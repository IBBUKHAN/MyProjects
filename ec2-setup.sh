#!/bin/bash

###############################################################################
# EchoMateLite EC2 Setup Script
# Run this script on your Ubuntu EC2 instance after first SSH connection
###############################################################################

set -e  # Exit on error

echo "======================================"
echo "EchoMateLite EC2 Setup Script"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Update system
echo -e "${GREEN}[1/8] Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x LTS
echo -e "${GREEN}[2/8] Installing Node.js 20.x LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify Node.js installation
echo -e "${YELLOW}Node.js version: $(node --version)${NC}"
echo -e "${YELLOW}npm version: $(npm --version)${NC}"

# Install PM2 globally
echo -e "${GREEN}[3/8] Installing PM2 process manager...${NC}"
sudo npm install -g pm2

# Install Nginx
echo -e "${GREEN}[4/8] Installing Nginx...${NC}"
sudo apt install -y nginx

# Install PostgreSQL client
echo -e "${GREEN}[5/8] Installing PostgreSQL client...${NC}"
sudo apt install -y postgresql-client

# Install Git
echo -e "${GREEN}[6/8] Installing Git...${NC}"
sudo apt install -y git

# Install other useful tools
echo -e "${GREEN}[7/8] Installing additional tools...${NC}"
sudo apt install -y curl wget vim htop unzip

# Create application directory
echo -e "${GREEN}[8/8] Setting up application directory...${NC}"
sudo mkdir -p /var/www/echomate
sudo chown -R $USER:$USER /var/www/echomate

# Configure firewall (UFW)
echo -e "${GREEN}Configuring firewall...${NC}"
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow 3000/tcp
echo "y" | sudo ufw enable

# Display status
echo ""
echo "======================================"
echo -e "${GREEN}✅ EC2 Setup Complete!${NC}"
echo "======================================"
echo ""
echo "Installed Software:"
echo "  - Node.js: $(node --version)"
echo "  - npm: $(npm --version)"
echo "  - PM2: $(pm2 --version)"
echo "  - Nginx: $(nginx -v 2>&1)"
echo "  - Git: $(git --version)"
echo "  - PostgreSQL client: $(psql --version)"
echo ""
echo "Application directory: /var/www/echomate"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Clone your repository to /var/www/echomate"
echo "2. Create .env file with your configuration"
echo "3. Install dependencies: npm install"
echo "4. Start application with PM2"
echo "5. Configure Nginx reverse proxy"
echo ""
echo "======================================"

