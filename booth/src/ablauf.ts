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
import { ladeEinstellungen, sichereEinstellungen, standardEinstellungen } from './einstellungen';
import {
  alsBilddaten,
  alsBlob,
  alsDoppelstreifen,
  zeichneFoto,
  zeichneStreifen,
} from './layout';
import { darfDrucken, dateiname, drucke, druckeInLetzterStunde, qrFuer, sichereAlsDatei } from './ausgabe';
import { neueKennung, raeumeAuf, sichere, anzahl as gesamtzahl } from './speicher';
import { ausgabeAdresse, legeAb } from './huelle';

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
  private ergebnisKennung = '';
  private sitzungen = 0;

  private leerlaufUhr: number | null = null;
  private weiterUhr: number | null = null;
  private animation: number | null = null;

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
    this.zeichne();

    try {
      await this.kamera.starte();
      this.zeichne();
    } catch (fehler) {
      const gedeutet = deuteFehler(fehler);
      this.zeigeKamerafehler(gedeutet.text);
    }

    // Abgelaufene Aufnahmen räumt die Box beim Start weg.
    void raeumeAuf(this.einstellungen.loeschfristTage).catch(() => undefined);
    void this.zaehleAuf();

    // Läuft der Booth in der Desktop-Hülle, kennt sie die Adresse, unter der
    // die Box ihre Dateien anbietet — der QR-Code braucht dann keine
    // Konfiguration von Hand.
    void ausgabeAdresse().then((adresse) => {
      if (adresse && !this.einstellungen.ausgabeBasis) {
        this.einstellungen.ausgabeBasis = adresse;
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
    this.ergebnis = null;
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
    const buehne = element('div', 'buehne');

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

    const start = element('button', 'knopf knopf--amber knopf--gross');
    start.textContent = 'Jetzt starten';
    start.addEventListener('click', () => this.geheZu('auswahl'));

    flaeche.append(
      mono(this.einstellungen.event, 'mono mono--amber'),
      titel,
      start,
      absatz(this.einstellungen.attractZeile)
    );

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

    if (this.art.bewegt && this.aufnahmen.length > 1) {
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
    const bilder = this.aufnahmen.map((a) => a.toDataURL('image/jpeg', 0.85));
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

    spalte.append(titel, zaehler, behalten, nochmal);

    // Auto-Weiter: die Box darf nicht am Ergebnis hängen bleiben.
    this.stoppeWeiter();
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

  private ausgabespalte(): HTMLElement {
    const spalte = element('div', 'spalte');

    const titel = document.createElement('h2');
    titel.textContent = 'Wohin damit?';

    const wege = element('div', 'wege');

    if (this.einstellungen.druck) {
      const erlaubt = darfDrucken(this.einstellungen.druckLimitStunde);
      wege.append(
        this.weg('Drucken', erlaubt ? 'Systemdruck' : 'Stundenlimit erreicht', erlaubt, () => {
          if (this.ergebnis) drucke(alsBilddaten(this.ergebnis), this.einstellungen.event);
          this.zeichne();
        })
      );
    }

    wege.append(
      this.weg('Sichern', 'Datei auf das Gerät', true, () => void this.sichereDatei()),
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
    this.geheZu('aufnahme');

    for (let i = 0; i < this.art.bilder; i++) {
      await this.countdown(i);
      this.blitze();
      this.aufnahmen.push(this.kamera.standbild(this.einstellungen.spiegeln));

      if (i < this.art.bilder - 1 && this.art.pause > 0) {
        await warte(this.art.pause * 1000);
      }
      // Ein Abbruch (Escape, Leerlauf) beendet die Serie.
      if (this.schritt !== 'aufnahme') return;
    }

    await this.baueErgebnis();
    this.geheZu('ergebnis');
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
          mono(`Aufnahme ${index + 1} von ${this.art.bilder}`, 'mono mono--amber')
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

  /** Setzt die Aufnahmen ins Druckbild und sichert sie sofort. */
  private async baueErgebnis(): Promise<void> {
    const texte = {
      titel: this.einstellungen.event,
      zeile: new Date().toLocaleDateString('de-DE'),
    };

    if (this.art.id === 'streifen') {
      const streifen = zeichneStreifen(this.aufnahmen, texte);
      this.ergebnis = this.einstellungen.doppelstreifen
        ? alsDoppelstreifen(streifen, this.einstellungen.schnittlinie)
        : streifen;
    } else if (this.aufnahmen.length > 1) {
      // Bewegtbild: als Blatt gesichert wird das erste Bild der Serie.
      this.ergebnis = zeichneFoto(this.aufnahmen[0]!, texte);
    } else {
      this.ergebnis = zeichneFoto(this.aufnahmen[0]!, texte);
    }

    this.ergebnisKennung = neueKennung();

    try {
      const blob = await alsBlob(this.ergebnis);
      await sichere({
        id: this.ergebnisKennung,
        zeit: Date.now(),
        art: this.art.id,
        event: this.einstellungen.event,
        blob,
      });
      // In der Desktop-Hülle zusätzlich als Datei — nur so kann der
      // Auslieferungsdienst sie über den QR-Code herausgeben.
      void legeAb(this.ergebnisKennung, blob);
      void this.zaehleAuf();
    } catch {
      // Sichern fehlgeschlagen: die Aufnahme bleibt trotzdem am Screen,
      // damit der Gast sein Bild bekommt.
      this.zeigeMeldung(
        'Nicht gesichert',
        'Die Aufnahme konnte nicht abgelegt werden. Sie lässt sich trotzdem drucken und sichern.'
      );
    }
  }

  private geheZuAusgabe(): void {
    this.stoppeWeiter();
    this.geheZu('ausgabe');
  }

  private async sichereDatei(): Promise<void> {
    if (!this.ergebnis) return;
    const blob = await alsBlob(this.ergebnis);
    sichereAlsDatei(blob, dateiname(this.art.id, this.ergebnisKennung));
  }

  // --- Überlagerungen ---------------------------------------------------

  private async zeigeQr(): Promise<void> {
    const adresse = await qrFuer(this.einstellungen.ausgabeBasis, this.ergebnisKennung);

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

    const pruefe = () => {
      if (feld.value === this.einstellungen.kioskPin) {
        tafel.decke.remove();
        this.zeigeEinstellungen();
      } else {
        meldung.textContent = 'PIN stimmt nicht.';
        feld.value = '';
        feld.focus();
      }
    };

    weiter.addEventListener('click', pruefe);
    feld.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') pruefe();
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

    const schalterreihe = element('div', 'chips');
    schalterreihe.append(
      schalter('Spiegeln', e.spiegeln, (v) => (e.spiegeln = v)),
      schalter('Blitz', e.blitz, (v) => (e.blitz = v)),
      schalter('Drucken', e.druck, (v) => (e.druck = v)),
      schalter('Doppelstreifen', e.doppelstreifen, (v) => (e.doppelstreifen = v)),
      schalter('Schnittlinie', e.schnittlinie, (v) => (e.schnittlinie = v))
    );

    const sichern = element('button', 'knopf knopf--amber knopf--breit');
    sichern.textContent = 'Sichern und schließen';
    sichern.addEventListener('click', () => {
      sichereEinstellungen(e);
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

    tafel.inhalt.append(
      mono(`Box ${e.box} · Kiosk-PIN ${e.kioskPin}`),
      ...felder,
      mono('Countdown-Stil'),
      stile,
      mono('Schalter'),
      schalterreihe,
      sichern,
      zuruecksetzen
    );
  }
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
