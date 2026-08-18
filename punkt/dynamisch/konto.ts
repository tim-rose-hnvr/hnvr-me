/**
 * Anmeldung gegen die vorhandenen Konten.
 *
 * Ich hatte angekündigt, die Passwörter ließen sich nicht prüfen, weil
 * der Quelltext der alten Anwendung fehlt. Das war voreilig: das
 * Verfahren steht im Hash selbst.
 *
 *   pbkdf2$210000$<32 Zeichen Salz, hex>$<64 Zeichen Schlüssel, hex>
 *   ────────┬───── ────────┬────────────  ────────┬────────────────
 *      Runden        16 Byte Salz              32 Byte Ergebnis
 *
 * Das ist der übliche, selbstbeschreibende Aufbau. Damit kann jede
 * Umgebung mit Web Crypto die Prüfung nachrechnen — niemand muss sein
 * Passwort neu setzen, und es entsteht kein zweites Verfahren neben dem
 * bestehenden.
 *
 * Offen bleibt allein die Streufunktion. SHA-256 ist bei 32 Byte
 * Ergebnis der Normalfall; SHA-512 wäre möglich. Statt zu raten wird
 * beides gerechnet und beides gleich lang verglichen. Das kostet eine
 * Rechnung mehr und schließt eine Fehlerquelle, die sonst erst der
 * erste Anmeldeversuch eines echten Kontos zeigen würde.
 */

import { kontoAnlegen, kontoNachMail, wixModule, KONTEN } from './ablage.ts';

const RUNDEN_HOECHSTENS = 400_000; // Schutz gegen einen Hash mit absurdem Wert

function hexZuBytes(hex: string): Uint8Array {
  const feld = new Uint8Array(hex.length / 2);
  for (let i = 0; i < feld.length; i++) feld[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return feld;
}

function bytesZuHex(feld: ArrayBuffer): string {
  return [...new Uint8Array(feld)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Vergleich ohne Zeitverrat: immer über die volle Länge. */
function gleich(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let unterschied = 0;
  for (let i = 0; i < a.length; i++) unterschied |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return unterschied === 0;
}

async function pbkdf2(passwort: string, salz: Uint8Array, runden: number, streu: string): Promise<string> {
  const schluessel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passwort),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salz, iterations: runden, hash: streu },
    schluessel,
    256,
  );
  return bytesZuHex(bits);
}

export async function passwortStimmt(passwort: string, gespeichert: string): Promise<boolean> {
  const teile = gespeichert.split('$');
  if (teile.length !== 4 || teile[0] !== 'pbkdf2') return false;
  const runden = Number(teile[1]);
  if (!Number.isInteger(runden) || runden < 1000 || runden > RUNDEN_HOECHSTENS) return false;
  if (!/^[0-9a-f]+$/.test(teile[2]) || !/^[0-9a-f]+$/.test(teile[3])) return false;

  const salz = hexZuBytes(teile[2]);
  for (const streu of ['SHA-256', 'SHA-512']) {
    if (gleich(await pbkdf2(passwort, salz, runden, streu), teile[3])) return true;
  }
  return false;
}

/**
 * Ein neues Passwort wird mit denselben Werten abgelegt wie die
 * vorhandenen — sonst stünden zwei Formate in derselben Spalte.
 */
export async function passwortHashen(passwort: string): Promise<string> {
  const salz = crypto.getRandomValues(new Uint8Array(16));
  const runden = 210_000;
  const hash = await pbkdf2(passwort, salz, runden, 'SHA-256');
  return `pbkdf2$${runden}$${bytesZuHex(salz.buffer)}$${hash}`;
}

// ─── Sitzung ──────────────────────────────────────────────────────────
//
// Der Ausweis ist ein Zettel mit Unterschrift, kein Schlüssel zu einer
// Liste: `kontoId.ablauf.signatur`. Unterschrieben wird mit dem
// `sitzungsSalz` des Kontos, das schon in der Ablage steht. Zwei Dinge
// folgen daraus, beide erwünscht:
//
//   – Es gibt keine Sitzungstabelle, die volllaufen kann.
//   – Wer das Salz austauscht, wirft alle Sitzungen dieses Kontos
//     hinaus. Genau das braucht man, wenn ein Gerät verloren geht.

export const AUSWEIS = 'pnkt_sitzung';
const TAGE = 30;

async function unterschrift(kontoId: string, ablauf: number, salz: string): Promise<string> {
  const schluessel = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(`${salz}:${kontoId}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const zeichen = await crypto.subtle.sign(
    'HMAC',
    schluessel,
    new TextEncoder().encode(`${kontoId}.${ablauf}`),
  );
  return bytesZuHex(zeichen);
}

export async function ausweisBauen(kontoId: string, salz: string): Promise<string> {
  const ablauf = Date.now() + TAGE * 86_400_000;
  return `${kontoId}.${ablauf}.${await unterschrift(kontoId, ablauf, salz)}`;
}

export interface Sitzung {
  kontoId: string;
  name: string;
  mail: string;
}

/** Liest den Ausweis aus dem Kopf und prüft ihn gegen die Ablage. */
export async function sitzungAus(kopf: Headers): Promise<Sitzung | null> {
  const roh = (kopf.get('cookie') ?? '')
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${AUSWEIS}=`));
  if (!roh) return null;

  const [kontoId, ablaufRoh, zeichen] = decodeURIComponent(roh.slice(AUSWEIS.length + 1)).split('.');
  if (!kontoId || !ablaufRoh || !zeichen) return null;
  const ablauf = Number(ablaufRoh);
  if (!Number.isFinite(ablauf) || ablauf < Date.now()) return null;

  const w = await wixModule();
  if (!w) return null;
  let konto: Record<string, unknown>;
  try {
    konto = await w.auth.elevate(w.items.get)(KONTEN, kontoId);
  } catch {
    return null;
  }
  const salz = typeof konto.sitzungsSalz === 'string' ? konto.sitzungsSalz : '';
  if (!salz) return null;
  if (!gleich(await unterschrift(kontoId, ablauf, salz), zeichen)) return null;

  return {
    kontoId,
    name: typeof konto.name === 'string' ? konto.name : '',
    mail: typeof konto.mail === 'string' ? konto.mail : '',
  };
}

/**
 * Meldet an. Gibt bei Erfolg den fertigen Ausweis zurück, sonst null —
 * und zwar für falsche Adresse und falsches Passwort gleich lange und
 * mit derselben Meldung. Wer beides unterscheiden kann, kann Konten
 * abzählen.
 */
export async function anmelden(mail: string, passwort: string): Promise<{ ausweis: string; sitzung: Sitzung } | null> {
  const konto = await kontoNachMail(mail);
  const hash = konto && typeof konto.pwHash === 'string' ? konto.pwHash : '';
  // Auch ohne Konto wird gerechnet, damit die Antwortzeit nichts verrät.
  const probe = hash || `pbkdf2$210000$${'0'.repeat(32)}$${'0'.repeat(64)}`;
  const stimmt = await passwortStimmt(passwort, probe);
  if (!konto || !hash || !stimmt) return null;

  const gesperrtBis = typeof konto.gesperrtBis === 'string' ? Date.parse(konto.gesperrtBis) : 0;
  if (gesperrtBis && gesperrtBis > Date.now()) return null;

  const kontoId = String(konto._id);
  const salz = String(konto.sitzungsSalz ?? '');
  if (!salz) return null;

  return {
    ausweis: await ausweisBauen(kontoId, salz),
    sitzung: {
      kontoId,
      name: typeof konto.name === 'string' ? konto.name : '',
      mail: typeof konto.mail === 'string' ? konto.mail : '',
    },
  };
}

export function ausweisKeks(wert: string, tage = TAGE): string {
  const teile = [
    `${AUSWEIS}=${encodeURIComponent(wert)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${tage * 86_400}`,
  ];
  return teile.join('; ');
}

export function ausweisLoeschen(): string {
  return `${AUSWEIS}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/**
 * Legt ein Konto an und meldet es gleich an.
 *
 * Ohne diese Funktion war das System unvollständig: Codes umhängen
 * konnte nur, wem die Hausverwaltung von Hand ein Konto eingetragen
 * hatte. Solange die Einführungsphase läuft, ist das Konto kostenlos —
 * an dieser Stelle gibt es deshalb keine Zahlungsprüfung.
 *
 * Das Passwort wird nach denselben Werten gestreut wie die vorhandenen
 * Sätze (siehe `passwortHashen`), damit nicht zwei Formate in derselben
 * Spalte stehen.
 */
export async function registrieren(
  mail: string,
  passwort: string,
  name: string,
): Promise<{ ausweis: string; sitzung: Sitzung } | { fehler: string }> {
  const adresse = mail.trim().toLowerCase();
  // Bewusst grob: eine strengere Regel weist mehr gültige Adressen ab
  // als sie ungültige fängt. Ob die Adresse erreichbar ist, sagt ohnehin
  // erst eine Nachricht dorthin.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(adresse)) return { fehler: 'Diese E-Mail-Adresse sieht nicht vollständig aus.' };
  if (passwort.length < 10) return { fehler: 'Das Passwort braucht mindestens zehn Zeichen. Länge hilft hier mehr als Sonderzeichen.' };
  if (passwort.length > 200) return { fehler: 'Höchstens 200 Zeichen.' };

  const pwHash = await passwortHashen(passwort);
  const sitzungsSalz = [...crypto.getRandomValues(new Uint8Array(24))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  let konto: { id: string };
  try {
    konto = await kontoAnlegen({ mail: adresse, pwHash, sitzungsSalz, name: name.trim() });
  } catch (fehler) {
    if ((fehler as Error)?.message === 'mail-vergeben')
      return { fehler: 'Zu dieser Adresse gibt es schon ein Konto. Melde dich damit an.' };
    console.error('[pnkt] Konto nicht anlegbar:', fehler);
    return { fehler: 'Das Anlegen hat nicht geklappt. Bitte gleich noch einmal versuchen.' };
  }

  return {
    ausweis: await ausweisBauen(konto.id, sitzungsSalz),
    sitzung: { kontoId: konto.id, name: name.trim(), mail: adresse },
  };
}
