import { leereAuflage, neueId, type Auflage, type Person } from './model'

// Katalogabfrage beim hbz-Verbundkatalog (lobid.org). Offen, ohne Anmeldung, CORS erlaubt.

export interface LobidRecord {
  id?: string
  hbzId?: string
  title?: string
  otherTitleInformation?: string[] | null
  contribution?: { agent?: { label?: string }; role?: { id?: string } }[] | null
  publication?: { startDate?: string; location?: string[] | string; publishedBy?: string[] | string }[] | null
  edition?: string[] | null
  extent?: string | null
  isbn?: string[] | null
}

export interface Treffer {
  titel: string
  untertitel: string
  personen: Person[]
  auflage: Auflage
}

export interface WerkVorschlag {
  schluessel: string
  titel: string
  untertitel: string
  personen: Person[]
  treffer: Treffer[]
}

const ERSTES = (x: string[] | string | undefined | null) => (Array.isArray(x) ? x[0] ?? '' : x ?? '')

export function personAusLabel(label: string, rolle: Person['rolle']): Person {
  const [nachname, ...rest] = label.split(',')
  return { nachname: nachname.trim(), vorname: rest.join(',').trim(), rolle }
}

export function auflagenNummer(edition: string): string {
  const m = edition.match(/(\d+)\.\s*(?:\[?\s*)?(?:Aufl|Auflage|ed\b|Ausg)/i)
  return m ? m[1] : ''
}

export function seitenAusUmfang(extent: string): { seiten: string; roemisch: string } {
  const roem = extent.match(/^\s*([IVXLC]+)\s*,/)
  const s = extent.match(/(\d+)\s*S\./)
  return { seiten: s ? s[1] : '', roemisch: roem ? roem[1] : '' }
}

export function trefferAusRecord(r: LobidRecord): Treffer {
  const beitraege = r.contribution ?? []
  const autoren = beitraege.filter((c) => c.role?.id?.endsWith('/aut'))
  const hrsg = beitraege.filter((c) => c.role?.id?.endsWith('/edt'))
  const personen: Person[] =
    autoren.length > 0
      ? autoren.map((c) => personAusLabel(c.agent?.label ?? '', 'autor'))
      : hrsg.map((c) => personAusLabel(c.agent?.label ?? '', 'hrsg'))
  const pub = (r.publication ?? [])[0] ?? {}
  const edition = (r.edition ?? [])[0] ?? ''
  const { seiten, roemisch } = seitenAusUmfang(r.extent ?? '')
  const nummer = auflagenNummer(edition)
  return {
    titel: (r.title ?? '').trim(),
    untertitel: (r.otherTitleInformation ?? [])
      .join(' ; ')
      .split(/\s+;\s+/)
      .map((t) => t.trim().replace(/^\p{Ll}/u, (c) => c.toUpperCase()))
      .join('. ')
      .trim(),
    personen,
    auflage: {
      ...leereAuflage(),
      id: neueId(),
      nummer,
      jahr: pub.startDate ?? '',
      verlag: ERSTES(pub.publishedBy),
      ort: ERSTES(pub.location),
      seiten,
      seitenRoemisch: roemisch,
      vermerk: nummer ? '' : edition,
      isbn: (r.isbn ?? []).find((i) => istIsbn(i).length === 13) ?? (r.isbn ?? [])[0] ?? '',
      quelle: { katalog: 'lobid', id: r.hbzId ?? r.id ?? '' },
    },
  }
}

function normal(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/** Vorauswahl: je Erscheinungsjahr nur die erste Ausgabe, weil Bibliotheken dieselbe Ausgabe mehrfach melden. */
export function vorauswahl(treffer: Treffer[]): Set<number> {
  const jahre = new Set<string>()
  const auswahl = new Set<number>()
  treffer.forEach((t, i) => {
    const j = t.auflage.jahr || `ohne-${i}`
    if (!jahre.has(j)) {
      jahre.add(j)
      auswahl.add(i)
    }
  })
  return auswahl
}

/** Fasst Katalogtreffer (je eine Ausgabe) zu Werken zusammen: gleicher Titel, gleiche erste Person. */
export function gruppiere(treffer: Treffer[]): WerkVorschlag[] {
  const gruppen = new Map<string, WerkVorschlag>()
  for (const t of treffer) {
    const p = t.personen[0]
    const schluessel = `${normal(p?.nachname ?? '')}|${normal(t.titel)}`
    const g = gruppen.get(schluessel)
    if (g) {
      g.treffer.push(t)
      if (t.untertitel.length > g.untertitel.length && !/\b\w\.\s/.test(t.untertitel)) g.untertitel = t.untertitel
    } else {
      gruppen.set(schluessel, { schluessel, titel: t.titel, untertitel: t.untertitel, personen: t.personen, treffer: [t] })
    }
  }
  for (const g of gruppen.values()) {
    g.treffer.sort((a, b) => (parseInt(a.auflage.jahr, 10) || 9999) - (parseInt(b.auflage.jahr, 10) || 9999))
  }
  return [...gruppen.values()].sort((a, b) => b.treffer.length - a.treffer.length)
}

/** Die ISBN ohne Bindestriche, wenn der Text eine ist, sonst leer. */
export function istIsbn(text: string): string {
  const roh = text.replace(/[\s-]/g, '').toUpperCase()
  return /^(\d{9}[\dX]|97[89]\d{10})$/.test(roh) ? roh : ''
}

export function suchAnfrage(autor: string, titel: string): string {
  const isbn = istIsbn(titel)
  if (isbn) return `isbn:${isbn}`
  const teile: string[] = []
  const zitat = (s: string) => s.replace(/"/g, '').trim()
  if (autor.trim()) teile.push(`contribution.agent.label:"${zitat(autor)}"`)
  if (titel.trim()) teile.push(`title:"${zitat(titel)}"`)
  return teile.join(' AND ')
}

export async function sucheImKatalog(autor: string, titel: string, signal?: AbortSignal): Promise<WerkVorschlag[]> {
  const q = suchAnfrage(autor, titel)
  if (!q) return []
  const url = `https://lobid.org/resources/search?q=${encodeURIComponent(q)}&format=json&size=100`
  const antwort = await fetch(url, { signal })
  if (!antwort.ok) throw new Error(`Katalog antwortet mit ${antwort.status}`)
  const daten = (await antwort.json()) as { member?: LobidRecord[] }
  return gruppiere((daten.member ?? []).map(trefferAusRecord))
}
