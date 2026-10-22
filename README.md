# Bibliographie

Ein Literatur-Verwaltungsprogramm nach dem Vorbild der Papier-Kartei: eine Karteikarte pro Werk, alle Auflagen und Ausgaben darunter, daraus gedruckte Literaturlisten.

Dies ist ein Klick-Prototyp. Die Daten liegen nur im Browser. Mit „Sichern“ entsteht eine JSON-Datei, die sich mit „Einlesen“ zurückholen lässt.

## Was der Prototyp kann

- Karteikarte mit Autoren oder Herausgebern, Titel, Untertitel, Schriftenreihe, Kommentar und Schlagwörtern (primär oder sekundär)
- Ein Werk mit beliebig vielen Auflagen: Auflagenzahl, reales und abweichend gedrucktes Jahr, Erscheinungstag, Verlag, Ort, Seiten
- Aufsätze mit „erschienen in“ (Zeitschrift, Zeitung, Sammelband)
- Status „vorläufig“ bis „fest anlegen“
- Drei Bereiche wie am Karteikasten: Erfassen (F2), Kartei (F3), Liste (F4); Sichern, Einlesen, Verlage und CSL-Export liegen unter „Ablage“
- Nach dem Start liegt eine leere Karte bereit; Strg+Enter legt fest an und holt die nächste Karte, Alt+N nimmt die nächste und lässt die aktuelle vorläufig
- Beim Tippen von Autor und Titel schlägt die Karte Werke vor: zuerst aus der eigenen Kartei („schon vorhanden“), nach einer Tipppause aus der Deutschen Nationalbibliothek und dem hbz-Verbundkatalog (lobid.org), je Werk mit Zahl der Ausgaben. E-Books und Hörbücher fallen weg, dieselbe Ausgabe aus beiden Katalogen erscheint dank ISBN nur einmal. Fällt ein Katalog aus, arbeitet die Suche mit dem anderen weiter. Nach der Auswahl werden die Ausgaben zum Abhaken gezeigt, je Jahr eine vorausgewählt. Auch auf einer bestehenden Karte lassen sich weitere Auflagen nachholen
- Verlage als eigener Bereich (F5): Kürzel, Namens- und Ortsgeschichte, weitere Schreibweisen. Beim Festanlegen werden neue Verlage von selbst gemerkt; Katalogschreibweisen wie „Philos.-Anthroposophischer Verl.“ werden einem bekannten Verlag zugeordnet, nach einer Rückfrage pro Verlag
- Auflagen verweisen über eine feste Kennung auf ihren Verlag. Im Jahr eines Ortswechsels warnt die Karte, ein abweichender Ort lässt sich als neuer Ortswechsel eintragen
- ISBN je Auflage: aus dem Katalog übernommen, im Titelfeld suchbar, in der Liste zuschaltbar
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

Rundgang mit Bildschirmfotos gegen `pnpm preview --port 4321`; die übrigen Skripte in `scripts/` prüfen gezielte Abläufe, etwa `scripts/ablage.mjs` den Speicher mit 20.000 Karten:

```sh
CHROME_BIN=<pfad-zu-chrome> node scripts/rundgang.mjs http://localhost:4321/ <ordner>
```

## Datenformat

Im Browser liegen die Daten in IndexedDB (`src/ablage.ts`). Die Sicherungsdatei ist JSON mit `format: "bibliographie-datenstamm"` und einer Versionsnummer, derzeit 7. Ältere Dateien werden beim Einlesen übersetzt. Sie enthält `werke`, `verlage`, `listen` und `themen`, das Modell steht in `src/model.ts`. Beim Einlesen werden Karten mit gleicher ID zusammengeführt, die zuletzt geänderte Fassung gewinnt.
