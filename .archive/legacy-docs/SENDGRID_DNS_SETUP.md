# 🔧 SendGrid DNS Setup Guide

**For Domain Authentication (Recommended for Production)**

---

## 🎯 What DNS Records to Add

When you authenticate your domain in SendGrid, you'll need to add **3 DNS records** to your domain:

1. **CNAME Record** (for domain authentication)
2. **CNAME Record** (for link branding)
3. **TXT Record** (for SPF)

---

## 📋 Step-by-Step DNS Setup

### Step 1: Get DNS Records from SendGrid

1. **Go to**: https://app.sendgrid.com/settings/sender_auth
2. **Click**: "Authenticate Your Domain"
3. **Enter your domain**: `yourdomain.com` (without www)
4. **Choose DNS provider**: Select your DNS provider (e.g., Cloudflare, GoDaddy, Namecheap)
5. **SendGrid will show you** the DNS records you need to add

---

## 🔍 DNS Records Format

SendGrid will show you something like:

### Record 1: Domain Authentication (CNAME)
```
Type: CNAME
Host: [something like: s1._domainkey or em1234]
Value: [something like: s1.domainkey.u1234567.wl123.sendgrid.net]
```

### Record 2: Link Branding (CNAME)
```
Type: CNAME
Host: [something like: s2._domainkey or em5678]
Value: [something like: s2.domainkey.u1234567.wl123.sendgrid.net]
```

### Record 3: SPF (TXT)
```
Type: TXT
Host: @ (or your domain name)
Value: v=spf1 include:sendgrid.net ~all
```

---

## 🎯 What to Put for "DNS Host"

The **"Host"** field depends on your DNS provider:

### Common Options:

1. **@** - For root domain (yourdomain.com)
2. **Blank/Empty** - Some providers use blank for root domain
3. **yourdomain.com** - Full domain name
4. **subdomain** - If adding to a subdomain (e.g., `mail.yourdomain.com`)

---

## 📝 Examples by DNS Provider

### Cloudflare
- **Host**: `@` (for root domain)
- **Or**: `mail` (for mail.yourdomain.com)

### GoDaddy
- **Host**: `@` (for root domain)
- **Or**: Leave blank for root domain

### Namecheap
- **Host**: `@` (for root domain)
- **Or**: `mail` (for subdomain)

### Google Domains
- **Host**: `@` (for root domain)
- **Or**: Leave blank for root domain

---

## ✅ Quick Answer

**For most DNS providers, use:**
- **Host**: `@` (for root domain like yourdomain.com)
- **Or**: Leave it **blank/empty** (some providers use blank for root)

**If SendGrid shows a specific host like `s1._domainkey`, use that exact value!**

---

## 🔍 How to Find Your DNS Provider

1. **Check your domain registrar** (where you bought the domain)
2. **Common providers**:
   - Cloudflare
   - GoDaddy
   - Namecheap
   - Google Domains
   - AWS Route 53
   - Name.com

---

## 📋 Complete Example

**If SendGrid shows:**
```
CNAME Record:
Host: s1._domainkey
Value: s1.domainkey.u1234567.wl123.sendgrid.net
```

**In your DNS provider, add:**
- **Type**: CNAME
- **Host/Name**: `s1._domainkey` (exactly as shown)
- **Value/Target**: `s1.domainkey.u1234567.wl123.sendgrid.net` (exactly as shown)
- **TTL**: 3600 (or default)

---

## ⚠️ Important Notes

1. **Use exact values** from SendGrid (don't modify them)
2. **DNS propagation** can take 24-48 hours (usually faster)
3. **Verify in SendGrid** after adding records
4. **For subdomains**, use the subdomain name (e.g., `mail` for `mail.yourdomain.com`)

---

## 🧪 Verify DNS Records

After adding records, verify:

1. **In SendGrid**: Click "Verify" button
2. **Or use online tools**:
   - https://mxtoolbox.com/
   - https://www.whatsmydns.net/

---

## 🚀 Alternative: Single Sender (Easier)

**If DNS setup is too complex**, use **Single Sender Verification** instead:

1. **Go to**: https://app.sendgrid.com/settings/sender_auth
2. **Click**: "Verify a Single Sender"
3. **Fill in your email** (no DNS needed!)
4. **Verify via email** link

**This is easier for testing, but domain authentication is better for production.**

---

## ✅ Checklist

- [ ] Got DNS records from SendGrid
- [ ] Identified your DNS provider
- [ ] Added CNAME record 1 (domain authentication)
- [ ] Added CNAME record 2 (link branding)
- [ ] Added TXT record (SPF)
- [ ] Waited for DNS propagation (5 minutes to 48 hours)
- [ ] Verified in SendGrid dashboard

---

**Need help? Share what DNS provider you're using and I can give specific instructions! 🚀**

