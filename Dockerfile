# API service (Railway). Installs only the @daybyday/api subgraph — schemas,
# engine, db — not the heavy Expo mobile app, then runs it with tsx (no separate
# compile step; tsx transpiles the TS workspace packages at runtime).
FROM node:20-slim

# pnpm via corepack, pinned to the repo's packageManager version.
RUN corepack enable

WORKDIR /app

# Copy the whole repo (node_modules / dist / .expo excluded via .dockerignore) so
# pnpm can read every workspace package.json to build the dependency graph.
COPY . .

# Install the API and its workspace dependencies only (skips apps/mobile).
# --prod=false so the tsx devDependency is included.
RUN pnpm install --filter @daybyday/api... --frozen-lockfile --prod=false

# Runtime: Railway injects PORT; the app reads it (default 8080) and binds 0.0.0.0.
ENV NODE_ENV=production
EXPOSE 8080
CMD ["pnpm", "--filter", "@daybyday/api", "exec", "tsx", "src/index.ts"]
