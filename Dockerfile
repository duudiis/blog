# syntax=docker/dockerfile:1.6

# ---- Base node image version ----
ARG NODE_VERSION=20.12.2

# ---- Builder stage ----
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# Install system deps if needed (sqlite bindings use pure JS in sqlite3 >=5 w prebuilds)
RUN apk add --no-cache libc6-compat

# ---- Build args ----
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ARG ADMIN_EMAIL
ARG JWT_SECRET

# Set ENV for Next.js build
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
    ADMIN_EMAIL=${ADMIN_EMAIL} \
    JWT_SECRET=${JWT_SECRET} \
    NEXT_TELEMETRY_DISABLED=1

# Copy dependency manifests first for better caching
COPY package.json package-lock.json* ./

# Install deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Copy rest of the source
COPY . .

# Build Next.js app
RUN npm run build

# ---- Runner stage ----
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

RUN apk add --no-cache libc6-compat

# ---- Runtime ENV ----
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=${NEXT_PUBLIC_GOOGLE_CLIENT_ID} \
    ADMIN_EMAIL=${ADMIN_EMAIL} \
    JWT_SECRET=${JWT_SECRET}

# Copy only the minimal runtime artifacts
COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/.next/ ./.next/
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Create directories for persistent data inside the container
RUN mkdir -p /app/public/uploads /app/data

# Expose the data and uploads as volumes so Portainer users can bind host paths
VOLUME ["/app/data", "/app/public/uploads"]

# Expose port
EXPOSE 3000

# Start the app
CMD ["npm", "run", "start"]