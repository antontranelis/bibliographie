import { createHash } from 'node:crypto'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Service Worker, der beim ersten Besuch alle Dateien des Programms vorhält.
 * Danach startet das Programm auch ohne Internet. Online kommt immer der neueste Stand aus dem Netz,
 * Updates blockiert er also nicht. Notschalter: eine sw.js ausliefern, die sich mit
 * self.registration.unregister() abmeldet.
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

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SPEICHER).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((namen) => Promise.all(namen.filter((n) => n.startsWith('bibliographie-') && n !== SPEICHER).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

// Eigene Dateien: erst das Netz, ohne Verbindung oder bei Fehlerantwort der Vorrat.
// Kataloge und alles Fremde gehen direkt ins Netz.
const ausVorrat = async (anfrage) => (await caches.match(anfrage)) ?? (anfrage.mode === 'navigate' ? await caches.match('./') : undefined)

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return
  e.respondWith(
    fetch(e.request)
      .then(async (antwort) => {
        if (antwort.ok) {
          const kopie = antwort.clone()
          caches.open(SPEICHER).then((c) => c.put(e.request, kopie))
          return antwort
        }
        return (await ausVorrat(e.request)) ?? antwort
      })
      .catch(async () => (await ausVorrat(e.request)) ?? Response.error()),
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
