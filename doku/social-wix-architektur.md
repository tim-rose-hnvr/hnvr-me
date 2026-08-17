# Social-Baustein — Architektur auf Wix

**Stand:** Entwurf, noch kein Code.
**Arbeitsname:** „Kanalwerk" (Platzhalter, wie „Saalwerk" beim Sitzungssystem).

> **Korrektur gegenüber der ersten Fassung.** Die erste Fassung ging davon aus, dass wir
> eigene Plattform-Apps bei Meta, LinkedIn und TikTok anmelden und deren Prüfverfahren
> durchlaufen müssen. Das ist falsch. Wix hat eine **Publisher API** mit eigener,
> bereits geprüfter Plattform-Anbindung. Damit entfällt der aufwendigste Teil, und die
> empfohlene Kanalreihenfolge dreht sich um.

---

## Abgrenzung

Dies ist ein **eigener Baustein** mit eigener Wix-Site, eigener Kundschaft und eigener
Abrechnung. Er teilt mit dem Sitzungssystem weder Codestand noch Datenbank noch Betrieb.

Der Grund für die Trennung ist Leitprinzip 2 der Projektanweisung: *Der Saal hängt von nichts
ab.* Ein Social-Werkzeug besteht ausschließlich aus Abhängigkeit von fremden Cloud-Diensten.
Diese Abhängigkeit darf den Saal nie erreichen.

Übernommen werden die Denkweisen: Mandantenfähigkeit von der ersten Tabelle an,
Zustandsketten statt Boolescher Felder, deutsche Bezeichner in der Domäne.

Eine spätere Brücke — Beschluss gefasst → Pressemitteilung vorbereitet — ist vorgesehen,
aber **nicht Teil der ersten Ausbaustufe**. Sie wird eine Schnittstelle, nie eine gemeinsame
Datenbank.

---

## Was die Wix Publisher API abnimmt

Endpunkte unter `https://www.wixapis.com/social-publisher/v1/`, Berechtigungsbereich
`SCOPE.PROMOTE.MANAGE-SOCIAL-POSTS`.

| Dienst | Was er kann |
|---|---|
| **Accounts** | `Get Connect Url` gibt die OAuth-URL je Kanal aus. Der Kunde autorisiert im Browser, der Abschluss läuft serverseitig. `Get Long Lived Token Status` prüft die Gültigkeit, `Disconnect` trennt. |
| **Items** | Entwurf anlegen, sofort veröffentlichen, oder über `schedulingInfo.scheduledDate` planen. Umplanen, abbrechen, Sammelversand. |
| **Premium Features** | Kontingent und Berechtigung prüfen (`PUBLISH_POST`, `SCHEDULE_POST`, `AI_TOOLS`) — **vor** jedem Versand. |
| **Generated Content** | KI-Text und -Bild. Optional, nicht tragend. |
| Webhooks | `item-publish-started`, `item-publish-scheduled`, `item-published`, `item-publish-failed` |

**Kanäle:** Instagram, Facebook, LinkedIn, Pinterest, YouTube, Google Business Profile,
TikTok. X ist in der Kanalliste als *deprecated* geführt.

**Die tragende Erkenntnis:** Die Autorisierung läuft über Wix' eigene Plattform-Apps. Meta,
LinkedIn und TikTok haben *Wix* geprüft. Wir stellen keinen eigenen Antrag, durchlaufen kein
Review, halten keine Kundentoken und tragen deren Rotation nicht.

**Was die Publisher API ausdrücklich nicht kann:** Kommentare und Direktnachrichten lesen
oder beantworten. Die zweite Säule von swat.io — Community Management als Ticketsystem —
ist damit **nicht** abgedeckt und bleibt aus der ersten Ausbaustufe draußen. Wer sie später
will, braucht dafür doch eine eigene Meta-App mit eigenem Prüfverfahren. Das ist dann eine
eigene Entscheidung mit eigener Begründung.

Beiträge, die direkt auf einem Kanal entstanden sind, holt Wix einmal täglich und nur bei
bezahltem Plan. Kein Abruf auf Zuruf.

---

## Der Schnitt

```
Hauptsite „Kanalwerk"                    Kundensite (je Mandant eine)
──────────────────────                   ────────────────────────────
Selbstanmeldung   (Members)              hält die verbundenen Kanäle
Abo und Rechnung  (Pricing Plans)        trägt das Veröffentlichungskontingent
Redaktionskalender, Entwurf     ──────►  Publisher API stellt zu
Freigabelauf                    ◄──────  Webhooks melden Ergebnis zurück
Wix Data als Datenhaltung
```

**Kein eigener Konnektor in der ersten Stufe.** Uhr, Tokentresor und Plattform-Adapter —
die drei Gründe für den Go-Dienst der ersten Fassung — trägt jetzt Wix. Ein eigener Dienst
kommt erst dazu, wenn ein Kanal gewollt wird, den Wix nicht führt (Bluesky, Mastodon), oder
wenn die Inbox gebaut wird.

**Warum eine Site je Kunde.** Verbundene Konten gehören der **Site**, nicht einem Member.
Eine gemeinsame Site für alle Kunden scheidet damit aus: gemeinsames Kontingent, und
`List Accounts` gäbe jedem Kunden die Konten aller anderen zurück. Die Hauptsite trägt
Anmeldung, Abo und Planer; je Mandant wird eine Site bereitgestellt, die seine Kanäle hält.

Der Preis dafür ist ein Wix-Plan je Kunde. **Der muss in die Preisgestaltung**, nicht in die
Marge. Siehe den folgenden Abschnitt.

---

## Kontingent und Kostenuntergrenze

Veröffentlichen und Planen hängen am Social-Media-Marketing-Plan der jeweiligen Site.

| Plan | Beiträge je Monat | Verbundene Konten | Planung möglich |
|---|---|---|---|
| Frei | 10 | 1 | **nein** |
| Essentials | 50 | 2 | ja |
| Pro | 250 | 8 | ja |

**Der freie Plan scheidet aus.** Er kann nicht terminieren, und ein Publisher ohne
Terminierung ist keiner. Jeder Kunde braucht mindestens Essentials.

**Mengenrechnung.** Die Publisher API nimmt **ein Item je Kanal**. Ein Beitrag, der auf fünf
Kanälen erscheinen soll, verbraucht fünf Einheiten. Bei der angenommenen Frequenz von einer
Veröffentlichung alle zwei Tage, also rund 15 im Monat:

| Kanäle je Kunde | Zustellungen je Monat | Nötiger Plan |
|---|---|---|
| 1 | 15 | Essentials |
| 3 | 45 | Essentials, ohne Reserve |
| 5 | 75 | Pro |
| 8 | 120 | Pro, mit Reserve |

Das Kontingent ist damit **nicht** die Grenze. Die Grenze ist die Kostenuntergrenze je
Kunde: Site-Plan plus Social-Plan fallen an, bevor der erste Euro verdient ist. Zwei Konten
reichen für kaum einen Kunden, also ist Pro der Regelfall.

> **Widerspruch in den Quellen.** Der Wix-Supportartikel nennt 250 Beiträge für Pro, die
> Wix-Produktseite wirbt bei bezahlten Plänen mit „unlimited posts". Vor der Preisgestaltung
> im echten Checkout klären. Die Zahlen oben stammen aus dem Supportartikel, weil er
> konkreter ist.

---

## Fachregeln, die nicht wegoptimiert werden dürfen

**Veröffentlichung**

- **Ein Beitrag darf nie doppelt erscheinen.** Jeder Auftrag trägt einen Idempotenzschlüssel.
  Vor einem Wiederholungsversuch wird geprüft, ob der Beitrag bereits draußen ist. Ein
  Ausfall darf Verzögerung kosten, niemals eine Doppelveröffentlichung.
- **Kontingent vor Versand prüfen.** Die Premium Features API wird vor jedem Veröffentlichen
  und Planen gefragt. Ein gültiger Aufruf scheitert sonst am Limit — und zwar spät.
- **Fehlgeschlagen ist ein Zustand, kein Logeintrag.** Der Webhook `item-publish-failed`
  führt zu einem sichtbaren Zustand mit Grund und Wiederholungsknopf. Stille Fehlschläge
  sind die häufigste Beschwerde über Werkzeuge dieser Art.
- **Ein ungültiges Token ist ein Vorgang, kein Fehler.** `Get Long Lived Token Status` wird
  regelmäßig geprüft. Wird ein Token ungültig, muss der Kunde den Kanal neu verbinden —
  geplante Beiträge dürfen dabei nicht stillschweigend verfallen.
- **Ein Beitrag je Kanal.** Die Publisher API nimmt je Item genau einen Kanal, und Format und
  Inhalt müssen zum Kanal passen. Unser Datenmodell trennt deshalb Inhalt und Zustellung.

**Freigabe**

- Freigabe ist ein Staffelstab, kein Häkchen: berechtigt sind mehrere, entschieden hat genau
  eine Person, und wer wann freigegeben hat, steht fest. Übernommen aus der Sitzungsleitung.
- Ein freigegebener Beitrag, der nachträglich geändert wird, verliert die Freigabe. Ohne
  diese Regel ist der ganze Lauf wertlos.

**Mandant**

- `mandant_id` in jeder Collection, ohne Ausnahme.
- Jede Abfrage im Backend filtert zusätzlich auf den Mandanten des angemeldeten Members.
  Berechtigungen werden im Kern geprüft, nie in der Oberfläche.

---

## Datenmodell (Wix Data Collections, Hauptsite)

Wix vergibt `_id`, `_createdDate`, `_updatedDate`, `_owner` selbst.

| Collection | Tragende Felder |
|---|---|
| `mandant` | `name`, `plan_id`, `kunden_site_id`, `zustand` |
| `mitgliedschaft` | `mandant_id`, `wix_member_id`, `rolle` (`inhaber`, `redaktion`, `freigabe`, `betrachter`) |
| `kanal` | `mandant_id`, `plattform`, `wix_account_id`, `anzeigename`, `zustand`, `token_geprueft_am` |
| `beitrag` | `mandant_id`, `titel`, `text`, `medien[]`, `zustand`, `geplant_fuer`, `idempotenz_schluessel` |
| `beitrag_kanal` | `beitrag_id`, `kanal_id`, `zustand`, `wix_item_id`, `externe_beitrag_id`, `fehlergrund` |
| `freigabe` | `beitrag_id`, `wix_member_id`, `entscheidung`, `begruendung`, `zeitpunkt` |
| `ereignis` | `mandant_id`, `art`, `nutzlast`, `zeitpunkt` — nur anfügbar |

`kanal.wix_account_id` ist die Konto-ID aus `List Accounts` auf der Kundensite.
`beitrag_kanal.wix_item_id` ist die Item-ID aus der Publisher API — darüber laufen Umplanen,
Abbruch und die Zuordnung eingehender Webhooks.

**Zustandsketten**

- Beitrag: `entwurf → eingereicht → freigegeben → geplant → veroeffentlicht`
  Nebenwege: `abgelehnt`, `zurueckgezogen`
- Beitrag je Kanal: `wartend → uebergeben → zugestellt | fehlgeschlagen | uebersprungen`
- Kanal: `verbunden → ungueltig → getrennt`

---

## Kanalreihenfolge

**Stufe 1 — von Wix getragen, kein eigener Antrag. Hiermit wird gestartet.**

Instagram, Facebook, LinkedIn, YouTube, Pinterest, Google Business Profile, TikTok.

Alle sieben über denselben Weg: `Get Connect Url` → Kunde autorisiert → veröffentlichen.
Kein Adapter je Plattform, kein Prüfverfahren, kein Tokentresor.

**Stufe 2 — nur bei belegter Nachfrage, mit eigenem Aufwand.**

- Bluesky und Mastodon: offene Protokolle, kein Genehmigungsverfahren, aber eigener Adapter
  und damit doch ein eigener Dienst.
- X: von Wix als deprecated geführt; eigener Zugang ist kostenpflichtig und teuer.

**Stufe 3 — eigene Entscheidung mit eigener Begründung.**

Inbox und Community Management. Braucht eine eigene Meta-App mit vollem Prüfverfahren und
den Erhaltungsaufwand, den die erste Fassung dieses Dokuments beschrieben hat. Erst
anfangen, wenn Stufe 1 Geld verdient.

---

## Baureihenfolge

1. Hauptsite, Selbstanmeldung, Mandant und Mitgliedschaft, Rollen
2. Beitrag, Kalender, Freigabelauf — **ohne jede Ausspielung**. Ab hier vorführbar.
3. Bereitstellung der Kundensite, Kanalverbindung über `Get Connect Url`
4. Zustellung über die Publisher API, ein Kanal, Ende zu Ende, mit Webhook-Rückmeldung
5. Die übrigen sechs Kanäle — größtenteils dieselbe Strecke
6. Kontingentanzeige und Abrechnung nach Verbrauch

**Nicht zuerst:** Inbox, Analytics, KI-Texte, Mehrsprachigkeit. Alles additiv.

---

## Zu prüfen, bevor gebaut wird

Der erste Punkt entscheidet, ob das ein Produkt wird.

1. **Was kosten Essentials und Pro?** Die Mengen stehen fest (siehe oben), die Preise nicht —
   der Supportartikel nennt keine. Zusammen mit dem Site-Plan ergibt das die
   Kostenuntergrenze je Kunde, und damit den Boden, über dem unser Preis liegen muss.
   Im echten Checkout nachsehen, dabei den Widerspruch 250 gegen „unlimited" mitklären.
2. Ist das Kontingent tatsächlich **je Site** bemessen und nicht kontoweit? Die Aufteilung
   in eine Site je Kunde steht und fällt damit.
3. Lässt sich eine Kundensite **programmgesteuert bereitstellen**, samt Plan-Zuweisung, oder
   ist jeder Neukunde Handarbeit?
4. Verhalten bei ungültigem Token: Was passiert mit bereits geplanten Items, wenn der Kanal
   die Gültigkeit verliert?
5. Mengengrenzen von Wix Data auf der Hauptsite: Einträge je Collection, Abfragedurchsatz.

---

## Offene Entscheidungen

- Produktname (》Kanalwerk《 ist Platzhalter)
- Ob die Kundensite dem Kunden gehört oder uns — Auswirkung auf Kündigung und Datenmitnahme
- Auftragsverarbeitung und Löschkonzept, bevor der erste echte Kunde anschließt
- Erster Pilotkunde
