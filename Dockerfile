# Use Bun official image
FROM oven/bun:1.0

WORKDIR /app

# Copy package and lock files
COPY package.json bun.lock bunfig.toml ./

# Install dependencies
RUN bun install

# Copy the rest of the app
COPY . .

# Build the app (if you have a build step, e.g., for TypeScript)
RUN bun run build

# Expose the app port
EXPOSE 3000

# Start the app
CMD ["bun", "start"]
