/**
 * Der Editor.
 *
 * Zeichnet den Entwurf über `@studio/render` — **denselben Renderer, der auch
 * das Druck-PDF erzeugt**. Deshalb kann die Vorschau nicht lügen: was hier
 * steht, steht später im PDF, weil es durch dieselbe Datei gelaufen ist.
 *
 * Darüber liegt eine dünne Schicht aus Auswahlrahmen und Griffen. Jede
 * Handlung geht als Kommando in den Stack, nie direkt ans Modell — damit ist
 * alles rückgängig zu machen, ohne dass diese Datei davon wissen muss.
 *
 * Bewusst ohne Rahmenwerk: der Editor soll sich als Custom Element in fremde
 * Seiten einbauen lassen, ohne dort React zu erzwingen.
 */

import {
  type Druckbefund,
  darfAendern,
  ElementAendern,
  type Entwurf,
  type Entwurfselement,
  findeElement,
  KommandoFehler,
  KommandoStack,
  type Markenkit,
  type Markenverstoss,
  pruefeDruck,
  pruefeMarkenkonform,
  TextAendern,
} from '@studio/editor-core';
import { blattmasse, type Schriftquelle, schriftRegeln, seitenHtml } from '@studio/render';
import { Auswahlsteuerung, grifflagen } from './auswahl.js';

export interface EditorOptionen {
  behaelter: HTMLElement;
  entwurf: Entwurf;
  schriften: readonly Schriftquelle[];
  markenkit?: Markenkit | null;
  /** Wird nach jeder Änderung gerufen — für Bedienfelder außerhalb. */
  beiAenderung?: (entwurf: Entwurf) => void;
  /** Kurze Rückmeldung an den Nutzer, etwa bei abgelehnten Handlungen. */
  beiMeldung?: (text: string) => void;
}

export interface Pruefstand {
  druck: Druckbefund[];
  marke: Markenverstoss[];
}

const GRIFF_GROESSE = 10;

export class Editor {
  readonly stack: KommandoStack;
  readonly #behaelter: HTMLElement;
  readonly #buehne: HTMLElement;
  readonly #blatt: HTMLElement;
  readonly #ebene: HTMLElement;
  readonly #stilknoten: HTMLStyleElement;
  readonly #auswahl: Auswahlsteuerung;
  readonly #optionen: EditorOptionen;
  #massstab = 1;
  #textBearbeitung: string | null = null;
  /** Auf ein unbewegliches Element gedrückt — Meldung erst, wenn wirklich gezogen wird. */
  #gehaltenUnbeweglich: { id: string; x: number; y: number } | null = null;

  constructor(optionen: EditorOptionen) {
    this.#optionen = optionen;
    this.#behaelter = optionen.behaelter;
    this.stack = new KommandoStack(optionen.entwurf);
    this.#auswahl = new Auswahlsteuerung(this.stack, (m) => optionen.beiMeldung?.(m));

    this.#behaelter.innerHTML = '';
    this.#behaelter.classList.add('studio-editor');

    this.#stilknoten = document.createElement('style');
    this.#stilknoten.textContent = schriftRegeln(optionen.schriften);
    this.#behaelter.append(this.#stilknoten);

    this.#buehne = document.createElement('div');
    this.#buehne.className = 'studio-buehne';
    this.#blatt = document.createElement('div');
    this.#blatt.className = 'studio-blatt';
    this.#ebene = document.createElement('div');
    this.#ebene.className = 'studio-ebene';

    this.#buehne.append(this.#blatt, this.#ebene);
    this.#behaelter.append(this.#buehne);

    this.#verdrahte();
    this.zeichne();
    this.stack.abonniere(() => this.zeichne());

    // Der Massstab hängt an der Fenstergröße; ohne das schneidet die Bühne ab.
    globalThis.addEventListener?.('resize', () => this.passeMassstabAn());
  }

  get entwurf(): Entwurf {
    return this.stack.entwurf;
  }

  get ausgewaehlt(): Entwurfselement | null {
    return this.#auswahl.ausgewaehltesElement;
  }

  get massstab(): number {
    return this.#massstab;
  }

  waehle(elementId: string | null): void {
    this.#auswahl.waehle(elementId);
    this.zeichneEbene();
    this.#optionen.beiAenderung?.(this.entwurf);
  }

  /** Live-Prüfung: Druckvorstufe und Markenkit. Der eigentliche Produktwert. */
  pruefe(): Pruefstand {
    const kit = this.#optionen.markenkit ?? null;
    return {
      druck: pruefeDruck(this.entwurf, { pruefeAufloesung: true }),
      marke: kit === null ? [] : pruefeMarkenkonform(this.entwurf, kit),
    };
  }

  /** Ändert eine Eigenschaft des ausgewählten Elements über den Stack. */
  aendere(
    aenderung: ConstructorParameters<typeof ElementAendern>[1],
    aspekt: 'farbe' | 'text' | 'position',
  ): void {
    const id = this.#auswahl.ausgewaehlt;
    if (id === null) return;
    try {
      this.stack.ausfuehren(new ElementAendern(id, aenderung, aspekt));
    } catch (fehler) {
      if (fehler instanceof KommandoFehler) {
        this.#optionen.beiMeldung?.(fehler.message);
        return;
      }
      throw fehler;
    }
  }

  setzeText(inhalt: string): void {
    const id = this.#auswahl.ausgewaehlt;
    if (id === null) return;
    try {
      this.stack.ausfuehren(new TextAendern(id, inhalt));
    } catch (fehler) {
      if (fehler instanceof KommandoFehler) {
        this.#optionen.beiMeldung?.(fehler.message);
        return;
      }
      throw fehler;
    }
  }

  rueckgaengig(): void {
    this.stack.rueckgaengig();
  }

  wiederholen(): void {
    this.stack.wiederholen();
  }

  /** Zeichnet Blatt und Auswahlschicht neu. */
  zeichne(): void {
    if (this.#textBearbeitung !== null) return;

    this.#blatt.innerHTML = seitenHtml(this.entwurf, { schriften: this.#optionen.schriften });
    const blatt = blattmasse(this.entwurf);
    this.#buehne.style.width = `${blatt.breite}px`;
    this.#buehne.style.height = `${blatt.hoehe}px`;

    this.passeMassstabAn();
    this.zeichneEbene();
    this.#optionen.beiAenderung?.(this.entwurf);
  }

  passeMassstabAn(): void {
    const blatt = blattmasse(this.entwurf);
    const verfuegbar = this.#behaelter.getBoundingClientRect();
    if (verfuegbar.width === 0 || verfuegbar.height === 0) return;

    // Etwas Luft lassen, sonst kleben die Griffe am Rand.
    const rand = 32;
    this.#massstab = Math.min(
      (verfuegbar.width - rand) / blatt.breite,
      (verfuegbar.height - rand) / blatt.hoehe,
      1,
    );
    this.#buehne.style.transform = `scale(${this.#massstab})`;
  }

  /** Auswahlrahmen, Griffe und die Anschnitt-/Sicherheitslinien. */
  zeichneEbene(): void {
    const blatt = blattmasse(this.entwurf);
    const e = this.entwurf;
    const teile: string[] = [];

    // Hilfslinien: Endformat und Sicherheitsabstand. Das ist der Unterschied
    // zwischen „sieht gut aus" und „kommt aus der Druckerei zurück".
    teile.push(
      `<div class="studio-linie studio-endformat" style="left:${e.anschnitt.links}px;top:${e.anschnitt.oben}px;` +
        `width:${e.masse.breite}px;height:${e.masse.hoehe}px"></div>`,
    );
    if (e.sicherheitsabstand > 0) {
      teile.push(
        `<div class="studio-linie studio-sicherheit" style="left:${e.anschnitt.links + e.sicherheitsabstand}px;` +
          `top:${e.anschnitt.oben + e.sicherheitsabstand}px;` +
          `width:${e.masse.breite - 2 * e.sicherheitsabstand}px;` +
          `height:${e.masse.hoehe - 2 * e.sicherheitsabstand}px"></div>`,
      );
    }

    const gewaehlt = this.#auswahl.ausgewaehltesElement;
    if (gewaehlt !== null) {
      const x = gewaehlt.x + e.anschnitt.links;
      const y = gewaehlt.y + e.anschnitt.oben;
      const dreh =
        gewaehlt.drehung === 0
          ? ''
          : `transform:rotate(${gewaehlt.drehung}deg);transform-origin:50% 50%;`;
      const beweglich = darfAendern(gewaehlt, 'position');

      teile.push(
        `<div class="studio-rahmen${beweglich ? '' : ' studio-gesperrt'}" ` +
          `style="left:${x}px;top:${y}px;width:${gewaehlt.breite}px;height:${gewaehlt.hoehe}px;${dreh}">` +
          (beweglich
            ? grifflagen()
                .map(
                  (g) =>
                    `<span class="studio-griff" data-griff="${g.art}" style="left:${g.ax * 100}%;top:${g.ay * 100}%;` +
                    `width:${GRIFF_GROESSE / this.#massstab}px;height:${GRIFF_GROESSE / this.#massstab}px"></span>`,
                )
                .join('')
            : '<span class="studio-schloss">gesperrt</span>') +
          '</div>',
      );
    }

    this.#ebene.style.width = `${blatt.breite}px`;
    this.#ebene.style.height = `${blatt.hoehe}px`;
    this.#ebene.innerHTML = teile.join('');
  }

  /** Zeigerlage im Dokumentkoordinatensystem, Anschnitt bereits abgezogen. */
  #zeigerlage(ereignis: PointerEvent): { x: number; y: number } {
    const kasten = this.#buehne.getBoundingClientRect();
    return {
      x: (ereignis.clientX - kasten.left) / this.#massstab - this.entwurf.anschnitt.links,
      y: (ereignis.clientY - kasten.top) / this.#massstab - this.entwurf.anschnitt.oben,
    };
  }

  #verdrahte(): void {
    this.#behaelter.addEventListener('pointerdown', (ereignis) => {
      const ziel = ereignis.target as HTMLElement;
      const traeger = ziel.closest<HTMLElement>('[data-element-id]');
      const elementId = traeger?.dataset['elementId'] ?? null;

      if (elementId === null || traeger?.dataset['typ'] === 'hintergrund') {
        this.waehle(null);
        return;
      }

      // Auswählen geht immer — auch bei gesperrten Elementen und Platzhaltern.
      // Sonst ließe sich ein Platzhalter nicht anwählen und damit sein Text
      // nicht bearbeiten, und die ganze Vorlage wäre unbenutzbar.
      this.#auswahl.waehle(elementId);
      this.#gehaltenUnbeweglich = null;

      const lage = this.#zeigerlage(ereignis);
      const element = findeElement(this.entwurf, elementId)?.element ?? null;
      if (element !== null && darfAendern(element, 'position')) {
        if (this.#auswahl.beginneZiehen(elementId, lage)) {
          this.#behaelter.setPointerCapture(ereignis.pointerId);
        }
      } else {
        // Die Meldung kommt erst, wenn tatsächlich gezogen wird. Beim bloßen
        // Anwählen wäre sie nur im Weg.
        this.#gehaltenUnbeweglich = { id: elementId, x: lage.x, y: lage.y };
      }

      this.zeichneEbene();
      this.#optionen.beiAenderung?.(this.entwurf);
    });

    this.#behaelter.addEventListener('pointermove', (ereignis) => {
      const gehalten = this.#gehaltenUnbeweglich;
      if (gehalten !== null) {
        const lage = this.#zeigerlage(ereignis);
        const weg = Math.hypot(lage.x - gehalten.x, lage.y - gehalten.y);
        // Erst ab einer erkennbaren Bewegung melden — ein Wackeln beim Klicken
        // ist keine Verschiebeabsicht.
        if (weg * this.#massstab > 3) {
          const element = findeElement(this.entwurf, gehalten.id)?.element ?? null;
          if (element !== null) {
            this.#optionen.beiMeldung?.(
              element.platzhalter !== null
                ? `„${element.name}" ist ein Platzhalter und darf nicht verschoben werden.`
                : `„${element.name}" ist gesperrt.`,
            );
          }
          this.#gehaltenUnbeweglich = null;
        }
        return;
      }

      if (!this.#auswahl.ziehtGerade) return;
      this.#auswahl.zieheWeiter(this.#zeigerlage(ereignis));
    });

    for (const art of ['pointerup', 'pointercancel'] as const) {
      this.#behaelter.addEventListener(art, (ereignis) => {
        this.#gehaltenUnbeweglich = null;
        if (!this.#auswahl.ziehtGerade) return;
        this.#auswahl.beendeZiehen();
        this.#behaelter.releasePointerCapture((ereignis as PointerEvent).pointerId);
      });
    }

    // Doppelklick auf Text: an Ort und Stelle bearbeiten. Der Renderer bleibt
    // stehen, damit der Umbruch währenddessen nicht springt.
    this.#behaelter.addEventListener('dblclick', (ereignis) => {
      const ziel = (ereignis.target as HTMLElement).closest<HTMLElement>('[data-typ="text"]');
      const id = ziel?.dataset['elementId'];
      if (ziel === null || ziel === undefined || id === undefined) return;

      const fundstelle = findeElement(this.entwurf, id);
      if (fundstelle === null || !darfAendern(fundstelle.element, 'text')) {
        this.#optionen.beiMeldung?.('Dieser Text darf nicht geändert werden.');
        return;
      }

      this.#textBearbeitung = id;
      ziel.contentEditable = 'true';
      ziel.focus();

      const beenden = (): void => {
        ziel.contentEditable = 'false';
        this.#textBearbeitung = null;
        const neu = ziel.textContent ?? '';
        // Weiche Trennstriche wieder heraus: sie sind Satzhilfe, nicht Inhalt.
        this.setzeText(neu.replaceAll('­', ''));
        this.zeichne();
      };
      ziel.addEventListener('blur', beenden, { once: true });
    });

    globalThis.addEventListener?.('keydown', (ereignis) => {
      const tastatur = ereignis as KeyboardEvent;
      if (this.#textBearbeitung !== null) return;

      const schritt = tastatur.shiftKey ? 10 : 1;
      const bewegung: Record<string, [number, number]> = {
        ArrowLeft: [-schritt, 0],
        ArrowRight: [schritt, 0],
        ArrowUp: [0, -schritt],
        ArrowDown: [0, schritt],
      };

      if (tastatur.key in bewegung) {
        const [dx, dy] = bewegung[tastatur.key] as [number, number];
        this.#auswahl.verschiebeUmSchritt(dx, dy);
        tastatur.preventDefault();
        return;
      }

      if ((tastatur.ctrlKey || tastatur.metaKey) && tastatur.key.toLowerCase() === 'z') {
        if (tastatur.shiftKey) this.wiederholen();
        else this.rueckgaengig();
        tastatur.preventDefault();
      }
      if (tastatur.key === 'Escape') this.waehle(null);
    });
  }
}
