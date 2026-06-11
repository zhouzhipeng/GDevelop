FROM node:20-alpine

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy the server source.
COPY server.js ./
COPY src ./src

# Project data lives here; mount a volume to persist it.
ENV MY_CLOUD_DATA_DIR=/data
ENV PORT=3030
ENV HOST=0.0.0.0
VOLUME ["/data"]
EXPOSE 3030

# Set MY_CLOUD_TOKEN at runtime to require an access token:
#   docker run -e MY_CLOUD_TOKEN=your-secret -p 3030:3030 -v gd-cloud:/data gdevelop-my-cloud
CMD ["node", "server.js"]
