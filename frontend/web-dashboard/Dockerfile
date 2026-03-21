FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json only — NOT package-lock.json.
# Lock file generated on Windows omits @rollup/rollup-linux-x64-musl.
# npm install resolves correct platform-specific binaries for Alpine.
COPY package.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget -qO- http://localhost:3000 || exit 1

CMD ["nginx", "-g", "daemon off;"]