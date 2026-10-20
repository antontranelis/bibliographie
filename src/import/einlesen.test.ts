import { describe, expect, it } from 'vitest'
import { druckzeile } from '../format'
import { abschnitte as listenAbschnitte } from '../listen'
import { baum } from '../themen'
import { leeresWerk } from '../model'
import { aufloesung, planeImport, uebernimm } from './einlesen'
import type { Lauf, OdtDokument, OdtEintrag } from './odt'

const n = (text: string): Lauf => ({ text, fett: false, kursiv: false, hinterlegt: null })
const f = (text: string): Lauf => ({ ...n(text), fett: true })
let nr = 0
const eintrag = (abschnittNr: number, laeufe: Lauf[]): OdtEintrag => ({ nummer: ++nr, abschnitt: '', abschnittNr, laeufe })

// Brief, dann „V.“ über zwei Absätze, darunter a) und b)
const dok: OdtDokument = {
  abschnitte: ['Lieber Herr Tranelis, hier ein sehr langer Begleittext, der weit mehr als eine Überschrift ist und deshalb nicht als Kapitel gelten soll, auch wenn er kurz vor den Listen steht.', 'V. Medien', 'als Bedingungen', 'a) Manipulation', 'b) Netzwerke'],
  eintraege: [
    eintrag(0, [n('a) Lizenzausgaben,')]),
    eintrag(3, [n('Ernst Iros: '), f('Wesen und Dramaturgie des Films'), n(', Zürich 1938')]),
    eintrag(3, [n('Rudolf Arnheim: '), f('Film als Kunst'), n(', Berlin 1932 '), { ...n('Bitte prüfen'), hinterlegt: '#ff00ff' }]),
    eintrag(3, [n('Walter Benjamin: '), f('Das Kunstwerk'), n(', Paris 1936; viele weitere Ausgaben')]),
    eintrag(4, [n('Ernst Iros: '), f('Wesen und Dramaturgie des Films'), n(', Zürich 1938')]),
    eintrag(4, [n('Seltsame Zeile ohne Titel')]),
    eintrag(4, [n('Rudolf Arnheim: '), f('Rundfunk als Hörkunst'), n(', München 1979')]),
  ],
}

describe('planeImport', () => {
  const vorhanden = { ...leeresWerk(), id: 'da', titel: 'Rundfunk als Hörkunst', personen: [{ vorname: 'Rudolf', nachname: 'Arnheim', rolle: 'autor' as const }] }
  const plan = planeImport(dok, [vorhanden])

  it('wählt Abschnitte mit überwiegend erkannten Einträgen und die kurzen Überschriften davor', () => {
    expect(plan.abschnitte.map((a) => [a.titel.slice(0, 15), a.eintraege, a.vorschlag])).toEqual([
      ['Lieber Herr Tra', 1, false],
      ['V. Medien', 0, true],
      ['als Bedingungen', 0, true],
      ['a) Manipulation', 3, true],
      ['b) Netzwerke', 3, true],
    ])
  })
  it('teilt die Einträge in sicher, prüfen und von Hand', () => {
    expect(plan.posten.map((p) => p.status)).toEqual(['hand', 'sicher', 'sicher', 'hand', 'sicher', 'hand', 'sicher'])
  })
  it('erkennt Doppelte in der Kartei und innerhalb der Auswahl', () => {
    const alle = new Set(plan.abschnitte.map((a) => a.nr))
    expect(aufloesung(plan, alle).map((a) => (a.art === 'doppelt' ? `doppelt:${a.vertreter}` : a.art))).toEqual(['neu', 'neu', 'neu', 'neu', 'doppelt:1', 'neu', 'vorhanden'])
  })
  it('Karten von Hand behalten Personen, Titel und die Originalzeile', () => {
    const benjamin = plan.posten[3].werk
    expect(benjamin.personen[0].nachname).toBe('Benjamin')
    expect(benjamin.titel).toBe('Das Kunstwerk')
    expect(benjamin.vorlage).toBe('Walter Benjamin: Das Kunstwerk, Paris 1936; viele weitere Ausgaben')
    const seltsam = plan.posten[5].werk
    expect(seltsam.titel).toBe('')
    expect(seltsam.vorlage).toBe('Seltsame Zeile ohne Titel')
  })
  it('sichere Karten brauchen keine Vorlage, der Kommentar kommt auf die Rückseite', () => {
    expect(plan.posten[1].werk.vorlage).toBe('')
    expect(plan.posten[2].werk.kommentar).toBe('Bitte prüfen')
    expect(plan.posten.every((p) => p.werk.status === 'vorlaeufig')).toBe(true)
  })
})

describe('uebernimm', () => {
  const vorhanden = { ...leeresWerk(), id: 'da', titel: 'Rundfunk als Hörkunst', personen: [{ vorname: 'Rudolf', nachname: 'Arnheim', rolle: 'autor' as const }] }
  const plan = planeImport(dok, [vorhanden])
  const auswahl = new Set(plan.abschnitte.filter((a) => a.vorschlag).map((a) => a.nr))
  const r = uebernimm(plan, auswahl, 'Medien')

  it('legt nur neue Karten an, ohne Doppelte', () => {
    expect(r.werke.map((w) => w.titel)).toEqual(['Wesen und Dramaturgie des Films', 'Film als Kunst', 'Das Kunstwerk', ''])
  })
  it('baut die Liste mit Kapiteln in der Reihenfolge der Datei nach', () => {
    const l = r.liste!
    expect(l.name).toBe('Medien')
    expect(l.regel).toBeNull()
    expect(l.sortierung).toBe('hand')
    // Seine Überschriften tragen ihre Nummern selbst
    expect(l.kapitelNummern).toBe(false)
    expect(l.kapitel.map((k) => [k.titel, k.ebene])).toEqual([
      ['V. Medien als Bedingungen', 1],
      ['a) Manipulation', 2],
      ['b) Netzwerke', 2],
    ])
    const druck = listenAbschnitte(l, [...r.werke, vorhanden]).map((a) => `${a.nummer}:${a.zeilen.map((z) => z.werk.titel || '?').join(',')}`)
    expect(druck).toEqual([':', '1:', '1.1:Wesen und Dramaturgie des Films,Film als Kunst,Das Kunstwerk', '1.2:?,Rundfunk als Hörkunst'])
  })
  it('ein Werk, das in zwei Abschnitten steht, kommt in den ersten', () => {
    expect(r.liste!.eintraege.filter((e) => e.werkId === r.werke[0].id)).toHaveLength(1)
  })
  it('sichere Karten drucken ihre Originalzeile', () => {
    expect(druckzeile(r.werke[0])).toBe('Ernst Iros: Wesen und Dramaturgie des Films, Zürich 1938')
  })
  it('ohne Liste nur Karten', () => {
    expect(uebernimm(plan, auswahl, null).liste).toBeUndefined()
  })
})

describe('Auswahl und Doppelte', () => {
  const iros = () => [n('Ernst Iros: '), f('Wesen und Dramaturgie des Films'), n(', Zürich 1938')]
  const dreimal: OdtDokument = {
    abschnitte: ['A', 'B', 'C'],
    eintraege: [eintrag(0, iros()), eintrag(1, iros()), eintrag(2, iros())],
  }
  it('ist der erste Fund abgewählt, wird der erste gewählte zur Karte', () => {
    const plan = planeImport(dreimal, [])
    const auswahl = new Set([1, 2])
    expect(aufloesung(plan, auswahl).map((a) => a.art)).toEqual(['neu', 'doppelt'])
    const r = uebernimm(plan, auswahl, 'L')
    expect(r.werke).toHaveLength(1)
    expect(r.liste!.eintraege.map((e) => e.werkId)).toEqual([r.werke[0].id])
  })
})

describe('Einträge vor dem ersten Absatz', () => {
  const eintragA = () => [n('Ernst Iros: '), f('Wesen und Dramaturgie des Films'), n(', Zürich 1938')]
  const eintragB = () => [n('Rudolf Arnheim: '), f('Film als Kunst'), n(', Berlin 1932')]
  it('ohne jeden Absatz: ein wählbarer Abschnitt, Einträge vor den Kapiteln', () => {
    const plan = planeImport({ abschnitte: [], eintraege: [eintrag(-1, eintragA())] }, [])
    expect(plan.abschnitte.map((a) => [a.nr, a.eintraege, a.vorschlag])).toEqual([[-1, 1, true]])
    const r = uebernimm(plan, new Set([-1]), 'L')
    expect(r.werke).toHaveLength(1)
    expect(r.liste!.kapitel).toEqual([])
    expect(r.liste!.eintraege).toEqual([{ werkId: r.werke[0].id, kapitelId: '' }])
  })
  it('gemischt: führende Einträge vor den Kapiteln, der Rest im Kapitel', () => {
    const plan = planeImport({ abschnitte: ['Kapitel'], eintraege: [eintrag(-1, eintragA()), eintrag(0, eintragB())] }, [])
    expect(plan.abschnitte.map((a) => a.nr)).toEqual([-1, 0])
    const r = uebernimm(plan, new Set([-1, 0]), 'L')
    expect(r.liste!.kapitel.map((k) => k.titel)).toEqual(['Kapitel'])
    expect(r.liste!.eintraege.map((e) => e.kapitelId)).toEqual(['', r.liste!.kapitel[0].id])
  })
})

describe('Abschnitte als Themen', () => {
  const vorhanden = { ...leeresWerk(), id: 'da', titel: 'Rundfunk als Hörkunst', personen: [{ vorname: 'Rudolf', nachname: 'Arnheim', rolle: 'autor' as const }] }
  const plan = planeImport(dok, [vorhanden])
  const auswahl = new Set(plan.abschnitte.filter((a) => a.vorschlag).map((a) => a.nr))

  it('legt fehlende Themen nach den Kapiteln an und ordnet die Karten zu', () => {
    const r = uebernimm(plan, auswahl, 'Medien', [])
    expect(baum(r.themen!).map((k) => `${k.tiefe}:${k.thema.nummer}|${k.thema.titel}`)).toEqual(['0:V.|Medien als Bedingungen', '1:a)|Manipulation', '1:b)|Netzwerke'])
    const a = r.themen!.find((t) => t.nummer === 'a)')!
    const b = r.themen!.find((t) => t.nummer === 'b)')!
    expect(r.werke.find((w) => w.titel === 'Film als Kunst')?.themen).toEqual([a.id])
    // Iros steht in a) und b): eine Karte, beide Themen
    expect(r.werke.find((w) => w.titel === 'Wesen und Dramaturgie des Films')?.themen).toEqual([a.id, b.id])
    // Die schon vorhandene Karte bekommt ihr Thema über die Zuordnung
    expect(r.zuordnung?.get('da')).toEqual([b.id])
  })
  it('nutzt gleichnamige Themen, auch mit leicht anderem Wortlaut', () => {
    const bestand = [
      { id: 'v', nummer: 'V.', titel: 'Medien', elternId: '' },
      { id: 'a', nummer: 'a)', titel: 'Manipulation', elternId: 'v' },
    ]
    const r = uebernimm(plan, auswahl, null, bestand)
    expect(r.themen!.map((t) => t.id).slice(0, 2)).toEqual(['v', 'a'])
    expect(r.themen!).toHaveLength(3)
    expect(r.themen!.find((t) => t.nummer === 'b)')?.elternId).toBe('v')
    expect(r.werke.find((w) => w.titel === 'Film als Kunst')?.themen).toEqual(['a'])
  })
  it('ohne Themenbestand keine Zuordnung', () => {
    const r = uebernimm(plan, auswahl, 'Medien')
    expect(r.themen).toBeUndefined()
    expect(r.werke.every((w) => w.themen.length === 0)).toBe(true)
  })
})
