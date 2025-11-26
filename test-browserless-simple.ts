/**
 * Simple Browserless.io connection test
 * Run with: npx tsx test-browserless-simple.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { chromium } from 'playwright';

async function testBrowserless() {
  console.log('\n🧪 Testing Browserless.io Connection\n');

  const apiKey = process.env.BROWSERLESS_API_KEY;
  const endpoint = process.env.BROWSERLESS_ENDPOINT || 'wss://production-sfo.browserless.io';

  console.log('📋 Configuration:');
  console.log('  - API Key:', apiKey ? `${apiKey.substring(0, 8)}...` : '❌ NOT SET');
  console.log('  - Endpoint:', endpoint);
  console.log('');

  if (!apiKey) {
    console.error('❌ BROWSERLESS_API_KEY not found in .env.local');
    process.exit(1);
  }

  // Build WebSocket endpoint - stealth is in the base endpoint already
  const wsEndpoint = endpoint.includes('?')
    ? `${endpoint}&token=${apiKey}`
    : `${endpoint}?token=${apiKey}`;

  try {
    console.log('🌐 Connecting to Browserless.io...');
    console.log('   Endpoint:', wsEndpoint);
    console.log('');

    // Use connectOverCDP for Browserless
    const browser = await chromium.connectOverCDP(wsEndpoint, {
      timeout: 30000,
    });

    console.log('✅ Connected successfully!\n');

    // Get the default context and page
    const context = browser.contexts()[0] || await browser.newContext();
    const page = await context.newPage();

    console.log('📄 Navigating to example.com...');
    await page.goto('https://example.com', { timeout: 30000 });

    const title = await page.title();
    console.log('📌 Page title:', title);

    console.log('📸 Taking screenshot...');
    await page.screenshot({ path: 'browserless-test.png' });
    console.log('✅ Screenshot saved to: browserless-test.png\n');

    await browser.close();
    console.log('🧹 Browser closed\n');

    console.log('✅ Test completed successfully!');
    console.log('\n🎉 Browserless.io is working correctly!\n');

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Test failed!');
    console.error('Error:', error.message);

    if (error.message.includes('connect ECONNREFUSED')) {
      console.log('\n💡 Possible issues:');
      console.log('  - Check your internet connection');
      console.log('  - Verify the endpoint URL is correct');
    } else if (error.message.includes('401') || error.message.includes('403')) {
      console.log('\n💡 Possible issues:');
      console.log('  - API key is invalid');
      console.log('  - API key has expired');
      console.log('  - Check your Browserless.io dashboard');
    } else if (error.message.includes('timeout')) {
      console.log('\n💡 Possible issues:');
      console.log('  - Browserless.io may be experiencing issues');
      console.log('  - Your plan may have reached its limits');
      console.log('  - Check status.browserless.io');
    }

    console.log('');
    process.exit(1);
  }
}

testBrowserless();
