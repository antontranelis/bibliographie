import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { starteAktualisierung } from './aktualisierung'
import { bitteUmDauer, lade } from './ablage'
import { leererDatenstamm } from './model'
import '@fontsource-variable/source-serif-4/opsz.css'
import '@fontsource-variable/source-serif-4/opsz-italic.css'
import '@fontsource-variable/source-sans-3/index.css'
import './styles.css'

document.documentElement.dataset.stand = __STAND__

// Nach dem ersten Besuch auch ohne Internet; neue Versionen siehe aktualisierung.ts
if (import.meta.env.PROD) starteAktualisierung()

// Der gespeicherte Stand wird vor dem ersten Zeichnen gelesen, damit die App nie mit leerer Kartei startet.
// Lässt er sich nicht lesen, startet sie gar nicht: leer zu starten würde ihn beim ersten Speichern überschreiben.
const wurzel = createRoot(document.getElementById('root')!)
lade().then(
  (start) => {
    bitteUmDauer()
    wurzel.render(
      <StrictMode>
        <App start={start ?? leererDatenstamm()} />
      </StrictMode>,
    )
  },
  () =>
    wurzel.render(
      <p className="ladefehler" role="alert">
        Die gespeicherten Daten lassen sich gerade nicht lesen. Bitte die Seite neu laden; hilft das nicht, den Browser neu starten. Die Daten bleiben dabei erhalten.
      </p>,
    ),
)
