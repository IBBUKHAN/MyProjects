# EchoMateLite AWS Deployment Checklist

Use this checklist to track your deployment progress.

## 🎯 Pre-Deployment

- [ ] AWS account created and verified
- [ ] Credit card added to AWS account
- [ ] Domain name purchased (optional but recommended)
- [ ] Code ready and tested locally
- [ ] Git repository set up

---

## 🔐 Step 1: IAM Setup (15 minutes)

- [ ] Created IAM user: `echomate-deployer`
- [ ] Attached required policies
- [ ] Generated access keys
- [ ] Configured AWS CLI locally (`aws configure`)
- [ ] Tested AWS CLI: `aws s3 ls`

**Saved Credentials:**

- [ ] Access Key ID saved securely
- [ ] Secret Access Key saved securely

---

## 🗄️ Step 2: RDS Database (20 minutes)

- [ ] Created PostgreSQL RDS instance: `echomate-db`
- [ ] Database status: **Available**
- [ ] Configured security group: `echomate-rds-sg`
- [ ] Allowed PostgreSQL port 5432
- [ ] Tested connection from local machine

**Save These Values:**

- [ ] RDS Endpoint: `____________________________`
- [ ] Master username: `postgres`
- [ ] Master password: `____________________________`
- [ ] Database name: `echomate_db`

---

## 🖥️ Step 3: EC2 Backend Server (30 minutes)

- [ ] Launched EC2 instance: `echomate-backend`
- [ ] Instance type: t2.micro / t3.micro
- [ ] OS: Ubuntu 22.04 LTS
- [ ] Created key pair: `echomate-key.pem`
- [ ] Downloaded and secured key pair
- [ ] Created security group: `echomate-backend-sg`
- [ ] Opened ports: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (API)
- [ ] Instance state: **Running**
- [ ] Successfully SSH'd into instance
- [ ] Updated RDS security group to allow EC2 access

**Installed on EC2:**

- [ ] Node.js v20.x
- [ ] npm
- [ ] PM2 process manager
- [ ] Nginx web server
- [ ] PostgreSQL client
- [ ] Git

**Save These Values:**

- [ ] EC2 Public IP: `____________________________`
- [ ] EC2 Public DNS: `____________________________`

---

## 🪣 Step 4: S3 Storage (25 minutes)

### Media Bucket

- [ ] Created bucket: `echomate-media-____`
- [ ] Configured bucket policy (public read)
- [ ] Configured CORS
- [ ] Tested upload

### Frontend Bucket

- [ ] Created bucket: `echomate-frontend-____`
- [ ] Enabled static website hosting
- [ ] Configured bucket policy
- [ ] Set index.html and error.html
- [ ] Noted website endpoint

### IAM for S3

- [ ] Created IAM user: `echomate-s3-user`
- [ ] Attached S3 permissions
- [ ] Generated access keys

**Save These Values:**

- [ ] Media bucket name: `____________________________`
- [ ] Frontend bucket name: `____________________________`
- [ ] S3 Website endpoint: `____________________________`
- [ ] S3 Access Key ID: `____________________________`
- [ ] S3 Secret Access Key: `____________________________`

---

## 🔒 Step 5: SSL Certificate (ACM) (20 minutes)

- [ ] Requested SSL certificate in us-east-1
- [ ] Added domains:
  - [ ] yourdomain.com
  - [ ] www.yourdomain.com
  - [ ] api.yourdomain.com
- [ ] Selected DNS validation
- [ ] Added CNAME records to DNS provider
- [ ] Certificate status: **Issued** ✅

**Save These Values:**

- [ ] Certificate ARN: `____________________________`

---

## 🌐 Step 6: CloudFront CDN (20 minutes)

- [ ] Created CloudFront distribution
- [ ] Configured S3 frontend bucket as origin
- [ ] Set HTTPS redirect
- [ ] Added alternate domain names (CNAMEs)
- [ ] Attached SSL certificate
- [ ] Set default root object: index.html
- [ ] Created custom error responses (403, 404 → index.html)
- [ ] Distribution status: **Deployed**

**Save These Values:**

- [ ] CloudFront domain: `____________________________`
- [ ] Distribution ID: `____________________________`

---

## 🔐 Step 7: AWS Cognito (30 minutes)

### User Pool

- [ ] Created user pool: `echomate-users`
- [ ] Configured sign-in with email
- [ ] Set password policy
- [ ] Enabled self-registration
- [ ] Set required attributes (name, email)
- [ ] Created app client: `echomate-web-client`
- [ ] Configured authentication flows
- [ ] Set callback URLs
- [ ] User pool status: **Active**

### Identity Pool (Optional)

- [ ] Created identity pool: `echomate_identity_pool`
- [ ] Linked to user pool
- [ ] Configured IAM roles

**Save These Values:**

- [ ] User Pool ID: `____________________________`
- [ ] App Client ID: `____________________________`
- [ ] App Client Secret: `____________________________`
- [ ] Cognito Domain: `____________________________`
- [ ] Identity Pool ID: `____________________________`

---

## 📊 Step 8: CloudWatch Monitoring (15 minutes)

- [ ] Created log group: `/aws/echomate/backend`
- [ ] Created log group: `/aws/echomate/nginx`
- [ ] Created log group: `/aws/echomate/errors`
- [ ] Installed CloudWatch agent on EC2
- [ ] Configured CloudWatch agent
- [ ] Created CPU utilization alarm
- [ ] Created RDS connection alarm
- [ ] Configured SNS topic for notifications

---

## 🌍 Step 9: DNS Configuration (10 minutes)

- [ ] Updated DNS A record for root domain → CloudFront
- [ ] Updated DNS A record for www → CloudFront
- [ ] Updated DNS A record for api → EC2 or ALB
- [ ] Verified DNS propagation
- [ ] Tested domain in browser

---

## 📝 Step 10: Environment Variables

- [ ] Created `.env` file on EC2 backend
- [ ] Added all required variables
- [ ] Created `.env` file for frontend build
- [ ] Tested environment variable loading

---

## 🚀 Step 11: Backend Deployment

- [ ] Cloned repository to EC2
- [ ] Installed dependencies: `npm install`
- [ ] Built application (if needed)
- [ ] Started with PM2: `pm2 start`
- [ ] Configured PM2 to start on reboot
- [ ] Configured Nginx reverse proxy
- [ ] Tested API endpoints
- [ ] Checked PM2 logs: `pm2 logs`

---

## 🎨 Step 12: Frontend Deployment

- [ ] Built frontend: `npm run build`
- [ ] Uploaded build files to S3 frontend bucket
- [ ] Invalidated CloudFront cache
- [ ] Tested website in browser
- [ ] Verified all pages load correctly
- [ ] Tested routing (SPA navigation)

---

## ✅ Step 13: End-to-End Testing

- [ ] User registration works
- [ ] Email verification works (if enabled)
- [ ] User login works
- [ ] JWT tokens received
- [ ] User profile loads
- [ ] Profile picture upload works
- [ ] Create post works
- [ ] Post media upload works
- [ ] Post feed displays correctly
- [ ] Like/comment functionality works
- [ ] User logout works
- [ ] All API calls use HTTPS
- [ ] CloudWatch logs appearing

---

## 🔒 Step 14: Security Hardening

- [ ] Removed temporary security group rules
- [ ] Restricted SSH to specific IP
- [ ] Enabled EC2 instance firewall (UFW)
- [ ] Reviewed IAM permissions (least privilege)
- [ ] Enabled RDS encryption
- [ ] Enabled S3 bucket versioning
- [ ] Configured S3 lifecycle policies
- [ ] Set up automated backups
- [ ] Enabled CloudTrail logging
- [ ] Reviewed all security groups
- [ ] Changed all default passwords
- [ ] Enabled MFA on AWS root account

---

## 📈 Step 15: Performance Optimization

- [ ] Enabled CloudFront compression
- [ ] Configured browser caching headers
- [ ] Optimized images
- [ ] Enabled lazy loading
- [ ] Configured RDS performance insights
- [ ] Set up auto-scaling (if needed)
- [ ] Reviewed CloudWatch metrics

---

## 💰 Step 16: Cost Management

- [ ] Set up AWS Budgets
- [ ] Created billing alarm
- [ ] Reviewed resource usage
- [ ] Configured S3 lifecycle to delete old logs
- [ ] Stopped unused resources
- [ ] Documented expected monthly costs

---

## 📚 Step 17: Documentation

- [ ] Documented all credentials securely
- [ ] Created deployment runbook
- [ ] Documented rollback procedure
- [ ] Created troubleshooting guide
- [ ] Documented API endpoints
- [ ] Created user guide

---

## 🎉 Launch!

- [ ] Final testing complete
- [ ] Team notified
- [ ] Monitoring dashboard set up
- [ ] Support plan in place
- [ ] Backup/recovery tested
- [ ] **Application is LIVE!** 🚀

---

## 📞 Emergency Contacts

- AWS Support: https://console.aws.amazon.com/support/
- Account ID: `____________________________`
- Region: `us-east-1`

---

## 🔄 Post-Launch Tasks

- [ ] Monitor CloudWatch for 24 hours
- [ ] Check for errors in logs
- [ ] Monitor costs daily for first week
- [ ] Collect user feedback
- [ ] Plan first update/patch

---

**Deployment Date:** ******\_\_\_******

**Deployed By:** ******\_\_\_******

**Status:** ⬜ In Progress | ⬜ Complete

---

Good luck with your deployment! 🚀
