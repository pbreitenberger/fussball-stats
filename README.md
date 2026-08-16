# Fußballspieler Statistik Report

Statische GitHub Pages Website für einen öffentlichen Fußballspieler-Statistikreport.

## Dateien

- `index.html` - Hauptseite
- `style.css` - Layout und Design
- `app.js` - CSV-Import, Filter, Diagramme und Tabelle
- `data.csv` - manuell pflegbare Spielerdaten

## CSV-Struktur

Die Datei `data.csv` muss folgende Header enthalten:

```csv
Spieler,Saison,Verein,Position,Tore,Assists,Spiele,Minuten
```

Du kannst die Beispieldaten ersetzen. Wichtig: Die Spaltennamen müssen gleich bleiben.

## Manuelle Aktualisierung

1. `data.csv` lokal oder direkt in GitHub bearbeiten.
2. Datei committen.
3. GitHub Pages veröffentlicht die Änderung automatisch.

## GitHub Pages aktivieren

1. Neues GitHub Repository erstellen, z. B. `fussball-stats`.
2. Diese Dateien in das Repository hochladen.
3. In GitHub zu `Settings` > `Pages` gehen.
4. Source: `Deploy from a branch` auswählen.
5. Branch: `main`, Folder: `/root` auswählen.
6. Speichern.

Danach ist die Website typischerweise unter folgender Struktur erreichbar:

`https://USERNAME.github.io/fussball-stats/`

## Hinweise

- Die Website ist öffentlich. Keine vertraulichen Daten in `data.csv` speichern.
- Für ca. 30 Spieler reicht diese statische Lösung problemlos aus.
- Die Diagramme werden im Browser mit Chart.js erstellt.
