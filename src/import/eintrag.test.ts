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
    expect(e.werk?.auflagen[0]).toMatchObject({ ort: 'Dornach/Stuttgart', jahr: '1928' })
    expect(rueckprobe(e.werk!, laeufe).ergebnis).toBe('gleich')
  })
  it('Beitrag in einer Zeitschrift (Nr. 985)', () => {
    const laeufe = [n('Werner Schäfer: '), f('Durch Mittel der Medientechnik'), n(' (in: '), k('Gegenwart'), n(' 1/2004, S. 27f)')]
    const e = zerlegeEintrag(laeufe)
    expect(e.status).toBe('erkannt')
    expect(e.werk?.erschienenIn).toMatchObject({ titel: 'Gegenwart', ausgabe: '1/2004', jahr: '2004' })
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
  it('weitere Ausgaben nach Semikolon bleiben als Kette stehen', () => {
    expect(zerlegeEintrag([n('A B: '), f('T'), n(', Basel 1990; 2. Aufl. 1995')]).status).toBe('kette')
  })
})
