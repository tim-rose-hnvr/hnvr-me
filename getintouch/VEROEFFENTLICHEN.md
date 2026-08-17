# Veröffentlichen

Die Seite ist online:
**https://get-in-tou-35a520f5-hnvrme.wix-site-host.com**

| | |
|---|---|
| Projekt | `Get in Touch` |
| siteId | `880ffa0c-0877-46e5-ba41-e1ba1e072338` |
| appId | `af0cc4c8-dd9a-4fae-a9cc-7265992abc43` |
| Collection | `GetInTouchProfile` |
| Dashboard | https://manage.wix.com/dashboard/880ffa0c-0877-46e5-ba41-e1ba1e072338 |

Verknüpfung und Anmeldedaten stehen in `wix.config.json`; die Datei gehört ins
Repository, sie enthält keine Geheimnisse.

---

## Ausliefern

```bash
cd getintouch
npm run build && npm run release
```

Oder auf Knopfdruck: GitHub → Actions → *Get in Touch veröffentlichen* → *Run
workflow*. Der Ablauf prüft erst (Tests, Typen), baut, liefert aus und sieht
danach nach, ob die vier wichtigsten Adressen antworten. Absichtlich kein
Automatismus bei jedem Commit — ein Deploy soll eine Entscheidung sein.

Dafür braucht es das Repository-Geheimnis **`WIX_API_KEY`**:
Wix-Dashboard → Einstellungen → API-Schlüssel (nur Kontoinhaber), danach
GitHub → Settings → Secrets and variables → Actions.

---

## Zwei Fallen, die Zeit gekostet haben

**`wix login --api-key` läuft ohne Terminal nicht durch.** Das CLI nimmt den
Schlüssel entgegen, fällt dann aber trotzdem auf die Anmeldung per Gerätecode
zurück und wartet bis zum Zeitablauf (Stand CLI 1.1.237). Wer ohne Terminal
anmelden muss, schreibt die Datei, die das CLI nach erfolgreicher Anmeldung
selbst anlegt:

```
~/.wix/auth/api-key.json
{ "token": "<Schlüssel>",
  "accountId": "<accountId>",
  "userInfo": { "userId": "<accountOwner>", "email": "<slug>" } }
```

Die drei Werte liefert `GET https://www.wixapis.com/accounts/v1/accounts/my_account`
mit dem Schlüssel im `Authorization`-Kopf. Genau das macht der Workflow.

**Umgebungsvariablen aus dem Bau überleben nicht.** `import.meta.env.X` wird zu
`process.env.X` übersetzt und erst auf dem Server ausgewertet — dort ist die
Variable nicht gesetzt. Der Name der Collection stand einmal in
`GETINTOUCH_WIX_COLLECTION`; die CMS-Quelle war deshalb beim ersten Ausliefern
lautlos abgeschaltet, und die Seite zeigte nur die Profile aus den Dateien. Er
steht jetzt als Konstante im Code. Wer wirklich eine Variable braucht, setzt sie
mit `wix env set --key … --value …` auf den Servern von Wix, nicht in der Shell
des Bauvorgangs.

---

## Was auf diesem Host nicht uns gehört

`/robots.txt` und `/sitemap.xml` beantwortet Wix an der Kante, bevor unsere
Routen drankommen — `robots.txt.ts` und `sitemap.xml.ts` laufen dort nie. Beide
bleiben trotzdem im Projekt: auf einer eigenen Domain ohne Wix davor stimmen
sie, und lokal prüfen sie sich mit. Auf diesem Host gilt:

- Wix' robots.txt erlaubt alles. Dass die Werkstatt und die Galerie-Vorschauen
  nicht in den Index gehören, steht deshalb als `noindex` in den Seiten selbst —
  wo es ohnehin verbindlicher ist.
- Die Sitemap, die Wix in seiner robots.txt nennt, gibt es nicht (404). Wer sie
  braucht, trägt sie in den SEO-Werkzeugen des Dashboards nach.

Eine vorgebaute **Unterseite** wird als `…/index.html` abgelegt und unter ihrer
Adresse ohne Schrägstrich mit 404 beantwortet — nur die Startseite bekommt diese
Behandlung geschenkt. `/designs` ist deshalb servergerendert. Für neue Seiten
gilt: `prerender = true` nur auf der Startseite.

---

## Noch von Hand im Dashboard

Das Projekt steht auf den Wix-Vorgaben: Englisch, USD, `America/New_York`. Für
einen Betrieb in Hannover gehört das auf Deutsch, EUR und `Europe/Berlin`. Auf
die Seiten wirkt sich das nicht aus — die Erreichbarkeit rechnet mit der
Zeitzone aus dem Profil —, wohl aber auf Rechnungen und andere Wix-Funktionen.
Einen dokumentierten Schreib-Endpunkt dafür gibt es nicht.

Ebenfalls offen: eine eigene Domain vor `get-in-tou-35a520f5-hnvrme.wix-site-host.com`.
Solange die fehlt, zeigt `Astro.site` (`https://hnvr.me`) in Canonical-Angaben
und im QR-Code auf eine Adresse, die es noch nicht gibt.
