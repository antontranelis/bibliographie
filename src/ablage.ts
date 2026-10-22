import type { Datenstamm, Werk } from './model'
import { migriere } from './speicher'

// Der Datenbestand liegt in IndexedDB: dort ist Platz für zehntausende Karten, localStorage fasst nur etwa 5 MB.
// Die Karten liegen nach ihrer ID verteilt in FAECHER Datensätzen; gespeichert werden nur Fächer, in denen sich
// seit dem letzten Speichern etwas geändert hat. Die App ersetzt eine Karte bei jeder Änderung durch ein neues
// Objekt, deshalb genügt der Vergleich der Objekte. Einzelne Datensätze je Karte wären beim Einlesen großer
// Bestände viel zu langsam (20.000 Datensätze: über 15 s), ein einziger Datensatz für alles beim Tippen
// (jede Pause kopiert die ganze Kartei). Verlage, Listen, Themen und die Reihenfolge der Karten stehen zusammen
// in einem weiteren Datensatz.
// Bis zu dieser Fassung lag alles in localStorage; beim ersten Start zieht es um. Der alte Stand wird erst
// gelöscht, wenn er sicher in der Datenbank steht. Lässt sich IndexedDB beim Laden nicht öffnen (sehr alte oder
// gesperrte Browser), bleibt es für dieses Fenster bei localStorage.
// Ein Speichervorgang, der erst beim Verlassen der Seite beginnt, kommt nicht sicher an. Deshalb schreibt das
// Fenster beim Verbergen und Verlassen zusätzlich synchron einen Nachtrag in localStorage: was seit dem letzten
// abgeschlossenen Speichern fehlt, meist ein paar Karten. Der nächste Start spielt ihn ein; ein Speichern, das
// nach dem Nachtrag beginnt und gelingt, enthält ihn und löscht ihn. Fällt die Datenbank erst später aus,
// scheitert das Speichern sichtbar; still woandershin zu schreiben hieße, dass der nächste Start es nicht findet.

const DATENBANK = 'bibliographie'
const WERKE = 'werke'
const STAMM = 'stamm'
const REST = 'rest'
const ALT = 'bibliographie:datenstamm:v1'
const NACHTRAG = 'bibliographie:nachtrag'
/** Mehr geänderte Karten passen nicht sicher in localStorage */
const NACHTRAG_HOECHSTENS = 2000
const FAECHER = 256

const faecherVon = new Map<string, number>()
/** Fach einer Karte: aus der ID gestreut (FNV-1a), je ID nur einmal berechnet */
function fach(id: string): number {
  let f = faecherVon.get(id)
  if (f === undefined) {
    let h = 0x811c9dc5
    for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 0x01000193)
    f = (h >>> 0) % FAECHER
    faecherVon.set(id, f)
  }
  return f
}

interface Rest {
  verlage: Datenstamm['verlage']
  listen: Datenstamm['listen']
  themen: Datenstamm['themen']
  /** Reihenfolge der Karten */
  reihenfolge: string[]
}

interface Nachtrag {
  /** Geänderte und neue Karten */
  werke: Werk[]
  /** Gelöschte Karten */
  weg: string[]
  rest: Rest
}

interface Abbild {
  werke: Map<string, Werk>
  anzahl: number[]
  d: Datenstamm
}

/**
 * Grundlage für das nächste Speichern: der zuletzt abgeschickte Stand. Transaktionen laufen in der Reihenfolge,
 * in der sie abgeschickt werden; der nächste Vorgang schreibt also nur, was danach dazukam. Scheitert einer,
 * fehlt den später abgeschickten etwas: Sie gelten dann auch als gescheitert, und der nächste schreibt alles.
 */
let zuletzt: Abbild | null = null
/** Was sicher in der Datenbank steht; Grundlage für den Nachtrag. Null: unbekannt */
let gesichert: Abbild | null = null
/** Zählt geschriebene Nachträge */
let nachtragNr = 0
/** Zählt gescheiterte Speichervorgänge */
let gescheitert = 0

let verbindung: Promise<IDBDatabase | null> | null = null
/** Beim Laden ließ sich IndexedDB nicht öffnen */
let ohneDatenbank = false

function oeffne(): Promise<IDBDatabase | null> {
  verbindung ??= new Promise((fertig) => {
    try {
      const anfrage = indexedDB.open(DATENBANK, 1)
      anfrage.onupgradeneeded = () => {
        anfrage.result.createObjectStore(WERKE)
        anfrage.result.createObjectStore(STAMM)
      }
      anfrage.onsuccess = () => {
        const db = anfrage.result
        // Eine andere Fassung will die Datenbank umbauen: Platz machen, die Seite lädt dann ohnehin neu
        db.onversionchange = () => {
          db.close()
          verbindung = null
        }
        db.onclose = () => (verbindung = null)
        fertig(db)
      }
      // Ein anderes Fenster hält die Datenbank noch offen (etwa die eben verlassene Seite beim Neuladen):
      // es schließt sie, dann geht es weiter
      anfrage.onblocked = () => {}
      anfrage.onerror = () => {
        verbindung = null
        fertig(null)
      }
    } catch {
      verbindung = null
      fertig(null)
    }
  })
  return verbindung
}

const altLesen = (): Datenstamm | null => {
  try {
    const text = localStorage.getItem(ALT)
    return text ? (JSON.parse(text) as Datenstamm) : null
  } catch {
    return null
  }
}

/** Werke und Rest in einer Transaktion schreiben: was sich gegenüber `vorher` geändert hat, oder alles. */
function schreibe(t: IDBTransaction, d: Datenstamm, vorher: Abbild | null) {
  const werke = t.objectStore(WERKE)
  if (!vorher) werke.clear()
  const faecher: Werk[][] = Array.from({ length: FAECHER }, () => [])
  const geaendert = new Array<boolean>(FAECHER).fill(!vorher)
  for (const w of d.werke) {
    const f = fach(w.id)
    faecher[f].push(w)
    if (vorher?.werke.get(w.id) !== w) geaendert[f] = true
  }
  // Gleich viele Karten und keine neue: dann ist auch keine weggefallen
  for (let f = 0; f < FAECHER; f++) {
    if (!geaendert[f] && faecher[f].length === vorher!.anzahl[f]) continue
    if (faecher[f].length) werke.put(faecher[f], f)
    else if (vorher) werke.delete(f)
  }
  const v = vorher?.d
  if (!v || v.werke !== d.werke || v.verlage !== d.verlage || v.listen !== d.listen || v.themen !== d.themen) t.objectStore(STAMM).put(restVon(d), REST)
}

const restVon = (d: Datenstamm): Rest => ({ verlage: d.verlage, listen: d.listen, themen: d.themen, reihenfolge: d.werke.map((w) => w.id) })

function abbild(d: Datenstamm): Abbild {
  const anzahl = new Array<number>(FAECHER).fill(0)
  for (const w of d.werke) anzahl[fach(w.id)]++
  return { werke: new Map(d.werke.map((w) => [w.id, w])), anzahl, d }
}

/** Karten und Rest wieder zusammensetzen, in der gespeicherten Reihenfolge */
function zusammensetzen(alle: Iterable<Werk>, r: Rest): Datenstamm {
  const nachId = new Map([...alle].map((w) => [w.id, w]))
  const geordnet = r.reihenfolge.flatMap((id) => nachId.get(id) ?? [])
  // Karten, die in der Reihenfolge fehlen, kommen ans Ende statt verloren zu gehen
  const bekannt = new Set(r.reihenfolge)
  const uebrig = [...nachId.values()].filter((w) => !bekannt.has(w.id))
  return { werke: [...geordnet, ...uebrig], verlage: r.verlage, listen: r.listen, themen: r.themen }
}

function nachtragLesen(): Nachtrag | null {
  try {
    const text = localStorage.getItem(NACHTRAG)
    return text ? (JSON.parse(text) as Nachtrag) : null
  } catch {
    return null
  }
}

function nachtragAnwenden(d: Datenstamm | null, n: Nachtrag): Datenstamm {
  const werke = new Map((d?.werke ?? []).map((w) => [w.id, w]))
  for (const id of n.weg) werke.delete(id)
  for (const w of n.werke) werke.set(w.id, w)
  return zusammensetzen(werke.values(), n.rest)
}

/**
 * Beim Verbergen und Verlassen der Seite: synchron festhalten, was noch nicht sicher gespeichert ist.
 * Danach trotzdem `speichere` aufrufen; gelingt das, ist der Nachtrag überflüssig.
 */
export function sichereSofort(d: Datenstamm) {
  try {
    if (ohneDatenbank) {
      localStorage.setItem(ALT, JSON.stringify(d))
      return
    }
    const basis = gesichert
    if (basis?.d === d) return
    const werke = basis ? d.werke.filter((w) => basis.werke.get(w.id) !== w) : d.werke
    if (werke.length > NACHTRAG_HOECHSTENS) return
    const ids = new Set(d.werke.map((w) => w.id))
    const weg = basis ? [...basis.werke.keys()].filter((id) => !ids.has(id)) : []
    const n: Nachtrag = { werke, weg, rest: restVon(d) }
    localStorage.setItem(NACHTRAG, JSON.stringify(n))
    nachtragNr++
  } catch {
    /* zu groß: dann bleibt nur das Speichern */
  }
}

/**
 * Liest den gespeicherten Stand, null wenn noch nichts gespeichert ist. Steht nur ein alter Stand in localStorage,
 * kommt er in derselben Transaktion in die Datenbank, damit kein zweites Fenster dazwischen schreibt; ebenso ein
 * Nachtrag. Wirft, wenn die Datenbank da ist, sich aber nicht lesen lässt: Leer zu starten hieße, beim nächsten
 * Speichern alles zu überschreiben.
 */
export async function lade(): Promise<Datenstamm | null> {
  zuletzt = null
  gesichert = null
  const db = await oeffne()
  ohneDatenbank = !db
  if (!db) {
    const alt = altLesen()
    return alt && migriere(alt)
  }
  const { stand, sicher } = await new Promise<{ stand: Datenstamm | null; sicher: boolean }>((fertig, fehler) => {
    let stand: Datenstamm | null = null
    let umgezogen = false
    let nachgetragen = false
    try {
      const t = db.transaction([WERKE, STAMM], 'readwrite')
      const rest = t.objectStore(STAMM).get(REST)
      const werke = t.objectStore(WERKE).getAll()
      werke.onsuccess = () => {
        const r = rest.result as Rest | undefined
        if (r) stand = zusammensetzen((werke.result as Werk[][]).flat(), r)
        else {
          stand = altLesen()
          umgezogen = !!stand
        }
        const n = nachtragLesen()
        if (n) {
          stand = nachtragAnwenden(stand, n)
          nachgetragen = true
        }
        if (umgezogen || nachgetragen) schreibe(t, stand!, null)
      }
      t.oncomplete = () => {
        if (umgezogen) localStorage.removeItem(ALT)
        if (nachgetragen) localStorage.removeItem(NACHTRAG)
        fertig({ stand, sicher: true })
      }
      // Umzug oder Nachtrag nicht geschrieben (etwa Speicher voll): der Stand gilt als ungespeichert,
      // alte Quellen bleiben, das nächste Speichern schreibt alles
      t.onabort = () => (werke.readyState === 'done' && !werke.error ? fertig({ stand, sicher: false }) : fehler(t.error))
    } catch (e) {
      fehler(e)
    }
  })
  if (!stand) return null
  const d = migriere(stand)
  // Die Datenbank hält den Stand vor der Migration; die migrierten Karten gelten trotzdem als gespeichert,
  // sie werden bei jedem Laden gleich migriert
  if (sicher) {
    zuletzt = abbild(d)
    gesichert = zuletzt
  } else if (nachtragLesen()) nachtragNr++ // Das nächste gelungene Speichern enthält den Nachtrag und löscht ihn
  return d
}

/** Speichert den Stand. Falsch, wenn der Speicher voll oder gesperrt ist: dann bleibt nur die Exportdatei. */
export async function speichere(d: Datenstamm): Promise<boolean> {
  if (ohneDatenbank) {
    try {
      localStorage.setItem(ALT, JSON.stringify(d))
      return true
    } catch {
      return false
    }
  }
  const db = await oeffne()
  if (!db) return false
  const vorher = zuletzt
  const stand = gescheitert
  const nr = nachtragNr
  return new Promise((fertig) => {
    let t: IDBTransaction | undefined
    try {
      t = db.transaction([WERKE, STAMM], 'readwrite', { durability: 'strict' })
      const neu = abbild(d)
      t.oncomplete = () => {
        const ok = gescheitert === stand
        // Ein früherer Vorgang ist gescheitert: was jetzt in der Datenbank steht, ist unbekannt
        gesichert = ok ? neu : null
        // Begann nach dem letzten Nachtrag: enthält ihn
        if (ok && nr > 0 && nr === nachtragNr) localStorage.removeItem(NACHTRAG)
        fertig(ok)
      }
      t.onabort = () => {
        gescheitert++
        zuletzt = null
        fertig(false)
      }
      schreibe(t, d, vorher)
      zuletzt = neu
    } catch {
      gescheitert++
      zuletzt = null
      // Nichts halb schreiben
      try {
        t?.abort()
      } catch {
        /* schon beendet */
      }
      fertig(false)
    }
  })
}

/** Den Browser bitten, die Daten nicht bei Platzmangel von selbst zu löschen. */
export function bitteUmDauer() {
  navigator.storage?.persist?.().catch(() => {})
}
