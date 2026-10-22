import { useCallback, useEffect, useRef, useState } from 'react'
import { schalteScharf, verbinde } from './aktualisierung'

// Die Sitzung entscheidet allein über Schreibrecht, Speichern und Versionswechsel. Eine Regel:
// Nur der aktuelle Schreiber darf einen Versionswechsel auslösen, und nur nach erfolgreichem Speichern;
// ab dann ist das Fenster eingefroren, bis es neu lädt. Ohne erfolgreiches Speichern wartet die neue Version.
// Fenster ohne Schreibrecht laden bei einem Wechsel einfach neu; sie haben nichts zu speichern.
//
// Nur ein Fenster schreibt. Jedes Fenster hält den ganzen Datenstand und schreibt ihn komplett zurück;
// zwei schreibende Fenster würden sich gegenseitig überschreiben. Das Schreibrecht ist eine Sperre des
// Browsers (Web Locks). Wer es nicht hat, schreibt nie und steht in der Schlange; schließt das schreibende
// Fenster, rückt das nächste nach. Wer das Schreibrecht bekommt, lädt immer zuerst den gespeicherten Stand,
// auch beim ersten Erwerb: was beim Öffnen gelesen wurde, kann inzwischen überholt sein.
// Lässt sich der Stand nicht laden, gibt das Fenster die Sperre zurück und stellt sich nicht wieder an.
// „Hier weiterarbeiten“: Das schreibende Fenster hört auf zu schreiben, meldet „speichert“, speichert und meldet „abgegeben“;
// dann nimmt das bittende Fenster die Sperre (steal). Kommt keiner, schreibt das erste weiter.
// Gelingt das Speichern nicht (Speicher voll), meldet es „verweigert“ und schreibt weiter. Antwortet das
// schreibende Fenster gar nicht, wird nur übernommen, wenn die Sperre wirklich frei ist.

const SPERRE = 'bibliographie-schreibrecht'
const KANAL = 'bibliographie-schreibrecht'
/** So lange wartet ein abgebendes Fenster auf die Übernahme */
const UEBERGABE = 3000
/** So lange wartet ein bittendes Fenster auf eine erste Antwort */
const ANTWORT = 1500
/** So lange wartet es, wenn das schreibende Fenster gerade speichert (große Karteien) */
const SPEICHERN = 30_000

export type Schreibrecht = 'pruefen' | 'ja' | 'nein'

/** Warum eine Übernahme nicht geklappt hat */
export type Absage = '' | 'verweigert' | 'antwortet-nicht'

/** Ergebnis eines Versuchs, die neue Version zu übernehmen */
export type Wechsel = 'laeuft' | 'nicht-gespeichert' | 'nicht-erlaubt'

export interface Sitzung {
  recht: Schreibrecht
  /** Versionswechsel freigegeben, Fenster eingefroren bis zum Neuladen */
  wechselt: boolean
  /** Eine neue Version wartet */
  neueVersion: boolean
  /** Ein Wechsel ist am Speichern gescheitert; die neue Version wartet weiter */
  nichtGespeichert: boolean
  absage: Absage
  uebernehmen: () => void
  aktualisieren: () => Promise<Wechsel>
}

/** So lange nach dem Öffnen darf eine „beim Start“ gemeldete Version noch von selbst übernehmen */
const STARTFENSTER = 10_000

/**
 * @param speichern schreibt den aktuellen Stand sofort; falsch, wenn das nicht gelingt
 * @param neuLaden holt den Stand aus dem Speicher, wenn das Schreibrecht hierher kommt; wirft, wenn das nicht geht
 */
export function useSitzung(speichern: () => Promise<boolean>, neuLaden: () => Promise<void>): Sitzung {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
  const [recht, setRechtZustand] = useState<Schreibrecht>(locks ? 'pruefen' : 'ja')
  const [absage, setAbsage] = useState<Absage>('')
  const [wechselt, setWechselt] = useState(false)
  const [neueVersion, setNeueVersion] = useState(false)
  const [nichtGespeichert, setNichtGespeichert] = useState(false)
  const rueckruf = useRef({ speichern, neuLaden })
  rueckruf.current = { speichern, neuLaden }
  // generation: zählt jeden Erwerb; nur das Ende des aktuellen Haltens zählt
  const z = useRef({
    /** Spiegel des Zustands für Entscheidungen im selben Augenblick */
    recht: (locks ? 'pruefen' : 'ja') as Schreibrecht,
    wechselt: false,
    startWunschBis: 0,
    generation: 0,
    /** Zählt jeden Abbau der Komponente; eine Sperre, die erst danach bewilligt wird, gehört niemandem mehr */
    abbau: 0,
    halte: false,
    /** Gibt gerade ab und speichert dafür */
    gibtAb: false,
    /** Hat abgegeben und wartet auf die Übernahme */
    abgegeben: false,
    /** Laden beim Erwerb gescheitert: nicht wieder anstellen */
    kaputt: false,
    loslassen: null as (() => void) | null,
    schlange: null as AbortController | null,
    kanal: null as BroadcastChannel | null,
  }).current

  const setRecht = useCallback(
    (r: Schreibrecht) => {
      z.recht = r
      setRechtZustand(r)
    },
    [z],
  )

  /** Neue Version übernehmen: nur als Schreiber, nur nach erfolgreichem Speichern; danach eingefroren. */
  const aktualisieren = useCallback(async (): Promise<Wechsel> => {
    if (z.recht !== 'ja' || z.wechselt) return 'nicht-erlaubt'
    z.wechselt = true
    setWechselt(true)
    if (!(await rueckruf.current.speichern())) {
      z.wechselt = false
      setWechselt(false)
      setNichtGespeichert(true)
      return 'nicht-gespeichert'
    }
    setNichtGespeichert(false)
    if (!schalteScharf()) {
      z.wechselt = false
      setWechselt(false)
      return 'nicht-erlaubt'
    }
    return 'laeuft'
  }, [z])

  /** Beim Start gemeldete Version übernimmt von selbst, sobald dieses Fenster schreibt. */
  const startVersuchen = useCallback(() => {
    if (Date.now() < z.startWunschBis && z.recht === 'ja') {
      z.startWunschBis = 0
      aktualisieren()
    }
  }, [z, aktualisieren])

  useEffect(
    () =>
      verbinde({
        neueVersion: (beimStart) => {
          setNeueVersion(true)
          if (beimStart) {
            z.startWunschBis = Date.now() + STARTFENSTER
            startVersuchen()
          }
        },
        uebernommen: async () => {
          // Selbst freigegeben oder ohne Schreibrecht: nichts zu verlieren
          if (z.wechselt || z.recht !== 'ja') return location.reload()
          // Unerwartet als Schreiber: nur neu laden, wenn gespeichert ist
          z.wechselt = true
          setWechselt(true)
          if (await rueckruf.current.speichern()) return location.reload()
          z.wechselt = false
          setWechselt(false)
          setNichtGespeichert(true)
        },
      }),
    [z, startVersuchen],
  )

  useEffect(() => {
    if (recht === 'ja') startVersuchen()
  }, [recht, startVersuchen])

  /** Sperre anfragen und halten, bis sie weggenommen wird oder das Fenster schließt. */
  const erwerben = useCallback(
    (optionen: LockOptions): Promise<boolean> => {
      if (!locks) return Promise.resolve(false)
      let meine = 0
      const aufbau = z.abbau
      return locks
        .request(SPERRE, optionen, async (sperre) => {
          if (!sperre) return null
          // Erst nach dem Abbau bewilligt (etwa beim doppelten Start im Entwicklungsmodus): sofort zurückgeben
          if (z.abbau !== aufbau) return null
          // Bewilligt: dieses Fenster wartet nicht mehr in der Schlange
          z.schlange = null
          meine = ++z.generation
          z.halte = true
          try {
            await rueckruf.current.neuLaden()
          } catch {
            z.kaputt = true
            return
          }
          // Während des Ladens abgebaut oder weggenommen: nicht mehr schreiben
          if (z.generation !== meine || !z.halte) return
          z.abgegeben = false
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
            z.abgegeben = false
            setRecht('nein')
            if (!z.kaputt) anstellenRef.current()
          }
          return meine > 0
        })
    },
    [locks, z, setRecht],
  )

  const anstellenRef = useRef(() => {})
  anstellenRef.current = () => {
    if (!locks || z.schlange || z.halte) return
    const abbruch = new AbortController()
    z.schlange = abbruch
    erwerben({ signal: abbruch.signal }).finally(() => {
      if (z.schlange === abbruch) z.schlange = null
    })
  }

  useEffect(() => {
    if (!locks) return
    const k = new BroadcastChannel(KANAL)
    z.kanal = k
    let weiter: ReturnType<typeof setTimeout> | undefined
    k.onmessage = async (e) => {
      if (e.data !== 'gib-ab' || !z.halte) return
      // Schon dabei: die Antwort geht an alle bittenden Fenster
      if (z.gibtAb) return k.postMessage('speichert')
      if (z.abgegeben) return k.postMessage('abgegeben')
      // Lädt noch: was hier im Speicher steht, ist nicht der gespeicherte Stand; nichts davon abgeben
      if (z.recht !== 'ja') return
      // Während eines Versionswechsels nicht abgeben
      if (z.wechselt) return k.postMessage('verweigert')
      // Erst aufhören zu schreiben, dann speichern: nur abgeben, was sicher gespeichert ist
      const g = z.generation
      z.gibtAb = true
      setRecht('nein')
      k.postMessage('speichert')
      const ok = await rueckruf.current.speichern()
      z.gibtAb = false
      // Inzwischen abgebaut oder weggenommen
      if (!z.halte || z.generation !== g) return
      if (!ok) {
        setRecht('ja')
        k.postMessage('verweigert')
        return
      }
      z.abgegeben = true
      k.postMessage('abgegeben')
      // Übernimmt niemand, bleibt das Schreibrecht hier
      weiter = setTimeout(() => {
        if (!z.halte || z.generation !== g) return
        z.abgegeben = false
        setRecht('ja')
      }, UEBERGABE)
    }
    let aktiv = true
    // Beim Start: frei → schreiben; sonst lesend in die Schlange
    erwerben({ ifAvailable: true }).then((ok) => {
      if (ok || !aktiv) return
      setRecht('nein')
      anstellenRef.current()
    })
    return () => {
      aktiv = false
      clearTimeout(weiter)
      k.close()
      // Abbau: Sperre freigeben, ohne dass das als „weggenommen“ zählt
      z.abbau++
      z.generation++
      z.halte = false
      z.gibtAb = false
      z.loslassen?.()
      z.loslassen = null
      z.schlange?.abort()
      z.schlange = null
    }
  }, [locks, erwerben, z, setRecht])

  /** Das schreibende Fenster bitten, zu speichern und abzugeben; dann übernehmen. */
  const uebernehmen = useCallback(() => {
    const k = z.kanal
    if (!locks || !k || z.halte) return
    setAbsage('')
    let erledigt = false
    const ende = () => {
      if (erledigt) return false
      erledigt = true
      clearTimeout(t)
      k.removeEventListener('message', antwort)
      return true
    }
    const nehmen = (optionen: LockOptions) => {
      z.schlange?.abort()
      z.schlange = null
      erwerben(optionen).then((ok) => ok || anstellenRef.current())
    }
    // Antwortet niemand: nur übernehmen, wenn die Sperre wirklich frei ist
    const keineAntwort = async () => {
      if (!ende()) return
      const stand = await locks.query()
      if (stand.held?.some((s) => s.name === SPERRE)) setAbsage('antwortet-nicht')
      else nehmen({ ifAvailable: true })
    }
    let t = setTimeout(keineAntwort, ANTWORT)
    const antwort = (e: MessageEvent) => {
      if (e.data === 'speichert' && !erledigt) {
        clearTimeout(t)
        t = setTimeout(keineAntwort, SPEICHERN)
      }
      if (e.data === 'abgegeben' && ende()) nehmen({ steal: true })
      if (e.data === 'verweigert' && ende()) setAbsage('verweigert')
    }
    k.addEventListener('message', antwort)
    k.postMessage('gib-ab')
  }, [locks, erwerben, z])

  return { recht, wechselt, neueVersion, nichtGespeichert, absage, uebernehmen, aktualisieren }
}
