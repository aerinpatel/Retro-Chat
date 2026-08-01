# 1. Base Image with Node.js
FROM node:20-alpine AS builder

# Install pnpm directly
RUN npm install -g pnpm

# 2. Set working directory
WORKDIR /app

# 3. Copy dependency definitions
COPY package.json pnpm-lock.yaml* tsconfig*.json ./

# 4. Install all dependencies
RUN pnpm install --frozen-lockfile

# 5. Copy source code
COPY . .

# 6. Build TypeScript to JavaScript (/dist)
RUN pnpm exec tsc -b

# 7. Production Runner stage
FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
# Install only production dependencies
RUN pnpm install --prod --frozen-lockfile

# Copy compiled JavaScript from builder stage
COPY --from=builder /app/dist ./dist

# Expose server port
EXPOSE 8080

# Run the server
CMD ["node", "dist/index.js"]
