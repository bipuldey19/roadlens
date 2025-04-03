# Use Node.js LTS version
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Create volume mount points
RUN mkdir -p /app/node_modules

# Expose port
EXPOSE 4000

# Start the app
CMD ["npm", "start"] 