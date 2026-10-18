import { leereAuflage, leeresErschienenIn, leeresWerk, type Person, type Werk } from '../model'
import { druckzeileTeile, STANDARD_STIL, type Stil, type Teil } from '../format'
import type { Lauf } from './odt'

// Macht aus einem Listeneintrag eine Karte. Was sich nicht sicher zerlegen lässt, bleibt als Originalzeile erhalten.

/** Hinterlegung, mit der Jens Göken Kommentare an den Leser markiert */
export const KOMMENTARFARBE = '#ff00ff'

export type ImportStatus = 'erkannt' | 'kette' | 'unklar'

export interface ImportErgebnis {
  status: ImportStatus
  werk?: Werk
  /** Eintrag ohne Kommentare, als reiner Text */
  original: string
  /** Kommentar an den Leser, abgetrennt */
  hinweis: string
  grund?: string
}

interface Zeichen {
  text: string
  /** je Zeichen: fett, kursiv */
  fett: boolean[]
  kursiv: boolean[]
}

function zeile(laeufe: Lauf[]): Zeichen {
  const z: Zeichen = { text: '', fett: [], kursiv: [] }
  for (const l of laeufe) {
    const t = l.text.replace(/ /g, ' ')
    z.text += t
    for (let i = 0; i < t.length; i++) {
      z.fett.push(l.fett)
      z.kursiv.push(l.kursiv)
    }
  }
  return z
}

function teilZeile(z: Zeichen, von: number, bis = z.text.length): Zeichen {
  return { text: z.text.slice(von, bis), fett: z.fett.slice(von, bis), kursiv: z.kursiv.slice(von, bis) }
}

/** Auszeichnung zählt nur an Zeichen, die keine Leer- oder Satzzeichen sind. */
const ausgezeichnet = (z: Zeichen, von = 0, bis = z.text.length) => {
  for (let i = von; i < bis; i++) if ((z.fett[i] || z.kursiv[i]) && /[\p{L}\p{N}]/u.test(z.text[i])) return true
  return false
}

const PARTIKEL = new Set(['von', 'van', 'de', 'du', 'der', 'den', 'la', 'le', 'di', 'da', 'del', 'ten', 'ter', 'zu', 'v.', 'vom', 'zur'])

/** „Orrin E. Dunlop, Jr.“ → Vorname „Orrin E.“, Nachname „Dunlop, Jr.“; Partikel gehören zum Nachnamen. */
export function zerlegeName(name: string): { vorname: string; nachname: string } {
  const [kern, ...zusatz] = name.split(/, (?=(?:Jr|Sr|jr|sr)\.?$)/)
  const woerter = kern.trim().split(/\s+/)
  if (woerter.length === 1) return { vorname: '', nachname: [kern.trim(), ...zusatz].join(', ') }
  let i = woerter.length - 1
  while (i > 1 && PARTIKEL.has(woerter[i - 1])) i--
  if (i === 1 && PARTIKEL.has(woerter[0])) i = 0
  return { vorname: woerter.slice(0, i).join(' '), nachname: [woerter.slice(i).join(' '), ...zusatz].join(', ') }
}

function zerlegePersonen(text: string): Person[] | null {
  let t = text.trim()
  if (!t) return []
  if (/[[\]]/.test(t)) return null
  let rolle: Person['rolle'] = 'autor'
  if (/ \(Hrsg\.\)$/.test(t)) {
    rolle = 'hrsg'
    t = t.replace(/ \(Hrsg\.\)$/, '')
  }
  if (/[()]/.test(t)) return null
  return t.split('/').map((n) => ({ ...zerlegeName(n), rolle }))
}

/** Kette weiterer Ausgaben: ein Semikolon außerhalb von Klammern. */
function hatKette(text: string): boolean {
  let tiefe = 0
  for (const c of text) {
    if (c === '(') tiefe++
    else if (c === ')') tiefe--
    else if (c === ';' && tiefe === 0) return true
  }
  return false
}

/** Aufrechte Stellen in der kursiven Anmerkung werden zu *…*. */
function anmerkungText(z: Zeichen): string {
  let text = ''
  let i = 0
  while (i < z.text.length) {
    let j = i
    while (j < z.text.length && z.kursiv[j] === z.kursiv[i]) j++
    const stueck = z.text.slice(i, j)
    if (z.kursiv[i] || !/[\p{L}\p{N}]/u.test(stueck)) text += stueck
    else {
      const kern = stueck.trim()
      const vorn = stueck.slice(0, stueck.indexOf(kern))
      text += `${vorn}*${kern}*${stueck.slice(vorn.length + kern.length)}`
    }
    i = j
  }
  return text
}

const JAHR = /\b(1[4-9]\d\d|20\d\d)\b/g

export function zerlegeEintrag(laeufe: Lauf[]): ImportErgebnis {
  const hinweis = laeufe
    .filter((l) => l.hinterlegt === KOMMENTARFARBE)
    .map((l) => l.text)
    .join('')
    .trim()
  let z = zeile(laeufe.filter((l) => l.hinterlegt !== KOMMENTARFARBE))
  // Leerzeichen am Rand entfernen
  const links = z.text.length - z.text.trimStart().length
  z = teilZeile(z, links, links + z.text.trim().length)
  const original = z.text
  const unklar = (grund: string): ImportErgebnis => ({ status: 'unklar', original, hinweis, grund })

  // Anmerkung am Ende: „(Anm.: …)“
  let anmerkung = ''
  const anm = z.text.match(/ \(Anm\.: (.*)\)$/s)
  if (anm && anm.index !== undefined) {
    const start = anm.index + ' (Anm.: '.length
    anmerkung = anmerkungText(teilZeile(z, start, start + anm[1].length)).trim()
    z = teilZeile(z, 0, anm.index)
  }

  const ersterFett = z.fett.findIndex((f, i) => f && /[\p{L}\p{N}]/u.test(z.text[i]))
  if (ersterFett < 0) return unklar('kein fetter Titel')
  const vorTitel = z.text.slice(0, ersterFett)
  if (ausgezeichnet(z, 0, ersterFett)) return unklar('Auszeichnung vor dem Titel')
  let personenText = ''
  if (vorTitel) {
    const m = vorTitel.match(/^(.+): $/s)
    if (!m) return unklar('Personen nicht erkennbar')
    personenText = m[1]
  }
  const personen = zerlegePersonen(personenText)
  if (!personen) return unklar('Personen mit Zusätzen')

  // Titel: zusammenhängend fett, Leerzeichen und Satzzeichen dazwischen erlaubt
  let titelEnde = ersterFett
  for (let i = ersterFett; i < z.text.length; i++) {
    if (z.fett[i]) titelEnde = i + 1
    else if (!/[\s.,:;!?–-]/.test(z.text[i])) break
  }
  const titel = z.text.slice(ersterFett, titelEnde).trim()
  const rest = teilZeile(z, titelEnde)

  if (hatKette(rest.text)) return { status: 'kette', original, hinweis, grund: 'weitere Ausgaben' }

  const werk: Werk = { ...leeresWerk(), personen: personen.length ? personen : leeresWerk().personen, titel, anmerkung }

  // Beitrag: „. Untertitel (in: Zeitschrift …)“
  const beitrag = rest.text.match(/^(?:\. (.*?))? \(in: (.*)\)$/s)
  if (beitrag) {
    const untertitel = (beitrag[1] ?? '').trim()
    const innenStart = rest.text.length - 1 - beitrag[2].length
    if (ausgezeichnet(rest, 0, innenStart - 5)) return unklar('Auszeichnung im Untertitel')
    const innen = teilZeile(rest, innenStart, rest.text.length - 1)
    const kursivStart = innen.kursiv.findIndex((k) => k)
    const fettStart = innen.fett.findIndex((f) => f)
    const start = [kursivStart, fettStart].filter((x) => x >= 0).sort((a, b) => a - b)[0]
    if (start !== 0) return unklar('Zeitschrift oder Sammelband nicht ausgezeichnet')
    const sammelband = fettStart === 0
    const art = sammelband ? innen.fett : innen.kursiv
    let ende = 0
    while (ende < innen.text.length && art[ende]) ende++
    const quelle = innen.text.slice(0, ende).trim()
    let weiter = innen.text.slice(ende)
    if (ausgezeichnet(innen, ende)) return unklar('weitere Auszeichnung im Beitrag')
    let seitenVon = ''
    let seitenBis = ''
    const s = weiter.match(/, S\. ([^,]+)$/)
    if (s && s.index !== undefined) {
      // Ein Bereich wird zerlegt, mehrere Bereiche bleiben wie gedruckt
      const bereiche = s[1].split('–')
      if (bereiche.length === 2 && !s[1].includes('/')) [seitenVon, seitenBis] = bereiche
      else seitenVon = s[1]
      weiter = weiter.slice(0, s.index)
    }
    const ausgabe = (weiter.startsWith(' ') ? weiter.slice(1) : weiter).trimEnd()
    const jahre = [...ausgabe.matchAll(JAHR)].map((m) => m[1])
    werk.art = 'aufsatz'
    werk.untertitel = untertitel
    werk.auflagen = []
    werk.erschienenIn = {
      ...leeresErschienenIn(),
      art: sammelband ? 'sammelband' : 'zeitschrift',
      titel: quelle,
      ausgabe,
      jahr: jahre.at(-1) ?? '',
      seitenVon: seitenVon.trim(),
      seitenBis: seitenBis.trim(),
    }
    return { status: 'erkannt', werk, original, hinweis }
  }

  // Buch: „. Untertitel, Ort Jahr“ oder „…, Ort, 2. Aufl. Jahr“
  if (ausgezeichnet(rest)) return unklar('Auszeichnung nach dem Titel')
  const buch = rest.text.match(/^(?:\. (.*?))?, ([^,]+?(?:, [A-Z]{2})?)(?:, (\d+)\. Aufl\.)? (1[4-9]\d\d|20\d\d)$/s)
  if (!buch) return unklar('Ort und Jahr nicht erkennbar')
  werk.untertitel = (buch[1] ?? '').trim()
  werk.auflagen = [{ ...leereAuflage(), ort: buch[2].trim(), nummer: buch[3] ?? '', jahr: buch[4] }]
  return { status: 'erkannt', werk, original, hinweis }
}

export type Rueckprobe = 'gleich' | 'text-gleich' | 'abweichend'

const normal = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Auszeichnung als Folge von Abschnitten (fett, kursiv) über Wortzeichen, damit Leerzeichen am Rand nicht zählen. */
function auszeichnungsMuster(stuecke: { text: string; fett: boolean; kursiv: boolean }[]): string {
  const muster: string[] = []
  for (const s of stuecke) {
    const w = s.text.replace(/[^\p{L}\p{N}]/gu, '')
    if (!w) continue
    const k = `${s.fett ? 'F' : ''}${s.kursiv ? 'K' : ''}`
    const letzter = muster[muster.length - 1]
    if (letzter && letzter.startsWith(`${k}:`)) muster[muster.length - 1] += w
    else muster.push(`${k}:${w}`)
  }
  return muster.join('|')
}

/** Vergleicht die Druckzeile einer Karte mit dem Originaleintrag: Text und Auszeichnung. */
export function rueckprobe(werk: Werk, laeufe: Lauf[], stil: Stil = STANDARD_STIL): { ergebnis: Rueckprobe; gedruckt: string } {
  const teile: Teil[] = druckzeileTeile(werk, stil)
  const ohneKommentar = laeufe.filter((l) => l.hinterlegt !== KOMMENTARFARBE)
  const gedruckt = teile.map((t) => t.text).join('')
  const original = ohneKommentar.map((l) => l.text).join('').replace(/ /g, ' ')
  if (normal(gedruckt) !== normal(original)) return { ergebnis: 'abweichend', gedruckt }
  const a = auszeichnungsMuster(teile.map((t) => ({ text: t.text, fett: Boolean(t.auszeichnung), kursiv: Boolean(t.kursiv) })))
  const b = auszeichnungsMuster(ohneKommentar)
  return { ergebnis: a === b ? 'gleich' : 'text-gleich', gedruckt }
}
