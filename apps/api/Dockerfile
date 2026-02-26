FROM node:20-alpine

WORKDIR /app

# Copy workspace root manifest + lockfile first (layer cache)
COPY package.json yarn.lock* ./

# Copy only the package.json files needed for workspace install
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json

# Install all workspace dependencies from the repo root
RUN yarn install --frozen-lockfile

# Copy source code
COPY packages/shared/ packages/shared/
COPY apps/api/ apps/api/

# Create uploads directory
RUN mkdir -p apps/api/uploads/temp apps/api/uploads/receipts \
    apps/api/uploads/invoices apps/api/uploads/documents apps/api/uploads/statements

WORKDIR /app/apps/api

EXPOSE 3001

CMD ["node", "app.js"]
