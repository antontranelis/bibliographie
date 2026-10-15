import { sucheDnb } from './dnb'
import { gruppiere, istIsbn, sucheLobid, type Treffer, type WerkVorschlag } from './lobid'

// Fragt Deutsche Nationalbibliothek und hbz-Verbundkatalog gleichzeitig und führt die Ausgaben zusammen.

const vertraeglich = (a: string, b: string) => !a.trim() || !b.trim() || a.trim() === b.trim()

/**
 * Dieselbe Ausgabe nur, wenn ISBN und Jahr gleich sind und Auflagennummer und Umfang sich nicht widersprechen.
 * Verlage drucken neue Auflagen oft unter derselben ISBN nach; die ISBN allein ist nur ein Hinweis.
 */
export function selbeAusgabe(a: Treffer, b: Treffer): boolean {
  const isbn = istIsbn(a.auflage.isbn)
  return (
    Boolean(isbn) &&
    isbn === istIsbn(b.auflage.isbn) &&
    a.auflage.jahr.trim() !== '' &&
    a.auflage.jahr.trim() === b.auflage.jahr.trim() &&
    vertraeglich(a.auflage.nummer, b.auflage.nummer) &&
    vertraeglich(a.auflage.seiten, b.auflage.seiten)
  )
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
