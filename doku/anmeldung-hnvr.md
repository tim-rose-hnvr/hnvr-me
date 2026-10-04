# Anmeldung über hnvr.me

Das PDF Studio meldet mit dem **hnvr.me-Konto** an. Kunden von hnvr.me
brauchen kein zweites Konto, und wer bei hnvr.me schon angemeldet ist, kommt
ohne Formular ins Studio.

## Wie es gebaut ist

```
Browser ──► PDF-Studio-Site (eigenes Wix-Projekt „pdf studio", eigenes Hosting)
              │
              ├─ /api/hnvr/anmelden   ─► Wix-Anmeldeseite des hnvr.me-Projekts
              │                           (erst still, prompt=none; sonst mit Formular)
              ├─ /api/hnvr/rueckkehr  ◄─ zurück mit Code → Refresh-Token im HttpOnly-Keks
              ├─ /api/mitglied.json   ─► fragt hnvr.me: wer ist angemeldet?
              ├─ /api/hnvr/abmelden   ─► hier und bei hnvr.me abmelden
              │
              └─ Kontaktanfragen, Unterschriften → weiter im eigenen Projekt
```

- **Wer angemeldet ist, kommt von hnvr.me** (Wix-Projekt „Digitale Erlebnisse",
  `e8492887-…`). Dafür trägt das hnvr.me-Projekt einen zweiten Zugang
  (Headless-Client) „PDF Studio". Wix sieht genau das vor: je Oberfläche, die
  ein Projekt benutzt, ein eigener Client.
- **Hosting und Serverrouten mit erhöhten Rechten bleiben im eigenen Projekt.**
  Die beiden Zugänge zu mischen — Anmeldung und erhöhte Rechte über denselben
  fremden Client — ist kein dokumentierter Weg; deshalb getrennt.
- **Das Studio selbst weiß nichts von hnvr.me.** Es liest Kopfzeilen, die
  `portal/skripte/app-einbetten.mjs` beim Einbetten setzt:
  `studio-anmeldung` (Auskunft), `studio-anmeldung-weg` (Anmeldeknopf),
  `studio-anmeldung-konto` (Beschriftung „Mit hnvr.me anmelden") sowie
  `studio-heimat` und `studio-heimat-name` (Rückweg in die Konsole).

Die Regeln, die schiefgehen können, ohne dass es jemand sieht — kein offener
Umleiter, keine Anmeldeschleife, Kekse nur HttpOnly —, stehen in
`portal/src/hnvr-regeln.js` und werden ohne Server geprüft:

```sh
cd portal && npm run pruefen:hnvr    # 27 Prüfungen
```

## Einrichten

Eingerichtet am 4. Oktober 2026 über die Wix-Schnittstelle (OAuth Apps API),
genau wie hier beschrieben. Die Schritte bleiben stehen, falls der Zugang
einmal neu angelegt werden muss.

1. **Zugang anlegen.** Im Projekt **„Digitale Erlebnisse“** (www.hnvr.me) —
   Wix-Dashboard → *Einstellungen* → *Headless-Einstellungen* → *OAuth-App
   anlegen*, oder `POST /oauth-app/v1/oauth-apps` mit der Site-ID
   `e8492887-5537-412e-a484-297fb7a6ba28`:
   - Name: `PDF Studio`
   - **Login-URL: leer lassen.** Der bestehende Zugang zeigt auf
     `/konsole/anmelden`; diese Seite startet ihren eigenen Login und führt
     danach in die Konsole, nicht ins Studio.
   - Erlaubte Autorisierungs-Rücksprungadressen (genau so):
     - `https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com/api/hnvr/rueckkehr`
     - `http://localhost:4321/api/hnvr/rueckkehr` (nur für die Entwicklung)
   - Erlaubte Umleitungsdomains (für das Abmelden):
     - `https://werkbank-b2ce6ab2-hnvrme.wix-site-host.com`
     - `http://localhost:4321`
2. **Kennung eintragen.** Die Client-ID des Zugangs steht im Dashboard
   (Headless-Einstellungen, Zugang „PDF Studio“). Sie ist nicht geheim, steht
   aber trotzdem nicht im Repository — die Umgebung der Site ist ihr Ort:
   ```sh
   cd portal
   npx wix env set --key HNVR_CLIENT_ID --value <Client-ID>
   echo "HNVR_CLIENT_ID=<Client-ID>" >> .env      # örtlich; .env ist ignoriert
   ```
   Ohne `HNVR_CLIENT_ID` bricht der Bau ab — mit Absicht: eine veröffentlichte
   Fassung, die niemanden anmelden kann, soll es nicht geben.
3. **Veröffentlichen.** `npm run build && npx wix release`
4. **Probe.** `node studio/werkzeuge/live-pruefen.mjs` prüft von außen, dass
   `/api/hnvr/anmelden` zur Wix-Anmeldung des hnvr.me-Projekts führt und dass
   www.hnvr.me/pdf-studio ins Studio weiterleitet. Von Hand: auf www.hnvr.me in
   der Konsole anmelden, dann www.hnvr.me/pdf-studio öffnen — es sollte ohne
   Formular „Angemeldet als …" dastehen. In einem privaten Fenster erscheint
   stattdessen die Wix-Anmeldeseite des hnvr.me-Projekts.

Der Zugang hat einen Schlüssel (`secret`), den die Schnittstelle beim Anlegen
einmal zurückgibt. Das Studio braucht ihn nicht — `src/hnvr.js` meldet nur
mit der Client-ID an (`OAuthStrategy({ clientId })`). Er steht nirgends und
gehört nirgends hin.

**`pdf-studio.me` erst eintragen, wenn die Domain dir gehört und
angeschlossen ist.** Eine erlaubte Rücksprungadresse auf einer fremden Domain
schickt Anmeldecodes von hnvr.me-Konten an den, dem sie gehört.

## Als App in der Konsole

Der öffentliche Einstieg ist **www.hnvr.me/pdf-studio**, und seit dem
4. Oktober 2026 liefert hnvr.me das Studio dort selbst aus. **Dort braucht es
diesen Zugang nicht:** das Studio fragt dieselbe Route wie die Konsole
(`/api/hub/me`) und meldet über `/konsole/anmelden?ziel=…` an — eine Sitzung,
ein Konto, eine Domain (`hnvr-app/README.md`). Der Zugang „PDF Studio“ bleibt
für die eigenständige Studio-Site (werkbank-…); dort gilt alles oben.

Wie das Studio als Bereich in der Konsole und als Kachel auf www.hnvr.me/tools
erscheint — Manifest, Symbol, Kachel, Anleitung — steht in `hnvr-app/`
(`node hnvr-app/pruefe-app.mjs`). Eingebettet setzt `app-einbetten.mjs`
zusätzlich `studio-heimat` und `studio-heimat-name`; dann führt
„KONSOLE / PDF STUDIO“ im Kopf zurück nach www.hnvr.me/konsole.

## Offen, mit Grund

- **Die Anmeldeseite liegt heute unter www.moment-creator.de.** So ist das
  hnvr.me-Projekt eingestellt (Wix-Pages-Domain des bestehenden Zugangs).
  Wer sich anmeldet, sieht also kurz eine andere Domain in der Adresszeile.
  Ob und wie sie für den neuen Zugang auf hnvr.me zeigen kann, ist in den
  Headless-Einstellungen unter *Wix Pages Domain* zu entscheiden — das betrifft
  das ganze hnvr.me-Projekt, nicht nur das Studio.
- **Kontaktanfragen landen weiter im Dashboard der Studio-Site**, nicht im
  Adressbuch von hnvr.me. Dorthin zu schreiben braucht einen Server-Schlüssel
  des hnvr.me-Projekts (API-Key mit CRM-Rechten) in der Umgebung — eine
  eigene Entscheidung.
- **Die alte Mitgliederbasis des Studios** enthält ein einziges Konto, am Tag
  der Einrichtung angelegt. Es wird nicht mehr benutzt.
- **Stilles Anmelden ist erst nach der Veröffentlichung prüfbar.** Örtlich
  bestätigt: die Route bekommt von Wix einen gültigen Anmeldelink des
  hnvr.me-Projekts, Wix prüft die Rücksprungadresse streng (ein nicht
  eingetragener Rücksprung wird mit 400 abgewiesen), die Rückkehr ohne
  Vorgang wird abgewiesen, ein kaputter Keks wird weggeräumt.
