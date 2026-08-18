/**
 * Youbooth – Fotobox Web-App Server
 * Booth, Live-Mosaik (2. Bildschirm / IP), Gäste-Upload, QR-Sharing,
 * Admin-Panel mit Vorlagen-Editor und Fernsteuerung.
 * Läuft komplett lokal/offline; YOUBOOTH_BASE_URL setzen, wenn öffentlich
 * unter https://youbooth.me erreichbar (Reverse-Proxy / Tunnel).
 */
const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

/* ---------- Die Adresse der Zentrale steht an EINER Stelle ----------
   Bis die eigene Domain steht, laeuft alles ueber diese Uebergangsadresse.
   Sie hier zu aendern reicht: Standardeinstellungen, Update-Pruefung,
   Aktivierung und Kopplung lesen alle von hier. */
const ZENTRALE = 'https://pic-me-app-7c4cb979-hnvrme.wix-site-host.com';
const crypto = require('crypto');
const QRCode = require('qrcode');
const kamera = require('./kamera');
const hashtag = require('./hashtag');
const zertifikat = require('./zertifikat');
const https = require('node:https');
const { WebSocketServer } = require('ws');

/* `PORT` ist bewusst veränderlich: Ist 3377 von einem fremden Programm belegt,
   weicht die Box auf den nächsten freien Port aus (siehe `server.on('error')`
   ganz unten) und schreibt den tatsächlich gebundenen Port hier zurück.
   Alles andere — QR-Adressen, `/api/netz`, die Statusauskunft — liest von hier
   und stimmt dadurch automatisch mit. Stünde hier ein `const`, zeigten die
   QR-Codes nach einem Ausweichen auf einen toten Port. */
let PORT = Number(process.env.PORT) || 3377;
const PORT_WUNSCH = PORT;
const PUBLIC_BASE = (process.env.YOUBOOTH_BASE_URL || '').replace(/\/$/, '');
/* Edition: 'cloud' = Web-App ohne Drucken (zentral gehostet),
   'desktop' = volle System-App (Windows/macOS) mit Drucken & Hardware. */
const EDITION = (process.env.YOUBOOTH_EDITION || 'desktop').toLowerCase() === 'cloud' ? 'cloud' : 'desktop';
const CAN_PRINT = EDITION === 'desktop';
/* Die Fassung des PROGRAMMS — bewusst nicht `require('./package.json')`:
   Diese Datei kann aus einem nachgeladenen Inhaltsordner laufen, und dann
   läse ein relatives `require` dessen package.json. Zwei verschiedene Dinge
   („welches Programm" und „welche Inhalte") trügen denselben Namen, und
   spätestens beim Update-Vergleich fiele die Box auf die Nase. */
/* Eine Fassungsnummer für das ganze Programm — die aus `booth/package.json`.
   Die daneben (`server/package.json`) trägt keine: Sie gibt es nur, damit Node
   diesen Ordner als CommonJS liest. Stünde dort eine zweite Nummer, liefen sie
   auseinander, und die Selbstaktualisierung vergliche die falsche. */
const APP_VERSION =
  /* In der Desktop-Hülle kommt die Fassung von dort: Sie kennt sie ohnehin,
     und im gepackten Programm liegt die `package.json` in einem Archiv, aus
     dem dieser Prozess nicht lesen kann — genau daran ist der erste Windows-
     Installer gescheitert. Ohne Hülle bleibt der Weg über die Datei. */
  process.env.YOUBOOTH_FASSUNG ||
  require(path.join(process.env.YOUBOOTH_MITGELIEFERT || __dirname, '..', 'package.json')).version;
/* Beschreibbarer Datenordner: im gepackten Desktop-Build liegt der Code in
   einem schreibgeschützten app.asar – Fotos/Config gehören dann in den
   Nutzerordner (von electron/main.js via YOUBOOTH_DATEN gesetzt). */
/* Betriebsdaten liegen NEBEN dem Programm, nicht darin: Einstellungen,
   Vorlagen, Aufnahmen und der Lizenzschlüssel gehören dem Gerät. Lagen sie im
   Programmordner, landeten sie in der Versionsverwaltung und im Installer —
   beides ist einmal passiert. In der Desktop-Hülle zeigt `YOUBOOTH_DATEN` auf
   den Nutzerordner, denn dort ist das Programm schreibgeschützt. */
const DATA_DIR = process.env.YOUBOOTH_DATEN || path.join(__dirname, '..', 'daten');
const PHOTOS_DIR = path.join(DATA_DIR, 'photos');
const CONFIG_DIR = path.join(DATA_DIR, 'config');
const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
const HOTFOLDER_DIR = path.join(DATA_DIR, 'hotfolder');
/* Eigene Schriften des Betreibers. Sie liegen im Nutzerordner, nicht im
   Programm — ein Update darf sie nicht wegräumen. */
const SCHRIFT_DIR = path.join(DATA_DIR, 'schriften');
const HOTFOLDER_DONE = path.join(HOTFOLDER_DIR, 'gedruckt');
fs.mkdirSync(PHOTOS_DIR, { recursive: true });
fs.mkdirSync(CONFIG_DIR, { recursive: true });
fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
fs.mkdirSync(HOTFOLDER_DONE, { recursive: true });

/* ---------- Einstellungen & Vorlagen (persistiert als JSON) ---------- */

const SETTINGS_FILE = path.join(CONFIG_DIR, 'settings.json');
const TEMPLATES_FILE = path.join(CONFIG_DIR, 'templates.json');

/* Countdown-Animationen-Bibliothek (IDs müssen zu public/countdowns.js passen) */
const COUNTDOWN_STYLES = [
  'ring', 'pop', 'bar', 'flip', 'confetti', 'neon', 'film', 'emoji', 'bounce', 'glitch',
  'dots', 'heartbeat', 'flash', 'zoom', 'spin3d', 'wave', 'pixel', 'sparkle', 'balloon', 'gradient',
];

const DEFAULT_SETTINGS = {
  eventName: 'Youbooth Event',
  tagline: 'youbooth.me',
  countdown: 3,
  countdownStyle: 'ring',                       // ring | pop | bar
  modes: { photo: true, strip: true, boomerang: true, gif: true, video: false },
  /* GIF: Anzahl Einzelbilder, Standzeit je Bild, vor/zurück statt Sprung. */
  gif: { bilder: 6, msProBild: 180, pingpong: true },
  /* Was der Gast nach der Aufnahme sehen soll — Reihenfolge inbegriffen.
     Abgeschaut bei Breeze: nicht drei fest verdrahtete Knöpfe, sondern eine
     Auswahl, die der Betreiber je Feier setzt. `verwerfen` ist der Grund,
     warum das mehr ist als Kosmetik: Wer sein Bild nicht mag, soll es
     wegwerfen können, ohne dass es je gespeichert wird. */
  aktionen: { liste: ['nochmal', 'drucken', 'teilen'], gross: 'teilen' },
  /* Hashtag-Drucker: Beiträge aus dem Netz holen und (nach Freigabe) drucken.
     `moderation` ist mit Absicht standardmäßig an — ein Drucker, der
     ungefiltert ausgibt, was unter einem Hashtag auftaucht, ist auf einer
     Feier kein Dienst, sondern ein Haftungsfall. */
  hashtag: {
    enabled: false, quelle: 'mastodon', tag: '', instanz: 'mastodon.social',
    token: '', igNutzerId: '', endpunkt: '',
    intervallSek: 180, moderation: true, autoDruck: false, maxProStunde: 30,
  },
  /* Wo die Box nachsieht, ob es eine neuere Fassung gibt. ★ Der eingebaute
     Auto-Updater zeigt auf `youbooth.me/downloads/` — diese Adresse gibt es
     im DNS gar nicht, und `checkForUpdatesAndNotify().catch(() => {})`
     verschluckt den Fehlschlag. Jede installierte Box prüft seit jeher ins
     Leere. Deshalb hier eine eigene, sichtbare Prüfung gegen die Seite, die
     tatsächlich steht. */
  /* Die Box prüft NICHT mehr selbst auf neue Fassungen. Das macht die
     Desktop-Hülle über die Release-Liste, und zwei Quellen für dieselbe Sache
     laufen auseinander: Gemessen am 18.08. meldete die Box „Neue Fassung
     1.29.0" gegen ihre eigene 1.0.0 — die alte Zentrale kennt unsere Zählung
     nicht. Wer eine eigene Verteilstelle betreibt, schaltet es wieder ein. */
  update: { pruefen: false, url: '' },
  /* Darf der Hersteller aus der Ferne helfen (Diagnose, Einstellung, Neustart)?
     Voreingestellt ja – Support ist Teil des Produkts –, aber der Betreiber
     kann es im Cockpit abschalten, und jeder Eingriff steht im Protokoll. */
  fernwartung: { erlaubt: true, letzter: '' },
  /* Der Gast waehlt sein Layout. Aus bleibt aus: Ohne Auswahl laeuft der
     Ablauf wie bisher, ohne Zwischenschritt. */
  auswahl: { aktiv: false, vorlagen: [], sekunden: 12 },
  /* ---------- Was der Booth in unserer Oberflaeche zusaetzlich braucht ----
     Bewusst ein eigener Block: Was hier steht, gehoert zur Fuehrung des
     Gastes durch den Abend, nicht zur Technik der Box. So bleibt beim Lesen
     erkennbar, welche Einstellung wem gehoert. */
  booth: {
    /* Bewegung im Attract: ruhig, pulsender Startknopf oder Laufband. */
    attractstil: 'laufband',
    /* Weicher Auftritt beim Schrittwechsel. */
    uebergang: true,
    /* Sekunden Leerlauf, bis der Booth zum Attract zurueckspringt. */
    leerlauf: 45,
    /* Sekunden bis „Auto-Weiter" im Ergebnis. */
    autoWeiter: 8,
    /* Blitz im Ausloesemoment. */
    blitz: true,
    /* Nach wie vielen Tagen die Box ihre Aufnahmen wegraeumt. */
    loeschfristTage: 30,
  },
  /* Anzeigename dieser Box in der Kopfleiste. Nicht `brandName` — der gehoert
     dem White-Label und steht auf den Gaestebildschirmen. */
  boxName: 'Box #1',

  /* Ist der Einrichtungs-Assistent durch? Beim allerersten Start soll der
     Betreiber in fünf Schritten zu einer druckenden Box kommen und nicht in
     einer Einstellungswüste stehen. */
  eingerichtet: false,
  /* Kamerabild ausrichten. Hängt die Kamera über Kopf am Ring oder liegt das
     Tablet quer, war das Bild bisher nicht zu retten. */
  vorschau: { spiegeln: true, drehen: 0 },
  /* Profile: fertige Wege statt Einstellungen. Der Gast wählt „Hochzeitsfoto"
     und bekommt Modus, Vorlage und Filter in einem Zug — er muss nicht
     wissen, was ein Streifen ist. Sind keine Profile angelegt, bleibt das
     alte Modus-Menü stehen. */
  profile: { enabled: false, liste: [] },
  /* Welche Vorlage gedruckt wird. Die Kennungen müssen im Katalog stehen —
     sonst druckt die Box ein Ersatzlayout, und niemand merkt es vor dem
     ersten Abzug. `tools/vorlagen-uebernehmen.mjs` prüft das mit. */
  active: { strip: 'streifen-klassisch', single: 'foto-klassisch' },
  brandName: 'Youbooth',                           // Whitelabel: eigener Name
  whitelabel: false,                            // true = kein Youbooth-Branding auf Gäste-Screens
  logo: null,                                   // eigenes Logo (Data-URL)
  attract: { headline: '', hint: 'BERÜHREN ZUM STARTEN' },
  ticker: { enabled: false, text: '' },         // Laufband auf Mosaik & Säule
  mosaicMode: 'grid',                           // grid | overlay | logo | photomosaic
  mosaicTarget: null,                           // Zielbild fürs Photomosaik (Data-URL, klein)
  mosaicCols: 40,                               // Rasterspalten fürs Photomosaik
  mosaicStrength: 0.55,                         // Motiv-Tönung 0..1 (Fern-/Nahwirkung)
  mosaicSticker: false,                         // jede Photomosaik-Kachel als Sticker drucken
  printing: true,                               // false = komplett druckloser Betrieb

  /* ---------- Jede Gästebeschriftung ist eine Einstellung ----------
     Leer heißt ausdrücklich „nimm die Vorgabe aus dem Booth" — NICHT „zeige
     nichts an". Wer ein Feld in der Verwaltung leert, will die Vorgabe
     zurück; ein unbeschrifteter Knopf auf einer Feier wäre die schlechteste
     aller Auslegungen. Deshalb steht hier bewusst kein einziger Text: Die
     Vorgaben leben im HTML des Booths, an genau einer Stelle. Was hier
     landet, ist immer eine bewusste Abweichung. */
  texte: {},

  /* ---------- Wie viel Papier ein Abend kosten darf ----------
     Papier und Farbband sind die einzigen laufenden Kosten eines Abends, und
     ein Gast, der zehnmal auf „Drucken" tippt, merkt davon nichts. Die
     Grenzen hängen deshalb am Event, nicht am Gerät: Beim Hochzeitspaket sind
     zwei Abzüge je Runde vereinbart, beim Messestand vielleicht einer.
     0 heißt „keine Grenze".

     Die zeitliche Bremse steht bewusst NICHT hier, sondern als
     `druck.maxProStunde` beim Gerät: Sie schützt die Hardware vor einer
     leergedruckten Rolle und gilt unabhängig davon, welches Event läuft.
     Zwei Zeitgrenzen an zwei Stellen liefen unweigerlich auseinander. */
  druckGrenzen: {
    proRunde: 0,        // Abzüge je Aufnahme
    proEvent: 0,        // Abzüge insgesamt, seit das Event aktiv wurde
    /* Was passiert, wenn die Grenze erreicht ist: `hinweis` blendet eine
       Erklärung ein (der Gast versteht, warum), `verstecken` nimmt den Knopf
       weg (kein Betteln beim Personal). */
    beiGrenze: 'hinweis',
  },
  /* Zwei 2×6-Streifen nebeneinander auf ein 4×6-Blatt. Dye-Sub-Drucker rechnen
     je Blatt ab – so kostet ein Streifen die Hälfte. Geschnitten wird an der
     feinen Linie in der Mitte (oder vom Cutter des Druckers). */
  druck: {
    streifenDoppelt: false, schnittlinie: true,
    /* ★ Bremse gegen leergedrucktes Papier. Drucken muss aus dem WLAN
       erreichbar bleiben — der iPad-Booth und die Teilen-Station drucken von
       dort. Damit kann aber auch jemand den Knopf gedrückt halten und eine
       ganze Rolle verbrauchen. 60 Blatt je Stunde reichen jeder Feier; ein
       Betreiber, der mehr braucht, stellt es hoch. 0 = keine Grenze. */
    maxProStunde: 60,
  },
  printer: null,                                // vom System erkannter Drucker
  /* Foto-Weiterleitung an die Cloud. `secret` ist das Kennwort des gehosteten
     Relays – nur damit darf die Box dort ein NEUES Event anlegen. */
  cloud: { enabled: false, url: '', key: '', secret: '' },
  /* Meldung an die Youbooth-Zentrale: Box, Tagesnutzung und laufendes Event.
     `key` ist der Produktschlüssel (PM-…), über den die Zentrale den Kunden
     erkennt. Ohne Schlüssel wird nicht gemeldet. */
  melden: {
    enabled: false,
    url: ZENTRALE + '/api/box/melden',
    key: '',
    puls: 3,        // Sekunden zwischen zwei Auftragsabfragen (0 = aus)
    fotos: false,   // jedes Foto zusätzlich in die Cloud-Galerie laden
  },
  /* Angebot: was der Kunde gebucht hat – steuert, welche Funktionen
     Gäste an Booth, Teilen-Seite & Galerie überhaupt sehen */
  offer: {
    print: true,        // Ausdruck an der Box
    qr: true,           // QR-Code zum Herunterladen
    whatsapp: true, mail: true, sms: true, native: true,   // Teilen-Kanäle
    gallery: true,      // Gäste-Galerie an der Box & im Netz
    guestUpload: true,  // Gäste-Upload vom Handy
  },
  /* Frei gestalteter Startbildschirm (Front-Designer) */
  front: null,          // ALT — bleibt als Rückfall, siehe `bildschirme.attract`

  /* ---------- Gestaltbare Gäste-Bildschirme ----------
     Bisher ließ sich genau EIN Bildschirm gestalten (der Startbildschirm,
     oben als `front`). Alles danach — Auswahl, Ergebnis, Teilen — war fest
     programmiert. Genau daran hängt aber, ob eine Box nach dem Kunden
     aussieht oder nach uns.

     `null` bei einem Bildschirm heißt ausdrücklich „nimm die eingebaute
     Gestaltung", NICHT „zeige nichts". Ein leerer Bildschirm auf einer Feier
     wäre die schlechteste aller Auslegungen — und nur so kann der Booth
     seine Vorgaben später verbessern, ohne bestehende Events abzuschneiden.

     Die Maße sind RELATIV (0…1), nicht in Pixeln: Dieselbe Gestaltung muss
     auf einem liegenden Fernseher und auf einem hochkant stehenden
     Spiegel-Booth sitzen. */
  bildschirme: {
    attract: null,    // Startbildschirm („Berühren zum Starten")
    auswahl: null,    // „Was darf's sein?"
    ergebnis: null,   // Bild ansehen, drucken, behalten
    teilen: null,     // QR-Code zum Mitnehmen
  },
  /* DSGVO-Einwilligung + Umfrage vor dem Foto */
  /* Umfrage + Einwilligung. `unterschrift` blendet ein Feld zum Unterschreiben
     mit dem Finger ein; `imDruck` bestimmt, was davon auf dem Bild landet —
     eine Antwort (Tischnummer, Gruß) und/oder die Unterschrift. */
  survey: {
    enabled: false, consent: { enabled: false, text: '' }, questions: [],
    unterschrift: false, imDruck: { frage: '', unterschrift: false },
  },
  /* Green Screen (Chroma-Key): Hintergrund ersetzen */
  /* Hintergrund ersetzen. `ki: true` braucht KEINEN grünen Stoff — die
     Freistellung rechnet im Browser der Box, ohne Netz und ohne Dienst. */
  greenscreen: { enabled: false, ki: false, key: '#00c800', similarity: 42, background: null },
  /* Begrüßungs-Animation auf der Landingpage */
  intro: true,
  /* Selfie-Foto-Finder (Gesichtserkennung, Premium-Modul) */
  faceFinder: { enabled: false, showHint: true, consent: true, consentText: '' },
  /* AR-Gesichtsfilter (live, Premium-Modul) */
  arFilters: { enabled: false },
  /* Generative KI-Kunststile über eigenen Endpoint (lokale GPU / Cloud).
     Vertrag: POST {image (dataURL), prompt} -> {image (dataURL)}. Key bleibt am Server. */
  aiArt: { enabled: false, endpoint: '', key: '' },
  /* Ordner-Autodruck (Hotfolder): neue Bilder im Ordner automatisch drucken */
  hotfolder: { enabled: false, addToGallery: true },
  /* Sprach-Assistent: Box spricht Countdown & Ansagen (lokal, Web Speech API) */
  voice: { enabled: false },
  /* Text-/Satz-Animation auf dem Startbildschirm (Bibliothek) */
  textAnim: { enabled: false, style: 'fade', text: 'Sag Cheese!' },
  /* Fotobox-Material (Rahmen/Overlay) auf jede Aufnahme (Bibliothek) */
  material: { id: '' },
  /* Werbe-Playlist: Slides, die auf Leerlauf-/Werbe-Bildschirmen rotieren */
  playlist: { enabled: false, slides: [] },
  /* Kiosk: die App startet im Vollbild direkt im Booth, und das Cockpit ist
     hinter einer PIN. Die PIN wird NICHT im Klartext gespeichert. */
  kiosk: { enabled: false, salz: '', pin: '' },   // pin = Prüfsumme, nie das Kennwort
  /* Der Betreiber. Solange hier kein Kennwort steht, ist die Box frisch und
     jeder im Netz darf sie einrichten — danach nie wieder ohne Anmeldung.
     Cockpit und Portal zeigen Kundennamen, Adressen und Telefonnummern; im
     Gäste-WLAN einer Feier ist das sonst offen wie ein Aushang. */
  betreiber: {
    name: '', email: '', salz: '', kennwort: '',   // kennwort = Prüfsumme, nie das Kennwort
    firma: '', strasse: '', plz: '', ort: '', land: 'Deutschland',
    telefon: '', web: '', steuernummer: '',
    logo: null,                                    // dataURL, für White-Label
  },
  /* Bildquelle: eingebaute Webcam im Browser oder Spiegelreflex über
     digiCamControl (eigenes Windows-Programm, HTTP auf Port 5513). */
  kamera: { quelle: 'webcam', url: 'http://localhost:5513' },
  /* HTTPS mit eigenem Zertifikat. Ohne das gibt Safari auf dem iPad die
     Kamera nicht frei – über die nackte IP bleibt sie schwarz. */
  https: { enabled: false, port: 3378 },
  /* Die Foto-Wand ist ein GÄSTE-Bildschirm und war als einziger nicht
     gestaltbar: Marke, Logo, großes Bild, Mitmach-QR, Laufband und
     Mosaik-Fortschritt standen fest drin. Auf einer Trauung will niemand
     ein Laufband, auf einem Messestand ist der QR das Wichtigste.

     Nur ein- und ausblenden, bewusst keine freie Anordnung: Die Wand hängt
     an einem Beamer in unbekannter Größe, und ein frei geschobenes Element
     säße auf jeder zweiten Leinwand halb im Rand. */
  wand: {
    zeigen: {
      marke: true,        // Kopfzeile mit Markennamen
      logo: true,         // Logo-Overlay über der Wand
      gross: true,        // die neueste Aufnahme groß eingeblendet
      qr: true,           // Mitmach-QR in der Ecke
      laufband: true,     // Laufband am unteren Rand
      fortschritt: true,  // Fortschrittsbalken beim Photomosaik
    },
    /* Leer heißt: Vorgabe „Mosaik-Wand" benutzen. Dieselbe Regel wie bei
       allen Gästebeschriftungen — leer ist nie eine leere Beschriftung. */
    ueberschrift: '',
  },
  /* ENTFERNT (1.30): die Kasse an der Box. Gäste bezahlen an einer Fotobox
     nichts — eine Bezahlschranke vor Druck, Start oder Teilen kostet auf
     einer Feier nur Stimmung, und ohne angebundenen Zahlungsdienst musste
     der Betreiber ohnehin jede Zahlung von Hand freigeben.
     Bezahlt werden sollen LIZENZEN, nicht Auslösungen — und das läuft über
     hnvr.me, nicht über das Gerät im Festzelt. */
};

const PLAYLIST_THEMES = ['dark', 'amber', 'coral', 'festival', 'mint'];
function cleanSlides(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, 30).map((s, i) => {
    const type = s && s.type === 'image' ? 'image' : 'text';
    const out = {
      id: (s && s.id) || 'sl_' + i + '_' + Date.now().toString(36),
      type,
      duration: Math.max(2, Math.min(60, Number(s && s.duration) || 6)),
    };
    if (type === 'image') {
      out.image = (typeof s.image === 'string' && s.image.startsWith('data:image/') && s.image.length < 4_000_000) ? s.image : '';
      out.caption = String((s && s.caption) || '').slice(0, 80);
    } else {
      out.title = String((s && s.title) || '').slice(0, 60);
      out.subtitle = String((s && s.subtitle) || '').slice(0, 120);
      out.theme = PLAYLIST_THEMES.includes(s && s.theme) ? s.theme : 'dark';
    }
    return out;
  }).filter(s => s.type === 'text' ? (s.title || s.subtitle) : s.image);
}

/* Text-Animationen-Bibliothek (IDs müssen zu public/textanim.js passen) */
const TEXTANIM_STYLES = [
  'typewriter', 'fade', 'bounce', 'slide', 'wave', 'glitch', 'neon', 'zoom', 'flip', 'rainbow',
  'shake', 'pop', 'blur', 'rise', 'spotlight', 'stamp', 'wobble', 'split', 'marquee', 'sparkle',
];

/* Fotobox-Materialien-Bibliothek (IDs müssen zu public/materials.js passen) */
const MATERIAL_IDS = [
  '', 'polaroid', 'filmstrip', 'gold', 'neonframe', 'hearts', 'confettiborder', 'tape', 'ticket',
  'roundshadow', 'dots', 'vignette', 'lightleak', 'bokeh', 'grain', 'snow', 'sparkles',
  'floathearts', 'sunburst', 'wash', 'dust',
];

/* ---------- Mitgelieferte Druckvorlagen ----------
   Sie stehen NICHT mehr im Server, sondern in `vorlagen-katalog.json` neben
   ihm — derselben Datei, die auch die Oberfläche einbaut. Zwei Listen
   derselben Sache laufen auseinander, und man merkt es erst auf dem Papier:
   In der Vorfassung zeigte die Voreinstellung auf `classic-strip`, während
   die mitgelieferten Blätter längst `klassik-streifen` hießen. Eine frische
   Box druckte deshalb ein eingebautes Ersatzlayout statt einer Vorlage.

   Das Modell ist unseres (eine Feldliste, Reihenfolge = Ebene); der Server
   speichert und liefert es aus, ohne hineinzusehen. */

/* ---------- Dateien, die einen Stromausfall überstehen ----------
   Hier stand `JSON.parse(readFileSync(...))` in einem `try` mit stillem
   Rückfall auf die Vorgaben. Zwei Fehler in zwei Zeilen:

   1. Geschrieben wurde direkt in die Zieldatei. Ein Stromausfall mitten im
      Schreiben — auf einer Feier, wo jemand den Stecker zieht, ist das kein
      Sonderfall — hinterlässt eine halbe Datei.
   2. Gelesen wurde mit stillem Rückfall. Die halbe Datei ließ die Box also
      wortlos auf Werkseinstellungen zurückspringen: Drucker weg, Lizenz weg,
      Marke weg. Der Betreiber merkte es, wenn der erste Gast davorstand.

   Jetzt wird in eine Nebendatei geschrieben und dann umbenannt — das ist
   unteilbar, es gibt die alte oder die neue Fassung, nie eine halbe. Die
   vorige gute Fassung bleibt als `.bak` liegen, und beim Lesen wird
   repariert statt vergessen. */
const selbstreparaturen = [];

function loadJson(file, fallback) {
  let roh;
  try {
    roh = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return fallback;                       // gibt es nicht: normal beim Erststart
  }
  try {
    return JSON.parse(roh);
  } catch (e) {
    console.error('BESCHÄDIGT: ' + path.basename(file) + ' — ' + e.message.slice(0, 80));
    const sicherung = file + '.bak';
    try {
      const alt = JSON.parse(fs.readFileSync(sicherung, 'utf8'));
      fs.copyFileSync(file, file + '.kaputt');
      fs.copyFileSync(sicherung, file);
      console.error('  → aus ' + path.basename(sicherung) + ' wiederhergestellt.');
      selbstreparaturen.push({ was: path.basename(file), wie: 'Sicherung eingespielt', zeit: Date.now() });
      return alt;
    } catch (e2) {
      try { fs.renameSync(file, file + '.kaputt'); } catch {}
      console.error('  → keine brauchbare Sicherung. Beiseitegelegt als '
        + path.basename(file) + '.kaputt, es gelten die Vorgaben.');
      selbstreparaturen.push({ was: path.basename(file), wie: 'auf Vorgaben zurück', zeit: Date.now() });
      return fallback;
    }
  }
}

function saveJson(file, data) {
  const text = JSON.stringify(data, null, 2);
  const neben = file + '.tmp';
  /* Erst die vorige gute Fassung sichern — aber nur, wenn sie lesbar ist.
     Eine kaputte Datei als „Sicherung" abzulegen würde die einzige heile
     Fassung überschreiben. */
  try {
    if (fs.existsSync(file)) {
      JSON.parse(fs.readFileSync(file, 'utf8'));
      fs.copyFileSync(file, file + '.bak');
    }
  } catch {}
  const griff = fs.openSync(neben, 'w');
  try {
    fs.writeSync(griff, text);
    /* `fsync` ist der Punkt, an dem die Daten wirklich auf der Platte sind.
       Ohne ihn liegt der Inhalt im Zwischenspeicher des Betriebssystems, und
       das Umbenennen wäre eine Zusage, die ein Stromausfall bricht. */
    fs.fsyncSync(griff);
  } finally {
    fs.closeSync(griff);
  }
  fs.renameSync(neben, file);
}

/* ★★ Einstellungen zusammenführen — und zwar EINE EBENE TIEF.
   Vorher stand hier `{ ...DEFAULT_SETTINGS, ...gespeichert }`. Das ersetzt
   verschachtelte Blöcke **komplett**: Eine Box, die ihre Einstellungen unter
   1.8.0 gespeichert hat, bekam beim Aktualisieren einen `hashtag`-Block ohne
   `intervallSek` und ohne `moderation`. Die Folgen waren still und
   ernst:
     · `Math.max(60, undefined)` ist NaN → `setInterval(fn, NaN)` läuft mit
       **1 Millisekunde**; die Box hätte eine fremde Schnittstelle im
       Dauerfeuer abgefragt (im Protokoll nur als „TimeoutNaNWarning").
     · `moderation` wäre `undefined` und damit falsch → Beiträge aus dem Netz
       wären **ohne Freigabe gedruckt** worden. Genau die Zusage, die diese
       Funktion überhaupt vertretbar macht.
   Deshalb: Was im Standard ein Objekt ist, wird gemischt statt ersetzt. */
function einstellungenMischen(standard, gespeichert) {
  const aus = { ...standard };
  for (const [k, v] of Object.entries(gespeichert || {})) {
    const s = standard[k];
    const beideObjekte = s && v && typeof s === 'object' && typeof v === 'object'
      && !Array.isArray(s) && !Array.isArray(v);
    aus[k] = beideObjekte ? { ...s, ...v } : v;
  }
  return aus;
}

let settings = einstellungenMischen(DEFAULT_SETTINGS, loadJson(SETTINGS_FILE, {}));

/* Einmalige Bereinigung: Boxen, die schon liefen, tragen die alte Zentrale als
   Update-Adresse in ihrer `settings.json`. Die Vorgabe daneben zu ändern
   reicht dann nicht — die gespeicherte Zeile gewinnt, und die Box meldete
   weiter „Neue Fassung 1.29.0" gegen ihre eigene 1.0.0. Aktualisiert wird
   über die Desktop-Hülle; eine eigene Verteilstelle bleibt eintragbar. */
if (typeof settings.update.url === 'string' && /pic-me-app|youbooth\.me\/version\.json/.test(settings.update.url)) {
  settings.update = { pruefen: false, url: '' };
  saveJson(SETTINGS_FILE, settings);
  console.log('Update-Adresse der alten Zentrale entfernt — aktualisiert wird über die Desktop-Hülle.');
}
/* Mitgeliefertes Vorlagenpaket (aus gekauften Vorlagen umgesetzt). Liegt als
   eigene Datei neben dem Programm, damit die Liste im Code lesbar bleibt und
   ein Nachliefern kein Code-Update braucht. */
const KATALOG = loadJson(path.join(__dirname, '..', 'vorlagen-katalog.json'), []);
const ALLE_VORLAGEN = Array.isArray(KATALOG) ? KATALOG : [];
if (!ALLE_VORLAGEN.length) {
  /* Lieber laut als still: Ohne Katalog hat die Box nichts zu drucken, und
     das soll beim Start auffallen und nicht vor dem ersten Gast. */
  console.error('ACHTUNG: vorlagen-katalog.json fehlt oder ist leer — die Box hat keine Vorlagen.');
}

let templates = loadJson(TEMPLATES_FILE, ALLE_VORLAGEN);
/* Nachgelieferte Vorlagen ergänzen, ohne eigene Änderungen zu überschreiben. */
{
  const da = new Set(templates.map((t) => t.id));
  const neue = ALLE_VORLAGEN.filter((t) => !da.has(t.id));
  if (neue.length) templates = templates.concat(neue);
}
saveJson(SETTINGS_FILE, settings);
saveJson(TEMPLATES_FILE, templates);

/* ---------- Lizenz-Schlüssel (pro Kunde/Gerät, schützt externen Zugriff) ---------- */

const LICENSE_FILE = path.join(CONFIG_DIR, 'license.json');
let license = loadJson(LICENSE_FILE, null);
if (!license || !license.key) {
  license = { key: 'YOUBOOTH-' + crypto.randomBytes(8).toString('hex').toUpperCase(), created: new Date().toISOString() };
  saveJson(LICENSE_FILE, license);
}

function isLocal(req) {
  const ip = req.socket.remoteAddress || '';
  const loopback = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
  if (!loopback) return false;
  // Hinter einem Tunnel/Reverse-Proxy verbindet sich der Prozess zwar lokal,
  // die Anfrage kommt aber aus dem Internet → NICHT als Booth-PC/Admin behandeln.
  if (req.headers['x-forwarded-for'] || req.headers['x-forwarded-host'] || req.headers['cf-connecting-ip']) return false;
  return true;
}

/* ---------- Anmeldung des Betreibers ----------
   Die Sitzungen liegen im Arbeitsspeicher: Ein Neustart der Box meldet alle
   ab. Das ist gewollt — nach einem Neustart steht meist jemand anderes davor,
   und eine Anmeldung, die einen Stromausfall überlebt, ist keine.

   Das Kennwort wird nie gespeichert, nur eine gesalzene Prüfsumme über
   100 000 Runden PBKDF2. Reines SHA-256 wie bei der Kiosk-PIN reicht hier
   nicht: Eine PIN ist vierstellig und ohnehin nur gegen Neugier; ein Kennwort
   schützt Kundendaten und muss ein gestohlenes settings.json überstehen. */
const SITZUNGEN = new Map();                // marke -> { seit, bis }
const SITZUNGSDAUER = 12 * 60 * 60 * 1000;  // ein langer Veranstaltungstag

function kennwortPruefsumme(kennwort, salz) {
  return crypto.pbkdf2Sync(String(kennwort), String(salz), 100000, 32, 'sha256').toString('hex');
}

function sitzungAnlegen() {
  const marke = crypto.randomBytes(24).toString('hex');
  SITZUNGEN.set(marke, { seit: Date.now(), bis: Date.now() + SITZUNGSDAUER });
  return marke;
}

function sitzungGueltig(marke) {
  const s = marke && SITZUNGEN.get(marke);
  if (!s) return false;
  if (Date.now() > s.bis) { SITZUNGEN.delete(marke); return false; }
  return true;
}

function markeAusAnfrage(req) {
  const roh = req.headers.cookie || '';
  const treffer = roh.match(/(?:^|;\s*)youbooth_sitzung=([a-f0-9]{48})/);
  return treffer ? treffer[1] : '';
}

/** Ist überhaupt schon ein Betreiber angelegt? Vorher ist die Box offen. */
const betreiberAngelegt = () => !!(settings.betreiber && settings.betreiber.kennwort);

/** Angemeldet — oder die Box ist noch frisch und wartet auf ihre Einrichtung. */
function istBetreiber(req) {
  if (!betreiberAngelegt()) return true;
  return sitzungGueltig(markeAusAnfrage(req));
}

/* Schreibzugriffe: mit Anmeldung, mit Lizenz-Schlüssel — oder am Gerät selbst,
   solange die Box noch niemandem gehört */
function requireKey(req, res, next) {
  /* Reihenfolge mit Absicht: Die Anmeldung zuerst, danach der Schlüssel für
     Maschinen, und erst zuletzt „steht am Gerät" — und das nur, solange die
     Box noch niemandem gehört. Vorher genügte es, im selben WLAN zu sein. */
  if (sitzungGueltig(markeAusAnfrage(req))) return next();
  const k = req.get('x-youbooth-key') || req.query.key;
  if (k === license.key) return next();
  if (!betreiberAngelegt() && isLocal(req)) return next();
  res.status(401).json({ error: 'Nicht angemeldet' });
}

/* ---------- Statistiken (pro Tag, persistiert) ---------- */

const STATS_FILE = path.join(CONFIG_DIR, 'stats.json');
let stats = loadJson(STATS_FILE, { days: {} });
function recordStat(type) {
  const day = new Date().toISOString().slice(0, 10);
  if (!stats.days[day]) stats.days[day] = {};
  stats.days[day][type] = (stats.days[day][type] || 0) + 1;
  saveJson(STATS_FILE, stats);
}

/* ---------- App & WebSocket ---------- */

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

/* ---------- Warum hier ein leerer Zuhörer stehen MUSS ----------
   `ws` hängt sich an die Ereignisse des HTTP-Servers und wirft dessen
   'error' unverändert auf sich selbst weiter. Fehlt hier ein Zuhörer, macht
   Node daraus ein „Unhandled 'error' event" und beendet den Prozess —
   und zwar MITTEN im Verteilen des Ereignisses. Unsere eigene Behandlung
   weiter unten (`server.on('error')`, Ausweichport) kommt dann nie dran,
   weil Zuhörer in der Reihenfolge ihrer Anmeldung laufen und `ws` sich
   hier, dreitausend Zeilen früher, als erster angemeldet hat.
   GEMESSEN: ohne diese Zeile stürzte der Ausweichversuch weiterhin mit
   EADDRINUSE ab, obwohl die Behandlung längst dastand. */
wss.on('error', (err) => {
  if (!err || err.code !== 'EADDRINUSE') {
    console.error('WebSocket-Server:', err && err.message ? err.message : err);
  }
  /* EADDRINUSE wird unten in server.on('error') behandelt. */
});

app.use(express.json({ limit: '60mb' }));

/* iframe-Einbettung auf hnvr.me / Wix erlauben (Anbindung per iframe).
   Bei Bedarf mit ENV YOUBOOTH_FRAME_ANCESTORS anpassen (Leerzeichen-getrennt). */
const FRAME_ANCESTORS = process.env.YOUBOOTH_FRAME_ANCESTORS ||
  "'self' http://localhost:* http://127.0.0.1:* https://hnvr.me https://*.hnvr.me https://*.wixsite.com https://*.wix.com https://*.editorx.io https://*.filesusr.com https://*.wixstudio.com";
app.use((req, res, next) => {
  res.set('Content-Security-Policy', 'frame-ancestors ' + FRAME_ANCESTORS);
  res.removeHeader('X-Frame-Options');
  next();
});

/* ---------- Dateikette: erst nachgeladen, dann mitgeliefert ----------
   Diese Datei kann an zwei Orten liegen: im Programm (app.asar) oder in einem
   nachgeladenen Inhaltsordner unter `%APPDATA%/youbooth/app/<fassung>/`. Welcher
   es ist, sagt `__dirname` von selbst.

   Die zweite Zeile ist der Grund, warum der Schnellweg nur 1,5 statt 27 MB
   lädt: Freistell-Modelle (11,8 MB), Gesichtserkennung (8 MB) und
   Druckvorlagen (5,4 MB) sind im Schnellpaket NICHT enthalten und kommen
   weiter aus dem Programm. Express nimmt die erste Datei, die es findet —
   nachgeladene Seiten gewinnen, alles Übrige fällt sauber zurück. */
/* ------------------------- Modulschaltung -------------------------------
   Die Lizenz führt seit der Aktivierung mit, WAS gebucht ist (`produkte`).
   Gelesen hat das bisher niemand: Ein Kunde mit dem Fotobox-Modul konnte
   Live-Wall, Galerie, Gästebuch, Diashow und Selfie-Finder genauso benutzen
   wie einer, der alles bezahlt.

   Gesperrt wird HIER, vor der Dateiauslieferung — nicht in der Oberfläche.
   Eine ausgegraute Kachel ist keine Sperre; wer die Adresse kennt, ruft die
   Seite trotzdem auf. Darum hängt die Sperre an der Route.

   Zwei Dinge bleiben immer offen, auch ohne jedes Modul:
   `/share` und `/photos` — das sind die Links, die GÄSTE in der Hand haben.
   Ein Gast, dem sein eigenes Foto wegen eines Abos verweigert wird, ist ein
   Schaden beim Kunden, kein Verkaufsargument.

   Voreinstellung ist `['all']`. Wer heute läuft, merkt von alledem nichts. */
/* Welche Seite zu welchem Modul gehoert. DAS ist die oertliche Information —
   die Namen sind es nicht.

   Hier stand eine dritte Modulliste mit eigenen Namen: „Online-Galerie",
   „Diashow", „Sofortbild-Kamera". Sie waren weder die der Website noch die
   von `produkte.js`, und sie zeigte nur sieben Module statt vierzehn. In der
   Zentrale las sich das dann so, als haette der Betreiber sieben Module
   gekauft. Namen kommen jetzt aus `gestaltung/module.json`, ueber
   `produkte.js`. */
const MODULSEITEN = {
  photowall: ['/wand.html'],
  gallery: ['/galerie.html'],
  guestbook: ['/gaestebuch.html', '/zettelwand.html'],
  webcam: ['/gastkamera.html'],
  microsites: ['/microsite.html'],
  slideshow: ['/slideshow.html'],
  selfiefinder: ['/finder.html'],
};

/* Sieben der vierzehn Module haben eine eigene Seite, die gesperrt werden
   kann. Die uebrigen wirken IM Booth (Aufnahmearten, Effekte, Druck) — sie
   stehen trotzdem in der Liste, sonst fehlten sie in der Uebersicht. */
const MODULE = require('./produkte').map((p) => ({
  id: p.id,
  kennung: p.kennung,
  name: p.name,
  seiten: MODULSEITEN[p.id] || [],
}));

/** Ist das Modul gebucht? Ohne Lizenz und bei `all` gilt: ja. */
function modulFrei(id) {
  const p = settings.lizenz && settings.lizenz.produkte;
  if (!Array.isArray(p) || !p.length || p.includes('all')) return true;
  /* Beide Schreibweisen zaehlen — eine Lizenz von vor der Zusammenlegung
     fuehrt `photowall`, eine neue `foto-wall`, gemeint ist dasselbe Modul. */
  return p.includes(id) || p.some((x) => produktSchluessel(x) === produktSchluessel(id));
}

/** Für Konsole und Cockpit: was ist gebucht, was nicht. */
function modulStand() {
  return MODULE.map((m) => ({
    id: m.id,
    kennung: m.kennung,
    name: m.name,
    frei: modulFrei(m.id),
    seiten: m.seiten,
  }));
}

const SEITE_ZU_MODUL = new Map();
for (const m of MODULE) for (const s of m.seiten) SEITE_ZU_MODUL.set(s, m);

app.use((req, res, next) => {
  /* Nur den nackten Pfad ansehen; `?event=…` gehört nicht zur Entscheidung. */
  const pfad = req.path.endsWith('/') ? req.path + 'index.html' : req.path;
  const m = SEITE_ZU_MODUL.get(pfad);
  if (!m || modulFrei(m.id)) return next();
  res.status(402).type('html').send(`<!doctype html><html lang="de"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Youbooth – nicht gebucht</title><style>
 body{margin:0;min-height:100vh;display:grid;place-items:center;background:#14110d;
      color:#f6f1e7;font:400 1rem/1.6 system-ui,sans-serif;text-align:center;padding:24px}
 h1{font-size:1.4rem;margin:0 0 10px} p{opacity:.72;max-width:34ch;margin:0 auto}
 b{color:#e5b769}</style></head><body><div>
 <h1>${m.name} ist nicht gebucht</h1>
 <p>Dieses Modul gehört nicht zum aktuellen Paket. Im Kundenkonto lässt es sich
 unter <b>Module</b> dazubuchen — danach ist es sofort verfügbar.</p>
</div></body></html>`);
});

app.get('/api/module', (req, res) => res.json({
  produkte: (settings.lizenz && settings.lizenz.produkte) || ['all'],
  module: modulStand(),
}));

/* ---------- Die Oberfläche ----------
   Sie wird gebaut (Vite) und liegt danach in `dist/`. Der Server liefert
   sie aus; im Entwicklungsbetrieb übernimmt das der Vite-Server, der die
   Schnittstellen hierher weiterreicht.

   `YOUBOOTH_OBERFLAECHE` zeigt in der Desktop-Hülle auf den entpackten
   Ordner — dort liegt die Oberfläche nicht neben dem Server. */
const OBERFLAECHE = process.env.YOUBOOTH_OBERFLAECHE || path.join(__dirname, '..', 'dist');
if (!fs.existsSync(path.join(OBERFLAECHE, 'index.html'))) {
  console.error('ACHTUNG: keine gebaute Oberfläche unter ' + OBERFLAECHE + ' — erst `npm run build`.');
}
app.use(express.static(OBERFLAECHE));
/* API-Antworten nie cachen (sonst zeigt ein Reload alte Einstellungen) */
app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
app.use('/photos', express.static(PHOTOS_DIR, { maxAge: '1d' }));
/* Eigene Schriften. Eigener Pfad, damit sie nicht mit den mitgelieferten
   unter /schrift/ durcheinandergehen. */
app.use('/eigene-schrift', express.static(SCHRIFT_DIR, { maxAge: '7d' }));
/* Installer + Auto-Update-Feed (latest.yml etc.) für die Desktop-App */
app.use('/downloads', express.static(DOWNLOADS_DIR));

function lanIp() {
  const nets = os.networkInterfaces();
  let candidate = null;
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        if (net.address.startsWith('192.168.')) return net.address;
        if (!candidate) candidate = net.address;
      }
    }
  }
  return candidate || '127.0.0.1';
}

function baseUrl() {
  return PUBLIC_BASE || `http://${lanIp()}:${PORT}`;
}

/* ---------- Meldung an die Youbooth-Zentrale ----------
   Die Box sagt regelmäßig, dass sie läuft, und liefert die Tageszahlen.
   Die Zentrale erkennt den Kunden am Produktschlüssel; die Box selbst kennt
   keine Kundennummer und kann darum auch keine fremde angeben. */
/* ---------- Zustand der Box ----------
   Das, wovor ein Betreiber auf einer Feier wirklich Angst hat: Papier leer,
   Kamera weg, Platte voll, Wolke stumm. Die Box weiß das selbst — sie muss es
   nur sagen. Der Zustand geht bei jeder Meldung mit und steht im Konto. */
let letzterFehler = '';                 // zuletzt schiefgegangene Sache
/* Dazu ein kurzes Gedächtnis: Im Support hilft „was ging heute schief" mehr
   als „was ging zuletzt schief". Bewusst klein und nur im Arbeitsspeicher —
   es soll die Diagnose füllen, keine Datei anlegen. */
const letzteFehler = [];
const fehlerMerken = (was) => {
  letzterFehler = String(was || '').slice(0, 200);
  if (letzterFehler) {
    letzteFehler.push(new Date().toLocaleString('de-DE') + ' – ' + letzterFehler);
    if (letzteFehler.length > 20) letzteFehler.shift();
  }
};

/* ═══════════════════ Selbstprüfung und Selbstreparatur ═══════════════════
   Eine Fotobox steht stundenlang unbeaufsichtigt in einem Saal. Was in dieser
   Zeit kaputtgeht, merkt niemand — bis ein Gast davorsteht. Deshalb sieht die
   Box alle fünf Minuten selbst nach und behebt, was sich beheben lässt.

   Die Regel dabei: Repariert wird nur, was eindeutig ist. Alles andere wird
   GEMELDET, nicht geraten. Eine Box, die selbstständig den Drucker wechselt,
   weil sie den eingestellten gerade nicht sieht, druckt eine Hochzeit auf dem
   Bürodrucker im Nebenraum. */
const KONTROLLE_MS = 5 * 60 * 1000;
let letzteKontrolle = null;

function platzFrei(ordner) {
  /* `statfs` gibt es erst ab Node 18.15 und auf manchen Windows-Ständen gar
     nicht. Ohne Auskunft wird NICHT geraten — `null` heißt „weiß ich nicht",
     und der Aufrufer behandelt das anders als „reichlich Platz". */
  try {
    const s = fs.statfsSync(ordner);
    return Math.round((s.bavail * s.bsize) / 1048576);   // MB
  } catch { return null; }
}

/** Räumt Reste weg, die niemand mehr braucht. Gibt die Zahl der MB zurück. */
function restlosAufraeumen() {
  let befreit = 0, dateien = 0;
  const alt = Date.now() - 24 * 3600 * 1000;
  for (const ordner of [os.tmpdir(), path.join(DATA_DIR, 'config')]) {
    let liste = [];
    try { liste = fs.readdirSync(ordner); } catch { continue; }
    for (const f of liste) {
      /* Nur die eigenen Reste: abgebrochene Druckdateien und liegen
         gebliebene Nebendateien vom Speichern. Fremde Dateien im
         Temp-Ordner gehen die Box nichts an. */
      if (!/^youbooth_print_.*\.(jpg|png)$/i.test(f) && !/\.tmp$/i.test(f)) continue;
      const p = path.join(ordner, f);
      try {
        const s = fs.statSync(p);
        if (s.mtimeMs > alt) continue;
        befreit += s.size; dateien++;
        fs.unlinkSync(p);
      } catch {}
    }
  }
  if (dateien) {
    console.log('Selbstreparatur: ' + dateien + ' Restdatei(en) entfernt, '
      + Math.round(befreit / 1048576) + ' MB frei.');
    selbstreparaturen.push({ was: 'Restdateien', wie: dateien + ' entfernt', zeit: Date.now() });
  }
  return Math.round(befreit / 1048576);
}

async function selbstpruefung() {
  const punkte = [];
  const melden = (name, gut, text, tat) =>
    punkte.push({ name, gut, text, tat: tat || null });

  /* 1. Kann die Box überhaupt noch schreiben? Ohne das ist alles andere
        egal — jedes Foto und jede Einstellung ginge verloren. */
  try {
    const probe = path.join(DATA_DIR, '.schreibprobe');
    fs.writeFileSync(probe, String(Date.now()));
    fs.unlinkSync(probe);
    melden('Datenordner', true, 'beschreibbar');
  } catch (e) {
    melden('Datenordner', false, 'NICHT beschreibbar: ' + (e.code || e.message));
    fehlerMerken('Datenordner nicht beschreibbar — Fotos gehen verloren');
  }

  /* 2. Platz. Ein volles Laufwerk zeigt sich sonst als „Foto konnte nicht
        gespeichert werden" mitten in der Feier. */
  const frei = platzFrei(DATA_DIR);
  if (frei === null) {
    melden('Speicherplatz', true, 'nicht ermittelbar');
  } else if (frei < 200) {
    const geholt = restlosAufraeumen();
    const jetzt = platzFrei(DATA_DIR);
    melden('Speicherplatz', jetzt !== null && jetzt >= 200,
      (jetzt === null ? frei : jetzt) + ' MB frei',
      geholt ? 'aufgeräumt, ' + geholt + ' MB zurückgeholt' : null);
    if (jetzt !== null && jetzt < 200) fehlerMerken('Nur noch ' + jetzt + ' MB frei');
  } else if (frei < 1000) {
    melden('Speicherplatz', true, frei + ' MB frei — wird knapp');
  } else {
    melden('Speicherplatz', true, frei + ' MB frei');
  }

  /* 3. Drucker. Hier wird bewusst NICHT repariert (siehe oben) — aber der
        Betreiber erfährt es, solange er noch etwas tun kann. */
  if (settings.printing && settings.printer) {
    const z = await druckerZustand();
    melden('Drucker', z.da, z.da ? z.text : settings.printer + ': ' + z.text);
    if (!z.da) fehlerMerken('Drucker „' + settings.printer + '" meldet: ' + z.text);
  }

  /* 4. Sind die Einstellungen noch vollständig? Ein fehlender Block führt zu
        `undefined` in einer Rechnung und von dort zu NaN — und NaN in einem
        Zeitgeber lässt eine Schleife tausendfach je Sekunde laufen. Das ist
        hier schon einmal passiert; deshalb wird es geprüft und ergänzt. */
  /* Zwei Fehler steckten in der ersten Fassung dieser Prüfung, beide erst
     durch Messen sichtbar:

     1. Sie fragte `=== null`. Vier Einstellungen haben `null` aber als
        GÜLTIGEN Wert — „kein Drucker gewählt", „kein Logo". Die Prüfung hielt
        sie für fehlend, ergänzte sie, schrieb die Datei und meldete eine
        Reparatur. Alle fünf Minuten, für immer. Eine Selbstheilung, die sich
        Arbeit erfindet, verdeckt im Protokoll die echten Fälle.

     2. Sie sah nur auf die OBERSTE Ebene — und die hat `einstellungenMischen`
        beim Laden längst ergänzt. Die Prüfung bestätigte also eine Reparatur,
        die schon passiert war, und fand nie etwas. Gegengeprüft: zwei Blöcke
        aus der Datei gelöscht, Prüfung meldete trotzdem „vollständig".

     Geprüft wird deshalb jetzt in die TIEFE. Genau dort liegt die Lücke:
     `einstellungenMischen` geht eine Ebene tief, ein fehlender Wert auf
     Ebene drei bleibt `undefined` — und `undefined` in einer Rechnung wird
     NaN, und NaN in einem Zeitgeber lässt eine Schleife tausendfach je
     Sekunde laufen. Genau das ist hier schon einmal passiert. */
  const fehlend = [];
  (function tiefPruefen(vorlage, ist, pfad) {
    for (const [k, v] of Object.entries(vorlage)) {
      const wo = pfad ? pfad + '.' + k : k;
      if (!ist || !(k in ist)) { fehlend.push(wo); continue; }
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        tiefPruefen(v, ist[k], wo);
      }
    }
  })(DEFAULT_SETTINGS, settings, '');

  /* Ergänzt wird an genau der Stelle, an der etwas fehlt — nicht der ganze
     Block. Sonst überschriebe die Reparatur die Einstellungen daneben. */
  for (const pfad of fehlend) {
    const teile = pfad.split('.');
    let vorlage = DEFAULT_SETTINGS, ziel = settings;
    for (let i = 0; i < teile.length - 1; i++) {
      vorlage = vorlage[teile[i]];
      if (!ziel[teile[i]] || typeof ziel[teile[i]] !== 'object') ziel[teile[i]] = {};
      ziel = ziel[teile[i]];
    }
    const letzter = teile[teile.length - 1];
    const wert = vorlage[letzter];
    ziel[letzter] = (wert && typeof wert === 'object')
      ? JSON.parse(JSON.stringify(wert)) : wert;
  }
  if (fehlend.length) {
    saveJson(SETTINGS_FILE, settings);
    melden('Einstellungen', true, fehlend.length + ' Wert(e) ergänzt',
      fehlend.slice(0, 8).join(', ') + (fehlend.length > 8 ? ' …' : ''));
    selbstreparaturen.push({
      was: 'Einstellungen',
      wie: fehlend.length + ' ergänzt: ' + fehlend.slice(0, 5).join(', '),
      zeit: Date.now(),
    });
    console.log('Selbstreparatur: fehlende Einstellungen ergänzt — ' + fehlend.join(', '));
  } else {
    melden('Einstellungen', true, 'vollständig');
  }

  letzteKontrolle = {
    zeit: Date.now(),
    punkte,
    inOrdnung: punkte.every((p) => p.gut),
    reparaturen: selbstreparaturen.slice(-10),
  };
  /* Die Konsole erfährt es sofort — nicht erst beim nächsten Neuladen. */
  const schlecht = punkte.filter((p) => !p.gut);
  if (schlecht.length) {
    broadcast({ type: 'selbstpruefung', schlecht: schlecht.map((p) => p.name + ': ' + p.text) });
  }
  return letzteKontrolle;
}

/* Beim Start einmal nach 20 Sekunden (nicht sofort — die Kamera und der
   Drucker brauchen nach einem Neustart des Rechners einen Moment), danach
   im festen Takt. */
setTimeout(() => { selbstpruefung().catch(() => {}); }, 20000);
setInterval(() => { selbstpruefung().catch(() => {}); }, KONTROLLE_MS);

function druckerZustand() {
  return new Promise((ok) => {
    if (!CAN_PRINT || !settings.printer) return ok({ da: false, text: settings.printing ? 'kein Drucker gewählt' : 'Druck aus' });
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `Get-Printer -Name '${settings.printer.replace(/'/g, "''")}' | Select-Object -ExpandProperty PrinterStatus`],
      { windowsHide: true, timeout: 8000 }, (err, out) => {
        if (err) return ok({ da: false, text: 'Drucker nicht gefunden' });
        const z = String(out).trim();
        /* Normal / Idle heißt bereit; alles andere ist eine Ansage wert. */
        ok({ da: /Normal|Idle/i.test(z), text: z || 'unbekannt' });
      });
  });
}

/* ---------- Gibt es etwas Neueres? ----------
   Bewusst nur nachsehen und Bescheid sagen, nicht selbst herunterladen: Eine
   Box, die sich mitten auf einer Feier ein 90-MB-Paket zieht und einen
   Neustart anbietet, ist ein Risiko, kein Dienst. */
let neueVersion = null;      // { version, notes, url } oder null

function neuer(a, b) {
  const za = String(a).split('.').map(Number), zb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((za[i] || 0) > (zb[i] || 0)) return true;
    if ((za[i] || 0) < (zb[i] || 0)) return false;
  }
  return false;
}

async function updatePruefen() {
  if (!settings.update.pruefen || typeof fetch !== 'function') return;
  // Ohne eingetragene Adresse gibt es nichts zu fragen — und geraten wird nicht.
  if (!/^https?:\/\//i.test(String(settings.update.url || ''))) return;
  try {
    const feed = /^https?:\/\//i.test(String(settings.update.url || ''))
      ? settings.update.url : '';
    const res = await fetch(feed, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d = await res.json();
    /* ★ Die Adresse muss zur PLATTFORM passen. Vorher stand hier fest
       `platforms.windows` – eine Mac-Box hätte den Windows-Installer
       angeboten. Fällt erst auf, wenn wirklich ein Mac im Feld steht. */
    const eigene = (d.platforms && d.platforms[geraeteTyp()]) || {};
    const ersatz = (d.platforms && d.platforms.windows) || {};

    /* ★ Adressen in `version.json` duerfen relativ sein (`/pakete/…`) — auf
       der Verkaufsseite ist das richtig, weil sie damit einen Domainwechsel
       ueberlebt. Fuer die Box ist es toedlich: Sie wuerde gegen ihre EIGENE
       Adresse aufloesen und den Betreiber auf `localhost:3377/pakete/…`
       schicken. Also hier gegen die Herkunft der Datei aufloesen. */
    const absolut = (u) => {
      if (!u) return '';
      try { return new URL(u, feed).href; } catch { return String(u); }
    };

    /* Zwei Pflichtstufen, bewusst getrennt:
         `mindestens`  – darunter ist das Update fällig: deutlicher, nicht
                         wegklickbarer Hinweis im Cockpit. Die Box läuft weiter.
         `sperreUnter` – nur für wirklich kaputte Fassungen: der Booth nimmt
                         keine neuen Gäste mehr an, das Cockpit bleibt offen,
                         damit der Betreiber aktualisieren kann.
       Eine laufende Feier mitten im Betrieb hart abzuschalten wäre schlimmer
       als der Fehler, den man damit verhindern will. */
    const pflicht = !!(d.mindestens && neuer(String(d.mindestens), APP_VERSION));
    const gesperrt = !!(d.sperreUnter && neuer(String(d.sperreUnter), APP_VERSION));

    if (d && d.version && (neuer(d.version, APP_VERSION) || pflicht || gesperrt)) {
      neueVersion = {
        version: d.version,
        notes: String(d.notes || '').slice(0, 400),
        url: absolut(eigene.url || ersatz.url),
        fuer: eigene.url ? geraeteTyp() : (ersatz.url ? 'windows' : ''),
        pflicht, gesperrt,
        mindestens: d.mindestens ? String(d.mindestens) : '',
      };
      console.log('Neue Youbooth-Fassung verfügbar:', d.version
        + (gesperrt ? ' — GESPERRT, Aktualisierung nötig' : pflicht ? ' — Pflicht-Update' : ''));
      /* ★ Der Programmhuelle sofort Bescheid sagen, statt sie ihren eigenen
         6-Stunden-Takt abwarten zu lassen. Der Server prueft oefter und
         weiss es damit als Erster; die Huelle kann dann herunterladen. Ohne
         Huelle (Quellpaket, Mac) passiert hier nichts — dort bleibt es beim
         Hinweis im Cockpit. */
      try { process.emit('youbooth-update-pruefen', d.version); } catch (e) { /* egal */ }
    } else {
      neueVersion = null;
    }
    /* Die Bildschirme sollen es sofort erfahren, nicht erst beim naechsten
       Neuladen – sonst steht eine gesperrte Box noch stundenlang offen. */
    broadcast({ type: 'update', neueVersion });
  } catch (err) {
    /* Kein Netz oder Seite weg – das ist keine Störung, nur eine Auskunft,
       die heute nicht zu haben ist. Aber sichtbar im Protokoll. */
    console.log('Update-Prüfung nicht möglich:', err.message);
  }
}

async function boxZustand() {
  const drucker = await druckerZustand();
  let platteFreiMb = null;
  try {
    const st = fs.statfsSync ? fs.statfsSync(DATA_DIR) : null;
    if (st) platteFreiMb = Math.round((st.bavail * st.bsize) / 1048576);
  } catch { /* nicht überall vorhanden */ }
  const heute = stats.days[new Date().toISOString().slice(0, 10)] || {};
  return {
    drucker: drucker.da, druckerText: drucker.text,
    platteFreiMb,
    kameraQuelle: settings.kamera.quelle,
    wolke: !!(settings.melden && settings.melden.fotos),
    bildschirme: clientRoles(),
    letzterFehler,
    warteschlange: warteschlange.length,
    hashtagWarten: settings.hashtag.enabled ? hashtagStand.warten.length : 0,
    neueVersion: neueVersion ? neueVersion.version : null,
    fotosHeute: (heute.photo || 0) + (heute.strip || 0) + (heute.boomerang || 0) + (heute.gif || 0) + (heute.video || 0) + (heute.guest || 0),
  };
}

/** Auf welcher Art Gerät läuft diese Box? Steht später im Betreiberkonto. */
function geraeteTyp() {
  if (EDITION === 'cloud') return 'cloud';
  const p = os.platform();
  return p === 'win32' ? 'windows' : p === 'darwin' ? 'mac' : 'linux';
}

function tagesZahlen() {
  const tag = new Date().toISOString().slice(0, 10);
  const d = stats.days[tag] || {};
  const fotos = (d.photo || 0) + (d.strip || 0) + (d.boomerang || 0) + (d.gif || 0) + (d.video || 0) + (d.guest || 0);
  return { tag, fotos, gaeste: d.guest || 0, events: 0 };
}

/* ---------- Fernsteuerung: Aufträge der Zentrale ausführen ----------
   Die Box ist hinter dem Router von außen nicht erreichbar. Statt einer
   eingehenden Verbindung holt sie sich bei jeder Meldung ab, was zu tun ist,
   führt es lokal aus und quittiert es bei der nächsten Meldung. */
function fuehreAuftragAus(a) {
  const d = (a && a.daten) || {};
  switch (a && a.art) {
    case 'ausloesen': {
      const modus = ['photo', 'strip', 'boomerang'].includes(d.modus) ? d.modus : null;
      broadcast({ type: 'control', action: 'trigger', target: 'booth', url: null, mode: modus });
      return 'Auslöser an den Booth gesendet' + (modus ? ' (' + modus + ')' : '');
    }
    case 'neuladen':
      broadcast({ type: 'control', action: 'reload', target: 'all', url: null, mode: null });
      return 'Alle Bildschirme laden neu';

    case 'event': {
      const name = String(d.eventName || '').slice(0, 80);
      settings.eventName = name;
      saveJson(SETTINGS_FILE, settings);
      broadcast({ type: 'settings', settings });
      return name ? 'Event heißt jetzt „' + name + '"' : 'Eventname geleert';
    }

    case 'mosaik': {
      const modi = ['grid', 'overlay', 'logo', 'photomosaic'];
      const modus = modi.includes(d.mosaicMode) ? d.mosaicMode : 'grid';
      settings.mosaicMode = modus;
      saveJson(SETTINGS_FILE, settings);
      broadcast({ type: 'settings', settings });
      return 'Wand-Modus: ' + modus;
    }

    /* Vorlage scharfstellen – per Id oder (bequemer) per Name */
    case 'vorlage': {
      const wunsch = String(d.vorlage || '').trim();
      const treffer = templates.find(t => t.id === wunsch)
        || templates.find(t => (t.name || '').toLowerCase() === wunsch.toLowerCase());
      if (!treffer) throw new Error('Vorlage „' + wunsch + '" gibt es auf dieser Box nicht');
      vorlageAktivieren(treffer.id);
      return 'Vorlage „' + treffer.name + '" ist aktiv';
    }

    /* Vorlage aus der Zentrale übernehmen (Push) */
    case 'vorlagePush': {
      /* Gleicher Name und gleiche Art = dieselbe Vorlage. Sonst sammelt sich
         bei jedem Push eine Kopie mehr an. */
      const wunsch = d.tpl && { ...d.tpl };
      if (wunsch && !wunsch.id) {
        const alt = templates.find(t => t.art === wunsch.art
          && (t.name || '').toLowerCase() === String(wunsch.name || '').toLowerCase());
        if (alt) wunsch.id = alt.id;
      }
      const ergebnis = vorlageUebernehmen(wunsch);
      if (ergebnis.fehler) throw new Error('Vorlage abgelehnt: ' + ergebnis.fehler);
      if (d.aktivieren) vorlageAktivieren(ergebnis.vorlage.id);
      return 'Vorlage „' + ergebnis.vorlage.name + '" übernommen'
        + (d.aktivieren ? ' und aktiviert' : '');
    }

    /* ---------- Fernwartung durch den Hersteller ----------
       Die drei folgenden Aufträge sind das, was im Support wirklich gebraucht
       wird: sehen, was los ist · eine falsche Einstellung geradeziehen · das
       Programm neu starten. Sie kommen aus der Zentrale und werden – wie alle
       Aufträge – quittiert, damit im Protokoll steht, was passiert ist.

       Der Betreiber kann sie mit einem Schalter komplett sperren
       (`settings.fernwartung.erlaubt`). Ohne diesen Schalter wäre es ein
       Fernzugriff, dem er nie zugestimmt hat. */
    case 'diagnose': {
      if (!fernwartungErlaubt()) throw new Error('Fernwartung ist an dieser Box abgeschaltet');
      return diagnoseText();
    }

    case 'einstellung': {
      if (!fernwartungErlaubt()) throw new Error('Fernwartung ist an dieser Box abgeschaltet');
      const pfad = String(d.pfad || '');
      if (!FERN_EINSTELLUNGEN.includes(pfad)) {
        throw new Error('Diese Einstellung darf nicht aus der Ferne gesetzt werden: ' + pfad);
      }
      const vorher = pfadLesen(settings, pfad);
      pfadSchreiben(settings, pfad, d.wert);
      saveJson(SETTINGS_FILE, settings);
      broadcast({ type: 'settings', settings });
      return 'Einstellung ' + pfad + ': ' + JSON.stringify(vorher) + ' → ' + JSON.stringify(pfadLesen(settings, pfad));
    }

    case 'neustart': {
      if (!fernwartungErlaubt()) throw new Error('Fernwartung ist an dieser Box abgeschaltet');
      /* Ohne Electron gibt es niemanden, der das Programm wieder startet –
         dann wäre ein „Neustart" schlicht ein Ausschalten. Das sagen wir,
         statt die Box auf einer Feier stillzulegen. */
      if (!process.versions.electron) throw new Error('Neustart geht nur in der Youbooth-App, nicht im Browser-Betrieb');
      setTimeout(() => { try { process.emit('youbooth-neustart'); } catch (e) { /* egal */ } }, 1500);
      return 'Neustart in 1,5 Sekunden – die Quittung geht noch vorher raus';
    }

    default:
      throw new Error('Unbekannter Auftrag: ' + (a && a.art));
  }
}

/* Der Betreiber entscheidet, ob der Hersteller aus der Ferne eingreifen darf.
   Voreinstellung: erlaubt – Support ist Teil dessen, was er gekauft hat –,
   aber sichtbar und mit einem Schalter im Cockpit abschaltbar. */
function fernwartungErlaubt() {
  const f = settings.fernwartung || {};
  return f.erlaubt !== false;
}

/* Nur diese Einstellungen sind aus der Ferne setzbar. Alles, was Geld, Rechte
   oder Datenschutz berührt, bleibt draußen – der Support soll helfen können,
   nicht die Box übernehmen. */
const FERN_EINSTELLUNGEN = [
  'eventName', 'tagline', 'countdown', 'countdownStyle',
  'printing', 'druck.maxProStunde', 'druck.streifenDoppelt', 'druck.schnittlinie',
  'mosaicMode', 'mosaicCols',
  'vorschau.drehen', 'vorschau.spiegeln',
  'update.pruefen', 'melden.puls',
];

function pfadLesen(o, pfad) {
  return pfad.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
}
function pfadSchreiben(o, pfad, wert) {
  const teile = pfad.split('.');
  const letzter = teile.pop();
  const ziel = teile.reduce((a, k) => (a[k] = a[k] || {}), o);
  ziel[letzter] = wert;
}

/* Ein Lagebericht in einem Stück Text – das, wonach man im Support als
   Erstes fragt, ohne dass jemand vor Ort etwas ablesen muss. */
function diagnoseText() {
  const z = [];
  const s = settings;
  z.push('Youbooth ' + APP_VERSION + ' · ' + geraeteTyp() + ' · ' + os.hostname());
  z.push('Node ' + process.version + (process.versions.electron ? ' · Electron ' + process.versions.electron : ' · ohne App-Hülle'));
  z.push('Laufzeit ' + Math.round(process.uptime() / 60) + ' min · Speicher ' + Math.round(process.memoryUsage().rss / 1048576) + ' MB');
  z.push('Event: ' + (s.eventName || '—') + ' · Vorlagen: ' + templates.length
    + ' (aktiv: ' + (s.active && s.active.single) + ' / ' + (s.active && s.active.strip) + ')');
  z.push('Druck: ' + (s.printing ? 'an' : 'aus')
    + ', Grenze/Std ' + ((s.druck && s.druck.maxProStunde) || 0)
    + ', Doppelstreifen ' + (s.druck && s.druck.streifenDoppelt ? 'an' : 'aus')
    + ', Drucker „' + (s.printer || '—') + '"');
  z.push('Kamera: ' + ((s.kamera && s.kamera.quelle) || 'webcam')
    + ' · Vorschau drehen ' + ((s.vorschau && s.vorschau.drehen) || 0) + '°'
    + (s.vorschau && s.vorschau.spiegeln ? ', gespiegelt' : ''));
  z.push('Cloud: ' + (s.cloud && s.cloud.enabled ? 'an' : 'aus')
    + ' · Meldung: ' + (s.melden && s.melden.enabled ? 'Puls alle ' + ((s.melden && s.melden.puls) || 3) + ' s' : 'aus')
    + ' · Kiosk: ' + (s.kiosk && s.kiosk.enabled ? 'an' : 'aus'));
  const w = loadJson(WARTE_DATEI, []);
  z.push('Warteschlange Cloud: ' + (Array.isArray(w) ? w.length : 0) + ' offen');
  const zahlen = tagesZahlen();
  z.push('Heute: ' + zahlen.fotos + ' Aufnahmen, ' + zahlen.gaeste + ' Gäste-Uploads');
  z.push('Fotos im Ordner: ' + (fs.existsSync(PHOTOS_DIR) ? fs.readdirSync(PHOTOS_DIR).length : 0));
  if (letzteFehler.length) {
    z.push('Letzte Fehler:');
    letzteFehler.slice(-5).forEach(f => z.push('  · ' + f));
  } else {
    z.push('Keine Fehler protokolliert');
  }
  return z.join('\n');
}


let letzteMeldung = 0;
let quittungen = [];   // erledigte Aufträge, die noch zur Zentrale müssen

async function sendeMeldung(zusatz = {}) {
  const m = settings.melden;
  const zahlen = tagesZahlen();
  const res = await fetch(m.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: m.key,
      box: { name: os.hostname(), version: APP_VERSION, url: baseUrl(), typ: geraeteTyp() },
      nutzung: zahlen,
      event: settings.eventName ? {
        name: settings.eventName, datum: zahlen.tag,
        fotos: zahlen.fotos, gaeste: zahlen.gaeste, slug: '',
      } : undefined,
      /* Damit die Zentrale weiß, welche Vorlagen es hier überhaupt gibt */
      vorlagen: templates.map(t => ({ id: t.id, name: t.name, art: t.art, format: t.format })).slice(0, 40),
      aktiv: settings.active,
      zustand: await boxZustand(),
      ...zusatz,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(res.status + ' ' + t.slice(0, 160));
  }
  return res.json().catch(() => ({}));
}

/* ================= Einstellungen: Gerät oder Event? =================
   Ab hier gibt es ZWEI Sorten Einstellungen, und die Trennung ist die
   wichtigste Entscheidung im ganzen Aufbau:

   · GERÄT  — Drucker, Kamera, Netz, Lizenz, Fernwartung. Das hängt an dieser
     einen Box und darf NIEMALS mit einem Event mitreisen. Wer eine Hochzeit
     lädt und dabei den Drucker verstellt bekommt, hat abends kein Papier.

   · EVENT  — Name, Countdown, Modi, Vorlage, was Gäste dürfen, Aussehen.
     Das gehört zur Feier und wird extern verwaltet: Der Betreiber stellt es
     im Browser ein, die Box holt es sich beim Melden.

   Deshalb eine ausdrückliche Positivliste statt „alles außer …": Eine neue
   Einstellung ist im Zweifel Gerätesache und muss hier bewusst eingetragen
   werden, um mit einem Event zu reisen. Andersherum wäre jede neue
   Hardware-Einstellung stillschweigend fernsteuerbar. */
const EVENT_EINSTELLUNGEN = [
  'eventName', 'tagline', 'countdown', 'countdownStyle', 'modes', 'gif',
  'aktionen', 'active', 'offer', 'attract', 'intro', 'voice', 'textAnim',
  'ticker', 'playlist', 'material', 'logo', 'whitelabel', 'brandName',
  'mosaicCols', 'mosaicMode', 'mosaicSticker', 'mosaicStrength', 'mosaicTarget',
  'profile', 'arFilters',
  /* Seit 1.24: alle Gästebeschriftungen und die Druckgrenzen. Beides gehört
     ans Event — eine Hochzeit spricht anders als eine Firmenfeier, und wie
     viel Papier ein Abend kosten darf, ist eine Frage des Auftrags, nicht
     des Geräts. */
  'texte', 'druckGrenzen', 'greenscreen', 'survey', 'faceFinder',
  /* Seit 1.26: die gestalteten Gäste-Bildschirme. Sie gehören ans Event —
     eine Hochzeit sieht anders aus als ein Messestand, und beides läuft auf
     derselben Box. `front` bleibt für alte Events mit dabei. */
  'bildschirme', 'front',
  /* Seit 1.30: Bewegungsstart. Gehört ans Event, weil es vom Aufstellort
     abhängt — an einem engen Durchgang löst dieselbe Empfindlichkeit
     ständig aus, in einer weiten Halle gar nicht. */
  'bewegungsstart',
  /* Seit 1.30: die Gestaltung der Foto-Wand. Gehoert ans Event —
     eine Trauung will kein Laufband, ein Messestand lebt vom QR. */
  'wand',
];

/* Was die Box wirklich benutzt: Geräteeinstellungen, darüber die des Events.
   `settings` selbst bleibt unangetastet — sonst wäre nach einem Event nicht
   mehr feststellbar, was die Box eigentlich für sich eingestellt hat. */
let eventEinstellungen = null;   // vom Server geholt, null = keines aktiv
let eventName = '';

function wirksam() {
  if (!eventEinstellungen) return settings;
  const zusammen = { ...settings };
  for (const k of EVENT_EINSTELLUNGEN) {
    if (Object.prototype.hasOwnProperty.call(eventEinstellungen, k)) {
      zusammen[k] = eventEinstellungen[k];
    }
  }
  return zusammen;
}

/** Übernimmt die Einstellungen eines Events – nur die erlaubten Schlüssel. */
function eventUebernehmen(daten) {
  if (!daten || typeof daten !== 'object') {
    if (eventEinstellungen) { eventEinstellungen = null; eventName = ''; broadcast({ type: 'settings', settings: wirksam() }); }
    return false;
  }
  const roh = daten.einstellungen || {};
  const gefiltert = {};
  for (const k of EVENT_EINSTELLUNGEN) {
    if (Object.prototype.hasOwnProperty.call(roh, k)) gefiltert[k] = roh[k];
  }
  const vorher = JSON.stringify(eventEinstellungen);
  eventEinstellungen = gefiltert;
  eventName = String(daten.name || gefiltert.eventName || '');

  /* Das Druckkontingent hängt am Event, also muss es beim Wechsel von vorn
     anfangen. Gezählt wird gegen die Kennung (`_id`), nicht gegen den Namen:
     Zwei Feiern desselben Kunden heißen oft gleich. */
  const kennung = String(daten._id || daten.id || eventName || '');
  if (druckEvent.event !== kennung) {
    if (druckEvent.zahl > 0) {
      console.log('Druckkontingent zurückgesetzt (vorheriges Event: '
        + druckEvent.zahl + ' Abzüge).');
    }
    druckEvent = { event: kennung, zahl: 0 };
    druckRunden.clear();
  }
  const geaendert = vorher !== JSON.stringify(eventEinstellungen);
  if (geaendert) {
    console.log('Event „' + (eventName || '?') + '" übernommen: '
      + Object.keys(gefiltert).length + ' Einstellungen von der Zentrale.');
    /* Die Bildschirme sofort mitziehen – sonst zeigt der Booth noch die
       Hochzeit, während im Cockpit schon die Firmenfeier steht. */
    broadcast({ type: 'settings', settings: wirksam() });
  }
  return geaendert;
}

async function meldeAnZentrale(grund = 'plan') {
  const m = settings.melden;
  if (!m || !m.enabled || !m.url || !m.key || typeof fetch !== 'function') return;
  /* Nicht öfter als alle 60 Sekunden, egal wie oft etwas ausgelöst wird */
  if (Date.now() - letzteMeldung < 60000 && grund !== 'start') return;
  letzteMeldung = Date.now();

  /* Offene Quittungen mitschicken. Geht die Meldung schief, kommen sie
     zurück in die Schlange – eine Rückmeldung darf nicht verschwinden. */
  const mit = quittungen;
  quittungen = [];
  try {
    const antwort = await sendeMeldung(mit.length ? { erledigt: mit } : {});

    /* Die Zentrale schickt das aktive Event mit. `null` heißt ausdrücklich
       „kein Event aktiv" und schaltet zurück auf die Geräteeinstellungen. */
    if ('event' in antwort) eventUebernehmen(antwort.event);

    const auftraege = Array.isArray(antwort.auftraege) ? antwort.auftraege : [];
    if (!auftraege.length) return;

    for (const a of auftraege) {
      try {
        const text = fuehreAuftragAus(a);
        console.log('Auftrag der Zentrale ausgeführt:', a.art, '–', text);
        quittungen.push({ id: a.id, ok: true, text });
      } catch (err) {
        console.log('Auftrag der Zentrale fehlgeschlagen:', a.art, '–', err.message);
        quittungen.push({ id: a.id, ok: false, text: err.message });
      }
    }
    /* Sofort quittieren, damit der Betreiber die Rückmeldung gleich sieht
       und nicht erst in 15 Minuten. */
    const offen = quittungen;
    quittungen = [];
    try {
      await sendeMeldung({ erledigt: offen });
    } catch (err) {
      console.log('Quittung an Zentrale fehlgeschlagen:', err.message);
      quittungen = offen.concat(quittungen);   // beim nächsten Mal erneut
    }
  } catch (err) {
    console.log('Meldung an Zentrale fehlgeschlagen:', err.message);
    quittungen = mit.concat(quittungen);
  }
}

/* ---------- Puls: kurzer Takt nur für Aufträge ----------
   Die volle Meldung schreibt Box, Nutzung und Event fort und ist zu teuer für
   Sekundentakt. Der Puls fragt nur die Warteschlange ab — dadurch liegt
   zwischen „Knopf im Konto" und „Box tut es" nur der Pulsabstand. */
let pulsLaeuft = false;
async function pulsAnZentrale() {
  const m = settings.melden;
  if (pulsLaeuft || !m || !m.enabled || !m.url || !m.key || typeof fetch !== 'function') return;
  if (!(Number(m.puls) > 0)) return;
  pulsLaeuft = true;
  const mit = quittungen;
  quittungen = [];
  try {
    const res = await fetch(zentraleBasis() + '/api/box/puls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: m.key, box: { name: os.hostname() }, erledigt: mit }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const antwort = await res.json();
    /* Das Event kommt im Sekundentakt mit: Wer im Browser ein Event startet,
       soll nicht eine Viertelstunde warten. Fehlt der Schlüssel ganz, hatte
       die Zentrale gerade keine Auskunft — dann bleibt alles, wie es ist. */
    if ('event' in antwort) eventUebernehmen(antwort.event);

    /* ★ Die ausgelieferte Fassung kommt im Sekundentakt mit. Damit weiss eine
       laufende Box binnen drei Sekunden von einer neuen Fassung, statt auf
       den eigenen 30-Minuten-Takt zu warten. Geprueft wird trotzdem gegen
       `version.json` (ein Aufruf, kein Dauerzustand) — nur so kommen auch
       Anmerkungen, Pflicht- und Sperrgrenzen mit. */
    if (antwort.fassung && antwort.fassung.version
        && neuer(String(antwort.fassung.version), APP_VERSION)
        && (!neueVersion || neueVersion.version !== antwort.fassung.version)) {
      console.log('Zentrale meldet Fassung ' + antwort.fassung.version + ' — nachsehen.');
      updatePruefen().catch(() => { /* die naechste Runde versucht es wieder */ });
    }

    for (const a of (Array.isArray(antwort.auftraege) ? antwort.auftraege : [])) {
      try {
        const text = fuehreAuftragAus(a);
        console.log('Auftrag der Zentrale ausgeführt:', a.art, '–', text);
        quittungen.push({ id: a.id, ok: true, text });
      } catch (err) {
        console.log('Auftrag der Zentrale fehlgeschlagen:', a.art, '–', err.message);
        quittungen.push({ id: a.id, ok: false, text: err.message });
      }
    }
  } catch (err) {
    quittungen = mit.concat(quittungen);   // Rückmeldungen dürfen nicht verloren gehen
    /* Ein ausgefallener Puls ist Alltag (Netz, Schlaf) und wird nicht gemeldet,
       sonst füllt er bei jedem Aussetzer das Protokoll. */
  }
  pulsLaeuft = false;
}

/* ---------- Fotos in die Cloud-Galerie ----------
   Zwei Schritte: Adresse holen, direkt zu Wix hochladen, dann eintragen. Das
   Bild läuft NICHT durch den Wix-Worker — der begrenzt die Anfragegröße. */
function zentraleBasis() {
  /* ★ GEMESSEN als Ursache von „Die Zentrale ist gerade nicht erreichbar":
     Das Cockpit schickt beim Speichern den ROHEN Inhalt des Adressfeldes —
     auch wenn es leer ist. Danach kannte die Box keine Zentrale mehr, und
     Aktivierung wie Kopplung liefen ins Leere. Das darf nicht an einem
     Eingabefeld haengen: Wer die Adresse loescht, will keine eigene Zentrale
     betreiben, er hat nur ein Feld geleert. Also Rueckfall auf die
     Standardadresse, und offensichtlich Unbrauchbares gar nicht erst
     annehmen. */
  const roh = String(settings.melden?.url || '').trim();
  const brauchbar = /^https?:\/\//i.test(roh) ? roh : ZENTRALE;
  return brauchbar.replace(/\/api\/box\/melden\/?$/, '');
}

let wolke = { event: '', token: '', galerieUrl: '', qrGesendet: false };

async function wolkeAnfragen(nutzlast) {
  const res = await fetch(zentraleBasis() + '/api/box/foto', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: settings.melden.key, box: { name: os.hostname() }, ...nutzlast }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + text.slice(0, 160));
  return JSON.parse(text || '{}');
}

/** Lädt einen Puffer hoch und gibt die entstandene Wix-Adresse zurück. */
async function wolkeHochladen(name, mimeType, puffer, art, gesichter) {
  const eventName = settings.eventName || 'Ohne Namen';
  const start = await wolkeAnfragen({
    event: eventName, name, mimeType, sizeInBytes: puffer.length,
  });
  if (!start.uploadUrl) throw new Error('Keine Upload-Adresse erhalten');

  const put = await fetch(start.uploadUrl + '?filename=' + encodeURIComponent(name), {
    method: 'PUT', headers: { 'Content-Type': mimeType }, body: puffer,
  });
  if (!put.ok) throw new Error('Upload HTTP ' + put.status);
  const erg = await put.json();
  const url = erg && erg.file && erg.file.url;
  if (!url) throw new Error('Wix lieferte keine Bildadresse');

  await wolkeAnfragen({
    schritt: 'fertig', event: eventName, name, url, art: art || 'foto',
    /* Nur die Zahlenvektoren – nie ein Gesichtsausschnitt. */
    gesichter: Array.isArray(gesichter) && gesichter.length ? gesichter : undefined,
  });

  /* Event gewechselt? Dann gilt der alte QR-Code nicht mehr. */
  if (start.token && start.token !== wolke.token) {
    wolke = { event: eventName, token: start.token, galerieUrl: start.galerieUrl || '', qrGesendet: false };
  }
  return { url, start };
}

/** Einmal je Event einen QR-Code der Galerie hochladen — die Web-Wand zeigt ihn. */
async function wolkeQrSichern() {
  if (!wolke.galerieUrl || wolke.qrGesendet) return;
  wolke.qrGesendet = true;   // auch bei Fehlschlag nicht in einer Schleife hängen
  try {
    const png = await QRCode.toBuffer(wolke.galerieUrl, { width: 600, margin: 1 });
    await wolkeHochladen('qr_' + wolke.token + '.png', 'image/png', png, 'qr');
    console.log('QR-Code der Galerie an die Zentrale übergeben');
  } catch (err) {
    console.log('QR-Code konnte nicht übergeben werden:', err.message);
  }
}

/* ---------- Warteschlange für die Cloud ----------
   Auf einer Feier ist das Netz oft weg. Ohne Warteschlange wären die Fotos
   dieser Stunden für die Cloud-Galerie einfach verloren — und niemand würde
   es merken, weil an der Box alles normal aussieht. Deshalb wird jeder
   fehlgeschlagene Upload gemerkt und später nachgeholt. Die Bilddateien
   liegen ohnehin im Fotoordner; gemerkt wird nur der Name. */
const WARTE_DATEI = path.join(CONFIG_DIR, 'wolke-warteschlange.json');
let warteschlange = loadJson(WARTE_DATEI, []);
if (!Array.isArray(warteschlange)) warteschlange = [];

function einreihen(eintrag) {
  /* Kein doppeltes Einreihen, und nicht unbegrenzt wachsen lassen. */
  if (warteschlange.some((w) => w.name === eintrag.name)) return;
  warteschlange.push(eintrag);
  if (warteschlange.length > 500) warteschlange = warteschlange.slice(-500);
  saveJson(WARTE_DATEI, warteschlange);
}

let warteLaeuft = false;
async function warteschlangeAbarbeiten() {
  const m = settings.melden;
  if (warteLaeuft || !warteschlange.length) return;
  if (!m || !m.enabled || !m.key || !m.fotos || typeof fetch !== 'function') return;
  warteLaeuft = true;
  try {
    /* Höchstens drei je Runde: bei 200 nachzuholenden Fotos soll die Box
       nicht minutenlang blockiert am Netz hängen. */
    for (const eintrag of warteschlange.slice(0, 3)) {
      const datei = path.join(PHOTOS_DIR, eintrag.name);
      if (!fs.existsSync(datei)) {                    // gelöscht: aus der Schlange nehmen
        warteschlange = warteschlange.filter((w) => w.name !== eintrag.name);
        continue;
      }
      await wolkeHochladen(eintrag.name, eintrag.mime, fs.readFileSync(datei), 'foto', eintrag.gesichter);
      warteschlange = warteschlange.filter((w) => w.name !== eintrag.name);
      console.log('Nachgereicht an die Cloud-Galerie:', eintrag.name, '(' + warteschlange.length + ' offen)');
    }
    saveJson(WARTE_DATEI, warteschlange);
    if (!warteschlange.length) fehlerMerken('');
  } catch (err) {
    /* Immer noch kein Netz – beim nächsten Mal wieder. Kein Protokollrauschen. */
  }
  warteLaeuft = false;
}

async function fotoInDieWolke(dateiName, mime, puffer, gesichter) {
  const m = settings.melden;
  if (!m || !m.enabled || !m.key || !m.fotos || typeof fetch !== 'function') return;
  try {
    await wolkeHochladen(dateiName, mime, puffer, 'foto', gesichter);
    await wolkeQrSichern();
  } catch (err) {
    console.log('Foto in die Cloud-Galerie fehlgeschlagen, kommt in die Warteschlange:', err.message);
    fehlerMerken(warteschlange.length + 1 + ' Foto(s) warten auf die Cloud');
    einreihen({ name: dateiName, mime, gesichter: gesichter || null, zeit: new Date().toISOString() });
  }
}

/* Die PIN-Prüfsumme geht NIE hinaus – auch nicht an den eigenen Rechner.
   Sonst könnte man sie am Cockpit vorbei offline durchprobieren. */
const ohnePin = (s) => {
  const b = s.betreiber || {};
  const { salz, kennwort, ...betreiberOffen } = b;
  return {
    ...s,
    kiosk: { enabled: !!(s.kiosk && s.kiosk.enabled), gesetzt: !!(s.kiosk && s.kiosk.pin) },
    /* Firmendaten und Logo dürfen hinaus — sie stehen ohnehin auf jedem Abzug
       und in jeder Rechnung. Salz und Prüfsumme nie. */
    betreiber: { ...betreiberOffen, angelegt: !!b.kennwort },
  };
};

function broadcast(msg) {
  /* Ein Ausgang, eine Regel: Trägt eine Nachricht Einstellungen, geht die
     PIN-Prüfsumme nicht mit. Der Weg über `/api/settings` war von Anfang an
     sauber, der über den Draht nicht — und am Draht hängt jedes Gerät im
     WLAN, das die Adresse kennt. Hier statt an sieben Aufrufstellen, weil
     die achte sonst irgendwann vergessen wird. */
  const data = JSON.stringify(msg && msg.settings ? { ...msg, settings: ohnePin(msg.settings) } : msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

/* ---------- Ruht die Box gerade? ----------
   Ein Selbst-Update darf sich NIE mitten in eine Feier drängen. Der Bildschirm
   verschwinden zu lassen, waehrend Gaeste davorstehen, waere schlimmer als der
   Fehler, den das Update behebt. Also merkt sich die Box, wann sie zuletzt
   wirklich benutzt wurde — und die Huelle fragt danach, bevor sie neu startet. */
/* ★ 0 heisst „seit dem Start nie benutzt". Vorher stand hier `Date.now()`,
   und damit galt eine frisch gestartete Box 30 Minuten lang als „in
   Benutzung" — obwohl sie niemand angefasst hatte. GEMESSEN: Ein Update lag
   nach dem Neustart in 12 Sekunden bereit und wurde trotzdem nicht
   eingespielt. Wer neu startet, hat gerade NICHT fotografiert. */
let letzteNutzung = 0;
const START_ZEIT = Date.now();
const genutzt = () => { letzteNutzung = Date.now(); };

function clientRoles() {
  const roles = {};
  for (const c of wss.clients) {
    const r = c.youboothRole || 'unbekannt';
    roles[r] = (roles[r] || 0) + 1;
  }
  return roles;
}

function photoMeta(file) {
  const stat = fs.statSync(path.join(PHOTOS_DIR, file));
  const ext = path.extname(file).toLowerCase();
  return {
    name: file,
    url: `/photos/${encodeURIComponent(file)}`,
    type: ext === '.webm' || ext === '.mp4' ? 'video' : 'image',
    time: stat.mtimeMs,
  };
}

function listPhotos() {
  return fs.readdirSync(PHOTOS_DIR)
    .filter((f) => /\.(jpe?g|png|gif|webp|webm|mp4)$/i.test(f))
    .map(photoMeta)
    .sort((a, b) => b.time - a.time);
}

/* Update jetzt pruefen. Ohne das wartet man bis zu einen Tag auf die
   naechste Runde – im Support ist das eine Ewigkeit. */
app.post('/api/update/pruefen', requireKey, async (req, res) => {
  await updatePruefen();
  res.json({ ok: true, neueVersion });
});

/* Von Hand einspielen. Der Betreiber weiss besser als jede Regel, ob er
   gerade neu starten darf — deshalb umgeht dieser Weg die Ruhe-Bedingung.
   Ohne Programmhuelle (Quellpaket, Mac) gibt es nichts einzuspielen; dann
   sagt die Antwort das, statt stillschweigend nichts zu tun. */
app.post('/api/update/einspielen', requireKey, (req, res) => {
  const hoerer = process.listenerCount('youbooth-update-einspielen');
  if (!hoerer) {
    return res.status(409).json({ ok: false,
      error: 'Diese Fassung läuft ohne Programmhülle – bitte den Installer von der Seite laden.' });
  }
  res.json({ ok: true, text: 'Wird eingespielt, die Box startet neu.' });
  setTimeout(() => { try { process.emit('youbooth-update-einspielen'); } catch (e) { /* nichts */ } }, 300);
});

/* ---------- API: Eigene Schriften ----------
   Bisher gab es sechs eingebaute Schriften. Wer die Hausschrift eines Kunden
   auf den Ausdruck bringen wollte, hatte keinen Weg — bei dslrBooth laedt man
   dafuer eine Schriftdatei nach, und genau das geht jetzt auch hier.

   Die Datei landet im Nutzerordner (ueberlebt Updates) und wird unter
   /eigene-schrift/ ausgeliefert. Geprueft wird nicht die Dateiendung, sondern
   der Dateianfang: Eine umbenannte .exe soll gar nicht erst liegen bleiben. */
const SCHRIFT_TYPEN = [
  { kennung: [0x77, 0x4f, 0x46, 0x32], endung: 'woff2' },   // wOF2
  { kennung: [0x77, 0x4f, 0x46, 0x46], endung: 'woff' },    // wOFF
  { kennung: [0x00, 0x01, 0x00, 0x00], endung: 'ttf' },     // TrueType
  { kennung: [0x74, 0x72, 0x75, 0x65], endung: 'ttf' },     // 'true'
  { kennung: [0x4f, 0x54, 0x54, 0x4f], endung: 'otf' },     // OTTO
];

function schriftTypVon(puffer) {
  return SCHRIFT_TYPEN.find(t => t.kennung.every((b, i) => puffer[i] === b)) || null;
}

/* Aus dem Anzeigenamen einen Dateinamen machen, der nichts kaputt macht. */
function schriftDatei(name, endung) {
  const rein = String(name).toLowerCase()
    .replace(/[äÄ]/g, 'ae').replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return (rein || 'schrift') + '.' + endung;
}

const SCHRIFT_LISTE = () => path.join(CONFIG_DIR, 'schriften.json');
function schriftenListe() { return loadJson(SCHRIFT_LISTE(), []); }
function schriftenSpeichern(liste) {
  saveJson(SCHRIFT_LISTE(), liste);
  broadcast({ type: 'schriften', schriften: liste });
}

app.get('/api/schriften', (req, res) => res.json({ schriften: schriftenListe() }));

app.post('/api/schriften', requireKey, (req, res) => {
  const name = String((req.body || {}).name || '').trim().slice(0, 40);
  const daten = String((req.body || {}).datei || '');
  if (!name) return res.status(400).json({ error: 'Wie soll die Schrift heissen?' });

  const roh = daten.replace(/^data:[^,]*,/, '');
  let puffer;
  try { puffer = Buffer.from(roh, 'base64'); } catch (e) { puffer = null; }
  if (!puffer || puffer.length < 64) return res.status(400).json({ error: 'Die Datei ist leer oder unlesbar' });
  if (puffer.length > 3 * 1024 * 1024) return res.status(400).json({ error: 'Die Schrift ist groesser als 3 MB' });

  const typ = schriftTypVon(puffer);
  if (!typ) return res.status(400).json({ error: 'Das ist keine Schriftdatei (erlaubt: woff2, woff, ttf, otf)' });

  fs.mkdirSync(SCHRIFT_DIR, { recursive: true });
  const datei = schriftDatei(name, typ.endung);
  fs.writeFileSync(path.join(SCHRIFT_DIR, datei), puffer);

  const liste = schriftenListe().filter(x => x.datei !== datei);
  liste.push({ name, datei, groesse: puffer.length, art: typ.endung });
  schriftenSpeichern(liste.slice(0, 20));
  res.json({ ok: true, schriften: schriftenListe() });
});

app.delete('/api/schriften/:datei', requireKey, (req, res) => {
  const datei = path.basename(String(req.params.datei || ''));
  const liste = schriftenListe();
  if (!liste.some(x => x.datei === datei)) return res.status(404).json({ error: 'Diese Schrift gibt es nicht' });
  try { fs.unlinkSync(path.join(SCHRIFT_DIR, datei)); } catch (e) { /* schon weg ist auch gut */ }
  schriftenSpeichern(liste.filter(x => x.datei !== datei));
  res.json({ ok: true, schriften: schriftenListe() });
});

/* ---------- API: Fernwartung & Diagnose ----------
   Beide Wege führen durch dieselbe Stelle wie ein Auftrag aus der Zentrale.
   Der Lagebericht ist auch ohne Support nützlich: Der Betreiber kann ihn
   ansehen und in ein Ticket kopieren, statt am Telefon Werte vorzulesen. */

app.get('/api/diagnose', requireKey, (req, res) => {
  res.json({ ok: true, text: diagnoseText() });
});

/* ---------- Fernauslöser für Gäste ----------
   Bewusst ohne Schlüssel: Wer im WLAN der Box steht und den QR-Code am Screen
   abfotografiert hat, darf auslösen — das ist der ganze Zweck. Was er NICHT
   darf, ist etwas einstellen; dafür ist `/api/fern/auftrag` da, und das liegt
   hinter dem Schlüssel.
   Die Sperre von drei Sekunden ist keine Sicherheit, sondern Anstand: Ohne sie
   hält ein Kind den Finger auf dem Knopf und der Booth kommt nicht mehr zur
   Ruhe. */
let letzterFernstart = 0;
app.post('/api/fern/ausloesen', (req, res) => {
  const jetzt = Date.now();
  if (jetzt - letzterFernstart < 3000) {
    return res.status(429).json({ ok: false, error: 'Einen Moment — der Booth läuft schon.' });
  }
  letzterFernstart = jetzt;
  broadcast({ type: 'control', action: 'trigger', target: 'booth', url: null, mode: null });
  res.json({ ok: true });
});

/* Einen Auftrag hier und jetzt ausführen – derselbe Code, den die Box auch
   für Aufträge der Zentrale nimmt. Hinter dem Lizenzschlüssel, weil er
   Einstellungen ändern kann. */
app.post('/api/fern/auftrag', requireKey, (req, res) => {
  const b = req.body || {};
  try {
    const text = fuehreAuftragAus({ art: String(b.art || ''), daten: b.daten || {} });
    res.json({ ok: true, text: String(text || '') });
  } catch (e) {
    res.status(400).json({ ok: false, fehler: e.message });
  }
});

/* ---------- Die Zentrale: Durchcheck und Reparatur ----------

   Warum das hier steht und nicht in der Oberfläche: Ein Durchcheck, der im
   Browser läuft, kann genau das prüfen, was der Browser sieht — und das ist
   fast nichts. Ob der Datenordner beschreibbar ist, ob noch eine alte Box auf
   dem Nachbarport klebt, ob überhaupt ein Drucker angemeldet ist: das weiß
   nur der Prozess auf dem Rechner.

   Jede Prüfung liefert dieselbe Form: eine Stufe (gut/warnung/fehler), einen
   Satz in Klartext und — wenn es etwas zu tun gibt — den Namen einer
   Reparatur. Ein Befund ohne Handgriff ist für den Betreiber vor einer
   wartenden Gesellschaft wertlos. */

function stufe(art, titel, text, reparatur) {
  const b = { art, titel, text };
  if (reparatur) b.reparatur = reparatur;
  return b;
}

/* Antwortet auf dem Port eine Box? Dieselbe Frage, die auch die Hülle
   stellt — hier, um eine hängende Altfassung zu FINDEN. */
function frageBoxAufPort(port, sekunden = 1) {
  return new Promise((fertig) => {
    const uhr = setTimeout(() => { anfrage.destroy(); fertig(null); }, sekunden * 1000);
    const anfrage = require('http').get(
      { host: '127.0.0.1', port, path: '/api/version', timeout: sekunden * 1000 },
      (antwort) => {
        let text = '';
        antwort.on('data', (t) => { text += t; if (text.length > 8192) anfrage.destroy(); });
        antwort.on('end', () => {
          clearTimeout(uhr);
          try { const d = JSON.parse(text); fertig(d && d.version ? String(d.version) : null); }
          catch (e) { fertig(null); }
        });
      });
    anfrage.on('error', () => { clearTimeout(uhr); fertig(null); });
    anfrage.on('timeout', () => anfrage.destroy());
  });
}

async function durchcheck() {
  const befunde = [];

  /* 1 — Der Datenordner. Ohne ihn ist jede Aufnahme des Abends verloren, und
     zwar erst dann, wenn sie schon gemacht ist. */
  try {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
    const probe = path.join(DATA_DIR, '.schreibprobe');
    fs.writeFileSync(probe, 'x');
    fs.unlinkSync(probe);
    befunde.push(stufe('gut', 'Datenordner', `Beschreibbar: ${DATA_DIR}`));
  } catch (e) {
    befunde.push(stufe('fehler', 'Datenordner',
      `Nicht beschreibbar: ${DATA_DIR} (${e.message}). Aufnahmen könnten verloren gehen.`,
      'datenordner'));
  }

  /* 2 — Platz. 100 Aufnahmen mit Streifen und Abzug sind schnell ein
     Gigabyte; ein volles Laufwerk mitten in der Feier ist der teuerste
     Ausfall, den es hier gibt. */
  try {
    const st = fs.statfsSync ? fs.statfsSync(DATA_DIR) : null;
    if (st) {
      const freiGb = (st.bavail * st.bsize) / 1073741824;
      befunde.push(freiGb < 1
        ? stufe('fehler', 'Speicherplatz', `Nur noch ${freiGb.toFixed(1)} GB frei. Das reicht für keinen Abend.`, 'aufraeumen')
        : freiGb < 5
          ? stufe('warnung', 'Speicherplatz', `${freiGb.toFixed(1)} GB frei. Für einen langen Abend knapp.`, 'aufraeumen')
          : stufe('gut', 'Speicherplatz', `${freiGb.toFixed(0)} GB frei.`));
    }
  } catch (e) { /* auf manchen Systemen nicht abfragbar — dann eben nicht */ }

  /* 3 — Der Port. Läuft die Box nicht auf dem Wunschport, ist das kein
     Fehler, aber der Betreiber sollte es wissen: QR-Codes und Lesezeichen
     zeigen dann woandershin. */
  befunde.push(PORT === PORT_WUNSCH
    ? stufe('gut', 'Anschluss', `Port ${PORT}, wie vorgesehen.`)
    : stufe('warnung', 'Anschluss',
        `Die Box läuft auf Port ${PORT} statt ${PORT_WUNSCH} — dort war etwas anderes.`));

  /* 4 — Reste früherer Fassungen. GENAU DAS hat einen Betreiber einen Abend
     gekostet: Ein Dienst der alten Fassung hielt den Port, die neue Box
     verabschiedete sich höflich, und das Fenster meldete „startet nicht". */
  const reste = [];
  for (let p = PORT_WUNSCH; p <= PORT_WUNSCH + 10; p++) {
    if (p === PORT) continue;
    const fassung = await frageBoxAufPort(p);
    if (fassung) reste.push({ port: p, fassung });
  }
  befunde.push(reste.length === 0
    ? stufe('gut', 'Doppelte Dienste', 'Es läuft genau eine Box.')
    : stufe('warnung', 'Doppelte Dienste',
        `Es antwortet noch ${reste.map((r) => `Fassung ${r.fassung} auf Port ${r.port}`).join(', ')}. `
        + 'Das ist meist ein Rest einer früheren Installation.',
        'reste'));

  /* 5 — Drucker. Dieselbe Abfrage wie `/api/printers`, nur hier abgewartet. */
  if (!CAN_PRINT) {
    befunde.push(stufe('warnung', 'Drucker', 'Diese Fassung druckt nicht — sie läuft ohne Programmhülle.'));
  } else {
    const drucker = await new Promise((fertig) => {
      execFile('powershell', ['-NoProfile', '-Command', 'Get-Printer | Select-Object -ExpandProperty Name'],
        { timeout: 15000 }, (fehler, ausgabe) => {
          if (fehler) return fertig(null);
          fertig(String(ausgabe).split(/\r?\n/).map((z) => z.trim()).filter(Boolean));
        });
    });
    const gewaehlt = settings.printer || '';
    befunde.push(drucker === null
      ? stufe('warnung', 'Drucker', 'Die Druckerabfrage antwortet nicht. Aufnehmen geht, drucken vielleicht nicht.')
      : drucker.length === 0
        ? stufe('warnung', 'Drucker', 'Es ist kein Drucker angemeldet. Aufnehmen geht, drucken nicht.')
        : !gewaehlt
          ? stufe('warnung', 'Drucker', `${drucker.length} Drucker gefunden, aber keiner ausgewählt.`, 'drucker')
          : drucker.includes(gewaehlt)
            ? stufe('gut', 'Drucker', `Ausgewählt: ${gewaehlt}`)
            : stufe('fehler', 'Drucker',
                `Ausgewählt ist „${gewaehlt}", angemeldet ist der nicht mehr.`, 'drucker'));
  }

  /* 6 — Vorlagen. Ohne sie kommt aus dem Drucker ein leeres Blatt. */
  befunde.push(!Array.isArray(templates) || templates.length === 0
    ? stufe('fehler', 'Vorlagen', 'Es ist keine einzige Vorlage geladen.', 'vorlagen')
    : stufe('gut', 'Vorlagen', `${templates.length} Vorlagen geladen.`));

  /* 7 — Betreiber. */
  befunde.push(betreiberAngelegt()
    ? stufe('gut', 'Betreiber', `Eingerichtet: ${settings.betreiber.email}`)
    : stufe('warnung', 'Betreiber', 'Noch kein Betreiber eingerichtet. Portal und Einstellungen sind gesperrt.'));

  /* 8 — Lizenz. */
  const liz = settings.lizenz || null;
  befunde.push(liz && liz.key
    ? stufe('gut', 'Lizenz', `Aktiv${liz.plan ? ` · ${liz.plan}` : ''}.`)
    : stufe('warnung', 'Lizenz', 'Keine Lizenz hinterlegt. Die Box läuft, gebuchte Module fehlen.'));

  /* 9 — Kommt eine neue Fassung durch? Nur eine Frage, kein Download. */
  try {
    const steuer = new AbortController();
    const uhr = setTimeout(() => steuer.abort(), 5000);
    const r = await fetch('https://youbooth.me/dl/latest.yml', { signal: steuer.signal });
    clearTimeout(uhr);
    const text = await r.text();
    const dort = (text.match(/^version:\s*(.+)$/m) || [])[1];
    befunde.push(!dort
      ? stufe('warnung', 'Aktualisierung', 'Das Downloadzentrum antwortet, nennt aber keine Fassung.')
      : dort.trim() === APP_VERSION
        ? stufe('gut', 'Aktualisierung', `Diese Box ist auf dem neuesten Stand (${APP_VERSION}).`)
        : stufe('warnung', 'Aktualisierung',
            `Hier läuft ${APP_VERSION}, bereit liegt ${dort.trim()}.`, 'aktualisieren'));
  } catch (e) {
    befunde.push(stufe('warnung', 'Aktualisierung',
      'youbooth.me ist gerade nicht erreichbar. Im Saal ist das normal und harmlos.'));
  }

  return {
    fassung: APP_VERSION,
    port: PORT,
    datenordner: DATA_DIR,
    zeitpunkt: new Date().toISOString(),
    befunde,
  };
}

app.get('/api/zentrale/check', async (req, res) => {
  try {
    res.json(await durchcheck());
  } catch (e) {
    res.status(500).json({ error: 'Der Durchcheck ist gescheitert: ' + e.message });
  }
});

/* Reparaturen. Jede tut GENAU eine Sache und sagt in einem Satz, was sie
   getan hat — „behoben" allein ist keine Auskunft. Nur vom Gerät selbst:
   Wer davorsteht, darf reparieren; wer im WLAN sitzt, nicht. */
app.post('/api/zentrale/reparatur', async (req, res) => {
  if (!isLocal(req)) return res.status(403).json({ error: 'Reparieren geht nur am Booth-PC.' });
  const was = String((req.body || {}).was || '');

  try {
    if (was === 'datenordner') {
      fs.mkdirSync(PHOTOS_DIR, { recursive: true });
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
      return res.json({ ok: true, text: `Ordner angelegt: ${DATA_DIR}` });
    }

    if (was === 'reste') {
      /* Die höfliche Bitte zuerst. Fassungen vor 1.0.4 kennen sie nicht —
         dann bleibt nur der Hinweis, denn einen fremden Prozess ungefragt
         abzuschießen ist auf einem Rechner, der auch anderes tut, falsch. */
      const beendet = [];
      const hartnaeckig = [];
      for (let p = PORT_WUNSCH; p <= PORT_WUNSCH + 10; p++) {
        if (p === PORT) continue;
        const fassung = await frageBoxAufPort(p);
        if (!fassung) continue;
        const ok = await new Promise((fertig) => {
          const a = require('http').request(
            { host: '127.0.0.1', port: p, path: '/api/beenden', method: 'POST', timeout: 3000 },
            (antwort) => { antwort.resume(); antwort.on('end', () => fertig(antwort.statusCode === 200)); });
          a.on('error', () => fertig(false));
          a.on('timeout', () => { a.destroy(); fertig(false); });
          a.end();
        });
        (ok ? beendet : hartnaeckig).push(`${fassung} auf Port ${p}`);
      }
      const text = [
        beendet.length ? `Beendet: ${beendet.join(', ')}.` : '',
        hartnaeckig.length
          ? `Nicht erreicht: ${hartnaeckig.join(', ')} — diese Fassung kennt den Weg noch nicht. `
            + 'Ein Neustart des Rechners räumt sie sicher weg.'
          : '',
        !beendet.length && !hartnaeckig.length ? 'Es lief nichts weiter — nichts zu tun.' : '',
      ].filter(Boolean).join(' ');
      return res.json({ ok: !hartnaeckig.length, text });
    }

    if (was === 'vorlagen') {
      const vorher = templates.length;
      templates = ALLE_VORLAGEN.slice();
      saveJson(TEMPLATES_FILE, templates);
      broadcast({ type: 'templates', templates });
      return res.json({ ok: true, text: `Vorlagen zurückgesetzt: ${vorher} → ${templates.length}.` });
    }

    if (was === 'neustart') {
      /* Nur, wenn eine Hülle da ist, die uns wieder startet. Sonst wäre der
         Knopf ein Ausschalter mit falscher Beschriftung. */
      if (typeof process.send !== 'function') {
        return res.status(400).json({ error: 'Ohne Programmhülle würde die Box nicht wieder hochkommen.' });
      }
      res.json({ ok: true, text: 'Die Box startet neu. Einen Moment.' });
      setTimeout(() => process.exit(0), 250);
      return;
    }

    return res.status(400).json({ error: `Unbekannte Reparatur: ${was}` });
  } catch (e) {
    return res.status(500).json({ error: 'Die Reparatur ist gescheitert: ' + e.message });
  }
});

/* ---------- API: Infos & QR ---------- */

app.get('/api/info', (req, res) => {
  const base = baseUrl();
  res.set('Access-Control-Allow-Origin', '*');   // Dashboard darf entfernte Boxen pingen
  res.json({
    ip: lanIp(),
    port: PORT,
    base,
    edition: EDITION,
    canPrint: CAN_PRINT,
    publicBase: PUBLIC_BASE || null,
    /* Adresse der Cloud-Galerie dieses Events, falls die Box sie schon hat.
       Die Teilen-Station baut daraus QR-Codes, die auch nach dem Heimweg des
       Gastes noch funktionieren – anders als eine WLAN-interne Adresse. */
    cloudGalerie: wolke.galerieUrl || null,
    urls: {
      home: `${base}/`,
      booth: `${base}/`,
      mosaic: `${base}/wand.html`,
      join: `${base}/join.html`,
      cam: `${base}/gastkamera.html`,
      guestbook: `${base}/gaestebuch.html`,
      gallery: `${base}/galerie.html`,
      station: `${base}/station.html`,
      admin: `${base}/cockpit.html`,
    },
  });
});

app.get('/api/status', (req, res) => {
  res.json({
    photos: listPhotos().length,
    clients: clientRoles(),
    uptime: Math.round(process.uptime()),
    warteschlange: warteschlange.length,
    neueVersion,
    settings,
  });
});

/* Die Huelle fragt hier, bevor sie ein Update einspielt. Bewusst OHNE
   Schluessel: Es ist eine reine Ja/Nein-Auskunft ohne Daten, und sie wird nur
   von localhost gebraucht. */
app.get('/api/leerlauf', (req, res) => {
  const rollen = clientRoles();
  const booths = (rollen.booth || 0) + (rollen.mosaic || 0) + (rollen.cam || 0);
  /* Nie benutzt = so ruhig wie moeglich. */
  const ruhigSek = letzteNutzung
    ? Math.round((Date.now() - letzteNutzung) / 1000)
    : Math.round((Date.now() - START_ZEIT) / 1000) + 24 * 3600;
  /* Aber nicht in den ersten Minuten nach dem Start einspielen: Booth und
     Mosaikwand brauchen ein paar Sekunden, um sich wieder zu verbinden.
     Ohne diese Schonzeit koennte ein Neustart mitten in eine Feier fallen,
     bevor die Bildschirme ueberhaupt gezaehlt werden konnten. */
  const seitStartSek = Math.round((Date.now() - START_ZEIT) / 1000);
  const SCHONZEIT_SEK = 180;
  /* Zwei Bedingungen, und beide muessen stimmen: seit 30 Minuten keine
     Aufnahme UND kein Gaeste-Bildschirm verbunden. Nur eine davon reicht
     nicht — eine Box in der Essenspause hat lange keine Aufnahme, steht aber
     mit offenem Booth mitten im Raum. */
  /* Die Schwellen stehen mit in der Antwort. Das ist kein Beiwerk: Wenn eine
     Box sich nicht erneuert, ist die erste Frage im Support „warum nicht",
     und die Antwort soll aus einem einzigen Aufruf ablesbar sein statt aus
     dem Quelltext. */
  const SCHWELLE_SEK = 30 * 60;
  const SCHWELLE_DRINGEND_SEK = 10 * 60;
  const leerlauf = ruhigSek >= SCHWELLE_SEK && booths === 0;
  /* Ventil fuer den Dauerbetrieb: Eine Box, die rund um die Uhr mit offenem
     Booth im Foyer steht, kaeme sonst NIE in den Leerlauf und wuerde sich nie
     erneuern. Bei einer Pflicht- oder Sperr-Fassung genuegt deshalb, dass
     zehn Minuten lang niemand ausgeloest hat — eine gesperrte Box bedient
     ohnehin keine Gaeste mehr. */
  const dringend = !!(neueVersion && (neueVersion.pflicht || neueVersion.gesperrt));

  /* ---------- Das Ventil gegen den offenen Reiter ----------
     GEMESSEN am 11.08.2026 auf einer echten Box: `booths: 1` über
     **26 Stunden**, dabei keine einzige Aufnahme. Ein Booth-Reiter stand
     irgendwo offen, und nach der Regel „ein Gäste-Bildschirm verbunden =
     in Benutzung" wurde 26 Stunden lang kein Update eingespielt.

     Die Regel ist richtig gemeint und für den Betrieb auch richtig: Eine Box
     mit offenem Booth steht im Raum, und ein Neustart mitten in der Feier
     wäre schlimmer als eine alte Fassung. Aber sie kennt keine Obergrenze.
     Nach vier Stunden ohne eine einzige Auslösung findet keine Feier statt —
     dann ist ein zwanzig Sekunden langer Neustart harmlos, egal wie viele
     Reiter offen stehen. Ohne dieses Ventil erneuert sich eine Box, an der
     jemand einen Reiter vergessen hat, buchstäblich nie. */
  const SCHWELLE_TROTZDEM_SEK = 4 * 3600;
  const trotzBildschirmen = ruhigSek >= SCHWELLE_TROTZDEM_SEK;

  const jetztInstallieren = seitStartSek >= SCHONZEIT_SEK
    && (leerlauf || trotzBildschirmen || (dringend && ruhigSek >= SCHWELLE_DRINGEND_SEK));

  /* Warum NICHT, in einem Satz und in Klartext. Ohne diesen Satz endet jede
     Supportfrage „warum aktualisiert die sich nicht" im Quelltext — genau das
     ist hier passiert. */
  let grund = '';
  if (jetztInstallieren) grund = 'Es spricht nichts dagegen.';
  else if (seitStartSek < SCHONZEIT_SEK) {
    grund = 'Die Box ist gerade erst gestartet (Schonzeit noch '
      + (SCHONZEIT_SEK - seitStartSek) + ' s).';
  } else if (booths > 0 && ruhigSek < SCHWELLE_TROTZDEM_SEK) {
    grund = booths + ' Gäste-Bildschirm(e) verbunden. Wird eingespielt, sobald sie '
      + 'geschlossen sind — spätestens nach ' + Math.round(SCHWELLE_TROTZDEM_SEK / 3600)
      + ' Stunden ohne Aufnahme (noch '
      + Math.max(0, Math.round((SCHWELLE_TROTZDEM_SEK - ruhigSek) / 60)) + ' min).';
  } else if (ruhigSek < SCHWELLE_SEK) {
    grund = 'Vor ' + Math.round(ruhigSek / 60) + ' min wurde noch ausgelöst. '
      + 'Nötig sind ' + Math.round(SCHWELLE_SEK / 60) + ' min Ruhe.';
  } else {
    grund = 'Unklar — bitte die Werte unten prüfen.';
  }

  res.json({
    leerlauf, jetztInstallieren, dringend, grund, ruhigSek, booths, verbunden: rollen,
    schwelleSek: SCHWELLE_SEK, schwelleDringendSek: SCHWELLE_DRINGEND_SEK,
    schwelleTrotzdemSek: SCHWELLE_TROTZDEM_SEK,
    seitStartSek, schonzeitSek: SCHONZEIT_SEK, nieBenutzt: !letzteNutzung,
  });
});

app.get('/api/qr', async (req, res) => {
  const data = String(req.query.data || baseUrl());
  const dark = /^[0-9a-fA-F]{6}$/.test(req.query.dark || '') ? `#${req.query.dark}` : '#141210';
  const light = /^[0-9a-fA-F]{6}$/.test(req.query.light || '') ? `#${req.query.light}` : '#f6f1e7';
  try {
    const png = await QRCode.toBuffer(data, {
      type: 'png',
      width: Math.min(parseInt(req.query.size, 10) || 480, 1200),
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark, light },
    });
    res.set('Content-Type', 'image/png').set('Cache-Control', 'no-store').send(png);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* ---------- API: Anmeldung des Betreibers ---------- */

/* Wer bin ich, und ist diese Box schon eingerichtet? Bewusst ohne Schutz:
   Genau diese Frage stellt jede Oberfläche, bevor sie weiß, ob sie den
   Anmeldeschirm oder ihren Inhalt zeigen soll. */
app.get('/api/betreiber', (req, res) => {
  const b = settings.betreiber || {};
  res.json({
    angelegt: betreiberAngelegt(),
    angemeldet: sitzungGueltig(markeAusAnfrage(req)),
    name: b.name || '',
    email: b.email || '',
    firma: b.firma || '',
  });
});

/* Ersteinrichtung: das eine Mal, an dem ein Kennwort ohne Anmeldung gesetzt
   werden darf — und nur vom Gerät selbst. Wer im Gäste-WLAN steht, soll sich
   nicht zum Betreiber einer fremden Box machen können. */
app.post('/api/betreiber/einrichten', (req, res) => {
  if (betreiberAngelegt()) {
    return res.status(409).json({ error: 'Diese Box hat schon einen Betreiber.' });
  }
  if (!isLocal(req)) {
    return res.status(403).json({ error: 'Die Ersteinrichtung geht nur am Gerät selbst.' });
  }
  const b = req.body || {};
  const name = rClean(b.name, 80);
  const email = rClean(b.email, 120);
  const kennwort = String(b.kennwort || '');

  if (!name || !email) return res.status(400).json({ error: 'Name und E-Mail sind Pflicht.' });
  /* Zehn Zeichen, nicht acht. Das hier hält eine Kundenkartei, und die
     Zwangspause unten hilft nur gegen Versuche über die Leitung — nicht gegen
     jemanden, der die settings.json mitnimmt. */
  if (kennwort.length < 10) {
    return res.status(400).json({ error: 'Das Kennwort braucht mindestens zehn Zeichen.' });
  }

  const salz = crypto.randomBytes(16).toString('hex');
  settings.betreiber = {
    ...settings.betreiber,
    name, email, salz,
    kennwort: kennwortPruefsumme(kennwort, salz),
  };
  saveJson(SETTINGS_FILE, settings);
  console.log(`Betreiber eingerichtet: ${name} <${email}>`);

  const marke = sitzungAnlegen();
  setzeSitzungskeks(res, marke);
  res.json({ ok: true });
});

/* Nach einem Fehlversuch eine Zwangspause. Ohne sie probiert ein Skript im
   selben WLAN eine Kennwortliste in Minuten durch. */
let anmeldeSperreBis = 0;

app.post('/api/anmelden', (req, res) => {
  if (!betreiberAngelegt()) {
    return res.status(409).json({ error: 'Diese Box ist noch nicht eingerichtet.' });
  }
  if (Date.now() < anmeldeSperreBis) {
    return res.status(429).json({ error: 'Zu viele Versuche. Einen Moment warten.' });
  }

  const b = settings.betreiber;
  const email = rClean((req.body || {}).email, 120).toLowerCase();
  const kennwort = String((req.body || {}).kennwort || '');
  const summe = kennwortPruefsumme(kennwort, b.salz);

  /* Beide Vergleiche laufen immer, und der Kennwortvergleich zeitgleich:
     Sonst verrät die Antwortzeit, ob es die E-Mail überhaupt gibt. */
  const emailStimmt = email === String(b.email || '').toLowerCase();
  const kennwortStimmt =
    summe.length === String(b.kennwort).length &&
    crypto.timingSafeEqual(Buffer.from(summe), Buffer.from(String(b.kennwort)));

  if (!emailStimmt || !kennwortStimmt) {
    anmeldeSperreBis = Date.now() + 3000;
    // Eine Auskunft für beide Fälle: Welches der beiden falsch war, geht
    // niemanden etwas an, der es nicht ohnehin weiß.
    return res.status(403).json({ error: 'E-Mail oder Kennwort stimmt nicht.' });
  }

  setzeSitzungskeks(res, sitzungAnlegen());
  res.json({ ok: true });
});

app.post('/api/abmelden', (req, res) => {
  const marke = markeAusAnfrage(req);
  if (marke) SITZUNGEN.delete(marke);
  res.setHeader('Set-Cookie', 'youbooth_sitzung=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
  res.json({ ok: true });
});

/* Firmendaten und Logo — das, was auf Abzügen, Angeboten und Event-Seiten
   erscheint. Hinter der Anmeldung, weil es zum Betreiber gehört. */
app.put('/api/betreiber', requireKey, (req, res) => {
  const b = req.body || {};
  const alt = settings.betreiber || {};
  const t = (wert, laenge, ersatz) =>
    typeof wert === 'string' ? rClean(wert, laenge) : (ersatz || '');

  settings.betreiber = {
    ...alt,
    name: t(b.name, 80, alt.name),
    email: t(b.email, 120, alt.email),
    firma: t(b.firma, 120, alt.firma),
    strasse: t(b.strasse, 120, alt.strasse),
    plz: t(b.plz, 10, alt.plz),
    ort: t(b.ort, 80, alt.ort),
    land: t(b.land, 60, alt.land) || 'Deutschland',
    telefon: t(b.telefon, 40, alt.telefon),
    web: t(b.web, 200, alt.web),
    steuernummer: t(b.steuernummer, 40, alt.steuernummer),
    /* Das Logo darf ausdrücklich gelöscht werden (`null`), aber nicht durch
       eine leere Anfrage verschwinden — sonst kostet ein Tippfehler im
       Formular das Markenzeichen auf jedem Abzug. */
    logo:
      b.logo === null
        ? null
        : typeof b.logo === 'string' && b.logo.startsWith('data:image/') && b.logo.length < 2_000_000
          ? b.logo
          : alt.logo || null,
  };
  saveJson(SETTINGS_FILE, settings);
  broadcast({ type: 'settings', settings });
  res.json({ ok: true, betreiber: ohnePin(settings).betreiber });
});

/* Kennwort ändern: nur angemeldet, und nur mit dem alten. */
app.post('/api/betreiber/kennwort', requireKey, (req, res) => {
  const b = settings.betreiber || {};
  const altes = String((req.body || {}).alt || '');
  const neues = String((req.body || {}).neu || '');
  const summe = kennwortPruefsumme(altes, b.salz);
  const stimmt =
    summe.length === String(b.kennwort).length &&
    crypto.timingSafeEqual(Buffer.from(summe), Buffer.from(String(b.kennwort)));

  if (!stimmt) return res.status(403).json({ error: 'Das bisherige Kennwort stimmt nicht.' });
  if (neues.length < 10) {
    return res.status(400).json({ error: 'Das neue Kennwort braucht mindestens zehn Zeichen.' });
  }

  const salz = crypto.randomBytes(16).toString('hex');
  settings.betreiber = { ...b, salz, kennwort: kennwortPruefsumme(neues, salz) };
  saveJson(SETTINGS_FILE, settings);
  /* Alle anderen Sitzungen fallen — wer das Kennwort ändert, will meistens
     genau das: jemanden aussperren. */
  SITZUNGEN.clear();
  setzeSitzungskeks(res, sitzungAnlegen());
  res.json({ ok: true });
});

function setzeSitzungskeks(res, marke) {
  /* Kein `Secure`: Die Box läuft im Saal über http im eigenen WLAN, und ein
     Keks mit `Secure` käme dort nie an. `HttpOnly` und `SameSite=Lax` gelten
     trotzdem — sie kosten nichts und schließen die häufigsten Löcher. */
  res.setHeader(
    'Set-Cookie',
    `youbooth_sitzung=${marke}; Path=/; Max-Age=${Math.floor(SITZUNGSDAUER / 1000)}; HttpOnly; SameSite=Lax`
  );
}

/* ---------- API: Einstellungen ---------- */

app.get('/api/settings', (req, res) => {
  /* 21 Bildschirme lesen hier. Sie sollen sehen, was FÜR DIESE FEIER gilt —
     also Geräteeinstellungen mit den Werten des Events darüber.

     Genau eine Ausnahme: Das Cockpit bearbeitet die Einstellungen DIESES
     GERÄTS und muss deshalb die unvermischten sehen. Sonst schriebe der
     Betreiber beim nächsten Speichern die Event-Werte in sein Gerät und
     hätte sie nach der Feier für immer. Dafür `?geraet=1`. */
  const roh = req.query.geraet === '1';
  const daten = roh ? settings : wirksam();
  if (isLocal(req)) {
    return res.json({ ...ohnePin(daten),
      _event: eventEinstellungen ? { name: eventName, felder: Object.keys(eventEinstellungen) } : null });
  }
  /* Extern (Tunnel/Gast): sensible Schlüssel nicht mitschicken */
  const safe = JSON.parse(JSON.stringify(ohnePin(daten)));
  if (safe.aiArt) safe.aiArt = { enabled: !!safe.aiArt.enabled, endpoint: '', key: '' };
  if (safe.cloud) safe.cloud = { enabled: !!safe.cloud.enabled, url: '', key: '', secret: '' };
  if (safe.melden) safe.melden = {
    enabled: !!safe.melden.enabled, url: '', key: '',
    puls: Number(safe.melden.puls) || 0, fotos: !!safe.melden.fotos,
  };
  res.json(safe);
});

/* Generative KI-Kunst: Proxy zum konfigurierten Endpoint (Key bleibt am Server).
   Vertrag: Endpoint bekommt {image, prompt} und liefert {image} zurück. */
app.post('/api/aiart', async (req, res) => {
  if (!settings.aiArt.enabled || !settings.aiArt.endpoint) {
    return res.status(400).json({ error: 'KI-Kunst ist nicht konfiguriert (Cockpit → KI-Kunst).' });
  }
  const { image, prompt } = req.body || {};
  if (typeof image !== 'string' || !image.startsWith('data:image/')) return res.status(400).json({ error: 'Ungültiges Bild' });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 90000);
  try {
    const r = await fetch(settings.aiArt.endpoint, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(settings.aiArt.key ? { Authorization: 'Bearer ' + settings.aiArt.key } : {}) },
      body: JSON.stringify({ image, prompt: String(prompt || '').slice(0, 300) }),
    });
    if (!r.ok) return res.status(502).json({ error: 'KI-Endpoint antwortete mit ' + r.status });
    const data = await r.json();
    if (!data || typeof data.image !== 'string') return res.status(502).json({ error: 'KI-Endpoint lieferte kein Bild im erwarteten Format' });
    recordStat('aiart');
    res.json({ ok: true, image: data.image });
  } catch (e) {
    res.status(502).json({ error: 'KI-Endpoint nicht erreichbar: ' + String(e.message || e).slice(0, 120) });
  } finally { clearTimeout(timer); }
});

/* Lizenz-Schlüssel nur am Gerät selbst einsehbar (für die Übergabe an den Kunden) */
app.get('/api/license', (req, res) => {
  if (!isLocal(req)) return res.status(403).json({ error: 'Nur direkt am Booth-PC abrufbar' });
  res.json({ key: license.key, created: license.created });
});

app.put('/api/settings', requireKey, (req, res) => {
  const b = req.body || {};
  if (typeof b.eventName === 'string') settings.eventName = b.eventName.slice(0, 80);
  if (typeof b.tagline === 'string') settings.tagline = b.tagline.slice(0, 80);
  if (typeof b.brandName === 'string') settings.brandName = b.brandName.slice(0, 40) || 'Youbooth';
  if (typeof b.whitelabel === 'boolean') settings.whitelabel = b.whitelabel;
  if (typeof b.printing === 'boolean') settings.printing = b.printing;
  if (b.druck && typeof b.druck === 'object') {
    if (typeof b.druck.streifenDoppelt === 'boolean') settings.druck.streifenDoppelt = b.druck.streifenDoppelt;
    if (typeof b.druck.schnittlinie === 'boolean') settings.druck.schnittlinie = b.druck.schnittlinie;
    if (Number.isFinite(b.druck.maxProStunde)) settings.druck.maxProStunde = Math.min(2000, Math.max(0, Math.round(b.druck.maxProStunde)));
  }
  if (typeof b.printer === 'string' || b.printer === null) settings.printer = b.printer ? String(b.printer).slice(0, 120) : null;
  if (typeof b.boxName === 'string') settings.boxName = b.boxName.slice(0, 40);
  if (b.booth && typeof b.booth === 'object') {
    const z = settings.booth;
    if (['ruhe', 'puls', 'laufband'].includes(b.booth.attractstil)) z.attractstil = b.booth.attractstil;
    if (typeof b.booth.uebergang === 'boolean') z.uebergang = b.booth.uebergang;
    if (typeof b.booth.blitz === 'boolean') z.blitz = b.booth.blitz;
    /* Grenzen mit Grund: Unter zehn Sekunden Leerlauf springt die Box einem
       Gast vor der Nase weg, und eine Loeschfrist von null Tagen loeschte die
       Aufnahme, bevor der Gast sie geladen hat. */
    if (Number.isFinite(b.booth.leerlauf)) z.leerlauf = Math.min(600, Math.max(10, Math.round(b.booth.leerlauf)));
    if (Number.isFinite(b.booth.autoWeiter)) z.autoWeiter = Math.min(300, Math.max(2, Math.round(b.booth.autoWeiter)));
    if (Number.isFinite(b.booth.loeschfristTage)) z.loeschfristTage = Math.min(3650, Math.max(1, Math.round(b.booth.loeschfristTage)));
  }
  if (COUNTDOWN_STYLES.includes(b.countdownStyle)) settings.countdownStyle = b.countdownStyle;
  if (['grid', 'overlay', 'logo', 'photomosaic'].includes(b.mosaicMode)) settings.mosaicMode = b.mosaicMode;
  if (b.auswahl && typeof b.auswahl === 'object') {
    const a = settings.auswahl || { aktiv: false, vorlagen: [], sekunden: 12 };
    if (typeof b.auswahl.aktiv === 'boolean') a.aktiv = b.auswahl.aktiv;
    if (Array.isArray(b.auswahl.vorlagen)) {
      /* Nur Kennungen, die es wirklich gibt – sonst zeigt der Booth eine
         Auswahl mit einem Feld, das nichts ergibt. */
      a.vorlagen = b.auswahl.vorlagen
        .map(v => String(v).slice(0, 80))
        .filter(v => templates.some(t => t.id === v))
        .slice(0, 8);
    }
    const sek = parseInt(b.auswahl.sekunden, 10);
    if (Number.isFinite(sek)) a.sekunden = Math.min(60, Math.max(3, sek));
    settings.auswahl = a;
  }
  if (b.fernwartung && typeof b.fernwartung === 'object' && typeof b.fernwartung.erlaubt === 'boolean') {
    settings.fernwartung = { ...(settings.fernwartung || {}), erlaubt: b.fernwartung.erlaubt };
  }
  if (b.mosaicTarget === null) settings.mosaicTarget = null;
  if (typeof b.mosaicTarget === 'string' && b.mosaicTarget.startsWith('data:image/') && b.mosaicTarget.length < 3_000_000) settings.mosaicTarget = b.mosaicTarget;
  if (Number.isInteger(b.mosaicCols) && b.mosaicCols >= 12 && b.mosaicCols <= 120) settings.mosaicCols = b.mosaicCols;
  if (Number.isFinite(b.mosaicStrength) && b.mosaicStrength >= 0 && b.mosaicStrength <= 1) settings.mosaicStrength = b.mosaicStrength;
  if (typeof b.mosaicSticker === 'boolean') settings.mosaicSticker = b.mosaicSticker;
  if (Number.isInteger(b.countdown) && b.countdown >= 1 && b.countdown <= 10) settings.countdown = b.countdown;
  if (b.logo === null) settings.logo = null;
  if (typeof b.logo === 'string' && b.logo.startsWith('data:image/') && b.logo.length < 3_000_000) settings.logo = b.logo;
  if (b.attract && typeof b.attract === 'object') {
    if (typeof b.attract.headline === 'string') settings.attract.headline = b.attract.headline.slice(0, 60);
    if (typeof b.attract.hint === 'string') settings.attract.hint = b.attract.hint.slice(0, 60);
  }
  if (b.ticker && typeof b.ticker === 'object') {
    if (typeof b.ticker.enabled === 'boolean') settings.ticker.enabled = b.ticker.enabled;
    if (typeof b.ticker.text === 'string') settings.ticker.text = b.ticker.text.slice(0, 400);
  }
  if (b.wand && typeof b.wand === 'object') {
    if (b.wand.zeigen && typeof b.wand.zeigen === 'object') {
      /* Nur die bekannten Schalter übernehmen. Käme ein unbekannter Name
         durch, stünde er für immer in der Datei und niemand wüsste, wozu. */
      for (const k of ['marke', 'logo', 'gross', 'qr', 'laufband', 'fortschritt']) {
        if (typeof b.wand.zeigen[k] === 'boolean') settings.wand.zeigen[k] = b.wand.zeigen[k];
      }
    }
    if (typeof b.wand.ueberschrift === 'string') settings.wand.ueberschrift = b.wand.ueberschrift.slice(0, 80);
  }
  if (b.offer && typeof b.offer === 'object') {
    for (const k of ['print', 'qr', 'whatsapp', 'mail', 'sms', 'native', 'gallery', 'guestUpload']) {
      if (typeof b.offer[k] === 'boolean') settings.offer[k] = b.offer[k];
    }
  }
  /* ---------- Gestaltete Bildschirme ----------
     Die Prüfung stand nur für `front` da und war damit an EINEN Bildschirm
     gebunden. Sie ist jetzt eine eigene Funktion und gilt für alle vier.
     Zweimal dieselbe Prüfung zu schreiben hieße: Die zweite ist irgendwann
     lascher als die erste, und genau darüber kommt dann etwas herein. */
  const elementePruefen = (roh) => {
    if (!Array.isArray(roh)) return null;
    const num = (v, min, max, fb) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
    };
    const anims = ['none', 'pulse', 'spin3d', 'float', 'glow', 'slide', 'spinfloat'];
    const raus = roh.slice(0, 12)
      .filter((e) => e && ['text', 'logo'].includes(e.type))
      .map((e) => ({
        type: e.type,
        content: String(e.content || '').slice(0, 120),
        x: num(e.x, 0, 1, 0.5), y: num(e.y, 0, 1, 0.5),
        size: num(e.size, 10, 300, 60),
        color: /^#[0-9a-fA-F]{6}$/.test(e.color || '') ? e.color : '#f6f1e7',
        font: ['display', 'ui'].includes(e.font) ? e.font : 'display',
        anim: anims.includes(e.anim) ? e.anim : 'none',
        speed: num(e.speed, 0.25, 4, 1),   // Tempo-Multiplikator (1 = normal)
      }));
    return raus.length ? raus : null;
  };

  if (b.front === null) settings.front = null;
  if (b.front && typeof b.front === 'object') {
    const el = elementePruefen(b.front.elements);
    settings.front = el ? { elements: el } : null;
  }

  if (b.bildschirme && typeof b.bildschirme === 'object') {
    if (!settings.bildschirme || typeof settings.bildschirme !== 'object') settings.bildschirme = {};
    /* Nur die vier bekannten Namen. Eine offene Liste wäre ein Ort, an dem
       sich beliebige Daten in den Einstellungen ablegen ließen. */
    for (const name of ['attract', 'auswahl', 'ergebnis', 'teilen']) {
      if (!(name in b.bildschirme)) continue;
      const w = b.bildschirme[name];
      settings.bildschirme[name] = (w && typeof w === 'object')
        ? (elementePruefen(w.elements) ? { elements: elementePruefen(w.elements) } : null)
        : null;
    }
  }
  if (b.cloud && typeof b.cloud === 'object') {
    if (typeof b.cloud.enabled === 'boolean') settings.cloud.enabled = b.cloud.enabled;
    if (typeof b.cloud.url === 'string') settings.cloud.url = b.cloud.url.slice(0, 300);
    if (typeof b.cloud.key === 'string') settings.cloud.key = b.cloud.key.slice(0, 120);
    if (typeof b.cloud.secret === 'string') settings.cloud.secret = b.cloud.secret.slice(0, 120);
  }
  if (b.https && typeof b.https === 'object') {
    if (typeof b.https.enabled === 'boolean') settings.https.enabled = b.https.enabled;
    const p = parseInt(b.https.port, 10);
    if (Number.isFinite(p) && p > 1024 && p < 65536) settings.https.port = p;
  }
  if (b.kamera && typeof b.kamera === 'object') {
    if (['webcam', 'dslr'].includes(b.kamera.quelle)) settings.kamera.quelle = b.kamera.quelle;
    if (typeof b.kamera.url === 'string' && /^https?:\/\//.test(b.kamera.url)) {
      settings.kamera.url = b.kamera.url.replace(/\/$/, '').slice(0, 200);
    }
  }
  /* `bezahlung` wird bewusst NICHT mehr übernommen. Eine alte Box, deren
     `settings.json` den Block noch enthält, verliert ihn beim nächsten
     Speichern — genau das ist gewollt. Eine stehengebliebene Einstellung,
     die nichts mehr schaltet, ist schlimmer als keine. */
  /* Kiosk & PIN. Die PIN kommt im Klartext herein und wird sofort zu einer
     gesalzenen Prüfsumme – im settings.json steht sie nie lesbar. */
  if (b.kiosk && typeof b.kiosk === 'object') {
    if (typeof b.kiosk.enabled === 'boolean') settings.kiosk.enabled = b.kiosk.enabled;
    if (typeof b.kiosk.pin === 'string') {
      const roh = b.kiosk.pin.trim();
      if (!roh) { settings.kiosk.pin = ''; settings.kiosk.salz = ''; }        // leer = PIN entfernen
      else if (/^\d{4,12}$/.test(roh)) {
        settings.kiosk.salz = crypto.randomBytes(8).toString('hex');
        settings.kiosk.pin = crypto.createHash('sha256').update(settings.kiosk.salz + roh).digest('hex');
      }
    }
  }
  if (b.melden && typeof b.melden === 'object') {
    if (typeof b.melden.enabled === 'boolean') settings.melden.enabled = b.melden.enabled;
    /* Eine leere oder unvollstaendige Adresse ueberschreibt die bestehende
       NICHT — sonst macht ein versehentlich geleertes Feld die Box taub. */
    if (typeof b.melden.url === 'string') {
      const u = b.melden.url.trim().slice(0, 300);
      if (!u) settings.melden.url = ZENTRALE + '/api/box/melden';
      else if (/^https?:\/\//i.test(u)) settings.melden.url = u;
    }
    if (typeof b.melden.key === 'string') settings.melden.key = b.melden.key.trim().slice(0, 60);
    if (b.melden.puls !== undefined) {
      const p = parseInt(b.melden.puls, 10);
      /* 0 = aus. Sonst mindestens 2 s, damit die Box die Zentrale nicht flutet. */
      settings.melden.puls = Number.isFinite(p) && p > 0 ? Math.min(120, Math.max(2, p)) : 0;
    }
    if (typeof b.melden.fotos === 'boolean') settings.melden.fotos = b.melden.fotos;
  }
  if (b.modes && typeof b.modes === 'object') {
    for (const k of ['photo', 'strip', 'boomerang', 'gif', 'video']) {
      if (typeof b.modes[k] === 'boolean') settings.modes[k] = b.modes[k];
    }
  }
  if (b.vorschau && typeof b.vorschau === 'object') {
    if (typeof b.vorschau.spiegeln === 'boolean') settings.vorschau.spiegeln = b.vorschau.spiegeln;
    if ([0, 90, 180, 270].includes(b.vorschau.drehen)) settings.vorschau.drehen = b.vorschau.drehen;
  }
  if (b.profile && typeof b.profile === 'object') {
    if (typeof b.profile.enabled === 'boolean') settings.profile.enabled = b.profile.enabled;
    if (Array.isArray(b.profile.liste)) {
      settings.profile.liste = b.profile.liste.slice(0, 8).map((p, i) => ({
        id: String((p && p.id) || 'pr' + i + '_' + Date.now().toString(36)).slice(0, 30),
        name: String((p && p.name) || 'Ohne Namen').slice(0, 40),
        emoji: String((p && p.emoji) || '📸').slice(0, 4),
        text: String((p && p.text) || '').slice(0, 60),
        modus: ['photo', 'strip', 'boomerang', 'gif', 'video'].includes(p && p.modus) ? p.modus : 'photo',
        vorlage: String((p && p.vorlage) || '').slice(0, 60),
        filter: String((p && p.filter) || '').slice(0, 20),
      }));
    }
  }
  if (b.gif && typeof b.gif === 'object') {
    if (Number.isFinite(b.gif.bilder)) settings.gif.bilder = Math.min(12, Math.max(2, Math.round(b.gif.bilder)));
    if (Number.isFinite(b.gif.msProBild)) settings.gif.msProBild = Math.min(1000, Math.max(60, Math.round(b.gif.msProBild)));
    if (typeof b.gif.pingpong === 'boolean') settings.gif.pingpong = b.gif.pingpong;
  }
  if (b.survey && typeof b.survey === 'object') {
    if (typeof b.survey.enabled === 'boolean') settings.survey.enabled = b.survey.enabled;
    if (b.survey.consent && typeof b.survey.consent === 'object') {
      if (typeof b.survey.consent.enabled === 'boolean') settings.survey.consent.enabled = b.survey.consent.enabled;
      if (typeof b.survey.consent.text === 'string') settings.survey.consent.text = b.survey.consent.text.slice(0, 600);
    }
    if (typeof b.survey.unterschrift === 'boolean') settings.survey.unterschrift = b.survey.unterschrift;
    if (b.survey.imDruck && typeof b.survey.imDruck === 'object') {
      if (typeof b.survey.imDruck.frage === 'string') settings.survey.imDruck.frage = b.survey.imDruck.frage.slice(0, 10);
      if (typeof b.survey.imDruck.unterschrift === 'boolean') settings.survey.imDruck.unterschrift = b.survey.imDruck.unterschrift;
    }
    if (Array.isArray(b.survey.questions)) {
      settings.survey.questions = b.survey.questions.slice(0, 6)
        .filter(q => q && typeof q.label === 'string')
        .map((q, i) => ({
          id: 'q' + i,
          label: q.label.slice(0, 120),
          type: q.type === 'choice' ? 'choice' : 'text',
          options: Array.isArray(q.options) ? q.options.slice(0, 8).map(o => String(o).slice(0, 40)) : [],
        }));
    }
  }
  if (typeof b.intro === 'boolean') settings.intro = b.intro;
  if (typeof b.eingerichtet === 'boolean') settings.eingerichtet = b.eingerichtet;
  if (b.hashtag && typeof b.hashtag === 'object') {
    const t = b.hashtag, z = settings.hashtag;
    if (typeof t.enabled === 'boolean') z.enabled = t.enabled;
    if (['mastodon', 'instagram', 'endpunkt'].includes(t.quelle)) z.quelle = t.quelle;
    if (typeof t.tag === 'string') z.tag = t.tag.replace(/^#/, '').slice(0, 60);
    if (typeof t.instanz === 'string') z.instanz = t.instanz.slice(0, 120);
    if (typeof t.token === 'string') z.token = t.token.slice(0, 400);
    if (typeof t.igNutzerId === 'string') z.igNutzerId = t.igNutzerId.slice(0, 60);
    if (typeof t.endpunkt === 'string' && (!t.endpunkt || /^https:\/\//.test(t.endpunkt))) z.endpunkt = t.endpunkt.slice(0, 300);
    /* Nicht unter 60 s: Wer eine fremde Schnittstelle im Sekundentakt abfragt,
       fliegt zu Recht raus. */
    if (Number.isFinite(t.intervallSek)) z.intervallSek = Math.min(3600, Math.max(60, Math.round(t.intervallSek)));
    if (typeof t.moderation === 'boolean') z.moderation = t.moderation;
    if (typeof t.autoDruck === 'boolean') z.autoDruck = t.autoDruck;
    if (Number.isFinite(t.maxProStunde)) z.maxProStunde = Math.min(200, Math.max(1, Math.round(t.maxProStunde)));
  }
  if (b.update && typeof b.update === 'object') {
    if (typeof b.update.pruefen === 'boolean') settings.update.pruefen = b.update.pruefen;
    if (typeof b.update.url === 'string' && /^https:\/\//.test(b.update.url)) {
      settings.update.url = b.update.url.slice(0, 300);
    }
  }
  if (b.aktionen && typeof b.aktionen === 'object') {
    const erlaubt = ['nochmal', 'drucken', 'teilen', 'wand', 'verwerfen'];
    if (Array.isArray(b.aktionen.liste)) {
      const rein = b.aktionen.liste.filter((x) => erlaubt.includes(x));
      /* Doppelte raus, und niemals leer: Ein Bildschirm ohne Knopf ist eine
         Sackgasse — der Gast käme nicht mehr weiter. */
      settings.aktionen.liste = [...new Set(rein)].slice(0, 5);
      if (!settings.aktionen.liste.length) settings.aktionen.liste = ['teilen'];
    }
    if (erlaubt.includes(b.aktionen.gross)) settings.aktionen.gross = b.aktionen.gross;
  }
  if (b.faceFinder && typeof b.faceFinder === 'object') {
    if (typeof b.faceFinder.enabled === 'boolean') settings.faceFinder.enabled = b.faceFinder.enabled;
    if (typeof b.faceFinder.showHint === 'boolean') settings.faceFinder.showHint = b.faceFinder.showHint;
    if (typeof b.faceFinder.consent === 'boolean') settings.faceFinder.consent = b.faceFinder.consent;
    if (typeof b.faceFinder.consentText === 'string') settings.faceFinder.consentText = b.faceFinder.consentText.slice(0, 600);
  }
  if (b.arFilters && typeof b.arFilters === 'object') {
    if (typeof b.arFilters.enabled === 'boolean') settings.arFilters.enabled = b.arFilters.enabled;
  }
  if (b.aiArt && typeof b.aiArt === 'object') {
    if (typeof b.aiArt.enabled === 'boolean') settings.aiArt.enabled = b.aiArt.enabled;
    if (typeof b.aiArt.endpoint === 'string') settings.aiArt.endpoint = b.aiArt.endpoint.slice(0, 300);
    if (typeof b.aiArt.key === 'string') settings.aiArt.key = b.aiArt.key.slice(0, 200);
  }
  if (b.hotfolder && typeof b.hotfolder === 'object') {
    if (typeof b.hotfolder.enabled === 'boolean') settings.hotfolder.enabled = b.hotfolder.enabled;
    if (typeof b.hotfolder.addToGallery === 'boolean') settings.hotfolder.addToGallery = b.hotfolder.addToGallery;
  }
  if (b.voice && typeof b.voice === 'object') {
    if (typeof b.voice.enabled === 'boolean') settings.voice.enabled = b.voice.enabled;
  }
  if (b.textAnim && typeof b.textAnim === 'object') {
    if (typeof b.textAnim.enabled === 'boolean') settings.textAnim.enabled = b.textAnim.enabled;
    if (TEXTANIM_STYLES.includes(b.textAnim.style)) settings.textAnim.style = b.textAnim.style;
    if (typeof b.textAnim.text === 'string') settings.textAnim.text = b.textAnim.text.slice(0, 60);
  }
  if (b.material && typeof b.material === 'object') {
    if (MATERIAL_IDS.includes(b.material.id)) settings.material.id = b.material.id;
  }
  if (b.playlist && typeof b.playlist === 'object') {
    if (typeof b.playlist.enabled === 'boolean') settings.playlist.enabled = b.playlist.enabled;
    if (Array.isArray(b.playlist.slides)) settings.playlist.slides = cleanSlides(b.playlist.slides);
  }
  if (b.greenscreen && typeof b.greenscreen === 'object') {
    const gs = b.greenscreen;
    if (typeof gs.enabled === 'boolean') settings.greenscreen.enabled = gs.enabled;
    if (typeof gs.ki === 'boolean') settings.greenscreen.ki = gs.ki;
    if (/^#[0-9a-fA-F]{6}$/.test(gs.key || '')) settings.greenscreen.key = gs.key;
    if (Number.isFinite(gs.similarity)) settings.greenscreen.similarity = Math.min(90, Math.max(5, gs.similarity));
    if (gs.background === null) settings.greenscreen.background = null;
    if (typeof gs.background === 'string' && gs.background.startsWith('data:image/') && gs.background.length < 5_000_000) settings.greenscreen.background = gs.background;
  }
  if (b.active && typeof b.active === 'object') {
    for (const k of ['strip', 'single']) {
      if (typeof b.active[k] === 'string' && templates.some(t => t.id === b.active[k])) {
        settings.active[k] = b.active[k];
      }
    }
  }
  saveJson(SETTINGS_FILE, settings);
  broadcast({ type: 'settings', settings });
  res.json({ ok: true, settings });
});

/* ═══════════════ Vorlagen prüfen, bevor sie abgelegt werden ═══════════════
   Eine Vorlage kommt aus dem Editor an der Box ODER als Push aus der
   Zentrale. Der Server sieht sie sich deshalb an, statt sie durchzureichen:
   Über ein Bildfeld liesse sich sonst eine fremde Adresse ins Druckbild
   schmuggeln, und ein NaN in einer Koordinate faende erst der Drucker.

   Geprueft wird nach demselben Modell, das die Oberflaeche zeichnet
   (`src/vorlage.ts`) — dieselben Regeln, zweimal angewandt: hier, weil der
   Server niemandem traut, und dort, weil die Oberflaeche auch ohne Server
   laufen koennen muss. */

const DRUCKFORMATE = Object.keys(require('../formate.json'));

/* Muss mit `DEKOLISTE` in `src/deko.ts` uebereinstimmen. Zwei Listen
   derselben Sache laufen auseinander — deshalb prueft `tools/deko-probe.mjs`
   beide gegeneinander. */
const DEKOARTEN = ['hochzeit-gold', 'blush-blumen', 'botanik', 'konfetti', 'ballons',
  'firma', 'reiner-rahmen', 'feuerwerk', 'bokeh', 'lorbeer', 'sanfter-himmel', 'schnee',
  'neon', 'filmkante', 'art-deco', 'sofortbild', 'herzen', 'feine-linie'];

/**
 * Erlaubte Bildquelle: eine eigene Datenadresse aus dem Editor oder eine
 * mitgelieferte Datei unter `/vorlagen/`. Nichts sonst — ueber eine Vorlage
 * darf sich keine fremde Adresse ins Druckbild schmuggeln, und eine Box im
 * Feier-WLAN soll beim Drucken nichts nachladen.
 */
function bildQuelle(v) {
  if (typeof v !== 'string') return null;
  if (v.startsWith('data:image/') && v.length < 6_000_000) return v;
  if (/^\/vorlagen\/[A-Za-z0-9._-]+$/.test(v)) return v;
  return null;
}
const FELDARTEN = ['bild', 'text', 'flaeche', 'logo', 'bilddatei', 'qr'];
const SCHRIFTARTEN = ['anzeige', 'mono', 'serif', 'sans', 'display', 'klassisch'];
const AUSRICHTUNGEN = ['links', 'mitte', 'rechts'];
const FIGUREN = ['rechteck', 'ellipse', 'linie'];

/* Farben: Sechserhex, Kurzhex, rgb/rgba — mehr braucht keine Vorlage, und
   alles andere koennte CSS sein, das woanders etwas anderes tut. */
function farbe(v, ersatz) {
  if (typeof v !== 'string') return ersatz;
  const t = v.trim();
  if (t === 'transparent') return t;
  if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(t)) return t;
  if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/.test(t)) return t;
  return ersatz;
}

function anteil(v, mindest) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(mindest, n));
}

function zahl(v, min, max, ersatz) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : ersatz;
}

function pruefeFeld(f) {
  if (!f || typeof f !== 'object' || !FELDARTEN.includes(f.art)) return null;
  const x = anteil(f.x, 0), y = anteil(f.y, 0);
  const b = anteil(f.b, 0.005), h = anteil(f.h, 0.005);
  if (x === null || y === null || b === null || h === null) return null;

  const aus = { id: String(f.id || 'f' + crypto.randomBytes(3).toString('hex')).slice(0, 24),
    art: f.art, x, y, b, h };
  if (Number.isFinite(Number(f.dreh)) && Number(f.dreh)) aus.dreh = zahl(f.dreh, -180, 180, 0);

  if (f.art === 'text') {
    aus.text = String(f.text || '').slice(0, 200);
    aus.groesse = zahl(f.groesse, 6, 400, 40);
    aus.gewicht = zahl(f.gewicht, 100, 900, 600);
    if (SCHRIFTARTEN.includes(f.schrift)) aus.schrift = f.schrift;
    if (AUSRICHTUNGEN.includes(f.ausrichtung)) aus.ausrichtung = f.ausrichtung;
    if (f.versalien) aus.versalien = true;
    if (f.umbruch) aus.umbruch = true;
    aus.farbe = farbe(f.farbe, undefined);
  } else if (f.art === 'flaeche') {
    if (FIGUREN.includes(f.figur)) aus.figur = f.figur;
    aus.farbe = farbe(f.farbe, undefined);
    aus.linie = farbe(f.linie, undefined);
    if (f.linienstaerke) aus.linienstaerke = zahl(f.linienstaerke, 0, 80, 0);
    if (f.radius) aus.radius = zahl(f.radius, 0, 400, 0);
  } else {
    if (f.radius) aus.radius = zahl(f.radius, 0, 400, 0);
    if (f.schatten) aus.schatten = true;
    if (f.rahmen) aus.rahmen = farbe(f.rahmen, undefined);
    if (f.rahmenB) aus.rahmenB = zahl(f.rahmenB, 0, 80, 0);
    if (f.art === 'qr') {
      aus.quelle = String(f.quelle || '').slice(0, 300);
    } else if (f.art === 'bilddatei' || f.art === 'logo') {
      const q = bildQuelle(f.quelle);
      if (q) aus.quelle = q;
    }
  }
  // Undefinierte Werte gehoeren nicht in die Datei — sie waeren nur Rauschen.
  for (const k of Object.keys(aus)) if (aus[k] === undefined) delete aus[k];
  return aus;
}

/* Vorlage uebernehmen. Gibt die gespeicherte Vorlage zurueck oder eine
   Begruendung, warum nicht — eine stille Ablehnung waere die schlechteste
   Antwort: Der Betreiber saehe seine Vorlage in der Liste fehlen, ohne Grund. */
function vorlageUebernehmen(t) {
  if (!t || typeof t !== 'object') return { fehler: 'Keine Vorlage im Aufruf' };
  if (typeof t.name !== 'string' || !t.name.trim()) return { fehler: 'Der Vorlage fehlt ein Name' };
  if (!DRUCKFORMATE.includes(t.format)) {
    return { fehler: 'Unbekanntes Papierformat. Erlaubt: ' + DRUCKFORMATE.join(', ') };
  }
  if (!Array.isArray(t.felder) || !t.felder.length) return { fehler: 'Die Vorlage hat keine Felder' };

  const felder = [];
  for (const f of t.felder.slice(0, 60)) {
    const geprueft = pruefeFeld(f);
    if (!geprueft) return { fehler: 'Ein Feld ist unbrauchbar (Art oder Masse)' };
    felder.push(geprueft);
  }
  if (!felder.some((f) => f.art === 'bild')) {
    return { fehler: 'Ohne Bildfeld kann die Vorlage keine Aufnahme zeigen' };
  }

  const tpl = {
    id: t.id && templates.some((x) => x.id === t.id) ? t.id
      : (String(t.id || '').slice(0, 60) || 'v_' + crypto.randomBytes(4).toString('hex')),
    name: String(t.name).slice(0, 60),
    format: t.format,
    art: t.art === 'streifen' ? 'streifen' : 'foto',
    aufnahmen: zahl(t.aufnahmen, 1, 8, felder.filter((f) => f.art === 'bild').length || 1),
    papier: farbe(t.papier, '#ffffff'),
    tinte: farbe(t.tinte, '#17171c'),
    akzent: farbe(t.akzent, '#f2b23e'),
    felder,
  };
  const hg = bildQuelle(t.hintergrund);
  if (hg) tpl.hintergrund = hg;
  if (t.ecken) tpl.ecken = true;
  /* Der gezeichnete Schmuck ist kein Feld, sondern ein Name — die Formen
     liegen im Client (`src/deko.ts`). Der Server muss die Liste trotzdem
     kennen: Ein unbekannter Name wuerde sonst durchgereicht und der Client
     zeichnete nichts, ohne dass jemand erfaehrt warum. */
  if (DEKOARTEN.includes(t.deko)) tpl.deko = t.deko;
  if (typeof t.logo === 'string' && t.logo.startsWith('data:image/') && t.logo.length < 6_000_000) {
    tpl.logo = t.logo;
  }

  const idx = templates.findIndex((x) => x.id === tpl.id);
  if (idx >= 0) templates[idx] = tpl; else templates.push(tpl);
  saveJson(TEMPLATES_FILE, templates);
  broadcast({ type: 'templates', templates });
  return { vorlage: tpl };
}

/* Vorlage scharfstellen. Gibt false zurueck, wenn es sie nicht gibt. */
function vorlageAktivieren(id) {
  const tpl = templates.find((t) => t.id === id);
  if (!tpl) return false;
  settings.active[tpl.art === 'streifen' ? 'strip' : 'single'] = tpl.id;
  saveJson(SETTINGS_FILE, settings);
  broadcast({ type: 'settings', settings });
  return true;
}


app.get('/api/templates', (req, res) => res.json({ templates, active: settings.active }));

app.post('/api/templates', requireKey, (req, res) => {
  const ergebnis = vorlageUebernehmen(req.body || {});
  if (ergebnis.fehler) return res.status(400).json({ error: ergebnis.fehler });
  res.json({ ok: true, template: ergebnis.vorlage });
});

app.post('/api/templates/:id/activate', requireKey, (req, res) => {
  if (!vorlageAktivieren(req.params.id)) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
  res.json({ ok: true, active: settings.active });
});

app.delete('/api/templates/:id', requireKey, (req, res) => {
  const idx = templates.findIndex(t => t.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'Vorlage nicht gefunden' });
  if (Object.values(settings.active).includes(req.params.id)) {
    return res.status(400).json({ error: 'Aktive Vorlage kann nicht gelöscht werden' });
  }
  templates.splice(idx, 1);
  saveJson(TEMPLATES_FILE, templates);
  broadcast({ type: 'templates', templates });
  res.json({ ok: true });
});

/* ---------- API: Fernsteuerung (inkl. Fernauslöser für iPad-Remote) ---------- */

app.post('/api/control', requireKey, (req, res) => {
  const { action, target, url, mode } = req.body || {};
  const allowed = ['reload', 'home', 'goto', 'trigger'];
  if (!allowed.includes(action)) return res.status(400).json({ error: 'Unbekannte Aktion' });
  broadcast({
    type: 'control', action, target: target || 'all', url: url || null,
    mode: ['photo', 'strip', 'boomerang'].includes(mode) ? mode : null,
  });
  res.json({ ok: true });
});

/* ---------- API: Spiegelreflex über digiCamControl ---------- */

app.get('/api/kamera/status', async (req, res) => {
  const s = await kamera.status(settings.kamera.url);
  res.json({ ...s, quelle: settings.kamera.quelle, url: settings.kamera.url });
});

/* Live-Vorschau: der Booth holt hier Einzelbilder. Der Umweg über uns spart
   dem Browser den Zugriff auf einen fremden Port (und dessen CORS-Regeln). */
app.get('/api/kamera/liveview.jpg', async (req, res) => {
  const bild = await kamera.liveBild(settings.kamera.url);
  if (!bild) return res.status(503).json({ error: 'Keine Live-Vorschau' });
  res.set('Content-Type', 'image/jpeg').set('Cache-Control', 'no-store').send(bild);
});

app.post('/api/kamera/live', async (req, res) => {
  const an = (req.body || {}).an !== false;
  await (an ? kamera.liveAn : kamera.liveAus)(settings.kamera.url);
  res.json({ ok: true, an });
});

/* Auslösen. Antwortet mit demselben Foto-Datensatz wie /api/photos, damit der
   Booth beide Wege gleich behandeln kann. */
app.post('/api/kamera/ausloesen', async (req, res) => {
  if (settings.kamera.quelle !== 'dslr') {
    return res.status(409).json({ error: 'Als Bildquelle ist die Webcam eingestellt' });
  }
  try {
    const erg = await kamera.ausloesen(settings.kamera.url, PHOTOS_DIR);
    const meta = { ...photoMeta(erg.name), source: 'dslr' };
    broadcast({ type: 'photo', photo: meta });
    recordStat('photo');
    meldeAnZentrale('foto');
    res.json({
      ok: true, photo: meta, nachgeholt: erg.geholt,
      downloadUrl: `${baseUrl()}${meta.url}`,
      shareUrl: `${baseUrl()}/share.html?p=${encodeURIComponent(erg.name)}`,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

/* ---------- API: Kiosk-PIN ----------
   Geprüft wird auf dem Server, damit die Prüfsumme den Rechner nicht verlässt.
   Nach jedem Fehlversuch eine kurze Zwangspause – Vierstellige Zahlen sind
   sonst in Sekunden durchprobiert. */
let pinSperreBis = 0;
app.post('/api/kiosk/pin', (req, res) => {
  if (!settings.kiosk.pin) return res.json({ ok: true, offen: true });   // keine PIN gesetzt
  if (Date.now() < pinSperreBis) {
    return res.status(429).json({ ok: false, error: 'Zu viele Versuche, kurz warten' });
  }
  const roh = String((req.body || {}).pin || '');
  const summe = crypto.createHash('sha256').update(settings.kiosk.salz + roh).digest('hex');
  const gleich = summe.length === settings.kiosk.pin.length
    && crypto.timingSafeEqual(Buffer.from(summe), Buffer.from(settings.kiosk.pin));
  if (!gleich) { pinSperreBis = Date.now() + 3000; return res.status(403).json({ ok: false }); }
  res.json({ ok: true });
});

/* ---------- Hashtag-Drucker ----------
   Der Ablauf: alle paar Minuten nachsehen, neue Bilder herunterladen, in eine
   Freigabeliste legen. Der Betreiber gibt frei — dann geht das Bild denselben
   Weg wie eine Aufnahme aus dem Booth (Galerie, Wand, Cloud) und wird auf
   Wunsch gedruckt. Ohne Freigabe passiert nichts. */
const HASHTAG_DATEI = path.join(CONFIG_DIR, 'hashtag.json');
let hashtagStand = loadJson(HASHTAG_DATEI, { gesehen: [], warten: [] });
if (!Array.isArray(hashtagStand.gesehen)) hashtagStand.gesehen = [];
if (!Array.isArray(hashtagStand.warten)) hashtagStand.warten = [];
let hashtagFehler = '';
let hashtagStunde = { seit: Date.now(), zahl: 0 };
let hashtagLaeuft = false;

const hashtagSichern = () => saveJson(HASHTAG_DATEI, hashtagStand);

async function hashtagHolen() {
  const e = settings.hashtag;
  if (!e.enabled || hashtagLaeuft || !e.tag) return;
  hashtagLaeuft = true;
  try {
    const beitraege = await hashtag.beitraegeHolen(e);
    hashtagFehler = '';
    /* Stundengrenze: Ein Hashtag, der plötzlich viral geht, soll nicht das
       ganze Papier verbrauchen. */
    if (Date.now() - hashtagStunde.seit > 3600000) hashtagStunde = { seit: Date.now(), zahl: 0 };

    for (const b of beitraege.slice(0, 40)) {
      if (hashtagStand.gesehen.includes(b.id)) continue;
      /* ★ Erst merken, wenn wirklich abgearbeitet. Vorher stand die Zeile
         oben: Wer über der Stundengrenze lag, galt als gesehen und wurde
         **nie wieder** geholt. Bei 30 Beiträgen und einer Grenze von 3 wären
         27 Bilder stillschweigend verloren gewesen. */
      if (hashtagStunde.zahl >= e.maxProStunde) continue;
      hashtagStand.gesehen.push(b.id);
      try {
        const bild = await hashtag.bildLaden(b.bildUrl);
        if (bild.puffer.length > 12 * 1024 * 1024) continue;   // 12 MB reichen für jeden Druck
        hashtagStunde.zahl += 1;
        const eintrag = {
          id: b.id, autor: b.autor, text: b.text, quelle: b.quelle, zeit: b.zeit,
          mime: bild.mime, daten: bild.puffer.toString('base64'),
        };
        if (e.moderation) {
          hashtagStand.warten.push(eintrag);
          broadcast({ type: 'hashtag', warten: hashtagStand.warten.length });
        } else {
          hashtagFreigeben(eintrag);
        }
      } catch (err) {
        console.log('Hashtag-Bild übersprungen:', err.message);
      }
    }
    /* Die Merkliste nicht unbegrenzt wachsen lassen. */
    if (hashtagStand.gesehen.length > 800) hashtagStand.gesehen = hashtagStand.gesehen.slice(-400);
    if (hashtagStand.warten.length > 60) hashtagStand.warten = hashtagStand.warten.slice(-60);
    hashtagSichern();
  } catch (err) {
    /* Sichtbar, nicht verschluckt: Ein Hashtag-Drucker, der stumm nichts tut,
       ist schlimmer als einer, der sagt warum. */
    hashtagFehler = err.message.slice(0, 200);
    console.log('Hashtag-Abruf fehlgeschlagen:', hashtagFehler);
  }
  hashtagLaeuft = false;
}

/** Freigeben: in die Galerie aufnehmen und auf Wunsch drucken. */
function hashtagFreigeben(eintrag) {
  const rohdaten = Buffer.from(eintrag.daten, 'base64');
  const { name } = bildAufnehmen(eintrag.mime, rohdaten, 'hashtag', 'hashtag', null);
  if (settings.hashtag.autoDruck && CAN_PRINT && settings.printer && settings.printing !== false) {
    printImageFile(path.join(PHOTOS_DIR, name), settings.printer, (err) => {
      if (err) fehlerMerken('Hashtag-Druck: ' + err.message);
    });
  }
  return name;
}

app.get('/api/hashtag', requireKey, (req, res) => {
  res.json({
    aktiv: settings.hashtag.enabled,
    fehler: hashtagFehler,
    proStunde: hashtagStunde.zahl,
    /* Ohne die Bilddaten – die Liste soll klein bleiben; die Vorschau holt
       sich das Cockpit einzeln. */
    warten: hashtagStand.warten.map((w) => ({
      id: w.id, autor: w.autor, text: w.text, quelle: w.quelle, zeit: w.zeit,
    })),
  });
});

app.get('/api/hashtag/bild', requireKey, (req, res) => {
  const w = hashtagStand.warten.find((x) => x.id === String(req.query.id || ''));
  if (!w) return res.status(404).end();
  res.set('Content-Type', w.mime).set('Cache-Control', 'no-store').send(Buffer.from(w.daten, 'base64'));
});

app.post('/api/hashtag/freigeben', requireKey, (req, res) => {
  const id = String((req.body || {}).id || '');
  const i = hashtagStand.warten.findIndex((x) => x.id === id);
  if (i < 0) return res.status(404).json({ ok: false, error: 'Nicht in der Liste' });
  const name = hashtagFreigeben(hashtagStand.warten[i]);
  hashtagStand.warten.splice(i, 1);
  hashtagSichern();
  broadcast({ type: 'hashtag', warten: hashtagStand.warten.length });
  res.json({ ok: true, name });
});

app.post('/api/hashtag/verwerfen', requireKey, (req, res) => {
  const id = String((req.body || {}).id || '');
  const vorher = hashtagStand.warten.length;
  hashtagStand.warten = hashtagStand.warten.filter((x) => x.id !== id);
  hashtagSichern();
  broadcast({ type: 'hashtag', warten: hashtagStand.warten.length });
  res.json({ ok: true, entfernt: vorher - hashtagStand.warten.length });
});

/** Sofort nachsehen – der Knopf „Jetzt prüfen" im Cockpit. */
app.post('/api/hashtag/pruefen', requireKey, async (req, res) => {
  await hashtagHolen();
  res.json({ ok: !hashtagFehler, fehler: hashtagFehler, warten: hashtagStand.warten.length });
});

/* ---------- Bezahlung: ENTFERNT (1.30) ----------
   Die Box kassiert nichts mehr. Es gab hier eine Sperre vor Druck, Start
   oder Teilen, die der Betreiber von Hand freigeben musste — ohne
   angebundenen Zahlungsdienst konnte die Box eine Zahlung ohnehin nur
   BEHAUPTEN, nie feststellen.

   Bezahlt werden Lizenzen, nicht einzelne Auslösungen, und das gehört auf
   hnvr.me — nicht auf ein Gerät, das im Festzelt steht. Wer hier wieder
   etwas einbaut, baut eine Kasse ohne Kassenbuch. */

/* ---------- API: Statistiken & Diagnose ---------- */

app.get('/api/stats', (req, res) => {
  const days = Object.keys(stats.days).sort();
  const totals = {};
  for (const d of days) for (const [k, v] of Object.entries(stats.days[d])) totals[k] = (totals[k] || 0) + v;
  const last14 = days.slice(-14).map(d => ({ day: d, ...stats.days[d] }));
  res.json({ totals, last14, photosStored: listPhotos().length });
});

app.post('/api/stats/event', (req, res) => {
  const type = String(req.body && req.body.type || '').slice(0, 30);
  if (!/^[a-z-]+$/.test(type)) return res.status(400).json({ error: 'Ungültiger Typ' });
  recordStat(type);
  res.json({ ok: true });
});

/* ---------- API: Umfrage- & Einwilligungs-Antworten (DSGVO / Lead-Gen) ---------- */

const SURVEYS_FILE = path.join(CONFIG_DIR, 'surveys.json');

app.post('/api/survey', (req, res) => {
  const b = req.body || {};
  const entry = {
    id: 'r_' + crypto.randomBytes(4).toString('hex'),
    consent: b.consent === true,
    answers: (b.answers && typeof b.answers === 'object') ? b.answers : {},
    time: new Date().toISOString(),
  };
  const list = loadJson(SURVEYS_FILE, []);
  list.unshift(entry);
  saveJson(SURVEYS_FILE, list.slice(0, 2000));
  recordStat('survey-response');
  res.json({ ok: true });
});

app.get('/api/survey', requireKey, (req, res) => res.json(loadJson(SURVEYS_FILE, [])));

/* CSV-Export der Antworten (für Firmenevents / Lead-Listen) */
app.get('/api/survey.csv', requireKey, (req, res) => {
  const list = loadJson(SURVEYS_FILE, []);
  const qs = settings.survey.questions || [];
  const head = ['Zeit', 'Einwilligung', ...qs.map(q => q.label)];
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const rows = list.map(r => [r.time, r.consent ? 'ja' : 'nein', ...qs.map(q => (r.answers || {})[q.id] || '')].map(esc).join(','));
  res.set('Content-Type', 'text/csv; charset=utf-8')
     .set('Content-Disposition', 'attachment; filename="youbooth-umfrage.csv"')
     .send([head.map(esc).join(','), ...rows].join('\n'));
});

/* ---------- API: Gästebuch (Text-Grüße der Gäste) ---------- */

const GUESTBOOK_FILE = path.join(CONFIG_DIR, 'guestbook.json');
/* Der Server vergibt eine NUMMER, keine Farbe. Welche Farbe das ist, steht
   in `gestaltung/tokens.css` — hier lagen fuenf Hexwerte aus einem aelteren
   Stand, und drei davon gehoerten in keine Palette dieses Hauses. `color`
   bleibt als Feld erhalten, damit Eintraege von vorher weiter angezeigt
   werden. */
const GB_FARBEN = 5;

app.get('/api/guestbook', (req, res) => { res.set('Access-Control-Allow-Origin', '*'); res.json(loadJson(GUESTBOOK_FILE, [])); });

app.post('/api/guestbook', (req, res) => {
  const b = req.body || {};
  const clean = (v, n) => String(v || '').slice(0, n).replace(/[<>]/g, '');
  const message = clean(b.message, 500);
  if (!message) return res.status(400).json({ error: 'Bitte eine Nachricht schreiben' });
  const entry = {
    id: 'g_' + crypto.randomBytes(4).toString('hex'),
    name: clean(b.name, 60) || 'Gast',
    message,
    farbe: Math.floor(Math.random() * GB_FARBEN),
    time: new Date().toISOString(),
  };
  const list = loadJson(GUESTBOOK_FILE, []);
  list.unshift(entry);
  saveJson(GUESTBOOK_FILE, list.slice(0, 1000));
  broadcast({ type: 'guestbook', entry });
  recordStat('guestbook');
  res.json({ ok: true, entry });
});

app.delete('/api/guestbook/:id', requireKey, (req, res) => {
  saveJson(GUESTBOOK_FILE, loadJson(GUESTBOOK_FILE, []).filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

/* ---------- API: Buchungsanfragen (Verkaufsseite youbooth.me) ---------- */

const INQUIRIES_FILE = path.join(CONFIG_DIR, 'inquiries.json');

app.post('/api/inquiry', (req, res) => {
  const b = req.body || {};
  const clean = (v, max) => String(v || '').slice(0, max).replace(/[<>]/g, '');
  const name = clean(b.name, 80);
  const contact = clean(b.contact, 120);
  if (!name || !contact) return res.status(400).json({ error: 'Name und Kontakt sind Pflicht' });
  const inquiry = {
    id: 'anfrage_' + crypto.randomBytes(4).toString('hex'),
    name,
    contact,
    date: clean(b.date, 40),
    package: clean(b.package, 40),
    message: clean(b.message, 1000),
    received: new Date().toISOString(),
  };
  const list = loadJson(INQUIRIES_FILE, []);
  list.unshift(inquiry);
  saveJson(INQUIRIES_FILE, list.slice(0, 500));
  recordStat('inquiry');
  console.log(`📩 Neue Buchungsanfrage: ${name} (${contact}) – Paket: ${inquiry.package || '–'}, Datum: ${inquiry.date || '–'}`);
  /* Optional an Cloud/CRM weiterleiten, wenn konfiguriert */
  if (settings.cloud.enabled && settings.cloud.url && typeof fetch === 'function') {
    fetch(settings.cloud.url.replace(/\/ingest$/, '/inquiry'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Youbooth-Key': settings.cloud.key || '',
        'X-Youbooth-Cloud-Secret': settings.cloud.secret || '',
      },
      body: JSON.stringify(inquiry),
    }).catch(() => {});
  }
  res.json({ ok: true });
});

app.get('/api/inquiries', requireKey, (req, res) => {
  res.json(loadJson(INQUIRIES_FILE, []));
});

/* ---------- API: Vermietung & Buchung (SaaS-fähig via operatorId) ----------
   Ein Vermieter pro Instanz (OPERATOR_ID); für zentrales hnvr.me-SaaS wird
   operatorId später pro Konto vergeben – die Datensätze tragen es schon. */

const OPERATOR_ID = 'self';
const PACKAGES_FILE = path.join(CONFIG_DIR, 'packages.json');
const BOOKINGS_FILE = path.join(CONFIG_DIR, 'bookings.json');
const BLOCKED_FILE = path.join(CONFIG_DIR, 'blocked.json');
const BOOKING_STATUS = ['angefragt', 'bestätigt', 'abgelehnt', 'abgeschlossen'];

function rClean(v, max) { return String(v == null ? '' : v).slice(0, max).replace(/[<>]/g, ''); }
function timesOverlap(a1, a2, b1, b2) { return a1 < b2 && b1 < a2; }

/* Beim ersten Start Beispiel-Pakete anlegen (Vermieter passt sie an) */
(function seedPackages() {
  if (Array.isArray(loadJson(PACKAGES_FILE, null))) return;
  saveJson(PACKAGES_FILE, [
    { id: 'pkg_digital', operatorId: OPERATOR_ID, name: 'Digital', price: '299 €', hours: 4, active: true, order: 0,
      features: ['Unbegrenzte Fotos, GIFs & Boomerangs', 'Live-Galerie & Sofort-Sharing per QR', 'Auf- und Abbau inklusive'] },
    { id: 'pkg_print', operatorId: OPERATOR_ID, name: 'Print', price: '449 €', hours: 4, active: true, order: 1,
      features: ['Alles aus Digital', 'Sofortdruck vor Ort', 'Individuelles Druck-Layout', 'Requisiten-Box'] },
    { id: 'pkg_premium', operatorId: OPERATOR_ID, name: 'Premium', price: '649 €', hours: 6, active: true, order: 2,
      features: ['Alles aus Print', 'Digitales Gästebuch', 'Betreuung vor Ort', 'Online-Galerie 6 Monate'] },
  ]);
})();

/* Pakete – öffentlich nur aktive, lokal (Cockpit) alle */
app.get('/api/packages', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const all = loadJson(PACKAGES_FILE, []);
  res.json(isLocal(req) ? all : all.filter(p => p.active));
});
app.post('/api/packages', requireKey, (req, res) => {
  const b = req.body || {};
  const list = loadJson(PACKAGES_FILE, []);
  const pkg = {
    id: (b.id && list.some(p => p.id === b.id)) ? b.id : 'pkg_' + crypto.randomBytes(4).toString('hex'),
    operatorId: OPERATOR_ID,
    name: rClean(b.name, 60) || 'Paket',
    price: rClean(b.price, 40),
    hours: Math.max(0, Math.min(48, Number(b.hours) || 0)),
    features: Array.isArray(b.features) ? b.features.slice(0, 12).map(f => rClean(f, 90)).filter(Boolean) : [],
    active: b.active !== false,
    order: Number(b.order) || 0,
  };
  const i = list.findIndex(p => p.id === pkg.id);
  if (i >= 0) list[i] = pkg; else list.push(pkg);
  list.sort((a, b) => (a.order || 0) - (b.order || 0));
  saveJson(PACKAGES_FILE, list);
  res.json({ ok: true, package: pkg });
});
app.delete('/api/packages/:id', requireKey, (req, res) => {
  saveJson(PACKAGES_FILE, loadJson(PACKAGES_FILE, []).filter(p => p.id !== req.params.id));
  res.json({ ok: true });
});

/* Blockierte Tage (Vermieter markiert Nicht-Verfügbarkeit; Toggle) */
app.get('/api/blocked', (req, res) => { res.set('Access-Control-Allow-Origin', '*'); res.json(loadJson(BLOCKED_FILE, [])); });
app.post('/api/blocked', requireKey, (req, res) => {
  const date = rClean((req.body || {}).date, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Ungültiges Datum' });
  let list = loadJson(BLOCKED_FILE, []);
  list = list.includes(date) ? list.filter(d => d !== date) : [...list, date];
  saveJson(BLOCKED_FILE, list);
  res.json({ ok: true, blocked: list });
});

/* Verfügbarkeit für die Buchungsseite: blockierte + bereits bestätigte Tage */
app.get('/api/availability', (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  const booked = loadJson(BOOKINGS_FILE, []).filter(b => b.status === 'bestätigt').map(b => b.date);
  res.json({ blocked: loadJson(BLOCKED_FILE, []), booked });
});

/* Buchungsanfrage anlegen (öffentlich, White-Label-Seite) */
app.post('/api/bookings', (req, res) => {
  const b = req.body || {};
  const pkg = loadJson(PACKAGES_FILE, []).find(p => p.id === b.packageId && p.active);
  const date = rClean(b.date, 10);
  const name = rClean(b.name, 80);
  const email = rClean(b.email, 120);
  if (!pkg) return res.status(400).json({ error: 'Bitte ein gültiges Paket wählen' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Bitte ein Datum wählen' });
  if (!name || !email) return res.status(400).json({ error: 'Name und E-Mail sind Pflicht' });
  if (loadJson(BLOCKED_FILE, []).includes(date)) return res.status(409).json({ error: 'Dieser Tag ist leider nicht verfügbar' });
  const start = rClean(b.startTime, 5) || '00:00';
  const end = rClean(b.endTime, 5) || '23:59';
  const bookings = loadJson(BOOKINGS_FILE, []);
  const conflict = bookings.some(x => x.status === 'bestätigt' && x.date === date && timesOverlap(start, end, x.startTime || '00:00', x.endTime || '23:59'));
  if (conflict) return res.status(409).json({ error: 'Zu dieser Zeit ist bereits ein Termin bestätigt' });
  const booking = {
    id: 'bk_' + crypto.randomBytes(4).toString('hex'),
    operatorId: OPERATOR_ID,
    packageId: pkg.id, packageName: pkg.name, price: pkg.price,
    date, startTime: start, endTime: end,
    name, email, phone: rClean(b.phone, 40), location: rClean(b.location, 120),
    message: rClean(b.message, 1000),
    status: 'angefragt', galleryLink: '',
    createdAt: new Date().toISOString(),
  };
  bookings.unshift(booking);
  saveJson(BOOKINGS_FILE, bookings.slice(0, 1000));
  recordStat('booking');
  /* Das Portal des Betreibers hängt am Draht. Ohne diese Zeile sieht er die
     Anfrage erst beim nächsten Neuladen — und eine Anfrage, die einen Tag
     unbeantwortet liegt, ist meist eine verlorene. */
  broadcast({ type: 'buchung', buchung: { id: booking.id, name, date, status: booking.status } });
  console.log(`📅 Neue Buchungsanfrage: ${name}, ${date} ${start}–${end}, Paket ${pkg.name}`);
  res.json({ ok: true, booking: { id: booking.id, status: booking.status } });
});

/* Buchungen verwalten (Cockpit, lokal) */
app.get('/api/bookings', requireKey, (req, res) => res.json(loadJson(BOOKINGS_FILE, [])));
app.post('/api/bookings/:id/status', requireKey, (req, res) => {
  const status = rClean((req.body || {}).status, 20);
  if (!BOOKING_STATUS.includes(status)) return res.status(400).json({ error: 'Ungültiger Status' });
  const list = loadJson(BOOKINGS_FILE, []);
  const bk = list.find(x => x.id === req.params.id);
  if (!bk) return res.status(404).json({ error: 'Buchung nicht gefunden' });
  if (status === 'bestätigt') {
    const conflict = list.some(x => x.id !== bk.id && x.status === 'bestätigt' && x.date === bk.date && timesOverlap(bk.startTime || '00:00', bk.endTime || '23:59', x.startTime || '00:00', x.endTime || '23:59'));
    if (conflict) return res.status(409).json({ error: 'Kollidiert mit einem bereits bestätigten Termin' });
  }
  bk.status = status;
  saveJson(BOOKINGS_FILE, list);
  res.json({ ok: true, booking: bk });
});
app.post('/api/bookings/:id/gallery', requireKey, (req, res) => {
  const list = loadJson(BOOKINGS_FILE, []);
  const bk = list.find(x => x.id === req.params.id);
  if (!bk) return res.status(404).json({ error: 'Buchung nicht gefunden' });
  bk.galleryLink = rClean((req.body || {}).galleryLink, 300);
  saveJson(BOOKINGS_FILE, list);
  res.json({ ok: true, booking: bk });
});
app.delete('/api/bookings/:id', requireKey, (req, res) => {
  saveJson(BOOKINGS_FILE, loadJson(BOOKINGS_FILE, []).filter(x => x.id !== req.params.id));
  res.json({ ok: true });
});

/* ---------- API: Version & Auto-Update (das „Keyprogramm" fragt hier ab) ---------- */

app.get('/api/version', (req, res) => {
  res.json({
    version: APP_VERSION,
    edition: EDITION,
    downloads: {
      windows: `${baseUrl()}/downloads/Youbooth-${APP_VERSION}.exe`,
      mac: `${baseUrl()}/downloads/Youbooth-${APP_VERSION}.dmg`,
    },
    feed: `${baseUrl()}/downloads/`,   // electron-updater Feed-URL
  });
});

/* ---------- API: Produkt-Lizenzen / Aktivierung (Verkauf via Wix-Abo) ---------- */

const LICENSES_FILE = path.join(CONFIG_DIR, 'licenses.json');
const PLANS = ['start', 'pro', 'whitelabel'];

/* Eigenständige Produkte – jedes einzeln verkauf- & freischaltbar.
   Eine Lizenz gewährt eine Auswahl davon (oder 'all' = alles). */
/* Die Modulliste liegt in `produkte.js` – sie wird auch vom Bauskript
   der Marketing-Site gelesen, damit es keine zweite Fassung gibt. */
const PRODUCTS = require('./produkte');
/* Zwei Kennungen je Modul, und beide muessen gelten:
   `id` ist die alte englische, die in bereits ausgestellten Lizenzen steht;
   `kennung` die gemeinsame aus `gestaltung/module.json`, die auch die Website
   benutzt. Wer nur eine davon annimmt, sperrt entweder alte Kunden aus oder
   versteht neue Lizenzen nicht. */
const PRODUCT_IDS = PRODUCTS.flatMap(p => [p.id, p.kennung]).filter(Boolean);

/** Uebersetzt beide Schreibweisen auf die alte — darauf pruefen die Module. */
function produktSchluessel(x) {
  const treffer = PRODUCTS.find(p => p.id === x || p.kennung === x);
  return treffer ? treffer.id : null;
}

function cleanProducts(v) {
  if (v === 'all' || (Array.isArray(v) && v.includes('all'))) return ['all'];
  if (Array.isArray(v)) {
    const p = [...new Set(v.map(produktSchluessel).filter(Boolean))];
    return p.length ? p : ['all'];
  }
  return ['all'];
}
app.get('/api/products', (req, res) => res.json(PRODUCTS));
app.get('/api/products/:id', (req, res) => {
  const p = PRODUCTS.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Produkt nicht gefunden' });
  res.json(p);
});
// Eigene Verkaufs-Landingpage je Produkt: /p/<id>
app.get('/p/:id', (req, res) => {
  if (!PRODUCT_IDS.includes(req.params.id)) return res.status(404).send('Produkt nicht gefunden');
  res.status(404).type('text').send('Produktseiten gibt es in dieser Fassung noch nicht.');
});

function newProductKey() {
  const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase();
  return `PM-${seg()}-${seg()}-${seg()}`;
}

// Aktivierung durch den Nutzer (manueller Schlüssel; Login folgt via Wix-Konto)
/* ★ Aktivierung fragt ZUERST die Zentrale, nicht die eigene Festplatte.
   Vorher wurde nur `config/licenses.json` geprüft — das ist die Liste der
   AUSGEGEBENEN Schlüssel und liegt beim Hersteller. Auf einer frisch
   installierten Kundenbox ist sie leer, also bekam dort JEDER gültige
   Schlüssel „nicht gefunden". Der allererste Bildschirm nach dem Kauf war
   damit eine geschlossene Tür.

   Die örtliche Liste bleibt als zweiter Weg: Sie ist die Antwort für die
   Boxen des Herstellers und für den Fall, dass auf einer Feier gerade kein
   Netz da ist und der Schlüssel schon einmal hier eingetragen wurde. */
async function lizenzInDerWolke(key) {
  const basis = zentraleBasis();
  if (!basis) return { erreichbar: false };
  try {
    const steuer = new AbortController();
    /* Acht Sekunden. Eine Aktivierung passiert vor den Augen eines Menschen,
       der gerade ausgepackt hat — länger warten heißt „kaputt". */
    const uhr = setTimeout(() => steuer.abort(), 8000);
    const res = await fetch(basis + '/api/box/aktivieren', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
      signal: steuer.signal,
    });
    clearTimeout(uhr);
    const daten = await res.json().catch(() => null);
    if (!daten) return { erreichbar: false };
    return { erreichbar: true, status: res.status, daten };
  } catch (e) {
    return { erreichbar: false, grund: e && e.message };
  }
}

/* ---------- Kopplung mit dem Kundenkonto ----------
   Der bequeme Weg statt des Abtippens: Die Box holt sich einen sechsstelligen
   Code, zeigt ihn an, und der Kunde bestätigt ihn in seinem Konto. Die Box
   spricht dabei NIE mit einem Kundenkonto — sie kennt nur den Code. Die
   Berechtigung liegt beim angemeldeten Menschen im Browser, nicht bei einem
   Gerät, das auf einer fremden Feier steht.

   Warum das über den Box-Server läuft und nicht direkt aus dem Browser:
   sonst bräuchte die Zentrale CORS-Freigaben für jede beliebige Box-Adresse
   im Netz eines Kunden. */
async function zentraleKopplung(nutzlast) {
  const basis = zentraleBasis();
  if (!basis) return { erreichbar: false };
  try {
    const steuer = new AbortController();
    const uhr = setTimeout(() => steuer.abort(), 8000);
    const r = await fetch(basis + '/api/box/kopplung', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nutzlast),
      signal: steuer.signal,
    });
    clearTimeout(uhr);
    const daten = await r.json().catch(() => null);
    return daten ? { erreichbar: true, status: r.status, daten } : { erreichbar: false };
  } catch (e) {
    return { erreichbar: false, grund: e && e.message };
  }
}

/* Was die Lizenz hergibt, gehört auf die Box — nicht nur in den
   Zwischenspeicher des Browsers. GEMESSEN: `produkte` kam bei der
   Aktivierung an und wurde weggeworfen; nichts auf der Box wusste danach,
   welche Module gebucht sind. Ohne diese Angabe lässt sich weder etwas
   freischalten noch im Cockpit anzeigen, wofür jemand bezahlt. */
function lizenzMerken(d, key) {
  settings.lizenz = {
    key,
    plan: String(d.plan || 'pro'),
    produkte: Array.isArray(d.produkte) ? d.produkte : ['all'],
    kunde: String(d.kunde || ''),
    expires: d.expires || null,
    stand: new Date().toISOString(),
  };
  settings.melden = { ...(settings.melden || {}), key, enabled: true };
  saveJson(SETTINGS_FILE, settings);
}

app.post('/api/kopplung/start', async (req, res) => {
  const a = await zentraleKopplung({
    was: 'start',
    geraet: os.hostname(),
    system: process.platform === 'darwin' ? 'macOS'
      : process.platform === 'win32' ? 'Windows' : process.platform,
  });
  if (!a.erreichbar) return res.status(503).json({ ok: false, offline: true, error:
    'Die Zentrale ist gerade nicht erreichbar — bitte Internetverbindung prüfen.' });
  /* Die fertige Adresse gleich mitgeben. Der Code steht schon darin, damit
     niemand ihn abtippen muss — der Bildschirm zeigt ihn trotzdem, falls die
     Bestaetigung an einem anderen Geraet passieren soll. */
  const d = a.daten || {};
  if (d.ok && d.code) d.bestaetigenUrl = zentraleBasis() + '/konto/koppeln?code=' + encodeURIComponent(d.code);
  res.status(a.status || 200).json(d);
});

app.post('/api/kopplung/status', async (req, res) => {
  const code = String((req.body && req.body.code) || '').trim().toUpperCase();
  if (!code) return res.status(400).json({ ok: false, error: 'Kein Code angegeben' });
  const a = await zentraleKopplung({ was: 'status', code });
  if (!a.erreichbar) return res.status(503).json({ ok: false, offline: true, error:
    'Die Zentrale ist gerade nicht erreichbar.' });
  const d = a.daten || {};
  /* Bei Erfolg genau dasselbe tun wie nach einer Aktivierung von Hand:
     Schlüssel hinterlegen und das Melden einschalten. Sonst hätte der
     bequeme Weg am Ende doch wieder einen Handgriff im Cockpit zur Folge. */
  if (d.ok && d.status === 'bestaetigt' && d.key) lizenzMerken(d, d.key);
  res.status(a.status || 200).json(d);
});

app.post('/api/activate', async (req, res) => {
  const key = String((req.body && req.body.key) || '').trim().toUpperCase();
  if (!key) return res.status(400).json({ ok: false, error: 'Kein Schlüssel angegeben' });

  const wolkeAntwort = await lizenzInDerWolke(key);
  if (wolkeAntwort.erreichbar && wolkeAntwort.daten && wolkeAntwort.daten.ok) {
    const d = wolkeAntwort.daten;
    /* Den Schlüssel gleich für das tägliche Melden hinterlegen. Sonst müsste
       ihn derselbe Mensch zwei Minuten später im Cockpit noch einmal
       eintippen, um die Box überhaupt mit der Zentrale zu verbinden. */
    lizenzMerken(d, key);
    return res.json({
      ok: true, plan: d.plan || 'pro', expires: d.expires || null,
      products: d.produkte || ['all'], kunde: d.kunde || '', quelle: 'zentrale',
    });
  }

  const list = loadJson(LICENSES_FILE, []);
  const lic = list.find(l => l.key === key);
  if (lic) {
    if (lic.status !== 'active') return res.status(403).json({ ok: false, error: 'Lizenz ist gesperrt' });
    if (lic.expires && new Date(lic.expires) < new Date()) return res.status(403).json({ ok: false, error: 'Lizenz ist abgelaufen' });
    lic.activations = (lic.activations || 0) + 1;
    lic.lastSeen = new Date().toISOString();
    saveJson(LICENSES_FILE, list);
    return res.json({ ok: true, plan: lic.plan, expires: lic.expires || null,
                      products: lic.products || ['all'], quelle: 'lokal' });
  }

  /* Zwei sehr verschiedene Lagen dürfen nicht denselben Satz bekommen:
     „falscher Schlüssel" schickt den Kunden in die Bestellbestätigung,
     „kein Netz" schickt ihn ans WLAN. */
  if (!wolkeAntwort.erreichbar) {
    return res.status(503).json({ ok: false, offline: true, error:
      'Die Zentrale ist gerade nicht erreichbar — bitte Internetverbindung prüfen und erneut versuchen.' });
  }
  const grund = (wolkeAntwort.daten && wolkeAntwort.daten.error) || 'Schlüssel nicht gefunden';
  return res.status(wolkeAntwort.status || 404).json({ ok: false, error: grund });
});

// Verwaltung (am Host bzw. mit Host-Lizenzschlüssel) — Schlüssel ausgeben/sperren
app.get('/api/licenses', requireKey, (req, res) => res.json(loadJson(LICENSES_FILE, [])));

app.post('/api/licenses', requireKey, (req, res) => {
  const b = req.body || {};
  const lic = {
    key: newProductKey(),
    plan: PLANS.includes(b.plan) ? b.plan : 'pro',
    products: cleanProducts(b.products),
    status: 'active',
    created: new Date().toISOString(),
    expires: b.expires ? String(b.expires).slice(0, 10) : null,
    note: String(b.note || '').slice(0, 100).replace(/[<>]/g, ''),
    activations: 0,
  };
  const list = loadJson(LICENSES_FILE, []);
  list.unshift(lic);
  saveJson(LICENSES_FILE, list);
  res.json({ ok: true, license: lic });
});

/* ---------- API: Support-Tickets ---------- */

const TICKETS_FILE = path.join(CONFIG_DIR, 'tickets.json');

app.post('/api/tickets', (req, res) => {
  const b = req.body || {};
  const clean = (v, n) => String(v || '').slice(0, n).replace(/[<>]/g, '');
  const subject = clean(b.subject, 120), name = clean(b.name, 80), contact = clean(b.contact, 120), message = clean(b.message, 3000);
  if (!subject || !contact || !message) return res.status(400).json({ error: 'Betreff, Kontakt und Nachricht sind Pflicht' });
  const ticket = {
    id: 'T-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    token: crypto.randomBytes(8).toString('hex'),
    subject, name, contact,
    status: 'offen',
    priority: ['niedrig', 'normal', 'hoch'].includes(b.priority) ? b.priority : 'normal',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    messages: [{ from: 'customer', text: message, time: new Date().toISOString() }],
  };
  const list = loadJson(TICKETS_FILE, []);
  list.unshift(ticket);
  broadcast({ type: 'ticket', ticket: { id: ticket.id, subject, status: ticket.status } });
  saveJson(TICKETS_FILE, list.slice(0, 2000));
  console.log(`🎫 Neues Support-Ticket ${ticket.id}: ${subject} (${name})`);
  res.json({ ok: true, id: ticket.id, token: ticket.token });
});

app.get('/api/tickets', requireKey, (req, res) => res.json(loadJson(TICKETS_FILE, [])));

app.get('/api/tickets/:id', (req, res) => {
  const list = loadJson(TICKETS_FILE, []);
  const t = list.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Nicht gefunden' });
  const isAdmin = isLocal(req) || req.get('x-youbooth-key') === license.key;
  if (!isAdmin && req.query.token !== t.token) return res.status(403).json({ error: 'Kein Zugriff' });
  const { token, ...safe } = t;
  res.json(isAdmin ? t : safe);
});

app.post('/api/tickets/:id/reply', (req, res) => {
  const list = loadJson(TICKETS_FILE, []);
  const t = list.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Nicht gefunden' });
  const isAdmin = isLocal(req) || req.get('x-youbooth-key') === license.key;
  const b = req.body || {};
  if (!isAdmin && b.token !== t.token) return res.status(403).json({ error: 'Kein Zugriff' });
  const text = String(b.text || '').slice(0, 3000).replace(/[<>]/g, '');
  if (!text) return res.status(400).json({ error: 'Leere Nachricht' });
  t.messages.push({ from: isAdmin ? 'support' : 'customer', text, time: new Date().toISOString() });
  t.status = isAdmin ? 'beantwortet' : 'offen';
  t.updated = new Date().toISOString();
  saveJson(TICKETS_FILE, list);
  res.json({ ok: true });
});

app.post('/api/tickets/:id/status', requireKey, (req, res) => {
  const list = loadJson(TICKETS_FILE, []);
  const t = list.find(x => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Nicht gefunden' });
  const s = String((req.body || {}).status || '');
  if (!['offen', 'beantwortet', 'geschlossen'].includes(s)) return res.status(400).json({ error: 'Ungültiger Status' });
  t.status = s; t.updated = new Date().toISOString();
  saveJson(TICKETS_FILE, list);
  res.json({ ok: true });
});

/* ---------- API: Microsites (öffentliche Kunden-/Event-Seiten) ---------- */

const MICROSITES_FILE = path.join(CONFIG_DIR, 'microsites.json');
function slugify(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'event';
}
function cleanMicrosite(m, existing) {
  const s = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
  return {
    slug: existing ? existing.slug : (m.slug ? slugify(m.slug) : slugify(m.title || 'event')),
    title: s(m.title, 80) || 'Unser Event',
    headline: s(m.headline, 80),
    subtitle: s(m.subtitle, 160),
    accent: /^#[0-9a-fA-F]{6}$/.test(m.accent || '') ? m.accent : '#f2b23e',   // unser Amber
    logo: m.logo === null ? null : (typeof m.logo === 'string' && m.logo.startsWith('data:image/') && m.logo.length < 3_000_000 ? m.logo : (existing ? existing.logo : null)),
    boxUrl: s(m.boxUrl, 200).replace(/\/$/, ''),
    gallery: m.gallery !== false,
    theme: ['glow', 'photo', 'minimal'].includes(m.theme) ? m.theme : 'glow',
    expires: /^\d{4}-\d{2}-\d{2}$/.test(m.expires || '') ? m.expires : (m.expires === '' ? '' : (existing ? existing.expires || '' : '')),
    password: typeof m.password === 'string' ? m.password.slice(0, 40) : (existing ? existing.password || '' : ''),
    enabled: m.enabled !== false,
    created: existing ? existing.created : new Date().toISOString(),
  };
}

app.get('/api/microsites', requireKey, (req, res) => res.json(loadJson(MICROSITES_FILE, [])));

app.get('/api/microsites/public/:slug', (req, res) => {
  const list = loadJson(MICROSITES_FILE, []);
  const m = list.find(x => x.slug === req.params.slug);
  if (!m || !m.enabled) return res.status(404).json({ error: 'Nicht gefunden' });
  if (m.expires && new Date(m.expires + 'T23:59:59') < new Date()) {
    return res.json({ slug: m.slug, title: m.title, expired: true });
  }
  const { password, ...safe } = m;   // Passwort nie ausliefern
  if (password && (req.query.pw || '') !== password) {
    return res.json({ slug: m.slug, title: m.title, locked: true });
  }
  res.json({ ...safe, base: m.boxUrl || '', faceFinder: settings.faceFinder });   // leer = gleiche Herkunft
});

app.post('/api/microsites', requireKey, (req, res) => {
  const list = loadJson(MICROSITES_FILE, []);
  let m = cleanMicrosite(req.body || {});
  let base = m.slug, i = 2;
  while (list.some(x => x.slug === m.slug)) m.slug = base + '-' + (i++);
  list.push(m);
  saveJson(MICROSITES_FILE, list);
  res.json({ ok: true, microsite: m });
});

app.put('/api/microsites/:slug', requireKey, (req, res) => {
  const list = loadJson(MICROSITES_FILE, []);
  const idx = list.findIndex(x => x.slug === req.params.slug);
  if (idx < 0) return res.status(404).json({ error: 'Nicht gefunden' });
  list[idx] = cleanMicrosite(req.body || {}, list[idx]);
  saveJson(MICROSITES_FILE, list);
  res.json({ ok: true, microsite: list[idx] });
});

app.delete('/api/microsites/:slug', requireKey, (req, res) => {
  saveJson(MICROSITES_FILE, loadJson(MICROSITES_FILE, []).filter(x => x.slug !== req.params.slug));
  res.json({ ok: true });
});

/* Hübsche Event-Seiten-Adresse: /m/<slug>
   Ausgeliefert wird immer dieselbe Seite; welche Feier gemeint ist, liest sie
   aus dem Weg. Ob es die Seite gibt, ob sie abgelaufen ist und ob ein Kennwort
   davor liegt, entscheidet `/api/microsites/public/:slug` — nicht diese Zeile.
   Beim Bauen entsteht `event.html`; im Entwicklungsbetrieb liegt sie noch
   nicht im `dist`, dann führt der Weg zur Quelle. */
/* Kurze Adresse für den QR-Code am Screen: /fern */
app.get('/fern', (req, res) => {
  const gebaut = path.join(OBERFLAECHE, 'fern.html');
  if (fs.existsSync(gebaut)) return res.sendFile(gebaut);
  res.redirect('/fern.html');
});

app.get('/m/:slug', (req, res) => {
  const gebaut = path.join(OBERFLAECHE, 'event.html');
  if (fs.existsSync(gebaut)) return res.sendFile(gebaut);
  res.redirect('/event.html?slug=' + encodeURIComponent(req.params.slug));
});

/* ---------- API: Boxen (Mehr-Box-Verwaltung im Kunden-Dashboard) ---------- */

const BOXES_FILE = path.join(CONFIG_DIR, 'boxes.json');
function boxesList() {
  let boxes = loadJson(BOXES_FILE, null);
  if (!boxes) {
    boxes = [{ id: 'self', name: 'Diese Box', url: '', note: 'Dieses Gerät', created: new Date().toISOString() }];
    saveJson(BOXES_FILE, boxes);
  }
  return boxes;
}
app.get('/api/boxes', requireKey, (req, res) => {
  const boxes = boxesList().map(b => ({
    ...b,
    url: b.id === 'self' ? baseUrl() : b.url,
    event: b.id === 'self' ? settings.eventName : (b.event || ''),
  }));
  res.json(boxes);
});
app.post('/api/boxes', requireKey, (req, res) => {
  const b = req.body || {};
  const box = {
    id: 'box_' + crypto.randomBytes(3).toString('hex'),
    name: String(b.name || '').slice(0, 60) || 'Neue Box',
    url: String(b.url || '').replace(/\/$/, '').slice(0, 200),
    event: String(b.event || '').slice(0, 80),
    note: String(b.note || '').slice(0, 100),
    created: new Date().toISOString(),
  };
  const list = boxesList();
  list.push(box);
  saveJson(BOXES_FILE, list);
  res.json({ ok: true, box });
});
app.delete('/api/boxes/:id', requireKey, (req, res) => {
  if (req.params.id === 'self') return res.status(400).json({ error: 'Diese Box lässt sich nicht entfernen' });
  saveJson(BOXES_FILE, boxesList().filter(b => b.id !== req.params.id));
  res.json({ ok: true });
});

app.post('/api/licenses/:key/toggle', requireKey, (req, res) => {
  const list = loadJson(LICENSES_FILE, []);
  const lic = list.find(l => l.key === String(req.params.key).toUpperCase());
  if (!lic) return res.status(404).json({ error: 'Nicht gefunden' });
  lic.status = lic.status === 'active' ? 'blocked' : 'active';
  saveJson(LICENSES_FILE, list);
  res.json({ ok: true, status: lic.status });
});

app.get('/api/diagnostics', requireKey, (req, res) => {
  const mem = process.memoryUsage();
  let photosBytes = 0;
  try { for (const f of fs.readdirSync(PHOTOS_DIR)) photosBytes += fs.statSync(path.join(PHOTOS_DIR, f)).size; } catch {}
  res.json({
    zeit: new Date().toISOString(),
    hostname: os.hostname(),
    plattform: `${os.platform()} ${os.release()} (${os.arch()})`,
    nodeVersion: process.version,
    uptimeSekunden: Math.round(process.uptime()),
    systemUptimeSekunden: Math.round(os.uptime()),
    ramFreiMB: Math.round(os.freemem() / 1048576),
    ramGesamtMB: Math.round(os.totalmem() / 1048576),
    prozessRamMB: Math.round(mem.rss / 1048576),
    cpuKerne: os.cpus().length,
    ip: lanIp(),
    port: PORT,
    fotosAnzahl: listPhotos().length,
    fotosSpeicherMB: Math.round(photosBytes / 1048576 * 10) / 10,
    verbundeneClients: clientRoles(),
    druckerKonfiguriert: settings.printer || null,
    druckenAktiv: settings.printing,
    cloudAktiv: settings.cloud.enabled,
    lizenzErstellt: license.created,
  });
});

/* ---------- API: Drucker (vom System erkannt, inkl. WLAN-Drucker) ---------- */

const { execFile } = require('child_process');

app.get('/api/printers', (req, res) => {
  if (!CAN_PRINT) return res.json({ printers: [], selected: null, edition: 'cloud' });
  execFile('powershell', ['-NoProfile', '-Command',
    'Get-Printer | Select-Object -ExpandProperty Name'],
    { timeout: 15000 }, (err, stdout) => {
      if (err) return res.json({ printers: [], error: 'Druckerabfrage fehlgeschlagen' });
      const printers = stdout.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
      res.json({ printers, selected: settings.printer });
    });
});

/* Serverseitiger Druck auf den gewählten Drucker (auch WLAN) */
/* Druckt eine Bilddatei (auf Datenträger) randlos-zentriert auf dem Windows-Drucker */
function printImageFile(filePath, printer, cb) {
  const ps = `
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('${filePath.replace(/'/g, "''")}')
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '${String(printer).replace(/'/g, "''")}'
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$pd.add_PrintPage({ param($s, $e)
  $b = $e.PageBounds
  $r = [Math]::Min($b.Width / $img.Width, $b.Height / $img.Height)
  $w = $img.Width * $r; $h = $img.Height * $r
  $e.Graphics.DrawImage($img, ($b.Width - $w) / 2, ($b.Height - $h) / 2, $w, $h)
})
$pd.Print()
$img.Dispose()`;
  execFile('powershell', ['-NoProfile', '-Command', ps], { timeout: 60000 }, cb || (() => {}));
}

/* Wie viele Blatt in dieser Stunde schon rausgingen. */
/* ═════════════════════ Der Startbildschirm der Konsole ═════════════════════
   Wer die Software öffnet, will drei Dinge wissen, bevor er irgendwo klickt:
   **Was steht heute an, ist die Box bereit, und was fehlt noch?**

   Bisher landete man direkt in den Einstellungen — einer Liste von 31 Karten,
   die keine dieser Fragen beantwortet. Man musste wissen, wonach man sucht.

   Diese Auskunft kommt bewusst aus EINEM Aufruf. Vorher hätte der
   Startbildschirm fünf Schnittstellen einzeln fragen müssen, und bei jeder
   könnte etwas anderes herauskommen — eine Übersicht, die sich selbst
   widerspricht, ist schlimmer als keine. */
app.get('/api/start', async (req, res) => {
  const w = wirksam();
  const rollen = clientRoles();
  const jetzt = new Date();
  const stunde = jetzt.getHours();
  const gruss = stunde < 5 ? 'Gute Nacht' : stunde < 11 ? 'Guten Morgen'
    : stunde < 18 ? 'Guten Tag' : 'Guten Abend';

  /* ---------- Bereitschaft ----------
     Was ein Betreiber VOR der Feier wissen muss, in der Reihenfolge, in der
     es eine Feier zum Scheitern bringt. `stand`: 'gut' | 'achtung' | 'fehlt'.
     Jeder Punkt sagt, was zu tun ist — „Drucker nicht bereit" allein hilft
     um 19 Uhr niemandem. */
  const punkte = [];
  const p = (was, stand, text, wohin) => punkte.push({ was, stand, text, wohin: wohin || null });

  /* `license` kann null sein (allererster Start, bevor ein Schlüssel da
     ist). `license.key` haette dann die ganze Auskunft mit einem
     Typfehler beendet — ausgerechnet auf dem Bildschirm, der sagen soll,
     was fehlt. */
  const hatLizenz = !!(license && license.key);
  p('Lizenz', hatLizenz ? 'gut' : 'fehlt',
    hatLizenz ? 'Aktiv' : 'Kein Schlüssel hinterlegt — die Box läuft eingeschränkt.',
    'geraet');

  const eventLaeuft = !!eventEinstellungen;
  p('Event', eventLaeuft ? 'gut' : 'achtung',
    eventLaeuft ? (eventName || 'ohne Namen') + ' — aus der Cloud geladen'
      : 'Keines aktiv. Es gelten die Einstellungen am Gerät.', 'event');

  if (settings.printing) {
    const dz = await druckerZustand();
    p('Drucker', dz.da ? 'gut' : (settings.printer ? 'fehlt' : 'achtung'),
      dz.da ? (settings.printer || 'bereit') : dz.text, 'ausgabe');
  } else {
    p('Drucken', 'achtung', 'Ausgeschaltet — es wird nichts gedruckt.', 'ausgabe');
  }

  const platz = platzFrei(DATA_DIR);
  p('Speicherplatz', platz === null ? 'gut' : platz < 500 ? 'fehlt' : platz < 2000 ? 'achtung' : 'gut',
    platz === null ? 'nicht ermittelbar'
      : platz < 500 ? 'Nur noch ' + platz + ' MB frei. Fotos aufräumen.'
      : (platz / 1024).toFixed(1).replace('.', ',') + ' GB frei', 'geraet');

  const meldetAn = !!(settings.melden && settings.melden.enabled && settings.melden.key);
  p('Zentrale', meldetAn ? 'gut' : 'achtung',
    meldetAn ? 'Verbunden — Fernsteuerung möglich'
      : 'Nicht verbunden. Ohne sie keine Events aus der Ferne.', 'geraet');

  if (neueVersion && neueVersion.version) {
    p('Aktualisierung', neueVersion.gesperrt ? 'fehlt' : 'achtung',
      'Fassung ' + neueVersion.version + ' liegt bereit.', 'geraet');
  } else {
    p('Aktualisierung', 'gut', 'Fassung ' + APP_VERSION + ' ist aktuell.', 'geraet');
  }

  const heute = new Date().toISOString().slice(0, 10);
  const stat = (stats && stats[heute]) || {};

  res.json({
    gruss,
    boxName: settings.brandName || 'Youbooth',
    version: APP_VERSION,
    event: eventLaeuft
      ? { name: eventName || w.eventName || '', tagline: w.tagline || '', ausDerCloud: true }
      : { name: w.eventName || '', tagline: w.tagline || '', ausDerCloud: false },
    bereitschaft: punkte,
    bereit: punkte.every((x) => x.stand !== 'fehlt'),
    offen: punkte.filter((x) => x.stand !== 'gut').length,
    heute: {
      aufnahmen: (stat.photo || 0) + (stat.strip || 0) + (stat.boomerang || 0) + (stat.gif || 0),
      drucke: stat.print || 0,
      gaeste: stat.guest || 0,
    },
    verbunden: rollen,
    fotosGesamt: listPhotos().length,
    letzterFehler,
  });
});

/* ═══════════════════════ Projekte (Events) ═══════════════════════
   Die Konsole wusste bisher nur, welches Event GERADE läuft. Welche es sonst
   gibt, stand allein im Kundenkonto im Browser — wer vor der Box steht und
   umschalten will, musste das Handy herausholen.

   Die Box holt die Liste selbst und reicht sie durch. Warum nicht die Konsole
   direkt bei der Cloud fragen: Dann stünde der Lizenzschlüssel im Browser und
   ginge über eine fremde Adresse — die Box hat ihn ohnehin und ist der
   richtige Ort dafür. */
app.get('/api/events', requireKey, async (req, res) => {
  const key = settings.melden && settings.melden.key;
  if (!key) return res.json({ ok: false, grund: 'Kein Produktschlüssel hinterlegt.', events: [] });
  try {
    const r = await fetch(zentraleBasis() + '/api/box/events?key=' + encodeURIComponent(key),
      { signal: AbortSignal.timeout(12000) });
    const d = await r.json();
    if (!r.ok) return res.json({ ok: false, grund: d.error || ('HTTP ' + r.status), events: [] });
    /* Welches Event die Box gerade wirklich fährt, weiß nur die Box. Die
       Cloud kennt nur das Häkchen — bei gestörter Leitung laufen die
       auseinander, und dann soll die Anzeige die Box zeigen, nicht die
       Absicht. */
    res.json({ ok: true, events: d.events || [], hier: eventName || null });
  } catch (e) {
    res.json({ ok: false, grund: 'Zentrale nicht erreichbar (' + (e.message || e) + ')', events: [] });
  }
});

app.post('/api/events/:id/:was', requireKey, async (req, res) => {
  const key = settings.melden && settings.melden.key;
  if (!key) return res.status(400).json({ error: 'Kein Produktschlüssel hinterlegt.' });
  const was = req.params.was === 'start' ? 'start' : 'stop';
  try {
    const r = await fetch(zentraleBasis() + '/api/box/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, id: String(req.params.id || '').slice(0, 60), was }),
      signal: AbortSignal.timeout(12000),
    });
    const d = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: d.error || ('HTTP ' + r.status) });
    /* Sofort nachfassen statt bis zum nächsten Puls zu warten: Wer hier
       „starten" drückt, will die neue Beschriftung SEHEN, nicht in drei
       Sekunden. */
    try { await meldeAnZentrale('event-umschalten'); } catch (e) { /* der Puls holt es sonst nach */ }
    res.json({ ok: true, ...d });
  } catch (e) {
    res.status(502).json({ error: 'Zentrale nicht erreichbar: ' + (e.message || e) });
  }
});

/* ═══════════════ Schnellweg: Inhalte ohne Installer ═══════════════
   Der große Installer bleibt für Electron und die Modelle. Alles, was sich
   im Alltag ändert — server.js und die Seiten —, kommt hier als 1,5-MB-Paket
   und braucht weder Installationsprogramm noch Adminrechte noch eine
   freigegebene `Youbooth.exe`. */
/* Aus dem PROGRAMM laden, nicht relativ: Der Entpacker gehört zur Hülle und
   muss auch dann funktionieren, wenn die nachgeladenen Inhalte fehlerhaft
   sind — sonst könnte sich eine Box nicht mehr aus einem kaputten Stand
   herausarbeiten. */
const selbstUpdate = require(
  path.join(process.env.YOUBOOTH_MITGELIEFERT || __dirname, 'selbst-update.js'));
let inhaltStand = { pruefung: 0, verfuegbar: null, laeuft: false, meldung: '' };

/** Welche Inhaltsfassung läuft gerade WIRKLICH? */
function inhaltFassung() {
  const eigen = selbstUpdate.aktiveFassung(DATA_DIR);
  /* Nicht die Notiz, sondern der Ort, aus dem diese Datei geladen wurde:
     Wenn die nachgeladene Fassung beim Start scheiterte, steht die Notiz
     vielleicht noch, gefahren wird aber die mitgelieferte. */
  const nachgeladen = process.env.YOUBOOTH_MITGELIEFERT
    && process.env.YOUBOOTH_MITGELIEFERT !== __dirname;
  return nachgeladen && eigen ? eigen.version : APP_VERSION;
}

async function inhaltPruefen() {
  const url = (settings.update && settings.update.url) || (ZENTRALE + '/version.json');
  const r = await fetch(url + (url.includes('?') ? '&' : '?') + 'x=' + Date.now(),
    { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const v = await r.json();
  const inhalt = v.inhalt;
  if (!inhalt || !inhalt.version) return null;
  /* Relativ angegebene Adressen gegen die Feed-Adresse auflösen — sonst
     landet die Box auf `localhost:3377/pakete/…` und lädt sich selbst. */
  const paket = new URL(inhalt.url, url).href;
  const jetzt = inhaltFassung();
  if (selbstUpdate.alsZahl(inhalt.version) <= selbstUpdate.alsZahl(jetzt)) return null;
  /* Verlangt die neue Fassung ein neueres Programm (neues Electron, neue
     Modelle), hilft der Schnellweg nicht — dann muss der Installer ran. */
  if (inhalt.brauchtProgramm
      && selbstUpdate.alsZahl(inhalt.brauchtProgramm) > selbstUpdate.alsZahl(APP_VERSION)) {
    return { version: inhalt.version, nurMitInstaller: true, brauchtProgramm: inhalt.brauchtProgramm };
  }
  return { ...inhalt, url: paket };
}

app.get('/api/inhalt', requireKey, async (req, res) => {
  const antwort = () => res.json({
    laeuft: inhaltFassung(), programm: APP_VERSION,
    nachgeladen: (selbstUpdate.aktiveFassung(DATA_DIR) || {}).version || null,
    ...inhaltStand,
  });
  if (req.query.pruefen !== '1') return antwort();
  try {
    inhaltStand.verfuegbar = await inhaltPruefen();
    inhaltStand.pruefung = Date.now();
    inhaltStand.meldung = inhaltStand.verfuegbar
      ? (inhaltStand.verfuegbar.nurMitInstaller
          ? 'Fassung ' + inhaltStand.verfuegbar.version + ' braucht das große Paket.'
          : 'Fassung ' + inhaltStand.verfuegbar.version + ' liegt bereit.')
      : 'Alles aktuell.';
  } catch (e) {
    inhaltStand.meldung = 'Prüfung fehlgeschlagen: ' + (e.message || e);
  }
  antwort();
});

app.post('/api/inhalt/einspielen', requireKey, async (req, res) => {
  if (inhaltStand.laeuft) return res.status(409).json({ error: 'Läuft bereits.' });
  let quelle = inhaltStand.verfuegbar;
  try {
    if (!quelle) quelle = await inhaltPruefen();
    if (!quelle) return res.json({ ok: true, nichts: true, meldung: 'Alles aktuell.' });
    if (quelle.nurMitInstaller) {
      return res.status(409).json({ error: 'Diese Fassung braucht das große Paket (Programm '
        + quelle.brauchtProgramm + ' nötig, hier läuft ' + APP_VERSION + ').' });
    }
    inhaltStand.laeuft = true;
    const erg = await selbstUpdate.schnellEinspielen(DATA_DIR, quelle, (was, text) => {
      inhaltStand.meldung = text;
      broadcast({ type: 'inhalt', schritt: was, text });
    });
    inhaltStand.laeuft = false;
    inhaltStand.verfuegbar = null;
    /* Neu starten muss die Hülle — der Server kann sich nicht selbst neu
       laden. Sie prüft dabei denselben Leerlauf wie beim großen Weg: mitten
       in einer Feier wird nichts neu gestartet. */
    process.emit('youbooth-inhalt-bereit', erg.version);
    res.json({ ok: true, ...erg, hinweis: 'Wird beim nächsten ruhigen Moment übernommen.' });
  } catch (e) {
    inhaltStand.laeuft = false;
    inhaltStand.meldung = 'Fehlgeschlagen: ' + (e.message || e);
    res.status(500).json({ error: inhaltStand.meldung });
  }
});

/* Im Puls mitprüfen — dieselbe Stelle, an der auch die Programmfassung
   ankommt. Eine eigene Schleife wäre ein zweiter Takt, der irgendwann
   auseinanderläuft. */
setInterval(() => {
  if (inhaltStand.laeuft) return;
  inhaltPruefen()
    .then((v) => {
      if (!v || v.nurMitInstaller) return;
      inhaltStand.verfuegbar = v;
      console.log('Inhalte ' + v.version + ' verfügbar (Schnellweg).');
      process.emit('youbooth-inhalt-verfuegbar', v.version);
    })
    .catch(() => { /* kein Netz ist kein Fehler */ });
}, 20 * 60 * 1000);

/* Die Selbstprüfung abrufbar machen — und auf Wunsch sofort auslösen.
   Ohne `?jetzt=1` wird die letzte Auskunft geliefert: Wer die Konsole alle
   paar Sekunden aktualisiert, soll nicht alle paar Sekunden den Drucker
   abfragen (das dauert bis zu acht Sekunden und blockiert ihn). */
app.get('/api/selbstpruefung', async (req, res) => {
  if (req.query.jetzt === '1' || !letzteKontrolle) {
    try { await selbstpruefung(); } catch (e) { /* die Auskunft unten reicht */ }
  }
  res.json(letzteKontrolle || { zeit: 0, punkte: [], inOrdnung: null, reparaturen: [] });
});

let druckStunde = { seit: Date.now(), zahl: 0 };
/* Kontingent des laufenden Events. `event` merkt sich, WELCHES Event gezählt
   wurde — beim Wechsel fängt die Zählung von vorn an. Ohne dieses Feld
   erbte die Abendveranstaltung den Verbrauch der Nachmittagsfeier. */
let druckEvent = { event: '', zahl: 0 };
/* Abzüge je Runde. Bewusst nur im Arbeitsspeicher: Nach einem Neustart ist
   der Gast, der gerade vor der Box stand, ohnehin ein anderer. */
const druckRunden = new Map();

app.post('/api/print', (req, res) => {
  if (!CAN_PRINT) return res.status(400).json({ error: 'Drucken ist in der Cloud-Version nicht verfügbar – dafür gibt es die Windows/macOS-App' });
  if (!settings.printing) return res.status(400).json({ error: 'Drucken ist deaktiviert' });
  if (Date.now() - druckStunde.seit > 3600000) druckStunde = { seit: Date.now(), zahl: 0 };
  const grenze = settings.druck.maxProStunde;
  if (grenze > 0 && druckStunde.zahl >= grenze) {
    fehlerMerken('Druckgrenze erreicht (' + grenze + '/Stunde)');
    return res.status(429).json({
      error: 'Für diese Stunde ist die Druckgrenze erreicht (' + grenze + ' Blatt). '
        + 'Im Cockpit unter Drucken lässt sie sich anheben.',
    });
  }
  /* ---------- Kaufmännische Grenzen des Events ----------
     Die Stundengrenze darüber schützt die Hardware. Diese hier schützt die
     Kalkulation: „zwei Abzüge je Gast" ist eine Zusage im Angebot, keine
     Hardware-Frage. Deshalb kommt sie aus `wirksam()` (Event schlägt Gerät)
     und wird HIER geprüft, im Server — ein Knopf, den nur der Booth
     ausblendet, ist keine Grenze: Die Teilen-Station und das Handy im WLAN
     drucken über dieselbe Schnittstelle. */
  const gz = wirksam().druckGrenzen || {};
  const runde = String((req.body && req.body.runde) || '').slice(0, 40);
  if (Number(gz.proEvent) > 0 && druckEvent.zahl >= Number(gz.proEvent)) {
    return res.status(429).json({
      error: 'Für dieses Event ist das Druckkontingent aufgebraucht ('
        + gz.proEvent + ' Abzüge).', grenze: 'event', restEvent: 0,
    });
  }
  if (Number(gz.proRunde) > 0 && runde) {
    const schon = druckRunden.get(runde) || 0;
    if (schon >= Number(gz.proRunde)) {
      return res.status(429).json({
        error: 'Für dieses Bild sind ' + gz.proRunde
          + (Number(gz.proRunde) === 1 ? ' Abzug' : ' Abzüge') + ' vorgesehen.',
        grenze: 'runde', restRunde: 0,
      });
    }
  }

  const { image, printer } = req.body || {};
  const match = /^data:image\/(jpeg|png);base64,(.+)$/.exec(image || '');
  if (!match) return res.status(400).json({ error: 'Ungültige Bilddaten' });
  const target = String(printer || settings.printer || '');
  if (!target) return res.status(400).json({ error: 'Kein Drucker gewählt' });
  const tmp = path.join(os.tmpdir(), `youbooth_print_${Date.now()}.${match[1] === 'png' ? 'png' : 'jpg'}`);
  fs.writeFileSync(tmp, Buffer.from(match[2], 'base64'));
  printImageFile(tmp, target, (err) => {
    try { fs.unlinkSync(tmp); } catch {}
    if (err) return res.status(500).json({ error: 'Druck fehlgeschlagen: ' + err.message.slice(0, 200) });
    recordStat('print');
    druckStunde.zahl += 1;
    druckEvent.zahl += 1;
    if (runde) druckRunden.set(runde, (druckRunden.get(runde) || 0) + 1);
    /* Die Karte darf nicht mitwachsen: Eine Box läuft wochenlang durch, und
       jede Runde legt einen Eintrag an. Ältere Runden interessieren nicht
       mehr — der Gast steht längst nicht mehr davor. */
    if (druckRunden.size > 400) {
      const alt = [...druckRunden.keys()].slice(0, 200);
      alt.forEach((k) => druckRunden.delete(k));
    }
    const rest = (n, verbraucht) => (Number(n) > 0 ? Math.max(0, Number(n) - verbraucht) : null);
    res.json({
      ok: true, printer: target, dieseStunde: druckStunde.zahl,
      restRunde: rest(gz.proRunde, druckRunden.get(runde) || 0),
      restEvent: rest(gz.proEvent, druckEvent.zahl),
    });
  });
});

/* ---------- Ordner-Autodruck (Hotfolder) ----------
   Neue Bilddateien im Ordner "hotfolder/" werden automatisch gedruckt und
   optional in die Galerie/Foto-Wall übernommen. Verarbeitete Dateien wandern
   nach "hotfolder/gedruckt/". Robustes Polling statt fs.watch (plattformstabil). */
let hotfolderBusy = false;
function scanHotfolder() {
  if (!settings.hotfolder || !settings.hotfolder.enabled || hotfolderBusy) return;
  hotfolderBusy = true;
  try {
    const now = Date.now();
    const files = fs.readdirSync(HOTFOLDER_DIR)
      .filter(f => /\.(jpe?g|png)$/i.test(f));
    for (const f of files) {
      const src = path.join(HOTFOLDER_DIR, f);
      let st;
      try { st = fs.statSync(src); } catch { continue; }
      if (!st.isFile()) continue;
      if (now - st.mtimeMs < 2500) continue;              // Datei evtl. noch im Schreiben
      const ext = path.extname(f).toLowerCase();
      // 1) In Galerie/Foto-Wall übernehmen
      if (settings.hotfolder.addToGallery) {
        const name = `youbooth_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`;
        try {
          fs.copyFileSync(src, path.join(PHOTOS_DIR, name));
          broadcast({ type: 'photo', photo: { ...photoMeta(name), source: 'hotfolder' } });
        } catch {}
      }
      // 2) In den "gedruckt"-Ordner verschieben (verhindert Doppelverarbeitung)
      const done = path.join(HOTFOLDER_DONE, `${Date.now()}_${f}`);
      try { fs.renameSync(src, done); } catch { continue; }
      // 3) Drucken (nur Desktop-Edition mit gewähltem Drucker)
      if (CAN_PRINT && settings.printing && settings.printer) {
        printImageFile(done, settings.printer, () => {});
      }
      recordStat('hotfolder');
    }
  } catch {}
  hotfolderBusy = false;
}
setInterval(scanHotfolder, 3000);

/* ---------- API: Fotos ---------- */

app.get('/api/photos', (req, res) => { res.set('Access-Control-Allow-Origin', '*'); res.json(listPhotos()); });

/* Alle Fotos als ZIP (eigener ZIP-Writer, Methode "store" + CRC32) */
const CRC_TABLE = (() => {
  const t = [];
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) { let c = 0xFFFFFFFF; for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(entries) {
  const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16LE(n & 0xFFFF, 0); return b; };
  const u32 = n => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0, 0); return b; };
  const parts = [], central = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const crc = crc32(e.data);
    const local = Buffer.concat([u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(crc), u32(e.data.length), u32(e.data.length), u16(name.length), u16(0), name]);
    parts.push(local, e.data);
    central.push(Buffer.concat([u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21), u32(crc), u32(e.data.length), u32(e.data.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name]));
    offset += local.length + e.data.length;
  }
  const cd = Buffer.concat(central);
  const eocd = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(cd.length), u32(offset), u16(0)]);
  return Buffer.concat([...parts, cd, eocd]);
}
app.get('/api/photos.zip', (req, res) => {
  const files = fs.readdirSync(PHOTOS_DIR).filter(f => /\.(jpe?g|png|gif|webp|webm|mp4)$/i.test(f));
  if (!files.length) return res.status(404).json({ error: 'Keine Fotos vorhanden' });
  const entries = files.map(f => ({ name: f, data: fs.readFileSync(path.join(PHOTOS_DIR, f)) }));
  res.set('Content-Type', 'application/zip')
     .set('Content-Disposition', 'attachment; filename="youbooth-fotos.zip"')
     .set('Access-Control-Allow-Origin', '*')
     .send(makeZip(entries));
});

/* Ein Bild in die Galerie aufnehmen — derselbe Weg für Booth, Gäste-Handy und
   Hashtag-Drucker: Datei ablegen, Bildschirme benachrichtigen, zählen, an die
   Zentrale melden und in die Cloud-Galerie schieben. */
function bildAufnehmen(mime, rohdaten, quelle, modus, gesichter) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'video/webm': 'webm', 'video/mp4': 'mp4' }[mime];
  /* Die Aufnahmeart steht IM Dateinamen. Sonst wüsste nur die Statistik, wie
     ein Bild entstanden ist — und die Galerie könnte nicht danach filtern.
     Wer den Ordner kopiert, kopiert die Zuordnung mit. */
  const arten = ['foto', 'streifen', 'boomerang', 'gif', 'gast'];
  const artName = arten.includes(mode) ? mode : (source === 'guest' ? 'gast' : 'foto');
  const name = `youbooth_${Date.now()}_${artName}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(PHOTOS_DIR, name), rohdaten);
  const meta = { ...photoMeta(name), source: quelle || 'booth' };
  broadcast({ type: 'photo', photo: meta });
  recordStat(['photo', 'strip', 'boomerang', 'gif', 'hashtag'].includes(modus) ? modus : (quelle === 'guest' ? 'guest' : 'photo'));
  meldeAnZentrale('foto');
  fotoInDieWolke(name, mime, rohdaten, gesichter);
  return { name, ext, meta };
}

app.post('/api/photos', (req, res) => {
  const { image, source, mode, gesichter } = req.body || {};
  const match = /^data:(image\/(?:jpeg|png|gif|webp)|video\/(?:webm|mp4));base64,(.+)$/.exec(image || '');
  if (!match) return res.status(400).json({ error: 'Ungültige Bilddaten' });
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp', 'video/webm': 'webm', 'video/mp4': 'mp4' }[match[1]];
  /* Die Aufnahmeart steht IM Dateinamen. Sonst wüsste nur die Statistik, wie
     ein Bild entstanden ist — und die Galerie könnte nicht danach filtern.
     Wer den Ordner kopiert, kopiert die Zuordnung mit. */
  const arten = ['foto', 'streifen', 'boomerang', 'gif', 'gast'];
  const artName = arten.includes(mode) ? mode : (source === 'guest' ? 'gast' : 'foto');
  const name = `youbooth_${Date.now()}_${artName}_${crypto.randomBytes(3).toString('hex')}.${ext}`;
  const rohdaten = Buffer.from(match[2], 'base64');
  fs.writeFileSync(path.join(PHOTOS_DIR, name), rohdaten);
  const meta = { ...photoMeta(name), source: source || 'booth', art: artName };
  genutzt();
  broadcast({ type: 'photo', photo: meta });
  recordStat(['photo', 'strip', 'boomerang', 'gif'].includes(mode) ? mode : (source === 'guest' ? 'guest' : 'photo'));
  meldeAnZentrale('foto');   // gedrosselt auf höchstens 1× pro Minute

  /* Photomosaik-Sticker: jede ankommende Kachel als kleinen Sticker drucken (haptische Wand) */
  if (settings.mosaicMode === 'photomosaic' && settings.mosaicSticker && CAN_PRINT && settings.printer
      && ['jpg', 'png', 'webp'].includes(ext) && source !== 'proof') {
    printImageFile(path.join(PHOTOS_DIR, name), settings.printer, () => {});
  }

  /* Direkter Cloud-Upload: Foto asynchron an konfigurierten Cloud-Server weiterleiten */
  if (settings.cloud.enabled && settings.cloud.url && typeof fetch === 'function') {
    fetch(settings.cloud.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Youbooth-Key': settings.cloud.key || '',
        'X-Youbooth-Cloud-Secret': settings.cloud.secret || '',
      },
      body: JSON.stringify({ name, image, event: settings.eventName, device: os.hostname() }),
    }).catch(err => console.log('Cloud-Upload fehlgeschlagen:', err.message));
  }

  /* Cloud-Galerie der Youbooth-Zentrale: dasselbe Foto zusätzlich hochladen.
     Läuft nebenher — die Antwort an den Booth wartet nicht darauf. */
  fotoInDieWolke(name, match[1], rohdaten, gesichter);

  res.json({
    ok: true,
    photo: meta,
    downloadUrl: `${baseUrl()}${meta.url}`,
    shareUrl: `${baseUrl()}/share.html?p=${encodeURIComponent(name)}`,
    /* Adresse, die auch außerhalb des WLANs funktioniert — sobald das Event
       in der Cloud angelegt ist. Der Booth nutzt sie für den QR-Code. */
    cloudGalerie: wolke.galerieUrl || null,
  });
});

app.delete('/api/photos/:name', requireKey, (req, res) => {
  const name = path.basename(req.params.name);
  const file = path.join(PHOTOS_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Nicht gefunden' });
  fs.unlinkSync(file);
  broadcast({ type: 'remove', name });
  res.json({ ok: true });
});

/* ---------- WebSocket ---------- */

wss.on('connection', (ws, req) => {
  const role = new URL(req.url, 'http://x').searchParams.get('role') || 'unbekannt';
  ws.youboothRole = role;
  ws.youboothSeit = Date.now();
  ws.lebt = true;
  ws.on('pong', () => { ws.lebt = true; });
  ws.send(JSON.stringify({ type: 'hello', role, settings: ohnePin(wirksam()) }));
});

/* ═══════════════ Herzschlag — der teuerste Fehler dieses Projekts ═══════════
   GEMESSEN am 11.08.2026: Eine Box meldete **26 Stunden lang** „Bildschirme: 1"
   und spielte deshalb kein einziges Update ein. Verbunden war nichts mehr —
   der Booth-Reiter war längst zu.

   Der Grund: `wss.clients` enthält eine Verbindung, bis sie sauber geschlossen
   wird ODER das Betriebssystem die TCP-Verbindung für tot erklärt. Bei einem
   zugeklappten Laptop, einem abgestürzten Browser oder abgerissenem WLAN
   passiert weder das eine noch das andere — es kommt kein FIN, und TCP wartet
   ohne Datenverkehr praktisch ewig. Die Verbindung bleibt als Geist stehen.

   Das ist doppelt bitter, weil dieselbe Zahl an zwei Stellen etwas entscheidet:
   die Anzeige „Booth verbunden" im Cockpit (falsch, aber harmlos) und die
   Frage, ob ein Update eingespielt werden darf (nicht harmlos — die Box
   erneuert sich dann NIE mehr).

   Ein Ping ist die einzige Möglichkeit, eine tote Verbindung zu erkennen: Wer
   nicht antwortet, ist weg. `terminate()` statt `close()`, weil ein sauberes
   Schließen eine Antwort erwartet, die ein toter Gegenüber nie gibt. */
/* Die Hülle sagt Bescheid, bevor sie sich für eine Installation beendet.
   Offene WebSocket-Verbindungen und ein lauschender Server halten den Prozess
   am Leben — und ein lebender Prozess sperrt die `Youbooth.exe`, die das
   Installationsprogramm gerade ersetzen will. */
process.on('youbooth-beenden', () => {
  console.log('Beenden angekündigt — Verbindungen werden geschlossen.');
  for (const ws of wss.clients) { try { ws.terminate(); } catch {} }
  try { wss.close(); } catch {}
  try { server.close(); } catch {}
  try { if (httpsServer) httpsServer.close(); } catch {}
});

const HERZSCHLAG_MS = 30000;
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.lebt === false) {
      console.log('Verbindung ohne Antwort beendet (' + (ws.youboothRole || '?') + ').');
      ws.terminate();
      continue;
    }
    ws.lebt = false;
    try { ws.ping(); } catch { try { ws.terminate(); } catch {} }
  }
}, HERZSCHLAG_MS);

/* ---------- HTTPS mit eigenem Zertifikat ---------- */

let httpsServer = null;
let httpsStand = { an: false, port: null, fehler: null, adresse: null };

async function httpsStarten() {
  const port = Number(settings.https.port) || 3378;
  try {
    const z = await zertifikat.sicherstellen(CONFIG_DIR, [lanIp(), 'localhost', os.hostname()]);
    httpsServer = https.createServer({ pfx: fs.readFileSync(z.pfx), passphrase: z.passwort }, app);
    /* Der WebSocket muss auch über HTTPS erreichbar sein, sonst bleibt die
       Mosaik-Wand auf dem iPad stumm. */
    httpsServer.on('upgrade', (req, socket, kopf) => {
      const { pathname } = new URL(req.url, 'https://x');
      if (pathname !== '/ws') return socket.destroy();
      wss.handleUpgrade(req, socket, kopf, (ws) => wss.emit('connection', ws, req));
    });
    httpsServer.listen(port, '0.0.0.0', () => {
      httpsStand = { an: true, port, fehler: null, adresse: `https://${lanIp()}:${port}` };
      console.log(`  Sicher (iPad):       https://${lanIp()}:${port}/`
        + (z.neu ? '   [Zertifikat neu ausgestellt]' : ''));
    });
    httpsServer.on('error', (err) => {
      httpsStand = { an: false, port, fehler: err.message, adresse: null };
      console.log('HTTPS nicht gestartet:', err.message);
    });
  } catch (err) {
    httpsStand = { an: false, port, fehler: err.message, adresse: null };
    console.log('Zertifikat fehlgeschlagen:', err.message);
  }
}

app.get('/api/https/status', (req, res) => res.json({ ...httpsStand, eingeschaltet: !!settings.https.enabled }));

/* Das öffentliche Zertifikat zum Mitnehmen. iOS bietet beim Öffnen an, es als
   Profil zu laden; freigeschaltet wird es danach in den Einstellungen. */
app.get('/zertifikat.cer', (req, res) => {
  const datei = path.join(CONFIG_DIR, 'youbooth.cer');
  if (!fs.existsSync(datei)) return res.status(404).json({ error: 'Noch kein Zertifikat – HTTPS erst einschalten' });
  res.set('Content-Type', 'application/x-x509-ca-cert')
     .set('Content-Disposition', 'attachment; filename="Youbooth.cer"')
     .send(fs.readFileSync(datei));
});

/* ---------- Stirbt die Huelle, stirbt die Box ----------
   Ein mit `fork` gestarteter Node-Prozess ueberlebt seinen Erzeuger. Genau
   daran ist eine Windows-Installation gescheitert: Das Installationsprogramm
   beendete das Fenster, der Serverprozess lief weiter, hielt Port 3377 — und
   die frisch installierte Fassung fand ihn belegt, sah dort ein Youbooth
   antworten und beendete sich hoeflich. Ergebnis: „Die Box startet nicht",
   obwohl alles heil war.

   Der Kanal zur Huelle ist das verlaesslichste Lebenszeichen, das es gibt:
   Er bricht, sobald der Erzeuger weg ist — auch beim harten Abschuss. */
if (typeof process.send === 'function') {
  process.on('disconnect', () => {
    console.log('Die Huelle ist weg — die Box beendet sich mit.');
    process.exit(0);
  });
}

/* Ein Weg, eine laufende Box von aussen sauber zu beenden. Gebraucht wird er
   beim Aktualisieren: Die neue Huelle findet eine aeltere Box auf dem Port,
   und die muss weichen, sonst zeigt das Fenster die alte Oberflaeche.
   Nur vom selben Rechner — wer dort steht, koennte den Prozess ohnehin
   abschiessen; hier tut er es wenigstens geordnet. */
app.post('/api/beenden', (req, res) => {
  if (!isLocal(req)) return res.status(403).json({ error: 'Nur vom Booth-PC' });
  res.json({ ok: true, version: APP_VERSION });
  console.log('Beenden angefordert (lokal) — die Box faehrt herunter.');
  setTimeout(() => {
    try { server.close(); } catch (e) { /* dann eben hart */ }
    process.exit(0);
  }, 250);
});

/* ---------- Der Port ist belegt — und das ist meistens harmlos ----------
   Ohne diesen Zuhörer warf `listen` einen unbehandelten Fehler. In der
   verpackten App bedeutet das ein Fenster mit „Uncaught Exception: listen
   EADDRINUSE" und einem Stapelaufruf — für einen Betreiber vor einer
   wartenden Hochzeitsgesellschaft die denkbar schlechteste Auskunft.

   Statt zu stürzen sehen wir nach, WER da lauscht:
   · Antwortet dort ein Youbooth, läuft die Box schon. Dann ist der zweite Start
     ein Bedienfehler, kein Defekt — wir beenden uns leise, und die Hülle holt
     das vorhandene Fenster nach vorn.
   · Antwortet etwas Fremdes, weichen wir auf den nächsten freien Port aus und
     sagen laut und in Klartext, unter welcher Adresse die Box nun erreichbar
     ist. Ein anderes Programm auf 3377 ist kein Grund, gar nicht zu starten. */
const MAX_PORT_VERSUCHE = 10;
let portVersuch = 0;

server.on('error', async (err) => {
  if (err && err.code === 'EADDRINUSE') {
    const belegt = PORT_WUNSCH + portVersuch;
    if (portVersuch === 0 && await istEigeneYoubooth(belegt)) {
      console.error(`Youbooth läuft bereits auf Port ${belegt} — dieser Start wird beendet.`);
      process.exit(0);                      // 0: kein Fehler, nur überflüssig
    }
    portVersuch++;
    if (portVersuch <= MAX_PORT_VERSUCHE) {
      const neu = PORT_WUNSCH + portVersuch;
      console.warn(`Port ${belegt} ist von einem anderen Programm belegt — versuche ${neu} …`);
      return server.listen(neu, '0.0.0.0');
    }
    console.error(`Die Ports ${PORT_WUNSCH} bis ${PORT_WUNSCH + MAX_PORT_VERSUCHE} sind alle belegt. `
      + 'Bitte das Programm schließen, das sie benutzt, oder PORT= setzen.');
    process.exit(1);
  }
  console.error('Der Webserver konnte nicht starten:', err && err.message ? err.message : err);
  process.exit(1);
});

/* Fragt den Belegthaber, ob er ein Youbooth ist. Kurzer Zeitausfall, weil ein
   fremdes Programm auf dem Port auch gar nicht antworten kann. */
function istEigeneYoubooth(port) {
  return new Promise((fertig) => {
    const abbruch = setTimeout(() => { anfrage.destroy(); fertig(false); }, 1500);
    const anfrage = require('http').get(
      { host: '127.0.0.1', port, path: '/api/version', timeout: 1500 },
      (res) => {
        let text = '';
        res.on('data', (t) => { text += t; if (text.length > 4096) anfrage.destroy(); });
        res.on('end', () => {
          clearTimeout(abbruch);
          try { fertig(!!JSON.parse(text).version); } catch (e) { fertig(false); }
        });
      });
    anfrage.on('error', () => { clearTimeout(abbruch); fertig(false); });
    anfrage.on('timeout', () => { anfrage.destroy(); });
  });
}

server.listen(PORT, '0.0.0.0', () => {
  /* Die eine Stelle, an der der tatsächlich gebundene Port festgeschrieben
     wird. Ab hier stimmen QR-Codes, /api/netz und die Statusauskunft — auch
     nach einem Ausweichen. */
  const gebunden = server.address();
  if (gebunden && gebunden.port) PORT = gebunden.port;
  if (PORT !== PORT_WUNSCH) {
    console.log(`  Hinweis: Port ${PORT_WUNSCH} war belegt, Youbooth läuft auf ${PORT}.`);
  }
  /* Die Desktop-Hülle startet diesen Prozess und muss wissen, WOHIN sie ihr
     Fenster zeigen soll. Den Wunschport zu raten reicht nicht: Ist er belegt,
     weicht die Box aus, und die Hülle stünde vor einer Fehlerseite. */
  if (typeof process.send === 'function') process.send({ art: 'bereit', port: PORT });
  console.log('──────────────────────────────────────────────');
  console.log('  Youbooth Fotobox läuft!');
  console.log(`  Booth (dieser PC):   http://localhost:${PORT}/`);
  console.log(`  Foto-Wall (Beamer):  http://localhost:${PORT}/wand.html`);
  console.log(`  Cockpit (Betreiber): http://localhost:${PORT}/cockpit.html`);
  console.log(`  Im Netzwerk (Handy): http://${lanIp()}:${PORT}/`);
  console.log(`  Lizenz-Schlüssel:    ${license.key}  (für externen Zugriff)`);
  if (PUBLIC_BASE) console.log(`  Öffentlich:          ${PUBLIC_BASE}`);
  if (settings.melden && settings.melden.enabled) {
    console.log('  Meldet an Zentrale:  ja'
      + (Number(settings.melden.puls) > 0 ? `  (Fernsteuerung alle ${settings.melden.puls} s)` : '  (Fernsteuerung aus)'));
    if (settings.melden.fotos) console.log('  Cloud-Galerie:       an');
  }
  console.log('──────────────────────────────────────────────');

  /* Erste Meldung kurz nach dem Start (Netzwerk ist dann oben), danach alle 15 Minuten. */
  setTimeout(() => meldeAnZentrale('start'), 15000);
  setInterval(() => meldeAnZentrale('plan'), 15 * 60 * 1000);

  /* HTTPS nebenher. Läuft zusätzlich zu HTTP, damit nichts kaputtgeht, was
     schon auf Port 3377 zeigt. Scheitert das Zertifikat, sagt die Box das —
     und arbeitet ohne HTTPS weiter. */
  if (settings.https && settings.https.enabled) httpsStarten();

  /* Hashtag-Drucker: im eingestellten Takt nachsehen. */
  setInterval(() => { if (settings.hashtag.enabled) hashtagHolen(); },
    Math.max(60, settings.hashtag.intervallSek) * 1000);
  setTimeout(() => { if (settings.hashtag.enabled) hashtagHolen(); }, 20000);

  /* Einmal beim Start und danach täglich nachsehen, ob es etwas Neueres gibt. */
  setTimeout(updatePruefen, 12000);
  /* ★ Alle 30 Minuten statt einmal am Tag. Gemessener Anlass: Nach einer
     Veroeffentlichung stand die Box bis zu 24 Stunden auf der alten Fassung,
     und die Programmhuelle sah sogar nur alle 6 Stunden nach. Wer einen
     Fehler behebt, will nicht bis zum naechsten Morgen warten.
     Geholt wird eine wenige Kilobyte grosse JSON-Datei — das faellt nicht
     ins Gewicht. */
  setInterval(updatePruefen, 30 * 60 * 1000);

  /* Nachzügler in die Cloud schieben, sobald wieder Netz da ist. */
  setInterval(warteschlangeAbarbeiten, 60000);
  setTimeout(warteschlangeAbarbeiten, 25000);

  /* Puls: der Takt steht in den Einstellungen und darf sich im Betrieb ändern,
     deshalb ein Sekundentakt mit eigener Uhr statt eines festen Intervalls. */
  let letzterPuls = 0;
  setInterval(() => {
    const p = Number(settings.melden && settings.melden.puls) || 0;
    if (p > 0 && Date.now() - letzterPuls >= p * 1000) {
      letzterPuls = Date.now();
      pulsAnZentrale();
    }
  }, 1000);
});
