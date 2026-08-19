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
import { holeEinstellungen, ladeEinstellungen } from './einstellungen';
import { amDraht } from './draht';
import { artname } from './arten';

const wurzel = document.getElementById('galerie');

if (wurzel) {
  void starte(wurzel);

  /* Die Box meldet jede neue Aufnahme. Neu gezeichnet wird aber nur, wenn
     gerade niemand ein Bild groß ansieht — der Galerie unter den Fingern das
     Bild wegzuziehen, während sie ein Gast durchblättert, wäre schlimmer als
     ein paar Sekunden Verzug. */
  amDraht('galerie', (n) => {
    if (n.type !== 'photo' && n.type !== 'remove') return;
    if (document.querySelector('.glightbox')) return;
    void starte(wurzel);
  });
}

async function starte(ziel: HTMLElement): Promise<void> {
  await holeEinstellungen();
  const einstellungen = ladeEinstellungen();
  let aufnahmen: Aufnahme[] = [];
  let fehler = false;

  try {
    aufnahmen = await alle();
  } catch {
    fehler = true;
  }

  // Die Bilder liegen auf der Box und werden von dort geladen — deshalb sieht
  // jedes Gerät im WLAN dieselbe Galerie.
  const adressen = new Map(aufnahmen.map((a) => [a.id, a.url]));
  /* GIF und Video sind beides „Bewegung", aber nur das GIF läuft in einem
     Bildelement. Ein gesprochener Gruß braucht `<video>`, sonst steht in der
     Galerie eine leere Kachel mit einem Herunterladen-Knopf darunter. */
  const bewegte = new Map(aufnahmen.filter((a) => a.bewegt && !a.video).map((a) => [a.id, a.url]));
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

        if (a.video) {
          /* Nur die Metadaten laden: Eine Galerie mit vierzig Grüßen dürfte
             sonst vierzig Videos gleichzeitig ziehen. Das erste Bild reicht
             als Kachel, gespielt wird erst in der Großansicht. */
          const bewegung = document.createElement('video');
          bewegung.src = adressen.get(a.id) ?? '';
          bewegung.muted = true;
          bewegung.playsInline = true;
          bewegung.preload = 'metadata';
          knopf.append(bewegung);
        } else {
          const bild = document.createElement('img');
          bild.src = adressen.get(a.id) ?? '';
          bild.alt = '';
          bild.loading = 'lazy';
          knopf.append(bild);
        }
        knopf.addEventListener('click', () => zeigeGross(sichtbar, i, adressen, bewegte));

        const fuss = document.createElement('figcaption');
        const zeitzeile = tag('span', 'gmono');
        zeitzeile.textContent = new Date(a.zeit).toLocaleString('de-DE', {
          dateStyle: 'short',
          timeStyle: 'short',
        });

        const laden = tag('a', 'gknopf') as HTMLAnchorElement;
        laden.href = adressen.get(a.id) ?? '';
        laden.download = a.id;
        laden.textContent = 'Herunterladen';

        fuss.append(zeitzeile, laden);

        if (bewegte.has(a.id)) {
          const gif = tag('a', 'gknopf gknopf--zweit') as HTMLAnchorElement;
          gif.href = bewegte.get(a.id)!;
          gif.download = a.id;
          gif.textContent = 'GIF';
          fuss.append(gif);

          const marke = tag('span', 'gmarke');
          marke.textContent = 'GIF';
          kachel.append(marke);
        } else if (a.video) {
          /* Die Marke sagt, dass hier Ton drin ist. Ohne sie sieht ein
             gesprochener Gruß aus wie ein besonders langweiliges Foto. */
          const marke = tag('span', 'gmarke');
          marke.textContent = a.art === 'stimme' ? 'Gruß' : 'Video';
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
  /* Aus dem, was WIRKLICH da ist — nicht aus der Liste der Booth-Arten.
     Sonst fehlte der Filter für alles, was nicht am Booth entstanden ist:
     Handybilder, Einwegkamera, gesprochene Grüße. */
  const filterarten = [
    { id: 'alle', name: 'Alle' },
    ...[...vorhandene].sort().map((id) => ({ id, name: artname(id) })),
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

  /* Der Weg zum Foto-Finder gehört hierher und nirgendwo sonst: Wer vor
     vierhundert Kacheln steht, ist genau der Gast, der ihn braucht. */
  if (einstellungen.finder.an) {
    const finder = tag('a', 'gchip gchip--finder') as HTMLAnchorElement;
    finder.href = './finder.html';
    finder.textContent = 'Meine Bilder finden';
    filterreihe.append(finder);
  }

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

  /* Zwei Elemente statt eines: Ein Video in ein `<img>` zu stecken zeigt
     nichts, und ein `<video>` für jedes Foto hätte Bedienelemente, die dort
     nichts zu suchen haben. Sichtbar ist immer genau eines. */
  const bewegung = document.createElement('video');
  bewegung.className = 'gvideo';
  bewegung.controls = true;
  bewegung.playsInline = true;
  bewegung.hidden = true;

  const zurueck = tag('button', 'gpfeil');
  zurueck.textContent = '‹';
  zurueck.setAttribute('aria-label', 'Vorheriges Bild');

  const vor = tag('button', 'gpfeil');
  vor.textContent = '›';
  vor.setAttribute('aria-label', 'Nächstes Bild');

  const zu = tag('button', 'gschliessen');
  zu.textContent = 'Schließen';

  const zaehler = tag('span', 'gmono');

  /* Diashow: alle vier Sekunden weiter, mit einem Balken, der die Zeit
     zeigt. Ohne den Balken wirkt jeder Wechsel wie ein Ruck — mit ihm wie
     ein Takt, und man weiß, wie lange man noch schauen kann.

     Gebraucht wird sie in genau einer Lage: Das Paar sitzt am Tag danach
     zu zweit vor dem Rechner und will nicht 400-mal klicken. */
  const diashow = tag('button', 'gschliessen gdiashow');
  /* Die Beschriftung wurde bisher erst in `stoppeDiashow()` gesetzt — und die
     läuft beim Öffnen nicht. Der Knopf stand deshalb leer da: ein Kasten, der
     nichts sagt und den trotzdem jemand drückt. */
  diashow.textContent = 'Diashow';
  const balken = tag('span', 'gbalken');
  let laeuft = false;
  let uhr: number | null = null;

  const stoppeDiashow = (): void => {
    laeuft = false;
    if (uhr !== null) window.clearInterval(uhr);
    uhr = null;
    diashow.textContent = 'Diashow';
    balken.removeAttribute('data-an');
    decke.removeAttribute('data-diashow');
  };

  const starteDiashow = (): void => {
    laeuft = true;
    diashow.textContent = 'Diashow anhalten';
    decke.setAttribute('data-diashow', '');
    takte();
    /* Ein gesprochener Gruß dauert länger als vier Sekunden. Die Diashow
       wartet deshalb, solange ein Video läuft — sonst schneidet sie jeden
       Gruß nach einem Satz ab. */
    uhr = window.setInterval(() => {
      if (!bewegung.hidden && !bewegung.paused && !bewegung.ended) return;
      weiter(1);
    }, 4000);
  };

  /* Den Balken bei jedem Bild neu anstoßen. Ohne das Umbrechen läuft die
     Animation beim zweiten Bild nicht noch einmal. */
  const takte = (): void => {
    if (!laeuft) return;
    balken.removeAttribute('data-an');
    void balken.offsetWidth;
    balken.setAttribute('data-an', '');
  };

  const zeige = () => {
    const a = liste[i];
    if (!a) return;

    /* Ein laufender Gruß muss aufhören, wenn weitergeblättert wird — sonst
       reden zwei Gäste gleichzeitig aus dem Rechner. */
    bewegung.pause();

    if (a.video) {
      bewegung.src = adressen.get(a.id) ?? '';
      bewegung.hidden = false;
      bild.hidden = true;
      bild.removeAttribute('src');
    } else {
      bewegung.hidden = true;
      bewegung.removeAttribute('src');
      bild.hidden = false;
      // Gross zeigt die Bewegung, wenn es eine gibt.
      bild.src = bewegte.get(a.id) ?? adressen.get(a.id) ?? '';
    }
    zaehler.textContent = `${i + 1} von ${liste.length}`;
    takte();
    /* Der Streifen unten führt mit: Wer bei Bild 300 ist, soll ihn nicht
       selbst dorthin schieben müssen. */
    streifen.querySelectorAll('.gminiatur').forEach((m, nr) => {
      m.classList.toggle('an', nr === i);
      if (nr === i) m.scrollIntoView({ block: 'nearest', inline: 'center' });
    });
  };

  const weiter = (schritt: number) => {
    i = (i + schritt + liste.length) % liste.length;
    zeige();
  };

  const beenden = () => {
    stoppeDiashow();
    bewegung.pause();
    decke.remove();
    document.removeEventListener('keydown', taste);
  };

  const taste = (e: KeyboardEvent) => {
    if (e.key === 'Escape') beenden();
    /* Wer selbst blättert, will nicht gleichzeitig weitergeschoben werden. */
    if (e.key === 'ArrowLeft') { stoppeDiashow(); weiter(-1); }
    if (e.key === 'ArrowRight') { stoppeDiashow(); weiter(1); }
    if (e.key === ' ') { e.preventDefault(); laeuft ? stoppeDiashow() : starteDiashow(); }
  };

  zurueck.addEventListener('click', () => { stoppeDiashow(); weiter(-1); });
  vor.addEventListener('click', () => { stoppeDiashow(); weiter(1); });
  zu.addEventListener('click', beenden);
  diashow.addEventListener('click', () => (laeuft ? stoppeDiashow() : starteDiashow()));
  decke.addEventListener('click', (e) => {
    if (e.target === decke) beenden();
  });
  document.addEventListener('keydown', taste);

  /* Miniaturen: der schnellste Weg von Bild 12 zu Bild 300. */
  const streifen = tag('div', 'gstreifen');
  liste.forEach((a, nr) => {
    const m = tag('button', 'gminiatur') as HTMLButtonElement;
    const mb = document.createElement('img');
    mb.src = adressen.get(a.id) ?? '';
    mb.alt = '';
    mb.loading = 'lazy';
    m.append(mb);
    m.setAttribute('aria-label', `Bild ${nr + 1}`);
    m.addEventListener('click', () => { stoppeDiashow(); i = nr; zeige(); });
    streifen.append(m);
  });

  const leiste = tag('div', 'gleiste');
  leiste.append(zaehler, diashow, zu);

  decke.append(balken, zurueck, bild, bewegung, vor, streifen, leiste);
  document.body.append(decke);
  zeige();
  zu.focus();
}

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}
