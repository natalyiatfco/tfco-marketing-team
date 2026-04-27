# Digital Marketing Command Center (DMCC)

## Overview

Multi-brand hospitality marketing platform. 7 restaurant/bar properties, each with a brand profile. 6 AI "employee" agents produce marketing deliverables, with a hybrid approval workflow: AI Manager reviews first, then human approves/rejects/requests revision.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- **Build**: esbuild (ESM bundle)
- **Frontend**: React + Vite + React Query

## Architecture

```
workspace/
├── artifacts/
│   ├── api-server/          # Express API (port from $PORT, typically 8080)
│   │   └── src/routes/      # properties, agents, tasks, reviews, dashboard
│   └── dashboard/           # React frontend (port from $PORT)
├── lib/
│   ├── api-spec/            # OpenAPI spec + orval config (codegen source of truth)
│   ├── api-client-react/    # React Query hooks (auto-generated)
│   ├── api-zod/             # Zod schemas (auto-generated)
│   ├── db/                  # Drizzle schema + migrations
│   │   ├── src/schema/      # properties, agents, tasks, reviews, memory tables
│   │   └── src/memory-service.ts  # writeMemory, consolidateMemoryFromReview, writeContentMemory, writeCampaignMemory
│   └── integrations-openai-ai-server/  # OpenAI client (Replit-managed auth)
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run seed` — seed 6 agents + 7 properties
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## AI Agents

| Agent  | Role                    | Color   |
|--------|-------------------------|---------|
| Alex   | content_specialist      | Purple  |
| Sam    | seo_specialist          | Green   |
| Jordan | paid_specialist         | Red     |
| Morgan | social_media_specialist | Amber   |
| Riley  | digital_marketing_analyst | Cyan  |
| Casey  | manager (auto-reviewer) | Blue    |

## Properties (7 Brands)

1. The Grand Terrace — upscale rooftop fine dining
2. Saltwater Grille — coastal seafood restaurant
3. Casa Madera — Mexican restaurant & mezcal bar
4. The Hearth — neighborhood American bistro
5. Nomo Ramen — modern Japanese ramen bar
6. Verde Kitchen — plant-forward fast-casual
7. Copper & Oak — whiskey bar & chophouse

## Task Lifecycle

1. Human dispatches task → POST /tasks (agent + property + prompt)
2. API responds immediately (status: "running")
3. Agent LLM call executes via `setImmediate` (non-blocking)
4. Output saved → status: "reviewing"
5. Manager agent (Casey) auto-reviews → creates review record
6. Task status → "completed"
7. Human sees review in Approvals queue → POST /reviews/:id/decide
8. For approved content/SEO tasks: POST /tasks/:id/publish → pushes to WordPress or Squarespace
9. For approved paid_specialist tasks: POST /tasks/:id/push-ads → pushes PAUSED campaign to Google Ads or Meta Ads

## Ad Platform Integration (Task #3)

### Properties — New Ad Fields
- `googleAdsCustomerId` — stored in DB (plaintext, numeric)
- `googleAdsRefreshToken` — AES-256-GCM encrypted at rest
- `metaAdsAccountId` — stored in DB (plaintext, numeric)
- `metaAdsAccessToken` — AES-256-GCM encrypted at rest
- `googleAdsConfigured` / `metaAdsConfigured` — boolean flags (safe response)

### Tasks — New Ad Fields
- `adPushStatus` — push status (null | "success" | "failed")
- `adCampaignId` — returned campaign ID from platform
- `adPlatform` — "google_ads" | "meta_ads"
- `adPushedAt` — timestamp

### Push-Ads Route (`/tasks/:id/push-ads`)
- Only accessible for `paid_specialist` tasks
- Must be approved with review decision
- Google Ads: OAuth2 token refresh → create Budget → create Campaign (PAUSED)
- Meta Ads: Marketing API v21.0 → create Campaign (PAUSED)
- Required env vars: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`

### Structured Output Formats
Jordan (paid_specialist) emits:
- `===GOOGLE ADS CAMPAIGN===...===END GOOGLE ADS===` with ad groups, keywords, headlines
- `===META ADS CAMPAIGN===...===END META ADS===` with audience + creative fields

Morgan (social_media_specialist) emits:
- `===INSTAGRAM===...===END INSTAGRAM===`
- `===FACEBOOK===...===END FACEBOOK===`
- `===TWITTER/X===...===END TWITTER===`
- `===LINKEDIN===...===END LINKEDIN===`

Dashboard task-detail page parses these sections and renders them as formatted platform cards.

## LLM Model

Using `gpt-5.1` with `max_completion_tokens: 4096` for agents, 1024 for manager reviews.

## OpenAPI → Codegen Notes

- Spec lives at `lib/api-spec/openapi.yaml`
- Orval's Zod mode is set to `mode: "single"` to avoid duplicate exports
- Response Zod schemas are NOT used to parse API responses (Date objects from DB conflict with `type: string`); they serve as documentation/type reference only
- Input validation (request bodies, params, query) uses generated Zod schemas

## Agent Memory Layer (Task #33 — write side)

Per-property persistent memory so each LLM call accumulates context from prior interactions.

### Tables
- `memory_entries` — stores text content with type, property FK, optional agent role, FKs to task/review
- `memory_embeddings` — stores `vector(1536)` embeddings with HNSW cosine index; FK to `memory_entries`

### Memory Types
| Type | Trigger |
|------|---------|
| `brand_voice_sample` | Review decision = approved |
| `rejection_reason` | Review decision = rejected or revision_requested |
| `seo_keyword` | Approved seo_specialist output (extracted keywords) |
| `content_entry` | CMS publish success (publish.ts) |
| `campaign_entry` | Ad platform push success (push-ads.ts) |

### Write-Side Functions (lib/db/src/memory-service.ts)
- `writeMemory(params)` — insert a single memory entry
- `consolidateMemoryFromReview(reviewId)` — called via `setImmediate` after `/reviews/:id/decide`
- `writeContentMemory(params)` — called after CMS publish
- `writeCampaignMemory(params)` — called after ad platform push

### Drizzle Relations
`lib/db/src/schema/relations.ts` defines full relation graph for all tables (used by Task #34 read paths).

## Workflows

- `artifacts/api-server: API Server` — runs `pnpm run dev` (build + start)
- `artifacts/dashboard: web` — runs `vite --host 0.0.0.0`
