import { useCallback, useEffect, useRef, useState } from 'react'

// Nur ein Fenster schreibt. Jedes Fenster hält den ganzen Datenstand und schreibt ihn komplett zurück;
// zwei schreibende Fenster würden sich gegenseitig überschreiben. Das Schreibrecht ist eine Sperre des
// Browsers (Web Locks). Wer es nicht hat, schreibt nie und steht in der Schlange; schließt das schreibende
// Fenster, rückt das nächste nach und lädt den gespeicherten Stand.
// „Hier weiterarbeiten“: Das schreibende Fenster speichert, hört auf zu schreiben und meldet „abgegeben“;
// dann nimmt das bittende Fenster die Sperre (steal). Kommt keiner, schreibt das erste weiter.

const SPERRE = 'bibliographie-schreibrecht'
const KANAL = 'bibliographie-schreibrecht'
/** So lange wartet ein abgebendes Fenster auf die Übernahme */
const UEBERGABE = 3000

export type Schreibrecht = 'pruefen' | 'ja' | 'nein'

/**
 * @param speichern schreibt den aktuellen Stand sofort, bevor das Schreibrecht abgegeben wird
 * @param neuLaden holt den Stand aus dem Speicher, wenn das Schreibrecht hierher wechselt
 */
export function useSchreibrecht(speichern: () => void, neuLaden: () => void): { recht: Schreibrecht; uebernehmen: () => void } {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  const [recht, setRecht] = useState<Schreibrecht>(locks ? 'pruefen' : 'ja')
  const rueckruf = useRef({ speichern, neuLaden })
  rueckruf.current = { speichern, neuLaden }
  // generation: zählt jeden Erwerb; nur das Ende des aktuellen Haltens zählt
  const z = useRef({
    generation: 0,
    halte: false,
    loslassen: null as (() => void) | null,
    schlange: null as AbortController | null,
    kanal: null as BroadcastChannel | null,
  }).current

  /** Sperre anfragen und halten, bis sie weggenommen wird oder das Fenster schließt. */
  const erwerben = useCallback(
    (optionen: LockOptions, zuvorLesend: boolean): Promise<boolean> => {
      if (!locks) return Promise.resolve(false)
      let meine = 0
      return locks
        .request(SPERRE, optionen, (sperre) => {
          if (!sperre) return null
          meine = ++z.generation
          z.halte = true
          if (zuvorLesend) rueckruf.current.neuLaden()
          setRecht('ja')
          // Gehalten bis steal, Schließen des Fensters oder Abbau der Komponente
          return new Promise<void>((fertig) => {
            z.loslassen = fertig
          })
        })
        .catch(() => {})
        .then(() => {
          if (meine && z.generation === meine) {
            // Weggenommen: lesend weiter, wieder anstellen
            z.halte = false
            setRecht('nein')
            anstellenRef.current()
          }
          return meine > 0
        })
    },
    [locks, z],
  )

  const anstellenRef = useRef(() => {})
  anstellenRef.current = () => {
    if (!locks || z.schlange || z.halte) return
    const abbruch = new AbortController()
    z.schlange = abbruch
    erwerben({ signal: abbruch.signal }, true).finally(() => {
      if (z.schlange === abbruch) z.schlange = null
    })
  }

  useEffect(() => {
    if (!locks) return
    const k = new BroadcastChannel(KANAL)
    z.kanal = k
    let weiter: ReturnType<typeof setTimeout> | undefined
    k.onmessage = (e) => {
      if (e.data !== 'gib-ab' || !z.halte) return
      rueckruf.current.speichern()
      setRecht('nein')
      const g = z.generation
      k.postMessage('abgegeben')
      // Übernimmt niemand, bleibt das Schreibrecht hier
      weiter = setTimeout(() => z.halte && z.generation === g && setRecht('ja'), UEBERGABE)
    }
    let aktiv = true
    // Beim Start: frei → schreiben; sonst lesend in die Schlange
    erwerben({ ifAvailable: true }, false).then((ok) => {
      if (ok || !aktiv) return
      setRecht('nein')
      anstellenRef.current()
    })
    return () => {
      aktiv = false
      clearTimeout(weiter)
      k.close()
      // Abbau: Sperre freigeben, ohne dass das als „weggenommen“ zählt
      z.generation++
      z.halte = false
      z.loslassen?.()
      z.loslassen = null
      z.schlange?.abort()
      z.schlange = null
    }
  }, [locks, erwerben, z])

  /** Das schreibende Fenster bitten, zu speichern und abzugeben; dann übernehmen. */
  const uebernehmen = useCallback(() => {
    const k = z.kanal
    if (!locks || !k || z.halte) return
    let erledigt = false
    const weiter = () => {
      if (erledigt) return
      erledigt = true
      clearTimeout(t)
      k.removeEventListener('message', antwort)
      z.schlange?.abort()
      z.schlange = null
      erwerben({ steal: true }, true)
    }
    const antwort = (e: MessageEvent) => e.data === 'abgegeben' && weiter()
    // Antwortet niemand, ist das andere Fenster weg oder hängt: dann trotzdem übernehmen
    const t = setTimeout(weiter, 1500)
    k.addEventListener('message', antwort)
    k.postMessage('gib-ab')
  }, [locks, erwerben, z])

  return { recht, uebernehmen }
}
