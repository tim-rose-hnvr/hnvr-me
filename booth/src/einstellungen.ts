/**
 * Einstellungen der Box. Werden lokal gehalten und überleben einen Neustart.
 * Ein Event überschreibt Branding und Texte; die Box selbst behält Technik.
 */

export type Countdownstil = 'ring' | 'zahl' | 'balken';

export type Einstellungen = {
  /** Anzeigename der Box, steht in der Kopfleiste. */
  box: string;
  event: string;
  attractTitel: string;
  attractZeile: string;
  laufband: string;
  /** Sekunden bis zur Aufnahme. */
  countdown: number;
  countdownstil: Countdownstil;
  /** Sekunden Leerlauf, bis der Booth zum Attract zurückspringt. */
  leerlauf: number;
  /** Sekunden bis „Auto-Weiter" im Ergebnis. */
  autoWeiter: number;
  /** Freigegebene Aufnahmearten. */
  arten: string[];
  spiegeln: boolean;
  blitz: boolean;
  /** Kennung der Vorlage, die für Einzelbilder gedruckt wird. */
  vorlageFoto: string;
  /** Kennung der Vorlage für Streifen. */
  vorlageStreifen: string;
  /** Drucken über den Systemdruckdialog anbieten. */
  druck: boolean;
  doppelstreifen: boolean;
  schnittlinie: boolean;
  /** Höchstzahl Drucke pro Stunde; 0 = ohne Grenze. */
  druckLimitStunde: number;
  loeschfristTage: number;
  kioskPin: string;
  /**
   * Basis-Adresse, unter der die Box ihre Dateien im lokalen Netz anbietet.
   * Der QR-Code zeigt darauf. Solange kein Auslieferungsdienst läuft, bleibt
   * das Feld leer und der QR wird durch den direkten Download ersetzt.
   */
  ausgabeBasis: string;
};

const STANDARD: Einstellungen = {
  box: 'Box #2',
  event: 'Hochzeit Lena & Jonas',
  attractTitel: 'Ein Bild für die Ewigkeit',
  attractZeile: 'Tippen oder per Fernbedienung am Handy auslösen',
  laufband: '3 · 2 · 1 · Cheese · Streifen in 13 Sekunden · Fotos nur für dieses Event',
  countdown: 3,
  countdownstil: 'ring',
  leerlauf: 45,
  autoWeiter: 8,
  arten: ['foto', 'streifen', 'boomerang', 'gif'],
  spiegeln: true,
  blitz: true,
  vorlageFoto: 'foto-klassisch',
  vorlageStreifen: 'streifen-klassisch',
  druck: true,
  doppelstreifen: true,
  schnittlinie: true,
  druckLimitStunde: 40,
  loeschfristTage: 30,
  kioskPin: '4812',
  ausgabeBasis: '',
};

const SCHLUESSEL = 'youbooth.einstellungen';

export function ladeEinstellungen(): Einstellungen {
  try {
    const roh = localStorage.getItem(SCHLUESSEL);
    if (!roh) return { ...STANDARD };
    // Unbekannte Felder aus älteren Ständen werden ignoriert, fehlende ergänzt.
    return { ...STANDARD, ...(JSON.parse(roh) as Partial<Einstellungen>) };
  } catch {
    return { ...STANDARD };
  }
}

export function sichereEinstellungen(e: Einstellungen): void {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(e));
  } catch {
    // Ohne Schreibrecht laeuft die Box weiter, nur ohne Gedaechtnis.
  }
}

export function standardEinstellungen(): Einstellungen {
  return { ...STANDARD };
}
