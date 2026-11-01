FROM oven/bun:1.4.2-alpine AS build

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN bun run typecheck

FROM oven/bun:1.4.2-alpine

WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json /app/bun.lock ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
RUN mkdir -p /app/data && chown -R bun:bun /app
USER bun
CMD ["bun", "src/index.ts"]
