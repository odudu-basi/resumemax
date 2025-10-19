'use client';

import { Button } from '@/components/ui/button';
import MixpanelService from '@/src/lib/mixpanel';

export default function MixpanelTest() {
  const testEvents = () => {
    console.log('Testing Mixpanel events...');
    
    // Test basic event
    MixpanelService.track('test_event', {
      test_property: 'test_value',
      timestamp: new Date().toISOString(),
    });

    // Test specific events
    MixpanelService.trackPageView({
      page_name: 'test_page',
    });

    MixpanelService.trackFeatureButtonClick({
      button_name: 'test_button',
      feature_name: 'test_feature',
      user_authenticated: false,
    });

    console.log('Mixpanel test events sent! Check your Mixpanel dashboard.');
  };

  return (
    <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
      <h3 className="text-lg font-semibold mb-2">Mixpanel Test Component</h3>
      <p className="text-sm text-gray-600 mb-4">
        This component is for testing Mixpanel integration. Remove it in production.
      </p>
      <Button onClick={testEvents} variant="outline">
        Test Mixpanel Events
      </Button>
    </div>
  );
}
