import { neueId, type Datenstamm, type Werk } from './model'

export const FORMAT = 'bibliographie-datenstamm'
export const VERSION = 1

export interface Exportdatei extends Datenstamm {
  format: typeof FORMAT
  version: number
  exportiert: string
}

export function exportiere(d: Datenstamm): string {
  const datei: Exportdatei = { format: FORMAT, version: VERSION, exportiert: new Date().toISOString(), ...d }
  return JSON.stringify(datei, null, 2)
}

export function importiere(text: string): Datenstamm {
  let daten: unknown
  try {
    daten = JSON.parse(text)
  } catch {
    throw new Error('Die Datei ist kein gültiges JSON.')
  }
  const d = daten as Partial<Exportdatei>
  if (d.format !== FORMAT) throw new Error('Die Datei stammt nicht aus diesem Programm.')
  if (typeof d.version !== 'number' || d.version > VERSION)
    throw new Error('Die Datei stammt aus einer neueren Programmversion.')
  return { werke: d.werke ?? [], verlage: d.verlage ?? [] }
}

/** Führt importierte Daten mit dem Bestand zusammen. Gleiche ID: die neuere Fassung gewinnt. */
export function zusammenfuehren(bestand: Datenstamm, neu: Datenstamm): Datenstamm {
  const werke = new Map(bestand.werke.map((w) => [w.id, w]))
  for (const w of neu.werke) {
    const alt = werke.get(w.id)
    if (!alt || w.geaendert > alt.geaendert) werke.set(w.id, w)
  }
  const verlage = new Map(bestand.verlage.map((v) => [v.id, v]))
  for (const v of neu.verlage) verlage.set(v.id, v)
  return { werke: [...werke.values()], verlage: [...verlage.values()] }
}

/** CSL-JSON für Zotero, Pandoc und Co. Eine Zeile pro Auflage, weil CSL kein Werk mit Auflagen kennt. */
export function exportiereCsl(werke: Werk[]): string {
  type CslItem = Record<string, unknown>
  const items = werke.flatMap((w): CslItem[] => {
    const personen = w.personen.filter((p) => p.nachname || p.vorname)
    const autoren = personen.filter((p) => p.rolle === 'autor').map((p) => ({ family: p.nachname, given: p.vorname }))
    const hrsg = personen.filter((p) => p.rolle === 'hrsg').map((p) => ({ family: p.nachname, given: p.vorname }))
    const titel = w.untertitel ? `${w.titel}. ${w.untertitel}` : w.titel
    if (w.art === 'aufsatz' && w.erschienenIn) {
      const e = w.erschienenIn
      return [
        {
          id: w.id,
          type: e.art === 'sammelband' ? 'chapter' : e.art === 'zeitung' ? 'article-newspaper' : 'article-journal',
          title: titel,
          author: autoren,
          'container-title': e.titel,
          volume: e.jahrgang || undefined,
          issue: e.heft || undefined,
          page: e.seitenVon ? [e.seitenVon, e.seitenBis].filter(Boolean).join('-') : undefined,
          issued: e.jahr ? { 'date-parts': [[parseInt(e.jahr, 10)]] } : undefined,
          note: w.kommentar || undefined,
        },
      ]
    }
    return w.auflagen.map((a, i) => ({
      id: w.auflagen.length > 1 ? `${w.id}-${i + 1}` : w.id,
      type: 'book',
      title: titel,
      author: autoren.length ? autoren : undefined,
      editor: hrsg.length ? hrsg : undefined,
      publisher: a.verlag || undefined,
      'publisher-place': a.ort || undefined,
      edition: a.nummer || undefined,
      issued: a.jahr ? { 'date-parts': [[parseInt(a.jahr, 10)]] } : undefined,
      'number-of-pages': a.seiten || undefined,
      'collection-title': w.reihe || undefined,
      'collection-number': w.reiheBand || undefined,
      note: w.kommentar || undefined,
    }))
  })
  return JSON.stringify(items, null, 2)
}

const SCHLUESSEL = 'bibliographie:datenstamm:v1'

export function ladeLokal(): Datenstamm | null {
  try {
    const text = localStorage.getItem(SCHLUESSEL)
    return text ? (JSON.parse(text) as Datenstamm) : null
  } catch {
    return null
  }
}

export function speichereLokal(d: Datenstamm): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(d))
  } catch {
    // Speicher voll oder gesperrt: die Exportdatei bleibt der sichere Weg.
  }
}

export { neueId }
