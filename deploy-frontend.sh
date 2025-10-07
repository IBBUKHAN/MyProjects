#!/bin/bash

###############################################################################
# EchoMateLite Frontend Deployment Script
# Run this ON YOUR LOCAL MACHINE to build and deploy frontend to S3
###############################################################################

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================"
echo "EchoMateLite Frontend Deployment"
echo -e "======================================${NC}"
echo ""

# Configuration - UPDATE THESE!
S3_BUCKET="echomate-frontend-2025"  # Your S3 bucket name
CLOUDFRONT_ID="E1234567890ABC"      # Your CloudFront distribution ID
AWS_REGION="us-east-1"
BUILD_DIR="client/dist"

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI not installed!${NC}"
    echo "Install it: https://aws.amazon.com/cli/"
    exit 1
fi

# Check if .env exists
if [ ! -f "client/.env" ]; then
    echo -e "${YELLOW}Warning: client/.env not found${NC}"
    echo "Make sure environment variables are set for production"
fi

# Navigate to client directory
echo -e "${GREEN}[1/5] Navigating to client directory...${NC}"
cd client

# Install dependencies
echo -e "${GREEN}[2/5] Installing dependencies...${NC}"
npm install

# Build frontend
echo -e "${GREEN}[3/5] Building production bundle...${NC}"
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo -e "${RED}Error: Build failed! dist directory not found${NC}"
    exit 1
fi

# Upload to S3
echo -e "${GREEN}[4/5] Uploading to S3 bucket: $S3_BUCKET...${NC}"
aws s3 sync dist/ s3://$S3_BUCKET/ \
    --region $AWS_REGION \
    --delete \
    --cache-control "public, max-age=31536000" \
    --exclude "index.html" \
    --exclude "*.map"

# Upload index.html separately with no-cache
echo -e "${GREEN}Uploading index.html with no-cache...${NC}"
aws s3 cp dist/index.html s3://$S3_BUCKET/index.html \
    --region $AWS_REGION \
    --cache-control "no-cache, no-store, must-revalidate" \
    --content-type "text/html"

# Invalidate CloudFront cache
echo -e "${GREEN}[5/5] Invalidating CloudFront cache...${NC}"
INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $CLOUDFRONT_ID \
    --paths "/*" \
    --query 'Invalidation.Id' \
    --output text)

echo -e "${YELLOW}CloudFront invalidation created: $INVALIDATION_ID${NC}"
echo -e "${YELLOW}Waiting for invalidation to complete (this may take 2-5 minutes)...${NC}"

# Wait for invalidation
aws cloudfront wait invalidation-completed \
    --distribution-id $CLOUDFRONT_ID \
    --id $INVALIDATION_ID

echo ""
echo -e "${BLUE}======================================"
echo "Deployment Summary"
echo -e "======================================${NC}"
echo -e "S3 Bucket: ${GREEN}$S3_BUCKET${NC}"
echo -e "CloudFront Distribution: ${GREEN}$CLOUDFRONT_ID${NC}"
echo -e "Invalidation ID: ${GREEN}$INVALIDATION_ID${NC}"
echo ""
echo -e "${GREEN}✅ Frontend deployed successfully!${NC}"
echo ""
echo "Your app should be live at:"
echo "https://yourdomain.com"
echo ""
echo -e "${BLUE}======================================${NC}"

