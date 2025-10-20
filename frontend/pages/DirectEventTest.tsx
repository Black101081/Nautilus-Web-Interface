import React, { useEffect, useRef } from 'react';
import { useNotification } from '@/contexts/NotificationContext';

/**
 * Test page using direct DOM event listeners
 * Bypasses React synthetic events to test if that's the issue
 */
const DirectEventTest: React.FC = () => {
  const { success, error, warning, info } = useNotification();
  const successBtnRef = useRef<HTMLButtonElement>(null);
  const errorBtnRef = useRef<HTMLButtonElement>(null);
  const warningBtnRef = useRef<HTMLButtonElement>(null);
  const infoBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    console.log('[DirectEventTest] Component mounted, attaching event listeners');

    const handleSuccess = () => {
      console.log('[DirectEventTest] Success button clicked via DOM listener');
      success('This is a success message from DOM listener!');
    };

    const handleError = () => {
      console.log('[DirectEventTest] Error button clicked via DOM listener');
      error('This is an error message from DOM listener!');
    };

    const handleWarning = () => {
      console.log('[DirectEventTest] Warning button clicked via DOM listener');
      warning('This is a warning message from DOM listener!');
    };

    const handleInfo = () => {
      console.log('[DirectEventTest] Info button clicked via DOM listener');
      info('This is an info message from DOM listener!');
    };

    // Attach DOM event listeners directly
    const successBtn = successBtnRef.current;
    const errorBtn = errorBtnRef.current;
    const warningBtn = warningBtnRef.current;
    const infoBtn = infoBtnRef.current;

    if (successBtn) {
      successBtn.addEventListener('click', handleSuccess);
      console.log('[DirectEventTest] Success listener attached');
    }
    if (errorBtn) {
      errorBtn.addEventListener('click', handleError);
      console.log('[DirectEventTest] Error listener attached');
    }
    if (warningBtn) {
      warningBtn.addEventListener('click', handleWarning);
      console.log('[DirectEventTest] Warning listener attached');
    }
    if (infoBtn) {
      infoBtn.addEventListener('click', handleInfo);
      console.log('[DirectEventTest] Info listener attached');
    }

    // Cleanup
    return () => {
      console.log('[DirectEventTest] Cleaning up event listeners');
      if (successBtn) successBtn.removeEventListener('click', handleSuccess);
      if (errorBtn) errorBtn.removeEventListener('click', handleError);
      if (warningBtn) warningBtn.removeEventListener('click', handleWarning);
      if (infoBtn) infoBtn.removeEventListener('click', handleInfo);
    };
  }, [success, error, warning, info]);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-4">Direct DOM Event Test</h1>
        <p className="text-yellow-400 mb-8">
          Using direct DOM addEventListener() instead of React onClick
        </p>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p className="text-gray-300 mb-6">
            Click the buttons below. Event listeners are attached via DOM API.
            Check console for debug logs.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <button
              ref={successBtnRef}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
            >
              Show Success (DOM)
            </button>

            <button
              ref={errorBtnRef}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
            >
              Show Error (DOM)
            </button>

            <button
              ref={warningBtnRef}
              className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium transition-colors"
            >
              Show Warning (DOM)
            </button>

            <button
              ref={infoBtnRef}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
            >
              Show Info (DOM)
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-700 rounded">
            <p className="text-sm text-gray-300 mb-2">
              <strong>Test Method:</strong> Direct DOM event listeners
            </p>
            <p className="text-sm text-gray-300">
              If this works, the issue is with React synthetic events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectEventTest;

