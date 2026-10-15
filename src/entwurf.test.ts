import { describe, expect, it } from 'vitest'
import { auflageLeer, eigeneAngaben, weichtAb } from './entwurf'
import { leereAuflage, leeresWerk, type Werk } from './model'

function vorlageMitVerlag(): Werk {
  const w = leeresWerk()
  w.personen = [{ vorname: 'Rudolf', nachname: 'Steiner', rolle: 'autor' }]
  w.auflagen = [{ ...leereAuflage(), verlag: 'Verlag am Goetheanum', ort: 'Dornach' }]
  return w
}

describe('weichtAb', () => {
  it('erkennt eine unberührte Vorlage, auch mit fixierten Feldern', () => {
    const vorlage = vorlageMitVerlag()
    expect(weichtAb(structuredClone(vorlage), vorlage)).toBe(false)
  })
  it('ignoriert IDs und Zeitstempel', () => {
    const vorlage = vorlageMitVerlag()
    const w = { ...structuredClone(vorlage), geaendert: '2030-01-01', auflagen: vorlage.auflagen.map((a) => ({ ...a, id: 'x' })) }
    expect(weichtAb(w, vorlage)).toBe(false)
  })
  it.each<[string, (w: Werk) => void]>([
    ['nur ein Nachname', (w) => (w.personen[0].nachname = 'NurAutor')],
    ['nur ein Verlag', (w) => (w.auflagen[0].verlag = 'Mein Verlag')],
    ['nur ein Vermerk', (w) => (w.auflagen[0].vermerk = '20.–25. Tsd.')],
    ['nur ein Druckjahr', (w) => (w.auflagen[0].gedrucktesJahr = '1894')],
    ['nur ein Schlagwort', (w) => w.schlagwoerter.push({ begriff: 'Ethik', primaer: true })],
    ['nur die Reihe', (w) => (w.reihe = 'Gesamtausgabe')],
    ['nur die Art', (w) => (w.art = 'aufsatz')],
    ['nur Erschienen in', (w) => (w.erschienenIn = { art: 'zeitschrift', titel: 'Das Goetheanum', jahrgang: '', jahr: '', heft: '', seitenVon: '', seitenBis: '' })],
    ['eine zweite Person', (w) => w.personen.push({ vorname: '', nachname: 'B', rolle: 'autor' })],
  ])('zählt %s als eigene Angabe', (_, aendern) => {
    const w = leeresWerk()
    aendern(w)
    expect(weichtAb(w, leeresWerk())).toBe(true)
  })
  it('wertet bloße Leerzeichen nicht als Angabe', () => {
    const w = leeresWerk()
    w.titel = '   '
    expect(weichtAb(w, leeresWerk())).toBe(false)
  })
})

describe('eigeneAngaben', () => {
  it('nennt nur Suchfelder, wenn nur Autor und Titel getippt wurden', () => {
    const vorlage = leeresWerk()
    const w = structuredClone(vorlage)
    w.personen[0].nachname = 'Steiner'
    w.titel = 'Philosophie der Freiheit'
    expect(eigeneAngaben(w, vorlage, ['personen', 'titel', 'untertitel'])).toEqual([])
  })
  it('meldet zusätzliche Angaben über die Suchfelder hinaus', () => {
    const vorlage = leeresWerk()
    const w = structuredClone(vorlage)
    w.titel = 'Philosophie der Freiheit'
    w.auflagen[0].verlag = 'Mein eigens erfasster Verlag'
    expect(eigeneAngaben(w, vorlage, ['personen', 'titel', 'untertitel'])).toEqual(['auflagen'])
  })
})

describe('auflageLeer', () => {
  it('ist leer ohne jede Angabe', () => {
    expect(auflageLeer(leereAuflage())).toBe(true)
  })
  it.each(['verlag', 'ort', 'jahr', 'nummer', 'seiten', 'seitenRoemisch', 'gedrucktesJahr', 'erscheinungstag', 'vermerk'] as const)(
    'ist nicht leer mit %s',
    (feld) => {
      expect(auflageLeer({ ...leereAuflage(), [feld]: 'x' })).toBe(false)
    },
  )
})
