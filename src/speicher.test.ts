import { describe, expect, it } from 'vitest'
import { exportiere, exportiereCsl, importiere, migriere, zusammenfuehren } from './speicher'
import { leereAuflage, leeresWerk } from './model'

describe('Import und Export', () => {
  const w = { ...leeresWerk(), titel: 'Wahrheit und Wissenschaft' }
  it('liest die eigene Exportdatei unverändert zurück', () => {
    const d = { werke: [w], verlage: [{ id: 'v', kuerzel: 'goe', namen: [{ abJahr: '', name: 'Verlag am Goetheanum' }], orte: [], schreibweisen: [] }] }
    expect(importiere(exportiere(d))).toEqual(d)
  })
  it('weist fremde Dateien ab', () => {
    expect(() => importiere('{"a":1}')).toThrow('nicht aus diesem Programm')
    expect(() => importiere('kein json')).toThrow('kein gültiges JSON')
  })
  it('behält beim Zusammenführen die neuere Fassung', () => {
    const alt = { ...w, titel: 'alt', geaendert: '2026-01-01' }
    const neu = { ...w, titel: 'neu', geaendert: '2026-02-01' }
    expect(zusammenfuehren({ werke: [neu], verlage: [] }, { werke: [alt], verlage: [] }).werke[0].titel).toBe('neu')
    expect(zusammenfuehren({ werke: [alt], verlage: [] }, { werke: [neu], verlage: [] }).werke[0].titel).toBe('neu')
  })
  it('schreibt CSL-JSON mit einem Eintrag pro Auflage', () => {
    const buch = {
      ...w,
      personen: [{ vorname: 'Rudolf', nachname: 'Steiner', rolle: 'autor' as const }],
      auflagen: [
        { ...leereAuflage(), jahr: '1892', ort: 'Weimar', verlag: 'Weißbach' },
        { ...leereAuflage(), nummer: '2', jahr: '1925', ort: 'Dornach', verlag: 'Philosophisch-Anthroposophischer Verlag' },
      ],
    }
    const csl = JSON.parse(exportiereCsl([buch]))
    expect(csl).toHaveLength(2)
    expect(csl[1]).toMatchObject({ type: 'book', 'publisher-place': 'Dornach', edition: '2', author: [{ family: 'Steiner', given: 'Rudolf' }] })
  })
})

describe('Version 1 übersetzen', () => {
  const alt = {
    format: 'bibliographie-datenstamm',
    version: 1,
    verlage: [{ id: 'v', name: 'Verlag am Goetheanum', kuerzel: 'goe', orte: [{ abJahr: '1923', ort: 'Dornach', wechselImJahr: false }] }],
    werke: [{ ...leeresWerk(), auflagen: [{ id: 'a', nummer: '', jahr: '1950', gedrucktesJahr: '', erscheinungstag: '', verlag: 'Verlag am Goetheanum', ort: 'Dornach', seiten: '', seitenRoemisch: '', vermerk: '' }] }],
  }
  it('liest eine Datei der Version 1 und verknüpft Auflagen über den Namen', () => {
    const d = importiere(JSON.stringify(alt))
    expect(d.verlage[0]).toEqual({ id: 'v', kuerzel: 'goe', namen: [{ abJahr: '', name: 'Verlag am Goetheanum' }], orte: alt.verlage[0].orte, schreibweisen: [] })
    expect(d.werke[0].auflagen[0]).toMatchObject({ verlagId: 'v', isbn: '' })
  })
  it('lässt Daten der Version 2 unverändert', () => {
    const d = importiere(JSON.stringify(alt))
    expect(migriere(d)).toEqual(d)
  })
  it('weist neuere Versionen ab', () => {
    expect(() => importiere(JSON.stringify({ ...alt, version: 99 }))).toThrow('neueren Programmversion')
  })
})

describe('ISBN im CSL-Export', () => {
  it('gibt die ISBN der Auflage mit', () => {
    const buch = { ...leeresWerk(), titel: 'T', auflagen: [{ ...leereAuflage(), jahr: '1990', isbn: '3-7274-0040-5' }] }
    expect(JSON.parse(exportiereCsl([buch]))[0].ISBN).toBe('3-7274-0040-5')
  })
})
