# Plan — Create / Update Sourcefinch Project Documentation (`.md`)

## Context

The user asked to "analyse the project and create .md file which have all the info about project." A comprehensive `PROJECT_DOCUMENTATION.md` already exists at the repo root (675 lines, 13 sections covering: Executive Summary, Repo Layout, Quick Start, DB Schema, Config & Env, Backend, AI Service, Frontend, Data Flow Walkthroughs, Testing, Operational Notes, Limitations/Roadmap, Glossary).

Because the request is ambiguous (augment vs. create-new vs. condensed overview) the first action is to **clarify intent with the user** before any file is written. No source or doc changes will be made in this planning step.

## Current state of existing documentation

`C:\Users\adity\OneDrive\Desktop\Files\Projects\sourcefintch\sourcefintch\PROJECT_DOCUMENTATION.md` already contains:

- §1 Executive Summary + tech stack table + architecture diagram
- §2 Repository Layout (full tree)
- §3 Quick Start (prereqs, setup, dev run)
- §4 Database Schema (full DDL summary for users, repositories, files, code_chunks, conversations, messages)
- §5 Configuration & Environment (every env var across the three services)
- §6 Backend (Express architecture, middleware chain, controllers, models, routes)
- §7 AI Service (FastAPI app, parsers, schemas, services, embedding providers)
- §8 Frontend (Vite config, components, pages, services, theming)
- §9 Data Flow Walkthroughs (ingestion, chat, repo deletion, status polling)
- §10 Testing & Verification Scripts (table per service)
- §11 Operational Notes & Conventions
- §12 Known Limitations & Roadmap
- §13 Glossary

`README.md` and `frontend/README.md` also exist. Frontend is on Vercel (`sourcefintch.vercel.app`), backend + AI service on Render (`sourcefintch.onrender.com`, `sourcefintch-5.onrender.com`).

## Open question for the user

**What kind of `.md` do you actually want?** I see three reasonable interpretations; I recommend the first:

**Option A (Recommended) — Augment `PROJECT_DOCUMENTATION.md` with the deployment section that is currently missing.**
The existing doc covers everything except the live production deployment wiring (Vercel rewrites, Render env-var matrix, Clerk domain config, troubleshooting matrix for the 502/404/CORS issues we debugged). Adding a new §14 "Production Deployment" + §15 "Troubleshooting Playbook" would close the only real gap.

**Option B — Create a short `PROJECT_OVERVIEW.md` (1–2 pages) as a top-level pointer.**
A condensed "what is this, how do I run it, where do I look for X" doc, with links into the existing comprehensive `PROJECT_DOCUMENTATION.md`. Useful for first-time visitors; not a replacement.

**Option C — Rewrite `PROJECT_DOCUMENTATION.md` from scratch with today's actual code.**
Risk: a full rewrite can introduce drift (we'd need to re-grep every section to keep it accurate). High effort, low marginal value over Option A.

**My recommendation: Option A.** Cheapest, highest-value, and explicitly closes the only real gap (production deployment / live troubleshooting) surfaced during our recent debugging.

## Decision needed (one question)

Please confirm:
- **A** — Augment existing doc with a "Production Deployment" + "Troubleshooting" section
- **B** — Create a new short `PROJECT_OVERVIEW.md` as a top-level pointer
- **C** — Full rewrite of `PROJECT_DOCUMENTATION.md` from scratch
- Or specify a different scope.

## Once decided, the implementation plan (for the chosen option)

### Option A — Augment `PROJECT_DOCUMENTATION.md` (recommended)

Tasks for the implementation-capable agent:

1. **Append §14 — Production Deployment** with:
   - Deployed URLs table (Frontend / Backend / AI service)
   - Vercel project settings (Root Directory = `frontend`, Build = `npm run build`, Output = `dist`, Framework = Vite)
   - `frontend/vercel.json` rewrite rules (`/api/(.*)` → backend, catch-all → `index.html`)
   - Render Web Service settings (Root = `ai-service`, Build = `pip install -r requirements.txt`, Start = `uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 1`)
   - Full env-var matrix per service (key → value → consumed by)
   - Clerk Production instance setup (allowed redirect URLs, authorized domains, prod vs dev keys)
   - Qdrant Cloud setup note (Render cannot reach localhost)
   - Model lazy-load and Render 512 MiB note
   - Vite `VITE_*` vars require cache-free redeploy
2. **Append §15 — Troubleshooting Playbook** with the diagnostic patterns we've encountered:
   - 404 on `/api/*` from frontend → Vercel rewrite not deployed (Root Directory / cache)
   - "Unable to reach AI service" in UI → `VITE_AI_SERVICE_URL` wrong or AI service `CORS_ORIGIN` missing
   - 502 from AI service → OOM (now mitigated by lazy model load) or cold start
   - 401 from backend → Clerk key mismatch
   - "Repository in progress" 429 → auto-expire on `updated_at` > 30 min (recently added)
   - CORS preflight failure → `CORS_ORIGIN` env var
3. **No edits to existing §1–§13** — they are already accurate.
4. Validate: re-grep any version-sensitive content (URLs, env var names) against the actual code/config files before finalizing.

### Option B — Create new `PROJECT_OVERVIEW.md`

Tasks:
1. Create `PROJECT_OVERVIEW.md` (≤ 200 lines) with: one-paragraph product description, ASCII architecture diagram, link to `PROJECT_DOCUMENTATION.md` for full details, list of live URLs, 5-step "run locally" guide, "where to look for X" index.
2. No edits to existing files.

### Option C — Full rewrite

Not recommended. If chosen, the plan is to treat `PROJECT_DOCUMENTATION.md` as the source of truth, re-verify each section against current code by re-grepping, and rewrite any section that's drifted.

## Affected files

- `PROJECT_DOCUMENTATION.md` (Option A or C) — augmented/rewritten in place
- `PROJECT_OVERVIEW.md` (Option B) — new file at repo root

No source code, env vars, configs, or runtime behavior are affected.

## Risks

- Drift between doc and code if a section is hand-written and not re-verified — mitigated by re-grepping before commit.
- Vercel URL changed during this session (`ji1v` → bare `sourcefintch.vercel.app`); must use the current URL only.
- The doc must reflect the recent lazy-model-load and auto-expire changes.

## Out of scope

- Creating per-component API reference (already implicit in §6/§7/§8).
- Generating OpenAPI / Swagger (none exists; out of scope).
- Translating existing docs to other languages.

## Validation

After implementation, confirm:
1. `PROJECT_DOCUMENTATION.md` (or `PROJECT_OVERVIEW.md`) renders correctly on GitHub.
2. Every URL, env var, and command in the new sections is copy-paste runnable.
3. The deployment section matches the live Vercel/Render configuration we verified during the earlier diagnostic steps.

## Open question (recommendation: A)

**Which option (A / B / C / other) do you want?**
