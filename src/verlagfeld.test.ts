import { describe, expect, it } from 'vitest'
import { berechneLage } from './VerlagFeld'

const fenster = { breite: 1360, hoehe: 900 }

describe('berechneLage', () => {
  it('öffnet unter dem Feld, wenn unten Platz ist', () => {
    const l = berechneLage({ left: 200, top: 100, bottom: 130, width: 300 }, fenster)
    expect(l).toMatchObject({ left: 200, top: 136, width: 420 })
    expect(l.bottom).toBeUndefined()
  })
  it('klappt nach oben, wenn unten zu wenig Platz ist', () => {
    const l = berechneLage({ left: 200, top: 800, bottom: 830, width: 300 }, fenster)
    expect(l.top).toBeUndefined()
    expect(l.bottom).toBe(900 - 800 + 6)
    expect(l.maxHoehe).toBe(800 - 6 - 16 - 44)
  })
  it('rückt vom rechten Rand ab', () => {
    const l = berechneLage({ left: 1200, top: 100, bottom: 130, width: 150 }, fenster)
    expect(l.left + l.width).toBe(1360 - 16)
  })
  it('wird auf schmalen Bildschirmen nie breiter als das Fenster', () => {
    const l = berechneLage({ left: 40, top: 100, bottom: 130, width: 200 }, { breite: 390, hoehe: 844 })
    expect(l.width).toBe(390 - 32)
    expect(l.left).toBe(16)
  })
  it('begrenzt die Höhe auf den Platz unten', () => {
    const l = berechneLage({ left: 40, top: 400, bottom: 430, width: 300 }, { breite: 1360, hoehe: 900 })
    expect(l.maxHoehe).toBe(900 - 430 - 6 - 16 - 44)
  })
})
