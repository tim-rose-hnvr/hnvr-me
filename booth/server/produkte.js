/* Youbooth – die verkaufbaren Module.
 *
 * Kennung, Name und Preis kommen aus `gestaltung/module.json` — derselben
 * Datei, aus der auch die Website ihre Modulseiten baut. BUILD_SPEC Teil 5.11
 * und Abnahmekriterium 6: „Preise, Modulnamen und Bibliotheksgroessen
 * existieren genau einmal."
 *
 * Was hier stand, war die zweite Liste. Sie war schon abgedriftet: dreizehn
 * Module statt vierzehn — die Einwegkamera fehlte ganz —, englische
 * Kennungen und vier abweichende Namen.
 *
 * Die alten Kennungen leben in `alt` weiter. Ausgestellte Lizenzen fuehren
 * sie in `settings.lizenz.produkte`; wuerden sie hier verschwinden, verloere
 * eine bezahlte Box von einer Fassung zur naechsten ihre Module.
 */
const GEMEINSAM = require('../../gestaltung/module.json');

/* Was nur die Software hat: Beschreibungstext, Merkmale und die Adressen der
   eigenen Oberflaechen. Auf der Website stehen dafuer andere Texte — das ist
   kein Widerspruch, sondern derselbe Gegenstand fuer ein anderes Publikum. */
const EIGENES = {
  booth: { icon: 'kamera', tag: 'Das volle System: Booth, Druck, Cockpit', url: 'dashboard.html', demo: 'booth.html',
    long: 'Die komplette Fotobox-Software: Live-Booth mit Countdown, Foto-Streifen & Boomerang, freies Druck-Layout, Sofort-Teilen per QR/Mail/WhatsApp und das Youbooth-Cockpit zur Fernsteuerung.',
    features: ['Booth mit Foto, Streifen, Boomerang & Video', 'Freier Druck-Layout-Editor + randloser Druck', 'Teilen per QR, Mail, WhatsApp & Galerie', 'Cockpit: alles aus der Ferne steuern'] },
  photowall: { icon: 'wand', tag: 'Fotos live auf Beamer & TV', url: 'mosaic.html', demo: 'mosaic.html',
    long: 'Alle Fotos erscheinen in Echtzeit als Mosaik-Wand auf Beamer oder TV – wahlweise als Raster, Overlay oder zu deinem Logo gelegt. Der Wow-Effekt auf jeder Party.',
    features: ['Echtzeit-Anzeige neuer Fotos', 'Raster-, Overlay- & Logo-Modus', 'Für Beamer, TV & 2. Bildschirm', 'Ohne Extra-Hardware im WLAN'] },
  selfiefinder: { icon: 'suche', tag: 'Fotos per Gesicht finden', url: 'finder.html', demo: 'finder.html',
    long: 'Gäste machen ein Selfie und bekommen sofort alle Fotos, auf denen sie zu sehen sind. Gesichtserkennung läuft lokal – datenschutzfreundlich, ganz ohne Cloud.',
    features: ['Fotos per eigenem Gesicht finden', 'Gesichtserkennung läuft lokal (DSGVO)', 'Sofort teilen & herunterladen', 'Kein Durchsuchen tausender Bilder'] },
  gallery: { icon: 'galerie', tag: 'Fotos teilen & herunterladen', url: 'gallery.html', demo: 'gallery.html',
    long: 'Eine gebrandete Online-Galerie für dein Event: Gäste scannen den QR-Code und sehen, teilen und laden alle Fotos herunter – einzeln oder als ZIP.',
    features: ['Gebrandete Event-Galerie', 'QR-Code zum sofortigen Zugang', 'Einzel- & Sammel-Download (ZIP)', 'Teilen per Link, Mail & WhatsApp'] },
  guestbook: { icon: 'stift', tag: 'Grüße als Live-Zettelwand', url: 'guestbook.html', demo: 'guestbook.html',
    long: 'Gäste hinterlassen Grüße mit Foto – live als bunte Zettelwand auf dem Bildschirm. Danach als digitales Gästebuch für das Brautpaar zum Behalten.',
    features: ['Grüße mit Foto & Name', 'Live-Zettelwand auf Beamer/TV', 'Moderation im Cockpit', 'Als Andenken exportierbar'] },
  webcam: { icon: 'selfie', tag: 'Browser-Fotobox ohne Hardware', url: 'cam.html', demo: 'cam.html',
    long: 'Verwandelt jedes Handy in eine Sofortbild-Kamera: Foto im Browser aufnehmen, mit AR-Filtern & Stickern verzieren und direkt in Galerie oder Foto-Wall hochladen.',
    features: ['Fotobox ohne Hardware – nur Handy', 'AR-Gesichtsfilter & Sticker-Editor', 'Polaroid-Rahmen & Sofortbild-Look', 'Upload in Galerie & Foto-Wall'] },
  microsites: { icon: 'netz', tag: 'Branded Event-Microsites', url: 'dashboard.html', demo: 'microsite.html?slug=demo',
    long: 'Für jedes Event eine eigene öffentliche Seite im Branding des Kunden: Galerie, Foto-Upload, Countdown und Infos – teilbar per Link & QR, verwaltet im Cockpit.',
    features: ['Eigene Seite pro Event', 'Im Branding des Kunden', 'Galerie, Upload & Countdown', 'Verwaltung & Ablaufdatum im Cockpit'] },
  slideshow: { icon: 'video', tag: 'Vollbild-Diashow für Events', url: 'slideshow.html', demo: 'slideshow.html',
    long: 'Alle Event-Fotos als elegante Vollbild-Diashow auf Beamer oder TV – mit sanften Übergängen und automatisch aktualisiert, sobald neue Bilder dazukommen.',
    features: ['Vollbild-Diashow für Beamer & TV', 'Sanfte Übergänge', 'Aktualisiert sich automatisch', 'Ideal für Empfang & Dinner'] },
  fxstudio: { icon: 'farbe', tag: 'Kunststile & KI-Hintergrund', url: 'studio.html', demo: 'studio.html',
    long: 'Verwandelt Fotos in Kunstwerke und tauscht den Hintergrund per KI aus – ganz ohne Greenscreen. Alles läuft lokal im Gerät, ohne Cloud und ohne Kosten pro Bild.',
    features: ['6 Kunststile (Öl, Pop-Art, Comic, Aquarell …)', 'KI-Hintergrund ohne grünes Tuch', 'Läuft lokal & DSGVO-freundlich', 'Direkt drucken, teilen & auf die Foto-Wall'] },
  voicebook: { icon: 'funk', tag: 'Grüße als Video mit echter Stimme', url: 'voicebook.html', demo: 'voicebook.html',
    long: 'Gäste sprechen 15 Sekunden ihre Glückwünsche ein – das Foto wird mit ihrer echten Stimme zu einem Video-Gruß. Ein Andenken, das man hören kann.',
    features: ['Foto + 15 s Sprachnachricht → Video', 'Live-Wellenform beim Aufnehmen', 'Läuft lokal im Browser', 'Landet direkt im Gästebuch & in der Galerie'] },
  slowmo: { icon: 'video', tag: 'Red-Carpet-Zeitlupe mit Musik', url: 'slowmo.html', demo: 'slowmo.html',
    long: 'Kurzes Video von Konfetti, Sprung oder Haarwurf wird zu cineastischer Zeitlupe – wahlweise mit treibendem Beat. Der Grammy-Booth-Effekt für jedes Event.',
    features: ['2×/3×/4× Zeitlupe wählbar', 'Optionaler, lizenzfreier Beat', 'Läuft komplett lokal', 'Direkt auf Foto-Wall & Galerie'] },
  rental: { icon: 'kalender', tag: 'Buchungsseite, Kalender & Pakete', url: 'rental.html', demo: 'book.html',
    long: 'Macht aus deiner Fotobox ein Vermietungs-Business: gebrandete Buchungsseite, Termin-Kalender mit Doppelbuchungs-Schutz, eigene Pakete und Galerie-Übergabe an den Kunden nach dem Event.',
    features: ['Gebrandete Buchungsseite (Paket → Termin → Anfrage)', 'Kalender mit Verfügbarkeit & Doppelbuchungs-Schutz', 'Eigene Pakete anlegen & verwalten', 'Galerie-Übergabe nach dem Event'] },
  spin360: { icon: 'boomerang', tag: 'Rundum-Video als Boomerang-Clip', url: 'spin360.html', demo: 'spin360.html',
    long: 'Verwandelt ein Rundum-Video vom drehenden Arm in einen cineastischen Clip – Zeitlupe, Boomerang-Loop (vor & zurück), Branding und optionaler Beat. Läuft komplett lokal.',
    features: ['Zeitlupe 2×/3×/4×', 'Boomerang-Loop (vor & zurück)', 'Branding & optionaler Beat', 'Aufnehmen oder Video hochladen'] },
};

/* Die Einwegkamera hatte hier keinen Eintrag. Sie steht auf der Website, im
   Preisrechner und in der Spec — nur die Software kannte sie nicht, und
   damit war sie nicht freischaltbar. */
EIGENES.disposable = {
  icon: 'film', tag: 'Handy wird zum Film mit begrenzten Bildern',
  url: 'dashboard.html', demo: 'einweg.html',
  long: 'Jedes Gaestehandy wird zum Einwegfilm: begrenzte Anzahl Aufnahmen, keine Vorschau, kein Loeschen. Entwickelt wird erst nach dem Event — die Spannung von frueher, ohne Labor.',
  features: ['12, 24 oder 36 Aufnahmen je Gast', 'Keine Vorschau, kein Loeschen', 'Entwicklung zum gewaehlten Zeitpunkt', 'Landet in Galerie und Foto-Wall'],
};

/* Zusammengesetzt: gemeinsame Kennung und gemeinsamer Preis, eigene Texte. */
const PRODUKTE = GEMEINSAM.module.map((m) => {
  const eigen = EIGENES[m.alt] || {};
  return {
    id: m.alt,          // was Lizenzen und gespeicherte Einstellungen fuehren
    kennung: m.id,      // die gemeinsame Kennung, gleich wie auf der Website
    name: m.name,
    price: `ab ${m.preis} €/Monat`,
    preis: m.preis,
    icon: eigen.icon || m.icon,
    tag: eigen.tag || '',
    url: eigen.url || 'dashboard.html',
    demo: eigen.demo || '',
    long: eigen.long || '',
    features: eigen.features || [],
  };
});

module.exports = PRODUKTE;
module.exports.bibliothek = GEMEINSAM.bibliothek;
