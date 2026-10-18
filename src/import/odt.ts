import { unzipSync, strFromU8 } from 'fflate'

// Liest Literaturlisten aus OpenDocument-Text (.odt): Abschnittsüberschriften und Listeneinträge
// mit ihren Auszeichnungen. Fett = Werktitel, kursiv = Zeitschrift, Hintergrundfarben = Markierungen.

export interface Lauf {
  text: string
  fett: boolean
  kursiv: boolean
  /** Hintergrundfarbe, etwa „#ff00ff“ für Kommentare an den Leser */
  hinterlegt: string | null
}

export interface OdtEintrag {
  /** Laufende Nummer in der Datei */
  nummer: number
  /** Letzte Überschrift vor dem Eintrag */
  abschnitt: string
  laeufe: Lauf[]
}

interface Format {
  fett?: boolean
  kursiv?: boolean
  hinterlegt?: string | null
  eltern?: string
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1]

const BENANNT: Record<string, string> = { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }

/** XML-Entities und Zeichenreferenzen in einem Durchgang, damit nichts doppelt dekodiert wird. */
function dekodiere(s: string): string {
  return s.replace(/&(?:#x([\da-fA-F]+)|#(\d+)|(lt|gt|quot|apos|amp));/g, (_, hex?: string, dez?: string, name?: string) =>
    name ? BENANNT[name] : String.fromCodePoint(hex ? parseInt(hex, 16) : parseInt(dez!, 10)),
  )
}

/** Formatvorlagen aus content.xml und styles.xml: Name → Fett, Kursiv, Hintergrund. */
export function leseFormate(...xmls: string[]): Map<string, Format> {
  const formate = new Map<string, Format>()
  for (const xml of xmls) {
    for (const [, kopf, rumpf] of xml.matchAll(/<style:style\b([^>]*?)(?:\/>|>([\s\S]*?)<\/style:style>)/g)) {
      const name = attr(kopf, 'style:name')
      if (!name) continue
      const f: Format = { eltern: attr(kopf, 'style:parent-style-name') }
      const tp = rumpf?.match(/<style:text-properties\b([^>]*)\/?>/)?.[1]
      if (tp) {
        const gewicht = attr(tp, 'fo:font-weight')
        const stil = attr(tp, 'fo:font-style')
        const grund = attr(tp, 'fo:background-color')
        if (gewicht) f.fett = gewicht === 'bold' || parseInt(gewicht, 10) >= 600
        if (stil) f.kursiv = stil === 'italic' || stil === 'oblique'
        if (grund) f.hinterlegt = grund === 'transparent' ? null : grund
      }
      formate.set(name, f)
    }
  }
  return formate
}

function aufgeloest(formate: Map<string, Format>, name: string | undefined, tiefe = 0): Format {
  if (!name || tiefe > 10) return {}
  const f = formate.get(name)
  if (!f) return {}
  const e = aufgeloest(formate, f.eltern, tiefe + 1)
  return { fett: f.fett ?? e.fett, kursiv: f.kursiv ?? e.kursiv, hinterlegt: f.hinterlegt !== undefined ? f.hinterlegt : e.hinterlegt }
}

/** Zerlegt content.xml in Abschnitte und Listeneinträge. */
export function leseInhalt(content: string, formate: Map<string, Format>): OdtEintrag[] {
  const koerper = content.match(/<office:text\b[^>]*>([\s\S]*)<\/office:text>/)?.[1] ?? content
  const eintraege: OdtEintrag[] = []
  const stapel: Format[] = []
  let abschnitt = ''
  let ueberschrift: string | null = null
  let aktuell: Lauf[] | null = null
  let listenTiefe = 0
  let nummer = 0

  const format = (): Required<Omit<Format, 'eltern'>> => {
    let f = { fett: false, kursiv: false, hinterlegt: null as string | null }
    for (const s of stapel) f = { fett: s.fett ?? f.fett, kursiv: s.kursiv ?? f.kursiv, hinterlegt: s.hinterlegt !== undefined ? s.hinterlegt : f.hinterlegt }
    return f
  }
  const schreibe = (text: string) => {
    if (!text) return
    if (ueberschrift !== null) ueberschrift += text
    else if (aktuell) {
      const f = format()
      const letzter = aktuell[aktuell.length - 1]
      if (letzter && letzter.fett === f.fett && letzter.kursiv === f.kursiv && letzter.hinterlegt === f.hinterlegt) letzter.text += text
      else aktuell.push({ text, ...f })
    }
  }

  for (const [, schliessend, tag, rest, selbst, text] of koerper.matchAll(/<(\/?)([\w:-]+)([^>]*?)(\/?)>|([^<]+)/g)) {
    if (text !== undefined) {
      schreibe(dekodiere(text))
      continue
    }
    const offen = !schliessend
    if (tag === 'text:list') listenTiefe += offen && !selbst ? 1 : schliessend ? -1 : 0
    // Überschrift-Absätze innerhalb eines Listeneintrags sind Einträge, keine Kapitel
    if (tag === 'text:h' && !aktuell) {
      if (offen && !selbst) ueberschrift = ''
      else if (schliessend) {
        abschnitt = (ueberschrift ?? '').trim() || abschnitt
        ueberschrift = null
      }
      continue
    }
    if (tag === 'text:list-item' && listenTiefe === 1) {
      if (offen && !selbst) aktuell = []
      else if (schliessend && aktuell) {
        nummer++
        eintraege.push({ nummer, abschnitt, laeufe: aktuell })
        aktuell = null
      }
      continue
    }
    if (tag === 'text:p' || tag === 'text:span' || tag === 'text:h') {
      if (offen && !selbst) stapel.push(aufgeloest(formate, attr(rest, 'text:style-name')))
      else if (schliessend) stapel.pop()
      if (tag !== 'text:span' && schliessend && aktuell && aktuell.length) schreibe(' ')
      continue
    }
    if (tag === 'text:s' && offen) schreibe(' '.repeat(parseInt(attr(rest, 'text:c') ?? '1', 10)))
    else if ((tag === 'text:tab' || tag === 'text:line-break') && offen) schreibe(' ')
  }
  // Leerzeichen am Ende jedes Eintrags glätten
  for (const e of eintraege) {
    const l = e.laeufe
    while (l.length && !l[l.length - 1].text.trim()) l.pop()
    if (l.length) l[l.length - 1].text = l[l.length - 1].text.replace(/\s+$/, '')
    if (l.length) l[0].text = l[0].text.replace(/^\s+/, '')
  }
  return eintraege.filter((e) => e.laeufe.length > 0)
}

export function leseOdt(bytes: Uint8Array): OdtEintrag[] {
  const dateien = unzipSync(bytes, { filter: (f) => f.name === 'content.xml' || f.name === 'styles.xml' })
  const content = strFromU8(dateien['content.xml'])
  const styles = dateien['styles.xml'] ? strFromU8(dateien['styles.xml']) : ''
  return leseInhalt(content, leseFormate(styles, content))
}
