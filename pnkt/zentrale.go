package main

import (
	"fmt"
	"net/http"

	"pnkt.me/pnkt/gestalt"
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
		"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; "+
			"font-src 'self'; img-src 'self' data:")
	fmt.Fprintf(w, zentraleSeite, m.Name, gestalt.Kopf(),
		m.Grund, m.Tinte, m.Primaer, gestalt.MarkeLockup(m.Name, "/", false), m.Name)
}

const zentraleSeite = `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Zentrale · %s</title>
%s
<style>
:root{--color-bg:%s;--color-text:%s;--color-accent:%s}
body{background:var(--color-bg);color:var(--color-text);
 font-family:var(--font-body);font-size:15px;line-height:1.55}
h1{font-family:var(--font-heading);font-size:1.5rem;letter-spacing:-.02em;margin:0}
.anriss{color:color-mix(in srgb,var(--color-text) 62%%,transparent);
 font-size:.92rem;margin:.25rem 0 1.5rem}
.anriss a{color:var(--color-accent-700)}
.reihe{display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin:0}
@media(max-width:640px){.reihe{grid-template-columns:1fr}}
.ordner{display:flex;flex-wrap:wrap;gap:.35rem;padding:.6rem .7rem;
 border-bottom:1px solid color-mix(in srgb,var(--color-text) 10%%,transparent)}
.ordner button{font:inherit;font-size:.82rem;font-weight:600;cursor:pointer;
 background:none;border:1px solid transparent;border-radius:999px;padding:.35rem .7rem;
 color:color-mix(in srgb,var(--color-text) 68%%,transparent)}
.ordner button[aria-pressed=true]{background:var(--color-accent);color:var(--color-bg)}
.ordner button:hover{color:var(--color-text)}
.ordner button[aria-pressed=true]:hover{color:var(--color-bg)}
.ordner .zahl{opacity:.65;font-weight:400;margin-left:.35rem}
/* Auf dem aktiven Reiter steht die Zahl auf Terrakotta. Mit .65 Deckung
   verschwindet sie dort fast — auf hellem Grund reicht sie, hier nicht. */
.ordner button[aria-pressed=true] .zahl{opacity:.9;color:var(--color-bg)}
.ziel{color:color-mix(in srgb,var(--color-text) 62%%,transparent);
 overflow-wrap:anywhere;max-width:26rem;display:block}
.tun{display:flex;gap:.4rem;justify-content:flex-end}
.tun button,.tun .knopf{font:inherit;font-size:.8rem;cursor:pointer;text-decoration:none;
 background:var(--color-bg);border:1px solid color-mix(in srgb,var(--color-text) 14%%,transparent);
 color:var(--color-text);border-radius:999px;padding:.35rem .75rem}
.tun button:hover,.tun .knopf:hover{border-color:var(--color-accent)}
.tun button.weg{color:#a82e23;border-color:color-mix(in srgb,#a82e23 45%%,transparent)}
.tun button.weg:hover{background:#a82e23;color:var(--color-bg)}
.zahl{color:color-mix(in srgb,var(--color-text) 62%%,transparent);font-size:.85rem}
.hinweis{font-size:.78rem;color:color-mix(in srgb,var(--color-text) 58%%,transparent);margin:0}
.zumachen{font:inherit;font-size:.78rem;cursor:pointer;background:none;border:none;
 color:var(--color-accent-700);text-decoration:underline;margin-left:.7rem;padding:0}
</style>

<a href="#inhalt" class="ueberspringen">Zum Inhalt</a>
<header class="werkkopf">
  <div class="werkkopf-innen">
    %s
    <nav class="werkwege" aria-label="Bereiche">
      <a class="werkweg" href="/">Studio</a>
      <a class="werkweg werkweg-aktiv" href="/zentrale" aria-current="page">Zentrale</a>
      <a class="werkweg" href="/landeseite">Landeseite</a>
      <a class="werkweg" href="/serie">Serie</a>
      <a class="werkweg" href="/zahlen">Zahlen</a>
    </nav>
  </div>
</header>

<main id="inhalt" class="spur">
  <h1>Zentrale · %s</h1>
  <p class="anriss">Suchen, ordnen, löschen. Zum Bauen geht es ins <a href="/">Studio</a>.</p>

  <div class="tafel">
    <div class="tafel-kopf"><span>Zugang</span><span id="stand"></span></div>
    <div class="tafel-koerper">
      <form class="reihe" onsubmit="return false">
        <label class="feld">Schlüssel
          <input class="eingabe" id="schluessel" type="password"
                 placeholder="x-punkt-schluessel" autocomplete="off">
        </label>
        <label class="feld">Suche
          <input class="eingabe" id="suche" type="search"
                 placeholder="Name, Kürzel, Ziel, GTIN, Ordner">
        </label>
      </form>
      <p class="hinweis">Der Schlüssel bleibt im Tab und wird beim Schließen vergessen.
        Gespeichert wird er nirgends — auf dem Server liegt ohnehin nur sein SHA-256-Abdruck.</p>
    </div>
  </div>

  <div class="tafel" style="margin-top:1.1rem">
    <div id="ordner" class="ordner"></div>
    <div id="meldung"></div>
    <div id="liste"></div>
  </div>

  <div class="tafel" id="passfeld" style="margin-top:1.1rem" hidden>
    <div class="tafel-kopf"><span>Produktpässe</span><span id="passstand"></span></div>
    <div id="passliste"></div>
  </div>
</main>

<div class="einschub-grund" id="einschubgrund" hidden></div>
<aside class="einschub" id="einschub" role="dialog" aria-modal="true"
       aria-labelledby="einschubtitel" hidden>
  <div class="einschub-kopf">
    <h2 id="einschubtitel"></h2>
    <button type="button" class="einschub-zu" id="einschubzu"
            aria-label="Schließen">&times;</button>
  </div>
  <div class="einschub-koerper" id="einschubkoerper"></div>
</aside>

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
    ladePaesse();
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

// Die geholten Codes bleiben nach Kennung greifbar. Es gibt keinen Weg,
// der einen einzelnen Code liest — und es braucht auch keinen: die Liste
// hat ihn gerade mitgebracht.
let bekannteCodes = new Map();

function zeigeListe(codes){
  bekannteCodes = new Map(codes.map(c => [c.id, c]));
  if (!codes.length){
    e("liste").innerHTML = '<div class="leer">Nichts gefunden.</div>';
    return;
  }
  let html = '<table class="liste"><thead><tr><th>Name</th><th>Kürzel</th><th>Ordner</th>' +
             '<th>Ziel</th><th></th></tr></thead><tbody>';
  for (const c of codes){
    html += '<tr>' +
      '<td>' + sicher(c.name || "ohne Namen") + '</td>' +
      '<td class="einsilbig">' + sicher(c.kuerzel) + '</td>' +
      '<td>' + sicher(c.ordner || "—") + '</td>' +
      '<td><span class="ziel">' + sicher(c.gtin ? ("GTIN " + c.gtin + " → " + (c.ziel||"")) : c.ziel) + '</span></td>' +
      '<td><div class="tun">' +
        '<button type="button" data-tun="einschub" data-id="' + sicher(c.id) + '">Ansehen</button>' +
      '</div></td></tr>';
  }
  e("liste").innerHTML = html + '</tbody></table>';
}

// Produktpässe. Sie hängen an der GTIN, nicht am Code — deshalb eine
// eigene Liste und kein Feld in der Codetabelle.
async function ladePaesse(){
  try {
    const paesse = await ruf("/api/v1/pass") || [];
    e("passfeld").hidden = paesse.length === 0;
    e("passstand").textContent = paesse.length + (paesse.length === 1 ? " Pass" : " Pässe");
    e("passliste").innerHTML = paesse.length ? passTabelle(paesse) : "";
  } catch (_) {
    // Ein Fehler hier darf die Codeliste nicht mitreißen.
    e("passfeld").hidden = true;
  }
}

function passTabelle(paesse){
  let html = '<table class="liste"><thead><tr><th>GTIN</th><th>Artikel</th><th>Charge</th>' +
             '<th>Fassung</th><th></th></tr></thead><tbody>';
  for (const p of paesse){
    html += '<tr>' +
      '<td class="einsilbig">' + sicher(p.gtin) + '</td>' +
      '<td>' + sicher(p.bezeichnung) + (p.modell ? ' <span class="zahl">' + sicher(p.modell) + '</span>' : '') + '</td>' +
      '<td>' + sicher(p.charge || "—") + '</td>' +
      '<td>' + p.fassung + '</td>' +
      '<td><div class="tun">' +
        '<a class="knopf" href="/p/' + encodeURIComponent(p.gtin) + '" target="_blank" rel="noopener">Ansehen</a>' +
        '<button type="button" class="weg" data-tun="passweg" data-gtin="' + sicher(p.gtin) + '" ' +
          'data-name="' + sicher(p.bezeichnung) + '">Zurückziehen</button>' +
      '</div></td></tr>';
  }
  return html + '</tbody></table>';
}

e("passliste").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button");
  if (!b || b.dataset.tun !== "passweg") return;
  if (!confirm("Den Produktpass für „" + b.dataset.name + "\" zurückziehen?\n\n" +
               "Die öffentliche Seite antwortet danach mit „kein Produktpass\". " +
               "Der Eintrag bleibt in der Ablage stehen.")) return;
  try {
    await ruf("/api/v1/pass/" + encodeURIComponent(b.dataset.gtin), "DELETE");
    ladePaesse();
  } catch (fehler) { melde(fehler.message); }
});

e("ordner").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  ordnerWahl = b.dataset.ordner;
  laden();
});

e("liste").addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b || b.dataset.tun !== "einschub") return;
  einschubAuf(b.dataset.id, b);
});

// --- Einschub -----------------------------------------------------------
//
// Ein Code wird angetippt, das Blatt faehrt von rechts ein und zeigt
// alles zu ihm: Ziel, Zahlen, Verlauf, und was man damit tun kann. Die
// Liste bleibt stehen. Wer einen Code prueft, prueft danach den
// naechsten — eine eigene Seite kostet jedes Mal den Weg zurueck.
//
// Der Verlauf steckt darin, nicht mehr als eigener Kasten: die Ablage
// haengt nur an, jede Aenderung ist ein neuer Satz. Diese Geschichte
// braucht man genau dann, wenn jemand fragt, wohin ein Code im Maerz
// gezeigt hat — also waehrend man diesen einen Code ansieht.

let einschubID = "";
let einschubRueckkehr = null; // wohin der Tastaturfokus danach gehoert

function einschubOffen(){ return !e("einschub").hidden; }

async function einschubAuf(id, ausloeser){
  const c = bekannteCodes.get(id);
  if (!c) return;
  einschubID = id;
  einschubRueckkehr = ausloeser || null;

  e("einschubtitel").textContent = c.name || c.kuerzel;
  e("einschubkoerper").innerHTML = '<div class="leer">wird geholt …</div>';

  e("einschubgrund").hidden = false;
  e("einschub").hidden = false;
  // Ein Umbruch zwischen "da" und "offen", sonst faengt der Uebergang
  // beim Endwert an und es faehrt nichts.
  void e("einschub").offsetWidth;
  e("einschubgrund").classList.add("offen");
  e("einschub").classList.add("offen");
  e("einschubzu").focus();

  // Beides zugleich holen; scheitert eines, faellt nicht alles aus.
  const [stand, fassungen] = await Promise.all([
    ruf("/api/v1/codes/" + encodeURIComponent(id) + "/statistik").catch(() => null),
    ruf("/api/v1/codes/" + encodeURIComponent(id) + "/fassungen").catch(() => null),
  ]);
  if (einschubID !== id) return; // inzwischen woanders
  e("einschubkoerper").innerHTML = einschubInhalt(c, stand, fassungen);
}

function einschubZu(){
  if (!einschubOffen()) return;
  e("einschubgrund").classList.remove("offen");
  e("einschub").classList.remove("offen");
  einschubID = "";
  // Erst nach der Fahrt aus dem Baum nehmen, sonst springt es weg
  // statt zu fahren. Ohne Bewegung ist die Dauer 0 und es passiert
  // sofort — auch das ist richtig.
  const dauer = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 300;
  setTimeout(() => {
    if (einschubID) return; // zwischenzeitlich neu geoeffnet
    e("einschub").hidden = true;
    e("einschubgrund").hidden = true;
  }, dauer);
  if (einschubRueckkehr && document.contains(einschubRueckkehr)) einschubRueckkehr.focus();
  einschubRueckkehr = null;
}

function einschubInhalt(c, stand, fassungen){
  const tage = stand || [];
  const scans = tage.reduce((summe, t) => summe + (t.gesamt || 0), 0);
  const weiter = tage.reduce((summe, t) => summe + ((t.zaehler || {})["schritt:weiter"] || 0), 0);
  const letzter = tage.map(t => t.tag).sort().pop() || "—";

  let html = "";

  html += '<div class="einschub-block"><h3>Ziel</h3>' +
    '<p class="ziel" style="max-width:none">' + sicher(c.ziel || "—") + '</p>' +
    '<p class="hinweis">Kurzweg <b>/r/' + sicher(c.kuerzel) + '</b>' +
    (c.ordner ? ' · Ordner <b>' + sicher(c.ordner) + '</b>' : ' · ohne Ordner') +
    (c.gtin ? ' · GTIN <b>' + sicher(c.gtin) + '</b>' : '') + '</p></div>';

  html += '<div class="einschub-block"><h3>Zahlen</h3>' +
    '<p class="zahl">' + scans + (scans === 1 ? ' Scan' : ' Scans') +
    ' · ' + weiter + ' mal weitergegangen · zuletzt ' + sicher(letzter) + '</p>' +
    (scans === 0
      ? '<p class="hinweis">Noch nichts gezählt. Gezählt wird der Aufruf des Kurzwegs — ' +
        'eine Vorschau zählt nicht mit.</p>'
      : '<p class="hinweis">Weiter reicht die Messung nicht: sobald jemand auf einer ' +
        'fremden Seite ist, hört sie auf.</p>') + '</div>';

  html += '<div class="einschub-block"><h3>Verlauf</h3>' + einschubFassungen(fassungen) + '</div>';

  html += '<div class="einschub-block"><h3>Tun</h3><div class="tun" style="justify-content:flex-start">' +
    '<a class="knopf" href="/r/' + encodeURIComponent(c.kuerzel) + '/vorschau" ' +
      'target="_blank" rel="noopener">Ziel ansehen</a>' +
    '<button type="button" data-tun="ordner">Ordner</button>' +
    '<button type="button" class="weg" data-tun="loeschen">Löschen</button>' +
    '</div><p class="hinweis">Die Vorschau zeigt das Ziel, ohne hinzugehen und ohne zu zählen.</p></div>';

  return html;
}

function einschubFassungen(fassungen){
  if (!fassungen || !fassungen.length) return '<p class="hinweis">Kein Verlauf lesbar.</p>';
  // Neueste oben: danach sucht man zuerst.
  const umgekehrt = fassungen.slice().reverse();
  const jetzt = umgekehrt[0].fassung;
  const stand = (f) => JSON.stringify([f.ziel, f.name || "", f.ordner || ""]);
  const giltStand = stand(umgekehrt[0]);

  let html = '<table class="liste"><thead><tr><th>Fassung</th><th>Wann</th>' +
             '<th>Ziel</th><th></th></tr></thead><tbody>';
  for (const f of umgekehrt){
    const gilt = f.fassung === jetzt;
    // Eine aeltere Fassung kann denselben Stand tragen wie die geltende
    // — etwa direkt nach einem Zurueckholen. Dann gibt es nichts zu
    // holen, und ein Knopf, der nur 409 ergibt, ist eine Falle.
    const gleich = !gilt && stand(f) === giltStand;
    html += '<tr>' +
      '<td class="einsilbig">' + f.fassung + (gilt ? ' <span class="zahl">gilt</span>' : '') + '</td>' +
      '<td>' + sicher(String(f.geaendert || f.erstellt).slice(0, 16).replace("T", " ")) + '</td>' +
      '<td><span class="ziel">' + sicher(f.ziel) + '</span></td>' +
      '<td><div class="tun">' + (gilt ? '' : (gleich
        ? '<span class="zahl">gleicher Stand</span>'
        : '<button type="button" data-tun="holen" data-fassung="' + f.fassung + '" ' +
          'data-ziel="' + sicher(f.ziel) + '">Zurückholen</button>')) +
      '</div></td></tr>';
  }
  return html + '</tbody></table>';
}

e("einschubkoerper").addEventListener("click", async (ev) => {
  const b = ev.target.closest("button");
  if (!b || !einschubID) return;
  const c = bekannteCodes.get(einschubID);
  if (!c) return;
  try {
    if (b.dataset.tun === "ordner"){
      const name = prompt("In welchen Ordner? Leer lassen heißt: kein Ordner.", c.ordner || "");
      if (name === null) return;
      await ruf("/api/v1/codes/" + encodeURIComponent(c.id), "PATCH", {ordner: name});
      const id = c.id;
      await laden();
      await einschubAuf(id, einschubRueckkehr);
      return;
    }
    if (b.dataset.tun === "loeschen"){
      const antwort = prompt(
        "Löschen entfernt das Ziel. Das Kürzel " + c.kuerzel +
        " bleibt dauerhaft reserviert und wird nie erneut vergeben — " +
        "ein gedruckter Code zeigt danach auf eine Hinweisseite.\n\n" +
        "Zum Bestätigen das Kürzel eintippen:");
      if (antwort === null) return;
      if (antwort.trim().toLowerCase() !== c.kuerzel.toLowerCase()){
        melde("Kürzel stimmt nicht — nichts gelöscht.");
        return;
      }
      await ruf("/api/v1/codes/" + encodeURIComponent(c.id), "DELETE");
      einschubZu();
      laden();
      return;
    }
    if (b.dataset.tun === "holen"){
      if (!confirm("Fassung " + b.dataset.fassung + " zurückholen?\n\n" +
                   "Das Ziel wird wieder " + b.dataset.ziel + ".\n" +
                   "Überschrieben wird nichts: es entsteht eine neue Fassung, " +
                   "und der bisherige Stand bleibt im Verlauf stehen.")) return;
      await ruf("/api/v1/codes/" + encodeURIComponent(c.id) +
                "/fassungen/" + encodeURIComponent(b.dataset.fassung), "POST");
      const id = c.id;
      await laden();
      await einschubAuf(id, einschubRueckkehr);
      return;
    }
  } catch (fehler) { melde(fehler.message); }
});

e("einschubzu").addEventListener("click", einschubZu);
e("einschubgrund").addEventListener("click", einschubZu);

// Der Fokus bleibt im Blatt, solange es offen ist. Ohne das laeuft die
// Tabulatortaste hinter den Grund und man bedient blind eine Liste, die
// man nicht sieht.
document.addEventListener("keydown", (ev) => {
  if (!einschubOffen()) return;
  if (ev.key === "Escape"){ einschubZu(); return; }
  if (ev.key !== "Tab") return;
  const greifbar = e("einschub").querySelectorAll(
    "a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex='-1'])");
  if (!greifbar.length) return;
  const erster = greifbar[0], letzter = greifbar[greifbar.length - 1];
  if (ev.shiftKey && document.activeElement === erster){ ev.preventDefault(); letzter.focus(); }
  else if (!ev.shiftKey && document.activeElement === letzter){ ev.preventDefault(); erster.focus(); }
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
