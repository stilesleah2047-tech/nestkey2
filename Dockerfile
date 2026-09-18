FROM node:20-alpine
WORKDIR /app

# Install backend dependencies first (better layer caching)
COPY backend/package*.json ./backend/
RUN cd backend && npm install --omit=dev

# Copy the app (backend serves the frontend too)
COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend
EXPOSE 4000
CMD ["node", "server.js"]
