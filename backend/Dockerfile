FROM node:22-alpine

# Apply the latest Alpine security patches
RUN apk upgrade --no-cache

WORKDIR /app

COPY package*.json ./
# Install production dependencies, then clear the npm cache
RUN npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force

COPY src ./src

# The app never runs npm or corepack, so remove them to shrink the image and the scan surface
RUN rm -rf /usr/local/lib/node_modules/npm \
           /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# The official node image has a non-root user "node" (uid 1000), which matches runAsUser in the chart
USER node

EXPOSE 5000
CMD ["node", "src/index.js"]