FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root manifest + lockfile for layer caching
COPY package.json yarn.lock* ./

# Copy only the package.json files needed for workspace install
COPY packages/shared/package.json packages/shared/package.json
COPY apps/web/package.json apps/web/package.json

# Install all workspace dependencies from the repo root
RUN yarn install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY apps/web/ apps/web/

# Build the Vite production bundle
WORKDIR /app/apps/web
RUN npm run build

# --- Production stage: serve with nginx ---
FROM nginx:alpine

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# nginx config: SPA routing + proxy /api to the api container
RUN echo 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri $uri/ /index.html; } \
  location /api { proxy_pass http://api:3001; } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
