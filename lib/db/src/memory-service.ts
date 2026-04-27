import { eq, and, or, isNull, desc, gt } from "drizzle-orm";
import { db } from "./index";
import {
  memoryEntriesTable,
  type InsertMemoryEntry,
  type MemoryType,
} from "./schema/memory";
import { reviewsTable } from "./schema/reviews";
import { tasksTable } from "./schema/tasks";
import { agentsTable } from "./schema/agents";

export interface WriteMemoryParams {
  propertyId: number;
  agentRole?: string | null;
  memoryType: MemoryType;
  content: string;
  metadata?: Record<string, unknown> | null;
  importanceScore?: number;
  expiresAt?: Date | null;
  sourceTaskId?: number | null;
  sourceReviewId?: number | null;
}

export async function writeMemory(params: WriteMemoryParams): Promise<void> {
  const row: InsertMemoryEntry = {
    propertyId: params.propertyId,
    agentRole: params.agentRole ?? null,
    memoryType: params.memoryType,
    content: params.content,
    metadata: params.metadata ?? null,
    importanceScore: params.importanceScore ?? 5,
    expiresAt: params.expiresAt ?? null,
    sourceTaskId: params.sourceTaskId ?? null,
    sourceReviewId: params.sourceReviewId ?? null,
  };
  await db.insert(memoryEntriesTable).values(row);
}

const SEO_KEYWORD_PATTERNS = [
  /^[-•*]\s+(.+)$/,
  /^\d+[.)]\s+(.+)$/,
  /^"(.+)"$/,
  /^`(.+)`$/,
];

function extractKeywords(output: string): string[] {
  const keywords: string[] = [];
  const lines = output.split("\n");
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    for (const pattern of SEO_KEYWORD_PATTERNS) {
      const m = line.match(pattern);
      if (m) {
        const kw = m[1].trim().replace(/[*_`'"]/g, "").trim();
        if (kw.length > 2 && kw.length < 120 && !kw.includes("\n")) {
          keywords.push(kw);
        }
        break;
      }
    }
  }
  return keywords.slice(0, 20);
}

function monthsFromNow(months: number): Date {
  return new Date(Date.now() + months * 30 * 24 * 60 * 60 * 1000);
}

export async function consolidateMemoryFromReview(reviewId: number): Promise<void> {
  const [row] = await db
    .select({
      reviewId: reviewsTable.id,
      decision: reviewsTable.decision,
      managerFeedback: reviewsTable.managerFeedback,
      managerScore: reviewsTable.managerScore,
      humanNotes: reviewsTable.humanNotes,
      taskId: tasksTable.id,
      taskOutput: tasksTable.output,
      taskInputPrompt: tasksTable.inputPrompt,
      propertyId: tasksTable.propertyId,
      agentRole: agentsTable.role,
    })
    .from(reviewsTable)
    .innerJoin(tasksTable, eq(reviewsTable.taskId, tasksTable.id))
    .innerJoin(agentsTable, eq(tasksTable.agentId, agentsTable.id))
    .where(eq(reviewsTable.id, reviewId));

  if (!row || !row.decision) return;

  const base = {
    propertyId: row.propertyId,
    agentRole: row.agentRole,
    sourceTaskId: row.taskId,
    sourceReviewId: row.reviewId,
  };

  if (row.decision === "approved" && row.taskOutput) {
    await writeMemory({
      ...base,
      memoryType: "brand_voice_sample",
      content: row.taskOutput,
      importanceScore: 7,
      metadata: { agentRole: row.agentRole },
    });

    if (row.agentRole === "seo_specialist") {
      const keywords = extractKeywords(row.taskOutput);
      for (const kw of keywords) {
        await writeMemory({
          ...base,
          memoryType: "seo_keyword",
          content: kw,
          importanceScore: 6,
          expiresAt: monthsFromNow(6),
          metadata: { agentRole: row.agentRole },
        });
      }
    }
  } else if (row.decision === "rejected") {
    const parts: string[] = [];
    if (row.managerFeedback) parts.push(`Manager feedback: ${row.managerFeedback}`);
    if (row.humanNotes) parts.push(`Human notes: ${row.humanNotes}`);
    const content = parts.join("\n\n") || "No feedback provided.";

    await writeMemory({
      ...base,
      memoryType: "rejection_reason",
      content,
      importanceScore: 9,
      metadata: {
        decision: row.decision,
        managerScore: row.managerScore ?? null,
        agentRole: row.agentRole,
      },
    });
  } else if (row.decision === "revision_requested" && row.taskOutput) {
    const feedbackParts: string[] = [];
    if (row.managerFeedback) feedbackParts.push(`Manager feedback: ${row.managerFeedback}`);
    if (row.humanNotes) feedbackParts.push(`Human notes: ${row.humanNotes}`);
    const feedback = feedbackParts.join("\n\n") || "No feedback provided.";

    await writeMemory({
      ...base,
      memoryType: "revision_delta",
      content: `Original output:\n${row.taskOutput}\n\nRevision requested:\n${feedback}`,
      importanceScore: 8,
      metadata: {
        decision: row.decision,
        managerScore: row.managerScore ?? null,
        agentRole: row.agentRole,
        taskPrompt: row.taskInputPrompt,
      },
    });
  }
}

export async function writeContentMemory(params: {
  propertyId: number;
  agentRole: string;
  taskId: number;
  title: string;
  output: string;
  platform: string;
  publishUrl: string | null;
}): Promise<void> {
  await writeMemory({
    propertyId: params.propertyId,
    agentRole: params.agentRole,
    memoryType: "content_entry",
    content: `${params.title}: ${params.output.slice(0, 500)}`,
    importanceScore: 6,
    metadata: {
      platform: params.platform,
      publishUrl: params.publishUrl,
      title: params.title,
    },
    sourceTaskId: params.taskId,
  });
}

export async function writeCampaignMemory(params: {
  propertyId: number;
  taskId: number;
  platform: string;
  campaignId: string | null;
  campaignName: string | null;
  outputSummary: string;
}): Promise<void> {
  await writeMemory({
    propertyId: params.propertyId,
    agentRole: "paid_specialist",
    memoryType: "campaign_entry",
    content: params.outputSummary,
    importanceScore: 7,
    expiresAt: monthsFromNow(3),
    metadata: {
      platform: params.platform,
      adCampaignId: params.campaignId,
      campaignName: params.campaignName,
    },
    sourceTaskId: params.taskId,
  });
}

const MEMORY_LIMITS: Record<string, number> = {
  brand_voice_sample: 2,
  rejection_reason: 3,
  revision_delta: 3,
  seo_keyword: 20,
  content_entry: 3,
  campaign_entry: 2,
};

const MEMORY_HEADINGS: Record<string, string> = {
  rejection_reason: "What To Avoid — Human Feedback (do not repeat these mistakes)",
  revision_delta: "Revision Patterns — What the client asked to change",
  brand_voice_sample: "Approved Outputs (brand voice reference)",
  seo_keyword: "SEO Keywords (use where relevant)",
  content_entry: "Recently Published Content",
  campaign_entry: "Recent Ad Campaigns",
};

export async function fetchMemoryContext(
  propertyId: number,
  agentRole: string,
): Promise<string> {
  const now = new Date();

  const rows = await db
    .select({
      memoryType: memoryEntriesTable.memoryType,
      content: memoryEntriesTable.content,
      importanceScore: memoryEntriesTable.importanceScore,
    })
    .from(memoryEntriesTable)
    .where(
      and(
        eq(memoryEntriesTable.propertyId, propertyId),
        or(
          eq(memoryEntriesTable.agentRole, agentRole),
          isNull(memoryEntriesTable.agentRole),
        ),
        or(
          isNull(memoryEntriesTable.expiresAt),
          gt(memoryEntriesTable.expiresAt, now),
        ),
      ),
    )
    .orderBy(
      desc(memoryEntriesTable.importanceScore),
      desc(memoryEntriesTable.createdAt),
    )
    .limit(120);

  if (rows.length === 0) return "";

  const byType: Record<string, string[]> = {};
  for (const row of rows) {
    const type = row.memoryType;
    if (!byType[type]) byType[type] = [];
    const limit = MEMORY_LIMITS[type] ?? 3;
    if (byType[type].length < limit) {
      byType[type].push(row.content);
    }
  }

  const typeOrder = [
    "rejection_reason",
    "revision_delta",
    "brand_voice_sample",
    "seo_keyword",
    "content_entry",
    "campaign_entry",
  ];
  const sections: string[] = [];

  for (const type of typeOrder) {
    const items = byType[type];
    if (!items || items.length === 0) continue;

    const heading = MEMORY_HEADINGS[type] ?? type;
    let formattedItems: string;

    if (type === "seo_keyword") {
      formattedItems = items.join(", ");
    } else if (type === "brand_voice_sample") {
      formattedItems = items
        .map((s, i) => `[Sample ${i + 1}]\n${s.slice(0, 600)}${s.length > 600 ? "…" : ""}`)
        .join("\n\n");
    } else {
      formattedItems = items
        .map((s) => `- ${s.slice(0, 300)}${s.length > 300 ? "…" : ""}`)
        .join("\n");
    }

    sections.push(`### ${heading}\n${formattedItems}`);
  }

  return sections.join("\n\n");
}
