/**
 * Befunde — was eine Prüfung zurückgibt.
 *
 * Eine Prüfung, die nur `true` oder `false` sagt, zwingt die Oberfläche dazu,
 * die Begründung ein zweites Mal zu erfinden. Deshalb gibt hier jede Prüfung
 * Sätze zurück, und zwar in drei Schweregraden:
 *
 * - **fehler** — hält an. Es wird nichts veröffentlicht und nichts gesendet.
 * - **warnung** — hält nicht an, muss aber gesehen werden. Wer trotzdem sendet,
 *   hat es entschieden und nicht übersehen.
 * - **hinweis** — Handwerk. Darf man ignorieren.
 *
 * Die Trennung ist wichtiger, als sie aussieht. Ein Werkzeug, das alles zum
 * Fehler erklärt, wird umgangen; eines, das alles zum Hinweis erklärt, wird
 * nicht gelesen.
 */

export type Schwere = 'fehler' | 'warnung' | 'hinweis';

export interface Befund {
  schwere: Schwere;
  /** Kurzer, gleichbleibender Schlüssel — für Prüfungen und Übersetzungen. */
  kennung: string;
  /** Der Satz, den ein Mensch liest. Vollständig, ohne Auslassung. */
  text: string;
  /** Woran es liegt, wenn es sich benennen lässt: ein Feld, ein Kanal. */
  stelle?: string;
}

export function haeltAn(befunde: readonly Befund[]): boolean {
  return befunde.some((b) => b.schwere === 'fehler');
}

export function nach(befunde: readonly Befund[], schwere: Schwere): Befund[] {
  return befunde.filter((b) => b.schwere === schwere);
}

/** Sortiert: Fehler zuerst, dann Warnungen, dann Hinweise. */
export function geordnet(befunde: readonly Befund[]): Befund[] {
  const rang: Record<Schwere, number> = { fehler: 0, warnung: 1, hinweis: 2 };
  return [...befunde].sort((a, b) => rang[a.schwere] - rang[b.schwere]);
}
