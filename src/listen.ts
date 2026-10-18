import { ersterscheinung, sortierName, STANDARD_STIL } from './format'
import { neueId, personSchluessel, type Kapitel, type ListenRegel, type Literaturliste, type Person, type Werk } from './model'

// Gespeicherte Literaturlisten: welche Karten in welchem Kapitel in welcher Reihenfolge stehen.

export const ALLE: ListenRegel = { person: '', schlagwort: '', nurPrimaer: false, nurFest: false }

export function neueListe(name: string, regel: ListenRegel | null = ALLE): Literaturliste {
  const jetzt = new Date().toISOString()
  return {
    id: neueId(),
    name,
    regel: regel && { ...regel },
    kapitel: [],
    eintraege: [],
    ausgenommen: [],
    stil: { ...STANDARD_STIL },
    sortierung: 'name',
    jedePerson: false,
    angelegt: jetzt,
    geaendert: jetzt,
  }
}

export function passtZurRegel(w: Werk, r: ListenRegel): boolean {
  return (
    (!r.nurFest || w.status === 'fest') &&
    (!r.person || w.personen.some((p) => personSchluessel(p) === r.person)) &&
    (!r.schlagwort || w.schlagwoerter.some((s) => s.begriff === r.schlagwort && (!r.nurPrimaer || s.primaer)))
  )
}

export interface ListenZeile {
  werk: Werk
  /** Bei „jeder Person“: die Person, unter der das Werk hier steht */
  person?: Person
  /** Wird gedruckt; herausgenommene Karten bleiben zum Wiederaufnehmen sichtbar */
  drin: boolean
  /** Von Hand aufgenommen oder in ein Kapitel gelegt */
  vonHand: boolean
  schluessel: string
}

export interface Abschnitt {
  /** Null = vor dem ersten Kapitel */
  kapitel: Kapitel | null
  nummer: string
  zeilen: ListenZeile[]
}

/** Laufende Nummern der Kapitel: „1“, „1.1“, „1.2“, „2“. */
export function nummern(kapitel: Kapitel[]): Map<string, string> {
  const aus = new Map<string, string>()
  let haupt = 0
  let unter = 0
  for (const k of kapitel) {
    if (k.ebene === 1 || haupt === 0) {
      haupt++
      unter = 0
      aus.set(k.id, String(haupt))
    } else aus.set(k.id, `${haupt}.${++unter}`)
  }
  return aus
}

const vgl = (a: string, b: string) => a.localeCompare(b, 'de', { sensitivity: 'base' })

function sortiert(zeilen: ListenZeile[], nach: 'name' | 'jahr'): ListenZeile[] {
  const name = (z: ListenZeile) => sortierName(z.werk, z.person)
  return [...zeilen].sort((a, b) => {
    const jahr = ersterscheinung(a.werk) - ersterscheinung(b.werk)
    if (nach === 'jahr') return jahr || vgl(name(a), name(b))
    return vgl(name(a), name(b)) || jahr || vgl(a.werk.titel, b.werk.titel)
  })
}

/** Die Liste, wie sie gedruckt wird: Abschnitte vor und in den Kapiteln, jeweils sortiert. */
export function abschnitte(liste: Literaturliste, werke: Werk[]): Abschnitt[] {
  const nachId = new Map(werke.map((w) => [w.id, w]))
  const kapitelIds = new Set(liste.kapitel.map((k) => k.id))
  const ausgenommen = new Set(liste.ausgenommen)
  const platz = new Map<string, string>()
  for (const e of liste.eintraege) if (nachId.has(e.werkId)) platz.set(e.werkId, kapitelIds.has(e.kapitelId) ? e.kapitelId : '')
  const regel = liste.regel
  const treffer = regel ? werke.filter((w) => !platz.has(w.id) && passtZurRegel(w, regel)) : []

  const zeilenIn = (kapitelId: string): ListenZeile[] => {
    const hand = liste.eintraege.filter((e) => platz.get(e.werkId) === kapitelId).map((e) => nachId.get(e.werkId)!)
    const ausRegel = kapitelId === '' ? treffer : []
    const zeile = (w: Werk, vonHand: boolean, person?: Person): ListenZeile => ({
      werk: w,
      person,
      drin: !ausgenommen.has(w.id),
      vonHand,
      schluessel: person ? `${w.id}|${personSchluessel(person)}` : w.id,
    })
    if (liste.sortierung === 'hand') return [...hand.map((w) => zeile(w, true)), ...sortiert(ausRegel.map((w) => zeile(w, false)), 'name')]
    const alle = [...hand.map((w) => zeile(w, true)), ...ausRegel.map((w) => zeile(w, false))]
    const ausgeweitet = liste.jedePerson
      ? alle.flatMap((z) => {
          const personen = z.werk.personen.filter((p) => p.nachname.trim() || p.vorname.trim())
          return personen.length > 1 ? personen.map((p) => zeile(z.werk, z.vonHand, p)) : [personen.length ? zeile(z.werk, z.vonHand, personen[0]) : z]
        })
      : alle
    return sortiert(ausgeweitet, liste.sortierung)
  }

  const nr = nummern(liste.kapitel)
  return [{ kapitel: null, nummer: '', zeilen: zeilenIn('') }, ...liste.kapitel.map((k) => ({ kapitel: k, nummer: nr.get(k.id)!, zeilen: zeilenIn(k.id) }))]
}

const geaendert = (l: Literaturliste): Literaturliste => ({ ...l, geaendert: new Date().toISOString() })

/** Karte aufnehmen; eine herausgenommene wird wieder gedruckt. */
export function hinzufuegen(l: Literaturliste, werkId: string, kapitelId = ''): Literaturliste {
  const da = l.eintraege.some((e) => e.werkId === werkId)
  return geaendert({
    ...l,
    eintraege: da ? l.eintraege : [...l.eintraege, { werkId, kapitelId }],
    ausgenommen: l.ausgenommen.filter((id) => id !== werkId),
  })
}

/** Karte in ein Kapitel legen; leer = vor das erste Kapitel. */
export function verschiebe(l: Literaturliste, werkId: string, kapitelId: string): Literaturliste {
  const da = l.eintraege.some((e) => e.werkId === werkId)
  return geaendert({
    ...l,
    eintraege: da ? l.eintraege.map((e) => (e.werkId === werkId ? { ...e, kapitelId } : e)) : [...l.eintraege, { werkId, kapitelId }],
  })
}

/** Von Hand aufgenommene Karte wieder aus der Liste nehmen. */
export function entferne(l: Literaturliste, werkId: string): Literaturliste {
  return geaendert({ ...l, eintraege: l.eintraege.filter((e) => e.werkId !== werkId) })
}

/** Karte drucken oder nicht drucken. */
export function umschalten(l: Literaturliste, werkId: string): Literaturliste {
  const raus = l.ausgenommen.includes(werkId)
  return geaendert({ ...l, ausgenommen: raus ? l.ausgenommen.filter((id) => id !== werkId) : [...l.ausgenommen, werkId] })
}

/** Von Hand aufgenommene Karte innerhalb ihres Kapitels um eine Stelle verschieben. */
export function rueckeUm(l: Literaturliste, werkId: string, richtung: -1 | 1): Literaturliste {
  const i = l.eintraege.findIndex((e) => e.werkId === werkId)
  if (i < 0) return l
  const kapitelId = l.eintraege[i].kapitelId
  let j = i + richtung
  while (j >= 0 && j < l.eintraege.length && l.eintraege[j].kapitelId !== kapitelId) j += richtung
  if (j < 0 || j >= l.eintraege.length) return l
  const eintraege = [...l.eintraege]
  ;[eintraege[i], eintraege[j]] = [eintraege[j], eintraege[i]]
  return geaendert({ ...l, eintraege })
}

/** Kapitel entfernen; seine Einträge rücken vor das erste Kapitel. */
export function kapitelEntfernen(l: Literaturliste, kapitelId: string): Literaturliste {
  return geaendert({
    ...l,
    kapitel: l.kapitel.filter((k) => k.id !== kapitelId),
    eintraege: l.eintraege.map((e) => (e.kapitelId === kapitelId ? { ...e, kapitelId: '' } : e)),
  })
}
