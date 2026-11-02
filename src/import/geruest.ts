import { neueId, type Thema } from '../model'
import { gleichesThema, neuesNach } from '../themen'

// Gesamtgerüst als Themenordnung einlesen. Jede Zeile oder jeder Absatz wird ein Thema; eine Nummer am Anfang
// („V.“, „a)“, „1.2“, „I.A.1a“) wird abgetrennt. Die Ebene ergibt sich, in dieser Reihenfolge, aus der Verschachtelung
// der Aufzählung, aus der Art der Nummern oder aus der Einrückung.

const NUMMER = /^((?:(?:[IVXLCDM]+|\d+)(?:\.[A-Za-z0-9/]+)+|[IVXLCDM]+|[ivxlc]{2,}|[A-Za-z]|\d+)[.)]?)\s+(\S.*)$/

/** Zusammengesetzter Code: römische Zahl oder Ziffer vorn, dann Glieder nach Punkten */
const CODE = /^(?:[IVXLCDM]+|\d+)\.[A-Za-z0-9]/

/** Zahl der Glieder: „I.A.1a1“ → I, A, 1, a, 1; „1/2“ ist ein Glied */
function glieder(nummer: string): number {
  const [kopf, ...rest] = nummer.replace(/[.)]$/, '').split('.')
  return (kopf ? 1 : 0) + rest.reduce((n, teil) => n + (teil.match(/\d+(?:\/\d+)*|[A-Za-z]/g)?.length ?? 0), 0)
}

/** „V. Medien“ → Nummer „V.“, Titel „Medien“. Ein Wort ohne Satzzeichen nach einem Buchstaben ist keine Nummer. */
export function nummerUndTitel(text: string): { nummer: string; titel: string } {
  const t = text.replace(/\s+/g, ' ').trim()
  const m = t.match(NUMMER)
  if (!m) return { nummer: '', titel: t }
  const nummer = m[1]
  // Ohne Punkt oder Klammer nur Ziffern: „Die Medien“ ist kein „D“ mit Titel
  if (!/[.)]$/.test(nummer) && !/^\d/.test(nummer) && !CODE.test(nummer)) return { nummer: '', titel: t }
  // „I.A. A. Bildekräfte“: der letzte Buchstabe des Codes steht noch einmal vor dem Titel
  const letzter = nummer.replace(/[.)]$/, '').match(/\.([A-Za-z])$/)?.[1]
  const titel = letzter ? m[2].replace(new RegExp(`^${letzter}[.)]\\s+(?=\\S)`), '') : m[2]
  return { nummer, titel: titel.trim() }
}

/** Art einer Nummer: römisch, Buchstabe, Ziffer, jeweils mit Satzzeichen; Dezimalnummern zählen nach Teilen. */
function art(nummer: string): string {
  const satz = nummer.slice(-1).match(/[.)]/)?.[0] ?? ''
  const kern = satz ? nummer.slice(0, -1) : nummer
  if (/^\d+$/.test(kern)) return `ziffer${satz}`
  if (CODE.test(kern)) return 'dezimal'
  if (/^[IVXLCDM]+$/.test(kern)) return `roemisch${satz}`
  if (/^[ivxlc]{2,}$/.test(kern)) return `roemisch-klein${satz}`
  if (/^[A-Z]$/.test(kern)) return `Buchstabe${satz}`
  return `buchstabe${satz}`
}


interface Zeile {
  text: string
  /** Hinweis aus der Datei: Verschachtelung oder Einrückung; größer = tiefer */
  tiefe: number
}

/** Ebenen bestimmen und den Baum bauen. */
function bauen(zeilen: Zeile[]): Thema[] {
  const eintraege = zeilen.map((z) => ({ ...z, ...nummerUndTitel(z.text) })).filter((z) => z.titel)
  if (eintraege.length === 0) return []
  const tiefen = [...new Set(eintraege.map((z) => z.tiefe))].sort((a, b) => a - b)
  const nummeriert = eintraege.filter((z) => z.nummer).length >= eintraege.length / 2
  const dezimal = eintraege.some((z) => z.nummer && art(z.nummer) === 'dezimal')

  const ebenen: number[] = []
  if (tiefen.length > 1) {
    // Verschachtelung oder Einrückung: der Rang der Tiefe ist die Ebene
    for (const z of eintraege) ebenen.push(tiefen.indexOf(z.tiefe))
  } else if (nummeriert) {
    // Nummern: die erste Art oben, jede neue Art eine Ebene unter der vorigen Zeile; Dezimalnummern nach Teilen
    const ebeneVonArt = new Map<string, number>()
    let vorige = -1
    for (const z of eintraege) {
      let e: number
      if (!z.nummer) e = Math.max(vorige, 0)
      // Codes und ihre obersten Nummern („I.“ zu „I.A.1“, „1“ zu „1.2“) nach der Zahl ihrer Glieder
      else if (dezimal && (CODE.test(z.nummer) || /^(?:[IVXLCDM]+|\d+)[.)]?$/.test(z.nummer))) e = glieder(z.nummer) - 1
      else {
        const a = art(z.nummer)
        if (!ebeneVonArt.has(a)) ebeneVonArt.set(a, vorige + 1)
        e = ebeneVonArt.get(a)!
      }
      ebenen.push(e)
      vorige = e
    }
  } else eintraege.forEach(() => ebenen.push(0))

  // Baum: keine Sprünge um mehr als eine Ebene nach unten
  const themen: Thema[] = []
  const eltern: string[] = []
  let vorige = -1
  eintraege.forEach((z, i) => {
    const e = Math.min(ebenen[i], vorige + 1)
    const thema: Thema = { id: neueId(), nummer: z.nummer, titel: z.titel, elternId: e > 0 ? eltern[e - 1] : '' }
    eltern[e] = thema.id
    eltern.length = e + 1
    themen.push(thema)
    vorige = e
  })
  return themen
}

/** Aus einer Textdatei: eine Zeile je Thema, Einrückung als Hinweis. */
export function geruestAusText(text: string): Thema[] {
  return bauen(
    text
      .split(/\r?\n/)
      .filter((z) => z.trim())
      .map((z) => ({ text: z, tiefe: z.replace(/\t/g, '    ').match(/^ */)![0].length })),
  )
}

/** Aus Absätzen eines Dokuments, tiefe = Verschachtelung der Aufzählung (0 = keine). */
export function geruestAusAbsaetzen(absaetze: { text: string; tiefe: number }[]): Thema[] {
  return bauen(absaetze.filter((a) => a.text.trim()))
}

/** Gerüst in eine bestehende Ordnung einfügen: gleiche Themen am selben Ort zusammenführen, die übrigen anhängen. */
export function fuegeEin(bestand: Thema[], geruest: Thema[]): { themen: Thema[]; neu: number } {
  let themen = [...bestand]
  const abbild = new Map<string, string>()
  let neu = 0
  for (const t of geruest) {
    const elternId = t.elternId ? (abbild.get(t.elternId) ?? '') : ''
    const da = themen.find((x) => x.elternId === elternId && gleichesThema(x, t.nummer, t.titel))
    if (da) abbild.set(t.id, da.id)
    else {
      const thema = { ...t, id: neueId(), elternId }
      themen = neuesNach(themen, thema)
      abbild.set(t.id, thema.id)
      neu++
    }
  }
  return { themen, neu }
}
