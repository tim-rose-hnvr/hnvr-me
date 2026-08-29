/* Unterschrift — zeichnen, tippen oder als Bild laden.

   Ergebnis ist ein PNG mit durchsichtigem Grund. Es wird beim Sichern als
   Bild in die Seite gelegt. Das ist eine sichtbare Unterschrift, keine
   kryptografische Signatur — der Unterschied steht auch im Dialog. */

import { el, zeigeDialog, sage, $, zeile } from './kern.js';
import { setzeUnterschriftsbild } from './anmerkungen.js';

const SCHRIFTEN = [
  { name: 'Handschrift breit', wert: 'italic 64px "Segoe Script", "Bradley Hand", "Apple Chancery", cursive' },
  { name: 'Handschrift schmal', wert: 'italic 60px "Snell Roundhand", "Lucida Handwriting", cursive' },
  { name: 'Serifen', wert: 'italic 56px Georgia, "Times New Roman", serif' },
];

export function zeigeUnterschriftDialog(beiFertig) {
  let art = 'zeichnen';
  const leinwand = el('canvas', { klasse: 'unterschrift-flaeche', width: 900, height: 260, stil: { height: '160px' } });
  const stift = leinwand.getContext('2d');
  let zeichnetGerade = false, letzterPunkt = null, hatStriche = false;

  const leere = () => {
    stift.clearRect(0, 0, leinwand.width, leinwand.height);
    hatStriche = false;
  };

  const punktAus = (ereignis) => {
    const kasten = leinwand.getBoundingClientRect();
    return {
      x: (ereignis.clientX - kasten.left) * (leinwand.width / kasten.width),
      y: (ereignis.clientY - kasten.top) * (leinwand.height / kasten.height),
    };
  };

  leinwand.addEventListener('pointerdown', (e) => {
    zeichnetGerade = true; hatStriche = true;
    letzterPunkt = punktAus(e);
    leinwand.setPointerCapture(e.pointerId);
  });
  leinwand.addEventListener('pointermove', (e) => {
    if (!zeichnetGerade) return;
    const jetzt = punktAus(e);
    stift.strokeStyle = '#101418';
    stift.lineWidth = Math.max(2.2, 4 - (e.pressure ? (1 - e.pressure) * 2 : 0));
    stift.lineCap = 'round'; stift.lineJoin = 'round';
    stift.beginPath();
    stift.moveTo(letzterPunkt.x, letzterPunkt.y);
    stift.lineTo(jetzt.x, jetzt.y);
    stift.stroke();
    letzterPunkt = jetzt;
  });
  const endeZeichnen = () => { zeichnetGerade = false; };
  leinwand.addEventListener('pointerup', endeZeichnen);
  leinwand.addEventListener('pointerleave', endeZeichnen);

  const namensfeld = el('input', { klasse: 'feld', placeholder: 'Vorname Nachname', stil: { flex: '1' } });
  const schriftwahl = el('select', { klasse: 'feld' }, ...SCHRIFTEN.map((s, i) => el('option', { value: String(i), text: s.name })));
  const tippBereich = el('div', { stil: { display: 'none' } },
    zeile('Name', namensfeld, schriftwahl));

  const bildwahl = el('input', { type: 'file', accept: 'image/png,image/jpeg', klasse: 'feld' });
  const bildHinweis = el('span', { klasse: 'hinweis' });
  const bildBereich = el('div', { stil: { display: 'none' } },
    zeile('Bilddatei', bildwahl),
    el('p', { klasse: 'hinweis' }, 'Am besten ein PNG mit durchsichtigem Grund. '),
    el('p', {}, bildHinweis));

  let geladenesBild = null;   // { datenUrl, verhaeltnis }
  bildwahl.addEventListener('change', () => {
    const datei = bildwahl.files?.[0];
    if (!datei) return;
    const leser = new FileReader();
    leser.onload = () => {
      // Erst wenn das Bild geladen ist, stehen die echten Maße fest. Vorher
      // hatte die Werkbank ein Verhältnis geraten — die Unterschrift wurde
      // dadurch verzerrt eingesetzt.
      const bild = new Image();
      bild.onload = () => {
        geladenesBild = {
          datenUrl: leser.result,
          verhaeltnis: (bild.naturalWidth || 3) / (bild.naturalHeight || 1),
        };
        bildHinweis.textContent = `${bild.naturalWidth} × ${bild.naturalHeight} Bildpunkte`;
      };
      bild.onerror = () => { bildHinweis.textContent = 'Diese Datei ließ sich nicht als Bild lesen.'; };
      bild.src = leser.result;
    };
    leser.readAsDataURL(datei);
  });

  const zeichenBereich = el('div', {},
    leinwand,
    el('div', { klasse: 'zeile', stil: { marginTop: '.5rem' } },
      el('button', { klasse: 'knopf knopf-klein knopf-still', text: 'Fläche leeren', beiClick: leere }),
      el('span', { klasse: 'hinweis', text: 'Mit Maus, Finger oder Stift schreiben.' })));

  const reiter = el('div', { klasse: 'unterschrift-reiter' },
    ...[['zeichnen', 'Zeichnen'], ['tippen', 'Tippen'], ['bild', 'Bild']].map(([id, name]) =>
      el('button', {
        klasse: `knopf knopf-klein ${id === 'zeichnen' ? 'ist-aktiv' : ''}`, text: name,
        beiClick: (e) => {
          art = id;
          [...reiter.children].forEach((k) => k.classList.toggle('ist-aktiv', k === e.currentTarget));
          zeichenBereich.style.display = id === 'zeichnen' ? '' : 'none';
          tippBereich.style.display = id === 'tippen' ? '' : 'none';
          bildBereich.style.display = id === 'bild' ? '' : 'none';
        },
      })));

  const rumpf = el('div', {}, reiter, zeichenBereich, tippBereich, bildBereich,
    el('p', { klasse: 'hinweis', stil: { marginTop: '1rem' } },
      'Sichtbare Unterschrift, keine kryptografische Signatur. Für rechtsverbindliches Signieren nach eIDAS braucht es ein Zertifikat und eine Signaturkarte — das kann diese Werkbank nicht.'));

  zeigeDialog({
    titel: 'Unterschrift anlegen',
    rumpf,
    knoepfe: [
      { beschriftung: 'Abbrechen' },
      {
        beschriftung: 'Übernehmen', betont: true,
        tun: () => {
          const ergebnis = ermittleBild();
          if (!ergebnis) { sage('Noch keine Unterschrift vorhanden', { art: 'warn' }); return false; }
          setzeUnterschriftsbild(ergebnis.datenUrl, ergebnis.verhaeltnis);
          beiFertig?.(ergebnis);
          return true;
        },
      },
    ],
  });

  function ermittleBild() {
    if (art === 'zeichnen') {
      if (!hatStriche) return null;
      return beschneide(leinwand);
    }
    if (art === 'tippen') {
      const name = namensfeld.value.trim();
      if (!name) return null;
      const hilfe = document.createElement('canvas');
      hilfe.width = 1200; hilfe.height = 260;
      const h = hilfe.getContext('2d');
      h.font = SCHRIFTEN[Number(schriftwahl.value)].wert;
      h.fillStyle = '#101418';
      h.textBaseline = 'middle';
      const breite = h.measureText(name).width;
      hilfe.width = Math.ceil(breite + 60);
      const h2 = hilfe.getContext('2d');
      h2.font = SCHRIFTEN[Number(schriftwahl.value)].wert;
      h2.fillStyle = '#101418';
      h2.textBaseline = 'middle';
      h2.fillText(name, 30, 130);
      return beschneide(hilfe);
    }
    if (art === 'bild') return geladenesBild;   // enthält Maße aus dem geladenen Bild
    return null;
  }
}

/** Schneidet durchsichtige Ränder ab und liefert PNG + Seitenverhältnis. */
function beschneide(leinwand) {
  const stift = leinwand.getContext('2d');
  const daten = stift.getImageData(0, 0, leinwand.width, leinwand.height).data;
  let minX = leinwand.width, minY = leinwand.height, maxX = 0, maxY = 0, gefunden = false;
  for (let y = 0; y < leinwand.height; y++) {
    for (let x = 0; x < leinwand.width; x++) {
      if (daten[(y * leinwand.width + x) * 4 + 3] > 12) {
        gefunden = true;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (!gefunden) return null;
  const rand = 8;
  const breite = Math.min(leinwand.width, maxX - minX + rand * 2);
  const hoehe = Math.min(leinwand.height, maxY - minY + rand * 2);
  const ziel = document.createElement('canvas');
  ziel.width = breite; ziel.height = hoehe;
  ziel.getContext('2d').drawImage(leinwand, Math.max(0, minX - rand), Math.max(0, minY - rand), breite, hoehe, 0, 0, breite, hoehe);
  return { datenUrl: ziel.toDataURL('image/png'), verhaeltnis: breite / hoehe };
}
