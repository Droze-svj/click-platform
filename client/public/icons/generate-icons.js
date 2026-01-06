// Icon generation script for PWA
// Run this to generate placeholder icons (replace with actual icons later)

const fs = require('fs')
const path = require('path')

const iconsDir = path.join(__dirname)

const sizes = [72, 96, 128, 144, 152, 192, 384, 512]

const iconSVG = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="24" height="24" rx="4" fill="#667eea"/>
  <path d="M7 9L12 4L17 9V17C17 17.5304 16.7893 18.0391 16.4142 18.4142C16.0391 18.7893 15.5304 19 15 19H9C8.46957 19 7.96086 18.7893 7.58579 18.4142C7.21071 18.0391 7 17.5304 7 17V9Z" fill="white"/>
  <path d="M9 12H15M9 15H15" stroke="#667eea" stroke-width="0.5" stroke-linecap="round"/>
</svg>`

// Generate icons for each size
sizes.forEach(size => {
  const filename = `icon-${size}x${size}.png`
  const svgContent = iconSVG(size)

  // For now, create SVG files (convert to PNG later)
  const svgFilename = `icon-${size}x${size}.svg`
  fs.writeFileSync(path.join(iconsDir, svgFilename), svgContent)

  console.log(`Generated ${svgFilename}`)
})

console.log('\n✅ Icon generation complete!')
console.log('Note: Convert SVG files to PNG using an image editor or online converter')
console.log('Place PNG files in the same directory as the SVG files')



