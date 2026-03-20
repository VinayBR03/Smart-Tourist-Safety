# =================================================================
# Stage 1: Build
# Installs deps and compiles TypeScript + Vite bundle.
# =================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Cache node_modules layer separately from source code.
# npm ci is faster and stricter than npm install — uses
# package-lock.json exactly, fails on any mismatch.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build
# tsc -b type-checks first, then vite build produces /app/dist
COPY . .
RUN npm run build

# =================================================================
# Stage 2: Runtime
# Serve the compiled static bundle with nginx.
# Final image is ~25MB — no Node, no source, no node_modules.
# =================================================================
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config — proxies /api and /ws to backend
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# nginx runs on port 3000 (matches Vite dev server port)
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]