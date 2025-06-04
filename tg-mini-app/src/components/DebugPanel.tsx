import React, { useState, useEffect } from 'react';
import { clearAllLogs } from '../debug';

interface DebugPanelProps {
  initiallyExpanded?: boolean;
}

const DebugPanel: React.FC<DebugPanelProps> = ({ initiallyExpanded = false }) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [logs, setLogs] = useState<string[]>([]);

  // Subscribe to log updates from global debug.ts
  useEffect(() => {
    const logElement = document.getElementById('global-debug-log');
    if (logElement) {
      // Extract logs from the global debug log element
      const updatePanelFromGlobalLog = () => {
        const newLogs: string[] = [];
        logElement.childNodes.forEach((node) => {
          if (node.textContent) {
            newLogs.push(node.textContent);
          }
        });
        setLogs(newLogs);
      };
      
      // Create an observer to watch for changes to the log element
      const observer = new MutationObserver(updatePanelFromGlobalLog);
      observer.observe(logElement, { childList: true });
      
      // Initial update
      updatePanelFromGlobalLog();
      
      return () => observer.disconnect();
    }
  }, []);

  const toggleExpanded = () => {
    setExpanded(!expanded);
  };

  const clearLogs = () => {
    clearAllLogs();
  };
  
  const panelStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(50, 50, 50, 0.85)', // Darker, less bright background
    color: 'white',
    fontSize: '12px',
    fontFamily: 'monospace',
    zIndex: 2147483647, // Maximum z-index value
    transition: 'height 0.3s ease',
    borderTop: '2px solid yellow' // Add a bold border for visibility
  };
  
  const headerStyles: React.CSSProperties = {
    padding: '8px 12px',
    backgroundColor: 'rgba(0, 0, 0, 1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontWeight: 'bold'
  };
  
  const contentStyles: React.CSSProperties = {
    maxHeight: expanded ? '200px' : '0',
    overflow: 'auto',
    padding: expanded ? '8px' : '0',
    transition: 'max-height 0.3s ease, padding 0.3s ease'
  };
  
  const buttonStyles: React.CSSProperties = {
    backgroundColor: 'transparent',
    color: '#00FF00',
    border: '1px solid #00FF00',
    padding: '2px 6px',
    fontSize: '10px',
    cursor: 'pointer',
    marginLeft: '5px'
  };
  
  return (
    <div style={panelStyles}>
      <div style={headerStyles}>
        <div>
          Debug Panel ({logs.length} entries)
        </div>
        <div>
          <button style={buttonStyles} onClick={clearLogs}>Clear</button>
          <button style={buttonStyles} onClick={toggleExpanded}>
            {expanded ? 'Hide' : 'Show'}
          </button>
        </div>
      </div>
      <div style={contentStyles}>
        {logs.length === 0 ? (
          <div style={{ padding: '10px', textAlign: 'center', fontStyle: 'italic' }}>
            No logs yet. The panel is working, but no debug messages have been logged.
          </div>
        ) : (
          <pre style={{ margin: 0 }}>
            {logs.map((log, index) => (
              <div key={index}>{log}</div>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
};

export default DebugPanel;
