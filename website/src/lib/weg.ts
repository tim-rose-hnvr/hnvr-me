/**
 * weg() setzt den Basispfad vor einen internen Weg.
 *
 * Auf einem eigenen Rechnernamen ist der Basispfad `/` und die Funktion
 * gibt zurueck, was sie bekommt. Liegt die Seite in einem
 * Unterverzeichnis — etwa auf GitHub Pages unter `/hnvr-me/` —, dann
 * muss jeder Weg das davor tragen.
 *
 * Astro setzt das NICHT von allein: ein geschriebenes `href="/preise"`
 * bleibt `/preise`, auch wenn `base` gesetzt ist. Genau daran scheitern
 * die meisten Projektseiten auf GitHub Pages, und zwar lautlos — der
 * Bau laeuft durch, und erst im Browser ist jeder Verweis tot.
 *
 * Anker und fremde Adressen bleiben unberuehrt.
 */
export function weg(pfad: string): string {
  if (!pfad.startsWith('/')) return pfad;
  const basis = import.meta.env.BASE_URL || '/';
  if (basis === '/') return pfad;
  return basis.replace(/\/$/, '') + pfad;
}
