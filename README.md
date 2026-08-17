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
2. Datei in den Ordner `data/` hochladen (z.B. per Drag & Drop im Browser auf github.com, oder `git add` + `git push`).
3. Fertig. Kein weiterer Schritt nötig.

Die Website fragt beim Laden automatisch die GitHub API nach allen Dateien im `data/`-Ordner
(`https://api.github.com/repos/OWNER/REPO/contents/data`) und liest jede gefundene `.csv`-Datei
ein. Titel, Datum und Team werden direkt aus dem Inhalt der CSV gelesen (Zeilen `Team:`,
`Session:`, `Date:` am Dateianfang) - eine manuelle Liste ist nicht mehr nötig.

Dateinamen-Konvention (empfohlen, aber nicht zwingend): `JJJJ-MM-TT_titel.csv`, z.B.
`2026-08-18_techniktraining.csv`. Falls die CSV kein Datum enthält, wird es aus diesem Namen
abgeleitet.

### Fallback: data/index.json

Falls die GitHub API mal nicht erreichbar ist (z.B. Rate-Limit bei sehr vielen Aufrufen pro
Stunde, oder du hostest die Seite nicht auf `*.github.io`), fällt die Seite automatisch auf
`data/index.json` zurück - das alte manifest-basierte Verfahren funktioniert also weiterhin als
Absicherung. Die Datei kann bei Bedarf einfach im gleichen Format wie bisher gepflegt werden;
notwendig ist das im Normalfall aber nicht mehr.

### Eigene Domain / Repo-Erkennung

Die Seite erkennt Owner und Repo-Namen automatisch aus der URL (`owner.github.io/repo/...`).
Falls du eine eigene Domain nutzt oder die Erkennung nicht passt, trage in `app.js` oben
`REPO_OWNER` und `REPO_NAME` fest ein.

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

GitHub Pages selbst kann Ordner nicht auflisten - die Seite nutzt dafür die öffentliche
GitHub-API (kein Login, keine Rate-Limit-Probleme bei normaler Nutzung: 60 Anfragen/Stunde,
pro Seitenaufruf wird nur 1 Anfrage verbraucht). Für **private** Repos funktioniert die
unauthentifizierte API nicht - dann `data/index.json` weiterhin manuell pflegen oder das Repo
public stellen.
