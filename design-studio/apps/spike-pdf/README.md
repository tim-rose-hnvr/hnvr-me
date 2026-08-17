# Spike: Läuft der Druckexport unter Wix?

**Die eine Frage, die dieser Spike beantwortet:** Lässt die Content-Security-Policy von
Wix die WASM-Ausführung und `OffscreenCanvas` zu, die ein clientseitiger PDF/X-Export
braucht? Fällt die Antwort negativ aus, ist die gesamte „alles im Browser"-Architektur
hinfällig und es braucht einen Renderserver — das ändert Aufwand und Betriebskosten
erheblich. Deshalb steht diese Messung vor allem anderen.

## Warum ohne Polotno

Polotno braucht eine kostenpflichtige Lizenz, deren Geltung für Mehrfach-Domain-Einbau
noch ungeklärt ist. Der Spike misst deshalb nicht Polotno, sondern die
Browser-Fähigkeiten, auf denen dessen Exportpfad aufsetzt:

| Fähigkeit | wofür |
|---|---|
| `WebAssembly.compile` / `.instantiate` | CMYK-Konvertierung |
| `OffscreenCanvas` | Transparenzen flachrechnen für PDF/X-1a |
| Canvas 2480 × 3508 | A4 bei 300 dpi |
| Schrift aus `data:`-URI | Schrifteinbettung ins PDF |

Diese vier sind Ausschlusskriterien. Worker, `unsafe-eval` und `SharedArrayBuffer`
werden mitgemessen, sind aber nur Komfort beziehungsweise dienen der Einordnung, wie
streng die CSP insgesamt ist.

## Zwei Messungen, nicht eine

Das ist der Kern und wird leicht übersehen:

1. **Custom Element** (`custom-element.js`) — läuft im **Seitenkontext** von Wix, also
   unter der CSP der Wix-Seite. **Das ist der geplante Auslieferungsweg, diese Messung
   entscheidet.**
2. **HTML-Embed** (`index.html`) — läuft im abgeschotteten iFrame auf fremder Herkunft,
   unter einer völlig anderen CSP. Nur die Vergleichsprobe.

Ein grünes Ergebnis im HTML-Embed sagt über den Custom-Element-Weg **nichts** aus. Wer
nur Variante 2 misst und daraus schließt, es gehe, baut auf Sand.

## Durchführung

**Variante 1 — Custom Element (die entscheidende):** `custom-element.js` als
Custom-Element-Extension über die Wix CLI ausliefern
([Anleitung](https://dev.wix.com/docs/build-apps/develop-your-app/develop-an-app-with-the-cli/supported-extensions/site/custom-elements/add-a-custom-element-extension-with-the-wix-cli)),
Tag-Name `studio-csp-spike`. Das Element rendert seinen Bericht selbst; zusätzlich liegt
er unter `window.spikeErgebnis` und wird als `spike-fertig`-Ereignis gemeldet.

**Variante 2 — HTML-Embed:** `index.html` in ein Wix-HTML-Element einfügen oder als
Datei hochladen und aufrufen.

Beide Male auf **Chrome, Safari und iOS-Safari** messen. Safari hinkt bei
`OffscreenCanvas` traditionell hinterher, und iPad-Nutzung ist für Marketingkunden kein
Randfall.

## Ergebnis lesen

Das Fazit steht unten auf der Seite und benennt bei Ausfall die fehlende Fähigkeit.
Die Rohdaten (`window.spikeErgebnis`) enthalten Umgebung und Einzelbefunde und gehören
ins Protokoll — mit Datum, denn Wix ändert seine CSP ohne Ankündigung.

## Wenn die Messung negativ ausfällt

Kein Grund zur Panik, aber eine Weggabelung:

- **Serverseitiges Rendern.** Der Renderer läuft in einem eigenen Dienst (headless
  Chromium), Wix liefert nur die Oberfläche. Kostet Betrieb und einen zweiten
  Auslieferungsweg, ist aber der Stand der Technik und löst das Problem endgültig.
- **Nur der Druckpfad wandert auf den Server.** Social-Export bleibt clientseitig, PDF
  geht als Auftrag raus. Der schmalste Eingriff, wenn nur WASM blockiert ist.
- **Auslieferung außerhalb von Wix.** Der Editor läuft auf eigener Domain, Wix Headless
  bleibt Backend. Ändert nichts am Code, nur am Hosting.

## Geprüft

Der Spike wurde in Chromium gegen zwei CSP-Fassungen gefahren, um sicherzugehen, dass er
überhaupt etwas misst:

- ohne CSP → alle kritischen Prüfungen bestanden, Fazit positiv
- `script-src 'self' 'unsafe-inline'` (kein `wasm-unsafe-eval`) → beide
  WebAssembly-Prüfungen fallen aus, Fazit negativ mit korrekter Begründung

Ein Spike, der immer grün meldet, ist wertlos. Dieser hier nicht.
