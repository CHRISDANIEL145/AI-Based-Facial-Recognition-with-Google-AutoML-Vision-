# Use official Node.js LTS image
FROM node:18

# Set the working directory
WORKDIR /app

# Install system dependencies for node-canvas
RUN apt-get update && apt-get install -y \
  libcairo2-dev \
  libpango1.0-dev \
  libjpeg-dev \
  libgif-dev \
  librsvg2-dev \
  && rm -rf /var/lib/apt/lists/*

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Ensure the captures and public folders exist
RUN mkdir -p captures public

# Set environment variables if needed (example)
# ENV GOOGLE_APPLICATION_CREDENTIALS=sapient-torch-456008-q9-6bc6576e3863.json

# Expose the app port
EXPOSE 3000

# Start the app
CMD ["node", "index.js"]
