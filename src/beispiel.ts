import { leereAuflage, neueId, type Datenstamm, type Werk } from './model'

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
    auflagen: [],
    kommentar: '',
    schlagwoerter: [],
    angelegt: jetzt(),
    geaendert: jetzt(),
    ...teil,
  }
}

const steiner = { vorname: 'Rudolf', nachname: 'Steiner', rolle: 'autor' as const }

/** Wenige Beispielkarten zum Ausprobieren. */
export function beispielDaten(): Datenstamm {
  return {
    verlage: [
      {
        id: neueId(),
        name: 'Philosophisch-Anthroposophischer Verlag',
        kuerzel: 'pav',
        orte: [
          { abJahr: '1908', ort: 'Berlin', wechselImJahr: false },
          { abJahr: '1923', ort: 'Dornach', wechselImJahr: true },
        ],
      },
      { id: neueId(), name: 'Verlag am Goetheanum', kuerzel: 'goe', orte: [{ abJahr: '1923', ort: 'Dornach', wechselImJahr: false }] },
      { id: neueId(), name: 'Verlag Freies Geistesleben', kuerzel: 'fg', orte: [{ abJahr: '1947', ort: 'Stuttgart', wechselImJahr: false }] },
      { id: neueId(), name: 'Rudolf Steiner Verlag', kuerzel: 'rsv', orte: [{ abJahr: '1945', ort: 'Dornach', wechselImJahr: false }] },
    ],
    werke: [
      werk({
        status: 'fest',
        personen: [steiner],
        titel: 'Die Philosophie der Freiheit',
        untertitel: 'Grundzüge einer modernen Weltanschauung. Seelische Beobachtungsresultate nach naturwissenschaftlicher Methode',
        reihe: 'Rudolf Steiner Gesamtausgabe',
        reiheBand: '4',
        auflagen: [
          { ...leereAuflage(), jahr: '1893', gedrucktesJahr: '1894', verlag: 'Emil Felber', ort: 'Berlin' },
          { ...leereAuflage(), nummer: '2', jahr: '1918', verlag: 'Philosophisch-Anthroposophischer Verlag', ort: 'Berlin', seiten: '282' },
          { ...leereAuflage(), jahr: '1929', verlag: 'Verlag am Goetheanum', ort: 'Dornach', seiten: '345', vermerk: '20.–25. Tsd.' },
        ],
        kommentar: 'Beispielkarte. Erschien schon Ende 1893, im Buch steht 1894.',
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
        erschienenIn: { art: 'zeitschrift', titel: 'Lucifer-Gnosis', jahrgang: '', jahr: '1907', heft: '33', seitenVon: '', seitenBis: '' },
        kommentar: 'Beispielkarte für einen Aufsatz. Angaben vor Gebrauch prüfen.',
        schlagwoerter: [{ begriff: 'Pädagogik', primaer: true }],
      }),
    ],
  }
}
