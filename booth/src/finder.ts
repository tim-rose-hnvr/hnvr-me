/**
 * Der Foto-Finder — ein Selfie statt vierhundert Mal scrollen.
 *
 * Die ganze Seite ist um eine Zusage herum gebaut, und die Zusage lautet:
 * **Dein Selfie verlässt dieses Gerät nicht.** Nicht zum Abgleich, nicht
 * verschlüsselt, nicht kurz. Es wird auf dem Handy in 128 Zahlen übersetzt,
 * diese Zahlen werden auf dem Handy mit der Liste der Box verglichen, und
 * zur Box geht nichts als die Bitte, ein paar Dateien anzuzeigen.
 *
 * Das ist kein Feinschliff, sondern der Grund, warum das Modul überhaupt
 * gebaut werden konnte: Ein Gesicht ist nach Art. 9 DSGVO ein besonderes
 * Datum. Ein Suchbild, das eine Box erreicht, ist eine Verarbeitung, die
 * jemand verantworten muss. Ein Suchbild, das das Gerät nie verlässt, ist
 * keine.
 *
 * Der Ablauf steht deshalb in dieser Reihenfolge:
 *   1. sagen, was passiert — vor dem ersten Tippen, nicht im Kleingedruckten
 *   2. Modell laden (rund sieben Megabyte, aus dem WLAN der Box)
 *   3. Selfie aufnehmen, Merkmal rechnen, Selfie verwerfen
 *   4. auf dem Gerät vergleichen
 *   5. Treffer zeigen — und einen Weg, sie alle mitzunehmen
 */

import './stil.css';
import './finder.css';
import { Kamera, deuteFehler } from './kamera';
/* NUR die Typen fest — die Erkennung selbst wiegt 1,3 Megabyte und wird
   erst geladen, wenn der Gast zugestimmt hat. Ein statischer Import zöge sie
   in jede Ansicht dieser Seite, auch in die, bei der jemand nur liest, was
   hier passiert, und dann weitergeht. */
import type { Eintrag, Treffer } from './gesichter';

type Lage = 'aus' | 'erklaerung' | 'laedt' | 'live' | 'sucht' | 'treffer' | 'nichts' | 'fehler';

type Stand = {
  liste: Eintrag[];
  offen: number;
  hinweis: boolean;
  einwilligung: boolean;
  einwilligungstext: string;
};

const wurzel = document.getElementById('finder');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  let lage: Lage = 'erklaerung';
  let grund = '';
  let stand: Stand | null = null;
  let treffer: Treffer[] = [];
  let einverstanden = false;

  const video = document.createElement('video');
  video.className = 'fdlive';
  video.playsInline = true;
  video.muted = true;
  video.setAttribute('aria-hidden', 'true');
  const kamera = new Kamera(video);

  const buehne = tag('div', 'fdbuehne');
  const ruhe = tag('div', 'fdruhe');
  buehne.append(video, ruhe);

  const sagt = tag('p', 'fdsagt');
  sagt.setAttribute('role', 'status');
  const leiste = tag('div', 'fdleiste');
  const raster = tag('div', 'fdraster');

  const flaeche = tag('div', 'fdflaeche');
  flaeche.append(buehne, sagt, leiste, raster);
  ziel.replaceChildren(flaeche);

  /* --- Zeichnen ---------------------------------------------------- */

  const zeichne = (): void => {
    flaeche.dataset.lage = lage;
    leiste.replaceChildren();
    raster.replaceChildren();
    ruhe.replaceChildren();

    if (lage === 'aus') {
      ruheText('Nicht eingeschaltet', 'Für diese Feier ist der Foto-Finder nicht freigegeben.');
      sagt.textContent = '';
      leiste.append(verweis('Zur Galerie', './galerie.html'));
      return;
    }

    if (lage === 'erklaerung') {
      ruheText('Deine Bilder finden', 'Ein Selfie genügt — es bleibt auf diesem Gerät.');
      sagt.replaceChildren(...erklaerung());
      const los = knopf('Einverstanden, Kamera an', 'amber', () => void anschalten());
      if (stand?.einwilligung && !einverstanden) los.setAttribute('disabled', 'true');
      leiste.append(los, verweis('Lieber alles ansehen', './galerie.html'));
      return;
    }

    if (lage === 'laedt') {
      ruheText('Einen Moment', 'Die Erkennung wird geladen — rund sieben Megabyte aus dem WLAN der Box.');
      sagt.textContent = 'Das passiert einmal. Danach geht die Suche in Sekunden.';
      return;
    }

    if (lage === 'live') {
      sagt.textContent = 'Halte dein Gesicht in den Rahmen und tippe auf den Auslöser.';
      leiste.append(
        knopf('Abbrechen', 'still', () => {
          kamera.stoppe();
          lage = 'erklaerung';
          zeichne();
        }),
        ausloeser(() => void sucheJetzt())
      );
      return;
    }

    if (lage === 'sucht') {
      sagt.textContent = 'Wird verglichen — hier auf deinem Gerät.';
      return;
    }

    if (lage === 'treffer') {
      const sichere = treffer.filter((t) => t.sicher);
      const unsichere = treffer.filter((t) => !t.sicher);
      const wieviel = sichere.length;
      sagt.textContent =
        `${wieviel} ${wieviel === 1 ? 'Bild' : 'Bilder'} mit dir` +
        (stand && stand.offen > 0
          ? ` · ${stand.offen} Aufnahmen sind noch nicht erfasst und konnten nicht durchsucht werden.`
          : '.');
      /* Alle Treffer in einem Zug. Siebzehnmal auf „Herunterladen" zu tippen
         macht niemand — und wer es doch tut, hat danach siebzehn Dateien im
         Downloadordner und keine Ahnung, welche zusammengehören. */
      /* Ins Paket kommen NUR die sicheren. Ein Gast, der auf „alle
         herunterladen" tippt, erwartet seine Bilder — nicht die von
         jemandem, der ihm ähnlich sieht. */
      if (wieviel > 0) {
        const paket = tag('a', 'knopf knopf--amber fdknopf') as HTMLAnchorElement;
        paket.href =
          '/api/photos.zip?nur=' + encodeURIComponent(sichere.map((t) => t.datei).join(','));
        paket.setAttribute('download', 'meine-bilder.zip');
        paket.textContent = `Alle ${wieviel} herunterladen`;
        leiste.append(paket);
      }

      leiste.append(
        knopf('Noch einmal suchen', 'still', () => void anschalten()),
        verweis('Alle Bilder ansehen', './galerie.html')
      );

      sichere.forEach((t) => raster.append(kachel(t)));

      /* Die Zweifelsfälle stehen darunter, hinter einer eigenen Überschrift
         und ausdrücklich als unsicher benannt. Sie ungefragt unter „deine
         Bilder" zu mischen hieße, die Entscheidung der Schwelle zu
         überlassen — und die Schwelle kennt den Gast nicht. */
      if (unsichere.length > 0) {
        const klappe = document.createElement('details');
        klappe.className = 'fdvielleicht';
        const kopf = document.createElement('summary');
        kopf.textContent = `${unsichere.length} weitere könnten passen`;
        const hinweis = tag(
          'p',
          'fdvielleicht__text',
          'Hier ist sich die Erkennung nicht sicher. Sieh selbst nach — es kann ' +
            'auch jemand sein, der dir ähnlich sieht.'
        );
        const zweites = tag('div', 'fdraster');
        unsichere.forEach((t) => zweites.append(kachel(t)));
        klappe.append(kopf, hinweis, zweites);
        raster.append(klappe);
      }
      return;
    }

    if (lage === 'nichts') {
      ruheText('Nichts gefunden', 'Auf keiner Aufnahme ist ein Gesicht, das zu deinem passt.');
      sagt.textContent =
        (stand && stand.offen > 0
          ? `${stand.offen} Aufnahmen sind noch nicht erfasst. `
          : '') +
        'Bei wenig Licht oder halb abgewandtem Gesicht hilft ein zweiter Versuch.';
      leiste.append(
        knopf('Noch einmal', 'amber', () => void anschalten()),
        verweis('Alle Bilder ansehen', './galerie.html')
      );
      return;
    }

    ruheText('Das ging nicht', grund);
    sagt.textContent = '';
    leiste.append(
      knopf('Noch einmal versuchen', 'amber', () => void anschalten()),
      verweis('Zur Galerie', './galerie.html')
    );
  };

  const ruheText = (marke: string, text: string): void => {
    ruhe.append(tag('span', 'fdruhe__marke', marke), tag('p', 'fdruhe__text', text));
  };

  /**
   * Was passiert, in vier Sätzen — vor dem ersten Tippen.
   *
   * Nicht im Kleingedruckten und nicht hinter einem Aufklapper: Wer eine
   * Kamera auf sein Gesicht richtet, soll vorher gelesen haben, wohin das
   * Bild geht. Dass die Antwort „nirgendwohin" lautet, ist das Beste, was
   * dieses Modul zu bieten hat, und gehört nach oben.
   */
  const erklaerung = (): HTMLElement[] => {
    const stuecke: HTMLElement[] = [
      tag('span', 'fdpunkt', 'Dein Selfie bleibt auf diesem Gerät. Es wird nicht gesendet und nicht gespeichert.'),
      tag('span', 'fdpunkt', 'Aus dem Gesicht werden 128 Zahlen gerechnet. Auch die bleiben hier.'),
      tag('span', 'fdpunkt', 'Verglichen wird auf deinem Handy. Die Box erfährt nur, welche Bilder du sehen willst.'),
    ];

    if (stand?.einwilligungstext) {
      stuecke.push(tag('span', 'fdpunkt fdpunkt--betreiber', stand.einwilligungstext));
    }

    if (stand?.einwilligung) {
      /* Ein Haken, kein vorausgefülltes Kästchen: Eine Einwilligung, die
         schon gesetzt ist, ist keine. */
      const zeile = tag('label', 'fdhaken');
      const kasten = document.createElement('input');
      kasten.type = 'checkbox';
      kasten.checked = einverstanden;
      kasten.addEventListener('change', () => {
        einverstanden = kasten.checked;
        zeichne();
      });
      zeile.append(kasten, tag('span', '', 'Ich bin einverstanden, dass mein Gesicht auf diesem Gerät mit den Aufnahmen verglichen wird.'));
      stuecke.push(zeile);
    }
    return stuecke;
  };

  const kachel = (t: Treffer): HTMLElement => {
    const feld = tag('figure', 'fdkachel');
    const bild = document.createElement('img');
    bild.src = `/photos/${encodeURIComponent(t.datei)}`;
    bild.alt = '';
    bild.loading = 'lazy';
    /* Die Bilder liegen auf der Box. Ist sie weg, bleibt sonst eine leere
       Kachel stehen — und der Gast hält sein Foto für kaputt statt die
       Verbindung. */
    bild.addEventListener('error', () => {
      feld.classList.add('fdkachel--weg');
      feld.append(tag('span', 'fdkachel__weg', 'Bild nicht erreichbar'));
    }, { once: true });

    const laden = tag('a', 'knopf knopf--rahmen-hell fdladen') as HTMLAnchorElement;
    laden.href = bild.src;
    laden.download = t.datei;
    laden.textContent = 'Herunterladen';

    /* Wie sicher der Treffer ist, in Worten statt in Zahlen: „0,42" sagt
       einem Gast nichts, „ziemlich sicher" schon. */
    const guete = tag(
      'span',
      t.sicher ? 'fdguete' : 'fdguete fdguete--unsicher',
      t.sicher ? (t.abstand < 0.35 ? 'sicher' : 'ziemlich sicher') : 'könnte passen'
    );
    feld.append(bild, guete, laden);
    return feld;
  };

  /* --- Ablauf ------------------------------------------------------ */

  const holeStand = async (): Promise<void> => {
    try {
      const antwort = await fetch('/api/gesichter');
      if (antwort.status === 403) {
        lage = 'aus';
        return;
      }
      if (!antwort.ok) throw new Error(String(antwort.status));
      stand = (await antwort.json()) as Stand;
      if (lage === 'erklaerung' || lage === 'fehler') lage = 'erklaerung';
    } catch {
      stand = null;
      grund = 'Die Box antwortet nicht. Seid ihr im richtigen WLAN?';
      lage = 'fehler';
    }
  };

  /* Die Erkennung, einmal geholt. Sie wiegt so viel wie die halbe Seite. */
  let erkennung: typeof import('./gesichter') | null = null;

  const anschalten = async (): Promise<void> => {
    treffer = [];
    // Erst das Modell, dann die Kamera: Sonst leuchtet sie sieben Megabyte lang.
    lage = 'laedt';
    zeichne();
    try {
      erkennung = erkennung ?? (await import('./gesichter'));
      await erkennung.ladeModell();
    } catch {
      grund = 'Die Gesichtserkennung ließ sich nicht laden.';
      lage = 'fehler';
      zeichne();
      return;
    }

    try {
      await hole();
      lage = 'live';
    } catch (fehler) {
      grund = deuteFehler(fehler).text;
      lage = 'fehler';
    }
    zeichne();
  };

  const hole = async (): Promise<void> => {
    kamera.stoppe();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('keine');
    const strom = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = strom;
    await video.play();
    if (video.videoWidth === 0) {
      await new Promise<void>((f) =>
        video.addEventListener('loadedmetadata', () => f(), { once: true })
      );
    }
    (kamera as unknown as { strom: MediaStream | null }).strom = strom;
  };

  const sucheJetzt = async (): Promise<void> => {
    lage = 'sucht';
    zeichne();

    /* Das Standbild wird gezogen, gemessen und fällt danach aus dem
       Gedächtnis — es landet in keiner Variablen, die die Funktion überlebt. */
    let such: number[] | null = null;
    try {
      const standbild = kamera.standbild(true);
      such = erkennung ? await erkennung.suchmerkmal(standbild) : null;
      standbild.width = 0;
      standbild.height = 0;
    } catch {
      such = null;
    }
    kamera.stoppe();

    if (!such) {
      grund = 'Auf dem Bild war kein Gesicht zu erkennen. Mehr Licht, Kamera etwas näher.';
      lage = 'fehler';
      zeichne();
      return;
    }

    /* Ohne Liste keine Aussage. „Nichts gefunden" wäre hier gelogen: Es ist
       nichts DURCHSUCHT worden. Wer der Box glaubt, sie habe nachgesehen,
       geht mit dem Eindruck weg, es gebe keine Bilder von ihm. */
    if (!stand) await holeStand();
    if (!stand || !erkennung) {
      grund = 'Die Liste der Aufnahmen ist gerade nicht erreichbar — es wurde nichts durchsucht. '
        + 'Seid ihr noch im WLAN der Box?';
      lage = 'fehler';
      zeichne();
      return;
    }

    treffer = erkennung.suche(such, stand.liste);
    lage = treffer.length > 0 ? 'treffer' : 'nichts';
    zeichne();
  };

  window.addEventListener('pagehide', () => kamera.stoppe());

  await holeStand();
  zeichne();
}

/* ------------------------------------------------------------------ */

function ausloeser(tue: () => void): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = 'fdausloeser';
  k.setAttribute('aria-label', 'Selfie aufnehmen');
  k.append(tag('span', 'fdring'));
  k.addEventListener('click', tue);
  return k;
}

function knopf(text: string, art: 'amber' | 'still', tue: () => void): HTMLButtonElement {
  const k = document.createElement('button');
  k.type = 'button';
  k.className = art === 'amber' ? 'knopf knopf--amber fdknopf' : 'knopf knopf--rahmen-hell fdknopf';
  k.textContent = text;
  k.addEventListener('click', tue);
  return k;
}

function verweis(text: string, ziel: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.className = 'knopf knopf--rahmen-hell fdknopf';
  a.href = ziel;
  a.textContent = text;
  return a;
}

function tag(name: string, klasse: string, text = ''): HTMLElement {
  const el = document.createElement(name);
  if (klasse) el.className = klasse;
  if (text) el.textContent = text;
  return el;
}
