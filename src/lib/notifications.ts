/**
 * Notification utility for auto-apply sessions
 * Handles browser notifications and in-app notifications
 */

export interface NotificationData {
  sessionId: string;
  jobUrl: string;
  jobTitle?: string;
  companyName?: string;
  expiresAt: string;
}

/**
 * Request browser notification permission
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.log('Browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
}

/**
 * Show browser notification for form filled
 */
export function showFormFilledNotification(data: NotificationData): Notification | null {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  const title = '✅ Application Form Filled!';
  const body = data.jobTitle && data.companyName
    ? `${data.jobTitle} at ${data.companyName}\n\nReview and submit within 15 minutes`
    : 'Review and submit within 15 minutes';

  const notification = new Notification(title, {
    body,
    icon: '/icon.png',
    badge: '/badge.png',
    tag: `auto-apply-${data.sessionId}`,
    requireInteraction: true, // Keep notification until user interacts
    actions: [
      {
        action: 'review',
        title: 'Review & Submit'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: {
      sessionId: data.sessionId,
      jobUrl: data.jobUrl,
      expiresAt: data.expiresAt
    }
  });

  // Handle notification click
  notification.onclick = () => {
    window.focus();
    // Navigate to the job URL or a review page
    window.location.href = data.jobUrl;
    notification.close();
  };

  return notification;
}

/**
 * Show browser notification for timeout
 */
export function showTimeoutNotification(data: NotificationData): Notification | null {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  const title = '⏰ Application Session Expired';
  const body = data.jobTitle && data.companyName
    ? `${data.jobTitle} at ${data.companyName}\n\nTimed out. Please try again.`
    : 'Session timed out. Please try again.';

  const notification = new Notification(title, {
    body,
    icon: '/icon.png',
    tag: `auto-apply-timeout-${data.sessionId}`,
    data: {
      sessionId: data.sessionId
    }
  });

  return notification;
}

/**
 * Calculate time remaining for a session
 */
export function getTimeRemaining(expiresAt: string): {
  total: number;
  minutes: number;
  seconds: number;
  expired: boolean;
} {
  const now = new Date().getTime();
  const expires = new Date(expiresAt).getTime();
  const total = expires - now;

  if (total <= 0) {
    return {
      total: 0,
      minutes: 0,
      seconds: 0,
      expired: true
    };
  }

  return {
    total,
    minutes: Math.floor((total / 1000 / 60) % 60),
    seconds: Math.floor((total / 1000) % 60),
    expired: false
  };
}

/**
 * Format time remaining as string
 */
export function formatTimeRemaining(expiresAt: string): string {
  const { minutes, seconds, expired } = getTimeRemaining(expiresAt);

  if (expired) {
    return 'Expired';
  }

  return `${minutes}m ${seconds}s`;
}
