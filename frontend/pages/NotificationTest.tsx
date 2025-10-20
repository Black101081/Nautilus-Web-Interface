import React from 'react';
import { useNotification } from '@/contexts/NotificationContext';

const NotificationTest: React.FC = () => {
  const { success, error, warning, info } = useNotification();

  console.log('[NotificationTest] Component rendered');

  const handleSuccess = () => {
    console.log('[NotificationTest] Success button clicked');
    success('This is a success message!');
  };

  const handleError = () => {
    console.log('[NotificationTest] Error button clicked');
    error('This is an error message!');
  };

  const handleWarning = () => {
    console.log('[NotificationTest] Warning button clicked');
    warning('This is a warning message!');
  };

  const handleInfo = () => {
    console.log('[NotificationTest] Info button clicked');
    info('This is an info message!');
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">Notification System Test</h1>
        
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p className="text-gray-300 mb-6">
            Click the buttons below to test the notification system.
            Notifications should appear in the top-right corner.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleSuccess}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
            >
              Show Success
            </button>

            <button
              onClick={handleError}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded font-medium transition-colors"
            >
              Show Error
            </button>

            <button
              onClick={handleWarning}
              className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-medium transition-colors"
            >
              Show Warning
            </button>

            <button
              onClick={handleInfo}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
            >
              Show Info
            </button>
          </div>

          <div className="mt-6 p-4 bg-gray-700 rounded">
            <p className="text-sm text-gray-300">
              Check the browser console for debug logs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationTest;

