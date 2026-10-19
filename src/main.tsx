import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-serif-4/opsz-italic.css'
import '@fontsource-variable/source-sans-3/index.css'
import './styles.css'

document.documentElement.dataset.stand = __STAND__

// Nach dem ersten Besuch auch ohne Internet: der Service Worker hält das Programm vor.
// Und den Browser bitten, die Daten nicht von selbst zu räumen.
// Übernimmt eine neue Version, während die Seite offen ist, meldet die App das zum Neuladen.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hatteSteuerung = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hatteSteuerung) window.dispatchEvent(new Event('neue-version'))
  })
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {})
    navigator.storage?.persist?.().catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
