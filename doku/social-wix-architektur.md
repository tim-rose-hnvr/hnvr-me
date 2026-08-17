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

## Zu prüfen

1. **Nimmt die Publisher API einen Account-API-Schlüssel an?** Trägt den ganzen Aufbau.
   Schritt 0.
2. Preise von Essentials und Pro, und der Widerspruch 250 gegen „unlimited".
3. Verhalten bei ungültigem Token: Was geschieht mit bereits geplanten Items?
4. Welche der Bestandssites haben bereits einen Social-Plan?

---

## Offene Entscheidungen

- Produktname (》Kanalwerk《 ist Platzhalter)
- Ob die Planer-Site eine Wix-Site wird oder etwas Schlankeres
- Ob und wann daraus doch ein Produkt für fremde Kunden wird — dann kommen Selbstanmeldung,
  Abrechnung und App zurück. Der jetzige Zuschnitt verbaut das nicht, er verschiebt es.
- Auftragsverarbeitung: Wer veröffentlicht im Namen wessen, und was steht dazu im Vertrag
  mit den Bestandskunden?
