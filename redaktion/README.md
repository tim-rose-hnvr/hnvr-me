# Redaktion

Ein Plan für soziale Kanäle **und** E-Mail. Selbst betrieben.

> Stand: Kern gebaut und geprüft, Oberflächen in Arbeit. Was noch nicht steht,
> steht weiter unten unter „Was heute fehlt" — und nirgends sonst als fertig.

## Warum überhaupt

swat.io macht soziale Kanäle gut und E-Mail gar nicht. Wer beides betreibt,
führt zwei Redaktionspläne, zwei Freigabeläufe und zwei Auswertungen — und
erklärt einmal im Quartal, warum der Newsletter und der LinkedIn-Beitrag am
selben Tag dasselbe angekündigt haben, nur mit anderen Zahlen.

Der Unterschied ist nicht eine weitere Funktion, sondern eine Zusammenlegung:

| | swat.io | hier |
|---|---|---|
| Redaktionsplan | soziale Kanäle | soziale Kanäle und Newsletter in einem |
| Freigabe | für Beiträge | derselbe Lauf für Beiträge und Newsletter |
| Posteingang | Kommentare, Nachrichten | dazu Antworten auf den Newsletter |
| Betrieb | als Dienst | als Dienst **oder** auf eigenem Server |
| Alternativtext | empfohlen | Bedingung fürs Veröffentlichen |

## Aufbau

```
src/kern/     die Regeln — ohne Server, ohne Datenbank, ohne Netz prüfbar
src/pages/    die Oberflächen
test/         node --test, keine Testbibliothek
```

Der Kern kennt weder Astro noch die Datenbank. Das ist der Grund, warum jede
Regel eine Prüfung hat: sie braucht dafür nichts weiter als Node.

## Prüfen

```
npm test
```

## Regeln beim Weiterbauen

- **Deutsch, auch im Code.** Die Domäne heißt Beitrag, Freigabe, Empfänger.
- **Nichts behaupten, was nicht eingelöst ist.** Was geplant ist, steht als
  geplant da — auf der Seite und in dieser Datei.
- **Kein Fremdaufruf im Browser.** Schriften und Bilder liegen im eigenen
  Verzeichnis. Ein Werkzeug, das Einwilligungen verwaltet und dabei selbst
  Daten an ein CDN gibt, widerlegt sich beim Laden.
- **Geprüft wird im Kern.** Ein nicht angezeigter Knopf ist keine Absicherung.
