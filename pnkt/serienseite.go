package main

import (
	"fmt"
	"net/http"

	"pnkt.me/pnkt/bogen"
	"pnkt.me/pnkt/gestalt"
)

// serienseite ist der Assistent aus dem Entwurf: Tabelle, Zuordnung,
// Muster, Vorschau, Bogen.
//
// Die Reihenfolge auf der Seite ist die Reihenfolge der Arbeit, und die
// Vorschau steht zwischen Eingabe und Erzeugen — nicht daneben. Wer sie
// ueberspringen kann, ueberspringt sie, und dann liegen 400 Kuerzel in
// der Ablage, die auf „{Tsich}" zeigen.
func (d *dienst) serienseite(w http.ResponseWriter, r *http.Request) {
	m := d.ablage.MarkeNachHost(r.Host)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy",
		"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; "+
			"font-src 'self'; img-src 'self' data: blob:")

	var blaetter string
	for i, b := range bogen.Blattliste {
		gewaehlt := ""
		if i == 0 {
			gewaehlt = " selected"
		}
		blaetter += fmt.Sprintf(`<option value="%s"%s>%s — %.0f × %.0f mm</option>`,
			b.Schluessel, gewaehlt, b.Name, b.BreiteMm, b.HoeheMm)
	}

	fmt.Fprintf(w, serienSeite, m.Name, gestalt.Kopf(),
		m.Grund, m.Tinte, m.Primaer, gestalt.MarkeLockup(m.Name, "/", false),
		blaetter, gestalt.IconJS())
}

const serienSeite = `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Serie · %s</title>
%s
<style>
:root{--color-bg:%s;--color-text:%s;--color-accent:%s;
 --leise:color-mix(in srgb,var(--color-text) 62%%,transparent);
 --linie:color-mix(in srgb,var(--color-text) 12%%,transparent)}
body{background:var(--color-bg);color:var(--color-text);
 font-family:var(--font-body);font-size:15px;line-height:1.55}
h1{font-family:var(--font-heading);font-size:1.5rem;letter-spacing:-.02em;margin:0}
h2{font-family:var(--font-heading);font-size:1.05rem;margin:0}
.anriss{color:var(--leise);font-size:.92rem;margin:.25rem 0 1.5rem}
.anriss a{color:var(--color-accent-700)}
.raster{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);
 gap:1.1rem;align-items:start}
@media(max-width:1000px){.raster{grid-template-columns:1fr}}
label{display:flex;flex-direction:column;gap:.3rem;font-size:.72rem;font-weight:600;
 letter-spacing:.04em;text-transform:uppercase;color:var(--leise)}
input,select,textarea{font:inherit;font-size:.9rem;padding:.55rem .7rem;
 border:1px solid color-mix(in srgb,var(--color-text) 22%%,transparent);
 border-radius:var(--radius-md);background:var(--color-bg);color:var(--color-text);
 width:100%%;min-width:0;text-transform:none;letter-spacing:normal;font-weight:400}
input:focus-visible,select:focus-visible,textarea:focus-visible{border-color:var(--color-accent)}
textarea{resize:vertical;min-height:7rem;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;
 font-size:.82rem;line-height:1.5}
.reihe{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}
.reihe3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.55rem}
@media(max-width:640px){.reihe,.reihe3{grid-template-columns:1fr}}
.knoepfe{display:flex;flex-wrap:wrap;gap:.45rem}
button.knopf,a.knopf{display:inline-flex;align-items:center;gap:.45rem;font:inherit;
 font-size:.85rem;font-weight:600;text-decoration:none;padding:.55rem .95rem;
 border:1px solid color-mix(in srgb,var(--color-text) 14%%,transparent);
 border-radius:999px;color:var(--color-text);background:var(--color-bg);cursor:pointer}
button.knopf:hover,a.knopf:hover{border-color:var(--color-accent)}
button.knopf.stark{background:var(--color-accent);color:var(--color-bg);
 border-color:var(--color-accent)}
button.knopf.stark:hover{background:var(--color-accent-600);border-color:var(--color-accent-600)}
button.knopf[disabled]{opacity:.45;cursor:not-allowed}
button.knopf[disabled]:hover{border-color:color-mix(in srgb,var(--color-text) 14%%,transparent)}
.hinweis{font-size:.8rem;color:var(--leise);border-left:2px solid var(--linie);
 padding-left:.85rem;margin:0}
table{width:100%%;border-collapse:collapse;font-size:.85rem}
th{text-align:left;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;
 color:var(--leise);font-weight:600;padding:.5rem .7rem;border-bottom:1px solid var(--linie)}
td{padding:.5rem .7rem;border-bottom:1px solid var(--linie);vertical-align:top}
tr:last-child td{border-bottom:none}
td.nr{color:var(--leise);font-variant-numeric:tabular-nums;width:3rem}
td.ziel{overflow-wrap:anywhere}
tr.krumm td{background:color-mix(in srgb,#a82e23 8%%,transparent)}
.fehlertext{color:#a82e23;font-size:.8rem}
.urteil{display:inline-flex;gap:.5rem;align-items:center;font-size:.72rem;
 font-weight:700;letter-spacing:.1em;text-transform:uppercase;
 padding:.4rem .8rem;border-radius:999px}
.u-gut{color:var(--color-accent-2-700);background:var(--color-accent-2-100)}
.u-schlecht{color:#a82e23;background:#f7e7e5}
.befund{font-size:.85rem;padding-left:.85rem;
 border-left:2px solid var(--color-accent-2);color:var(--leise)}
.befund b{color:var(--color-text);font-weight:600;display:block}
.befund.warnung{border-color:var(--color-accent)}
.befund.fehler{border-color:#a82e23}
.zahlen{display:flex;flex-wrap:wrap;gap:.3rem 1.1rem;font-size:.78rem;color:var(--leise)}
.zahlen b{color:var(--color-text);font-variant-numeric:tabular-nums}
.spalte{display:inline-flex;align-items:center;gap:.3rem;font-size:.78rem;
 background:var(--color-bg);border-radius:999px;padding:.25rem .7rem;cursor:pointer;
 border:1px solid transparent}
.spalte:hover{border-color:var(--color-accent)}
.spalten{display:flex;flex-wrap:wrap;gap:.35rem}
.blattbild{background:var(--color-bg);border-radius:var(--radius-md);padding:14px;
 display:grid;place-items:center}
.blattbild .blatt{background:#fff;box-shadow:0 6px 22px color-mix(in srgb,#2e2b25 18%%,transparent);
 display:grid;gap:2px;padding:6px;border-radius:2px}
.blattbild .fach{background:var(--color-surface);border-radius:2px}
.meldung{font-size:.85rem;padding:.6rem .8rem;border-radius:var(--radius-md)}
.meldung.schlecht{color:#a82e23;background:#f7e7e5}
.meldung.gut{color:var(--color-accent-2-700);background:var(--color-accent-2-100)}
[hidden]{display:none!important}
</style>

<a href="#inhalt" class="ueberspringen">Zum Inhalt</a>
<header class="werkkopf">
  <div class="werkkopf-innen">
    %s
    <nav class="werkwege" aria-label="Bereiche">
      <a class="werkweg" href="/">Studio</a>
      <a class="werkweg" href="/zentrale">Zentrale</a>
      <a class="werkweg" href="/landeseite">Landeseite</a>
      <a class="werkweg werkweg-aktiv" href="/serie" aria-current="page">Serie</a>
      <a class="werkweg" href="/zahlen">Zahlen</a>
    </nav>
  </div>
</header>

<main id="inhalt" class="spur">
  <h1>Serie</h1>
  <p class="anriss">Eine Tabelle hinein, ein Druckbogen heraus. Erst die Vorschau,
    dann das Erzeugen — ein vertipptes Muster darf keine vierhundert Codes kosten.</p>

  <div class="raster">
    <div style="display:flex;flex-direction:column;gap:1.1rem">
      <div class="tafel">
        <div class="tafel-kopf"><span>1 · Tabelle</span><span id="tabellenstand"></span></div>
        <div class="tafel-koerper">
          <label>Schlüssel
            <input id="schluessel" type="password" placeholder="x-punkt-schluessel"
                   autocomplete="off"></label>
          <div class="knoepfe">
            <input id="datei" type="file" accept=".csv,text/csv" style="display:none">
            <button class="knopf" type="button" id="waehlen">CSV wählen</button>
            <button class="knopf" type="button" id="beispiel">Beispiel einsetzen</button>
          </div>
          <label>Inhalt der Tabelle
            <textarea id="csv" spellcheck="false"
              placeholder="Tisch,Bereich&#10;1,Innen&#10;2,Terrasse"></textarea></label>
          <div id="spalten" class="spalten"></div>
          <p class="hinweis">Komma oder Semikolon, beides geht. Die erste Zeile ist die
            Kopfzeile. Ein Klick auf einen Spaltennamen setzt ihn ins Muster.</p>
        </div>
      </div>

      <div class="tafel">
        <div class="tafel-kopf"><span>2 · Ziel</span></div>
        <div class="tafel-koerper">
          <label>Muster
            <input id="muster" value="https://example.de/tisch/{Tisch}"></label>
          <p class="hinweis">Was in geschweiften Klammern steht, kommt aus der Tabelle.
            Umlaute und Leerzeichen werden vereinfacht: „Terrasse Süd" wird
            „terrasse-sued".</p>
          <div class="reihe3">
            <label>Beschriftung aus<select id="namespalte"><option value="">— keine —</option></select></label>
            <label>GTIN aus<select id="gtinspalte"><option value="">— keine —</option></select></label>
            <label>Ordner<input id="ordner" placeholder="etwa Sommer 2026"></label>
          </div>
        </div>
      </div>

      <div class="tafel">
        <div class="tafel-kopf"><span>3 · Druck</span></div>
        <div class="tafel-koerper">
          <div class="reihe3">
            <label>Breite in mm<input id="breite" type="number" value="40" min="5" max="300"></label>
            <label>Fehlerkorrektur<select id="stufe">
              <option value="L">L — 7 %%</option><option value="M" selected>M — 15 %%</option>
              <option value="Q">Q — 25 %%</option><option value="H">H — 30 %%</option>
            </select></label>
            <label>Verfahren<select id="verfahren">
              <option value="bildschirm">Nur Bildschirm</option>
              <option value="laser">Laser oder Tinte</option>
              <option value="offset" selected>Offsetdruck</option>
              <option value="grossformat">Großformat</option>
              <option value="gravur">Gravur, Textil</option>
            </select></label>
          </div>
          <div class="reihe3">
            <label>Bogen<select id="blatt">%s</select></label>
            <label>Anschnitt in mm<input id="anschnitt" type="number" value="3" min="0" max="10" step="0.5"></label>
            <label>Steg in mm<input id="abstand" type="number" value="4" min="0" max="30" step="0.5"></label>
          </div>
          <label style="flex-direction:row;align-items:center;gap:.5rem;text-transform:none;
                        font-size:.85rem;font-weight:400;color:var(--color-text)">
            <input type="checkbox" id="marken" checked style="width:auto"> Schnittmarken setzen
          </label>
          <p class="hinweis">Die Marken stehen in der Passerfarbe „All" — sie erscheinen
            damit in jedem Farbauszug. Schwarz allein läge nur im K-Auszug.</p>
        </div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:1.1rem;position:sticky;top:1rem">
      <div class="tafel">
        <div class="tafel-kopf"><span>Vorschau</span><span id="vorschaustand"></span></div>
        <div class="tafel-koerper">
          <div id="meldung"></div>
          <div id="bogenbild"></div>
          <div class="zahlen" id="bogenzahlen"></div>
          <div id="urteil"></div>
          <div id="befunde" style="display:flex;flex-direction:column;gap:.5rem"></div>
          <div class="knoepfe">
            <button class="knopf" type="button" id="pruefen">Vorschau rechnen</button>
            <button class="knopf stark" type="button" id="erzeugen" disabled>
              Codes anlegen und Bogen holen</button>
          </div>
          <p class="hinweis">Erzeugen legt die Codes wirklich an. Vorher passiert nichts —
            die Vorschau schreibt keine Zeile.</p>
        </div>
      </div>

      <div class="tafel">
        <div class="tafel-kopf"><span>Zeilen</span><span id="zeilenstand"></span></div>
        <div id="zeilen"></div>
      </div>
    </div>
  </div>
</main>

<script>
const e = (id) => document.getElementById(id);
%s

const BEISPIEL = "Tisch,Bereich\n1,Innen\n2,Innen\n3,Innen\n4,Terrasse Süd\n" +
  "5,Terrasse Süd\n6,Terrasse Süd\n7,Empore\n8,Empore\n";

let letzteVorschau = null;

// --- Tabelle -------------------------------------------------------------
e("waehlen").addEventListener("click", () => e("datei").click());
e("datei").addEventListener("change", async () => {
  const f = e("datei").files[0];
  if (!f) return;
  e("csv").value = await f.text();
  kopfzeileLesen();
});
e("beispiel").addEventListener("click", () => {
  e("csv").value = BEISPIEL;
  kopfzeileLesen();
});
e("csv").addEventListener("input", kopfzeileLesen);

// Die Kopfzeile wird im Browser gelesen, nicht am Server: der Server
// bekaeme sonst bei jedem Tastendruck eine Anfrage, und die Spaltenliste
// ist eine Zeile Text.
function kopfzeileLesen() {
  const text = e("csv").value.trim();
  if (!text) { e("spalten").innerHTML = ""; e("tabellenstand").textContent = ""; return; }
  const zeilen = text.split(/\r?\n/).filter(z => z.trim() !== "");
  const trenner = (zeilen[0].split(";").length > zeilen[0].split(",").length) ? ";" : ",";
  const spalten = zeilen[0].split(trenner).map(s => s.trim().replace(/^"|"$/g, ""));

  e("tabellenstand").textContent = (zeilen.length - 1) + " Zeilen · " + spalten.length + " Spalten";
  e("spalten").innerHTML = spalten.map(s =>
    '<button type="button" class="spalte" data-spalte="' + entschaerft(s) + '">' +
    icon("weiter", 13) + entschaerft(s) + "</button>").join("");

  for (const feld of ["namespalte", "gtinspalte"]) {
    const alt = e(feld).value;
    e(feld).innerHTML = '<option value="">— keine —</option>' +
      spalten.map(s => '<option value="' + entschaerft(s) + '">' + entschaerft(s) + "</option>").join("");
    if (spalten.includes(alt)) e(feld).value = alt;
  }
}

e("spalten").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  const feld = e("muster");
  const einsatz = "{" + b.dataset.spalte + "}";
  const p = feld.selectionStart ?? feld.value.length;
  feld.value = feld.value.slice(0, p) + einsatz + feld.value.slice(feld.selectionEnd ?? p);
  feld.focus();
  feld.selectionStart = feld.selectionEnd = p + einsatz.length;
});

function entschaerft(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// --- Anfrage -------------------------------------------------------------
function frage() {
  const p = new URLSearchParams({
    muster: e("muster").value,
    namespalte: e("namespalte").value,
    gtinspalte: e("gtinspalte").value,
    ordner: e("ordner").value,
    breite: e("breite").value,
    stufe: e("stufe").value,
    verfahren: e("verfahren").value,
    blatt: e("blatt").value,
    anschnitt: e("anschnitt").value,
    abstand: e("abstand").value,
    marken: e("marken").checked ? "1" : "0",
    // Die Seite legt immer an — und deshalb muss auch die Vorschau
    // damit rechnen. Gedruckt wird dann der Kurzweg, nicht das Ziel;
    // wer das Ziel misst, beurteilt einen Code, den es nie gibt.
    anlegen: "1",
  });
  return p.toString();
}

function melden(text, art) {
  e("meldung").innerHTML = text
    ? '<div class="meldung ' + art + '">' + entschaerft(text) + "</div>" : "";
}

e("pruefen").addEventListener("click", async () => {
  const schluessel = e("schluessel").value.trim();
  if (!schluessel) { melden("Ohne Schlüssel geht es nicht.", "schlecht"); return; }
  if (!e("csv").value.trim()) { melden("Erst eine Tabelle.", "schlecht"); return; }

  e("pruefen").disabled = true;
  try {
    const a = await fetch("/api/v1/serie/vorschau?" + frage(), {
      method: "POST",
      headers: {"x-punkt-schluessel": schluessel, "Content-Type": "text/csv"},
      body: e("csv").value,
    });
    const d = await a.json();
    if (!a.ok) { melden(d.fehler || ("Fehler " + a.status), "schlecht"); leerVorschau(); return; }
    letzteVorschau = d;
    vorschauZeigen(d);
  } catch (err) {
    melden("Der Server antwortet nicht: " + err.message, "schlecht");
  } finally {
    e("pruefen").disabled = false;
  }
});

function leerVorschau() {
  letzteVorschau = null;
  e("erzeugen").disabled = true;
  e("bogenbild").innerHTML = "";
  e("bogenzahlen").innerHTML = "";
  e("urteil").innerHTML = "";
  e("befunde").innerHTML = "";
  e("zeilen").innerHTML = "";
  e("zeilenstand").textContent = "";
  e("vorschaustand").textContent = "";
}

function vorschauZeigen(d) {
  const krumm = (d.posten || []).filter(p => p.Fehler).length;
  melden(krumm
    ? krumm + " von " + (d.posten || []).length + " Zeilen sind noch krumm."
    : (d.brauchbar || 0) + " Zeilen sind in Ordnung.", krumm ? "schlecht" : "gut");

  e("vorschaustand").textContent = (d.brauchbar || 0) + " von " + (d.zeilen || 0);

  // Doppelte Ziele sind kein Zeilenfehler, aber der teuerste Fehler
  // ueberhaupt: zwei Tische, die man in den Zahlen nie auseinanderhaelt.
  const dopp = d.doppelteZiele || {};
  const doppelt = Object.keys(dopp);
  if (doppelt.length) {
    e("meldung").innerHTML += '<div class="meldung schlecht" style="margin-top:.5rem">' +
      doppelt.length + " Ziel(e) kommen mehrfach vor, etwa " + entschaerft(doppelt[0]) +
      " in den Zeilen " + dopp[doppelt[0]].join(", ") + ".</div>";
  }

  if (d.bogenFehler) {
    e("bogenbild").innerHTML = "";
    e("bogenzahlen").innerHTML = '<span class="fehlertext">' +
      entschaerft(d.bogenFehler) + "</span>";
  } else if (d.bogen) {
    e("bogenzahlen").innerHTML =
      "<span>" + d.bogen.blatt + "</span>" +
      "<span>Raster <b>" + d.bogen.spalten + " × " + d.bogen.reihen + "</b></span>" +
      "<span>je Bogen <b>" + d.bogen.proBogen + "</b></span>" +
      "<span>Bogen <b>" + d.bogen.anzahl + "</b></span>";
    e("bogenbild").innerHTML = blattBild(d.bogen, d.brauchbar || 0);
  }

  if (d.urteil) {
    const gut = d.urteil.druckreif;
    e("urteil").innerHTML = '<span class="urteil ' + (gut ? "u-gut" : "u-schlecht") + '">' +
      icon(gut ? "geprueft" : "warnung", 14) +
      (gut ? "druckreif" : "so nicht drucken") + " · Note " + d.urteil.note + "</span>";
    e("befunde").innerHTML = (d.urteil.befunde || []).map(b =>
      '<div class="befund ' + (b.schwere || "") + '"><b>' + entschaerft(b.text) + "</b>" +
      entschaerft(b.rat || "") + "</div>").join("");
  } else {
    e("urteil").innerHTML = "";
    e("befunde").innerHTML = "";
  }

  const posten = d.posten || [];
  e("zeilenstand").textContent = posten.length + " Zeilen";
  e("zeilen").innerHTML = "<table><thead><tr><th>Zeile</th><th>Beschriftung</th>" +
    "<th>Ziel</th></tr></thead><tbody>" +
    posten.map(p => '<tr class="' + (p.Fehler ? "krumm" : "") + '">' +
      '<td class="nr">' + p.Nr + "</td>" +
      "<td>" + entschaerft(p.Name || "—") + "</td>" +
      '<td class="ziel">' + (p.Fehler
        ? '<span class="fehlertext">' + entschaerft(p.Fehler) + "</span>"
        : entschaerft(p.Ziel)) + "</td></tr>").join("") +
    "</tbody></table>";

  e("erzeugen").disabled = !d.brauchbar || !!d.bogenFehler;
}

// Das Blattbild zeigt das Raster, nicht die Codes: es geht um die Frage
// „geht das auf?", und ein Raster beantwortet sie schneller als 24
// winzige Quadrate.
function blattBild(b, wieviele) {
  const proBogen = Math.min(wieviele, b.proBogen);
  const breit = Math.min(180, 26 * b.spalten);
  const zelle = Math.floor(breit / b.spalten) - 2;
  let felder = "";
  for (let i = 0; i < b.spalten * b.reihen; i++) {
    const voll = i < proBogen;
    felder += '<div class="fach" style="width:' + zelle + "px;height:" + zelle + "px;opacity:" +
      (voll ? "1" : ".25") + '"></div>';
  }
  return '<div class="blattbild"><div class="blatt" style="grid-template-columns:repeat(' +
    b.spalten + ",1fr)\">" + felder + "</div></div>";
}

// --- Erzeugen ------------------------------------------------------------
e("erzeugen").addEventListener("click", async () => {
  const schluessel = e("schluessel").value.trim();
  if (!schluessel || !letzteVorschau) return;
  const wieviele = letzteVorschau.brauchbar || 0;
  if (!confirm(wieviele + " Codes werden wirklich angelegt. Weiter?")) return;

  e("erzeugen").disabled = true;
  const alt = e("erzeugen").textContent;
  // Der Ring dreht, solange der Server das Paket baut. Bei vierhundert
  // Codes dauert das mehrere Sekunden, und ein Knopf, der nur den Text
  // wechselt, sieht in dieser Zeit aus wie ein haengender Knopf.
  e("erzeugen").innerHTML = '<span class="laeuft"></span>wird erzeugt …';
  try {
    const a = await fetch("/api/v1/serie?" + frage(), {
      method: "POST",
      headers: {"x-punkt-schluessel": schluessel, "Content-Type": "text/csv"},
      body: e("csv").value,
    });
    if (!a.ok) {
      let text = "Fehler " + a.status;
      try { text = (await a.json()).fehler || text; } catch (_) {}
      melden(text, "schlecht");
      return;
    }
    const blob = await a.blob();
    const weg = URL.createObjectURL(blob);
    const anker = document.createElement("a");
    anker.href = weg;
    anker.download = "pnkt-serie.zip";
    anker.click();
    URL.revokeObjectURL(weg);
    melden(wieviele + " Codes angelegt, das Paket liegt in den Downloads. " +
      "Sie stehen ab jetzt in der Zentrale.", "gut");
  } catch (err) {
    melden("Der Server antwortet nicht: " + err.message, "schlecht");
  } finally {
    e("erzeugen").textContent = alt;
  }
});

// Aenderungen an Ziel oder Druck machen die Vorschau ungueltig. Ein
// Knopf, der noch von der vorigen Rechnung freigeschaltet ist, erzeugt
// sonst etwas anderes als das, was danebensteht.
for (const id of ["muster", "namespalte", "gtinspalte", "ordner", "breite", "stufe",
                  "verfahren", "blatt", "anschnitt", "abstand", "marken", "csv"]) {
  e(id).addEventListener("input", () => { e("erzeugen").disabled = true; });
  e(id).addEventListener("change", () => { e("erzeugen").disabled = true; });
}
</script>
`
