import { AUSGABE_ARTEN, type Auflage, type Ausgabe, type ErschienenIn, type Person, type Werk } from './model'

export interface Stil {
  /** 'ort': „Titel. Untertitel, Ort Jahr“; 'verlag': „Titel. Untertitel. Verlag, Ort Jahr“ */
  muster: 'ort' | 'verlag'
  namensfolge: 'vorname-name' | 'name-vorname'
  untertitelTrenner: '. ' | ' – ' | ': '
  /** 'auswahl': die zum Nennen markierten Auflagen und alle Ausgaben; 'alle': jede Auflage; 'erste': nur die erste Auflage */
  auflagen: 'auswahl' | 'alle' | 'erste'
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
  auflagen: 'auswahl',
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

function titelTeile(titel: string, untertitel: string, stil: Stil): Teil[] {
  const t = titel.trim()
  const u = untertitel.trim()
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
  const b = a.bearbeitung.trim()
  if (!b) return n && n !== '1' ? `${n}. Aufl.` : ''
  return `${n ? `${n}. ` : ''}${b} Aufl.`
}

const gefuellt = (a: Auflage) => Boolean(a.jahr.trim() || a.ort.trim() || a.verlag.trim())

/** Ort, im Muster „verlag“ mit Verlag davor. */
function ortsangabe(a: Auflage, stil: Stil): string {
  const ort = a.ort.trim()
  return stil.muster === 'verlag' ? [a.verlag.trim(), ort].filter(Boolean).join(', ') : ort
}

function anhang(a: Auflage, stil: Stil): string {
  let text = ''
  if (stil.seitenzahl && seiten(a)) text += `, ${seiten(a)}`
  if (stil.isbn && a.isbn.trim()) text += `, ISBN ${a.isbn.trim()}`
  return text
}

/** Erste Auflage einer Ausgabe: „Ort, 2. erw. Aufl. Jahr“; der Ort entfällt, wenn er gleich bleibt. */
function impressum(a: Auflage, stil: Stil, ort: string): string {
  const zaehlung = auflagenNummer(a)
  const ende = [zaehlung, jahr(a)].filter(Boolean).join(' ')
  const text = ort && zaehlung ? `${ort}, ${ende}` : [ort, ende].filter(Boolean).join(' ')
  return text + anhang(a, stil)
}

/** Weitere Auflage derselben Ausgabe: „2. erw. Aufl. Ort Jahr“. */
function folgeauflage(a: Auflage, stil: Stil, ort: string): string {
  return [auflagenNummer(a), ort, jahr(a)].filter(Boolean).join(' ') + anhang(a, stil)
}

/** Ob eine Auflage in der Liste genannt wird, solange nichts anderes markiert ist. */
export const nennen = (a: Auflage, erste: boolean): boolean => a.inListe ?? (erste || Boolean(a.bearbeitung.trim()))

function gedruckteAuflagen(ausgabe: Ausgabe, stil: Stil): Auflage[] {
  const auflagen = ausgabe.auflagen.filter(gefuellt)
  if (stil.auflagen === 'alle') return auflagen
  return auflagen.filter((a, i) => nennen(a, i === 0))
}

/** Wie eine weitere Ausgabe eingeleitet wird: eigene Bezeichnung oder nach Art und Sprache. */
export function ausgabeBezeichnung(a: Ausgabe): string {
  const eigene = a.bezeichnung.trim()
  if (eigene) return eigene
  if (a.art === 'uebersetzung' && a.sprache.trim()) return `${a.sprache.trim()}e Ausgabe`
  return AUSGABE_ARTEN.find((x) => x.value === a.art)?.druck ?? ''
}

const anschluss = (text: string) => (/^[,.;]/.test(text) ? text : ` ${text}`)

/** Impressum, weitere Auflagen und weitere Ausgaben eines Buchs. */
function ausgabenTeile(werk: Werk, stil: Stil): Teil[] {
  const teile: Teil[] = []
  let letzterOrt = ''
  werk.ausgaben.forEach((ausgabe, i) => {
    if (stil.auflagen === 'erste' && i > 0) return
    const auflagen = gedruckteAuflagen(ausgabe, stil)
    if (auflagen.length === 0) return
    const ortWenn = (a: Auflage) => {
      const ort = ortsangabe(a, stil)
      const neu = ort && ort !== letzterOrt ? ort : ''
      if (ort) letzterOrt = ort
      return neu
    }
    const [erste, ...weitere] = stil.auflagen === 'erste' ? auflagen.slice(0, 1) : auflagen
    if (i === 0) {
      const imp = impressum(erste, stil, ortWenn(erste))
      if (imp) teile.push(klar(stil.muster === 'verlag' ? `. ${imp}` : `, ${imp}`))
    } else {
      const bez = ausgabeBezeichnung(ausgabe)
      const eigenerTitel = ausgabe.titel.trim()
      teile.push(klar('; '))
      if (eigenerTitel) {
        if (bez) teile.push(klar(`${bez}: `))
        teile.push(...titelTeile(ausgabe.titel, ausgabe.untertitel, stil))
        const imp = impressum(erste, stil, ortWenn(erste))
        if (imp) teile.push(klar(`, ${imp}`))
      } else {
        const imp = impressum(erste, stil, ortWenn(erste))
        teile.push(klar([bez, imp].filter(Boolean).join(' ')))
      }
    }
    const zusatz = ausgabe.zusatz.trim()
    if (zusatz) teile.push(klar(anschluss(zusatz)))
    for (const a of weitere) teile.push(klar(`; ${folgeauflage(a, stil, ortWenn(a))}`))
  })
  return teile
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

/** Die Anmerkung steht kursiv; mit *…* markierte Titel darin stehen aufrecht. */
function anmerkungTeile(anm: string): Teil[] {
  return `(Anm.: ${anm})`
    .split('*')
    .map((text, i): Teil => (i % 2 === 1 ? { text } : { text, kursiv: true }))
    .filter((t) => t.text)
}

/** Eine Zeile der Literaturliste, in Teile mit Auszeichnung zerlegt. */
export function druckzeileTeile(werk: Werk, stil: Stil = STANDARD_STIL): Teil[] {
  const kopf = personen(werk, stil)
  const teile: Teil[] = [...(kopf ? [klar(`${kopf}: `)] : []), ...titelTeile(werk.titel, werk.untertitel, stil)]

  if (werk.art === 'aufsatz' && werk.erschienenIn?.titel.trim()) {
    const ein = erschienenInTeile(werk.erschienenIn, stil)
    if (stil.beitragsform === 'klammer') teile.push(klar(' ('), ...ein, klar(')'))
    else teile.push(klar(', '), ...ein)
  } else teile.push(...ausgabenTeile(werk, stil))

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

/** Jahr der Ersterscheinung: von Hand gesetzt oder die älteste Ausgabe, Manuskripte ausgenommen. */
export function ersterscheinung(werk: Werk): number {
  const hand = parseInt(werk.ersterscheinung, 10)
  if (!Number.isNaN(hand)) return hand
  const jahre = [...werk.ausgaben.filter((a) => a.art !== 'manuskript').flatMap((a) => a.auflagen.map((x) => x.jahr)), werk.erschienenIn?.jahr ?? '']
    .map((j) => parseInt(j, 10))
    .filter((j) => !Number.isNaN(j))
  return jahre.length ? Math.min(...jahre) : 9999
}

/** Sortierung nach Nachname, innerhalb gleicher Namen nach Jahr; oder chronologisch. */
export function sortiere(werke: Werk[], nach: 'name' | 'jahr'): Werk[] {
  const vgl = (a: string, b: string) => a.localeCompare(b, 'de', { sensitivity: 'base' })
  return [...werke].sort((a, b) => {
    if (nach === 'jahr') return ersterscheinung(a) - ersterscheinung(b) || vgl(sortierName(a), sortierName(b))
    return vgl(sortierName(a), sortierName(b)) || ersterscheinung(a) - ersterscheinung(b) || vgl(a.titel, b.titel)
  })
}
