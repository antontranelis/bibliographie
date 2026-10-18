import { describe, expect, it } from 'vitest'
import { karteiTreffer } from './Katalogsuche'
import { leereAuflage, leereAusgabe, leeresWerk } from './model'

describe('karteiTreffer', () => {
  const w = { ...leeresWerk(), titel: 'Die Philosophie der Freiheit', personen: [{ vorname: 'Rudolf', nachname: 'Steiner', rolle: 'autor' as const }], ausgaben: [{ ...leereAusgabe(), auflagen: [{ ...leereAuflage(), isbn: '978-3-7274-0040-6' }] }] }
  it('findet über Autor und Titelwörter', () => {
    expect(karteiTreffer([w], 'x', 'Stei', 'Freiheit')).toEqual([w])
  })
  it('findet über die ISBN, auch anders geschrieben', () => {
    expect(karteiTreffer([w], 'x', '', '9783727400406')).toEqual([w])
    expect(karteiTreffer([w], 'x', '', '9783727400000')).toEqual([])
  })
})
