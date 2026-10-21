import { neueId, type Thema } from './model'

// Themenordnung als Baum: Thema mit Elternthema, Geschwister in der Reihenfolge des Datenbestands.

export interface Knoten {
  thema: Thema
  tiefe: number
}

export const bezeichnung = (t: Thema) => [t.nummer.trim(), t.titel.trim()].filter(Boolean).join(' ')

/** Alle Themen in Lesereihenfolge mit ihrer Tiefe. Themen mit unbekanntem Eltern gelten als oberste Ebene. */
export function baum(themen: Thema[]): Knoten[] {
  const ids = new Set(themen.map((t) => t.id))
  const kinder = new Map<string, Thema[]>()
  for (const t of themen) {
    const eltern = ids.has(t.elternId) ? t.elternId : ''
    kinder.set(eltern, [...(kinder.get(eltern) ?? []), t])
  }
  const aus: Knoten[] = []
  const besucht = new Set<string>()
  const gehe = (eltern: string, tiefe: number) => {
    for (const t of kinder.get(eltern) ?? []) {
      if (besucht.has(t.id)) continue
      besucht.add(t.id)
      aus.push({ thema: t, tiefe })
      gehe(t.id, tiefe + 1)
    }
  }
  gehe('', 0)
  return aus
}

/** „V. Medien › a) Manipulation“ */
export function pfad(themen: Thema[], id: string): string {
  const nachId = new Map(themen.map((t) => [t.id, t]))
  const teile: string[] = []
  const gesehen = new Set<string>()
  for (let t = nachId.get(id); t && !gesehen.has(t.id); t = nachId.get(t.elternId)) {
    gesehen.add(t.id)
    teile.unshift(bezeichnung(t))
  }
  return teile.join(' › ')
}

/** Das Thema und alle seine Unterthemen. */
export function unterthemen(themen: Thema[], id: string): Set<string> {
  const menge = new Set([id])
  let gewachsen = true
  while (gewachsen) {
    gewachsen = false
    for (const t of themen) if (menge.has(t.elternId) && !menge.has(t.id)) (menge.add(t.id), (gewachsen = true))
  }
  return menge
}

/** Lesereihenfolge als Datenbestand: so bleiben Geschwisterfolgen eindeutig. */
const geordnet = (themen: Thema[]) => baum(themen).map((k) => k.thema)

/** Neues Thema als letztes Kind von elternId (leer = oberste Ebene). */
export function neuesThema(themen: Thema[], elternId: string): { themen: Thema[]; thema: Thema } {
  const thema: Thema = { id: neueId(), nummer: '', titel: '', elternId }
  const liste = geordnet(themen)
  if (!elternId) return { themen: [...liste, thema], thema }
  const zweig = unterthemen(liste, elternId)
  let i = liste.findIndex((t) => t.id === elternId)
  while (i + 1 < liste.length && zweig.has(liste[i + 1].id)) i++
  return { themen: [...liste.slice(0, i + 1), thema, ...liste.slice(i + 1)], thema }
}

/** Mit allen Unterthemen eine Stelle unter den Geschwistern nach oben oder unten. */
export function verschiebe(themen: Thema[], id: string, richtung: -1 | 1): Thema[] {
  const liste = geordnet(themen)
  const t = liste.find((x) => x.id === id)
  if (!t) return themen
  const geschwister = liste.filter((x) => x.elternId === t.elternId)
  const i = geschwister.findIndex((x) => x.id === id)
  const nachbar = geschwister[i + richtung]
  if (!nachbar) return themen
  const zweig = (x: Thema) => {
    const m = unterthemen(liste, x.id)
    return liste.filter((y) => m.has(y.id))
  }
  const [oben, unten] = richtung === -1 ? [zweig(t), zweig(nachbar)] : [zweig(nachbar), zweig(t)]
  const ohne = new Set([...oben, ...unten].map((x) => x.id))
  const start = liste.findIndex((x) => ohne.has(x.id))
  const rest = liste.filter((x) => !ohne.has(x.id))
  return [...rest.slice(0, start), ...oben, ...unten, ...rest.slice(start)]
}

/** Wird letztes Unterthema des vorigen Geschwisters. */
export function einruecken(themen: Thema[], id: string): Thema[] {
  const liste = geordnet(themen)
  const t = liste.find((x) => x.id === id)
  if (!t) return themen
  const geschwister = liste.filter((x) => x.elternId === t.elternId)
  const vorher = geschwister[geschwister.findIndex((x) => x.id === id) - 1]
  if (!vorher) return themen
  return geordnet(liste.map((x) => (x.id === id ? { ...x, elternId: vorher.id } : x)))
}

/** Wird Geschwister seines Elternthemas, direkt dahinter. */
export function ausruecken(themen: Thema[], id: string): Thema[] {
  const liste = geordnet(themen)
  const t = liste.find((x) => x.id === id)
  const eltern = t && liste.find((x) => x.id === t.elternId)
  if (!t || !eltern) return themen
  const zweig = unterthemen(liste, id)
  const bewegt = liste.filter((x) => zweig.has(x.id)).map((x) => (x.id === id ? { ...x, elternId: eltern.elternId } : x))
  const rest = liste.filter((x) => !zweig.has(x.id))
  const elternZweig = unterthemen(rest, eltern.id)
  let i = rest.findIndex((x) => x.id === eltern.id)
  while (i + 1 < rest.length && elternZweig.has(rest[i + 1].id)) i++
  return [...rest.slice(0, i + 1), ...bewegt, ...rest.slice(i + 1)]
}

/** Entfernt das Thema mit allen Unterthemen; die IDs braucht, wer Karten davon lösen will. */
export function entfernen(themen: Thema[], id: string): { themen: Thema[]; entfernt: Set<string> } {
  const entfernt = unterthemen(themen, id)
  return { themen: themen.filter((t) => !entfernt.has(t.id)), entfernt }
}

const normalTitel = (s: string) => s.toLocaleLowerCase('de').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

/** Dasselbe Thema: gleiche Bezeichnung, oder gleiche Nummer und ein Titel beginnt mit dem anderen. */
export function gleichesThema(t: Thema, nummer: string, titel: string): boolean {
  const a = normalTitel(t.titel)
  const b = normalTitel(titel)
  if (normalTitel(t.nummer) !== normalTitel(nummer)) return false
  if (a === b) return true
  return Boolean(nummer) && Boolean(a) && Boolean(b) && (a.startsWith(`${b} `) || b.startsWith(`${a} `))
}

/** Neues Thema hinter die letzten Nachkommen seines Elternthemas, oberste Ebene ans Ende. */
export function neuesNach(themen: Thema[], thema: Thema): Thema[] {
  if (!thema.elternId) return [...themen, thema]
  const zweig = unterthemen(themen, thema.elternId)
  let letzte = -1
  themen.forEach((t, i) => zweig.has(t.id) && (letzte = i))
  return letzte < 0 ? [...themen, thema] : [...themen.slice(0, letzte + 1), thema, ...themen.slice(letzte + 1)]
}
