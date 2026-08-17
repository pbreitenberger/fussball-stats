# GPS Multi-Training Dashboard für GitHub Pages

Diese Version lädt mehrere Trainingsdateien und kann wahlweise alle Trainings gesamt oder ein einzelnes Training anzeigen.

## Struktur

```text
index.html
style.css
app.js
data/
  index.json
  2026-08-11_5000m-pyramide-lang.csv
```

## Neue Trainings hinzufügen

1. Neue CSV-Datei exportieren.
2. Datei in den Ordner `data/` hochladen.
3. `data/index.json` ergänzen.

Beispiel:

```json
{
  "trainings": [
    {
      "file": "2026-08-11_5000m-pyramide-lang.csv",
      "date": "2026-08-11",
      "title": "5000m Pyramide, lang"
    },
    {
      "file": "2026-08-18_techniktraining.csv",
      "date": "2026-08-18",
      "title": "Techniktraining"
    }
  ]
}
```

## Dashboard-Funktionen

- Dropdown `Training`: Alle Trainings oder einzelnes Training
- Dropdown `Spieler`: Alle Spieler oder einzelner Spieler
- Gesamt-KPIs über den aktuellen Filter
- Spielerübersicht
- Umschaltung Absolut / Pro Minute
- Verteilung Distanz pro Minute
- Verlauf der Distanz pro Minute über alle Trainings
- Geschwindigkeitszonen
- Vergleich zur Mannschaft
- Lokaler Test mit mehreren CSV-Dateien über `CSV-Dateien lokal testen`

## Wichtig

GitHub Pages kann Dateien in einem Ordner nicht automatisch auflisten. Deshalb ist `data/index.json` notwendig. Wenn eine neue CSV-Datei hochgeladen wird, muss diese Datei dort ergänzt werden.
