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

## Woher die appId stammt

`wix.config.json` trägt zwei Kennungen. Die `siteId` steht in der
veröffentlichten Seite. Die `appId` stand nirgends im Repository, und es
gibt keinen Aufruf, der die eigenen Apps eines Kontos aufzählt — feste,
öffentliche Kennungen haben nur die von Wix selbst gebauten Apps.

Ermittelt wurde sie über die auf einer Site installierten Apps:

```
GET https://www.wixapis.com/apps-installer-service/v1/app-instances   (je Site)
```

Ein von Wix gebautes App steht auf vielen Sites, das eigene Projekt-App
auf genau einer. Auf „QR Code" waren zwei Kennungen übrig, die Get in
Touch nicht hat; nach dem Abgleich mit fünf weiteren Sites des Kontos
blieb eine:

| Kennung | installiert auf |
|---|---|
| `78640cbb-…` | QR Code, pdf studio, youbooth.me → kein Projekt-App |
| **`1af487c5-…`** | **nur QR Code** → das PUNKT-Projekt |
| `af0cc4c8-…` | nur Get in Touch → Gegenprobe, dessen appId bekannt ist |

Die Gegenprobe ist der eigentliche Beweis: die bekannte appId von Get in
Touch zeigt genau dieselbe Signatur — installiert auf ihrer eigenen Site
und auf keiner anderen.

`npm run kennung` prüft weiterhin beide Werte. Nicht aus Misstrauen gegen
diesen Befund, sondern gegen den Fall, dass jemand die Datei leert oder
auf eine fremde Site zeigen lässt: ein Ausliefern an die falsche Stelle
merkt man erst, wenn eine fremde Seite ersetzt ist.

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
