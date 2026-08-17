/**
 * Ziele — aus einem gepflegten Rohwert wird eine Adresse, die das Gerät versteht.
 *
 * Der Besitzer der Seite trägt „+49 511 12282286" ein, nicht „tel:+4951112282286".
 * Diese Übersetzung passiert hier, an einer Stelle, damit sie überall gleich
 * ausfällt — auf der Seite, im QR-Code und in der Visitenkarte.
 *
 * Zwei Dinge werden hier hart durchgesetzt:
 *
 *  1. Nur bekannte Schemata. `javascript:` und `data:` kämen sonst über ein
 *     gepflegtes Feld direkt in ein `href` — das ist der klassische Weg, wie
 *     aus einem Redaktionssystem eine Sicherheitslücke wird.
 *  2. Telefonnummern werden auf Ziffern und ein führendes Plus reduziert.
 *     Leerzeichen und Klammern in einem `tel:` brechen auf manchen Geräten.
 */

import type { KanalArt, Netzwerk } from './profil.ts';

const ERLAUBTE_SCHEMATA = new Set(['http:', 'https:', 'mailto:', 'tel:', 'sms:']);

/** Zeichen für den jeweiligen Kanal, passend zu `zeichen.ts`. */
const ZEICHEN_JE_KANAL: Record<KanalArt, string> = {
  link: 'link',
  telefon: 'telefon',
  mobil: 'mobil',
  whatsapp: 'whatsapp',
  mail: 'mail',
  termin: 'termin',
  route: 'route',
  shop: 'shop',
  datei: 'datei',
  video: 'video',
};

const ZEICHEN_JE_NETZWERK: Record<Netzwerk, string> = {
  instagram: 'instagram',
  linkedin: 'linkedin',
  facebook: 'facebook',
  youtube: 'youtube',
  tiktok: 'tiktok',
  x: 'x',
  xing: 'xing',
  threads: 'threads',
  pinterest: 'pinterest',
  spotify: 'spotify',
  telegram: 'telegram',
  github: 'github',
  website: 'globus',
};

export function zeichenFuerKanal(kanal: KanalArt): string {
  return ZEICHEN_JE_KANAL[kanal] ?? 'link';
}

export function zeichenFuerNetzwerk(netzwerk: Netzwerk): string {
  return ZEICHEN_JE_NETZWERK[netzwerk] ?? 'globus';
}

/** Reduziert eine Telefonnummer auf das, was ein Wählprogramm braucht. */
export function normalisiereNummer(roh: string): string {
  const gesaeubert = String(roh).replace(/[^\d+]/g, '');
  // Ein Plus gilt nur ganz vorn; „0176+49" ist ein Tippfehler, keine Nummer.
  const plus = gesaeubert.startsWith('+');
  return (plus ? '+' : '') + gesaeubert.replace(/\+/g, '');
}

/**
 * Wandelt eine deutsche Schreibweise in das internationale Format für WhatsApp:
 * dort werden nur Ziffern akzeptiert, mit Landesvorwahl und ohne führende Null.
 */
export function zuWhatsappNummer(roh: string, landesvorwahl = '49'): string {
  const nummer = normalisiereNummer(roh);
  if (nummer.startsWith('+')) return nummer.slice(1);
  if (nummer.startsWith('00')) return nummer.slice(2);
  if (nummer.startsWith('0')) return landesvorwahl + nummer.slice(1);
  return nummer;
}

/** Prüft eine fertige Adresse gegen die erlaubten Schemata. */
export function istSichereAdresse(adresse: string): boolean {
  try {
    return ERLAUBTE_SCHEMATA.has(new URL(adresse).protocol);
  } catch {
    return false;
  }
}

function alsWebadresse(roh: string): string | null {
  const wert = roh.trim();
  const mitSchema = /^[a-z][a-z0-9+.-]*:/i.test(wert) ? wert : `https://${wert}`;
  return istSichereAdresse(mitSchema) ? mitSchema : null;
}

/**
 * Baut die Zieladresse für einen Aktionsblock.
 *
 * Gibt `null` zurück, wenn sich aus dem Rohwert keine sichere Adresse bauen
 * lässt. Der Aufrufer lässt den Block dann weg, statt eine tote oder gefährliche
 * Schaltfläche anzuzeigen.
 */
export function adresseFuer(kanal: KanalArt, ziel: string): string | null {
  const wert = String(ziel ?? '').trim();
  if (!wert) return null;

  switch (kanal) {
    case 'telefon':
    case 'mobil': {
      const nummer = normalisiereNummer(wert);
      return nummer.replace(/\D/g, '').length >= 5 ? `tel:${nummer}` : null;
    }

    case 'whatsapp': {
      // Eine fertige wa.me- oder Business-Adresse bleibt, wie sie ist.
      if (/^https?:/i.test(wert)) return alsWebadresse(wert);
      const nummer = zuWhatsappNummer(wert);
      return nummer.length >= 8 ? `https://wa.me/${nummer}` : null;
    }

    case 'mail': {
      if (/^mailto:/i.test(wert)) return istSichereAdresse(wert) ? wert : null;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wert) ? `mailto:${wert}` : null;
    }

    case 'route': {
      if (/^https?:/i.test(wert)) return alsWebadresse(wert);
      // Ohne eigene Kartenadresse bleibt nur eine Suche. Bewusst als Klickziel
      // und nicht als eingebettete Karte: eingebettet würde der Kartendienst
      // schon beim Öffnen der Seite mitlesen.
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wert)}`;
    }

    case 'link':
    case 'termin':
    case 'shop':
    case 'datei':
    case 'video':
      return alsWebadresse(wert);

    default:
      return null;
  }
}

/** Adresse eines Netzwerk-Kanals. Nutzernamen werden zur vollen Adresse ergänzt. */
const VORSATZ_JE_NETZWERK: Record<Netzwerk, string> = {
  instagram: 'https://instagram.com/',
  linkedin: 'https://linkedin.com/in/',
  facebook: 'https://facebook.com/',
  youtube: 'https://youtube.com/@',
  tiktok: 'https://tiktok.com/@',
  x: 'https://x.com/',
  xing: 'https://xing.com/profile/',
  threads: 'https://threads.net/@',
  pinterest: 'https://pinterest.com/',
  spotify: 'https://open.spotify.com/user/',
  telegram: 'https://t.me/',
  github: 'https://github.com/',
  website: 'https://',
};

export function adresseFuerNetzwerk(netzwerk: Netzwerk, ziel: string): string | null {
  const wert = String(ziel ?? '').trim();
  if (!wert) return null;
  if (/^https?:/i.test(wert)) return alsWebadresse(wert);
  const name = wert.replace(/^@/, '');
  return alsWebadresse(VORSATZ_JE_NETZWERK[netzwerk] + name);
}

/**
 * Kanäle, die das Gerät verlassen (Anruf, Mail, Karten-App). Sie bekommen kein
 * `target="_blank"`: ein leerer Tab, der zurückbleibt, wenn das Telefon klingelt,
 * ist Müll auf dem Bildschirm.
 */
export function bleibtImGeraet(kanal: KanalArt): boolean {
  return kanal === 'telefon' || kanal === 'mobil' || kanal === 'mail';
}
