# Curalink — AI Medical Research Assistant (MERN + Ollama LLaMA 3)

Prototype that takes **patient context + question**, retrieves a **deep candidate pool** from:

- OpenAlex (publications)
- PubMed (publications)
- ClinicalTrials.gov (clinical trials)

…then **re-ranks** and sends the evidence to **Ollama (LLaMA 3)** to generate a structured, source-grounded answer.

## Prereqs

- Node.js 18+
- MongoDB running locally (or MongoDB Atlas)
- Ollama installed + running

## Ollama setup

1. Install Ollama and start it.
2. Pull the model:

`ollama pull llama3`

## Run locally

Backend:

1. `copy server/.env.example server/.env`
2. Edit `server/.env` (set `MONGO_URI`, etc.)
3. `npm.cmd --prefix server run dev`

Frontend:

1. `npm.cmd --prefix client run dev`
2. Open the Vite URL (typically `http://localhost:5173`)

## API

- `POST /api/chat`
  - Body: `{ userId, conversationId?, patientName?, disease?, location?, query }`
  - Returns: `{ expandedQuery, candidates, publications[], clinicalTrials[], response }`

## Notes

- Every message triggers fresh retrieval (depth-first) and then precision (re-ranking).
- The LLM is instructed to **only cite provided evidence** (S1.. / T1..).
- This is a research assistant prototype, not medical advice.

