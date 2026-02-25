FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json yarn.lock* package-lock.json* ./
RUN npm install --production 2>/dev/null || yarn install --frozen-lockfile 2>/dev/null || npm install

# Copy application code
COPY . .

# Create uploads directory
RUN mkdir -p uploads/temp uploads/receipts uploads/invoices uploads/documents uploads/statements

EXPOSE 3001

CMD ["node", "app.js"]
