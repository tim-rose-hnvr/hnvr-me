/**
 * Der Leuchttisch.
 *
 * ## Die These
 *
 * Der Entwurf ist nicht das Produkt — die **Aussage** ist es. Deshalb steht in
 * diesem Werkzeug nie ein einzelnes Format im Mittelpunkt, sondern alle
 * gleichzeitig: wie Andrucke auf einem Leuchttisch. Wer den Termin ändert,
 * sieht in derselben Sekunde, was das mit dem Plakat, der Story und dem
 * LinkedIn-Beitrag macht.
 *
 * ## Was hier anders ist als bei allen anderen
 *
 * 1. **Bindung statt Kopie.** Die Formate enthalten keinen Text, sondern
 *    Verweise. „Magic Resize" erzeugt Kopien, die auseinanderlaufen.
 * 2. **Kürzungsstufen.** Ein Titel in drei Längen; jedes Format nimmt die
 *    längste, die passt. Niemand tippt zweimal, nichts wird abgeschnitten.
 * 3. **Wirkungsprüfung.** Nicht ob die Datei stimmt, sondern ob das Material
 *    seinen Zweck erfüllt: Kontrast gegen den *tatsächlichen* Untergrund,
 *    Lesbarkeit auf die gedachte Entfernung, Sperrflächen der Plattformen,
 *    Haltbarkeit nach dem Termin.
 */

import {
  type Aussage,
  type Bindungsbefund,
  type Druckbefund,
  FELDNAMEN,
  FELDSCHLUESSEL,
  type Feldschluessel,
  type Kuerzungsstufe,
  loeseBindungen,
  type Markenverstoss,
  pruefeDruck,
  pruefeMarkenkonform,
  pruefeWirkung,
  pxZuMm,
  tageBisTermin,
  type Wirkungsbefund,
} from '@studio/editor-core';
import {
  blattmasse,
  erzeugeTextmesser,
  schriftRegeln,
  seitenHtml,
  type Textmesser,
  warteAufSchriften,
} from '@studio/render';
import { AUSSAGE, AUSSPIELUNGEN, type Ausspielung, MARKENKIT } from './daten.js';
import { SCHRIFTEN } from './schriften.js';

/** Bezugsdatum. Fest, damit das Probemodell immer dasselbe zeigt. */
const HEUTE = new Date('2026-08-17T00:00:00.000Z');

function el<K extends keyof HTMLElementTagNameMap>(
  art: K,
  klasse?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const knoten = document.createElement(art);
  if (klasse !== undefined) knoten.className = klasse;
  if (text !== undefined) knoten.textContent = text;
  return knoten;
}

interface Befund {
  schwere: 'fehler' | 'warnung' | 'hinweis';
  regel: string;
  meldung: string;
  messwert: string | null;
}

interface Pruefstand {
  befunde: Befund[];
  bindungen: Bindungsbefund[];
  fehler: number;
  warnungen: number;
}

class Leuchttisch {
  #aussage: Aussage = structuredClone(AUSSAGE);
  #gewaehlt = AUSSPIELUNGEN[0]?.id ?? '';
  readonly #tisch = el('div', 'tisch');
  readonly #protokoll = el('aside', 'spalte protokoll');
  readonly #quelle = el('aside', 'spalte quelle');
  #zuletztGeaendert: Feldschluessel | null = null;
  /**
   * Solange `null`, entscheidet die Schätzung. Der Messer kommt erst, wenn die
   * Schriften geladen sind — vorher würde gegen die Ersatzschrift gemessen und
   * jede Zahl wäre falsch.
   */
  #messer: Textmesser | null = null;

  constructor(wurzel: HTMLElement) {
    const stil = el('style');
    stil.textContent = schriftRegeln(SCHRIFTEN) + STIL;
    document.head.append(stil);

    wurzel.append(this.#baueKopf());
    const raster = el('div', 'raster');
    raster.append(this.#quelle, this.#tisch, this.#protokoll);
    wurzel.append(raster);

    this.#baueQuelle();
    this.#zeichneTisch();
    this.#baueProtokoll();

    void warteAufSchriften(document).then(() => {
      this.#messer = erzeugeTextmesser(document, { sprache: 'de' });
      this.#zeichneTisch();
      this.#baueProtokoll();
    });
  }

  // --- Auflösung und Prüfung ------------------------------------------------

  #aufgeloest(a: Ausspielung): {
    entwurf: ReturnType<typeof loeseBindungen>['entwurf'];
    bindungen: Bindungsbefund[];
  } {
    const { entwurf, bindungen } = ((): {
      entwurf: ReturnType<typeof loeseBindungen>['entwurf'];
      bindungen: Bindungsbefund[];
    } => {
      const ergebnis = loeseBindungen(a.entwurf, this.#aussage, this.#messer ?? undefined);
      return { entwurf: ergebnis.entwurf, bindungen: ergebnis.befunde };
    })();
    return { entwurf, bindungen };
  }

  #pruefe(a: Ausspielung): Pruefstand {
    const { entwurf, bindungen } = this.#aufgeloest(a);

    const wirkung: Wirkungsbefund[] = pruefeWirkung(entwurf, {
      leseabstandMeter: a.leseabstandMeter,
      ...(a.plattform === undefined ? {} : { plattform: a.plattform }),
      aussage: this.#aussage,
      heute: HEUTE,
    });
    const druck: Druckbefund[] =
      a.medium === 'Druck' ? pruefeDruck(entwurf, { pruefeAufloesung: false }) : [];
    const marke: Markenverstoss[] = pruefeMarkenkonform(entwurf, MARKENKIT);

    const befunde: Befund[] = [
      ...wirkung.map((b) => ({
        schwere: b.schwere,
        regel: b.regel,
        meldung: b.meldung,
        messwert: b.messwert,
      })),
      ...druck.map((b) => ({
        schwere: b.schwere as Befund['schwere'],
        regel: b.regel,
        meldung: b.meldung,
        messwert: null,
      })),
      ...marke.map((v) => ({
        schwere: v.schwere as Befund['schwere'],
        regel: v.regel,
        meldung: v.meldung,
        messwert: null,
      })),
      ...bindungen
        .filter((b) => !b.passt)
        .map((b) => ({
          schwere: 'warnung' as const,
          regel: 'ueberlauf',
          meldung:
            `„${FELDNAMEN[b.feld]}" läuft über: auch die kürzeste Fassung ist länger als der Rahmen fasst. ` +
            (b.gemessen
              ? 'Gesetzt und gemessen.'
              : 'Geschätzt — der Satz kann es noch enger machen.'),
          messwert: b.gemessen ? 'gemessen' : `${b.text.length}/${b.kapazitaet}`,
        })),
    ];

    return {
      befunde,
      bindungen,
      fehler: befunde.filter((b) => b.schwere === 'fehler').length,
      warnungen: befunde.filter((b) => b.schwere === 'warnung').length,
    };
  }

  // --- Kopf -----------------------------------------------------------------

  #baueKopf(): HTMLElement {
    const kopf = el('header', 'kopf');
    const marke = el('div', 'marke');
    marke.append(
      el('span', 'wortmarke', 'Leuchttisch'),
      el('span', 'these', 'Eine Aussage. Alle Formate. Gleichzeitig.'),
    );

    const tage = tageBisTermin(this.#aussage, HEUTE);
    const frist = el('div', 'frist');
    if (tage !== null) {
      frist.append(
        el('span', 'frist-zahl', String(tage)),
        el('span', 'frist-wort', tage === 1 ? 'Tag bis zum Termin' : 'Tage bis zum Termin'),
      );
    }

    kopf.append(marke, frist);
    return kopf;
  }

  // --- Die Quelle -----------------------------------------------------------

  #baueQuelle(): void {
    this.#quelle.innerHTML = '';
    this.#quelle.append(el('h2', undefined, 'Die Aussage'));
    this.#quelle.append(
      el(
        'p',
        'lauf',
        'Steht einmal. Jedes Format bindet darauf — geändert wird hier, nicht fünfmal.',
      ),
    );

    for (const schluessel of FELDSCHLUESSEL) {
      const wert = this.#aussage.felder[schluessel];
      if (wert === undefined) continue;

      const feld = el('div', 'feld');
      feld.dataset['feld'] = schluessel;
      feld.append(el('label', 'feldname', FELDNAMEN[schluessel]));

      const stufen: { stufe: Kuerzungsstufe; text: string | null }[] = [
        { stufe: 'lang', text: wert.lang },
        { stufe: 'mittel', text: wert.mittel },
        { stufe: 'kurz', text: wert.kurz },
      ];

      for (const { stufe, text } of stufen) {
        if (text === null) continue;
        const zeile = el('div', 'stufe');
        zeile.append(el('span', 'stufenname', stufe));

        const eingabe = el('input');
        eingabe.type = 'text';
        eingabe.value = text;
        eingabe.dataset['feld'] = schluessel;
        eingabe.dataset['stufe'] = stufe;
        eingabe.addEventListener('input', () => {
          const aktuell = this.#aussage.felder[schluessel];
          if (aktuell === undefined) return;
          this.#aussage = {
            ...this.#aussage,
            felder: {
              ...this.#aussage.felder,
              [schluessel]: { ...aktuell, [stufe]: eingabe.value },
            },
          };
          this.#zuletztGeaendert = schluessel;
          this.#zeichneTisch();
          this.#baueProtokoll();
        });

        zeile.append(eingabe, el('span', 'zeichen', String(text.length)));
        feld.append(zeile);
      }

      this.#quelle.append(feld);
    }

    // Der Termin ist kein Text, sondern ein Zeitpunkt — deshalb ein Datumsfeld.
    const terminfeld = el('div', 'feld');
    terminfeld.append(el('label', 'feldname', 'Termin'));
    const datum = el('input');
    datum.type = 'date';
    datum.value = (this.#aussage.termin ?? '').slice(0, 10);
    datum.addEventListener('input', () => {
      this.#aussage = { ...this.#aussage, termin: `${datum.value}T00:00:00.000Z` };
      this.#zuletztGeaendert = 'termin';
      this.#zeichneTisch();
      this.#baueProtokoll();
      const frist = document.querySelector('.frist');
      const tage = tageBisTermin(this.#aussage, HEUTE);
      if (frist !== null && tage !== null) {
        frist.innerHTML = '';
        frist.append(
          el('span', 'frist-zahl', String(tage)),
          el('span', 'frist-wort', tage === 1 ? 'Tag bis zum Termin' : 'Tage bis zum Termin'),
        );
      }
    });
    terminfeld.append(datum);
    terminfeld.append(
      el(
        'p',
        'lauf klein',
        'Ein Zeitpunkt, kein Text. Deshalb kann jedes Format ihn anders schreiben — und das System weiß, wann das Material abgelaufen ist.',
      ),
    );
    this.#quelle.append(terminfeld);
  }

  // --- Der Leuchttisch ------------------------------------------------------

  #zeichneTisch(): void {
    this.#tisch.innerHTML = '';

    for (const a of AUSSPIELUNGEN) {
      const { entwurf, bindungen } = this.#aufgeloest(a);
      const stand = this.#pruefe(a);
      const blatt = blattmasse(entwurf);

      const karte = el('article', 'andruck');
      karte.dataset['ausspielung'] = a.id;
      if (a.id === this.#gewaehlt) karte.classList.add('gewaehlt');

      // Kopfzeile: Name, Maße, Status.
      const zeile = el('div', 'andruck-kopf');
      const titel = el('div', 'andruck-titel');
      titel.append(el('strong', undefined, a.name));
      titel.append(
        el(
          'span',
          'mass',
          `${Math.round(entwurf.masse.breite)}×${Math.round(entwurf.masse.hoehe)} px · ` +
            `${a.medium === 'Druck' ? `${pxZuMm(entwurf.masse.breite, entwurf.masse.dpi).toFixed(0)}×${pxZuMm(entwurf.masse.hoehe, entwurf.masse.dpi).toFixed(0)} mm · ` : ''}` +
            `${a.leseabstandMeter} m`,
        ),
      );

      const chip = el(
        'span',
        `chip ${stand.fehler > 0 ? 'stopp' : stand.warnungen > 0 ? 'acht' : 'gut'}`,
        stand.fehler > 0
          ? `${stand.fehler} Fehler`
          : stand.warnungen > 0
            ? `${stand.warnungen} Hinweise`
            : 'sauber',
      );
      zeile.append(titel, chip);

      // Die Vorschau: derselbe Renderer wie im Druck-PDF.
      const rahmen = el('div', 'bogen');
      const buehne = el('div', 'bogen-inhalt');
      buehne.innerHTML = seitenHtml(entwurf, { schriften: SCHRIFTEN });
      buehne.style.width = `${blatt.breite}px`;
      buehne.style.height = `${blatt.hoehe}px`;
      rahmen.append(buehne);
      rahmen.style.aspectRatio = `${blatt.breite} / ${blatt.hoehe}`;

      // Sperrflächen der Plattform sichtbar machen.
      if (a.plattform === 'instagram-story') {
        rahmen.append(el('div', 'sperre sperre-oben'), el('div', 'sperre sperre-unten'));
      }

      // Welche Kürzungsstufe hat dieses Format gewählt? Das ist die Pointe.
      const stufen = el('div', 'stufenzeile');
      for (const b of bindungen) {
        const marke = el('span', `stufenmarke stufe-${b.stufe}`);
        marke.textContent = `${FELDNAMEN[b.feld].slice(0, 4)} ${b.stufe}`;
        marke.title = b.gemessen
          ? `${FELDNAMEN[b.feld]}: Fassung „${b.stufe}" — im Satz gemessen, nicht geschätzt`
          : `${FELDNAMEN[b.feld]}: Fassung „${b.stufe}", geschätzt ${b.text.length} von ~${b.kapazitaet} Zeichen`;
        if (this.#zuletztGeaendert === b.feld) marke.classList.add('geaendert');
        stufen.append(marke);
      }

      karte.append(zeile, rahmen, stufen);
      karte.addEventListener('click', () => {
        this.#gewaehlt = a.id;
        this.#zeichneTisch();
        this.#baueProtokoll();
      });
      this.#tisch.append(karte);

      // Maßstab erst nach dem Einhängen, sonst ist die Breite noch 0.
      queueMicrotask(() => {
        const verfuegbar = rahmen.getBoundingClientRect().width;
        if (verfuegbar > 0) buehne.style.transform = `scale(${verfuegbar / blatt.breite})`;
      });
    }
  }

  // --- Das Prüfprotokoll ----------------------------------------------------

  #baueProtokoll(): void {
    this.#protokoll.innerHTML = '';
    const a = AUSSPIELUNGEN.find((x) => x.id === this.#gewaehlt);
    if (a === undefined) return;

    const stand = this.#pruefe(a);
    this.#protokoll.append(el('h2', undefined, 'Prüfprotokoll'));
    this.#protokoll.append(el('p', 'lauf', a.name));

    const ampel = el(
      'div',
      `ampel ${stand.fehler > 0 ? 'stopp' : stand.warnungen > 0 ? 'acht' : 'gut'}`,
    );
    ampel.textContent =
      stand.fehler > 0
        ? `${stand.fehler} Fehler, ${stand.warnungen} Hinweise`
        : stand.warnungen > 0
          ? `${stand.warnungen} Hinweise`
          : 'Ohne Befund';
    this.#protokoll.append(ampel);

    if (stand.befunde.length === 0) {
      this.#protokoll.append(
        el('p', 'lauf klein', 'Kontrast, Lesbarkeit, Sperrflächen, Anschnitt und Marke geprüft.'),
      );
    }

    const gruppen: [string, Befund['schwere']][] = [
      ['Fehler', 'fehler'],
      ['Hinweise', 'warnung'],
      ['Notizen', 'hinweis'],
    ];

    for (const [ueberschrift, schwere] of gruppen) {
      const teil = stand.befunde.filter((b) => b.schwere === schwere);
      if (teil.length === 0) continue;

      this.#protokoll.append(el('h3', undefined, ueberschrift));
      const liste = el('ul', 'befunde');
      for (const b of teil) {
        const eintrag = el('li', schwere);
        eintrag.append(el('span', 'regel', b.regel));
        eintrag.append(el('span', 'meldung', b.meldung));
        if (b.messwert !== null) eintrag.append(el('span', 'messwert', b.messwert));
        liste.append(eintrag);
      }
      this.#protokoll.append(liste);
    }

    this.#protokoll.append(el('h3', undefined, 'Gewählte Fassungen'));
    const tabelle = el('table', 'stufentabelle');
    for (const b of stand.bindungen) {
      const zeile = el('tr');
      zeile.append(el('td', undefined, FELDNAMEN[b.feld]));
      zeile.append(el('td', 'stufenname', b.stufe));
      const platz = el('td', 'messwert');
      // Bei Messung wäre eine Zeichenzahl irreführend: entschieden hat die
      // gesetzte Höhe, nicht die Zeichenzahl.
      platz.textContent = b.gemessen ? 'gemessen' : `${b.text.length}/${b.kapazitaet}`;
      zeile.append(platz);
      tabelle.append(zeile);
    }
    this.#protokoll.append(tabelle);
  }
}

const STIL = `
/*
 * Leuchttisch: die Andrucke sind das einzige Helle. Der Grund ist ein kühles
 * Graphit mit leichtem Blaustich, damit er zum Markenblau der Beispielmarke
 * gehört statt danebenzustehen. Der Akzent ist ein Signalorange aus dem
 * Werkzeugkasten der Druckvorstufe — Schnittmarken, Messschieber. Ampelfarben
 * stehen davon getrennt: sie bedeuten etwas und sind keine Gestaltung.
 *
 * Drei Themenzustände: die Systemvorgabe setzt keine Marke am Wurzelelement,
 * dort entscheidet prefers-color-scheme. Eine ausdrückliche Wahl setzt
 * data-theme und muss beide Richtungen schlagen.
 */
:root{
  color-scheme:dark light;
  --tisch:#0e1116; --rahmen:#151a22; --erhoben:#1b212c; --linie:#28303d;
  --tinte:#eef1f7; --gedaempft:#8d96aa;
  --signal:#ff6a2b; --gut:#35c489; --acht:#f0b429; --stopp:#ff5a52;
  --masz:ui-monospace,"DejaVu Sans Mono",SFMono-Regular,Menlo,monospace;
}
@media (prefers-color-scheme:light){
  :root:not([data-theme="dark"]){
    --tisch:#dfe3ea; --rahmen:#eef1f6; --erhoben:#fff; --linie:#c9d0dc;
    --tinte:#141922; --gedaempft:#5c6577;
    --signal:#d94e14; --gut:#0d7a4f; --acht:#8a6100; --stopp:#b3261e;
  }
}
:root[data-theme="light"]{
  --tisch:#dfe3ea; --rahmen:#eef1f6; --erhoben:#fff; --linie:#c9d0dc;
  --tinte:#141922; --gedaempft:#5c6577;
  --signal:#d94e14; --gut:#0d7a4f; --acht:#8a6100; --stopp:#b3261e;
}

*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:var(--tisch);color:var(--tinte);
  font:14px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}

.kopf{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;flex-wrap:wrap;
  padding:.85rem 1.25rem;border-bottom:1px solid var(--linie);background:var(--rahmen)}
.marke{display:flex;align-items:baseline;gap:.85rem;flex-wrap:wrap}
.wortmarke{font-weight:640;letter-spacing:-.015em;font-size:1.05rem}
.these{color:var(--gedaempft);font-size:.85rem}
.frist{display:flex;align-items:baseline;gap:.45rem}
.frist-zahl{font:700 1.5rem/1 var(--masz);font-variant-numeric:tabular-nums;color:var(--signal)}
.frist-wort{color:var(--gedaempft);font-size:.78rem}

.raster{display:grid;grid-template-columns:296px minmax(0,1fr) 320px;
  height:calc(100vh - 58px)}
@media (max-width:1100px){.raster{grid-template-columns:1fr;height:auto}}

.spalte{padding:1.1rem;overflow-y:auto;background:var(--rahmen);border-right:1px solid var(--linie)}
.protokoll{border-right:0;border-left:1px solid var(--linie)}
h2{font-size:.7rem;text-transform:uppercase;letter-spacing:.1em;color:var(--gedaempft);
  margin:0 0 .35rem;font-weight:640}
h3{font-size:.68rem;text-transform:uppercase;letter-spacing:.09em;color:var(--gedaempft);
  margin:1.3rem 0 .4rem;font-weight:640}
.lauf{color:var(--gedaempft);font-size:.83rem;margin:0 0 1.1rem}
.lauf.klein{font-size:.76rem;margin:.5rem 0 0}

.feld{margin-bottom:1.15rem;padding-bottom:1.15rem;border-bottom:1px solid var(--linie)}
.feld:last-child{border-bottom:0}
.feldname{display:block;font-size:.8rem;font-weight:600;margin-bottom:.4rem}
.stufe{display:grid;grid-template-columns:44px 1fr 30px;align-items:center;gap:.4rem;
  margin-bottom:.3rem}
.stufenname{font:.66rem/1 var(--masz);text-transform:uppercase;letter-spacing:.06em;
  color:var(--gedaempft)}
.zeichen{font:.7rem/1 var(--masz);font-variant-numeric:tabular-nums;color:var(--gedaempft);
  text-align:right}
input{width:100%;font:inherit;font-size:.82rem;padding:.32rem .45rem;border-radius:5px;
  border:1px solid var(--linie);background:var(--tisch);color:var(--tinte)}
input:focus-visible{outline:2px solid var(--signal);outline-offset:1px;border-color:transparent}
input[type="date"]{font-family:var(--masz)}

.tisch{padding:1.1rem;overflow-y:auto;display:grid;gap:1.1rem;
  grid-template-columns:repeat(auto-fill,minmax(210px,1fr));align-content:start}
.andruck{background:var(--erhoben);border:1px solid var(--linie);border-radius:9px;
  padding:.7rem;cursor:pointer;display:flex;flex-direction:column;gap:.55rem}
.andruck:hover{border-color:var(--gedaempft)}
.andruck.gewaehlt{border-color:var(--signal);box-shadow:0 0 0 1px var(--signal)}
.andruck-kopf{display:flex;align-items:flex-start;justify-content:space-between;gap:.5rem}
.andruck-titel{display:flex;flex-direction:column;gap:.1rem;min-width:0}
.andruck-titel strong{font-size:.85rem;font-weight:620}
.mass{font:.66rem/1.35 var(--masz);font-variant-numeric:tabular-nums;color:var(--gedaempft)}
.chip{font:.64rem/1 var(--masz);padding:.25rem .4rem;border-radius:4px;white-space:nowrap;
  text-transform:uppercase;letter-spacing:.04em}
.chip.gut{background:color-mix(in srgb,var(--gut) 18%,transparent);color:var(--gut)}
.chip.acht{background:color-mix(in srgb,var(--acht) 18%,transparent);color:var(--acht)}
.chip.stopp{background:color-mix(in srgb,var(--stopp) 18%,transparent);color:var(--stopp)}

.bogen{position:relative;width:100%;overflow:hidden;border-radius:3px;
  background:#fff;box-shadow:0 2px 10px rgba(0,0,0,.35)}
.bogen-inhalt{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none}
.sperre{position:absolute;left:0;right:0;background:repeating-linear-gradient(45deg,
  rgba(255,90,82,.22) 0 6px,transparent 6px 12px);pointer-events:none}
.sperre-oben{top:0;height:14%}
.sperre-unten{bottom:0;height:20%}

.stufenzeile{display:flex;flex-wrap:wrap;gap:.22rem}
.stufenmarke{font:.6rem/1 var(--masz);padding:.22rem .34rem;border-radius:3px;
  border:1px solid var(--linie);color:var(--gedaempft)}
.stufenmarke.stufe-lang{border-color:color-mix(in srgb,var(--gut) 55%,var(--linie))}
.stufenmarke.stufe-mittel{border-color:color-mix(in srgb,var(--acht) 55%,var(--linie))}
.stufenmarke.stufe-kurz{border-color:color-mix(in srgb,var(--signal) 55%,var(--linie))}
.stufenmarke.geaendert{background:color-mix(in srgb,var(--signal) 22%,transparent);
  color:var(--tinte);border-color:var(--signal)}

.ampel{padding:.5rem .65rem;border-radius:6px;font:600 .82rem/1.3 ui-sans-serif,system-ui}
.ampel.gut{background:color-mix(in srgb,var(--gut) 16%,transparent);color:var(--gut)}
.ampel.acht{background:color-mix(in srgb,var(--acht) 16%,transparent);color:var(--acht)}
.ampel.stopp{background:color-mix(in srgb,var(--stopp) 16%,transparent);color:var(--stopp)}

.befunde{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:.55rem}
.befunde li{display:grid;grid-template-columns:1fr auto;gap:.2rem .5rem;
  padding:.45rem .55rem;border-radius:6px;background:var(--tisch);
  border-left:2px solid var(--linie);font-size:.79rem}
.befunde li.fehler{border-left-color:var(--stopp)}
.befunde li.warnung{border-left-color:var(--acht)}
.regel{grid-column:1/-1;font:.62rem/1 var(--masz);text-transform:uppercase;letter-spacing:.06em;
  color:var(--gedaempft)}
.meldung{color:var(--tinte)}
.messwert{font:.72rem/1.3 var(--masz);font-variant-numeric:tabular-nums;color:var(--gedaempft);
  white-space:nowrap;align-self:end}

.stufentabelle{width:100%;border-collapse:collapse;font-size:.78rem}
.stufentabelle td{padding:.28rem 0;border-bottom:1px solid var(--linie)}
.stufentabelle td:last-child{text-align:right}
.stufentabelle .stufenname{text-align:center}

@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

const wurzel = document.getElementById('app');
if (wurzel !== null) new Leuchttisch(wurzel);
