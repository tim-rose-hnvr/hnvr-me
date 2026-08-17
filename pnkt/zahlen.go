package main

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"pnkt.me/pnkt/gestalt"
	"pnkt.me/pnkt/speicher"
)

// Die Zahlen sind der Ort, an dem aus Zaehlern eine Aussage wird.
//
// Der Entwurf stellt einen Satz an den Anfang und die Diagramme
// darunter — und das ist keine Geschmacksfrage. Wer eine Zahlenwand
// aufschlaegt, sucht zuerst nach dem, was sie bedeutet. Steht der Satz
// nicht da, denkt sich jeder seinen eigenen aus.
//
// Der Satz wird im Speicher geschrieben, nicht hier: dieselbe Aussage
// soll aus der Schnittstelle kommen wie von der Seite. Zwei Fassungen
// laufen auseinander.

// zahlenDaten liefert die Uebersicht als JSON.
func (d *dienst) zahlenDaten(w http.ResponseWriter, r *http.Request, sch *speicher.Schluessel) {
	tage := int(zahl(r.URL.Query().Get("tage"), 30))
	// Ein Zeitraum ohne Grenze waere eine Einladung, versehentlich die
	// ganze Ablage durchzurechnen. Zehn Jahre reichen fuer „Alles".
	if tage < 1 {
		tage = 1
	}
	if tage > 3650 {
		tage = 3650
	}
	bis := time.Now().UTC()
	von := bis.AddDate(0, 0, -(tage - 1))
	d.jsonAus(w, http.StatusOK, d.ablage.Uebersicht(d.ablage.OrgVon(sch), von, bis))
}

func (d *dienst) zahlenseite(w http.ResponseWriter, r *http.Request) {
	m := d.ablage.MarkeNachHost(r.Host)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy",
		"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; "+
			"font-src 'self'; img-src 'self' data:")
	fmt.Fprintf(w, zahlenSeite, m.Name, gestalt.Kopf(),
		m.Grund, m.Tinte, m.Primaer, gestalt.MarkeLockup(m.Name, "/", false),
		strconv.Itoa(speicher.MindestScansFuerZeitaussage),
		strconv.Itoa(speicher.MindestScansFuerRate))
}

const zahlenSeite = `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zahlen · %s</title>
%s
<style>
:root{--color-bg:%s;--color-text:%s;--color-accent:%s;
 --leise:color-mix(in srgb,var(--color-text) 62%%,transparent);
 --linie:color-mix(in srgb,var(--color-text) 12%%,transparent)}
body{background:var(--color-bg);color:var(--color-text);
 font-family:var(--font-body);font-size:15px;line-height:1.55}
h1{font-family:var(--font-heading);font-size:1.5rem;letter-spacing:-.02em;margin:0}
.anriss{color:var(--leise);font-size:.92rem;margin:.25rem 0 1.5rem}
.anriss a{color:var(--color-accent-700)}
label{display:flex;flex-direction:column;gap:.3rem;font-size:.72rem;font-weight:600;
 letter-spacing:.04em;text-transform:uppercase;color:var(--leise)}
input{font:inherit;font-size:.9rem;padding:.55rem .7rem;
 border:1px solid color-mix(in srgb,var(--color-text) 22%%,transparent);
 border-radius:var(--radius-md);background:var(--color-bg);color:var(--color-text);
 width:100%%;text-transform:none;letter-spacing:normal;font-weight:400}
input:focus-visible{border-color:var(--color-accent)}
/* Der Satz. Er traegt die Seite und steht deshalb in der Schrift der
   Ueberschriften, nicht in der des Fliesstexts. */
.satz{font-family:var(--font-heading);font-size:1.55rem;line-height:1.25;
 letter-spacing:-.015em;margin:0}
@media(max-width:640px){.satz{font-size:1.2rem}}
.kacheln{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.7rem}
.kachel{background:var(--color-bg);border-radius:var(--radius-lg);padding:14px 16px}
.kachel .wert{font-family:var(--font-heading);font-size:1.6rem;line-height:1.1;
 font-variant-numeric:tabular-nums}
.kachel .was{font-size:.72rem;letter-spacing:.05em;text-transform:uppercase;color:var(--leise)}
.zeitraum{display:flex;flex-wrap:wrap;gap:.3rem}
.zeitraum button{font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;
 background:none;border:1px solid transparent;border-radius:999px;padding:.35rem .8rem;
 color:var(--leise)}
.zeitraum button[aria-pressed=true]{background:var(--color-accent);color:var(--color-bg)}
.zeitraum button:hover{color:var(--color-text)}
.zeitraum button[aria-pressed=true]:hover{color:var(--color-bg)}
/* Der Verlauf: ein Balken je Tag, gleich breit. Eine Kurve waere
   huebscher und wuerde zwischen zwei Tagen Werte behaupten, die es
   nicht gibt. */
.verlauf{display:flex;align-items:flex-end;gap:2px;height:150px;padding:0 2px}
.verlauf .tag{flex:1;min-width:2px;background:var(--color-accent);border-radius:3px 3px 0 0;
 position:relative}
.verlauf .tag.leer{background:color-mix(in srgb,var(--color-text) 8%%,transparent);
 border-radius:3px}
.verlauf .tag:hover{background:var(--color-accent-700)}
.achse{display:flex;justify-content:space-between;font-size:.72rem;color:var(--leise);
 padding-top:.4rem}
/* Die Strecke: zwei Stufen, nebeneinander, mit der Rate dazwischen.
   Ein Trichter waere huebscher und wuerde eine Verjuengung zeigen, die
   aus zwei Zahlen nicht abzulesen ist. */
.strecke{display:flex;align-items:stretch;gap:.6rem;flex-wrap:wrap}
.stufe{flex:1;min-width:9rem;background:var(--color-bg);border-radius:var(--radius-lg);
 padding:14px 16px}
.stufe .wert{font-family:var(--font-heading);font-size:1.5rem;line-height:1.1;
 font-variant-numeric:tabular-nums}
.stufe .was{font-size:.72rem;letter-spacing:.05em;text-transform:uppercase;color:var(--leise)}
.stufe .dazu{font-size:.8rem;color:var(--leise);margin-top:.3rem}
.rate{display:grid;place-items:center;padding:0 .4rem;font-weight:700;
 color:var(--color-accent-700);font-variant-numeric:tabular-nums}
.riegel{display:flex;flex-direction:column;gap:.5rem}
.riegel .zeile{display:grid;grid-template-columns:7.5rem 1fr 3.5rem;gap:.6rem;
 align-items:center;font-size:.85rem}
.riegel .balken{height:10px;border-radius:999px;
 background:color-mix(in srgb,var(--color-text) 8%%,transparent);overflow:hidden}
.riegel .balken i{display:block;height:100%%;background:var(--color-accent-2);border-radius:999px}
.riegel .n{text-align:right;font-variant-numeric:tabular-nums;color:var(--leise)}
.riegel .art{color:var(--leise);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
table{width:100%%;border-collapse:collapse;font-size:.88rem}
th{text-align:left;font-size:.68rem;letter-spacing:.06em;text-transform:uppercase;
 color:var(--leise);font-weight:600;padding:.55rem .8rem;border-bottom:1px solid var(--linie)}
td{padding:.55rem .8rem;border-bottom:1px solid var(--linie);vertical-align:top}
tr:last-child td{border-bottom:none}
td.n{text-align:right;font-variant-numeric:tabular-nums}
td.ziel{color:var(--leise);overflow-wrap:anywhere;max-width:22rem}
.stumm{font-size:.72rem;letter-spacing:.05em;text-transform:uppercase;
 color:var(--leise);background:color-mix(in srgb,var(--color-text) 7%%,transparent);
 border-radius:999px;padding:.15rem .55rem}
.hinweis{font-size:.8rem;color:var(--leise);border-left:2px solid var(--linie);
 padding-left:.85rem;margin:0}
.meldung{font-size:.85rem;padding:.6rem .8rem;border-radius:var(--radius-md);
 color:#a82e23;background:#f7e7e5}
.leer{color:var(--leise);font-size:.9rem;padding:1.2rem 0;text-align:center}
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
      <a class="werkweg" href="/serie">Serie</a>
      <a class="werkweg werkweg-aktiv" href="/zahlen" aria-current="page">Zahlen</a>
    </nav>
  </div>
</header>

<main id="inhalt" class="spur">
  <h1>Zahlen</h1>
  <p class="anriss">Was gescannt wurde, wann und womit. Gezählt wird in Klassen und je Tag —
    nie je Person. Was hier nicht steht, wurde nie aufgezeichnet.</p>

  <div class="tafel">
    <div class="tafel-kopf"><span>Zugang</span><span id="zeitraumtext"></span></div>
    <div class="tafel-koerper">
      <label>Schlüssel
        <input id="schluessel" type="password" placeholder="x-punkt-schluessel"
               autocomplete="off"></label>
      <div class="zeitraum" id="zeitraum">
        <button type="button" data-tage="7">7 Tage</button>
        <button type="button" data-tage="30" aria-pressed="true">30 Tage</button>
        <button type="button" data-tage="90">90 Tage</button>
        <button type="button" data-tage="3650">Alles</button>
      </div>
      <div id="meldung"></div>
    </div>
  </div>

  <div class="tafel" id="satzfeld" style="margin-top:1.1rem" hidden>
    <div class="tafel-koerper">
      <p class="satz" id="satz"></p>
      <p class="hinweis" id="zeithinweis" hidden></p>
      <div class="kacheln" id="kacheln"></div>
    </div>
  </div>

  <div class="tafel" id="streckefeld" style="margin-top:1.1rem" hidden>
    <div class="tafel-kopf"><span>Strecke</span><span id="streckestand"></span></div>
    <div class="tafel-koerper">
      <div class="strecke" id="strecke"></div>
      <p class="hinweis" id="streckehinweis"></p>
    </div>
  </div>

  <div class="tafel" id="verlauffeld" style="margin-top:1.1rem" hidden>
    <div class="tafel-kopf"><span>Verlauf</span><span id="verlaufstand"></span></div>
    <div class="tafel-koerper">
      <div class="verlauf" id="verlauf"></div>
      <div class="achse" id="achse"></div>
    </div>
  </div>

  <div class="tafel" id="klassenfeld" style="margin-top:1.1rem" hidden>
    <div class="tafel-kopf"><span>Wer und womit</span></div>
    <div class="tafel-koerper" id="klassen"></div>
  </div>

  <div class="tafel" id="codefeld" style="margin-top:1.1rem" hidden>
    <div class="tafel-kopf"><span>Codes</span><span id="codestand"></span></div>
    <div id="codes"></div>
  </div>
</main>

<script>
const e = (id) => document.getElementById(id);

// Die Schwelle kommt aus dem Speicher, nicht aus dieser Datei: unter ihr
// nennt der Satz keine beste Zeit, und die Seite soll denselben Wert
// zeigen, nach dem der Server entscheidet.
const MINDEST = %s;
const MINDESTRATE = %s;
let tage = 30;
let holen = null;

const ARTNAMEN = {geraet: "Gerät", system: "System", sprache: "Sprache", quelle: "Herkunft"};

function entschaerft(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

e("zeitraum").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  tage = Number(b.dataset.tage);
  [...e("zeitraum").children].forEach(x => x.setAttribute("aria-pressed", x === b));
  laden();
});

e("schluessel").addEventListener("input", () => {
  // Bei jedem Tastendruck eine Anfrage waere Unsinn; ein Schluessel
  // wird eingefuegt, nicht getippt.
  clearTimeout(holen);
  holen = setTimeout(laden, 400);
});

async function laden() {
  const k = e("schluessel").value.trim();
  if (!k) { e("meldung").innerHTML = ""; verbergen(); return; }
  try {
    const a = await fetch("/api/v1/zahlen?tage=" + tage, {headers: {"x-punkt-schluessel": k}});
    const d = await a.json();
    if (!a.ok) {
      e("meldung").innerHTML = '<div class="meldung">' +
        entschaerft(d.fehler || ("Fehler " + a.status)) + "</div>";
      verbergen();
      return;
    }
    e("meldung").innerHTML = "";
    zeigen(d);
  } catch (err) {
    e("meldung").innerHTML = '<div class="meldung">Der Server antwortet nicht: ' +
      entschaerft(err.message) + "</div>";
    verbergen();
  }
}

function verbergen() {
  for (const id of ["satzfeld", "streckefeld", "verlauffeld", "klassenfeld", "codefeld"])
    e(id).hidden = true;
}

function zeigen(d) {
  for (const id of ["satzfeld", "verlauffeld", "klassenfeld", "codefeld"]) e(id).hidden = false;
  strecke(d);
  e("zeitraumtext").textContent = d.von + " bis " + d.bis;
  e("satz").textContent = d.aussage;

  // Warum keine beste Zeit dasteht, gehoert daneben. Sonst sucht
  // jemand den Satz, den er beim Nachbarn gesehen hat, und haelt sein
  // Fehlen fuer einen Fehler.
  e("zeithinweis").hidden = d.gesamt === 0 || d.gesamt >= MINDEST;
  e("zeithinweis").textContent = "Unter " + MINDEST + " Scans wird keine beste Zeit " +
    "genannt: bei so wenigen Scans ist die Spitze Zufall, und sie sieht genauso aus " +
    "wie ein Ergebnis.";

  const proTag = d.tage.length ? (d.gesamt / d.tage.length) : 0;
  e("kacheln").innerHTML =
    kachel(zahlDeutsch(d.gesamt), "Scans") +
    kachel(proTag.toFixed(proTag < 10 ? 1 : 0), "je Tag") +
    kachel(zahlDeutsch(d.codesGesamt), "Codes") +
    kachel(zahlDeutsch(d.codesStumm), "davon ohne Scan");

  // --- Verlauf ---
  const hoechst = Math.max(1, ...d.tage.map(t => t.scans));
  e("verlauf").innerHTML = d.tage.map(t => {
    const anteil = t.scans / hoechst;
    // Ein Tag mit einem Scan muss sichtbar bleiben. Drei Prozent Hoehe
    // waeren ein Strich, den niemand von null unterscheidet.
    const hoehe = t.scans === 0 ? 3 : Math.max(6, Math.round(anteil * 100));
    return '<div class="tag' + (t.scans === 0 ? " leer" : "") + '" style="height:' + hoehe +
      '%%" title="' + t.tag + ": " + t.scans + ' Scans"></div>';
  }).join("");
  e("achse").innerHTML = d.tage.length
    ? "<span>" + d.tage[0].tag + "</span><span>Spitze " + hoechst +
      "</span><span>" + d.tage[d.tage.length - 1].tag + "</span>"
    : "";
  e("verlaufstand").textContent = d.tage.length + " Tage";

  // --- Klassen ---
  const arten = Object.keys(d.klassen || {}).sort();
  e("klassen").innerHTML = arten.length
    ? arten.map(art => {
        const werte = d.klassen[art];
        const summe = werte.reduce((s, w) => s + w.scans, 0) || 1;
        return '<div style="display:flex;flex-direction:column;gap:.5rem">' +
          '<div class="was" style="font-size:.72rem;letter-spacing:.05em;' +
          'text-transform:uppercase;color:var(--leise)">' +
          entschaerft(ARTNAMEN[art] || art) + "</div>" +
          '<div class="riegel">' + werte.map(w =>
            '<div class="zeile"><span class="art">' + entschaerft(w.wert) + "</span>" +
            '<span class="balken"><i style="width:' +
            Math.max(2, Math.round(w.scans * 100 / summe)) + '%%"></i></span>' +
            '<span class="n">' + Math.round(w.scans * 100 / summe) + " %%</span></div>").join("") +
          "</div></div>";
      }).join('<div style="height:1rem"></div>')
    : '<div class="leer">Noch nichts gescannt.</div>';

  // --- Codes ---
  e("codestand").textContent = d.codes.length + " Codes";
  e("codes").innerHTML = d.codes.length
    ? "<table><thead><tr><th>Code</th><th>Ziel</th><th style=\"text-align:right\">Scans</th>" +
      "<th style=\"text-align:right\">Weiter</th><th>Stand</th></tr></thead><tbody>" +
      d.codes.map(c =>
        "<tr><td><b>" + entschaerft(c.name || c.kuerzel) + "</b><br>" +
        '<span style="color:var(--leise);font-size:.8rem">/' + entschaerft(c.kuerzel) +
        (c.ordner ? " · " + entschaerft(c.ordner) : "") + "</span></td>" +
        '<td class="ziel">' + entschaerft(c.ziel) + "</td>" +
        '<td class="n">' + zahlDeutsch(c.scans) + "</td>" +
        '<td class="n">' + (c.mitSeite
          ? zahlDeutsch(c.weiter) + (c.scans
              ? ' <span style="color:var(--leise)">· ' +
                Math.round(c.weiter * 100 / c.scans) + " %%</span>" : "")
          : '<span style="color:var(--leise)">—</span>') + "</td>" +
        "<td>" + (c.aktiv ? "" : '<span class="stumm">abgeschaltet</span>') + "</td></tr>").join("") +
      "</tbody></table>"
    : '<div class="leer">Noch kein Code angelegt.</div>';
}

// Die Strecke steht nur da, wo es sie gibt: ohne Landeseite gibt es
// keinen zweiten Schritt, und eine leere Tafel mit zwei Nullen
// behauptet, es sei etwas gemessen worden.
function strecke(d) {
  e("streckefeld").hidden = !d.seitenScans;
  if (!d.seitenScans) return;
  const rate = Math.round(d.weiter * 100 / d.seitenScans);
  e("streckestand").textContent = d.codes.filter(c => c.mitSeite).length + " mit Landeseite";
  e("strecke").innerHTML =
    '<div class="stufe"><div class="wert">' + zahlDeutsch(d.seitenScans) + "</div>" +
      '<div class="was">Scan</div><div class="dazu">Code gescannt, Seite geladen</div></div>' +
    '<div class="rate">→ ' + rate + " %%</div>" +
    '<div class="stufe"><div class="wert">' + zahlDeutsch(d.weiter) + "</div>" +
      '<div class="was">Knopf</div><div class="dazu">weiter zum Ziel</div></div>';
  e("streckehinweis").textContent = d.seitenScans < MINDESTRATE
    ? "Unter " + MINDESTRATE + " Scans steht die Rate nicht im Satz oben: aus " +
      "vier Scans und einem Knopfdruck „25 Prozent\" zu machen, wäre eine Erfindung."
    : "Gemessen wird der Knopf auf der Landeseite. Ein Code ohne Seite hat keinen " +
      "Knopf und steht nicht im Nenner.";
}

function kachel(wert, was) {
  return '<div class="kachel"><div class="wert">' + entschaerft(wert) +
    '</div><div class="was">' + entschaerft(was) + "</div></div>";
}

// Derselbe Tausenderpunkt wie im Satz, den der Server schreibt.
function zahlDeutsch(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
</script>
`
