import { leereAuflage, neueId, type Person } from './model'
import { auflagenNummer, besteIsbn, istIsbn, personAusLabel, seitenAusUmfang, untertitelAus, type Treffer } from './lobid'

// Katalogabfrage bei der Deutschen Nationalbibliothek (SRU, MARC21-XML). Offen, ohne Anmeldung, CORS erlaubt.

export interface MarcFeld {
  tag: string
  ind2: string
  unter: { code: string; wert: string }[]
}

export interface MarcDatensatz {
  leader: string
  kontrolle: Record<string, string>
  felder: MarcFeld[]
}

function dekodiere(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([\da-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

/** Liest MARC21-XML. Bewusst ohne DOM, damit es im Browser und in Node gleich läuft. */
export function leseMarc(xml: string): MarcDatensatz[] {
  const saetze: MarcDatensatz[] = []
  for (const [, inhalt] of xml.matchAll(/<record\b[^>]*type="Bibliographic"[^>]*>([\s\S]*?)<\/record>/g)) {
    const leader = dekodiere(inhalt.match(/<leader>([^<]*)<\/leader>/)?.[1] ?? '')
    const kontrolle: Record<string, string> = {}
    for (const [, tag, wert] of inhalt.matchAll(/<controlfield tag="(\d+)">([^<]*)<\/controlfield>/g)) kontrolle[tag] ??= dekodiere(wert)
    const felder: MarcFeld[] = []
    for (const [, tag, ind2, rumpf] of inhalt.matchAll(/<datafield tag="(\d+)" ind1="[^"]*" ind2="([^"]*)">([\s\S]*?)<\/datafield>/g)) {
      const unter = [...rumpf.matchAll(/<subfield code="([^"]+)">([^<]*)<\/subfield>/g)].map(([, code, wert]) => ({ code, wert: dekodiere(wert) }))
      felder.push({ tag, ind2, unter })
    }
    saetze.push({ leader, kontrolle, felder })
  }
  return saetze
}

const felder = (d: MarcDatensatz, tag: string) => d.felder.filter((f) => f.tag === tag)
const unter = (f: MarcFeld | undefined, code: string) => f?.unter.filter((u) => u.code === code).map((u) => u.wert) ?? []
const erstes = (f: MarcFeld | undefined, code: string) => unter(f, code)[0] ?? ''

/** Nicht mitsortierte Artikel sind in der DNB mit Steuerzeichen markiert: U+0098 … U+009C. */
const ohneSteuerzeichen = (s: string) => s.replace(/[\u0098\u009c¬]/g, '').replace(/\s{2,}/g, ' ').trim()
const ohneSatzzeichenAmEnde = (s: string) => s.replace(/[\s/:;,=]+$/, '').trim()
const ohneKlammern = (s: string) => s.replace(/^\[|\]$/g, '').trim()

function ort(text: string): string {
  const o = ohneSatzzeichenAmEnde(ohneKlammern(text))
  return /^(s\.\s?l\.?|o\.\s?o\.?|ohne ort)$/i.test(o) ? '' : o
}

/** Ein Treffer pro gedrucktem Buch. E-Books, Hörbücher und andere Medien fallen weg. */
export function trefferAusMarc(d: MarcDatensatz): Treffer | null {
  if (d.leader[6] !== 'a') return null
  if (felder(d, '337').some((f) => unter(f, 'b').includes('c'))) return null
  if (felder(d, '300').some((f) => /online-ressource/i.test(erstes(f, 'a')))) return null

  const titelFeld = felder(d, '245')[0]
  const titel = ohneSatzzeichenAmEnde(ohneSteuerzeichen(erstes(titelFeld, 'a')))
  if (!titel) return null

  const beteiligte = [...felder(d, '100'), ...felder(d, '700')].filter((f) => !unter(f, 't').length)
  const mitRolle = (rolle: string) => beteiligte.filter((f) => unter(f, '4').includes(rolle)).map((f) => erstes(f, 'a'))
  const autoren = mitRolle('aut')
  const personen: Person[] =
    autoren.length > 0 ? autoren.map((a) => personAusLabel(a, 'autor')) : mitRolle('edt').map((a) => personAusLabel(a, 'hrsg'))

  const pub = felder(d, '264').find((f) => f.ind2 === '1') ?? felder(d, '260')[0] ?? felder(d, '264')[0]
  const edition = ohneSatzzeichenAmEnde(erstes(felder(d, '250')[0], 'a'))
  const nummer = auflagenNummer(edition)
  const { seiten, roemisch } = seitenAusUmfang(erstes(felder(d, '300')[0], 'a'))

  return {
    titel,
    untertitel: untertitelAus(unter(titelFeld, 'b').map(ohneSteuerzeichen)),
    personen,
    auflage: {
      ...leereAuflage(),
      id: neueId(),
      nummer,
      jahr: erstes(pub, 'c').match(/\d{4}/)?.[0] ?? '',
      verlag: ohneSatzzeichenAmEnde(ohneKlammern(erstes(pub, 'b'))),
      ort: ort(erstes(pub, 'a')),
      seiten,
      seitenRoemisch: roemisch,
      vermerk: nummer ? '' : edition,
      isbn: besteIsbn(felder(d, '020').flatMap((f) => unter(f, 'a'))),
      quelle: { katalog: 'dnb', id: d.kontrolle['001'] ?? '' },
    },
  }
}

/** CQL-Anfrage an die DNB. */
export function dnbAnfrage(autor: string, titel: string): string {
  const isbn = istIsbn(titel)
  if (isbn) return `num=${isbn}`
  const zitat = (s: string) => s.replace(/"/g, '').trim()
  const teile: string[] = []
  if (titel.trim()) teile.push(`tit="${zitat(titel)}"`)
  if (autor.trim()) teile.push(`per="${zitat(autor)}"`)
  return teile.join(' and ')
}

const SEITE = 100
const HOECHSTENS = 300

/** Ausgaben aus der Deutschen Nationalbibliothek, bis zu drei Seiten zu je 100 Datensätzen. */
export async function sucheDnb(autor: string, titel: string, signal?: AbortSignal): Promise<Treffer[]> {
  const q = dnbAnfrage(autor, titel)
  if (!q) return []
  const seite = async (start: number) => {
    const url =
      'https://services.dnb.de/sru/dnb?version=1.1&operation=searchRetrieve&recordSchema=MARC21-xml' +
      `&maximumRecords=${SEITE}&startRecord=${start}&query=${encodeURIComponent(q)}`
    const antwort = await fetch(url, { signal })
    if (!antwort.ok) throw new Error(`DNB antwortet mit ${antwort.status}`)
    return antwort.text()
  }
  const erste = await seite(1)
  const gesamt = parseInt(erste.match(/<numberOfRecords>(\d+)<\/numberOfRecords>/)?.[1] ?? '0', 10)
  const weitere = []
  for (let start = SEITE + 1; start <= Math.min(gesamt, HOECHSTENS); start += SEITE) weitere.push(seite(start))
  const texte = [erste, ...(await Promise.all(weitere))]
  return texte.flatMap(leseMarc).map(trefferAusMarc).filter((t): t is Treffer => t !== null)
}
