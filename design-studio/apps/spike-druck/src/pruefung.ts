/**
 * Prüfung des erzeugten PDF.
 *
 * ## Was hier nicht geht, und warum das gesagt gehört
 *
 * Der ursprüngliche Plan war, gegen **veraPDF** zu prüfen. Das war ein Irrtum:
 * veraPDF validiert **PDF/A und PDF/UA, aber kein PDF/X** — die eingebauten
 * Profile enden bei `4e` und `ua2`. Für PDF/X gibt es im offenen Bereich keinen
 * gleichwertigen Prüfer; die Referenzwerkzeuge (callas pdfToolbox, Enfocus
 * PitStop, Acrobat Pro) sind kommerziell.
 *
 * Daraus folgt zweierlei:
 *
 * 1. Diese Datei prüft die Anforderungen aus ISO 15930-7 **selbst**, auf der
 *    Objektebene des PDF. Das ist keine Zertifizierung, aber es fängt jeden
 *    Fehler, den man beim Erzeugen machen kann.
 * 2. Vor dem ersten echten Auftrag muss ein Preflight-Werkzeug oder die
 *    Druckerei gegenlesen. Das ist ein einmaliger Schritt, kein Dauerzustand —
 *    aber er darf nicht ausfallen.
 *
 * veraPDF bleibt trotzdem nützlich: es liest die Datei vollständig und meckert
 * bei struktureller Unsauberkeit. Deshalb ist es als Gegenprobe eingebaut,
 * ausdrücklich nicht als PDF/X-Urteil.
 */

import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { promisify } from 'node:util';
import { inflateSync } from 'node:zlib';

const ausfuehren = promisify(execFile);

const VERAPDF_ORTE = [
  process.env['VERAPDF_PFAD'],
  '/opt/verapdf/verapdf',
  '/usr/local/bin/verapdf',
];

export function findeVeraPdf(): string | null {
  return VERAPDF_ORTE.find((p) => typeof p === 'string' && p !== '' && existsSync(p)) ?? null;
}

export interface VeraErgebnis {
  /** Ob veraPDF die Datei überhaupt lesen und prüfen konnte. */
  gelesen: boolean;
  profil: string;
  /** Anzahl beanstandeter Regeln. Bei PDF/A-Regeln erwartbar, siehe Kopf. */
  beanstandungen: number;
}

/**
 * Gegenprobe: liest veraPDF die Datei sauber? Das Profil ist bewusst PDF/A-4 —
 * nicht weil das Dokument PDF/A sein soll, sondern weil das der strengste
 * verfügbare Leser ist. Ein Absturz hier bedeutet eine kaputte Datei.
 */
export async function leseGegenprobe(pdfPfad: string): Promise<VeraErgebnis> {
  const verapdf = findeVeraPdf();
  if (verapdf === null) throw new Error('veraPDF nicht gefunden (VERAPDF_PFAD setzen)');

  let ausgabe = '';
  try {
    const ergebnis = await ausfuehren(verapdf, ['--format', 'json', '--flavour', '4', pdfPfad], {
      maxBuffer: 64 * 1024 * 1024,
    });
    ausgabe = ergebnis.stdout;
  } catch (fehler) {
    const mitAusgabe = fehler as { stdout?: string };
    if (typeof mitAusgabe.stdout !== 'string' || mitAusgabe.stdout === '') throw fehler;
    ausgabe = mitAusgabe.stdout;
  }

  const daten = JSON.parse(ausgabe) as {
    report?: {
      jobs?: {
        taskResult?: { isExecuted?: boolean };
        validationResult?: {
          profileName?: string;
          details?: { ruleSummaries?: { status?: string }[] };
        }[];
      }[];
    };
  };

  const ergebnis = daten.report?.jobs?.[0]?.validationResult?.[0];
  const beanstandungen = (ergebnis?.details?.ruleSummaries ?? []).filter(
    (r) => r.status === 'failed',
  ).length;

  return {
    gelesen: ergebnis !== undefined,
    profil: ergebnis?.profileName ?? '',
    beanstandungen,
  };
}

export type Schwere = 'fehler' | 'hinweis';

export interface Befund {
  regel: string;
  meldung: string;
  schwere: Schwere;
}

export interface Erwartung {
  /** Erwartete TrimBox in Punkt: [x0, y0, x1, y1]. */
  trimBox?: [number, number, number, number];
  bleedBox?: [number, number, number, number];
  toleranz?: number;
  /** Erwartet wird ein CMYK-Ausgabefarbraum. */
  cmyk?: boolean;
}

/**
 * Entpackt alle FlateDecode-Ströme und hängt sie an den Klartext an, damit
 * Farboperatoren sichtbar werden. Ohne das prüft man nur die Wörterbücher und
 * übersieht genau die Stelle, an der Farben stehen.
 */
export function lesbarerInhalt(pdf: Uint8Array): string {
  const roh = new TextDecoder('latin1').decode(pdf);
  const teile: string[] = [roh];

  const muster = /stream\r?\n/g;
  let treffer = muster.exec(roh);
  while (treffer !== null) {
    const start = treffer.index + treffer[0].length;
    const ende = roh.indexOf('endstream', start);
    if (ende > start) {
      try {
        teile.push(new TextDecoder('latin1').decode(inflateSync(pdf.subarray(start, ende))));
      } catch {
        // Kein zlib-Strom (Bilddaten, Schriftdateien) — überspringen.
      }
    }
    treffer = muster.exec(roh);
  }

  return teile.join('\n');
}

/** Ein PDF-Rechteck: [x0, y0, x1, y1] in Punkt. */
type Kasten = readonly [number, number, number, number];

function kastenAus(text: string, name: string): Kasten | null {
  const treffer = new RegExp(`/${name}\\s*\\[([^\\]]+)\\]`).exec(text);
  const inhalt = treffer?.[1];
  if (inhalt === undefined) return null;

  const werte = inhalt.trim().split(/\s+/).map(Number);
  if (werte.length !== 4 || !werte.every((w) => Number.isFinite(w))) return null;
  const [x0, y0, x1, y1] = werte as [number, number, number, number];
  return [x0, y0, x1, y1];
}

function enthaelt(aussen: Kasten, innen: Kasten, toleranz: number): boolean {
  return (
    innen[0] >= aussen[0] - toleranz &&
    innen[1] >= aussen[1] - toleranz &&
    innen[2] <= aussen[2] + toleranz &&
    innen[3] <= aussen[3] + toleranz
  );
}

/**
 * Prüft die Anforderungen aus ISO 15930-7 (PDF/X-4), soweit sie sich am
 * erzeugten Dokument feststellen lassen.
 */
export function pruefePdfX(pdf: Uint8Array, erwartung: Erwartung = {}): Befund[] {
  const text = lesbarerInhalt(pdf);
  const kopf = new TextDecoder('latin1').decode(pdf.subarray(0, 16));
  const befunde: Befund[] = [];
  const toleranz = erwartung.toleranz ?? 0.5;
  const melde = (regel: string, meldung: string, schwere: Schwere = 'fehler'): void => {
    befunde.push({ regel, meldung, schwere });
  };

  // --- Kopf und Fassung -----------------------------------------------------
  const fassung = /^%PDF-(\d)\.(\d)/.exec(kopf);
  if (fassung === null) {
    melde('kopf', 'Datei beginnt nicht mit einem PDF-Kopf');
  } else {
    const zahl = Number(fassung[1]) + Number(fassung[2]) / 10;
    if (zahl < 1.6) melde('fassung', `PDF/X-4 verlangt mindestens PDF 1.6, gefunden ${zahl}`);
  }

  // --- Verschlüsselung ------------------------------------------------------
  if (/\/Encrypt\b/.test(text)) {
    melde('verschluesselung', 'PDF/X verbietet Verschlüsselung');
  }

  // --- OutputIntent ---------------------------------------------------------
  const absichten = text.match(/\/GTS_PDFX\b/g) ?? [];
  if (absichten.length === 0) {
    melde('outputintent', 'kein OutputIntent mit /S /GTS_PDFX');
  } else if (absichten.length > 1) {
    melde(
      'outputintent',
      `PDF/X erlaubt genau einen GTS_PDFX-OutputIntent, gefunden ${absichten.length}`,
    );
  }
  if (!/\/OutputIntents\b/.test(text)) {
    melde('outputintent', '/OutputIntents fehlt im Katalog');
  }
  if (!/\/OutputConditionIdentifier\b/.test(text)) {
    melde('outputintent', '/OutputConditionIdentifier fehlt');
  }
  if (!/\/DestOutputProfile\b/.test(text)) {
    melde(
      'outputintent',
      'kein eingebettetes ICC-Profil (/DestOutputProfile). Zulässig nur, wenn die ' +
        'Druckbedingung registriert ist und die Druckerei sie akzeptiert — vorher klären.',
      'hinweis',
    );
  }

  // --- XMP ------------------------------------------------------------------
  if (!/pdfxid:GTS_PDFXVersion/.test(text)) {
    melde('xmp', 'XMP ohne pdfxid:GTS_PDFXVersion — PDF/X-4 verlangt die Kennzeichnung dort');
  }
  if (!/PDF\/X-4/.test(text)) {
    melde('xmp', 'die Fassungsangabe "PDF/X-4" steht nicht im XMP');
  }

  // --- Kästen ---------------------------------------------------------------
  const media = kastenAus(text, 'MediaBox');
  const trim = kastenAus(text, 'TrimBox');
  const bleed = kastenAus(text, 'BleedBox');

  if (trim === null)
    melde('kaesten', '/TrimBox fehlt — die Druckerei weiß nicht, wo geschnitten wird');
  if (bleed === null) melde('kaesten', '/BleedBox fehlt', 'hinweis');
  if (media === null) melde('kaesten', '/MediaBox fehlt');

  if (trim !== null && bleed !== null && !enthaelt(bleed, trim, toleranz)) {
    melde('kaesten', `TrimBox [${trim.join(' ')}] liegt nicht in BleedBox [${bleed.join(' ')}]`);
  }
  if (bleed !== null && media !== null && !enthaelt(media, bleed, toleranz)) {
    melde('kaesten', `BleedBox [${bleed.join(' ')}] liegt nicht in MediaBox [${media.join(' ')}]`);
  }

  for (const [name, ist, soll] of [
    ['TrimBox', trim, erwartung.trimBox],
    ['BleedBox', bleed, erwartung.bleedBox],
  ] as const) {
    if (soll === undefined || ist === null) continue;
    if (ist.some((w, i) => Math.abs(w - (soll[i] ?? Number.NaN)) > toleranz)) {
      melde('kaesten', `/${name} ist [${ist.join(' ')}], erwartet [${soll.join(' ')}]`);
    }
  }

  // --- Farbe ----------------------------------------------------------------
  if (erwartung.cmyk !== false) {
    const cmykOperatoren =
      text.match(/(^|[\s\n])[\d.]+ [\d.]+ [\d.]+ [\d.]+ (k|K)([\s\n]|$)/g) ?? [];
    const rgbOperatoren = text.match(/(^|[\s\n])[\d.]+ [\d.]+ [\d.]+ (rg|RG)([\s\n]|$)/g) ?? [];
    const grauOperatoren = text.match(/(^|[\s\n])[\d.]+ (g|G)([\s\n]|$)/g) ?? [];

    if (cmykOperatoren.length === 0) {
      melde('farbraum', 'kein einziger CMYK-Farboperator gefunden');
    }
    if (rgbOperatoren.length > 0) {
      melde(
        'farbraum',
        `${rgbOperatoren.length} RGB-Farboperatoren bei CMYK-Ausgabefarbraum — die Druckerei müsste raten`,
      );
    }
    if (grauOperatoren.length > 0) {
      melde('farbraum', `${grauOperatoren.length} DeviceGray-Operatoren gefunden`, 'hinweis');
    }
  }

  // --- Schriften ------------------------------------------------------------
  const schriftverweise = text.match(/\/FontFile\d?\b/g) ?? [];
  const schriftarten = text.match(/\/Type\s*\/Font\b/g) ?? [];
  if (schriftarten.length > 0 && schriftverweise.length === 0) {
    melde(
      'schrift',
      'Schriften vorhanden, aber keine eingebettet — PDF/X verbietet Ersatzschriften',
    );
  }

  return befunde;
}

export function nurFehler(befunde: readonly Befund[]): Befund[] {
  return befunde.filter((b) => b.schwere === 'fehler');
}
