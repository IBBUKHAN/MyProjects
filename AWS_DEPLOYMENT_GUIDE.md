# EchoMateLite AWS Deployment Guide

## Architecture Overview

- **Frontend**: S3 + CloudFront (Static hosting)
- **Backend**: EC2 (NestJS/Node.js server)
- **Database**: RDS (PostgreSQL)
- **Authentication**: AWS Cognito + JWT
- **Storage**: S3 (Profile pictures & media)
- **API**: API Gateway (Optional) + Lambda (Optional)
- **Security**: ACM (SSL/TLS), IAM, Security Groups
- **Monitoring**: CloudWatch

---

## Step-by-Step AWS Setup

### 🔐 Step 1: AWS Account Setup & IAM Configuration

#### 1.1 Create IAM User for Deployment

```
1. Go to AWS Console → IAM → Users
2. Click "Create User"
3. Username: "echomate-deployer"
4. Enable "Provide user access to AWS Management Console" (optional)
5. Click "Next"
```

#### 1.2 Attach Policies

Attach these managed policies:

- `AmazonEC2FullAccess`
- `AmazonRDSFullAccess`
- `AmazonS3FullAccess`
- `CloudFrontFullAccess`
- `AWSCertificateManagerFullAccess`
- `CloudWatchFullAccess`
- `AmazonCognitoPowerUser`
- `IAMFullAccess`

#### 1.3 Create Access Keys

```
1. Select the user → Security credentials tab
2. Create access key → Choose "CLI" use case
3. Download and save the credentials securely
4. Configure AWS CLI:
   aws configure
   - AWS Access Key ID: [your-access-key]
   - AWS Secret Access Key: [your-secret-key]
   - Default region: us-east-1 (or your preferred region)
   - Default output format: json
```

---

### 🗄️ Step 2: Amazon RDS (PostgreSQL Database)

#### 2.1 Create RDS Instance

```
1. Go to AWS Console → RDS → Databases
2. Click "Create database"
3. Choose:
   - Engine: PostgreSQL
   - Version: 15.x or latest
   - Template: Free tier (for testing) OR Production (for production)

4. Settings:
   - DB instance identifier: echomate-db
   - Master username: postgres
   - Master password: [Create strong password - save it!]
   - Confirm password

5. Instance configuration:
   - Free tier: db.t3.micro OR db.t4g.micro
   - Production: db.t3.small or higher

6. Storage:
   - Allocated storage: 20 GB (minimum)
   - Storage type: General Purpose SSD (gp3)
   - Enable storage autoscaling: Yes
   - Maximum storage threshold: 100 GB

7. Connectivity:
   - VPC: Default VPC
   - Public access: Yes (for initial setup - restrict later)
   - VPC security group: Create new → "echomate-rds-sg"
   - Availability Zone: No preference
   - Database port: 5432

8. Additional configuration:
   - Initial database name: echomate_db
   - Enable automated backups: Yes
   - Backup retention: 7 days
   - Enable encryption: Yes

9. Click "Create database"
10. Wait 5-10 minutes for creation
```

#### 2.2 Configure RDS Security Group

```
1. Go to EC2 → Security Groups → Find "echomate-rds-sg"
2. Edit Inbound Rules:
   - Type: PostgreSQL
   - Protocol: TCP
   - Port: 5432
   - Source: Custom (we'll update this with EC2 security group later)
   - Temporarily use: My IP (for testing)
3. Save rules
```

#### 2.3 Note Down RDS Endpoint

```
1. Go to RDS → Databases → echomate-db
2. Copy the "Endpoint" (e.g., echomate-db.xxxxx.us-east-1.rds.amazonaws.com)
3. Save this for backend configuration
```

---

### 🖥️ Step 3: Amazon EC2 (Backend Server)

#### 3.1 Create EC2 Instance

```
1. Go to AWS Console → EC2 → Instances
2. Click "Launch Instance"

3. Name and tags:
   - Name: echomate-backend

4. Application and OS Images:
   - Amazon Machine Image: Ubuntu Server 22.04 LTS (Free tier eligible)
   - Architecture: 64-bit (x86)

5. Instance type:
   - Free tier: t2.micro OR t3.micro
   - Production: t3.small or higher

6. Key pair (login):
   - Click "Create new key pair"
   - Key pair name: echomate-key
   - Key pair type: RSA
   - Private key file format: .pem (for Mac/Linux) or .ppk (for Windows/PuTTY)
   - Download and save the key file securely
   - Move to safe location: mv ~/Downloads/echomate-key.pem ~/.ssh/
   - Set permissions: chmod 400 ~/.ssh/echomate-key.pem

7. Network settings:
   - VPC: Default
   - Auto-assign public IP: Enable
   - Create security group: Yes
   - Security group name: echomate-backend-sg
   - Description: Security group for EchoMate backend

8. Configure Security Group Rules:
   - SSH (22): Source: My IP (your current IP)
   - HTTP (80): Source: 0.0.0.0/0 (anywhere)
   - HTTPS (443): Source: 0.0.0.0/0 (anywhere)
   - Custom TCP (3000): Source: 0.0.0.0/0 (for backend API - will be restricted)
   - PostgreSQL (5432): Remove (we'll access RDS internally)

9. Storage:
   - 8 GB gp3 (Free tier)
   - Or 20 GB for production

10. Click "Launch Instance"
11. Wait for instance to be in "Running" state
```

#### 3.2 Connect to EC2 Instance

```bash
# Get the public IP from EC2 console
ssh -i ~/.ssh/echomate-key.pem ubuntu@<EC2-PUBLIC-IP>

# If permission error:
chmod 400 ~/.ssh/echomate-key.pem
```

#### 3.3 Setup EC2 Instance

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js (v20.x LTS)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PM2 (Process Manager)
sudo npm install -g pm2

# Install Nginx (Reverse Proxy)
sudo apt install -y nginx

# Install PostgreSQL client (for testing DB connection)
sudo apt install -y postgresql-client

# Install Git
sudo apt install -y git

# Create app directory
sudo mkdir -p /var/www/echomate
sudo chown -R ubuntu:ubuntu /var/www/echomate
```

#### 3.4 Update RDS Security Group

```
1. Go to EC2 → Security Groups → echomate-rds-sg
2. Edit Inbound Rules:
   - Add new rule:
     - Type: PostgreSQL
     - Port: 5432
     - Source: Security Group → echomate-backend-sg
3. Save rules
```

---

### 🪣 Step 4: Amazon S3 (Storage & Static Hosting)

#### 4.1 Create S3 Bucket for Media (Profile Pictures & Posts)

```
1. Go to S3 → Buckets → Create bucket

2. Bucket name: echomate-media-[unique-id] (e.g., echomate-media-2025)
   - Must be globally unique
   - Use lowercase, no spaces

3. AWS Region: us-east-1 (same as your other resources)

4. Object Ownership:
   - ACLs disabled (recommended)

5. Block Public Access settings:
   - ❌ Uncheck "Block all public access"
   - ✅ Check "I acknowledge..."
   - (We'll use bucket policy for controlled access)

6. Bucket Versioning: Enable (optional, for backup)

7. Encryption:
   - Enable server-side encryption
   - Amazon S3 managed keys (SSE-S3)

8. Click "Create bucket"
```

#### 4.2 Configure S3 Bucket Policy (Media Bucket)

```
1. Go to bucket → Permissions tab
2. Scroll to "Bucket policy" → Edit
3. Add this policy (replace BUCKET-NAME):

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET-NAME/*"
    }
  ]
}

4. Save changes
```

#### 4.3 Configure CORS for Media Bucket

```
1. Go to bucket → Permissions tab → CORS
2. Add this configuration:

[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]

3. Save changes
```

#### 4.4 Create S3 Bucket for Frontend (Static Website)

```
1. Create another bucket:
   - Bucket name: echomate-frontend-[unique-id]
   - Region: us-east-1
   - ❌ Uncheck "Block all public access"
   - ✅ Acknowledge

2. Enable Static Website Hosting:
   - Go to Properties tab
   - Scroll to "Static website hosting" → Edit
   - Enable
   - Hosting type: Host a static website
   - Index document: index.html
   - Error document: index.html (for React routing)
   - Save changes

3. Add Bucket Policy:
   - Go to Permissions → Bucket policy
   - Add:

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET-NAME/*"
    }
  ]
}

4. Note the website endpoint (e.g., http://bucket-name.s3-website-us-east-1.amazonaws.com)
```

#### 4.5 Create IAM User for S3 Access (Backend)

```
1. Go to IAM → Users → Create user
2. Username: echomate-s3-user
3. No console access needed
4. Attach policies directly:
   - Create inline policy:

{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::echomate-media-*",
        "arn:aws:s3:::echomate-media-*/*"
      ]
    }
  ]
}

5. Create access keys for this user
6. Save Access Key ID and Secret Access Key
```

---

### 🌐 Step 5: AWS Certificate Manager (ACM) - SSL/TLS

#### 5.1 Request SSL Certificate

```
1. Go to AWS Certificate Manager (ACM)
2. Make sure you're in us-east-1 region (for CloudFront)
3. Click "Request certificate"

4. Certificate type:
   - Request a public certificate

5. Domain names:
   - yourdomain.com
   - www.yourdomain.com
   - api.yourdomain.com (for backend)
   - *.yourdomain.com (wildcard - optional)

6. Validation method:
   - DNS validation (recommended)
   - OR Email validation

7. Click "Request"

8. Validation:
   - If DNS: Add CNAME records to your domain's DNS provider
   - Copy the Name and Value from ACM
   - Add to your DNS (Route53, GoDaddy, Namecheap, etc.)
   - Wait 5-30 minutes for validation

9. Status should change to "Issued"
```

---

### 🚀 Step 6: CloudFront (CDN for Frontend)

#### 6.1 Create CloudFront Distribution

```
1. Go to CloudFront → Distributions → Create distribution

2. Origin settings:
   - Origin domain: Select your S3 frontend bucket
   - Or use the S3 website endpoint URL
   - Origin path: leave empty
   - Name: auto-filled
   - Origin access: Public (we'll use bucket policy)

3. Default cache behavior:
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD, OPTIONS
   - Cache policy: CachingOptimized
   - Origin request policy: None

4. Settings:
   - Price class: Use all edge locations (best performance)
     OR Use only North America and Europe (cheaper)

   - Alternate domain names (CNAMEs): yourdomain.com, www.yourdomain.com

   - Custom SSL certificate: Select your ACM certificate

   - Default root object: index.html

   - Enable Standard logging: Yes (optional)

5. Click "Create distribution"
6. Wait 10-15 minutes for deployment
7. Note the CloudFront domain name (e.g., d1234abcd.cloudfront.net)
```

#### 6.2 Configure Error Pages for React SPA

```
1. Go to your CloudFront distribution
2. Error pages tab → Create custom error response
3. Create these error responses:
   - HTTP error code: 403
   - Response page path: /index.html
   - HTTP response code: 200

   - HTTP error code: 404
   - Response page path: /index.html
   - HTTP response code: 200
```

---

### 🔐 Step 7: AWS Cognito (User Authentication)

#### 7.1 Create User Pool

```
1. Go to AWS Cognito → User pools → Create user pool

2. Step 1: Configure sign-in experience
   - Cognito user pool sign-in options:
     ✅ Email
     ✅ Username (optional)
   - Next

3. Step 2: Configure security requirements
   - Password policy:
     - Password minimum length: 8
     - ✅ Contains numbers
     - ✅ Contains special characters
     - ✅ Contains uppercase letters
     - ✅ Contains lowercase letters

   - Multi-factor authentication: Optional
     - MFA methods: SMS, Authenticator apps

   - User account recovery:
     - ✅ Enable self-service account recovery
     - Email only

   - Next

4. Step 3: Configure sign-up experience
   - Self-registration: Enable
   - Cognito-assisted verification: Email
   - Required attributes:
     - name
     - email
     - picture (custom attribute for profile pic URL)
   - Next

5. Step 4: Configure message delivery
   - Email provider: Send email with Cognito (for testing)
     - OR Configure SES for production
   - Next

6. Step 5: Integrate your app
   - User pool name: echomate-users
   - ✅ Use Cognito Hosted UI (optional)
   - Domain: echomate-auth (or your custom domain)

   - Initial app client:
     - App client name: echomate-web-client
     - Client secret: Generate
     - Authentication flows:
       ✅ ALLOW_USER_PASSWORD_AUTH
       ✅ ALLOW_REFRESH_TOKEN_AUTH
       ✅ ALLOW_USER_SRP_AUTH

   - Allowed callback URLs:
     - http://localhost:5173/callback (development)
     - https://yourdomain.com/callback (production)

   - Allowed sign-out URLs:
     - http://localhost:5173
     - https://yourdomain.com

   - Next

7. Review and create
8. Note down:
   - User Pool ID
   - App Client ID
   - App Client Secret
```

#### 7.2 Create Identity Pool (for S3 Access - Optional)

```
1. Go to Cognito → Identity pools → Create identity pool
2. Identity pool name: echomate_identity_pool
3. Enable access to unauthenticated identities: No
4. Authentication providers:
   - Cognito user pool ID: [your-user-pool-id]
   - App client ID: [your-app-client-id]
5. Create pool
6. Configure IAM roles for authenticated users (auto-created)
7. Note the Identity Pool ID
```

---

### 📊 Step 8: CloudWatch (Monitoring & Logging)

#### 8.1 Create CloudWatch Log Groups

```
1. Go to CloudWatch → Log groups → Create log group
2. Create these log groups:
   - /aws/echomate/backend
   - /aws/echomate/nginx
   - /aws/echomate/errors

3. Set retention: 7 days (for cost optimization)
```

#### 8.2 Install CloudWatch Agent on EC2

```bash
# SSH into your EC2 instance
ssh -i ~/.ssh/echomate-key.pem ubuntu@<EC2-PUBLIC-IP>

# Download CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb

# Install
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Configure (interactive)
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-config-wizard

# Or create config manually at:
# /opt/aws/amazon-cloudwatch-agent/bin/config.json
```

#### 8.3 Create CloudWatch Alarms

```
1. Go to CloudWatch → Alarms → Create alarm

2. EC2 CPU Utilization Alarm:
   - Metric: EC2 → Per-Instance Metrics → CPUUtilization
   - Statistic: Average
   - Period: 5 minutes
   - Threshold: >= 80%
   - Alarm name: echomate-high-cpu
   - Create SNS topic for notification

3. RDS Connection Alarm:
   - Metric: RDS → DatabaseConnections
   - Threshold: >= 80 (or your max connections)

4. S3 Request Alarm (optional):
   - Metric: S3 → AllRequests
```

---

### 🔌 Step 9: API Gateway (Optional - for Serverless)

#### 9.1 Create REST API

```
1. Go to API Gateway → Create API
2. Choose: REST API → Build
3. API name: echomate-api
4. Endpoint type: Regional
5. Create API

6. Create resources and methods:
   - Resource: /auth
   - Resource: /users
   - Resource: /posts

7. For each resource:
   - Create methods (GET, POST, PUT, DELETE)
   - Integration type: HTTP (to EC2) or Lambda

8. Deploy API:
   - Actions → Deploy API
   - Stage name: prod
   - Note the Invoke URL
```

---

### 🌍 Step 10: Route 53 (DNS - If using custom domain)

#### 10.1 Configure DNS

```
1. Go to Route 53 → Hosted zones
2. Create hosted zone (if you have a domain)
   - Domain name: yourdomain.com

3. Create Record Sets:
   - Type A record for root domain:
     - Name: yourdomain.com
     - Type: A
     - Alias: Yes
     - Alias target: Your CloudFront distribution

   - Type A record for www:
     - Name: www.yourdomain.com
     - Type: A
     - Alias: Yes
     - Alias target: Your CloudFront distribution

   - Type A record for API:
     - Name: api.yourdomain.com
     - Type: A
     - Value: Your EC2 public IP
     - OR use Application Load Balancer
```

---

## 📝 Configuration Summary

After completing all steps, save these values:

### Environment Variables for Backend (.env)

```env
# Database
DB_HOST=echomate-db.xxxxx.us-east-1.rds.amazonaws.com
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-rds-password
DB_DATABASE=echomate_db

# AWS S3
AWS_ACCESS_KEY_ID=your-s3-user-access-key
AWS_SECRET_ACCESS_KEY=your-s3-user-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=echomate-media-2025

# AWS Cognito
COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
COGNITO_REGION=us-east-1

# JWT (if using custom JWT instead of Cognito)
JWT_SECRET=your-super-secret-key-min-32-chars
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_SECRET=another-secret-key
REFRESH_TOKEN_EXPIRES_IN=7d

# App
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://yourdomain.com
```

### Environment Variables for Frontend (.env)

```env
VITE_API_URL=https://api.yourdomain.com
# OR
VITE_API_URL=http://<EC2-PUBLIC-IP>:3000

VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx

# For Identity Pool (if using)
VITE_COGNITO_IDENTITY_POOL_ID=us-east-1:xxxx-xxxx-xxxx
```

---

## ✅ Verification Checklist

- [ ] RDS instance is running and accessible
- [ ] EC2 instance is running with Node.js, Nginx, PM2 installed
- [ ] EC2 can connect to RDS
- [ ] S3 buckets created (media + frontend)
- [ ] S3 bucket policies and CORS configured
- [ ] IAM user for S3 created with access keys
- [ ] SSL certificate issued and validated
- [ ] CloudFront distribution deployed
- [ ] Cognito User Pool created
- [ ] CloudWatch log groups created
- [ ] All security groups properly configured
- [ ] Environment variables documented

---

## 🚀 Next Steps

1. **Deploy Backend to EC2**

   - Clone repository
   - Install dependencies
   - Configure environment variables
   - Start with PM2
   - Configure Nginx reverse proxy

2. **Deploy Frontend to S3**

   - Build React app
   - Upload to S3 bucket
   - Invalidate CloudFront cache

3. **Test End-to-End**
   - User registration
   - Login
   - Create posts
   - Upload images
   - Monitor CloudWatch logs

---

## 💰 Cost Estimation (Monthly)

- **EC2 t3.micro**: ~$10
- **RDS db.t3.micro**: ~$15
- **S3 Storage (5GB)**: ~$0.15
- **S3 Requests**: ~$0.05
- **CloudFront**: ~$1-5 (depends on traffic)
- **Data Transfer**: ~$1-10
- **CloudWatch**: ~$1-3
- **Total**: ~$30-50/month (for small-scale app)

**Free Tier**: If you're within AWS Free Tier (first 12 months):

- EC2: 750 hours/month free
- RDS: 750 hours/month free
- S3: 5GB free
- CloudFront: 50GB free
- **Total**: ~$0-10/month

---

## 🔒 Security Best Practices

1. **Never commit credentials** to Git
2. Use **IAM roles** instead of access keys where possible
3. Enable **MFA** on root account
4. Restrict **Security Groups** to minimum required ports
5. Enable **VPC Flow Logs**
6. Rotate **access keys** regularly
7. Use **HTTPS** everywhere
8. Enable **CloudTrail** for audit logging
9. Regular **security patches** on EC2
10. Use **AWS Secrets Manager** for sensitive data

---

Ready to proceed with code updates? Let me know when you've completed these AWS setup steps!
