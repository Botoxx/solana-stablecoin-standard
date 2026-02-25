FROM node:20-alpine AS builder
WORKDIR /app/services/mint-burn
COPY mint-burn/package.json ./
RUN yarn install
COPY shared /app/services/shared
RUN ln -s /app/services/mint-burn/node_modules /app/services/node_modules
COPY mint-burn/tsconfig.json ./
COPY mint-burn/src ./src
RUN yarn build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/services/mint-burn/dist ./dist
COPY --from=builder /app/services/mint-burn/node_modules ./node_modules
COPY mint-burn/package.json ./
USER node
EXPOSE 3002
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3002/health || exit 1
CMD ["node", "dist/src/index.js"]
