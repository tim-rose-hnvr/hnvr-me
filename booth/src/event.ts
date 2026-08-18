/**
 * Event-Seite — was der Kunde nach der Feier bekommt.
 *
 * Eine Adresse, die man weitergeben kann: `…/m/hochzeit-lena-jonas`. Darauf
 * stehen die Bilder des Abends, der Name des Paares und, wenn gewünscht, ein
 * Kennwort davor und ein Datum, an dem alles verschwindet.
 *
 * Was die Seite zeigen darf, entscheidet die Box, nicht diese Datei:
 * `/api/microsites/public/:slug` gibt bei abgelaufener Frist nur noch den
 * Titel heraus, bei gesetztem Kennwort ohne richtiges Kennwort ebenso — und
 * das Kennwort selbst kommt nie mit. Rechte werden nie in der Oberfläche
 * geprüft; hier wird nur gezeichnet, was angekommen ist.
 */

import './stil.css';
import './event.css';

type Seite = {
  slug: string;
  title: string;
  headline?: string;
  subtitle?: string;
  accent?: string;
  logo?: string | null;
  gallery?: boolean;
  theme?: 'glow' | 'photo' | 'minimal';
  expires?: string;
  base?: string;
  /** Nur diese beiden kommen, wenn die Seite zu ist. */
  expired?: boolean;
  locked?: boolean;
};

type Aufnahme = { name: string; url: string; time: number; type: string };

const wurzel = document.getElementById('event');
if (wurzel) void starte(wurzel);

/** Die Kennung steht im Weg (`/m/<kennung>`) oder — im Entwicklungsbetrieb — als Frage. */
function kennung(): string {
  const ausWeg = location.pathname.match(/^\/m\/([^/]+)/);
  if (ausWeg) return decodeURIComponent(ausWeg[1]!);
  return new URLSearchParams(location.search).get('slug') ?? '';
}

async function starte(ziel: HTMLElement): Promise<void> {
  const slug = kennung();
  if (!slug) return zeige(ziel, fehlseite('Diese Adresse führt zu keiner Feier.'));

  const kennwort = sessionStorage.getItem('youbooth.event.' + slug) ?? '';
  await zeigeSeite(ziel, slug, kennwort);
}

async function zeigeSeite(ziel: HTMLElement, slug: string, kennwort: string): Promise<void> {
  let seite: Seite;
  try {
    const antwort = await fetch(
      `/api/microsites/public/${encodeURIComponent(slug)}` +
        (kennwort ? `?pw=${encodeURIComponent(kennwort)}` : '')
    );
    if (!antwort.ok) throw new Error(String(antwort.status));
    seite = (await antwort.json()) as Seite;
  } catch {
    return zeige(ziel, fehlseite('Diese Seite gibt es nicht mehr.'));
  }

  if (seite.accent) document.documentElement.style.setProperty('--eakzent', seite.accent);
  document.title = seite.title;

  if (seite.expired) {
    return zeige(
      ziel,
      kopf(seite),
      hinweiskarte(
        'Die Bilder sind weg',
        'Die Frist für diese Feier ist abgelaufen. Das war so vereinbart — gelöscht ist gelöscht, ' +
          'auch bei uns.'
      )
    );
  }

  if (seite.locked) return zeige(ziel, kopf(seite), kennwortkarte(ziel, slug));

  const teile: HTMLElement[] = [kopf(seite)];

  if (seite.gallery !== false) {
    let bilder: Aufnahme[] = [];
    try {
      const grund = (seite.base || '').replace(/\/$/, '');
      bilder = (await (await fetch(grund + '/api/photos')).json()) as Aufnahme[];
    } catch {
      teile.push(hinweiskarte('Gerade nicht erreichbar', 'Die Bilder liegen auf der Box. Bitte später noch einmal.'));
    }
    teile.push(bilder.length ? galerie(bilder, seite.base || '') : hinweiskarte('Noch nichts da', 'Sobald die ersten Bilder entstanden sind, stehen sie hier.'));
  }

  if (seite.expires) {
    teile.push(
      fusszeile(
        `Diese Seite ist bis zum ${datum(seite.expires)} erreichbar. Wer die Bilder behalten will, lädt sie vorher herunter.`
      )
    );
  }

  zeige(ziel, ...teile);
}

/* ------------------------------------------------------------------ */
/* Bausteine                                                           */
/* ------------------------------------------------------------------ */

function kopf(seite: Seite): HTMLElement {
  const bereich = tag('header', `ekopf ekopf--${seite.theme ?? 'glow'}`);

  if (seite.logo) {
    const bild = document.createElement('img');
    bild.className = 'ekopf__logo';
    bild.src = seite.logo;
    bild.alt = '';
    bereich.append(bild);
  }

  const titel = document.createElement('h1');
  titel.textContent = seite.headline || seite.title;
  bereich.append(titel);

  if (seite.subtitle) {
    const zeile = tag('p', 'efliess');
    zeile.textContent = seite.subtitle;
    bereich.append(zeile);
  }
  return bereich;
}

function galerie(bilder: Aufnahme[], grund: string): HTMLElement {
  const bereich = tag('section', 'ebereich');
  const kopfzeile = tag('div', 'ebereich__kopf');
  const titel = document.createElement('h2');
  titel.textContent = 'Die Bilder';
  const zahl = tag('span', 'emono');
  zahl.textContent = `${bilder.length} Aufnahmen`;

  // Alles auf einmal: der Wunsch, den jeder Kunde zuerst äußert.
  const alle = tag('a', 'eknopf') as HTMLAnchorElement;
  alle.href = grund + '/api/photos.zip';
  alle.textContent = 'Alle herunterladen';

  kopfzeile.append(titel, zahl, alle);
  bereich.append(kopfzeile);

  const raster = tag('div', 'eraster');
  bilder.forEach((b) => {
    const kachel = tag('figure', 'ebild');
    const bild = document.createElement('img');
    bild.src = grund + b.url;
    bild.alt = '';
    bild.loading = 'lazy';
    bild.decoding = 'async';

    const laden = tag('a', 'ebild__laden') as HTMLAnchorElement;
    laden.href = grund + b.url;
    laden.download = b.name;
    laden.textContent = 'Sichern';

    kachel.append(bild, laden);
    raster.append(kachel);
  });

  bereich.append(raster);
  return bereich;
}

function kennwortkarte(ziel: HTMLElement, slug: string): HTMLElement {
  const bereich = tag('section', 'ekarte');
  const titel = document.createElement('h2');
  titel.textContent = 'Kennwort';
  const text = tag('p', 'efliess');
  text.textContent = 'Diese Feier ist nicht öffentlich. Das Kennwort steht auf eurer Karte.';

  const zeile = tag('div', 'ereihe');
  const feld = document.createElement('input');
  feld.className = 'eeingabe';
  feld.type = 'password';
  feld.setAttribute('aria-label', 'Kennwort');
  const knopf = tag('button', 'eknopf eknopf--amber');
  knopf.textContent = 'Öffnen';

  const meldung = tag('p', 'emeldung');

  const pruefe = () => {
    const wert = feld.value.trim();
    if (!wert) return;
    // Im Sitzungsspeicher, nicht dauerhaft: Ein geteiltes Handy soll die
    // Bilder nicht offen lassen.
    sessionStorage.setItem('youbooth.event.' + slug, wert);
    void zeigeSeite(ziel, slug, wert).then(() => {
      if (document.querySelector('.ekarte')) {
        meldung.textContent = 'Das war nicht das richtige Kennwort.';
        sessionStorage.removeItem('youbooth.event.' + slug);
      }
    });
  };

  knopf.addEventListener('click', pruefe);
  feld.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pruefe();
  });

  zeile.append(feld, knopf);
  bereich.append(titel, text, zeile, meldung);
  queueMicrotask(() => feld.focus());
  return bereich;
}

function hinweiskarte(titel: string, text: string): HTMLElement {
  const bereich = tag('section', 'ekarte');
  const h = document.createElement('h2');
  h.textContent = titel;
  const p = tag('p', 'efliess');
  p.textContent = text;
  bereich.append(h, p);
  return bereich;
}

function fehlseite(text: string): HTMLElement {
  return hinweiskarte('Nichts gefunden', text);
}

function fusszeile(text: string): HTMLElement {
  const el = tag('p', 'efuss');
  el.textContent = text;
  return el;
}

/* ------------------------------------------------------------------ */
/* Helfer                                                              */
/* ------------------------------------------------------------------ */

function zeige(ziel: HTMLElement, ...teile: HTMLElement[]): void {
  ziel.replaceChildren(...teile);
}

function tag(name: string, klasse: string): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  return el;
}

function datum(schluessel: string): string {
  const teile = schluessel.split('-');
  return teile.length === 3 ? `${teile[2]}.${teile[1]}.${teile[0]}` : schluessel;
}
