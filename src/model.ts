// Datenmodell: ein Werk durch alle Auflagen und Ausgaben hindurch.

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
  vermerk: string
  isbn: string
  quelle?: { katalog: 'lobid' | 'dnb'; id: string }
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

export interface Schlagwort {
  begriff: string
  primaer: boolean
}

export interface Werk {
  id: string
  status: Status
  art: TextArt
  personen: Person[]
  titel: string
  untertitel: string
  reihe: string
  reiheBand: string
  auflagen: Auflage[]
  erschienenIn?: ErschienenIn
  kommentar: string
  /** Anmerkung, die in der Liste kursiv mitgedruckt wird: „(Anm.: …)“; *Titel* darin steht aufrecht */
  anmerkung: string
  schlagwoerter: Schlagwort[]
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

export interface Datenstamm {
  werke: Werk[]
  verlage: Verlag[]
}

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
    vermerk: '',
    isbn: '',
  }
}

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
    auflagen: [leereAuflage()],
    kommentar: '',
    anmerkung: '',
    schlagwoerter: [],
    angelegt: jetzt,
    geaendert: jetzt,
  }
}

export function leeresErschienenIn(): ErschienenIn {
  return { art: 'zeitschrift', titel: '', jahrgang: '', jahr: '', heft: '', ausgabe: '', seitenVon: '', seitenBis: '' }
}
