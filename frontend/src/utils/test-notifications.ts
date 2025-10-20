/**
 * Test notification utilities for debugging
 * Uses console.log instead of alert() to bypass browser blocking
 */

export const testNotify = {
  success: (message: string) => {
    console.log('[SUCCESS]', message);
    // Also try to show alert
    try {
      window.alert(`✅ Success\n\n${message}`);
    } catch (e) {
      console.error('[ALERT BLOCKED]', e);
    }
  },

  error: (message: string) => {
    console.log('[ERROR]', message);
    try {
      window.alert(`❌ Error\n\n${message}`);
    } catch (e) {
      console.error('[ALERT BLOCKED]', e);
    }
  },

  info: (message: string) => {
    console.log('[INFO]', message);
    try {
      window.alert(`ℹ️ Info\n\n${message}`);
    } catch (e) {
      console.error('[ALERT BLOCKED]', e);
    }
  },

  confirm: (message: string): boolean => {
    console.log('[CONFIRM]', message);
    try {
      return window.confirm(`❓ Confirm\n\n${message}`);
    } catch (e) {
      console.error('[CONFIRM BLOCKED]', e);
      return true; // Auto-confirm for testing
    }
  },
};

