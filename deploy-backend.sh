#!/bin/bash

###############################################################################
# EchoMateLite Backend Deployment Script
# Run this ON YOUR EC2 INSTANCE after initial setup
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================"
echo "EchoMateLite Backend Deployment"
echo -e "======================================${NC}"
echo ""

# Configuration
APP_DIR="/var/www/echomate"
REPO_URL="https://github.com/yourusername/echomate.git"  # Update this!
BRANCH="main"
APP_NAME="echomate-backend"

# Navigate to app directory
cd $APP_DIR

# Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${RED}Error: .env file not found!${NC}"
    echo "Please create .env file with required environment variables"
    exit 1
fi

# Pull latest code
echo -e "${GREEN}[1/6] Pulling latest code from $BRANCH branch...${NC}"
if [ -d ".git" ]; then
    git pull origin $BRANCH
else
    echo -e "${YELLOW}Git repository not found. Cloning...${NC}"
    git clone -b $BRANCH $REPO_URL .
fi

# Install dependencies
echo -e "${GREEN}[2/6] Installing dependencies...${NC}"
npm install --production

# Build if TypeScript
if [ -f "tsconfig.json" ]; then
    echo -e "${GREEN}[3/6] Building TypeScript...${NC}"
    npm run build
else
    echo -e "${YELLOW}[3/6] No TypeScript build needed${NC}"
fi

# Run database migrations (if using TypeORM or similar)
if [ -f "package.json" ] && grep -q "\"typeorm\"" package.json; then
    echo -e "${GREEN}[4/6] Running database migrations...${NC}"
    npm run migration:run || echo -e "${YELLOW}No migrations to run${NC}"
else
    echo -e "${YELLOW}[4/6] No migrations configured${NC}"
fi

# Stop existing PM2 process
echo -e "${GREEN}[5/6] Restarting application with PM2...${NC}"
pm2 delete $APP_NAME 2>/dev/null || true

# Start application with PM2
if [ -f "dist/server/index.js" ]; then
    # TypeScript build
    pm2 start dist/server/index.js --name $APP_NAME
elif [ -f "server/index.js" ]; then
    # JavaScript
    pm2 start server/index.js --name $APP_NAME
elif [ -f "dist/index.js" ]; then
    pm2 start dist/index.js --name $APP_NAME
elif [ -f "index.js" ]; then
    pm2 start index.js --name $APP_NAME
else
    echo -e "${RED}Error: Could not find entry point!${NC}"
    exit 1
fi

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system reboot
pm2 startup systemd -u $USER --hp /home/$USER

# Show status
echo -e "${GREEN}[6/6] Deployment complete!${NC}"
echo ""
echo -e "${BLUE}======================================"
echo "Application Status"
echo -e "======================================${NC}"
pm2 status
echo ""
echo -e "${YELLOW}View logs: pm2 logs $APP_NAME${NC}"
echo -e "${YELLOW}Monitor: pm2 monit${NC}"
echo -e "${YELLOW}Stop: pm2 stop $APP_NAME${NC}"
echo -e "${YELLOW}Restart: pm2 restart $APP_NAME${NC}"
echo ""
echo -e "${GREEN}✅ Deployment successful!${NC}"

