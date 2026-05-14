# Audit Note — AIPhotographyBusinessManager

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_06.md` section #22.

## Original Recommendations

### Gaps — AI Counterparts
- `/shoot-plan-optimize` — suggest timeline, crew, locations
- `/client-satisfaction-predict`
- `/gallery-organization-ai` — auto-sort and tag images
- `/review-sentiment-analyze`

### Gaps — Non-AI Features
- Cloud-storage backup (Dropbox/AWS)
- Advanced client proofing/markup
- Photographer schedule optimizer
- Lightroom/Capture One integration
- Print/marketplace

### Custom Feature Suggestions
1. Agentic shoot orchestration (pre/during/post)
2. Computer vision photo analysis (technical + emotional ratings)
3. Client communication automation (sentiment-aware email)
4. Pricing intelligence (competitor tracking)
5. Video highlight reel generation

## Implemented (Mechanical)
- `POST /api/ai/shoot-plan-optimize` — added in `backend/routes/ai.js`. Accepts shoot brief and returns timeline, crew, location, equipment, lighting, weather contingencies, and cost breakdown. Persists to `ai_results`.
- `POST /api/ai/gallery-organization-ai` — added in `backend/routes/ai.js`. Pulls photos from `photos` table by `gallery_id` (or accepts inline) and returns groupings, tags, highlight picks, duplicates, cover candidates. Persists to `ai_results`.

Both follow existing `callOpenRouter`/`parseAIJson`/`authenticateToken`/`aiRateLimiter` style.

## Backlog (deferred)

### NEEDS-CREDS / NEW-DEPS
- Cloud storage backup (Dropbox, AWS S3 SDKs).
- Lightroom/Capture One integration (proprietary CC SDK).
- Video highlight reel generation (ffmpeg + new compute).

### NEEDS-PRODUCT-DECISION
- `/client-satisfaction-predict` — needs satisfaction signal source (NPS surveys, response latency).
- `/review-sentiment-analyze` — connect to Google/Yelp APIs (creds + ToS).
- Advanced proofing/markup UX.
- Print marketplace.

### TOO-RISKY
- Agentic shoot orchestration (real-time during shoot — needs streaming infra).
- Computer vision quality scoring at gallery scale (cost/latency).

## Apply pass 4 (mechanical backlog)
- Reviewed remaining backlog. All deferred items are NEEDS-CREDS / NEW-DEPS, NEEDS-PRODUCT-DECISION, or TOO-RISKY — none mechanical. No code changes this pass.

## Apply pass 3 (frontend)
- Stack: CRA-React (frontend) + Express (backend).
- Action: LEFT-AS-IS — FE already wired.
- Pages `ShootPlanOptimize.js` and `GalleryOrganizationAI.js` consume the new endpoints; routed in `App.js`; nav entries in `components/Layout.js`. Other AI endpoints (analyze-photo, auto-cull, business-insights, pricing-estimate, style-analyzer, generate-caption, generate-contract, edits CRUD) all have FE callers.
- Token forwarded as Bearer header.
- No FE changes required.
