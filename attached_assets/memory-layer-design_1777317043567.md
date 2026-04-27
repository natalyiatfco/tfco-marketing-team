# DMCC Memory Layer — Schema & Prompt Injection Design

---

## 1. DB Schema

### `lib/db/src/schema/memory.ts`

```typescript
import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  integer,
  index,
  vector,  // pgvector extension
} from "drizzle-orm/pg-core";
import { properties } from "./properties";
import { tasks } from "./tasks";

export const memoryTypeEnum = pgEnum("memory_type", [
  "approved_output",       // Full approved agent output
  "rejection_feedback",    // Human rejection reason + what was wrong
  "revision_delta",        // What changed between rejected → approved version
  "keyword_registry",      // SEO/ad keywords already used (Sam, Jordan)
  "campaign_history",      // Past campaign summaries (Jordan)
  "published_content",     // Titles/slugs/topics already published (Alex)
  "brand_voice_sample",    // Curated brand voice examples (all agents)
]);

export const agentRoleEnum = pgEnum("agent_role_memory", [
  "content_specialist",
  "seo_specialist",
  "paid_specialist",
  "social_media_specialist",
  "digital_marketing_analyst",
  "manager",
  "all",  // Property-wide memory accessible by any agent
]);

// Tier 1: Structured memory — fast retrieval, no embeddings
export const memoryEntries = pgTable(
  "memory_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    sourceTaskId: uuid("source_task_id")
      .references(() => tasks.id, { onDelete: "set null" }),
    agentRole: agentRoleEnum("agent_role").notNull(),
    memoryType: memoryTypeEnum("memory_type").notNull(),
    content: text("content").notNull(),       // The actual memory text
    metadata: text("metadata"),               // JSON string: keywords[], platform, etc.
    importanceScore: integer("importance_score").default(5), // 1-10, human can override
    createdAt: timestamp("created_at").defaultNow().notNull(),
    expiresAt: timestamp("expires_at"),       // Optional TTL (e.g. campaigns expire)
  },
  (table) => ({
    propertyAgentIdx: index("memory_property_agent_idx").on(
      table.propertyId,
      table.agentRole,
      table.memoryType
    ),
    createdAtIdx: index("memory_created_at_idx").on(table.createdAt),
  })
);

// Tier 2: Semantic memory — pgvector for brand voice similarity search
export const memoryEmbeddings = pgTable(
  "memory_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    memoryEntryId: uuid("memory_entry_id")
      .notNull()
      .references(() => memoryEntries.id, { onDelete: "cascade" }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id, { onDelete: "cascade" }),
    agentRole: agentRoleEnum("agent_role").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }).notNull(), // text-embedding-3-small
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    // HNSW index for fast ANN search
    embeddingIdx: index("memory_embedding_hnsw_idx")
      .using("hnsw", table.embedding.op("vector_cosine_ops")),
    propertyAgentIdx: index("embed_property_agent_idx").on(
      table.propertyId,
      table.agentRole
    ),
  })
);
```

### Migration prerequisite

Run this **before** `pnpm --filter @workspace/db run push` — Drizzle's push will fail if the `vector` type isn't registered yet:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Confirm it's active with: `SELECT extversion FROM pg_extension WHERE extname = 'vector';` — should return `0.8.0`.

---

## 2. Memory Service

### `lib/db/src/memory-service.ts`

```typescript
import { db } from "./index";
import { memoryEntries, memoryEmbeddings } from "./schema/memory";
import { tasks } from "./schema/tasks";
import { reviews } from "./schema/reviews";
import { eq, and, desc, gt, isNull, or, sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI();

// ─── Types ───────────────────────────────────────────────────────────────────

type AgentRole =
  | "content_specialist"
  | "seo_specialist"
  | "paid_specialist"
  | "social_media_specialist"
  | "digital_marketing_analyst"
  | "manager"
  | "all";

interface MemoryContext {
  approvedOutputs: string[];
  rejectionFeedback: string[];
  revisionDeltas: string[];
  domainSpecific: string[];   // keywords, campaigns, published content
  brandVoiceSamples: string[]; // semantic search results
}

// ─── Write: called after review decision ─────────────────────────────────────

export async function consolidateMemoryFromReview(reviewId: string) {
  // Fetch review + task in one query
  const result = await db
    .select({
      review: reviews,
      task: tasks,
    })
    .from(reviews)
    .innerJoin(tasks, eq(tasks.id, reviews.taskId))
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!result.length) return;
  const { review, task } = result[0];
  if (!task.propertyId || !task.agentRole || !task.output) return;

  const propertyId = task.propertyId;
  const agentRole = task.agentRole as AgentRole;

  if (review.decision === "approved") {
    // Store approved output
    const entry = await db
      .insert(memoryEntries)
      .values({
        propertyId,
        sourceTaskId: task.id,
        agentRole,
        memoryType: "approved_output",
        content: task.output,
        importanceScore: 7,
      })
      .returning();

    // Embed for semantic search (brand voice, content specialist + social only)
    if (
      agentRole === "content_specialist" ||
      agentRole === "social_media_specialist"
    ) {
      await embedAndStore(entry[0].id, propertyId, agentRole, task.output);
    }

    // For SEO/paid: extract and store keyword/campaign registries
    if (agentRole === "seo_specialist") {
      await storeKeywordRegistry(propertyId, task.output, task.id);
    }
    if (agentRole === "paid_specialist") {
      await storeCampaignHistory(propertyId, task.output, task.id);
    }
  }

  if (review.decision === "rejected" && review.feedback) {
    await db.insert(memoryEntries).values({
      propertyId,
      sourceTaskId: task.id,
      agentRole,
      memoryType: "rejection_feedback",
      content: `Task prompt: "${task.prompt}"\nFeedback: ${review.feedback}`,
      importanceScore: 9, // Rejections are high signal
    });
  }

  if (review.decision === "revision_requested" && review.feedback) {
    // Store both the feedback AND the original output so agents can see the delta
    await db.insert(memoryEntries).values({
      propertyId,
      sourceTaskId: task.id,
      agentRole,
      memoryType: "revision_delta",
      content: `Original output:\n${task.output}\n\nRevision requested:\n${review.feedback}`,
      importanceScore: 8,
    });
  }
}

// ─── Read: called before each agent LLM call ─────────────────────────────────

export async function fetchMemoryContext(
  propertyId: string,
  agentRole: AgentRole,
  currentPrompt: string,
  options: {
    maxApproved?: number;
    maxRejections?: number;
    maxDomainSpecific?: number;
    semanticTopK?: number;
    recencyDays?: number;
  } = {}
): Promise<MemoryContext> {
  const {
    maxApproved = 3,
    maxRejections = 5,
    maxDomainSpecific = 10,
    semanticTopK = 3,
    recencyDays = 90,
  } = options;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - recencyDays);

  // Base filter: this property + (this agent role OR "all")
  const roleFilter = or(
    eq(memoryEntries.agentRole, agentRole),
    eq(memoryEntries.agentRole, "all")
  );
  const propertyFilter = eq(memoryEntries.propertyId, propertyId);
  const notExpired = or(
    isNull(memoryEntries.expiresAt),
    gt(memoryEntries.expiresAt, new Date())
  );
  const recencyFilter = gt(memoryEntries.createdAt, cutoff);

  // Fetch approved outputs
  const approved = await db
    .select({ content: memoryEntries.content })
    .from(memoryEntries)
    .where(
      and(
        propertyFilter,
        roleFilter,
        notExpired,
        recencyFilter,
        eq(memoryEntries.memoryType, "approved_output")
      )
    )
    .orderBy(desc(memoryEntries.importanceScore), desc(memoryEntries.createdAt))
    .limit(maxApproved);

  // Fetch rejection feedback
  const rejections = await db
    .select({ content: memoryEntries.content })
    .from(memoryEntries)
    .where(
      and(
        propertyFilter,
        roleFilter,
        notExpired,
        eq(memoryEntries.memoryType, "rejection_feedback")
      )
    )
    .orderBy(desc(memoryEntries.importanceScore), desc(memoryEntries.createdAt))
    .limit(maxRejections);

  // Fetch revision deltas
  const deltas = await db
    .select({ content: memoryEntries.content })
    .from(memoryEntries)
    .where(
      and(
        propertyFilter,
        roleFilter,
        notExpired,
        eq(memoryEntries.memoryType, "revision_delta")
      )
    )
    .orderBy(desc(memoryEntries.createdAt))
    .limit(3);

  // Fetch domain-specific memory (keywords, campaigns, published)
  const domainTypes = getDomainMemoryTypes(agentRole);
  const domainSpecific =
    domainTypes.length > 0
      ? await db
          .select({ content: memoryEntries.content })
          .from(memoryEntries)
          .where(
            and(
              propertyFilter,
              roleFilter,
              notExpired,
              sql`${memoryEntries.memoryType} = ANY(${domainTypes})`
            )
          )
          .orderBy(desc(memoryEntries.createdAt))
          .limit(maxDomainSpecific)
      : [];

  // Semantic search for brand voice (only for content/social roles)
  let brandVoiceSamples: string[] = [];
  if (
    (agentRole === "content_specialist" ||
      agentRole === "social_media_specialist") &&
    semanticTopK > 0
  ) {
    brandVoiceSamples = await semanticSearch(
      propertyId,
      agentRole,
      currentPrompt,
      semanticTopK
    );
  }

  return {
    approvedOutputs: approved.map((r) => r.content),
    rejectionFeedback: rejections.map((r) => r.content),
    revisionDeltas: deltas.map((r) => r.content),
    domainSpecific: domainSpecific.map((r) => r.content),
    brandVoiceSamples,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDomainMemoryTypes(agentRole: AgentRole): string[] {
  switch (agentRole) {
    case "seo_specialist":
      return ["keyword_registry", "published_content"];
    case "paid_specialist":
      return ["campaign_history", "keyword_registry"];
    case "content_specialist":
      return ["published_content"];
    default:
      return [];
  }
}

async function embedAndStore(
  memoryEntryId: string,
  propertyId: string,
  agentRole: AgentRole,
  text: string
) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text.slice(0, 8000), // Stay within token limits
  });

  await db.insert(memoryEmbeddings).values({
    memoryEntryId,
    propertyId,
    agentRole,
    embedding: response.data[0].embedding as unknown as string,
  });
}

async function semanticSearch(
  propertyId: string,
  agentRole: AgentRole,
  queryText: string,
  topK: number
): Promise<string[]> {
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: queryText.slice(0, 8000),
    });
    const queryEmbedding = response.data[0].embedding;

    const results = await db.execute(sql`
      SELECT me.content
      FROM memory_embeddings emb
      JOIN memory_entries me ON me.id = emb.memory_entry_id
      WHERE emb.property_id = ${propertyId}
        AND (emb.agent_role = ${agentRole} OR emb.agent_role = 'all')
        AND me.expires_at IS NULL OR me.expires_at > NOW()
      ORDER BY emb.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
      LIMIT ${topK}
    `);

    return (results.rows as { content: string }[]).map((r) => r.content);
  } catch {
    // Semantic search is best-effort; don't break agent execution
    return [];
  }
}

async function storeKeywordRegistry(
  propertyId: string,
  output: string,
  taskId: string
) {
  // Extract keyword list from Sam's structured output
  const keywordMatch = output.match(/keywords?[:\s]+([^\n]+)/gi);
  if (!keywordMatch) return;

  const keywords = keywordMatch
    .flatMap((line) => line.replace(/keywords?[:\s]+/i, "").split(","))
    .map((k) => k.trim())
    .filter(Boolean);

  if (keywords.length === 0) return;

  await db.insert(memoryEntries).values({
    propertyId,
    sourceTaskId: taskId,
    agentRole: "seo_specialist",
    memoryType: "keyword_registry",
    content: `Previously targeted keywords: ${keywords.join(", ")}`,
    metadata: JSON.stringify({ keywords }),
    importanceScore: 6,
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 6 months
  });
}

async function storeCampaignHistory(
  propertyId: string,
  output: string,
  taskId: string
) {
  // Jordan's structured output already delineates Google/Meta sections
  const googleMatch = output.match(
    /===GOOGLE ADS CAMPAIGN===([\s\S]*?)===END GOOGLE ADS===/
  );
  const metaMatch = output.match(
    /===META ADS CAMPAIGN===([\s\S]*?)===END META ADS===/
  );

  const summaries: string[] = [];
  if (googleMatch)
    summaries.push(`Google Ads campaign created:\n${googleMatch[1].trim()}`);
  if (metaMatch)
    summaries.push(`Meta Ads campaign created:\n${metaMatch[1].trim()}`);

  if (summaries.length === 0) return;

  await db.insert(memoryEntries).values({
    propertyId,
    sourceTaskId: taskId,
    agentRole: "paid_specialist",
    memoryType: "campaign_history",
    content: summaries.join("\n\n"),
    importanceScore: 7,
    expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 3 months
  });
}
```

---

## 3. Prompt Injection Pattern

### `lib/integrations-openai-ai-server/src/build-system-prompt.ts`

```typescript
import type { MemoryContext } from "../../../lib/db/src/memory-service";

interface AgentConfig {
  name: string;
  role: string;
  property: {
    name: string;
    description: string;
    brandGuidelines?: string;
  };
}

export function buildSystemPrompt(
  agent: AgentConfig,
  memory: MemoryContext
): string {
  const sections: string[] = [
    buildIdentitySection(agent),
    buildMemorySection(memory),
    buildOutputFormatSection(agent.role),
  ];

  return sections.filter(Boolean).join("\n\n");
}

function buildIdentitySection(agent: AgentConfig): string {
  return `You are ${agent.name}, a ${agent.role.replace(/_/g, " ")} at a hospitality marketing agency.
You are currently working on: ${agent.property.name}
${agent.property.description}
${agent.property.brandGuidelines ? `\nBrand guidelines:\n${agent.property.brandGuidelines}` : ""}`;
}

function buildMemorySection(memory: MemoryContext): string {
  const parts: string[] = [];

  // Brand voice — from semantic search, highest fidelity signal
  if (memory.brandVoiceSamples.length > 0) {
    parts.push(
      `## BRAND VOICE REFERENCE\nThe following are approved examples that represent this brand's voice and style. Match this tone precisely:\n\n${memory.brandVoiceSamples
        .map((s, i) => `[Example ${i + 1}]\n${truncate(s, 600)}`)
        .join("\n\n")}`
    );
  }

  // What NOT to do — rejection feedback is highest-importance signal
  if (memory.rejectionFeedback.length > 0) {
    parts.push(
      `## WHAT TO AVOID (HUMAN FEEDBACK)\nThe following outputs were rejected by the client. Understand exactly what went wrong and do not repeat these mistakes:\n\n${memory.rejectionFeedback
        .map((f, i) => `[Rejection ${i + 1}]\n${truncate(f, 400)}`)
        .join("\n\n")}`
    );
  }

  // Revision patterns
  if (memory.revisionDeltas.length > 0) {
    parts.push(
      `## REVISION PATTERNS\nThese show what the client asked to change after initial submission. Learn from the direction of the edits:\n\n${memory.revisionDeltas
        .map((d, i) => `[Revision ${i + 1}]\n${truncate(d, 400)}`)
        .join("\n\n")}`
    );
  }

  // Domain-specific registries
  if (memory.domainSpecific.length > 0) {
    parts.push(
      `## PRIOR WORK REGISTRY\nAvoid duplicating the following work already completed for this property:\n\n${memory.domainSpecific
        .map((d) => truncate(d, 300))
        .join("\n")}`
    );
  }

  if (parts.length === 0) return "";

  return `---\n# MEMORY CONTEXT\n${parts.join("\n\n")}\n---`;
}

function buildOutputFormatSection(role: string): string {
  // These enforce the structured output delimiters already expected by the parser
  const formats: Record<string, string> = {
    paid_specialist: `Your output MUST use these exact section delimiters:
===GOOGLE ADS CAMPAIGN===
...
===END GOOGLE ADS===
===META ADS CAMPAIGN===
...
===END META ADS===`,
    social_media_specialist: `Your output MUST use these exact section delimiters:
===INSTAGRAM===...===END INSTAGRAM===
===FACEBOOK===...===END FACEBOOK===
===TWITTER/X===...===END TWITTER===
===LINKEDIN===...===END LINKEDIN===`,
  };

  return formats[role] ?? "";
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "…";
}
```

---

## 4. Integration into Agent Execution Flow

### Modified agent execution in `artifacts/api-server/src/routes/tasks.ts`

The key change is the two lines added before the LLM call:

```typescript
import {
  fetchMemoryContext,
  consolidateMemoryFromReview,
} from "@workspace/db/memory-service";
import { buildSystemPrompt } from "@workspace/integrations-openai-ai-server/build-system-prompt";

// BEFORE (current):
setImmediate(async () => {
  const output = await runAgent(task, agent, property);
  await db.update(tasks)
    .set({ output, status: "reviewing" })
    .where(eq(tasks.id, task.id));
  await runManagerReview(task.id);
});

// AFTER (with memory):
setImmediate(async () => {
  // 1. Fetch memory context (parallel: structured + semantic)
  const memory = await fetchMemoryContext(
    task.propertyId,
    agent.role,
    task.prompt,
    {
      // Tune per agent role
      maxApproved: agent.role === "content_specialist" ? 2 : 3,
      maxRejections: 5,
      semanticTopK: agent.role === "paid_specialist" ? 0 : 3,
    }
  );

  // 2. Build system prompt with injected memory
  const systemPrompt = buildSystemPrompt(
    { name: agent.name, role: agent.role, property },
    memory
  );

  // 3. Run agent with memory-enriched prompt
  const output = await runAgent(task, agent, property, systemPrompt);

  await db.update(tasks)
    .set({ output, status: "reviewing" })
    .where(eq(tasks.id, task.id));

  await runManagerReview(task.id);
});
```

### Trigger memory write after human decision in `POST /reviews/:id/decide`:

```typescript
// At the end of the decide handler, after updating review status.
// Blocking — the HTTP response does not return until memory is written.
// This guarantees memory is available for any task dispatched immediately after approval.
await consolidateMemoryFromReview(reviewId);
```

---

## 5. Casey's Manager Review Enhancement

Since Casey now gets memory context too, its review can explicitly reference what past rejections looked like:

```typescript
// In manager review system prompt:
const caseyMemory = await fetchMemoryContext(
  task.propertyId,
  "manager",
  task.output,  // Casey reviews the OUTPUT, not the original prompt
  {
    maxRejections: 8,     // Casey needs more rejection history
    maxApproved: 2,
    semanticTopK: 0,      // No brand voice needed for review role
    recencyDays: 180,     // Longer window for pattern detection
  }
);
```

Add a `confidence_score` field to the `reviews` table (integer 1–10). Prompt Casey to emit it explicitly:

```
Rate your confidence that a human will approve this (1–10).
If confidence < 7, flag specific concerns.
Emit: CONFIDENCE: <score>
```

Route tasks with `confidence_score < 7` to a **"Needs Attention"** bucket in the Approvals queue UI.

---

## 6. Schema Registration

Add to `lib/db/src/schema/index.ts`:
```typescript
export * from "./memory";
```

Add to `lib/db/src/schema/relations.ts`:
```typescript
export const memoryEntriesRelations = relations(memoryEntries, ({ one }) => ({
  property: one(properties, {
    fields: [memoryEntries.propertyId],
    references: [properties.id],
  }),
  sourceTask: one(tasks, {
    fields: [memoryEntries.sourceTaskId],
    references: [tasks.id],
  }),
}));
```

Then run:
```bash
pnpm --filter @workspace/db run push
```

---

## Summary: Data Flow

```
Human approves review
        │
        ▼
consolidateMemoryFromReview()
  ├── approved_output    → memory_entries
  ├── rejection_feedback → memory_entries (importanceScore: 9)
  ├── revision_delta     → memory_entries
  ├── keyword_registry   → memory_entries (Sam/Jordan)
  ├── campaign_history   → memory_entries (Jordan)
  └── brand_voice_sample → memory_entries + memory_embeddings (Alex/Morgan)

Next task dispatched
        │
        ▼
fetchMemoryContext()
  ├── Structured query  → approved, rejections, deltas, domain-specific
  └── pgvector ANN      → top-K brand voice samples (cosine similarity)
        │
        ▼
buildSystemPrompt()     → identity + MEMORY CONTEXT block + output format
        │
        ▼
runAgent(systemPrompt)  → LLM call with full context
```
