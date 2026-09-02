# Sourcefinch — Final Project Documentation

> **AI-powered codebase intelligence** — connect a GitHub repository, ask natural-language questions about the code, and receive grounded answers with file-and-line citations.

This single document consolidates every meaningful file in the Sourcefinch repository (frontend, backend, AI service, infrastructure, scripts, tests, configuration) so a new engineer can understand the system end-to-end without spelunking through individual files.

---

## 1. Executive Summary

**Sourcefinch** is a three-tier web application that ingests public GitHub repositories, parses their source code into semantic chunks using AST-aware techniques (tree-sitter for Python / JavaScript / TypeScript, regex/fixed-line fallback for everything else), generates dense vector embeddings, and stores them in a Qdrant vector database. Users then ask natural-language questions in a chat UI; the system retrieves the most relevant code chunks, feeds them as context to an LLM (Groq, with Ollama/Mock fallbacks), and streams back a citation-backed answer.

### Tech Stack

| Layer            | Technology                                         | Purpose                                          |
| ---------------- | -------------------------------------------------- | ------------------------------------------------ |
| Frontend         | React 19 + TypeScript + Vite 8                     | UI framework                                     |
| Styling          | Tailwind CSS v4 (utility-first) + Radix UI         | Visual design + accessible primitives            |
| Animation        | Motion (Framer Motion v13) + GSAP + OGL shaders    | Cinematic motion, shader backgrounds             |
| Backend          | Node.js + Express 5                                | REST API, auth, orchestration                    |
| Authentication   | Clerk (`@clerk/express`, `@clerk/clerk-react`)     | Identity + session management                    |
| Relational DB    | MySQL 8 (InnoDB / utf8mb4)                         | Users, repos, files, conversations, messages     |
| Vector DB        | Qdrant 1.11+                                       | Code embeddings + semantic search                |
| Embeddings       | sentence-transformers (local, all-MiniLM-L6-v2) / Gemini `gemini-embedding-001` | 384-d (local) or 768-d (Gemini MRL) vectors |
| AI Orchestration | Python + FastAPI + Pydantic Settings               | Code parsing, chunking, retrieval, LLM calls     |
| LLM Providers    | Groq (`openai/gpt-oss-20b`), Ollama, Mock          | Answer generation with grounding                 |
| Code Parsing     | tree-sitter (python / javascript / typescript)     | AST-aware semantic chunking                      |
| Token Counting   | tiktoken (`cl100k_base`)                           | Pre-flight payload sizing for Groq 8k TPM        |
| Testing          | node:test, pytest                                  | Unit + integration tests                         |

### Top-Level Architecture

```
┌────────────────┐       ┌──────────────────────┐       ┌──────────────────────┐
│   Frontend     │──────▶│   Node Backend       │       │  Python AI Service   │
│  React + Vite  │       │   Express :3001      │       │  FastAPI  :8000      │
│     :5173      │──────▶│   /api/*             │       │  /ai/parse, /ai/chat │
└────────────────┘       └─────────┬────────────┘       └──────────────────────┘
       │                            │                              │
       │                            ▼                              ▼
       │                    ┌────────────────┐             ┌────────────────┐
       │                    │     MySQL      │             │    Qdrant      │
       │                    │     :3306      │             │     :6333      │
       │                    └────────────────┘             └────────────────┘
       │
       └─── Calls AI service directly via VITE_AI_SERVICE_URL (CORS-enabled)
```

The **frontend** talks to both services independently:
- `/api/*` calls are proxied by Vite to the Node backend during development.
- AI service calls (e.g., `/health` from the dashboard) go direct using `VITE_AI_SERVICE_URL`.

The **Node backend** orchestrates:
- Clerk session validation, repository ingestion, and CRUD endpoints.
- Service-to-service calls to the AI service using a shared `INTERNAL_API_SECRET`.

The **AI service** handles:
- Repository parsing (tree-sitter chunking).
- Embedding generation (local sentence-transformers or Gemini).
- Qdrant upsert / search.
- RAG orchestration: retrieval, context trimming, prompt construction, LLM call, retry, citation formatting.

---

## 2. Repository Layout

```
sourcefinch/
├── README.md                         Project overview & quick-start
├── replit.png, *.png                 Brand assets
│
├── frontend/                         React + Vite + TypeScript + Tailwind
│   ├── index.html, vite.config.ts, tsconfig*.json, package.json, .oxlintrc.json
│   ├── public/                       Static assets (logo.png, favicon.svg, landing.html)
│   ├── README.md                     Vite template notes
│   └── src/
│       ├── main.tsx                  React root
│       ├── App.tsx                   ClerkProvider + Router + AnimatePresence
│       ├── index.css                 Global styles + design tokens
│       ├── styles/                   fonts.css, tokens.css (design system)
│       ├── lib/utils.ts              Shared utility helpers
│       ├── types/index.ts            Shared TypeScript types
│       ├── services/
│       │   ├── api.ts                HTTP helpers (health, repos, chat, files)
│       │   └── useApiClient.ts       Stable, memoized authed-fetch client
│       ├── components/               UI primitives (see §8)
│       ├── pages/                    Route-level pages (see §8)
│       └── components/ui/            Button, Card, Modal, Badge, Banner,
│                                     Skeleton, StatusDot, ThemeToggle,
│                                     PromptInputBox, FileTree, ... (see §8)
│
├── backend/                          Node.js + Express
│   ├── package.json, nodemon.json
│   ├── migrations/                   SQL DDL (see §4)
│   ├── scripts/                      migrate.js, inspect_repos.js, verification scripts
│   ├── .env / .env.example
│   └── src/
│       ├── server.js                 app.listen() entry point
│       ├── app.js                    Express app + middleware chain
│       ├── config/                   environment.js, database.js (MySQL pool)
│       ├── controllers/              health, repository, chat, chunk, conversation
│       ├── middleware/               clerk, requireAuth, requireAuthOrInternal,
│       │                             requireInternalSecret, errorHandler, notFound
│       ├── models/                   User, Repository, File, CodeChunk,
│       │                             Conversation, Message + barrel index.js
│       ├── routes/                   health, repository, chat, chunk, conversation
│       ├── services/                 githubService.js, ingestionService.js
│       └── utils/                    githubUrlParser.js + tests, sqlParams.js
│
└── ai-service/                       Python + FastAPI
    ├── requirements.txt, pytest.ini, run.py, .env / .env.example
    ├── tests/                        pytest + verification scripts (see §10)
    └── app/
        ├── main.py                   FastAPI app + global error handlers
        ├── config.py                 Pydantic Settings (typed env config)
        ├── api/                      chat.py, indexing.py, health.py
        ├── parsers/                  base_parser.py, python_parser.py,
        │                             javascript_parser.py, generic_parser.py
        ├── schemas/                  chat.py, indexing.py (Pydantic models)
        └── services/                 code_parser.py (orchestrator), chunking_service.py,
                                      embedding_service.py, vector_service.py,
                                      retrieval_service.py, rag_service.py,
                                      message_router.py, llm_service.py,
                                      node_internal_client.py
```

---

## 3. Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+
- MySQL 8.0+ (local or cloud — Aiven, PlanetScale, etc.)
- Qdrant 1.11+ (local Docker or cloud)
- A Groq API key from <https://console.groq.com>
- A Clerk account (publishable + secret key)

### Setup

```bash
# 1. Copy env templates
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
cp frontend/.env.example frontend/.env

# 2. Create database + run migrations
mysql -u root -p -e "CREATE DATABASE sourcefinch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
cd backend && npm install && npm run migrate

# 3. Start backend (:3001)
npm run dev

# 4. Start AI service (:8000)
cd ../ai-service
python -m venv venv
.\venv\Scripts\Activate.ps1      # Windows
pip install -r requirements.txt
python run.py

# 5. Start frontend (:5173)
cd ../frontend
npm install
npm run dev
```

### Verification

| Command                                  | Expected                                                |
| ---------------------------------------- | ------------------------------------------------------- |
| `curl localhost:3001/api/health`         | `{"status":"ok","service":"sourcefinch-backend", ...}`  |
| `curl localhost:8000/health`             | `{"status":"ok","service":"sourcefinch-ai"}`            |
| Open `localhost:5173`                    | Landing page renders, dashboard shows both services     |
| Open `localhost:8000/docs`               | Swagger UI loads                                        |
| MySQL: `SHOW TABLES` in `sourcefinch`    | 6 tables + `schema_migrations`                          |

---

## 4. Database Schema (`backend/migrations/001_initial_schema.sql`)

A single consolidated migration recreates the schema in one pass (the previous numbered files have been merged).

### `users` — Clerk identity mirror
| Column       | Type             | Notes                              |
| ------------ | ---------------- | ---------------------------------- |
| id           | VARCHAR(255) PK  | Clerk userId (`user_2abc...`)      |
| email        | VARCHAR(255) UQ  | Lazy from `sessionClaims.email`    |
| name         | VARCHAR(255)     | Lazy from `sessionClaims`          |
| created_at   | TIMESTAMP        | default CURRENT_TIMESTAMP          |

Identity is **owned entirely by Clerk**. There is no password column. Foreign keys in `repositories` and `conversations` use `VARCHAR(255)` to match.

### `repositories`
| Column        | Type / Constraint                                       |
| ------------- | ------------------------------------------------------- |
| id            | INT AUTO_INCREMENT PK                                    |
| user_id       | VARCHAR(255) → users.id (ON DELETE CASCADE)             |
| name          | VARCHAR(255) NOT NULL                                   |
| owner         | VARCHAR(255) NOT NULL                                   |
| github_url    | VARCHAR(2048) NOT NULL                                  |
| branch        | VARCHAR(255) DEFAULT 'main'                             |
| status        | ENUM('pending','cloning','scanning','storing','embedding','completed','failed') |
| file_count    | INT DEFAULT 0                                           |
| created_at, updated_at | TIMESTAMP                                  |

### `files`
| Column         | Type                                            |
| -------------- | ----------------------------------------------- |
| id             | INT AUTO_INCREMENT PK                           |
| repository_id  | INT → repositories.id (CASCADE)                 |
| file_path      | VARCHAR(1024)                                   |
| language       | VARCHAR(50)                                     |
| file_size      | INT                                             |
| **content**    | **LONGTEXT** (raw source — needed for line-permalinks) |
| created_at     | TIMESTAMP                                       |

### `code_chunks` — metadata + pointer (NO `content` column)
| Column          | Type                                          |
| --------------- | --------------------------------------------- |
| id              | INT AUTO_INCREMENT PK                         |
| file_id         | INT → files.id (CASCADE)                      |
| **qdrant_point_id** | VARCHAR(36) UUID → points to full chunk in Qdrant |
| start_line      | INT (1-indexed)                               |
| end_line        | INT (1-indexed, inclusive)                    |
| language        | VARCHAR(50)                                   |

> The actual chunk text lives **only in Qdrant** to avoid duplication and sync drift.

### `conversations`
| Column         | Type                                            |
| -------------- | ----------------------------------------------- |
| id             | INT AUTO_INCREMENT PK                           |
| user_id        | VARCHAR(255) → users.id (CASCADE)               |
| repository_id  | INT → repositories.id (**SET NULL** on delete)  |
| title          | VARCHAR(500) DEFAULT 'New Conversation'         |
| created_at, updated_at | TIMESTAMP                                |

### `messages`
| Column         | Type                                          |
| -------------- | --------------------------------------------- |
| id             | INT AUTO_INCREMENT PK                         |
| conversation_id| INT → conversations.id (CASCADE)              |
| role           | ENUM('user','assistant')                      |
| content        | TEXT                                          |
| **sources**    | JSON (citation objects, nullable)             |
| created_at     | TIMESTAMP                                     |

### Migration runner (`backend/scripts/migrate.js`)
- Creates `schema_migrations(filename UNIQUE, run_at)` for tracking.
- Reads `migrations/*.sql` alphabetically; idempotent (skips already-applied files).
- Strips `--` line comments before splitting on `;`.
- Records each applied file in the tracking table.

---

## 5. Configuration & Environment

### `backend/.env`
| Var | Default | Purpose |
| --- | ------- | ------- |
| `PORT`                  | 3001                  | Backend port                       |
| `NODE_ENV`              | development           | Toggles error stacks in responses  |
| `CORS_ORIGIN`           | `http://localhost:5173` | Allowed frontend origin          |
| `MYSQL_HOST/PORT/USER/PASSWORD/DATABASE` | — | Cloud MySQL (Aiven) |
| `MYSQL_SSL`             | `true`                | Set true for cloud MySQL           |
| `GITHUB_TOKEN`          | —                     | Optional PAT (raises rate limits) |
| `MAX_REPO_SIZE_KB`      | 50000                 | Reject repos above this size       |
| `MAX_FILE_SIZE_BYTES`   | 1048576 (1 MB)        | Skip oversized files               |
| `CLONE_TIMEOUT_MS`      | 120000                | Git clone timeout                  |
| `AI_SERVICE_URL`        | `http://localhost:8000` | Where Node triggers AI service  |
| `CLERK_SECRET_KEY`      | —                     | **Must match frontend's Clerk app** |
| `CLERK_PUBLISHABLE_KEY` | —                     | Same Clerk app                     |
| `INTERNAL_API_SECRET`   | —                     | Shared with AI service             |

### `ai-service/.env`
| Var | Default | Purpose |
| --- | ------- | ------- |
| `PORT`                          | 8000                          | AI service port                         |
| `LLM_PROVIDER`                  | groq                          | groq / ollama / mock                    |
| `GROQ_API_KEY`                  | —                             | Required for Groq                        |
| `LLM_MODEL`                     | `openai/gpt-oss-20b`          | Groq model                              |
| `LLM_TIMEOUT_SECONDS`           | 30                            | Per-call timeout                        |
| `RAG_TOP_K`                     | 5                             | Chunks to retrieve per query            |
| `RAG_MIN_SCORE`                 | 0.20                          | Cosine-similarity gate                  |
| `RAG_MAX_CONTEXT_CHARS`         | 12000                         | Drop lower-scored chunks above this     |
| `RAG_MAX_ESTIMATED_TOKENS`      | 7000                          | Pre-flight trim threshold (Groq 8k TPM) |
| `EMBEDDING_PROVIDER`            | local                         | local / gemini                          |
| `EMBEDDING_MODEL`               | `all-MiniLM-L6-v2`            | 384 dimensions                          |
| `GEMINI_API_KEY`                | —                             | If using gemini provider                |
| `GEMINI_EMBEDDING_MODEL`        | `gemini-embedding-001`        | (text-embedding-004 deprecated Jan 2026)|
| `GEMINI_EMBEDDING_DIMENSION`    | 768                           | MRL truncation target                   |
| `QDRANT_URL`                    | `http://localhost:6333`       | Vector DB                               |
| `QDRANT_COLLECTION_NAME`        | `sourcefinch_chunks`          | Local-embeddings collection             |
| `QDRANT_API_KEY`                | —                             | For Qdrant Cloud                        |
| `CORS_ORIGIN`                   | `http://localhost:5173`       | Allowed frontend origin                 |
| `NODE_API_URL`                  | `http://localhost:3001`       | Node backend                            |
| `INTERNAL_API_SECRET`           | —                             | Must match backend                      |
| `CLONE_TIMEOUT_SECONDS`         | 120                           | Git clone timeout                       |

> Local and Gemini embeddings have **different dimensions** and therefore live in separate Qdrant collections: `sourcefinch_chunks` (local, 384-d) and `sourcefinch_chunks_gemini` (Gemini, 768-d via MRL).

### `frontend/.env`
| Var | Default | Purpose |
| --- | ------- | ------- |
| `VITE_AI_SERVICE_URL` | `http://localhost:8000` | Direct browser → AI service calls |
| `VITE_CLERK_PUBLISHABLE_KEY` | — | **Must match backend's Clerk app**  |

---

## 6. Backend (Node.js + Express)

### Bootstrap chain
- `server.js` reads `config.port` and calls `app.listen()`.
- `app.js` constructs the Express app, mounts:
  1. `clerkMiddleware` (populates `req.auth`),
  2. `express.json()` (body parsing),
  3. `cors({ origin: config.corsOrigin, credentials: true })`,
  4. `/api` routes,
  5. `notFound` (404 JSON),
  6. `errorHandler` (centralized error responder — shape: `{status, statusCode, message, [stack]}`).

### Configuration (`config/environment.js`)
Single object exporting `port`, `nodeEnv`, `corsOrigin`, `mysql {host,port,user,password,database,ssl}`, `github.token`, `ingestion {maxRepoSizeKb, maxFileSizeBytes, cloneTimeoutMs}`, `aiServiceUrl`, `clerk {secretKey, publishableKey}`, and `internalApiSecret`.

### MySQL pool (`config/database.js`)
`mysql2/promise` connection pool: 10 max connections, `waitForConnections`, unlimited queue, optional SSL (with `rejectUnauthorized:false` for dev). `testConnection()` pings the pool for the health endpoint.

### Middleware (`middleware/`)

| File | Purpose |
| ---- | ------- |
| `clerkMiddleware.js`        | Mounts `@clerk/express` `clerkMiddleware()` globally. Does NOT reject unauthenticated requests. |
| `requireAuth.js`            | Reads `getAuth(req).userId`; lazy-creates `users` row via `User.ensureFromClerk`; 401 JSON if missing. |
| `requireAuthOrInternal.js`  | Three branches: (1) Clerk user → pass, (2) valid `x-internal-secret` → pass, (3) neither → 401. Skips ownership check downstream. |
| `requireInternalSecret.js`  | Service-to-service only. Compares `x-internal-secret` header against `INTERNAL_API_SECRET`. **Fail-closed** (401 if env var unset). |
| `notFound.js`               | Catches unmatched routes, returns 404 JSON. |
| `errorHandler.js`           | Reads `err.statusCode ?? 500`, returns `{status, statusCode, message, [stack]}` (stack only in dev). |

> All auth uses Clerk v1+ where `req.auth` is a function. Always call `getAuth(req)` rather than `req.auth.userId`.

### Controllers (`controllers/`)

| File | Routes |
| ---- | ------ |
| `health.controller.js`       | `GET /api/health` — returns `{status, service, timestamp, database}` with 200 even if DB is down. |
| `repository.controller.js`   | `POST /api/repositories`, `GET /api/repositories`, `GET /api/repositories/:id`, `GET /api/repositories/:id/files`, `DELETE /api/repositories/:id`, `PATCH /api/repositories/:id/status`, `DELETE /api/repositories/:id/chunks`. Validates GitHub URL with `parse()`, calls `validateRepo()`, enforces one-active-repo-per-user, fires `ingestRepository()` in background. Ownership checks use 404 (not 403) to avoid existence leaks. |
| `chat.controller.js`         | `POST /api/chat`. Validates `repository_id` + `message`; resolves conversation (existing → 400 if wrong repo; `new_conversation` flag → create; otherwise use most-recent or create); persists user message; calls `AI service /ai/chat` with a 45s `AbortController`; relays errors verbatim; persists assistant message + sources (resilient — failure logs but returns 200 with `persistence_warning`). |
| `chunk.controller.js`        | `POST /api/chunks/batch` (bulk insert with order-preserved response), `POST /api/chunks` (single). AI-service only. |
| `conversation.controller.js` | `GET /api/conversations`, `POST /api/conversations`, `GET /api/conversations/:id` (with embedded messages). |

### Models (`models/`)
Each model is a thin wrapper around `pool.execute(sql, sqlParams(params))`. All use the `sqlParams` helper to coerce `undefined → null` (mysql2 requirement).

| File | Operations |
| ---- | ---------- |
| `User.js`         | `create`, `findById`, `findAll`, `update`, `remove`, `ensureFromClerk({id, email, name})` |
| `Repository.js`   | `create`, `findById`, `findByUserId`, `findCompleted`, `findCompletedByUserId`, `findActiveByUserId`, `update`, `remove` |
| `File.js`         | `create`, `createMany` (bulk), `findById`, `findByRepositoryId`, `remove` |
| `CodeChunk.js`    | `create`, `createMany` (preserves input order; returns `{id, qdrant_point_id, ...}`), `findById`, `findByFileId`, `deleteByRepositoryId` (joins files → cascade), `remove` |
| `Conversation.js` | `create`, `findById`, `findByUserId`, `findByRepositoryId`, `findMostRecentByUserIdAndRepositoryId`, `update`, `remove` |
| `Message.js`      | `create` (auto JSON-stringifies `sources`), `findById` (auto-parses `sources`), `findByConversationId` (ordered ASC), `remove` |

`models/index.js` is a barrel re-export.

### Routes (`routes/`)
Mounted at `/api` via `routes/index.js`:

| Prefix            | Routes |
| ----------------- | ------ |
| `/health`         | `GET /` |
| `/repositories`   | `GET /`, `POST /`, `GET /:id`, `GET /:id/files`, `PATCH /:id/status`, `DELETE /:id`, `DELETE /:id/chunks` |
| `/chunks`         | `POST /batch`, `POST /` (internal secret) |
| `/conversations`  | `GET /`, `POST /`, `GET /:id` (auth-or-internal) |
| `/chat`           | `POST /` (auth) |

### Services (`services/`)
- **`githubService.js`** — `getRepoInfo(owner, repo)` calls `https://api.github.com/repos/:owner/:repo` with optional Bearer token (raises 404/401/502). `validateRepo()` rejects private repos and oversized repos (note: GitHub's reported `size` includes full git history; the actual shallow clone is much smaller).
- **`ingestionService.js`** — `ingestRepository(id, url, branch)`:
  1. `git clone --depth 1 --branch <branch> <url> <tmpDir>` (timeout from env).
  2. Walks the clone, skipping `IGNORED_DIRS` (`.git`, `node_modules`, `venv`, `__pycache__`, `dist`, `build`, `coverage`), `IGNORED_FILE_PATTERNS` (`.env*`, `*.lock`, `*.log`), and `BINARY_EXTENSIONS` (images, archives, executables, `.pyc`, `.class`, `.o`).
  3. Detects language via `LANGUAGE_MAP` (45+ extensions → canonical names).
  4. Bulk-inserts file rows via `File.createMany`.
  5. Fires `POST <AI_SERVICE_URL>/ai/parse` fire-and-forget.
  6. Status updates: `cloning → scanning → storing → [embedding (Python)] → completed / failed`. Cleanup in `finally`.

### Utils (`utils/`)
- **`githubUrlParser.js`** — Validates `https?://github.com/<owner>/<repo>(.git)?(/)?`. Rejects non-GitHub hosts and missing segments. Has `node:test` unit tests in `githubUrlParser.test.js`.
- **`sqlParams.js`** — Recursive `undefined → null` coercion for mysql2 bind values.

### Scripts (`scripts/`)
- `migrate.js` — runs migrations (described in §4).
- `inspect_repos.js` — quick MySQL diagnostic: list repos with file/chunk counts.
- `verify_phase7_chat.js`, `verify_phase8_live.js`, `verify_rate_limit.js`, `test_gap_a.py` — ad-hoc verification scripts (see §10).
- `capture_responsive_breakpoi*.py` — screenshot helper for responsive breakpoints.

---

## 7. AI Service (Python + FastAPI)

### Bootstrap (`app/main.py`)
- FastAPI app with `lifespan` handler that calls `ensure_collection()` on startup (passive failure if Qdrant is unreachable).
- CORS: `allow_origins=[settings.cors_origin]`, `allow_credentials=True`.
- **Global error handlers** match the Node shape `{status, statusCode, message}`:
  - `HTTPException` → uses `exc.status_code` + `exc.detail`.
  - `RequestValidationError` → 422 with concatenated field messages.
  - Catch-all `Exception` → 500 (logs traceback, returns generic message).
- Three routers: `/health`, `/ai/indexing`, `/ai/chat`.

### Configuration (`app/config.py`)
Pydantic `BaseSettings` reading `.env` (case-insensitive). `effective_groq_api_key` falls back from `groq_api_key → llm_api_key → ""`.

### Schemas (`app/schemas/`)
Pydantic models serve as both validation and docs:

| Schema           | Fields |
| ---------------- | ------ |
| `ParseRequest`   | `repository_id: int>0`, `github_url: str`, `branch: str` |
| `ChatRequest`    | `repository_id: int`, `message: str≥1`, `conversation_id: int?` |
| `SourceCitation` | `file_path, start_line, end_line, code_chunk_id, score, content?` |
| `ChatResponse`   | `answer, sources, persistence_warning?` |

### Parsers (`app/parsers/`)

| File                  | Purpose |
| --------------------- | ------- |
| `base_parser.py`      | Defines `Chunk` dataclass (`file_path, language, start_line, end_line, content, parser_used`) and `BaseParser` ABC with `parse()` contract. **All line numbers are 1-indexed.** |
| `python_parser.py`    | `tree-sitter-python`. Walks root children, extracts `function_definition`, `class_definition`, `decorated_definition`. If no targets found, falls back to whole-file chunk. |
| `javascript_parser.py`| `tree-sitter-javascript` + `tree-sitter-typescript` (one class, picks parser by `language` param). Extracts `function_declaration`, `class_declaration`, `method_definition`, `arrow_function`, `export_statement`. (TSX is *not* handled — routed to generic parser.) |
| `generic_parser.py`   | Two strategies: (1) regex boundary detection across many languages (`def`, `function`, `class`, `fn`, `func`, Java/C# method signatures), (2) fixed-line chunking (40-line chunks, 5-line overlap) when no boundaries found. |

`chunking_service.py` selects the parser by language via `PARSER_MAP = {python: PythonParser, javascript: JavaScriptParser, typescript: JavaScriptParser}`. **Tree-sitter exceptions are caught here** (the only place) and the file is retried with `GenericParser`.

### Services (`app/services/`)

| File                    | Purpose |
| ----------------------- | ------- |
| `code_parser.py`         | Orchestrator for `POST /ai/parse`. Steps: (1) `GET /api/repositories/:id/files` from Node, (2) `git clone` into temp dir, (3) read each file UTF-8 with `errors="replace"`, (4) `chunk_file()`, (5) `PATCH status → embedding`, (6) `ensure_collection` + dual idempotency cleanup (delete Qdrant points by repo_id + DELETE `/api/repositories/:id/chunks`), (7) batch embed (size 32), (8) generate UUID `qdrant_point_id`s, (9) `POST /api/chunks/batch`, (10) upsert points with compensating rollback (deletes MySQL rows if Qdrant fails), (11) `PATCH status → completed`. On any error: `failed` status + raise. Cleanup in `finally` (Windows-aware — clears read-only). |
| `embedding_service.py`   | Pluggable provider abstraction (Protocol). `LocalEmbeddingProvider` (sentence-transformers, 384-d, unit-normalized) or `GeminiEmbeddingProvider` (Gemini `gemini-embedding-001` with MRL to 768-d, exponential backoff on 429). Singleton `_provider_instance`. `get_active_collection_name()` returns provider-scoped collection (`sourcefinch_chunks` or `sourcefinch_chunks_gemini`). |
| `vector_service.py`      | Qdrant singleton (`get_qdrant_client`). `ensure_collection(name, size)` — creates with Cosine distance or verifies dimension match (raises `ValueError` on mismatch). `delete_by_repository_id(name, repo_id)` — filter-based deletion. `upsert_points(name, points)`, `count_points`, `search_points` (with repo filter). |
| `retrieval_service.py`   | `retrieve_relevant_chunks(repo_id, query, top_k, min_score)` — embeds query, Qdrant search with `repository_id` filter, drops hits below `RAG_MIN_SCORE`. Returns structured dicts with id/score/file_path/language/start_line/end_line/content/code_chunk_id/repository_id/file_id. |
| `rag_service.py`         | RAG orchestration. Steps: (1) `get_repository_info` (404 / 409 mid-indexing / 422 failed / 502 Node down), (2) `rewrite_query` via Groq (uses conversation history to resolve pronouns), (3) retrieve, (4) zero-evidence short-circuit (returns FALLBACK_NO_EVIDENCE without calling LLM), (5) `apply_context_cap` (sort by score desc, drop lower-scored chunks to fit `RAG_MAX_CONTEXT_CHARS`), (6) `estimate_full_prompt_tokens` via tiktoken cl100k_base, pre-flight trim halving chunks until under `RAG_MAX_ESTIMATED_TOKENS`, (7) `LLM call with retry`: 413 → halve + retry, 429 → sleep 60s + retry, then 413/429 user-facing error, (8) empty-answer retry with half chunks, (9) build sources. |
| `llm_service.py`         | LLM providers behind a Protocol: `GroqProvider` (OpenAI-compatible, raises `GroqAPIError` on 413/429 for retry logic), `OllamaProvider` (local), `MockLLMProvider` (deterministic, used when no Groq key). `get_llm_provider()` returns the configured one (falls back to Mock if Groq key missing). |
| `message_router.py`      | **Classifier layer** in front of RAG. Categories: `conversational`, `code_query`, `off_topic`, `ambiguous`, `meta_command`. Uses Groq (llama-3.1-8b-instant) to classify with conversation history; falls back to a rule-based classifier on failure. Empty input is intercepted before classification. Each category has an isolated handler: conversational → direct LLM with identity prompt; code_query → RAG; off_topic/ambiguous → static redirect/clarify; meta_command → UI guidance. |
| `node_internal_client.py`| Adds `x-internal-secret` header to every outgoing request. Provides both sync (`internal_*`) and async (`async_internal_*`) helpers for GET/POST/PATCH/DELETE. |

### Routers (`app/api/`)

| Endpoint   | Method | Flow |
| ---------- | ------ | ---- |
| `/health`  | GET    | `{status:"ok", service:"sourcefinch-ai"}` |
| `/ai/parse`| POST   | `parse_repository()` (orchestrator). Returns `{repository_id, files_parsed, files_skipped, total_chunks, total_chunks_embedded, sample_chunks}`. |
| `/ai/chat` | POST   | Optional fetch conversation history from Node, then `route_message()` (classify → dispatch). |

---

## 8. Frontend (React + Vite + TypeScript + Tailwind)

### Bootstrap
- `main.tsx` → React 19 `createRoot` + `StrictMode`.
- `App.tsx` wraps the app in `<ClerkProvider publishableKey=...>` + `<BrowserRouter>`. `RoutedApp` mounts `<Routes>` inside `<AnimatePresence mode="wait">` so each navigation gets a 200ms fade via `FadeRoute`.
- Routes:
  - `/` → `LandingPage` (also catch-all `*`).
  - `/sign-in` → `SignInPage` (Clerk `<SignIn afterSignInUrl="/workspace" />`).
  - `/sign-up` → `SignUpPage` (same).
  - `/workspace` → `ProtectedRoute > WorkspacePage`.

### Types (`types/index.ts`)
Shared interfaces: `ServiceStatus`, `HealthResponse`, `ServiceCardProps`, `Repository`, `SourceCitation`, `ChatMessage`, `Conversation`, `RepositoryFile`, `ChatResponse`.

### Services (`services/`)
- **`api.ts`** — Thin HTTP wrappers around each backend endpoint. `checkBackendHealth` (proxy `/api/health`), `checkAIServiceHealth` (direct `${VITE_AI_SERVICE_URL}/health`), `fetchCompletedRepositories`, `createConversation`, `fetchConversation`, `createRepository`, `getRepository`, `deleteRepository`, `getRepositoryFiles`, `sendChatMessage`. All take an `authedFetch` (Clerk-token-injecting `fetch`).
- **`useApiClient.ts`** — Single source of truth for HTTP. Calls `useAuth()` **unconditionally** at top (avoids hook-order crashes). `authedFetch` is a `useCallback` that adds `Authorization: Bearer <token>` and `Content-Type: application/json`. The client object is `useMemo`-ed for **stable reference across renders** (prevents Clerk flicker).

### Pages (`pages/`)
| File              | Purpose |
| ----------------- | ------- |
| `LandingPage.tsx` | Public cinematic landing shown at `/`. Public navbar with Workspace link, theme toggle, Clerk `SignInButton`/`UserButton`. Renders `CinematicLandingHero` + `LandingPageContent` + footer. Docs modal available. |
| `Dashboard.tsx`   | Legacy Phase-1 health dashboard (still referenced). Pings both services in parallel and renders `ServiceStatusCard`s. |
| `SignInPage.tsx`  | Clerk `<SignIn>` centered on dark background. |
| `SignUpPage.tsx`  | Clerk `<SignUp>` centered on dark background. |
| `WorkspacePage.tsx` | Authenticated shell. Manages theme state (localStorage + `.dark` class), active tab (`workspace` vs `landing`), and the Docs modal. Renders either the cinematic landing (Overview) or `ChatInterface` (Workspace) within a Replit-style layout with shader backgrounds and `BgGradient`. |

### Components (`components/`)

| File                          | Purpose |
| ----------------------------- | ------- |
| `ChatInterface.tsx`           | **Main workspace shell.** Loads repos on mount; honors `?conversationId=` URL param (auto-load + history). Manages: selected repo, current conversation, message list, mobile sidebar drawer, file tree toggle, code viewer overlay, citations. Calls `/api/chat`; updates URL on conversation creation. Replit-inspired empty state with greeting, recent projects, and 3 suggested prompts. |
| `Sidebar.tsx`                 | Replit-style collapsible sidebar (hover-expand or pin). Brand header, Overview/Workspace/Docs nav, repository list with search, add-repo modal with progress polling (every 2s, max 120 attempts), delete confirmation modal, fullscreen `RepoIngestionLoader` overlay. Mobile drawer mirrors the desktop experience. |
| `CodeViewer.tsx`              | Renders a `SourceCitation` (or full `RepositoryFile`) with line-number gutter, copy-to-clipboard button, and direct GitHub permalink (`<repo>/blob/<branch>/<path>#L<a>-L<b>`). |
| `MarkdownRenderer.tsx`        | `marked.lexer(content, {gfm:true, breaks:true})` → block tokens → React. **Inline `file:line-line` codespans become clickable buttons** that call `onOpenCode`. Supports code blocks (with copy), tables, lists, blockquotes, headings. Optionally animates with staggered fade-rise (Motion variants). |
| `CinematicLandingHero.tsx`    | Big "Understand **Codebase**" headline + subtitle + glowing "Try Sourcefinch" CTA with shimmer sweep. Motion staggered reveal (0.28s stagger, 1.2s duration). |
| `LandingPageContent.tsx`      | Below-the-fold sections: 6-card capabilities grid, 3-step "How to use", CTA banner, gradient footer (`RuixenGradientFooter`). |
| `ProtectedRoute.tsx`          | Gates on `useAuth()`; loading pulse until `isLoaded`, otherwise `<Navigate to="/sign-in" replace />` if not signed in. |
| `FadeRoute.tsx`               | Wraps each route in a 200ms opacity fade. |
| `ServiceStatusCard.tsx`       | Health card with status dot + JSON response preview. |
| `CodeBackground.tsx`, `DottedBg2.tsx`, `thinking-tool.tsx`, `valley-of-the-mi*.tsx` | Visual / shader decoration utilities. |

### UI Primitives (`components/ui/`)

| File                              | Purpose |
| --------------------------------- | ------- |
| `Button.tsx`, `Card.tsx`, `Badge.tsx`, `Banner.tsx` | Foundation primitives with light/dark parity. |
| `Modal.tsx`                       | Accessible modal (Radix `Dialog`) with title, sizes (`sm`, `md`, `lg`). |
| `Skeleton.tsx`                    | Loading shimmer. |
| `StatusDot.tsx`                   | `checking`/`online`/`offline`/`muted`/`failed` indicator. |
| `theme-toggle.tsx`                | Light/dark toggle (writes `sf_theme` to localStorage + toggles `.dark` class). |
| `PromptInputBox.tsx`              | Multi-line chat composer with forwardRef handle (`focus()`), submit-on-Enter, attachment/upload hook, status prop (`idle`/`sending`). |
| `file-tree.tsx`                   | Interactive collapsible tree of `RepositoryFile[]` with selection highlight and loading skeleton. |
| `bg-gradient.tsx`                 | `BgGradient` animated backdrop, used by `WorkspacePage`. |
| `waves-shader.tsx` / `waves-shader-demo.tsx` | OGL shader background (used on landing/overview). |
| `repo-ingestion-loader.tsx`       | Fullscreen progress UI shown while a repo is being ingested. |
| `ruixen-gradient-footer.tsx`      | NotebookLM-style footer with gradient and CTA buttons. |
| `demo.tsx`                        | Tiny component showcase. |

### Design tokens
- `styles/tokens.css` — CSS custom properties (radii, colors, typography).
- `styles/fonts.css` — Custom font faces.
- `index.css` — Tailwind v4 entrypoint + global resets.

### Configuration
- `vite.config.ts` — Vite plugin-react + Tailwind plugin. Proxies `/api` to `localhost:3001`. `@` alias → `src/`.
- `tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.json` — TypeScript project references.
- `.oxlintrc.json` — Oxlint lint config (React + TypeScript rules).

---

## 9. Data Flow Walkthroughs

### 9.1 Add & ingest a GitHub repository
1. User opens `WorkspacePage`, clicks **+ Add Repo** in the `Sidebar`, pastes URL (optionally branch), clicks Ingest.
2. `Sidebar.handleAddRepo` → `api.createRepository(url, branch)` → `POST /api/repositories`.
3. Node `repository.controller.createRepository`:
   - Calls `parse()` on the URL.
   - Calls `githubService.validateRepo()` (private → 400, oversized → 400).
   - `Repository.findActiveByUserId` → 429 if another repo is mid-pipeline.
   - `Repository.create()` → 201 with `{id, name, status:"pending"}`.
   - Fires `ingestRepository(id, url, branch)` (background, no await).
4. `ingestionService.ingestRepository`:
   - Updates status to `cloning`, runs `git clone --depth 1 --branch <branch>`.
   - Updates status to `scanning`, walks the clone (ignores `.git`, `node_modules`, binaries, etc.), bulk-inserts file rows.
   - Updates status to `storing`.
   - Fires `POST <AI_SERVICE_URL>/ai/parse` (fire-and-forget).
5. AI service `code_parser.parse_repository`:
   - `GET /api/repositories/:id/files` (file list).
   - Clones into a Python temp dir.
   - Reads each file UTF-8 (errors=`replace`), `chunk_file()` (tree-sitter or generic).
   - PATCHes status to `embedding`.
   - `ensure_collection` + dual cleanup (delete Qdrant points + DELETE chunks).
   - `embed_texts` (batched, 32).
   - Generates UUIDs, bulk-inserts chunks via `POST /api/chunks/batch`.
   - Upserts points to Qdrant with compensating rollback on failure.
   - PATCHes status to `completed` (or `failed`).
6. Sidebar polls `GET /api/repositories/:id` every 2s for status; updates UI on `completed`.

### 9.2 Ask a question
1. User types into `PromptInputBox`, presses Enter.
2. `ChatInterface.handleSendMessage` → `api.sendChatMessage({conversation_id?, repository_id, message, new_conversation})` → `POST /api/chat`.
3. Node `chat.controller.handleChat`:
   - Resolves conversation (existing → ownership + repo-match checks; new → create; no flag → most-recent or create).
   - Persists user message.
   - Calls `POST <AI_SERVICE_URL>/ai/chat` with `{repository_id, message, conversation_id}` (45s `AbortController`).
4. AI service `chat.chat`:
   - Optional `GET /api/conversations/:id` for last 6 messages.
   - `route_message()` → classify (Groq) → dispatch.
5. For `code_query`, `rag_service.answer_question`:
   - `get_repository_info` (validates status: not mid-indexing → 409, not failed → 422).
   - `rewrite_query` (resolves pronouns using history).
   - `retrieve_relevant_chunks` (Qdrant, filtered by repo_id).
   - If empty → return FALLBACK_NO_EVIDENCE (no LLM call).
   - `apply_context_cap` + pre-flight token trim.
   - LLM call with retry (413 → halve; 429 → sleep 60s).
   - Empty-answer retry with half chunks.
   - Build `sources[]` and return.
6. Node persists assistant message (resilient on failure → `persistence_warning: true`).
7. ChatInterface renders Markdown via `MarkdownRenderer`, lists citations, allows clicking to open `CodeViewer`.

---

## 10. Testing & Verification Scripts

### Backend
- `backend/src/utils/githubUrlParser.test.js` — `node:test` unit tests (parses standard URLs, strips `.git`/trailing slash, accepts http, rejects non-GitHub/invalid/missing/extra-path). Run with `node --test` or `npm test`.

### AI service (`ai-service/tests/`)
| File | Purpose |
| ---- | ------- |
| `test_conversation_handling.py` | Validates conversational / off-topic / ambiguous routing. |
| `test_embedding_providers.py`   | Verifies local sentence-transformers and Gemini providers produce correct dimensions and handle rate limits. |
| `test_line_numbers.py`          | Asserts 1-indexed line numbering across all parsers. |
| `test_message_router.py`        | Exercises `MessageCategory` dispatch across all 5 routes + rule-based fallback. |
| `test_qdrant_proc.py`           | Smoke test against a running Qdrant. |
| `test_tiktoken_verification.py` | Verifies tiktoken cl100k_base token estimates. |
| `diagnose_large_repo.py`        | Debugging helper for large-repo ingestion. |
| `diagnose_threshold.py`         | Diagnoses RAG score-threshold tuning. |
| `investigate_retrieval_scores.py` | Deep dive into retrieval score distributions. |
| `run_threshold_live_test.py`    | Live threshold tuning against indexed repos. |
| `run_full_phase5_verification.py` / `verify_phase5.py` / `verify_phase5_gaps.py` | Phase-5 (retrieval) acceptance suite. |
| `run_full_phase6_verification.py` / `verify_phase6_gaps.py` | Phase-6 (RAG orchestration) suite. |
| `verify_threshold_tuning.py` / `run_phase7_test.py` | Phase-7 (chat with citations) suite. |
| `verify_polish_fixes.py`        | Edge-case regression suite. |

### Backend scripts (`backend/scripts/`)
| File | Purpose |
| ---- | ------- |
| `verify_phase7_chat.js`   | Manual end-to-end chat verification (Node). |
| `verify_phase8_live.js`   | Live multi-turn chat verification. |
| `verify_rate_limit.js`    | Checks that ingestion rejects an in-progress second repo with 429. |
| `test_gap_a.py`           | Phase-A gap coverage test. |

---

## 11. Operational Notes & Conventions

### Backend conventions
- **Auth:** every authenticated route uses `requireAuth`; routes called by both user + AI service use `requireAuthOrInternal`; AI-service-only routes use `requireInternalSecret`. The middleware is fail-closed (missing `INTERNAL_API_SECRET` → 401).
- **Errors:** controllers throw `new Error('msg')` with `err.statusCode = <int>`; `errorHandler` renders them with the Node shape `{status, statusCode, message, [stack]}`. 404 (not 403) is used to hide existence on ownership mismatches.
- **MySQL:** all `pool.execute` calls go through `sqlParams([...])` so `undefined` becomes `null`. Bulk inserts use multi-row `INSERT ... VALUES (?, ?, ?), (?, ?, ?)` syntax (mysql2 doesn't support multi-row placeholders in `execute`).
- **Ingestion:** only one repo per user can be in `pending|cloning|scanning|storing|embedding` at a time (429 otherwise).

### AI service conventions
- **Line numbers** are always 1-indexed (tree-sitter rows are converted explicitly at chunk construction).
- **TSX** is intentionally absent from `PARSER_MAP` — routed to `GenericParser` because tree-sitter-typescript's grammar is unreliable on JSX.
- **Idempotency:** every parse run deletes both Qdrant points and MySQL chunks for the repository before re-indexing. If Qdrant upsert fails, MySQL chunks are deleted as a compensating rollback.
- **LLM retries:** `GroqAPIError` carries `status_code` so the RAG pipeline can implement 413→halve and 429→wait+retry without losing the signal.
- **Token pre-flight:** `estimate_full_prompt_tokens` includes system prompt + history + chunks + question so the estimate matches what Groq actually receives.
- **Empty-answer handling:** if the LLM returns empty content (common with `finish_reason=length`), the pipeline retries once with half the chunks before falling back to `FALLBACK_NO_EVIDENCE`.

### Frontend conventions
- **Hooks must be called unconditionally** at the top of components — no early `return`s gated on `isLoaded`/`isSignedIn` (causes "Rendered more hooks than previous render").
- **API client memoization:** `useApiClient` returns a stable object reference; downstream `useEffect([api])` does NOT re-fire on hover/state changes.
- **Citations in Markdown:** any `file_path:start[-end]` codespan rendered by `MarkdownRenderer` becomes a clickable button that opens the code viewer.
- **URL state:** `?conversationId=<id>` in the workspace URL makes conversations deep-linkable; the `ChatInterface` restores from URL on mount.

### Cross-cutting
- **Internal secret:** generate with `openssl rand -hex 32`. Must match between `backend/.env` and `ai-service/.env`.
- **Clerk keys:** both `CLERK_PUBLISHABLE_KEY` (frontend) and `CLERK_SECRET_KEY` (backend) must come from the **same Clerk application** or auth silently 401s.
- **MAX_REPO_SIZE_KB** is checked against GitHub's reported `size` (full history, not shallow clone). Historical large commits can cause spurious rejections.
- **Multi-turn context:** the AI service fetches the last 6 messages via `GET /api/conversations/:id` and uses Groq to rewrite the latest question into a standalone search query (pronoun resolution).

---

## 12. Known Limitations & Roadmap

- **Multi-turn search:** rewrite is best-effort; pronoun-heavy follow-ups ("how do I run it?") still benefit from explicit repo/file references.
- **TSX/JSX:** not chunked via tree-sitter (falls back to generic parser).
- **Embeddings:** switching providers requires re-ingestion (different dimensions → different Qdrant collections).
- **Groq TPM:** 8k TPM tier limits prompt size; pre-flight trimming handles this for typical repos but very large queries may still 413.
- **Private repos:** explicitly rejected (only public GitHub repos supported today).
- **Single active ingestion per user:** enforced to avoid resource contention.
- **Citation content:** chunk text lives only in Qdrant; if Qdrant is wiped, citations lose content (point IDs survive but content is gone).

---

## 13. Glossary

| Term | Meaning |
| ---- | ------- |
| **RAG**                | Retrieval-Augmented Generation: retrieve relevant context, then ask LLM to answer using only that context. |
| **Qdrant**             | Open-source vector database with cosine / dot-product / euclidean distance. |
| **MRL (Matryoshka Representation Learning)** | Embeddings trained so the leading N dimensions form a usable sub-embedding. Lets us truncate Gemini's 3072-d output to 768-d. |
| **Cosine distance**    | Used for similarity search; normalized sentence-transformers vectors have unit length, so cosine ≡ dot-product. |
| **AST**               | Abstract Syntax Tree; tree-sitter builds these from source code. |
| **Citation**          | A `{file_path, start_line, end_line, score, content}` returned alongside an LLM answer. |
| **Idempotency cleanup** | Before re-ingesting a repo, delete existing chunks (MySQL) and vectors (Qdrant) to avoid duplicates. |
| **Compensating rollback** | If a downstream step fails, undo upstream writes (e.g., delete MySQL chunks if Qdrant upsert fails). |
| **Pre-flight trim**   | Proactively halve the chunk list if estimated prompt tokens exceed the LLM provider's TPM window. |
| **TPM**               | Tokens Per Minute — Groq's free tier enforces an 8k TPM limit. |
| **Clerk userId**      | String like `user_2abc...` — used as the PK in the local `users` mirror table. |
| **Conversation ID**   | MySQL `conversations.id`. Returned to the frontend; stored in `?conversationId=` for deep-linking. |
| **Source code citation line range** | 1-indexed, inclusive on both ends (e.g., `Lines 42–58`). |
| **Winston-style parser fallback** | "Try fancy parser → catch → try plain parser." `chunking_service.chunk_file` is the only place this pattern lives. |

---

*End of project documentation.*