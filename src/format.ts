import type { Auflage, ErschienenIn, Person, Werk } from './model'

export interface Stil {
  /** 'ort': „Titel. Untertitel, Ort Jahr“; 'verlag': „Titel. Untertitel. Verlag, Ort Jahr“ */
  muster: 'ort' | 'verlag'
  namensfolge: 'vorname-name' | 'name-vorname'
  untertitelTrenner: '. ' | ' – ' | ': '
  auflagen: 'erste' | 'alle'
  seitenzahl: boolean
  isbn: boolean
  /** Auszeichnung des Obertitels von Buch oder Aufsatz; Sammelbände folgen ihr, Zeitschriften stehen kursiv */
  titelAuszeichnung: 'fett' | 'halbfett' | 'keine'
  /** Zwischen mehreren Personen: „A/B“ oder „A / B“ */
  personenTrenner: '/' | ' / '
  /** Beiträge in Klammern „(in: …)“ oder mit Komma „, in: …“ */
  beitragsform: 'klammer' | 'komma'
  /** Punkt am Ende jeder Zeile */
  schlusspunkt: boolean
  /** Anmerkung für den Druck als „(Anm.: …)“ mitdrucken */
  anmerkungen: boolean
}

/** Voreinstellung nach den Literaturlisten von Jens Göken. */
export const STANDARD_STIL: Stil = {
  muster: 'ort',
  namensfolge: 'vorname-name',
  untertitelTrenner: '. ',
  auflagen: 'erste',
  seitenzahl: false,
  isbn: false,
  titelAuszeichnung: 'fett',
  personenTrenner: '/',
  beitragsform: 'klammer',
  schlusspunkt: false,
  anmerkungen: true,
}

/** Ein Stück der Druckzeile mit Auszeichnung. */
export interface Teil {
  text: string
  auszeichnung?: 'fett' | 'halbfett'
  kursiv?: boolean
}

const klar = (text: string): Teil => ({ text })

/** Benachbarte Teile mit gleicher Auszeichnung zusammenfassen, leere entfernen. */
export function verdichte(teile: Teil[]): Teil[] {
  const aus: Teil[] = []
  for (const t of teile) {
    if (!t.text) continue
    const letzter = aus[aus.length - 1]
    if (letzter && letzter.auszeichnung === t.auszeichnung && Boolean(letzter.kursiv) === Boolean(t.kursiv)) letzter.text += t.text
    else aus.push({ ...t })
  }
  return aus
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
  const text = liste.map((p) => name(p, stil.namensfolge)).join(stil.personenTrenner)
  return liste.every((p) => p.rolle === 'hrsg') ? `${text} (Hrsg.)` : text
}

function titelTeile(werk: Werk, stil: Stil): Teil[] {
  const t = werk.titel.trim()
  const u = werk.untertitel.trim()
  const auszeichnung = stil.titelAuszeichnung === 'keine' ? undefined : stil.titelAuszeichnung
  return [{ text: t, auszeichnung }, ...(u ? [klar(`${stil.untertitelTrenner}${u}`)] : [])]
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

/** Ausgabenangabe einer Zeitschrift: die gedruckte Fassung oder aus Jahrgang, Heft und Jahr zusammengesetzt. */
function ausgabeText(e: ErschienenIn): string {
  const frei = e.ausgabe.trim()
  if (frei) return /^[,.]/.test(frei) ? frei : ` ${frei}`
  const jg = e.jahrgang.trim()
  const h = e.heft.trim()
  const j = e.jahr.trim()
  const heftJahr = h && j ? `${h}/${j}` : h || j
  if (jg) return `, ${jg}. Jg.${heftJahr ? `, ${heftJahr}` : ''}`
  return heftJahr ? ` ${heftJahr}` : ''
}

function erschienenInTeile(e: ErschienenIn, stil: Stil): Teil[] {
  const sammelband = e.art === 'sammelband'
  const auszeichnung = stil.titelAuszeichnung === 'keine' ? undefined : stil.titelAuszeichnung
  const titel: Teil = sammelband ? { text: e.titel.trim(), auszeichnung } : { text: e.titel.trim(), kursiv: true }
  const von = e.seitenVon.trim()
  const bis = e.seitenBis.trim()
  const s = von ? `, S. ${bis ? `${von}–${bis}` : von}` : ''
  return [klar('in: '), titel, klar(`${ausgabeText(e)}${s}`)]
}

/** Eine Zeile der Literaturliste, in Teile mit Auszeichnung zerlegt. */
/** Die Anmerkung steht kursiv; mit *…* markierte Titel darin stehen aufrecht. */
function anmerkungTeile(anm: string): Teil[] {
  return `(Anm.: ${anm})`
    .split('*')
    .map((text, i): Teil => (i % 2 === 1 ? { text } : { text, kursiv: true }))
    .filter((t) => t.text)
}

export function druckzeileTeile(werk: Werk, stil: Stil = STANDARD_STIL): Teil[] {
  const kopf = personen(werk, stil)
  const teile: Teil[] = [...(kopf ? [klar(`${kopf}: `)] : []), ...titelTeile(werk, stil)]

  if (werk.art === 'aufsatz' && werk.erschienenIn?.titel.trim()) {
    const ein = erschienenInTeile(werk.erschienenIn, stil)
    if (stil.beitragsform === 'klammer') teile.push(klar(' ('), ...ein, klar(')'))
    else teile.push(klar(', '), ...ein)
  } else {
    const auflagen = werk.auflagen.filter((a) => a.jahr.trim() || a.ort.trim() || a.verlag.trim())
    const gewaehlt = stil.auflagen === 'alle' ? auflagen : auflagen.slice(0, 1)
    const imp = gewaehlt.map((a) => impressum(a, stil)).filter(Boolean)
    if (imp.length > 0) teile.push(klar(stil.muster === 'verlag' ? `. ${imp.join('; ')}` : `, ${imp.join('; ')}`))
  }

  const anm = werk.anmerkung?.trim()
  if (stil.anmerkungen && anm) teile.push(klar(' '), ...anmerkungTeile(anm))

  if (stil.schlusspunkt) {
    const text = teile.map((t) => t.text).join('')
    if (!text.endsWith('.')) teile.push(klar('.'))
  }
  return verdichte(teile)
}

/** Eine Zeile der Literaturliste als reiner Text. */
export function druckzeile(werk: Werk, stil: Stil = STANDARD_STIL): string {
  return druckzeileTeile(werk, stil)
    .map((t) => t.text)
    .join('')
}

function sortierName(werk: Werk): string {
  const p = werk.personen.find((x) => x.nachname.trim() || x.vorname.trim())
  return p ? `${p.nachname.trim()} ${p.vorname.trim()}` : werk.titel.trim()
}

function ersteJahr(werk: Werk): number {
  const jahre = [...werk.auflagen.map((a) => a.jahr), werk.erschienenIn?.jahr ?? '']
    .map((j) => parseInt(j, 10))
    .filter((j) => !Number.isNaN(j))
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
