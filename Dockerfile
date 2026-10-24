FROM node:22-bookworm-slim AS builder

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ libusb-1.0-0-dev pkg-config \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    libusb-1.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
ENV PORT=8096
EXPOSE 8096

CMD ["node", "dist/server/index.js"]
