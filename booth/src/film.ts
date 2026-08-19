/**
 * Die Einwegkamera — jedes Gästehandy wird zur Wegwerfkamera.
 *
 * Das Modul ist absichtlich das Gegenteil der Web-Kamera nebenan. Dort:
 * ansehen, verwerfen, noch einmal. Hier: einmal drücken, und weg ist es.
 *
 * Der Reiz liegt im Fehlenden. Wer jedes Bild sofort sieht, macht dasselbe
 * dreimal und behält das dritte — und am Ende gleichen sich alle. Wer nicht
 * nachsehen kann, drückt einmal ab und wendet sich wieder dem Abend zu. Was
 * am nächsten Tag ankommt, ist unschärfer, schiefer und deutlich näher an
 * dem, was wirklich los war.
 *
 * Drei Dinge dürfen deshalb NICHT gebaut werden, auch wenn sie leicht wären:
 *
 *  1. **Keine Vorschau.** Nicht als Aufblitzen, nicht als Miniatur in der
 *     Ecke. Ein halbe Sekunde sichtbares Bild reicht, um das Urteil
 *     „nochmal" auszulösen — und damit ist die Wette verloren.
 *  2. **Kein Löschen und kein zweiter Versuch.** Der Zähler geht nur in eine
 *     Richtung.
 *  3. **Kein Nachschauen.** Auch nicht über die Galerie: Die Bilder liegen
 *     bis zur Entwicklung in einem eigenen Ordner auf der Box, und keine
 *     Oberfläche kennt ihn.
 *
 * Das Zählwerk gehört der Box, nicht dem Browser. Läge es hier, wäre der
 * Film mit einem Neuladen wieder voll — und die einzige Regel des Moduls
 * hinfällig.
 */

import './stil.css';
import './film.css';
import { farbe, schrift } from './farben';
import { Kamera, deuteFehler } from './kamera';

/** Was die Box über einen Film herausgibt — nie die Bilder selbst. */
type Film = {
  id: string;
  name: string;
  laenge: number;
  uebrig: number;
  geknipst: number;
  look: 'neutral' | 'korn' | 'stempel' | 'blitz';
  entwickelt: boolean;
  entwickeltAm: number | null;
  nachladen: boolean;
};

type Lage = 'holen' | 'bereit' | 'live' | 'sendet' | 'voll' | 'fehler';

/* Der Film liegt auf dem Gerät, nicht im Konto. Wer sein Handy weggibt,
   gibt seinen Film weg — das ist gewollt, sonst wäre es eine Galerie mit
   Zähler. */
const SCHUBLADE = 'youbooth.film.kennung';

const wurzel = document.getElementById('film');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  const video = document.createElement('video');
  video.className = 'fmlive';
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('aria-hidden', 'true');

  const kamera = new Kamera(video);
  let seite: 'environment' | 'user' = 'environment';
  let film: Film | null = null;
  let lage: Lage = 'holen';
  let grund = '';

  const flaeche = tag('div', 'fmflaeche');
  const buehne = tag('div', 'fmbuehne');
  const blitz = tag('span', 'fmblitz');
  const werk = tag('span', 'fmwerk');
  werk.dataset.feld = 'werk';
  const ruhe = tag('div', 'fmruhe');
  buehne.append(video, blitz, ruhe, werk);

  const kopf = tag('header', 'fmkopf');
  const sagt = tag('p', 'fmsagt');
  sagt.setAttribute('role', 'status');
  const leiste = tag('div', 'fmleiste');

  flaeche.append(kopf, buehne, sagt, leiste);
  ziel.replaceChildren(flaeche);

  /* --- Zeichnen --------------------------------------------------- */

  /** Was in der Bühne steht, solange die Kamera aus ist. */
  const ruhetext = (): [string, string] => {
    if (lage === 'holen') return ['Wegwerfkamera', 'Trag deinen Namen ein — dann bekommst du einen Film.'];
    if (lage === 'voll') return ['Film voll', 'Alle Bilder sind unterwegs ins Labor.'];
    if (lage === 'fehler') return ['Kamera aus', 'Der Sucher erscheint, sobald die Kamera läuft.'];
    return ['Kamera aus', `Noch ${film?.uebrig ?? 0} von ${film?.laenge ?? 0} Aufnahmen.`];
  };

  const zeichne = (): void => {
    flaeche.dataset.lage = lage;
    leiste.replaceChildren();
    kopf.replaceChildren();

    const [marke, text] = ruhetext();
    ruhe.replaceChildren(
      tag('span', 'fmruhe__marke', marke),
      tag('p', 'fmruhe__text', text)
    );

    if (film) {
      kopf.append(
        tag('span', 'fmmarke', 'Einwegkamera'),
        tag('span', 'fmname', film.name)
      );
      werk.textContent = `${film.uebrig}`;
      werk.title = `${film.uebrig} von ${film.laenge} Aufnahmen übrig`;
    }

    if (lage === 'holen') {
      leiste.append(namensfeld());
      return;
    }

    if (lage === 'bereit') {
      sagt.textContent = film?.entwickelt
        ? 'Dein Film ist entwickelt. Die Bilder liegen in der Galerie.'
        : 'Kamera aus. Der Film läuft weiter, wenn du sie wieder einschaltest.';
      leiste.append(knopf('Kamera einschalten', 'amber', () => void anschalten()));
      if (film?.entwickelt) {
        leiste.append(verweis('Zur Galerie', './galerie.html'));
      }
      return;
    }

    if (lage === 'live') {
      /* Der wichtigste Satz der ganzen Oberfläche. Ohne ihn drückt der erste
         Gast zweimal und wundert sich, warum nichts kommt. */
      sagt.textContent = 'Einmal drücken. Kein Nachschauen — genau das ist der Witz.';
      leiste.append(
        knopf('Wenden', 'still', () => void wende()),
        ausloeser(() => void loeseAus()),
        knopf('Pause', 'still', () => {
          kamera.stoppe();
          lage = 'bereit';
          zeichne();
        })
      );
      return;
    }

    if (lage === 'sendet') {
      sagt.textContent = 'Weiter …';
      return;
    }

    if (lage === 'voll') {
      sagt.textContent = film?.entwickelt
        ? 'Film voll und entwickelt. Alle Bilder liegen in der Galerie.'
        : entwicklungssatz(film);
      if (film?.entwickelt) leiste.append(verweis('Zur Galerie', './galerie.html'));
      if (film?.nachladen) {
        leiste.append(knopf('Neuen Film holen', 'still', () => {
          try {
            localStorage.removeItem(SCHUBLADE);
          } catch {
            /* Ohne Speicher geht es auch — dann eben je Aufruf ein Film. */
          }
          film = null;
          lage = 'holen';
          zeichne();
        }));
      }
      return;
    }

    sagt.textContent = grund;
    leiste.append(knopf('Noch einmal versuchen', 'amber', () => void anschalten()));
  };

  /** Das Namensfeld beim Filmholen. Ein Feld, ein Knopf, sonst nichts. */
  const namensfeld = (): HTMLElement => {
    const block = tag('form', 'fmholen');
    sagt.textContent =
      'Ein Film mit begrenzter Anzahl Aufnahmen. Kein Löschen, kein Nachschauen — ' +
      'entwickelt wird später, dann bekommt ihr alle Bilder auf einmal.';

    const eingabe = document.createElement('input');
    eingabe.className = 'eingabe fmeingabe';
    eingabe.placeholder = 'Dein Name';
    eingabe.maxLength = 60;
    eingabe.autocomplete = 'name';
    eingabe.required = true;

    const los = knopf('Film holen', 'amber', () => undefined);
    los.type = 'submit';

    block.append(eingabe, los);
    block.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = eingabe.value.trim();
      if (!name) {
        eingabe.focus();
        return;
      }
      void holeFilm(name);
    });
    return block;
  };

  /* --- Film und Box ----------------------------------------------- */

  const holeFilm = async (name: string): Promise<void> => {
    try {
      const antwort = await fetch('/api/film', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const daten = (await antwort.json()) as { film?: Film; error?: string };
      if (!antwort.ok || !daten.film) throw new Error(daten.error || 'Kein Film');
      film = daten.film;
      try {
        localStorage.setItem(SCHUBLADE, film.id);
      } catch {
        /* Kein Speicher: Der Film läuft, aber ein Neuladen verliert ihn.
           Besser als gar keine Kamera. */
      }
      lage = 'bereit';
    } catch (fehler) {
      grund = fehler instanceof Error ? fehler.message : 'Die Box antwortet nicht.';
      lage = 'fehler';
    }
    zeichne();
  };

  /** Den Film vom letzten Mal wiederfinden. */
  const nimmAuf = async (): Promise<void> => {
    let kennung = '';
    try {
      kennung = localStorage.getItem(SCHUBLADE) || '';
    } catch {
      kennung = '';
    }
    if (!kennung) return;

    try {
      const antwort = await fetch('/api/film/' + encodeURIComponent(kennung));
      if (!antwort.ok) throw new Error(String(antwort.status));
      const daten = (await antwort.json()) as { film: Film };
      film = daten.film;
      lage = film.uebrig > 0 ? 'bereit' : 'voll';
    } catch {
      /* Der Film ist weg — etwa weil die Box neu aufgesetzt wurde. Dann
         bekommt der Gast einen neuen, statt vor einer Fehlermeldung zu
         stehen. */
      try {
        localStorage.removeItem(SCHUBLADE);
      } catch {
        /* dann eben nicht */
      }
    }
  };

  const anschalten = async (): Promise<void> => {
    try {
      await hole(seite);
      lage = 'live';
    } catch (fehler) {
      grund = deuteFehler(fehler).text;
      lage = 'fehler';
    }
    zeichne();
  };

  const hole = async (welche: 'user' | 'environment'): Promise<void> => {
    kamera.stoppe();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('keine');
    const strom = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: welche },
      audio: false,
    });
    video.srcObject = strom;
    await video.play();
    if (video.videoWidth === 0) {
      await new Promise<void>((fertig) =>
        video.addEventListener('loadedmetadata', () => fertig(), { once: true })
      );
    }
    (kamera as unknown as { strom: MediaStream | null }).strom = strom;
  };

  const wende = async (): Promise<void> => {
    seite = seite === 'user' ? 'environment' : 'user';
    try {
      await hole(seite);
    } catch {
      // Nur eine Kamera am Gerät: dann bleibt es bei der einen.
      seite = seite === 'user' ? 'environment' : 'user';
      await hole(seite).catch(() => undefined);
    }
    zeichne();
  };

  const loeseAus = async (): Promise<void> => {
    if (!film || lage !== 'live') return;

    /* Der Blitz ist hier keine Zierde: Er ist die EINZIGE Rückmeldung, dass
       das Bild aufgenommen wurde. Ohne ihn drückt der Gast noch einmal. */
    blitz.dataset.an = '';
    window.setTimeout(() => blitz.removeAttribute('data-an'), 260);

    const bild = kamera.standbild(seite === 'user');
    const fertig = mitLook(bild, film.look, film.geknipst + 1);

    /* Die Kamera bleibt AN. Ein Gast mit vierundzwanzig Bildern schaltet
       nicht vierundzwanzigmal ein — er dreht sich um und drückt wieder. */
    lage = 'sendet';
    zeichne();

    try {
      const antwort = await fetch(`/api/film/${encodeURIComponent(film.id)}/bild`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: fertig.toDataURL('image/jpeg', 0.88) }),
      });
      const daten = (await antwort.json()) as { film?: Film; error?: string };
      if (daten.film) film = daten.film;
      if (!antwort.ok && antwort.status !== 409) throw new Error(daten.error || 'Nicht angekommen');
      lage = film && film.uebrig > 0 ? 'live' : 'voll';
      if (lage === 'voll') kamera.stoppe();
    } catch {
      /* Kein Netz. Das Bild ist weg — und das muss der Gast erfahren,
         denn im Gegensatz zur Web-Kamera kann er es nicht wiederholen,
         ohne dass er es weiß. Der Zähler steht noch, also darf er es. */
      grund = 'Das Bild kam nicht an. Das Zählwerk steht noch — noch einmal drücken.';
      lage = 'live';
      sagt.textContent = grund;
    }
    zeichne();
    if (lage === 'live') sagt.textContent = grund || 'Weiter geht’s.';
    grund = '';
  };

  await nimmAuf();
  zeichne();
}

/* ------------------------------------------------------------------ */
/* Der Look                                                            */
/* ------------------------------------------------------------------ */

/**
 * Legt die Anmutung auf die Aufnahme — auf dem Gerät des Gastes, nicht auf
 * der Box.
 *
 * Der Grund ist Rechenzeit: Eine Box, die für hundertachtzig Gästebilder
 * je Abend Korn rechnet, rechnet nichts anderes mehr. Achtzig Handys, die
 * je ihr eigenes Bild bearbeiten, merken es nicht.
 */
function mitLook(
  quelle: HTMLCanvasElement,
  look: Film['look'],
  nummer: number
): HTMLCanvasElement {
  if (look === 'neutral') return quelle;

  const stift = quelle.getContext('2d');
  if (!stift) return quelle;

  if (look === 'korn' || look === 'stempel') korn(stift, quelle);
  if (look === 'blitz') hartesLicht(stift, quelle);
  if (look === 'stempel') datumsstempel(stift, quelle, nummer);
  return quelle;
}

/** Kleinbild-Korn: feines Rauschen, in den Schatten stärker als im Licht. */
function korn(stift: CanvasRenderingContext2D, flaeche: HTMLCanvasElement): void {
  const bild = stift.getImageData(0, 0, flaeche.width, flaeche.height);
  const d = bild.data;
  /* Die Stärke hängt von der Bildgröße ab. Ein festes Maß sieht auf einem
     Handy mit 12 Megapixeln aus wie Staub und auf 640 × 480 wie Schnee. */
  const staerke = Math.max(8, Math.min(22, flaeche.width / 90));

  for (let i = 0; i < d.length; i += 4) {
    const hell = (d[i]! + d[i + 1]! + d[i + 2]!) / 765;
    // In den Schatten liegt das Korn eines Films sichtbarer als in den Lichtern.
    const anteil = staerke * (1.25 - hell);
    const stoss = (Math.random() - 0.5) * anteil;
    d[i] = klemme(d[i]! + stoss);
    d[i + 1] = klemme(d[i + 1]! + stoss);
    d[i + 2] = klemme(d[i + 2]! + stoss);
  }
  stift.putImageData(bild, 0, 0);
}

/**
 * Blitz-Anmutung: harte Mitte, abfallende Ränder, leicht kühler Ton — so
 * sieht ein Bild aus, das ein winziger Reflektor aus zwei Metern beleuchtet
 * hat.
 */
function hartesLicht(stift: CanvasRenderingContext2D, flaeche: HTMLCanvasElement): void {
  const b = flaeche.width;
  const h = flaeche.height;

  stift.save();
  stift.globalCompositeOperation = 'overlay';
  const licht = stift.createRadialGradient(b / 2, h * 0.42, 0, b / 2, h * 0.42, Math.max(b, h) * 0.72);
  licht.addColorStop(0, farbe('--weiss', 0.34));
  licht.addColorStop(0.55, farbe('--weiss', 0.04));
  /* Echtes Schwarz, kein Tokenwert: Der Randabfall eines Blitzes ist ein
     Lichtmangel, keine Hausfarbe — er bliebe schwarz, auch wenn das ganze
     Gestaltungssystem morgen grün wäre. */
  licht.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
  stift.fillStyle = licht;
  stift.fillRect(0, 0, b, h);
  stift.restore();

  stift.save();
  stift.globalCompositeOperation = 'soft-light';
  stift.fillStyle = farbe('--blitzlicht', 0.16);
  stift.fillRect(0, 0, b, h);
  stift.restore();
}

/**
 * Der Datumsstempel des Labors: unten rechts, orange, in einer Schrift mit
 * gleichen Ziffernbreiten. Er trägt Datum, Uhrzeit und Bildnummer — genau
 * das, was auf einem entwickelten Abzug stand.
 */
function datumsstempel(
  stift: CanvasRenderingContext2D,
  flaeche: HTMLCanvasElement,
  nummer: number
): void {
  const jetzt = new Date();
  const zwei = (n: number) => String(n).padStart(2, '0');
  const text =
    `${zwei(jetzt.getDate())}.${zwei(jetzt.getMonth() + 1)}.${jetzt.getFullYear()} ` +
    `${zwei(jetzt.getHours())}:${zwei(jetzt.getMinutes())}  #${zwei(nummer)}`;

  const groesse = Math.max(13, Math.round(flaeche.width / 42));
  stift.save();
  stift.font = schrift(groesse, 600);
  stift.textAlign = 'right';
  stift.textBaseline = 'alphabetic';

  /* Zweimal gezeichnet: Der Stempel eines Labors brennt ins Bild, er liegt
     nicht darauf. Ein Schein darunter hält ihn auch auf hellem Grund
     lesbar — ohne Kasten, der wie ein Wasserzeichen aussähe. */
  const x = flaeche.width - groesse;
  const y = flaeche.height - groesse;
  stift.shadowColor = 'rgba(0, 0, 0, 0.55)';
  stift.shadowBlur = groesse * 0.5;
  stift.fillStyle = farbe('--laborstempel', 0.92);
  stift.fillText(text, x, y);
  stift.shadowBlur = 0;
  stift.fillText(text, x, y);
  stift.restore();
}

const klemme = (wert: number): number => (wert < 0 ? 0 : wert > 255 ? 255 : wert);

/* ------------------------------------------------------------------ */

/** Was auf dem Schlussbildschirm steht, wenn der Film voll ist. */
function entwicklungssatz(film: Film | null): string {
  if (!film) return 'Der Film ist voll.';
  if (film.entwickeltAm === null) {
    return 'Film voll. Entwickelt wird von Hand — die Bilder kommen, sobald die Gastgeber sie freigeben.';
  }
  const wann = new Date(film.entwickeltAm);
  const zwei = (n: number) => String(n).padStart(2, '0');
  return (
    `Film voll — ${film.laenge} Aufnahmen. Entwickelt wird am ` +
    `${zwei(wann.getDate())}.${zwei(wann.getMonth() + 1)}. um ${zwei(wann.getHours())}:${zwei(wann.getMinutes())} Uhr. ` +
    'Dann kommen alle Bilder auf einmal.'
  );
}

function ausloeser(tue: () => void): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = 'fmausloeser';
  k.setAttribute('aria-label', 'Auslösen');
  k.append(tag('span', 'fmring'));
  k.addEventListener('click', tue);
  return k;
}

function knopf(text: string, art: 'amber' | 'still', tue: () => void): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = art === 'amber' ? 'knopf knopf--amber fmknopf' : 'knopf knopf--rahmen-hell fmknopf';
  k.textContent = text;
  k.addEventListener('click', tue);
  return k;
}

function verweis(text: string, ziel: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'knopf knopf--rahmen-hell fmknopf';
  a.href = ziel;
  a.textContent = text;
  return a;
}

function tag(name: string, klasse: string, text = ''): HTMLElement {
  const el = document.createElement(name);
  el.className = klasse;
  if (text) el.textContent = text;
  return el;
}
