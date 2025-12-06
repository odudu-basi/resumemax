'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Initialize PostHog
    if (typeof window !== 'undefined') {
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // We'll capture manually for better control
        capture_pageleave: true,

        // Session recording settings
        session_recording: {
          maskAllInputs: false,
          maskInputOptions: {
            password: true, // Always mask passwords
            color: false,
            date: false,
            'datetime-local': false,
            email: false,
            month: false,
            number: false,
            range: false,
            search: false,
            tel: false,
            text: false,
            time: false,
            url: false,
            week: false,
            textarea: false,
            select: false,
          },
        },

        // Autocapture settings
        autocapture: {
          dom_event_allowlist: ['click', 'submit', 'change'],
          url_allowlist: [],
          element_allowlist: [],
        },

        loaded: (posthog) => {
          if (process.env.NODE_ENV === 'development') {
            console.log('✅ PostHog loaded successfully');
          }
        },
      });
    }
  }, []);

  // Track page views
  useEffect(() => {
    if (pathname && typeof window !== 'undefined') {
      let url = window.origin + pathname;
      if (searchParams && searchParams.toString()) {
        url = url + `?${searchParams.toString()}`;
      }

      posthog.capture('$pageview', {
        $current_url: url,
      });
    }
  }, [pathname, searchParams]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
