/* Digital unterschreiben — kryptografisch, nicht als Bild.

   Der Unterschied zur Unterschrift unter „Werkzeuge": die dort ist ein Bild
   auf der Seite. Sie sieht aus wie eine Unterschrift und beweist nichts. Die
   hier ist eine Signatur nach PAdES: über den Bytes der Datei wird ein
   Hashwert gebildet und mit dem privaten Schlüssel aus Ihrer .p12-Datei
   signiert. Ändert danach jemand ein Zeichen, meldet jeder Betrachter
   „Dokument wurde nach der Unterschrift verändert".

   Ablauf, weil er nicht offensichtlich ist:

   1. In das Dokument wird ein Unterschriftsfeld gelegt, dessen /Contents ein
      leerer Platzhalter fester Länge ist und dessen /ByteRange aus vier
      Platzhalterzahlen besteht.
   2. Das Dokument wird gesichert — ohne Objektströme, damit der Platzhalter
      im Klartext auffindbar bleibt.
   3. Im Ergebnis wird der Platzhalter gesucht. Daraus ergibt sich der
      ByteRange: alles vor und alles nach dem Platzhalter.
   4. Über genau diese beiden Stücke wird der Hashwert gebildet und ein
      CMS-SignedData gebaut (abgetrennt, mit signierten Attributen und
      ESS-Zertifikatsverweis — das verlangt PAdES).
   5. Die DER-Bytes wandern als Hex in den Platzhalter. Die Datei ist damit
      unterschrieben, ohne dass sich ihre Länge geändert hat.

   Grenzen, offen gesagt:

   · **Eine Unterschrift je Datei.** Eine zweite über die erste hinweg
     verlangt eine inkrementelle Ergänzung — die Datei müsste angehängt
     statt neu geschrieben werden. Das kann das Studio nicht; es würde
     die erste Unterschrift brechen. Sie sagt es deshalb, statt es zu tun.
   · **Kein Zeitstempel von einer TSA.** Die Signaturzeit ist die Uhr dieses
     Geräts (signingTime). Für PAdES-B-T bräuchte es einen Zeitstempeldienst
     im Netz — und der Saal soll von nichts abhängen.
   · **Keine Prüfung der Sperrlisten (OCSP/CRL).** Damit ist das Ergebnis
     PAdES-B-B, nicht -B-LT.

   Damit ist es eine fortgeschrittene elektronische Signatur. Ob sie als
   qualifiziert gilt, entscheidet allein Ihr Zertifikat und dessen
   Aussteller — nicht dieses Programm. */

import { fremdWeg } from './kern.js';

let forge = null;
async function starteForge() {
  if (!forge) forge = (await import(fremdWeg('forge.mjs'))).default;
  return forge;
}

/* 16 kB Platz für die Signatur. RSA-2048 mit Kette braucht 3 bis 6 kB;
   der Rest ist Luft für lange Ketten und größere Schlüssel. */
const PLATZ = 16384;
const PLATZHALTER_ZAHL = 9999999999;   // zehn Stellen, genug für 10-GB-Dateien

/**
 * Liest eine .p12/.pfx und gibt Schlüssel und Kette zurück.
 * @throws bei falschem Kennwort — mit einer Meldung, die das auch sagt.
 */
export async function oeffneAusweis(bytes, kennwort) {
  const f = await starteForge();
  const roh = f.util.createBuffer(new Uint8Array(bytes));
  let p12;
  try {
    p12 = f.pkcs12.pkcs12FromAsn1(f.asn1.fromDer(roh), false, kennwort);
  } catch (fehler) {
    const text = String(fehler?.message || fehler);
    if (/mac|password|invalid/i.test(text)) throw new Error('Falsches Kennwort für die Ausweisdatei.');
    throw new Error(`Die Ausweisdatei ließ sich nicht lesen: ${text}`);
  }

  const schluesselTaschen = {
    ...p12.getBags({ bagType: f.pki.oids.pkcs8ShroudedKeyBag }),
    ...p12.getBags({ bagType: f.pki.oids.keyBag }),
  };
  const schluessel = Object.values(schluesselTaschen).flat().find((t) => t?.key)?.key;
  if (!schluessel) throw new Error('In der Datei steckt kein privater Schlüssel.');

  const zertTaschen = p12.getBags({ bagType: f.pki.oids.certBag })[f.pki.oids.certBag] || [];
  const zertifikate = zertTaschen.map((t) => t.cert).filter(Boolean);
  if (!zertifikate.length) throw new Error('In der Datei steckt kein Zertifikat.');

  /* Das eigene Zertifikat ist das, dessen öffentlicher Schlüssel zum privaten
     passt. Der Rest ist die Kette bis zur Wurzel. */
  const eigenes = zertifikate.find((z) => z.publicKey?.n?.equals?.(schluessel.n)) || zertifikate[0];
  const kette = [eigenes, ...zertifikate.filter((z) => z !== eigenes)];

  return { schluessel, zertifikat: eigenes, kette, beschreibung: beschreibeZertifikat(eigenes) };
}

/** Menschenlesbare Angaben aus einem Zertifikat. */
export function beschreibeZertifikat(zert) {
  const feld = (name) => zert.subject.getField(name)?.value || '';
  const aussteller = (name) => zert.issuer.getField(name)?.value || '';
  return {
    name: feld('CN') || feld('O') || '(ohne Namen)',
    organisation: feld('O'),
    land: feld('C'),
    aussteller: aussteller('CN') || aussteller('O') || '(unbekannt)',
    gueltigVon: zert.validity.notBefore,
    gueltigBis: zert.validity.notAfter,
    seriennummer: zert.serialNumber,
    abgelaufen: zert.validity.notAfter < new Date(),
    nochNichtGueltig: zert.validity.notBefore > new Date(),
  };
}

/**
 * Legt ein Unterschriftsfeld mit Platzhalter an.
 * Wird vor dem Sichern gerufen; danach muss `fuelleSignatur` das Ergebnis
 * bearbeiten.
 */
export function legePlatzhalterAn(ziel, pdflib, { grund, ort, name, kontakt } = {}) {
  const { PDFName, PDFNumber, PDFString, PDFHexString, PDFArray, PDFDict } = pdflib;
  const kontext = ziel.context;

  const signatur = kontext.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'ETSI.CAdES.detached',   // PAdES
    M: PDFString.fromDate(new Date()),
  });
  /* Der Platzhalter muss vor dem Sichern schon seine endgültige Länge haben —
     danach darf sich an der Datei nichts mehr verschieben. */
  signatur.set(PDFName.of('Contents'), PDFHexString.of('0'.repeat(PLATZ * 2)));
  signatur.set(PDFName.of('ByteRange'), kontext.obj([
    0, PLATZHALTER_ZAHL, PLATZHALTER_ZAHL, PLATZHALTER_ZAHL,
  ]));
  if (grund) signatur.set(PDFName.of('Reason'), PDFString.of(grund));
  if (ort) signatur.set(PDFName.of('Location'), PDFString.of(ort));
  if (name) signatur.set(PDFName.of('Name'), PDFString.of(name));
  if (kontakt) signatur.set(PDFName.of('ContactInfo'), PDFString.of(kontakt));
  const signaturRef = kontext.register(signatur);

  /* Ein leeres Unterschriftsfeld im Dokument wird bevorzugt: dann sitzt die
     Unterschrift dort, wo sie hingehört. Sonst ein unsichtbares neues Feld. */
  const vorhanden = findeLeeresSignaturfeld(ziel, pdflib);
  if (vorhanden) {
    vorhanden.set(PDFName.of('V'), signaturRef);
    setzeSigFlags(ziel, pdflib);
    return;
  }

  const seite = ziel.getPage(0);
  const widget = kontext.obj({
    Type: 'Annot', Subtype: 'Widget', FT: 'Sig',
    T: PDFString.of(freierFeldname(ziel, pdflib)),
    F: PDFNumber.of(132),              // unsichtbar, aber vorhanden
    Rect: [0, 0, 0, 0],
    P: seite.ref,
    V: signaturRef,
  });
  const widgetRef = kontext.register(widget);

  let annots = seite.node.get(PDFName.of('Annots'));
  if (!annots) { annots = PDFArray.withContext(kontext); seite.node.set(PDFName.of('Annots'), annots); }
  const annotsArray = annots instanceof PDFArray ? annots : kontext.lookup(annots, PDFArray);
  annotsArray.push(widgetRef);

  const acro = holeAcroForm(ziel, pdflib);
  const felder = acro.get(PDFName.of('Fields'));
  const felderArray = felder instanceof PDFArray ? felder : kontext.lookup(felder, PDFArray);
  felderArray.push(widgetRef);
  setzeSigFlags(ziel, pdflib);
}

function holeAcroForm(ziel, { PDFName, PDFDict, PDFArray }) {
  const kontext = ziel.context;
  let acro = ziel.catalog.get(PDFName.of('AcroForm'));
  if (!acro) {
    acro = PDFDict.withContext(kontext);
    acro.set(PDFName.of('Fields'), PDFArray.withContext(kontext));
    ziel.catalog.set(PDFName.of('AcroForm'), acro);
  }
  const dict = acro instanceof PDFDict ? acro : kontext.lookup(acro, PDFDict);
  if (!dict.get(PDFName.of('Fields'))) dict.set(PDFName.of('Fields'), PDFArray.withContext(kontext));
  return dict;
}

function setzeSigFlags(ziel, pdflib) {
  const { PDFName, PDFNumber } = pdflib;
  holeAcroForm(ziel, pdflib).set(PDFName.of('SigFlags'), PDFNumber.of(3));
}

function findeLeeresSignaturfeld(ziel, { PDFName, PDFDict, PDFArray }) {
  const kontext = ziel.context;
  const acro = holeAcroForm(ziel, { PDFName, PDFDict, PDFArray });
  const felder = acro.get(PDFName.of('Fields'));
  const liste = felder instanceof PDFArray ? felder : kontext.lookup(felder, PDFArray);
  if (!liste) return null;
  for (let i = 0; i < liste.size(); i++) {
    const dict = kontext.lookup(liste.get(i), PDFDict);
    if (!dict) continue;
    if (String(dict.get(PDFName.of('FT'))) !== '/Sig') continue;
    if (dict.get(PDFName.of('V'))) continue;    // schon unterschrieben
    return dict;
  }
  return null;
}

function freierFeldname(ziel, { PDFName, PDFDict, PDFArray }) {
  const kontext = ziel.context;
  const acro = holeAcroForm(ziel, { PDFName, PDFDict, PDFArray });
  const felder = kontext.lookup(acro.get(PDFName.of('Fields')), PDFArray);
  const vergeben = new Set();
  for (let i = 0; i < (felder?.size() || 0); i++) {
    const dict = kontext.lookup(felder.get(i), PDFDict);
    const t = dict?.get(PDFName.of('T'));
    if (t) vergeben.add(String(t.decodeText?.() ?? t));
  }
  let n = 1;
  while (vergeben.has(`Unterschrift ${n}`)) n += 1;
  return `Unterschrift ${n}`;
}

/**
 * Füllt den Platzhalter im gesicherten PDF mit der echten Signatur.
 * @param {Uint8Array} bytes  Ergebnis von `ziel.save({ useObjectStreams: false })`
 * @returns {Promise<Uint8Array>} dieselbe Länge, jetzt unterschrieben
 */
export async function fuelleSignatur(bytes, ausweis) {
  const f = await starteForge();
  const roh = new Uint8Array(bytes);
  const text = latin1(roh);

  /* Der Platzhalter ist die einzige Stelle mit so vielen Nullen am Stück. */
  const nullen = '0'.repeat(PLATZ * 2);
  const inhaltStart = text.indexOf(`<${nullen}>`);
  if (inhaltStart < 0) throw new Error('Der Platzhalter für die Unterschrift wurde nicht gefunden.');
  const inhaltEnde = inhaltStart + PLATZ * 2 + 2;    // einschließlich < und >

  const bereich = [0, inhaltStart, inhaltEnde, roh.length - inhaltEnde];

  /* ByteRange eintragen — mit derselben Byteanzahl wie der Platzhalter,
     sonst verschiebt sich alles dahinter und der Hashwert stimmt nicht mehr. */
  /* Wie pdf-lib die Klammern setzt, ist seine Sache — gesucht wird deshalb
     mit einem Muster, nicht mit einer Zeichenkette. */
  const muster = new RegExp(`\\[\\s*0\\s+${PLATZHALTER_ZAHL}\\s+${PLATZHALTER_ZAHL}\\s+${PLATZHALTER_ZAHL}\\s*\\]`);
  const treffer = muster.exec(text);
  if (!treffer) throw new Error('Der Platzhalter für den ByteRange wurde nicht gefunden.');
  const platzhalterBereich = treffer[0];
  let neuerBereich = `[${bereich.join(' ')}]`;
  if (neuerBereich.length > platzhalterBereich.length) throw new Error('Der ByteRange passt nicht in den Platzhalter.');
  neuerBereich = `${neuerBereich.slice(0, -1).padEnd(platzhalterBereich.length - 1, ' ')}]`;
  schreibeLatin1(roh, treffer.index, neuerBereich);

  /* Genau die beiden Stücke, die der ByteRange nennt — nicht mehr. */
  const zuSignieren = new Uint8Array(bereich[1] + bereich[3]);
  zuSignieren.set(roh.subarray(0, bereich[1]), 0);
  zuSignieren.set(roh.subarray(bereich[2], bereich[2] + bereich[3]), bereich[1]);

  const der = baueCms(f, zuSignieren, ausweis);
  const hex = f.util.bytesToHex(der).toUpperCase();
  if (hex.length > PLATZ * 2) {
    throw new Error(`Die Signatur ist mit ${Math.ceil(hex.length / 2)} Bytes größer als der Platz von ${PLATZ} Bytes.`);
  }
  schreibeLatin1(roh, inhaltStart + 1, hex.padEnd(PLATZ * 2, '0'));

  return roh;
}

/* ---------- CMS SignedData ------------------------------------------------- */

/* Von Hand zusammengesetzt statt mit forge.pkcs7, aus einem Grund: PAdES
   verlangt das signierte Attribut `signingCertificateV2` (ESS, OID
   1.2.840.113549.1.9.16.2.47). Es bindet die Signatur an genau dieses
   Zertifikat und verhindert, dass jemand die Signatur einem anderen
   Zertifikat unterschiebt. forge kann in seinen signierten Attributen nur
   drei feste Sorten schreiben; ein eigenes fällt bei ihm als leere Menge
   heraus — strukturell gültig, inhaltlich wertlos.

   Was hier passiert, ist ausschließlich Kodierung nach RFC 5652 und RFC 5035.
   Gehasht und signiert wird weiterhin von forge. Es entsteht keine Zeile
   eigener Kryptografie. */

const OID = {
  signedData: '1.2.840.113549.1.7.2',
  data: '1.2.840.113549.1.7.1',
  sha256: '2.16.840.1.101.3.4.2.1',
  rsa: '1.2.840.113549.1.1.1',
  contentType: '1.2.840.113549.1.9.3',
  messageDigest: '1.2.840.113549.1.9.4',
  signingTime: '1.2.840.113549.1.9.5',
  signingCertificateV2: '1.2.840.113549.1.9.16.2.47',
};

function baueCms(f, daten, { schluessel, zertifikat, kette }) {
  const { asn1 } = f;
  const U = asn1.Class.UNIVERSAL;
  const K = asn1.Class.CONTEXT_SPECIFIC;
  const T = asn1.Type;

  const folge = (...kinder) => asn1.create(U, T.SEQUENCE, true, kinder.flat().filter(Boolean));
  const menge = (...kinder) => asn1.create(U, T.SET, true, kinder.flat().filter(Boolean));
  const oid = (wert) => asn1.create(U, T.OID, false, asn1.oidToDer(wert).getBytes());
  const oktett = (bytes) => asn1.create(U, T.OCTETSTRING, false, bytes);
  const ganz = (n) => asn1.create(U, T.INTEGER, false, asn1.integerToDer(n).getBytes());
  const algorithmus = (wert, mitNull = true) =>
    folge(oid(wert), mitNull ? asn1.create(U, T.NULL, false, '') : null);

  /* Aussteller und Seriennummer werden aus dem Zertifikat selbst genommen,
     nicht neu erzeugt: Byte für Byte dasselbe, sonst findet ein Prüfer das
     Zertifikat nicht wieder. */
  const zertAsn1 = f.pki.certificateToAsn1(zertifikat);
  const tbs = zertAsn1.value[0];
  const hatVersion = tbs.value[0].tagClass === K && tbs.value[0].type === 0;
  const seriennummer = tbs.value[hatVersion ? 1 : 0];
  const aussteller = tbs.value[hatVersion ? 3 : 2];

  const zertDer = asn1.toDer(zertAsn1).getBytes();
  const zertHash = f.md.sha256.create().update(zertDer).digest().getBytes();

  const inhaltsHash = f.md.sha256.create().update(latin1(daten)).digest().getBytes();

  /* ESSCertIDv2 ::= SEQUENCE { hashAlgorithm DEFAULT sha256, certHash,
                                issuerSerial OPTIONAL }
     Der Standardwert sha256 wird nach DER weggelassen. */
  const essZertId = folge(
    oktett(zertHash),
    folge(folge(asn1.create(K, 4, true, [aussteller])), seriennummer));
  const signingCertificateV2 = folge(menge(essZertId));

  const attribut = (typ, wert) => folge(oid(typ), menge(wert));
  const attribute = [
    attribut(OID.contentType, oid(OID.data)),
    attribut(OID.signingTime, asn1.create(U, T.UTCTIME, false, asn1.dateToUtcTime(new Date()))),
    attribut(OID.messageDigest, oktett(inhaltsHash)),
    attribut(OID.signingCertificateV2, signingCertificateV2),
  ];

  /* Signiert wird die DER-Form der Attributmenge mit dem Kennzeichen SET
     (0x31) — nicht mit dem [0] der SignerInfo. Das steht so in RFC 5652
     §5.4 und ist die Stelle, an der selbstgebaute Signaturen scheitern. */
  const attributeAlsMenge = menge(attribute);
  const attributeDer = asn1.toDer(attributeAlsMenge).getBytes();

  const zuSignieren = f.md.sha256.create().update(attributeDer);
  const signatur = schluessel.sign(zuSignieren, 'RSASSA-PKCS1-V1_5');

  /* In der SignerInfo tragen dieselben Attribute das Kennzeichen [0]. */
  const attributeAlsKontext = asn1.create(K, 0, true, attribute);

  const signerInfo = folge(
    ganz(1),
    folge(aussteller, seriennummer),
    algorithmus(OID.sha256),
    attributeAlsKontext,
    algorithmus(OID.rsa),
    oktett(signatur));

  const zertifikate = asn1.create(K, 0, true, kette.map((z) => f.pki.certificateToAsn1(z)));

  const signedData = folge(
    ganz(1),
    menge(algorithmus(OID.sha256)),
    folge(oid(OID.data)),          // abgetrennt: kein eContent
    zertifikate,
    menge(signerInfo));

  const inhalt = folge(oid(OID.signedData), asn1.create(K, 0, true, [signedData]));
  return asn1.toDer(inhalt).getBytes();
}

/* ---------- Bytes und Text ------------------------------------------------- */

function latin1(bytes) {
  let text = '';
  const stueck = 0x8000;
  for (let i = 0; i < bytes.length; i += stueck) {
    text += String.fromCharCode.apply(null, bytes.subarray(i, i + stueck));
  }
  return text;
}

function schreibeLatin1(bytes, versatz, text) {
  for (let i = 0; i < text.length; i++) bytes[versatz + i] = text.charCodeAt(i) & 0xff;
}
