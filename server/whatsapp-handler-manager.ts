// Manager for WhatsApp handler instance that allows hot-reloading credentials

let reloadCallback: (() => void) | null = null;

/**
 * Register the reload callback from the main server
 */
export function registerReloadCallback(callback: () => void) {
  reloadCallback = callback;
}

/**
 * Reload the WhatsApp handler with updated credentials
 * This is called after saving new credentials from the connections panel
 */
export function reloadWhatsAppHandler() {
  if (!reloadCallback) {
    console.warn('[WhatsApp Manager] Reload callback not registered yet');
    return false;
  }

  console.log('[WhatsApp Manager] Triggering handler reload...');
  reloadCallback();
  return true;
}
