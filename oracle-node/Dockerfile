# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies including devDependencies for the build
RUN npm install

# Copy source code and tsconfig
COPY . .

# Run build
RUN npm run build

# Production stage
FROM node:20-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the built files from builder stage
COPY --from=builder /app/dist ./dist

# Create a placeholder .env if not present (optional, usually provided by host)
RUN touch .env

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
