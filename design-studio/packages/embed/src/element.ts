/**
 * `<design-studio>` — der Baustein für fremde Seiten.
 *
 * Ein Custom Element ohne Rahmenwerk. Es nimmt eine Aussage und eine Liste von
 * Ausspielungen entgegen und zeigt für jede die aufgelöste Vorschau samt
 * Prüfbefunden. Wer die Aussage ändert, sieht alle Formate gleichzeitig
 * nachziehen — dasselbe Versprechen wie im Leuchttisch, nur eingebettet.
 *
 * ## Warum Shadow DOM
 *
 * Der Baustein landet in fremden Seiten: Wix, WordPress, was auch immer. Deren
 * Stilregeln würden die Vorschau sonst umgestalten, und die Vorschau darf nicht
 * lügen. Der Schattenbaum kapselt das ab.
 *
 * ## Zwei Fallen dabei
 *
 * **Der Schattenbaum schützt vor Selektoren, nicht vor Vererbung.** Eine
 * Fremdseite mit `* { font-family: … !important }` trifft auch das Wirtselement
 * selbst — das steht im Dokumentbaum. Ein `!important` von dort schlägt die
 * `:host`-Regel, und jedes Kind im Schattenbaum **erbt** die fremde Schrift.
 * Deshalb werden vererbbare Eigenschaften nicht nur auf `:host` gesetzt,
 * sondern noch einmal auf einen inneren Knoten: den erreicht kein Selektor der
 * Fremdseite.
 *
 * **`@font-face` wirkt im Schattenbaum nicht.** Schriftgesichter werden nur aus
 * dem Dokumentbaum aufgelöst; eine `@font-face`-Regel innerhalb eines
 * Schattenbaums wird stillschweigend ignoriert, und der Browser setzt in der
 * Ersatzschrift weiter. Das ist genau der Fehlertyp, der hier schon zweimal
 * zugeschlagen hat: kein Absturz, nur ein falsches Bild. Deshalb gehen die
 * Schriftregeln ins Dokument, alles andere in den Schattenbaum — und ein Test
 * im echten Browser prüft nach, welche Schrift tatsächlich benutzt wurde.
 *
 * ## Schnittstelle
 *
 * ```html
 * <design-studio></design-studio>
 * <script>
 *   const el = document.querySelector('design-studio');
 *   el.aussage = { … };            // Eigenschaft, kein Attribut: es ist ein Objekt
 *   el.ausspielungen = [ … ];
 *   el.addEventListener('aussage-geaendert', (e) => console.log(e.detail.aussage));
 * </script>
 * ```
 *
 * Attribute gibt es nur für Skalares (`leseabstand`, `bearbeitbar`). Objekte
 * über Attribute zu reichen hieße, sie durch JSON und HTML-Maskierung zu
 * schleusen — dieselbe Klasse von Fehlern wie beim `style`-Attribut.
 */

import {
  type Aussage,
  type Bindungsbefund,
  type Druckbefund,
  type Entwurf,
  FELDNAMEN,
  type Feldschluessel,
  loeseBindungen,
  pruefeDruck,
  pruefeWirkung,
  type Wirkungsbefund,
} from '@studio/editor-core';
import {
  blattmasse,
  erzeugeTextmesser,
  type Schriftquelle,
  schriftRegeln,
  seitenHtml,
  type Textmesser,
  warteAufSchriften,
} from '@studio/render';

/** Eine Ausspielung, wie der Einbettende sie übergibt. */
export interface EingebetteteAusspielung {
  id: string;
  name: string;
  entwurf: Entwurf;
  medium?: 'Druck' | 'Bildschirm';
  leseabstandMeter?: number;
  plattform?: string;
}

export interface Befund {
  schwere: 'fehler' | 'warnung' | 'hinweis';
  regel: string;
  meldung: string;
}

export interface AussageGeaendert {
  aussage: Aussage;
  feld: Feldschluessel;
}

/**
 * Schriftregeln landen im Dokument, nicht im Schattenbaum — siehe Modulkopf.
 * Mehrere Instanzen desselben Bausteins teilen sich einen Stilknoten, damit
 * nicht bei jedem Einhängen ein weiteres Megabyte Base64 im Kopf steht.
 */
const SCHRIFTKNOTEN_ID = 'design-studio-schriften';

function sorgeFuerSchriften(dokument: Document, schriften: readonly Schriftquelle[]): void {
  if (schriften.length === 0) return;
  const vorhanden = dokument.getElementById(SCHRIFTKNOTEN_ID);
  const regeln = schriftRegeln(schriften);
  if (vorhanden !== null) {
    if (!vorhanden.textContent?.includes(regeln)) vorhanden.textContent += regeln;
    return;
  }
  const knoten = dokument.createElement('style');
  knoten.id = SCHRIFTKNOTEN_ID;
  knoten.textContent = regeln;
  dokument.head.append(knoten);
}

const STIL = `
:host{
  --grund:#ffffff; --tinte:#16181d; --gedaempft:#5b6270; --linie:#dfe3ea;
  --gut:#1a7f52; --acht:#9a6100; --stopp:#b3261e;
  --masz:ui-monospace,SFMono-Regular,Menlo,monospace;
  display:block; color:var(--tinte); background:var(--grund);
  font:15px/1.5 system-ui,sans-serif; container-type:inline-size;
}
:host([dunkel]){
  --grund:#14161a; --tinte:#e9ecf2; --gedaempft:#98a1b0; --linie:#2a2f38;
  --gut:#5fd39b; --acht:#e8b45c; --stopp:#ff8a80;
}
*{box-sizing:border-box}
/*
 * Vererbbare Eigenschaften hier noch einmal, nicht nur auf :host — sonst reicht
 * ein !important der Fremdseite am Wirtselement, um sie in den ganzen
 * Schattenbaum zu vererben. Siehe Modulkopf. (Keine Akzente in diesem
 * Kommentar: er steht in einem Template-Literal, das sie beenden würden.)
 */
.raster{font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;
  color:var(--tinte);background:var(--grund);text-transform:none;letter-spacing:normal;
  display:grid;grid-template-columns:minmax(220px,1fr) 2.4fr;gap:1.25rem;align-items:start}
@container (max-width: 640px){.raster{grid-template-columns:1fr}}

h2{margin:0 0 .6rem;font-size:.7rem;letter-spacing:.09em;text-transform:uppercase;
  color:var(--gedaempft);font-weight:600}
label{display:block;margin-bottom:.5rem}
.stufe{font:.62rem/1 var(--masz);letter-spacing:.06em;text-transform:uppercase;
  color:var(--gedaempft);display:block;margin-bottom:.15rem}
input[type=text],input[type=date]{width:100%;padding:.4rem .5rem;border:1px solid var(--linie);
  border-radius:5px;background:var(--grund);color:var(--tinte);font:inherit}
input:focus-visible{outline:2px solid var(--gut);outline-offset:1px}
fieldset{border:0;padding:0;margin:0 0 1rem}
legend{padding:0;font-weight:600;font-size:.86rem;margin-bottom:.35rem}

.andrucke{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:1rem}
.andruck{border:1px solid var(--linie);border-radius:8px;padding:.7rem;background:var(--grund)}
.kopf{display:flex;justify-content:space-between;align-items:baseline;gap:.5rem;margin-bottom:.5rem}
.name{font-weight:600;font-size:.88rem}
.chip{font:.66rem/1 var(--masz);padding:.22rem .4rem;border-radius:4px;white-space:nowrap}
.chip.gut{background:color-mix(in srgb,var(--gut) 15%,transparent);color:var(--gut)}
.chip.acht{background:color-mix(in srgb,var(--acht) 18%,transparent);color:var(--acht)}
.chip.stopp{background:color-mix(in srgb,var(--stopp) 15%,transparent);color:var(--stopp)}

.bogen{position:relative;width:100%;overflow:hidden;border:1px solid var(--linie);
  border-radius:4px;background:#fff}
.bogen-inhalt{position:absolute;inset:0;transform-origin:0 0}
.marken{display:flex;flex-wrap:wrap;gap:.25rem;margin-top:.5rem}
.marke{font:.62rem/1 var(--masz);padding:.2rem .34rem;border:1px solid var(--linie);border-radius:3px;
  color:var(--gedaempft)}
.marke.lang{border-color:color-mix(in srgb,var(--gut) 55%,var(--linie))}
.marke.kurz{border-color:color-mix(in srgb,var(--acht) 55%,var(--linie))}

ul.befunde{list-style:none;margin:.55rem 0 0;padding:0;display:flex;flex-direction:column;gap:.35rem}
ul.befunde li{font-size:.76rem;padding:.35rem .45rem;border-left:2px solid var(--linie);
  border-radius:0 4px 4px 0;background:color-mix(in srgb,var(--tinte) 4%,transparent)}
ul.befunde li.fehler{border-left-color:var(--stopp)}
ul.befunde li.warnung{border-left-color:var(--acht)}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
`;

export class DesignStudioElement extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['dunkel', 'nur-vorschau'];
  }

  #wurzel: ShadowRoot;
  /**
   * Alles Gezeichnete hängt hier drunter. Der Messknoten steht **daneben**,
   * denn er darf beim Neuzeichnen nicht mitgelöscht werden: ein losgelöster
   * Knoten hat Höhe 0, dann passt jede Fassung und die Stufenwahl fällt immer
   * auf „lang" — ohne Fehlermeldung, nur mit überlaufendem Text.
   */
  #huelle: HTMLDivElement;
  #aussage: Aussage | null = null;
  #ausspielungen: EingebetteteAusspielung[] = [];
  #schriften: readonly Schriftquelle[] = [];
  #messer: Textmesser | null = null;
  #heute: Date = new Date();
  #gezeichnet = false;

  constructor() {
    super();
    this.#wurzel = this.attachShadow({ mode: 'open' });
    const stil = document.createElement('style');
    stil.textContent = STIL;
    this.#huelle = document.createElement('div');
    this.#wurzel.append(stil, this.#huelle);
  }

  // --- Eigenschaften --------------------------------------------------------

  get aussage(): Aussage | null {
    return this.#aussage;
  }

  set aussage(wert: Aussage | null) {
    this.#aussage = wert;
    this.#zeichne();
  }

  get ausspielungen(): EingebetteteAusspielung[] {
    return this.#ausspielungen;
  }

  set ausspielungen(wert: EingebetteteAusspielung[]) {
    this.#ausspielungen = [...wert];
    this.#zeichne();
  }

  /** Eingebettete Schriften. Landen im Dokument, nicht im Schattenbaum. */
  get schriften(): readonly Schriftquelle[] {
    return this.#schriften;
  }

  set schriften(wert: readonly Schriftquelle[]) {
    this.#schriften = [...wert];
    sorgeFuerSchriften(document, this.#schriften);
    void this.#messeNachSchriftladung();
  }

  /** Bezugszeitpunkt für die Haltbarkeitsprüfung. Für Tests festsetzbar. */
  get heute(): Date {
    return this.#heute;
  }

  set heute(wert: Date) {
    this.#heute = wert;
    this.#zeichne();
  }

  connectedCallback(): void {
    if (!this.#gezeichnet) {
      this.#zeichne();
      void this.#messeNachSchriftladung();
    }
  }

  attributeChangedCallback(): void {
    if (this.#gezeichnet) this.#zeichne();
  }

  // --- Innenleben -----------------------------------------------------------

  async #messeNachSchriftladung(): Promise<void> {
    await warteAufSchriften(document);
    this.#messer?.aufraeumen();
    // Der Messknoten gehört in den Schattenbaum: in `document.body` träfen ihn
    // die Regeln der Fremdseite, und schon ein `div { border: 3px }` verschöbe
    // jede gemessene Höhe um sechs Pixel.
    this.#messer = erzeugeTextmesser(document, { sprache: 'de', behaelter: this.#wurzel });
    this.#zeichne();
  }

  #aufgeloest(a: EingebetteteAusspielung): {
    entwurf: Entwurf;
    bindungen: Bindungsbefund[];
  } {
    if (this.#aussage === null) return { entwurf: a.entwurf, bindungen: [] };
    const ergebnis = loeseBindungen(a.entwurf, this.#aussage, this.#messer ?? undefined);
    return { entwurf: ergebnis.entwurf, bindungen: ergebnis.befunde };
  }

  #befunde(a: EingebetteteAusspielung, entwurf: Entwurf, bindungen: Bindungsbefund[]): Befund[] {
    const wirkung: Wirkungsbefund[] = pruefeWirkung(entwurf, {
      leseabstandMeter: a.leseabstandMeter ?? 0.4,
      ...(a.plattform === undefined ? {} : { plattform: a.plattform }),
      ...(this.#aussage === null ? {} : { aussage: this.#aussage }),
      heute: this.#heute,
    });
    const druck: Druckbefund[] =
      a.medium === 'Druck' ? pruefeDruck(entwurf, { pruefeAufloesung: false }) : [];

    return [
      ...wirkung.map((b) => ({ schwere: b.schwere, regel: b.regel, meldung: b.meldung })),
      ...druck.map((b) => ({
        schwere: b.schwere as Befund['schwere'],
        regel: b.regel,
        meldung: b.meldung,
      })),
      ...bindungen
        .filter((b) => !b.passt)
        .map((b) => ({
          schwere: 'warnung' as const,
          regel: 'ueberlauf',
          meldung: `„${FELDNAMEN[b.feld]}" läuft über seinen Rahmen hinaus.`,
        })),
    ];
  }

  #zeichne(): void {
    this.#gezeichnet = true;
    this.#huelle.replaceChildren();

    const raster = document.createElement('div');
    raster.className = 'raster';
    if (!this.hasAttribute('nur-vorschau')) raster.append(this.#baueQuelle());
    raster.append(this.#baueAndrucke());
    this.#huelle.append(raster);
  }

  #baueQuelle(): HTMLElement {
    const spalte = document.createElement('div');
    const ueber = document.createElement('h2');
    ueber.textContent = 'Die Aussage';
    spalte.append(ueber);

    const aussage = this.#aussage;
    if (aussage === null) {
      const hinweis = document.createElement('p');
      hinweis.textContent = 'Noch keine Aussage gesetzt.';
      spalte.append(hinweis);
      return spalte;
    }

    for (const [schluessel, wert] of Object.entries(aussage.felder)) {
      if (wert === undefined) continue;
      const feld = schluessel as Feldschluessel;
      const gruppe = document.createElement('fieldset');
      const titel = document.createElement('legend');
      titel.textContent = FELDNAMEN[feld];
      gruppe.append(titel);

      for (const stufe of ['lang', 'mittel', 'kurz'] as const) {
        const text = wert[stufe];
        if (text === null) continue;
        const beschriftung = document.createElement('label');
        const marke = document.createElement('span');
        marke.className = 'stufe';
        marke.textContent = stufe;
        const eingabe = document.createElement('input');
        eingabe.type = 'text';
        eingabe.value = text;
        eingabe.dataset['feld'] = feld;
        eingabe.dataset['stufe'] = stufe;
        eingabe.addEventListener('input', () => {
          this.#setzeFeld(feld, stufe, eingabe.value);
        });
        beschriftung.append(marke, eingabe);
        gruppe.append(beschriftung);
      }
      spalte.append(gruppe);
    }

    if (aussage.termin !== null) {
      const gruppe = document.createElement('fieldset');
      const titel = document.createElement('legend');
      titel.textContent = 'Termin';
      const eingabe = document.createElement('input');
      eingabe.type = 'date';
      eingabe.value = aussage.termin.slice(0, 10);
      eingabe.dataset['feld'] = 'termin';
      eingabe.addEventListener('change', () => {
        this.#setzeTermin(eingabe.value);
      });
      gruppe.append(titel, eingabe);
      spalte.append(gruppe);
    }

    return spalte;
  }

  #baueAndrucke(): HTMLElement {
    const spalte = document.createElement('div');
    const liste = document.createElement('div');
    liste.className = 'andrucke';

    for (const a of this.#ausspielungen) {
      const { entwurf, bindungen } = this.#aufgeloest(a);
      const befunde = this.#befunde(a, entwurf, bindungen);
      const fehler = befunde.filter((b) => b.schwere === 'fehler').length;
      const warnungen = befunde.filter((b) => b.schwere === 'warnung').length;

      const karte = document.createElement('div');
      karte.className = 'andruck';
      karte.dataset['ausspielung'] = a.id;

      const kopf = document.createElement('div');
      kopf.className = 'kopf';
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = a.name;
      const chip = document.createElement('span');
      chip.className = `chip ${fehler > 0 ? 'stopp' : warnungen > 0 ? 'acht' : 'gut'}`;
      chip.textContent =
        fehler > 0 ? `${fehler} Fehler` : warnungen > 0 ? `${warnungen} Hinweise` : 'sauber';
      kopf.append(name, chip);

      const blatt = blattmasse(entwurf);
      const bogen = document.createElement('div');
      bogen.className = 'bogen';
      bogen.style.aspectRatio = `${blatt.breite} / ${blatt.hoehe}`;
      const buehne = document.createElement('div');
      buehne.className = 'bogen-inhalt';
      buehne.innerHTML = seitenHtml(entwurf, { schriften: this.#schriften });
      buehne.style.width = `${blatt.breite}px`;
      buehne.style.height = `${blatt.hoehe}px`;
      bogen.append(buehne);

      const marken = document.createElement('div');
      marken.className = 'marken';
      for (const b of bindungen) {
        const marke = document.createElement('span');
        marke.className = `marke ${b.stufe}`;
        marke.textContent = `${FELDNAMEN[b.feld].slice(0, 4)} ${b.stufe}`;
        marke.title = b.gemessen ? 'im Satz gemessen' : 'geschätzt';
        marken.append(marke);
      }

      karte.append(kopf, bogen, marken);
      if (befunde.length > 0) karte.append(this.#baueBefunde(befunde));
      liste.append(karte);

      // Maßstab erst nach dem Einhängen: vorher ist die Breite noch 0.
      queueMicrotask(() => {
        const verfuegbar = bogen.getBoundingClientRect().width;
        if (verfuegbar > 0) buehne.style.transform = `scale(${verfuegbar / blatt.breite})`;
      });
    }

    spalte.append(liste);
    return spalte;
  }

  #baueBefunde(befunde: readonly Befund[]): HTMLElement {
    const liste = document.createElement('ul');
    liste.className = 'befunde';
    for (const b of befunde) {
      const eintrag = document.createElement('li');
      eintrag.className = b.schwere;
      eintrag.dataset['regel'] = b.regel;
      eintrag.textContent = b.meldung;
      liste.append(eintrag);
    }
    return liste;
  }

  #setzeFeld(feld: Feldschluessel, stufe: 'lang' | 'mittel' | 'kurz', text: string): void {
    const alt = this.#aussage;
    if (alt === null) return;
    const wert = alt.felder[feld];
    if (wert === undefined) return;

    this.#aussage = {
      ...alt,
      felder: { ...alt.felder, [feld]: { ...wert, [stufe]: text } },
    };
    this.#meldeAenderung(feld);
    this.#zeichneNurAndrucke();
  }

  #setzeTermin(datum: string): void {
    const alt = this.#aussage;
    if (alt === null || datum === '') return;
    this.#aussage = { ...alt, termin: `${datum}T00:00:00.000Z` };
    this.#meldeAenderung('termin');
    this.#zeichneNurAndrucke();
  }

  /**
   * Nur die Andrucke neu zeichnen, nicht die Eingabefelder — sonst verliert das
   * gerade beschriebene Feld beim ersten Tastendruck den Fokus.
   */
  #zeichneNurAndrucke(): void {
    const raster = this.#huelle.querySelector('.raster');
    const alt = raster?.lastElementChild;
    if (raster === null || raster === undefined || alt === null || alt === undefined) {
      this.#zeichne();
      return;
    }
    alt.replaceWith(this.#baueAndrucke());
  }

  #meldeAenderung(feld: Feldschluessel): void {
    if (this.#aussage === null) return;
    const detail: AussageGeaendert = { aussage: this.#aussage, feld };
    this.dispatchEvent(new CustomEvent('aussage-geaendert', { detail, bubbles: true }));
  }

  disconnectedCallback(): void {
    this.#messer?.aufraeumen();
    this.#messer = null;
  }
}

/** Registriert das Element. Mehrfaches Aufrufen ist unschädlich. */
export function registriere(name = 'design-studio'): void {
  if (customElements.get(name) === undefined) customElements.define(name, DesignStudioElement);
}
