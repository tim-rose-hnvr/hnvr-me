package main

import (
	"net/http"
)

// studio ist die Bedienoberflaeche. Sie liegt als Text im Binaer, damit das
// Programm ohne Beiwerk laeuft: keine Datei daneben, kein Netz, kein CDN.
// Die Vorschau kommt vom eigenen Server als Vektor — was zu sehen ist, ist
// dieselbe Datei, die spaeter in den Druck geht.
func (d *dienst) studio(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'")
	_, _ = w.Write([]byte(studioSeite))
}

const studioSeite = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>pnkt — Studio</title>
<style>
:root{--grund:#EBEEEE;--flaeche:#fff;--tief:#E2E6E7;--tinte:#141A1C;--leise:#59666C;
--linie:#D0D7D9;--stark:#A9B4B8;--rot:#A82E23;--rotgrund:#F7E7E5;--warn:#7E5300;
--warngrund:#F6ECDA;--gut:#0D5A4D;--gutgrund:#DFEDEA}
@media(prefers-color-scheme:dark){:root{--grund:#111618;--flaeche:#192023;--tief:#212A2E;
--tinte:#E4E9EA;--leise:#93A1A7;--linie:#2A3438;--stark:#47555A;--rot:#F0705C;
--rotgrund:#33201D;--warn:#E0A63F;--warngrund:#2E2513;--gut:#45B49C;--gutgrund:#152C28}}
*{box-sizing:border-box}
body{margin:0;background:var(--grund);color:var(--tinte);
font:16px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif}
.spur{max-width:1180px;margin:0 auto;padding:1.5rem}
h1{font-size:1.5rem;margin:0 0 .25rem;letter-spacing:-.02em}
.anriss{color:var(--leise);margin:0 0 1.5rem;font-size:.95rem}
.raster{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:1.25rem;align-items:start}
@media(max-width:900px){.raster{grid-template-columns:1fr}}
.feld{background:var(--flaeche);border:1px solid var(--linie);border-radius:10px;overflow:hidden}
.kopf{padding:.7rem 1rem;border-bottom:1px solid var(--linie);background:var(--tief);
font-size:.7rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:var(--leise)}
.koerper{padding:1rem;display:flex;flex-direction:column;gap:.85rem}
label{display:flex;flex-direction:column;gap:.25rem;font-size:.8rem;color:var(--leise)}
input,select{font:inherit;font-size:.9rem;padding:.5rem .6rem;border:1px solid var(--stark);
border-radius:6px;background:var(--flaeche);color:var(--tinte)}
input[type=color]{padding:.2rem;height:2.4rem}
.reihe{display:grid;grid-template-columns:1fr 1fr;gap:.6rem}
.vorschau{display:grid;place-items:center;padding:1.5rem;background:var(--tief);min-height:320px}
.vorschau img{max-width:100%;height:auto}
.note{display:inline-flex;align-items:center;gap:.5rem;font-weight:700;font-size:.8rem;
padding:.25rem .6rem;border-radius:4px;letter-spacing:.06em;text-transform:uppercase}
.note.gut{color:var(--gut);background:var(--gutgrund)}
.note.warn{color:var(--warn);background:var(--warngrund)}
.note.schlecht{color:var(--rot);background:var(--rotgrund)}
.befund{font-size:.85rem;padding-left:.85rem;border-left:2px solid var(--stark);color:var(--leise)}
.befund.fehler{border-color:var(--rot)}
.befund.warnung{border-color:var(--warn)}
.befund b{color:var(--tinte);font-weight:600}
.zahlen{display:flex;flex-wrap:wrap;gap:.35rem 1.25rem;font-size:.8rem;color:var(--leise)}
.zahlen b{color:var(--tinte);font-variant-numeric:tabular-nums}
a.knopf{display:inline-block;font-size:.85rem;font-weight:600;text-decoration:none;
padding:.5rem .8rem;border:1px solid var(--stark);border-radius:6px;color:var(--tinte)}
a.knopf.stark{border-color:var(--rot);color:var(--rot);background:var(--rotgrund)}
</style>

<div class="spur">
  <h1>pnkt — Studio</h1>
  <p class="anriss">Vektor von Anfang an, Druckurteil vor dem Export. Alles rechnet dieser Server, nichts geht nach draussen.</p>

  <div class="raster">
    <div class="feld">
      <div class="kopf">Vorschau</div>
      <div class="vorschau"><img id="bild" alt="QR-Vorschau"></div>
      <div class="koerper">
        <div id="urteil"></div>
        <div class="zahlen" id="zahlen"></div>
        <div><a class="knopf stark" id="export" download="pnkt.svg">SVG laden</a></div>
      </div>
    </div>

    <div class="feld">
      <div class="kopf">Einstellungen</div>
      <div class="koerper">
        <label>Inhalt<input id="inhalt" value="https://pnkt.me/2cnjdq"></label>
        <div class="reihe">
          <label>Breite in mm<input id="breite" type="number" value="40" min="5" max="500"></label>
          <label>Fehlerkorrektur<select id="stufe">
            <option>L</option><option selected>M</option><option>Q</option><option>H</option>
          </select></label>
        </div>
        <div class="reihe">
          <label>Druckverfahren<select id="verfahren">
            <option value="offset">Offset</option><option value="digital">Digitaldruck</option>
            <option value="thermo">Thermotransfer</option><option value="tintenstrahl">Tintenstrahl</option>
            <option value="siebdruck">Siebdruck</option><option value="flexo">Flexodruck</option>
            <option value="gravur">Gravur</option>
          </select></label>
          <label>Ruhezone<input id="ruhezone" type="number" value="4" min="0" max="10"></label>
        </div>
        <div class="reihe">
          <label>Modulform<select id="form">
            <option value="quadrat">Quadrat</option><option value="punkt">Punkt</option>
            <option value="rund">Rund</option><option value="mosaik">Mosaik</option>
            <option value="raute">Raute</option><option value="kreuz">Kreuz</option>
          </select></label>
          <label>Augenkern<select id="augenkern">
            <option value="quadrat">Quadrat</option><option value="rund">Rund</option>
            <option value="punkt">Punkt</option>
          </select></label>
        </div>
        <div class="reihe">
          <label>Vordergrund<input id="vordergrund" type="color" value="#000000"></label>
          <label>Hintergrund<input id="hintergrund" type="color" value="#ffffff"></label>
        </div>
        <div class="reihe">
          <label>Logoaussparung<input id="logo" type="number" value="0" min="0" max="0.4" step="0.05"></label>
          <label>Fuer die Kasse<select id="kasse">
            <option value="0">nein</option><option value="1">ja, GS1</option>
          </select></label>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
const e = (id) => document.getElementById(id);
const felder = ['inhalt','breite','stufe','verfahren','ruhezone','form','augenkern',
                'vordergrund','hintergrund','logo','kasse'];

function abfrage() {
  const p = new URLSearchParams();
  p.set('inhalt', e('inhalt').value);
  p.set('breite', e('breite').value);
  p.set('stufe', e('stufe').value);
  p.set('verfahren', e('verfahren').value);
  p.set('ruhezone', e('ruhezone').value);
  p.set('form', e('form').value);
  p.set('augenkern', e('augenkern').value);
  p.set('vordergrund', e('vordergrund').value);
  p.set('hintergrund', e('hintergrund').value);
  p.set('logo', e('logo').value);
  p.set('kasse', e('kasse').value);
  return p;
}

async function zeichnen() {
  const p = abfrage();
  e('bild').src = '/qr.svg?' + p.toString();
  e('export').href = '/qr.svg?' + p.toString();

  const antwort = await fetch('/api/druckpruefung?' + p.toString());
  const d = await antwort.json();
  if (d.fehler) {
    e('urteil').innerHTML = '<span class="note schlecht">nicht baubar</span> ' + d.fehler;
    e('zahlen').innerHTML = '';
    return;
  }
  const u = d.urteil;
  const art = u.druckreif ? (u.note === 'A' ? 'gut' : 'warn') : 'schlecht';
  let html = '<span class="note ' + art + '">Note ' + u.note + ' — ' +
    (u.druckreif ? 'druckreif' : 'nicht druckreif') + '</span>';
  for (const b of (u.befunde || [])) {
    html += '<div class="befund ' + b.schwere + '"><b>' + b.text + '</b>' +
      (b.rat ? '<br>' + b.rat : '') + '</div>';
  }
  e('urteil').innerHTML = html;
  e('zahlen').innerHTML =
    '<span>Version <b>' + d.version + '</b></span>' +
    '<span>Module <b>' + d.kante + '</b></span>' +
    '<span>Maske <b>' + d.maske + '</b></span>' +
    '<span>Modul <b>' + u.modulMm.toFixed(3) + ' mm</b></span>' +
    '<span>Kontrast <b>' + u.kontrast + ':1</b></span>' +
    '<span>kleinste Breite <b>' + u.kleinsteMm + ' mm</b></span>';
}

let warten;
for (const f of felder) {
  e(f).addEventListener('input', () => {
    clearTimeout(warten);
    warten = setTimeout(zeichnen, 150);
  });
}
zeichnen();
</script>
`
