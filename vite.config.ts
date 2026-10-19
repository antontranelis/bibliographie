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

// Alte Vorräte bleiben, solange ein Tab offen ist, der beim Wechsel schon lief: er lädt noch die alten
// Programmteile nach. Vermerkt werden sie im Cache-Speicher, damit das ein Beenden des Workers übersteht.
const VERMERK = 'bibliographie-auslauf'
const vermerk = async () => {
  const a = await (await caches.open(VERMERK)).match('vermerk')
  return a ? a.json() : { vorraete: [], tabs: [] }
}
const merke = async (v) => (await caches.open(VERMERK)).put('vermerk', new Response(JSON.stringify(v)))
// Bereits gesteuerte Tabs wechseln schon beim Aktivieren zur neuen Version; aufgeräumt wird erst danach
let aktivierung = Promise.resolve()

// Geprüft, wenn eine Seite fertig geladen hat: dann ist ein ersetzter Tab (Neuladen) sicher geschlossen
const aufraeumen = async () => {
  await aktivierung
  const v = await vermerk()
  if (v.vorraete.length === 0) return
  const offen = new Set((await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).map((c) => c.id))
  if (v.tabs.some((id) => offen.has(id))) return
  await Promise.all(v.vorraete.map((n) => caches.delete(n)))
  await merke({ vorraete: [], tabs: [] })
}

self.addEventListener('message', (e) => {
  if (e.data === 'geladen') e.waitUntil(aufraeumen())
})

self.addEventListener('activate', (e) => {
  aktivierung = (async () => {
    const alt = (await caches.keys()).filter((n) => n.startsWith('bibliographie-') && n !== SPEICHER && n !== VERMERK)
    const tabs = (await self.clients.matchAll({ type: 'window', includeUncontrolled: true })).map((c) => c.id)
    const v = await vermerk()
    await merke({ vorraete: [...new Set([...v.vorraete, ...alt])].filter((n) => n !== SPEICHER), tabs: [...new Set([...v.tabs, ...tabs])] })
    await self.clients.claim()
  })()
  e.waitUntil(aktivierung.then(() => aufraeumen()))
})

// Eigene Dateien: erst das Netz, ohne Verbindung oder bei Fehlerantwort der Vorrat (alle Vorräte, auch auslaufende).
// Kataloge und alles Fremde gehen direkt ins Netz.
// ignoreVary: der Server schickt „Vary: Origin“, Modul-Anfragen haben einen Origin-Kopf, das Vorladen nicht
const ausVorrat = async (anfrage) =>
  (await caches.match(anfrage, { ignoreVary: true })) ?? (anfrage.mode === 'navigate' ? await caches.match('./', { ignoreVary: true }) : undefined)

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
