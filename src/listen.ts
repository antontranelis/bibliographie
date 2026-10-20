import { ersterscheinung, sortierName, STANDARD_STIL } from './format'
import { neueId, personSchluessel, type ListenRegel, type Literaturliste, type Person, type Thema, type Werk } from './model'
import { baum, bezeichnung, unterthemen } from './themen'

// Gespeicherte Literaturlisten: welche Karten in welcher Reihenfolge stehen, wahlweise gegliedert nach Themen.

export const ALLE: ListenRegel = { person: '', schlagwort: '', nurPrimaer: false, nurFest: false, thema: '', mitUnterthemen: true }

export function neueListe(name: string, regel: ListenRegel | null = ALLE): Literaturliste {
  const jetzt = new Date().toISOString()
  return {
    id: neueId(),
    name,
    regel: regel && { ...regel },
    eintraege: [],
    ausgenommen: [],
    stil: { ...STANDARD_STIL },
    sortierung: 'name',
    jedePerson: false,
    gliederung: 'keine',
    angelegt: jetzt,
    geaendert: jetzt,
  }
}

/** Themen, die eine Regel aufnimmt; null = jedes */
export function regelThemen(r: ListenRegel | null, themen: Thema[]): Set<string> | null {
  if (!r?.thema) return null
  return r.mitUnterthemen ? unterthemen(themen, r.thema) : new Set([r.thema])
}

export function passtZurRegel(w: Werk, r: ListenRegel, themen: Thema[] = []): boolean {
  const menge = regelThemen(r, themen)
  return (
    (!menge || w.themen.some((t) => menge.has(t))) &&
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
  /** Von Hand aufgenommen */
  vonHand: boolean
  schluessel: string
}

/** Überschrift eines Abschnitts, aus der Themenordnung */
export interface Ueberschrift {
  id: string
  titel: string
  ebene: 1 | 2
}

export interface Abschnitt {
  /** Null = ohne Überschrift */
  ueberschrift: Ueberschrift | null
  zeilen: ListenZeile[]
}

/** Das Werk, wie die Zeile es druckt: bei „jeder Person“ steht die Einordnungsperson vorn. Die Karte selbst bleibt, wie sie ist. */
export function druckWerk(z: ListenZeile): Werk {
  const vorn = z.person
  if (!vorn) return z.werk
  return { ...z.werk, personen: [vorn, ...z.werk.personen.filter((p) => p !== vorn)] }
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

/**
 * Die Liste, wie sie gedruckt wird: ein Abschnitt ohne Überschrift, oder bei der Gliederung nach Themen
 * ein Abschnitt je Thema, und ein Werk steht unter jedem seiner Themen.
 */
export function abschnitte(liste: Literaturliste, werke: Werk[], themen: Thema[] = []): Abschnitt[] {
  const nachId = new Map(werke.map((w) => [w.id, w]))
  const ausgenommen = new Set(liste.ausgenommen)
  // Von Hand Aufgenommene in ihrer Reihenfolge; gelöschte Karten fallen weg
  const hand = [...new Set(liste.eintraege.map((e) => e.werkId))].filter((id) => nachId.has(id)).map((id) => nachId.get(id)!)
  const handIds = new Set(hand.map((w) => w.id))
  const regel = liste.regel
  const treffer = regel ? werke.filter((w) => !handIds.has(w.id) && passtZurRegel(w, regel, themen)) : []

  const zeile = (w: Werk, vonHand: boolean, person?: Person): ListenZeile => ({
    werk: w,
    person,
    drin: !ausgenommen.has(w.id),
    vonHand,
    schluessel: person ? `${w.id}|${personSchluessel(person)}` : w.id,
  })
  /** Von Hand aufgenommene zuerst in ihrer Reihenfolge, oder alle sortiert; bei „jeder Person“ ausgeweitet. */
  const ordne = (hand: Werk[], ausRegel: Werk[], sortierung: Literaturliste['sortierung']): ListenZeile[] => {
    if (sortierung === 'hand') return [...hand.map((w) => zeile(w, true)), ...sortiert(ausRegel.map((w) => zeile(w, false)), 'name')]
    const alle = [...hand.map((w) => zeile(w, true)), ...ausRegel.map((w) => zeile(w, false))]
    const ausgeweitet = liste.jedePerson
      ? alle.flatMap((z) => {
          const personen = z.werk.personen.filter((p) => p.nachname.trim() || p.vorname.trim())
          return personen.length > 1 ? personen.map((p) => zeile(z.werk, z.vonHand, p)) : [personen.length ? zeile(z.werk, z.vonHand, personen[0]) : z]
        })
      : alle
    return sortiert(ausgeweitet, sortierung)
  }

  if (liste.gliederung === 'themen') return nachThemen(liste, hand, treffer, themen, ordne)
  return [{ ueberschrift: null, zeilen: ordne(hand, treffer, liste.sortierung) }]
}

/** Abschnitte aus der Themenordnung; Zweige ohne Werke entfallen. Was in keinem gezeigten Thema steht, kommt in einen Schlussabschnitt. */
function nachThemen(
  liste: Literaturliste,
  hand: Werk[],
  treffer: Werk[],
  themen: Thema[],
  ordne: (hand: Werk[], ausRegel: Werk[], s: Literaturliste['sortierung']) => ListenZeile[],
): Abschnitt[] {
  const erlaubt = regelThemen(liste.regel, themen)
  const knoten = baum(themen).filter((k) => !erlaubt || erlaubt.has(k.thema.id))
  const handIds = new Set(hand.map((w) => w.id))
  const alle = [...hand, ...treffer.filter((w) => !handIds.has(w.id))]
  // „von Hand“: die Reihenfolge der Einträge gilt auch unter jedem Thema
  const sortierung = liste.sortierung
  const flach = Math.min(...knoten.map((k) => k.tiefe))
  const abschnitte: Abschnitt[] = knoten.map((k) => {
    const hier = alle.filter((w) => w.themen.includes(k.thema.id))
    return {
      ueberschrift: { id: k.thema.id, titel: bezeichnung(k.thema), ebene: k.tiefe - flach === 0 ? 1 : 2 },
      zeilen: ordne(hier.filter((w) => handIds.has(w.id)), hier.filter((w) => !handIds.has(w.id)), sortierung),
    }
  })
  // Ein Thema bleibt, wenn es selbst oder eines seiner Unterthemen Werke hat
  const mitWerken = new Set<string>()
  for (const a of abschnitte) {
    if (a.zeilen.length === 0) continue
    for (const id of mitVorfahren(themen, a.ueberschrift!.id)) mitWerken.add(id)
  }
  const ergebnis = abschnitte.filter((a) => mitWerken.has(a.ueberschrift!.id))
  // Jede Karte der Liste erscheint mindestens einmal: ohne Thema, oder von Hand aufgenommen außerhalb des Regelzweigs
  const gezeigt = new Set(ergebnis.flatMap((a) => a.zeilen.map((z) => z.werk.id)))
  const rest = alle.filter((w) => !gezeigt.has(w.id))
  if (rest.length)
    ergebnis.push({
      ueberschrift: { id: '~weitere', titel: erlaubt ? 'Weitere Titel' : 'ohne Thema', ebene: 1 },
      zeilen: ordne(rest.filter((w) => handIds.has(w.id)), rest.filter((w) => !handIds.has(w.id)), sortierung),
    })
  return ergebnis
}

/** Das Thema und alle seine Vorfahren. */
function mitVorfahren(themen: Thema[], id: string): string[] {
  const nachId = new Map(themen.map((t) => [t.id, t]))
  const aus: string[] = []
  for (let t = nachId.get(id); t && !aus.includes(t.id); t = nachId.get(t.elternId)) aus.push(t.id)
  return aus
}

const geaendert = (l: Literaturliste): Literaturliste => ({ ...l, geaendert: new Date().toISOString() })

/** Karte aufnehmen; eine herausgenommene wird wieder gedruckt. */
export function hinzufuegen(l: Literaturliste, werkId: string): Literaturliste {
  const da = l.eintraege.some((e) => e.werkId === werkId)
  return geaendert({
    ...l,
    eintraege: da ? l.eintraege : [...l.eintraege, { werkId }],
    ausgenommen: l.ausgenommen.filter((id) => id !== werkId),
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

/** Von Hand aufgenommene Karte um eine Stelle verschieben. */
export function rueckeUm(l: Literaturliste, werkId: string, richtung: -1 | 1): Literaturliste {
  const i = l.eintraege.findIndex((e) => e.werkId === werkId)
  const j = i + richtung
  if (i < 0 || j < 0 || j >= l.eintraege.length) return l
  const eintraege = [...l.eintraege]
  ;[eintraege[i], eintraege[j]] = [eintraege[j], eintraege[i]]
  return geaendert({ ...l, eintraege })
}
