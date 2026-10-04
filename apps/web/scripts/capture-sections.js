#!/usr/bin/env node

/**
 * Take detailed viewport screenshots of each section
 * Scrolls to trigger whileInView animations before capturing
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SECTIONS = [
  { id: 'hero', name: 'Hero', yOffset: 0, waitTime: 3000 },
  { id: 'features', name: 'Features', yOffset: 1000, waitTime: 2000 },
  { id: 'services', name: 'Service Categories', yOffset: 2400, waitTime: 2000 },
  { id: 'how-it-works', name: 'How It Works', yOffset: 4000, waitTime: 1500 },
  { id: 'why', name: 'Why Anticlock', yOffset: 5500, waitTime: 1500 },
  { id: 'providers', name: 'Providers', yOffset: 7000, waitTime: 1500 },
  { id: 'faq', name: 'FAQ', yOffset: 8500, waitTime: 1500 },
  { id: 'footer', name: 'Footer', yOffset: 10000, waitTime: 1000 },
];

async function captureSection(page, section, index, device) {
  try {
    console.log(`  Capturing ${section.name}...`);
    
    // Scroll to offset
    await page.evaluate((offset) => {
      window.scrollTo({ top: offset, behavior: 'instant' });
    }, section.yOffset);
    
    // Wait for animations to complete
    await page.waitForTimeout(section.waitTime);
    
    // Take screenshot
    const filename = `${device}-${String(index + 1).padStart(2, '0')}-${section.id}.png`;
    const artifactPath = path.join('/opt/cursor/artifacts', filename);
    const docsPath = path.join(__dirname, '../../docs/website-preview', filename);
    
    await page.screenshot({
      path: artifactPath,
      fullPage: false,
    });
    
    // Copy to docs folder
    fs.copyFileSync(artifactPath, docsPath);
    
    console.log(`    ✓ ${filename}`);
    return filename;
  } catch (error) {
    console.error(`    ✗ Failed to capture ${section.name}:`, error.message);
    return null;
  }
}

async function takeScreenshots() {
  console.log('Launching browser...\n');
  const browser = await chromium.launch({ headless: true });
  
  try {
    // Desktop screenshots (1440x900)
    console.log('📸 Desktop screenshots (1440x900):\n');
    const desktopPage = await browser.newPage({
      viewport: { width: 1440, height: 900 }
    });
    
    await desktopPage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(2000); // Initial load animations
    
    const desktopFiles = [];
    for (let i = 0; i < SECTIONS.length; i++) {
      const filename = await captureSection(desktopPage, SECTIONS[i], i, 'desktop');
      if (filename) desktopFiles.push(filename);
    }
    
    await desktopPage.close();
    console.log(`\n✓ Captured ${desktopFiles.length} desktop screenshots\n`);
    
    // Mobile screenshots (390x844)
    console.log('📱 Mobile screenshots (390x844):\n');
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });
    
    await mobilePage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(2000); // Initial load animations
    
    const mobileFiles = [];
    for (let i = 0; i < SECTIONS.length; i++) {
      const filename = await captureSection(mobilePage, SECTIONS[i], i, 'mobile');
      if (filename) mobileFiles.push(filename);
    }
    
    await mobilePage.close();
    console.log(`\n✓ Captured ${mobileFiles.length} mobile screenshots\n`);
    
    console.log('✅ All screenshots saved to:');
    console.log('   - /opt/cursor/artifacts/');
    console.log('   - docs/website-preview/\n');
    
    return { desktop: desktopFiles, mobile: mobileFiles };
  } catch (error) {
    console.error('Error taking screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Ensure artifacts directory exists
const artifactsDir = '/opt/cursor/artifacts';
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

takeScreenshots()
  .then(({ desktop, mobile }) => {
    console.log('Screenshot summary:');
    console.log(`  Desktop: ${desktop.length} files`);
    console.log(`  Mobile: ${mobile.length} files`);
  })
  .catch(console.error);
