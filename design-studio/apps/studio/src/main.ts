/**
 * Probemodell — der Editor mit Bedienfeldern.
 *
 * Zeigt die drei Dinge, an denen sich das Produkt entscheidet:
 *
 * 1. **Vorlage zuerst.** Der Standardfall ist ein gesperrtes Layout mit
 *    Platzhaltern. Was nicht freigegeben ist, lässt sich nicht anfassen.
 * 2. **Markenkit erzwungen.** Eine Farbe außerhalb des Kits wird abgelehnt,
 *    nicht bloß angemerkt.
 * 3. **Druckvorstufe live.** Anschnitt, Sicherheitsabstand und Haarlinien
 *    werden während des Gestaltens geprüft, nicht erst beim Export.
 */

import {
  ElementAendern,
  ElementEntfernen,
  ElementHinzufuegen,
  type Entwurf,
  erzeugeAusVorlage,
  erzeugeForm,
  erzeugeText,
  KommandoFehler,
  mitMarkenkit,
  pxZuMm,
  sammlePlatzhalter,
  systemUhr,
  type Vorlage,
  type VorlagenWert,
  zufallsId,
} from '@studio/editor-core';
import { EDITOR_STIL, Editor } from '@studio/editor-ui';
import { freierEntwurf, MARKENKIT, MARKENSCHRIFT, VORLAGEN } from './daten.js';
import { SCHRIFTEN } from './schriften.js';

const werkzeuge = { neueId: zufallsId, jetzt: systemUhr };

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

class Anwendung {
  /**
   * `null`, solange der erste Editor noch im Bau ist. Der Editor meldet die
   * erste Änderung nämlich schon aus seinem Konstruktor heraus — also bevor
   * diese Zuweisung zurückkommt. Ohne die Prüfung baut das Bedienfeld auf
   * einem noch nicht existierenden Editor auf und die ganze Anwendung bleibt
   * stumm.
   */
  #editor: Editor | null = null;
  readonly #buehne = el('div', 'buehne');
  readonly #links = el('aside', 'feld feld-links');
  readonly #rechts = el('aside', 'feld feld-rechts');
  readonly #meldung = el('div', 'meldung');
  #meldungsUhr: ReturnType<typeof setTimeout> | null = null;

  constructor(wurzel: HTMLElement) {
    const stil = el('style');
    stil.textContent = EDITOR_STIL + ANWENDUNGS_STIL;
    document.head.append(stil);

    const kopf = this.#baueKopf();
    const raster = el('div', 'raster');
    raster.append(this.#links, this.#buehne, this.#rechts);
    wurzel.append(kopf, raster, this.#meldung);

    const erste = VORLAGEN[0] as Vorlage;
    this.#baueLinks();
    this.#starte(erzeugeAusVorlage(erste, this.#vorbelegung(erste), {}, werkzeuge));
  }

  /** Platzhalter mit ihren Bauplanwerten vorbelegen — nichts bleibt leer. */
  #vorbelegung(vorlage: Vorlage): Record<string, VorlagenWert> {
    const werte: Record<string, VorlagenWert> = {};
    for (const info of sammlePlatzhalter(vorlage)) {
      werte[info.schluessel] = { typ: 'text', wert: info.vorbelegung ?? '' };
    }
    return werte;
  }

  get editor(): Editor {
    if (this.#editor === null) throw new Error('Editor noch nicht bereit');
    return this.#editor;
  }

  #starte(entwurf: Entwurf): Editor {
    this.#buehne.innerHTML = '';
    const flaeche = el('div', 'leinwand');
    this.#buehne.append(flaeche);

    const editor = new Editor({
      behaelter: flaeche,
      entwurf,
      schriften: SCHRIFTEN,
      markenkit: MARKENKIT,
      beiAenderung: () => this.#baueRechts(),
      beiMeldung: (text) => this.#melde(text),
    });
    this.#editor = editor;
    this.#baueRechts();
    return editor;
  }

  #melde(text: string): void {
    this.#meldung.textContent = text;
    this.#meldung.classList.add('sichtbar');
    if (this.#meldungsUhr !== null) clearTimeout(this.#meldungsUhr);
    this.#meldungsUhr = setTimeout(() => this.#meldung.classList.remove('sichtbar'), 4000);
  }

  #baueKopf(): HTMLElement {
    const kopf = el('header', 'kopf');
    const titel = el('div', 'marke');
    titel.append(el('strong', undefined, 'Design Studio'), el('span', 'unterzeile', 'Probemodell'));

    const knoepfe = el('div', 'knopfreihe');
    const knopf = (
      beschriftung: string,
      tun: () => void,
      titelText?: string,
    ): HTMLButtonElement => {
      const b = el('button', undefined, beschriftung);
      if (titelText !== undefined) b.title = titelText;
      b.addEventListener('click', tun);
      return b;
    };

    knoepfe.append(
      knopf('↶ Rückgängig', () => this.editor.rueckgaengig(), 'Strg+Z'),
      knopf('↷ Wiederholen', () => this.editor.wiederholen(), 'Strg+Umschalt+Z'),
      knopf('Text', () => this.#fuegeEin('text')),
      knopf('Fläche', () => this.#fuegeEin('form')),
      knopf('Löschen', () => this.#loesche()),
    );

    kopf.append(titel, knoepfe);
    return kopf;
  }

  #fuegeEin(art: 'text' | 'form'): void {
    const entwurf = this.editor.entwurf;
    const seite = entwurf.seiten[0];
    if (seite === undefined) return;

    const rahmen = {
      x: entwurf.masse.breite * 0.2,
      y: entwurf.masse.hoehe * 0.45,
      breite: entwurf.masse.breite * 0.5,
      hoehe: entwurf.masse.hoehe * 0.08,
    };

    const element =
      art === 'text'
        ? erzeugeText(
            rahmen,
            'Neuer Text',
            {
              schriftFamilie: MARKENSCHRIFT,
              schriftGroesse: Math.round(entwurf.masse.hoehe * 0.03),
              farbe: '#000000',
            },
            werkzeuge,
          )
        : erzeugeForm(rahmen, 'rechteck', { fuellung: '#e2a33c' }, werkzeuge);

    try {
      this.editor.stack.ausfuehren(
        mitMarkenkit(
          new ElementHinzufuegen(
            { seiteId: seite.id, gruppenId: null, index: seite.elemente.length },
            element,
          ),
          MARKENKIT,
        ),
      );
      this.editor.waehle(element.id);
    } catch (fehler) {
      if (fehler instanceof KommandoFehler) this.#melde(fehler.message);
      else throw fehler;
    }
  }

  #loesche(): void {
    const gewaehlt = this.editor.ausgewaehlt;
    if (gewaehlt === null) {
      this.#melde('Nichts ausgewählt.');
      return;
    }
    try {
      this.editor.stack.ausfuehren(new ElementEntfernen(gewaehlt.id));
      this.editor.waehle(null);
    } catch (fehler) {
      if (fehler instanceof KommandoFehler) this.#melde(fehler.message);
      else throw fehler;
    }
  }

  #baueLinks(): void {
    this.#links.innerHTML = '';
    this.#links.append(el('h2', undefined, 'Vorlagen'));

    for (const vorlage of VORLAGEN) {
      const karte = el('button', 'vorlage');
      karte.append(
        el('strong', undefined, vorlage.name),
        el('span', undefined, vorlage.beschreibung),
      );
      karte.addEventListener('click', () => {
        this.#starte(erzeugeAusVorlage(vorlage, this.#vorbelegung(vorlage), {}, werkzeuge));
      });
      this.#links.append(karte);
    }

    const frei = el('button', 'vorlage vorlage-frei');
    frei.append(
      el('strong', undefined, 'Freier Entwurf'),
      el('span', undefined, 'Ohne Platzhalter — alles beweglich'),
    );
    frei.addEventListener('click', () => this.#starte(freierEntwurf()));
    this.#links.append(frei);

    this.#links.append(el('h2', undefined, 'Markenkit'));
    const kit = el('div', 'kit');
    for (const farbe of MARKENKIT.farben) {
      const punkt = el('span', 'farbpunkt');
      punkt.style.background = farbe.hex;
      punkt.title = `${farbe.name} ${farbe.hex}`;
      kit.append(punkt);
    }
    this.#links.append(kit);
    this.#links.append(
      el(
        'p',
        'hinweis',
        MARKENKIT.strikt
          ? 'Strikt: Farben außerhalb des Kits werden abgelehnt, nicht nur angemerkt.'
          : 'Locker: Abweichungen werden nur angemerkt.',
      ),
    );
  }

  #baueRechts(): void {
    if (this.#editor === null) return;
    this.#rechts.innerHTML = '';
    const gewaehlt = this.editor.ausgewaehlt;

    this.#rechts.append(el('h2', undefined, 'Auswahl'));
    if (gewaehlt === null) {
      this.#rechts.append(
        el('p', 'hinweis', 'Nichts ausgewählt. Element anklicken, Text doppelklicken.'),
      );
    } else {
      this.#rechts.append(this.#eigenschaften(gewaehlt));
    }

    // --- Prüfstand ----------------------------------------------------------
    const stand = this.editor.pruefe();
    const druckFehler = stand.druck.filter((b) => b.schwere === 'fehler');
    const markeFehler = stand.marke.filter((v) => v.schwere === 'fehler');

    this.#rechts.append(el('h2', undefined, 'Druckvorstufe'));
    const ampel = el(
      'div',
      `ampel ${druckFehler.length > 0 ? 'rot' : stand.druck.length > 0 ? 'gelb' : 'gruen'}`,
    );
    ampel.textContent =
      druckFehler.length > 0
        ? `${druckFehler.length} Fehler — so nimmt die Druckerei das nicht an`
        : stand.druck.length > 0
          ? `${stand.druck.length} Warnung(en)`
          : 'Ohne Befund';
    this.#rechts.append(ampel);

    if (stand.druck.length > 0) {
      const liste = el('ul', 'befunde');
      for (const b of stand.druck) {
        const eintrag = el('li', b.schwere);
        eintrag.textContent = b.meldung;
        liste.append(eintrag);
      }
      this.#rechts.append(liste);
    }

    this.#rechts.append(el('h2', undefined, 'Markenkonformität'));
    const kitAmpel = el('div', `ampel ${markeFehler.length > 0 ? 'rot' : 'gruen'}`);
    kitAmpel.textContent =
      markeFehler.length > 0 ? `${markeFehler.length} Verstoß(e)` : 'Markenkonform';
    this.#rechts.append(kitAmpel);

    if (stand.marke.length > 0) {
      const liste = el('ul', 'befunde');
      for (const v of stand.marke) {
        const eintrag = el('li', v.schwere === 'fehler' ? 'fehler' : 'warnung');
        eintrag.textContent = v.meldung;
        liste.append(eintrag);
      }
      this.#rechts.append(liste);
    }

    const e = this.editor.entwurf;
    const masse = el(
      'p',
      'hinweis',
      `${e.masse.breite.toFixed(0)} × ${e.masse.hoehe.toFixed(0)} px bei ${e.masse.dpi} dpi` +
        ` (${pxZuMm(e.masse.breite, e.masse.dpi).toFixed(0)} × ${pxZuMm(e.masse.hoehe, e.masse.dpi).toFixed(0)} mm)` +
        `, Anschnitt ${pxZuMm(e.anschnitt.links, e.masse.dpi).toFixed(0)} mm`,
    );
    this.#rechts.append(masse);
  }

  #eigenschaften(gewaehlt: NonNullable<Editor['ausgewaehlt']>): HTMLElement {
    const kasten = el('div', 'eigenschaften');
    kasten.append(el('p', 'elementname', `${gewaehlt.name} · ${gewaehlt.typ}`));

    if (gewaehlt.platzhalter !== null) {
      kasten.append(
        el(
          'p',
          'platzhalter',
          `Platzhalter „${gewaehlt.platzhalter.schluessel}" — änderbar: ${gewaehlt.platzhalter.bearbeitbar.join(', ')}`,
        ),
      );
    } else if (gewaehlt.gesperrt) {
      kasten.append(el('p', 'platzhalter gesperrt', 'Gesperrt — Teil des Layouts'));
    }

    if (gewaehlt.typ === 'text') {
      const feld = el('textarea');
      feld.value = gewaehlt.inhalt;
      feld.rows = 4;
      feld.addEventListener('input', () => this.editor.setzeText(feld.value));
      kasten.append(el('label', undefined, 'Text'), feld);

      const groesse = el('input');
      groesse.type = 'range';
      groesse.min = '8';
      groesse.max = String(Math.round(this.editor.entwurf.masse.hoehe * 0.15));
      groesse.value = String(Math.round(gewaehlt.schriftGroesse));
      groesse.addEventListener('input', () =>
        this.editor.aendere({ schriftGroesse: Number(groesse.value) }, 'text'),
      );
      kasten.append(
        el('label', undefined, `Schriftgröße ${Math.round(gewaehlt.schriftGroesse)} px`),
        groesse,
      );
    }

    // Farbwahl: nur Kitfarben plus ein bewusst verbotener Ton, damit sich der
    // Wächter im Probemodell zeigen lässt.
    const farben = el('div', 'farbwahl');
    const auswahl: { hex: string; name: string; erlaubt: boolean }[] = [
      ...MARKENKIT.farben.map((f) => ({ hex: f.hex, name: f.name, erlaubt: true })),
      { hex: '#ff0000', name: 'Nicht im Kit', erlaubt: false },
    ];

    for (const farbe of auswahl) {
      const knopf = el('button', `farbknopf${farbe.erlaubt ? '' : ' verboten'}`);
      knopf.style.background = farbe.hex;
      knopf.title = farbe.name;
      knopf.addEventListener('click', () => {
        const aenderung = gewaehlt.typ === 'text' ? { farbe: farbe.hex } : { fuellung: farbe.hex };
        try {
          // Der Wächter hüllt das Kommando ein: er lehnt neu hinzukommende
          // Verstöße ab, lässt bestehende aber weiter bearbeiten.
          this.editor.stack.ausfuehren(
            mitMarkenkit(new ElementAendern(gewaehlt.id, aenderung, 'farbe'), MARKENKIT),
          );
        } catch (fehler) {
          if (fehler instanceof KommandoFehler) this.#melde(fehler.message);
          else throw fehler;
        }
      });
      farben.append(knopf);
    }
    kasten.append(el('label', undefined, 'Farbe'), farben);

    return kasten;
  }
}

const ANWENDUNGS_STIL = `
:root{color-scheme:light dark;--grund:#f4f5f8;--karte:#fff;--text:#16181d;--gedaempft:#5a6070;
  --linie:#dde1e8;--blau:#0a5c8a;--rot:#b3261e;--gelb:#8a6d00;--gruen:#0f7a3d}
@media (prefers-color-scheme:dark){:root{--grund:#14161c;--karte:#1c1f27;--text:#e8eaf0;
  --gedaempft:#9aa1b1;--linie:#2b303b;--blau:#5aa9d8;--rot:#ff8a80;--gelb:#e0c36a;--gruen:#4ec27d}}
*{box-sizing:border-box}
body{margin:0;background:var(--grund);color:var(--text);
  font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.kopf{display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap;
  padding:.7rem 1rem;background:var(--karte);border-bottom:1px solid var(--linie)}
.marke{display:flex;align-items:baseline;gap:.5rem}
.marke .unterzeile{color:var(--gedaempft);font-size:.8rem}
.knopfreihe{display:flex;gap:.4rem;flex-wrap:wrap}
button{font:inherit;padding:.4rem .7rem;border-radius:6px;border:1px solid var(--linie);
  background:var(--karte);color:var(--text);cursor:pointer}
button:hover{border-color:var(--blau)}
.raster{display:grid;grid-template-columns:250px 1fr 300px;gap:0;height:calc(100vh - 56px)}
@media (max-width:900px){.raster{grid-template-columns:1fr;height:auto}}
.feld{padding:1rem;overflow-y:auto;background:var(--karte);border-right:1px solid var(--linie)}
.feld-rechts{border-right:0;border-left:1px solid var(--linie)}
.feld h2{font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:var(--gedaempft);
  margin:1.2rem 0 .5rem;font-weight:600}
.feld h2:first-child{margin-top:0}
.buehne{position:relative;min-height:60vh}
.leinwand{position:absolute;inset:0}
@media (max-width:900px){.buehne{min-height:70vh}.leinwand{position:relative;height:70vh}}
.vorlage{display:flex;flex-direction:column;align-items:flex-start;gap:.15rem;width:100%;
  text-align:left;margin-bottom:.5rem;padding:.6rem .7rem}
.vorlage span{color:var(--gedaempft);font-size:.8rem}
.vorlage-frei{border-style:dashed}
.kit{display:flex;gap:.4rem}
.farbpunkt{width:26px;height:26px;border-radius:5px;border:1px solid var(--linie)}
.hinweis{color:var(--gedaempft);font-size:.8rem;margin:.5rem 0 0}
.eigenschaften label{display:block;margin:.7rem 0 .25rem;font-size:.78rem;color:var(--gedaempft)}
.eigenschaften textarea,.eigenschaften input{width:100%;font:inherit;padding:.4rem;
  border-radius:6px;border:1px solid var(--linie);background:var(--grund);color:var(--text)}
.elementname{font-weight:600;margin:0}
.platzhalter{margin:.3rem 0 0;padding:.35rem .5rem;border-radius:5px;font-size:.78rem;
  background:color-mix(in srgb,var(--blau) 12%,transparent);color:var(--blau)}
.platzhalter.gesperrt{background:color-mix(in srgb,var(--rot) 12%,transparent);color:var(--rot)}
.farbwahl{display:flex;gap:.4rem;flex-wrap:wrap}
.farbknopf{width:30px;height:30px;padding:0;border-radius:5px}
.farbknopf.verboten{outline:2px dashed var(--rot);outline-offset:2px}
.ampel{padding:.45rem .6rem;border-radius:6px;font-weight:600;font-size:.82rem}
.ampel.gruen{background:color-mix(in srgb,var(--gruen) 15%,transparent);color:var(--gruen)}
.ampel.gelb{background:color-mix(in srgb,var(--gelb) 18%,transparent);color:var(--gelb)}
.ampel.rot{background:color-mix(in srgb,var(--rot) 15%,transparent);color:var(--rot)}
.befunde{margin:.5rem 0 0;padding-left:1.1rem;font-size:.8rem;color:var(--gedaempft)}
.befunde li{margin-bottom:.3rem}
.befunde li.fehler{color:var(--rot)}
.meldung{position:fixed;left:50%;bottom:1.5rem;transform:translateX(-50%) translateY(1rem);
  background:var(--rot);color:#fff;padding:.6rem 1rem;border-radius:8px;max-width:min(90vw,44rem);
  opacity:0;pointer-events:none;transition:opacity .18s,transform .18s;font-size:.85rem;z-index:50}
.meldung.sichtbar{opacity:1;transform:translateX(-50%)}
`;

const wurzel = document.getElementById('app');
if (wurzel !== null) new Anwendung(wurzel);
