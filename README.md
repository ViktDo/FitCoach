# FitCoach (mono-repo)

- `apps/fitcoach-next` — Next.js (standalone build → GHCR).
- `apps/fitcoach-api`  — Node.js API (Express/Fastify).
- CI: GitHub Actions → build & push в GHCR (`ghcr.io/<org>/<image>`).
- Deploy: docker-compose на сервере.

## Быстрый старт (локально)
```bash
cd apps/fitcoach-next && npm i && npm run dev
cd ../fitcoach-api && npm i && npm run dev