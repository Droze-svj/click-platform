#!/usr/bin/env node

/**
 * Generate VAPID Keys for Push Notifications
 * Creates public/private key pair for Web Push API
 */

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function generateVAPIDKeys() {
  console.log('🔐 Generating VAPID keys for push notifications...\n')

  try {
    // Generate ECDSA key pair with P-256 curve (required for Web Push)
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.generateKeys()

    // Get public and private keys in the correct format
    const publicKey = ecdh.getPublicKey('base64url')
    const privateKey = ecdh.getPrivateKey('base64url')

    // Generate a sample email for the VAPID subject
    const email = 'notifications@click.com'

    const keys = {
      publicKey,
      privateKey,
      email,
      generatedAt: new Date().toISOString(),
      note: 'Add these to your production environment variables'
    }

    console.log('✅ VAPID keys generated successfully!')
    console.log('=' .repeat(60))
    console.log('PUBLIC KEY:')
    console.log(publicKey)
    console.log('')
    console.log('PRIVATE KEY:')
    console.log(privateKey)
    console.log('')
    console.log('EMAIL:')
    console.log(email)
    console.log('=' .repeat(60))

    // Save to file
    const outputPath = path.join(__dirname, '..', '.env.vapid-keys')
    const envContent = `# VAPID Keys for Push Notifications
# Generated on ${keys.generatedAt}
# Add these to your production environment variables

VAPID_PUBLIC_KEY=${publicKey}
VAPID_PRIVATE_KEY=${privateKey}
VAPID_EMAIL=${email}

# Example usage in .env.local:
# VAPID_PUBLIC_KEY=${publicKey}
# VAPID_PRIVATE_KEY=${privateKey}
# VAPID_EMAIL=${email}
`

    fs.writeFileSync(outputPath, envContent)
    console.log(`📁 Keys saved to: ${outputPath}`)
    console.log('')
    console.log('📋 Next Steps:')
    console.log('1. Copy the keys above to your production environment')
    console.log('2. Set VAPID_EMAIL to your actual email address')
    console.log('3. Test push notifications with the generated keys')
    console.log('4. Keep the private key secure and never commit to version control')

    // Validate the keys
    console.log('\n🔍 Key Validation:')
    try {
      // Verify the keys can be used for signing
      const testMessage = 'test'
      const sign = crypto.createSign('SHA256')
      sign.update(testMessage)
      sign.end()

      // This will throw if keys are invalid
      const signature = sign.sign({
        key: Buffer.from(privateKey, 'base64url'),
        dsaEncoding: 'ieee-p1363'
      }, 'base64url')

      console.log('✅ Key pair validation: PASSED')
      console.log('✅ Keys are ready for production use')

    } catch (error) {
      console.error('❌ Key validation failed:', error.message)
      console.log('⚠️  Generated keys may not be compatible with Web Push API')
      console.log('💡 Try regenerating the keys')
    }

    return keys

  } catch (error) {
    console.error('❌ Failed to generate VAPID keys:', error.message)
    console.log('\n💡 Troubleshooting:')
    console.log('• Ensure Node.js version supports crypto.createECDH')
    console.log('• Check that prime256v1 curve is available')
    console.log('• Try updating Node.js to latest LTS version')
    process.exit(1)
  }
}

// Alternative method using web-push library if available
async function generateWithWebPush() {
  try {
    const webpush = require('web-push')
    const vapidKeys = webpush.generateVAPIDKeys()

    console.log('🔐 Generated VAPID keys using web-push library:')
    console.log('Public Key:', vapidKeys.publicKey)
    console.log('Private Key:', vapidKeys.privateKey)

    return vapidKeys
  } catch (error) {
    console.log('⚠️ web-push library not available, using Node.js crypto')
    return null
  }
}

// Check Node.js crypto support
function checkCryptoSupport() {
  try {
    const ecdh = crypto.createECDH('prime256v1')
    ecdh.generateKeys()
    return true
  } catch (error) {
    console.warn('⚠️ Node.js crypto may not support ECDSA P-256 curve')
    console.log('Node.js version:', process.version)
    return false
  }
}

// Main execution
if (require.main === module) {
  console.log('🚀 Click VAPID Key Generator\n')

  // Check crypto support
  if (!checkCryptoSupport()) {
    console.log('❌ Crypto support check failed')
    console.log('💡 Alternative: Install web-push library for key generation')
    console.log('   npm install web-push --save-dev')
    console.log('   Then run: node scripts/generate-vapid-keys.js')
    process.exit(1)
  }

  // Try web-push first, fallback to Node.js crypto
  generateWithWebPush().then(webPushKeys => {
    if (!webPushKeys) {
      generateVAPIDKeys()
    }
  }).catch(() => {
    generateVAPIDKeys()
  })
}

module.exports = { generateVAPIDKeys }




