# Abnahme

Der Zweck dieser Phase ist nicht, sich zu vergewissern, dass alles stimmt. Der Zweck ist, **Gegenbeweise zu suchen**. Wer prüft, um bestätigt zu werden, findet nichts.

## Ablauf

**1. Bauen und ausliefern.** Was geprüft wird, ist der Build, nicht die Quelldatei.

**2. Prüflauf starten.**

```bash
node .claude/skills/webseite/scripts/pruefen.mjs ./dist / /leistungen /kontakt
node .claude/skills/webseite/scripts/pruefen.mjs http://localhost:3000 --out .pruefung
```

Alle Seiten prüfen, nicht nur die Startseite. Unterseiten sind der Ort, an dem halbfertige Arbeit sitzt.

**3. Fehler beheben, bis der Lauf mit `0 Fehler` endet.** Nicht die Prüfung entschärfen.

**4. Warnungen und Gestaltungsverdacht beantworten** — behoben oder mit einem Satz begründet. Ein Verdacht darf abgelehnt werden („Systemschrift ist hier Absicht, die Seite läuft im abgeschotteten Netz"), aber nicht übergangen werden.

**5. Screenshots ansehen.** Mit dem Read-Werkzeug auf die PNG-Dateien in `.pruefung/screenshots/`. Erzeugen ist keine Prüfung — es muss hingesehen werden. Mindestens die Mobil- und die Desktopfassung jeder Seite.

Beim Ansehen konkret fragen:
- Führt der Blick von selbst zur wichtigsten Stelle, oder konkurrieren drei Elemente?
- Ist irgendwo etwas gedrängt, das Luft braucht?
- Sieht die Mobilfassung gebaut aus oder zusammengeschoben?
- Ist der Signature Moment im Bild sichtbar?
- Gibt es eine Stelle, an der man merkt, dass hier jemand entschieden hat?

**6. Von Hand nachfassen**, was kein Skript kann:
- Tab-Taste durch die ganze Seite: Fokus immer sichtbar, Reihenfolge logisch, keine Falle.
- Jedes Formular einmal falsch ausfüllen und einmal absenden.
- Jeden Zustand ansehen: leer, Ladevorgang, Fehler, ein Element, sehr viele Elemente, sehr langer Text.
- Seite auf 200 % zoomen.
- Wenn es eine Dunkelfassung gibt: beide Fassungen ansehen.

## Fundtypen und ihre Bedeutung

| Meldung | Was dahintersteckt |
|---|---|
| `konsole` | Fehler im JavaScript oder fehlende Datei. Nie ignorieren, auch wenn die Seite „trotzdem geht". |
| `netz` | 404 auf Bild, Schrift oder Skript. Häufig falscher Pfad im Build. |
| `layout` waagerechter Überlauf | Feste Breite, zu langes Wort, überbreites Element. Auf Mobil der häufigste echte Fehler. |
| `kontrast` | Grauer Text auf grauem Grund. Betrifft fast immer Hilfs- und Fußzeilentexte. |
| `bewegung` | Animation läuft trotz reduzierter Bewegung. Die Mediaabfrage fehlt oder greift nicht. |
| `links` | Interner Link ins Leere, oft ein vergessenes `href="#"`. |
| `inhalt` | Platzhaltertext in der Abgabe. |
| `verdacht typografie` | Keine erkennbare Skala oder zu wenig Größenkontrast — die Hauptursache für langweilige Seiten. |
| `verdacht farbe` | Standardpalette übernommen statt Farben gewählt. |

## Berichtsvorlage

Diese Form wird abgegeben, nicht „ist fertig".

```markdown
## Abnahme <Projekt>

### Anforderungen
- [erledigt]   Startseite mit Preisrechner — /: Rechner rechnet, Werte geprüft mit 3 Eingaben
- [teilweise]  Kontaktformular — Gestaltung und Validierung fertig, Versand fehlt (kein Endpunkt vorhanden)
- [offen]      Englische Fassung — nicht begonnen, siehe Restliste

### Prüflauf
`node .claude/skills/webseite/scripts/pruefen.mjs ./dist / /preise /kontakt`
0 Fehler, 2 Warnungen, 1 Gestaltungsverdacht

- Warnung „meta description fehlt" auf /kontakt → ergänzt
- Warnung „Tippziel 22×22 auf Mobil" → Fläche auf 44 px vergrößert
- Verdacht „nur Systemschriften" → abgelehnt: Auslieferung im abgeschotteten Netz, Schrift bewusst lokal und systemnah

### Angesehene Screenshots
- start-mobil.png — Kopfbereich sitzt, Displayzeile bricht sauber
- start-desktop.png — Signature Moment (Saalplan) im ersten Bild sichtbar
- preise-mobil.png — Tabelle scrollt waagerecht in eigenem Rahmen, Rest der Seite nicht

### Von Hand geprüft
Tabreihenfolge, Formular mit Leereingabe, 200 % Zoom, Dunkelfassung

### Bewusst weggelassen
- Keine Dunkelfassung für die Druckansicht — nicht beauftragt
- Kein Analytics

### Restliste
1. Endpunkt für Formularversand
2. Englische Fassung
```

## Regel für die Fertigmeldung

„Fertig" ohne grünen Prüflauf ist eine Falschaussage, auch wenn sie gut gemeint ist. Wenn etwas nicht geht, gehört das in die Meldung — mit Grund und Restliste. Eine ehrliche Restliste kostet Vertrauen einmal; ein grünes Häkchen, das beim ersten Klick zerfällt, kostet es dauerhaft.
