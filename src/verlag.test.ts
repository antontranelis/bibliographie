import { describe, expect, it } from 'vitest'
import { ortFuerJahr, verlagVorschlaege } from './verlag'
import type { Verlag } from './model'

const steiner: Verlag = {
  id: 'v1',
  name: 'Philosophisch-Anthroposophischer Verlag',
  kuerzel: 'pav',
  orte: [
    { abJahr: '1908', ort: 'Berlin', wechselImJahr: false },
    { abJahr: '1923', ort: 'Dornach', wechselImJahr: true },
  ],
}
const goe: Verlag = { id: 'v2', name: 'Verlag am Goetheanum', kuerzel: 'goe', orte: [] }

describe('ortFuerJahr', () => {
  it('nimmt den ersten Ort für alle Jahre vor dem ersten Wechsel', () => {
    expect(ortFuerJahr(steiner, '1918')).toEqual({ ort: 'Berlin', zweiOrteMoeglich: null })
  })
  it('nimmt den neuen Ort nach dem Wechseljahr', () => {
    expect(ortFuerJahr(steiner, '1925')).toEqual({ ort: 'Dornach', zweiOrteMoeglich: null })
  })
  it('warnt im Wechseljahr, wenn der Wechsel mitten im Jahr lag', () => {
    expect(ortFuerJahr(steiner, '1923')).toEqual({ ort: 'Dornach', zweiOrteMoeglich: ['Berlin', 'Dornach'] })
  })
  it('nimmt ohne Jahr den ersten Ort', () => {
    expect(ortFuerJahr(steiner, '')?.ort).toBe('Berlin')
  })
  it('liefert nichts ohne Ortsgeschichte', () => {
    expect(ortFuerJahr(goe, '1950')).toBeNull()
  })
})

describe('verlagVorschlaege', () => {
  it('findet über das Kürzel', () => {
    expect(verlagVorschlaege([steiner, goe], 'goe')[0]).toBe(goe)
  })
  it('findet über den Namensanfang', () => {
    expect(verlagVorschlaege([steiner, goe], 'Verlag am G')).toEqual([goe])
  })
  it('liefert bei leerer Eingabe nichts', () => {
    expect(verlagVorschlaege([steiner, goe], ' ')).toEqual([])
  })
})
