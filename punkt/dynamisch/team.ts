/**
 * Mitarbeitende — die Regeln, ohne Datenbank.
 *
 * Drei Rollen, dieselben wie im Go-Programm unter `pnkt/`:
 *
 *   Rolle      lesen  schreiben  verwalten
 *   inhaber    ja     ja         ja
 *   redakteur  ja     ja         nein
 *   leser      ja     nein       nein
 *
 * Codes gehören der Organisation, nicht der Person. Die Organisation ist
 * das Konto des Inhabers — ein Code mit `kontoId = Inhaber` ist für alle
 * Mitarbeitenden derselbe Code.
 *
 * **Eingeladen wird mit einem Link, nicht mit einer Mail.** Dieses System
 * verschickt keine Post, und das bleibt so (siehe `pnkt/README.md`). Der
 * Inhaber bekommt einen Link, den er selbst weitergibt. Der Link ist das
 * Geheimnis: 32 Zeichen, sieben Tage gültig, einmal einlösbar. In der
 * Ablage steht nur sein Abdruck — wer die Sammlung liest, kann damit
 * niemanden hereinholen.
 *
 * Warum der Link und nicht die Adresse allein: Konten werden hier ohne
 * Bestätigungsmail angelegt. Eine Mitgliedschaft, die nur an einer
 * Adresse hängt, könnte jeder übernehmen, der diese Adresse als Erster
 * registriert. Die Adresse ist trotzdem gebunden — damit ein falsch
 * weitergeleiteter Link bei der falschen Person nichts öffnet.
 *
 * Alles hier ist ohne Wix prüfbar und wird in `test/` geprüft. Gefragt
 * wird immer auf dem Server; die Oberfläche blendet nur aus, was sie
 * ohnehin nicht dürfte.
 */

export type Rolle = 'inhaber' | 'redakteur' | 'leser';

/** Die Rollen, die man vergeben kann. Inhaber wird man nicht, man ist es. */
export const VERGEBBAR: readonly Rolle[] = ['redakteur', 'leser'];

export const ROLLENNAME: Record<Rolle, string> = {
  inhaber: 'Inhaber',
  redakteur: 'Redakteur',
  leser: 'Leser',
};

export function rolleTaugt(roh: string): roh is 'redakteur' | 'leser' {
  return (VERGEBBAR as readonly string[]).includes(roh);
}

export function darfSchreiben(rolle: Rolle | null): boolean {
  return rolle === 'inhaber' || rolle === 'redakteur';
}

/** Mitarbeitende einladen, Rollen ändern, entlassen. Bleibt beim Inhaber. */
export function darfVerwalten(rolle: Rolle | null): boolean {
  return rolle === 'inhaber';
}

/**
 * Wozu ein Konto gehört. `null` heißt: zu keiner fremden Organisation —
 * dann ist es selbst Inhaber seiner eigenen.
 */
export interface Zugehoerigkeit {
  /** Konto des Inhabers, also die Organisation. */
  inhaberId: string;
  inhaberName: string;
  rolle: 'redakteur' | 'leser';
  /** Kennung der Zeile in PK_Mitglieder. */
  mitgliedschaft: string;
}

/** Die Organisation, in der ein Konto arbeitet. */
export function organisationVon(kontoId: string, z: Zugehoerigkeit | null): string {
  return z ? z.inhaberId : kontoId;
}

/** Welche Rolle ein Konto an einem Code hat — oder keine. */
export function rolleAmCode(codeKontoId: string, kontoId: string, z: Zugehoerigkeit | null): Rolle | null {
  if (!codeKontoId) return null;
  // Eigene Codes bleiben eigene, auch nach dem Beitritt: wer vorher
  // Aufsteller gedruckt hat, verliert sie nicht, weil er jetzt mitarbeitet.
  if (codeKontoId === kontoId) return 'inhaber';
  if (z && codeKontoId === z.inhaberId) return z.rolle;
  return null;
}

// ─── Adressen ─────────────────────────────────────────────────────────

/**
 * Bewusst grob: eine strengere Regel weist mehr gültige Adressen ab als
 * sie ungültige fängt. Ob die Adresse erreichbar ist, sagt ohnehin erst
 * eine Nachricht dorthin.
 */
export function adresseTaugt(mail: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail);
}

export function adresseBereinigen(mail: string): string {
  return mail.trim().toLowerCase();
}

// ─── Einladungslink ───────────────────────────────────────────────────

export const EINLADUNG_TAGE = 7;
const ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const LAENGE = 32;

/**
 * 32 Zeichen aus 62, gleichverteilt. Ein Byte, das über dem letzten
 * vollen Vielfachen von 62 liegt, wird verworfen statt gefaltet — sonst
 * kämen die ersten acht Zeichen etwas häufiger vor.
 */
export function einladungErzeugen(): string {
  const grenze = 256 - (256 % ZEICHEN.length);
  let aus = '';
  while (aus.length < LAENGE) {
    for (const b of crypto.getRandomValues(new Uint8Array(LAENGE * 2))) {
      if (b < grenze) aus += ZEICHEN[b % ZEICHEN.length];
      if (aus.length === LAENGE) break;
    }
  }
  return aus;
}

/** Formprüfung vor jeder Abfrage — Müll wird gar nicht erst gesucht. */
export function einladungFormOk(roh: string): boolean {
  return new RegExp(`^[A-Za-z0-9]{${LAENGE}}$`).test(roh);
}

/** Der Abdruck, der in der Ablage steht. Der Link selbst steht nirgends. */
export async function einladungAbdruck(schluessel: string): Promise<string> {
  const roh = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(schluessel));
  return [...new Uint8Array(roh)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function einladungAblauf(jetzt = Date.now()): string {
  return new Date(jetzt + EINLADUNG_TAGE * 86_400_000).toISOString();
}

export function einladungGueltig(bis: string, jetzt = Date.now()): boolean {
  const t = Date.parse(bis);
  return Number.isFinite(t) && t > jetzt;
}

/**
 * Nur dieser Rückweg ist nach dem Anmelden erlaubt. Alles andere wäre
 * eine offene Weiterleitung: /anmelden?weiter=//fremd.example schickte
 * einen frisch angemeldeten Menschen auf eine fremde Seite.
 */
export function rueckwegTaugt(weg: string): boolean {
  return new RegExp(`^/einladung/[A-Za-z0-9]{${LAENGE}}$`).test(weg);
}

// ─── Annehmen ─────────────────────────────────────────────────────────

export interface Annahmelage {
  /** Adresse, für die die Einladung ausgestellt wurde. */
  eingeladen: string;
  /** Adresse des angemeldeten Kontos. */
  angemeldet: string;
  kontoId: string;
  inhaberId: string;
  /** Gehört das Konto schon zu einer Organisation? */
  schonDabei: Zugehoerigkeit | null;
  /** Führt das Konto selbst Mitarbeitende? */
  fuehrtSelbst: boolean;
  /** Arbeitet der Einladende inzwischen selbst woanders mit? */
  inhaberArbeitetWoanders: boolean;
}

/**
 * Ob eine gültige Einladung von diesem Konto angenommen werden darf.
 * Gibt den Grund zurück, der dem Menschen hilft, oder null.
 *
 * Ein Konto arbeitet in höchstens einer fremden Organisation. Sonst wäre
 * bei jedem neuen Code offen, wem er gehört — und wer einen Inhaber
 * entlässt, entließe ihn nicht aus der anderen.
 */
export function annahmeHindernis(l: Annahmelage): string | null {
  if (adresseBereinigen(l.eingeladen) !== adresseBereinigen(l.angemeldet))
    return `Diese Einladung gilt für ${l.eingeladen}. Du bist als ${l.angemeldet} angemeldet — melde dich ab und mit der eingeladenen Adresse an.`;
  if (l.kontoId === l.inhaberId) return 'Das ist deine eigene Organisation.';
  // Wer eingeladen hat und danach selbst woanders beigetreten ist, führt
  // keine Organisation mehr. Seine offenen Links gelten nicht weiter.
  if (l.inhaberArbeitetWoanders) return 'Diese Einladung gilt nicht mehr.';
  if (l.schonDabei && l.schonDabei.inhaberId === l.inhaberId) return 'Du bist hier schon dabei.';
  if (l.schonDabei)
    return `Du arbeitest schon bei ${l.schonDabei.inhaberName || 'einer anderen Organisation'} mit. Tritt dort zuerst aus — ein Konto gehört höchstens einer fremden Organisation.`;
  if (l.fuehrtSelbst)
    return 'Du führst selbst Mitarbeitende. Ein Konto kann nicht zugleich einladen und eingeladen sein.';
  return null;
}
