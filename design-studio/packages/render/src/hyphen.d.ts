/**
 * Typen für `hyphen`. Das Paket liefert keine mit und ist CommonJS — deshalb
 * als Default-Export beschrieben. Ein benannter ESM-Import scheitert in Node,
 * weil der CJS-Lexer die Exporte dort nicht erkennt.
 */
interface Trennmodul {
  hyphenateSync(text: string, optionen?: { hyphenChar?: string }): string;
}

declare module 'hyphen/de-1996' {
  const modul: Trennmodul;
  export default modul;
}

declare module 'hyphen/en-us' {
  const modul: Trennmodul;
  export default modul;
}
