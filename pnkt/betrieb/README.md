# Betrieb

Vier Dateien. Zwei Wege, beide vollständig; welcher genommen wird, hängt
davon ab, ob auf der Maschine noch etwas anderes läuft.

| Datei | Wofür |
|---|---|
| `pnkt.service` | systemd, direkt auf dem Rechner |
| `Containerfile` | Podman oder Docker, zweistufig, Endabbild ohne Shell |
| `Caddyfile` | vorgelagerter Server: TLS, Kurzdomains, Landkopf |
| `sichern.sh` | Datenverzeichnis sichern und die Sicherung prüfen |

`systemd-analyze verify pnkt.service` läuft ohne Beanstandung durch.

---

## Der kurze Weg

```sh
go build -trimpath -ldflags="-s -w" -o pnkt .
sudo useradd --system --home /var/lib/pnkt --shell /usr/sbin/nologin pnkt
sudo install -d -o pnkt -g pnkt /var/lib/pnkt/daten
sudo install -o root -g root -m 0755 pnkt /opt/pnkt/pnkt
sudo install -m 0644 betrieb/pnkt.service /etc/systemd/system/
sudo systemctl enable --now pnkt
```

Davor ein Caddy, ein nginx oder was schon da ist. `pnkt` lauscht bewusst
auf `127.0.0.1` — TLS macht der vorgelagerte Server.

## Was vor dem ersten Start entschieden sein muss

Zwei Angaben lassen sich später nicht mehr folgenlos ändern:

**`-host`** steht im GS1 Digital Link, also auf gedruckten Etiketten.
Wer hier die Testadresse stehen lässt und später umzieht, hat die
Auflage in der Hand. Der endgültige Name gehört hier hin, auch wenn er
am ersten Tag noch auf nichts zeigt.

**Die Kurzdomain** bestimmt die Länge jedes gedruckten Codes. `pnkt.me/2cnjdq`
ist 19 Zeichen, `punkt.beispiel-agentur.de/2cnjdq` ist 33 — das sind bei
Stufe M zwei QR-Versionen Unterschied und damit spürbar kleinere Module
auf demselben Etikett. Kurz ist hier kein Geschmack, sondern Millimeter.

Alles andere lässt sich im laufenden Betrieb ändern.

## Der Landkopf

Die Landregel wertet einen Kopf aus, den ein vorgelagerter Server setzt.
Eine eigene Standortbestimmung findet nicht statt — dafür bräuchte es
eine IP-Datenbank, und die wäre eine Abhängigkeit mit Ablaufdatum.

Hinter Cloudflare ist das `CF-IPCountry`, die Voreinstellung. Hinter
allem anderen gibt es diesen Kopf **nicht**, und dann läuft die Landregel
still ins Leere — was erst auffällt, wenn die Kampagne schon lief.
Deshalb:

- eigener Kopf gesetzt → `-landkopf X-Land`
- keine Länderkennung verfügbar → `-landkopf ""`, dann greift die Regel
  gar nicht erst

## Sichern

```sh
sudo install -m 0755 betrieb/sichern.sh /usr/local/bin/pnkt-sichern
sudo systemd-run --on-calendar=daily --unit=pnkt-sicherung /usr/local/bin/pnkt-sichern
```

Die Dateien werden nur angehängt. Eine Kopie während des Betriebs kann
deshalb höchstens eine halb geschriebene letzte Zeile erwischen — und die
überspringt `pnkt` beim Laden. Anhalten muss man dafür nichts.

`sichern.sh` packt nicht nur, es packt auch wieder aus und zählt die
Fassungen in `codes.jsonl`. Eine Sicherung, die nie geprüft wurde, ist
keine.

## Umziehen

Binär und Datenverzeichnis kopieren, `-host` gleich lassen, fertig. Es
gibt keine Datenbank, kein Schema und keine Migration.

## Was hier bewusst fehlt

**Der Zielrechner.** Ein Einplatinenrechner reicht für die Weiterleitung;
die Massenanlage von vierhundert Codes will mehr Kerne. Welcher es wird
und ob `pnkt.me` selbst darauf zeigen soll, ist eine Entscheidung über
Geld und Verantwortung und keine technische.

Nur eines dazu: Solange das Wix-Studio unter derselben Domain erreichbar
bleiben soll, brauchen beide Seiten einen gemeinsamen vorgelagerten
Server, der nach Pfad aufteilt. `/`, `/studio` und `/zentrale` zu Wix,
`/r/`, `/01/`, `/p/` und die Kurzadressen zu `pnkt` — oder umgekehrt.
Getrennte Hostnamen sind einfacher, kosten aber Zeichen im gedruckten
Code.
