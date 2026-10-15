import { describe, expect, it } from 'vitest'
import { istIsbn, vorauswahl, auflagenNummer, gruppiere, seitenAusUmfang, suchAnfrage, trefferAusRecord, type LobidRecord } from './lobid'

const ausgabe1918: LobidRecord = {
  hbzId: 'HT010793533',
  title: 'Die Philosophie der Freiheit',
  otherTitleInformation: ['Grundzüge einer modernen Weltanschauung ; seelische Beobachtungs-Resultate nach naturwissenschaftlicher Methode'],
  contribution: [{ agent: { label: 'Steiner, Rudolf' }, role: { id: 'http://id.loc.gov/vocabulary/relators/aut' } }],
  publication: [{ startDate: '1918', location: ['Berlin W.'], publishedBy: ['Philos.-Anthroposophischer Verl.'] }],
  edition: ['2. - 6. Tsd., wesentl. erg. u. erw'],
  extent: '282 S.',
}
const ausgabe1973: LobidRecord = {
  hbzId: 'HT1',
  title: 'Die Philosophie der Freiheit',
  otherTitleInformation: ['Grundzüge einer modernen Weltanschauung'],
  contribution: [{ agent: { label: 'Steiner, Rudolf' }, role: { id: 'http://id.loc.gov/vocabulary/relators/aut' } }],
  publication: [{ startDate: '1973', location: ['Stuttgart'], publishedBy: ['Verl. Freies Geistesleben'] }],
  edition: ['2. Aufl'],
  extent: 'XII, 204 S.',
  isbn: ['3772504098', '9783772504090'],
}

describe('trefferAusRecord', () => {
  it('übernimmt Person, Titel, Untertitel und Impressum', () => {
    const t = trefferAusRecord(ausgabe1918)
    expect(t.personen).toEqual([{ nachname: 'Steiner', vorname: 'Rudolf', rolle: 'autor' }])
    expect(t.titel).toBe('Die Philosophie der Freiheit')
    expect(t.untertitel).toBe('Grundzüge einer modernen Weltanschauung. Seelische Beobachtungs-Resultate nach naturwissenschaftlicher Methode')
    expect(t.auflage).toMatchObject({ jahr: '1918', ort: 'Berlin W.', verlag: 'Philos.-Anthroposophischer Verl.', seiten: '282', nummer: '' })
    expect(t.auflage.vermerk).toBe('2. - 6. Tsd., wesentl. erg. u. erw')
    expect(t.auflage.quelle).toEqual({ katalog: 'lobid', id: 'HT010793533' })
  })
  it('liest Auflagennummer und römische Seiten', () => {
    const t = trefferAusRecord(ausgabe1973)
    expect(t.auflage.nummer).toBe('2')
    expect(t.auflage.seitenRoemisch).toBe('XII')
    expect(t.auflage.seiten).toBe('204')
  })
})

describe('Hilfen', () => {
  it('erkennt Auflagennummern', () => {
    expect(auflagenNummer('2. Aufl')).toBe('2')
    expect(auflagenNummer('[11. Aufl.]')).toBe('11')
    expect(auflagenNummer('20. - 25. Taus')).toBe('')
  })
  it('liest Umfangsangaben', () => {
    expect(seitenAusUmfang('345 S. ; 8-o')).toEqual({ seiten: '345', roemisch: '' })
  })
  it('baut die Suchanfrage aus Autor und Titel', () => {
    expect(suchAnfrage('Steiner', 'Philosophie der Freiheit')).toBe(
      'contribution.agent.label:"Steiner" AND title:"Philosophie der Freiheit"',
    )
  })
})

describe('gruppiere', () => {
  it('fasst Ausgaben desselben Werks zusammen und sortiert sie nach Jahr', () => {
    const g = gruppiere([trefferAusRecord(ausgabe1973), trefferAusRecord(ausgabe1918)])
    expect(g).toHaveLength(1)
    expect(g[0].treffer.map((t) => t.auflage.jahr)).toEqual(['1918', '1973'])
  })
})

describe('vorauswahl', () => {
  it('wählt je Jahr nur die erste Ausgabe vor', () => {
    const a = trefferAusRecord(ausgabe1918)
    const b = trefferAusRecord(ausgabe1918)
    const c = trefferAusRecord(ausgabe1973)
    expect([...vorauswahl([a, b, c])]).toEqual([0, 2])
  })
})

describe('ISBN', () => {
  it('übernimmt die ISBN aus dem Katalog, bevorzugt die dreizehnstellige', () => {
    expect(trefferAusRecord(ausgabe1973).auflage.isbn).toBe('9783772504090')
    expect(trefferAusRecord(ausgabe1918).auflage.isbn).toBe('')
  })
  it('erkennt eine ISBN mit und ohne Bindestriche', () => {
    expect(istIsbn('978-3-7725-0409-0')).toBe('9783772504090')
    expect(istIsbn('3-7274-0040-X')).toBe('372740040X')
    expect(istIsbn('Philosophie der Freiheit')).toBe('')
    expect(istIsbn('1918')).toBe('')
  })
  it('sucht im Katalog nach der ISBN, wenn im Titel eine steht', () => {
    expect(suchAnfrage('Steiner', '978-3-7725-0409-0')).toBe('isbn:9783772504090')
  })
})
