package main

import (
	"fmt"
	"net/http"

	"pnkt.me/pnkt/gestalt"
)

// studio ist die Bedienoberflaeche. Sie liegt als Text im Binaer, damit
// das Programm ohne Beiwerk laeuft: keine Datei daneben, kein Netz, kein
// CDN, keine fremde Schrift. Die Marke kommt aus dem Hostnamen — dasselbe
// Studio traegt bei jedem Kunden dessen Gesicht.
//
// Der Aufbau folgt dem Ablauf, nicht der Technik: erst was drinsteht,
// dann wie es aussieht, dann wie es gedruckt wird. Das Urteil steht
// daneben und nicht am Ende, weil eine Warnung nach dem Export niemandem
// mehr hilft.
func (d *dienst) studio(w http.ResponseWriter, r *http.Request) {
	m := d.ablage.MarkeNachHost(r.Host)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy",
		// blob: braucht die Vorschau: das SVG kommt als Blob aus der
		// Schnittstelle und wird nicht nachgeladen. Ohne diese Angabe
		// bleibt die Vorschau leer — und zwar lautlos.
		"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; "+
			"font-src 'self'; img-src 'self' data: blob:")
	fmt.Fprintf(w, studioSeite, m.Name, gestalt.Kopf(),
		m.Grund, m.Tinte, m.Primaer, gestalt.MarkeLockup(m.Name, "/", false), m.Name)
}

const studioSeite = `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Studio · %s</title>
%s
<style>
:root{--color-bg:%s;--color-text:%s;--color-accent:%s;
 --gut:var(--color-accent-2-700);--gutgrund:var(--color-accent-2-100);
 --warn:var(--color-accent-700);--warngrund:var(--color-accent-100);
 --schlecht:#a82e23;--schlechtgrund:#f7e7e5;
 --leise:color-mix(in srgb,var(--color-text) 62%%,transparent);
 --linie:color-mix(in srgb,var(--color-text) 12%%,transparent)}
body{background:var(--color-bg);color:var(--color-text);
 font-family:var(--font-body);font-size:15px;line-height:1.55}
h1{font-family:var(--font-heading);font-size:1.5rem;letter-spacing:-.02em;margin:0}
.anriss{color:var(--leise);font-size:.92rem;margin:.25rem 0 1.5rem}
.anriss a{color:var(--color-accent-700)}
.raster{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:1.1rem;align-items:start}
@media(max-width:940px){.raster{grid-template-columns:1fr}}
label{display:flex;flex-direction:column;gap:.3rem;font-size:.72rem;font-weight:600;
 letter-spacing:.04em;text-transform:uppercase;color:var(--leise)}
input,select,textarea{font:inherit;font-size:.9rem;padding:.55rem .7rem;
 border:1px solid color-mix(in srgb,var(--color-text) 22%%,transparent);
 border-radius:var(--radius-md);background:var(--color-bg);color:var(--color-text);
 width:100%%;min-width:0;text-transform:none;letter-spacing:normal;font-weight:400}
input:focus-visible,select:focus-visible,textarea:focus-visible{border-color:var(--color-accent)}
input[type=color]{padding:.2rem;height:2.5rem;cursor:pointer}
input[type=range]{padding:0;accent-color:var(--color-accent);border:none;background:none}
textarea{resize:vertical;min-height:4.5rem}
.reihe{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}
.reihe3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.55rem}
.reiter{display:flex;flex-wrap:wrap;gap:.3rem;padding:.6rem .7rem;
 border-bottom:1px solid var(--linie)}
.reiter button{font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;
 background:none;border:1px solid transparent;border-radius:999px;padding:.35rem .75rem;
 color:var(--leise)}
.reiter button[aria-selected=true]{background:var(--color-accent);color:var(--color-bg)}
.reiter button:hover{color:var(--color-text)}
.reiter button[aria-selected=true]:hover{color:var(--color-bg)}
.vorschau{display:grid;place-items:center;padding:1.8rem;min-height:360px;
 background:var(--color-bg)}
/* Die Vorschau fuellt die Flaeche. Das SVG traegt sein Millimetermass
   in sich; wer es hier klein anzeigt, weil 40 mm nun einmal klein sind,
   kann nichts beurteilen. Das wahre Mass steht in der Kopfzeile. */
.vorschau img{width:min(100%%,400px);height:auto;
 filter:drop-shadow(0 12px 32px color-mix(in srgb,#2e2b25 22%%,transparent))}
.urteil{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;font-size:.72rem;
 font-weight:700;letter-spacing:.1em;text-transform:uppercase;
 padding:.4rem .8rem;border-radius:999px;width:fit-content}
.u-gut{color:var(--gut);background:var(--gutgrund)}
.u-achtung{color:var(--warn);background:var(--warngrund)}
.u-kritisch{color:var(--schlecht);background:var(--schlechtgrund)}
.befund{font-size:.85rem;padding-left:.85rem;
 border-left:2px solid var(--color-accent-2);color:var(--leise)}
.befund b{color:var(--color-text);font-weight:600;display:block}
.befund.fehler{border-color:var(--schlecht)}
.befund.warnung{border-color:var(--color-accent-500)}
.zahlen{display:flex;flex-wrap:wrap;gap:.3rem 1.1rem;font-size:.78rem;color:var(--leise)}
.zahlen b{color:var(--color-text);font-variant-numeric:tabular-nums}
.knoepfe{display:flex;flex-wrap:wrap;gap:.45rem}
a.knopf,button.knopf{display:inline-flex;align-items:center;gap:.45rem;font:inherit;
 font-size:.85rem;font-weight:600;text-decoration:none;padding:.55rem .95rem;
 border:1px solid color-mix(in srgb,var(--color-text) 14%%,transparent);
 border-radius:999px;color:var(--color-text);background:var(--color-bg);cursor:pointer}
a.knopf:hover,button.knopf:hover{border-color:var(--color-accent)}
a.knopf.stark,button.knopf.stark{background:var(--color-accent);color:var(--color-bg);
 border-color:var(--color-accent)}
a.knopf.stark:hover{background:var(--color-accent-600);border-color:var(--color-accent-600)}
.hinweis{font-size:.8rem;color:var(--leise);border-left:2px solid var(--linie);padding-left:.85rem}
.messwert{font-size:.78rem;color:var(--leise);background:var(--color-bg);
 border-radius:var(--radius-md);padding:.6rem .8rem}
.messwert b{color:var(--color-text)}
[hidden]{display:none!important}
.formen{display:grid;grid-template-columns:repeat(auto-fill,minmax(76px,1fr));gap:.35rem}
.formen button{font:inherit;font-size:.74rem;padding:.45rem .25rem;cursor:pointer;
 border:1px solid transparent;border-radius:999px;
 background:var(--color-bg);color:var(--leise)}
.formen button:hover{color:var(--color-text)}
.formen button[aria-pressed=true]{background:var(--color-accent);color:var(--color-bg);
 font-weight:600}
/* Der Streifen: die Entwuerfe nebeneinander, jeder mit seinem Bild.
   Eine Liste mit Namen taugt nicht — man erkennt eine Gestaltung, man
   liest sie nicht. */
.streifen{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:.5rem}
.entwurf{background:var(--color-bg);border-radius:var(--radius-md);padding:.5rem;
 display:flex;flex-direction:column;gap:.35rem;border:2px solid transparent}
.entwurf.gilt{border-color:var(--color-accent)}
.entwurf img{width:100%%;height:auto;display:block;background:#fff;border-radius:6px}
.entwurf .name{font-size:.76rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;
 white-space:nowrap}
.entwurf .tun{display:flex;gap:.3rem;flex-wrap:wrap}
.entwurf .tun button{font:inherit;font-size:.72rem;padding:.15rem .45rem;cursor:pointer;
 background:none;border:none;color:var(--color-accent-700);text-decoration:underline}
.entwurf .tun button.weg{color:#a82e23}
/* Der Vergleich legt den zweiten Entwurf halbdurchsichtig darueber.
   Nebeneinander sieht man Unterschiede in der Modulform nicht; genau
   dafuer ist der Vergleich da. */
.vergleich{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none}
.vergleich img{width:min(100%%,400px);height:auto;opacity:.55}
.vorschau{position:relative}
.vergleichschip{position:absolute;top:.7rem;right:.7rem;font-size:.72rem;font-weight:600;
 background:var(--color-accent);color:var(--color-bg);border-radius:999px;
 padding:.25rem .7rem;z-index:2}
</style>

<a href="#inhalt" class="ueberspringen">Zum Inhalt</a>
<header class="werkkopf">
  <div class="werkkopf-innen">
    %s
    <nav class="werkwege" aria-label="Bereiche">
      <a class="werkweg werkweg-aktiv" href="/" aria-current="page">Studio</a>
      <a class="werkweg" href="/zentrale">Zentrale</a>
      <a class="werkweg" href="/landeseite">Landeseite</a>
      <a class="werkweg" href="/serie">Serie</a>
      <a class="werkweg" href="/zahlen">Zahlen</a>
    </nav>
  </div>
</header>

<main id="inhalt" class="spur">
  <h1>Studio</h1>
  <p class="anriss">Vor dem Druck wissen, ob er scannt. Alles rechnet dieser Server — %s.
    Angelegte Codes stehen in der <a href="/zentrale">Zentrale</a>.</p>

  <div class="raster">
    <div>
      <div class="tafel">
        <div class="tafel-kopf"><span>Vorschau</span><span id="masse"></span></div>
        <div class="vorschau">
          <img id="bild" alt="Vorschau des Codes">
          <div class="vergleich" id="vergleich" hidden><img id="vergleichbild" alt=""></div>
          <span class="vergleichschip" id="vergleichschip" hidden></span>
        </div>
        <div class="tafel-koerper">
          <div id="urteil"></div>
          <div id="befunde" style="display:flex;flex-direction:column;gap:.5rem"></div>
          <div class="zahlen" id="zahlen"></div>
          <div class="knoepfe">
            <a class="knopf stark" id="a-svg" download="pnkt.svg">SVG</a>
            <a class="knopf stark" id="a-pdf" download="pnkt.pdf">PDF</a>
            <a class="knopf stark" id="a-eps" download="pnkt.eps">EPS</a>
            <button class="knopf" id="a-png" type="button">PNG 2048</button>
            <a class="knopf" id="a-aufsteller" download="pnkt-aufsteller.pdf">Aufsteller A6</a>
          </div>
          <div class="reihe" style="margin-top:.2rem">
            <label>Überschrift des Aufstellers<input id="auf-kopf" placeholder="Speisekarte"></label>
            <label>Aufforderung<input id="auf-ruf" value="Jetzt scannen"></label>
          </div>
          <p class="hinweis">SVG, PDF und EPS sind echter Vektor in Millimetermaß.
             PNG rechnet der Browser aus demselben SVG — für den Druck nimmt man es nicht.</p>
        </div>
      </div>
    </div>

    <div class="tafel">
      <div class="reiter" role="tablist">
        <button role="tab" data-blatt="inhalt" aria-selected="true">Inhalt</button>
        <button role="tab" data-blatt="form" aria-selected="false">Form</button>
        <button role="tab" data-blatt="farbe" aria-selected="false">Farbe</button>
        <button role="tab" data-blatt="rahmen" aria-selected="false">Rahmen</button>
        <button role="tab" data-blatt="druck" aria-selected="false">Druck</button>
        <button role="tab" data-blatt="entwuerfe" aria-selected="false">Entwürfe</button>
      </div>

      <div class="tafel-koerper" data-blatt="inhalt">
        <label>Was soll der Code enthalten?
          <select id="typ">
            <option value="url">Adresse</option>
            <option value="text">Freier Text</option>
            <option value="vcard">Visitenkarte</option>
            <option value="wlan">WLAN</option>
            <option value="girocode">GiroCode — Überweisung</option>
            <option value="gs1">GS1 Digital Link</option>
          </select>
        </label>
        <div id="felder" style="display:flex;flex-direction:column;gap:.6rem"></div>
        <p class="hinweis" id="inhalt-hinweis"></p>
      </div>

      <div class="tafel-koerper" data-blatt="form" hidden>
        <label>Modulform</label>
        <div class="formen" id="modulformen"></div>
        <div class="reihe">
          <label>Augenrahmen<select id="augenrahmen">
            <option value="quadrat">Quadrat</option><option value="kissen">Kissen</option>
            <option value="blatt">Blatt</option><option value="rund">Rund</option>
          </select></label>
          <label>Augenkern<select id="augenkern">
            <option value="quadrat">Quadrat</option><option value="rund">Rund</option>
            <option value="weich">Weich</option><option value="punkt">Punkt</option>
          </select></label>
        </div>
        <div class="reihe">
          <label>Fehlerkorrektur<select id="stufe">
            <option value="L">L — 7 %%</option><option value="M" selected>M — 15 %%</option>
            <option value="Q">Q — 25 %%</option><option value="H">H — 30 %%</option>
          </select></label>
          <label>Ruhezone in Modulen<input id="ruhezone" type="number" value="4" min="0" max="10"></label>
        </div>
        <label>Logoaussparung <span id="logo-wert">0 %%</span>
          <input id="logo" type="range" min="0" max="0.4" step="0.05" value="0"></label>
        <p class="messwert">Gemessen an 160 Kombinationen: <b>quadratische und leicht
          gerundete Augen (Kissen) wurden 40 von 40 mal gelesen</b>, Blatt und Rund
          kein einziges Mal. Der Scanner sucht in den Ecken das Verhältnis 1:1:3:1:1.</p>
      </div>

      <div class="tafel-koerper" data-blatt="farbe" hidden>
        <label>Farbwelt<select id="farbwelt">
          <option value="rgb">Bildschirm — Hexfarbe</option>
          <option value="cmyk">CMYK — vier Kanäle</option>
          <option value="sonder">Sonderfarbe — Vollton</option>
          <option value="verlauf">Verlauf</option>
        </select></label>

        <div data-farbe="rgb">
          <div class="reihe">
            <label>Vordergrund<input id="vordergrund" type="color" value="#0d0d12"></label>
            <label>Hintergrund<input id="hintergrund" type="color" value="#ffffff"></label>
          </div>
        </div>

        <div data-farbe="cmyk" hidden>
          <div class="reihe">
            <label>Cyan<input id="c" type="number" value="0" min="0" max="100"></label>
            <label>Magenta<input id="m" type="number" value="92" min="0" max="100"></label>
          </div>
          <div class="reihe" style="margin-top:.55rem">
            <label>Yellow<input id="y" type="number" value="86" min="0" max="100"></label>
            <label>Key<input id="k" type="number" value="12" min="0" max="100"></label>
          </div>
        </div>

        <div data-farbe="sonder" hidden>
          <label>Name der Farbe<input id="sondername" value="HKS 13 K"></label>
          <p class="hinweis">Der Vollton bekommt einen eigenen Auszug in PDF und EPS.
             Die vier Werte oben sind das Ersatzrezept für alles, was die Farbe nicht hat.</p>
        </div>

        <div data-farbe="verlauf" hidden>
          <div class="reihe">
            <label>Von<input id="v1" type="color" value="#4f39f6"></label>
            <label>Nach<input id="v2" type="color" value="#0d0d12"></label>
          </div>
          <div class="reihe" style="margin-top:.55rem">
            <label>Art<select id="verlaufart">
              <option value="linear">Linear</option><option value="radial">Radial</option>
            </select></label>
            <label>Winkel<input id="winkel" type="number" value="45" min="0" max="360"></label>
          </div>
          <p class="hinweis">Der Kontrast wird gegen die hellste Marke gerechnet —
             wer nur die dunkelste prüft, gibt Verläufe frei, die oben auslaufen.</p>
        </div>
      </div>

      <div class="tafel-koerper" data-blatt="rahmen" hidden>
        <label>Rahmen<select id="rahmenart">
          <option value="keiner">keiner</option>
          <option value="balken">Balken unten</option>
          <option value="schild">Schild</option>
        </select></label>
        <label>Aufforderung<input id="rahmentext" value="JETZT SCANNEN"></label>
        <div class="reihe">
          <label>Fläche<input id="rahmenfarbe" type="color" value="#141018"></label>
          <label>Schrift<input id="rahmentextfarbe" type="color" value="#ffffff"></label>
        </div>
        <p class="hinweis">Der Code wird dabei nicht verkleinert. Die Modulgröße ist eine
           Druckentscheidung und darf nicht sinken, weil jemand eine Beschriftung dazunimmt.</p>
      </div>

      <div class="tafel-koerper" data-blatt="druck" hidden>
        <label>Breite in Millimetern<input id="breite" type="number" value="40" min="5" max="1000"></label>
        <label>Druckverfahren<select id="verfahren">
          <option value="bildschirm">Nur Bildschirm — ab 0,20 mm</option>
          <option value="laser">Laser oder Tinte, Papier — ab 0,40 mm</option>
          <option value="offset" selected>Offsetdruck — ab 0,50 mm</option>
          <option value="grossformat">Großformat, Plane, Folie — ab 0,75 mm</option>
          <option value="gravur">Gravur, Prägung, Textil — ab 1,00 mm</option>
        </select></label>
        <label><span style="display:flex;gap:.4rem;align-items:center">
          <input type="checkbox" id="kasse" style="width:auto"> An der Kasse lesbar (GS1)</span></label>
        <label>Leseabstand in Zentimetern<input id="abstand" type="number" value="50" min="5"></label>
        <p class="messwert" id="abstand-rat"></p>
      </div>

      <div class="tafel-koerper" data-blatt="entwuerfe" hidden>
        <div class="reihe">
          <label>Schlüssel<input id="e-schluessel" type="password"
                 placeholder="x-punkt-schluessel" autocomplete="off"></label>
          <label>Code<select id="e-code"><option value="">— erst Schlüssel —</option></select></label>
        </div>
        <div class="reihe">
          <label>Name des Entwurfs<input id="e-name" placeholder="Terrakotta rund"></label>
          <label style="justify-content:flex-end">
            <button class="knopf stark" type="button" id="e-sichern" disabled
                    style="width:100%%;justify-content:center">Aktuellen sichern</button></label>
        </div>
        <div id="e-meldung"></div>
        <div class="streifen" id="e-streifen"></div>
        <p class="hinweis" id="e-hinweis">Ein Entwurf hält eine Gestaltung fest — mehr nicht.
          Eine Scanrate je Entwurf steht bewusst nicht darunter: gemessen wird über das
          Kürzel, und zwei Gestaltungen desselben Codes tragen dasselbe Kürzel. Beim Scan
          ist nicht zu unterscheiden, welche der beiden auf dem Papier stand.</p>
      </div>
    </div>
  </div>
</main>

<script>
const e = (id) => document.getElementById(id);
const FORMEN = ["quadrat","punkt","rund","weich","mosaik","raute","kreuz","stern",
                "querstriche","laengsstriche","fliessend","tropfen"];
let modulform = "quadrat";
let inhaltText = "https://pnkt.me";

// --- Formauswahl ---------------------------------------------------------
e("modulformen").innerHTML = FORMEN.map(f =>
  '<button type="button" data-form="'+f+'" aria-pressed="'+(f===modulform)+'">'+f+'</button>').join("");
e("modulformen").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  modulform = b.dataset.form;
  [...e("modulformen").children].forEach(x => x.setAttribute("aria-pressed", x===b));
  zeichnen();
});

// --- Reiter ---------------------------------------------------------------
document.querySelectorAll('[role=tab]').forEach(t => t.addEventListener("click", () => {
  document.querySelectorAll('[role=tab]').forEach(x => x.setAttribute("aria-selected", x===t));
  document.querySelectorAll('[data-blatt]').forEach(x => {
    if (x.getAttribute("role") === "tablist") return;
    if (x.hasAttribute("role")) return;
    x.hidden = x.dataset.blatt !== t.dataset.blatt;
  });
}));

// --- Inhaltstypen ---------------------------------------------------------
const TYPEN = {
  url:      [["url","Adresse","https://example.de/aktion"]],
  text:     [["text","Text","",true]],
  vcard:    [["vorname","Vorname"],["nachname","Nachname"],["firma","Firma"],
             ["stellung","Position"],["telefon","Telefon"],["mail","E-Mail"],
             ["ort","Ort"],["plz","PLZ"]],
  wlan:     [["ssid","Netzname"],["schluessel","Passwort"],["art","Verschlüsselung","WPA"]],
  girocode: [["empfaenger","Empfänger"],["iban","IBAN","DE89 3704 0044 0532 0130 00"],
             ["betrag","Betrag in Euro"],["zweck","Verwendungszweck"]],
  gs1:      [["gtin","GTIN","4006381333931"],["charge","Charge"],["verfaellt","Verfällt JJMMTT"]]
};

function felderZeichnen() {
  const typ = e("typ").value;
  e("felder").innerHTML = TYPEN[typ].map(([k,name,platz,gross]) =>
    '<label>'+name+(gross
      ? '<textarea data-feld="'+k+'"></textarea>'
      : '<input data-feld="'+k+'" placeholder="'+(platz||"")+'">')+'</label>').join("");
  // Beim Wechsel gleich ein brauchbares Beispiel einsetzen.
  TYPEN[typ].forEach(([k,,platz]) => {
    const f = e("felder").querySelector('[data-feld="'+k+'"]');
    if (f && platz) f.value = platz;
  });
  e("felder").querySelectorAll("[data-feld]").forEach(f =>
    f.addEventListener("input", () => spaeter(inhaltHolen)));
  inhaltHolen();
}
e("typ").addEventListener("change", felderZeichnen);

async function inhaltHolen() {
  const felder = {};
  e("felder").querySelectorAll("[data-feld]").forEach(f => felder[f.dataset.feld] = f.value);
  // Solange nichts eingetragen ist, wird auch nichts gefragt — sonst
  // steht bei jedem Typwechsel eine Fehlermeldung da, die niemand
  // verursacht hat.
  if (!Object.values(felder).some(v => v.trim() !== "")) {
    e("inhalt-hinweis").style.color = "";
    e("inhalt-hinweis").textContent = "Noch nichts eingetragen.";
    return;
  }
  const antwort = await fetch("/api/v1/inhalt", {method:"POST",
    body: JSON.stringify({typ: e("typ").value, felder})});
  const d = await antwort.json();
  if (d.fehler) {
    e("inhalt-hinweis").textContent = d.fehler;
    e("inhalt-hinweis").style.color = "var(--schlecht)";
    return;
  }
  e("inhalt-hinweis").style.color = "";
  e("inhalt-hinweis").textContent = d.zeichen + " Zeichen. Je mehr im Code steht, "
    + "desto größer muss er gedruckt werden.";
  inhaltText = d.text;
  zeichnen();
}

// --- Farbwelt -------------------------------------------------------------
e("farbwelt").addEventListener("change", () => {
  const welt = e("farbwelt").value;
  document.querySelectorAll("[data-farbe]").forEach(x => x.hidden = x.dataset.farbe !== welt);
  // Sonderfarben brauchen das Ersatzrezept aus den CMYK-Feldern.
  if (welt === "sonder") document.querySelector('[data-farbe=cmyk]').hidden = false;
  zeichnen();
});

function vordergrund() {
  const welt = e("farbwelt").value;
  const cmyk = () => [e("c").value, e("m").value, e("y").value, e("k").value].join(",");
  if (welt === "cmyk")   return "cmyk(" + cmyk() + ")";
  if (welt === "sonder") return "sonder(" + e("sondername").value + "," + cmyk() + ")";
  if (welt === "verlauf") return {art: e("verlaufart").value, winkel: Number(e("winkel").value),
    stops: [{pos:0, farbe:e("v1").value}, {pos:1, farbe:e("v2").value}]};
  return e("vordergrund").value;
}

// --- Zeichnen -------------------------------------------------------------
function stil() {
  const s = {
    modulform, augenrahmen: e("augenrahmen").value, augenkern: e("augenkern").value,
    vordergrund: vordergrund(), hintergrund: e("hintergrund").value,
    ruhezone: Number(e("ruhezone").value), logo: Number(e("logo").value)
  };
  if (e("rahmenart").value !== "keiner") {
    s.rahmen = {art: e("rahmenart").value, text: e("rahmentext").value,
                farbe: e("rahmenfarbe").value, textfarbe: e("rahmentextfarbe").value};
  }
  return s;
}

function wunsch(format) {
  return {text: inhaltText, format, breiteMm: Number(e("breite").value),
          verfahren: e("verfahren").value, stufe: e("stufe").value, stil: stil()};
}

async function datei(format) {
  const antwort = await fetch("/api/v1/rendern", {method:"POST", body: JSON.stringify(wunsch(format))});
  return antwort.blob();
}

let letzteURLs = [];
async function zeichnen() {
  e("logo-wert").textContent = Math.round(Number(e("logo").value)*100) + " %%";

  const antwort = await fetch("/api/v1/rendern",
    {method:"POST", body: JSON.stringify({...wunsch("svg"), alsJson:true})});
  const d = await antwort.json();
  if (d.fehler) {
    e("urteil").innerHTML = '<span class="urteil u-kritisch">nicht baubar</span>';
    e("befunde").innerHTML = '<div class="befund fehler"><b>'+d.fehler+'</b></div>';
    return;
  }
  const u = d.urteil;
  e("urteil").innerHTML = '<span class="urteil u-'+d.pruefung+'">'+
    (d.pruefung==="gut" ? "druckreif" : d.pruefung==="achtung" ? "achtung" : "so nicht drucken")+
    ' · Note '+u.note+'</span>';
  e("befunde").innerHTML = (u.befunde||[]).map(b =>
    '<div class="befund '+b.schwere+'"><b>'+b.text+'</b>'+(b.rat||"")+'</div>').join("");
  e("zahlen").innerHTML =
    '<span>Version <b>'+d.version+'</b></span><span>Module <b>'+d.kante+'</b></span>'+
    '<span>Modul <b>'+u.modulMm.toFixed(3)+' mm</b></span>'+
    '<span>Kontrast <b>'+u.kontrast+':1</b></span>'+
    '<span>kleinste Breite <b>'+u.kleinsteMm+' mm</b></span>';
  e("masse").textContent = e("breite").value + " mm";

  const abstand = Number(e("abstand").value) * 10;
  e("abstand-rat").innerHTML = 'Faustregel: Kantenlänge ≈ Leseabstand ÷ 10. Für '+
    (abstand/10)+' cm Abstand wären das <b>'+Math.round(abstand/10)+' mm</b>.';

  letzteURLs.forEach(URL.revokeObjectURL);
  letzteURLs = [];
  const svg = await datei("svg");
  const url = URL.createObjectURL(svg);
  letzteURLs.push(url);
  e("bild").src = url;
  e("a-svg").href = url;

  // Der Aufsteller ist eine fertige Karte und keine Ausgabe desselben
  // Codes: die Kantenlaenge kommt aus dem Kartenformat, nicht aus dem
  // Feld „Breite". Deshalb ein eigener Weg statt eines dritten Formats.
  const kf = new URLSearchParams({
    inhalt: inhaltText, karte: "a6", stufe: e("stufe").value,
    form: modulform, augenrahmen: e("augenrahmen").value,
    augenkern: e("augenkern").value, hintergrund: e("hintergrund").value,
    ruhezone: e("ruhezone").value, logo: e("logo").value,
    ueberschrift: e("auf-kopf").value, aufforderung: e("auf-ruf").value,
  });
  const vg = vordergrund();
  if (typeof vg === "string") {
    kf.set("vordergrund", vg);
    e("a-aufsteller").href = "/aufsteller.pdf?" + kf.toString();
    e("a-aufsteller").removeAttribute("aria-disabled");
    e("a-aufsteller").title = "A6-Karte mit Code, Überschrift und Aufforderung";
    e("a-aufsteller").style.opacity = "";
  } else {
    // Ein Verlauf laesst sich nicht in eine Adresszeile schreiben. Statt
    // still einen schwarzen Aufsteller zu liefern, faellt der Knopf aus
    // und sagt warum.
    e("a-aufsteller").removeAttribute("href");
    e("a-aufsteller").setAttribute("aria-disabled", "true");
    e("a-aufsteller").title = "Der Aufsteller kann noch keinen Verlauf — " +
      "für ihn eine der drei anderen Farbwelten wählen.";
    e("a-aufsteller").style.opacity = ".45";
  }

  for (const [id, format] of [["a-pdf","pdf"], ["a-eps","eps"]]) {
    const b = await datei(format);
    const u2 = URL.createObjectURL(b);
    letzteURLs.push(u2);
    e(id).href = u2;
  }
}

// PNG rechnet der Browser aus demselben SVG — dafuer braucht es keinen Server.
e("a-png").addEventListener("click", async () => {
  const text = await (await datei("svg")).text();
  const bild = new Image();
  bild.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(text)));
  await bild.decode();
  const c = document.createElement("canvas");
  c.width = c.height = 2048;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  g.drawImage(bild, 0, 0, 2048, 2048);
  c.toBlob(b => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "pnkt.png"; a.click();
  });
});

// --- Entwuerfe -----------------------------------------------------------
//
// Ein Entwurf haelt eine Gestaltung fest. Was er nicht haelt, ist eine
// Scanrate: gemessen wird ueber das Kuerzel, und zwei Gestaltungen
// desselben Codes tragen dasselbe. Die Zahl waere erfunden.
let eStil = [];      // die geladenen Entwuerfe
let eGilt = null;    // die geltende Gestaltung des Codes
let eVergleich = "";

function eMelden(text, art) {
  e("e-meldung").innerHTML = text
    ? '<div class="messwert" style="' +
      (art === "schlecht" ? "color:#a82e23;background:#f7e7e5" :
       "color:var(--color-accent-2-700);background:var(--color-accent-2-100)") +
      '">' + text.replace(/[<>&]/g, "") + "</div>" : "";
}

async function eRuf(weg, art, rumpf) {
  const kopf = {"x-punkt-schluessel": e("e-schluessel").value.trim()};
  if (rumpf) kopf["Content-Type"] = "application/json";
  const a = await fetch(weg, {method: art || "GET", headers: kopf,
    body: rumpf ? JSON.stringify(rumpf) : undefined});
  const text = await a.text();
  let d = null;
  try { d = text ? JSON.parse(text) : null; } catch (_) {}
  if (!a.ok) throw new Error((d && d.fehler) || ("Fehler " + a.status));
  return d;
}

e("e-schluessel").addEventListener("input", () => spaeter(eCodesHolen));

async function eCodesHolen() {
  if (!e("e-schluessel").value.trim()) return;
  try {
    const d = await eRuf("/api/v1/codes");
    const vorher = e("e-code").value;
    e("e-code").innerHTML = '<option value="">— auswählen —</option>' + d.map(c =>
      '<option value="' + c.id + '">' + (c.name || c.kuerzel) + " · /" + c.kuerzel +
      "</option>").join("");
    if (vorher && [...e("e-code").options].some(o => o.value === vorher)) {
      e("e-code").value = vorher;
    }
    eMelden("", "");
  } catch (fehler) { eMelden(fehler.message, "schlecht"); }
}

e("e-code").addEventListener("change", () => {
  e("e-sichern").disabled = !e("e-code").value;
  eEntwuerfeHolen();
});

async function eEntwuerfeHolen() {
  const id = e("e-code").value;
  if (!id) { eStil = []; eGilt = null; eStreifen(); return; }
  try {
    const d = await eRuf("/api/v1/codes/" + encodeURIComponent(id) + "/entwuerfe");
    eStil = d.entwuerfe || [];
    eGilt = d.stil || null;
    eStreifen();
  } catch (fehler) { eMelden(fehler.message, "schlecht"); }
}

// Jeder Entwurf bekommt sein eigenes Bild. Ein Streifen aus Namen
// taugt nicht: man erkennt eine Gestaltung, man liest sie nicht.
function eBildweg(stil) {
  const p = new URLSearchParams({inhalt: inhaltText, breite: "40",
    stufe: e("stufe").value});
  for (const [k, v] of Object.entries(stil || {})) {
    if (typeof v === "string" || typeof v === "number") p.set(k, String(v));
  }
  if (stil && stil.modulform) p.set("form", stil.modulform);
  return "/qr.svg?" + p.toString();
}

function eStreifen() {
  if (!eStil.length) {
    e("e-streifen").innerHTML = e("e-code").value
      ? '<div class="messwert">Für diesen Code ist noch kein Entwurf gesichert.</div>' : "";
    eVergleichAus();
    return;
  }
  e("e-streifen").innerHTML = eStil.map(x =>
    '<div class="entwurf' + (eVergleich === x.name ? " gilt" : "") + '">' +
      '<img src="' + eBildweg(x.stil) + '" alt="Entwurf ' + x.name + '">' +
      '<span class="name" title="' + x.name + '">' + x.name + "</span>" +
      '<span class="tun">' +
        '<button type="button" data-tun="laden" data-name="' + x.name + '">laden</button>' +
        '<button type="button" data-tun="vergleich" data-name="' + x.name + '">' +
          (eVergleich === x.name ? "aus" : "vergleichen") + "</button>" +
        '<button type="button" class="weg" data-tun="weg" data-name="' + x.name + '">weg</button>' +
      "</span></div>").join("");
}

e("e-streifen").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button"); if (!b) return;
  const name = b.dataset.name;
  const eintrag = eStil.find(x => x.name === name);
  const id = e("e-code").value;
  try {
    if (b.dataset.tun === "laden" && eintrag) {
      stilEinsetzen(eintrag.stil);
      eMelden("„" + name + "\" ist eingestellt. Gesichert wird dadurch nichts.", "gut");
      zeichnen();
    }
    if (b.dataset.tun === "vergleich") {
      eVergleich = (eVergleich === name) ? "" : name;
      eStreifen();
      eVergleichZeigen();
    }
    if (b.dataset.tun === "weg") {
      if (!confirm("Den Entwurf „" + name + "\" entfernen? Der gedruckte Code " +
                   "bleibt unberührt.")) return;
      await eRuf("/api/v1/codes/" + encodeURIComponent(id) +
                 "/entwuerfe/" + encodeURIComponent(name), "DELETE");
      if (eVergleich === name) eVergleich = "";
      eEntwuerfeHolen();
      eVergleichZeigen();
    }
  } catch (fehler) { eMelden(fehler.message, "schlecht"); }
});

function eVergleichZeigen() {
  const eintrag = eStil.find(x => x.name === eVergleich);
  if (!eintrag) { eVergleichAus(); return; }
  e("vergleichbild").src = eBildweg(eintrag.stil);
  e("vergleich").hidden = false;
  e("vergleichschip").hidden = false;
  e("vergleichschip").textContent = "Vergleich: " + eVergleich;
}

function eVergleichAus() {
  e("vergleich").hidden = true;
  e("vergleichschip").hidden = true;
}

// stilEinsetzen ist die Umkehrung von stil(): dieselben Felder,
// dieselben Namen. Laufen die beiden auseinander, laedt ein Entwurf
// etwas anderes, als er gesichert hat.
function stilEinsetzen(s) {
  if (!s) return;
  if (s.modulform) {
    modulform = s.modulform;
    [...e("modulformen").children].forEach(x =>
      x.setAttribute("aria-pressed", x.dataset.form === modulform));
  }
  if (s.augenrahmen) e("augenrahmen").value = s.augenrahmen;
  if (s.augenkern) e("augenkern").value = s.augenkern;
  if (s.hintergrund) e("hintergrund").value = s.hintergrund;
  if (s.ruhezone !== undefined) e("ruhezone").value = s.ruhezone;
  if (s.logo !== undefined) e("logo").value = s.logo;
  if (typeof s.vordergrund === "string") {
    if (s.vordergrund.startsWith("cmyk(")) {
      e("farbwelt").value = "cmyk";
      const z = s.vordergrund.slice(5, -1).split(",");
      [["c",0],["m",1],["y",2],["k",3]].forEach(([id, i]) => { e(id).value = z[i]; });
    } else if (s.vordergrund.startsWith("sonder(")) {
      e("farbwelt").value = "sonder";
      const z = s.vordergrund.slice(7, -1).split(",");
      e("sondername").value = z[0];
      [["c",1],["m",2],["y",3],["k",4]].forEach(([id, i]) => { e(id).value = z[i]; });
    } else {
      e("farbwelt").value = "rgb";
      e("vordergrund").value = s.vordergrund;
    }
  } else if (s.vordergrund && s.vordergrund.stops) {
    e("farbwelt").value = "verlauf";
    e("verlaufart").value = s.vordergrund.art || "linear";
    e("winkel").value = s.vordergrund.winkel ?? 45;
    e("v1").value = s.vordergrund.stops[0].farbe;
    e("v2").value = s.vordergrund.stops[1].farbe;
  }
  e("farbwelt").dispatchEvent(new Event("change"));
  if (s.rahmen) {
    e("rahmenart").value = s.rahmen.art;
    e("rahmentext").value = s.rahmen.text || "";
    e("rahmenfarbe").value = s.rahmen.farbe || "#141018";
    e("rahmentextfarbe").value = s.rahmen.textfarbe || "#ffffff";
  } else {
    e("rahmenart").value = "keiner";
  }
}

e("e-sichern").addEventListener("click", async () => {
  const id = e("e-code").value;
  const name = e("e-name").value.trim();
  if (!id) return;
  if (!name) { eMelden("Ein Entwurf ohne Namen ist im Streifen nicht zu finden.", "schlecht"); return; }
  try {
    await eRuf("/api/v1/codes/" + encodeURIComponent(id) + "/entwuerfe", "POST",
               {name, stil: stil()});
    e("e-name").value = "";
    eMelden("„" + name + "\" ist gesichert.", "gut");
    eEntwuerfeHolen();
  } catch (fehler) { eMelden(fehler.message, "schlecht"); }
});

let warten;
function spaeter(f) { clearTimeout(warten); warten = setTimeout(f, 180); }
["breite","stufe","verfahren","ruhezone","logo","augenrahmen","augenkern","vordergrund",
 "hintergrund","c","m","y","k","sondername","v1","v2","verlaufart","winkel","rahmenart",
 "rahmentext","rahmenfarbe","rahmentextfarbe","kasse","abstand",
 "auf-kopf","auf-ruf"]
  .forEach(id => e(id).addEventListener("input", () => spaeter(zeichnen)));

felderZeichnen();
</script>
`
