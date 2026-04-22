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
│   │   └── src/schema/      # properties, agents, tasks, reviews tables
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

## LLM Model

Using `gpt-5.1` with `max_completion_tokens: 4096` for agents, 1024 for manager reviews.

## OpenAPI → Codegen Notes

- Spec lives at `lib/api-spec/openapi.yaml`
- Orval's Zod mode is set to `mode: "single"` to avoid duplicate exports
- Response Zod schemas are NOT used to parse API responses (Date objects from DB conflict with `type: string`); they serve as documentation/type reference only
- Input validation (request bodies, params, query) uses generated Zod schemas

## Workflows

- `artifacts/api-server: API Server` — runs `pnpm run dev` (build + start)
- `artifacts/dashboard: web` — runs `vite --host 0.0.0.0`
