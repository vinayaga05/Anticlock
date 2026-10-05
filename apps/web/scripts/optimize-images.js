#!/usr/bin/env node

/**
 * Optimize and copy category images from mobile app to web
 * Converts PNG to WebP and resizes to max 640px width for web performance
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SOURCE_DIR = path.join(__dirname, '../../mobile/src/shared/assets/categories');
const BRAND_DIR = path.join(__dirname, '../../mobile/src/shared/assets/brand');
const TARGET_DIR = path.join(__dirname, '../public/app');

async function optimizeImage(sourcePath, targetPath) {
  try {
    const image = sharp(sourcePath);
    const metadata = await image.metadata();
    
    // Resize if wider than 640px, maintain aspect ratio
    const pipeline = metadata.width > 640 
      ? image.resize(640, null, { withoutEnlargement: true })
      : image;
    
    // Convert to WebP with quality 85
    await pipeline
      .webp({ quality: 85 })
      .toFile(targetPath);
    
    const originalSize = fs.statSync(sourcePath).size;
    const newSize = fs.statSync(targetPath).size;
    const savings = Math.round((1 - newSize / originalSize) * 100);
    
    console.log(`✓ ${path.basename(targetPath)} (${savings}% smaller)`);
  } catch (error) {
    console.error(`✗ Failed to process ${sourcePath}:`, error.message);
  }
}

async function main() {
  // Create target directory
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }
  
  console.log('Optimizing category images...\n');
  
  // Process category images
  const categoryFiles = fs.readdirSync(SOURCE_DIR).filter(f => f.endsWith('.png'));
  
  for (const file of categoryFiles) {
    const sourcePath = path.join(SOURCE_DIR, file);
    const targetPath = path.join(TARGET_DIR, file.replace('.png', '.webp'));
    await optimizeImage(sourcePath, targetPath);
  }
  
  // Process logo
  console.log('\nOptimizing logo...\n');
  const logoSource = path.join(BRAND_DIR, 'logo.png');
  const logoTarget = path.join(TARGET_DIR, 'logo.webp');
  await optimizeImage(logoSource, logoTarget);
  
  console.log(`\n✅ Optimized ${categoryFiles.length + 1} images to ${TARGET_DIR}`);
}

main().catch(console.error);
