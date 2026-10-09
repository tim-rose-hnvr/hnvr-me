/* seo-rank.me — kleiner HTML-Parser mit DOM und Selektoren.
   Zweck: derselbe Regelkatalog, der im Browser laeuft, soll auch in Node
   laufen — ohne Fremdpakete, weil das Projekt keine hat.

   Umfang ist bewusst begrenzt auf das, was der Katalog braucht:
   querySelector(All), getAttribute, hasAttribute, textContent, outerHTML,
   closest, getElementsByTagName, documentElement, body, head, tagName.
   Selektoren: Typ, *, Attribut mit = ~= und Kennzeichen i, Kommalisten,
   Nachfahrenverkettung. Mehr nicht, und das absichtlich. */

/* ---------- Zeichenverweise ---------- */

const NAMEN = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß",
  eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", ntilde: "ñ",
  copy: "©", reg: "®", trade: "™", euro: "€", pound: "£", yen: "¥", cent: "¢",
  deg: "°", plusmn: "±", times: "×", divide: "÷", minus: "−",
  laquo: "«", raquo: "»", lsaquo: "‹", rsaquo: "›",
  bdquo: "„", ldquo: "“", rdquo: "”", sbquo: "‚", lsquo: "‘", rsquo: "’",
  ndash: "–", mdash: "—", hellip: "…", middot: "·", bull: "•",
  dagger: "†", Dagger: "‡", permil: "‰", sect: "§", para: "¶",
  larr: "←", uarr: "↑", rarr: "→", darr: "↓", harr: "↔",
  shy: "­", ensp: " ", emsp: " ", thinsp: " ", zwnj: "‌", zwj: "‍"
};

export function zeichenAufloesen(text) {
  if (text.indexOf("&") === -1) return text;
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);?/g, (ganz, kern) => {
    if (kern[0] === "#") {
      const zahl = kern[1] === "x" || kern[1] === "X"
        ? parseInt(kern.slice(2), 16)
        : parseInt(kern.slice(1), 10);
      if (!isFinite(zahl) || zahl < 0 || zahl > 0x10ffff) return ganz;
      try { return String.fromCodePoint(zahl); } catch { return ganz; }
    }
    return Object.prototype.hasOwnProperty.call(NAMEN, kern) ? NAMEN[kern] : ganz;
  });
}

function schuetzen(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function schuetzenAttribut(text) {
  return String(text).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/* ---------- Knoten ---------- */

const LEER = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input",
  "link", "meta", "param", "source", "track", "wbr"]);

const ROHTEXT = new Set(["script", "style", "textarea", "title"]);

const NUR_KOPF = new Set(["base", "link", "meta", "noscript", "script", "style", "template", "title"]);

// Elemente, deren Endmarke entfallen darf. Wert: was sie schliesst.
const SCHLIESST = {
  p: new Set(["address", "article", "aside", "blockquote", "details", "div", "dl",
    "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2", "h3", "h4",
    "h5", "h6", "header", "hr", "main", "nav", "ol", "p", "pre", "section",
    "table", "ul"]),
  li: new Set(["li"]),
  dt: new Set(["dt", "dd"]),
  dd: new Set(["dt", "dd"]),
  tr: new Set(["tr", "tbody", "tfoot", "thead"]),
  td: new Set(["td", "th", "tr", "tbody", "tfoot", "thead"]),
  th: new Set(["td", "th", "tr", "tbody", "tfoot", "thead"]),
  option: new Set(["option", "optgroup"]),
  optgroup: new Set(["optgroup"]),
  thead: new Set(["tbody", "tfoot"]),
  tbody: new Set(["tbody", "tfoot"]),
  li_: null
};

class Knoten {
  constructor(typ) {
    this.nodeType = typ;           // 1 Element, 3 Text, 8 Kommentar
    this.childNodes = [];
    this.parentNode = null;
  }
  get parentElement() {
    return this.parentNode && this.parentNode.nodeType === 1 ? this.parentNode : null;
  }
}

class Text extends Knoten {
  constructor(inhalt) { super(3); this.data = inhalt; }
  get textContent() { return this.data; }
  toHTML() { return schuetzen(this.data); }
}

class Kommentar extends Knoten {
  constructor(inhalt) { super(8); this.data = inhalt; }
  get textContent() { return ""; }
  toHTML() { return "<!--" + this.data + "-->"; }
}

export class Element extends Knoten {
  constructor(name, attribute) {
    super(1);
    this.localName = name;
    this.tagName = name.toUpperCase();
    this.nodeName = this.tagName;
    this.attribute = attribute || new Map();   // kleingeschriebener Name → Wert
    this.rohtext = null;
  }

  getAttribute(name) {
    const w = this.attribute.get(String(name).toLowerCase());
    return w === undefined ? null : w;
  }

  hasAttribute(name) {
    return this.attribute.has(String(name).toLowerCase());
  }

  get children() {
    return this.childNodes.filter((k) => k.nodeType === 1);
  }

  get nextElementSibling() {
    if (!this.parentNode) return null;
    const gs = this.parentNode.childNodes;
    let gesehen = false;
    for (const k of gs) {
      if (gesehen && k.nodeType === 1) return k;
      if (k === this) gesehen = true;
    }
    return null;
  }

  get textContent() {
    if (this.rohtext !== null) return this.rohtext;
    let aus = "";
    for (const k of this.childNodes) aus += k.textContent;
    return aus;
  }

  get innerHTML() {
    if (this.rohtext !== null) return this.rohtext;
    return this.childNodes.map((k) => k.toHTML()).join("");
  }

  get outerHTML() { return this.toHTML(); }

  toHTML() {
    let aus = "<" + this.localName;
    for (const [name, wert] of this.attribute) {
      aus += wert === "" ? " " + name : " " + name + '="' + schuetzenAttribut(wert) + '"';
    }
    aus += ">";
    if (LEER.has(this.localName)) return aus;
    aus += this.innerHTML;
    return aus + "</" + this.localName + ">";
  }

  querySelector(auswahl) {
    const treffer = suchen(this, auswahl, true);
    return treffer.length ? treffer[0] : null;
  }

  querySelectorAll(auswahl) {
    return suchen(this, auswahl, false);
  }

  getElementsByTagName(name) {
    const gesucht = String(name).toLowerCase();
    const aus = [];
    durchlaufen(this, (el) => { if (gesucht === "*" || el.localName === gesucht) aus.push(el); });
    return aus;
  }

  closest(auswahl) {
    let n = this;
    while (n && n.nodeType === 1) {
      if (passtAufEinen(n, auswahl)) return n;
      n = n.parentElement;
    }
    return null;
  }
}

class Dokument extends Element {
  constructor() {
    super("#document", new Map());
    this.nodeType = 9;
  }
  get documentElement() {
    const kinder = this.children;
    // Bei HTML ist es das html-Element, bei XML das erste Element ueberhaupt.
    return kinder.find((k) => k.localName === "html") || kinder[0] || null;
  }
  get head() {
    const h = this.documentElement;
    return h ? h.children.find((k) => k.localName === "head") || null : null;
  }
  get body() {
    const h = this.documentElement;
    return h ? h.children.find((k) => k.localName === "body") || null : null;
  }
  get textContent() {
    const b = this.body;
    return b ? b.textContent : super.textContent;
  }
}

function durchlaufen(wurzel, tun) {
  for (const k of wurzel.childNodes) {
    if (k.nodeType === 1) { tun(k); durchlaufen(k, tun); }
  }
}

/* ---------- Selektoren ---------- */

/* Ein Selektor ist eine Kommaliste. Jeder Teil ist eine Folge von
   Stufen, getrennt durch Leerzeichen (Nachfahre). Eine Stufe ist ein
   Typname oder * plus beliebig viele Attributbedingungen. */

const zwischenspeicher = new Map();

function zerlegen(auswahl) {
  if (zwischenspeicher.has(auswahl)) return zwischenspeicher.get(auswahl);

  const teile = [];
  let tiefe = 0, letzter = 0;
  for (let i = 0; i < auswahl.length; i++) {
    const z = auswahl[i];
    if (z === "[") tiefe++;
    else if (z === "]") tiefe--;
    else if (z === "," && tiefe === 0) { teile.push(auswahl.slice(letzter, i)); letzter = i + 1; }
  }
  teile.push(auswahl.slice(letzter));

  const zerlegt = teile.map((teil) => stufenTeilen(teil).map(stufeLesen));
  zwischenspeicher.set(auswahl, zerlegt);
  return zerlegt;
}

/* Trennt an Leerzeichen, aber nur ausserhalb eckiger Klammern.
   Sonst zerfaellt meta[name="description" i] an dem Leerzeichen vor i. */
function stufenTeilen(teil) {
  const stufen = [];
  let tiefe = 0;
  let aktuell = "";

  for (const z of teil.trim()) {
    if (z === "[") tiefe++;
    else if (z === "]") tiefe--;

    if (tiefe === 0 && /\s/.test(z)) {
      if (aktuell) { stufen.push(aktuell); aktuell = ""; }
      continue;
    }
    aktuell += z;
  }

  if (aktuell) stufen.push(aktuell);
  return stufen;
}

function stufeLesen(text) {
  const stufe = { name: null, bedingungen: [] };
  let rest = text;

  const typ = /^([a-zA-Z][a-zA-Z0-9-]*|\*)/.exec(rest);
  if (typ) { stufe.name = typ[1] === "*" ? null : typ[1].toLowerCase(); rest = rest.slice(typ[0].length); }

  const muster = /\[\s*([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:([~^$*|]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\]\s]*))\s*)?(i|I)?\s*\]/g;
  let t;
  while ((t = muster.exec(rest)) !== null) {
    stufe.bedingungen.push({
      name: t[1].toLowerCase(),
      operator: t[2] || null,
      wert: t[3] !== undefined ? t[3] : (t[4] !== undefined ? t[4] : t[5]),
      egal: Boolean(t[6])
    });
  }
  return stufe;
}

function bedingungPasst(el, b) {
  const roh = el.getAttribute(b.name);
  if (roh === null) return false;
  if (!b.operator) return true;

  const a = b.egal ? roh.toLowerCase() : roh;
  const v = b.egal ? String(b.wert).toLowerCase() : String(b.wert);

  switch (b.operator) {
    case "=": return a === v;
    case "~=": return a.split(/\s+/).indexOf(v) !== -1;
    case "^=": return a.indexOf(v) === 0;
    case "$=": return v.length <= a.length && a.slice(a.length - v.length) === v;
    case "*=": return a.indexOf(v) !== -1;
    case "|=": return a === v || a.indexOf(v + "-") === 0;
    default: return false;
  }
}

function stufePasst(el, stufe) {
  if (stufe.name && el.localName !== stufe.name) return false;
  for (const b of stufe.bedingungen) if (!bedingungPasst(el, b)) return false;
  return true;
}

// Prueft einen einzelnen Knoten gegen die ganze Kommaliste, ohne Vorfahren.
function passtAufEinen(el, auswahl) {
  for (const teil of zerlegen(auswahl)) {
    if (teil.length && stufePasst(el, teil[teil.length - 1])) {
      if (teil.length === 1) return true;
      if (vorfahrenPassen(el, teil.slice(0, -1))) return true;
    }
  }
  return false;
}

function vorfahrenPassen(el, stufen) {
  let n = el.parentElement;
  let i = stufen.length - 1;
  while (n && i >= 0) {
    if (stufePasst(n, stufen[i])) i--;
    n = n.parentElement;
  }
  return i < 0;
}

function suchen(wurzel, auswahl, nurErster) {
  const stufenlisten = zerlegen(auswahl);
  const aus = [];
  let fertig = false;

  durchlaufen(wurzel, (el) => {
    if (fertig) return;
    for (const teil of stufenlisten) {
      if (!teil.length) continue;
      if (!stufePasst(el, teil[teil.length - 1])) continue;
      if (teil.length > 1 && !vorfahrenPassen(el, teil.slice(0, -1))) continue;
      aus.push(el);
      if (nurErster) fertig = true;
      return;
    }
  });

  return aus;
}

/* ---------- Parser ---------- */

export function parseHTML(quelle) {
  const dok = new Dokument();
  const html = new Element("html", new Map());
  const kopf = new Element("head", new Map());
  const koerper = new Element("body", new Map());

  anhaengen(dok, html);
  anhaengen(html, kopf);
  anhaengen(html, koerper);

  let stapel = [kopf];
  let inKopf = true;
  let i = 0;
  const n = quelle.length;

  function aktuell() { return stapel[stapel.length - 1]; }

  function nachKoerper() {
    if (!inKopf) return;
    inKopf = false;
    stapel = [koerper];
  }

  function textEinfuegen(roh) {
    if (!roh) return;
    if (inKopf && !roh.trim()) return;          // Leerraum im Kopf verwerfen
    if (inKopf && roh.trim()) nachKoerper();
    anhaengen(aktuell(), new Text(zeichenAufloesen(roh)));
  }

  while (i < n) {
    const spitz = quelle.indexOf("<", i);

    if (spitz === -1) { textEinfuegen(quelle.slice(i)); break; }
    if (spitz > i) textEinfuegen(quelle.slice(i, spitz));

    // Kommentar
    if (quelle.startsWith("<!--", spitz)) {
      const schluss = quelle.indexOf("-->", spitz + 4);
      const ende = schluss === -1 ? n : schluss + 3;
      anhaengen(aktuell(), new Kommentar(quelle.slice(spitz + 4, schluss === -1 ? n : schluss)));
      i = ende;
      continue;
    }

    // Doctype und andere Anweisungen
    if (quelle.startsWith("<!", spitz) || quelle.startsWith("<?", spitz)) {
      const schluss = quelle.indexOf(">", spitz);
      i = schluss === -1 ? n : schluss + 1;
      continue;
    }

    // Endmarke
    if (quelle.startsWith("</", spitz)) {
      const schluss = quelle.indexOf(">", spitz);
      const name = quelle.slice(spitz + 2, schluss === -1 ? n : schluss).trim().toLowerCase();
      i = schluss === -1 ? n : schluss + 1;

      if (name === "head") { nachKoerper(); continue; }
      if (name === "body" || name === "html") { nachKoerper(); continue; }

      for (let s = stapel.length - 1; s >= 0; s--) {
        if (stapel[s].localName === name) { stapel.length = s === 0 ? 1 : s; break; }
      }
      continue;
    }

    // Startmarke
    const marke = markeLesen(quelle, spitz);
    if (!marke) { textEinfuegen(quelle.slice(spitz, spitz + 1)); i = spitz + 1; continue; }

    i = marke.ende;
    const name = marke.name;

    if (name === "html") { fuellen(html.attribute, marke.attribute); continue; }
    if (name === "head") { inKopf = true; stapel = [kopf]; continue; }
    if (name === "body") { fuellen(koerper.attribute, marke.attribute); nachKoerper(); continue; }

    if (inKopf && !NUR_KOPF.has(name)) nachKoerper();

    // Elemente mit entfallender Endmarke schliessen
    const oben = aktuell();
    if (oben && oben.localName !== "head" && oben.localName !== "body") {
      let s = stapel.length - 1;
      while (s > 0) {
        const regel = SCHLIESST[stapel[s].localName];
        if (regel && regel.has(name)) { stapel.length = s; s--; } else break;
      }
    }

    const el = new Element(name, marke.attribute);
    anhaengen(aktuell(), el);

    if (LEER.has(name) || marke.selbstschliessend) continue;

    if (ROHTEXT.has(name)) {
      const schluss = endeSuchen(quelle, i, name);
      el.rohtext = zeichenAufloesen(quelle.slice(i, schluss.anfang));
      if (name === "script" || name === "style") el.rohtext = quelle.slice(i, schluss.anfang);
      i = schluss.ende;
      continue;
    }

    stapel.push(el);
  }

  return dok;
}

function anhaengen(eltern, kind) {
  kind.parentNode = eltern;
  eltern.childNodes.push(kind);
}

function fuellen(ziel, quelle) {
  for (const [k, v] of quelle) if (!ziel.has(k)) ziel.set(k, v);
}

function endeSuchen(quelle, ab, name) {
  const muster = new RegExp("</" + name + "\\s*>", "i");
  const rest = quelle.slice(ab);
  const t = muster.exec(rest);
  if (!t) return { anfang: quelle.length, ende: quelle.length };
  return { anfang: ab + t.index, ende: ab + t.index + t[0].length };
}

function markeLesen(quelle, ab) {
  const namensmuster = /^<([a-zA-Z][a-zA-Z0-9:-]*)/.exec(quelle.slice(ab, ab + 64));
  if (!namensmuster) return null;

  const name = namensmuster[1].toLowerCase();
  let i = ab + namensmuster[0].length;
  const attribute = new Map();
  let selbstschliessend = false;
  const n = quelle.length;

  while (i < n) {
    while (i < n && /\s/.test(quelle[i])) i++;
    if (i >= n) break;

    if (quelle[i] === ">") { i++; break; }
    if (quelle[i] === "/" && quelle[i + 1] === ">") { selbstschliessend = true; i += 2; break; }

    const namensteil = /^[^\s=\/>]+/.exec(quelle.slice(i));
    if (!namensteil) { i++; continue; }
    const attrName = namensteil[0].toLowerCase();
    i += namensteil[0].length;

    while (i < n && /\s/.test(quelle[i])) i++;

    let wert = "";
    if (quelle[i] === "=") {
      i++;
      while (i < n && /\s/.test(quelle[i])) i++;
      const z = quelle[i];
      if (z === '"' || z === "'") {
        const schluss = quelle.indexOf(z, i + 1);
        wert = quelle.slice(i + 1, schluss === -1 ? n : schluss);
        i = schluss === -1 ? n : schluss + 1;
      } else {
        const teil = /^[^\s>]*/.exec(quelle.slice(i));
        wert = teil ? teil[0] : "";
        i += wert.length;
      }
    }

    if (!attribute.has(attrName)) attribute.set(attrName, zeichenAufloesen(wert));
  }

  return { name, attribute, selbstschliessend, ende: i };
}

/* ---------- XML, fuer den Sitemap-Pruefer ---------- */

export function parseXML(quelle) {
  // Fuer unsere Zwecke genuegt derselbe Parser ohne die HTML-Sonderregeln:
  // Sitemaps haben keine entfallenden Endmarken und keine Rohtextelemente.
  const dok = new Dokument();
  const stapel = [dok];
  let i = 0;
  const n = quelle.length;
  let fehler = null;

  while (i < n) {
    const spitz = quelle.indexOf("<", i);
    if (spitz === -1) break;

    if (spitz > i) {
      const roh = quelle.slice(i, spitz);
      if (roh.trim()) anhaengen(stapel[stapel.length - 1], new Text(zeichenAufloesen(roh)));
    }

    if (quelle.startsWith("<!--", spitz)) {
      const schluss = quelle.indexOf("-->", spitz + 4);
      i = schluss === -1 ? n : schluss + 3;
      continue;
    }
    if (quelle.startsWith("<?", spitz) || quelle.startsWith("<!", spitz)) {
      const schluss = quelle.indexOf(">", spitz);
      i = schluss === -1 ? n : schluss + 1;
      continue;
    }
    if (quelle.startsWith("</", spitz)) {
      const schluss = quelle.indexOf(">", spitz);
      const name = quelle.slice(spitz + 2, schluss === -1 ? n : schluss).trim().toLowerCase();
      i = schluss === -1 ? n : schluss + 1;
      const oben = stapel[stapel.length - 1];
      if (stapel.length > 1 && oben.localName === name) stapel.pop();
      else if (!fehler) fehler = "Endmarke </" + name + "> passt nicht zu <" + (oben.localName || "?") + ">";
      continue;
    }

    const marke = markeLesen(quelle, spitz);
    if (!marke) { i = spitz + 1; continue; }
    i = marke.ende;

    const el = new Element(marke.name, marke.attribute);
    el.namespaceURI = marke.attribute.get("xmlns") || null;
    anhaengen(stapel[stapel.length - 1], el);
    if (!marke.selbstschliessend) stapel.push(el);
  }

  if (!fehler && stapel.length > 1) fehler = "<" + stapel[stapel.length - 1].localName + "> wurde nicht geschlossen";
  dok.parserfehler = fehler;
  return dok;
}
