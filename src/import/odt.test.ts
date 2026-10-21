import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { zerlegeEintrag } from './eintrag'
import { leseAbsaetze, leseOdt, leseOdtDokument } from './odt'

const odt = (eintrag: string) => dokument(`<text:list><text:list-item><text:p>${eintrag}</text:p></text:list-item></text:list>`)

const dokument = (inhalt: string) =>
  zipSync({
    'content.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-content><office:automatic-styles>
<style:style style:name="T1" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
</office:automatic-styles><office:body><office:text>
${inhalt}
</office:text></office:body></office:document-content>`),
  })

describe('leseOdt', () => {
  it('dekodiert benannte, dezimale und hexadezimale Zeichenreferenzen', () => {
    const [e] = leseOdt(odt('A B: <text:span text:style-name="T1">Fran&#xE7;ois &#x2013; Film &#8222;X&#8220; &#x1D11E; &amp; &lt;Ton&gt;</text:span>, Paris 1990'))
    const w = zerlegeEintrag(e.laeufe).werk
    expect(w?.titel).toBe('François – Film „X“ 𝄞 & <Ton>')
  })
  it('dekodiert nicht doppelt', () => {
    const [e] = leseOdt(odt('&amp;#x41; &amp;lt; &amp;amp;'))
    expect(e.laeufe.map((l) => l.text).join('')).toBe('&#x41; &lt; &amp;')
  })
})

describe('leseOdtDokument', () => {
  it('Absätze außerhalb der Listen sind Abschnitte, auch ohne Überschriftenformat', () => {
    const d = leseOdtDokument(
      dokument(
        '<text:p>V. Medien</text:p><text:p><text:span>a) Manipulation</text:span>:</text:p>' +
          '<text:list><text:list-item><text:p>A B: <text:span text:style-name="T1">Eins</text:span>, Basel 1990</text:p></text:list-item>' +
          '<text:list-item><text:p>C D: <text:span text:style-name="T1">Zwei</text:span>, Bern 1991</text:p></text:list-item></text:list>' +
          '<text:p/><text:h>b) Netzwerke</text:h>' +
          '<text:list><text:list-item><text:p>E F: <text:span text:style-name="T1">Drei</text:span>, Wien 1992</text:p></text:list-item></text:list>',
      ),
    )
    expect(d.abschnitte).toEqual(['V. Medien', 'a) Manipulation:', 'b) Netzwerke'])
    expect(d.eintraege.map((e) => [e.abschnittNr, e.abschnitt])).toEqual([
      [1, 'a) Manipulation:'],
      [1, 'a) Manipulation:'],
      [2, 'b) Netzwerke'],
    ])
  })
  it('Einträge vor dem ersten Absatz gehören zu keinem Abschnitt', () => {
    const d = leseOdtDokument(dokument('<text:list><text:list-item><text:p>Erster</text:p></text:list-item></text:list>'))
    expect(d.abschnitte).toEqual([])
    expect(d.eintraege[0].abschnittNr).toBe(-1)
  })
})

describe('leseAbsaetze', () => {
  it('alle Absätze in Reihenfolge, mit der Tiefe ihrer Aufzählung', () => {
    const a = leseAbsaetze(
      dokument(
        '<text:p>Gesamtgerüst</text:p>' +
          '<text:list><text:list-item><text:p>V. Medien</text:p>' +
          '<text:list><text:list-item><text:p>a) <text:span>Film</text:span></text:p></text:list-item><text:list-item><text:p>b) Rundfunk</text:p></text:list-item></text:list>' +
          '</text:list-item><text:list-item><text:h>VI. Technik</text:h></text:list-item></text:list><text:p/>',
      ),
    )
    expect(a).toEqual([
      { text: 'Gesamtgerüst', tiefe: 0 },
      { text: 'V. Medien', tiefe: 1 },
      { text: 'a) Film', tiefe: 2 },
      { text: 'b) Rundfunk', tiefe: 2 },
      { text: 'VI. Technik', tiefe: 1 },
    ])
  })
})
