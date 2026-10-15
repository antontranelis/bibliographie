import { afterEach, describe, expect, it, vi } from 'vitest'
import { ohneDoppelte, sucheImKatalog } from './katalog'
import { leereAuflage } from './model'
import type { Treffer } from './lobid'

const treffer = (jahr: string, isbn = ''): Treffer => ({
  titel: 'Die Philosophie der Freiheit',
  untertitel: '',
  personen: [{ vorname: 'Rudolf', nachname: 'Steiner', rolle: 'autor' }],
  auflage: { ...leereAuflage(), jahr, isbn },
})

describe('ohneDoppelte', () => {
  it('führt dieselbe ISBN aus beiden Katalogen zusammen, auch anders geschrieben', () => {
    const r = ohneDoppelte([treffer('1987', '3-7274-6280-9'), treffer('1987', '3727462809'), treffer('1918'), treffer('1918')])
    expect(r.map((t) => t.auflage.jahr)).toEqual(['1987', '1918', '1918'])
  })
})

describe('sucheImKatalog', () => {
  afterEach(() => vi.unstubAllGlobals())
  const lobidAntwort = { member: [{ title: 'Die Philosophie der Freiheit', contribution: [{ agent: { label: 'Steiner, Rudolf' }, role: { id: 'x/aut' } }], publication: [{ startDate: '1918' }] }] }

  it('nimmt den anderen Katalog, wenn einer ausfällt', async () => {
    vi.stubGlobal('fetch', async (url: string) =>
      url.includes('dnb.de') ? new Response('', { status: 503 }) : new Response(JSON.stringify(lobidAntwort), { status: 200 }),
    )
    const r = await sucheImKatalog('Steiner', 'Philosophie der Freiheit')
    expect(r).toHaveLength(1)
    expect(r[0].treffer[0].auflage.jahr).toBe('1918')
  })
  it('meldet einen Fehler, wenn beide ausfallen', async () => {
    vi.stubGlobal('fetch', async () => new Response('', { status: 503 }))
    await expect(sucheImKatalog('Steiner', 'Philosophie der Freiheit')).rejects.toThrow('503')
  })
})
