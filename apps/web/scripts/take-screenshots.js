#!/usr/bin/env node

/**
 * Take screenshots of the marketing website at mobile and desktop sizes
 */

const { chromium } = require('playwright');
const path = require('path');

async function takeScreenshots() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: true });
  
  try {
    // Desktop screenshot (1440px)
    console.log('\nTaking desktop screenshot (1440px)...');
    const desktopPage = await browser.newPage({
      viewport: { width: 1440, height: 900 }
    });
    
    await desktopPage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await desktopPage.waitForTimeout(2000); // Wait for animations
    
    await desktopPage.screenshot({
      path: path.join(__dirname, '../../docs/website-preview/desktop-1440px.png'),
      fullPage: true
    });
    console.log('✓ Desktop screenshot saved');
    
    await desktopPage.close();
    
    // Mobile screenshot (390px)
    console.log('\nTaking mobile screenshot (390px)...');
    const mobilePage = await browser.newPage({
      viewport: { width: 390, height: 844 }
    });
    
    await mobilePage.goto('http://localhost:3001', { waitUntil: 'networkidle' });
    await mobilePage.waitForTimeout(2000); // Wait for animations
    
    await mobilePage.screenshot({
      path: path.join(__dirname, '../../docs/website-preview/mobile-390px.png'),
      fullPage: true
    });
    console.log('✓ Mobile screenshot saved');
    
    await mobilePage.close();
    
    console.log('\n✅ Screenshots saved to docs/website-preview/');
  } catch (error) {
    console.error('Error taking screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

takeScreenshots().catch(console.error);
