# Sourcefinch

**AI-powered codebase intelligence** — connect a GitHub repo, ask natural-language questions about the code, and get answers with source file/line citations.

## Architecture

```
┌──────────────┐      ┌──────────────────┐      ┌──────────────────┐
│   Frontend   │─────▶│  Node Backend    │      │  Python AI Svc   │
│  React+Vite  │      │  Express :3001   │      │  FastAPI :8000   │
│   :5173      │─────▶│  /api/*          │      │  /health         │
└──────────────┘      └────────┬─────────┘      └──────────────────┘
   Tailwind CSS         Routes/Controllers        Embeddings, RAG
                        │  MySQL (Phase 2) ✅     Qdrant (Phase 3+)
                        ▼
                  ┌──────────────┐
                  │    MySQL     │
                  │   :3306      │
                  └──────────────┘
```

**Frontend → Backend**: Vite proxies `/api` requests to the Node backend during dev.
**Frontend → AI Service**: Called directly via `VITE_AI_SERVICE_URL` (CORS enabled on the AI service).

## Prerequisites

- **Node.js** v18+ and npm
- **Python** 3.9+ and pip
- **MySQL** 8.0+ (local install or Docker)

## Quick Start

### 1. Clone & set up environment files

```bash
# Copy .env templates (adjust values if needed — defaults work out of the box)
cp backend/.env.example backend/.env
cp ai-service/.env.example ai-service/.env
cp frontend/.env.example frontend/.env
```

> **📝 Note on `MAX_REPO_SIZE_KB`**: `MAX_REPO_SIZE_KB` is validated against GitHub's reported repo `size` (which includes full git history), rather than the shallow `--depth 1` clone size downloaded during ingestion.
> 
> **📝 Note on Multi-Turn Chat Context**: In Phase 7, each question is embedded and retrieved independently of prior conversation turns. Pronoun-dependent follow-up queries (e.g., *"how do I run it?"*) should mention specific repository/file names for optimal semantic vector retrieval. Multi-turn context injection and query rewriting are tracked for future phases.

### 2. Set up MySQL

#### 2a. Create the database

Open a MySQL shell (`mysql -u root -p`) and run:

```sql
CREATE DATABASE IF NOT EXISTS sourcefinch
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

#### 2b. Configure connection

Update `backend/.env` with your MySQL credentials:

```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your_mysql_password
MYSQL_DATABASE=sourcefinch
```

#### 2c. Run migrations

```bash
cd backend
npm install
npm run migrate
```

This executes SQL files from `backend/migrations/` to create all tables:

| Table | Purpose |
|-------|---------|
| `users` | Registered developer accounts |
| `repositories` | GitHub repos connected for analysis |
| `files` | Individual source files within repos |
| `code_chunks` | Metadata/pointers to chunks stored in Qdrant (see note below) |
| `conversations` | Q&A threads between user and AI |
| `messages` | Individual messages within conversations |

> **📝 Note on `code_chunks`**: This table intentionally has **no `content` column**.
> The actual chunk text will live only in Qdrant (the vector database, wired up in Phase 3+).
> Storing it in both places would mean doubled storage and a sync nightmare.
> Instead, `code_chunks` stores line-range metadata and a `qdrant_point_id` UUID that
> references the full text + embedding in Qdrant.

#### 2d. Verify tables

In a MySQL shell:

```sql
USE sourcefinch;
SHOW TABLES;
-- Should list: code_chunks, conversations, files, messages, repositories, users

-- Check foreign keys are set up correctly:
SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'sourcefinch' AND REFERENCED_TABLE_NAME IS NOT NULL;
```

### 3. Start the Node backend

```bash
cd backend
npm install
npm run dev
```

The backend starts at **http://localhost:3001**. Verify:

```bash
curl http://localhost:3001/api/health
# → {"status":"ok","service":"sourcefinch-backend","timestamp":"...","database":"connected"}
```

The `"database": "connected"` field confirms MySQL is reachable.

### 4. Start the Python AI service

```bash
cd ai-service
python -m venv venv

# Activate the virtual environment:
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
python run.py
```

The AI service starts at **http://localhost:8000**. Verify:

```bash
curl http://localhost:8000/health
# → {"status":"ok","service":"sourcefinch-ai"}
```

FastAPI also auto-generates interactive API docs at **http://localhost:8000/docs**.

### 5. Start the React frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — the dashboard should show both services as **Online** (green).

## Verification Checklist

| Check | Command / Action | Expected Result |
|-------|-----------------|-----------------| 
| Backend health | `curl http://localhost:3001/api/health` | `{"status":"ok","service":"sourcefinch-backend",...,"database":"connected"}` |
| Backend 404 | `curl http://localhost:3001/api/nonexistent` | `{"status":"error","statusCode":404,...}` |
| AI service health | `curl http://localhost:8000/health` | `{"status":"ok","service":"sourcefinch-ai"}` |
| AI service docs | Open `http://localhost:8000/docs` | Swagger UI loads |
| Frontend dashboard | Open `http://localhost:5173` | Both services show "Online" |
| MySQL tables | `SHOW TABLES` in MySQL shell | 6 tables listed |
| Foreign keys | `information_schema` query (above) | FK constraints listed |

## Project Structure

```
sourcefinch/
├── frontend/                    React + Vite + TypeScript + Tailwind
│   ├── src/
│   │   ├── components/          Reusable UI components
│   │   ├── pages/               Page-level components
│   │   ├── services/            API call functions
│   │   └── types/               Shared TypeScript types
│   ├── vite.config.ts           Vite config with proxy
│   └── .env.example
│
├── backend/                     Node.js + Express
│   ├── migrations/
│   │   └── 001_initial_schema.sql   SQL DDL for all 6 tables
│   ├── scripts/
│   │   └── migrate.js               Simple migration runner
│   ├── src/
│   │   ├── config/
│   │   │   ├── environment.js       Environment configuration
│   │   │   └── database.js          MySQL connection pool
│   │   ├── controllers/             Route handlers (business logic)
│   │   ├── middleware/              Error handling, 404, etc.
│   │   ├── models/                  Database models (one per table)
│   │   │   ├── index.js             Barrel re-export
│   │   │   ├── User.js
│   │   │   ├── Repository.js
│   │   │   ├── File.js
│   │   │   ├── CodeChunk.js
│   │   │   ├── Conversation.js
│   │   │   └── Message.js
│   │   └── routes/                  Route definitions
│   └── .env.example
│
├── ai-service/                  Python + FastAPI
│   ├── app/
│   │   ├── api/                 FastAPI routers (like Express routes)
│   │   ├── config.py            Pydantic Settings (typed env config)
│   │   └── main.py              FastAPI app entry point
│   ├── run.py                   Convenience startup script
│   └── .env.example
│
├── .gitignore
└── README.md
```

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------| 
| Frontend | React + TypeScript + Vite | UI framework |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Backend | Node.js + Express | REST API, auth, orchestration |
| AI Service | Python + FastAPI | Code parsing, embeddings, RAG |
| Relational DB | MySQL *(Phase 2 ✅)* | Users, repos, metadata |
| Vector DB | Qdrant *(Phase 3+)* | Code embeddings for search |
| Embeddings | sentence-transformers *(Phase 3+)* | Local embedding generation |
| LLM | Groq / Gemini / Ollama *(Phase 4+)* | Answer generation |
