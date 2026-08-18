/* Youbooth – die verkaufbaren Module.
 *
 * ★ Eine Liste, zwei Nutzer: der Server (`/api/products`, `/p/<id>`) und das
 *   Bauskript der Marketing-Site. Vorher gab es eine zweite, von Hand
 *   gepflegte Kopie in `build-wix.py` — die driftete ab, und auf der
 *   Live-Seite stand jede Produktseite ohne Beschreibung und ohne Merkmale da.
 */
const PRODUKTE = [
  { id: 'booth', name: 'Komplette Fotobox', icon: 'kamera', tag: 'Das volle System: Booth, Druck, Cockpit', url: 'dashboard.html', price: 'ab 39 €/Monat', demo: 'booth.html',
    long: 'Die komplette Fotobox-Software: Live-Booth mit Countdown, Foto-Streifen & Boomerang, freies Druck-Layout, Sofort-Teilen per QR/Mail/WhatsApp und das Youbooth-Cockpit zur Fernsteuerung.',
    features: ['Booth mit Foto, Streifen, Boomerang & Video', 'Freier Druck-Layout-Editor + randloser Druck', 'Teilen per QR, Mail, WhatsApp & Galerie', 'Cockpit: alles aus der Ferne steuern'] },
  { id: 'photowall', name: 'Live-Foto-Wall', icon: 'wand', tag: 'Fotos live auf Beamer & TV', url: 'mosaic.html', price: 'ab 19 €/Monat', demo: 'mosaic.html',
    long: 'Alle Fotos erscheinen in Echtzeit als Mosaik-Wand auf Beamer oder TV – wahlweise als Raster, Overlay oder zu deinem Logo gelegt. Der Wow-Effekt auf jeder Party.',
    features: ['Echtzeit-Anzeige neuer Fotos', 'Raster-, Overlay- & Logo-Modus', 'Für Beamer, TV & 2. Bildschirm', 'Ohne Extra-Hardware im WLAN'] },
  { id: 'selfiefinder', name: 'Selfie-Foto-Finder', icon: 'suche', tag: 'Fotos per Gesicht finden', url: 'finder.html', price: 'ab 15 €/Monat', demo: 'finder.html',
    long: 'Gäste machen ein Selfie und bekommen sofort alle Fotos, auf denen sie zu sehen sind. Gesichtserkennung läuft lokal – datenschutzfreundlich, ganz ohne Cloud.',
    features: ['Fotos per eigenem Gesicht finden', 'Gesichtserkennung läuft lokal (DSGVO)', 'Sofort teilen & herunterladen', 'Kein Durchsuchen tausender Bilder'] },
  { id: 'gallery', name: 'Event-Galerie & QR', icon: 'galerie', tag: 'Fotos teilen & herunterladen', url: 'gallery.html', price: 'ab 12 €/Monat', demo: 'gallery.html',
    long: 'Eine gebrandete Online-Galerie für dein Event: Gäste scannen den QR-Code und sehen, teilen und laden alle Fotos herunter – einzeln oder als ZIP.',
    features: ['Gebrandete Event-Galerie', 'QR-Code zum sofortigen Zugang', 'Einzel- & Sammel-Download (ZIP)', 'Teilen per Link, Mail & WhatsApp'] },
  { id: 'guestbook', name: 'Digitales Gästebuch', icon: 'stift', tag: 'Grüße als Live-Zettelwand', url: 'guestbook.html', price: 'ab 12 €/Monat', demo: 'guestbook.html',
    long: 'Gäste hinterlassen Grüße mit Foto – live als bunte Zettelwand auf dem Bildschirm. Danach als digitales Gästebuch für das Brautpaar zum Behalten.',
    features: ['Grüße mit Foto & Name', 'Live-Zettelwand auf Beamer/TV', 'Moderation im Cockpit', 'Als Andenken exportierbar'] },
  { id: 'webcam', name: 'Web-Sofortbild-Kamera', icon: 'selfie', tag: 'Browser-Fotobox ohne Hardware', url: 'cam.html', price: 'ab 15 €/Monat', demo: 'cam.html',
    long: 'Verwandelt jedes Handy in eine Sofortbild-Kamera: Foto im Browser aufnehmen, mit AR-Filtern & Stickern verzieren und direkt in Galerie oder Foto-Wall hochladen.',
    features: ['Fotobox ohne Hardware – nur Handy', 'AR-Gesichtsfilter & Sticker-Editor', 'Polaroid-Rahmen & Sofortbild-Look', 'Upload in Galerie & Foto-Wall'] },
  { id: 'microsites', name: 'Event-Seiten', icon: 'netz', tag: 'Branded Event-Microsites', url: 'dashboard.html', price: 'ab 19 €/Monat', demo: 'microsite.html?slug=demo',
    long: 'Für jedes Event eine eigene öffentliche Seite im Branding des Kunden: Galerie, Foto-Upload, Countdown und Infos – teilbar per Link & QR, verwaltet im Cockpit.',
    features: ['Eigene Seite pro Event', 'Im Branding des Kunden', 'Galerie, Upload & Countdown', 'Verwaltung & Ablaufdatum im Cockpit'] },
  { id: 'slideshow', name: 'Beamer-Slideshow', icon: 'video', tag: 'Vollbild-Diashow für Events', url: 'slideshow.html', price: 'ab 12 €/Monat', demo: 'slideshow.html',
    long: 'Alle Event-Fotos als elegante Vollbild-Diashow auf Beamer oder TV – mit sanften Übergängen und automatisch aktualisiert, sobald neue Bilder dazukommen.',
    features: ['Vollbild-Diashow für Beamer & TV', 'Sanfte Übergänge', 'Aktualisiert sich automatisch', 'Ideal für Empfang & Dinner'] },
  { id: 'fxstudio', name: 'Effekt-Studio', icon: 'farbe', tag: 'Kunststile & KI-Hintergrund', url: 'studio.html', price: 'ab 15 €/Monat', demo: 'studio.html',
    long: 'Verwandelt Fotos in Kunstwerke und tauscht den Hintergrund per KI aus – ganz ohne Greenscreen. Alles läuft lokal im Gerät, ohne Cloud und ohne Kosten pro Bild.',
    features: ['6 Kunststile (Öl, Pop-Art, Comic, Aquarell …)', 'KI-Hintergrund ohne grünes Tuch', 'Läuft lokal & DSGVO-freundlich', 'Direkt drucken, teilen & auf die Foto-Wall'] },
  { id: 'voicebook', name: 'Audio-Gästebuch', icon: 'funk', tag: 'Grüße als Video mit echter Stimme', url: 'voicebook.html', price: 'ab 12 €/Monat', demo: 'voicebook.html',
    long: 'Gäste sprechen 15 Sekunden ihre Glückwünsche ein – das Foto wird mit ihrer echten Stimme zu einem Video-Gruß. Ein Andenken, das man hören kann.',
    features: ['Foto + 15 s Sprachnachricht → Video', 'Live-Wellenform beim Aufnehmen', 'Läuft lokal im Browser', 'Landet direkt im Gästebuch & in der Galerie'] },
  { id: 'slowmo', name: 'Slow-Motion Booth', icon: 'video', tag: 'Red-Carpet-Zeitlupe mit Musik', url: 'slowmo.html', price: 'ab 15 €/Monat', demo: 'slowmo.html',
    long: 'Kurzes Video von Konfetti, Sprung oder Haarwurf wird zu cineastischer Zeitlupe – wahlweise mit treibendem Beat. Der Grammy-Booth-Effekt für jedes Event.',
    features: ['2×/3×/4× Zeitlupe wählbar', 'Optionaler, lizenzfreier Beat', 'Läuft komplett lokal', 'Direkt auf Foto-Wall & Galerie'] },
  { id: 'rental', name: 'Vermietung & Buchung', icon: 'kalender', tag: 'Buchungsseite, Kalender & Pakete', url: 'rental.html', price: 'ab 25 €/Monat', demo: 'book.html',
    long: 'Macht aus deiner Fotobox ein Vermietungs-Business: gebrandete Buchungsseite, Termin-Kalender mit Doppelbuchungs-Schutz, eigene Pakete und Galerie-Übergabe an den Kunden nach dem Event.',
    features: ['Gebrandete Buchungsseite (Paket → Termin → Anfrage)', 'Kalender mit Verfügbarkeit & Doppelbuchungs-Schutz', 'Eigene Pakete anlegen & verwalten', 'Galerie-Übergabe nach dem Event'] },
  { id: 'spin360', name: '360°-Booth', icon: 'boomerang', tag: 'Rundum-Video als Boomerang-Clip', url: 'spin360.html', price: 'ab 19 €/Monat', demo: 'spin360.html',
    long: 'Verwandelt ein Rundum-Video vom drehenden Arm in einen cineastischen Clip – Zeitlupe, Boomerang-Loop (vor & zurück), Branding und optionaler Beat. Läuft komplett lokal.',
    features: ['Zeitlupe 2×/3×/4×', 'Boomerang-Loop (vor & zurück)', 'Branding & optionaler Beat', 'Aufnehmen oder Video hochladen'] },
];

module.exports = PRODUKTE;
