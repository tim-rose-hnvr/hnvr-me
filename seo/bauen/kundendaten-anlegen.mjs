/* seo-rank.me — den Ablageort fuer abgelegte Pruefungen anlegen.

   Die Anmeldung laeuft schon (gemessen, siehe Kopf von
   site/assets/js/konto.js). Was noch fehlt, ist die Sammlung, in die
   eine abgelegte Pruefung geschrieben wird. Sie liegt auf derselben
   Wix-Site wie die Mitglieder und muss EINMAL angelegt werden.

   Warum als Skript und nicht von Hand: die Berechtigungen sind der
   ganze Punkt. Alle vier stehen auf SITE_MEMBER_AUTHOR — jedes Konto
   liest und schreibt ausschliesslich die eigenen Eintraege. Wer das im
   Dashboard zusammenklickt, setzt leicht `SITE_MEMBER` und macht damit
   jede abgelegte Pruefung fuer jedes andere Mitglied lesbar.

   Aufruf:
     WIX_API_KEY=<schluessel> node bauen/kundendaten-anlegen.mjs
     WIX_API_KEY=<schluessel> node bauen/kundendaten-anlegen.mjs --pruefen

   Den Schluessel gibt es unter https://manage.wix.com/account/api-keys
   mit dem Recht „Manage Data Collections". Er gehoert NICHT in eine
   Datei dieses Projekts. */

const SITE = "e8492887-5537-412e-a484-297fb7a6ba28"; /* Wix-Site hinter www.hnvr.me */
const SAMMLUNG = "seorank-pruefungen";
const WIX = "https://www.wixapis.com";

const schluessel = process.env.WIX_API_KEY;
const nurPruefen = process.argv.includes("--pruefen");

if (!schluessel) {
  console.error("Ohne WIX_API_KEY geht es nicht.");
  console.error("  WIX_API_KEY=<schluessel> node bauen/kundendaten-anlegen.mjs");
  process.exit(1);
}

async function ruf(pfad, art, rumpf) {
  const a = await fetch(WIX + pfad, {
    method: art,
    headers: {
      "content-type": "application/json",
      authorization: schluessel,
      "wix-site-id": SITE
    },
    body: rumpf ? JSON.stringify(rumpf) : undefined
  });
  const text = await a.text();
  let daten = null;
  try { daten = text ? JSON.parse(text) : null; } catch { daten = null; }
  return { ok: a.ok, status: a.status, daten, text };
}

/* Die Felder sind dieselben, die `ausBefund` in konto.js schreibt.
   Wer hier eines aendert, aendert es dort mit — sonst landet es
   stillschweigend als schemaloses Feld in der Sammlung (Wix erzwingt
   das Schema NICHT). */
const sammlung = {
  id: SAMMLUNG,
  displayName: "seo-rank.me Pruefungen",
  displayField: "adresse",
  permissions: {
    read: "SITE_MEMBER_AUTHOR",
    insert: "SITE_MEMBER_AUTHOR",
    update: "SITE_MEMBER_AUTHOR",
    remove: "SITE_MEMBER_AUTHOR"
  },
  fields: [
    { key: "adresse", displayName: "Geprueft", type: "TEXT" },
    { key: "titel", displayName: "Titel der Seite", type: "TEXT" },
    { key: "umfang", displayName: "Umfang", type: "TEXT" },
    { key: "wert", displayName: "Wert", type: "NUMBER" },
    { key: "kritisch", displayName: "Kritisch", type: "NUMBER" },
    { key: "wichtig", displayName: "Wichtig", type: "NUMBER" },
    { key: "hinweise", displayName: "Hinweise", type: "NUMBER" },
    { key: "befunde", displayName: "Befunde", type: "OBJECT" },
    { key: "geprueft", displayName: "Zeitpunkt", type: "DATETIME" }
  ]
};

const vorhanden = await ruf("/wix-data/v2/collections/" + encodeURIComponent(SAMMLUNG), "GET");

if (vorhanden.ok) {
  const c = vorhanden.daten?.collection || vorhanden.daten?.dataCollection || {};
  const r = c.permissions || {};
  console.log("Die Sammlung " + SAMMLUNG + " gibt es schon.");
  console.log("  Felder:        " + (c.fields || []).map((f) => f.key).join(", "));
  console.log("  Berechtigung:  lesen " + r.read + " · anlegen " + r.insert
    + " · aendern " + r.update + " · loeschen " + r.remove);
  const streng = ["read", "insert", "update", "remove"].every((s) => r[s] === "SITE_MEMBER_AUTHOR");
  console.log(streng
    ? "  Jedes Konto sieht ausschliesslich die eigenen Eintraege."
    : "  ACHTUNG: nicht alle vier stehen auf SITE_MEMBER_AUTHOR. Dann sehen Mitglieder fremde Eintraege.");
  process.exit(streng ? 0 : 1);
}

if (vorhanden.status !== 404) {
  console.error("Nachsehen ging schief: HTTP " + vorhanden.status + " " + vorhanden.text.slice(0, 300));
  process.exit(1);
}

console.log("Die Sammlung " + SAMMLUNG + " gibt es noch nicht.");
if (nurPruefen) {
  console.log("Mit --pruefen wird nichts angelegt. Ohne den Schalter noch einmal aufrufen.");
  process.exit(1);
}

const angelegt = await ruf("/wix-data/v2/collections", "POST", { collection: sammlung });
if (!angelegt.ok) {
  console.error("Anlegen ging schief: HTTP " + angelegt.status + " " + angelegt.text.slice(0, 500));
  process.exit(1);
}

console.log("Angelegt: " + SAMMLUNG + " mit " + sammlung.fields.length + " Feldern.");
console.log("Alle vier Rechte stehen auf SITE_MEMBER_AUTHOR.");
console.log("Ab jetzt traegt der Knopf „pruefung ablegen\" im Protokoll.");
