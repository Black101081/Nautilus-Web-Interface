/**
 * Test Helper for Sandbox Environment
 * 
 * Exposes notification functions to global scope so they can be called
 * from browser automation tools via console.
 * 
 * Safe to use in any environment - will gracefully fail if not supported.
 */

import type { NotificationType } from '@/contexts/NotificationContext';

interface TestHelper {
  notify: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
  triggerButton: (selector: string) => void;
  clickByText: (text: string) => void;
  clickByIndex: (index: number) => void;
}

declare global {
  interface Window {
    __TEST_HELPER__?: TestHelper;
  }
}

/**
 * Check if we should enable test helper
 */
function shouldEnableTestHelper(): boolean {
  try {
    // Enable in development, staging, or when explicitly requested
    const env = process.env.NODE_ENV;
    const isDevOrStaging = env === 'development' || env === 'staging';
    const isExplicitlyEnabled = typeof window !== 'undefined' && 
                                (window.location.search.includes('testHelper=true') ||
                                 window.location.hostname.includes('manusvm.computer'));
    
    return isDevOrStaging || isExplicitlyEnabled;
  } catch (error) {
    // If any check fails, don't enable
    console.warn('[TestHelper] Environment check failed:', error);
    return false;
  }
}

export function initTestHelper(notificationFunctions: {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}) {
  try {
    // Check if we should enable
    if (!shouldEnableTestHelper()) {
      return;
    }

    // Check if window is available (SSR safety)
    if (typeof window === 'undefined') {
      return;
    }

    // Check if already initialized
    if (window.__TEST_HELPER__) {
      console.log('[TestHelper] Already initialized');
      return;
    }

    console.log('[TestHelper] Initializing test helper functions');

    window.__TEST_HELPER__ = {
      notify: {
        success: (message: string) => {
          try {
            console.log('[TestHelper] notify.success:', message);
            notificationFunctions.success(message);
          } catch (error) {
            console.error('[TestHelper] notify.success failed:', error);
          }
        },
        error: (message: string) => {
          try {
            console.log('[TestHelper] notify.error:', message);
            notificationFunctions.error(message);
          } catch (error) {
            console.error('[TestHelper] notify.error failed:', error);
          }
        },
        warning: (message: string) => {
          try {
            console.log('[TestHelper] notify.warning:', message);
            notificationFunctions.warning(message);
          } catch (error) {
            console.error('[TestHelper] notify.warning failed:', error);
          }
        },
        info: (message: string) => {
          try {
            console.log('[TestHelper] notify.info:', message);
            notificationFunctions.info(message);
          } catch (error) {
            console.error('[TestHelper] notify.info failed:', error);
          }
        },
      },

      triggerButton: (selector: string) => {
        try {
          console.log('[TestHelper] triggerButton:', selector);
          const button = document.querySelector<HTMLButtonElement>(selector);
          if (button) {
            button.click();
            console.log('[TestHelper] Button clicked');
          } else {
            console.error('[TestHelper] Button not found:', selector);
          }
        } catch (error) {
          console.error('[TestHelper] triggerButton failed:', error);
        }
      },

      clickByText: (text: string) => {
        try {
          console.log('[TestHelper] clickByText:', text);
          const buttons = Array.from(document.querySelectorAll('button'));
          const button = buttons.find(b => b.textContent?.includes(text));
          if (button) {
            button.click();
            console.log('[TestHelper] Button clicked:', button.textContent);
          } else {
            console.error('[TestHelper] Button not found with text:', text);
          }
        } catch (error) {
          console.error('[TestHelper] clickByText failed:', error);
        }
      },

      clickByIndex: (index: number) => {
        try {
          console.log('[TestHelper] clickByIndex:', index);
          const buttons = document.querySelectorAll('button');
          if (buttons[index]) {
            (buttons[index] as HTMLButtonElement).click();
            console.log('[TestHelper] Button clicked at index:', index);
          } else {
            console.error('[TestHelper] Button not found at index:', index);
          }
        } catch (error) {
          console.error('[TestHelper] clickByIndex failed:', error);
        }
      },
    };

    console.log('[TestHelper] ✅ Test helper ready. Use window.__TEST_HELPER__');
    console.log('[TestHelper] Examples:');
    console.log('  window.__TEST_HELPER__.notify.success("Test message")');
    console.log('  window.__TEST_HELPER__.clickByText("Optimize")');
    console.log('  window.__TEST_HELPER__.clickByIndex(0)');
  } catch (error) {
    // Fail silently in production, log in development
    console.warn('[TestHelper] Initialization failed (non-critical):', error);
  }
}

