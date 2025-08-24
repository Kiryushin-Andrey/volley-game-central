// Import debug utilities first to ensure they're initialized before React
import './debug';

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { DialogProvider } from './components/Dialogs/DialogProvider'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </React.StrictMode>,
)
