FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT_STANDALONE=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
ENV RESEARCH_HARNESS=standalone
ENV RESEARCH_PROVIDER=gemini
ENV RESEARCH_MODEL=gemini-2.5-flash
ENV RESEARCH_REVIEW_PROVIDER=gemini
ENV RESEARCH_REVIEW_MODEL=gemini-2.5-flash

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/agents ./agents
COPY --from=builder /app/plugins ./plugins
COPY --from=builder /app/styles ./styles

RUN mkdir -p /app/workspace && chown -R node:node /app
USER node
EXPOSE 8080
CMD ["node", "server.js"]
