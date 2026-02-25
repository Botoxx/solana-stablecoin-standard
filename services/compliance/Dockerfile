FROM node:20-alpine AS builder
WORKDIR /app/services/compliance
COPY compliance/package.json ./
RUN yarn install
COPY shared /app/services/shared
RUN ln -s /app/services/compliance/node_modules /app/services/node_modules
COPY compliance/tsconfig.json ./
COPY compliance/src ./src
RUN yarn build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/services/compliance/dist ./dist
COPY --from=builder /app/services/compliance/node_modules ./node_modules
COPY compliance/package.json ./
USER node
EXPOSE 3003
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://localhost:3003/health || exit 1
CMD ["node", "dist/src/index.js"]
