/**
 * Ausgabewege: sichern, drucken, QR.
 *
 * Gedruckt wird über das Betriebssystem — „was das Betriebssystem kennt,
 * kennt die Box". In der Desktop-Hülle mit gewähltem Drucker geht das ohne
 * Dialog und randlos zentriert; im Browser bleibt der Druckdialog.
 */

import QRCode from 'qrcode';
import { druckeInHuelle } from './huelle';

/** Merkt sich Druckzeitpunkte, um das Stundenlimit zu prüfen. */
const druckzeiten: number[] = [];

export function druckeInLetzterStunde(): number {
  const grenze = Date.now() - 60 * 60 * 1000;
  while (druckzeiten.length > 0 && druckzeiten[0]! < grenze) druckzeiten.shift();
  return druckzeiten.length;
}

export function darfDrucken(limitProStunde: number): boolean {
  if (limitProStunde <= 0) return true;
  return druckeInLetzterStunde() < limitProStunde;
}

/** Bild als Datei sichern — der direkte Weg, wenn kein Netz im Spiel ist. */
export function sichereAlsDatei(blob: Blob, dateiname: string): void {
  const adresse = URL.createObjectURL(blob);
  const verweis = document.createElement('a');
  verweis.href = adresse;
  verweis.download = dateiname;
  document.body.appendChild(verweis);
  verweis.click();
  verweis.remove();
  // Erst freigeben, wenn der Browser die Datei übernommen hat.
  setTimeout(() => URL.revokeObjectURL(adresse), 10_000);
}

/**
 * Drucken. Zwei Wege, und der bessere gewinnt:
 *
 *  1. In der Desktop-Hülle mit gewähltem Drucker: Die Box druckt selbst,
 *     randlos zentriert, ohne Dialog. Auf einer Feier steht niemand am
 *     Rechner, der ein Fenster wegklickt.
 *  2. Sonst der Systemdruckdialog über ein eigenes Fenster.
 *
 * Gezählt wird in beiden Fällen — die Stundengrenze schützt das Papier,
 * unabhängig davon, welcher Weg gegangen wurde.
 */
export async function drucke(
  bilddaten: string,
  beschriftung: string,
  drucker = ''
): Promise<{ weg: 'huelle' | 'dialog' } | { fehler: string }> {
  if (drucker) {
    const blob = await datenAlsBlob(bilddaten);
    const ergebnis = await druckeInHuelle(blob, drucker);
    if (ergebnis && 'gedruckt' in ergebnis) {
      druckzeiten.push(Date.now());
      return { weg: 'huelle' };
    }
    if (ergebnis && 'fehler' in ergebnis) return ergebnis;
    // Keine Hülle: weiter mit dem Dialog.
  }
  druckeUeberDialog(bilddaten, beschriftung);
  return { weg: 'dialog' };
}

async function datenAlsBlob(bilddaten: string): Promise<Blob> {
  const antwort = await fetch(bilddaten);
  return antwort.blob();
}

/**
 * Druck über den Systemdialog: Das Bild wird in ein eigenes Fenster gelegt,
 * auf Seitengröße gesetzt und gedruckt. Ohne Ränder, damit der Abzug stimmt.
 */
export function druckeUeberDialog(bilddaten: string, beschriftung: string): void {
  druckzeiten.push(Date.now());

  const rahmen = document.createElement('iframe');
  rahmen.setAttribute('aria-hidden', 'true');
  rahmen.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(rahmen);

  const dokument = rahmen.contentDocument;
  if (!dokument) return;

  dokument.open();
  dokument.write(`<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>${beschriftung}</title>
<style>
  @page { size: 10cm 15cm; margin: 0 }
  html, body { margin: 0; height: 100% }
  img { width: 100%; height: 100%; object-fit: contain; display: block }
</style></head><body><img src="${bilddaten}" alt=""></body></html>`);
  dokument.close();

  const bild = dokument.querySelector('img');
  const los = () => {
    rahmen.contentWindow?.focus();
    rahmen.contentWindow?.print();
    // Der Rahmen darf erst weg, wenn der Dialog ihn nicht mehr braucht.
    setTimeout(() => rahmen.remove(), 60_000);
  };

  if (bild?.complete) los();
  else bild?.addEventListener('load', los, { once: true });
}

/**
 * QR-Code auf die Adresse, unter der die Box die Datei im lokalen Netz
 * anbietet. Ohne konfigurierte Basis-Adresse gibt es keinen sinnvollen QR —
 * dann bleibt der direkte Download.
 */
export async function qrFuer(basis: string, datei: string): Promise<string | null> {
  const sauber = basis.trim().replace(/\/$/, '');
  if (!sauber) return null;

  // Die Box liefert ihre Aufnahmen unter `/photos/` aus. Der Dateiname trägt
  // schon die Endung — bei Boomerang und GIF zeigt der Code auf die Bewegung.
  return qrBild(`${sauber}/photos/${encodeURIComponent(datei)}`);
}

/** QR-Code auf eine beliebige Adresse — erzeugt im Gerät, ohne Netz. */
export function qrBild(adresse: string): Promise<string> {
  return QRCode.toDataURL(adresse, {
    margin: 1,
    width: 600,
    color: { dark: '#0b0b0d', light: '#ffffff' },
  });
}

export function dateiname(art: string, kennung: string, endung: 'jpg' | 'gif' = 'jpg'): string {
  const jetzt = new Date();
  const zwei = (n: number) => String(n).padStart(2, '0');
  const datum = `${jetzt.getFullYear()}${zwei(jetzt.getMonth() + 1)}${zwei(jetzt.getDate())}`;
  const zeit = `${zwei(jetzt.getHours())}${zwei(jetzt.getMinutes())}`;
  return `youbooth-${datum}-${zeit}-${art}-${kennung}.${endung}`;
}
