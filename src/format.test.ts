import { describe, expect, it } from 'vitest'
import { druckzeile, sortiere, STANDARD_STIL } from './format'
import { leereAuflage, leeresWerk, type Werk } from './model'

function werk(teil: Partial<Werk>): Werk {
  return { ...leeresWerk(), ...teil }
}
const steiner = { vorname: 'Rudolf', nachname: 'Steiner', rolle: 'autor' as const }

const pdf = werk({
  personen: [steiner],
  titel: 'Die Philosophie der Freiheit',
  untertitel: 'Grundzüge einer modernen Weltanschauung',
  auflagen: [
    { ...leereAuflage(), jahr: '1893', gedrucktesJahr: '1894', verlag: 'Emil Felber', ort: 'Berlin' },
    { ...leereAuflage(), nummer: '2', jahr: '1918', verlag: 'Philosophisch-Anthroposophischer Verlag', ort: 'Berlin' },
  ],
})

describe('druckzeile', () => {
  it('folgt dem Muster der Skizze: Vorname Name: Titel. Untertitel, Ort Jahr', () => {
    expect(druckzeile(pdf)).toBe(
      'Rudolf Steiner: Die Philosophie der Freiheit. Grundzüge einer modernen Weltanschauung, Berlin 1893 (im Druck: 1894).',
    )
  })
  it('kennt die Variante mit Verlagsname', () => {
    expect(druckzeile(pdf, { ...STANDARD_STIL, muster: 'verlag' })).toBe(
      'Rudolf Steiner: Die Philosophie der Freiheit. Grundzüge einer modernen Weltanschauung. Emil Felber, Berlin 1893 (im Druck: 1894).',
    )
  })
  it('kann alle Auflagen mit Auflagenzählung zeigen', () => {
    expect(druckzeile(pdf, { ...STANDARD_STIL, auflagen: 'alle' })).toBe(
      'Rudolf Steiner: Die Philosophie der Freiheit. Grundzüge einer modernen Weltanschauung, Berlin 1893 (im Druck: 1894); Berlin, 2. Aufl. 1918.',
    )
  })
  it('stellt Name, Vorname voran und wählt den Untertiteltrenner', () => {
    expect(druckzeile(pdf, { ...STANDARD_STIL, namensfolge: 'name-vorname', untertitelTrenner: ' – ' })).toMatch(
      /^Steiner, Rudolf: Die Philosophie der Freiheit – Grundzüge/,
    )
  })
  it('trennt mehrere Autoren mit Schrägstrich und markiert Herausgeber', () => {
    const w = werk({
      personen: [
        { vorname: 'Anna', nachname: 'A', rolle: 'hrsg' },
        { vorname: 'Bert', nachname: 'B', rolle: 'hrsg' },
      ],
      titel: 'Sammlung',
      auflagen: [{ ...leereAuflage(), ort: 'Dornach', jahr: '1990' }],
    })
    expect(druckzeile(w)).toBe('Anna A / Bert B (Hrsg.): Sammlung, Dornach 1990.')
  })
  it('setzt römische und arabische Seitenzahl, wenn gewünscht', () => {
    const w = werk({
      personen: [steiner],
      titel: 'T',
      auflagen: [{ ...leereAuflage(), ort: 'Basel', jahr: '2000', seiten: '578', seitenRoemisch: 'XXI' }],
    })
    expect(druckzeile(w, { ...STANDARD_STIL, seitenzahl: true })).toBe('Rudolf Steiner: T, Basel 2000, XXI + 578 S.')
  })
  it('stellt einen Aufsatz mit Erschienen-in dar', () => {
    const w = werk({
      art: 'aufsatz',
      personen: [steiner],
      titel: 'Goethe als Vater einer neuen Ästhetik',
      erschienenIn: { art: 'zeitschrift', titel: 'Das Goetheanum', jahrgang: '12', jahr: '1933', heft: '4', seitenVon: '10', seitenBis: '14' },
    })
    expect(druckzeile(w)).toBe(
      'Rudolf Steiner: Goethe als Vater einer neuen Ästhetik, in: Das Goetheanum 12. Jg. (1933), Nr. 4, S. 10–14.',
    )
  })
})

describe('sortiere', () => {
  const a = werk({ personen: [{ vorname: 'X', nachname: 'Özdemir', rolle: 'autor' }], titel: 'a', auflagen: [{ ...leereAuflage(), jahr: '1950' }] })
  const b = werk({ personen: [{ vorname: 'Y', nachname: 'Ohm', rolle: 'autor' }], titel: 'b', auflagen: [{ ...leereAuflage(), jahr: '1920' }] })
  const c = werk({ personen: [{ vorname: 'Y', nachname: 'Ohm', rolle: 'autor' }], titel: 'c', auflagen: [{ ...leereAuflage(), jahr: '1910' }] })
  it('sortiert nach Nachname, dann Jahr', () => {
    expect(sortiere([a, b, c], 'name').map((w) => w.titel)).toEqual(['c', 'b', 'a'])
  })
  it('sortiert chronologisch', () => {
    expect(sortiere([a, b, c], 'jahr').map((w) => w.titel)).toEqual(['c', 'b', 'a'])
  })
})

describe('ISBN in der Liste', () => {
  it('zeigt die ISBN nur, wenn gewünscht', () => {
    const w = werk({ personen: [steiner], titel: 'T', auflagen: [{ ...leereAuflage(), ort: 'Dornach', jahr: '1995', isbn: '3-7274-0040-5' }] })
    expect(druckzeile(w)).toBe('Rudolf Steiner: T, Dornach 1995.')
    expect(druckzeile(w, { ...STANDARD_STIL, isbn: true })).toBe('Rudolf Steiner: T, Dornach 1995, ISBN 3-7274-0040-5.')
  })
})
