FROM node:20-alpine AS builder
WORKDIR /app/services/webhook
COPY webhook/package.json ./
RUN yarn install
COPY shared /app/services/shared
RUN ln -s /app/services/webhook/node_modules /app/services/node_modules
COPY webhook/tsconfig.json ./
COPY webhook/src ./src
RUN yarn build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/services/webhook/dist ./dist
COPY --from=builder /app/services/webhook/node_modules ./node_modules
COPY webhook/package.json ./
USER node
EXPOSE 3004
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3004/health || exit 1
CMD ["node", "dist/src/index.js"]
