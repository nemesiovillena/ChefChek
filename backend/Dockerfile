# Stage 1: Build (full deps, bun)
# oven/bun:1 is Debian-based so the Prisma engine (glibc) matches the node runtime below.
FROM oven/bun:1 AS builder

WORKDIR /app

# Copy manifest + lockfile for reproducible install
COPY package.json bun.lock ./

# Install all dependencies (dev needed for the build step)
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Build application
RUN bun run build

# Stage 2: Production dependencies (bun, prod-only)
FROM oven/bun:1 AS prod-deps

WORKDIR /app

COPY package.json bun.lock ./

# Production dependencies only (prisma + @prisma/client are prod deps)
RUN bun install --frozen-lockfile --production

# Copy schema and generate the Prisma client for the runtime platform
COPY prisma ./prisma
RUN bunx prisma generate

# Stage 3: Production runtime (node, proven for NestJS)
FROM node:20-bullseye-slim AS runner

WORKDIR /app

# Built app + prod node_modules (with generated Prisma client)
COPY --from=builder /app/dist ./dist
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/prisma ./prisma
COPY package.json ./

# dumb-init for signal forwarding, libssl1.1 for Prisma engine, wget for healthcheck
RUN apt-get update && \
    apt-get install -y dumb-init libssl1.1 wget && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 -r nodejs && \
    useradd -r -u 1001 -g nodejs nodejs

# Set proper permissions
RUN chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application with dumb-init
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main"]
