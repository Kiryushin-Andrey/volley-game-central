# Multi-stage build for Volley Game Central

# Stage 1: Build the backend
FROM node:22.16.0-alpine AS backend-builder
WORKDIR /app/backend

# Copy backend package files
COPY backend/package*.json ./

# Install backend dependencies
RUN npm install -g npm@10.9.2
RUN npm install --registry https://registry.npmjs.org

# Copy backend source code
COPY backend/ ./

# Build the backend
RUN npm run build

# Copy npm logs if they exist
RUN mkdir -p /app/npm-logs && cp -r /root/.npm/_logs /app/npm-logs/ || true

# Stage 2: Build the tg-mini-app
FROM node:22.16.0-alpine AS frontend-builder
WORKDIR /app/tg-mini-app

# Copy frontend package files
COPY tg-mini-app/package*.json ./

# Install frontend dependencies
RUN npm install -g npm@10.9.2
RUN npm install --registry https://registry.npmjs.org

# Copy frontend source code
COPY tg-mini-app/ ./

# Build the frontend
RUN npm run build

# Copy npm logs if they exist
RUN mkdir -p /app/npm-logs && cp -r /root/.npm/_logs /app/npm-logs/ || true

# Stage 3: Production image
FROM node:22.16.0-alpine
WORKDIR /app

# Copy backend build artifacts
COPY --from=backend-builder /app/backend/dist ./backend/dist
COPY --from=backend-builder /app/backend/package*.json ./backend/
COPY --from=backend-builder /app/backend/.env.example ./backend/.env
COPY --from=backend-builder /app/backend/drizzle ./backend/drizzle
COPY --from=backend-builder /app/backend/scripts ./backend/scripts

# Install backend production dependencies
WORKDIR /app/backend
RUN npm install -g npm@10.9.2
RUN npm install --registry https://registry.npmjs.org --omit=dev

# Copy npm logs if they exist
RUN mkdir -p /app/npm-logs && cp -r /root/.npm/_logs /app/npm-logs/ || true

# Copy frontend build artifacts
WORKDIR /app
COPY --from=frontend-builder /app/tg-mini-app/dist ./tg-mini-app/dist

# Copy npm logs from build stages
COPY --from=backend-builder /app/npm-logs /app/npm-logs/backend
COPY --from=frontend-builder /app/npm-logs /app/npm-logs/frontend

# Add nginx to serve the frontend
RUN apk add --no-cache nginx

# Create nginx configuration
COPY <<EOF /etc/nginx/http.d/default.conf
server {
    listen 80;
    
    # Serve the frontend
    location / {
        root /app/tg-mini-app/dist;
        try_files \$uri \$uri/ /index.html;
    }
    
    # Proxy API requests to the backend
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

# Expose ports
EXPOSE 80

# Set environment variables
ENV NODE_ENV=production

# Use supervisor to run both nginx and the backend
RUN apk add --no-cache supervisor

# Configure supervisord
RUN mkdir -p /etc/supervisor/conf.d
COPY <<EOF /etc/supervisor/conf.d/supervisord.conf
[supervisord]
nodaemon=true
user=root

[program:nginx]
command=nginx -g "daemon off;"
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0

[program:backend]
command=sh -c 'npm run migrate && npm run start'
directory=/app/backend
autostart=true
autorestart=true
stdout_logfile=/dev/stdout
stdout_logfile_maxbytes=0
stderr_logfile=/dev/stderr
stderr_logfile_maxbytes=0
EOF

# Start supervisord
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
