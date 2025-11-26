/**
 * Test script for Browserless.io integration
 *
 * Run with: npx tsx test-browserless.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { withBrowserless, connectToBrowserless, shouldUseBrowserless } from './src/lib/browserless';

async function testBrowserless() {
  console.log('\n🧪 Testing Browserless.io Integration\n');

  // Check configuration
  console.log('📋 Configuration:');
  console.log('  - Should use Browserless?', shouldUseBrowserless());
  console.log('  - Environment:', process.env.NODE_ENV);
  console.log('  - API Key set?', !!process.env.BROWSERLESS_API_KEY);
  console.log('');

  try {
    console.log('🌐 Attempting to connect to browser...');

    const result = await withBrowserless(async (page) => {
      console.log('✅ Connected successfully!');

      // Navigate to a test page
      console.log('📄 Navigating to example.com...');
      await page.goto('https://example.com', { timeout: 30000 });

      // Get page title
      const title = await page.title();
      console.log('📌 Page title:', title);

      // Take screenshot
      console.log('📸 Taking screenshot...');
      await page.screenshot({ path: 'browserless-test.png' });
      console.log('✅ Screenshot saved to: browserless-test.png');

      return { title, success: true };
    });

    console.log('\n✅ Test completed successfully!');
    console.log('Result:', result);

  } catch (error: any) {
    console.error('\n❌ Test failed!');
    console.error('Error:', error.message);

    if (error.message.includes('BROWSERLESS_API_KEY')) {
      console.log('\n💡 Tip: Add your Browserless API key to .env.local:');
      console.log('   BROWSERLESS_API_KEY=your_key_here');
    }

    process.exit(1);
  }
}

// Run test
testBrowserless()
  .then(() => {
    console.log('\n🎉 All tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Unexpected error:', error);
    process.exit(1);
  });
