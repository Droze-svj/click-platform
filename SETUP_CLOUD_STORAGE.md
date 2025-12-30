# ☁️ Cloud Storage Setup Guide

**Purpose**: Store files persistently (images, videos, documents)

**Options**: AWS S3, Google Cloud Storage, or Cloudinary

---

## 🎯 Choose Your Provider

### Option 1: Cloudinary (Easiest - Recommended for Start)
- ✅ **Free tier**: 25GB storage, 25GB bandwidth/month
- ✅ **Image/video optimization** built-in
- ✅ **CDN included**
- ✅ **Easiest setup** (5 minutes)

### Option 2: AWS S3 (Most Popular)
- ✅ **Free tier**: 5GB storage, 20,000 GET requests/month
- ✅ **Scalable** and reliable
- ✅ **Industry standard**
- ⚠️ Requires AWS account setup

### Option 3: Google Cloud Storage
- ✅ **Free tier**: 5GB storage, 5GB egress/month
- ✅ **Good integration** with Google services
- ⚠️ Requires Google Cloud account

---

## 🚀 Option 1: Cloudinary Setup (Recommended)

### Step 1: Create Account

1. **Sign up**: https://cloudinary.com/users/register/free
   - Free tier: 25GB storage, 25GB bandwidth/month
   - No credit card required

2. **Verify your email**

3. **Go to Dashboard**: https://cloudinary.com/console

---

### Step 2: Get Credentials

1. **In Dashboard**, you'll see:
   - **Cloud Name**: `your-cloud-name`
   - **API Key**: `123456789012345`
   - **API Secret**: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

2. **Copy these values**

---

### Step 3: Add to Render.com

Add these variables:

```
Variable Name: CLOUDINARY_URL
Value: cloudinary://API_KEY:API_SECRET@CLOUD_NAME
(Replace API_KEY, API_SECRET, and CLOUD_NAME with your values)

Example:
cloudinary://123456789012345:xxxxxxxxxxxxxxxxxxxxxxxxxxxxx@your-cloud-name
```

**Or add separately**:

```
Variable Name: CLOUDINARY_CLOUD_NAME
Value: your-cloud-name

Variable Name: CLOUDINARY_API_KEY
Value: 123456789012345

Variable Name: CLOUDINARY_API_SECRET
Value: xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🚀 Option 2: AWS S3 Setup

### Step 1: Create AWS Account

1. **Sign up**: https://aws.amazon.com/free/
   - Free tier: 5GB storage, 20,000 GET requests/month
   - Credit card required (won't be charged if you stay within free tier)

2. **Verify your account**

---

### Step 2: Create S3 Bucket

1. **Go to**: https://s3.console.aws.amazon.com/

2. **Click**: "Create bucket"

3. **Settings**:
   - **Bucket name**: `click-platform-files` (must be globally unique)
   - **Region**: Choose closest to you (e.g., `us-east-1`)
   - **Block Public Access**: Uncheck if you want public files
   - **Default encryption**: Enable
   - Click **Create bucket**

---

### Step 3: Create IAM User & Access Key

1. **Go to**: https://console.aws.amazon.com/iam/

2. **Click**: "Users" → "Add users"

3. **Settings**:
   - **User name**: `click-platform-s3`
   - **Access type**: "Programmatic access"
   - Click **Next**

4. **Permissions**:
   - Click "Attach existing policies directly"
   - Search and select: `AmazonS3FullAccess`
   - Click **Next** → **Next** → **Create user**

5. **Copy credentials**:
   - **Access Key ID**: `AKIAIOSFODNN7EXAMPLE`
   - **Secret Access Key**: `wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`
   - **Save these!** (you won't see the secret again)

---

### Step 4: Add to Render.com

Add these variables:

```
Variable Name: AWS_ACCESS_KEY_ID
Value: AKIAIOSFODNN7EXAMPLE
(Your Access Key ID from Step 3)

Variable Name: AWS_SECRET_ACCESS_KEY
Value: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
(Your Secret Access Key from Step 3)

Variable Name: AWS_S3_BUCKET
Value: click-platform-files
(Your bucket name from Step 2)

Variable Name: AWS_S3_REGION
Value: us-east-1
(Your bucket region from Step 2)
```

---

## 🚀 Option 3: Google Cloud Storage Setup

### Step 1: Create Google Cloud Account

1. **Sign up**: https://cloud.google.com/free
   - Free tier: $300 credit, 5GB storage
   - Credit card required

2. **Create a project**: "Click Platform"

---

### Step 2: Create Storage Bucket

1. **Go to**: https://console.cloud.google.com/storage

2. **Click**: "Create bucket"

3. **Settings**:
   - **Name**: `click-platform-files`
   - **Location**: Choose closest region
   - **Storage class**: Standard
   - Click **Create**

---

### Step 3: Create Service Account

1. **Go to**: https://console.cloud.google.com/iam-admin/serviceaccounts

2. **Click**: "Create Service Account"

3. **Settings**:
   - **Name**: `click-platform-storage`
   - **Role**: "Storage Admin"
   - Click **Create** → **Done**

4. **Create Key**:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose "JSON"
   - **Download the JSON file**

5. **Open the JSON file** and copy the values:
   - `project_id`
   - `private_key`
   - `client_email`

---

### Step 4: Add to Render.com

Add these variables:

```
Variable Name: GCS_PROJECT_ID
Value: your-project-id
(From the JSON file)

Variable Name: GCS_KEYFILE
Value: {"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
(Paste the entire JSON content as a single line, or use GCS_KEYFILE_PATH if you prefer file path)

Variable Name: GCS_BUCKET
Value: click-platform-files
(Your bucket name)
```

---

## ✅ Verify Setup

After redeploying, check your logs. You should see:
```
✅ Cloud storage initialized: [cloudinary|s3|gcs]
```

Instead of:
```
⚠️ Cloud storage not configured. Using local file storage.
```

---

## 🧪 Test File Upload

After setup, test by:
1. Uploading a file through your API
2. Checking your cloud storage dashboard
3. Verifying the file is accessible

---

## 📊 Monitoring

- **Cloudinary**: https://cloudinary.com/console
- **AWS S3**: https://s3.console.aws.amazon.com/
- **Google Cloud**: https://console.cloud.google.com/storage

---

## 💰 Pricing Comparison

| Provider | Free Tier | Paid (per month) |
|----------|-----------|------------------|
| **Cloudinary** | 25GB storage, 25GB bandwidth | $89+ for 100GB |
| **AWS S3** | 5GB storage, 20K requests | ~$0.023/GB storage |
| **Google Cloud** | 5GB storage, 5GB egress | ~$0.020/GB storage |

**Recommendation**: Start with **Cloudinary** (easiest, best free tier)

---

## 🎯 What This Enables

- ✅ Persistent file storage (files survive server restarts)
- ✅ Image/video optimization (Cloudinary)
- ✅ CDN delivery (faster file access)
- ✅ Scalable storage (grows with your app)

---

## 🔒 Security Notes

- **Never commit** credentials to git
- **Store** in Render.com environment variables only
- **Use IAM roles** (AWS) or service accounts (GCS) with minimal permissions
- **Enable encryption** at rest
- **Set up CORS** if needed for direct browser uploads

---

## 🚀 Quick Start Recommendation

**For fastest setup**: Use **Cloudinary**
1. Sign up (2 minutes)
2. Copy credentials (1 minute)
3. Add to Render.com (2 minutes)
4. **Total: 5 minutes!**

---

**Ready? Choose a provider and follow the steps above! 🚀**

