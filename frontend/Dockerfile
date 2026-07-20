# Stage 1: Build (bun → standalone SSR output)
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Backend origin baked into rewrites at build time.
# In docker-compose the backend service is reachable as `backend:3001`.
ARG BACKEND_URL=http://localhost:3001
ENV BACKEND_URL=$BACKEND_URL

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time by
# Next.js — setting them as a runtime container env var has no effect on
# already-compiled JS. Must be passed as Docker build args.
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ARG NEXT_PUBLIC_BACKEND_URL=http://localhost:3001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL

# Copy manifest + lockfile for reproducible install
COPY package.json bun.lock ./

# Install dependencies (dev needed for next build)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build: next.config output:'standalone' emits .next/standalone (server.js + minimal node_modules)
RUN bun run build

# Stage 2: Production runtime (node, SSR via standalone server)
FROM node:20-alpine AS runner

WORKDIR /app

# tini for proper PID 1 signal forwarding
RUN apk add --no-cache tini

# Standalone server binds to 0.0.0.0 so it accepts traffic from outside the container
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Copy the self-contained standalone server (includes minimal node_modules + package.json)
COPY --from=builder --chown=node:node /app/.next/standalone ./
# Static assets and public/ are not bundled into standalone — copy separately
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# Run as the non-root user shipped with the node image (uid 1000)
USER node

EXPOSE 3000

# Health check: standalone server responds on /
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',(r)=>{process.exit(r.statusCode<500?0:1)})"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
