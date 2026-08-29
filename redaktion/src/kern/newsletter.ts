/**
 * Der Newsletter.
 *
 * Aufgebaut wie ein Beitrag: Bausteine statt einer HTML-Wüste. Das hat einen
 * praktischen Grund und keinen ästhetischen — aus Bausteinen lässt sich
 * **beides** erzeugen, die HTML-Fassung und die reine Textfassung, und zwar so,
 * dass die Textfassung wirklich lesbar ist. Wer Text aus HTML herausrechnet,
 * bekommt eine Textfassung, die aussieht wie ein Unfall, und schickt sie dann
 * doch nicht mit. Genau das aber ist eines der wenigen Merkmale, an denen
 * Postfächer Werbung von Post unterscheiden.
 *
 * Zur Personalisierung: `{{vorname|Hallo}}` — Feld, Strich, Ersatz. **Ein Feld
 * ohne Ersatz, das fehlt, ist ein Fehler und keine Lücke.** Der Grund steht in
 * jedem Postfach der Welt: „Hallo ,". Das darf nicht erst beim Empfänger
 * auffallen.
 */

import type { Befund } from './befund.ts';
import { gruppenwert, type Empfaenger } from './empfaenger.ts';
import type { Verteiler } from './verteiler.ts';

export type Baustein =
  | { art: 'text'; text: string }
  | { art: 'ueberschrift'; text: string; stufe: 2 | 3 }
  | { art: 'bild'; datei: string; alt: string; schmueckend?: boolean }
  | { art: 'knopf'; beschriftung: string; ziel: string }
  | { art: 'zitat'; text: string; quelle?: string }
  | { art: 'trenner' };

export interface Fassungsvariante {
  /** `a`, `b` — die Kennung der Variante. */
  kennung: string;
  betreff: string;
  /** Der Vorschautext, den Postfächer hinter dem Betreff zeigen. */
  vorschau: string;
}

export const NEWSLETTERZUSTAENDE = [
  'entwurf', 'eingereicht', 'freigegeben', 'geplant', 'laeuft', 'gesendet', 'abgebrochen', 'abgelehnt',
] as const;
export type Newsletterzustand = (typeof NEWSLETTERZUSTAENDE)[number];

export interface Newsletter {
  kennung: string;
  organisation: string;
  /** Interner Name. Steht in keiner Mail. */
  titel: string;
  zustand: Newsletterzustand;
  /** Mindestens eine. Mehr als eine heißt: A/B. */
  varianten: Fassungsvariante[];
  bausteine: Baustein[];
  verteiler: string;
  segment?: string;
  absender: { name: string; adresse: string; antwortAn?: string };
  geplantFuer: number | null;
  /** Bei A/B: nach welcher Zahl die Gewinnervariante bestimmt wird. */
  entscheidungsmass?: 'oeffnung' | 'klick';
  /** Und wie lange gewartet wird, bevor der Rest die Gewinnerin bekommt. */
  pruefdauerMs?: number;
  /** Anteil des Bestands, der die Varianten bekommt. Rest bekommt die Gewinnerin. */
  probeanteil?: number;
  verfasser: string;
  angelegtAm: number;
  geaendertAm: number;
}

/* ------------------------------------------------------ Personalisierung */

const FELDMUSTER = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|([^}]*))?\}\}/g;

export interface Einsetzung {
  merkmale: Record<string, string>;
  /** Immer vorhanden: der Abmeldelink. Ohne ihn wird nicht gesendet. */
  abmeldelink: string;
  verteilername: string;
}

export type Setzergebnis = { ok: true; text: string } | { ok: false; fehlend: string[] };

/**
 * Felder einsetzen.
 *
 * Gibt die fehlenden Felder zurück, statt sie leer zu lassen. Der Aufrufer
 * entscheidet dann — beim Probeversand wird gewarnt, beim echten Versand
 * angehalten.
 */
export function setzeFelder(vorlage: string, werte: Einsetzung): Setzergebnis {
  const fehlend: string[] = [];
  const text = vorlage.replace(FELDMUSTER, (_treffer, feld: string, ersatz?: string) => {
    const wert =
      feld === 'abmeldelink' ? werte.abmeldelink
      : feld === 'verteiler' ? werte.verteilername
      : werte.merkmale[feld.startsWith('merkmal.') ? feld.slice(8) : feld];
    if (wert !== undefined && wert !== '') return wert;
    if (ersatz !== undefined) return ersatz;
    fehlend.push(feld);
    return '';
  });
  return fehlend.length > 0 ? { ok: false, fehlend: [...new Set(fehlend)] } : { ok: true, text };
}

/** Welche Felder eine Vorlage überhaupt verlangt — für die Vorschau im Editor. */
export function verlangteFelder(vorlage: string): Array<{ feld: string; hatErsatz: boolean }> {
  const heraus = new Map<string, boolean>();
  for (const m of vorlage.matchAll(FELDMUSTER)) {
    const feld = m[1]!;
    heraus.set(feld, (heraus.get(feld) ?? false) || m[2] !== undefined);
  }
  return [...heraus].map(([feld, hatErsatz]) => ({ feld, hatErsatz }));
}

/* ------------------------------------------------------------- Darstellen */

/**
 * HTML maskieren.
 *
 * Steht hier und nicht in einer Bibliothek, weil es die eine Stelle ist, an
 * der ein Merkmal aus einem Formular zu ausführbarem Code werden könnte:
 * jemand trägt sich mit dem Vornamen `<script>` ein, und der Newsletter geht
 * mit diesem Vornamen an 40 000 Postfächer.
 */
export function maskiere(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absatzHtml(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((absatz) => `<p>${maskiere(absatz).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/**
 * Die HTML-Fassung.
 *
 * Tabellen und Inline-Stile, kein Raster und keine eigene Schrift: die
 * Postfächer, um die es geht, können 1999. Das ist kein Handwerksmangel,
 * sondern die Zielumgebung.
 */
export function alsHtml(bausteine: readonly Baustein[], titel: string): string {
  const teile: string[] = [];
  for (const b of bausteine) {
    switch (b.art) {
      case 'ueberschrift':
        teile.push(`<h${b.stufe} style="margin:24px 0 8px;font-size:${b.stufe === 2 ? 21 : 17}px;line-height:1.3">${maskiere(b.text)}</h${b.stufe}>`);
        break;
      case 'text':
        teile.push(absatzHtml(b.text));
        break;
      case 'bild':
        // `alt` immer, auch leer bei schmückenden Bildern — ein fehlendes
        // Attribut lässt Vorleseprogramme den Dateinamen sprechen.
        teile.push(
          `<img src="${maskiere(b.datei)}" alt="${maskiere(b.schmueckend ? '' : b.alt)}" width="600" style="max-width:100%;height:auto;display:block;margin:16px 0">`,
        );
        break;
      case 'knopf':
        teile.push(
          `<p style="margin:24px 0"><a href="${maskiere(b.ziel)}" style="display:inline-block;padding:12px 22px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px">${maskiere(b.beschriftung)}</a></p>`,
        );
        break;
      case 'zitat':
        teile.push(
          `<blockquote style="margin:20px 0;padding:2px 0 2px 16px;border-left:3px solid #ccc">${absatzHtml(b.text)}${b.quelle ? `<p style="color:#666">— ${maskiere(b.quelle)}</p>` : ''}</blockquote>`,
        );
        break;
      case 'trenner':
        teile.push('<hr style="border:0;border-top:1px solid #e0e0e0;margin:28px 0">');
        break;
    }
  }
  return [
    '<!doctype html>',
    '<html lang="de"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${maskiere(titel)}</title></head>`,
    '<body style="margin:0;padding:0;background:#f4f4f2">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center">',
    '<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:#fff;margin:24px auto;padding:32px;font-family:Georgia,\'Times New Roman\',serif;font-size:16px;line-height:1.6;color:#1a1a1a">',
    '<tr><td>',
    teile.join('\n'),
    '</td></tr></table></td></tr></table></body></html>',
  ].join('\n');
}

/**
 * Die Textfassung.
 *
 * Nicht aus dem HTML herausgerechnet, sondern aus denselben Bausteinen
 * gebaut. Deshalb ist sie lesbar, und deshalb kann sie mitgeschickt werden.
 */
export function alsText(bausteine: readonly Baustein[]): string {
  const teile: string[] = [];
  for (const b of bausteine) {
    switch (b.art) {
      case 'ueberschrift':
        teile.push(`${b.text}\n${'='.repeat(Math.min(b.text.length, 60))}`);
        break;
      case 'text':
        teile.push(b.text);
        break;
      case 'bild':
        // Der Alternativtext ist in der Textfassung der ganze Inhalt.
        if (!b.schmueckend && b.alt) teile.push(`[Bild: ${b.alt}]`);
        break;
      case 'knopf':
        teile.push(`${b.beschriftung}: ${b.ziel}`);
        break;
      case 'zitat':
        teile.push(b.text.split('\n').map((z) => `> ${z}`).join('\n') + (b.quelle ? `\n> — ${b.quelle}` : ''));
        break;
      case 'trenner':
        teile.push('—'.repeat(40));
        break;
    }
  }
  return teile.join('\n\n');
}

export interface Ausfertigung {
  betreff: string;
  vorschau: string;
  html: string;
  text: string;
  variante: string;
}

export type Ausfertigungsergebnis = { ok: true; mail: Ausfertigung } | { ok: false; befunde: Befund[] };

/**
 * Eine Mail für **einen** Empfänger fertig machen.
 *
 * Erst die Felder, dann die Darstellung — in dieser Reihenfolge, weil ein
 * eingesetztes Merkmal maskiert werden muss und ein maskiertes Merkmal nicht
 * mehr eingesetzt werden kann.
 */
export function fertige(
  newsletter: Newsletter,
  empfaenger: Empfaenger,
  verteiler: Verteiler,
  abmeldelink: string,
  variante?: string,
): Ausfertigungsergebnis {
  const gewaehlt =
    (variante ? newsletter.varianten.find((v) => v.kennung === variante) : undefined) ??
    variantenwahl(newsletter, empfaenger);

  const werte: Einsetzung = {
    merkmale: empfaenger.merkmale,
    abmeldelink,
    verteilername: verteiler.name,
  };

  const fehlend = new Set<string>();
  const setzen = (roh: string): string => {
    const e = setzeFelder(roh, werte);
    if (e.ok) return e.text;
    for (const f of e.fehlend) fehlend.add(f);
    return '';
  };

  const betreff = setzen(gewaehlt.betreff);
  const vorschau = setzen(gewaehlt.vorschau);
  const bausteine: Baustein[] = newsletter.bausteine.map((b) => {
    switch (b.art) {
      case 'text': return { ...b, text: setzen(b.text) };
      case 'ueberschrift': return { ...b, text: setzen(b.text) };
      case 'zitat': return { ...b, text: setzen(b.text) };
      case 'knopf': return { ...b, beschriftung: setzen(b.beschriftung), ziel: setzen(b.ziel) };
      default: return b;
    }
  });

  if (fehlend.size > 0) {
    return {
      ok: false,
      befunde: [...fehlend].map((feld) => ({
        schwere: 'fehler' as const,
        kennung: 'newsletter.feld.fehlt',
        text: `Das Feld „${feld}" fehlt bei diesem Empfänger und hat keinen Ersatzwert. Ohne Ersatz stünde dort „Hallo ,".`,
        stelle: feld,
      })),
    };
  }

  return {
    ok: true,
    mail: {
      betreff,
      vorschau,
      html: alsHtml(bausteine, betreff),
      text: alsText(bausteine) + `\n\n${'—'.repeat(40)}\nAbmelden: ${abmeldelink}`,
      variante: gewaehlt.kennung,
    },
  };
}

/**
 * Welche Variante dieser Empfänger bekommt.
 *
 * Über den Streuwert seiner Kennung und nicht über einen Zufallswert: derselbe
 * Empfänger muss auch nach einem Neustart in derselben Gruppe landen, sonst
 * bekommt er beim zweiten Anlauf beide Fassungen.
 */
export function variantenwahl(newsletter: Newsletter, empfaenger: Empfaenger): Fassungsvariante {
  const erste = newsletter.varianten[0]!;
  if (newsletter.varianten.length === 1) return erste;
  const wert = gruppenwert(empfaenger, newsletter.kennung);
  const stelle = Math.min(newsletter.varianten.length - 1, Math.floor(wert * newsletter.varianten.length));
  return newsletter.varianten[stelle] ?? erste;
}

/* ---------------------------------------------------------------- Prüfung */

/** Ab hier schneiden Postfächer auf dem Telefon den Betreff ab. */
export const BETREFF_UMBRUCH = 45;

const SCHREIER = /\b[A-ZÄÖÜ]{4,}\b/g;

/**
 * Den Newsletter prüfen.
 *
 * Die Befunde hier sind zum Teil Handwerk (Betrefflänge) und zum Teil harte
 * Bedingungen (Abmeldelink, absolute Adressen). Was anhält, hält aus einem
 * Grund an, der im Satz steht.
 */
export function pruefeNewsletter(newsletter: Newsletter): Befund[] {
  const befunde: Befund[] = [];

  if (newsletter.varianten.length === 0) {
    befunde.push({ schwere: 'fehler', kennung: 'newsletter.ohne.variante', text: 'Es gibt keinen Betreff.' });
    return befunde;
  }

  for (const v of newsletter.varianten) {
    const wo = newsletter.varianten.length > 1 ? ` (Variante ${v.kennung.toUpperCase()})` : '';
    if (v.betreff.trim().length === 0) {
      befunde.push({ schwere: 'fehler', kennung: 'newsletter.betreff.leer', text: `Der Betreff${wo} ist leer.`, stelle: v.kennung });
    } else if (v.betreff.length > BETREFF_UMBRUCH) {
      befunde.push({
        schwere: 'hinweis',
        kennung: 'newsletter.betreff.lang',
        text: `Der Betreff${wo} ist ${v.betreff.length} Zeichen lang. Auf dem Telefon sind nach etwa ${BETREFF_UMBRUCH} Schluss.`,
        stelle: v.kennung,
      });
    }
    if (v.vorschau.trim().length === 0) {
      befunde.push({
        schwere: 'warnung',
        kennung: 'newsletter.vorschau.leer',
        text: `Ohne Vorschautext${wo} zeigt das Postfach den Anfang des Textes — meist „Wird diese Mail nicht richtig dargestellt".`,
        stelle: v.kennung,
      });
    }
    const schreit = v.betreff.match(SCHREIER);
    if (schreit && schreit.length > 0) {
      befunde.push({
        schwere: 'hinweis',
        kennung: 'newsletter.betreff.versal',
        text: `„${schreit[0]}" steht im Betreff in Großbuchstaben. Filter lesen das als Werbung.`,
        stelle: v.kennung,
      });
    }
    if (/[!?]{2,}/.test(v.betreff)) {
      befunde.push({
        schwere: 'hinweis',
        kennung: 'newsletter.betreff.zeichen',
        text: 'Mehrere Ausrufe- oder Fragezeichen hintereinander im Betreff. Dasselbe Signal wie Großbuchstaben.',
        stelle: v.kennung,
      });
    }
  }

  if (newsletter.varianten.length > 1) {
    if (!newsletter.entscheidungsmass) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'newsletter.ab.ohne.mass',
        text: 'Bei zwei Varianten muss feststehen, woran die bessere erkannt wird — an Öffnungen oder an Klicks.',
      });
    }
    if (!newsletter.pruefdauerMs || newsletter.pruefdauerMs < 3_600_000) {
      befunde.push({
        schwere: 'warnung',
        kennung: 'newsletter.ab.zu.kurz',
        text: 'Unter einer Stunde Prüfdauer entscheidet der Zufall, wer gerade am Rechner sitzt, und nicht der Betreff.',
      });
    }
    const betreffe = new Set(newsletter.varianten.map((v) => v.betreff.trim()));
    if (betreffe.size < newsletter.varianten.length) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'newsletter.ab.gleich',
        text: 'Zwei Varianten haben denselben Betreff. Dann gibt es nichts zu vergleichen.',
      });
    }
  }

  const text = newsletter.bausteine.filter((b) => b.art === 'text' || b.art === 'ueberschrift');
  const bilder = newsletter.bausteine.filter((b) => b.art === 'bild');

  if (newsletter.bausteine.length === 0) {
    befunde.push({ schwere: 'fehler', kennung: 'newsletter.leer', text: 'Der Newsletter hat keinen Inhalt.' });
  } else if (text.length === 0 && bilder.length > 0) {
    /* Eine Mail, die nur aus einem Bild besteht, ist für Vorleseprogramme
       leer, bei abgeschalteten Bildern weiß und für Filter ein sicheres
       Zeichen. Drei Gründe, ein Fehler. */
    befunde.push({
      schwere: 'fehler',
      kennung: 'newsletter.nur.bild',
      text: 'Der Newsletter besteht nur aus Bildern. Ohne Text ist er bei abgeschalteten Bildern leer — und für Filter Werbung.',
    });
  }

  for (const b of bilder) {
    if (b.art !== 'bild') continue;
    if (!b.schmueckend && b.alt.trim().length === 0) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'newsletter.alt.fehlt',
        text: 'Einem Bild fehlt der Alternativtext. In der Textfassung ist an seiner Stelle nichts.',
        stelle: b.datei,
      });
    }
  }

  for (const b of newsletter.bausteine) {
    if (b.art !== 'knopf') continue;
    if (b.beschriftung.trim().length === 0) {
      befunde.push({ schwere: 'fehler', kennung: 'newsletter.knopf.leer', text: 'Ein Knopf hat keine Beschriftung.' });
    }
    // Ein relativer Pfad in einer Mail führt ins Leere: es gibt keine Seite,
    // von der aus er zählen könnte.
    if (!/^https:\/\//i.test(b.ziel) && !b.ziel.startsWith('{{')) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'newsletter.ziel.relativ',
        text: `„${b.beschriftung}" zeigt auf „${b.ziel}". In einer Mail muss das eine vollständige https-Adresse sein.`,
      });
    }
  }

  if (!newsletter.absender.adresse.includes('@')) {
    befunde.push({ schwere: 'fehler', kennung: 'newsletter.absender', text: 'Die Absenderadresse ist keine Adresse.' });
  }
  if (/^noreply@|^no-reply@|^donotreply@/i.test(newsletter.absender.adresse) && !newsletter.absender.antwortAn) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'newsletter.noreply',
      text: 'Absender ist ein Nicht-Antworten-Postfach und es ist keine Antwortadresse gesetzt. Wer antwortet, schreibt ins Leere — und meldet sich dann als Werbung.',
    });
  }
  if (!newsletter.verteiler) {
    befunde.push({ schwere: 'fehler', kennung: 'newsletter.ohne.verteiler', text: 'Kein Verteiler gewählt.' });
  }

  return befunde;
}

export const ZUSTANDSNAMEN: Record<Newsletterzustand, string> = {
  entwurf: 'Entwurf',
  eingereicht: 'Eingereicht',
  freigegeben: 'Freigegeben',
  geplant: 'Geplant',
  laeuft: 'Läuft',
  gesendet: 'Gesendet',
  abgebrochen: 'Abgebrochen',
  abgelehnt: 'Abgelehnt',
};
