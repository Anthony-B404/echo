# ===========================================
# Stage 1: Dependencies
# ===========================================
FROM node:20-alpine AS deps

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# ===========================================
# Stage 2: Build
# ===========================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build argument for API URL (injected at build time)
ARG API_URL=https://api.dh-echo.cloud
ENV API_URL=$API_URL

# Build the Nuxt application
RUN pnpm build

# ===========================================
# Stage 3: Production (Nginx for SPA)
# ===========================================
FROM nginx:alpine AS production

# Copy custom nginx config for SPA routing
COPY nginx.docker.conf /etc/nginx/conf.d/default.conf

# Copy built SPA files from builder
COPY --from=builder /app/.output/public /usr/share/nginx/html

# Security: Configure nginx to run as non-root user
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
