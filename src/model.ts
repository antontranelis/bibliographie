// Datenmodell: ein Werk durch alle Ausgaben und deren Auflagen hindurch.

import type { Stil } from './format'

export type Status = 'vorlaeufig' | 'fest'

export type TextArt =
  | 'buch'
  | 'sammelband'
  | 'aufsatz'
  | 'selbstverlag'
  | 'festschrift'
  | 'vortrag'
  | 'manuskript'
  | 'typoskript'
  | 'hochschulschrift'
  | 'brief'
  | 'online'
  | 'sonstiges'

export const TEXT_ARTEN: { value: TextArt; label: string }[] = [
  { value: 'buch', label: 'Buch' },
  { value: 'sammelband', label: 'Sammelband' },
  { value: 'aufsatz', label: 'Aufsatz' },
  { value: 'selbstverlag', label: 'Selbstverlag / Privatdruck' },
  { value: 'festschrift', label: 'Festschrift' },
  { value: 'vortrag', label: 'Vortrag' },
  { value: 'manuskript', label: 'Unveröffentlichtes Manuskript' },
  { value: 'typoskript', label: 'Unveröffentlichtes Typoskript' },
  { value: 'hochschulschrift', label: 'Hochschulschrift' },
  { value: 'brief', label: 'Brief' },
  { value: 'online', label: 'Online-Beitrag' },
  { value: 'sonstiges', label: 'Sonstiges' },
]

export interface Person {
  vorname: string
  nachname: string
  rolle: 'autor' | 'hrsg'
}

export interface Auflage {
  id: string
  /** Zählnummer der Auflage, leer = nicht gezählt */
  nummer: string
  /** Reales Erscheinungsjahr */
  jahr: string
  /** Im Buch abgedrucktes, abweichendes Jahr */
  gedrucktesJahr: string
  /** Tag der Ersterscheinung, ISO-Datum */
  erscheinungstag: string
  /** Verlagsname, wie er für diese Auflage gedruckt wird */
  verlag: string
  /** Verweis auf die Verlagskarte, sobald der Name einem Verlag zugeordnet ist */
  verlagId?: string
  ort: string
  /** Der Ort weicht bewusst von der Ortsgeschichte des Verlags ab */
  ortBestaetigt?: boolean
  seiten: string
  seitenRoemisch: string
  /** Bearbeitung, gedruckt vor „Aufl.“: „erw.“, „überarb. und erw.“ */
  bearbeitung: string
  /** Druckvermerk, nicht gedruckt: „20.–25. Tsd.“ */
  vermerk: string
  /** In der Literaturliste nennen; leer = erste Auflage der Ausgabe oder bearbeitete Auflage */
  inListe?: boolean
  isbn: string
  quelle?: { katalog: 'lobid' | 'dnb'; id: string }
}

export type AusgabeArt =
  | 'erstausgabe'
  | 'neuausgabe'
  | 'lizenzausgabe'
  | 'taschenbuch'
  | 'nachdruck'
  | 'weitere'
  | 'uebersetzung'
  | 'fassung'
  | 'gekuerzt'
  | 'hochschulschrift'
  | 'aufsatz'
  | 'manuskript'

/** Art der Ausgabe und wie sie in der Liste eingeleitet wird, solange keine eigene Bezeichnung gesetzt ist. */
export const AUSGABE_ARTEN: { value: AusgabeArt; label: string; druck: string }[] = [
  { value: 'erstausgabe', label: 'Erstausgabe', druck: '' },
  { value: 'neuausgabe', label: 'Neuausgabe', druck: 'Neuausgabe' },
  { value: 'lizenzausgabe', label: 'Lizenzausgabe', druck: 'Lizenzausgabe' },
  { value: 'taschenbuch', label: 'Taschenbuch / Paperback', druck: 'als Taschenbuch' },
  { value: 'nachdruck', label: 'Nachdruck', druck: 'Nachdruck' },
  { value: 'weitere', label: 'Weitere Ausgabe', druck: 'auch' },
  { value: 'uebersetzung', label: 'Übersetzung', druck: 'Übersetzung' },
  { value: 'fassung', label: 'Veränderte Fassung', druck: 'veränderte Fassung' },
  { value: 'gekuerzt', label: 'Gekürzte Fassung', druck: 'gekürzte Fassung' },
  { value: 'hochschulschrift', label: 'Hochschulschrift', druck: 'Dissertation' },
  { value: 'aufsatz', label: 'Zuerst als Aufsatz', druck: 'zuerst' },
  { value: 'manuskript', label: 'Manuskript / Typoskript', druck: 'Manuskript' },
]

export type MitwirkungsRolle = 'hrsg' | 'vorwort' | 'einleitung' | 'nachwort' | 'anhang' | 'uebersetzung'

export const MITWIRKUNGS_ROLLEN: { value: MitwirkungsRolle; label: string }[] = [
  { value: 'hrsg', label: 'Herausgabe' },
  { value: 'vorwort', label: 'Vorwort' },
  { value: 'einleitung', label: 'Einleitung' },
  { value: 'nachwort', label: 'Nachwort' },
  { value: 'anhang', label: 'Anhang' },
  { value: 'uebersetzung', label: 'Übersetzung' },
]

export interface Mitwirkung {
  vorname: string
  nachname: string
  rolle: MitwirkungsRolle
  /** Ab welcher Auflage, leer = von Anfang an */
  abAuflage: string
}

/**
 * Eine Ausgabe des Werks mit ihren Auflagen. Die erste Ausgabe ist die, nach der das Werk in der Liste steht.
 * Jedes Werk hat mindestens eine, auch ein Aufsatz, damit er sich in ein Buch umstellen lässt.
 */
export interface Ausgabe {
  id: string
  art: AusgabeArt
  /** Sprache als Adjektiv, etwa „deutsch“ oder „englisch“; bei Übersetzungen ergibt sie „deutsche Ausgabe“ */
  sprache: string
  /** Eigene Einleitung in der Liste, etwa „erste Ausgabe in Englisch“ oder „2. Aufl. als“; leer = nach der Art */
  bezeichnung: string
  /** Eigener Titel dieser Ausgabe, leer = Titel des Werks */
  titel: string
  untertitel: string
  /** Wird nach dem Impressum gedruckt: „mit Untertitel: …“, „(=8. Aufl.)“, „, hrsg. von …“ */
  zusatz: string
  mitwirkende: Mitwirkung[]
  auflagen: Auflage[]
}

export interface ErschienenIn {
  art: 'zeitschrift' | 'sammelband' | 'zeitung'
  titel: string
  jahrgang: string
  jahr: string
  heft: string
  /**
   * Was nach dem Titel gedruckt wird, etwa „44/1927“, „, Bd. 62, 1957, Nr. 6“ oder „, hrsg. von …, Mainz 1996“.
   * Beginnt sie mit Komma oder Punkt, schließt sie direkt an den Titel an, sonst mit Leerzeichen. Hat Vorrang vor Jahrgang/Heft.
   */
  ausgabe: string
  seitenVon: string
  seitenBis: string
}

/** Schlagwörter sind gleichwertig und stehen alphabetisch */
export interface Schlagwort {
  begriff: string
}

/**
 * Schlagwort an seinem alphabetischen Platz dazunehmen; ein gleiches (ohne Groß- und Kleinschreibung) nur einmal.
 * Steht es schon im Bestand, gilt dessen Schreibweise.
 */
export function schlagwortDazu(s: Schlagwort[], begriff: string, bestand: string[] = []): Schlagwort[] {
  const gleich = (x: string) => x.toLowerCase() === begriff.trim().toLowerCase()
  const b = bestand.find(gleich) ?? begriff.trim()
  if (!b || s.some((x) => gleich(x.begriff))) return s
  return sortiereSchlagwoerter([...s, { begriff: b }])
}

export const sortiereSchlagwoerter = (s: Schlagwort[]): Schlagwort[] => [...s].sort((a, b) => a.begriff.localeCompare(b.begriff, 'de'))

export interface Werk {
  id: string
  status: Status
  art: TextArt
  personen: Person[]
  titel: string
  untertitel: string
  reihe: string
  reiheBand: string
  ausgaben: Ausgabe[]
  /** Jahr der Ersterscheinung von Hand; leer = älteste Ausgabe außer Manuskripten */
  ersterscheinung: string
  erschienenIn?: ErschienenIn
  kommentar: string
  /** Anmerkung, die in der Liste kursiv mitgedruckt wird: „(Anm.: …)“; *Titel* darin steht aufrecht */
  anmerkung: string
  /** Zeile aus einer eingelesenen Liste, solange die Karte nicht sicher zerlegt und nicht fest angelegt ist */
  vorlage: string
  schlagwoerter: Schlagwort[]
  /** Themen aus der Themenordnung, beliebig viele */
  themen: string[]
  angelegt: string
  geaendert: string
}

export interface OrtsAbschnitt {
  abJahr: string
  ort: string
  /** Wechsel mitten im Jahr: in abJahr sind beide Orte möglich */
  wechselImJahr: boolean
}

export interface NamensAbschnitt {
  /** Leer beim ersten Namen: gilt von Anfang an */
  abJahr: string
  name: string
}

export interface Verlag {
  id: string
  kuerzel: string
  /** Namensgeschichte; der erste Name gilt bis zur ersten Änderung */
  namen: NamensAbschnitt[]
  orte: OrtsAbschnitt[]
  /** Weitere Schreibweisen, etwa Abkürzungen aus Bibliothekskatalogen */
  schreibweisen: string[]
}

/**
 * Ein Thema der Themenordnung. Der Baum entsteht über elternId; die Reihenfolge der Geschwister
 * ist ihre Reihenfolge in Datenstamm.themen.
 */
export interface Thema {
  id: string
  /** Wie gedruckt, etwa „V.“, „a)“ oder „1.2“; darf leer sein */
  nummer: string
  titel: string
  /** Leer = oberste Ebene */
  elternId: string
}

/** Welche Karten eine Liste von selbst aufnimmt. Leere Person, leeres Schlagwort und leeres Thema heißen: alle. */
export interface ListenRegel {
  /** Schlüssel „Nachname|Vorname“ */
  person: string
  schlagwort: string
  nurFest: boolean
  /** ID eines Themas */
  thema: string
  /** Auch Karten der Unterthemen */
  mitUnterthemen: boolean
}

/** Eine von Hand aufgenommene Karte. */
export interface ListenEintrag {
  werkId: string
}

/** Gespeicherte Literaturliste. Sie verweist auf Karten und druckt immer deren aktuellen Stand. */
export interface Literaturliste {
  id: string
  name: string
  /** Null = nur von Hand aufgenommene Karten */
  regel: ListenRegel | null
  /** Reihenfolge zählt bei der Sortierung „von Hand“ */
  eintraege: ListenEintrag[]
  /**
   * Bei Gliederung nach Themen und „von Hand“: eigene Reihenfolge je Thema (Thema-ID → Werk-IDs),
   * damit ein Werk unter jedem seiner Themen an seinem Platz steht. Ohne Eintrag gilt die Reihenfolge von eintraege.
   */
  abschnittsfolge: Record<string, string[]>
  /** Karten, die nicht gedruckt werden, obwohl Regel oder Eintrag sie aufnehmen */
  ausgenommen: string[]
  stil: Stil
  sortierung: 'name' | 'jahr' | 'hand'
  /** Ein Werk erscheint unter jeder seiner Personen, nicht nur unter der ersten */
  jedePerson: boolean
  /** 'themen': Abschnitte aus der Themenordnung, ein Werk unter jedem seiner Themen */
  gliederung: 'keine' | 'themen'
  angelegt: string
  geaendert: string
}

export interface Datenstamm {
  werke: Werk[]
  verlage: Verlag[]
  listen: Literaturliste[]
  themen: Thema[]
}

export const leererDatenstamm = (): Datenstamm => ({ werke: [], verlage: [], listen: [], themen: [] })

export const personSchluessel = (p: { nachname: string; vorname: string }) => `${p.nachname.trim()}|${p.vorname.trim()}`

export const neueId = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

export function leereAuflage(): Auflage {
  return {
    id: neueId(),
    nummer: '',
    jahr: '',
    gedrucktesJahr: '',
    erscheinungstag: '',
    verlag: '',
    ort: '',
    seiten: '',
    seitenRoemisch: '',
    bearbeitung: '',
    vermerk: '',
    isbn: '',
  }
}

export function leereAusgabe(art: AusgabeArt = 'erstausgabe'): Ausgabe {
  return { id: neueId(), art, sprache: '', bezeichnung: '', titel: '', untertitel: '', zusatz: '', mitwirkende: [], auflagen: [leereAuflage()] }
}

/** Alle Auflagen aller Ausgaben in ihrer Reihenfolge. */
export const alleAuflagen = (werk: Werk): Auflage[] => werk.ausgaben.flatMap((a) => a.auflagen)

/** Jede Auflage aller Ausgaben umformen. */
export const mitAuflagen = (werk: Werk, f: (a: Auflage) => Auflage): Werk => ({
  ...werk,
  ausgaben: werk.ausgaben.map((x) => ({ ...x, auflagen: x.auflagen.map(f) })),
})

export function leeresWerk(): Werk {
  const jetzt = new Date().toISOString()
  return {
    id: neueId(),
    status: 'vorlaeufig',
    art: 'buch',
    personen: [{ vorname: '', nachname: '', rolle: 'autor' }],
    titel: '',
    untertitel: '',
    reihe: '',
    reiheBand: '',
    ausgaben: [leereAusgabe()],
    ersterscheinung: '',
    kommentar: '',
    anmerkung: '',
    vorlage: '',
    schlagwoerter: [],
    themen: [],
    angelegt: jetzt,
    geaendert: jetzt,
  }
}

export function leeresErschienenIn(): ErschienenIn {
  return { art: 'zeitschrift', titel: '', jahrgang: '', jahr: '', heft: '', ausgabe: '', seitenVon: '', seitenBis: '' }
}
