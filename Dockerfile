# Production Dockerfile for WAPISaaS container deployment
FROM node:22-slim

# Install system dependencies if any are needed
RUN apt-get update && apt-get install -y \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy packages
COPY package*.json ./

# Install dependencies (including production and build tools)
RUN npm ci

# Copy project source
COPY . .

# Build Vite frontend assets and bundle Express backend
RUN npm run build

# Expose internal service port
EXPOSE 5000

# Set production variables
ENV NODE_ENV=production
ENV PORT=5000

# Start server
CMD ["npm", "start"]
