/**
 * Die Bilddateien der Marke — eingebettet, nicht ausgeliefert.
 *
 * Das Zeichen selbst zeichnet `zeichenPlaettchen()` aus `kern/marke.ts`; für
 * das Symbol auf dem iOS-Startbildschirm braucht es aber eine PNG-Datei, SVG
 * nimmt iOS dort nicht.
 *
 * Die Datei liegt deshalb unter `src/bilder/` und nicht unter `public/`: aus
 * `public/` wäre sie unter einer festen Adresse abrufbar, hier wird sie beim
 * Bauen in die Seite eingebettet. Es gibt keine Adresse, unter der jemand das
 * Logo abholen könnte. Die Originale in allen Größen liegen im Projekt unter
 * `doku/handoff/brand/`, also in der Versionsverwaltung, nicht im Netz.
 *
 * Der Aufruf steht in `try`, weil `import.meta.glob` eine Erfindung des
 * Bündlers ist — die Tests laufen mit blankem Node und kennen es nicht.
 */

let eingebettet: Record<string, string> = {};

try {
  const roh = import.meta.glob<string>('/src/bilder/marke/*.png', {
    eager: true,
    query: '?inline',
    import: 'default',
  });
  eingebettet = roh as unknown as Record<string, string>;
} catch {
  eingebettet = {};
}

/** Das Startbildschirm-Symbol als Datenadresse, oder leer wenn nicht gebaut. */
export function startbildschirmSymbol(): string {
  return eingebettet['/src/bilder/marke/icon-180.png'] ?? '';
}
