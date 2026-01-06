#!/usr/bin/env node

/**
 * Convert SVG Icons to PNG Format
 * Generates PNG versions of PWA icons for better browser compatibility
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const iconsDir = path.join(__dirname, '..', 'client', 'public', 'icons')
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function convertSvgToPng() {
  console.log('🎨 Converting SVG icons to PNG format...\n')

  // Check if SVG icons exist
  const svgIcon = path.join(iconsDir, 'icon-192x192.svg')
  if (!fs.existsSync(svgIcon)) {
    console.error('❌ SVG icon not found:', svgIcon)
    console.log('💡 Run: node client/public/icons/generate-icons.js first')
    process.exit(1)
  }

  try {
    // Read the SVG content
    const svgContent = fs.readFileSync(svgIcon, 'utf8')
    console.log('✅ Found SVG icon template')

    // Convert each size
    for (const size of sizes) {
      const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`)

      console.log(`🔄 Converting ${size}x${size}...`)

      await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png({
          quality: 90,
          compressionLevel: 9
        })
        .toFile(outputPath)

      console.log(`✅ Generated: icon-${size}x${size}.png`)
    }

    // Create additional variants
    console.log('\n🔄 Creating special icon variants...')

    // Maskable icon (with padding for different shapes)
    const maskableSize = 512
    const maskablePadding = 64 // 64px padding on each side
    const maskableOutput = path.join(iconsDir, 'icon-maskable-512x512.png')

    await sharp(Buffer.from(svgContent))
      .resize(maskableSize - maskablePadding * 2, maskableSize - maskablePadding * 2)
      .extend({
        top: maskablePadding,
        bottom: maskablePadding,
        left: maskablePadding,
        right: maskablePadding,
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .png({
        quality: 90,
        compressionLevel: 9
      })
      .toFile(maskableOutput)

    console.log('✅ Generated: icon-maskable-512x512.png')

    // High-quality favicon
    const faviconOutput = path.join(__dirname, '..', 'client', 'public', 'favicon-32x32.png')
    await sharp(Buffer.from(svgContent))
      .resize(32, 32)
      .png({
        quality: 95,
        compressionLevel: 9
      })
      .toFile(faviconOutput)

    console.log('✅ Generated: favicon-32x32.png')

    // Apple touch icon
    const appleTouchOutput = path.join(__dirname, '..', 'client', 'public', 'apple-touch-icon.png')
    await sharp(Buffer.from(svgContent))
      .resize(180, 180)
      .png({
        quality: 95,
        compressionLevel: 9
      })
      .toFile(appleTouchOutput)

    console.log('✅ Generated: apple-touch-icon.png')

    // Verify all files were created
    console.log('\n📁 Verifying generated files...')
    const expectedFiles = [
      ...sizes.map(size => `icon-${size}x${size}.png`),
      'icon-maskable-512x512.png',
      '../favicon-32x32.png',
      '../apple-touch-icon.png'
    ]

    let successCount = 0
    for (const file of expectedFiles) {
      const fullPath = path.join(iconsDir, file)
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath)
        console.log(`✅ ${file} (${(stats.size / 1024).toFixed(1)} KB)`)
        successCount++
      } else {
        console.log(`❌ ${file} - MISSING`)
      }
    }

    console.log(`\n🎉 Conversion complete! ${successCount}/${expectedFiles.length} files generated`)

    // Update manifest to use PNG icons
    await updateManifestForPngIcons()

    // Generate icon usage instructions
    generateIconUsageInstructions()

  } catch (error) {
    console.error('❌ Conversion failed:', error.message)
    console.log('\n💡 Troubleshooting:')
    console.log('• Ensure Sharp is installed: npm install sharp --save-dev')
    console.log('• Check SVG file is valid')
    console.log('• Ensure write permissions to icons directory')
    process.exit(1)
  }
}

async function updateManifestForPngIcons() {
  console.log('\n📝 Updating PWA manifest for PNG icons...')

  const manifestPath = path.join(__dirname, '..', 'client', 'public', 'manifest.json')

  if (!fs.existsSync(manifestPath)) {
    console.warn('⚠️ Manifest file not found, skipping update')
    return
  }

  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))

    // Update icons to use PNG versions
    manifest.icons = [
      {
        "src": "/icons/icon-192x192.png",
        "sizes": "192x192",
        "type": "image/png",
        "purpose": "any maskable"
      },
      {
        "src": "/icons/icon-512x512.png",
        "sizes": "512x512",
        "type": "image/png",
        "purpose": "any maskable"
      },
      {
        "src": "/favicon-32x32.png",
        "sizes": "32x32",
        "type": "image/png",
        "purpose": "any"
      }
    ]

    // Add related_applications for better PWA experience
    manifest.related_applications = [
      {
        "platform": "webapp",
        "url": "/manifest.json"
      }
    ]

    // Write updated manifest
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    console.log('✅ Manifest updated with PNG icons')

  } catch (error) {
    console.warn('⚠️ Failed to update manifest:', error.message)
  }
}

function generateIconUsageInstructions() {
  console.log('\n📋 Icon Usage Instructions:')
  console.log('=' .repeat(50))
  console.log('✅ PWA Icons: /icons/icon-[size].png')
  console.log('✅ Favicon: /favicon-32x32.png')
  console.log('✅ Apple Touch: /apple-touch-icon.png')
  console.log('✅ Maskable: /icons/icon-maskable-512x512.png')
  console.log('')
  console.log('📱 HTML Meta Tags (add to _document.tsx):')
  console.log('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">')
  console.log('<link rel="apple-touch-icon" href="/apple-touch-icon.png">')
  console.log('')
  console.log('🔍 Browser DevTools Testing:')
  console.log('• Go to Application > Manifest')
  console.log('• Check all icon sizes are loaded')
  console.log('• Test PWA install prompt')
  console.log('')
  console.log('📊 Icon Sizes Generated:')
  sizes.forEach(size => console.log(`   • ${size}x${size} PNG`))
  console.log('   • 512x512 Maskable PNG')
  console.log('   • 32x32 Favicon PNG')
  console.log('   • 180x180 Apple Touch PNG')
}

// Alternative method using Puppeteer (if Sharp fails)
async function convertWithPuppeteer() {
  console.log('🔄 Falling back to Puppeteer conversion...')

  try {
    const puppeteer = require('puppeteer')

    // This would require more complex setup
    console.log('⚠️ Puppeteer conversion not implemented')
    console.log('💡 Use Sharp conversion method instead')

  } catch (error) {
    console.log('⚠️ Puppeteer not available')
  }
}

// Main execution
if (require.main === module) {
  console.log('🚀 Click PWA Icon Converter\n')

  // Check if Sharp is available
  try {
    require('sharp')
    convertSvgToPng()
  } catch (error) {
    console.error('❌ Sharp library not found')
    console.log('💡 Install with: npm install sharp --save-dev')
    console.log('💡 Alternative: Convert SVG manually using online tools')
    process.exit(1)
  }
}

module.exports = { convertSvgToPng }



