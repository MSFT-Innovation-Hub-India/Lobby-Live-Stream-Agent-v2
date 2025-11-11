# Deployment Guide

This guide covers deploying the **AI Eye - Hub Lobby Live Stream Agent v2** application to production environments.

## Prerequisites

- Production server (VM, VPS, or cloud instance)
- Domain name (optional but recommended)
- SSL certificate (for HTTPS)
- Azure OpenAI credentials
- RTSP camera access

## Deployment Options

### Option 1: Traditional VM Deployment
### Option 2: Docker Container Deployment
### Option 3: Azure App Service Deployment
### Option 4: AWS EC2 Deployment

---

## Option 1: Traditional VM Deployment

### Server Requirements
- **OS**: Ubuntu 20.04 LTS or newer
- **CPU**: 2+ cores
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 20GB+
- **Network**: 100 Mbps+

### Step 1: Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install FFmpeg
sudo apt install -y ffmpeg

# Install Nginx (for reverse proxy)
sudo apt install -y nginx

# Install PM2 (process manager)
sudo npm install -g pm2
```

### Step 2: Clone and Setup Application

```bash
# Create app directory
sudo mkdir -p /var/www/lobby-stream
cd /var/www/lobby-stream

# Clone repository
git clone https://github.com/MSFT-Innovation-Hub-India/Lobby-Live-Stream-Agent-v2.git .

# Install backend dependencies
cd backend
npm install --production
cp .env.example .env
# Edit .env with production credentials
nano .env

# Build frontend
cd ../frontend
npm install
npm run build
```

### Step 3: Configure Nginx

Create `/etc/nginx/sites-available/lobby-stream`:

```nginx
# Frontend - Static files
server {
    listen 80;
    server_name your-domain.com;
    
    root /var/www/lobby-stream/frontend/dist;
    index index.html;
    
    # Frontend routing
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # API proxy to backend
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Stream files
    location /stream {
        proxy_pass http://localhost:3001;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
    }
    
    # Captured frames
    location /captures {
        proxy_pass http://localhost:3001;
        add_header Cache-Control no-cache;
        add_header Access-Control-Allow-Origin *;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/lobby-stream /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Step 4: Start Backend with PM2

```bash
cd /var/www/lobby-stream/backend

# Start with PM2
pm2 start server.js --name lobby-stream-backend

# Configure PM2 to start on boot
pm2 startup
pm2 save
```

### Step 5: Setup SSL with Let's Encrypt

```bash
# Install certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

### Step 6: Configure Firewall

```bash
# Allow SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# If RTSP access needed
sudo ufw allow 554/tcp

sudo ufw enable
```

---

## Option 2: Docker Container Deployment

### Step 1: Create Dockerfiles

**Backend Dockerfile** (`backend/Dockerfile`):
```dockerfile
FROM node:20-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application files
COPY . .

# Create directories for stream and captures
RUN mkdir -p stream captures

EXPOSE 3001

CMD ["node", "server.js"]
```

**Frontend Dockerfile** (`frontend/Dockerfile`):
```dockerfile
FROM node:20-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build for production
RUN npm run build

# Production stage with nginx
FROM nginx:alpine

# Copy built files
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

**Frontend Nginx Config** (`frontend/nginx.conf`):
```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Proxy API requests to backend
    location /api {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    location /stream {
        proxy_pass http://backend:3001;
        add_header Cache-Control no-cache;
    }
    
    location /captures {
        proxy_pass http://backend:3001;
        add_header Cache-Control no-cache;
    }
}
```

### Step 2: Create Docker Compose

**docker-compose.yml** (root directory):
```yaml
version: '3.8'

services:
  backend:
    build: ./backend
    container_name: lobby-stream-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
    env_file:
      - ./backend/.env
    volumes:
      - ./backend/stream:/app/stream
      - ./backend/captures:/app/captures
    networks:
      - lobby-stream-network

  frontend:
    build: ./frontend
    container_name: lobby-stream-frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - lobby-stream-network

networks:
  lobby-stream-network:
    driver: bridge
```

### Step 3: Deploy with Docker

```bash
# Build and start containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop containers
docker-compose down
```

---

## Option 3: Azure Deployment

### Azure App Service + Azure Container Registry

```bash
# Login to Azure
az login

# Create resource group
az group create --name lobby-stream-rg --location eastus

# Create container registry
az acr create --resource-group lobby-stream-rg \
  --name lobbystreamacr --sku Basic

# Build and push images
az acr build --registry lobbystreamacr \
  --image lobby-stream-backend:latest ./backend

az acr build --registry lobbystreamacr \
  --image lobby-stream-frontend:latest ./frontend

# Create App Service plan
az appservice plan create --name lobby-stream-plan \
  --resource-group lobby-stream-rg --is-linux --sku B2

# Create backend web app
az webapp create --resource-group lobby-stream-rg \
  --plan lobby-stream-plan --name lobby-stream-backend \
  --deployment-container-image-name \
  lobbystreamacr.azurecr.io/lobby-stream-backend:latest

# Configure backend app settings
az webapp config appsettings set --resource-group lobby-stream-rg \
  --name lobby-stream-backend --settings \
  AZURE_OPENAI_ENDPOINT=your-endpoint \
  AZURE_OPENAI_API_KEY=your-key \
  AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o

# Create frontend web app
az webapp create --resource-group lobby-stream-rg \
  --plan lobby-stream-plan --name lobby-stream-frontend \
  --deployment-container-image-name \
  lobbystreamacr.azurecr.io/lobby-stream-frontend:latest
```

---

## Production Checklist

### Security
- [ ] HTTPS enabled with valid SSL certificate
- [ ] CORS restricted to specific domains
- [ ] Authentication implemented
- [ ] API keys secured in environment variables
- [ ] Firewall configured
- [ ] Regular security updates scheduled

### Performance
- [ ] Gzip compression enabled
- [ ] CDN configured (if needed)
- [ ] Caching headers set
- [ ] Database indexes optimized (if added)
- [ ] Load balancing configured (if needed)

### Monitoring
- [ ] Application logs configured
- [ ] Error tracking (e.g., Sentry)
- [ ] Performance monitoring (e.g., New Relic)
- [ ] Uptime monitoring
- [ ] Disk space monitoring

### Backup
- [ ] Database backup schedule (if added)
- [ ] Configuration backup
- [ ] Automated backup to cloud storage

### Documentation
- [ ] Deployment runbook created
- [ ] Environment variables documented
- [ ] Disaster recovery plan
- [ ] Scaling guide

---

## Environment Variables (Production)

```env
# Backend .env
NODE_ENV=production
PORT=3001

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-production-key
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Security (optional, implement in code)
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=https://your-domain.com

# Monitoring (optional)
SENTRY_DSN=your-sentry-dsn
```

---

## Scaling Considerations

### Vertical Scaling
- Increase CPU/RAM on existing server
- Better for single-stream applications

### Horizontal Scaling
- Multiple backend instances behind load balancer
- Shared storage for captured frames (NFS, S3)
- Redis for session management
- Database for frame metadata

### Load Balancer Setup (Nginx)
```nginx
upstream backend {
    least_conn;
    server backend1:3001;
    server backend2:3001;
    server backend3:3001;
}

server {
    location /api {
        proxy_pass http://backend;
    }
}
```

---

## Monitoring and Maintenance

### PM2 Monitoring
```bash
pm2 monit                    # Real-time monitoring
pm2 logs lobby-stream-backend  # View logs
pm2 restart lobby-stream-backend  # Restart app
pm2 reload lobby-stream-backend   # Zero-downtime reload
```

### Docker Monitoring
```bash
docker stats                 # Resource usage
docker-compose logs -f       # Follow logs
docker-compose restart       # Restart services
```

### Health Checks
```bash
# Check backend health
curl http://localhost:3001/health

# Check stream status
curl http://localhost:3001/api/stream/status
```

---

## Troubleshooting Production Issues

### Issue: High CPU Usage
- Check FFmpeg processes: `ps aux | grep ffmpeg`
- Reduce video quality in FFmpeg settings
- Scale horizontally with load balancer

### Issue: High Memory Usage
- Check for memory leaks: `pm2 monit`
- Restart application: `pm2 restart lobby-stream-backend`
- Increase server RAM

### Issue: Slow Frame Analysis
- Check Azure OpenAI API latency
- Consider batch processing
- Implement queue system

---

## Rollback Procedure

### PM2 Deployment
```bash
# Stop current version
pm2 stop lobby-stream-backend

# Checkout previous version
git checkout <previous-commit>
npm install

# Start
pm2 start server.js --name lobby-stream-backend
```

### Docker Deployment
```bash
# Use previous image tag
docker-compose down
docker-compose pull
docker-compose up -d
```

---

## Support

For deployment assistance:
- Open an issue on GitHub
- Contact: Microsoft Innovation Hub India
- Email: [Contact info in README.md]

---

**Note**: This guide covers common deployment scenarios. Adjust based on your specific infrastructure and requirements.
