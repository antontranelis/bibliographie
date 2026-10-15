import type { Auflage, Person, Werk } from './model'

export interface Stil {
  /** 'ort': Muster aus der Skizze; 'verlag': Variante mit Verlagsname */
  muster: 'ort' | 'verlag'
  namensfolge: 'vorname-name' | 'name-vorname'
  untertitelTrenner: '. ' | ' – ' | ': '
  auflagen: 'erste' | 'alle'
  seitenzahl: boolean
  isbn: boolean
}

export const STANDARD_STIL: Stil = {
  muster: 'ort',
  namensfolge: 'vorname-name',
  untertitelTrenner: '. ',
  auflagen: 'erste',
  seitenzahl: false,
  isbn: false,
}

function name(p: Person, folge: Stil['namensfolge']): string {
  const v = p.vorname.trim()
  const n = p.nachname.trim()
  if (!v) return n
  if (!n) return v
  return folge === 'name-vorname' ? `${n}, ${v}` : `${v} ${n}`
}

export function personen(werk: Werk, stil: Stil): string {
  const liste = werk.personen.filter((p) => p.vorname.trim() || p.nachname.trim())
  if (liste.length === 0) return ''
  const text = liste.map((p) => name(p, stil.namensfolge)).join(' / ')
  return liste.every((p) => p.rolle === 'hrsg') ? `${text} (Hrsg.)` : text
}

function titel(werk: Werk, stil: Stil): string {
  const t = werk.titel.trim()
  const u = werk.untertitel.trim()
  return u ? `${t}${stil.untertitelTrenner}${u}` : t
}

function jahr(a: Auflage): string {
  const j = a.jahr.trim()
  const g = a.gedrucktesJahr.trim()
  if (g && g !== j) return j ? `${j} (im Druck: ${g})` : g
  return j
}

function seiten(a: Auflage): string {
  const r = a.seitenRoemisch.trim()
  const s = a.seiten.trim()
  if (r && s) return `${r} + ${s} S.`
  if (s) return `${s} S.`
  if (r) return `${r} S.`
  return ''
}

function auflagenNummer(a: Auflage): string {
  const n = a.nummer.trim()
  return n && n !== '1' ? `${n}. Aufl.` : ''
}

function impressum(a: Auflage, stil: Stil): string {
  const ort = a.ort.trim()
  const verlag = a.verlag.trim()
  const kopf = stil.muster === 'verlag' ? [verlag, ort].filter(Boolean).join(', ') : ort
  const zaehlung = auflagenNummer(a)
  const ende = [zaehlung, jahr(a)].filter(Boolean).join(' ')
  let text: string
  if (kopf && zaehlung) text = `${kopf}, ${ende}`
  else text = [kopf, ende].filter(Boolean).join(' ')
  if (stil.seitenzahl && seiten(a)) text += `, ${seiten(a)}`
  if (stil.isbn && a.isbn.trim()) text += `, ISBN ${a.isbn.trim()}`
  return text
}

function erschienenIn(werk: Werk): string {
  const e = werk.erschienenIn
  if (!e || !e.titel.trim()) return ''
  const teile = [`in: ${e.titel.trim()}`]
  if (e.art === 'sammelband') {
    // Sammelband: Titel genügt, Seiten folgen
  } else {
    const jg = e.jahrgang.trim() ? ` ${e.jahrgang.trim()}. Jg.` : ''
    const j = e.jahr.trim() ? ` (${e.jahr.trim()})` : ''
    teile[0] += `${jg}${j}`
    if (e.heft.trim()) teile.push(`Nr. ${e.heft.trim()}`)
  }
  const von = e.seitenVon.trim()
  const bis = e.seitenBis.trim()
  if (von) teile.push(bis ? `S. ${von}–${bis}` : `S. ${von}`)
  return teile.join(', ')
}

/** Eine Zeile der Literaturliste. */
export function druckzeile(werk: Werk, stil: Stil = STANDARD_STIL): string {
  const kopf = personen(werk, stil)
  const t = titel(werk, stil)
  let zeile = kopf ? `${kopf}: ${t}` : t

  if (werk.art === 'aufsatz' && werk.erschienenIn?.titel.trim()) {
    return schluss(`${zeile}, ${erschienenIn(werk)}`)
  }

  const auflagen = werk.auflagen.filter((a) => a.jahr.trim() || a.ort.trim() || a.verlag.trim())
  const gewaehlt = stil.auflagen === 'alle' ? auflagen : auflagen.slice(0, 1)
  const imp = gewaehlt.map((a) => impressum(a, stil)).filter(Boolean)
  if (imp.length > 0) {
    zeile += stil.muster === 'verlag' ? `. ${imp.join('; ')}` : `, ${imp.join('; ')}`
  }
  return schluss(zeile)
}

function schluss(zeile: string): string {
  return zeile.endsWith('.') ? zeile : `${zeile}.`
}

function sortierName(werk: Werk): string {
  const p = werk.personen.find((x) => x.nachname.trim() || x.vorname.trim())
  return p ? `${p.nachname.trim()} ${p.vorname.trim()}` : werk.titel.trim()
}

function ersteJahr(werk: Werk): number {
  const jahre = werk.auflagen.map((a) => parseInt(a.jahr, 10)).filter((j) => !Number.isNaN(j))
  return jahre.length ? Math.min(...jahre) : 9999
}

/** Sortierung nach Nachname, innerhalb gleicher Namen nach Jahr; oder chronologisch. */
export function sortiere(werke: Werk[], nach: 'name' | 'jahr'): Werk[] {
  const vgl = (a: string, b: string) => a.localeCompare(b, 'de', { sensitivity: 'base' })
  return [...werke].sort((a, b) => {
    if (nach === 'jahr') return ersteJahr(a) - ersteJahr(b) || vgl(sortierName(a), sortierName(b))
    return vgl(sortierName(a), sortierName(b)) || ersteJahr(a) - ersteJahr(b) || vgl(a.titel, b.titel)
  })
}
