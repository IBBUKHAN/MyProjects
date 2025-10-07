# 🆓 EchoMateLite - FREE TIER Deployment (No AWS CLI!)

## ✅ 100% Free Tier - Browser Only Deployment

**Cost**: $0/month (first 12 months with AWS Free Tier)  
**Requirements**: Just a web browser and AWS account!  
**Time**: 1-2 hours  
**AWS CLI**: NOT NEEDED! ❌

---

## 📋 What You Get (100% Free for 12 Months):

✅ **EC2 t2.micro** - 750 hours/month (enough for 24/7 running)  
✅ **RDS db.t2.micro or db.t3.micro** - 750 hours/month  
✅ **S3** - 5GB storage + 20,000 GET requests  
✅ **CloudFront** - 50GB data transfer  
✅ **Cognito** - 50,000 monthly active users  
✅ **CloudWatch** - 10 custom metrics + 5GB logs

**Total Cost**: **$0/month** ✨

---

## 🛑 What You Need:

- [ ] AWS Account (free to create)
- [ ] Credit/debit card (for verification - won't be charged in free tier)
- [ ] Web browser (Chrome, Safari, Firefox)
- [ ] SSH client (already on Mac - Terminal)
- [ ] Your code ready

**That's it!** No AWS CLI, no complicated tools!

---

## 🚀 Step-by-Step FREE TIER Deployment

### **STEP 1: Create AWS Account** (10 minutes)

1. Go to: https://aws.amazon.com/
2. Click "Create an AWS Account"
3. Enter email and choose password
4. Account type: **Personal**
5. Add credit card (for verification only)
6. Verify phone number
7. Choose **Basic Support (Free)**
8. Sign in to AWS Console

✅ **You now have access to 12 months FREE!**

---

### **STEP 2: Create RDS Database** (15 minutes)

1. **Go to AWS Console**: https://console.aws.amazon.com/
2. **Search for "RDS"** in top search bar → Click
3. **Click "Create database"**

4. **Choose settings:**
   - Engine: **PostgreSQL**
   - Version: **15.x** (latest)
   - Templates: **Free tier** ⭐ (This limits you to free options!)
5. **Settings:**
   - DB instance identifier: `echomate-db`
   - Master username: `postgres`
   - Master password: `YourPassword123!` (save this!)
   - Confirm password
6. **Instance configuration:**
   - Automatically selected: **db.t3.micro** or **db.t2.micro** (free tier)
7. **Storage:**
   - Allocated storage: **20 GB** (free tier limit)
   - Storage type: **General Purpose SSD (gp2)**
   - ❌ Uncheck "Enable storage autoscaling" (to stay in free tier)
8. **Connectivity:**
   - Compute resource: **Don't connect to an EC2 instance** (we'll do manually)
   - VPC: **Default VPC**
   - Public access: **Yes** (for easier setup - secure later)
   - VPC security group: **Create new**
   - New security group name: `echomate-rds-sg`
9. **Database authentication:**
   - Password authentication
10. **Additional configuration:**
    - Initial database name: `echomate_db`
    - ❌ Uncheck "Enable automated backups" (saves costs, optional)
    - ❌ Uncheck "Enable encryption" (free tier friendly)
11. **Click "Create database"**

12. **Wait 5-10 minutes** - Status will change to "Available"

13. **Save your RDS Endpoint:**
    - Click on your database name
    - Copy the "Endpoint" (looks like: `echomate-db.xxxxx.us-east-1.rds.amazonaws.com`)
    - Save this in a notes file!

✅ **Database Created!**

**Estimated Free Tier Cost**: $0/month (750 hours free)

---

### **STEP 3: Create EC2 Instance** (15 minutes)

1. **Search for "EC2"** in AWS Console → Click
2. **Click "Launch Instance"**

3. **Name and tags:**
   - Name: `echomate-backend`
4. **Application and OS Images:**
   - Quick Start: **Ubuntu**
   - Amazon Machine Image: **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**
   - Architecture: **64-bit (x86)**
   - ✅ Look for "Free tier eligible" label!
5. **Instance type:**
   - **t2.micro** ⭐ (Free tier eligible)
   - 1 vCPU, 1 GB RAM
6. **Key pair (login):**
   - Click "Create new key pair"
   - Key pair name: `echomate-key`
   - Key pair type: **RSA**
   - Private key file format: **.pem** (for Mac/Linux)
   - Click "Create key pair"
   - **File downloads automatically** → Save to safe location!
   - Move to ~/.ssh/:
     ```bash
     mv ~/Downloads/echomate-key.pem ~/.ssh/
     chmod 400 ~/.ssh/echomate-key.pem
     ```
7. **Network settings:**
   - Click "Edit"
   - VPC: **Default**
   - Auto-assign public IP: **Enable**
   - Firewall (security groups): **Create security group**
   - Security group name: `echomate-backend-sg`
   - Description: `Security group for EchoMate backend`
8. **Inbound security group rules:**

   - Rule 1: SSH (already there)

     - Type: SSH
     - Port: 22
     - Source: **My IP** (for security)

   - Click "Add security group rule"
   - Rule 2: HTTP

     - Type: HTTP
     - Port: 80
     - Source: **Anywhere (0.0.0.0/0)**

   - Click "Add security group rule"
   - Rule 3: HTTPS

     - Type: HTTPS
     - Port: 443
     - Source: **Anywhere (0.0.0.0/0)**

   - Click "Add security group rule"
   - Rule 4: Custom TCP (for your API)
     - Type: **Custom TCP**
     - Port: **3000**
     - Source: **Anywhere (0.0.0.0/0)**

9. **Configure storage:**
   - Size: **8 GB** or **30 GB** (both free tier eligible)
   - Volume type: **gp2**
   - ❌ Delete on termination: Checked
10. **Summary:**
    - Verify "Free tier eligible" appears
    - Number of instances: **1**
11. **Click "Launch Instance"**

12. **Wait 2-3 minutes** - Instance state becomes "Running"

13. **Save your EC2 Public IP:**
    - Click on instance ID
    - Copy "Public IPv4 address" (e.g., 54.123.45.67)
    - Save this!

✅ **Server Created!**

**Estimated Free Tier Cost**: $0/month (750 hours free)

---

### **STEP 4: Connect RDS to EC2** (5 minutes)

**Allow EC2 to access RDS:**

1. **Go to EC2** → **Security Groups**
2. **Find `echomate-rds-sg`** → Click it
3. **Click "Edit inbound rules"**
4. **Click "Add rule":**
   - Type: **PostgreSQL**
   - Port: **5432**
   - Source: **Custom**
   - Search and select: **echomate-backend-sg** (your EC2 security group)
5. **Click "Save rules"**

✅ **EC2 can now access RDS!**

---

### **STEP 5: Create S3 Buckets** (10 minutes - NO CLI!)

#### A. Create Media Bucket (for profile pictures & uploads)

1. **Search for "S3"** in AWS Console → Click
2. **Click "Create bucket"**

3. **Bucket settings:**
   - Bucket name: `echomate-media-yourname-2025` (must be globally unique!)
   - AWS Region: **US East (N. Virginia) us-east-1**
4. **Object Ownership:**
   - ACLs disabled (recommended)
5. **Block Public Access:**
   - ❌ **Uncheck** "Block all public access"
   - ✅ Check "I acknowledge..."
6. **Bucket Versioning:** Disable (to save space in free tier)
7. **Tags:** Skip
8. **Default encryption:** Server-side encryption (SSE-S3) - FREE
9. **Click "Create bucket"**

10. **Configure Bucket Policy:**

    - Click on your new bucket
    - Go to **Permissions** tab
    - Scroll to **Bucket policy** → Click "Edit"
    - Paste this (replace YOUR-BUCKET-NAME):

    ```json
    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Sid": "PublicReadGetObject",
          "Effect": "Allow",
          "Principal": "*",
          "Action": "s3:GetObject",
          "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
        }
      ]
    }
    ```

    - Click "Save changes"

11. **Configure CORS:**

    - Same bucket → **Permissions** tab
    - Scroll to **CORS** → Click "Edit"
    - Paste this:

    ```json
    [
      {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"]
      }
    ]
    ```

    - Click "Save changes"

✅ **Media bucket ready!**

#### B. Create Frontend Bucket (for React app)

1. **Click "Create bucket"** again

2. **Bucket settings:**
   - Bucket name: `echomate-frontend-yourname-2025` (must be unique!)
   - Region: **us-east-1**
3. **Block Public Access:**
   - ❌ **Uncheck** "Block all public access"
   - ✅ Acknowledge
4. **Click "Create bucket"**

5. **Enable Static Website Hosting:**
   - Click on bucket → **Properties** tab
   - Scroll to bottom → **Static website hosting** → Click "Edit"
   - **Enable**
   - Hosting type: **Host a static website**
   - Index document: `index.html`
   - Error document: `index.html`
   - Click "Save changes"
6. **Configure Bucket Policy:**

   - **Permissions** tab → **Bucket policy** → "Edit"
   - Paste (replace YOUR-BUCKET-NAME):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
       }
     ]
   }
   ```

   - Save changes

7. **Note your website URL:**
   - **Properties** tab → Scroll to **Static website hosting**
   - Copy the "Bucket website endpoint"
   - Example: `http://echomate-frontend-yourname-2025.s3-website-us-east-1.amazonaws.com`
   - Save this!

✅ **Frontend bucket ready!**

**Estimated Free Tier Cost**: $0/month (5GB storage + 20k requests free)

---

### **STEP 6: Create IAM User for S3 Access** (10 minutes)

**For backend to upload images to S3:**

1. **Search for "IAM"** → Click
2. **Users** → **Create user**
3. **User name:** `echomate-s3-user`
4. ❌ **Don't** provide console access
5. **Click "Next"**
6. **Permissions:** **Attach policies directly**
7. **Click "Create policy"** (opens new tab)
8. **In new tab:**

   - Click **JSON** tab
   - Paste this (replace YOUR-MEDIA-BUCKET):

   ```json
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
           "arn:aws:s3:::YOUR-MEDIA-BUCKET",
           "arn:aws:s3:::YOUR-MEDIA-BUCKET/*"
         ]
       }
     ]
   }
   ```

   - Click "Next"
   - Policy name: `EchoMateS3Access`
   - Click "Create policy"

9. **Go back to user creation tab**
10. **Refresh policies** → Search for `EchoMateS3Access` → Select it
11. **Click "Next"** → **Create user**
12. **Click on the user** → **Security credentials** tab
13. **Create access key:**
    - Click "Create access key"
    - Use case: **Application running outside AWS**
    - Click "Next"
    - Click "Create access key"
    - **IMPORTANT**: Copy both:
      - Access Key ID
      - Secret Access Key
    - Save these securely!
    - Click "Done"

✅ **S3 access configured!**

---

### **STEP 7: Create Cognito User Pool** (10 minutes)

1. **Search for "Cognito"** → Click
2. **Click "Create user pool"**

3. **Step 1: Sign-in experience:**

   - Provider types: **Cognito user pool**
   - Sign-in options: ✅ **Email**, ✅ **Username** (optional)
   - Click "Next"

4. **Step 2: Security requirements:**

   - Password policy: **Cognito defaults** (or customize)
   - Multi-factor authentication: **No MFA** (for free tier simplicity)
   - User account recovery: ✅ **Email only**
   - Click "Next"

5. **Step 3: Sign-up experience:**

   - Self-registration: ✅ **Enable**
   - Attribute verification: **Send email message, verify email address**
   - Required attributes: **name**, **email**
   - Click "Next"

6. **Step 4: Message delivery:**

   - Email provider: **Send email with Cognito** (FREE - 50 emails/day)
   - ❌ DON'T use SES (costs extra)
   - FROM email address: Use default
   - Click "Next"

7. **Step 5: Integrate your app:**

   - User pool name: `echomate-users`
   - ❌ **Don't** use Cognito Hosted UI (skip for now)
   - Initial app client:
     - App client name: `echomate-web-client`
     - Client secret: **Generate a client secret**
     - Authentication flows:
       - ✅ ALLOW_USER_PASSWORD_AUTH
       - ✅ ALLOW_REFRESH_TOKEN_AUTH
   - Click "Next"

8. **Step 6: Review and create:**

   - Review everything
   - Click "Create user pool"

9. **Save these values:**
   - Click on your user pool
   - Copy **User pool ID** (e.g., us-east-1_aBcDeFgHi)
   - Go to **App integration** tab
   - Click on your app client
   - Copy **Client ID**
   - Copy **Client secret** (click Show)
   - Save all three!

✅ **Authentication ready!**

**Estimated Free Tier Cost**: $0/month (50,000 MAU free!)

---

### **STEP 8: Deploy Backend to EC2** (20 minutes - NO AWS CLI!)

1. **SSH into your EC2:**

   ```bash
   ssh -i ~/.ssh/echomate-key.pem ubuntu@YOUR-EC2-PUBLIC-IP
   ```

2. **Update system:**

   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

3. **Install Node.js:**

   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs
   node --version
   npm --version
   ```

4. **Install PM2:**

   ```bash
   sudo npm install -g pm2
   ```

5. **Install Git:**

   ```bash
   sudo apt install -y git
   ```

6. **Create app directory:**

   ```bash
   sudo mkdir -p /var/www/echomate
   sudo chown -R ubuntu:ubuntu /var/www/echomate
   cd /var/www/echomate
   ```

7. **Clone your repository:**

   ```bash
   git clone YOUR-GITHUB-REPO-URL .
   # If private repo, use: git clone https://USERNAME:TOKEN@github.com/user/repo.git .
   ```

8. **Create .env file:**

   ```bash
   nano .env
   ```

   Paste this (fill in YOUR values):

   ```env
   NODE_ENV=production
   PORT=3000

   DB_HOST=YOUR-RDS-ENDPOINT
   DB_PORT=5432
   DB_USERNAME=postgres
   DB_PASSWORD=YourPassword123!
   DB_DATABASE=echomate_db

   AWS_ACCESS_KEY_ID=YOUR-S3-ACCESS-KEY
   AWS_SECRET_ACCESS_KEY=YOUR-S3-SECRET-KEY
   AWS_REGION=us-east-1
   AWS_S3_BUCKET=echomate-media-yourname-2025

   COGNITO_USER_POOL_ID=us-east-1_XXXXX
   COGNITO_CLIENT_ID=XXXXXXXXX
   COGNITO_CLIENT_SECRET=XXXXXXXXX
   COGNITO_REGION=us-east-1

   JWT_SECRET=your-super-secret-key-min-32-chars-long
   JWT_EXPIRES_IN=1h
   ```

   - Press `Ctrl+X`, then `Y`, then `Enter` to save

9. **Install dependencies:**

   ```bash
   npm install
   ```

10. **Build (if TypeScript):**

    ```bash
    npm run build
    ```

11. **Start with PM2:**

    ```bash
    # If you built TypeScript:
    pm2 start dist/server/index.js --name echomate-backend

    # Or if JavaScript:
    pm2 start server/index.js --name echomate-backend

    # Save PM2 config
    pm2 save
    pm2 startup
    # Copy and run the command it shows
    ```

12. **Test it works:**

    ```bash
    curl http://localhost:3000/health
    # Should see response

    pm2 logs
    # Should see no errors
    ```

✅ **Backend is live!**

**Test from browser:** `http://YOUR-EC2-PUBLIC-IP:3000/health`

---

### **STEP 9: Deploy Frontend to S3** (15 minutes - NO AWS CLI!)

**On your LOCAL computer:**

1. **Create .env file:**

   ```bash
   cd client
   nano .env
   ```

   Add:

   ```env
   VITE_API_URL=http://YOUR-EC2-PUBLIC-IP:3000
   VITE_AWS_REGION=us-east-1
   VITE_COGNITO_USER_POOL_ID=us-east-1_XXXXX
   VITE_COGNITO_CLIENT_ID=XXXXXXXXX
   ```

   Save and exit

2. **Install and build:**

   ```bash
   npm install
   npm run build
   ```

   This creates a `dist/` folder

3. **Upload to S3 (using browser):**

   - Go to AWS Console → S3
   - Click on `echomate-frontend-yourname-2025`
   - Click **Upload**
   - Click **Add files**
   - Select ALL files from your `client/dist/` folder
   - Click **Upload**
   - Wait for upload to complete
   - Click **Close**

4. **Upload folders:**

   - If you have `assets/` folder in dist:
   - Click **Upload** → **Add folder**
   - Select the `assets` folder
   - Upload

5. **Test your website:**
   - Open the S3 website endpoint URL you saved earlier
   - Example: `http://echomate-frontend-yourname-2025.s3-website-us-east-1.amazonaws.com`
   - Your React app should load!

✅ **Frontend is live!**

---

## 🎉 YOU'RE DONE!

### Your Application is Running:

**Frontend:** `http://YOUR-FRONTEND-BUCKET.s3-website-us-east-1.amazonaws.com`  
**Backend API:** `http://YOUR-EC2-IP:3000`  
**Database:** Running on RDS  
**Storage:** S3 buckets ready  
**Auth:** Cognito ready

**Total Cost:** **$0/month** with AWS Free Tier! 🎊

---

## 💡 What You Built:

```
Internet
   ↓
S3 Frontend (React) ← Users see this
   ↓
EC2 Backend (API) ← Handles requests
   ↓
RDS Database ← Stores data
   ↓
S3 Media ← Stores images
   ↓
Cognito ← Handles auth
```

---

## 🔄 How to Update:

### Update Backend:

```bash
ssh -i ~/.ssh/echomate-key.pem ubuntu@YOUR-EC2-IP
cd /var/www/echomate
git pull
npm install
pm2 restart echomate-backend
```

### Update Frontend:

1. Build locally: `npm run build`
2. Go to S3 bucket in AWS Console
3. Delete old files
4. Upload new files from `dist/`

---

## 📊 Free Tier Limits:

### What's FREE (12 months):

- EC2 t2.micro: 750 hours/month (24/7 = 720 hours ✅)
- RDS db.t2/t3.micro: 750 hours/month
- S3: 5GB storage + 20,000 GET requests
- Cognito: 50,000 monthly active users
- CloudWatch: 10 metrics + 5GB logs

### Stay in Free Tier:

- ✅ Run only ONE EC2 instance
- ✅ Run only ONE RDS instance
- ✅ Keep S3 under 5GB
- ✅ Don't use CloudFront (costs after 50GB)
- ✅ Keep logs under 5GB

---

## 🛑 After 12 Months (When Free Tier Ends):

**Expected cost:** $25-40/month

- EC2 t2.micro: ~$10
- RDS db.t3.micro: ~$15
- S3: ~$0.15
- Data transfer: ~$1-5

**To reduce costs:**

- Stop instances when not needed
- Use Reserved Instances (30% discount)
- Delete old logs and files

---

## 🆘 Troubleshooting:

### Backend won't start:

```bash
pm2 logs echomate-backend
# Check for errors
```

### Can't connect to database:

```bash
# Test from EC2:
sudo apt install postgresql-client
psql -h YOUR-RDS-ENDPOINT -U postgres -d echomate_db
# If fails, check RDS security group
```

### Frontend shows blank page:

- Check browser console for errors
- Verify API URL in .env is correct
- Check CORS settings in backend

### S3 files not accessible:

- Verify bucket policy allows public read
- Check file uploaded correctly
- Verify bucket name in URL

---

## ✅ Free Tier Checklist:

- [ ] AWS account has "Free tier eligible" badges
- [ ] Only 1 EC2 instance running
- [ ] Only 1 RDS instance running
- [ ] EC2 is t2.micro (not t3.small or larger)
- [ ] RDS is db.t2.micro or db.t3.micro
- [ ] S3 storage < 5GB
- [ ] No CloudFront (or within 50GB)
- [ ] Billing alarm set up

**Set Billing Alarm:**

1. CloudWatch → Billing → Create Alarm
2. Set threshold: $5
3. Get email if you exceed free tier

---

## 🎊 Congratulations!

You've deployed a full-stack application on AWS for **$0/month**!

**No AWS CLI needed!**  
**All through the browser!**  
**100% Free Tier!**

Enjoy your EchoMateLite app! 🚀

---

**Questions?**

- Check CloudWatch logs for errors
- Review this guide step-by-step
- AWS Support: https://console.aws.amazon.com/support/
