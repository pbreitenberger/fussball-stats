# GPS Training Dashboard für GitHub Pages

Dieses Projekt enthält eine statische GitHub-Pages-Seite für GPS-Tracker-CSV-Dateien aus Fußballtrainings.

## Dateien

- `index.html` - Dashboard-Seite
- `style.css` - Dark Dashboard Design
- `app.js` - CSV-Parser, Kennzahlen, Filter und Charts
- `data.csv` - aktuelle Trainingsdaten

## Erwartetes CSV-Format

Die Seite ist für das Matrix-Format ausgelegt, das aus der Trainingsdatei exportiert wird:

```csv
Team:,Tscherms Marling
Session:,5000m Pyramide, lang
Date:,2026-08-11

,Session average,Spieler 1,Spieler 2,Spieler 3
Duration,01:32:35,01:41:58,01:19:07,01:36:40
Total distance,9052.84,11149.42,6483.75,9525.34
Max speed,25.36,27.20,23.44,25.44
...
```

Die Anzahl der Spieler ist variabel. Die Seite erkennt alle Spieler-Spalten automatisch.

## Manuelle Aktualisierung

1. Neue CSV-Datei aus dem Tracker exportieren.
2. Datei in `data.csv` umbenennen.
3. `data.csv` im GitHub Repository ersetzen.
4. GitHub Pages veröffentlicht die aktualisierten Werte automatisch.

Alternativ kann ein Besucher über `CSV lokal laden` eine CSV-Datei temporär im Browser öffnen. Diese Änderung wird nicht gespeichert.

## Enthaltene Funktionen

- Spieler-Dropdown
- KPI-Karten für Gesamtdistanz, Distanz pro Minute, HSR-Distanz, Metabolic Power, Max Speed und Beschleunigungen
- Spielerübersicht als Tabelle
- Umschaltung Absolut / Pro Minute
- Verteilung Distanz pro Minute
- Geschwindigkeitszonen
- Vergleich Spieler gegen Mannschaftsdurchschnitt

## Hinweis

Die Website ist öffentlich. Lade keine vertraulichen oder personenbezogenen Daten hoch, die nicht öffentlich sichtbar sein dürfen.
