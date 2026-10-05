#!/usr/bin/env node

const { chromium } = require('playwright');

async function checkPage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }
  });
  
  // Collect console messages and network failures
  const logs = [];
  const failed = [];
  page.on('console', msg => logs.push(`${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => logs.push(`ERROR: ${err.message}`));
  page.on('requestfailed', request => {
    failed.push(`FAILED: ${request.url()} - ${request.failure().errorText}`);
  });
  page.on('response', response => {
    if (response.status() >= 400) {
      failed.push(`${response.status()}: ${response.url()}`);
    }
  });
  
  try {
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(3000);
    
    console.log('\n=== Console Logs ===');
    logs.forEach(log => console.log(log));
    
    console.log('\n=== Failed/404 Requests ===');
    failed.forEach(f => console.log(f));
    
    console.log('\n=== Page Title ===');
    console.log(await page.title());
    
    console.log('\n=== Hero Section HTML ===');
    const heroHTML = await page.evaluate(() => {
      const section = document.querySelector('section');
      return section ? section.outerHTML.substring(0, 500) : 'No section found';
    });
    console.log(heroHTML);
    
    console.log('\n=== Checking for phone mockups ===');
    const phoneCount = await page.evaluate(() => {
      return document.querySelectorAll('.phone-frame, [class*="PhoneFrame"]').length;
    });
    console.log(`Found ${phoneCount} phone frames`);
    
    console.log('\n=== Checking CSS ===');
    const hasStyles = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      const styles = document.querySelectorAll('style');
      return { linkCount: links.length, styleCount: styles.length };
    });
    console.log(hasStyles);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkPage().catch(console.error);
