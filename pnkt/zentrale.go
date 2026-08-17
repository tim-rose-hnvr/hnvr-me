package main

import (
	"fmt"
	"net/http"
)

// zentrale ist die Verwaltung: suchen, ordnen, loeschen. Das Studio baut
// Codes, die Zentrale fuehrt sie — eine Agentur legt selten einen Code an,
// sondern vierhundert, und findet ihn ein halbes Jahr spaeter wieder.
//
// Die Seite liegt als Text im Binaer, wie das Studio: keine Datei daneben,
// kein CDN, keine fremde Schrift. Die Marke kommt aus dem Hostnamen.
func (d *dienst) zentrale(w http.ResponseWriter, r *http.Request) {
	m := d.ablage.MarkeNachHost(r.Host)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy",
		"default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; "+
			"img-src 'self' data:")
	fmt.Fprintf(w, zentraleSeite, m.Name, m.Grund, m.Tinte, m.Primaer, m.Name)
}

const zentraleSeite = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zentrale · %s</title>
<style>
:root{
  --grund:%s; --tinte:%s; --primaer:%s;
  --flaeche:#fff; --tief:#f1f2f4; --linie:#dcdee3; --stark:#a9adb8; --leise:#5b6070;
  --schlecht:#a82e23; --schlechtgrund:#f7e7e5;
}
@media(prefers-color-scheme:dark){:root{
  --flaeche:#191a1f; --tief:#212228; --linie:#2f3138; --stark:#4c505c; --leise:#9aa0ae;
  --schlecht:#f0705c; --schlechtgrund:#33201d;
}}
*{box-sizing:border-box}
body{margin:0;background:var(--grund);color:var(--tinte);
  font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
  -webkit-font-smoothing:antialiased}
.spur{max-width:1240px;margin:0 auto;padding:clamp(1rem,3vw,2rem)}
h1{font-size:1.35rem;margin:0;letter-spacing:-.02em}
.anriss{color:var(--leise);font-size:.92rem;margin:.2rem 0 1.4rem}
.anriss a{color:inherit}
.feld{background:var(--flaeche);border:1px solid var(--linie);border-radius:12px;overflow:hidden;
  margin-bottom:1.1rem}
.kopf{padding:.65rem .95rem;border-bottom:1px solid var(--linie);background:var(--tief);
  font-size:.68rem;font-weight:700;letter-spacing:.11em;text-transform:uppercase;color:var(--leise);
  display:flex;justify-content:space-between;align-items:baseline;gap:.75rem}
.koerper{padding:1rem;display:flex;flex-direction:column;gap:.8rem}
label{display:flex;flex-direction:column;gap:.25rem;font-size:.78rem;color:var(--leise)}
input{font:inherit;font-size:.9rem;padding:.5rem .6rem;border:1px solid var(--stark);
  border-radius:7px;background:var(--flaeche);color:var(--tinte);width:100%%;min-width:0}
.reihe{display:grid;grid-template-columns:1fr 1fr;gap:.55rem;margin:0}
@media(max-width:640px){.reihe{grid-template-columns:1fr}}
.ordner{display:flex;flex-wrap:wrap;gap:.3rem;padding:.55rem .6rem;border-bottom:1px solid var(--linie);
  background:var(--tief)}
.ordner button{font:inherit;font-size:.8rem;font-weight:600;background:none;
  border:1px solid transparent;color:var(--leise);border-radius:6px;padding:.32rem .62rem;cursor:pointer}
.ordner button[aria-pressed=true]{background:var(--flaeche);border-color:var(--linie);color:var(--tinte)}
.ordner .zahl{opacity:.6;font-weight:400;margin-left:.3rem}
table{width:100%%;border-collapse:collapse;font-size:.88rem}
th{text-align:left;font-size:.68rem;letter-spacing:.09em;text-transform:uppercase;color:var(--leise);
  font-weight:700;padding:.5rem .8rem;border-bottom:1px solid var(--linie)}
td{padding:.55rem .8rem;border-bottom:1px solid var(--linie);vertical-align:top}
tr:last-child td{border-bottom:none}
.kuerzel{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.85rem}
.ziel{color:var(--leise);overflow-wrap:anywhere;max-width:26rem;display:block}
.tun{display:flex;gap:.35rem;justify-content:flex-end}
.tun button{font:inherit;font-size:.78rem;background:var(--tief);border:1px solid var(--linie);
  color:var(--tinte);border-radius:6px;padding:.28rem .55rem;cursor:pointer}
.tun button.weg{color:var(--schlecht);border-color:var(--schlecht)}
.leer{padding:2.2rem 1rem;text-align:center;color:var(--leise);font-size:.9rem}
.meldung{padding:.7rem .95rem;font-size:.85rem;background:var(--schlechtgrund);color:var(--schlecht)}
.hinweis{font-size:.78rem;color:var(--leise);margin:0}
</style>

<div class="spur">
  <h1>Zentrale · %s</h1>
  <p class="anriss">Suchen, ordnen, löschen. Zum Bauen geht es ins <a href="/">Studio</a>.</p>

  <div class="feld">
    <div class="kopf"><span>Zugang</span><span id="stand"></span></div>
    <div class="koerper">
      <form class="reihe" onsubmit="return false">
        <label>Schlüssel
          <input id="schluessel" type="password" placeholder="x-punkt-schluessel" autocomplete="off">
        </label>
        <label>Suche
          <input id="suche" type="search" placeholder="Name, Kürzel, Ziel, GTIN, Ordner">
        </label>
      </form>
      <p class="hinweis">Der Schlüssel bleibt im Tab und wird beim Schließen vergessen.
        Gespeichert wird er nirgends — auf dem Server liegt ohnehin nur sein SHA-256-Abdruck.</p>
    </div>
  </div>

  <div class="feld">
    <div id="ordner" class="ordner"></div>
    <div id="meldung"></div>
    <div id="liste"></div>
  </div>
</div>

<script>
const e = (id) => document.getElementById(id);
let ordnerWahl = "";
let holen = null;

// Der Schluessel lebt im Tab, nicht auf der Platte. Ein geteilter Rechner
// soll ihn nicht ueberdauern.
e("schluessel").value = sessionStorage.getItem("pnkt-schluessel") || "";

function sicher(wert){
  return String(wert == null ? "" : wert)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function schluessel(){ return e("schluessel").value.trim(); }

async function ruf(weg, art, rumpf){
  const kopf = {"x-punkt-schluessel": schluessel()};
  if (rumpf) kopf["Content-Type"] = "application/json";
  const antwort = await fetch(weg, {
    method: art || "GET", headers: kopf,
    body: rumpf ? JSON.stringify(rumpf) : undefined
  });
  const text = await antwort.text();
  let wert = null;
  try { wert = text ? JSON.parse(text) : null; } catch (_) { wert = null; }
  if (!antwort.ok) throw new Error((wert && wert.fehler) || ("Fehler " + antwort.status));
  return wert;
}

function melde(text){
  e("meldung").innerHTML = text ? '<div class="meldung">' + sicher(text) + '</div>' : "";
}

async function laden(){
  if (!schluessel()){
    e("stand").textContent = "kein Schlüssel";
    e("ordner").innerHTML = "";
    e("liste").innerHTML = '<div class="leer">Schlüssel eintragen, dann erscheinen die Codes.</div>';
    return;
  }
  const wort = e("suche").value.trim();
  try {
    const ordner = await ruf("/api/v1/ordner");
    // Ein Ordner verschwindet, wenn sein letzter Code geht. Dann wieder
    // alles zeigen — sonst steht man vor einer leeren Liste unter einem
    // Reiter, den es nicht mehr gibt.
    if (ordnerWahl && !ordnerDa(ordner, ordnerWahl)) ordnerWahl = "";
    const codes = await ruf("/api/v1/codes?suche=" + encodeURIComponent(wort) +
                            "&ordner=" + encodeURIComponent(ordnerWahl));
    melde("");
    zeigeOrdner(ordner || []);
    zeigeListe(codes || []);
    e("stand").textContent = (codes || []).length + " Codes";
    sessionStorage.setItem("pnkt-schluessel", schluessel());
  } catch (fehler) {
    melde(fehler.message);
    e("stand").textContent = "";
    e("liste").innerHTML = "";
  }
}

function ordnerDa(stand, wahl){
  return (stand || []).some(o => wahl === "-" ? o.name === "" : o.name === wahl);
}

function zeigeOrdner(stand){
  const gesamt = stand.reduce((summe, o) => summe + o.anzahl, 0);
  const knopf = (wert, beschriftung, anzahl) =>
    '<button type="button" data-ordner="' + sicher(wert) + '" aria-pressed="' +
    (wert === ordnerWahl) + '">' + sicher(beschriftung) +
    '<span class="zahl">' + anzahl + '</span></button>';

  let html = knopf("", "Alle", gesamt);
  for (const o of stand){
    html += o.name === ""
      ? knopf("-", "Ohne Ordner", o.anzahl)
      : knopf(o.name, o.name, o.anzahl);
  }
  e("ordner").innerHTML = html;
}

function zeigeListe(codes){
  if (!codes.length){
    e("liste").innerHTML = '<div class="leer">Nichts gefunden.</div>';
    return;
  }
  let html = '<table><thead><tr><th>Name</th><th>Kürzel</th><th>Ordner</th>' +
             '<th>Ziel</th><th></th></tr></thead><tbody>';
  for (const c of codes){
    html += '<tr>' +
      '<td>' + sicher(c.name || "ohne Namen") + '</td>' +
      '<td class="kuerzel">' + sicher(c.kuerzel) + '</td>' +
      '<td>' + sicher(c.ordner || "—") + '</td>' +
      '<td><span class="ziel">' + sicher(c.gtin ? ("GTIN " + c.gtin + " → " + (c.ziel||"")) : c.ziel) + '</span></td>' +
      '<td><div class="tun">' +
        '<button type="button" data-tun="ordner" data-id="' + sicher(c.id) + '" ' +
          'data-wert="' + sicher(c.ordner || "") + '">Ordner</button>' +
        '<button type="button" class="weg" data-tun="loeschen" data-id="' + sicher(c.id) + '" ' +
          'data-kuerzel="' + sicher(c.kuerzel) + '">Löschen</button>' +
      '</div></td></tr>';
  }
  e("liste").innerHTML = html + '</tbody></table>';
}

e("ordner").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  ordnerWahl = b.dataset.ordner;
  laden();
});

e("liste").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.tun === "ordner"){
      const name = prompt("In welchen Ordner? Leer lassen heißt: kein Ordner.", b.dataset.wert);
      if (name === null) return;
      await ruf("/api/v1/codes/" + encodeURIComponent(b.dataset.id), "PATCH", {ordner: name});
    }
    if (b.dataset.tun === "loeschen"){
      const sicherheit = prompt(
        "Löschen entfernt das Ziel. Das Kürzel " + b.dataset.kuerzel +
        " bleibt dauerhaft reserviert und wird nie erneut vergeben — " +
        "ein gedruckter Code zeigt danach auf eine Hinweisseite.\n\n" +
        "Zum Bestätigen das Kürzel eintippen:");
      if (sicherheit === null) return;
      if (sicherheit.trim().toLowerCase() !== b.dataset.kuerzel.toLowerCase()){
        melde("Kürzel stimmt nicht — nichts gelöscht.");
        return;
      }
      await ruf("/api/v1/codes/" + encodeURIComponent(b.dataset.id), "DELETE");
    }
    laden();
  } catch (fehler) {
    melde(fehler.message);
  }
});

// Tippen loest nicht bei jedem Anschlag eine Anfrage aus.
for (const id of ["schluessel", "suche"]){
  e(id).addEventListener("input", () => {
    clearTimeout(holen);
    holen = setTimeout(laden, 250);
  });
}

laden();
</script>
`
