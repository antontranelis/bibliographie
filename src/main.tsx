import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { starteAktualisierung } from './aktualisierung'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-serif-4/opsz-italic.css'
import '@fontsource-variable/source-sans-3/index.css'
import './styles.css'

document.documentElement.dataset.stand = __STAND__

// Nach dem ersten Besuch auch ohne Internet; neue Versionen siehe aktualisierung.ts
if (import.meta.env.PROD) starteAktualisierung()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
