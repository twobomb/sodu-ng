import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.jsx'

import { installAudioUnlock } from './lib/audioUnlock';
installAudioUnlock();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="sodu-theme"
    >
      <App />
    </ThemeProvider>
  </StrictMode>,
)
