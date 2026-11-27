---
name: deploy-google-cloud
description: >-
  Run Open Research IDE locally with Google Gemini API or deploy directly to
  Firebase App Hosting or Google Cloud Run from Google Antigravity.
---

# Deploy Open Research IDE with Google Technologies

This repository ships ready for **Direct Standalone Runtime** (zero external gateway daemon required) and supports three paths:

## Option 1 — Local Development (Google Gemini API or Local Gemma)
1. Run `npm run setup` to create `.env` with `RESEARCH_HARNESS=standalone` and `RESEARCH_PROVIDER=gemini`.
2. Add your Google AI Studio key (`GEMINI_API_KEY=...`) in `.env` or inside the in-app **Setup** modal (`https://aistudio.google.com/apikey`).
3. Start the app with `npm run dev` and open `http://127.0.0.1:3000`.
4. To test without an API key, click **Explore Sample Investigation** on the home screen.

## Option 2 — Deploy to Firebase App Hosting (Recommended Full-Stack SSR)
Uses `firebase.json` and `apphosting.yaml`:
1. Ensure Firebase project is on the Blaze plan and authenticated (`npx -y firebase-tools@latest login`).
2. Store your API key in Cloud Secret Manager:
   ```bash
   npx -y firebase-tools@latest apphosting:secrets:set GEMINI_API_KEY
   npx -y firebase-tools@latest apphosting:secrets:grantaccess GEMINI_API_KEY --backend open-research-ide
   ```
3. Uncomment the `GEMINI_API_KEY` secret block in `apphosting.yaml`.
4. Deploy:
   ```bash
   npm run deploy:firebase
   ```

## Option 3 — Deploy to Google Cloud Run (Containerized via `Dockerfile`)
Uses `Dockerfile` (`NEXT_OUTPUT_STANDALONE=1`, port `8080`, `GET /api/health`):
```bash
gcloud run deploy open-research-ide \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars RESEARCH_HARNESS=standalone,RESEARCH_PROVIDER=gemini,RESEARCH_MODEL=gemini-2.5-flash,RESEARCH_REVIEW_PROVIDER=gemini,RESEARCH_REVIEW_MODEL=gemini-2.5-flash \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```
Verify deployment by visiting `/api/health` (`{"ok":true,"runtime":"standalone","defaultProvider":"gemini"}`).
