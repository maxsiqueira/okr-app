# Build Stage
FROM node:20-alpine as builder

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

# Build frontend
RUN npm run build

# Production Stage
FROM node:20-alpine

WORKDIR /app

# Copy built assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json

# CRITICAL: Install PRODUCTION dependencies in the final image to ensure they exist
# We do not rely on copying from builder node_modules to avoid symlink/platform issues
COPY package-lock.json ./package-lock.json
RUN npm ci --omit=dev

EXPOSE 3001

CMD ["node", "server/proxy.js"]
