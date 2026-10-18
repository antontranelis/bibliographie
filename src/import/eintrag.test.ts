import { describe, expect, it } from 'vitest'
import { rueckprobe, zerlegeEintrag, zerlegeName } from './eintrag'
import type { Lauf } from './odt'

const n = (text: string): Lauf => ({ text, fett: false, kursiv: false, hinterlegt: null })
const f = (text: string): Lauf => ({ ...n(text), fett: true })
const k = (text: string): Lauf => ({ ...n(text), kursiv: true })

describe('zerlegeName', () => {
  it('Partikel und Zusatz gehören zum Nachnamen', () => {
    expect(zerlegeName('Ludwig van Beethoven')).toEqual({ vorname: 'Ludwig', nachname: 'van Beethoven' })
    expect(zerlegeName('Orrin E. Dunlop, Jr.')).toEqual({ vorname: 'Orrin E.', nachname: 'Dunlop, Jr.' })
  })
})

describe('zerlegeEintrag', () => {
  it('Buch mit Untertitel, Ort und Jahr (Nr. 7)', () => {
    const laeufe = [n('Albert Steffen: '), f('Der Künstler und die Erfüllung der Mysterien'), n(', Dornach/Stuttgart 1928')]
    const e = zerlegeEintrag(laeufe)
    expect(e.status).toBe('erkannt')
    expect(e.werk?.titel).toBe('Der Künstler und die Erfüllung der Mysterien')
    expect(e.werk?.ausgaben[0].auflagen[0]).toMatchObject({ ort: 'Dornach/Stuttgart', jahr: '1928' })
    expect(rueckprobe(e.werk!, laeufe).ergebnis).toBe('gleich')
  })
  it('Beitrag in einer Zeitschrift (Nr. 985)', () => {
    const laeufe = [n('Werner Schäfer: '), f('Durch Mittel der Medientechnik'), n(' (in: '), k('Gegenwart'), n(' 1/2004, S. 27f)')]
    const e = zerlegeEintrag(laeufe)
    expect(e.status).toBe('erkannt')
    expect(e.werk?.erschienenIn).toMatchObject({ titel: 'Gegenwart', ausgabe: '1/2004', jahr: '2004' })
    // Auch ein Beitrag behält eine erste Ausgabe, damit er sich in ein Buch umstellen lässt
    expect(e.werk?.ausgaben).toHaveLength(1)
    expect(rueckprobe(e.werk!, laeufe).ergebnis).toBe('gleich')
  })
  it('aufrechte Titel in der Anmerkung werden markiert (Nr. 1406)', () => {
    const laeufe = [
      n('Irving John Good: '),
      f('The Estimation of Probabilities'),
      n(', Cambridge/MA 1965 '),
      k('(Anm.: erschienen als '),
      n('Research Monograph Nr. 30'),
      k('.)'),
    ]
    const e = zerlegeEintrag(laeufe)
    expect(e.werk?.anmerkung).toBe('erschienen als *Research Monograph Nr. 30*.')
    expect(rueckprobe(e.werk!, laeufe).ergebnis).toBe('gleich')
  })
  it('Kommentare an den Leser werden abgetrennt', () => {
    const e = zerlegeEintrag([n('A B: '), f('T'), n(', Basel 1990'), { ...n(' Bitte prüfen.'), hinterlegt: '#ff00ff' }])
    expect(e.hinweis).toBe('Bitte prüfen.')
    expect(e.original).toBe('A B: T, Basel 1990')
  })
  it('weitere Auflagen mit Bearbeitung und Ortswechsel (Nr. 102)', () => {
    const laeufe = [n('Ernst Iros: '), f('Wesen und Dramaturgie des Films'), n(', Zürich/Leipzig 1938; 2. erw. Aufl. Zürich 1957; 3. Aufl. ebenda 1962')]
    const e = zerlegeEintrag(laeufe)
    expect(e.status).toBe('erkannt')
    expect(e.werk?.ausgaben).toHaveLength(1)
    expect(e.werk?.ausgaben[0].auflagen.map((a) => [a.nummer, a.bearbeitung, a.ort, a.jahr, a.inListe])).toEqual([
      ['', '', 'Zürich/Leipzig', '1938', true],
      ['2', 'erw.', 'Zürich', '1957', true],
      ['3', '', 'Zürich', '1962', true],
    ])
    expect(rueckprobe(e.werk!, laeufe).ergebnis).toBe('gleich')
  })
  it('Übersetzung mit fettem Titel (Nr. 510)', () => {
    const laeufe = [
      n('Neil Postman: '),
      f('Amusing Ourselves to Death'),
      n('. Public Discourse in the Age of Show Business, New York 1985; deutsche Ausgabe: '),
      f('Wir amüsieren uns zu Tode'),
      n('. Urteilsbildung im Zeitalter der Unterhaltungsindustrie, Frankfurt a.M. 1985'),
    ]
    const e = zerlegeEintrag(laeufe)
    expect(e.status).toBe('erkannt')
    expect(e.werk?.ausgaben[1]).toMatchObject({ art: 'uebersetzung', sprache: 'deutsch', bezeichnung: '', titel: 'Wir amüsieren uns zu Tode', untertitel: 'Urteilsbildung im Zeitalter der Unterhaltungsindustrie' })
    expect(e.werk?.ausgaben[1].auflagen[0]).toMatchObject({ ort: 'Frankfurt a.M.', jahr: '1985' })
    expect(rueckprobe(e.werk!, laeufe).ergebnis).toBe('gleich')
  })
  it('Ausgabeart ohne Titel, „ebd.“ übernimmt den Ort (Nr. 689)', () => {
    const laeufe = [n('Walter Wüllenweber: '), f('Wir Fernsehkinder'), n('. Eine Generation ohne Programm, Reinbek bei Hamburg 1994; als Taschenbuch, ebd. 1996')]
    const e = zerlegeEintrag(laeufe)
    expect(e.status).toBe('erkannt')
    expect(e.werk?.ausgaben[1]).toMatchObject({ art: 'taschenbuch', bezeichnung: '' })
    expect(rueckprobe(e.werk!, laeufe).gedruckt).toBe('Walter Wüllenweber: Wir Fernsehkinder. Eine Generation ohne Programm, Reinbek bei Hamburg 1994; als Taschenbuch 1996')
    expect(e.werk?.ausgaben[1].auflagen[0]).toMatchObject({ ort: 'Reinbek bei Hamburg', jahr: '1996' })
    expect(rueckprobe(e.werk!, laeufe).ergebnis).toBe('gleich')
  })
  it('Titeländerung bleibt in der Bezeichnung (Nr. 1576)', () => {
    const laeufe = [
      n('Dorothy Stein: '),
      f('Ada. A Life and a Legacy'),
      n(', Cambridge/MA 1985; deutsche Ausgabe: '),
      f('Ada. Die Braut der Wissenschaft'),
      n(', Berlin 1999; 2. Aufl. als: '),
      f('Ada Augusta Lovelace. Eine Frau am Anfang der Moderne'),
      n(', ebenda 2004'),
    ]
    const e = zerlegeEintrag(laeufe)
    expect(e.status).toBe('erkannt')
    expect(e.werk?.ausgaben[2]).toMatchObject({ art: 'neuausgabe', bezeichnung: '2. Aufl. als', titel: 'Ada Augusta Lovelace. Eine Frau am Anfang der Moderne' })
    expect(e.werk?.ausgaben[2].auflagen[0]).toMatchObject({ ort: 'Berlin', jahr: '2004' })
    expect(rueckprobe(e.werk!, laeufe).ergebnis).toBe('gleich')
  })
  it('frei formulierte Kettenglieder bleiben als Kette stehen', () => {
    expect(zerlegeEintrag([n('A B: '), f('T'), n(', Basel 1990; weitere Aufl.')]).status).toBe('kette')
  })
})
