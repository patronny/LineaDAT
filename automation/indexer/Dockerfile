FROM node:20-alpine
WORKDIR /app

# Install deps first (better cache hits across code-only changes).
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# App source.
COPY tsconfig.json ponder.config.ts ponder.schema.ts ./
COPY abis ./abis
COPY src ./src

# Ponder runs unprivileged. /data holds the pglite DB on a Fly volume.
RUN mkdir -p /data && chown -R node:node /app /data
USER node

ENV NODE_ENV=production
ENV PONDER_LOG_LEVEL=info
# pglite directory inside the mounted volume.
ENV PONDER_DATABASE_DIRECTORY=/data/pglite

EXPOSE 42069

CMD ["npx", "ponder", "start"]
