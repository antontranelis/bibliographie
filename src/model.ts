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
  verlag: string
  ort: string
  seiten: string
  seitenRoemisch: string
  vermerk: string
  quelle?: { katalog: 'lobid'; id: string }
}

export interface ErschienenIn {
  art: 'zeitschrift' | 'sammelband' | 'zeitung'
  titel: string
  jahrgang: string
  jahr: string
  heft: string
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

export interface Verlag {
  id: string
  name: string
  kuerzel: string
  orte: OrtsAbschnitt[]
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
    schlagwoerter: [],
    angelegt: jetzt,
    geaendert: jetzt,
  }
}

export function leeresErschienenIn(): ErschienenIn {
  return { art: 'zeitschrift', titel: '', jahrgang: '', jahr: '', heft: '', seitenVon: '', seitenBis: '' }
}
