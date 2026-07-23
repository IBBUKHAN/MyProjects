# UIDAI Chatbot

RAG chatbot for UIDAI / Aadhaar. **Scraping is generic** (works on any site); domain context lives only in chat prompts via `BOT_NAME` / `BOT_DOMAIN` in config.

## Features

- **Web scraping** — Playwright-based page extraction + BFS site crawler
- **ChromaDB** — Hybrid vector + BM25 search
- **SSE streaming chat** — `POST /chat/query/stream`
- **Admin crawl** — Scrape uidai.gov.in and index into ChromaDB with live SSE progress

## Setup

```bash
cd /Users/mdibrahim/Desktop/uidai_chatbot
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```



## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

## API Endpoints


| Method | Path                           | Description                               |
| ------ | ------------------------------ | ----------------------------------------- |
| GET    | `/health`                      | Health check + document count             |
| POST   | `/chat/query`                  | Non-streaming chat                        |
| POST   | `/chat/query/stream`           | **SSE streaming chat**                    |
| POST   | `/admin/crawl-website`         | Start website crawl + index (Bearer auth) |
| GET    | `/admin/crawl-status/{job_id}` | **SSE crawl progress**                    |
| POST   | `/admin/ingest-url`            | Index a single URL                        |
| POST   | `/admin/reindex`               | Reset DB and crawl default UIDAI URLs     |
| GET    | `/admin/websites`              | List indexed URLs                         |


Admin routes require header: `Authorization: Bearer <ADMIN_API_TOKEN>`

## Example: Crawl UIDAI website

```bash
# Start crawl
curl -X POST http://localhost:8000/admin/crawl-website \
  -H "Authorization: Bearer super-secret-admin-token" \
  -H "Content-Type: application/json" \
  -d '{"base_url": "https://uidai.gov.in", "max_pages": 50, "max_depth": 2}'

# Watch SSE progress (replace JOB_ID)
curl -N http://localhost:8000/admin/crawl-status/JOB_ID \
  -H "Authorization: Bearer super-secret-admin-token"
```



## Example: Streaming chat

```bash
curl -N -X POST http://localhost:8000/chat/query/stream \
  -H "Content-Type: application/json" \
  -d '{"question": "How do I update my Aadhaar address?", "session_id": "user-1"}'
```

SSE event types: `status`, `answer_chunk`, `sources`, `metadata`, `error`

## Project structure

```
uidai_chatbot/
├── main.py              # FastAPI app + routes
├── config.py            # Environment config
├── schemas.py           # Pydantic models
├── core/
│   ├── web_scraper.py   # Playwright page extraction
│   ├── crawler.py       # BFS site crawler
│   ├── vector_store.py  # ChromaDB + hybrid search
│   ├── ingestion.py     # Scrape → chunk → embed → store
│   └── job_events.py    # In-memory SSE job events
└── services/
    └── rag_service.py   # RAG + streaming answers
```

