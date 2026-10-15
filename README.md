# Bibliographie

Ein Literatur-Verwaltungsprogramm nach dem Vorbild der Papier-Kartei: eine Karteikarte pro Werk, alle Auflagen und Ausgaben darunter, daraus gedruckte Literaturlisten.

Dies ist ein Klick-Prototyp. Die Daten liegen nur im Browser. Mit „Sichern“ entsteht eine JSON-Datei, die sich mit „Einlesen“ zurückholen lässt.

## Was der Prototyp kann

- Karteikarte mit Autoren oder Herausgebern, Titel, Untertitel, Schriftenreihe, Kommentar und Schlagwörtern (primär oder sekundär)
- Ein Werk mit beliebig vielen Auflagen: Auflagenzahl, reales und abweichend gedrucktes Jahr, Erscheinungstag, Verlag, Ort, Seiten
- Aufsätze mit „erschienen in“ (Zeitschrift, Zeitung, Sammelband)
- Status „vorläufig“ bis „fest anlegen“
- Suche im hbz-Verbundkatalog (lobid.org): gefundene Ausgaben werden zu einem Werk zusammengefasst und als vorläufige Karte übernommen
- Verlage mit Kürzel für die Schnelleingabe und Ortsgeschichte; im Jahr eines Ortswechsels warnt die Karte
- Felder fixieren für die Serieneingabe
- Literaturliste nach Person oder Schlagwort, in zwei Mustern, sortiert nach Name oder Jahr; Ausgabe als Word-Datei oder Druck
- Export als CSL-JSON für Zotero, Citavi und Pandoc

## Entwickeln

```sh
pnpm install
pnpm dev
pnpm test
pnpm build
```

Rundgang mit Bildschirmfotos gegen `pnpm preview --port 4321`:

```sh
CHROME_BIN=<pfad-zu-chrome> node scripts/rundgang.mjs http://localhost:4321/ <ordner>
```

## Datenformat

Die Sicherungsdatei ist JSON mit `format: "bibliographie-datenstamm"` und einer Versionsnummer. Sie enthält `werke` und `verlage`, das Modell steht in `src/model.ts`. Beim Einlesen werden Karten mit gleicher ID zusammengeführt, die zuletzt geänderte Fassung gewinnt.
