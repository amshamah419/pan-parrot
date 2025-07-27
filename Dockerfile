# Multi-stage build for production
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Create app user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S panparrot -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=panparrot:nodejs /app/dist ./dist
COPY --from=builder --chown=panparrot:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=panparrot:nodejs /app/package*.json ./
COPY --from=builder --chown=panparrot:nodejs /app/prisma ./prisma
COPY --from=builder --chown=panparrot:nodejs /app/scripts/start.sh ./scripts/start.sh

# Make scripts executable
RUN chmod +x /app/scripts/start.sh

# Switch to non-root user
USER panparrot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/ping', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application with database initialization
CMD ["./scripts/start.sh", "node", "dist/server/node-build.mjs"]
