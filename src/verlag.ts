import { alleAuflagen, mitAuflagen, neueId, type Auflage, type Verlag, type Werk } from './model'

// Verlage: Namens- und Ortsgeschichte, Schreibweisen, Zuordnung von Auflagen.

const zahl = (jahr: string) => {
  const j = parseInt(jahr, 10)
  return Number.isNaN(j) ? -Infinity : j
}

function abschnittFuer<T extends { abJahr: string }>(abschnitte: T[], jahr: string): { index: number; sortiert: T[] } | null {
  if (abschnitte.length === 0) return null
  const sortiert = [...abschnitte].sort((a, b) => zahl(a.abJahr) - zahl(b.abJahr))
  const j = parseInt(jahr, 10)
  if (Number.isNaN(j)) return { index: 0, sortiert }
  let index = 0
  sortiert.forEach((a, i) => {
    if (zahl(a.abJahr) <= j) index = i
  })
  return { index, sortiert }
}

export interface OrtsAuskunft {
  ort: string
  /** In diesem Jahr kommen zwei Orte in Frage */
  zweiOrteMoeglich: string[] | null
}

/** Verlagsort zu einem Erscheinungsjahr aus der Ortsgeschichte. */
export function ortFuerJahr(verlag: Verlag, jahr: string): OrtsAuskunft | null {
  const a = abschnittFuer(verlag.orte, jahr)
  if (!a) return null
  const aktuell = a.sortiert[a.index]
  if (a.index > 0 && aktuell.wechselImJahr && zahl(aktuell.abJahr) === parseInt(jahr, 10)) {
    return { ort: aktuell.ort, zweiOrteMoeglich: [a.sortiert[a.index - 1].ort, aktuell.ort] }
  }
  return { ort: aktuell.ort, zweiOrteMoeglich: null }
}

/** Der Name, den der Verlag im Erscheinungsjahr trug. */
export function nameFuerJahr(verlag: Verlag, jahr: string): string {
  const a = abschnittFuer(verlag.namen, jahr)
  return a ? a.sortiert[a.index].name : ''
}

/** Der jüngste Name, zum Anzeigen. */
export function anzeigeName(verlag: Verlag): string {
  const a = abschnittFuer(verlag.namen, '9999')
  return a ? a.sortiert[a.index].name : ''
}

/** Alle Namen und Schreibweisen eines Verlags. */
export function alleNamen(verlag: Verlag): string[] {
  return [...verlag.namen.map((n) => n.name), ...verlag.schreibweisen].filter((n) => n.trim())
}

const textNormal = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()

/** Verlage, deren Kürzel oder Namen zur Eingabe passen. */
export function verlagVorschlaege(verlage: Verlag[], eingabe: string): Verlag[] {
  const e = textNormal(eingabe)
  if (!e) return []
  const namen = (v: Verlag) => alleNamen(v).map(textNormal)
  const kuerzel = verlage.filter((v) => v.kuerzel.toLowerCase() === e)
  const anfang = verlage.filter((v) => !kuerzel.includes(v) && namen(v).some((n) => n.startsWith(e)))
  const enthaelt = verlage.filter((v) => !kuerzel.includes(v) && !anfang.includes(v) && namen(v).some((n) => n.includes(e)))
  return [...kuerzel, ...anfang, ...enthaelt].slice(0, 8)
}

/** Verlag, dessen Name oder Schreibweise genau dem Text entspricht. */
export function findeExakt(verlage: Verlag[], text: string): Verlag | undefined {
  const t = textNormal(text)
  if (!t) return undefined
  return verlage.find((v) => alleNamen(v).some((n) => textNormal(n) === t))
}

const FUELLWOERTER = new Set(['verlag', 'verl', 'verlags', 'der', 'die', 'das', 'des', 'am', 'im', 'und', 'gmbh', 'ag', 'kg', 'co'])

function woerter(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 1 && !FUELLWOERTER.has(w))
}

/** Zwei Verlagsnamen, die sich nur durch Abkürzungen und Füllwörter unterscheiden. */
export function aehnlich(a: string, b: string): boolean {
  const wa = woerter(a)
  const wb = woerter(b)
  if (wa.length === 0 || wa.length !== wb.length) return false
  return wa.every((x, i) => {
    const y = wb[i]
    const kurz = x.length <= y.length ? x : y
    const lang = kurz === x ? y : x
    return kurz.length >= 3 && lang.startsWith(kurz)
  })
}

/** Ein Verlag, der dem Text ähnelt, ohne ihm exakt zu entsprechen. */
export function findeAehnlich(verlage: Verlag[], text: string): Verlag | undefined {
  if (!text.trim() || findeExakt(verlage, text)) return undefined
  return verlage.find((v) => alleNamen(v).some((n) => aehnlich(text, n)))
}

const LAENDERZUSAETZE = new Set([
  'schweiz', 'switzerland', 'suisse', 'deutschland', 'germany', 'brd', 'ddr', 'österreich', 'austria',
  'usa', 'england', 'uk', 'frankreich', 'france', 'italien', 'niederlande',
])
const istLaenderzusatz = (s: string) => LAENDERZUSAETZE.has(s.trim().toLowerCase().replace(/\.$/, ''))

/**
 * Ortsname ohne Zusätze, die keinen anderen Ort bezeichnen: Länder in Klammern oder nach Schrägstrich
 * und Postbezirke. „Dornach (Schweiz)“ → „Dornach“, „Berlin W.“ → „Berlin“.
 * Alles andere bleibt: „New York“, „Frankfurt (Oder)“, „Frankfurt/Main“.
 */
export function ortName(ort: string): string {
  let s = ort.trim().replace(/\s+/g, ' ')
  s = s.replace(/\s*\(([^)]*)\)$/, (m, innen: string) => (istLaenderzusatz(innen) ? '' : m))
  s = s.replace(/\s*[/,]\s*([^/,]+)$/, (m, rest: string) => (istLaenderzusatz(rest) ? '' : m))
  s = s.replace(/(\s+[A-ZÄÖÜ]{1,3}\.)+$/, '')
  return s.trim()
}

/** Gleicher Ort, wenn die Namen ohne Zusätze vollständig übereinstimmen. */
export function ortGleich(a: string, b: string): boolean {
  const x = ortName(a).toLowerCase()
  return Boolean(x) && x === ortName(b).toLowerCase()
}

export function kuerzelVorschlag(name: string, verlage: Verlag[]): string {
  const basis = woerter(name).map((w) => w[0]).join('').slice(0, 4) || 'v'
  const belegt = new Set(verlage.map((v) => v.kuerzel.toLowerCase()))
  if (!belegt.has(basis)) return basis
  let n = 2
  while (belegt.has(`${basis}${n}`)) n++
  return `${basis}${n}`
}

/** Die am wenigsten abgekürzte Form: wenige Punkte, dann die längste. */
function ausgeschrieben(texte: string[]): string {
  const punkte = (s: string) => (s.match(/\./g) ?? []).length
  return [...texte].sort((a, b) => punkte(a) - punkte(b) || b.length - a.length)[0]
}

function eindeutig(texte: string[]): string[] {
  const gesehen = new Set<string>()
  return texte.filter((t) => {
    const n = textNormal(t)
    if (!n || gesehen.has(n)) return false
    gesehen.add(n)
    return true
  })
}

/**
 * Neuer Verlag aus den Schreibweisen einer Karte. Als Ort gilt nur der der frühesten Auflage:
 * ein anderer Ort kann Umzug, Niederlassung oder Katalogfehler sein und wird nur auf Klick eingetragen.
 */
export function verlagAus(texte: string[], auflagen: Auflage[], vorhandene: Verlag[]): Verlag {
  const liste = eindeutig(texte)
  const name = ausgeschrieben(liste)
  const frueheste = auflagen.filter((a) => a.ort.trim()).sort((a, b) => zahl(a.jahr) - zahl(b.jahr))[0]
  const orte: Verlag['orte'] = frueheste ? [{ abJahr: '', ort: ortName(frueheste.ort), wechselImJahr: false }] : []
  return {
    id: neueId(),
    kuerzel: kuerzelVorschlag(name, vorhandene),
    namen: [{ abJahr: '', name }],
    orte,
    schreibweisen: liste.filter((t) => textNormal(t) !== textNormal(name)),
  }
}

export interface VerlagsGruppe {
  art: 'bekannt' | 'aehnlich' | 'neu'
  verlag?: Verlag
  texte: string[]
  /** IDs der betroffenen Auflagen */
  auflagen: string[]
}

/** Ordnet die noch nicht verknüpften Verlagsnamen einer Karte: bekannt, ähnlich oder neu. */
export function planeVerlage(werk: Werk, verlage: Verlag[]): VerlagsGruppe[] {
  const gruppen: VerlagsGruppe[] = []
  for (const a of alleAuflagen(werk)) {
    const text = a.verlag.trim()
    if (!text || (a.verlagId && verlage.some((v) => v.id === a.verlagId))) continue
    const exakt = findeExakt(verlage, text)
    const aehnlicher = exakt ? undefined : findeAehnlich(verlage, text)
    const art: VerlagsGruppe['art'] = exakt ? 'bekannt' : aehnlicher ? 'aehnlich' : 'neu'
    const verlag = exakt ?? aehnlicher
    const gruppe = gruppen.find((g) =>
      g.art === art && (verlag ? g.verlag === verlag : g.texte.some((t) => textNormal(t) === textNormal(text) || aehnlich(t, text))),
    )
    if (gruppe) {
      gruppe.auflagen.push(a.id)
      if (!gruppe.texte.some((t) => textNormal(t) === textNormal(text))) gruppe.texte.push(text)
    } else {
      gruppen.push({ art, verlag, texte: [text], auflagen: [a.id] })
    }
  }
  return gruppen
}

/**
 * Wendet den Abgleich an. Bekannte werden verknüpft, Neue angelegt.
 * Ähnliche richten sich nach der Antwort: true = derselbe Verlag, false = ein anderer, undefined = offen lassen.
 */
export function wendePlanAn(
  werk: Werk,
  verlage: Verlag[],
  plan: VerlagsGruppe[],
  antwort: (g: VerlagsGruppe) => boolean | undefined,
): { werk: Werk; verlage: Verlag[] } {
  let liste = [...verlage]
  const zuordnung = new Map<string, string>()
  for (const g of plan) {
    let ziel: Verlag | undefined
    if (g.art === 'bekannt') ziel = g.verlag
    else if (g.art === 'aehnlich') {
      const a = antwort(g)
      if (a === undefined) continue
      if (a && g.verlag) {
        const bekannt = alleNamen(g.verlag).map(textNormal)
        const neu = g.texte.filter((t) => !bekannt.includes(textNormal(t)))
        ziel = { ...g.verlag, schreibweisen: [...g.verlag.schreibweisen, ...neu] }
        liste = liste.map((v) => (v.id === ziel!.id ? ziel! : v))
      }
    }
    if (!ziel) {
      ziel = verlagAus(g.texte, alleAuflagen(werk).filter((a) => g.auflagen.includes(a.id)), liste)
      liste = [...liste, ziel]
    }
    for (const id of g.auflagen) zuordnung.set(id, ziel.id)
  }
  if (zuordnung.size === 0) return { werk, verlage: liste }
  return {
    werk: mitAuflagen(werk, (a) => (zuordnung.has(a.id) ? { ...a, verlagId: zuordnung.get(a.id) } : a)),
    verlage: liste,
  }
}

/** Ort einer verknüpften Auflage, der nicht zur Ortsgeschichte passt. */
export function ortsAbweichung(verlag: Verlag, a: Auflage): { erwartet: string } | null {
  if (!a.ort.trim() || a.ortBestaetigt) return null
  const erwartet = ortFuerJahr(verlag, a.jahr)
  if (!erwartet) return null
  const moeglich = erwartet.zweiOrteMoeglich ?? [erwartet.ort]
  return moeglich.some((o) => ortGleich(o, a.ort)) ? null : { erwartet: erwartet.ort }
}

export function ortswechselEintragen(verlag: Verlag, jahr: string, ort: string): Verlag {
  const orte = [...verlag.orte, { abJahr: jahr.trim(), ort: ortName(ort), wechselImJahr: false }].sort((a, b) => zahl(a.abJahr) - zahl(b.abJahr))
  return { ...verlag, orte }
}
