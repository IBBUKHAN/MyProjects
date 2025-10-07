# 🚀 EchoMateLite - EC2 Deployment Guide

Complete guide to deploy your social media app on AWS EC2 (Free Tier eligible).

---

## 📋 Prerequisites

Before you start, make sure you have:

- ✅ AWS Account (Free Tier)
- ✅ Your code ready to deploy
- ✅ Database credentials (RDS PostgreSQL or Neon)
- ✅ S3 bucket created (for image uploads)

---

## 🎯 Step 1: Launch EC2 Instance

### 1.1 Create EC2 Instance

1. **Go to AWS Console** → EC2 Dashboard
2. Click **"Launch Instance"**

### 1.2 Instance Configuration

**Name:** `EchoMateLite-Server`

**AMI (Operating System):**

- Choose: **Ubuntu Server 22.04 LTS** (Free tier eligible)
- Architecture: 64-bit (x86)

**Instance Type:**

- Choose: **t2.micro** (Free tier: 750 hours/month)

**Key Pair:**

- Click "Create new key pair"
- Name: `echomate-key`
- Key pair type: RSA
- Private key format: `.pem`
- **Download and save the key file securely!**

**Network Settings:**

- ✅ Allow SSH traffic from: Anywhere (0.0.0.0/0) or My IP
- ✅ Allow HTTPS traffic from: Anywhere
- ✅ Allow HTTP traffic from: Anywhere

**Storage:**

- 8 GB gp3 (Free tier: Up to 30 GB)

### 1.3 Launch Instance

Click **"Launch Instance"** and wait for it to start (Status: Running).

---

## 🔐 Step 2: Connect to Your EC2 Instance

### 2.1 Set Key Permissions (MacOS/Linux)

```bash
cd ~/Downloads  # or wherever you saved your key
chmod 400 echomate-key.pem
```

### 2.2 Get Public IP

1. Go to EC2 Dashboard
2. Select your instance
3. Copy **Public IPv4 address** (e.g., `54.123.456.78`)

### 2.3 SSH into Instance

```bash
ssh -i echomate-key.pem ubuntu@54.123.456.78
# Replace with your actual IP address
```

Type `yes` when prompted to continue connecting.

---

## 📦 Step 3: Install Required Software

### 3.1 Update System

```bash
sudo apt update && sudo apt upgrade -y
```

### 3.2 Install Node.js 20.x

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should show v20.x.x
npm --version
```

### 3.3 Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

### 3.4 Install Nginx (Web Server)

```bash
sudo apt install -y nginx
```

### 3.5 Install Git

```bash
sudo apt install -y git
```

---

## 📂 Step 4: Deploy Your Application

### 4.1 Clone Your Repository

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/MyProjects.git
cd MyProjects
```

**OR** if you don't have it on GitHub yet, upload via SCP:

```bash
# On your local machine (new terminal)
cd ~/Documents/GitHub/MyProjects
tar -czf myproject.tar.gz .
scp -i ~/Downloads/echomate-key.pem myproject.tar.gz ubuntu@54.123.456.78:~

# Back on EC2
tar -xzf myproject.tar.gz
```

### 4.2 Install Dependencies

```bash
npm install
```

### 4.3 Create Environment Variables

```bash
nano .env
```

Paste your environment variables:

```env
DATABASE_URL=postgresql://user:password@your-db-host:5432/dbname
JWT_SECRET=your-super-secret-jwt-key-change-this
NODE_ENV=production

# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=eu-north-1
S3_BUCKET=echomate-media-ibbu-2025
```

**Save:** Press `Ctrl + X`, then `Y`, then `Enter`

### 4.4 Build the Application

```bash
# Build the frontend
npm run build

# Push database schema (if needed)
npm run db:push
```

---

## 🔧 Step 5: Configure PM2 to Run Your App

### 5.1 Create PM2 Ecosystem File

```bash
nano ecosystem.config.js
```

Paste this configuration:

```javascript
module.exports = {
  apps: [
    {
      name: "echomate",
      script: "tsx",
      args: "server/index.ts",
      cwd: "/home/ubuntu/MyProjects",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 8080,
      },
    },
  ],
};
```

**Save:** `Ctrl + X`, `Y`, `Enter`

### 5.2 Install TypeScript Executor

```bash
npm install -g tsx
```

### 5.3 Start Application with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Copy and run the command PM2 outputs** (it will be something like):

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

### 5.4 Check App Status

```bash
pm2 status
pm2 logs echomate --lines 50
```

---

## 🌐 Step 6: Configure Nginx as Reverse Proxy

### 6.1 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/echomate
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name YOUR_EC2_PUBLIC_IP;  # Replace with your IP or domain

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Root location - serve frontend
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API routes
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Increase timeout for uploads
    client_max_body_size 10M;
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;
}
```

**Save:** `Ctrl + X`, `Y`, `Enter`

### 6.2 Enable the Site

```bash
sudo ln -s /etc/nginx/sites-available/echomate /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default site
sudo nginx -t  # Test configuration
sudo systemctl restart nginx
```

### 6.3 Configure Firewall

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
```

---

## 🎉 Step 7: Access Your Application

### Your app is now live at:

```
http://YOUR_EC2_PUBLIC_IP
```

**Example:** `http://54.123.456.78`

---

## 🔒 Step 8: (Optional) Add SSL Certificate with Let's Encrypt

### 8.1 Point Domain to EC2 (if you have one)

1. Go to your domain registrar (e.g., GoDaddy, Namecheap)
2. Add an **A Record** pointing to your EC2 Public IP

### 8.2 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 8.3 Get SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:

- Enter your email
- Agree to terms
- Choose to redirect HTTP to HTTPS

### 8.4 Auto-Renewal Test

```bash
sudo certbot renew --dry-run
```

---

## 🔄 Step 9: Deploy Updates

### 9.1 Pull Latest Code

```bash
cd ~/MyProjects
git pull origin main  # or your branch name
```

### 9.2 Rebuild and Restart

```bash
npm install
npm run build
pm2 restart echomate
```

---

## 📊 Monitoring & Maintenance

### Check Application Logs

```bash
pm2 logs echomate
pm2 logs echomate --lines 100
```

### Monitor Resource Usage

```bash
pm2 monit
htop  # Install with: sudo apt install htop
```

### Restart Services

```bash
pm2 restart echomate
sudo systemctl restart nginx
```

### Check Nginx Logs

```bash
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🐛 Troubleshooting

### Issue: Can't connect to EC2

**Solution:** Check Security Group rules in AWS Console

- Ensure port 80 (HTTP) is open
- Ensure port 22 (SSH) is open

### Issue: App not starting

```bash
pm2 logs echomate --err
```

Check for:

- Missing environment variables
- Database connection issues
- Port conflicts

### Issue: Nginx 502 Bad Gateway

```bash
sudo systemctl status nginx
pm2 status
```

Make sure:

- PM2 app is running
- Port 8080 is not blocked
- Check firewall: `sudo ufw status`

### Issue: Database connection failed

Verify `.env` file has correct `DATABASE_URL`

### Issue: S3 uploads not working

Check AWS credentials in `.env`:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `S3_BUCKET`

---

## 💰 AWS Free Tier Limits

**EC2:**

- ✅ 750 hours/month of t2.micro
- ✅ 30 GB EBS storage
- ✅ 15 GB data transfer out

**RDS (if using):**

- ✅ 750 hours/month of db.t2.micro
- ✅ 20 GB storage

**S3:**

- ✅ 5 GB storage
- ✅ 20,000 GET requests
- ✅ 2,000 PUT requests

**Monitor your usage:** AWS Console → Billing Dashboard

---

## 🎯 Quick Reference Commands

```bash
# SSH into server
ssh -i echomate-key.pem ubuntu@YOUR_IP

# Navigate to project
cd ~/MyProjects

# View logs
pm2 logs echomate

# Restart app
pm2 restart echomate

# Pull updates
git pull && npm install && npm run build && pm2 restart echomate

# Check status
pm2 status
sudo systemctl status nginx

# View environment variables
cat .env
```

---

## ✅ Deployment Checklist

- [ ] EC2 instance launched (t2.micro)
- [ ] Security groups configured (ports 22, 80, 443)
- [ ] SSH access working
- [ ] Node.js installed
- [ ] PM2 installed
- [ ] Nginx installed
- [ ] Code deployed
- [ ] Dependencies installed
- [ ] `.env` file created
- [ ] Database connected
- [ ] App built (`npm run build`)
- [ ] PM2 started and saved
- [ ] Nginx configured
- [ ] Firewall configured
- [ ] App accessible via browser
- [ ] (Optional) SSL certificate installed

---

## 🎉 Congratulations!

Your EchoMateLite app is now live on AWS EC2!

**Access your app:** `http://YOUR_EC2_IP`

**Next Steps:**

1. Add a custom domain
2. Set up SSL certificate
3. Configure monitoring/alerts
4. Set up automated backups
5. Optimize performance

---

## 📞 Need Help?

Check these resources:

- AWS EC2 Documentation
- PM2 Documentation
- Nginx Documentation
- Your application logs: `pm2 logs echomate`

---

**Made with ❤️ for EchoMateLite**
