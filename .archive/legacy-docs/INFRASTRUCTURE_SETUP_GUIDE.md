# 🏗️ Infrastructure Setup Guide

**Date**: Current  
**Purpose**: Step-by-step guide for setting up production infrastructure

---

## 📋 Overview

This guide will help you set up the infrastructure needed to deploy Click to production. We'll cover:

1. **Hosting Provider Selection**
2. **Server Setup**
3. **Domain Configuration**
4. **SSL Certificate Setup**
5. **Database Setup**
6. **Redis Setup**
7. **Storage Setup (AWS S3)**

---

## 1. Hosting Provider Selection

### Recommended Options

#### Option 1: DigitalOcean (Recommended for Startups)
- **Pros**: Simple, affordable, good documentation
- **Cost**: ~$12-24/month for basic droplet
- **Setup Time**: 15-30 minutes
- **Link**: https://www.digitalocean.com/

#### Option 2: AWS EC2 (Recommended for Scale)
- **Pros**: Scalable, comprehensive services
- **Cost**: ~$10-50/month (varies by instance)
- **Setup Time**: 30-60 minutes
- **Link**: https://aws.amazon.com/ec2/

#### Option 3: Heroku (Easiest)
- **Pros**: Very easy setup, managed services
- **Cost**: ~$25-50/month
- **Setup Time**: 10-15 minutes
- **Link**: https://www.heroku.com/

#### Option 4: Railway / Render (Modern Alternatives)
- **Pros**: Modern, easy deployment
- **Cost**: ~$20-40/month
- **Setup Time**: 10-20 minutes

### Quick Start: DigitalOcean

1. **Create Account**: https://www.digitalocean.com/
2. **Create Droplet**:
   - Choose Ubuntu 22.04 LTS
   - Select Basic plan ($12/month minimum)
   - Choose datacenter region
   - Add SSH key or create root password
3. **Note your server IP**: You'll need this for DNS

---

## 2. Server Setup

### Automated Setup (Recommended)

```bash
# SSH into your server
ssh root@your-server-ip

# Clone or upload your code
git clone https://github.com/your-org/click.git /var/www/click
cd /var/www/click

# Run automated setup script
sudo bash scripts/setup-production.sh
```

This script will install:
- Node.js 18+
- PM2 (process manager)
- Nginx (web server)
- MongoDB (if not using Atlas)
- Certbot (for SSL)
- FFmpeg (for video processing)

### Manual Setup

If you prefer manual setup:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install PM2
sudo npm install -g pm2

# Install Nginx
sudo apt install -y nginx

# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Install FFmpeg
sudo apt install -y ffmpeg
```

---

## 3. Domain Configuration

### Step 1: Purchase Domain (if needed)
- **Recommended**: Namecheap, Google Domains, Cloudflare
- **Cost**: ~$10-15/year

### Step 2: Configure DNS Records

Add these DNS records in your domain provider:

#### For Main Domain (e.g., click.example.com)
```
Type: A
Name: @ (or click)
Value: YOUR_SERVER_IP
TTL: 3600
```

#### For API Subdomain (optional, e.g., api.click.example.com)
```
Type: A
Name: api
Value: YOUR_SERVER_IP
TTL: 3600
```

### Step 3: Verify DNS Propagation

```bash
# Check DNS propagation
dig your-domain.com
# or
nslookup your-domain.com
```

Wait 5-60 minutes for DNS to propagate.

---

## 4. SSL Certificate Setup

### Using Let's Encrypt (Free)

```bash
# On your server
sudo certbot --nginx -d your-domain.com

# Follow prompts:
# - Enter email
# - Agree to terms
# - Choose redirect HTTP to HTTPS (recommended)
```

### Using Cloudflare (If using Cloudflare DNS)

1. **Add site to Cloudflare**
2. **Change nameservers** in your domain registrar
3. **Enable SSL/TLS** in Cloudflare dashboard
4. **Set SSL mode** to "Full" or "Full (strict)"

### Verify SSL

```bash
# Test SSL
curl -I https://your-domain.com

# Should return 200 OK
```

---

## 5. Database Setup

### Option 1: MongoDB Atlas (Recommended)

1. **Create Account**: https://www.mongodb.com/cloud/atlas
2. **Create Cluster**:
   - Choose free tier (M0) or paid tier
   - Select region closest to your server
   - Create cluster
3. **Create Database User**:
   - Go to Database Access
   - Add new user
   - Set username and password
4. **Whitelist IP**:
   - Go to Network Access
   - Add IP address (0.0.0.0/0 for all, or your server IP)
5. **Get Connection String**:
   - Go to Clusters
   - Click Connect
   - Choose "Connect your application"
   - Copy connection string
   - Replace `<password>` with your password

**Connection String Format**:
```
mongodb+srv://username:password@cluster.mongodb.net/click?retryWrites=true&w=majority
```

### Option 2: Local MongoDB

```bash
# Install MongoDB
sudo apt install -y mongodb

# Start MongoDB
sudo systemctl start mongodb
sudo systemctl enable mongodb

# Connection string
mongodb://localhost:27017/click
```

---

## 6. Redis Setup

### Option 1: Redis Cloud (Recommended)

1. **Create Account**: https://redis.com/try-free/
2. **Create Database**:
   - Choose free tier (30MB)
   - Select region
   - Create database
3. **Get Connection String**:
   - Copy Redis URL from dashboard

**Connection String Format**:
```
redis://username:password@host:port
```

### Option 2: Local Redis

```bash
# Install Redis
sudo apt install -y redis-server

# Start Redis
sudo systemctl start redis
sudo systemctl enable redis

# Connection string
redis://localhost:6379
```

---

## 7. Storage Setup (AWS S3)

### Step 1: Create AWS Account

1. **Sign up**: https://aws.amazon.com/
2. **Navigate to S3**: https://console.aws.amazon.com/s3/

### Step 2: Create S3 Bucket

1. **Click "Create bucket"**
2. **Configure**:
   - Bucket name: `click-production` (must be unique)
   - Region: Choose closest to your server
   - Block public access: Uncheck (if you need public access)
   - Versioning: Enable (recommended)
3. **Create bucket**

### Step 3: Create IAM User

1. **Go to IAM**: https://console.aws.amazon.com/iam/
2. **Create User**:
   - User name: `click-s3-user`
   - Access type: Programmatic access
3. **Attach Policy**:
   - Search for "S3" and select "AmazonS3FullAccess"
   - Or create custom policy with only necessary permissions
4. **Save Credentials**:
   - Access Key ID
   - Secret Access Key
   - **Save these securely!**

### Step 4: Configure CORS (if needed)

1. **Go to your S3 bucket**
2. **Permissions tab**
3. **CORS configuration**:
```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
        "AllowedOrigins": ["https://your-domain.com"],
        "ExposeHeaders": []
    }
]
```

### Step 5: Optional - CloudFront CDN

1. **Go to CloudFront**: https://console.aws.amazon.com/cloudfront/
2. **Create Distribution**:
   - Origin: Your S3 bucket
   - Viewer protocol: Redirect HTTP to HTTPS
   - Price class: Use all edge locations
3. **Get CloudFront URL**: Use this in your `.env.production`

---

## 8. Quick Setup Checklist

### Infrastructure Checklist

- [ ] Hosting provider account created
- [ ] Server instance created
- [ ] Server IP address noted
- [ ] Domain purchased (if needed)
- [ ] DNS records configured
- [ ] DNS propagation verified
- [ ] SSL certificate installed
- [ ] MongoDB Atlas account created (or local MongoDB)
- [ ] Database connection string obtained
- [ ] Redis Cloud account created (or local Redis)
- [ ] Redis connection string obtained
- [ ] AWS account created
- [ ] S3 bucket created
- [ ] IAM user created with S3 access
- [ ] AWS credentials saved

### Configuration Checklist

- [ ] Run interactive setup: `bash scripts/setup-production-interactive.sh`
- [ ] Review `.env.production` file
- [ ] Validate configuration: `npm run validate:production`
- [ ] Test OAuth configuration: `npm run test:oauth:all`

---

## 9. Verification Commands

### Test Server Connection
```bash
ssh root@your-server-ip
```

### Test DNS
```bash
dig your-domain.com
```

### Test SSL
```bash
curl -I https://your-domain.com
```

### Test Database Connection
```bash
# On server
mongosh "your-connection-string"
```

### Test Redis Connection
```bash
# On server
redis-cli -u "your-redis-url"
```

---

## 10. Next Steps

After infrastructure is set up:

1. **Configure Environment**: Run `bash scripts/setup-production-interactive.sh`
2. **Deploy Application**: Follow `PRODUCTION_DEPLOYMENT_CHECKLIST.md`
3. **Verify Deployment**: Run `npm run deploy:verify`
4. **Monitor**: Set up monitoring and alerts

---

## 🆘 Troubleshooting

### DNS Not Working
- Wait 24-48 hours for full propagation
- Check DNS records are correct
- Verify nameservers are set correctly

### SSL Certificate Issues
- Ensure DNS is pointing to your server
- Check port 80 and 443 are open
- Verify domain ownership

### Database Connection Issues
- Check IP whitelist in MongoDB Atlas
- Verify connection string is correct
- Check firewall rules

### Redis Connection Issues
- Verify Redis URL is correct
- Check Redis is running (if local)
- Verify network access (if cloud)

---

## 📚 Additional Resources

- **DigitalOcean Tutorials**: https://www.digitalocean.com/community/tags/tutorials
- **AWS Documentation**: https://docs.aws.amazon.com/
- **MongoDB Atlas Docs**: https://docs.atlas.mongodb.com/
- **Let's Encrypt Docs**: https://letsencrypt.org/docs/

---

**Last Updated**: Current  
**Status**: Ready for Use


