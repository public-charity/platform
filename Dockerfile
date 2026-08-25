# public.charity platform — multi-stage build for Fly.io
FROM node:26-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts resolves env('DATABASE_URL') eagerly, and `generate` loads the
# config even though it never opens a connection. Supply a placeholder for the build
# only; the real URL arrives from Fly secrets at runtime. This used to work by
# accident because `COPY . .` baked the developer's local .env into the image.
ENV DATABASE_URL="postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder"
RUN npx prisma generate && npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Next standalone server + assets.
# --chown matters: the ISR cache is written at runtime as the `nextjs` user, and
# root-owned files make revalidation fail with EACCES (pages then never refresh).
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Full node_modules overlays standalone's trimmed set. Needed because the
# release command runs `prisma migrate deploy`, and the Prisma 7 CLI pulls in
# transitive deps (effect, etc.) that a hand-picked copy misses.
# Later optimisation: run migrations from a dedicated job image instead.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
