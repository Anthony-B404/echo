# ===========================================
# Stage 1: Dependencies
# ===========================================
FROM node:20-alpine AS deps

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install ffmpeg (includes ffprobe) for audio processing in development
RUN apk add --no-cache ffmpeg

# Set ffmpeg/ffprobe paths for the application
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# ===========================================
# Stage 2: Build
# ===========================================
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the AdonisJS application
RUN node ace build

# ===========================================
# Stage 3: Production
# ===========================================
FROM node:20-alpine AS production

# Install pnpm for production dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install ffmpeg (includes ffprobe) for audio processing
RUN apk add --no-cache ffmpeg

# Set ffmpeg/ffprobe paths for the application
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV FFPROBE_PATH=/usr/bin/ffprobe

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S adonisjs -u 1001

WORKDIR /app

# Copy package files for production install
COPY package.json pnpm-lock.yaml ./

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built application from builder stage
COPY --from=builder /app/build ./

# Create storage directory for file uploads
RUN mkdir -p /app/storage && chown -R adonisjs:nodejs /app/storage

# Set ownership
RUN chown -R adonisjs:nodejs /app

# Switch to non-root user
USER adonisjs

# Expose port
EXPOSE 3333

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3333/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))" || exit 1

# Default command (can be overridden for workers)
CMD ["node", "bin/server.js"]
