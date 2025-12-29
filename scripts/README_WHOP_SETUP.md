# Whop Setup Scripts

## Available Scripts

### 1. Complete Setup (Interactive)
```bash
./scripts/setup-whop-complete.sh
```
Guides you through the entire setup process interactively.

### 2. Update Environment Variables
```bash
node scripts/update-env-whop-ids.js
```
Interactive script to add Whop product IDs to environment variables.

### 3. Seed Database
```bash
node scripts/seed-database-complete.js
```
Seeds both membership packages and add-ons.

### 4. Check Setup Status
```bash
node scripts/check-whop-setup.js
```
Verifies your setup is complete.

### 5. Test Subscription System
```bash
node scripts/test-subscription-system.js
```
Tests the subscription system functionality.

## Individual Seed Scripts

```bash
# Seed membership packages only
node scripts/seed-membership-packages.js

# Seed add-ons only
node scripts/seed-add-ons.js
```

## Prerequisites

- MongoDB running (local or Atlas)
- Whop API key
- Whop products created
- Product IDs from Whop dashboard
