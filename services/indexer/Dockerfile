FROM node:20-alpine AS builder
WORKDIR /app/services/indexer
COPY indexer/package.json ./
RUN yarn install
COPY shared /app/services/shared
RUN ln -s /app/services/indexer/node_modules /app/services/node_modules
COPY indexer/tsconfig.json ./
COPY indexer/src ./src
RUN yarn build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/services/indexer/dist ./dist
COPY --from=builder /app/services/indexer/node_modules ./node_modules
COPY indexer/package.json ./
USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "dist/src/index.js"]
