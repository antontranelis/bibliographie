import { leereAusgabe, neueId, type Auflage, type Ausgabe, type Datenstamm, type Verlag, type Werk } from './model'

export const FORMAT = 'bibliographie-datenstamm'
export const VERSION = 3

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
  return migriere({ werke: d.werke ?? [], verlage: d.verlage ?? [] })
}

/**
 * Bringt Daten auf den Stand von Version 3. Version 1 kannte pro Verlag nur einen Namen,
 * und Auflagen verwiesen über den Namenstext auf ihn. Bis Version 2 hingen die Auflagen direkt am Werk;
 * sie werden zur ersten Ausgabe.
 */
export function migriere(d: Datenstamm): Datenstamm {
  const verlage: Verlag[] = d.verlage.map((v) => {
    const alt = v as Partial<Verlag> & { name?: string }
    return {
      id: alt.id ?? neueId(),
      kuerzel: alt.kuerzel ?? '',
      namen: alt.namen ?? [{ abJahr: '', name: alt.name ?? '' }],
      orte: alt.orte ?? [],
      schreibweisen: alt.schreibweisen ?? [],
    }
  })
  const nachName = new Map(verlage.map((v) => [v.namen[0]?.name.trim().toLowerCase(), v.id]))
  const auflage = (a: Auflage): Auflage => {
    const neu = { ...a, isbn: a.isbn ?? '', bearbeitung: a.bearbeitung ?? '', verlagId: a.verlagId ?? nachName.get(a.verlag.trim().toLowerCase()) }
    if (neu.verlagId === undefined) delete neu.verlagId
    return neu
  }
  const werke = d.werke.map((w): Werk => {
    const { auflagen, ...rest } = w as Werk & { auflagen?: Auflage[] }
    const bisher: Ausgabe[] = rest.ausgaben ?? [{ ...leereAusgabe(), auflagen: auflagen ?? [] }]
    const ausgaben = bisher.length ? bisher : [leereAusgabe()]
    return {
      ...rest,
      anmerkung: rest.anmerkung ?? '',
      ersterscheinung: rest.ersterscheinung ?? '',
      ...(rest.erschienenIn ? { erschienenIn: { ...rest.erschienenIn, ausgabe: rest.erschienenIn.ausgabe ?? '' } } : {}),
      ausgaben: ausgaben.map((a) => ({ ...leereAusgabe(), ...a, auflagen: a.auflagen.map(auflage) })),
    }
  })
  return { werke, verlage }
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

/** CSL-JSON für Zotero, Pandoc und Co. Eine Zeile pro Auflage, weil CSL kein Werk mit Ausgaben und Auflagen kennt. */
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
    const auflagen = w.ausgaben.flatMap((ausgabe) => ausgabe.auflagen.map((a) => ({ a, ausgabe })))
    return auflagen.map(({ a, ausgabe }, i) => ({
      id: auflagen.length > 1 ? `${w.id}-${i + 1}` : w.id,
      type: 'book',
      title: ausgabe.titel.trim() ? (ausgabe.untertitel.trim() ? `${ausgabe.titel}. ${ausgabe.untertitel}` : ausgabe.titel) : titel,
      author: autoren.length ? autoren : undefined,
      editor: hrsg.length ? hrsg : undefined,
      publisher: a.verlag || undefined,
      'publisher-place': a.ort || undefined,
      edition: a.nummer || undefined,
      issued: a.jahr ? { 'date-parts': [[parseInt(a.jahr, 10)]] } : undefined,
      'number-of-pages': a.seiten || undefined,
      ISBN: a.isbn || undefined,
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
    return text ? migriere(JSON.parse(text) as Datenstamm) : null
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
