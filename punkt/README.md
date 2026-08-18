# PUNKT auf Wix

Die Hülle, mit der die Marketingseite auf die bestehende Wix-Site
**„QR Code"** ausgeliefert wird
(`710946fa-e37e-43d7-9f1e-0db6bec22300`, heute erreichbar unter
`punkt-954d3e9b-hnvrme.wix-site-host.com`).

**Hier liegt keine einzige Seite.** `astro.config.mjs` zeigt mit `srcDir`
und `publicDir` nach `../website`. Was ausgeliefert wird, steht dort und
nur dort — zwei Kopien derselben Seite laufen auseinander, und man merkt
es erst, wenn die ausgelieferte Fassung etwas anderes sagt als die, an
der man arbeitet.

```sh
cd punkt
npm install
npm run build      # baut ../website/src, ohne jede Wix-Anmeldung
npm run release    # liefert aus — braucht Anmeldung, siehe unten
```

## Was noch fehlt: die appId

`wix.config.json` trägt zwei Kennungen. Die `siteId` steht drin. Die
`appId` nicht:

```json
{ "appId": "HIER-DIE-APP-ID-…", "siteId": "710946fa-e37e-43d7-9f1e-0db6bec22300" }
```

Sie entsteht beim Anlegen des Projekts und liegt **nur im Projektordner**,
aus dem bisher ausgeliefert wurde. Es gibt keinen Weg, sie zu ermitteln:

- Die Wix-REST-Schnittstelle kennt keinen Aufruf, der die eigenen Apps
  aufzählt — nur die von Wix selbst gebauten haben feste, öffentliche
  Kennungen.
- `wix` kann einen bestehenden Projektstand nicht herunterladen. Es gibt
  `npm create @wix/new headless link`, aber das legt eine **neue** Site an,
  statt sich mit einer bestehenden zu verbinden.
- Die ausgelieferte Seite gibt sie nicht preis. Nachgesehen: in allen acht
  Seiten steht genau eine Kennung, und das ist die `siteId`.

`npm run kennung` prüft das und bricht mit dieser Erklärung ab, statt
einen Bau zu starten, der zwanzig Sekunden später unverständlich endet.

## Ohne die Wix-Anbindung

`astro.config.mjs` bindet den Hosting-Adapter ein, aber **nicht** `wix()`.
Die Anbindung bringt CMS, Mitglieder und Warenkorb mit und verlangt dafür
`WIX_CLIENT_ID` samt Client-Geheimnis. Die Marketingseite braucht nichts
davon: sie zeigt je Besucher dasselbe, fragt nichts ab und rechnet nichts.

Das hat zwei Folgen, beide gewollt:

1. Der Bau läuft **ohne jede Anmeldung** durch — nachprüfbar mit
   `npm run build`. Nur `release` braucht den Schlüssel.
2. In der ausgelieferten Seite liegt kein Wix-Clientcode. Was nicht
   eingebunden ist, kann auch nichts nachladen.

## Was beim Ausliefern verschwindet

Der heutige Stand der Site hat acht Wege. Nach dem Ausliefern:

| Weg | danach |
|---|---|
| `/`, `/datenschutz`, `/impressum` | ersetzt durch den neuen Entwurf |
| `/lesbarkeit`, `/massenanlage`, `/schnittstelle` | im neuen Entwurf nachgebaut, gegen `pnkt/` geprüft |
| `/studio`, `/zentrale` | **weg** |

`/studio` und `/zentrale` sind die Anwendung, nicht Marketing. Sie laufen
inzwischen im Go-Programm unter `pnkt/` — Wix kann kein Go ausführen. Sie
kommen zurück, sobald ein Server für `pnkt.me` steht; bis dahin sind sie
auf dieser Adresse nicht mehr erreichbar.

## Auslieferung

Über den Workflow `.github/workflows/punkt-veroeffentlichen.yml`, von Hand
gestartet. Er prüft zuerst die Kennungen, baut, liefert aus und ruft
danach alle zehn Seiten und die Schrift ab — fehlt die Schrift, sieht die
Seite auf den ersten Blick richtig aus und setzt in Wahrheit die
Systemschrift.
