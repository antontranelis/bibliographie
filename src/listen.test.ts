import { describe, expect, it } from 'vitest'
import { ALLE, abschnitte, druckWerk, entferne, hinzufuegen, neueListe, rueckeUm, umschalten } from './listen'
import { druckzeile } from './format'
import { leereAuflage, leereAusgabe, leeresWerk, type Literaturliste, type Thema, type Werk } from './model'

const p = (vorname: string, nachname: string) => ({ vorname, nachname, rolle: 'autor' as const })
function werk(id: string, personen: ReturnType<typeof p>[], jahr: string, schlagwoerter: string[] = [], status: Werk['status'] = 'fest'): Werk {
  return {
    ...leeresWerk(),
    id,
    titel: id,
    status,
    personen,
    schlagwoerter: schlagwoerter.map((begriff) => ({ begriff, primaer: true })),
    ausgaben: [{ ...leereAusgabe(), auflagen: [{ ...leereAuflage(), jahr, ort: 'Basel' }] }],
  }
}
const steiner = werk('pdf', [p('Rudolf', 'Steiner')], '1894', ['Freiheit'])
const arnheim = werk('film', [p('Rudolf', 'Arnheim')], '1932', ['Film'])
const beide = werk('briefe', [p('Marie', 'Steiner'), p('Rudolf', 'Steiner')], '1950', ['Freiheit'], 'vorlaeufig')
const werke = [steiner, arnheim, beide]
const ids = (l: ReturnType<typeof abschnitte>) => l.map((a) => `${a.ueberschrift?.titel ?? ''}:${a.zeilen.map((z) => z.werk.id + (z.drin ? '' : '-')).join(',')}`)

describe('abschnitte', () => {
  it('nimmt nach Regel auf und sortiert nach der ersten Person', () => {
    const l = neueListe('Alle')
    expect(ids(abschnitte(l, werke))).toEqual([':film,briefe,pdf'])
    expect(ids(abschnitte({ ...l, regel: { ...l.regel!, schlagwort: 'Freiheit' } }, werke))).toEqual([':briefe,pdf'])
    expect(ids(abschnitte({ ...l, regel: { ...l.regel!, nurFest: true } }, werke))).toEqual([':film,pdf'])
    expect(ids(abschnitte({ ...l, regel: { ...l.regel!, person: 'Steiner|Marie' } }, werke))).toEqual([':briefe'])
  })
  it('ohne Regel nur von Hand aufgenommene Karten', () => {
    const l = hinzufuegen({ ...neueListe('Hand'), regel: null }, 'film')
    expect(ids(abschnitte(l, werke))).toEqual([':film'])
  })
  it('herausgenommene Karten bleiben sichtbar, aber nicht drin', () => {
    const l = umschalten(neueListe('Alle'), 'pdf')
    expect(ids(abschnitte(l, werke))).toEqual([':film,briefe,pdf-'])
    expect(ids(abschnitte(umschalten(l, 'pdf'), werke))).toEqual([':film,briefe,pdf'])
  })
  it('von Hand: Reihenfolge der Einträge, Regeltreffer danach nach Name', () => {
    let l: Literaturliste = { ...neueListe('Hand'), sortierung: 'hand' as const }
    l = hinzufuegen(l, 'briefe')
    l = hinzufuegen(l, 'pdf')
    expect(ids(abschnitte(l, werke))).toEqual([':briefe,pdf,film'])
    l = rueckeUm(l, 'pdf', -1)
    expect(ids(abschnitte(l, werke))).toEqual([':pdf,briefe,film'])
    l = entferne(l, 'pdf')
    expect(l.eintraege.map((e) => e.werkId)).toEqual(['briefe'])
  })
  it('chronologisch nach Ersterscheinung', () => {
    expect(ids(abschnitte({ ...neueListe('Jahr'), sortierung: 'jahr' }, werke))).toEqual([':pdf,film,briefe'])
  })
  it('bei jeder Person: ein Werk erscheint unter jeder seiner Personen', () => {
    const a = abschnitte({ ...neueListe('Personen'), jedePerson: true }, werke)
    expect(a[0].zeilen.map((z) => `${z.werk.id}@${z.person?.vorname ?? ''}`)).toEqual(['film@Rudolf', 'briefe@Marie', 'pdf@Rudolf', 'briefe@Rudolf'])
  })
  it('bei jeder Person: die Einordnungsperson steht in der Zeile vorn, die Karte bleibt unverändert', () => {
    const gemeinsam = werk('gemeinsam', [p('Anna', 'Adler'), p('Zoe', 'Zebra')], '1990')
    const mitte = werk('mitte', [p('Max', 'Mitte')], '1990')
    const a = abschnitte({ ...neueListe('Personen'), jedePerson: true }, [gemeinsam, mitte])
    expect(a[0].zeilen.map((z) => druckzeile(druckWerk(z)))).toEqual([
      'Anna Adler/Zoe Zebra: gemeinsam, Basel 1990',
      'Max Mitte: mitte, Basel 1990',
      'Zoe Zebra/Anna Adler: gemeinsam, Basel 1990',
    ])
    expect(gemeinsam.personen.map((x) => x.nachname)).toEqual(['Adler', 'Zebra'])
  })
  it('übergeht Einträge gelöschter Karten', () => {
    const l = hinzufuegen({ ...neueListe('Hand'), regel: null }, 'weg')
    expect(ids(abschnitte(l, werke))).toEqual([':'])
  })
  it('hinzufügen nimmt eine herausgenommene Karte wieder auf und legt nichts doppelt an', () => {
    let l = umschalten(neueListe('Alle'), 'pdf')
    l = hinzufuegen(hinzufuegen(l, 'pdf'), 'pdf')
    expect(l.ausgenommen).toEqual([])
    expect(l.eintraege).toHaveLength(1)
  })
})

describe('Themen', () => {
  const th = (id: string, elternId = '', nummer = ''): Thema => ({ id, nummer, titel: id, elternId })
  // Medien > Film; Medien > Rundfunk; Technik
  const themen = [th('medien', '', 'V.'), th('film', 'medien', 'a)'), th('rundfunk', 'medien', 'b)'), th('technik', '', 'VI.')]
  const mit = (w: Werk, ...ids: string[]): Werk => ({ ...w, themen: ids })
  const iros = mit(werk('iros', [p('Ernst', 'Iros')], '1938'), 'film')
  const arnheim = mit(werk('arnheim', [p('Rudolf', 'Arnheim')], '1932'), 'film', 'rundfunk')
  const ohne = werk('ohne', [p('Max', 'Mitte')], '1990')
  const alle = [iros, arnheim, ohne]

  it('Regel nach Thema, wahlweise mit Unterthemen', () => {
    const l = neueListe('Medien')
    expect(ids(abschnitte({ ...l, regel: { ...l.regel!, thema: 'film', mitUnterthemen: false } }, alle, themen))).toEqual([':arnheim,iros'])
    expect(ids(abschnitte({ ...l, regel: { ...l.regel!, thema: 'medien', mitUnterthemen: false } }, alle, themen))).toEqual([':'])
    expect(ids(abschnitte({ ...l, regel: { ...l.regel!, thema: 'medien', mitUnterthemen: true } }, alle, themen))).toEqual([':arnheim,iros'])
  })
  it('Gliederung nach Themen: ein Werk unter jedem seiner Themen, leere Zweige entfallen, ohne Thema am Ende', () => {
    const a = abschnitte({ ...neueListe('Themenkartei'), gliederung: 'themen' }, alle, themen)
    expect(a.map((x) => `${x.ueberschrift?.titel ?? ''}|${x.ueberschrift?.ebene ?? 0}:${x.zeilen.map((z) => z.werk.id).join(',')}`)).toEqual([
      'V. medien|1:',
      'a) film|2:arnheim,iros',
      'b) rundfunk|2:arnheim',
      'ohne Thema|1:ohne',
    ])
  })
  it('von Hand aufgenommene Karten außerhalb des Regelzweigs bleiben beim Umschalten erhalten', () => {
    const l = hinzufuegen(hinzufuegen({ ...neueListe('Rundfunk'), regel: { ...ALLE, thema: 'rundfunk', mitUnterthemen: true } }, 'iros'), 'ohne')
    const zeilen = (x: Literaturliste) => abschnitte(x, alle, themen).flatMap((a) => a.zeilen.map((z) => z.werk.id)).sort()
    expect(zeilen(l)).toEqual(['arnheim', 'iros', 'ohne'])
    const t = abschnitte({ ...l, gliederung: 'themen' }, alle, themen)
    expect(t.map((x) => `${x.ueberschrift?.titel}:${x.zeilen.map((z) => z.werk.id).join(',')}`)).toEqual(['b) rundfunk:arnheim', 'Weitere Titel:iros,ohne'])
  })
  it('Gliederung nach Themen, von Hand sortiert: Reihenfolge der Einträge unter jedem Thema', () => {
    let l: Literaturliste = { ...neueListe('Datei'), regel: null, gliederung: 'themen', sortierung: 'hand' }
    l = hinzufuegen(hinzufuegen(hinzufuegen(l, 'iros'), 'arnheim'), 'ohne')
    const a = abschnitte(l, alle, themen)
    expect(a.map((x) => `${x.ueberschrift?.titel}:${x.zeilen.map((z) => z.werk.id).join(',')}`)).toEqual([
      'V. medien:',
      'a) film:iros,arnheim',
      'b) rundfunk:arnheim',
      'ohne Thema:ohne',
    ])
  })
  it('Gliederung nach Themen mit Themenregel: nur dieser Zweig', () => {
    const l = neueListe('Film')
    const a = abschnitte({ ...l, gliederung: 'themen', regel: { ...l.regel!, thema: 'rundfunk', mitUnterthemen: true } }, alle, themen)
    expect(a.map((x) => `${x.ueberschrift?.titel}:${x.zeilen.map((z) => z.werk.id).join(',')}`)).toEqual(['b) rundfunk:arnheim'])
  })
})
