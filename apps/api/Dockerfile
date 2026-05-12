FROM node:22-alpine AS base
RUN apk add --no-cache openssl && corepack enable && corepack prepare pnpm@9.15.4 --activate

# ---- Dependencies stage ----
FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY packages/db/package.json ./packages/db/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --no-frozen-lockfile

# ---- Build stage ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .
# Generate Prisma client, copy generated .prisma/client into the pnpm virtual
# store entry for @prisma/client AND into root node_modules for TypeScript.
# The pnpm store copy is critical at runtime: @prisma/client's index.js looks
# for .prisma/client as a bare module starting from its own directory inside
# .pnpm/, so the generated files must live alongside the stub there.
RUN pnpm --filter @barberflow/db generate && \
    cp -r packages/db/node_modules/.prisma node_modules/ && \
    PNPM_PRISMA=$(ls -d node_modules/.pnpm/@prisma+client* 2>/dev/null | head -1) && \
    [ -n "$PNPM_PRISMA" ] && cp -r packages/db/node_modules/.prisma/client/. "${PNPM_PRISMA}/node_modules/.prisma/client/"
RUN pnpm --filter @barberflow/shared-types build
RUN pnpm --filter @barberflow/db build
RUN pnpm --filter @barberflow/api build

# ---- Runtime stage ----
FROM node:22-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

# pnpm virtual store + hoisted packages (symlink targets live here)
COPY --from=builder /app/node_modules ./node_modules
# API-specific node_modules (pnpm does not hoist workspace deps to root);
# symlinks inside point back into node_modules/.pnpm which is copied above
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
# packages/db/node_modules: contains @prisma/client symlink AND .prisma/client
# generated files; packages/db/dist/client.js resolves @prisma/client from here
COPY --from=builder /app/packages/db/node_modules ./packages/db/node_modules
# Compiled workspace packages (apps/api/node_modules/@barberflow/* symlinks point here)
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/package.json
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/shared-types/package.json ./packages/shared-types/package.json
# Compiled API
COPY --from=builder /app/apps/api/dist ./apps/api/dist

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

# Run from the API's own directory so pnpm symlinks resolve correctly
WORKDIR /app/apps/api
CMD ["node", "dist/main.js"]
