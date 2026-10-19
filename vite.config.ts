import { createHash } from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Service Worker: eine Version, ein Vorrat. Der aktive Worker liefert HTML und alle Programmteile
 * aus seinem eigenen Vorrat, damit sie immer zusammenpassen, auch ohne Internet.
 * Eine neue Version lädt im Hintergrund vollständig und wartet. Die Seite schaltet sie scharf
 * (src/aktualisierung.ts): beim Start, wenn kein anderer Tab offen ist, sonst per Knopf.
 * Notschalter: eine sw.js ausliefern, die sich mit self.registration.unregister() abmeldet.
 */
function offline(): Plugin {
  return {
    name: 'offline',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const dateien = ['./', ...Object.keys(bundle).filter((f) => f !== 'index.html' && !f.endsWith('.map'))].sort()
      const stand = createHash('sha256').update(dateien.join('\n')).digest('hex').slice(0, 12)
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `// Erzeugt beim Build (vite.config.ts)
const SPEICHER = 'bibliographie-${stand}'
const DATEIEN = ${JSON.stringify(dateien)}

// Neue Version vollständig vorhalten, dann warten, bis die Seite sie scharf schaltet
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(DATEIEN)))
})

self.addEventListener('message', (e) => {
  if (e.data === 'aktivieren') self.skipWaiting()
})

// Beim Übernehmen laufen keine alten Tabs mehr: alte Vorräte weg
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('bibliographie-') && n !== SPEICHER).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

// Eigene Dateien aus dem Vorrat dieser Version, Unbekanntes und alles Fremde aus dem Netz.
// ignoreVary: der Server schickt „Vary: Origin“, Modul-Anfragen haben einen Origin-Kopf, das Vorladen nicht.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  e.respondWith(
    caches.open(SPEICHER).then(async (c) => {
      const treffer = await c.match(e.request.mode === 'navigate' ? './' : e.request, { ignoreVary: true })
      return treffer ?? fetch(e.request)
    }),
  )
})
`,
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), offline()],
  base: './',
  // Build-Stempel: zeigt, welcher Stand im Browser läuft (html data-stand)
  define: { __STAND__: JSON.stringify(new Date().toISOString()) },
})
