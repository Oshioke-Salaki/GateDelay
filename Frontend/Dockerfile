# syntax=docker/dockerfile:1
#
# GateDelay frontend (Next.js 16, standalone output).
#
# Build from the Frontend/ directory:
#   docker build -t gatedelay-frontend:local Frontend
#
# NEXT_PUBLIC_* values are inlined into the client bundle by `next build`, so
# they are BUILD ARGS, not runtime env. An image built for staging cannot be
# repointed at production by changing the container environment — rebuild
# instead. This is also why no real secret may be passed here: every ARG below
# ends up readable in the shipped JavaScript.
# Required keys and their meaning: Frontend/.env.example.

# ---------------------------------------------------------------------------
# Base — pinned minor so a rebuild cannot silently change the runtime.
# `package.json` engines require node >= 20; 22 is the current LTS.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---------------------------------------------------------------------------
# deps — install once, cached on the lockfile alone
# ---------------------------------------------------------------------------
FROM base AS deps
# `.npmrc` carries the legacy-peer-deps setting the React 19 / @react-pdf/renderer
# peer conflict requires; without it `npm ci` here resolves differently from a
# developer's local install.
COPY package.json package-lock.json .npmrc ./
# `npm ci` fails loudly when the lockfile is out of sync with package.json,
# which is what we want in a deploy pipeline.
RUN npm ci

# ---------------------------------------------------------------------------
# builder — typecheck, lint-free build, standalone output
# ---------------------------------------------------------------------------
FROM base AS builder

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_PROJECT_ID
ARG NEXT_PUBLIC_CLIENT_KEY
ARG NEXT_PUBLIC_APP_ID
ARG NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
ARG NEXT_PUBLIC_MARKET_FACTORY_ADDRESS
ARG NEXT_PUBLIC_MARKET_MAKER_ADDRESS
ARG NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS
ARG NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS
ARG NEXT_PUBLIC_IPFS_GATEWAY
ARG NEXT_PUBLIC_AVIATION_STACK_KEY

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL \
    NEXT_PUBLIC_PROJECT_ID=$NEXT_PUBLIC_PROJECT_ID \
    NEXT_PUBLIC_CLIENT_KEY=$NEXT_PUBLIC_CLIENT_KEY \
    NEXT_PUBLIC_APP_ID=$NEXT_PUBLIC_APP_ID \
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID \
    NEXT_PUBLIC_MARKET_FACTORY_ADDRESS=$NEXT_PUBLIC_MARKET_FACTORY_ADDRESS \
    NEXT_PUBLIC_MARKET_MAKER_ADDRESS=$NEXT_PUBLIC_MARKET_MAKER_ADDRESS \
    NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS=$NEXT_PUBLIC_GOVERNANCE_CONTRACT_ADDRESS \
    NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS=$NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS \
    NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS=$NEXT_PUBLIC_VOTING_CONTRACT_ADDRESS \
    NEXT_PUBLIC_IPFS_GATEWAY=$NEXT_PUBLIC_IPFS_GATEWAY \
    NEXT_PUBLIC_AVIATION_STACK_KEY=$NEXT_PUBLIC_AVIATION_STACK_KEY \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
# runner — minimal, non-root
# ---------------------------------------------------------------------------
FROM base AS runner

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# `standalone` already contains server.js and the traced node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# /api/ping is a no-store route handler, so a healthy response also proves the
# Next.js server is actually executing routes rather than just holding the port.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/ping').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
