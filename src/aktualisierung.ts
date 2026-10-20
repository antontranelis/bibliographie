// Neue Versionen: der Service Worker lädt sie im Hintergrund und lässt sie warten. Dieses Modul meldet nur,
// was geschieht (neue Version bereit, Version übernommen). Ob und wann scharf geschaltet wird, entscheidet
// allein die Sitzung (sitzung.ts): nur der Schreiber, nur nach erfolgreichem Speichern.

/** So lange nach dem Öffnen gilt eine fertige neue Version als „beim Start“ */
const STARTFENSTER = 10_000
const STUENDLICH = 60 * 60 * 1000

export interface Hoerer {
  /** Eine neue Version wartet. beimStart: kurz nach dem Öffnen und kein anderer Tab der App offen. */
  neueVersion: (beimStart: boolean) => void
  /** Eine neue Version hat übernommen; die laufende Seite ist veraltet. */
  uebernommen: () => void
}

let wartend: ServiceWorker | null = null
let gemeldet: boolean | null = null
let hoerer: Hoerer | null = null
/** Kennung dieses Tabs: Kanal-Nachrichten erreichen auch andere Kanal-Objekte im selben Tab */
const TAB = Math.random().toString(36).slice(2)

/** Die Sitzung meldet sich an; eine schon gemeldete neue Version wird nachgereicht. */
export function verbinde(h: Hoerer): () => void {
  hoerer = h
  if (gemeldet !== null) h.neueVersion(gemeldet)
  return () => {
    if (hoerer === h) hoerer = null
  }
}

/** Nur für die Sitzung: die wartende Version übernehmen lassen. */
export function schalteScharf(): boolean {
  if (!wartend) return false
  wartend.postMessage('aktivieren')
  return true
}

/** Andere offene Tabs der App, gefragt über einen gemeinsamen Kanal. */
function andereTabs(): Promise<boolean> {
  if (!('BroadcastChannel' in window)) return Promise.resolve(true)
  return new Promise((fertig) => {
    const kanal = new BroadcastChannel('bibliographie-tabs')
    const t = setTimeout(() => {
      kanal.close()
      fertig(false)
    }, 300)
    kanal.onmessage = (e) => {
      if (e.data?.hier === undefined || e.data.hier === TAB || e.data.an !== TAB) return
      clearTimeout(t)
      kanal.close()
      fertig(true)
    }
    kanal.postMessage({ frage: TAB })
  })
}

export function starteAktualisierung(): void {
  if (!('serviceWorker' in navigator)) return
  const geoeffnet = Date.now()

  // Auf die Frage anderer Tabs antworten
  if ('BroadcastChannel' in window) {
    const kanal = new BroadcastChannel('bibliographie-tabs')
    kanal.onmessage = (e) => {
      if (e.data?.frage && e.data.frage !== TAB) kanal.postMessage({ hier: TAB, an: e.data.frage })
    }
  }

  // Die erste Übernahme beim ersten Besuch ist keine neue Version
  let gesteuert = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (gesteuert) (hoerer ? hoerer.uebernommen : () => location.reload())()
    gesteuert = true
  })

  const bereit = async (w: ServiceWorker) => {
    if (!navigator.serviceWorker.controller) return
    wartend = w
    const beimStart = Date.now() - geoeffnet < STARTFENSTER && !(await andereTabs())
    gemeldet = beimStart
    hoerer?.neueVersion(beimStart)
  }

  window.addEventListener('load', async () => {
    navigator.storage?.persist?.().catch(() => {})
    const reg = await navigator.serviceWorker.register('./sw.js').catch(() => null)
    if (!reg) return
    if (reg.waiting) bereit(reg.waiting)
    reg.addEventListener('updatefound', () => {
      const neu = reg.installing
      neu?.addEventListener('statechange', () => neu.state === 'installed' && bereit(neu))
    })
    const pruefen = () => reg.update().catch(() => {})
    setInterval(pruefen, STUENDLICH)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && pruefen())
  })
}
