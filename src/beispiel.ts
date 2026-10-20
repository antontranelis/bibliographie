import { leereAuflage, leereAusgabe, neueId, type Datenstamm, type Verlag, type Werk } from './model'
import { ALLE, neueListe } from './listen'
import { migriere } from './speicher'

const jetzt = () => new Date().toISOString()

function werk(teil: Partial<Werk>): Werk {
  return {
    id: neueId(),
    status: 'vorlaeufig',
    art: 'buch',
    personen: [],
    titel: '',
    untertitel: '',
    reihe: '',
    reiheBand: '',
    ausgaben: [],
    ersterscheinung: '',
    kommentar: '',
    anmerkung: '',
    vorlage: '',
    schlagwoerter: [],
    themen: [],
    angelegt: jetzt(),
    geaendert: jetzt(),
    ...teil,
  }
}

const steiner = { vorname: 'Rudolf', nachname: 'Steiner', rolle: 'autor' as const }

/** Wenige Beispielkarten zum Ausprobieren. */
export function beispielDaten(): Datenstamm {
  const v = (name: string, kuerzel: string, orte: Verlag['orte']): Verlag => ({ id: neueId(), kuerzel, namen: [{ abJahr: '', name }], orte, schreibweisen: [] })
  const erkenntnis = { id: neueId(), nummer: 'I.', titel: 'Erkenntnis und Freiheit', elternId: '' }
  const erziehung = { id: neueId(), nummer: 'II.', titel: 'Erziehung', elternId: '' }
  const kind = { id: neueId(), nummer: 'a)', titel: 'Das Kind im Elternhaus', elternId: erziehung.id }
  // migriere verknüpft die Auflagen über den Verlagsnamen
  return migriere({
    themen: [erkenntnis, erziehung, kind],
    verlage: [
      v('Philosophisch-Anthroposophischer Verlag', 'pav', [
        { abJahr: '1908', ort: 'Berlin', wechselImJahr: false },
        { abJahr: '1923', ort: 'Dornach', wechselImJahr: true },
      ]),
      v('Verlag am Goetheanum', 'goe', [{ abJahr: '1923', ort: 'Dornach', wechselImJahr: false }]),
      v('Verlag Freies Geistesleben', 'fg', [{ abJahr: '1947', ort: 'Stuttgart', wechselImJahr: false }]),
      v('Rudolf Steiner Verlag', 'rsv', [{ abJahr: '1945', ort: 'Dornach', wechselImJahr: false }]),
    ],
    werke: [
      werk({
        status: 'fest',
        personen: [steiner],
        titel: 'Die Philosophie der Freiheit',
        untertitel: 'Grundzüge einer modernen Weltanschauung. Seelische Beobachtungsresultate nach naturwissenschaftlicher Methode',
        reihe: 'Rudolf Steiner Gesamtausgabe',
        reiheBand: '4',
        ausgaben: [
          {
            ...leereAusgabe(),
            auflagen: [
              { ...leereAuflage(), jahr: '1893', gedrucktesJahr: '1894', verlag: 'Emil Felber', ort: 'Berlin' },
              { ...leereAuflage(), nummer: '2', jahr: '1918', verlag: 'Philosophisch-Anthroposophischer Verlag', ort: 'Berlin', seiten: '282' },
              { ...leereAuflage(), jahr: '1929', verlag: 'Verlag am Goetheanum', ort: 'Dornach', seiten: '345', vermerk: '20.–25. Tsd.' },
            ],
          },
        ],
        kommentar: 'Beispielkarte. Erschien schon Ende 1893, im Buch steht 1894.',
        themen: [erkenntnis.id],
        schlagwoerter: [
          { begriff: 'Erkenntnistheorie', primaer: true },
          { begriff: 'Freiheit', primaer: true },
          { begriff: 'Ethik', primaer: false },
        ],
      }),
      werk({
        personen: [steiner],
        titel: 'Die Erziehung des Kindes vom Gesichtspunkte der Geisteswissenschaft',
        art: 'aufsatz',
        erschienenIn: { art: 'zeitschrift', titel: 'Lucifer-Gnosis', jahrgang: '', jahr: '1907', heft: '33', ausgabe: '', seitenVon: '', seitenBis: '' },
        kommentar: 'Beispielkarte für einen Aufsatz. Angaben vor Gebrauch prüfen.',
        schlagwoerter: [{ begriff: 'Pädagogik', primaer: true }],
        themen: [kind.id],
      }),
    ],
    listen: [neueListe('Rudolf Steiner', { ...ALLE, person: 'Steiner|Rudolf' })],
  })
}
