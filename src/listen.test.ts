import { describe, expect, it } from 'vitest'
import { abschnitte, druckWerk, entferne, hinzufuegen, kapitelEntfernen, neueListe, nummern, rueckeUm, umschalten, verschiebe } from './listen'
import { druckzeile } from './format'
import { leereAuflage, leereAusgabe, leeresWerk, type Kapitel, type Literaturliste, type Werk } from './model'

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
const ids = (l: ReturnType<typeof abschnitte>) => l.map((a) => `${a.nummer}:${a.zeilen.map((z) => z.werk.id + (z.drin ? '' : '-')).join(',')}`)
const kap = (id: string, ebene: 1 | 2 = 1): Kapitel => ({ id, titel: id, ebene })

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
  it('Kapitel mit laufender Nummer, Einträge darin, Rest davor', () => {
    let l: Literaturliste = { ...neueListe('Kapitel'), kapitel: [kap('a'), kap('a1', 2), kap('a2', 2), kap('b')] }
    l = verschiebe(l, 'film', 'a1')
    l = verschiebe(l, 'briefe', 'b')
    expect(ids(abschnitte(l, werke))).toEqual([':pdf', '1:', '1.1:film', '1.2:', '2:briefe'])
    expect([...nummern(l.kapitel).values()]).toEqual(['1', '1.1', '1.2', '2'])
  })
  it('ein entferntes Kapitel gibt seine Einträge nach vorn ab', () => {
    let l: Literaturliste = { ...neueListe('Kapitel'), kapitel: [kap('a'), kap('b')] }
    l = verschiebe(l, 'film', 'b')
    l = kapitelEntfernen(l, 'b')
    expect(ids(abschnitte(l, werke))).toEqual([':film,briefe,pdf', '1:'])
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
