import type { Verlag } from './model'

export interface OrtsAuskunft {
  ort: string
  /** In diesem Jahr kommen zwei Orte in Frage */
  zweiOrteMoeglich: string[] | null
}

/** Verlagsort zu einem Erscheinungsjahr aus der Ortsgeschichte des Verlags. */
export function ortFuerJahr(verlag: Verlag, jahr: string): OrtsAuskunft | null {
  if (verlag.orte.length === 0) return null
  const j = parseInt(jahr, 10)
  const sortiert = [...verlag.orte].sort((a, b) => (parseInt(a.abJahr, 10) || 0) - (parseInt(b.abJahr, 10) || 0))
  if (Number.isNaN(j)) return { ort: sortiert[0].ort, zweiOrteMoeglich: null }
  let index = 0
  sortiert.forEach((abschnitt, i) => {
    const ab = parseInt(abschnitt.abJahr, 10)
    if (Number.isNaN(ab) || ab <= j) index = i
  })
  const aktuell = sortiert[index]
  if (index > 0 && aktuell.wechselImJahr && parseInt(aktuell.abJahr, 10) === j) {
    return { ort: aktuell.ort, zweiOrteMoeglich: [sortiert[index - 1].ort, aktuell.ort] }
  }
  return { ort: aktuell.ort, zweiOrteMoeglich: null }
}

/** Verlage, deren Kürzel oder Namensanfang zur Eingabe passt. */
export function verlagVorschlaege(verlage: Verlag[], eingabe: string): Verlag[] {
  const e = eingabe.trim().toLowerCase()
  if (!e) return []
  const kuerzel = verlage.filter((v) => v.kuerzel.toLowerCase() === e)
  const anfang = verlage.filter((v) => !kuerzel.includes(v) && v.name.toLowerCase().startsWith(e))
  const enthaelt = verlage.filter(
    (v) => !kuerzel.includes(v) && !anfang.includes(v) && v.name.toLowerCase().includes(e),
  )
  return [...kuerzel, ...anfang, ...enthaelt].slice(0, 8)
}
