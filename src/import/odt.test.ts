import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { zerlegeEintrag } from './eintrag'
import { leseOdt } from './odt'

const odt = (eintrag: string) =>
  zipSync({
    'content.xml': strToU8(`<?xml version="1.0" encoding="UTF-8"?>
<office:document-content><office:automatic-styles>
<style:style style:name="T1" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>
</office:automatic-styles><office:body><office:text>
<text:list><text:list-item><text:p>${eintrag}</text:p></text:list-item></text:list>
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
