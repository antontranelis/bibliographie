import { neueListe } from '../listen'
import { leeresWerk, neueId, type Kapitel, type ListenEintrag, type Literaturliste, type Werk } from '../model'
import { KOMMENTARFARBE, rueckprobe, zerlegeEintrag, zerlegePersonen } from './eintrag'
import type { Lauf, OdtDokument } from './odt'

// Plan und Übernahme einer eingelesenen Literaturliste: welche Abschnitte, welche Karten, welche Liste.

/** Bis zu dieser Länge kann ein Absatz ohne Einträge eine Überschrift sein */
const UEBERSCHRIFT_LAENGE = 120

export type PostenStatus = 'sicher' | 'pruefen' | 'hand'

/** Nummer des Abschnitts für Einträge vor dem ersten Absatz */
export const VOR_DEM_ERSTEN = -1

export interface ImportAbschnitt {
  /** Stelle des Absatzes in der Datei; VOR_DEM_ERSTEN für Einträge davor */
  nr: number
  titel: string
  eintraege: number
  erkannt: number
  /** Vorausgewählt: überwiegend erkannte Einträge oder eine kurze Überschrift direkt davor */
  vorschlag: boolean
}

export interface ImportPosten {
  abschnittNr: number
  status: PostenStatus
  werk: Werk
  /** Dieselbe Karte steht schon in der Kartei */
  vorhandenId?: string
  /** Gleiche Gruppe = dasselbe Werk; leer, wenn ohne Titel nicht vergleichbar */
  gruppe: string
}

export interface ImportPlan {
  abschnitte: ImportAbschnitt[]
  posten: ImportPosten[]
}

const normal = (s: string) => s.toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
/** Gleiches Werk: gleicher erster Nachname und gleicher Titel */
const schluessel = (w: Werk) => (w.titel.trim() ? `${normal(w.personen[0]?.nachname ?? '')}|${normal(w.titel)}` : '')

/** Was sich aus einer nicht zerlegten Zeile sicher sagen lässt: Personen vor dem Doppelpunkt, fetter Titel. */
function teilwerk(laeufe: Lauf[]): Werk {
  const werk = leeresWerk()
  const ohne = laeufe.filter((l) => l.hinterlegt !== KOMMENTARFARBE)
  const fett = ohne.findIndex((l) => l.fett && l.text.trim())
  if (fett < 0) return werk
  const davor = ohne
    .slice(0, fett)
    .map((l) => l.text)
    .join('')
  const m = davor.match(/^(.*):\s*$/s)
  const personen = m ? zerlegePersonen(m[1]) : null
  if (personen?.length) werk.personen = personen
  let ende = fett
  while (ende < ohne.length && (ohne[ende].fett || !ohne[ende].text.trim())) ende++
  werk.titel = ohne
    .slice(fett, ende)
    .map((l) => l.text)
    .join('')
    .trim()
  return werk
}

export function planeImport(dok: OdtDokument, bestand: Werk[]): ImportPlan {
  const inKartei = new Map(bestand.map((w) => [schluessel(w), w.id]))
  inKartei.delete('')

  const posten: ImportPosten[] = dok.eintraege.map((e) => {
    const r = zerlegeEintrag(e.laeufe)
    let status: PostenStatus = 'hand'
    let werk: Werk
    if (r.status === 'erkannt' && r.werk) {
      status = rueckprobe(r.werk, e.laeufe).ergebnis === 'gleich' ? 'sicher' : 'pruefen'
      werk = r.werk
    } else werk = r.werk ?? teilwerk(e.laeufe)
    werk = { ...werk, status: 'vorlaeufig', vorlage: status === 'sicher' ? '' : r.original, kommentar: r.hinweis }
    const gruppe = schluessel(werk)
    return { abschnittNr: e.abschnittNr, status, werk, gruppe, ...(gruppe && inKartei.has(gruppe) ? { vorhandenId: inKartei.get(gruppe) } : {}) }
  })

  const abschnitt = (nr: number, titel: string): ImportAbschnitt => {
    const eigene = posten.filter((p) => p.abschnittNr === nr)
    const erkannt = eigene.filter((p) => p.status !== 'hand').length
    return { nr, titel, eintraege: eigene.length, erkannt, vorschlag: eigene.length > 0 && erkannt / eigene.length >= 0.5 }
  }
  const davor = posten.some((p) => p.abschnittNr === VOR_DEM_ERSTEN) ? [abschnitt(VOR_DEM_ERSTEN, 'vor dem ersten Absatz')] : []
  const abschnitte = [...davor, ...dok.abschnitte.map((titel, nr) => abschnitt(nr, titel))]
  // Kurze Absätze ohne Einträge direkt vor einem gewählten Abschnitt sind seine Überschrift
  for (let i = abschnitte.length - 1; i >= 0; i--) {
    const a = abschnitte[i]
    if (a.eintraege === 0 && a.titel.length <= UEBERSCHRIFT_LAENGE && abschnitte[i + 1]?.vorschlag) a.vorschlag = true
  }
  return { abschnitte, posten }
}

export interface Aufloesung {
  posten: ImportPosten
  /** Stelle in `plan.posten` */
  i: number
  /** neu = wird Karte; vorhanden = steht in der Kartei; doppelt = weiter oben in der Auswahl */
  art: 'neu' | 'vorhanden' | 'doppelt'
  /** Bei „doppelt“: Stelle des ersten gewählten Fundes */
  vertreter: number
}

/** Was aus den gewählten Einträgen wird. Doppelte zählen innerhalb der Auswahl: der erste gewählte Fund wird die Karte. */
export function aufloesung(plan: ImportPlan, auswahl: Set<number>): Aufloesung[] {
  const erster = new Map<string, number>()
  return plan.posten.flatMap((posten, i): Aufloesung[] => {
    if (!auswahl.has(posten.abschnittNr)) return []
    if (posten.vorhandenId) return [{ posten, i, art: 'vorhanden', vertreter: i }]
    if (posten.gruppe && erster.has(posten.gruppe)) return [{ posten, i, art: 'doppelt', vertreter: erster.get(posten.gruppe)! }]
    if (posten.gruppe) erster.set(posten.gruppe, i)
    return [{ posten, i, art: 'neu', vertreter: i }]
  })
}

/**
 * Legt die Karten an und, wenn ein Name gegeben ist, eine Liste in der Reihenfolge der Datei.
 * Aufeinanderfolgende Abschnitte ohne Einträge werden zu einem Kapitel, die folgenden zu Unterkapiteln.
 */
export function uebernimm(plan: ImportPlan, auswahl: Set<number>, listenName: string | null): { werke: Werk[]; liste?: Literaturliste } {
  const gewaehlt = aufloesung(plan, auswahl)
  const ids = new Map<number, string>()
  const werke: Werk[] = []
  for (const { posten, i, art, vertreter } of gewaehlt) {
    if (art === 'vorhanden') ids.set(i, posten.vorhandenId!)
    else if (art === 'doppelt') ids.set(i, ids.get(vertreter)!)
    else {
      const jetzt = new Date().toISOString()
      const w = { ...posten.werk, id: neueId(), angelegt: jetzt, geaendert: jetzt }
      werke.push(w)
      ids.set(i, w.id)
    }
  }
  if (listenName === null) return { werke }

  const kapitel: Kapitel[] = []
  const kapitelVon = new Map<number, string>()
  let oben: Kapitel | null = null
  let letzterLeer = false
  // Einträge vor dem ersten Absatz stehen in der Liste vor den Kapiteln
  for (const a of plan.abschnitte.filter((x) => auswahl.has(x.nr) && x.nr !== VOR_DEM_ERSTEN)) {
    if (a.eintraege === 0) {
      if (oben && letzterLeer) oben.titel = `${oben.titel} ${a.titel}`
      else {
        oben = { id: neueId(), titel: a.titel, ebene: 1 }
        kapitel.push(oben)
      }
      letzterLeer = true
      continue
    }
    const k: Kapitel = { id: neueId(), titel: a.titel, ebene: oben ? 2 : 1 }
    kapitel.push(k)
    kapitelVon.set(a.nr, k.id)
    letzterLeer = false
  }

  const eintraege: ListenEintrag[] = []
  const drin = new Set<string>()
  for (const { posten, i } of gewaehlt) {
    const werkId = ids.get(i)!
    if (drin.has(werkId)) continue
    drin.add(werkId)
    eintraege.push({ werkId, kapitelId: kapitelVon.get(posten.abschnittNr) ?? '' })
  }
  return { werke, liste: { ...neueListe(listenName, null), kapitel, eintraege, sortierung: 'hand' } }
}
