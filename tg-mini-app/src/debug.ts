// Global debug utility file

// Get debug mode from localStorage or default to false
let debugModeEnabled = localStorage.getItem('debugModeEnabled') === 'true';

// In-memory buffer for all debug logs regardless of UI/debug mode state
const debugLogBuffer: string[] = [];

// Function to toggle debug mode
export function toggleDebugMode(): void {
  debugModeEnabled = !debugModeEnabled;
  localStorage.setItem('debugModeEnabled', debugModeEnabled.toString());
  
  const debugLog = document.getElementById('debug-log');
  const debugToggle = document.getElementById('debug-toggle');
  const copyButton = document.getElementById('copy-logs');
  
  // Show or hide the debug logs panel
  if (debugLog) {
    debugLog.style.display = debugModeEnabled ? 'block' : 'none';
    if (debugModeEnabled) {
      // Populate UI from in-memory buffer when enabling
      renderLogsToUI();
    } else {
      // Clear only UI when disabling (preserve buffer)
      clearUILogs();
    }
  }
  // Show/hide copy button alongside the panel
  if (copyButton) {
    (copyButton as HTMLElement).style.display = debugModeEnabled ? 'inline-flex' : 'none';
  }
  
  // Reposition the toggle button based on debug panel visibility and info text presence
  if (debugToggle) {
    updateDebugTogglePosition();
  }
  
  if (debugModeEnabled) {
    logDebug('Debug mode enabled');
  }
}

// Function to update debug toggle position based on info text presence
export function updateDebugTogglePosition(): void {
  const debugToggle = document.getElementById('debug-toggle');
  const copyButton = document.getElementById('copy-logs');
  const infoText = document.querySelector('.info-text');
  
  if (!debugToggle) return;
  
  let bottomPosition = 10; // Default position
  
  // Check if info text is present and visible
  if (infoText && window.getComputedStyle(infoText).display !== 'none') {
    // Get the height of the info text element
    const infoTextHeight = infoText.getBoundingClientRect().height;
    bottomPosition = infoTextHeight + 10; // 10px gap above info text
  }
  
  // If debug panel is visible, add its height
  if (debugModeEnabled) {
    bottomPosition += 200; // Debug panel height
  }
  
  debugToggle.style.bottom = `${bottomPosition}px`;

  // Position the copy button slightly above the toggle to avoid overlap
  if (copyButton) {
    // Anchor to left, and keep a fixed offset above the debug panel when visible
    const el = copyButton as HTMLElement;
    el.style.left = '10px';
    el.style.right = 'auto';
    el.style.bottom = debugModeEnabled ? '210px' : '10px';
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
  const debugLog = document.getElementById('debug-log');
  const copyButton = document.getElementById('copy-logs');
  
  if (debugToggle && debugLog) {
    // Set initial debug log visibility based on stored preference
    debugLog.style.display = debugModeEnabled ? 'block' : 'none';
    // Set initial copy button visibility
    if (copyButton) {
      (copyButton as HTMLElement).style.display = debugModeEnabled ? 'inline-flex' : 'none';
      copyButton.addEventListener('click', async () => {
        await copyAllLogsToClipboard();
      });
    }
    // Populate UI from buffer if debug mode starts enabled
    if (debugModeEnabled) {
      renderLogsToUI();
    }
    
    // Set initial toggle button position based on debug mode
    updateDebugTogglePosition();
    
    // Add event listener to toggle debug mode
    debugToggle.addEventListener('click', () => {
      toggleDebugMode();
    });
    
    // Set up MutationObserver to watch for info text changes
    const observer = new MutationObserver(() => {
      updateDebugTogglePosition();
    });
    
    // Observe changes to the document body
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
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
  const bufferEntry = `[${timestamp}] ${formattedMsg}`;
  
  // Always log to console regardless of debug mode
  console.log(`[DEBUG ${timestamp}] ${formattedMsg}`);
  // Always add to in-memory buffer
  debugLogBuffer.push(bufferEntry);
  
  // Only update UI if debug mode is enabled
  if (!isDebugMode()) return;
  
  const logElement = document.getElementById('debug-log');
  if (logElement) {
    // Create a new log entry
    const logEntry = document.createElement('div');
    logEntry.style.borderBottom = '1px solid #444';
    logEntry.style.padding = '2px 0';
    logEntry.textContent = bufferEntry;
    
    // Add to the container
    logElement.appendChild(logEntry);
    
    // Auto-scroll to bottom
    logElement.scrollTop = logElement.scrollHeight;
  }
}

// Function to clear all debug logs
export function clearAllLogs(): void {
  const logElement = document.getElementById('debug-log');
  if (logElement) {
    // Remove all child nodes
    while (logElement.firstChild) {
      logElement.removeChild(logElement.firstChild);
    }
    // Log that logs were cleared
    logDebug('Logs cleared');
  }
}

// Helper: Render entire buffer to the UI panel
function renderLogsToUI(): void {
  const logElement = document.getElementById('debug-log');
  if (!logElement) return;
  // Clear current UI
  clearUILogs();
  // Append from buffer
  for (const entry of debugLogBuffer) {
    const logEntry = document.createElement('div');
    logEntry.style.borderBottom = '1px solid #444';
    logEntry.style.padding = '2px 0';
    logEntry.textContent = entry;
    logElement.appendChild(logEntry);
  }
  logElement.scrollTop = logElement.scrollHeight;
}

// Helper: Clear only the UI log container (preserves buffer)
function clearUILogs(): void {
  const logElement = document.getElementById('debug-log');
  if (!logElement) return;
  while (logElement.firstChild) {
    logElement.removeChild(logElement.firstChild);
  }
}

// Helper: Copy all buffered logs to clipboard with blank line separation
async function copyAllLogsToClipboard(): Promise<void> {
  try {
    const text = debugLogBuffer.join('\n\n');
    await navigator.clipboard.writeText(text);
    console.log('Debug logs copied to clipboard');
  } catch (err) {
    console.error('Failed to copy debug logs:', err);
  }
}
