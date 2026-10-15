import { sucheDnb } from './dnb'
import { gruppiere, istIsbn, sucheLobid, type Treffer, type WerkVorschlag } from './lobid'

// Fragt Deutsche Nationalbibliothek und hbz-Verbundkatalog gleichzeitig und führt die Ausgaben zusammen.

/** Dieselbe Ausgabe aus beiden Katalogen nur einmal, erkannt an der ISBN. Ohne ISBN bleibt alles stehen. */
export function ohneDoppelte(treffer: Treffer[]): Treffer[] {
  const gesehen = new Set<string>()
  return treffer.filter((t) => {
    const isbn = istIsbn(t.auflage.isbn)
    if (!isbn) return true
    if (gesehen.has(isbn)) return false
    gesehen.add(isbn)
    return true
  })
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
