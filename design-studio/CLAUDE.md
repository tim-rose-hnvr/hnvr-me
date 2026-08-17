# Projektanweisung — Design Studio

> Dieses Verzeichnis ist ein **eigenständiges Produkt** und hat mit dem Sitzungssystem im
> Wurzelverzeichnis nichts zu tun. Die Leitprinzipien dort (Offline-Zwang, kein CDN,
> keine Cloud) gelten hier **nicht** und sind teilweise das Gegenteil dessen, was hier
> gebraucht wird. Es liegt nur vorübergehend im selben Repository und ist so gebaut,
> dass `git subtree split --prefix=design-studio` es ohne Umbau herauslöst.

---

## Was gebaut wird

Ein einbettbarer Design-Editor als eigenes Produkt. Kunden erzeugen daraus markenkonforme
Social-Media-Grafiken und druckfertige PDFs. Ausgeliefert wird er zweifach: als eigenständige
Anwendung (Astro auf Wix Headless) und als Custom Element zum Einbau in fremde Projekte.

**Nicht** das Ziel: Canva ersetzen. Ziel ist der Ausschnitt, den Canva schlecht macht —
erzwungene Markenkonformität und saubere Druckvorstufe.

---

## Leitprinzipien

1. **`editor-core` besitzt das Dokumentformat, kein SDK.** Polotno, Konva, was auch immer
   gerendert wird, bleibt hinter `editor-ui` verborgen. `editor-core` darf kein Render-SDK
   importieren. Grund: Lizenzkosten und Wechselrisiko. Ein SDK-Tausch muss eine Portierung
   von einem Paket sein, kein Neuanfang.
2. **Vorlage zuerst, freies Gestalten als Ausnahme.** Der Standardfall ist ein gesperrtes
   Layout mit ausgefüllten Platzhaltern. Kunden sollen markenkonforme Ergebnisse bekommen,
   keine kreative Spielwiese.
3. **Der Druckpfad ist kein Sonderfall.** Anschnitt, Endformat und Sicherheitsabstand sind
   im Modell, nicht im Export. Ein Entwurf, der für Instagram gebaut wurde, muss ohne
   Datenverlust auf A4 kommen.
4. **Alles Wix-Spezifische lebt in `wix-adapter`.** Die Speicherschnittstelle
   (`EntwurfSpeicher`, `AssetSpeicher`) ist die Grenze. Ein anderer Anbieter ist ein zweiter
   Adapter, keine Änderung im Kern.

---

## Einheiten — einmal lesen, dann nie wieder diskutieren

Alle Koordinaten und Maße im Dokument sind **Pixel bei der `dpi` des Entwurfs**.
Eine Einheit, überall, keine Mischung.

- Bildschirm: `dpi: 72` — dann gilt 1 px = 1 pt, und PDF-Punkte sind identisch.
- Druck: `dpi: 300` — A4 ist dann 2480 × 3508 px.
- Millimeter sind eine reine Anzeigeeinheit. Umrechnung nur über `mmZuPx` / `pxZuMm`.

Ursprung ist die **linke obere Ecke des Endformats**. Elemente im Anschnitt haben
negative Koordinaten. Das ist gewollt.

---

## Aufbau

```
packages/
  editor-core/   Dokumentmodell, Kommando-Stack, Markenkit, Vorlagen — framework-frei
  wix-adapter/   Wix Data, Media, Members hinter der Speicherschnittstelle
  editor-ui/     React, Render-SDK gekapselt              (noch nicht angelegt)
  export/        Social (PNG/JPG) + Druck (PDF/X, CMYK)   (noch nicht angelegt)
  embed/         Custom Element für Fremdprojekte         (noch nicht angelegt)
apps/
  spike-pdf/     Messung: laeuft PDF/X mit WASM unter Wix-CSP?
  studio/        Astro — das Produkt                      (noch nicht angelegt)
```

---

## Arbeitsweise

- **Sprache Deutsch** in Bezeichnern, wo es die Fachdomäne betrifft (`entwurf`, `seite`,
  `vorlage`, `markenkit`, `anschnitt`). Technische Begriffe bleiben englisch, wo etabliert
  (`Kommando`-Stack heißt `KommandoStack`, aber `Store`, `Adapter`, `Schema` bleiben).
- **Lauffähiger Code mit Tests.** Die Regeln oben sind testbar und werden getestet.
- **Keine erfundenen APIs.** Wix-Aufrufe gegen die Dokumentation prüfen, nicht raten.
- **Widersprich, wenn etwas falsch ist.**

---

## Offene Punkte

- **Polotno-Lizenz für Mehrfach-Domain-Einbau ist ungeklärt.** Self-Serve deckt laut
  Preisseite nur *a single domain under one brand family*. Bis das schriftlich geklärt ist,
  wird `editor-ui` nicht gegen Polotno gebaut. Der Kern ist bewusst SDK-frei, damit diese
  Klärung nichts blockiert.
- CSP: CMYK-Konvertierung braucht `wasm-unsafe-eval`, PDF/X-1a-Flattening braucht
  `OffscreenCanvas`. Ob Wix Headless das durchlässt, misst `apps/spike-pdf`.
- Schrifteinbettung im PDF braucht Embedding-Lizenzen. Bis auf Weiteres nur SIL-OFL-Schriften.
