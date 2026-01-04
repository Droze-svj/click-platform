#!/usr/bin/env node

/**
 * Icon Conversion Script
 * Converts SVG icons to PNG format for PWA compatibility
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const iconsDir = path.join(__dirname, '..', 'client', 'public', 'icons')
const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

async function convertIcons() {
  console.log('🎨 Converting SVG icons to PNG format...\n')

  // Ensure icons directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true })
  }

  // Generate base SVG icon
  const baseSvg = `<svg width="512" height="512" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="24" height="24" rx="4" fill="#667eea"/>
    <path d="M7 9L12 4L17 9V17C17 17.5304 16.7893 18.0391 16.4142 18.4142C16.0391 18.7893 15.5304 19 15 19H9C8.46957 19 7.96086 18.7893 7.58579 18.4142C7.21071 18.0391 7 17.5304 7 17V9Z" fill="white"/>
    <path d="M9 12H15M9 15H15" stroke="#667eea" stroke-width="0.5" stroke-linecap="round"/>
  </svg>`

  // Convert SVG to PNG for each size
  const conversionPromises = sizes.map(async (size) => {
    const svgBuffer = Buffer.from(baseSvg)
    const outputPath = path.join(iconsDir, `icon-${size}x${size}.png`)

    try {
      await sharp(svgBuffer)
        .resize(size, size)
        .png()
        .toFile(outputPath)

      console.log(`   ✅ Generated icon-${size}x${size}.png`)
      return true
    } catch (error) {
      console.error(`   ❌ Failed to generate icon-${size}x${size}.png:`, error.message)
      return false
    }
  })

  // Wait for all conversions to complete
  const results = await Promise.all(conversionPromises)
  const successCount = results.filter(Boolean).length

  console.log(`\n🎯 Conversion complete: ${successCount}/${sizes.length} icons generated`)

  if (successCount === sizes.length) {
    console.log('\n📋 Generated PNG icons:')
    sizes.forEach(size => {
      console.log(`   • icon-${size}x${size}.png (${size}x${size}px)`)
    })

    console.log('\n💡 Update your manifest.json to use PNG icons instead of SVG:')
    console.log('   "icons": [')
    sizes.forEach(size => {
      console.log(`     {`)
      console.log(`       "src": "/icons/icon-${size}x${size}.png",`)
      console.log(`       "sizes": "${size}x${size}",`)
      console.log(`       "type": "image/png"`)
      if (size >= 192) {
        console.log(`       "purpose": "any maskable"`)
      } else {
        console.log(`       "purpose": "any"`)
      }
      console.log(`     },`)
    })
    console.log('   ]')
  } else {
    console.log('\n⚠️  Some icons failed to convert. You may need to install additional dependencies:')
    console.log('   sudo apt-get install libvips-dev  # Ubuntu/Debian')
    console.log('   brew install vips                 # macOS')
  }

  return successCount === sizes.length
}

// Clean up old SVG files
function cleanupSvgFiles() {
  console.log('\n🧹 Cleaning up SVG files...')

  try {
    const files = fs.readdirSync(iconsDir)
    const svgFiles = files.filter(file => file.endsWith('.svg'))

    svgFiles.forEach(file => {
      const filePath = path.join(iconsDir, file)
      fs.unlinkSync(filePath)
      console.log(`   🗑️  Removed ${file}`)
    })

    console.log(`   ✅ Cleaned up ${svgFiles.length} SVG files`)
  } catch (error) {
    console.warn('   ⚠️  Failed to clean up SVG files:', error.message)
  }
}

// Validate generated icons
function validateIcons() {
  console.log('\n🔍 Validating generated icons...')

  const validationResults = sizes.map(size => {
    const iconPath = path.join(iconsDir, `icon-${size}x${size}.png`)

    try {
      const stats = fs.statSync(iconPath)
      const isValid = stats.size > 100 // Basic size check

      console.log(`   ${isValid ? '✅' : '❌'} icon-${size}x${size}.png (${Math.round(stats.size / 1024)}KB)`)

      return isValid
    } catch (error) {
      console.log(`   ❌ icon-${size}x${size}.png (missing)`)
      return false
    }
  })

  const validCount = validationResults.filter(Boolean).length
  console.log(`\n📊 Validation: ${validCount}/${sizes.length} icons valid`)

  return validCount === sizes.length
}

// Main execution
async function main() {
  console.log('🚀 Click PWA Icon Generation\n')

  try {
    const conversionSuccess = await convertIcons()

    if (conversionSuccess) {
      cleanupSvgFiles()
      const validationSuccess = validateIcons()

      if (validationSuccess) {
        console.log('\n🎉 All PWA icons successfully generated and validated!')
        console.log('\n📱 Next steps:')
        console.log('   1. Update client/public/manifest.json to use PNG icons')
        console.log('   2. Test PWA installation on mobile devices')
        console.log('   3. Verify icons appear correctly in app install prompt')
      } else {
        console.log('\n⚠️  Icon validation failed. Please check the generated files.')
        process.exit(1)
      }
    } else {
      console.log('\n❌ Icon conversion failed. Please check dependencies and try again.')
      process.exit(1)
    }

  } catch (error) {
    console.error('❌ Icon generation failed:', error.message)
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { convertIcons, cleanupSvgFiles, validateIcons }
