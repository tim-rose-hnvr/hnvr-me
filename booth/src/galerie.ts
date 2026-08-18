/**
 * Kunden-Galerie: alle Aufnahmen eines Events zum Ansehen und Herunterladen.
 *
 * Sie läuft auf demselben Gerät wie der Booth und liest dieselbe Ablage.
 * Ausgeliefert wird sie im lokalen Netz — deshalb steht die Löschfrist
 * sichtbar im Kopf, so wie sie den Gästen versprochen wurde.
 */

import './stil.css';
import './galerie.css';
import { alle, type Aufnahme } from './speicher';
import { ladeEinstellungen } from './einstellungen';
import { ARTEN } from './arten';

const wurzel = document.getElementById('galerie');

if (wurzel) {
  void starte(wurzel);
}

async function starte(ziel: HTMLElement): Promise<void> {
  const einstellungen = ladeEinstellungen();
  let aufnahmen: Aufnahme[] = [];
  let fehler = false;

  try {
    aufnahmen = await alle();
  } catch {
    fehler = true;
  }

  const adressen = new Map(aufnahmen.map((a) => [a.id, URL.createObjectURL(a.blob)]));
  // Bewegtbilder liegen neben dem Blatt — in der Kachel bleibt das Standbild,
  // damit nicht zwanzig Animationen gleichzeitig laufen.
  const bewegte = new Map(
    aufnahmen.filter((a) => a.bewegt).map((a) => [a.id, URL.createObjectURL(a.bewegt!)])
  );
  let filter = 'alle';

  const kopf = tag('header', 'gkopf');
  const titel = document.createElement('h1');
  titel.textContent = einstellungen.event;
  const zeile = tag('span', 'gmono');
  const raster = tag('div', 'graster');
  const leer = tag('p', 'gleer');
  const filterreihe = tag('div', 'gfilter');

  kopf.append(titel, zeile);

  const zeichne = () => {
    const sichtbar = aufnahmen.filter((a) => filter === 'alle' || a.art === filter);

    zeile.textContent = `${sichtbar.length} von ${aufnahmen.length} Aufnahmen · Löschung nach ${einstellungen.loeschfristTage} Tagen`;

    leer.hidden = sichtbar.length > 0;
    leer.textContent = fehler
      ? 'Die Ablage ist nicht erreichbar.'
      : aufnahmen.length === 0
        ? 'Noch keine Aufnahme in dieser Galerie.'
        : 'Keine Aufnahme in dieser Auswahl.';

    raster.replaceChildren(
      ...sichtbar.map((a, i) => {
        const kachel = tag('figure', 'gkachel');
        const knopf = tag('button', 'gknopfbild');
        const bild = document.createElement('img');
        bild.src = adressen.get(a.id) ?? '';
        bild.alt = '';
        bild.loading = 'lazy';
        knopf.append(bild);
        knopf.addEventListener('click', () => zeigeGross(sichtbar, i, adressen, bewegte));

        const fuss = document.createElement('figcaption');
        const zeitzeile = tag('span', 'gmono');
        zeitzeile.textContent = new Date(a.zeit).toLocaleString('de-DE', {
          dateStyle: 'short',
          timeStyle: 'short',
        });

        const laden = tag('a', 'gknopf') as HTMLAnchorElement;
        laden.href = adressen.get(a.id) ?? '';
        laden.download = `youbooth-${a.id}.jpg`;
        laden.textContent = 'Herunterladen';

        fuss.append(zeitzeile, laden);

        if (bewegte.has(a.id)) {
          const gif = tag('a', 'gknopf gknopf--zweit') as HTMLAnchorElement;
          gif.href = bewegte.get(a.id)!;
          gif.download = `youbooth-${a.id}.gif`;
          gif.textContent = 'GIF';
          fuss.append(gif);

          const marke = tag('span', 'gmarke');
          marke.textContent = 'GIF';
          kachel.append(marke);
        }
        kachel.append(knopf, fuss);
        return kachel;
      })
    );

    filterreihe.querySelectorAll<HTMLButtonElement>('[data-art]').forEach((b) => {
      const an = b.dataset.art === filter;
      b.classList.toggle('an', an);
      b.setAttribute('aria-pressed', String(an));
    });
  };

  // Filter nur für Arten anbieten, die auch vorkommen.
  const vorhandene = new Set(aufnahmen.map((a) => a.art));
  const filterarten = [
    { id: 'alle', name: 'Alle' },
    ...ARTEN.filter((a) => vorhandene.has(a.id)).map((a) => ({ id: a.id, name: a.name })),
  ];

  filterarten.forEach((a) => {
    const knopf = tag('button', 'gchip');
    knopf.dataset.art = a.id;
    knopf.textContent = a.name;
    knopf.addEventListener('click', () => {
      filter = a.id;
      zeichne();
    });
    filterreihe.append(knopf);
  });

  ziel.replaceChildren(kopf, filterreihe, raster, leer);
  zeichne();
}

/** Lightbox mit Vor und Zurück, bedienbar auch per Tastatur. */
function zeigeGross(
  liste: Aufnahme[],
  start: number,
  adressen: Map<string, string>,
  bewegte: Map<string, string>
): void {
  let i = start;

  const decke = tag('div', 'glightbox');
  const bild = document.createElement('img');
  bild.alt = '';

  const zurueck = tag('button', 'gpfeil');
  zurueck.textContent = '‹';
  zurueck.setAttribute('aria-label', 'Vorheriges Bild');

  const vor = tag('button', 'gpfeil');
  vor.textContent = '›';
  vor.setAttribute('aria-label', 'Nächstes Bild');

  const zu = tag('button', 'gschliessen');
  zu.textContent = 'Schließen';

  const zaehler = tag('span', 'gmono');

  const zeige = () => {
    const a = liste[i];
    if (!a) return;
    // Gross zeigt die Bewegung, wenn es eine gibt.
    bild.src = bewegte.get(a.id) ?? adressen.get(a.id) ?? '';
    zaehler.textContent = `${i + 1} von ${liste.length}`;
  };

  const weiter = (schritt: number) => {
    i = (i + schritt + liste.length) % liste.length;
    zeige();
  };

  const beenden = () => {
    decke.remove();
    document.removeEventListener('keydown', taste);
  };

  const taste = (e: KeyboardEvent) => {
    if (e.key === 'Escape') beenden();
    if (e.key === 'ArrowLeft') weiter(-1);
    if (e.key === 'ArrowRight') weiter(1);
  };

  zurueck.addEventListener('click', () => weiter(-1));
  vor.addEventListener('click', () => weiter(1));
  zu.addEventListener('click', beenden);
  decke.addEventListener('click', (e) => {
    if (e.target === decke) beenden();
  });
  document.addEventListener('keydown', taste);

  const leiste = tag('div', 'gleiste');
  leiste.append(zaehler, zu);

  decke.append(zurueck, bild, vor, leiste);
  document.body.append(decke);
  zeige();
  zu.focus();
}

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}
