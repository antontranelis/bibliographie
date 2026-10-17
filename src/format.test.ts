import { describe, expect, it } from 'vitest'
import { druckzeile, druckzeileTeile, sortiere, STANDARD_STIL, type Stil } from './format'
import { leereAuflage, leeresErschienenIn, leeresWerk, type Werk } from './model'

function werk(teil: Partial<Werk>): Werk {
  return { ...leeresWerk(), ...teil }
}
const person = (vorname: string, nachname: string, rolle: 'autor' | 'hrsg' = 'autor') => ({ vorname, nachname, rolle })
const steiner = person('Rudolf', 'Steiner')
const SKIZZE: Stil = { ...STANDARD_STIL, titelAuszeichnung: 'keine', personenTrenner: ' / ', beitragsform: 'komma', schlusspunkt: true }

// Zeilen aus den Literaturlisten von Jens Göken (Nr. in Klammern)
describe('Listenformat', () => {
  it('Buch mit Untertitel (Nr. 7, 13)', () => {
    const w = werk({ personen: [person('Frances Taylor', 'Patterson')], titel: 'Cinema Craftsmanship', untertitel: 'A Book for Photoplaywrights', auflagen: [{ ...leereAuflage(), ort: 'New York', jahr: '1920' }] })
    expect(druckzeile(w)).toBe('Frances Taylor Patterson: Cinema Craftsmanship. A Book for Photoplaywrights, New York 1920')
    expect(druckzeileTeile(w)).toEqual([
      { text: 'Frances Taylor Patterson: ' },
      { text: 'Cinema Craftsmanship', auszeichnung: 'fett' },
      { text: '. A Book for Photoplaywrights, New York 1920' },
    ])
  })
  it('mehrere Personen mit Schrägstrich ohne Leerzeichen (Nr. 11)', () => {
    const w = werk({ personen: [person('Max', 'Mack'), person('Ewald Andrè', 'Dupont')], titel: 'Die zappelnde Leinwand', untertitel: 'Ein Filmbuch', auflagen: [{ ...leereAuflage(), ort: 'Berlin', jahr: '1916' }] })
    expect(druckzeile(w)).toBe('Max Mack/Ewald Andrè Dupont: Die zappelnde Leinwand. Ein Filmbuch, Berlin 1916')
  })
  it('Herausgeber (Nr. 170)', () => {
    const w = werk({ personen: [person('Lotte H.', 'Eisner', 'hrsg'), person('Heinz', 'Friedrich', 'hrsg')], titel: 'Film – Rundfunk – Fernsehen', auflagen: [{ ...leereAuflage(), ort: 'Frankfurt a. M.', jahr: '1958' }] })
    expect(druckzeile(w)).toBe('Lotte H. Eisner/Heinz Friedrich (Hrsg.): Film – Rundfunk – Fernsehen, Frankfurt a. M. 1958')
  })
  it('einfachster Zeitschriftenbeitrag (Nr. 142)', () => {
    const w = werk({ art: 'aufsatz', personen: [person('Karl', 'Heymann')], titel: 'Perfektion des Films', erschienenIn: { ...leeresErschienenIn(), titel: 'Die Drei', ausgabe: '1/1954', seitenVon: '42f' } })
    expect(druckzeileTeile(w)).toEqual([
      { text: 'Karl Heymann: ' },
      { text: 'Perfektion des Films', auszeichnung: 'fett' },
      { text: ' (in: ' },
      { text: 'Die Drei', kursiv: true },
      { text: ' 1/1954, S. 42f)' },
    ])
  })
  it('Zeitschriftenbeitrag mit Komma nach dem Titel (Nr. 164)', () => {
    const w = werk({ art: 'aufsatz', personen: [person('Donald', 'Horton'), person('Anselm', 'Strauss')], titel: 'Interaction in Audience-Participation Shows', erschienenIn: { ...leeresErschienenIn(), titel: 'The American Journal of Sociology', ausgabe: ', Bd. 62, 1957, Nr. 6', seitenVon: '579', seitenBis: '587' } })
    expect(druckzeile(w)).toBe('Donald Horton/Anselm Strauss: Interaction in Audience-Participation Shows (in: The American Journal of Sociology, Bd. 62, 1957, Nr. 6, S. 579–587)')
  })
  it('setzt die Ausgabenangabe aus Jahrgang und Heft zusammen, wenn keine gedruckte da ist', () => {
    const e = { ...leeresErschienenIn(), titel: 'Die Drei', jahrgang: '25', heft: '1', jahr: '1963', seitenVon: '1', seitenBis: '5' }
    expect(druckzeile(werk({ art: 'aufsatz', titel: 'T', erschienenIn: e }))).toBe('T (in: Die Drei, 25. Jg., 1/1963, S. 1–5)')
    expect(druckzeile(werk({ art: 'aufsatz', titel: 'T', erschienenIn: { ...e, jahrgang: '' } }))).toBe('T (in: Die Drei 1/1963, S. 1–5)')
  })
  it('Beitrag in einem Sammelband mit fettem Sammelbandtitel', () => {
    const w = werk({ art: 'aufsatz', titel: 'T', erschienenIn: { ...leeresErschienenIn(), art: 'sammelband', titel: 'Musik und Technik', ausgabe: ', hrsg. von Rudolf Frisius, Mainz 1996' } })
    expect(druckzeileTeile(w)).toEqual([
      { text: 'T', auszeichnung: 'fett' },
      { text: ' (in: ' },
      { text: 'Musik und Technik', auszeichnung: 'fett' },
      { text: ', hrsg. von Rudolf Frisius, Mainz 1996)' },
    ])
  })
  it('druckt die Anmerkung kursiv in Klammern (Nr. 34)', () => {
    const w = werk({ personen: [person('Albert', 'Steffen')], titel: 'Der Künstler und die Erfüllung der Mysterien', auflagen: [{ ...leereAuflage(), ort: 'Dornach/Stuttgart', jahr: '1928' }], anmerkung: 'Enthält Ausführungen über das Kino.' })
    const teile = druckzeileTeile(w)
    expect(teile.at(-1)).toEqual({ text: '(Anm.: Enthält Ausführungen über das Kino.)', kursiv: true })
    expect(druckzeile(w, { ...STANDARD_STIL, anmerkungen: false })).toBe('Albert Steffen: Der Künstler und die Erfüllung der Mysterien, Dornach/Stuttgart 1928')
  })
  it('setzt markierte Titel in der Anmerkung aufrecht (Nr. 1406)', () => {
    const w = werk({ titel: 'T', anmerkung: 'erschienen als *Research Monograph Nr. 30*.' })
    expect(druckzeileTeile(w).slice(-3)).toEqual([
      { text: '(Anm.: erschienen als ', kursiv: true },
      { text: 'Research Monograph Nr. 30' },
      { text: '.)', kursiv: true },
    ])
  })
  it('Halbfett und ohne Auszeichnung', () => {
    const w = werk({ titel: 'T' })
    expect(druckzeileTeile(w, { ...STANDARD_STIL, titelAuszeichnung: 'halbfett' })).toEqual([{ text: 'T', auszeichnung: 'halbfett' }])
    expect(druckzeileTeile(w, { ...STANDARD_STIL, titelAuszeichnung: 'keine' })).toEqual([{ text: 'T' }])
  })
})

describe('Muster der Skizze als Variante', () => {
  const pdf = werk({
    personen: [steiner],
    titel: 'Die Philosophie der Freiheit',
    untertitel: 'Grundzüge einer modernen Weltanschauung',
    auflagen: [
      { ...leereAuflage(), jahr: '1893', gedrucktesJahr: '1894', verlag: 'Emil Felber', ort: 'Berlin' },
      { ...leereAuflage(), nummer: '2', jahr: '1918', verlag: 'Philosophisch-Anthroposophischer Verlag', ort: 'Berlin' },
    ],
  })
  it('Vorname Name: Titel. Untertitel, Ort Jahr.', () => {
    expect(druckzeile(pdf, SKIZZE)).toBe('Rudolf Steiner: Die Philosophie der Freiheit. Grundzüge einer modernen Weltanschauung, Berlin 1893 (im Druck: 1894).')
  })
  it('mit Verlagsname', () => {
    expect(druckzeile(pdf, { ...SKIZZE, muster: 'verlag' })).toBe(
      'Rudolf Steiner: Die Philosophie der Freiheit. Grundzüge einer modernen Weltanschauung. Emil Felber, Berlin 1893 (im Druck: 1894).',
    )
  })
  it('alle Auflagen mit Zählung', () => {
    expect(druckzeile(pdf, { ...SKIZZE, auflagen: 'alle' })).toBe(
      'Rudolf Steiner: Die Philosophie der Freiheit. Grundzüge einer modernen Weltanschauung, Berlin 1893 (im Druck: 1894); Berlin, 2. Aufl. 1918.',
    )
  })
  it('Name, Vorname und Gedankenstrich', () => {
    expect(druckzeile(pdf, { ...SKIZZE, namensfolge: 'name-vorname', untertitelTrenner: ' – ' })).toMatch(/^Steiner, Rudolf: Die Philosophie der Freiheit – Grundzüge/)
  })
  it('Seitenzahl und ISBN auf Wunsch, ohne doppelten Schlusspunkt', () => {
    const w = werk({ personen: [steiner], titel: 'T', auflagen: [{ ...leereAuflage(), ort: 'Basel', jahr: '2000', seiten: '578', seitenRoemisch: 'XXI', isbn: '3-7274-0040-5' }] })
    expect(druckzeile(w, { ...SKIZZE, seitenzahl: true })).toBe('Rudolf Steiner: T, Basel 2000, XXI + 578 S.')
    expect(druckzeile(w, { ...SKIZZE, isbn: true })).toBe('Rudolf Steiner: T, Basel 2000, ISBN 3-7274-0040-5.')
  })
  it('Aufsatz mit Komma statt Klammer', () => {
    const w = werk({ art: 'aufsatz', personen: [steiner], titel: 'Goethe', erschienenIn: { ...leeresErschienenIn(), titel: 'Das Goetheanum', jahrgang: '12', heft: '4', jahr: '1933', seitenVon: '10', seitenBis: '14' } })
    expect(druckzeile(w, SKIZZE)).toBe('Rudolf Steiner: Goethe, in: Das Goetheanum, 12. Jg., 4/1933, S. 10–14.')
  })
})

describe('sortiere', () => {
  const a = werk({ personen: [person('X', 'Özdemir')], titel: 'a', auflagen: [{ ...leereAuflage(), jahr: '1950' }] })
  const b = werk({ personen: [person('Y', 'Ohm')], titel: 'b', auflagen: [{ ...leereAuflage(), jahr: '1920' }] })
  const c = werk({ personen: [person('Y', 'Ohm')], titel: 'c', auflagen: [{ ...leereAuflage(), jahr: '1910' }] })
  const d = werk({ art: 'aufsatz', personen: [person('Z', 'Abel')], titel: 'd', auflagen: [], erschienenIn: { ...leeresErschienenIn(), titel: 'Z', jahr: '1900' } })
  it('nach Nachname, dann Jahr', () => {
    expect(sortiere([a, b, c], 'name').map((w) => w.titel)).toEqual(['c', 'b', 'a'])
  })
  it('chronologisch, auch mit dem Jahr eines Aufsatzes', () => {
    expect(sortiere([a, b, c, d], 'jahr').map((w) => w.titel)).toEqual(['d', 'c', 'b', 'a'])
  })
})
