# Stage 1: Install dependencies
FROM oven/bun:1 AS install

WORKDIR /app

# Copy workspace root
COPY package.json bun.lock ./

# Copy all workspace package.json files (Bun needs these for workspace resolution)
COPY packages/shared/package.json packages/shared/package.json
COPY packages/api-server/package.json packages/api-server/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/mcp-server/package.json packages/mcp-server/package.json
COPY packages/cli/package.json packages/cli/package.json

RUN bun install --frozen-lockfile --production

# Stage 2: Runtime
FROM oven/bun:1-slim

WORKDIR /app

COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/package.json ./package.json

# Copy source code
COPY packages/ ./packages/
COPY tsconfig.json ./

EXPOSE 3100

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD bun -e "fetch('http://localhost:3100/api/v1/health').then(r => process.exit(r.ok ? 0 : 1))" || exit 1

CMD ["bun", "run", "packages/api-server/src/index.ts"]
