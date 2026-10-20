import type { Auflage, Werk } from './model'

// Ob eine Karte eigene Angaben enthält, entscheidet allein der Vergleich mit ihrer Vorlage:
// der Karte, wie sie mit den fixierten Feldern angelegt wurde. Keine Feldlisten pro Aufrufer.

/** Inhaltsfelder eines Werks. IDs, Zeitstempel und Herkunftsvermerke gehören nicht dazu. */
export const INHALTSFELDER = [
  'art',
  'status',
  'personen',
  'titel',
  'untertitel',
  'reihe',
  'reiheBand',
  'ausgaben',
  'ersterscheinung',
  'erschienenIn',
  'kommentar',
  'anmerkung',
  'schlagwoerter',
  'themen',
] as const satisfies readonly (keyof Werk)[]

export type Inhaltsfeld = (typeof INHALTSFELDER)[number]

const AUFLAGEFELDER = [
  'nummer',
  'jahr',
  'gedrucktesJahr',
  'erscheinungstag',
  'verlag',
  'ort',
  'seiten',
  'seitenRoemisch',
  'bearbeitung',
  'vermerk',
  'isbn',
] as const satisfies readonly (keyof Auflage)[]

/** Vergleichbare Form: Texte getrimmt, IDs und Herkunft entfernt. */
function normal(wert: unknown): unknown {
  if (typeof wert === 'string') return wert.trim()
  if (Array.isArray(wert)) return wert.map(normal)
  if (wert && typeof wert === 'object') {
    const o = wert as Record<string, unknown>
    return Object.fromEntries(
      Object.keys(o)
        .filter((k) => k !== 'id' && k !== 'quelle' && k !== 'verlagId')
        .sort()
        .map((k) => [k, normal(o[k])]),
    )
  }
  return wert ?? null
}

function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(normal(a)) === JSON.stringify(normal(b))
}

/** Inhaltsfelder, in denen die Karte von ihrer Vorlage abweicht, ohne die ausgenommenen. */
export function eigeneAngaben(werk: Werk, vorlage: Werk, ausser: readonly Inhaltsfeld[] = []): Inhaltsfeld[] {
  return INHALTSFELDER.filter((f) => !ausser.includes(f) && !gleich(werk[f], vorlage[f]))
}

/** Hat jemand an der Karte etwas eingetragen, das nicht aus der Vorlage stammt? */
export function weichtAb(werk: Werk, vorlage: Werk): boolean {
  return eigeneAngaben(werk, vorlage).length > 0
}

/** Eine Auflagenzeile ohne jede Angabe. Nur solche Zeilen dürfen still wegfallen. */
export function auflageLeer(a: Auflage): boolean {
  return AUFLAGEFELDER.every((f) => !a[f].trim())
}
