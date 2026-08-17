/**
 * Abgabe — vom fertigen Entwurf zur Mail.
 *
 * Solange es keinen Konto-Bereich zum Selbstveröffentlichen gibt, ist die Mail
 * der Übergabepunkt. Der ganze Entwurf steckt im Vorschau-Link, also braucht
 * sie keinen Anhang und wir keinen Dienst, der Entwürfe entgegennimmt: der
 * Entwurf verlässt den Browser erst in dem Moment, in dem ein Mensch absendet.
 *
 * Der Text steht hier und nicht in der Werkstatt, weil er Logik ist und keine
 * Oberfläche: welcher Weg gewählt wird, hängt an der Länge der Adresse, und ein
 * abgeschnittener Link wäre stillschweigend kaputt. Hier lässt sich beides
 * prüfen, ohne einen Browser zu starten.
 */

import { MARKE } from './marke.ts';
import type { Profil } from './profil.ts';

export const POSTFACH = MARKE.postfach;

/**
 * Jenseits davon kürzen Mailprogramme die Adresse — Outlook und der
 * Windows-Protokollaufruf sind die engsten Stellen. Wir bleiben darunter und
 * weichen sonst aus, statt zu kürzen.
 */
export const MAILTO_GRENZE = 1900;

/**
 * Wie der Entwurf bei uns ankommt:
 * - `link` — er steht in der Mail (der Normalfall),
 * - `ablage` — er liegt in der Zwischenablage und muss eingefügt werden,
 * - `datei` — er wurde heruntergeladen und muss angehängt werden.
 */
export type Beilage = 'link' | 'ablage' | 'datei';

export function abgabeBetreff(profil: Profil): string {
  return `${MARKE.name} — Entwurf ${profil.slug}`;
}

export function abgabeRumpf(profil: Profil, weg: Beilage, link: string): string {
  return [
    'Hallo,',
    '',
    `anbei mein Entwurf für die Adresse /t/${profil.slug}.`,
    '',
    weg === 'link'
      ? link
      : weg === 'ablage'
        ? '(Der Vorschau-Link liegt in der Zwischenablage — bitte hier einfügen.)'
        : '(Der Entwurf wurde als Datei gesichert — bitte anhängen.)',
    '',
    'Viele Grüße',
    profil.kopf.name,
  ].join('\n');
}

export function abgabeAdresse(profil: Profil, weg: Beilage, link: string): string {
  const betreff = encodeURIComponent(abgabeBetreff(profil));
  const rumpf = encodeURIComponent(abgabeRumpf(profil, weg, link));
  return `mailto:${POSTFACH}?subject=${betreff}&body=${rumpf}`;
}

/** Passt der Vorschau-Link in die Mail, ohne dass sie jemand abschneidet? */
export function linkPasst(profil: Profil, link: string): boolean {
  return abgabeAdresse(profil, 'link', link).length <= MAILTO_GRENZE;
}
