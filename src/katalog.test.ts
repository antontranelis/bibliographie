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
  const mit = (jahr: string, isbn: string, nummer = '', seiten = '', vermerk = ''): Treffer => {
    const t = treffer(jahr, isbn)
    return { ...t, auflage: { ...t.auflage, nummer, seiten, vermerk } }
  }
  it('führt nur vollständig übereinstimmende Ausgaben zusammen, auch bei anders geschriebener ISBN', () => {
    const r = ohneDoppelte([mit('1987', '3-7274-0040-5', '15', '288'), mit('1987', '3727400405', '15', '288'), treffer('1918'), treffer('1918')])
    expect(r.map((t) => t.auflage.jahr)).toEqual(['1987', '1918', '1918'])
  })
  it('behält beide, wenn eine Angabe fehlt', () => {
    expect(ohneDoppelte([mit('1987', '3727400405', '15', '288'), mit('1987', '3727400405', '', '288')])).toHaveLength(2)
  })
  it('lässt eine unvollständige Angabe nicht zwei verschiedene Auflagen verdrängen (Review #3)', () => {
    const r = ohneDoppelte([mit('2020', '9783867720724', '', '200'), mit('2020', '9783867720724', '6', '200'), mit('2020', '9783867720724', '7', '200')])
    expect(r.map((t) => t.auflage.nummer)).toEqual(['', '6', '7'])
  })
  it('behält widersprüchliche Auflagenvermerke (Review #3)', () => {
    const r = ohneDoppelte([mit('2020', '9783867720724', '', '200', 'Unveränderter Nachdruck'), mit('2020', '9783867720724', '', '200', 'Überarbeitete Ausgabe')])
    expect(r).toHaveLength(2)
  })
  it('behält Auflagen verschiedener Jahre mit derselben ISBN (DNB, 9783867720724)', () => {
    const r = ohneDoppelte([mit('2021', '9783867720724', '7'), mit('2018', '9783867720724', '5'), mit('2017', '9783867720724', '4'), mit('2013', '9783867720724', '1')])
    expect(r.map((t) => `${t.auflage.nummer}/${t.auflage.jahr}`)).toEqual(['7/2021', '5/2018', '4/2017', '1/2013'])
  })
  it('behält Auflagen mit derselben ISBN und abweichendem Umfang (DNB, 9783727400407)', () => {
    const r = ohneDoppelte([mit('1995', '9783727400407', '16', '288'), mit('1987', '9783727400407', '15', '288'), mit('1978', '9783727400407', '14', '278')])
    expect(r).toHaveLength(3)
  })
  it('behält im selben Jahr verschiedene Auflagen oder verschiedenen Umfang', () => {
    expect(ohneDoppelte([mit('2020', '9783867720724', '6'), mit('2020', '9783867720724', '7')])).toHaveLength(2)
    expect(ohneDoppelte([mit('2020', '9783867720724', '', '200'), mit('2020', '9783867720724', '', '240')])).toHaveLength(2)
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
