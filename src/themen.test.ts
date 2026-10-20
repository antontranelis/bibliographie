import { describe, expect, it } from 'vitest'
import { ausruecken, baum, bezeichnung, einruecken, entfernen, neuesThema, pfad, unterthemen, verschiebe } from './themen'
import type { Thema } from './model'

const t = (id: string, elternId = '', nummer = '', titel = id): Thema => ({ id, nummer, titel, elternId })
// V. Medien > a) Manipulation > 1. Werbung; V. Medien > b) Netzwerke; VI. Technik
const ordnung = [t('v', '', 'V.', 'Medien'), t('a', 'v', 'a)', 'Manipulation'), t('w', 'a', '1.', 'Werbung'), t('b', 'v', 'b)', 'Netzwerke'), t('vi', '', 'VI.', 'Technik')]

describe('Themenordnung', () => {
  it('Baum in Lesereihenfolge mit Tiefe', () => {
    expect(baum(ordnung).map((x) => `${x.tiefe}:${x.thema.id}`)).toEqual(['0:v', '1:a', '2:w', '1:b', '0:vi'])
  })
  it('Baum bleibt richtig, auch wenn ein Kind vor seinem Eltern steht', () => {
    expect(baum([ordnung[1], ...ordnung.filter((x) => x.id !== 'a')]).map((x) => x.thema.id)).toEqual(['v', 'a', 'w', 'b', 'vi'])
  })
  it('Bezeichnung und Pfad', () => {
    expect(bezeichnung(ordnung[1])).toBe('a) Manipulation')
    expect(pfad(ordnung, 'w')).toBe('V. Medien › a) Manipulation › 1. Werbung')
  })
  it('Unterthemen schließen das Thema selbst ein', () => {
    expect([...unterthemen(ordnung, 'v')].sort()).toEqual(['a', 'b', 'v', 'w'])
    expect([...unterthemen(ordnung, 'vi')]).toEqual(['vi'])
  })
  it('neues Thema kommt hinter die letzten Nachkommen seines Elternthemas', () => {
    const { themen, thema } = neuesThema(ordnung, 'v')
    expect(baum(themen).map((x) => x.thema.id)).toEqual(['v', 'a', 'w', 'b', thema.id, 'vi'])
    expect(thema.elternId).toBe('v')
  })
  it('verschieben unter Geschwistern, mit allen Unterthemen', () => {
    expect(baum(verschiebe(ordnung, 'b', -1)).map((x) => x.thema.id)).toEqual(['v', 'b', 'a', 'w', 'vi'])
    expect(baum(verschiebe(ordnung, 'vi', -1)).map((x) => x.thema.id)).toEqual(['vi', 'v', 'a', 'w', 'b'])
    expect(verschiebe(ordnung, 'v', -1)).toBe(ordnung)
  })
  it('einrücken unter das vorige Geschwister, ausrücken hinter das Elternthema', () => {
    expect(einruecken(ordnung, 'b').find((x) => x.id === 'b')?.elternId).toBe('a')
    expect(einruecken(ordnung, 'v')).toBe(ordnung)
    const aus = ausruecken(ordnung, 'w')
    expect(aus.find((x) => x.id === 'w')?.elternId).toBe('v')
    expect(baum(aus).map((x) => x.thema.id)).toEqual(['v', 'a', 'w', 'b', 'vi'])
  })
  it('entfernen nimmt die Unterthemen mit und nennt alle IDs', () => {
    const r = entfernen(ordnung, 'a')
    expect(r.themen.map((x) => x.id)).toEqual(['v', 'b', 'vi'])
    expect([...r.entfernt].sort()).toEqual(['a', 'w'])
  })
})
