import { describe, expect, it } from 'vitest'
import { baum, bezeichnung } from '../themen'
import { ohneAbgewaehlte } from '../GeruestDialog'
import { fuegeEin, geruestAusAbsaetzen, geruestAusText, nummerUndTitel } from './geruest'

const zeigen = (themen: ReturnType<typeof geruestAusText>) => baum(themen).map((k) => `${k.tiefe}:${bezeichnung(k.thema)}`)

describe('nummerUndTitel', () => {
  it('trennt übliche Nummern ab', () => {
    expect(nummerUndTitel('V. Die elektronischen Medien')).toEqual({ nummer: 'V.', titel: 'Die elektronischen Medien' })
    expect(nummerUndTitel('a) Manipulation')).toEqual({ nummer: 'a)', titel: 'Manipulation' })
    expect(nummerUndTitel('1.2 Film')).toEqual({ nummer: '1.2', titel: 'Film' })
    expect(nummerUndTitel('3. Rundfunk')).toEqual({ nummer: '3.', titel: 'Rundfunk' })
    expect(nummerUndTitel('Ohne Nummer')).toEqual({ nummer: '', titel: 'Ohne Nummer' })
    expect(nummerUndTitel('Die Medien')).toEqual({ nummer: '', titel: 'Die Medien' })
  })
})

describe('geruestAusText', () => {
  it('Ebenen nach Nummernart: erste Art oben, jede neue eine tiefer', () => {
    const t = geruestAusText('I. Erkenntnis\na) Freiheit\nb) Denken\nII. Medien\na) Film\n1. Stummfilm\nb) Rundfunk\n')
    expect(zeigen(t)).toEqual(['0:I. Erkenntnis', '1:a) Freiheit', '1:b) Denken', '0:II. Medien', '1:a) Film', '2:1. Stummfilm', '1:b) Rundfunk'])
  })
  it('Gliederungscodes wie I.A.1a1: jedes Glied eine Ebene, doppelter Buchstabe am Titel entfällt', () => {
    const t = geruestAusText('I. Schöpfung\nI.A. A. Bildekräfte\nI.A.1 Goetheanismus\nI.A.1a Formen\nI.A.1a1 Blätter\nI.A.2 Naturkunde\nI.B. Äther\nII. Ursprung\nII.C.1/2 Urindien\nII.C.1/2a Tibet')
    expect(zeigen(t)).toEqual(['0:I. Schöpfung', '1:I.A. Bildekräfte', '2:I.A.1 Goetheanismus', '3:I.A.1a Formen', '4:I.A.1a1 Blätter', '2:I.A.2 Naturkunde', '1:I.B. Äther', '0:II. Ursprung', '1:II.C.1/2 Urindien', '2:II.C.1/2a Tibet'])
  })
  it('Gliederungscodes: fehlt eine Zwischennummer, gilt die nächste vorhandene davor im eigenen Zweig', () => {
    const t = geruestAusText('I. Natur\nI.C. Erde\nI.C.4 Steine\nI.C.5a Kristalle\nII. Mensch\nII.B.1c Kind\nII.B.1d1 Spiel')
    expect(zeigen(t)).toEqual(['0:I. Natur', '1:I.C. Erde', '2:I.C.4 Steine', '2:I.C.5a Kristalle', '0:II. Mensch', '1:II.B.1c Kind', '1:II.B.1d1 Spiel'])
  })
  it('Dezimalnummern nach Punkten', () => {
    expect(zeigen(geruestAusText('1 Medien\n1.1 Film\n1.1.1 Stummfilm\n1.2 Rundfunk\n2 Technik'))).toEqual(['0:1 Medien', '1:1.1 Film', '2:1.1.1 Stummfilm', '1:1.2 Rundfunk', '0:2 Technik'])
  })
  it('ohne Nummern nach Einrückung', () => {
    expect(zeigen(geruestAusText('Medien\n  Film\n    Stummfilm\n  Rundfunk\nTechnik'))).toEqual(['0:Medien', '1:Film', '2:Stummfilm', '1:Rundfunk', '0:Technik'])
  })
  it('leere Zeilen zählen nicht, ein Sprung um zwei Ebenen wird zu einer', () => {
    expect(zeigen(geruestAusText('Medien\n\n      Film'))).toEqual(['0:Medien', '1:Film'])
  })
})

describe('geruestAusAbsaetzen', () => {
  it('Verschachtelung der Aufzählung geht vor', () => {
    const t = geruestAusAbsaetzen([
      { text: 'V. Medien', tiefe: 1 },
      { text: 'a) Film', tiefe: 2 },
      { text: 'b) Rundfunk', tiefe: 2 },
      { text: 'VI. Technik', tiefe: 1 },
    ])
    expect(zeigen(t)).toEqual(['0:V. Medien', '1:a) Film', '1:b) Rundfunk', '0:VI. Technik'])
  })
  it('ohne Verschachtelung entscheiden die Nummern', () => {
    const t = geruestAusAbsaetzen([
      { text: 'V. Medien', tiefe: 0 },
      { text: 'a) Film', tiefe: 0 },
      { text: 'VI. Technik', tiefe: 0 },
    ])
    expect(zeigen(t)).toEqual(['0:V. Medien', '1:a) Film', '0:VI. Technik'])
  })
})

describe('fuegeEin', () => {
  it('führt gleichnamige Themen zusammen und hängt den Rest an der richtigen Stelle an', () => {
    const bestand = [
      { id: 'v', nummer: 'V.', titel: 'Medien', elternId: '' },
      { id: 'a', nummer: 'a)', titel: 'Film', elternId: 'v' },
    ]
    const neu = geruestAusText('V. Medien\na) Film\nb) Rundfunk\nVI. Technik')
    const r = fuegeEin(bestand, neu)
    expect(zeigen(r.themen)).toEqual(['0:V. Medien', '1:a) Film', '1:b) Rundfunk', '0:VI. Technik'])
    expect(r.themen.slice(0, 2).map((t) => t.id)).toEqual(['v', 'a'])
    expect(r.neu).toBe(2)
  })
})

describe('ohneAbgewaehlte', () => {
  it('Unterthemen einer abgewählten Zeile rücken eine Ebene hoch', () => {
    const t = geruestAusText('Gesamtgerüst\n  V. Medien\n    a) Film\n  VI. Technik')
    const titel = t.find((x) => x.titel === 'Gesamtgerüst')!
    expect(zeigen(ohneAbgewaehlte(t, new Set([titel.id])))).toEqual(['0:V. Medien', '1:a) Film', '0:VI. Technik'])
  })
})
