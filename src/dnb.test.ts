import { describe, expect, it } from 'vitest'
import { dnbAnfrage, leseMarc, trefferAusMarc } from './dnb'

const kopf = '<?xml version="1.0" encoding="UTF-8"?><searchRetrieveResponse><numberOfRecords>165</numberOfRecords><records><record><recordData>'
const fuss = '</recordData></record></records></searchRetrieveResponse>'

const gedruckt = `<record xmlns="http://www.loc.gov/MARC21/slim" type="Bibliographic">
  <leader>00000nam a2200000 c 4500</leader>
  <controlfield tag="001">891438521</controlfield>
  <datafield tag="020" ind1=" " ind2=" ">
    <subfield code="a">9783727462801</subfield>
    <subfield code="c">kart. : DM 11.80</subfield>
    <subfield code="9">978-3-7274-6280-1</subfield>
  </datafield>
  <datafield tag="100" ind1="1" ind2=" ">
    <subfield code="a">Steiner, Rudolf</subfield>
    <subfield code="d">1861-1925</subfield>
    <subfield code="4">aut</subfield>
  </datafield>
  <datafield tag="245" ind1="1" ind2="0">
    <subfield code="a">&#152;Die&#156; Philosophie der Freiheit</subfield>
    <subfield code="b">Grundzüge einer modernen Weltanschauung ; seelische Beobachtungsresultate nach naturwissenschaftlicher Methode</subfield>
    <subfield code="c">Rudolf Steiner</subfield>
  </datafield>
  <datafield tag="250" ind1=" " ind2=" ">
    <subfield code="a">15. Aufl.</subfield>
  </datafield>
  <datafield tag="264" ind1=" " ind2="1">
    <subfield code="a">Dornach/Schweiz</subfield>
    <subfield code="b">Rudolf-Steiner-Verl.</subfield>
    <subfield code="c">1987</subfield>
  </datafield>
  <datafield tag="300" ind1=" " ind2=" ">
    <subfield code="a">XII, 288 S.</subfield>
    <subfield code="c">18 cm</subfield>
  </datafield>
  <datafield tag="337" ind1=" " ind2=" ">
    <subfield code="a">ohne Hilfsmittel zu benutzen</subfield>
    <subfield code="b">n</subfield>
  </datafield>
  <datafield tag="700" ind1="1" ind2=" ">
    <subfield code="a">Witzenmann, Herbert</subfield>
    <subfield code="e">Herausgeber</subfield>
    <subfield code="4">edt</subfield>
  </datafield>
</record>`

const ebook = `<record xmlns="http://www.loc.gov/MARC21/slim" type="Bibliographic">
  <leader>00000nam a2200000uc 4500</leader>
  <controlfield tag="001">1240537972</controlfield>
  <datafield tag="100" ind1="1" ind2=" "><subfield code="a">Steiner, Rudolf</subfield><subfield code="4">aut</subfield></datafield>
  <datafield tag="245" ind1="1" ind2="0"><subfield code="a">Die Philosophie der Freiheit</subfield></datafield>
  <datafield tag="264" ind1=" " ind2="1"><subfield code="a">München</subfield><subfield code="b">neobooks</subfield><subfield code="c">2021</subfield></datafield>
  <datafield tag="300" ind1=" " ind2=" "><subfield code="a">Online-Ressource, 263 Seiten</subfield></datafield>
  <datafield tag="337" ind1=" " ind2=" "><subfield code="a">Computermedien</subfield><subfield code="b">c</subfield></datafield>
</record>`

const hoerbuch = `<record xmlns="http://www.loc.gov/MARC21/slim" type="Bibliographic">
  <leader>00000nim a2200000uc 4500</leader>
  <controlfield tag="001">1261436806</controlfield>
  <datafield tag="100" ind1="1" ind2=" "><subfield code="a">Steiner, Rudolf</subfield><subfield code="4">art</subfield></datafield>
  <datafield tag="245" ind1="1" ind2="0"><subfield code="a">Philosophie der Freiheit</subfield></datafield>
  <datafield tag="264" ind1=" " ind2="1"><subfield code="a">Butzbach</subfield><subfield code="b">BÄNG Management &amp; Verlag</subfield><subfield code="c">2022</subfield></datafield>
</record>`

const ohneOrt = `<record xmlns="http://www.loc.gov/MARC21/slim" type="Bibliographic">
  <leader>00000nam a2200000 c 4500</leader>
  <controlfield tag="001">111</controlfield>
  <datafield tag="100" ind1="1" ind2=" "><subfield code="a">Steiner, Rudolf</subfield><subfield code="4">aut</subfield></datafield>
  <datafield tag="245" ind1="1" ind2="0"><subfield code="a">Die Philosophie der Freiheit</subfield></datafield>
  <datafield tag="260" ind1=" " ind2=" "><subfield code="a">[S.l.]</subfield><subfield code="b">Philos.-Anthroposoph. Verl.</subfield><subfield code="c">[1921]</subfield></datafield>
  <datafield tag="300" ind1=" " ind2=" "><subfield code="a">282 S.</subfield></datafield>
</record>`

describe('leseMarc', () => {
  it('liest Datensätze, Felder und Unterfelder und dekodiert Entitäten', () => {
    const r = leseMarc(kopf + gedruckt + fuss + kopf + hoerbuch + fuss)
    expect(r).toHaveLength(2)
    expect(r[0].leader).toBe('00000nam a2200000 c 4500')
    expect(r[0].kontrolle['001']).toBe('891438521')
    expect(r[1].felder.find((f) => f.tag === '264')?.unter.find((u) => u.code === 'b')?.wert).toBe('BÄNG Management & Verlag')
  })
})

describe('trefferAusMarc', () => {
  it('übernimmt ein gedrucktes Buch vollständig', () => {
    const [d] = leseMarc(kopf + gedruckt + fuss)
    const t = trefferAusMarc(d)!
    expect(t.titel).toBe('Die Philosophie der Freiheit')
    expect(t.untertitel).toBe('Grundzüge einer modernen Weltanschauung. Seelische Beobachtungsresultate nach naturwissenschaftlicher Methode')
    expect(t.personen).toEqual([{ nachname: 'Steiner', vorname: 'Rudolf', rolle: 'autor' }])
    expect(t.auflage).toMatchObject({
      nummer: '15',
      jahr: '1987',
      verlag: 'Rudolf-Steiner-Verl.',
      ort: 'Dornach/Schweiz',
      seiten: '288',
      seitenRoemisch: 'XII',
      isbn: '9783727462801',
      quelle: { katalog: 'dnb', id: '891438521' },
    })
  })
  it('lässt E-Books und Hörbücher weg', () => {
    expect(trefferAusMarc(leseMarc(kopf + ebook + fuss)[0])).toBeNull()
    expect(trefferAusMarc(leseMarc(kopf + hoerbuch + fuss)[0])).toBeNull()
  })
  it('räumt Platzhalter und Klammern auf', () => {
    const t = trefferAusMarc(leseMarc(kopf + ohneOrt + fuss)[0])!
    expect(t.auflage).toMatchObject({ ort: '', jahr: '1921', verlag: 'Philos.-Anthroposoph. Verl.' })
  })
})

describe('Ort der DNB', () => {
  it.each([
    ['[S.l.] @', ''],
    ['[S.l.]', ''],
    ['o.O.', ''],
    ['[Dornach]', 'Dornach'],
    ['Reinbek bei Hamburg', 'Reinbek bei Hamburg'],
  ])('macht aus „%s“ „%s“', (roh, erwartet) => {
    const xml = kopf + ohneOrt.replace('<subfield code="a">[S.l.]</subfield>', `<subfield code="a">${roh}</subfield>`) + fuss
    expect(trefferAusMarc(leseMarc(xml)[0])!.auflage.ort).toBe(erwartet)
  })
})

describe('Untertitel der DNB', () => {
  it('glättet Doppelpunkt-Trenner und Klammern', () => {
    const xml = kopf + gedruckt.replace('Grundzüge einer modernen Weltanschauung ; seelische', 'Grundzüge einer modernen Weltanschauung : (seelische').replace('naturwissenschaftlicher Methode</subfield>', 'naturwissenschaftlicher Methode)</subfield>') + fuss
    expect(trefferAusMarc(leseMarc(xml)[0])!.untertitel).toBe('Grundzüge einer modernen Weltanschauung. Seelische Beobachtungsresultate nach naturwissenschaftlicher Methode')
  })
})

describe('dnbAnfrage', () => {
  it('sucht nach Titel und Person', () => {
    expect(dnbAnfrage('Steiner', 'Philosophie der Freiheit')).toBe('tit="Philosophie der Freiheit" and per="Steiner"')
  })
  it('sucht nach der ISBN, wenn im Titel eine steht', () => {
    expect(dnbAnfrage('', '3-7274-6280-9')).toBe('num=3727462809')
  })
  it('liefert ohne Angaben nichts', () => {
    expect(dnbAnfrage(' ', '')).toBe('')
  })
})
