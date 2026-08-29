/**
 * Zustellbarkeit — die Kopfzeilen und die drei Einträge im DNS.
 *
 * Der unangenehme Teil eines Newsletter-Werkzeugs. Er entscheidet, ob die Mail
 * ankommt, und er lässt sich nicht durch Gestaltung ausgleichen: eine Domain
 * ohne DMARC landet seit Februar 2024 bei Google und Yahoo im Werbeordner
 * oder gar nicht, gleich wie gut der Betreff ist.
 *
 * Die Anforderungen, die beide Anbieter für Versender ab 5 000 Mails am Tag
 * gesetzt haben, sind zugleich die Gliederung dieser Datei:
 *
 * 1. SPF **und** DKIM, beide bestanden, beide auf die sichtbare Absenderdomain
 *    ausgerichtet.
 * 2. DMARC, mindestens `p=none`.
 * 3. Abmeldung mit einem Klick, im Kopf und im Text, und binnen zwei Tagen
 *    umgesetzt.
 * 4. Beschwerdequote dauerhaft unter 0,3 % (siehe `versand.ts`).
 *
 * Was hier **nicht** steht: das Versenden selbst. Der Kern kennt keinen
 * Mailserver, er baut nur die Kopfzeilen und beurteilt die Einrichtung.
 */

import type { Befund } from './befund.ts';

export interface Absender {
  name: string;
  adresse: string;
  antwortAn?: string;
  /** Die Domain, unter der signiert wird. Meist die des Absenders. */
  domain: string;
}

export interface Abmeldewege {
  /** Die Ein-Klick-Adresse. Muss POST vertragen, nicht nur GET. */
  einKlick: string;
  /** Der Weg über eine Mail, für Programme, die den ersten nicht können. */
  perMail: string;
}

/**
 * Die Kopfzeilen einer Newsletter-Mail.
 *
 * `List-Unsubscribe-Post` ist der Unterschied zwischen „es gibt einen
 * Abmeldelink" und „das Postfach zeigt einen Abmeldeknopf". Ohne diese Zeile
 * blendet Gmail den Knopf nicht ein, und ohne den Knopf klickt der Leser den
 * anderen — den, der als Werbung meldet.
 *
 * Wichtig: Die Adresse hinter `List-Unsubscribe` muss **POST** annehmen und
 * darf nichts weiter verlangen. Eine Bestätigungsseite dahinter macht die
 * Zeile wertlos; das Postfach ruft sie im Hintergrund auf und sieht nie eine
 * Seite.
 */
export function kopfzeilen(
  absender: Absender,
  listenkennung: string,
  listenname: string,
  abmelden: Abmeldewege,
  nachrichtenkennung: string,
): Record<string, string> {
  return {
    'From': `${absender.name} <${absender.adresse}>`,
    ...(absender.antwortAn ? { 'Reply-To': absender.antwortAn } : {}),
    'Message-ID': `<${nachrichtenkennung}@${absender.domain}>`,
    'List-Id': `${listenname} <${listenkennung}>`,
    'List-Unsubscribe': `<${abmelden.einKlick}>, <${abmelden.perMail}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    // Sagt Abwesenheitsnotizen, dass sie schweigen sollen. Ohne das antwortet
    // jeder Urlauber dem Verteiler.
    'Auto-Submitted': 'auto-generated',
    'Precedence': 'bulk',
    'MIME-Version': '1.0',
  };
}

/* ------------------------------------------------------ Einrichtung prüfen */

export interface DnsBefunde {
  /** Der TXT-Eintrag der Domain, der mit `v=spf1` beginnt. `null`, wenn keiner. */
  spf: string | null;
  /** Der DKIM-Eintrag unter `<auswahl>._domainkey.<domain>`. */
  dkim: string | null;
  /** Der TXT-Eintrag unter `_dmarc.<domain>`. */
  dmarc: string | null;
  /** Gibt es einen Rückwärtseintrag, und passt er? */
  ptrPasst?: boolean;
}

/**
 * Die Einrichtung beurteilen.
 *
 * Eine reine Funktion über die schon aufgelösten Einträge: das Auflösen selbst
 * gehört nicht in den Kern, das Beurteilen schon. So lässt sich jede Regel
 * ohne Netz prüfen — und im Betrieb steht dieselbe Beurteilung wie im Test.
 */
export function pruefeEinrichtung(dns: DnsBefunde, mailsProTag: number): Befund[] {
  const befunde: Befund[] = [];
  const massenversand = mailsProTag >= 5000;

  /* --- SPF --- */
  if (!dns.spf) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'dns.spf.fehlt',
      text: 'Kein SPF-Eintrag. Ohne ihn nimmt kein großer Anbieter Massenpost an.',
      stelle: 'spf',
    });
  } else {
    if (!/^v=spf1\b/i.test(dns.spf.trim())) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'dns.spf.form',
        text: 'Der SPF-Eintrag beginnt nicht mit „v=spf1".',
        stelle: 'spf',
      });
    }
    if (/[+]all\b/i.test(dns.spf)) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'dns.spf.offen',
        text: '„+all" erlaubt jedem Rechner der Welt, in deinem Namen zu senden. Das ist schlechter als gar kein SPF.',
        stelle: 'spf',
      });
    } else if (!/[-~]all\b/i.test(dns.spf)) {
      befunde.push({
        schwere: 'warnung',
        kennung: 'dns.spf.ohne.abschluss',
        text: 'Dem SPF-Eintrag fehlt der Abschluss „-all" oder „~all". Ohne ihn ist unklar, was mit allem anderen geschehen soll.',
        stelle: 'spf',
      });
    }
    /* Zehn Auflösungen sind die Grenze aus RFC 7208. Wir zählen die
       Anweisungen, die eine auslösen — genau zählen ließe sich nur durch
       Auflösen, und das gehört nicht hierher. */
    const nachschlagend = (dns.spf.match(/\b(include|a|mx|ptr|exists|redirect)[:=]?/gi) ?? []).length;
    if (nachschlagend > 10) {
      befunde.push({
        schwere: 'warnung',
        kennung: 'dns.spf.zu.viele',
        text: `Der SPF-Eintrag enthält ${nachschlagend} Anweisungen, die eine Auflösung auslösen. Ab zehn gilt er als ungültig.`,
        stelle: 'spf',
      });
    }
  }

  /* --- DKIM --- */
  if (!dns.dkim) {
    befunde.push({
      schwere: 'fehler',
      kennung: 'dns.dkim.fehlt',
      text: 'Kein DKIM-Schlüssel. Ohne Signatur ist jede Weiterleitung ein Zustellfehler.',
      stelle: 'dkim',
    });
  } else {
    const schluessel = /(^|;)\s*p\s*=\s*([^;]*)/i.exec(dns.dkim);
    if (!schluessel || schluessel[2]!.trim().length === 0) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'dns.dkim.leer',
        text: 'Der DKIM-Eintrag hat einen leeren Schlüssel („p="). So ist er ausdrücklich zurückgezogen.',
        stelle: 'dkim',
      });
    } else if (schluessel[2]!.replace(/\s/g, '').length < 200) {
      // Ein 1024-Bit-Schlüssel ist rund 216 Zeichen Base64, ein 2048er rund 392.
      befunde.push({
        schwere: 'warnung',
        kennung: 'dns.dkim.kurz',
        text: 'Der DKIM-Schlüssel sieht nach 1024 Bit aus. 2048 sind seit Jahren der Standard.',
        stelle: 'dkim',
      });
    }
  }

  /* --- DMARC --- */
  if (!dns.dmarc) {
    befunde.push({
      schwere: massenversand ? 'fehler' : 'warnung',
      kennung: 'dns.dmarc.fehlt',
      text: massenversand
        ? 'Kein DMARC-Eintrag. Bei mehr als 5 000 Mails am Tag nehmen Google und Yahoo die Post dann nicht mehr an.'
        : 'Kein DMARC-Eintrag. Solange der Versand klein bleibt, geht es — beim Wachsen wird es zur Bedingung.',
      stelle: 'dmarc',
    });
  } else {
    if (!/^v=DMARC1\b/i.test(dns.dmarc.trim())) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'dns.dmarc.form',
        text: 'Der DMARC-Eintrag beginnt nicht mit „v=DMARC1".',
        stelle: 'dmarc',
      });
    }
    const regel = /(^|;)\s*p\s*=\s*(none|quarantine|reject)/i.exec(dns.dmarc)?.[2]?.toLowerCase();
    if (!regel) {
      befunde.push({
        schwere: 'fehler',
        kennung: 'dns.dmarc.ohne.regel',
        text: 'Dem DMARC-Eintrag fehlt die Angabe „p=". Ohne sie gilt er als nicht vorhanden.',
        stelle: 'dmarc',
      });
    } else if (regel === 'none') {
      befunde.push({
        schwere: 'hinweis',
        kennung: 'dns.dmarc.none',
        text: '„p=none" erfüllt die Anforderung und schützt nichts: gefälschte Post in deinem Namen kommt weiter an. Nach ein paar Wochen ohne Auffälligkeiten in den Berichten auf „quarantine" gehen.',
        stelle: 'dmarc',
      });
    }
    if (!/\brua\s*=/i.test(dns.dmarc)) {
      befunde.push({
        schwere: 'warnung',
        kennung: 'dns.dmarc.ohne.berichte',
        text: 'Ohne „rua=" kommen keine Berichte. Dann lässt sich nie feststellen, ob eine schärfere Regel gefahrlos wäre.',
        stelle: 'dmarc',
      });
    }
  }

  if (dns.ptrPasst === false) {
    befunde.push({
      schwere: 'warnung',
      kennung: 'dns.ptr',
      text: 'Der Rückwärtseintrag der Versand-IP passt nicht zum Rechnernamen. Einige Anbieter werten das ab.',
      stelle: 'ptr',
    });
  }

  return befunde;
}

/* ------------------------------------------------------------- Aufwärmen */

export interface Aufwaermtag {
  tag: number;
  hoechstmenge: number;
}

/**
 * Der Aufwärmplan für eine neue Versanddomain.
 *
 * Eine Domain, die gestern nichts versandt hat und heute 40 000 Mails abgibt,
 * ist aus Sicht jedes Anbieters ein übernommenes Konto. Die Menge wird deshalb
 * täglich etwa verdoppelt, beginnend bei 50 — nicht weil 50 eine besondere
 * Zahl wäre, sondern weil die Steigerung zählt und nicht der Anfang.
 *
 * Der Plan endet, wenn die Zielmenge erreicht ist. Wer schneller will, kann
 * das tun; er sollte nur nicht überrascht sein.
 */
export function aufwaermplan(zielmenge: number, anfang = 50, faktor = 2): Aufwaermtag[] {
  const plan: Aufwaermtag[] = [];
  let menge = Math.min(anfang, zielmenge);
  let tag = 1;
  while (menge < zielmenge && tag <= 60) {
    plan.push({ tag, hoechstmenge: menge });
    menge = Math.min(zielmenge, Math.ceil(menge * faktor));
    tag++;
  }
  plan.push({ tag, hoechstmenge: zielmenge });
  return plan;
}

/** Wie viel an einem bestimmten Tag des Aufwärmens hinaus darf. */
export function mengeAmTag(plan: readonly Aufwaermtag[], tag: number): number {
  if (plan.length === 0) return 0;
  if (tag <= 0) return plan[0]!.hoechstmenge;
  const treffer = plan.find((p) => p.tag === tag);
  return treffer ? treffer.hoechstmenge : plan.at(-1)!.hoechstmenge;
}

/**
 * Prüft, ob eine geplante Menge zum Aufwärmstand passt.
 *
 * Als Warnung und nicht als Fehler: es gibt Domains, die seit Jahren senden
 * und keinen Aufwärmplan brauchen. Wer ihn überschreitet, soll es aber wissen.
 */
export function aufwaermbefund(plan: readonly Aufwaermtag[], tag: number, menge: number): Befund | null {
  const erlaubt = mengeAmTag(plan, tag);
  if (menge <= erlaubt) return null;
  return {
    schwere: 'warnung',
    kennung: 'zustellung.aufwaermen',
    text: `Der Aufwärmplan sieht für Tag ${tag} höchstens ${erlaubt} Mails vor, geplant sind ${menge}. Ein zu schneller Anstieg kostet den Ruf der Domain, und der ist teuer zurückzugewinnen.`,
  };
}
