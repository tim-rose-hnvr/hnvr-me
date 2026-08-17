package main

import (
	"fmt"
	"net/http"
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
		"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; "+
			"img-src 'self' data: blob:")
	fmt.Fprintf(w, studioSeite, m.Name, m.Grund, m.Tinte, m.Primaer, m.Name)
}

const studioSeite = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Studio · %s</title>
<style>
:root{
  --grund:%s; --tinte:%s; --primaer:%s;
  --flaeche:#fff; --tief:#f1f2f4; --linie:#dcdee3; --stark:#a9adb8; --leise:#5b6070;
  --gut:#0d5a4d; --gutgrund:#dfedea; --warn:#7e5300; --warngrund:#f6ecda;
  --schlecht:#a82e23; --schlechtgrund:#f7e7e5;
}
@media(prefers-color-scheme:dark){:root{
  --flaeche:#191a1f; --tief:#212228; --linie:#2f3138; --stark:#4c505c; --leise:#9aa0ae;
  --gut:#45b49c; --gutgrund:#152c28; --warn:#e0a63f; --warngrund:#2e2513;
  --schlecht:#f0705c; --schlechtgrund:#33201d;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--grund);color:var(--tinte);
  font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  -webkit-font-smoothing:antialiased}
.spur{max-width:1240px;margin:0 auto;padding:clamp(1rem,3vw,2rem)}
h1{font-size:1.35rem;margin:0;letter-spacing:-.02em}
.anriss{color:var(--leise);font-size:.92rem;margin:.2rem 0 1.4rem}
.raster{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:1.1rem;align-items:start}
@media(max-width:940px){.raster{grid-template-columns:1fr}}
.feld{background:var(--flaeche);border:1px solid var(--linie);border-radius:12px;overflow:hidden}
.kopf{padding:.65rem .95rem;border-bottom:1px solid var(--linie);background:var(--tief);
  font-size:.68rem;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--leise);
  display:flex;justify-content:space-between;align-items:baseline;gap:.75rem}
.koerper{padding:1rem;display:flex;flex-direction:column;gap:.8rem}
label{display:flex;flex-direction:column;gap:.25rem;font-size:.78rem;color:var(--leise)}
input,select,textarea{font:inherit;font-size:.9rem;padding:.5rem .6rem;border:1px solid var(--stark);
  border-radius:7px;background:var(--flaeche);color:var(--tinte);width:100%%;min-width:0}
input[type=color]{padding:.2rem;height:2.4rem;cursor:pointer}
input[type=range]{padding:0;accent-color:var(--primaer)}
textarea{resize:vertical;min-height:4.5rem}
.reihe{display:grid;grid-template-columns:1fr 1fr;gap:.55rem}
.reihe3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:.55rem}
.reiter{display:flex;flex-wrap:wrap;gap:.3rem;padding:.55rem .6rem;border-bottom:1px solid var(--linie);
  background:var(--tief)}
.reiter button{font:inherit;font-size:.8rem;font-weight:600;background:none;border:1px solid transparent;
  color:var(--leise);border-radius:6px;padding:.32rem .62rem;cursor:pointer}
.reiter button[aria-selected=true]{background:var(--flaeche);border-color:var(--linie);color:var(--tinte)}
.vorschau{display:grid;place-items:center;padding:1.6rem;background:
  repeating-conic-gradient(var(--tief) 0 25%%,transparent 0 50%%) 0 0/18px 18px;min-height:340px}
/* Die Vorschau fuellt die Flaeche. Das SVG traegt sein Millimetermass
   in sich; wer es hier klein anzeigt, weil 40 mm nun einmal klein sind,
   kann nichts beurteilen. Das wahre Mass steht in der Kopfzeile. */
.vorschau img{width:min(100%%,380px);height:auto;filter:drop-shadow(0 2px 12px rgba(0,0,0,.14))}
.urteil{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;font-size:.8rem;font-weight:700;
  letter-spacing:.07em;text-transform:uppercase;padding:.3rem .65rem;border-radius:5px;width:fit-content}
.u-gut{color:var(--gut);background:var(--gutgrund)}
.u-achtung{color:var(--warn);background:var(--warngrund)}
.u-kritisch{color:var(--schlecht);background:var(--schlechtgrund)}
.befund{font-size:.85rem;padding-left:.8rem;border-left:2px solid var(--stark);color:var(--leise)}
.befund b{color:var(--tinte);font-weight:600;display:block}
.befund.fehler{border-color:var(--schlecht)}
.befund.warnung{border-color:var(--warn)}
.zahlen{display:flex;flex-wrap:wrap;gap:.3rem 1.1rem;font-size:.78rem;color:var(--leise)}
.zahlen b{color:var(--tinte);font-variant-numeric:tabular-nums}
.knoepfe{display:flex;flex-wrap:wrap;gap:.45rem}
a.knopf,button.knopf{display:inline-block;font:inherit;font-size:.85rem;font-weight:650;
  text-decoration:none;padding:.5rem .8rem;border:1px solid var(--stark);border-radius:7px;
  color:var(--tinte);background:var(--flaeche);cursor:pointer}
a.knopf.stark{border-color:var(--primaer);color:var(--primaer)}
.hinweis{font-size:.8rem;color:var(--leise);border-left:2px solid var(--linie);padding-left:.8rem}
.messwert{font-size:.78rem;color:var(--leise);background:var(--tief);border-radius:7px;padding:.55rem .7rem}
.messwert b{color:var(--tinte)}
[hidden]{display:none!important}
.formen{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:.35rem}
.formen button{font:inherit;font-size:.72rem;padding:.4rem .2rem;border:1px solid var(--linie);
  border-radius:6px;background:var(--flaeche);color:var(--leise);cursor:pointer}
.formen button[aria-pressed=true]{border-color:var(--primaer);color:var(--primaer);font-weight:650}
</style>

<div class="spur">
  <h1>Studio</h1>
  <p class="anriss">Vor dem Druck wissen, ob er scannt. Alles rechnet dieser Server — %s</p>

  <div class="raster">
    <div>
      <div class="feld">
        <div class="kopf"><span>Vorschau</span><span id="masse"></span></div>
        <div class="vorschau"><img id="bild" alt="Vorschau des Codes"></div>
        <div class="koerper">
          <div id="urteil"></div>
          <div id="befunde" style="display:flex;flex-direction:column;gap:.5rem"></div>
          <div class="zahlen" id="zahlen"></div>
          <div class="knoepfe">
            <a class="knopf stark" id="a-svg" download="pnkt.svg">SVG</a>
            <a class="knopf stark" id="a-pdf" download="pnkt.pdf">PDF</a>
            <a class="knopf stark" id="a-eps" download="pnkt.eps">EPS</a>
            <button class="knopf" id="a-png" type="button">PNG 2048</button>
          </div>
          <p class="hinweis">SVG, PDF und EPS sind echter Vektor in Millimetermaß.
             PNG rechnet der Browser aus demselben SVG — für den Druck nimmt man es nicht.</p>
        </div>
      </div>
    </div>

    <div class="feld">
      <div class="reiter" role="tablist">
        <button role="tab" data-blatt="inhalt" aria-selected="true">Inhalt</button>
        <button role="tab" data-blatt="form" aria-selected="false">Form</button>
        <button role="tab" data-blatt="farbe" aria-selected="false">Farbe</button>
        <button role="tab" data-blatt="rahmen" aria-selected="false">Rahmen</button>
        <button role="tab" data-blatt="druck" aria-selected="false">Druck</button>
      </div>

      <div class="koerper" data-blatt="inhalt">
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

      <div class="koerper" data-blatt="form" hidden>
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

      <div class="koerper" data-blatt="farbe" hidden>
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

      <div class="koerper" data-blatt="rahmen" hidden>
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

      <div class="koerper" data-blatt="druck" hidden>
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
    </div>
  </div>
</div>

<script>
const e = (id) => document.getElementById(id);
const FORMEN = ["quadrat","punkt","rund","weich","mosaik","raute","kreuz","stern",
                "querstriche","laengsstriche","fliessend"];
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

let warten;
function spaeter(f) { clearTimeout(warten); warten = setTimeout(f, 180); }
["breite","stufe","verfahren","ruhezone","logo","augenrahmen","augenkern","vordergrund",
 "hintergrund","c","m","y","k","sondername","v1","v2","verlaufart","winkel","rahmenart",
 "rahmentext","rahmenfarbe","rahmentextfarbe","kasse","abstand"]
  .forEach(id => e(id).addEventListener("input", () => spaeter(zeichnen)));

felderZeichnen();
</script>
`
