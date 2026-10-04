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

## Die dynamischen Wege — `dynamisch/`

Hier liegt der Teil, der eine Laufzeit braucht: `/r/{kürzel}` schlägt das
Ziel nach, leitet weiter und zählt. Er ist bewusst **nicht** in
`website/src`, sondern in diesem Verzeichnis, und wird von
`astro.config.mjs` per `injectRoute` eingehängt.

Zwei Gründe:

1. `website/` bleibt eine statische Seite, die überall liegen kann. Eine
   Route mit einem Kürzel, das erst morgen entsteht, würde den
   statischen Bau brechen — Astro verlangt dort `getStaticPaths`.
2. Dieser Code ist Wix-eigen: er liest `@wix/data`. Das gehört nicht in
   ein Verzeichnis, das auch auf GitHub Pages liegen soll.

### Das ist eine zweite Umsetzung — mit Ansage

Die Weiterleitung gibt es damit zweimal: einmal in Go (`pnkt/`, mit
JSONL-Ablage, für einen eigenen Server) und einmal hier (mit Wix-Daten).
Das widerspricht dem Grundsatz „ein Programm, keine Sonderzweige", und
die Ausnahme ist begründet:

- Die **Rechnung** — kodieren, formen, beurteilen, ausgeben — bleibt
  einfach. Sie steht nur in Go und läuft im Browser als WebAssembly.
  Zwei Urteile über denselben Code kann es nicht geben.
- Doppelt ist allein die **Ablage**: Nachschlagen, Zählen, Ziel setzen.
  Das sind wenige, klar umrissene Vorgänge.

Der Grund für die Ausnahme ist ein Datum: die Codes in `PK_Codes` sind
gedruckt, und seit der Auslieferung der neuen Seiten zeigten sie ins
Leere. Ein gedruckter Code, der 404 gibt, ist der teuerste Fehler dieses
Systems. Auf einen Server zu warten war keine Möglichkeit.

Sobald ein eigener Server steht, gilt Go, und dieses Verzeichnis wird
zur Übergangslösung, die man abschaltet — nicht zur zweiten Wahrheit,
die man pflegt.

### Die Sammlungen

Sie stammen aus der vorigen PUNKT-Anwendung und tragen echte Daten:

| Sammlung | Inhalt |
|---|---|
| `PK_Codes` | 5 Codes, davon dynamische mit Kürzel und Ziel |
| `PK_Konten` | 2 Konten, mit `pwHash` und `sitzungsSalz` |
| `PK_Statistik` | Zählerstände je Code und Tag |
| `PK_Mitglieder` | Mitarbeitende und offene Einladungen, siehe unten |
| `PK_Ereignisse`, `PK_Ordner`, `PK_Schluessel`, `PK_Domains`, `PK_Dateien` | vorhanden, noch nicht angebunden |

Die Feldnamen sind aus dem Bestand abgelesen. Wer eines umbenennt,
verliert die Daten.

### Mitarbeitende

Der Inhaber lädt in der Zentrale ein: Adresse und Rolle eintragen, die
Seite erzeugt einen Link `/einladung/<32 Zeichen>`. Den gibt er selbst
weiter — dieses System verschickt keine Mails. Die Person meldet sich
mit der eingeladenen Adresse an oder legt ein Konto an und nimmt an.

| Rolle | Codes sehen | anlegen, umhängen, umbenennen, stilllegen | einladen, Rollen, entlassen |
|---|---|---|---|
| Inhaber | ja | ja | ja |
| Redakteur | ja | ja | nein |
| Leser | ja | nein | nein |

Die Regeln stehen in `dynamisch/team.ts` und sind getestet
(`test/team.test.ts`), die Ablage in `dynamisch/ablage.ts`, geprüft wird
in `dynamisch/api.ts` — bei jeder Anfrage, nicht in der Oberfläche.

- **Der Link ist das Geheimnis, nicht die Adresse.** Konten entstehen hier
  ohne Bestätigungsmail; eine Mitgliedschaft, die nur an einer Adresse
  hinge, könnte übernehmen, wer die Adresse als Erster registriert.
  Abgelegt ist nur der SHA-256-Abdruck. Sieben Tage gültig, einmal
  einlösbar, und nur für die eingeladene Adresse.
- **Codes gehören der Organisation** (`kontoId` = Konto des Inhabers).
  Was ein Redakteur anlegt, bleibt beim Inhaber, auch nach dem Austritt.
  Eigene Codes von vor dem Beitritt bleiben eigene.
- **Höchstens eine fremde Organisation je Konto.** Wer selbst
  Mitarbeitende führt, kann nicht zugleich irgendwo beitreten.
- **Entlassen wirkt sofort.** Die Rolle wird bei jeder Anfrage neu
  gelesen, nicht im Ausweis mitgetragen.
- **Die Altzeile** (`admin@hnvr.me` als Redakteur, ohne `zustand`) gilt
  als offene Einladung ohne Link. Der Inhaber stellt mit „Neuer Link"
  einen aus; erst dann kann sie angenommen werden.

Neue Felder an `PK_Mitglieder`: `zustand` (`eingeladen` | `aktiv`),
`mitgliedId`, `name`, `einladungAbdruck`, `einladungBis`, `eingeladen`,
`beigetreten`. Wix legt Felder, die im Schema fehlen, beim Schreiben an —
das ist bei den bestehenden Sammlungen so, aber für diese Sammlung **nicht
gegen den echten Bestand geprüft**. Vor dem ersten Einsatz einmal mit
einem Wegwerf-Konto durchklicken: einladen, annehmen, Code umhängen,
Leser setzen, Umhängen muss scheitern, entlassen.

**Abweichung vom Go-Programm:** `pnkt/` holt Mitarbeitende über die
Adresse eines schon bestehenden Kontos herein (`NimmMitarbeitendeAuf`),
ohne Link. Beim Umzug auf den eigenen Server gilt dieselbe Begründung wie
oben — dort sollte der Link nachgezogen werden, nicht hier entfernt.
