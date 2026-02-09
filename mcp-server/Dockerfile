FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
COPY server.json README.md ./
ENV NODE_ENV=production
ENV MCP_TRANSPORT=http
ENV MCP_PORT=3015
EXPOSE 3015
USER node
ENTRYPOINT ["node", "dist/index.js"]
