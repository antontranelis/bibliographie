// Neue Versionen: der Service Worker lädt sie im Hintergrund und lässt sie warten. Scharf geschaltet wird
// beim Start, wenn kein anderer Tab der App offen ist, sonst über den Knopf „Jetzt aktualisieren“.
// Dann laden alle Tabs neu; ihre Daten speichert die App beim Verlassen der Seite.

/** So lange nach dem Öffnen gilt eine fertige neue Version als „beim Start“ */
const STARTFENSTER = 10_000
const STUENDLICH = 60 * 60 * 1000

let wartend: ServiceWorker | null = null
/** Kennung dieses Tabs: Kanal-Nachrichten erreichen auch andere Kanal-Objekte im selben Tab */
const TAB = Math.random().toString(36).slice(2)

let vorher: () => boolean = () => true

/** Wird vor dem Scharfschalten aufgerufen; falsch, wenn nicht sicher gespeichert ist. */
export function vorDemAktualisieren(f: () => boolean): void {
  vorher = f
}

/** Neue Version scharf schalten, aber nur nach erfolgreichem Speichern; alle Tabs laden daraufhin neu. */
export function jetztAktualisieren(): boolean {
  if (!wartend) return false
  if (!vorher()) {
    window.dispatchEvent(new Event('aktualisierung-gestoppt'))
    return false
  }
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

  // Übernimmt eine neue Version, laden alle Tabs neu. Die erste Übernahme beim ersten Besuch ist keine.
  let gesteuert = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (gesteuert) location.reload()
    gesteuert = true
  })

  const bereit = async (w: ServiceWorker) => {
    if (!navigator.serviceWorker.controller) return
    wartend = w
    const beimStart = Date.now() - geoeffnet < STARTFENSTER && !(await andereTabs())
    if (!beimStart || !jetztAktualisieren()) window.dispatchEvent(new Event('neue-version'))
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
