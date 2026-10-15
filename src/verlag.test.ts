import { describe, expect, it } from 'vitest'
import {
  aehnlich,
  anzeigeName,
  findeAehnlich,
  findeExakt,
  kuerzelVorschlag,
  nachVerlagsAenderung,
  nameFuerJahr,
  ortFuerJahr,
  ortGleich,
  ortsAbweichung,
  ortswechselEintragen,
  planeVerlage,
  verlagAus,
  verlagVorschlaege,
  wendePlanAn,
} from './verlag'
import { leereAuflage, leeresWerk, type Auflage, type Verlag, type Werk } from './model'

const pav: Verlag = {
  id: 'v1',
  kuerzel: 'pav',
  namen: [{ abJahr: '', name: 'Philosophisch-Anthroposophischer Verlag' }],
  orte: [
    { abJahr: '1908', ort: 'Berlin', wechselImJahr: false },
    { abJahr: '1923', ort: 'Dornach', wechselImJahr: true },
  ],
  schreibweisen: [],
}
const goe: Verlag = {
  id: 'v2',
  kuerzel: 'goe',
  namen: [
    { abJahr: '', name: 'Verlag der Goetheanum-Stiftung' },
    { abJahr: '1980', name: 'Verlag am Goetheanum' },
  ],
  orte: [{ abJahr: '', ort: 'Dornach', wechselImJahr: false }],
  schreibweisen: ['Verl. am Goetheanum'],
}
const auflage = (teil: Partial<Auflage>): Auflage => ({ ...leereAuflage(), ...teil })
const werk = (auflagen: Auflage[]): Werk => ({ ...leeresWerk(), titel: 'T', auflagen })

describe('Orts- und Namensgeschichte', () => {
  it('nimmt den ersten Ort vor dem ersten Wechsel', () => {
    expect(ortFuerJahr(pav, '1918')).toEqual({ ort: 'Berlin', zweiOrteMoeglich: null })
  })
  it('nimmt den neuen Ort nach dem Wechseljahr', () => {
    expect(ortFuerJahr(pav, '1925')).toEqual({ ort: 'Dornach', zweiOrteMoeglich: null })
  })
  it('warnt im Wechseljahr, wenn der Wechsel mitten im Jahr lag', () => {
    expect(ortFuerJahr(pav, '1923')).toEqual({ ort: 'Dornach', zweiOrteMoeglich: ['Berlin', 'Dornach'] })
  })
  it('liefert ohne Ortsgeschichte nichts', () => {
    expect(ortFuerJahr({ ...pav, orte: [] }, '1950')).toBeNull()
  })
  it('nennt den Namen, den der Verlag im Erscheinungsjahr trug', () => {
    expect(nameFuerJahr(goe, '1960')).toBe('Verlag der Goetheanum-Stiftung')
    expect(nameFuerJahr(goe, '1985')).toBe('Verlag am Goetheanum')
    expect(nameFuerJahr(goe, '')).toBe('Verlag der Goetheanum-Stiftung')
  })
  it('zeigt den jüngsten Namen an', () => {
    expect(anzeigeName(goe)).toBe('Verlag am Goetheanum')
  })
})

describe('Finden', () => {
  it('findet über das Kürzel, frühere Namen und Schreibweisen', () => {
    expect(verlagVorschlaege([pav, goe], 'goe')[0]).toBe(goe)
    expect(verlagVorschlaege([pav, goe], 'Verlag der Goe')).toEqual([goe])
    expect(verlagVorschlaege([pav, goe], 'Verl. am')).toEqual([goe])
    expect(verlagVorschlaege([pav, goe], ' ')).toEqual([])
  })
  it('ordnet exakt zu, ohne auf Groß- und Kleinschreibung oder Leerzeichen zu achten', () => {
    expect(findeExakt([pav, goe], ' verl.  am goetheanum ')).toBe(goe)
    expect(findeExakt([pav, goe], 'Verlag der Goetheanum-Stiftung')).toBe(goe)
    expect(findeExakt([pav, goe], 'Goetheanum')).toBeUndefined()
  })
  it.each([
    ['Philos.-Anthroposophischer Verl.', 'Philosophisch-Anthroposophischer Verlag'],
    ['Philosoph.-Anthroposoph. Verl.', 'Philosophisch-Anthroposophischer Verlag'],
    ['Rudolf-Steiner-Verl.', 'Rudolf Steiner Verlag'],
    ['Verl. Freies Geistesleben', 'Verlag Freies Geistesleben'],
  ])('hält „%s“ und „%s“ für ähnlich', (a, b) => {
    expect(aehnlich(a, b)).toBe(true)
  })
  it.each([
    ['Rudolf Stiener-Nachlassverwaltung', 'Rudolf Steiner Verlag'],
    ['Verlag Urachhaus', 'Verlag Freies Geistesleben'],
    ['Emil Felber', 'Felber & Söhne Verlag Berlin'],
    ['Verlag', 'Verlag'],
  ])('hält „%s“ und „%s“ nicht für ähnlich', (a, b) => {
    expect(aehnlich(a, b)).toBe(false)
  })
  it('findet ähnliche, aber nicht exakte Verlage', () => {
    expect(findeAehnlich([pav, goe], 'Philos.-anthropos. Verl.')).toBe(pav)
    expect(findeAehnlich([pav, goe], 'Philosophisch-Anthroposophischer Verlag')).toBeUndefined()
  })
  it('vergleicht Orte über das erste Wort', () => {
    expect(ortGleich('Dornach (Schweiz)', 'Dornach')).toBe(true)
    expect(ortGleich('Berlin W.', 'berlin')).toBe(true)
    expect(ortGleich('Dornach/Schweiz', 'Basel')).toBe(false)
  })
  it('schlägt ein freies Kürzel vor', () => {
    expect(kuerzelVorschlag('Verlag Freies Geistesleben', [])).toBe('fg')
    expect(kuerzelVorschlag('Verlag Freies Geistesleben', [goe, { ...pav, kuerzel: 'fg' }])).toBe('fg2')
  })
})

describe('Neuer Verlag aus Auflagen', () => {
  it('leitet die Ortsgeschichte aus den Auflagen ab und nimmt die ausgeschriebene Form als Namen', () => {
    const v = verlagAus(
      ['Philos.-Anthroposophischer Verl.', 'Philosophisch-Anthroposophischer Verlag'],
      [
        auflage({ jahr: '1929', ort: 'Dornach (Schweiz)' }),
        auflage({ jahr: '1918', ort: 'Berlin W.' }),
        auflage({ jahr: '1921', ort: 'Berlin' }),
      ],
      [],
    )
    expect(v.namen).toEqual([{ abJahr: '', name: 'Philosophisch-Anthroposophischer Verlag' }])
    expect(v.schreibweisen).toEqual(['Philos.-Anthroposophischer Verl.'])
    expect(v.orte).toEqual([
      { abJahr: '', ort: 'Berlin', wechselImJahr: false },
      { abJahr: '1929', ort: 'Dornach', wechselImJahr: false },
    ])
    expect(v.kuerzel).toBe('pa')
  })
})

describe('Abgleich einer Karte', () => {
  it('teilt die Verlage einer Karte in bekannt, ähnlich und neu', () => {
    const w = werk([
      auflage({ verlag: 'Verl. am Goetheanum', jahr: '1985' }),
      auflage({ verlag: 'Philos.-Anthroposophischer Verl.', jahr: '1918' }),
      auflage({ verlag: 'Philosoph.-Anthroposoph. Verl.', jahr: '1921' }),
      auflage({ verlag: 'Emil Felber', jahr: '1893' }),
      auflage({ verlag: '', jahr: '1990' }),
    ])
    const plan = planeVerlage(w, [pav, goe])
    expect(plan.map((g) => [g.art, g.texte, g.auflagen.length])).toEqual([
      ['bekannt', ['Verl. am Goetheanum'], 1],
      ['aehnlich', ['Philos.-Anthroposophischer Verl.', 'Philosoph.-Anthroposoph. Verl.'], 2],
      ['neu', ['Emil Felber'], 1],
    ])
    expect(plan[1].verlag).toBe(pav)
  })
  it('übergeht schon verknüpfte Auflagen', () => {
    const w = werk([auflage({ verlag: 'Irgendwas', verlagId: 'v1' })])
    expect(planeVerlage(w, [pav, goe])).toEqual([])
  })
  it('verknüpft bei „derselbe“ und merkt die Schreibweisen', () => {
    const w = werk([auflage({ verlag: 'Philos.-Anthroposophischer Verl.', jahr: '1918', ort: 'Berlin' })])
    const plan = planeVerlage(w, [pav])
    const r = wendePlanAn(w, [pav], plan, () => true)
    expect(r.werk.auflagen[0].verlagId).toBe('v1')
    expect(r.werk.auflagen[0].verlag).toBe('Philos.-Anthroposophischer Verl.')
    expect(r.verlage[0].schreibweisen).toEqual(['Philos.-Anthroposophischer Verl.'])
  })
  it('legt bei „anderer Verlag“ und bei Neuen einen Verlag an', () => {
    const w = werk([
      auflage({ verlag: 'Philos.-Anthroposophischer Verl.', jahr: '1918', ort: 'Berlin' }),
      auflage({ verlag: 'Emil Felber', jahr: '1893', ort: 'Berlin' }),
    ])
    const r = wendePlanAn(w, [pav], planeVerlage(w, [pav]), () => false)
    expect(r.verlage).toHaveLength(3)
    expect(r.werk.auflagen.every((a) => a.verlagId && a.verlagId !== 'v1')).toBe(true)
    const felber = r.verlage.find((v) => anzeigeName(v) === 'Emil Felber')
    expect(felber?.orte).toEqual([{ abJahr: '', ort: 'Berlin', wechselImJahr: false }])
  })
  it('lässt eine ähnliche Gruppe offen, wenn die Antwort fehlt', () => {
    const w = werk([auflage({ verlag: 'Philos.-Anthroposophischer Verl.' })])
    const r = wendePlanAn(w, [pav], planeVerlage(w, [pav]), () => undefined)
    expect(r.werk.auflagen[0].verlagId).toBeUndefined()
    expect(r.verlage).toEqual([pav])
  })
})

describe('Ortswechsel lernen', () => {
  it('erkennt einen abweichenden Ort bei verknüpfter Auflage', () => {
    expect(ortsAbweichung(pav, auflage({ verlagId: 'v1', jahr: '1950', ort: 'Stuttgart' }))).toEqual({ erwartet: 'Dornach' })
    expect(ortsAbweichung(pav, auflage({ verlagId: 'v1', jahr: '1950', ort: 'Dornach (Schweiz)' }))).toBeNull()
    expect(ortsAbweichung(pav, auflage({ verlagId: 'v1', jahr: '1950', ort: 'Stuttgart', ortBestaetigt: true }))).toBeNull()
    expect(ortsAbweichung(pav, auflage({ verlagId: 'v1', jahr: '1950', ort: '' }))).toBeNull()
  })
  it('trägt einen Ortswechsel ab dem Jahr ein, sortiert', () => {
    const v = ortswechselEintragen(pav, '1915', 'Leipzig')
    expect(v.orte.map((o) => `${o.abJahr} ${o.ort}`)).toEqual(['1908 Berlin', '1915 Leipzig', '1923 Dornach'])
  })
})

describe('Änderungen an der Verlagskarte', () => {
  it('zieht Namen und Ort verknüpfter Auflagen nach, solange sie dem alten Stand entsprachen', () => {
    const w = werk([
      auflage({ verlagId: 'v1', verlag: 'Philosophisch-Anthroposophischer Verlag', jahr: '1918', ort: 'Berlin' }),
      auflage({ verlagId: 'v1', verlag: 'Philos. Verl.', jahr: '1925', ort: 'Basel' }),
      auflage({ verlag: 'Philosophisch-Anthroposophischer Verlag', jahr: '1918', ort: 'Berlin' }),
    ])
    const neu: Verlag = { ...pav, namen: [{ abJahr: '', name: 'Phil.-Anthr. Verlag' }], orte: [{ abJahr: '', ort: 'Leipzig', wechselImJahr: false }] }
    const [r] = nachVerlagsAenderung([w], pav, neu)
    expect(r.auflagen[0]).toMatchObject({ verlag: 'Phil.-Anthr. Verlag', ort: 'Leipzig' })
    expect(r.auflagen[1]).toMatchObject({ verlag: 'Philos. Verl.', ort: 'Basel' })
    expect(r.auflagen[2]).toMatchObject({ verlag: 'Philosophisch-Anthroposophischer Verlag', ort: 'Berlin' })
  })
  it('lässt Werke ohne Bezug unverändert', () => {
    const w = werk([auflage({ verlag: 'X' })])
    expect(nachVerlagsAenderung([w], pav, { ...pav, kuerzel: 'p' })[0]).toBe(w)
  })
})
