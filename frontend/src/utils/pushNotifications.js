import api from '../services/api';

/**
 * Converts a base64 string to a Uint8Array for PushManager subscription.
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Checks if Web Push Notifications are supported in the current browser/device.
 */
export function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Registers the Service Worker (/sw.js)
 */
export async function registerPushServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.error('Service worker registration failed:', err);
    return null;
  }
}

/**
 * Gets current push subscription if active.
 */
export async function getExistingPushSubscription() {
  if (!isPushNotificationSupported()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (err) {
    console.error('Error checking existing push subscription:', err);
    return null;
  }
}

/**
 * Subscribes the student device/phone to Web Push Notifications.
 */
export async function subscribeToPushNotifications() {
  if (!isPushNotificationSupported()) {
    throw new Error('Push notifications are not supported on this browser. Try Chrome on Android or Safari on iOS 16.4+.');
  }

  // 1. Request notification permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was denied. Please allow notifications in your browser/phone settings.');
  }

  // 2. Register Service Worker
  const registration = await registerPushServiceWorker();
  if (!registration) {
    throw new Error('Could not register service worker.');
  }

  // 3. Fetch VAPID Public Key from backend
  const keyRes = await api.get('/notifications/vapid-public-key');
  const vapidPublicKey = keyRes.data?.public_key;
  if (!vapidPublicKey) {
    throw new Error('Failed to retrieve server public key.');
  }

  // 4. Subscribe to PushManager
  const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey
    });
  }

  // 5. Send subscription to backend
  const subJSON = subscription.toJSON();
  await api.post('/notifications/subscribe', {
    endpoint: subJSON.endpoint,
    keys: {
      p256dh: subJSON.keys?.p256dh,
      auth: subJSON.keys?.auth
    }
  });

  return subscription;
}

/**
 * Unsubscribes current device.
 */
export async function unsubscribeFromPushNotifications() {
  if (!isPushNotificationSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      await api.post('/notifications/unsubscribe', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
      return true;
    }
    return false;
  } catch (err) {
    console.error('Error unsubscribing:', err);
    return false;
  }
}

/**
 * Sends a real test notification to verify the student's phone receives it!
 */
export async function sendTestPushAlert() {
  const res = await api.post('/notifications/test-push');
  return res.data;
}
