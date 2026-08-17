# Veröffentlichen

Kurzfassung: **ein einmaliger Schritt von Hand, danach auf Knopfdruck.**

---

## Warum ich das nicht selbst erledigen kann

Ich rufe die ganze Zeit Wix-APIs auf — das Headless-Projekt, die Collection und
das Profil `hnvr` sind darüber angelegt worden. Der Zugang läuft aber über den
Wix-Connector: ich kann damit *Anfragen stellen*, ich habe den Schlüssel nicht
*in der Hand*. Er liegt im Connector, nicht in dieser Umgebung.

Das Ausliefern des Frontends geht nur über die Wix-CLI auf diesem Rechner
(`wix build`, dann `wix release`), und die will eine eigene Anmeldung:
Browser-Login oder `wix login --api-key <token>` — also einen Schlüssel als
Zeichenkette in einer Konsole.

Geprüft, bevor ich das behaupte:

| Weg | Ergebnis |
|---|---|
| Schlüssel per REST anlegen | Kein Endpunkt. Laut Doku nur im API-Schlüssel-Manager, und nur Kontoinhaber. |
| Frontend per REST ausliefern | Kein Endpunkt. Die Spezifikation hat 29 Treffer auf „publish/release", alle aus Fachdomänen (Blogbeiträge, Bestellungen). |
| `Site Actions`-API | Gilt laut Doku ausdrücklich „not to Headless backends or apps". |
| Gespeicherte CLI-Sitzung | Keine — weder `~/.wix` noch `.wix` im Projekt, keine `WIX_*`-Variable. |

---

## Schritt 1 — einmalig, von Hand

Die Verknüpfung geht nur interaktiv, weil dabei ein **bestehendes** Projekt
ausgewählt wird statt ein neues angelegt:

```bash
cd getintouch
npx wix login
npm create @wix/new@latest -- headless link --business-name "Get in Touch"
```

Dabei das vorhandene Projekt wählen:

| | |
|---|---|
| Name | `Get in Touch` |
| metaSiteId | `ed8e16cf-182d-4cbb-8b7d-1f97fe28d62b` |
| Dashboard | https://manage.wix.com/dashboard/ed8e16cf-182d-4cbb-8b7d-1f97fe28d62b |

Danach:

1. Den Node-Adapter aus `astro.config.mjs` entfernen — Wix bringt seinen eigenen
   mit. (Er steht nur da, damit `npm run build` ohne Wix-Konto funktioniert.)
2. `npm i @wix/data`, danach kann `src/typen/wix-data.d.ts` weg.
3. Die entstandene Verknüpfungsdatei einchecken.

Prüfen und ausliefern:

```bash
npm run build && npx wix release
```

---

## Schritt 2 — ab dann auf Knopfdruck

`.github/workflows/getintouch-veroeffentlichen.yml` erledigt den Rest: Tests,
Typprüfung, Bauen, Ausliefern, danach ein Blick auf die vier wichtigsten
Adressen.

Dafür einmal ein Repository-Geheimnis anlegen:

1. Wix-Dashboard → Einstellungen → **API-Schlüssel** → neuer Schlüssel mit
   Admin-Rolle, beschränkt auf dieses Projekt.
2. GitHub → Settings → Secrets and variables → Actions → **`WIX_API_KEY`**.

Der Schlüssel liegt damit bei GitHub und nicht in einem Chatverlauf. Widerrufen
geht jederzeit im selben Wix-Dialog.

Ausgelöst wird der Ablauf von Hand (Actions → *Get in Touch veröffentlichen* →
*Run workflow*). Absichtlich kein Automatismus bei jedem Commit: ein Deploy
soll eine Entscheidung sein, kein Nebeneffekt.

---

## Noch von Hand im Dashboard

Das Projekt wurde mit den Wix-Vorgaben angelegt und steht auf Englisch, USD und
`America/New_York`. Für einen Betrieb in Hannover gehört das auf Deutsch, EUR
und `Europe/Berlin`. Auf die Seiten wirkt sich das nicht aus — die
Erreichbarkeit rechnet mit der Zeitzone aus dem Profil —, wohl aber auf
Rechnungen und andere Wix-Funktionen. Einen dokumentierten Schreib-Endpunkt
dafür gibt es nicht.
