# Social-Baustein — Architektur auf Wix

**Stand:** Entwurf, noch kein Code.
**Arbeitsname:** „Kanalwerk" (Platzhalter, wie „Saalwerk" beim Sitzungssystem).

---

## Abgrenzung

Dies ist ein **eigener Baustein** mit eigener Wix-Site, eigener Kundschaft und eigener
Abrechnung. Er teilt mit dem Sitzungssystem weder Codestand noch Datenbank noch Betrieb.

Der Grund für die Trennung ist nicht Bequemlichkeit, sondern Leitprinzip 2 der
Projektanweisung: *Der Saal hängt von nichts ab.* Ein Social-Werkzeug besteht
ausschließlich aus Abhängigkeit von fremden Cloud-Schnittstellen. Diese Abhängigkeit darf
den Saal nie erreichen. Zwei Sites, zwei Betriebsverantwortungen, keine gemeinsame Laufzeit.

Was übernommen wird, sind die Denkweisen: Mandantenfähigkeit von der ersten Tabelle an,
Zustandsketten statt Boolescher Felder, deutsche Bezeichner in der Domäne.

Eine spätere Brücke zwischen beiden Bausteinen — Beschluss gefasst → Pressemitteilung
vorbereitet — ist ausdrücklich vorgesehen, aber **nicht Teil der ersten Ausbaustufe**. Sie
wird eine Schnittstelle, nie eine gemeinsame Datenbank.

---

## Der Schnitt

```
Wix-Site „Kanalwerk"                     Konnektor (Go, eigener Server)
─────────────────────────────            ──────────────────────────────
Selbstanmeldung   (Members)              Uhr   — minutengenaue Warteschlange
Abo und Rechnung  (Pricing Plans)        Tresor — Kundentoken, verschlüsselt
Redaktionskalender, Entwurf              Adapter — je Kanal einer
Freigabelauf                     ──────► Zustellung an die Plattformen
Inbox-Oberfläche                 ◄────── Rückmeldung, eingehende Nachrichten
Wix Data als Datenhaltung
```

**Warum dieser Schnitt und kein anderer:**

1. **Der Takt gehört nicht auf Wix.** Die dokumentierten Wix-Scheduler (Data Sync Jobs,
   Background Tasks) bewegen Daten nach Zeitplan; sie sind kein allgemeiner Minuten-Cron
   für beliebigen Backend-Code. Ein Publisher braucht aber eine Uhr, die auf die Minute
   feuert. Also liegt die Uhr im Konnektor.
2. **Kundentoken gehören nicht in den Secrets Manager.** Der ist siteweit, auf 3500 Zeichen
   je Eintrag begrenzt und für eine Handvoll eigener Schlüssel gedacht. Dort liegen die
   drei bis sechs App-Geheimnisse — nicht tausende rotierende Kundentoken.
3. **Alles, was der Kunde sieht, gehört auf Wix.** Anmeldung, Abrechnung, Kalender,
   Freigabe. Dort ist Wix schneller als jede Eigenentwicklung, und der Konnektor bleibt
   klein genug, um ihn zu verstehen.

Wix dokumentiert selbst-verwaltete Backends für CLI-Apps ausdrücklich. Der Schnitt ist ein
vorgesehener Weg, kein Umweg.

---

## Fachregeln, die nicht wegoptimiert werden dürfen

Diese Regeln sind das Gegenstück zu den Ton- und Bildregeln des Sitzungssystems.

**Veröffentlichung**

- **Ein Beitrag darf nie doppelt erscheinen.** Jeder Veröffentlichungsauftrag trägt einen
  Idempotenzschlüssel. Ein Wiederholungsversuch nach Zeitüberschreitung prüft erst, ob der
  Beitrag bereits draußen ist. Ein Ausfall darf Verzögerung kosten, niemals eine
  Doppelveröffentlichung.
- **Fehlgeschlagen ist ein Zustand, kein Logeintrag.** Wenn eine Zustellung scheitert, sieht
  der Kunde das in der Oberfläche mit Grund und Wiederholungsknopf. Stille Fehlschläge sind
  die häufigste Beschwerde über Werkzeuge dieser Art.
- **Wiederholung mit wachsendem Abstand**, gedeckelt. Plattformen sperren bei stumpfem
  Nachbohren die App, nicht nur den Aufruf.
- **Ein abgelaufenes Token ist ein Vorgang, kein Fehler.** Der Kunde wird vor Ablauf
  erinnert, der Kanal geht in `token_laeuft_ab`, geplante Beiträge werden nicht stillschweigend
  verworfen.

**Freigabe**

- Freigabe ist ein Staffelstab, kein Häkchen: berechtigt sind mehrere, entschieden hat genau
  eine Person, und wer wann freigegeben hat, steht fest. Übernommen aus der Sitzungsleitung.
- Ein freigegebener Beitrag, der nachträglich geändert wird, verliert die Freigabe. Ohne
  diese Regel ist der ganze Lauf wertlos.

**Mandant**

- `mandant_id` in jeder Collection, ohne Ausnahme.
- Wix Data Berechtigungen allein reichen nicht — jede Abfrage im Backend filtert zusätzlich
  auf den Mandanten des angemeldeten Members. Berechtigungen prüfen im Kern, nie in der
  Oberfläche.

---

## Datenmodell (Wix Data Collections)

Wix vergibt `_id`, `_createdDate`, `_updatedDate`, `_owner` selbst. Die folgenden Felder
kommen dazu.

| Collection | Tragende Felder |
|---|---|
| `mandant` | `name`, `plan_id`, `kanal_kontingent`, `zustand` |
| `mitgliedschaft` | `mandant_id`, `wix_member_id`, `rolle` (`inhaber`, `redaktion`, `freigabe`, `betrachter`) |
| `kanal` | `mandant_id`, `plattform`, `externe_konto_id`, `anzeigename`, `zustand`, `token_ablauf` |
| `beitrag` | `mandant_id`, `titel`, `text`, `medien[]`, `zustand`, `geplant_fuer`, `idempotenz_schluessel` |
| `beitrag_kanal` | `beitrag_id`, `kanal_id`, `zustand`, `externe_beitrag_id`, `fehlergrund` |
| `freigabe` | `beitrag_id`, `wix_member_id`, `entscheidung`, `begruendung`, `zeitpunkt` |
| `vorgang` | `mandant_id`, `kanal_id`, `art`, `externe_id`, `zustand`, `zugewiesen_an` |
| `ereignis` | `mandant_id`, `art`, `nutzlast`, `zeitpunkt` — nur anfügbar |

**Ein Beitrag, mehrere Kanäle:** `beitrag` trägt den Inhalt, `beitrag_kanal` den Zustand je
Kanal. Ohne diese Trennung kann ein Beitrag nicht auf Bluesky erscheinen und auf LinkedIn
scheitern — genau das ist aber der Normalfall.

**Zustandsketten**

- Beitrag: `entwurf → eingereicht → freigegeben → geplant → veroeffentlicht`
  Nebenwege: `abgelehnt`, `zurueckgezogen`
- Beitrag je Kanal: `wartend → zugestellt | fehlgeschlagen | uebersprungen`
- Kanal: `verbunden → token_laeuft_ab → getrennt | fehler`
- Vorgang (Inbox): `neu → zugewiesen → beantwortet | erledigt | ignoriert`

---

## Schnittstelle Wix ↔ Konnektor

Beide Richtungen laufen über HTTPS mit gegenseitiger Authentisierung.

**Wix → Konnektor.** Wix-Backend hält das Konnektor-Geheimnis im Secrets Manager und ruft
auf (nur Backend-Code, nie aus der Oberfläche):

| Aufruf | Zweck |
|---|---|
| `POST /kanal/verbinden` | startet den OAuth-Lauf, gibt Weiterleitungs-URL zurück |
| `POST /beitrag/planen` | übergibt Beitrag, Kanäle, Zeitpunkt, Idempotenzschlüssel |
| `POST /beitrag/abbrechen` | nimmt einen geplanten Beitrag aus der Warteschlange |
| `GET /kanal/zustand` | Tokenlage je Kanal eines Mandanten |

**Konnektor → Wix.** Der Konnektor hält einen Wix-API-Schlüssel und schreibt Ergebnisse
zurück in die Collections: Zustellzustand, externe Beitrags-ID, Fehlergrund, eingegangene
Vorgänge.

**Der OAuth-Lauf liegt vollständig beim Konnektor.** Der Kunde klickt auf Wix „Facebook
verbinden", wird zum Konnektor geleitet, von dort zur Plattform und zurück. Das Kundentoken
berührt die Wix-Site nie. Wix erfährt nur, dass ein Kanal verbunden ist.

---

## Kanäle nach Türsteher, nicht nach Wunsch

Die Reihenfolge folgt der Zugangshürde, nicht der Kundennachfrage. Wer mit Meta anfängt,
wartet Monate ohne Produkt.

**Stufe 1 — kein Genehmigungsverfahren. Hiermit wird gestartet.**

- **Bluesky** (AT-Protokoll, offen)
- **Mastodon** (offen)
- **Entwurf, Freigabe, Erinnerung ohne Ausspielung** — funktioniert ohne jeden
  Plattformzugang und ist bei Verwaltungskunden oft der eigentliche Schmerz
- **RSS, E-Mail, Webhook** als Ausgabewege

**Stufe 2 — Antrag läuft ab Tag eins, Freischaltung später.**

- Meta (Facebook, Instagram): Unternehmensverifizierung, App Review je Berechtigung,
  jährlicher Data Use Checkup
- LinkedIn: Marketing Developer Platform, partnergesteuert — die härteste Hürde
- YouTube: Kontingent-Erhöhung nur nach Prüfung
- TikTok: Content Posting API nur nach Audit

**Stufe 3 — nur bei belegter Nachfrage.**

- X (kostenpflichtig, für Produktnutzung im vierstelligen Bereich pro Monat)
- WhatsApp (über BSP, Abrechnung je Konversation)

Die Anträge der Stufe 2 werden am ersten Projekttag gestellt, nicht wenn Stufe 1 fertig ist.
Sie laufen Monate — diese Zeit ist die eigentliche Bauzeit.

---

## Baureihenfolge

1. Wix-Site, Selbstanmeldung, Mandant und Mitgliedschaft, Rollen
2. Beitrag, Kalender, Freigabelauf — **ohne jede Ausspielung**. Ab hier ist das Werkzeug
   vorführbar und für manche Kunden schon verkaufbar.
3. Konnektor mit Uhr und Tresor, ein einziger Adapter (Bluesky)
4. Mastodon, RSS, E-Mail
5. Inbox und Vorgänge für die Kanäle der Stufe 1
6. Meta und LinkedIn, sobald freigegeben — je ein Adapter, der Rest steht schon

**Nicht zuerst:** Analytics, KI-Textvorschläge, Mehrsprachigkeit, App-Market-Veröffentlichung.
Alles additiv.

---

## Zu prüfen, bevor gebaut wird

Diese Punkte sind aus der Wix-Doku **nicht** abschließend belegt und müssen vor der ersten
Zeile Code verifiziert werden:

- Gibt es einen allgemeinen Zeitplaner für eigenen Backend-Code auf Wix, und mit welcher
  kleinsten Auflösung? Die Architektur oben geht davon aus, dass es ihn nicht gibt, und
  legt die Uhr in den Konnektor. Wenn es ihn doch gibt, ändert das nichts Wesentliches.
- Zeitlimit einer Wix-Backend-Funktion für ausgehende Aufrufe.
- Mengengrenzen von Wix Data: Einträge je Collection, Abfragedurchsatz, Größe je Eintrag.
- Ob Pricing Plans die gewünschte Staffelung nach Kanalzahl abbilden kann oder ob dafür ein
  eigenes Kontingentfeld am Mandanten nötig ist.

---

## Offene Entscheidungen

- Produktname (》Kanalwerk《 ist Platzhalter)
- Standort des Konnektors — eigener Server oder gemieteter
- Ob der Konnektor mandantenübergreifend läuft oder je Mandant eine Instanz bekommt
- Auftragsverarbeitung und Löschkonzept, bevor der erste echte Kunde anschließt
- Erster Pilotkunde
