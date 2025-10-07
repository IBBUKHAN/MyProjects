# 🚀 EchoMateLite AWS Deployment Package

Complete AWS deployment documentation and scripts for EchoMateLite - a lightweight social media platform.

---

## 📦 What's Included

This deployment package contains everything you need to deploy EchoMateLite to AWS:

### 📚 Documentation

- **`QUICK_START.md`** ⭐ START HERE - Fast deployment guide (30 minutes)
- **`AWS_DEPLOYMENT_GUIDE.md`** - Comprehensive step-by-step guide for all AWS services
- **`DEPLOYMENT_CHECKLIST.md`** - Track your progress through deployment

### 🔧 Deployment Scripts

- **`ec2-setup.sh`** - Automated EC2 instance setup (Node.js, Nginx, PM2, etc.)
- **`deploy-backend.sh`** - Deploy backend to EC2 with PM2
- **`deploy-frontend.sh`** - Build and deploy frontend to S3 + CloudFront
- **`nginx-config.conf`** - Nginx reverse proxy configuration template

### 📄 Configuration Templates

Environment variables are documented in:

- `AWS_DEPLOYMENT_GUIDE.md` (Backend .env section)
- `AWS_DEPLOYMENT_GUIDE.md` (Frontend .env section)

---

## 🎯 Quick Start

### 1. Read the Documentation

```bash
# Start here for fastest deployment
open QUICK_START.md

# Or for detailed guidance
open AWS_DEPLOYMENT_GUIDE.md
```

### 2. AWS Infrastructure Setup

Follow the AWS console steps to create:

- ✅ RDS (PostgreSQL database)
- ✅ EC2 (Backend server)
- ✅ S3 (Media storage + Static hosting)
- ✅ Cognito (User authentication)
- ✅ CloudFront (CDN)
- ✅ ACM (SSL certificates)

### 3. Deploy Backend to EC2

```bash
# SSH into your EC2 instance
ssh -i ~/.ssh/echomate-key.pem ubuntu@YOUR-EC2-IP

# Upload and run setup script
./ec2-setup.sh

# Clone your repository
cd /var/www/echomate
git clone YOUR-REPO-URL .

# Create .env file with your AWS credentials
nano .env

# Deploy
./deploy-backend.sh
```

### 4. Deploy Frontend to S3

```bash
# On your local machine
# Update S3_BUCKET and CLOUDFRONT_ID in the script
./deploy-frontend.sh
```

### 5. Access Your Application

- **Frontend**: `https://yourdomain.com`
- **Backend API**: `https://api.yourdomain.com`
- **Health Check**: `https://api.yourdomain.com/health`

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CloudFront CDN                          │
│                    (Content Delivery Network)                   │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────┴──────────────┐
        │                           │
        ▼                           ▼
┌───────────────┐          ┌────────────────┐
│  S3 Frontend  │          │   EC2 Backend  │◄─── Nginx
│  (React App)  │          │   (NestJS/Node)│◄─── PM2
└───────────────┘          └────────┬───────┘
                                    │
                           ┌────────┼────────┐
                           │        │        │
                           ▼        ▼        ▼
                    ┌──────────┐ ┌────┐ ┌─────────┐
                    │    RDS   │ │ S3 │ │ Cognito │
                    │PostgreSQL│ │Media│ │  Auth   │
                    └──────────┘ └────┘ └─────────┘
```

**Key Components:**

- **Frontend**: React app hosted on S3, delivered via CloudFront
- **Backend**: NestJS/Node.js API running on EC2 with Nginx reverse proxy
- **Database**: PostgreSQL on Amazon RDS
- **Storage**: User uploads stored in S3
- **Authentication**: AWS Cognito User Pools
- **Monitoring**: CloudWatch logs and metrics

---

## 📋 Deployment Checklist

Use `DEPLOYMENT_CHECKLIST.md` to track your progress:

- [ ] AWS account setup
- [ ] IAM user created
- [ ] RDS database running
- [ ] EC2 instance configured
- [ ] S3 buckets created
- [ ] SSL certificate issued
- [ ] CloudFront deployed
- [ ] Cognito user pool created
- [ ] Backend deployed to EC2
- [ ] Frontend deployed to S3
- [ ] DNS configured
- [ ] End-to-end testing complete

---

## 🛠️ AWS Services Used

| Service        | Purpose                        | Cost (approx)           |
| -------------- | ------------------------------ | ----------------------- |
| **EC2**        | Backend hosting                | $10/month (t3.micro)    |
| **RDS**        | PostgreSQL database            | $15/month (db.t3.micro) |
| **S3**         | Static hosting + media storage | $0.15/month             |
| **CloudFront** | CDN for frontend               | $1-5/month              |
| **Cognito**    | User authentication            | Free (< 50k MAU)        |
| **ACM**        | SSL certificates               | Free                    |
| **CloudWatch** | Monitoring & logs              | $1-3/month              |
| **Route 53**   | DNS (optional)                 | $0.50/month             |
| **Total**      |                                | **~$30-50/month**       |

**Free Tier**: First 12 months can cost as low as $0-10/month!

---

## 🔐 Security Features

- ✅ HTTPS/SSL via ACM
- ✅ Password hashing (bcrypt)
- ✅ JWT token authentication
- ✅ AWS Cognito user management
- ✅ IAM least privilege access
- ✅ VPC security groups
- ✅ S3 bucket policies
- ✅ CloudWatch monitoring
- ✅ Nginx rate limiting
- ✅ CORS protection

---

## 📊 Monitoring & Logging

### CloudWatch Log Groups

- `/aws/echomate/backend` - Application logs
- `/aws/echomate/nginx` - Nginx access/error logs
- `/aws/echomate/errors` - Error tracking

### CloudWatch Alarms

- EC2 CPU utilization > 80%
- RDS connection count > threshold
- S3 request anomalies

### PM2 Monitoring

```bash
pm2 monit              # Real-time monitoring
pm2 logs               # View all logs
pm2 logs echomate-backend  # Specific app logs
```

---

## 🔄 Continuous Deployment

### Backend Updates

```bash
ssh -i ~/.ssh/echomate-key.pem ubuntu@YOUR-EC2-IP
cd /var/www/echomate
git pull
npm install
pm2 restart echomate-backend
```

### Frontend Updates

```bash
# Build and deploy
./deploy-frontend.sh

# Or manually
npm run build
aws s3 sync dist/ s3://YOUR-BUCKET/ --delete
aws cloudfront create-invalidation --distribution-id XXX --paths "/*"
```

---

## 🐛 Troubleshooting

### Common Issues

**Backend not responding:**

```bash
pm2 status
pm2 logs echomate-backend
sudo systemctl status nginx
```

**Database connection failed:**

```bash
# Test connection
psql -h RDS-ENDPOINT -U postgres -d echomate_db

# Check security group allows EC2
```

**Frontend 404 errors:**

```bash
# Verify CloudFront error pages configured
# Check S3 bucket policy allows public read
```

**CORS errors:**

```bash
# Verify ALLOWED_ORIGINS in backend .env
# Check Nginx CORS headers
```

---

## 📖 Additional Resources

### AWS Documentation

- [EC2 User Guide](https://docs.aws.amazon.com/ec2/)
- [RDS User Guide](https://docs.aws.amazon.com/rds/)
- [S3 User Guide](https://docs.aws.amazon.com/s3/)
- [CloudFront User Guide](https://docs.aws.amazon.com/cloudfront/)
- [Cognito User Guide](https://docs.aws.amazon.com/cognito/)

### Tools

- [AWS CLI](https://aws.amazon.com/cli/)
- [AWS Console](https://console.aws.amazon.com/)
- [AWS Pricing Calculator](https://calculator.aws/)
- [AWS Free Tier](https://aws.amazon.com/free/)

---

## 🎓 Learning Path

1. **Phase 1**: Deploy to AWS (follow QUICK_START.md)
2. **Phase 2**: Configure production settings (SSL, custom domain)
3. **Phase 3**: Set up monitoring and alerts
4. **Phase 4**: Implement CI/CD pipeline
5. **Phase 5**: Optimize for scale and performance

---

## 💡 Best Practices

### Security

- ✅ Use environment variables for secrets
- ✅ Enable MFA on AWS account
- ✅ Restrict security groups to minimum required
- ✅ Regular security updates on EC2
- ✅ Use AWS Secrets Manager for production

### Performance

- ✅ Enable CloudFront compression
- ✅ Configure browser caching
- ✅ Use lazy loading for images
- ✅ Optimize database queries
- ✅ Monitor with CloudWatch

### Cost Optimization

- ✅ Use Reserved Instances for production
- ✅ Set S3 lifecycle policies
- ✅ Limit CloudWatch log retention
- ✅ Stop dev/test resources when not in use
- ✅ Set billing alarms

---

## 🆘 Support

If you need help:

1. **Check logs**: CloudWatch, PM2 logs, Nginx logs
2. **Review documentation**: AWS docs, this deployment guide
3. **AWS Support**: https://console.aws.amazon.com/support/
4. **Community**: AWS forums, Stack Overflow

---

## 📝 Next Steps After Deployment

- [ ] Set up automated backups
- [ ] Configure monitoring alerts
- [ ] Implement CI/CD pipeline
- [ ] Load testing
- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation for team
- [ ] User acceptance testing

---

## 🎉 Congratulations!

Once deployed, your EchoMateLite application will be:

- ✅ Secure (HTTPS, authentication, encryption)
- ✅ Scalable (AWS infrastructure)
- ✅ Monitored (CloudWatch)
- ✅ Fast (CloudFront CDN)
- ✅ Reliable (RDS backups, PM2 auto-restart)

**You're ready to launch!** 🚀

---

## 📄 File Structure

```
EchoMateLite/
├── AWS_README.md                    ← You are here
├── QUICK_START.md                   ← Start here for deployment
├── AWS_DEPLOYMENT_GUIDE.md          ← Detailed AWS setup guide
├── DEPLOYMENT_CHECKLIST.md          ← Track your progress
├── ec2-setup.sh                     ← EC2 automated setup
├── deploy-backend.sh                ← Backend deployment script
├── deploy-frontend.sh               ← Frontend deployment script
├── nginx-config.conf                ← Nginx configuration
├── client/                          ← React frontend
│   ├── src/
│   ├── .env                         ← Frontend environment variables
│   └── package.json
└── server/                          ← NestJS backend
    ├── index.ts
    ├── .env                         ← Backend environment variables
    └── package.json
```

---

**Version**: 1.0.0  
**Last Updated**: October 2025  
**Maintained By**: EchoMateLite Team

---

For questions or issues, please refer to the documentation files or contact AWS Support.

Happy Deploying! 🎊
