# Social-Baustein — Architektur auf Wix

**Stand:** Entwurf, noch kein Code.
**Arbeitsname:** „Kanalwerk" (Platzhalter, wie „Saalwerk" beim Sitzungssystem).

> **Zuschnitt.** Dies ist ein **Agenturwerkzeug für eigene Bestandskunden**, kein Produkt für
> fremde Kunden. Deren Wix-Sites liegen bereits im eigenen Konto. Das vereinfacht den Aufbau
> erheblich: keine Selbstanmeldung, keine Abrechnung im System, keine App im App Market,
> keine Bereitstellung von Sites.
>
> Zwei frühere Fassungen dieses Dokuments gingen von einem Produkt für fremde Kunden aus und
> waren entsprechend überdimensioniert. Der Verlauf steht in der Git-Historie.

---

## Abgrenzung

Eigener Baustein, getrennt vom Sitzungssystem — kein gemeinsamer Codestand, keine gemeinsame
Datenbank, kein gemeinsamer Betrieb.

Der Grund ist Leitprinzip 2 der Projektanweisung: *Der Saal hängt von nichts ab.* Ein
Social-Werkzeug besteht ausschließlich aus Abhängigkeit von fremden Cloud-Diensten. Diese
Abhängigkeit darf den Saal nie erreichen.

Übernommen werden die Denkweisen: Zustandsketten statt Boolescher Felder, deutsche Bezeichner
in der Domäne, Rechte im Kern geprüft statt in der Oberfläche.

---

## Der Aufbau

```
Planer-Site (eine, intern)
├─ Redaktionskalender, Entwürfe
├─ Freigabelauf
├─ Kundenliste mit Site-IDs
└─ Backend ruft mit Account-API-Schlüssel
        │
        ├─ wix-site-id: Tanzschule   → Publisher API dieser Site
        ├─ wix-site-id: Vinery       → Publisher API dieser Site
        └─ wix-site-id: Festhalle    → Publisher API dieser Site
```

**Ein Account-API-Schlüssel**, angelegt im API Keys Manager, mit Zugriff auf genau die
Kundensites, die das Werkzeug bedienen soll — nicht auf alle. Jeder Aufruf trägt
`Authorization: <key>` und `wix-site-id: <Site der Kundin>`.

Belegte Randbedingungen:

- Nur Kontoinhaber und Mitinhaber können API-Schlüssel anlegen.
- Ein Schlüssel bekommt Zugriff auf alle Sites des Kontos oder auf ausgewählte. Empfehlung
  der Doku und hier zwingend: **die engste nötige Auswahl**.
- Site-Aufrufe funktionieren nur mit Schlüsseln aus dem Konto, dem die Site gehört. Sites,
  die einer Kundin selbst gehören, sind auf diesem Weg **nicht** erreichbar.
- Der Schlüssel gehört ausschließlich in Server-Code, nie in die Oberfläche.

---

## Was die Wix Publisher API trägt

Endpunkte unter `https://www.wixapis.com/social-publisher/v1/`, Bereich
`SCOPE.PROMOTE.MANAGE-SOCIAL-POSTS`.

| Dienst | Was er kann |
|---|---|
| **Accounts** | `Get Connect Url` liefert die OAuth-URL je Kanal; die Kundin autorisiert im Browser, der Abschluss läuft serverseitig. `Get Long Lived Token Status` prüft die Gültigkeit, `Disconnect` trennt. |
| **Items** | Entwurf anlegen, sofort veröffentlichen, oder über `schedulingInfo.scheduledDate` planen. Umplanen, abbrechen, Sammelversand. |
| **Premium Features** | Kontingent prüfen (`PUBLISH_POST`, `SCHEDULE_POST`, `AI_TOOLS`) — **vor** jedem Versand. |
| **Generated Content** | KI-Text und -Bild. Optional. |
| Webhooks | `item-publish-started`, `item-publish-scheduled`, `item-published`, `item-publish-failed` |

**Kanäle:** Instagram, Facebook, LinkedIn, Pinterest, YouTube, Google Business Profile,
TikTok. X ist als *deprecated* geführt.

Die Autorisierung läuft über Wix' eigene Plattform-Apps. Meta, LinkedIn und TikTok haben
*Wix* geprüft. Kein eigener Antrag, kein Prüfverfahren, keine Kundentoken, keine Rotation.

**Nicht abgedeckt:** Kommentare und Direktnachrichten. Community Management als Ticketsystem
ist kein Bestandteil und würde eine eigene Meta-App mit vollem Prüfverfahren erfordern.

Beiträge, die direkt auf einem Kanal entstanden sind, holt Wix einmal täglich und nur bei
bezahltem Plan.

---

## Kontingent und Kosten

Je Kundensite:

| Plan | Beiträge je Monat | Verbundene Konten | Planung |
|---|---|---|---|
| Frei | 10 | 1 | **nein** |
| Essentials | 50 | 2 | ja |
| Pro | 250 | 8 | ja |

**Der freie Plan scheidet aus** — ohne Terminierung kein Redaktionsplan. Jede Kundensite,
die das Werkzeug nutzt, braucht mindestens Essentials.

**Mengenrechnung.** Die Publisher API nimmt **ein Item je Kanal**; ein Beitrag auf fünf
Kanälen verbraucht fünf Einheiten. Bei einer Veröffentlichung alle zwei Tage, also rund 15
im Monat:

| Kanäle | Zustellungen je Monat | Nötiger Plan |
|---|---|---|
| 1 | 15 | Essentials |
| 3 | 45 | Essentials, ohne Reserve |
| 5 | 75 | Pro |
| 8 | 120 | Pro, mit Reserve |

Für einen einzelnen Bestandskunden ist Pro reichlich bemessen. Das Kontingent ist keine
Grenze, die Planposition je Kundensite ist eine Kostenposition — weiterreichen oder in die
Betreuung einrechnen.

> **Widerspruch in den Quellen.** Der Wix-Supportartikel nennt 250 Beiträge für Pro, die
> Wix-Produktseite wirbt mit „unlimited posts". Preise nennt keine der beiden. Im Checkout
> einer bestehenden Site nachsehen.

---

## Fachregeln

**Veröffentlichung**

- **Ein Beitrag darf nie doppelt erscheinen.** Jeder Auftrag trägt einen Idempotenzschlüssel;
  vor einem Wiederholungsversuch wird geprüft, ob der Beitrag bereits draußen ist.
- **Kontingent vor Versand prüfen.** Sonst scheitert ein gültiger Aufruf spät am Limit.
- **Fehlgeschlagen ist ein Zustand, kein Logeintrag.** `item-publish-failed` führt zu einem
  sichtbaren Zustand mit Grund und Wiederholungsknopf.
- **Ein ungültiges Token ist ein Vorgang, kein Fehler.** Wird ein Kanal ungültig, muss die
  Kundin neu verbinden. Geplante Beiträge dürfen dabei nicht stillschweigend verfallen.
- **Ein Item je Kanal.** Format und Inhalt müssen zum Kanal passen. Deshalb trennt das
  Datenmodell Inhalt und Zustellung.

**Freigabe**

- Freigabe ist ein Staffelstab, kein Häkchen: entschieden hat genau eine Person, und wer wann
  freigegeben hat, steht fest. Übernommen aus der Sitzungsleitung.
- Ein freigegebener Beitrag, der nachträglich geändert wird, verliert die Freigabe.

**Trennung der Kunden**

- `kunde_id` in jeder Collection. Auch bei wenigen Kunden — die Trennung nachzurüsten kostet
  mehr, als sie von Anfang an mitzuführen.
- Der API-Schlüssel bekommt nur die Sites, die das Werkzeug wirklich bedient.

---

## Datenmodell (Wix Data Collections auf der Planer-Site)

Wix vergibt `_id`, `_createdDate`, `_updatedDate`, `_owner` selbst.

| Collection | Tragende Felder |
|---|---|
| `kunde` | `name`, `wix_site_id`, `social_plan`, `zustand` |
| `kanal` | `kunde_id`, `plattform`, `wix_account_id`, `anzeigename`, `zustand`, `geprueft_am` |
| `beitrag` | `kunde_id`, `titel`, `text`, `medien[]`, `zustand`, `geplant_fuer`, `idempotenz_schluessel` |
| `beitrag_kanal` | `beitrag_id`, `kanal_id`, `zustand`, `wix_item_id`, `externe_beitrag_id`, `fehlergrund` |
| `freigabe` | `beitrag_id`, `wix_member_id`, `entscheidung`, `begruendung`, `zeitpunkt` |
| `ereignis` | `kunde_id`, `art`, `nutzlast`, `zeitpunkt` — nur anfügbar |

`kunde.wix_site_id` ist der Wert für den `wix-site-id`-Kopf.
`kanal.wix_account_id` stammt aus `List Accounts` der Kundensite.
`beitrag_kanal.wix_item_id` ist die Item-ID der Publisher API — darüber laufen Umplanen,
Abbruch und die Zuordnung eingehender Webhooks.

**Zustandsketten**

- Beitrag: `entwurf → eingereicht → freigegeben → geplant → veroeffentlicht`
  Nebenwege: `abgelehnt`, `zurueckgezogen`
- Beitrag je Kanal: `wartend → uebergeben → zugestellt | fehlgeschlagen | uebersprungen`
- Kanal: `verbunden → ungueltig → getrennt`

---

## Ausbaustufe 2 — Werkzeug für die Kundin

Sobald die Kundin selbst arbeitet, ändert sich der Aufbau an einer Stelle grundlegend.

**Der Account-API-Schlüssel fällt als Weg aus.** Er gibt niemandem eine Oberfläche. Der
richtige Ort ist eine **Dashboard-Seiten-Erweiterung**: die Kundin meldet sich in *ihrem*
Wix-Dashboard an, das sie ohnehin kennt, und findet dort „Kanalwerk" im Menü. Ihre Kanäle,
ihre Kontakte, ihr Kontingent. Einmal gebaut, je Kunde installiert. Wix bietet dafür die
Wix CLI (React/Node, von Wix gehostet) oder eine selbstverwaltete Einbettung per iframe
auf eigenem HTTPS-Server.

### E-Mail: Kampagnen-API nein, Transmissions-API ja

Die Kampagnen-API **kann keine Kampagne anlegen** — laut Doku ist der einzige Weg über die
API, eine bestehende wiederzuverwenden. Gestaltet wird im Wix-Composer. Ein eigener
E-Mail-Aufbau wäre damit tot.

Der Ausweg ist die **Email Transmissions API**: sie nimmt `emailHtmlContent`, also
vollständiges eigenes HTML, kennt `MARKETING` als Typ, ersetzt einen Platzhalter durch den
echten Abmeldelink und akzeptiert einen Idempotenzschlüssel gegen Doppelversand. Absender
muss verifiziert sein, der Versand zählt aufs E-Mail-Kontingent der Site.

### Gestaltung: Vorlagen statt Editor

Ein Canva-Nachbau kommt nicht in Frage. Canva ist ein Grafikeditor mit Ebenen, Schriften,
Freistellern, Formaten und Exportkette — daran arbeiten seit über zehn Jahren Hunderte
Leute. Eine abgespeckte Fassung ist genau das, was Kunden ablehnen.

**Die Kundin braucht auch keinen Editor.** Sie will nicht Schriften wählen und Ebenen
verschieben, sie will, dass es zu ihrem übrigen Auftritt passt. Der richtige Zuschnitt ist
deshalb ein **Vorlagenwerkzeug**:

- Die Agentur gestaltet die Vorlagen in der Markenwelt der Kundin.
- Die Kundin tauscht Bild und Text, wählt das Format, fertig.
- Fest liegen: Schrift, Farbe, Raster, Logo.

Technisch ist das eine Textersetzung und ein Bildzuschnitt auf festem Layout — ein Formular
mit Vorschau, kein Editor. Und es ist **für die Agentur das bessere Produkt**, weil die
Kundin die Gestaltung nicht zerstören kann. Genau daran scheitern Agenturen, die ihren
Kunden freie Werkzeuge geben.

Falls später doch freie Gestaltung verlangt wird: **einkaufen, nicht bauen.** Es gibt
fertige Editor-SDKs für diesen Zweck (Polotno wird ausdrücklich als Canva-artiges SDK
vertrieben, darunter liegen Bibliotheken wie Fabric.js oder Konva; Adobe Express hat ein
Einbett-SDK für Partner). Lizenz- und Preisfragen sind ungeprüft.

### Die drei Teile und ihre Größen

| Teil | Größe | Zustand |
|---|---|---|
| Planer und Verteilung | klein | entworfen, API gemessen |
| Vorlagen | mittel | Zuschnitt steht, nichts gebaut |
| E-Mail über Transmissions | klein | Weg belegt, Kontingent zu klein |
| Freie Gestaltung | sehr groß | nur einkaufen, nur bei belegter Nachfrage |

---

## Baureihenfolge

**Schritt 0 — der Beweis.** API-Schlüssel anlegen, `List Accounts` gegen eine bestehende
Kundensite rufen. Antwortet das, steht der ganze Aufbau. Antwortet es nicht, siehe
Ausweichweg unten. **Vor allem anderen.**

1. Planer-Site, Kundenliste mit Site-IDs, Kanäle je Kunde einlesen
2. Beitrag, Kalender, Freigabelauf — **ohne jede Ausspielung**. Ab hier vorführbar.
3. Zustellung über die Publisher API: ein Kunde, ein Kanal, Ende zu Ende, mit
   Webhook-Rückmeldung
4. Die übrigen Kanäle und Kunden — dieselbe Strecke
5. Kontingentanzeige je Kunde

**Nicht zuerst:** Inbox, Analytics, KI-Texte, Mandantenfähigkeit für fremde Kunden. Alles
additiv, alles später.

---

## Ausweichweg, falls Schritt 0 scheitert

Nimmt die Publisher API keine API-Schlüssel-Identität an, führt der Weg über eine
Wix-App, die auf jeder Kundensite installiert wird und dort mit App-Identität aufruft.
Datenmodell und Freigabelauf bleiben unverändert; es kommt der Installationsvorgang je Site
hinzu und eine Zuordnung Kunde ↔ App-Instanz.

Mehr Arbeit, aber kein anderer Entwurf.

---

## Bestandsaufnahme vom 17.08.2026

Gemessen über `GET /social-publisher/v1/accounts` und
`GET /social-publisher/v1/features/{type}`, je Site über den `wix-site-id`-Kopf.
Zwölf Sites auf Facebook, Instagram und LinkedIn geprüft, sechs davon zusätzlich auf
Kontingent.

**Die Publisher API antwortet.** Der Aufbau ist damit grundsätzlich tragfähig — mit einer
Einschränkung, siehe unten.

**Kanäle.** Genau eine Site hat einen lebenden Kanal: `hnvr.me mit Erlebniss` mit drei
LinkedIn-Konten (Tim Rose als Person, LeineBiz UG, hnvr.me als Standard). Facebook,
Instagram und Google Business Profile sind dort **erloschen**. Alle übrigen Sites haben nie
einen Kanal verbunden.

**Kontingent — der blockierende Befund.** Auf allen sechs geprüften Sites:

- `PUBLISH_POST`: aktiv, Grenze **10 je Monat**, verbraucht 0
- `SCHEDULE_POST`: **abgeschaltet**
- `AI_TOOLS`: abgeschaltet
- `monetizationEnabled`: true

Alle Sites laufen also auf dem freien Plan. **Terminieren ist nirgends möglich**, und die
Grenze von 10 liegt unter dem angenommenen Bedarf von 15. Der Upgrade je Kundensite ist
damit keine Option, sondern die Voraussetzung — vor der ersten Zeile Code.

**Die Zustandskette ist bestätigt.** Die API unterscheidet genau die drei Fälle, die das
Datenmodell vorsieht:

| API-Antwort | Zustand im Modell |
|---|---|
| `HTTP 200` mit `accounts[]` | `verbunden` |
| `USER_IS_DISCONNECTED` | `ungueltig` |
| `USER_NOT_EXIST_FOR_CHANNEL` | nie verbunden |

Die Unterscheidung zwischen „erloschen" und „nie eingerichtet" muss in der Oberfläche
sichtbar bleiben — sonst sucht man einen Fehler, wo nur nichts eingerichtet ist.

**E-Mail-Marketing**, gemessen auf vier Sites über
`GET /email-marketing/v1/account-details`. Alle identisch:

| Merkmal | Wert |
|---|---|
| Status | `ACTIVE` — das Konto besteht bereits |
| Paket | `Free200` |
| Kampagnen je Monat | `-1` — unbegrenzt |
| E-Mails je Monat | **200**, verbraucht 0 |
| Terminierung | **`scheduling: false`** |
| Mehrere Absender | `false` |
| Wix-Werbung entfernbar | `false` |
| Größte Empfängerzahl | 1 000 000 |

Bestehende Kampagnen: `hnvr.me` sieben, die übrigen keine.

Und dasselbe Muster wie bei Social: **Terminierung ist auch bei E-Mail abgeschaltet.**

### Vollständiges Portfolio, alle zwölf Sites

Social-Kontingent und Terminierung sind **auf allen zwölf Sites identisch**: `0/10`
Beiträge im Monat, `SCHEDULE_POST` aus, E-Mail-Paket `Free200` mit 200 E-Mails.
Der einzige Unterschied liegt in der Empfängerliste:

| Kundensite | Kontakte | 200 E-Mails reichen? |
|---|---:|---|
| **Hanomag Ersatzteile** | **3 690** | **nein — bei weitem nicht** |
| hnvr.me | 17 | ja |
| Tanzschule Bothe | 8 | ja |
| PUNKT | 2 | ja |
| Saalwerk, youbooth.me, Hanomag-Service, Vinery Färber, Eggers Eventservice, Festhalle Ahrend, eventcue, Der Anzünder | je 1 | ja |

**Das dreht die Reihenfolge um.** Die frühere Annahme, das E-Mail-Kontingent sei der
Engpass, stimmt für elf von zwölf Sites nicht — dort ist die Liste schlicht leer. Ein
Newsletter hat für sie heute **keinen Wert**, weil es niemanden zu benachrichtigen gibt.

Zwei Folgerungen:

1. **Social zuerst, E-Mail später.** Der universelle Engpass ist die abgeschaltete
   Terminierung bei Social, nicht das E-Mail-Kontingent.
2. **Hanomag Ersatzteile ist der Sonderfall und zugleich der beste Beweiskunde.** 3 690
   Kontakte bei 200 E-Mails im Monat heißt: eine einzige vollständige Aussendung dauert
   über 18 Monate. Dort ist E-Mail nicht Beiwerk, sondern der ganze Zweck — und dort
   rechnet sich ein bezahlter E-Mail-Plan sofort.

---

## Zu prüfen

1. **Nimmt die Publisher API einen Account-API-Schlüssel an?** Die Bestandsaufnahme lief
   über die Kontoanmeldung, **nicht** über einen API-Schlüssel. Dass die Schnittstelle je
   Site erreichbar ist, ist damit belegt; dass sie eine Schlüssel-Identität annimmt, noch
   nicht. Bleibt Schritt 0.
2. Preise von Essentials und Pro, und der Widerspruch 250 gegen „unlimited".
3. Verhalten bei ungültigem Token: Was geschieht mit bereits geplanten Items?
4. ~~Welche der Bestandssites haben bereits einen Social-Plan?~~ **Beantwortet:** keine.
   Alle zwölf laufen frei, mit identischen Werten.
5. Was kostet ein bezahlter E-Mail-Plan? Nur für Hanomag Ersatzteile nötig, dort aber
   sofort — und dort trägt er sich vermutlich auch.

---

## Offene Entscheidungen

- Produktname (》Kanalwerk《 ist Platzhalter)
- Ob die Planer-Site eine Wix-Site wird oder etwas Schlankeres
- Ob und wann daraus doch ein Produkt für fremde Kunden wird — dann kommen Selbstanmeldung,
  Abrechnung und App zurück. Der jetzige Zuschnitt verbaut das nicht, er verschiebt es.
- Auftragsverarbeitung: Wer veröffentlicht im Namen wessen, und was steht dazu im Vertrag
  mit den Bestandskunden?
