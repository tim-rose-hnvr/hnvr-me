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
- **Das Studio selbst weiß nichts von hnvr.me.** Es liest drei Kopfzeilen, die
  `portal/skripte/app-einbetten.mjs` beim Einbetten setzt:
  `studio-anmeldung` (Auskunft), `studio-anmeldung-weg` (Anmeldeknopf) und
  `studio-anmeldung-konto` (Beschriftung „Mit hnvr.me anmelden").

Die Regeln, die schiefgehen können, ohne dass es jemand sieht — kein offener
Umleiter, keine Anmeldeschleife, Kekse nur HttpOnly —, stehen in
`portal/src/hnvr-regeln.js` und werden ohne Server geprüft:

```sh
cd portal && npm run pruefen:hnvr    # 27 Prüfungen
```

## Einrichten — der eine Schritt, den nur du machen kannst

Der Zugang im hnvr.me-Projekt vergibt Zugriff auf die Kundenkonten einer
laufenden Site. Das legt niemand außer dir an.

1. **Zugang anlegen.** Wix-Dashboard der Site **„Digitale Erlebnisse"**
   (www.hnvr.me) → *Einstellungen* → *Headless-Einstellungen* → *OAuth-App
   anlegen*:
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
2. **Kennung eintragen.** Die Client-ID des neuen Zugangs kopieren, dann:
   ```sh
   cd portal
   npx wix env set --key HNVR_CLIENT_ID --value <Client-ID>
   echo "HNVR_CLIENT_ID=<Client-ID>" >> .env      # örtlich; .env ist ignoriert
   ```
   Ohne `HNVR_CLIENT_ID` bricht der Bau ab — mit Absicht: eine veröffentlichte
   Fassung, die niemanden anmelden kann, soll es nicht geben.
3. **Veröffentlichen.** `npm run build && npx wix release`
4. **Probe.** Auf www.hnvr.me in der Konsole anmelden, dann
   `…/portal` des Studios öffnen: es sollte ohne Formular „Angemeldet als …"
   dastehen. In einem privaten Fenster erscheint stattdessen die
   Wix-Anmeldeseite des hnvr.me-Projekts.

**`pdf-studio.me` erst eintragen, wenn die Domain dir gehört und
angeschlossen ist.** Eine erlaubte Rücksprungadresse auf einer fremden Domain
schickt Anmeldecodes von hnvr.me-Konten an den, dem sie gehört.

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
