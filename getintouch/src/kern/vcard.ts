/**
 * vCard — der Teil, der aus einer Webseite einen Eintrag im Adressbuch macht.
 *
 * Version 3.0, nicht 4.0: 3.0 versteht jedes iPhone, jedes Android und Outlook
 * seit Jahren. 4.0 ist die sauberere Norm und wird auf genau den Geräten nicht
 * zuverlässig gelesen, auf denen die Karte am häufigsten landet.
 *
 * Drei Kleinigkeiten, an denen vCards in der Praxis scheitern und die hier
 * deshalb ausdrücklich gelöst sind:
 *
 *  1. **Zeilenenden.** RFC 2426 verlangt CRLF. Mit LF allein zeigt Outlook eine
 *     leere Karte an.
 *  2. **Maskierung.** Komma, Semikolon und Backslash trennen in einer vCard
 *     Felder. Eine Firma namens „Meier, Schulze & Co." zerlegt eine unmaskierte
 *     Karte in drei Felder.
 *  3. **Zeilenlänge.** Über 75 Oktett muss umbrochen werden. Der Umbruch darf
 *     kein Mehrbyte-Zeichen zerschneiden, sonst steht „Müller" als „M?ller" im
 *     Adressbuch.
 */

import type { Visitenkarte } from './profil.ts';
import { normalisiereNummer } from './ziele.ts';

const CRLF = '\r\n';
const MAX_OKTETT = 75;

/** Maskiert einen Textwert nach RFC 2426, Abschnitt 2.4.2. */
function maskiere(wert: string): string {
  return String(wert ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

const oktette = new TextEncoder();

/**
 * Faltet eine Zeile auf höchstens 75 Oktett. Umbrochen wird an Zeichengrenzen,
 * die Folgezeile beginnt mit einem Leerzeichen.
 */
function falte(zeile: string): string {
  if (oktette.encode(zeile).length <= MAX_OKTETT) return zeile;

  const stuecke: string[] = [];
  let aktuell = '';
  let laenge = 0;
  // Grenze für Folgezeilen ist um das führende Leerzeichen kleiner.
  let grenze = MAX_OKTETT;

  for (const zeichen of zeile) {
    const breite = oktette.encode(zeichen).length;
    if (laenge + breite > grenze) {
      stuecke.push(aktuell);
      aktuell = '';
      laenge = 0;
      grenze = MAX_OKTETT - 1;
    }
    aktuell += zeichen;
    laenge += breite;
  }
  if (aktuell) stuecke.push(aktuell);

  return stuecke.join(`${CRLF} `);
}

interface Zeile {
  name: string;
  /** Bereits maskierter Wert — Maskierung passiert beim Aufrufer, weil
   *  strukturierte Felder wie ADR ihre Bestandteile einzeln maskieren müssen. */
  wert: string;
  /** Fertige Parameter, z. B. `TYPE=WORK,VOICE`. */
  parameter?: string;
}

function baueZeile({ name, wert, parameter }: Zeile): string {
  const kopf = parameter ? `${name};${parameter}` : name;
  return falte(`${kopf}:${wert}`);
}

/**
 * Ein Datenbild wird zu PHOTO. Erwartet wird eine Datenadresse
 * (`data:image/jpeg;base64,…`); alles andere wird ausgelassen, denn ein
 * verlinktes Bild lädt beim Öffnen der Karte nach und verrät dabei, wann und
 * wo jemand den Kontakt anschaut.
 */
function fotoZeile(bild: string | undefined): string | null {
  if (!bild) return null;
  const treffer = /^data:image\/(jpeg|jpg|png|gif|webp);base64,([A-Za-z0-9+/=]+)$/i.exec(bild.trim());
  if (!treffer) return null;
  const typ = treffer[1]!.toUpperCase() === 'JPG' ? 'JPEG' : treffer[1]!.toUpperCase();
  return baueZeile({ name: 'PHOTO', parameter: `ENCODING=b;TYPE=${typ}`, wert: treffer[2]! });
}

export interface VcardOptionen {
  /** Bild als Datenadresse. Wird eingebettet, damit die Karte offline vollständig ist. */
  bild?: string;
  /** Adresse der Profilseite. Landet als zusätzliche URL in der Karte. */
  seite?: string;
  /** Zeitstempel für REV. Wird übergeben, damit die Ausgabe prüfbar bleibt. */
  stand?: Date;
}

/**
 * Baut eine vCard 3.0 aus einer Visitenkarte.
 *
 * Die Ausgabe endet mit CRLF und ist damit fertig zum Ausliefern als
 * `text/vcard`.
 */
export function baueVcard(karte: Visitenkarte, optionen: VcardOptionen = {}): string {
  const zeilen: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];

  const nachname = maskiere(karte.nachname ?? '');
  const vorname = maskiere(karte.vorname ?? '');
  // N: Nachname;Vorname;Weitere;Anrede;Namenszusatz
  zeilen.push(falte(`N:${nachname};${vorname};;;`));

  const anzeigename = [karte.vorname, karte.nachname].filter(Boolean).join(' ').trim();
  zeilen.push(baueZeile({ name: 'FN', wert: maskiere(anzeigename || karte.firma || '') }));

  if (karte.firma) zeilen.push(falte(`ORG:${maskiere(karte.firma)}`));
  if (karte.funktion) zeilen.push(baueZeile({ name: 'TITLE', wert: maskiere(karte.funktion) }));

  if (karte.telefon) {
    zeilen.push(baueZeile({ name: 'TEL', parameter: 'TYPE=WORK,VOICE', wert: normalisiereNummer(karte.telefon) }));
  }
  if (karte.mobil) {
    zeilen.push(baueZeile({ name: 'TEL', parameter: 'TYPE=CELL,VOICE', wert: normalisiereNummer(karte.mobil) }));
  }
  if (karte.mail) {
    zeilen.push(baueZeile({ name: 'EMAIL', parameter: 'TYPE=INTERNET,WORK', wert: maskiere(karte.mail) }));
  }
  if (karte.web) zeilen.push(baueZeile({ name: 'URL', wert: maskiere(karte.web) }));
  if (optionen.seite && optionen.seite !== karte.web) {
    zeilen.push(baueZeile({ name: 'URL', wert: maskiere(optionen.seite) }));
  }

  if (karte.strasse || karte.plz || karte.ort || karte.land) {
    // ADR: Postfach;Zusatz;Straße;Ort;Region;PLZ;Land
    const teile = [
      '',
      '',
      maskiere(karte.strasse ?? ''),
      maskiere(karte.ort ?? ''),
      '',
      maskiere(karte.plz ?? ''),
      maskiere(karte.land ?? ''),
    ];
    zeilen.push(falte(`ADR;TYPE=WORK:${teile.join(';')}`));
  }

  if (karte.notiz) zeilen.push(baueZeile({ name: 'NOTE', wert: maskiere(karte.notiz) }));

  const foto = fotoZeile(optionen.bild);
  if (foto) zeilen.push(foto);

  if (optionen.stand) {
    zeilen.push(`REV:${optionen.stand.toISOString().replace(/\.\d{3}Z$/, 'Z')}`);
  }

  zeilen.push('END:VCARD');
  return zeilen.join(CRLF) + CRLF;
}

/** Dateiname für den Download. Ohne Umlaute und Leerzeichen, damit er überall ankommt. */
export function vcardDateiname(karte: Visitenkarte): string {
  const roh = [karte.vorname, karte.nachname].filter(Boolean).join('-') || karte.firma || 'kontakt';
  const name = roh
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${name || 'kontakt'}.vcf`;
}
