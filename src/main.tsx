import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { validateInvoice } from './engine/validate'

// Parity tests (scripts/parity-browser.mjs) call the shipped engine directly. Local-only; nothing is sent.
if (new URLSearchParams(location.search).has('parity')) {
  const validatePdf = async (bytes: Uint8Array) => (await import('./engine/zugferd')).validatePdf(bytes);
  (window as unknown as { __einvoice: unknown }).__einvoice = { validateInvoice, validatePdf }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
