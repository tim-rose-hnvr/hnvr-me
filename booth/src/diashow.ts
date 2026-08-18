/**
 * Vollbild-Diashow für Beamer und Fernseher.
 *
 * Das Gegenstück zur Foto-Wall: Die Wand zeigt viele Bilder klein und
 * gleichzeitig, die Diashow eines groß und nacheinander. Beides hat seinen
 * Platz — die Wand am Stehtisch, wo Gäste sich suchen; die Diashow an der
 * Wand hinter dem Buffet, wo niemand sucht, sondern hinsieht.
 *
 * Drei Regeln aus dem Betrieb stecken darin:
 *
 *  1. **Keine Bedienelemente.** Ein Beamerbild steht auf Kopfhöhe, und was
 *     antippbar aussieht, wird angetippt. Es gibt hier nichts zu tippen.
 *
 *  2. **Wer neu ist, kommt als Nächstes.** Ein Gast, der eben ausgelöst hat,
 *     dreht sich zur Leinwand um. Sieht er sich dort erst nach vierzig
 *     Bildern, hat er sich längst abgewandt. Neue Aufnahmen rücken deshalb
 *     an die nächste Stelle, nicht ans Ende.
 *
 *  3. **Nichts bleibt stehen.** Fällt die Box aus, läuft die Diashow mit dem
 *     weiter, was sie hat, und holt sich den Rest, wenn die Box zurück ist.
 *     Ein Ausfall darf Komfort kosten, niemals das Bild an der Wand.
 *
 * Zwischen den Fotos laufen die Tafeln der Box: Menü, Danksagung, nächster
 * Programmpunkt. Damit wird aus der Diashow ein Infokanal, der niemanden
 * anspricht und trotzdem etwas sagt.
 */

import './stil.css';
import './diashow.css';
import { alle, type Aufnahme } from './speicher';
import { holeEinstellungen, ladeEinstellungen, type Tafel } from './einstellungen';
import { amDraht, istNeuladen } from './draht';

/* Rückfalltakt, falls der Draht gerade weg ist. Die Box meldet neue
   Aufnahmen von selbst; dieser Takt ist nur das Netz darunter und darf
   deshalb ruhig sein — eine Diashow, die im Sekundentakt fragt, bremst
   eine Box aus, die nebenbei druckt. */
const TAKT = 20000;

/** Was gerade an der Wand steht. */
type Bild =
  | { art: 'foto'; id: string; adresse: string; sekunden: number }
  | { art: 'tafel'; tafel: Tafel };

const wurzel = document.getElementById('diashow');
if (wurzel) void starte(wurzel);

async function starte(ziel: HTMLElement): Promise<void> {
  await holeEinstellungen();

  const buehne = tag('div', 'dbuehne');
  const leer = tag('div', 'dleer');
  ziel.replaceChildren(buehne, leer);

  /* Die Reihe steht neueste zuerst. `zeiger` wandert durch sie hindurch und
     springt am Ende zurück an den Anfang. */
  let reihe: Aufnahme[] = [];
  let zeiger = 0;
  /* Zählt die Fotos seit der letzten Tafel. Nicht die Bilder insgesamt: Sonst
     verschöbe sich der Rhythmus mit jeder Tafel. */
  let seitTafel = 0;
  let naechsteTafel = 0;
  let uhr: number | null = null;

  const hole = async (): Promise<void> => {
    let neu: Aufnahme[];
    try {
      neu = await alle();
    } catch {
      // Box weg: Die Diashow läuft mit dem weiter, was sie hat.
      return;
    }

    // Neueste zuerst; Bewegtbilder laufen mit, sie sind ein Bild wie andere.
    neu.sort((a, b) => b.zeit - a.zeit);

    const bekannt = new Set(reihe.map((a) => a.id));
    const frisch = neu.filter((a) => !bekannt.has(a.id));

    if (reihe.length === 0) {
      reihe = neu;
    } else if (frisch.length > 0) {
      /* Frische Aufnahmen an die nächste Stelle, nicht ans Ende — Regel 2.
         Der Rest der Reihe bleibt in seiner Ordnung stehen, damit die
         Schleife nicht bei jedem Auslösen von vorn beginnt. */
      const alt = reihe.filter((a) => neu.some((n) => n.id === a.id));
      reihe = [...alt.slice(0, zeiger), ...frisch, ...alt.slice(zeiger)];
    } else {
      // Nichts Neues, aber vielleicht etwas gelöscht.
      const uebrig = reihe.filter((a) => neu.some((n) => n.id === a.id));
      if (uebrig.length !== reihe.length) {
        reihe = uebrig;
        if (zeiger > reihe.length) zeiger = 0;
      }
    }
  };

  /** Das nächste Bild — Foto oder Tafel, je nach Rhythmus. */
  const naechstes = (): Bild | null => {
    const e = ladeEinstellungen();
    const tafeln = e.tafeln;

    // Eine Tafel ist dran, wenn genug Fotos seit der letzten gelaufen sind.
    const tafelFaellig =
      tafeln.length > 0 && e.diashow.jedesTafel > 0 && seitTafel >= e.diashow.jedesTafel;

    if (tafelFaellig || (reihe.length === 0 && tafeln.length > 0)) {
      const tafel = tafeln[naechsteTafel % tafeln.length]!;
      naechsteTafel += 1;
      seitTafel = 0;
      return { art: 'tafel', tafel };
    }

    if (reihe.length === 0) return null;

    if (zeiger >= reihe.length) zeiger = 0;
    const aufnahme = reihe[zeiger]!;
    zeiger += 1;
    seitTafel += 1;
    return {
      art: 'foto',
      id: aufnahme.id,
      adresse: aufnahme.url,
      sekunden: e.diashow.dauer,
    };
  };

  const schritt = (): void => {
    const bild = naechstes();

    if (!bild) {
      leer.hidden = false;
      leer.replaceChildren(
        tag('span', 'dmono', ladeEinstellungen().event),
        tag('p', 'dleer__text', 'Die Diashow beginnt, sobald die erste Aufnahme da ist.')
      );
      uhr = window.setTimeout(schritt, 4000);
      return;
    }

    leer.hidden = true;
    const sekunden = Math.max(2, bild.art === 'foto' ? bild.sekunden : bild.tafel.sekunden);
    zeige(buehne, bild, ladeEinstellungen().diashow.bewegung, sekunden);
    uhr = window.setTimeout(schritt, sekunden * 1000);
  };

  await hole();
  schritt();

  window.setInterval(() => void hole(), TAKT);

  amDraht('wand', (n) => {
    if (n.type === 'photo' || n.type === 'remove') void hole();
    /* Eine Diashow steht stundenlang unbeaufsichtigt am Beamer. Sie darf
       jederzeit neu laden — es sitzt niemand davor, dem etwas verlorenginge. */
    if (istNeuladen(n, 'wand')) location.reload();
  });

  // Der Bildschirm darf nicht dunkel werden. Klappt es nicht, läuft die
  // Diashow trotzdem — dann muss der Betreiber den Schoner selbst abstellen.
  void haltWach();

  // Aufräumen ist hier keine Zierde: Die Seite läuft einen ganzen Abend.
  window.addEventListener('pagehide', () => {
    if (uhr !== null) window.clearTimeout(uhr);
  });
}

/**
 * Legt ein Bild auf die Bühne und blendet das vorige aus.
 *
 * Zwei Ebenen statt einer: Die alte bleibt stehen, bis die neue steht.
 * Tauschte man nur die Adresse, sähe man zwischen zwei Bildern kurz nichts —
 * auf einer drei Meter breiten Leinwand ist das ein Loch, kein Übergang.
 */
function zeige(
  buehne: HTMLElement,
  bild: Bild,
  bewegung: boolean,
  sekunden: number
): void {
  const platte = tag('div', bewegung ? 'dplatte dplatte--wandert' : 'dplatte');
  /* Die Bewegung dauert genau so lange wie das Bild steht. Eine feste Dauer
     im Stylesheet käme bei kurzer Standzeit nie an und bliebe bei langer auf
     halbem Weg stehen — beides sieht aus wie ein Fehler. */
  platte.style.setProperty('--dstand', `${sekunden}s`);

  if (bild.art === 'foto') {
    /* Der Hintergrund ist dasselbe Bild, formatfüllend und unscharf. Ein
       hochkantes Foto auf einer querformatigen Leinwand ließe sonst zwei
       schwarze Balken stehen — oder man beschnitte es, und dann fehlen
       Köpfe. Unscharf gefüllt bleibt das Bild vollständig und die Fläche
       ruhig. */
    const grund = tag('div', 'dgrund');
    grund.style.backgroundImage = `url("${bild.adresse}")`;

    const foto = document.createElement('img');
    foto.className = 'dfoto';
    foto.src = bild.adresse;
    foto.alt = '';
    platte.append(grund, foto);
  } else {
    platte.append(tafelplatte(bild.tafel));
  }

  buehne.append(platte);
  // Erst im nächsten Bildaufbau einblenden, sonst gibt es keinen Übergang.
  requestAnimationFrame(() => platte.classList.add('da'));

  /* Alles außer den beiden obersten Ebenen fliegt raus. Ohne das wüchse die
     Seite über einen Abend auf tausend Ebenen an, und der Rechner am Beamer
     hat keine Reserve. */
  while (buehne.children.length > 2) {
    const alt = buehne.firstElementChild;
    if (!alt) break;
    alt.remove();
  }
}

function tafelplatte(tafel: Tafel): HTMLElement {
  if (tafel.art === 'bild' && tafel.bild) {
    const feld = tag('div', 'dtafel dtafel--bild');
    const bild = document.createElement('img');
    bild.className = 'dtafel__bild';
    bild.src = tafel.bild;
    bild.alt = '';
    feld.append(bild);
    if (tafel.unterzeile) feld.append(tag('p', 'dtafel__unterzeile', tafel.unterzeile));
    return feld;
  }

  const feld = tag('div', 'dtafel dtafel--text');
  if (tafel.titel) feld.append(tag('h1', 'dtafel__titel', tafel.titel));
  if (tafel.zeile) feld.append(tag('p', 'dtafel__zeile', tafel.zeile));
  return feld;
}

/**
 * Hält den Bildschirm wach. Der Bildschirmschoner eines Beamer-Rechners ist
 * der häufigste Grund für eine schwarze Leinwand mitten im Empfang.
 */
async function haltWach(): Promise<void> {
  const schloss = (navigator as Navigator & {
    wakeLock?: { request: (art: 'screen') => Promise<{ release: () => Promise<void> }> };
  }).wakeLock;
  if (!schloss) return;

  const nimm = async () => {
    try {
      await schloss.request('screen');
    } catch {
      // Verweigert oder nicht erlaubt — dann eben nicht.
    }
  };

  await nimm();
  // Nach einem Wechsel in einen anderen Tab ist die Sperre weg.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void nimm();
  });
}

function tag(name: string, klasse: string, text = ''): HTMLElement {
  const e = document.createElement(name);
  e.className = klasse;
  if (text) e.textContent = text;
  return e;
}
