import { ersterscheinung, sortierName, STANDARD_STIL } from './format'
import { neueId, personSchluessel, type Kapitel, type ListenRegel, type Literaturliste, type Person, type Thema, type Werk } from './model'
import { baum, bezeichnung, unterthemen } from './themen'

// Gespeicherte Literaturlisten: welche Karten in welchem Kapitel in welcher Reihenfolge stehen.

export const ALLE: ListenRegel = { person: '', schlagwort: '', nurPrimaer: false, nurFest: false, thema: '', mitUnterthemen: true }

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
    gliederung: 'kapitel',
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
  /** Von Hand aufgenommen oder in ein Kapitel gelegt */
  vonHand: boolean
  schluessel: string
}

export interface Abschnitt {
  /** Null = vor dem ersten Kapitel */
  kapitel: Kapitel | null
  /** Kapitel aus der Themenordnung: nicht in der Liste bearbeitbar */
  ausThema?: boolean
  nummer: string
  zeilen: ListenZeile[]
}

/** Das Werk, wie die Zeile es druckt: bei „jeder Person“ steht die Einordnungsperson vorn. Die Karte selbst bleibt, wie sie ist. */
export function druckWerk(z: ListenZeile): Werk {
  const vorn = z.person
  if (!vorn) return z.werk
  return { ...z.werk, personen: [vorn, ...z.werk.personen.filter((p) => p !== vorn)] }
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

/**
 * Die Liste, wie sie gedruckt wird: Abschnitte vor und in den Kapiteln, jeweils sortiert.
 * Bei der Gliederung nach Themen bilden die Themen die Kapitel, und ein Werk steht unter jedem seiner Themen.
 */
export function abschnitte(liste: Literaturliste, werke: Werk[], themen: Thema[] = []): Abschnitt[] {
  const nachId = new Map(werke.map((w) => [w.id, w]))
  const kapitelIds = new Set(liste.kapitel.map((k) => k.id))
  const ausgenommen = new Set(liste.ausgenommen)
  const platz = new Map<string, string>()
  for (const e of liste.eintraege) if (nachId.has(e.werkId)) platz.set(e.werkId, kapitelIds.has(e.kapitelId) ? e.kapitelId : '')
  const regel = liste.regel
  const treffer = regel ? werke.filter((w) => !platz.has(w.id) && passtZurRegel(w, regel, themen)) : []

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

  if (liste.gliederung === 'themen') return nachThemen(liste, [...platz.keys()].map((id) => nachId.get(id)!), treffer, themen, ordne)

  const zeilenIn = (kapitelId: string): ListenZeile[] =>
    ordne(
      liste.eintraege.filter((e) => platz.get(e.werkId) === kapitelId).map((e) => nachId.get(e.werkId)!),
      kapitelId === '' ? treffer : [],
      liste.sortierung,
    )
  const nr = nummern(liste.kapitel)
  return [{ kapitel: null, nummer: '', zeilen: zeilenIn('') }, ...liste.kapitel.map((k) => ({ kapitel: k, nummer: nr.get(k.id)!, zeilen: zeilenIn(k.id) }))]
}

/** Kapitel aus der Themenordnung; Zweige ohne Werke entfallen, Werke ohne Thema stehen am Ende. */
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
  const sortierung = liste.sortierung === 'hand' ? 'name' : liste.sortierung
  const flach = Math.min(...knoten.map((k) => k.tiefe))
  const abschnitte: Abschnitt[] = knoten.map((k) => {
    const hier = alle.filter((w) => w.themen.includes(k.thema.id))
    return {
      kapitel: { id: k.thema.id, titel: bezeichnung(k.thema), ebene: k.tiefe - flach === 0 ? 1 : 2 },
      ausThema: true,
      nummer: '',
      zeilen: ordne(hier.filter((w) => handIds.has(w.id)), hier.filter((w) => !handIds.has(w.id)), sortierung),
    }
  })
  // Ein Thema bleibt, wenn es selbst oder eines seiner Unterthemen Werke hat
  const mitWerken = new Set<string>()
  for (const a of abschnitte) {
    if (a.zeilen.length === 0) continue
    for (const id of mitVorfahren(themen, a.kapitel!.id)) mitWerken.add(id)
  }
  const ergebnis = abschnitte.filter((a) => mitWerken.has(a.kapitel!.id))
  if (!erlaubt) {
    const bekannt = new Set(themen.map((t) => t.id))
    const ohne = alle.filter((w) => !w.themen.some((t) => bekannt.has(t)))
    if (ohne.length)
      ergebnis.push({
        kapitel: { id: '~ohne-thema', titel: 'ohne Thema', ebene: 1 },
        ausThema: true,
        nummer: '',
        zeilen: ordne(ohne.filter((w) => handIds.has(w.id)), ohne.filter((w) => !handIds.has(w.id)), sortierung),
      })
  }
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
