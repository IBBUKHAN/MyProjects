# EchoMateLite AWS Deployment - Quick Start Guide

This guide will help you deploy EchoMateLite to AWS in the fastest way possible.

---

## 📁 Documentation Files

- **`AWS_DEPLOYMENT_GUIDE.md`** - Complete detailed guide with all AWS services
- **`DEPLOYMENT_CHECKLIST.md`** - Step-by-step checklist to track progress
- **`QUICK_START.md`** - This file - simplified overview
- **`ec2-setup.sh`** - Automated EC2 instance setup script
- **`deploy-backend.sh`** - Backend deployment script (run on EC2)
- **`deploy-frontend.sh`** - Frontend deployment script (run locally)
- **`nginx-config.conf`** - Nginx reverse proxy configuration

---

## 🚀 30-Minute Quick Deploy (Development/Testing)

### Prerequisites

- AWS account with payment method added
- AWS CLI installed and configured locally
- Domain name (optional for testing)

---

### Phase 1: AWS Infrastructure (20 minutes)

#### 1. Create RDS Database

```bash
# In AWS Console
1. Go to RDS → Create Database
2. PostgreSQL, Free Tier (db.t3.micro)
3. DB identifier: echomate-db
4. Master user: postgres, Password: [your-password]
5. Database name: echomate_db
6. Public access: Yes
7. Create database
8. Save endpoint: echomate-db.xxxxx.us-east-1.rds.amazonaws.com
```

#### 2. Create EC2 Instance

```bash
# In AWS Console
1. EC2 → Launch Instance
2. Name: echomate-backend
3. Ubuntu 22.04 LTS, t2.micro
4. Create key pair: echomate-key.pem (download it!)
5. Security groups: Allow SSH (22), HTTP (80), HTTPS (443), Custom (3000)
6. Launch instance
7. Save public IP
```

#### 3. Create S3 Buckets

```bash
# Media bucket
aws s3 mb s3://echomate-media-$(date +%s) --region us-east-1

# Frontend bucket
aws s3 mb s3://echomate-frontend-$(date +%s) --region us-east-1
aws s3 website s3://echomate-frontend-XXXXX --index-document index.html
```

#### 4. Create Cognito User Pool

```bash
# In AWS Console
1. Cognito → Create User Pool
2. Email sign-in
3. Password policy: Standard
4. User pool name: echomate-users
5. App client: echomate-web-client
6. Save: User Pool ID, Client ID, Client Secret
```

---

### Phase 2: Backend Deployment (5 minutes)

```bash
# 1. SSH into EC2
chmod 400 ~/Downloads/echomate-key.pem
mv ~/Downloads/echomate-key.pem ~/.ssh/
ssh -i ~/.ssh/echomate-key.pem ubuntu@YOUR-EC2-IP

# 2. Run setup script
curl -o setup.sh https://raw.githubusercontent.com/YOUR-REPO/ec2-setup.sh
chmod +x setup.sh
./setup.sh

# 3. Clone your repository
cd /var/www/echomate
git clone YOUR-REPO-URL .

# 4. Create .env file
nano .env
# Paste your environment variables (see AWS_DEPLOYMENT_GUIDE.md)

# 5. Deploy
npm install
npm run build  # if TypeScript
pm2 start server/index.js --name echomate-backend
pm2 save
pm2 startup

# 6. Configure Nginx
sudo nano /etc/nginx/sites-available/echomate
# Copy contents from nginx-config.conf
sudo ln -s /etc/nginx/sites-available/echomate /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Phase 3: Frontend Deployment (5 minutes)

```bash
# On your local machine

# 1. Create client/.env file
cd client
nano .env
# Add:
VITE_API_URL=http://YOUR-EC2-IP:3000
VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXX
VITE_COGNITO_CLIENT_ID=XXXXX

# 2. Build
npm install
npm run build

# 3. Deploy to S3 (manual)
aws s3 sync dist/ s3://YOUR-FRONTEND-BUCKET/ --delete

# 4. Test
# Open: http://YOUR-FRONTEND-BUCKET.s3-website-us-east-1.amazonaws.com
```

---

## 🎯 Production Deployment (Additional Steps)

### 1. SSL Certificate (ACM)

```bash
1. ACM → Request Certificate (in us-east-1 for CloudFront)
2. Add domains: yourdomain.com, www.yourdomain.com, api.yourdomain.com
3. DNS validation → Add CNAME to your DNS
4. Wait for "Issued" status
```

### 2. CloudFront Distribution

```bash
1. CloudFront → Create Distribution
2. Origin: Your S3 frontend bucket
3. CNAME: yourdomain.com, www.yourdomain.com
4. SSL: Select your ACM certificate
5. Error pages: 403, 404 → /index.html (200)
6. Deploy and note CloudFront domain
```

### 3. Update DNS

```bash
1. Go to your DNS provider (Route 53, GoDaddy, etc.)
2. Add A record (or CNAME): yourdomain.com → CloudFront domain
3. Add A record (or CNAME): www.yourdomain.com → CloudFront domain
4. Add A record: api.yourdomain.com → EC2 public IP
5. Wait for DNS propagation (5-30 minutes)
```

### 4. CloudWatch Monitoring

```bash
1. CloudWatch → Log Groups → Create:
   - /aws/echomate/backend
   - /aws/echomate/errors
2. Create alarms:
   - EC2 CPU > 80%
   - RDS Connections > 80
```

---

## 🔄 Daily Operations

### Deploy Backend Updates

```bash
ssh -i ~/.ssh/echomate-key.pem ubuntu@YOUR-EC2-IP
cd /var/www/echomate
git pull origin main
npm install
npm run build
pm2 restart echomate-backend
pm2 logs
```

### Deploy Frontend Updates

```bash
# Local machine
cd client
npm run build
aws s3 sync dist/ s3://YOUR-FRONTEND-BUCKET/ --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id YOUR-DISTRIBUTION-ID \
  --paths "/*"
```

### Monitor Application

```bash
# EC2 logs
pm2 logs echomate-backend
pm2 monit

# Nginx logs
sudo tail -f /var/log/nginx/echomate-error.log

# CloudWatch
# Go to AWS Console → CloudWatch → Log Groups
```

### Database Backup

```bash
# Manual backup
pg_dump -h YOUR-RDS-ENDPOINT -U postgres echomate_db > backup.sql

# Restore
psql -h YOUR-RDS-ENDPOINT -U postgres echomate_db < backup.sql
```

---

## 🐛 Troubleshooting

### Backend not accessible

```bash
# Check if running
pm2 status

# Check logs
pm2 logs echomate-backend

# Check port
sudo netstat -tlnp | grep 3000

# Check Nginx
sudo nginx -t
sudo systemctl status nginx
```

### Database connection error

```bash
# Test connection
psql -h YOUR-RDS-ENDPOINT -U postgres -d echomate_db

# Check security group
# RDS SG must allow EC2 SG on port 5432
```

### Frontend 403/404 errors

```bash
# Check S3 bucket policy (must allow public read)
# Check CloudFront error pages configured
# Clear browser cache
```

### CORS errors

```bash
# Check backend CORS configuration
# Ensure ALLOWED_ORIGINS in .env includes frontend URL
# Check Nginx CORS headers
```

---

## 💰 Cost Optimization

- **Free Tier (First 12 months)**: ~$0-10/month

  - EC2 t2.micro: 750 hours free
  - RDS t3.micro: 750 hours free
  - S3: 5GB free
  - CloudFront: 50GB free

- **After Free Tier**: ~$30-50/month
  - Consider Reserved Instances for 30-50% savings
  - Use S3 Lifecycle policies to delete old files
  - Set CloudWatch log retention to 7 days
  - Stop EC2/RDS when not in use (dev environments)

---

## 🔒 Security Checklist

- [ ] Changed all default passwords
- [ ] Enabled MFA on AWS root account
- [ ] Limited EC2 SSH to your IP only
- [ ] Using environment variables (not hardcoded)
- [ ] HTTPS enabled (production)
- [ ] Database not publicly accessible (production)
- [ ] S3 buckets have proper policies
- [ ] CloudTrail enabled for audit logs
- [ ] Regular backups configured
- [ ] Security updates applied monthly

---

## 📚 Resources

- **AWS Documentation**: https://docs.aws.amazon.com/
- **AWS Free Tier**: https://aws.amazon.com/free/
- **AWS Support**: https://console.aws.amazon.com/support/
- **AWS Calculator**: https://calculator.aws/

---

## 🆘 Support

If you encounter issues:

1. Check logs: `pm2 logs`, Nginx logs, CloudWatch
2. Review security groups and network settings
3. Verify environment variables
4. Check AWS Service Health Dashboard
5. Consult AWS documentation

---

## 🎉 Success!

Once deployed:

- **Frontend**: https://yourdomain.com
- **Backend API**: https://api.yourdomain.com
- **Health Check**: https://api.yourdomain.com/health

**Next Steps:**

- Set up monitoring alerts
- Configure automated backups
- Plan scaling strategy
- Document your architecture
- Train your team

Good luck! 🚀
