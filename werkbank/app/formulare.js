/* Formulare — vorhandene AcroForm-Felder ausfüllen.

   Die Felder kommen aus pdf.js (Widget-Anmerkungen). Eingaben liegen in
   zustand.formularwerte und werden bei der Ausgabe über pdf-lib in das
   Dokument geschrieben — wahlweise auch fest eingebrannt. */

import { zustand, melde, el, sage } from './kern.js';

export function felderDerSeite(seitenId) {
  return zustand.formularfelder.filter((f) => f.seiteId === seitenId);
}

export function hatFormular() { return zustand.formularfelder.length > 0; }

export function offeneFelder() {
  return zustand.formularfelder.filter((f) => !f.nurLesen && !wertVon(f));
}

export function wertVon(feld) {
  const wert = zustand.formularwerte.get(feld.name);
  if (wert == null) return feld.art === 'kasten' || feld.art === 'radio' ? false : '';
  return wert;
}

export function setzeWert(name, wert) {
  zustand.formularwerte.set(name, wert);
  zustand.geaendert = true;
  melde('formular:geaendert');
  melde('dokument:geaendert');
}

/** Zeichnet Eingabefelder als Überlagerung über die Seite. */
export function zeichneFormularfelder(ebene, eintrag, sicht) {
  ebene.innerHTML = '';
  const felder = felderDerSeite(eintrag.id);
  if (!felder.length) return;

  for (const feld of felder) {
    const [x1, y1] = sicht.convertToViewportPoint(feld.rechteck[0], feld.rechteck[1]);
    const [x2, y2] = sicht.convertToViewportPoint(feld.rechteck[2], feld.rechteck[3]);
    const links = Math.min(x1, x2), oben = Math.min(y1, y2);
    const breite = Math.abs(x2 - x1), hoehe = Math.abs(y2 - y1);
    const stil = {
      left: `${links}px`, top: `${oben}px`, width: `${breite}px`, height: `${hoehe}px`,
      fontSize: `${Math.max(8, Math.min(hoehe * 0.62, 18))}px`,
    };

    let knoten;
    if (feld.art === 'kasten' || feld.art === 'radio') {
      knoten = el('input', {
        type: feld.art === 'kasten' ? 'checkbox' : 'radio',
        klasse: 'formularfeld', name: feld.name,
        stil: { ...stil, width: `${Math.min(breite, hoehe)}px`, height: `${Math.min(breite, hoehe)}px` },
        disabled: feld.nurLesen,
        beiChange: (e) => setzeWert(feld.name, feld.art === 'radio' ? feld.anWert : e.target.checked),
      });
      const wert = wertVon(feld);
      knoten.checked = feld.art === 'radio' ? wert === feld.anWert : !!wert && wert !== 'Off';
    } else if (feld.art === 'auswahl') {
      knoten = el('select', { klasse: 'formularfeld', stil, disabled: feld.nurLesen, beiChange: (e) => setzeWert(feld.name, e.target.value) },
        el('option', { value: '', text: '—' }),
        ...feld.optionen.map((o) => el('option', { value: o.wert, text: o.text })));
      knoten.value = wertVon(feld) || '';
    } else if (feld.art === 'unterschrift') {
      knoten = el('div', {
        klasse: 'formularfeld', stil: { ...stil, display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: '11px' },
        text: 'Unterschreiben', title: `Unterschriftsfeld „${feld.name}"`,
        beiClick: () => melde('unterschrift:anfordern', { seitenId: feld.seiteId, rechteck: feld.rechteck }),
      });
    } else if (feld.mehrzeilig) {
      knoten = el('textarea', {
        klasse: 'formularfeld', stil: { ...stil, resize: 'none' }, readonly: feld.nurLesen,
        beiInput: (e) => setzeWert(feld.name, e.target.value),
      });
      knoten.value = wertVon(feld);
    } else {
      knoten = el('input', {
        type: 'text', klasse: 'formularfeld', stil, readonly: feld.nurLesen,
        maxlength: feld.maximal || null,
        beiInput: (e) => setzeWert(feld.name, e.target.value),
      });
      knoten.value = wertVon(feld);
    }
    knoten.title = `${feld.name}${feld.pflicht ? ' (Pflichtfeld)' : ''}`;
    knoten.dataset.feld = feld.name;
    ebene.append(knoten);
  }
}

/** Springt zum nächsten leeren Feld und setzt den Fokus, sobald die Seite steht. */
export function zumNaechstenFeld(bringeInSicht) {
  const offen = offeneFelder();
  if (!offen.length) { sage('Alle Felder sind ausgefüllt'); return false; }
  const feld = offen[0];
  bringeInSicht(feld.seiteId);

  // Die Seite wird erst gezeichnet, dann entsteht das Eingabefeld. Wir warten
  // darauf, statt eine Frist zu raten.
  let versuche = 0;
  const greifen = () => {
    const knoten = document.querySelector(`[data-feld="${CSS.escape(feld.name)}"]`);
    if (knoten) {
      knoten.focus({ preventScroll: true });
      if (knoten.select) knoten.select();
      return;
    }
    if (++versuche < 40) setTimeout(greifen, 80);
  };
  setTimeout(greifen, 120);
  return true;
}

export function formularTafel() {
  const felder = zustand.formularfelder;
  if (!felder.length) return el('p', { klasse: 'hinweis', text: 'Dieses Dokument enthält keine Formularfelder.' });

  const liste = el('div', {});
  const nachSeite = new Map();
  for (const feld of felder) {
    if (!nachSeite.has(feld.seiteId)) nachSeite.set(feld.seiteId, []);
    nachSeite.get(feld.seiteId).push(feld);
  }
  for (const [seitenId, gruppe] of nachSeite) {
    const nummer = zustand.folge.findIndex((e) => e.id === seitenId) + 1;
    liste.append(el('h3', { klasse: 'klein leise', text: `Seite ${nummer}`, stil: { margin: '.6rem 0 .25rem' } }));
    for (const feld of gruppe) {
      const wert = wertVon(feld);
      const gefuellt = feld.art === 'kasten' || feld.art === 'radio' ? !!wert : String(wert).length > 0;
      liste.append(el('div', { klasse: 'merkmal' },
        el('span', {}, feld.name, feld.pflicht ? el('span', { klasse: 'marke marke-warn', text: 'Pflicht', stil: { marginLeft: '.3rem' } }) : null),
        el('span', { klasse: gefuellt ? 'marke marke-gut' : 'marke', text: gefuellt ? 'gefüllt' : 'leer' })));
    }
  }
  return liste;
}
