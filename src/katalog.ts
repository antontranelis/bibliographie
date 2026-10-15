import { sucheDnb } from './dnb'
import { gruppiere, istIsbn, sucheLobid, type Treffer, type WerkVorschlag } from './lobid'

// Fragt Deutsche Nationalbibliothek und hbz-Verbundkatalog gleichzeitig und führt die Ausgaben zusammen.

const textNormal = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/**
 * Dieselbe Ausgabe nur bei vollständiger Übereinstimmung von ISBN, Jahr, Auflagennummer, Umfang und Vermerk.
 * Verlage drucken neue Auflagen oft unter derselben ISBN nach. Eine fehlende Angabe ist kein Beleg für Gleichheit:
 * im Zweifel bleiben beide Treffer zur Auswahl.
 */
export function selbeAusgabe(a: Treffer, b: Treffer): boolean {
  const isbn = istIsbn(a.auflage.isbn)
  if (!isbn || isbn !== istIsbn(b.auflage.isbn)) return false
  return (['jahr', 'nummer', 'seiten', 'vermerk'] as const).every((f) => {
    const x = textNormal(a.auflage[f])
    return x !== '' || f === 'vermerk' ? x === textNormal(b.auflage[f]) : false
  })
}

/** Dieselbe Ausgabe aus mehreren Katalogen nur einmal. Im Zweifel bleiben beide zur Auswahl. */
export function ohneDoppelte(treffer: Treffer[]): Treffer[] {
  const behalten: Treffer[] = []
  for (const t of treffer) if (!behalten.some((b) => selbeAusgabe(b, t))) behalten.push(t)
  return behalten
}

export async function sucheImKatalog(autor: string, titel: string, signal?: AbortSignal): Promise<WerkVorschlag[]> {
  const ergebnisse = await Promise.allSettled([sucheDnb(autor, titel, signal), sucheLobid(autor, titel, signal)])
  const erfolgreich = ergebnisse.filter((e): e is PromiseFulfilledResult<Treffer[]> => e.status === 'fulfilled')
  if (erfolgreich.length === 0) {
    const grund = (ergebnisse[0] as PromiseRejectedResult).reason
    throw grund instanceof Error ? grund : new Error('Kein Katalog erreichbar')
  }
  return gruppiere(ohneDoppelte(erfolgreich.flatMap((e) => e.value)))
}
