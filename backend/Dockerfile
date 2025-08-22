# Backend Dockerfile for OnDottedLine
# Uses Node.js 20 LTS
FROM node:20-alpine

# Install system deps (openssl for RFC3161 TSQ, CA certs for TLS, bash for scripts)
RUN apk add --no-cache bash openssl ca-certificates \
    && update-ca-certificates

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy the rest of the source
COPY . .

# Create non-root user and adjust permissions
RUN addgroup -S app && adduser -S -G app app \
    && chown -R app:app /app

USER app

# Environment
ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

# Default command; override in compose if migrations need to run first
CMD ["npm", "start"]
