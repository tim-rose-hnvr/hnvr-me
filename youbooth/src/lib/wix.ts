/**
 * Anmeldung über Wix — der Weg für die Website.
 *
 * Die Website ist ein Wix-Headless-Projekt. Damit gibt es Mitglieder, und Wix
 * führt den Anmeldeweg selbst: Google, Facebook oder E-Mail. Wir bauen weder
 * eine Kennwortprüfung noch eine Nutzerverwaltung — das ist der Punkt.
 *
 * WICHTIG, und der Unterschied zur Box: Diese Anmeldung braucht Internet. Sie
 * gilt für die Website, nicht für die Box im Saal. Die Box hat ihre eigene
 * Anmeldung mit eigenem Kennwort, weil sie in einer Scheune ohne Netz stehen
 * muss — eine Anmeldung, die Google fragen muss, sperrt genau dann aus, wenn
 * niemand helfen kann.
 *
 * Die Kennung ist keine Geheimzahl: Sie steht in jedem Browser, der die Seite
 * öffnet, und ist genau dafür gedacht. Geheim ist nur das Client-Secret, und
 * das braucht dieser Weg nicht.
 */

import { createClient, OAuthStrategy, type Tokens } from '@wix/sdk';
import { members } from '@wix/members';

const SPEICHER_TOKEN = 'youbooth.wix.tokens';
const SPEICHER_OAUTH = 'youbooth.wix.oauth';

export type Mitglied = { name: string; email: string };

function gemerkteTokens(): Tokens | undefined {
  try {
    const roh = localStorage.getItem(SPEICHER_TOKEN);
    return roh ? (JSON.parse(roh) as Tokens) : undefined;
  } catch {
    return undefined;
  }
}

export function kunde(kennung: string) {
  return createClient({
    modules: { members },
    auth: OAuthStrategy({ clientId: kennung, tokens: gemerkteTokens() }),
  });
}

/**
 * Startet die Anmeldung. `anbieter` leer heißt: die Anmeldeseite von Wix mit
 * allen Wegen nebeneinander — E-Mail und die freigeschalteten Anbieter.
 */
export async function melde(
  kennung: string,
  anbieter?: 'google' | 'facebook'
): Promise<{ fehler?: string }> {
  const k = kunde(kennung);
  const zurueck = new URL('/anmelden/zurueck', location.origin).href;
  const danach = new URL('/anmelden', location.origin).href;

  const daten = k.auth.generateOAuthData(zurueck, danach);
  localStorage.setItem(SPEICHER_OAUTH, JSON.stringify(daten));

  try {
    const { authUrl } = await k.auth.getAuthUrl(daten, anbieter ? { idp: anbieter } : undefined);
    location.href = authUrl;
    return {};
  } catch (fehler) {
    /* Der häufigste Grund ist keine Panne, sondern eine fehlende Zeile in den
       Headless-Einstellungen: Die Rücksprungadresse muss dort erlaubt sein.
       Deshalb steht sie in der Meldung — sonst sucht man an der falschen
       Stelle. */
    return {
      fehler:
        `Wix hat den Anmeldeweg nicht geöffnet. Ist ${zurueck} in den ` +
        `Headless-Einstellungen als erlaubte Rücksprungadresse eingetragen?`,
    };
  }
}

/** Auf der Rücksprungseite: den Code gegen Zugangsmarken tauschen. */
export async function nimmZurueck(kennung: string): Promise<{ fehler?: string }> {
  const k = kunde(kennung);

  let daten;
  try {
    daten = JSON.parse(localStorage.getItem(SPEICHER_OAUTH) || 'null');
  } catch {
    daten = null;
  }
  if (!daten) return { fehler: 'Der angefangene Anmeldeweg ist nicht mehr da. Bitte noch einmal.' };

  const zurueck = k.auth.parseFromUrl();
  if (zurueck.error) {
    return { fehler: zurueck.errorDescription || 'Die Anmeldung wurde abgebrochen.' };
  }

  try {
    const marken = await k.auth.getMemberTokens(zurueck.code!, zurueck.state!, daten);
    localStorage.setItem(SPEICHER_TOKEN, JSON.stringify(marken));
    localStorage.removeItem(SPEICHER_OAUTH);
    return {};
  } catch {
    return { fehler: 'Die Anmeldung ließ sich nicht abschließen.' };
  }
}

/** Wer ist angemeldet? `null` heißt: niemand. */
export async function angemeldet(kennung: string): Promise<Mitglied | null> {
  if (!gemerkteTokens()) return null;
  try {
    const { member } = await kunde(kennung).members.getCurrentMember();
    if (!member) return null;
    const profil = member.profile || {};
    const kontakt = member.contact || {};
    return {
      name:
        profil.nickname ||
        [kontakt.firstName, kontakt.lastName].filter(Boolean).join(' ') ||
        member.loginEmail ||
        'Angemeldet',
      email: member.loginEmail || '',
    };
  } catch {
    // Abgelaufene Marken sind kein Fehler, sondern ein Zustand.
    localStorage.removeItem(SPEICHER_TOKEN);
    return null;
  }
}

export function abmelden(): void {
  localStorage.removeItem(SPEICHER_TOKEN);
  localStorage.removeItem(SPEICHER_OAUTH);
  location.href = '/anmelden';
}
