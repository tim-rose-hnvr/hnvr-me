/* seo-rank.me — die Beispielseite.
   Eine absichtlich fehlerhafte Seite, an der sich zeigen laesst, was der
   Pruefer findet. Sie steht hier fuer sich, weil zwei Stellen sie brauchen:
   das Werk auf der Startseite und der Seiten-Pruefer. Zwei Kopien waeren
   zwei Wahrheiten.

   Stand der Messung (Browser und Kommandozeile gleich):
   2 kritisch, 18 wichtig, 36 Hinweise, 102 bestanden, 63 von 100 Punkten. */

var SEORANK_BEISPIEL = [
    '<!doctype html>',
    '<html>',
    '<head>',
    '  <title>Waagen</title>',
    '  <script src="https://cdn.beispiel-netz.de/alles.js"><\/script>',
    '  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Roboto">',
    '  <link rel="canonical" href="/waagen/industrie">',
    '  <link rel="canonical" href="https://beispiel-domain.de/waagen#oben">',
    '  <link rel="alternate" hreflang="de" href="https://beispiel-domain.de/de">',
    '  <link rel="alternate" hreflang="de" href="https://beispiel-domain.de/at">',
    '  <link rel="alternate" hreflang="englisch" href="https://beispiel-domain.de/en">',
    '  <meta name="viewport" content="width=device-width, user-scalable=no">',
    '  <meta http-equiv="refresh" content="30">',
    '  <meta property="og:image" content="/bilder/vorschau.png">',
    '</head>',
    '<body>',
    '  <h1>Industriewaagen</h1>',
    '  <h1>Unser Sortiment</h1>',
    '  <h4>Plattformwaagen</h4>',
    '  <p>Kurzer Text mit wenigen Woertern.</p>',
    '  <p><font color="red">Angebot</font> <b>der Woche</b></p>',
    '  <img src="/bilder/waage.jpg">',
    '  <img src="/bilder/IMG_2481.jpg" alt="IMG_2481.jpg">',
    '  <img src="http://beispiel-domain.de/bilder/alt.jpg" alt="Alte Waage">',
    '  <table><tr><td>Modell</td><td>Preis</td></tr></table>',
    '  <form>',
    '    <input type="text" name="suche" placeholder="Suchen" autofocus>',
    '    <button></button>',
    '  </form>',
    '  <div id="block">A</div>',
    '  <div id="block">B</div>',
    '  <a href="/service">hier</a>',
    '  <a href="#">Nach oben</a>',
    '  <a href="javascript:void(0)">Aufklappen</a>',
    '  <a href="https://fremde-seite.de" target="_blank">Partner</a>',
    '  <a href="/kontakt"></a>',
    '  <a href="/agb" rel="nofollow">Bedingungen</a>',
    '  <iframe src="https://www.youtube.com/embed/xyz"></iframe>',
    '  <script src="https://www.googletagmanager.com/gtag/js"><\/script>',
    '  <script type="application/ld+json">{ "@type": "Product", }<\/script>',
    '</body>',
    '</html>'
  ].join("\n");

if (typeof module !== "undefined" && module.exports) module.exports = SEORANK_BEISPIEL;
