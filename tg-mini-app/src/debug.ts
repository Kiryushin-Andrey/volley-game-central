// Global debug utility file

// Get debug mode from localStorage or default to false
let debugModeEnabled = localStorage.getItem('debugModeEnabled') === 'true';

// Function to toggle debug mode
export function toggleDebugMode(): void {
  debugModeEnabled = !debugModeEnabled;
  localStorage.setItem('debugModeEnabled', debugModeEnabled.toString());
  
  const debugLog = document.getElementById('global-debug-log');
  const debugToggle = document.getElementById('debug-toggle');
  
  // Show or hide the debug logs panel
  if (debugLog) {
    debugLog.style.display = debugModeEnabled ? 'block' : 'none';
  }
  
  // Reposition the toggle button based on debug panel visibility
  if (debugToggle) {
    if (debugModeEnabled) {
      // When debug panel is visible, position above it
      debugToggle.style.bottom = '210px';
    } else {
      // When debug panel is hidden, position in bottom corner
      debugToggle.style.bottom = '10px';
    }
  }
  
  if (debugModeEnabled) {
    logDebug('Debug mode enabled');
  }
}

// Export getter for debug mode state
export function isDebugMode(): boolean {
  return debugModeEnabled;
}

// Initialize debug UI when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  // Find our embedded debug elements
  const debugToggle = document.getElementById('debug-toggle');
  const debugLog = document.getElementById('global-debug-log');
  
  if (debugToggle && debugLog) {
    // Set initial debug log visibility based on stored preference
    debugLog.style.display = debugModeEnabled ? 'block' : 'none';
    
    // Set initial toggle button position based on debug mode
    debugToggle.style.bottom = debugModeEnabled ? '210px' : '10px';
    
    // Add event listener to toggle debug mode
    debugToggle.addEventListener('click', () => {
      toggleDebugMode();
    });
    
    // Log essential Telegram WebApp info
    logDebug('Checking Telegram WebApp availability:');
    logDebug(`Window.Telegram exists: ${Boolean(window.Telegram)}`);
    logDebug(`WebApp exists: ${Boolean(window.Telegram?.WebApp)}`);

    if (window.Telegram?.WebApp) {
      logDebug('Telegram WebApp data:');
      logDebug(`initData: ${window.Telegram.WebApp.initData}`);
      logDebug('initDataUnsafe:');
      logDebug(JSON.stringify(window.Telegram.WebApp.initDataUnsafe, null, 2));
    }
  } else {
    console.error('Debug UI elements not found in the DOM');
  }
});

// Function to log debug messages
export function logDebug(message: any): void {
  // Format timestamp and message
  const timestamp = new Date().toISOString().substr(11, 8);
  const formattedMsg = typeof message === 'string' 
    ? message 
    : JSON.stringify(message, null, 2);
  
  // Always log to console regardless of debug mode
  console.log(`[DEBUG ${timestamp}] ${formattedMsg}`);
  
  // Only update UI if debug mode is enabled
  if (!isDebugMode()) return;
  
  const logElement = document.getElementById('global-debug-log');
  if (logElement) {
    // Create a new log entry
    const logEntry = document.createElement('div');
    logEntry.style.borderBottom = '1px solid #444';
    logEntry.style.padding = '2px 0';
    logEntry.textContent = `[${timestamp}] ${formattedMsg}`;
    
    // Add to the container
    logElement.appendChild(logEntry);
    
    // Auto-scroll to bottom
    logElement.scrollTop = logElement.scrollHeight;
  }
}

// Function to clear all debug logs
export function clearAllLogs(): void {
  const logElement = document.getElementById('global-debug-log');
  if (logElement) {
    // Remove all child nodes
    while (logElement.firstChild) {
      logElement.removeChild(logElement.firstChild);
    }
    // Log that logs were cleared
    logDebug('Logs cleared');
  }
}
