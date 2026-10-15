import { describe, expect, it } from 'vitest'
import { exportiere, exportiereCsl, importiere, zusammenfuehren } from './speicher'
import { leereAuflage, leeresWerk } from './model'

describe('Import und Export', () => {
  const w = { ...leeresWerk(), titel: 'Wahrheit und Wissenschaft' }
  it('liest die eigene Exportdatei unverändert zurück', () => {
    const d = { werke: [w], verlage: [{ id: 'v', name: 'Verlag am Goetheanum', kuerzel: 'goe', orte: [] }] }
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
