# Stage 1: Build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build application
RUN bun run build

# Stage 2: Production with Nginx
FROM node:20-alpine AS runner

WORKDIR /app

# Install nginx
RUN apk add --no-cache nginx && mkdir -p /etc/nginx/http.d

# Copy built application from builder
COPY --from=builder /app/out ./
COPY --from=builder /app/public ./public

# Configure nginx for SPA
RUN echo 'server { \
    listen 3000; \
    root /app; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /dashboard { \
        try_files $uri $uri/ /dashboard/index.html; \
    } \
}' > /etc/nginx/http.d/default.conf

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]