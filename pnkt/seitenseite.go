package main

import (
	"encoding/json"
	"fmt"
	"net/http"

	"pnkt.me/pnkt/gestalt"
	"pnkt.me/pnkt/seite"
	"pnkt.me/pnkt/speicher"
)

// landeseite ist der Editor: links tippen, rechts sofort sehen.
//
// Die Vorschau steht daneben und nicht hinter einem Knopf. Wer eine
// Speisekarte eintippt, tippt zwanzig Zeilen; erfaehrt er erst danach,
// dass die Anordnung nicht passt, tippt er sie nicht noch einmal.
//
// Die Vorschau ist ein iframe auf dieselbe Zeichnung, die spaeter
// ausgeliefert wird — kein Nachbau. Ein Nachbau laeuft auseinander,
// und dann zeigt die Vorschau etwas anderes als der Scan.
func (d *dienst) landeseite(w http.ResponseWriter, r *http.Request) {
	m := d.ablage.MarkeNachHost(r.Host)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy",
		// frame-src 'self': die Vorschau ist ein Rahmen auf den eigenen
		// Dienst. Ohne die Angabe bleibt er leer, und zwar lautlos.
		"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; "+
			"font-src 'self'; img-src 'self' data:; frame-src 'self'")
	fmt.Fprintf(w, landeseiteSeite, m.Name, gestalt.Kopf(),
		m.Grund, m.Tinte, m.Primaer, gestalt.MarkeLockup(m.Name, "/", false),
		gestalt.IconJS())
}

// seiteVorschau zeichnet eine ungespeicherte Seite. Sie schreibt nichts
// und braucht deshalb keinen Schluessel — es sind die Daten, die der
// Aufrufer gerade selbst geschickt hat.
func (d *dienst) seiteVorschau(w http.ResponseWriter, r *http.Request) {
	var s speicher.Seite
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&s); err != nil {
		d.hinweisMitMarke(w, r, http.StatusBadRequest, "Nicht lesbar", err.Error())
		return
	}
	if fehler := s.Pruefe(); len(fehler) > 0 {
		// Auch eine unfertige Seite wird gezeichnet: waehrend des
		// Tippens ist sie fast immer unfertig, und eine Vorschau, die
		// dann nichts zeigt, ist keine.
		if s.Titel == "" {
			s.Titel = "Ohne Titel"
		}
		if _, da := speicher.VorlageNach(s.Vorlage); !da {
			s.Vorlage = "info"
		}
	}
	roh, err := seite.Zeichne(&s, d.ablage.MarkeNachHost(r.Host), "#")
	if err != nil {
		d.hinweisMitMarke(w, r, http.StatusInternalServerError, "Nicht darstellbar", err.Error())
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy",
		"default-src 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; "+
			"img-src 'self' data:; form-action 'none'; base-uri 'none'")
	w.Header().Set("Cache-Control", "no-store")
	_, _ = w.Write(roh)
}

const landeseiteSeite = `<!doctype html>
<html lang="de">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Landeseite · %s</title>
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
.raster{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:1.1rem;align-items:start}
@media(max-width:1040px){.raster{grid-template-columns:1fr}}
label{display:flex;flex-direction:column;gap:.3rem;font-size:.7rem;font-weight:600;
 letter-spacing:.04em;text-transform:uppercase;color:var(--leise)}
input,select,textarea{font:inherit;font-size:.9rem;padding:.5rem .65rem;
 border:1px solid color-mix(in srgb,var(--color-text) 22%%,transparent);
 border-radius:var(--radius-md);background:var(--color-bg);color:var(--color-text);
 width:100%%;min-width:0;text-transform:none;letter-spacing:normal;font-weight:400}
input:focus-visible,select:focus-visible,textarea:focus-visible{border-color:var(--color-accent)}
textarea{resize:vertical;min-height:5rem}
.reihe{display:grid;grid-template-columns:1fr 1fr;gap:.5rem}
.reihe3{display:grid;grid-template-columns:2fr 1fr auto;gap:.5rem;align-items:end}
.knoepfe{display:flex;flex-wrap:wrap;gap:.45rem}
button.knopf,a.knopf{display:inline-flex;align-items:center;gap:.4rem;font:inherit;
 font-size:.85rem;font-weight:600;text-decoration:none;padding:.5rem .9rem;
 border:1px solid color-mix(in srgb,var(--color-text) 14%%,transparent);
 border-radius:999px;color:var(--color-text);background:var(--color-bg);cursor:pointer}
button.knopf:hover,a.knopf:hover{border-color:var(--color-accent)}
button.knopf.stark{background:var(--color-accent);color:var(--color-bg);
 border-color:var(--color-accent)}
button.knopf.stark:hover{background:var(--color-accent-600);border-color:var(--color-accent-600)}
button.knopf[disabled]{opacity:.45;cursor:not-allowed}
button.klein{font-size:.78rem;padding:.3rem .6rem;background:none;border:none;
 color:var(--color-accent-700);cursor:pointer;text-decoration:underline}
button.klein.weg{color:#a82e23}
.hinweis{font-size:.8rem;color:var(--leise);border-left:2px solid var(--linie);
 padding-left:.85rem;margin:0}
.block{background:var(--color-bg);border-radius:var(--radius-lg);padding:.9rem 1rem;
 display:flex;flex-direction:column;gap:.6rem}
.blockkopf{display:flex;justify-content:space-between;align-items:center;gap:.5rem;
 font-size:.7rem;letter-spacing:.05em;text-transform:uppercase;color:var(--leise)}
.zeilen{display:flex;flex-direction:column;gap:.4rem}
.meldung{font-size:.85rem;padding:.55rem .8rem;border-radius:var(--radius-md)}
.meldung.schlecht{color:#a82e23;background:#f7e7e5}
.meldung.gut{color:var(--color-accent-2-700);background:var(--color-accent-2-100)}
.fehlerliste{margin:0;padding-left:1.1rem;font-size:.84rem}
/* Der Rahmen zeigt die Seite in der Breite eines Telefons. Sie wird zu
   neun Zehnteln stehend gelesen; eine Vorschau in Fensterbreite zeigt
   eine Anordnung, die niemand zu sehen bekommt. */
.telefon{background:#2e2b25;border-radius:34px;padding:12px;margin:0 auto;
 width:100%%;max-width:360px;box-shadow:0 14px 40px color-mix(in srgb,#2e2b25 25%%,transparent)}
.telefon iframe{width:100%%;height:600px;border:none;border-radius:24px;background:#fff;
 display:block}
.wahlliste{display:flex;flex-wrap:wrap;gap:.35rem}
.wahlliste button{font:inherit;font-size:.8rem;font-weight:600;cursor:pointer;
 background:var(--color-bg);border:1px solid transparent;border-radius:999px;
 padding:.35rem .75rem;color:var(--leise)}
.wahlliste button[aria-pressed=true]{background:var(--color-accent);color:var(--color-bg)}
.wahlliste button:hover{color:var(--color-text)}
.wahlliste button[aria-pressed=true]:hover{color:var(--color-bg)}
[hidden]{display:none!important}
</style>

<a href="#inhalt" class="ueberspringen">Zum Inhalt</a>
<header class="werkkopf">
  <div class="werkkopf-innen">
    %s
    <nav class="werkwege" aria-label="Bereiche">
      <a class="werkweg" href="/">Studio</a>
      <a class="werkweg" href="/zentrale">Zentrale</a>
      <a class="werkweg werkweg-aktiv" href="/landeseite" aria-current="page">Landeseite</a>
      <a class="werkweg" href="/serie">Serie</a>
      <a class="werkweg" href="/zahlen">Zahlen</a>
    </nav>
  </div>
</header>

<main id="inhalt" class="spur">
  <h1>Landeseite</h1>
  <p class="anriss">Statt einer fremden Adresse eine kleine Seite: Titel, ein paar Zeilen,
    ein Knopf. Sie kommt aus diesem Server, lädt nichts nach und zählt keine Person.
    Der Knopf ist der zweite Schritt — aus Scan und Knopf entsteht die Rate in den
    <a href="/zahlen">Zahlen</a>.</p>

  <div class="raster">
    <div style="display:flex;flex-direction:column;gap:1.1rem">
      <div class="tafel">
        <div class="tafel-kopf"><span>1 · Code</span><span id="codestand"></span></div>
        <div class="tafel-koerper">
          <div class="reihe">
            <label>Schlüssel
              <input id="schluessel" type="password" placeholder="x-punkt-schluessel"
                     autocomplete="off"></label>
            <label>Code
              <select id="code"><option value="">— erst Schlüssel —</option></select></label>
          </div>
          <div id="meldung"></div>
        </div>
      </div>

      <div class="tafel">
        <div class="tafel-kopf"><span>2 · Vorlage</span></div>
        <div class="tafel-koerper">
          <div class="wahlliste" id="vorlagen"></div>
          <p class="hinweis" id="vorlagenzweck"></p>
          <button class="knopf" type="button" id="beispiel">Beispiel einsetzen</button>
        </div>
      </div>

      <div class="tafel">
        <div class="tafel-kopf"><span>3 · Inhalt</span></div>
        <div class="tafel-koerper">
          <label>Titel<input id="titel" maxlength="90" placeholder="Sommerkarte"></label>
          <label>Zeile darunter<input id="unter" placeholder="Täglich ab 17 Uhr"></label>
          <div id="bloecke" style="display:flex;flex-direction:column;gap:.7rem"></div>
          <button class="knopf" type="button" id="blockdazu">Abschnitt hinzufügen</button>
        </div>
      </div>

      <div class="tafel">
        <div class="tafel-kopf"><span>4 · Knopf und Fuß</span></div>
        <div class="tafel-koerper">
          <div class="reihe">
            <label>Beschriftung<input id="ktext" placeholder="Ganze Karte ansehen"></label>
            <label>Ziel des Knopfes<input id="kziel" placeholder="https://…"></label>
          </div>
          <label>Fußzeile<input id="fuss" placeholder="Allergene auf Nachfrage"></label>
          <p class="hinweis">Erlaubt sind https, http, mailto und tel. Ein anderes Schema
            wäre fremder Code auf dieser Domain und wird abgelehnt.</p>
        </div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:1.1rem;position:sticky;top:1rem">
      <div class="tafel">
        <div class="tafel-kopf"><span>Vorschau</span><span id="vorschaustand"></span></div>
        <div class="tafel-koerper">
          <div class="telefon">
            <iframe id="rahmen" title="Vorschau der Landeseite"></iframe>
          </div>
          <div id="fehler"></div>
          <div class="knoepfe">
            <button class="knopf stark" type="button" id="sichern" disabled>Seite setzen</button>
            <button class="knopf" type="button" id="entfernen" disabled>Seite entfernen</button>
          </div>
          <p class="hinweis" id="stand"></p>
        </div>
      </div>
    </div>
  </div>
</main>

<script>
const e = (id) => document.getElementById(id);
%s

let vorlage = "karte";
let bloecke = [];
let vorlagen = [];
let holen = null;

function entschaerft(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function melden(text, art) {
  e("meldung").innerHTML = text
    ? '<div class="meldung ' + art + '">' + entschaerft(text) + "</div>" : "";
}

// --- Zugang und Codeliste ------------------------------------------------
e("schluessel").addEventListener("input", () => {
  melden("", "");
  clearTimeout(holen);
  holen = setTimeout(codesHolen, 400);
});

async function codesHolen() {
  const k = e("schluessel").value.trim();
  if (!k) { e("code").innerHTML = '<option value="">— erst Schlüssel —</option>'; return; }
  try {
    const a = await fetch("/api/v1/codes", {headers: {"x-punkt-schluessel": k}});
    const d = await a.json();
    if (!a.ok) { melden(d.fehler || ("Fehler " + a.status), "schlecht"); return; }
    e("codestand").textContent = d.length + " Codes";
    // Die Auswahl ueberlebt das Neuladen der Liste: nach dem Setzen
    // steht sonst wieder „— auswählen —" da, und der naechste Klick auf
    // „Seite setzen" liefe ins Leere.
    const vorher = e("code").value;
    e("code").innerHTML = '<option value="">— auswählen —</option>' + d.map(c =>
      '<option value="' + entschaerft(c.id) + '"' + (c.seite ? ' data-hat="1"' : '') + '>' +
      entschaerft(c.name || c.kuerzel) + " · /" + entschaerft(c.kuerzel) +
      (c.seite ? " · hat eine Seite" : "") + "</option>").join("");
    if (vorher && [...e("code").options].some(o => o.value === vorher)) {
      e("code").value = vorher;
    }
  } catch (err) {
    melden("Der Server antwortet nicht: " + err.message, "schlecht");
  }
}

e("code").addEventListener("change", async () => {
  const id = e("code").value;
  e("sichern").disabled = !id;
  e("entfernen").disabled = !id;
  if (!id) { e("stand").textContent = ""; return; }

  // Hat der Code schon eine Seite, wird sie geladen — sonst faengt man
  // beim Bearbeiten versehentlich von vorn an. Gefragt wird nur, wenn
  // die Liste sagt, dass es eine gibt: sonst holt der Browser einen
  // erwarteten 404 und schreibt ihn in die Konsole, wo er wie ein
  // Fehler aussieht.
  const gewaehlt = e("code").selectedOptions[0];
  if (!gewaehlt || gewaehlt.dataset.hat !== "1") {
    e("stand").textContent = "Für diesen Code ist noch keine Seite hinterlegt.";
    zeichnen();
    return;
  }
  try {
    const a = await fetch("/api/v1/codes/" + encodeURIComponent(id) + "/seite",
      {headers: {"x-punkt-schluessel": e("schluessel").value.trim()}});
    if (a.ok) {
      einsetzen(await a.json());
      e("stand").textContent = "Die gespeicherte Seite dieses Codes ist geladen.";
    }
  } catch (_) { /* ohne Netz bleibt das Formular, wie es ist */ }
  zeichnen();
});

// --- Vorlagen ------------------------------------------------------------
async function vorlagenHolen() {
  const a = await fetch("/api/v1/vorlagen");
  vorlagen = await a.json();
  e("vorlagen").innerHTML = vorlagen.map(v =>
    '<button type="button" data-v="' + entschaerft(v.schluessel) + '" aria-pressed="' +
    (v.schluessel === vorlage) + '">' + entschaerft(v.name) + "</button>").join("");
  zweckZeigen();
}

function zweckZeigen() {
  const v = vorlagen.find(x => x.schluessel === vorlage);
  e("vorlagenzweck").textContent = v ? v.zweck : "";
}

e("vorlagen").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  vorlage = b.dataset.v;
  [...e("vorlagen").children].forEach(x => x.setAttribute("aria-pressed", x === b));
  zweckZeigen();
  bloeckeZeichnen();
  zeichnen();
});

e("beispiel").addEventListener("click", () => {
  const v = vorlagen.find(x => x.schluessel === vorlage);
  if (v) einsetzen(v.beispiel);
  zeichnen();
});

function einsetzen(s) {
  if (!s) return;
  vorlage = s.vorlage || "karte";
  [...e("vorlagen").children].forEach(x =>
    x.setAttribute("aria-pressed", x.dataset.v === vorlage));
  zweckZeigen();
  e("titel").value = s.titel || "";
  e("unter").value = s.unter || "";
  e("fuss").value = s.fuss || "";
  e("ktext").value = s.handlung ? s.handlung.text : "";
  e("kziel").value = s.handlung ? s.handlung.ziel : "";
  bloecke = (s.bloecke || []).map(b => ({
    titel: b.titel || "", text: b.text || "",
    zeilen: (b.zeilen || []).map(z => ({
      was: z.was || "", neben: z.neben || "", dazu: z.dazu || "", ziel: z.ziel || ""}))
  }));
  bloeckeZeichnen();
}

// --- Abschnitte ----------------------------------------------------------
e("blockdazu").addEventListener("click", () => {
  bloecke.push({titel: "", text: "", zeilen: [{was: "", neben: "", dazu: "", ziel: ""}]});
  bloeckeZeichnen();
});

function bloeckeZeichnen() {
  const weg = vorlage === "verweise";
  const nebenName = vorlage === "veranstaltung" ? "Uhrzeit" : "Preis";
  e("bloecke").innerHTML = bloecke.map((b, i) =>
    '<div class="block" data-i="' + i + '">' +
      '<div class="blockkopf"><span>Abschnitt ' + (i + 1) + "</span>" +
        '<button type="button" class="klein weg" data-tun="blockweg">entfernen</button></div>' +
      '<label>Überschrift<input data-feld="titel" value="' + entschaerft(b.titel) + '"></label>' +
      '<label>Freier Text<textarea data-feld="text" rows="2">' + entschaerft(b.text) + "</textarea></label>" +
      '<div class="zeilen">' + b.zeilen.map((z, j) =>
        '<div class="reihe3" data-j="' + j + '">' +
          '<label>' + (weg ? "Text" : "Zeile") + '<input data-feld="was" value="' +
            entschaerft(z.was) + '"></label>' +
          (weg
            ? '<label>Ziel<input data-feld="ziel" value="' + entschaerft(z.ziel) + '"></label>'
            : '<label>' + nebenName + '<input data-feld="neben" value="' +
              entschaerft(z.neben) + '"></label>') +
          '<button type="button" class="klein weg" data-tun="zeileweg">weg</button>' +
        "</div>" +
        '<label style="margin-top:-.2rem">Anmerkung<input data-feld="dazu" data-j="' + j +
          '" value="' + entschaerft(z.dazu) + '"></label>').join("") +
      "</div>" +
      '<button type="button" class="klein" data-tun="zeiledazu">Zeile hinzufügen</button>' +
    "</div>").join("");
}

e("bloecke").addEventListener("click", ev => {
  const b = ev.target.closest("button"); if (!b) return;
  const block = Number(b.closest(".block").dataset.i);
  if (b.dataset.tun === "blockweg") bloecke.splice(block, 1);
  if (b.dataset.tun === "zeiledazu") bloecke[block].zeilen.push({was: "", neben: "", dazu: "", ziel: ""});
  if (b.dataset.tun === "zeileweg") {
    bloecke[block].zeilen.splice(Number(b.closest(".reihe3").dataset.j), 1);
  }
  bloeckeZeichnen();
  zeichnen();
});

e("bloecke").addEventListener("input", ev => {
  const feld = ev.target.dataset.feld; if (!feld) return;
  const block = Number(ev.target.closest(".block").dataset.i);
  const reihe = ev.target.closest(".reihe3");
  if (reihe) {
    bloecke[block].zeilen[Number(reihe.dataset.j)][feld] = ev.target.value;
  } else if (feld === "dazu" && ev.target.dataset.j !== undefined) {
    bloecke[block].zeilen[Number(ev.target.dataset.j)].dazu = ev.target.value;
  } else {
    bloecke[block][feld] = ev.target.value;
  }
  spaeter(zeichnen);
});

// --- Zeichnen ------------------------------------------------------------
function seite() {
  const s = {
    vorlage, titel: e("titel").value, unter: e("unter").value,
    fuss: e("fuss").value,
    bloecke: bloecke.map(b => ({
      titel: b.titel, text: b.text,
      zeilen: b.zeilen.filter(z => z.was || z.neben || z.ziel)
    })),
  };
  if (e("ktext").value.trim() || e("kziel").value.trim()) {
    s.handlung = {text: e("ktext").value, ziel: e("kziel").value};
  }
  return s;
}

let warten;
function spaeter(f) { clearTimeout(warten); warten = setTimeout(f, 220); }

async function zeichnen() {
  const s = seite();
  // Die Vorschau kommt aus demselben Zeichner wie die spaetere Seite.
  // Ein Nachbau im Browser liefe auseinander, und dann zeigt die
  // Vorschau etwas anderes als der Scan.
  const r = e("rahmen");
  r.srcdoc = "";
  try {
    const a = await fetch("/api/v1/seite/vorschau", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(s)});
    r.srcdoc = await a.text();
  } catch (_) { /* ohne Netz bleibt der Rahmen leer */ }

  try {
    const p = await fetch("/api/v1/seite/pruefen", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(s)});
    const d = await p.json();
    e("fehler").innerHTML = d.inOrdnung
      ? '<div class="meldung gut">' + icon("geprueft", 13) + " So kann sie gesetzt werden.</div>"
      : '<div class="meldung schlecht"><ul class="fehlerliste">' +
        (d.fehler || []).map(f => "<li>" + entschaerft(f) + "</li>").join("") + "</ul></div>";
    e("vorschaustand").textContent = d.inOrdnung ? "in Ordnung" :
      (d.fehler || []).length + " offen";
  } catch (_) {}
}

for (const id of ["titel", "unter", "fuss", "ktext", "kziel"]) {
  e(id).addEventListener("input", () => spaeter(zeichnen));
}

// --- Setzen und Entfernen ------------------------------------------------
e("sichern").addEventListener("click", async () => {
  const id = e("code").value, k = e("schluessel").value.trim();
  if (!id || !k) return;
  try {
    const a = await fetch("/api/v1/codes/" + encodeURIComponent(id) + "/seite", {
      method: "PUT",
      headers: {"x-punkt-schluessel": k, "Content-Type": "application/json"},
      body: JSON.stringify(seite())});
    const d = await a.json();
    if (!a.ok) { melden(d.fehler || ("Fehler " + a.status), "schlecht"); return; }
    melden("Gesetzt. Ein Scan auf /" + d.kuerzel + " zeigt jetzt diese Seite.", "gut");
    e("stand").textContent = "Fassung " + d.fassung + " · gesetzt";
    codesHolen();
  } catch (err) { melden("Der Server antwortet nicht: " + err.message, "schlecht"); }
});

e("entfernen").addEventListener("click", async () => {
  const id = e("code").value, k = e("schluessel").value.trim();
  if (!id || !k) return;
  if (!confirm("Die Seite entfernen? Der Code führt danach wieder auf sein Ziel. " +
               "Der gedruckte Code bleibt gültig.")) return;
  try {
    const a = await fetch("/api/v1/codes/" + encodeURIComponent(id) + "/seite", {
      method: "DELETE", headers: {"x-punkt-schluessel": k}});
    const d = await a.json();
    if (!a.ok) { melden(d.fehler || ("Fehler " + a.status), "schlecht"); return; }
    melden("Entfernt. /" + d.kuerzel + " führt wieder auf " + d.ziel + ".", "gut");
    codesHolen();
  } catch (err) { melden("Der Server antwortet nicht: " + err.message, "schlecht"); }
});

vorlagenHolen().then(() => { bloeckeZeichnen(); zeichnen(); });
</script>
`
