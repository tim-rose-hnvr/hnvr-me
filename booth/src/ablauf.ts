/**
 * Der Booth-Ablauf: Attract → Auswahl → Countdown → Aufnahme → Ergebnis →
 * Ausgabe. Alles läuft lokal; ohne Netz fehlt nur der QR-Weg.
 *
 * Zwei Regeln aus dem Betrieb stecken fest darin:
 *  1. Eine Aufnahme wird gesichert, bevor sie gezeigt wird.
 *  2. Die Box bleibt nie hängen — Leerlauf und Auto-Weiter holen sie zurück.
 */

import { ARTEN, REGIE, type Art } from './arten';
import { Kamera, deuteFehler } from './kamera';
import type { Einstellungen } from './einstellungen';
import {
  holeEinstellungen,
  ladeEinstellungen,
  pinStimmt,
  sichereEinstellungen,
  sichereGreenscreen,
  sichereTafeln,
  standardEinstellungen,
} from './einstellungen';
import { alsBilddaten, alsBlob, alsDoppelstreifen, zeichneMitVorlage } from './layout';
import { alsGif } from './gif';
import { bildfelder, werteJetzt } from './vorlage';
import { eingestellt, findeVorlage, ladeVorlagen } from './vorlagen';
import {
  darfDrucken,
  dateiname,
  drucke,
  druckeInLetzterStunde,
  qrBild,
  qrFuer,
  sichereAlsDatei,
} from './ausgabe';
import { raeumeAuf, sichere, anzahl as gesamtzahl, type Aufnahme } from './speicher';
import { amDraht, istNeuladen, type Nachricht } from './draht';
import { EFFEKTE, stelleFrei, wende, type Effektkennung } from './effekte';

type Schritt = 'attract' | 'auswahl' | 'aufnahme' | 'ergebnis' | 'ausgabe';

export class Booth {
  private wurzel: HTMLElement;
  private einstellungen: Einstellungen;
  private kamera: Kamera;
  private video: HTMLVideoElement;

  private schritt: Schritt = 'attract';
  private art: Art = ARTEN[0]!;
  private aufnahmen: HTMLCanvasElement[] = [];
  private ergebnis: HTMLCanvasElement | null = null;
  /** Bewegtbild zur laufenden Aufnahme, sobald es auf der Box liegt. */
  private bewegtbild: Aufnahme | null = null;
  private ergebnisKennung = '';
  private sitzungen = 0;

  /** Gewählter Kunststil. Gilt für die laufende Runde, nicht für die Box. */
  private effekt: Effektkennung = 'ohne';
  /** Läuft gerade eine Neuberechnung? Solange bleiben die Stile gesperrt. */
  private rechnet = false;
  /** Der Greenscreen-Hintergrund, einmal geladen. */
  private hintergrundbild: HTMLImageElement | null = null;
  /**
   * Die Aufnahmen in der Fassung, die im Blatt steckt. Die Schleife im
   * Ergebnis zeigt sie — nicht die rohen: Sonst liefe die Vorschau ohne
   * den Stil, den der Gast gerade gewählt hat.
   */
  private gezeigteAufnahmen: HTMLCanvasElement[] = [];

  private leerlaufUhr: number | null = null;
  private weiterUhr: number | null = null;
  private animation: number | null = null;

  /** QR-Code auf die Seite mit dem Fernauslöser. */
  private fernQr = '';

  constructor(wurzel: HTMLElement) {
    this.wurzel = wurzel;
    this.einstellungen = ladeEinstellungen();

    this.video = document.createElement('video');
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.id = 'video';
    this.kamera = new Kamera(this.video);
  }

  async starte(): Promise<void> {
    /* Erst der Stand der Box, dann das erste Bild. Sonst zeichnet der Booth
       eine Sekunde lang mit den Vorgaben — Eventname, Laufband und Countdown
       springen dem Gast vor der Nase um. */
    await holeEinstellungen();
    this.einstellungen = ladeEinstellungen();
    this.zeichne();

    try {
      await this.kamera.starte();
      this.zeichne();
    } catch (fehler) {
      const gedeutet = deuteFehler(fehler);
      this.zeigeKamerafehler(gedeutet.text);
    }

    // Welche Vorlagen es gibt und welche eingestellt ist, weiß die Box.
    void ladeVorlagen();

    // Der Greenscreen-Hintergrund wird einmal geladen, nicht bei jeder
    // Aufnahme: Ein Bild aus einer Data-URL zu dekodieren kostet Zeit, die
    // sonst zwischen Blitz und Ergebnis läge.
    void this.ladeHintergrund();

    // Ab hier meldet die Box selbst, wenn sich etwas ändert.
    amDraht('booth', (n) => this.vonDerBox(n));

    // Abgelaufene Aufnahmen räumt die Box beim Start weg.
    void raeumeAuf(this.einstellungen.loeschfristTage).catch(() => undefined);
    void this.zaehleAuf();

    // Läuft der Booth in der Desktop-Hülle, kennt sie die Adresse, unter der
    // die Box ihre Dateien anbietet — der QR-Code braucht dann keine
    // Konfiguration von Hand.
    void boxAdresse().then(async (adresse) => {
      if (adresse && !this.einstellungen.ausgabeBasis) {
        this.einstellungen.ausgabeBasis = adresse;
      }
      const basis = this.einstellungen.ausgabeBasis.trim().replace(/\/$/, '');
      if (!basis) return;
      try {
        this.fernQr = await qrBild(`${basis}/fern`);
        if (this.schritt === 'attract') this.zeichne();
      } catch {
        // Ohne QR bleibt der Screen das Bedienelement.
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.zumAttract();
      // Einstellungen: Strg/Cmd + E, danach PIN.
      if (e.key.toLowerCase() === 'e' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.fragePin();
      }
    });
  }

  /**
   * Was die Box meldet.
   *
   * Der Booth ist die einzige Oberfläche, vor der jemand steht. Deshalb wird
   * hier nichts unter laufender Aufnahme umgeworfen: Neue Einstellungen und
   * ein Neuladen greifen erst im Attract, wenn niemand davorsteht. Drei
   * Sekunden später zu wirken ist verzeihlich, eine Serie mittendrin
   * abzureißen nicht.
   */
  private vonDerBox(n: Nachricht): void {
    const ruht = this.schritt === 'attract';

    if (n.type === 'settings' || n.type === 'hello') {
      this.einstellungen = ladeEinstellungen();
      // Ein neuer Hintergrund für die Freistellung wird sofort geladen, nicht
      // erst beim nächsten Blitz.
      void this.ladeHintergrund();
      if (ruht) this.zeichne();
    }

    // Auslösen vom Handy: derselbe Weg wie der Knopf am Screen.
    if (
      n.type === 'control' &&
      n.action === 'trigger' &&
      (this.schritt === 'attract' || this.schritt === 'auswahl')
    ) {
      void this.starteSerie();
    }

    if (istNeuladen(n, 'booth') && ruht) location.reload();
  }

  private async zaehleAuf(): Promise<void> {
    try {
      this.sitzungen = await gesamtzahl();
      const feld = this.wurzel.querySelector('[data-feld="sitzungen"]');
      if (feld) feld.textContent = String(this.sitzungen);
    } catch {
      // Ohne Ablage laeuft der Booth weiter, nur ohne Zaehler.
    }
  }

  // --- Zeitgeber --------------------------------------------------------

  private setzeLeerlauf(): void {
    this.stoppeLeerlauf();
    if (this.schritt === 'attract') return;
    this.leerlaufUhr = window.setTimeout(
      () => this.zumAttract(),
      this.einstellungen.leerlauf * 1000
    );
  }

  private stoppeLeerlauf(): void {
    if (this.leerlaufUhr !== null) window.clearTimeout(this.leerlaufUhr);
    this.leerlaufUhr = null;
  }

  private stoppeWeiter(): void {
    if (this.weiterUhr !== null) window.clearTimeout(this.weiterUhr);
    this.weiterUhr = null;
  }

  private stoppeAnimation(): void {
    if (this.animation !== null) window.clearInterval(this.animation);
    this.animation = null;
  }

  private zumAttract(): void {
    this.stoppeWeiter();
    this.stoppeAnimation();
    this.aufnahmen = [];
    this.gezeigteAufnahmen = [];
    this.ergebnis = null;
    this.bewegtbild = null;
    // Der Stil gehört dem Gast, der ihn gewählt hat. Der nächste fängt ohne an.
    this.effekt = 'ohne';
    this.schritt = 'attract';
    this.zeichne();
  }

  private geheZu(schritt: Schritt): void {
    this.schritt = schritt;
    this.zeichne();
    this.setzeLeerlauf();
  }

  // --- Aufbau -----------------------------------------------------------

  private zeichne(): void {
    this.wurzel.replaceChildren(this.kopfleiste(), this.buehne(), this.fussleiste());
  }

  private kopfleiste(): HTMLElement {
    const leiste = element('header', 'leiste');

    const marke = element('span', 'zustand');
    marke.append(
      element('span', 'lampe'),
      mono(this.kamera.laeuft ? 'Bereit' : 'Kamera prüfen'),
      mono(this.einstellungen.box)
    );

    const rechts = element('span', 'zustand');
    const zaehler = mono(String(this.sitzungen));
    zaehler.dataset.feld = 'sitzungen';
    rechts.append(mono('Sessions'), zaehler, mono(this.einstellungen.event));

    leiste.append(marke, rechts);
    return leiste;
  }

  private fussleiste(): HTMLElement {
    const leiste = element('footer', 'leiste leiste--fuss');
    leiste.append(
      mono(
        `Fotos nur für dieses Event · Löschung nach ${this.einstellungen.loeschfristTage} Tagen`
      )
    );

    const rechts = element('span', 'zustand');
    if (this.einstellungen.druck && this.einstellungen.druckLimitStunde > 0) {
      rechts.append(
        mono(`${druckeInLetzterStunde()} / ${this.einstellungen.druckLimitStunde} diese Stunde`)
      );
    }
    const knopf = element('button', 'chip');
    knopf.textContent = 'Einstellungen ⌘+E';
    knopf.addEventListener('click', () => this.fragePin());
    rechts.append(knopf);

    leiste.append(rechts);
    return leiste;
  }

  private buehne(): HTMLElement {
    const buehne = element(
      'div',
      this.einstellungen.uebergang ? 'buehne buehne--auftritt' : 'buehne'
    );

    switch (this.schritt) {
      case 'attract':
        buehne.append(this.bildfeld(this.attract()));
        break;
      case 'auswahl':
        buehne.append(this.bildfeld(), this.auswahlspalte());
        break;
      case 'aufnahme':
        buehne.append(this.bildfeld(this.countdownfeld()));
        break;
      case 'ergebnis':
        buehne.append(this.ergebnisfeld(), this.ergebnisspalte());
        break;
      case 'ausgabe':
        buehne.append(this.ergebnisfeld(), this.ausgabespalte());
        break;
    }

    return buehne;
  }

  /** Live-Bild mit optionaler Überlagerung. */
  private bildfeld(ueberlagerung?: HTMLElement): HTMLElement {
    const feld = element('div', 'bild');

    if (this.kamera.laeuft) {
      this.video.style.transform = this.einstellungen.spiegeln ? 'scaleX(-1)' : 'none';
      feld.append(this.video);
    } else {
      const hinweis = element('div', 'bild__hinweis');
      hinweis.append(
        mono('Kein Live-Bild'),
        absatz('Die Kamera ist nicht bereit. Der Booth wartet, bis sie da ist.')
      );
      feld.append(hinweis);
    }

    const blitz = element('span', 'blitz');
    blitz.dataset.feld = 'blitz';
    feld.append(blitz);

    if (ueberlagerung) feld.append(ueberlagerung);
    return feld;
  }

  private attract(): HTMLElement {
    const flaeche = element('div', 'attract');

    const titel = document.createElement('h1');
    titel.textContent = this.einstellungen.attractTitel;

    const puls = this.einstellungen.attractstil === 'puls';
    const start = element(
      'button',
      puls ? 'knopf knopf--amber knopf--gross knopf--puls' : 'knopf knopf--amber knopf--gross'
    );
    start.textContent = 'Jetzt starten';
    start.addEventListener('click', () => this.geheZu('auswahl'));

    flaeche.append(
      mono(this.einstellungen.event, 'mono mono--amber'),
      titel,
      start,
      absatz(this.einstellungen.attractZeile)
    );

    // Laufband: der Text steht zweimal darin, damit die Schleife ohne Lücke
    // durchläuft. Ohne Text kein Band — ein leeres Band wäre nur Bewegung.
    if (this.einstellungen.attractstil === 'laufband' && this.einstellungen.laufband.trim()) {
      const band = element('div', 'laufband');
      const spur = element('div', 'laufband__spur');
      const text = `${this.einstellungen.laufband}   ·   `;
      spur.append(mono(text), mono(text));
      band.append(spur);
      flaeche.append(band);
    }

    // Der Auslöser fürs Handy: nur zeigen, wenn die Box ihn auch anbietet.
    if (this.fernQr) {
      const fern = element('div', 'fern');
      const bild = document.createElement('img');
      bild.src = this.fernQr;
      bild.alt = 'QR-Code zum Auslöser im Netz der Box';
      fern.append(bild, mono('Auslöser aufs Handy'));
      flaeche.append(fern);
    }

    // Tippen irgendwo startet ebenfalls — der Screen ist das Bedienelement.
    flaeche.addEventListener('click', (e) => {
      if (e.target === flaeche) this.geheZu('auswahl');
    });

    return flaeche;
  }

  private auswahlspalte(): HTMLElement {
    const spalte = element('div', 'spalte');

    const titel = document.createElement('h2');
    titel.textContent = 'Wie möchtest du?';

    const raster = element('div', 'arten');
    ARTEN.filter((a) => this.einstellungen.arten.includes(a.id)).forEach((a) => {
      const kachel = element('button', 'art');
      if (a.id === this.art.id) kachel.classList.add('gewaehlt');

      const name = element('span', 'art__name');
      name.textContent = a.name;

      const zeilen = element('span', 'art__zeilen');
      a.zeilen.forEach((z) => zeilen.append(mono(z)));

      kachel.append(name, zeilen);
      kachel.addEventListener('click', () => {
        this.art = a;
        this.zeichne();
        this.setzeLeerlauf();
      });
      raster.append(kachel);
    });

    const los = element('button', 'knopf knopf--amber knopf--gross knopf--breit');
    los.textContent = "Los geht's";
    los.addEventListener('click', () => void this.starteSerie());

    const zurueck = element('button', 'knopf knopf--rahmen knopf--breit');
    zurueck.textContent = 'Abbrechen';
    zurueck.addEventListener('click', () => this.zumAttract());

    spalte.append(titel, raster, los, zurueck);
    return spalte;
  }

  private countdownfeld(): HTMLElement {
    const feld = element('div', 'countdown');
    feld.dataset.feld = 'countdown';
    return feld;
  }

  private ergebnisfeld(): HTMLElement {
    const feld = element('div', 'bild');

    if (this.art.bewegt && this.aufnahmen.length > 1 && !this.rechnet) {
      // Bewegtbild: die Serie läuft als Schleife, vor und zurück.
      const bild = document.createElement('img');
      bild.className = 'ergebnis';
      bild.alt = '';
      feld.append(bild);
      this.spieleSerie(bild);
    } else if (this.ergebnis) {
      const bild = document.createElement('img');
      bild.className = 'ergebnis';
      bild.src = alsBilddaten(this.ergebnis);
      bild.alt = '';
      feld.append(bild);
    }

    return feld;
  }

  private spieleSerie(ziel: HTMLImageElement): void {
    this.stoppeAnimation();
    const reihenfolge = this.gezeigteAufnahmen.length ? this.gezeigteAufnahmen : this.aufnahmen;
    const bilder = reihenfolge.map((a) => a.toDataURL('image/jpeg', 0.85));
    const reihe = [...bilder, ...bilder.slice(1, -1).reverse()];
    let i = 0;
    ziel.src = reihe[0] ?? '';
    this.animation = window.setInterval(() => {
      i = (i + 1) % reihe.length;
      ziel.src = reihe[i] ?? '';
    }, 140);
  }

  private ergebnisspalte(): HTMLElement {
    const spalte = element('div', 'spalte');

    const titel = document.createElement('h2');
    titel.textContent = 'Gefällt dir das?';

    const zaehler = mono(`Auto-Weiter in ${this.einstellungen.autoWeiter} s`);
    zaehler.dataset.feld = 'weiter';

    const behalten = element('button', 'knopf knopf--amber knopf--gross knopf--breit');
    behalten.textContent = 'Behalten';
    behalten.addEventListener('click', () => this.geheZuAusgabe());

    const nochmal = element('button', 'knopf knopf--rahmen knopf--breit');
    nochmal.textContent = 'Nochmal';
    nochmal.addEventListener('click', () => void this.starteSerie());

    spalte.append(titel, zaehler);
    const stile = this.stilreihe();
    if (stile) spalte.append(stile);
    spalte.append(behalten, nochmal);

    /* Auto-Weiter: die Box darf nicht am Ergebnis hängen bleiben. Solange
       ein Stil gerechnet wird, läuft die Uhr nicht — sonst stünde der Gast
       schon in der Ausgabe, wenn sein Bild fertig ist. */
    this.stoppeWeiter();
    if (this.rechnet) return spalte;
    let rest = this.einstellungen.autoWeiter;
    const tick = () => {
      rest -= 1;
      if (rest <= 0) {
        this.geheZuAusgabe();
        return;
      }
      const feld = this.wurzel.querySelector('[data-feld="weiter"]');
      if (feld) feld.textContent = `Auto-Weiter in ${rest} s`;
      this.weiterUhr = window.setTimeout(tick, 1000);
    };
    this.weiterUhr = window.setTimeout(tick, 1000);

    return spalte;
  }

  /**
   * Die Stilwahl unter dem Ergebnis.
   *
   * Sie erscheint nur, wenn der Betreiber mehr als nichts freigegeben hat —
   * eine Reihe mit einem einzigen Knopf „Ohne" ist keine Wahl. Und sie
   * erscheint nicht beim Bewegtbild-Rechnen, weil dort jede Änderung eine
   * ganze Serie neu rechnet.
   */
  private stilreihe(): HTMLElement | null {
    const frei = EFFEKTE.filter(
      (e) => e.id === 'ohne' || this.einstellungen.effekte.includes(e.id)
    );
    if (frei.length < 2) return null;

    const reihe = element('div', 'stile');
    reihe.dataset.feld = 'stile';

    frei.forEach((e) => {
      const knopf = element('button', 'stil');
      knopf.dataset.stil = e.id;
      if (e.id === this.effekt) knopf.classList.add('gewaehlt');
      if (this.rechnet) knopf.setAttribute('disabled', 'true');

      const name = element('span', 'stil__name');
      name.textContent = e.name;
      knopf.append(name, mono(this.rechnet && e.id === this.effekt ? 'wird gerechnet …' : e.zeile));

      knopf.addEventListener('click', () => {
        void this.waehleEffekt(e.id);
        this.setzeLeerlauf();
      });
      reihe.append(knopf);
    });

    return reihe;
  }

  private ausgabespalte(): HTMLElement {
    const spalte = element('div', 'spalte');

    const titel = document.createElement('h2');
    titel.textContent = 'Wohin damit?';

    const wege = element('div', 'wege');

    if (this.einstellungen.druck) {
      const erlaubt = darfDrucken(this.einstellungen.druckLimitStunde);
      wege.append(
        this.weg(
          'Drucken',
          erlaubt
            ? this.einstellungen.drucker || 'Systemdruck'
            : 'Stundenlimit erreicht',
          erlaubt,
          () => void this.druckeErgebnis()
        )
      );
    }

    wege.append(this.weg('Sichern', 'Datei auf das Gerät', true, () => void this.sichereDatei()));

    if (this.art.bewegt) {
      const da = this.bewegtbild !== null;
      wege.append(
        this.weg('GIF sichern', da ? 'Animiert, für das Handy' : 'wird noch gerechnet …', da, () =>
          this.sichereBewegtbild()
        )
      );
    }

    wege.append(
      this.weg('QR-Code', 'Ohne Internet', true, () => void this.zeigeQr()),
      this.weg('Galerie', 'Alle Event-Fotos', false, () => undefined)
    );

    const fertig = element('button', 'knopf knopf--amber knopf--gross knopf--breit');
    fertig.textContent = 'Fertig';
    fertig.addEventListener('click', () => this.zumAttract());

    const runde = element('button', 'knopf knopf--rahmen knopf--breit');
    runde.textContent = 'Noch eine Runde';
    runde.addEventListener('click', () => this.geheZu('auswahl'));

    spalte.append(titel, wege, fertig, runde);
    return spalte;
  }

  private weg(name: string, zeile: string, aktiv: boolean, tue: () => void): HTMLElement {
    const knopf = element('button', aktiv && name === 'Drucken' ? 'weg weg--haupt' : 'weg');
    if (!aktiv) knopf.setAttribute('disabled', 'true');

    const titel = element('span', 'weg__name');
    titel.textContent = name;
    knopf.append(titel, mono(zeile));
    knopf.addEventListener('click', () => {
      if (!aktiv) return;
      tue();
      this.setzeLeerlauf();
    });
    return knopf;
  }

  // --- Aufnahme ---------------------------------------------------------

  private async starteSerie(): Promise<void> {
    if (!this.kamera.laeuft) {
      this.zeigeKamerafehler('Ohne Kamera keine Aufnahme. Verbindung prüfen.');
      return;
    }

    this.stoppeWeiter();
    this.stoppeAnimation();
    this.aufnahmen = [];
    this.gezeigteAufnahmen = [];
    this.effekt = 'ohne';
    this.geheZu('aufnahme');

    // Wie viele Bilder gebraucht werden, entscheidet die Vorlage — nicht die
    // Aufnahmeart. Ein Streifen mit vier Bildfeldern will vier Aufnahmen;
    // bisher kamen immer drei, und das vierte Feld bekam eine Wiederholung.
    const anzahl = this.bilderJeSerie();

    for (let i = 0; i < anzahl; i++) {
      await this.countdown(i);
      this.blitze();
      this.aufnahmen.push(this.kamera.standbild(this.einstellungen.spiegeln));

      if (i < anzahl - 1 && this.art.pause > 0) {
        await warte(this.art.pause * 1000);
      }
      // Ein Abbruch (Escape, Leerlauf) beendet die Serie.
      if (this.schritt !== 'aufnahme') return;
    }

    await this.baueErgebnis();
    this.geheZu('ergebnis');
  }

  /**
   * Anzahl Aufnahmen einer Serie. Bewegtbild bringt seine eigene Zahl mit
   * (die Bewegung braucht viele Bilder); beim Streifen zählt die Vorlage.
   */
  private bilderJeSerie(): number {
    if (this.art.bewegt) return this.art.bilder;
    if (this.art.id !== 'streifen') return this.art.bilder;
    const vorlage = findeVorlage(eingestellt().streifen, 'streifen');
    const felder = bildfelder(vorlage);
    // Doppelstreifen-Vorlagen zeigen dieselbe Serie zweimal: dann ist die
    // halbe Feldzahl die Serie. Sonst so viele Aufnahmen wie Felder.
    const gewuenscht = vorlage.aufnahmen > 0 ? vorlage.aufnahmen : felder;
    return Math.max(1, Math.min(8, gewuenscht));
  }

  private countdown(index: number): Promise<void> {
    return new Promise((fertig) => {
      const feld = this.wurzel.querySelector<HTMLElement>('[data-feld="countdown"]');
      if (!feld) return fertig();

      const gesamt = this.einstellungen.countdown;
      let rest = gesamt;

      const zeichneSchritt = () => {
        feld.replaceChildren();

        const oben = element('div', 'zustand');
        oben.append(
          mono(`Aufnahme ${index + 1} von ${this.bilderJeSerie()}`, 'mono mono--amber')
        );
        feld.append(oben);

        if (this.einstellungen.countdownstil === 'ring') {
          const ring = element('span', 'ring');
          const zahl = element('span', 'ring__zahl');
          zahl.textContent = String(rest);
          ring.append(zahl);
          feld.append(ring);
        } else if (this.einstellungen.countdownstil === 'zahl') {
          const zahl = element('span', 'zahl-gross');
          zahl.textContent = String(rest);
          feld.append(zahl);
        } else {
          const balken = element('span', 'balken');
          const fuellung = document.createElement('span');
          fuellung.style.width = `${((gesamt - rest) / gesamt) * 100}%`;
          balken.append(fuellung);
          feld.append(balken);
        }

        const regie = element('span', 'regie');
        regie.textContent = REGIE[index % REGIE.length]!;
        feld.append(regie);

        const abbruch = element('button', 'knopf knopf--rahmen');
        abbruch.textContent = 'Abbrechen';
        abbruch.addEventListener('click', () => this.zumAttract());
        feld.append(abbruch);
      };

      zeichneSchritt();

      const tick = () => {
        rest -= 1;
        if (this.schritt !== 'aufnahme') return fertig();
        if (rest <= 0) {
          feld.replaceChildren();
          return fertig();
        }
        zeichneSchritt();
        window.setTimeout(tick, 1000);
      };

      window.setTimeout(tick, 1000);
    });
  }

  private blitze(): void {
    if (!this.einstellungen.blitz) return;
    const blitz = this.wurzel.querySelector<HTMLElement>('[data-feld="blitz"]');
    if (!blitz) return;
    blitz.classList.remove('aus');
    void blitz.offsetWidth; // Neustart der Animation erzwingen
    blitz.classList.add('aus');
  }

  /**
   * Die Aufnahmen, wie sie ins Blatt kommen: erst freigestellt, dann im
   * gewählten Stil.
   *
   * Die Reihenfolge ist nicht beliebig. Wer zuerst stilisiert, verschiebt
   * das Grün des Tuchs — Sepia macht daraus ein Braun, und danach findet
   * die Freistellung nichts mehr, wonach sie suchen könnte.
   *
   * Der Stil greift auf die Aufnahme, nicht auf das fertige Blatt: Rahmen,
   * Logo und Eventname bleiben in ihren Farben. Ein sepiafarbenes
   * Firmenlogo wäre kein Effekt, sondern ein Fehler.
   */
  private bearbeiteAufnahmen(): HTMLCanvasElement[] {
    const gs = this.einstellungen.greenscreen;
    // Ohne Hintergrundbild wird nicht freigestellt: Ein durchsichtiges Bild
    // im Blatt sieht aus wie ein Fehler, nicht wie ein Effekt.
    const frei =
      gs.an && this.hintergrundbild
        ? this.aufnahmen.map((a) =>
            stelleFrei(a, this.hintergrundbild, {
              an: true,
              farbe: gs.farbe,
              toleranz: gs.toleranz,
            })
          )
        : this.aufnahmen;

    return this.effekt === 'ohne' ? frei : frei.map((a) => wende(a, this.effekt));
  }

  /**
   * Wählt einen Kunststil und rechnet das Blatt neu.
   *
   * Neu gerechnet heißt auch: neu abgelegt. Die Datei auf der Box ist das,
   * was Galerie, Wand und QR-Code zeigen — sie muss dasselbe zeigen wie der
   * Screen. Erst das neue Blatt sichern, dann das alte löschen: Andersherum
   * wäre die Aufnahme zwischen den beiden Schritten weg.
   */
  private async waehleEffekt(id: Effektkennung): Promise<void> {
    if (this.rechnet || id === this.effekt || this.aufnahmen.length === 0) return;

    this.effekt = id;
    this.rechnet = true;
    // Während gerechnet wird, springt der Booth nicht weiter — der Gast
    // hat gerade etwas gewählt und würde die Antwort verpassen.
    this.stoppeWeiter();
    this.zeichne();

    try {
      await this.baueErgebnis(true);
    } finally {
      this.rechnet = false;
      this.zeichne();
    }
  }

  /**
   * Setzt die Aufnahmen ins Druckbild und sichert sie sofort.
   *
   * `ersatz` heißt: Es gab schon ein Blatt dieser Runde, und das neue tritt
   * an seine Stelle. Dann wird die Runde nicht noch einmal gezählt, und die
   * alte Datei verschwindet von der Box.
   */
  private async baueErgebnis(ersatz = false): Promise<void> {
    const werte = werteJetzt(
      this.einstellungen.event,
      this.einstellungen.box,
      this.sitzungen + 1
    );

    const quellen = this.bearbeiteAufnahmen();
    this.gezeigteAufnahmen = quellen;

    if (this.art.id === 'streifen') {
      const vorlage = findeVorlage(eingestellt().streifen, 'streifen');
      const streifen = await zeichneMitVorlage(vorlage, quellen, werte);
      // Doppeln gilt nur für das schmale 2×6-Blatt: Zwei davon passen auf ein
      // 4×6, das der Cutter mittig trennt. Eine Vorlage, die schon auf 4×6
      // gestaltet ist, würde beim Doppeln auf halbe Größe zusammenfallen —
      // viele Katalogblätter zeigen die Serie ohnehin bereits zweimal.
      const darfDoppeln = vorlage.format === 'streifen-2x6';
      this.ergebnis =
        this.einstellungen.doppelstreifen && darfDoppeln
          ? alsDoppelstreifen(streifen, this.einstellungen.schnittlinie)
          : streifen;
    } else {
      // Bewegtbild: als Blatt gesichert wird das erste Bild der Serie.
      const vorlage = findeVorlage(eingestellt().foto, 'foto');
      this.ergebnis = await zeichneMitVorlage(vorlage, [quellen[0]!], werte);
    }

    /* Beim Stilwechsel tritt das neue Blatt an die Stelle des alten — unter
       demselben Namen. Das ist wichtiger, als es aussieht: Der QR-Code, den
       der Gast vielleicht schon abfotografiert hat, zeigt auf diesen Namen,
       und die Wand am Beamer hängt schon daran. Ein neuer Name hieße: sieben
       Blätter für eine Aufnahme und ein toter QR-Code. */
    const altesBlatt = ersatz ? this.ergebnisKennung : '';
    const altesBewegtbild = ersatz ? this.bewegtbild?.id ?? '' : '';
    this.ergebnisKennung = '';
    this.bewegtbild = null;

    try {
      // Die Box vergibt den Namen — sie legt die Datei an, und ab da ist der
      // Name die Kennung für QR-Code, Wand und Galerie.
      const abgelegt = await sichere(alsBilddaten(this.ergebnis), this.art.id, altesBlatt);
      this.ergebnisKennung = abgelegt.id;
      if (!ersatz) void this.zaehleAuf();
      /* Gesichter für den Foto-Finder — hier und nicht später: Das Blatt liegt
         gerade im Speicher, und ein Nachtragen über die halbe Ablage kostet
         den Betreiber am Abend Minuten.
         Nur wenn der Finder eingeschaltet ist: Ohne das rechnete die Box
         biometrische Merkmale von Gästen, die niemand danach gefragt hat.
         Und nur nebenher — der Gast wartet nicht darauf. */
      if (this.einstellungen.finder.an && this.ergebnis) {
        const blatt = this.ergebnis;
        const name = abgelegt.id;
        void import('./gesichter')
          .then((g) => g.merkeGesichter(name, blatt))
          .catch(() => undefined);
      }
      // Das Bewegtbild kommt danach: Es dauert länger, und der Gast soll sein
      // Bild sehen, ohne darauf zu warten.
      if (this.art.bewegt) void this.baueBewegtbild(quellen.slice(), altesBewegtbild);
    } catch {
      // Sichern fehlgeschlagen: die Aufnahme bleibt trotzdem am Screen,
      // damit der Gast sein Bild bekommt.
      this.zeigeMeldung(
        'Nicht gesichert',
        'Die Aufnahme konnte nicht abgelegt werden. Sie lässt sich trotzdem drucken und sichern.'
      );
    }
  }

  /**
   * Kodiert die Serie als GIF und legt sie zur Aufnahme dazu. Läuft nach dem
   * Sichern des Blattes; schlägt es fehl, bleibt das Blatt unberührt.
   */
  private async baueBewegtbild(rahmen: HTMLCanvasElement[], ersetzt = ''): Promise<void> {
    const gehoert = this.ergebnisKennung;
    try {
      const bewegt = await alsGif(rahmen, {
        breite: 480,
        verzoegerungMs: Math.max(80, this.art.pause * 1000),
        pingpong: true,
      });

      // Das GIF ist eine eigene Aufnahme auf der Box, kein Anhängsel des
      // Blattes: So sieht es die Galerie, die Wand und jedes Handy im WLAN —
      // und der QR-Code kann direkt darauf zeigen.
      const abgelegt = await sichere(await alsDatenadresse(bewegt.blob), this.art.id, ersetzt);

      if (this.ergebnisKennung === gehoert) {
        this.bewegtbild = abgelegt;
        // Nur nachzeichnen, wenn der Gast noch bei seiner Aufnahme steht.
        if (this.schritt === 'ergebnis' || this.schritt === 'ausgabe') this.zeichne();
      }
    } catch {
      // Ohne Bewegtbild bleibt das Blatt — der Gast bekommt sein Bild.
    }
  }

  /**
   * Lädt das Hintergrundbild für die Freistellung. Schlägt es fehl, wird
   * nicht freigestellt — ein durchsichtiger Gast ist schlimmer als ein Tuch
   * im Bild.
   */
  private async ladeHintergrund(): Promise<void> {
    const quelle = this.einstellungen.greenscreen.hintergrund;
    if (!quelle) {
      this.hintergrundbild = null;
      return;
    }
    if (this.hintergrundbild?.src === quelle) return;

    try {
      this.hintergrundbild = await new Promise<HTMLImageElement>((fertig, schiefgegangen) => {
        const bild = new Image();
        bild.addEventListener('load', () => fertig(bild), { once: true });
        bild.addEventListener('error', () => schiefgegangen(new Error('Hintergrund')), {
          once: true,
        });
        bild.src = quelle;
      });
    } catch {
      this.hintergrundbild = null;
    }
  }

  private geheZuAusgabe(): void {
    this.stoppeWeiter();
    this.geheZu('ausgabe');
  }

  /**
   * Druckt das Ergebnis. Geht es schief, erfährt der Gast es — ein Knopf, der
   * nichts tut, ist auf einer Feier schlimmer als eine Absage.
   */
  private async druckeErgebnis(): Promise<void> {
    if (!this.ergebnis) return;
    const ergebnis = await drucke(
      alsBilddaten(this.ergebnis),
      this.einstellungen.event,
      this.einstellungen.drucker
    );
    if ('fehler' in ergebnis) {
      this.zeigeMeldung(
        'Druck ging nicht',
        `Der Drucker „${this.einstellungen.drucker}" meldet: ${ergebnis.fehler} — ` +
          'Das Bild ist gesichert und lässt sich über „Sichern" oder den QR-Code mitnehmen.'
      );
    }
    this.zeichne();
  }

  private async sichereDatei(): Promise<void> {
    if (!this.ergebnis) return;
    const blob = await alsBlob(this.ergebnis);
    sichereAlsDatei(blob, dateiname(this.art.id, this.ergebnisKennung));
  }

  /** Holt eine Datei von der Box und gibt sie dem Gerät zum Sichern. */
  private async hole(url: string, name: string): Promise<void> {
    const antwort = await fetch(url);
    sichereAlsDatei(await antwort.blob(), name);
  }

  private sichereBewegtbild(): void {
    if (!this.bewegtbild) return;
    void this.hole(this.bewegtbild.url, this.bewegtbild.id);
  }

  // --- Überlagerungen ---------------------------------------------------

  private async zeigeQr(): Promise<void> {
    // Bei Boomerang und GIF will der Gast die Bewegung, nicht das Standbild.
    const datei = (this.art.bewegt && this.bewegtbild?.id) || this.ergebnisKennung;
    const adresse = await qrFuer(this.einstellungen.ausgabeBasis, datei);

    if (!adresse) {
      this.zeigeMeldung(
        'QR noch nicht eingerichtet',
        'Der QR-Code zeigt auf die Adresse, unter der die Box ihre Dateien im lokalen Netz anbietet. ' +
          'Diese Adresse steht in den Einstellungen unter „Ausgabe-Adresse" — solange sie fehlt, ' +
          'bleibt der direkte Weg über „Sichern".'
      );
      return;
    }

    const tafel = this.tafel('Bild aufs Handy');
    const feld = element('div', 'qrfeld');
    const bild = document.createElement('img');
    bild.src = adresse;
    bild.alt = 'QR-Code zum Herunterladen der Aufnahme';
    feld.append(bild);

    tafel.inhalt.append(
      feld,
      absatz('Mit der Kamera scannen — das Bild kommt über das WLAN der Box, ganz ohne Internet.')
    );
  }

  private zeigeKamerafehler(text: string): void {
    this.zeigeMeldung('Kamera', text);
  }

  private zeigeMeldung(titel: string, text: string): void {
    const tafel = this.tafel(titel);
    tafel.inhalt.append(absatz(text));
  }

  private tafel(titelText: string): { decke: HTMLElement; inhalt: HTMLElement } {
    const decke = element('div', 'decke');
    const tafel = element('div', 'tafel');

    const titel = document.createElement('h2');
    titel.textContent = titelText;

    const schliessen = element('button', 'knopf knopf--rahmen knopf--breit');
    schliessen.textContent = 'Schließen';
    schliessen.addEventListener('click', () => decke.remove());

    tafel.append(titel);
    decke.append(tafel);
    document.body.append(decke);

    // Der Schließen-Knopf bleibt unten, egal was dazwischen kommt.
    queueMicrotask(() => tafel.append(schliessen));

    return { decke, inhalt: tafel };
  }

  // --- Einstellungen ----------------------------------------------------

  private fragePin(): void {
    const tafel = this.tafel('Einstellungen');

    const zeile = element('div', 'feldzeile');
    const feld = document.createElement('input');
    feld.className = 'eingabe';
    feld.type = 'password';
    feld.inputMode = 'numeric';
    feld.placeholder = 'Kiosk-PIN';
    feld.setAttribute('aria-label', 'Kiosk-PIN');

    const weiter = element('button', 'knopf knopf--amber');
    weiter.textContent = 'Öffnen';

    const meldung = element('span', 'hinweiszeile');

    /* Geprüft wird auf der Box, nicht hier: Sie kennt nur die gesalzene
       Prüfsumme und legt nach einem Fehlversuch eine Zwangspause ein. Eine
       vierstellige Zahl im Browser zu vergleichen hieße, sie im Quelltext
       jeder Oberfläche mitzuliefern. */
    let laeuft = false;
    const pruefe = async () => {
      if (laeuft) return;
      laeuft = true;
      weiter.setAttribute('disabled', 'disabled');
      meldung.textContent = 'Prüfe …';
      const antwort = await pinStimmt(feld.value);
      laeuft = false;
      weiter.removeAttribute('disabled');
      if (antwort.ok) {
        tafel.decke.remove();
        this.zeigeEinstellungen();
        return;
      }
      meldung.textContent = antwort.grund ?? 'PIN stimmt nicht.';
      feld.value = '';
      feld.focus();
    };

    weiter.addEventListener('click', () => void pruefe());
    feld.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void pruefe();
    });

    zeile.append(feld, weiter);
    tafel.inhalt.append(absatz('Der Booth ist gesperrt. PIN eingeben, um an die Einstellungen zu kommen.'), zeile, meldung);
    queueMicrotask(() => feld.focus());
  }

  private zeigeEinstellungen(): void {
    const tafel = this.tafel('Einstellungen');
    const e = this.einstellungen;

    const felder: HTMLElement[] = [];

    const text = (marke: string, wert: string, setze: (v: string) => void) => {
      const zeile = element('label', 'feldzeile');
      const beschriftung = mono(marke);
      const eingabe = document.createElement('input');
      eingabe.className = 'eingabe';
      eingabe.value = wert;
      eingabe.addEventListener('input', () => setze(eingabe.value));
      zeile.append(beschriftung, eingabe);
      felder.push(zeile);
    };

    const zahl = (marke: string, wert: number, setze: (v: number) => void) => {
      const zeile = element('label', 'feldzeile');
      const eingabe = document.createElement('input');
      eingabe.className = 'eingabe';
      eingabe.type = 'number';
      eingabe.value = String(wert);
      eingabe.addEventListener('input', () => setze(Number(eingabe.value)));
      zeile.append(mono(marke), eingabe);
      felder.push(zeile);
    };

    const schalter = (marke: string, an: boolean, setze: (v: boolean) => void) => {
      const knopf = element('button', an ? 'chip an' : 'chip');
      knopf.textContent = marke;
      knopf.addEventListener('click', () => {
        const neu = !knopf.classList.contains('an');
        knopf.classList.toggle('an', neu);
        setze(neu);
      });
      return knopf;
    };

    text('Event', e.event, (v) => (e.event = v));
    text('Attract-Titel', e.attractTitel, (v) => (e.attractTitel = v));
    text('Laufband', e.laufband, (v) => (e.laufband = v));
    text('Ausgabe-Adresse', e.ausgabeBasis, (v) => (e.ausgabeBasis = v));
    zahl('Countdown (s)', e.countdown, (v) => (e.countdown = Math.max(1, v)));
    zahl('Leerlauf (s)', e.leerlauf, (v) => (e.leerlauf = Math.max(10, v)));
    zahl('Löschfrist (Tage)', e.loeschfristTage, (v) => (e.loeschfristTage = Math.max(1, v)));
    zahl('Drucke je Stunde', e.druckLimitStunde, (v) => (e.druckLimitStunde = Math.max(0, v)));

    const stile = element('div', 'chips');
    (['ring', 'zahl', 'balken'] as const).forEach((stil) => {
      const knopf = element('button', e.countdownstil === stil ? 'chip an' : 'chip');
      knopf.textContent = stil;
      knopf.addEventListener('click', () => {
        e.countdownstil = stil;
        stile.querySelectorAll('.chip').forEach((c) => c.classList.remove('an'));
        knopf.classList.add('an');
      });
      stile.append(knopf);
    });

    const attractstile = element('div', 'chips');
    (['ruhe', 'puls', 'laufband'] as const).forEach((stil) => {
      const knopf = element('button', e.attractstil === stil ? 'chip an' : 'chip');
      knopf.textContent = stil;
      knopf.addEventListener('click', () => {
        e.attractstil = stil;
        attractstile.querySelectorAll('.chip').forEach((c) => c.classList.remove('an'));
        knopf.classList.add('an');
      });
      attractstile.append(knopf);
    });

    /* Diashow: Tempo, Bewegung, Rhythmus der Zwischenbilder. */
    zahl('Diashow: Sekunden je Bild', e.diashow.dauer, (v) => {
      e.diashow.dauer = Math.min(30, Math.max(3, v));
    });
    zahl('Diashow: Tafel nach je … Bildern', e.diashow.jedesTafel, (v) => {
      e.diashow.jedesTafel = Math.min(20, Math.max(0, v));
    });

    /* Die Zwischenbilder selbst. Drei Sätze reichen für das, was zwischen
       den Fotos stehen soll: Menü, Danksagung, nächster Programmpunkt.
       Bearbeitet wird an der Box, weil dort auch der Beamer hängt. */
    const tafeln = element('div', 'tafeln');
    const zeichneTafeln = () => {
      tafeln.replaceChildren();

      e.tafeln.forEach((t, i) => {
        const zeile = element('div', 'tafelzeile');

        if (t.art === 'bild') {
          const vorschau = document.createElement('img');
          vorschau.className = 'tafelzeile__bild';
          vorschau.src = t.bild || '';
          vorschau.alt = '';
          zeile.append(vorschau);
        }

        const oben = document.createElement('input');
        oben.className = 'eingabe';
        oben.value = (t.art === 'bild' ? t.unterzeile : t.titel) || '';
        oben.placeholder = t.art === 'bild' ? 'Unterzeile' : 'Titel';
        oben.addEventListener('input', () => {
          if (t.art === 'bild') t.unterzeile = oben.value;
          else t.titel = oben.value;
        });
        zeile.append(oben);

        if (t.art === 'text') {
          const unten = document.createElement('input');
          unten.className = 'eingabe';
          unten.value = t.zeile || '';
          unten.placeholder = 'Zeile darunter';
          unten.addEventListener('input', () => (t.zeile = unten.value));
          zeile.append(unten);
        }

        const dauer = document.createElement('input');
        dauer.className = 'eingabe eingabe--kurz';
        dauer.type = 'number';
        dauer.value = String(t.sekunden);
        dauer.title = 'Sekunden';
        dauer.addEventListener('input', () => {
          t.sekunden = Math.min(60, Math.max(2, Number(dauer.value) || 6));
        });
        zeile.append(dauer);

        const weg = element('button', 'chip');
        weg.textContent = 'Entfernen';
        weg.addEventListener('click', () => {
          e.tafeln.splice(i, 1);
          zeichneTafeln();
        });
        zeile.append(weg);

        tafeln.append(zeile);
      });

      const neueTafel = element('button', 'chip');
      neueTafel.textContent = 'Tafel mit Text';
      neueTafel.addEventListener('click', () => {
        e.tafeln = [
          ...e.tafeln,
          { id: `tafel-${e.tafeln.length}-${Date.now().toString(36)}`, art: 'text', sekunden: 6, titel: '', zeile: '' },
        ];
        zeichneTafeln();
      });

      const neuesBild = element('label', 'chip') as HTMLLabelElement;
      neuesBild.textContent = 'Tafel mit Bild';
      const bildwahl = document.createElement('input');
      bildwahl.type = 'file';
      bildwahl.accept = 'image/*';
      bildwahl.hidden = true;
      bildwahl.addEventListener('change', async () => {
        const gewaehlt = bildwahl.files?.[0];
        if (!gewaehlt) return;
        try {
          const bild = await alsHintergrund(gewaehlt);
          e.tafeln = [
            ...e.tafeln,
            { id: `tafel-${e.tafeln.length}-${Date.now().toString(36)}`, art: 'bild', sekunden: 6, bild, unterzeile: '' },
          ];
          zeichneTafeln();
        } catch {
          neuesBild.textContent = 'Bild ging nicht';
        }
      });
      neuesBild.append(bildwahl);

      const knoepfe = element('div', 'chips');
      knoepfe.append(neueTafel, neuesBild);
      tafeln.append(knoepfe);
    };
    zeichneTafeln();

    /* Freistellung vor dem Tuch. Der Hintergrund kommt aus einer Datei am
       Gerät — nicht aus dem Netz: Eine Box in einer Scheune hat keins, und
       das Bild soll auch nach dem Abbau noch da sein. */
    const freistellung = element('div', 'chips');
    freistellung.append(
      schalter('Freistellung', e.greenscreen.an, (v) => (e.greenscreen.an = v))
    );

    const hintergrundwahl = element('label', 'chip') as HTMLLabelElement;
    hintergrundwahl.textContent = e.greenscreen.hintergrund
      ? 'Hintergrund wechseln'
      : 'Hintergrund wählen';
    const datei = document.createElement('input');
    datei.type = 'file';
    datei.accept = 'image/*';
    datei.hidden = true;
    datei.addEventListener('change', async () => {
      const gewaehlt = datei.files?.[0];
      if (!gewaehlt) return;
      try {
        e.greenscreen.hintergrund = await alsHintergrund(gewaehlt);
        hintergrundwahl.textContent = 'Hintergrund gewählt';
      } catch {
        hintergrundwahl.textContent = 'Bild ging nicht';
      }
    });
    hintergrundwahl.append(datei);
    freistellung.append(hintergrundwahl);

    if (e.greenscreen.hintergrund) {
      const weg = element('button', 'chip');
      weg.textContent = 'Hintergrund entfernen';
      weg.addEventListener('click', () => {
        e.greenscreen.hintergrund = null;
        hintergrundwahl.textContent = 'Hintergrund wählen';
        weg.remove();
      });
      freistellung.append(weg);
    }

    /* Welche Kunststile am Ergebnis zur Wahl stehen. Der Betreiber entscheidet
       das je Event: Eine Firmenfeier will oft nur Schwarzweiss, eine Trauung
       gar keinen. Wird alles abgewaehlt, verschwindet die Reihe am Screen —
       eine Wahl mit einem einzigen Eintrag ist keine. */
    const kunststile = element('div', 'chips');
    EFFEKTE.filter((k) => k.id !== 'ohne').forEach((k) => {
      const knopf = schalter(k.name, e.effekte.includes(k.id), (an) => {
        e.effekte = an
          ? [...e.effekte, k.id]
          : e.effekte.filter((vorhanden) => vorhanden !== k.id);
      });
      kunststile.append(knopf);
    });

    const schalterreihe = element('div', 'chips');
    schalterreihe.append(
      schalter('Übergänge', e.uebergang, (v) => (e.uebergang = v)),
      schalter('Spiegeln', e.spiegeln, (v) => (e.spiegeln = v)),
      schalter('Blitz', e.blitz, (v) => (e.blitz = v)),
      schalter('Drucken', e.druck, (v) => (e.druck = v)),
      schalter('Doppelstreifen', e.doppelstreifen, (v) => (e.doppelstreifen = v)),
      schalter('Schnittlinie', e.schnittlinie, (v) => (e.schnittlinie = v))
    );

    const sichern = element('button', 'knopf knopf--amber knopf--breit');
    sichern.textContent = 'Sichern und schließen';
    sichern.addEventListener('click', () => {
      void sichereEinstellungen(e);
      // Die Freistellung geht ihren eigenen Weg — siehe `sichereGreenscreen`.
      void sichereGreenscreen(e.greenscreen).then(() => this.ladeHintergrund());
      // Die Zwischenbilder ebenso — sie tragen Bilder, siehe `sichereTafeln`.
      void sichereTafeln(e.tafeln);
      this.einstellungen = e;
      tafel.decke.remove();
      this.zeichne();
    });

    const zuruecksetzen = element('button', 'knopf knopf--rahmen knopf--breit');
    zuruecksetzen.textContent = 'Auf Standard zurücksetzen';
    zuruecksetzen.addEventListener('click', () => {
      this.einstellungen = standardEinstellungen();
      sichereEinstellungen(this.einstellungen);
      tafel.decke.remove();
      this.zeichne();
    });

    // Im Kiosk ist dies der einzige Weg zu den anderen Oberflächen der Box.
    const wege = element('div', 'chips');
    (
      [
        ['Cockpit', './cockpit.html'],
        ['Editor', './editor.html'],
        ['Portal', './portal.html'],
        ['Galerie', './galerie.html'],
        ['Foto-Wall', './wand.html'],
        ['Diashow', './diashow.html'],
        ['Einwegkamera', './film.html'],
        ['Gesprochene Grüße', './stimme.html'],
        ['Zeitlupe', './zeitlupe.html'],
        ['Foto-Finder', './finder.html'],
        ['Einrichtung', './einrichtung.html'],
      ] as const
    ).forEach(([name, ziel]) => {
      const glied = element('a', 'chip') as HTMLAnchorElement;
      glied.href = ziel;
      glied.textContent = name;
      wege.append(glied);
    });

    tafel.inhalt.append(
      mono(`Box ${e.box} · Kiosk ${e.kioskGesetzt ? 'mit PIN gesperrt' : 'offen'}`),
      mono('Oberflächen'),
      wege,
      ...felder,
      mono('Countdown-Stil'),
      stile,
      mono('Attract-Stil'),
      attractstile,
      mono('Kunststile am Ergebnis'),
      kunststile,
      mono('Freistellung'),
      freistellung,
      mono('Diashow: Zwischenbilder'),
      tafeln,
      mono('Schalter'),
      schalterreihe,
      sichern,
      zuruecksetzen
    );
  }
}

/**
 * Unter welcher Adresse die Box im Netz erreichbar ist. Sie weiß es selbst —
 * der QR-Code am Screen muss auf sie zeigen, nicht auf `localhost`, sonst
 * öffnet das Handy des Gastes seine eigene Maschine.
 */
async function boxAdresse(): Promise<string> {
  try {
    const antwort = await fetch('/api/info');
    if (!antwort.ok) return '';
    const info = (await antwort.json()) as { base?: string };
    return info.base ?? '';
  } catch {
    return '';
  }
}

/**
 * Bereitet ein gewähltes Bild als Greenscreen-Hintergrund auf.
 *
 * Verkleinert wird nicht aus Ordnungsliebe: Die Einstellungen der Box gehen
 * als eine JSON-Datei über die Leitung, und ein Foto vom Handy bringt
 * zwölf Megabyte mit. Hinter der Aufnahme steht es ohnehin nur in deren
 * Auflösung — mehr als 1920 Punkte Breite sieht niemand.
 */
async function alsHintergrund(datei: File): Promise<string> {
  const bild = await new Promise<HTMLImageElement>((fertig, schiefgegangen) => {
    const b = new Image();
    b.addEventListener('load', () => fertig(b), { once: true });
    b.addEventListener('error', () => schiefgegangen(new Error('Bild')), { once: true });
    b.src = URL.createObjectURL(datei);
  });

  const faktor = Math.min(1, 1920 / Math.max(1, bild.naturalWidth));
  const flaeche = document.createElement('canvas');
  flaeche.width = Math.round(bild.naturalWidth * faktor);
  flaeche.height = Math.round(bild.naturalHeight * faktor);
  const stift = flaeche.getContext('2d');
  if (!stift) throw new Error('Zeichenfläche nicht verfügbar');
  stift.drawImage(bild, 0, 0, flaeche.width, flaeche.height);
  URL.revokeObjectURL(bild.src);

  // JPEG, nicht PNG: Ein Hintergrund braucht keine Transparenz, und PNG
  // wäre bei einem Foto um ein Vielfaches größer.
  return flaeche.toDataURL('image/jpeg', 0.86);
}

/** Blob als Datenadresse — so nimmt die Box sie über die Schnittstelle an. */
function alsDatenadresse(blob: Blob): Promise<string> {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onload = () => fertig(String(leser.result));
    leser.onerror = () => fehler(new Error('Bild nicht lesbar'));
    leser.readAsDataURL(blob);
  });
}

// --- kleine Helfer ------------------------------------------------------

function element(tag: string, klasse: string): HTMLElement {
  const el = document.createElement(tag);
  el.className = klasse;
  return el;
}

function mono(text: string, klasse = 'mono'): HTMLElement {
  const el = element('span', klasse);
  el.textContent = text;
  return el;
}

function absatz(text: string): HTMLElement {
  const el = document.createElement('p');
  el.textContent = text;
  return el;
}

function warte(ms: number): Promise<void> {
  return new Promise((fertig) => window.setTimeout(fertig, ms));
}
