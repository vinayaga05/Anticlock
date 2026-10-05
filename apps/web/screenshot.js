const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ 
    headless: true,
    executablePath: '/usr/local/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:3001...');
    await page.goto('http://localhost:3001', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for content to load
    await page.waitForTimeout(2000);

    // Mobile screenshot (390px width - iPhone 12/13/14)
    console.log('Taking mobile screenshot (390px)...');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: '../../docs/website-preview/home-mobile-390px.png', 
      fullPage: true 
    });
    console.log('✓ Mobile screenshot saved');

    // Desktop screenshot (1440px width)
    console.log('Taking desktop screenshot (1440px)...');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: '../../docs/website-preview/home-desktop-1440px.png', 
      fullPage: true 
    });
    console.log('✓ Desktop screenshot saved');

    console.log('\nScreenshots saved to docs/website-preview/');
  } catch (error) {
    console.error('Error taking screenshots:', error.message);
  } finally {
    await browser.close();
  }
})();
