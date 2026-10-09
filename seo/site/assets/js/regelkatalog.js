/* seo-rank.me — Regelkatalog
   Eine einzige Quelle fuer beides: der Seiten-Pruefer arbeitet diese Liste ab,
   und regelsatz.html wird daraus erzeugt (bauen/regelsatz-erzeugen.mjs).
   Wer hier etwas aendert, laesst danach den Erzeuger laufen.

   Felder je Regel:
     id       kurzer Name, erscheint im Bericht
     gruppe   Ueberschrift im Regelsatz
     name     Klartextname des Befunds
     stufe    kritisch | wichtig | hinweis
     braucht  true, wenn ein vollstaendiges Dokument noetig ist
     wozu     Erklaerung fuer den Regelsatz
     pruefe   (dokument, rohtext) => null | {wie, fund}
*/

/* Die Messroutinen, die die Regeln benutzen, werden zusaetzlich nach aussen
   gegeben: die Analyse-Ansicht und die Kommandozeile rechnen damit, statt
   eigene Fassungen zu fuehren, die auseinanderlaufen koennten. */
var SEORANK_MESSEN = {};

var SEORANK_KATALOG = (function () {
  "use strict";

  var GRENZE_TITEL = 600;
  var GRENZE_TEXT = 960;

  var messflaeche = typeof document !== "undefined"
    ? document.createElement("canvas").getContext("2d")
    : null;

  /* Vorschubbreiten von Arial, im Browser einmal gemessen und als Bruchteil
     der Schriftgroesse abgelegt. Sie werden nur gebraucht, wenn kein Canvas
     zur Verfuegung steht, also in der Kommandozeile. Abweichung gegen die
     echte Messung: unter einem halben Prozent. */
  var ARIAL_BREITEN = {
    "0":0.5562, "1":0.5562, "2":0.5562, "3":0.5562, "4":0.5562, "5":0.5562, "6":0.5562, "7":0.5562,
    "8":0.5562, "9":0.5562, " ":0.2778, "!":0.2778, "\"":0.355, "#":0.5562, "$":0.5562, "%":0.8892,
    "&":0.667, "'":0.1909, "(":0.333, ")":0.333, "*":0.3892, "+":0.584, ",":0.2778, "-":0.333,
    ".":0.2778, "/":0.2778, ":":0.2778, ";":0.2778, "<":0.584, "=":0.584, ">":0.584, "?":0.5562,
    "@":1.0151, "A":0.667, "B":0.667, "C":0.7222, "D":0.7222, "E":0.667, "F":0.6108, "G":0.7778,
    "H":0.7222, "I":0.2778, "J":0.5, "K":0.667, "L":0.5562, "M":0.833, "N":0.7222, "O":0.7778,
    "P":0.667, "Q":0.7778, "R":0.7222, "S":0.667, "T":0.6108, "U":0.7222, "V":0.667, "W":0.9438,
    "X":0.667, "Y":0.667, "Z":0.6108, "[":0.2778, "\\":0.2778, "]":0.2778, "^":0.4692, "_":0.5562,
    "`":0.333, "a":0.5562, "b":0.5562, "c":0.5, "d":0.5562, "e":0.5562, "f":0.2778, "g":0.5562,
    "h":0.5562, "i":0.2222, "j":0.2222, "k":0.5, "l":0.2222, "m":0.833, "n":0.5562, "o":0.5562,
    "p":0.5562, "q":0.5562, "r":0.333, "s":0.5, "t":0.2778, "u":0.5562, "v":0.5, "w":0.7222,
    "x":0.5, "y":0.5, "z":0.5, "{":0.334, "|":0.2598, "}":0.334, "~":0.584, "ä":0.5562,
    "ö":0.5562, "ü":0.5562, "Ä":0.667, "Ö":0.7778, "Ü":0.7222, "ß":0.6108, "á":0.5562, "à":0.5562,
    "â":0.5562, "é":0.5562, "è":0.5562, "ê":0.5562, "í":0.2778, "ì":0.2778, "î":0.2778, "ó":0.5562,
    "ò":0.5562, "ô":0.5562, "ú":0.5562, "ù":0.5562, "û":0.5562, "ñ":0.5562, "ç":0.5, "Á":0.667,
    "À":0.667, "Â":0.667, "É":0.667, "È":0.667, "Ê":0.667, "Í":0.2778, "Ó":0.7778, "Ú":0.7222,
    "Ñ":0.7222, "Ç":0.7222, "€":0.5562, "£":0.5562, "¥":0.5562, "©":0.7368, "®":0.7368, "™":1,
    "°":0.3999, "±":0.5488, "×":0.584, "÷":0.5488, "–":0.5562, "—":1, "…":1, "·":0.333,
    "•":0.3501, "«":0.5562, "»":0.5562, "‹":0.333, "›":0.333, "„":0.333, "“":0.333, "”":0.333,
    "‚":0.2222, "‘":0.2222, "’":0.2222, "§":0.5562, "¶":0.5371, "†":0.5562, "‡":0.5562, "‰":1,
    "←":1, "↑":0.5, "→":1, "↓":0.5, "↔":1, "✓":0.749, "✕":0.8169, "≈":0.5488,
    "≤":0.5488, "≥":0.5488
  };

  function px(text, schrift) {
    if (messflaeche) {
      messflaeche.font = schrift;
      return Math.round(messflaeche.measureText(text).width);
    }
    // Ohne Canvas: aus der Breitentabelle rechnen.
    var groesse = parseFloat(schrift) || 16;
    var summe = 0;
    var zeichen = String(text).split("");
    for (var i = 0; i < zeichen.length; i++) {
      var b = ARIAL_BREITEN[zeichen[i]];
      summe += (b === undefined ? 0.5562 : b) * groesse;
    }
    return Math.round(summe);
  }

  function kurz(text, laenge) {
    text = String(text).replace(/\s+/g, " ").trim();
    return text.length > laenge ? text.slice(0, laenge) + "…" : text;
  }

  function liste(werte, anzahl) {
    return werte.slice(0, anzahl || 5).join("\n") + (werte.length > (anzahl || 5) ? "\n… und " + (werte.length - (anzahl || 5)) + " weitere" : "");
  }

  function alle(d, wahl) {
    return Array.prototype.slice.call(d.querySelectorAll(wahl));
  }

  function inhalt(el) {
    return el ? (el.getAttribute("content") || "").trim() : "";
  }

  /* Nur der Seitentitel, nicht die Beschriftung einer Grafik: <title> gibt
     es auch in SVG, und dort bedeutet es etwas voellig anderes. */
  function seitentitel(d) {
    return alle(d, "title").filter(function (t) { return !t.closest("svg"); });
  }

  function robotsAngabe(d) {
    return alle(d, 'meta[name="robots" i], meta[name="googlebot" i]')
      .map(inhalt).join(",").toLowerCase();
  }

  // Sammelt alle absoluten Adressen, die das Dokument von aussen holt.
  function fremdadressen(d) {
    var quellen = [];
    alle(d, "img[src], script[src], iframe[src], source[src], video[src], audio[src], embed[src]")
      .forEach(function (el) { quellen.push(el.getAttribute("src")); });
    // Nur Verweise, die der Browser wirklich abruft. canonical, alternate
    // und aehnliche Angaben zeigen nur hin, sie laden nichts.
    var ladendeRel = ["stylesheet", "icon", "shortcut icon", "apple-touch-icon", "preload", "preconnect", "dns-prefetch", "prefetch", "prerender", "manifest", "mask-icon"];
    alle(d, "link[href][rel]").forEach(function (el) {
      var rel = (el.getAttribute("rel") || "").toLowerCase().trim();
      if (ladendeRel.indexOf(rel) !== -1 || rel.split(/\s+/).some(function (r) { return ladendeRel.indexOf(r) !== -1; })) {
        quellen.push(el.getAttribute("href"));
      }
    });
    alle(d, "img[srcset], source[srcset]").forEach(function (el) {
      (el.getAttribute("srcset") || "").split(",").forEach(function (t) {
        quellen.push(t.trim().split(/\s+/)[0]);
      });
    });
    return quellen.filter(function (q) { return q && /^(https?:)?\/\//i.test(q); });
  }

  function hostVon(adresse) {
    try { return new URL(adresse.replace(/^\/\//, "https://")).host.toLowerCase(); }
    catch (e) { return null; }
  }

  var SCHRIFTDIENSTE = ["fonts.googleapis.com", "fonts.gstatic.com", "use.typekit.net", "p.typekit.net", "fast.fonts.net", "use.fontawesome.com", "cdn.jsdelivr.net/npm/@fontsource"];
  var ZAEHLDIENSTE = [
    ["google-analytics.com", "Google Analytics"], ["googletagmanager.com", "Google Tag Manager"],
    ["connect.facebook.net", "Meta-Pixel"], ["static.hotjar.com", "Hotjar"],
    ["matomo", "Matomo"], ["plausible.io", "Plausible"], ["clarity.ms", "Microsoft Clarity"],
    ["doubleclick.net", "Google-Werbenetz"], ["ads.linkedin.com", "LinkedIn Insight"]
  ];
  /* Zaehlt die Woerter im sichtbaren Text, ohne Skripte und Formatierung. */
  function woerterZaehlen(d) {
    if (!d.body) return 0;
    var text = "";
    var stapel = [d.body];
    while (stapel.length) {
      var el = stapel.pop();
      for (var i = 0; i < el.childNodes.length; i++) {
        var k = el.childNodes[i];
        if (k.nodeType === 3) text += " " + k.textContent;
        else if (k.nodeType === 1 && ["script", "style", "noscript", "template"].indexOf(k.localName) === -1) stapel.push(k);
      }
    }
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  /* Alle Objekte aus allen JSON-LD-Bloecken, flach ausgebreitet. */
  function ldObjekte(d) {
    var aus = [];
    alle(d, 'script[type="application/ld+json"]').forEach(function (s) {
      var daten;
      try { daten = JSON.parse(s.textContent); } catch (e) { return; }
      var vorrat = [daten];
      while (vorrat.length) {
        var o = vorrat.pop();
        if (!o || typeof o !== "object") continue;
        if (Array.isArray(o)) { vorrat.push.apply(vorrat, o); continue; }
        aus.push(o);
        if (o["@graph"]) vorrat.push(o["@graph"]);
      }
    });
    return aus;
  }


  /* ---------- Helfer fuer die erweiterten Regeln ---------- */

  /* Die Adresse, unter der die Seite stehen soll. Ohne canonical hilft
     og:url weiter; ohne beides laesst sich zur Adresse nichts sagen. */
  function eigeneAdresse(d) {
    var k = d.querySelector('link[rel="canonical" i]');
    var wert = k ? (k.getAttribute("href") || "").trim() : "";
    if (!wert) {
      var og = d.querySelector('meta[property="og:url" i]');
      wert = og ? inhalt(og) : "";
    }
    if (!/^https?:\/\//i.test(wert)) return null;
    try { return new URL(wert); } catch (e) { return null; }
  }

  /* Sichtbarer Text der Seite als eine Zeichenkette. */
  function sichtbarerText(d) {
    if (!d.body) return "";
    var text = "";
    var stapel = [d.body];
    var aus = ["script", "style", "noscript", "template", "svg"];
    while (stapel.length) {
      var el = stapel.pop();
      for (var i = 0; i < el.childNodes.length; i++) {
        var k = el.childNodes[i];
        if (k.nodeType === 3) text += " " + k.textContent;
        else if (k.nodeType === 1 && aus.indexOf(k.localName) === -1) stapel.push(k);
      }
    }
    return text.replace(/\s+/g, " ").trim();
  }

  /* Zerlegt in Saetze. Abkuerzungen mit Punkt werden nicht erkannt; das
     verschiebt den Wert leicht nach unten und ist so vermerkt. */
  function saetze(text) {
    return String(text).split(/[.!?…]+[\s"»«)]|[.!?…]+$/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s.split(/\s+/).length > 2; });
  }

  /* Silben naeherungsweise: zusammenhaengende Vokalgruppen zaehlen.
     Fuer Deutsch traegt das ausreichend weit, exakt ist es nicht. */
  function silben(wort) {
    var w = String(wort).toLowerCase().replace(/[^a-zäöüß]/g, "");
    if (!w) return 0;
    var gruppen = w.match(/[aeiouäöüy]+/g);
    var n = gruppen ? gruppen.length : 1;
    if (/[^aeiouäöüy]e$/.test(w) && n > 1) n--;
    return Math.max(1, n);
  }

  /* Lesbarkeit nach Amstad, der deutschen Fassung des Flesch-Werts.
     100 = sehr leicht, 0 = sehr schwer. */
  function lesbarkeit(text) {
    var s = saetze(text);
    var w = text.split(/\s+/).filter(Boolean);
    if (s.length < 3 || w.length < 40) return null;
    var asl = w.length / s.length;
    var asw = w.reduce(function (summe, x) { return summe + silben(x); }, 0) / w.length;
    return {
      wert: Math.round(180 - asl - 58.5 * asw),
      satzlaenge: Math.round(asl * 10) / 10,
      woerter: w.length,
      saetze: s.length
    };
  }

  var STOPPWOERTER = ("der die das und oder aber ein eine einen einem einer eines "
    + "ist sind war waren sein ihre ihr sie er es wir ihr uns euch mit von zu zum zur "
    + "auf aus bei nach vor ueber über unter für fuer durch gegen ohne um an im in am "
    + "den dem des als auch noch nur schon dann wenn dass daß wie was wer wo weil "
    + "man sich nicht kein keine mehr sehr hier dort diese dieser dieses jeder alle "
    + "the and for you your with this that from are was not but have has").split(" ");

  /* Zaehlt Woerter und Wortfolgen im sichtbaren Text. */
  function wortfeld(text, laenge) {
    var w = text.toLowerCase()
      .replace(/[^a-zäöüß0-9\s-]/g, " ")
      .split(/\s+/)
      .filter(function (x) { return x.length > 2; });
    var zaehler = {};
    for (var i = 0; i + laenge <= w.length; i++) {
      var teil = w.slice(i, i + laenge);
      if (laenge === 1 && STOPPWOERTER.indexOf(teil[0]) !== -1) continue;
      if (laenge > 1 && STOPPWOERTER.indexOf(teil[0]) !== -1) continue;
      if (laenge > 1 && STOPPWOERTER.indexOf(teil[laenge - 1]) !== -1) continue;
      var s = teil.join(" ");
      zaehler[s] = (zaehler[s] || 0) + 1;
    }
    var aus = Object.keys(zaehler).map(function (k) { return { wort: k, anzahl: zaehler[k] }; });
    aus.sort(function (a, b) { return b.anzahl - a.anzahl || a.wort.localeCompare(b.wort); });
    return { liste: aus, gesamt: Math.max(1, w.length) };
  }

  var FARBNAMEN = {
    black: [0, 0, 0], white: [255, 255, 255], red: [255, 0, 0], lime: [0, 255, 0],
    blue: [0, 0, 255], yellow: [255, 255, 0], cyan: [0, 255, 255], magenta: [255, 0, 255],
    silver: [192, 192, 192], gray: [128, 128, 128], grey: [128, 128, 128],
    maroon: [128, 0, 0], olive: [128, 128, 0], green: [0, 128, 0], purple: [128, 0, 128],
    teal: [0, 128, 128], navy: [0, 0, 128], orange: [255, 165, 0]
  };

  function farbeLesen(wert) {
    if (!wert) return null;
    var w = String(wert).trim().toLowerCase();
    if (FARBNAMEN[w]) return FARBNAMEN[w];
    var kurzHex = w.match(/^#([0-9a-f]{3})$/);
    if (kurzHex) {
      return kurzHex[1].split("").map(function (z) { return parseInt(z + z, 16); });
    }
    var hex = w.match(/^#([0-9a-f]{6})$/);
    if (hex) {
      return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16)];
    }
    var rgb = w.match(/^rgba?\(\s*([0-9]+)[\s,]+([0-9]+)[\s,]+([0-9]+)/);
    if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    return null;
  }

  function leuchtdichte(rgb) {
    var teile = rgb.map(function (v) {
      var x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * teile[0] + 0.7152 * teile[1] + 0.0722 * teile[2];
  }

  function kontrast(a, b) {
    var la = leuchtdichte(a), lb = leuchtdichte(b);
    var hell = Math.max(la, lb), dunkel = Math.min(la, lb);
    return Math.round(((hell + 0.05) / (dunkel + 0.05)) * 100) / 100;
  }

  /* Liest eine einzelne Eigenschaft aus einem style-Attribut. */
  function stilWert(el, name) {
    var stil = el.getAttribute("style");
    if (!stil) return null;
    var treffer = stil.match(new RegExp("(?:^|;)\\s*" + name + "\\s*:\\s*([^;]+)", "i"));
    return treffer ? treffer[1].trim() : null;
  }

  /* Alle ids des Dokuments, fuer Verweise auf Sprungmarken. */
  function kennungen(d) {
    var menge = {};
    alle(d, "[id]").forEach(function (el) { menge[el.getAttribute("id")] = true; });
    return menge;
  }

  /* Der Inhalt aller <style>-Bloecke. Nur hier steht wirklich CSS; ein
     <code>@import</code> im Fliesstext ist eine Erklaerung, kein Stil. */
  function stilQuellen(d) {
    return alle(d, "style").map(function (e) { return e.textContent; }).join("\n");
  }

  /* Ebenso fuer Skripte: nur eingebettete, keine Datenbloecke wie JSON-LD. */
  function skriptQuellen(d) {
    return alle(d, "script").filter(function (e) {
      if (e.hasAttribute("src")) return false;
      var typ = (e.getAttribute("type") || "").toLowerCase();
      return typ === "" || typ.indexOf("javascript") !== -1 || typ === "module";
    }).map(function (e) { return e.textContent; }).join("\n");
  }

  var ROLLEN = ("alert alertdialog application article banner button cell checkbox columnheader "
    + "combobox complementary contentinfo definition dialog directory document feed figure form "
    + "grid gridcell group heading img link list listbox listitem log main marquee math menu "
    + "menubar menuitem menuitemcheckbox menuitemradio navigation none note option presentation "
    + "progressbar radio radiogroup region row rowgroup rowheader scrollbar search searchbox "
    + "separator slider spinbutton status switch tab table tablist tabpanel term textbox timer "
    + "toolbar tooltip tree treegrid treeitem doc-subtitle").split(" ");

  /* Wie ldObjekte, aber vollstaendig: steigt auch in verschachtelte Objekte
     ab. Ein Offer steht in einem Product, ein AggregateRating ebenso, ein
     Organization als publisher. Wer nur die oberste Ebene ansieht, sieht
     die haelfte der Auszeichnung nicht. */
  function ldTief(d) {
    var aus = [];
    alle(d, 'script[type="application/ld+json"]').forEach(function (s) {
      var daten;
      try { daten = JSON.parse(s.textContent); } catch (e) { return; }
      var vorrat = [daten];
      var gesehen = 0;
      while (vorrat.length && gesehen < 5000) {
        var o = vorrat.pop();
        gesehen++;
        if (!o || typeof o !== "object") continue;
        if (Array.isArray(o)) { vorrat.push.apply(vorrat, o); continue; }
        aus.push(o);
        Object.keys(o).forEach(function (k) {
          if (k === "@context") return;
          var w = o[k];
          if (w && typeof w === "object") vorrat.push(w);
        });
      }
    });
    return aus;
  }

  var UNSPEZIFISCH = ["hier", "hier klicken", "klicken", "mehr", "mehr erfahren", "mehr lesen", "weiterlesen", "link", "weiter", "details", "read more", "mehr dazu"];


  /* Zu jeder Regel: was konkret zu tun ist, worauf sie wirkt und wie schwer
     sie in der Punktzahl wiegt. Getrennt von der Pruefung gehalten, damit
     die Pruefroutinen lesbar bleiben.
     Aufbau: id: [ was tun, Wirkungsbereich, Gewicht 1-5 ] */
  var ZUSATZ = {
    "titel-fehlt": ["Ein <code>&lt;title&gt;</code> in den Kopfbereich setzen: erst worum es geht, dann der Name der Website, getrennt durch einen Strich.", "Trefferliste", 5],
    "titel-mehrfach": ["Alle title-Elemente bis auf das erste entfernen. Meist stammt das zweite aus einer Vorlage, die schon einen mitbringt.", "Trefferliste", 4],
    "titel-breit": ["Auf etwa 55 bis 60 Zeichen kürzen. Das Wichtigste nach vorn, den Namen der Website ans Ende — abgeschnitten wird von hinten.", "Trefferliste", 3],
    "titel-kurz": ["Um das ergänzen, was die Seite von anderen unterscheidet: Ort, Fachgebiet, Jahreszahl, Modell.", "Trefferliste", 2],
    "titel-wiederholung": ["Die Wiederholungen streichen. Ein Wort einmal im Titel reicht vollkommen.", "Trefferliste", 2],
    "beschreibung-fehlt": ["<code>&lt;meta name=\"description\" content=\"…\"&gt;</code> ergänzen: zwei Sätze, die sagen was die Seite liefert und für wen.", "Trefferliste", 3],
    "beschreibung-mehrfach": ["Bis auf eine alle entfernen. Häufig setzt ein Zusatzmodul eine zweite dazu.", "Trefferliste", 3],
    "beschreibung-breit": ["Auf etwa 155 Zeichen kürzen; den entscheidenden Satz zuerst.", "Trefferliste", 2],
    "beschreibung-kurz": ["Auf zwei vollständige Sätze ausbauen. Der Platz steht zur Verfügung.", "Trefferliste", 1],
    "h1-fehlt": ["Die Hauptüberschrift der Seite in ein <code>&lt;h1&gt;</code> setzen — den Text, der oben im Inhalt steht.", "Gliederung", 4],
    "h1-mehrfach": ["Eine h1 behalten, die übrigen zu h2 machen. Die h1 benennt die Seite, nicht einen Abschnitt.", "Gliederung", 3],
    "h1-lang": ["Auf einen Satzteil kürzen. Was länger ist, gehört in den ersten Absatz.", "Gliederung", 2],
    "ueberschrift-sprung": ["Die übersprungene Ebene einziehen oder die zu tiefe Überschrift anheben. Ebenen sind eine Gliederung, keine Schriftgrößen.", "Gliederung", 2],
    "ueberschrift-leer": ["Leere Überschriften entfernen. Meist sind es Kästen, die nur Abstand erzeugen sollten.", "Gliederung", 2],
    "main-fehlt": ["Den eigentlichen Inhalt in <code>&lt;main&gt;</code> fassen — alles außer Kopf, Menü und Fußbereich.", "Bedienung", 3],
    "main-mehrfach": ["Nur einen main behalten. Es gibt genau einen Hauptteil je Seite.", "Bedienung", 3],
    "doppelte-id": ["Die doppelten Kennungen umbenennen. Verweise und Beschriftungen finden sonst das falsche Element.", "Bedienung", 3],
    "praesentationsmarkup": ["Die Gestaltungsangaben in das Stilblatt verlagern. Im HTML bleibt, was der Inhalt ist.", "Gliederung", 1],
    "tabelle-ohne-kopf": ["Die erste Zeile in <code>&lt;th&gt;</code> setzen und mit <code>scope</code> versehen. Ohne Kopf ist eine Tabelle nur ein Raster.", "Bedienung", 2],
    "sprache-fehlt": ["<code>lang</code> am html-Element setzen, etwa <code>lang=\"de\"</code>. Davon hängen Vorlesestimme, Trennung und Anführungszeichen ab.", "Bedienung", 4],
    "zeichensatz-fehlt": ["<code>&lt;meta charset=\"utf-8\"&gt;</code> als erste Zeile im Kopfbereich.", "Darstellung", 4],
    "zeichensatz-spaet": ["Die charset-Angabe in die ersten 1024 Bytes ziehen, am besten direkt hinter <code>&lt;head&gt;</code>.", "Darstellung", 3],
    "ansichtsfeld-fehlt": ["<code>&lt;meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"&gt;</code> ergänzen.", "Darstellung", 4],
    "ansichtsfeld-sperrt-zoom": ["<code>user-scalable=no</code> und ein <code>maximum-scale</code> unter 5 entfernen. Vergrößern muss möglich bleiben.", "Bedienung", 3],
    "favicon-fehlt": ["Ein Symbol hinterlegen: <code>&lt;link rel=\"icon\" href=\"/favicon.svg\"&gt;</code>. Es erscheint im Reiter und im Lesezeichen.", "Darstellung", 1],
    "basis-adresse": ["<code>&lt;base&gt;</code> entfernen und die Verweise absolut oder wurzelbezogen schreiben. Die Wirkung von base wird regelmäßig übersehen.", "Verweise", 2],
    "gesperrt": ["Wenn die Seite gefunden werden soll: <code>noindex</code> entfernen. Wenn nicht: prüfen, ob sie überhaupt in der Sitemap steht.", "Indexierung", 5],
    "nofollow-seitenweit": ["Das seitenweite <code>nofollow</code> entfernen. Es unterbindet, dass von hier aus überhaupt etwas gefunden wird.", "Indexierung", 4],
    "weiterleitung-meta": ["Die Weiterleitung auf den Server verlagern, mit Statuscode 301. Eine Meta-Weiterleitung ist langsam und mehrdeutig.", "Indexierung", 4],
    "kanonisch-fehlt": ["<code>&lt;link rel=\"canonical\" href=\"…\"&gt;</code> mit der vollständigen, gewünschten Adresse setzen.", "Indexierung", 3],
    "kanonisch-mehrfach": ["Bis auf eine alle entfernen. Bei mehreren verwirft die Suchmaschine alle.", "Indexierung", 4],
    "kanonisch-relativ": ["Die Adresse absolut angeben, mit Schema und Host.", "Indexierung", 3],
    "kanonisch-mit-fragment": ["Das <code>#…</code> aus der kanonischen Adresse streichen. Der Teil hinter der Raute erreicht den Server nie.", "Indexierung", 2],
    "auszug-begrenzt": ["Wenn die Seite in der Trefferliste beschrieben werden soll: die Begrenzung des Auszugs lockern.", "Trefferliste", 2],
    "bild-ohne-alt": ["Jedem inhaltlichen Bild ein <code>alt</code> geben, das beschreibt was zu sehen ist. Rein schmückende Bilder bekommen <code>alt=\"\"</code>.", "Bedienung", 4],
    "bild-ohne-src": ["Die Quelle ergänzen oder das leere Bild entfernen.", "Darstellung", 3],
    "bild-ohne-masse": ["<code>width</code> und <code>height</code> setzen. Ohne sie springt das Layout, sobald das Bild eintrifft.", "Ladezeit", 3],
    "bild-alt-lang": ["Auf einen Satz kürzen. Was ausführlicher sein muss, gehört in eine Bildunterschrift.", "Bedienung", 1],
    "bild-alt-dateiname": ["Den Dateinamen durch eine Beschreibung ersetzen. „IMG_4021.jpg“ sagt niemandem etwas.", "Bedienung", 2],
    "bild-ohne-lazy": ["Bildern außerhalb des ersten Bildschirms <code>loading=\"lazy\"</code> geben.", "Ladezeit", 2],
    "video-ohne-untertitel": ["Eine Untertitelspur einbinden: <code>&lt;track kind=\"captions\" …&gt;</code>.", "Bedienung", 3],
    "svg-ohne-beschriftung": ["Der Grafik einen <code>&lt;title&gt;</code> oder ein <code>aria-label</code> geben; rein schmückende auf <code>aria-hidden=\"true\"</code> setzen.", "Bedienung", 2],
    "verweis-ohne-text": ["Dem Verweis Text geben oder ein <code>aria-label</code>. Ein Verweis, der nur ein Bild enthält, braucht dessen alt.", "Bedienung", 3],
    "verweis-unspezifisch": ["„hier“ und „mehr“ durch das Ziel ersetzen: „Anleitung zur Einrichtung“. Verweise werden aus dem Zusammenhang gerissen vorgelesen.", "Bedienung", 2],
    "verweis-leer": ["Verweise mit <code>href=\"#\"</code> zu Knöpfen machen, wenn sie nichts öffnen, sondern etwas auslösen.", "Bedienung", 2],
    "verweis-javascript": ["<code>javascript:</code> durch einen echten Verweis oder einen <code>&lt;button&gt;</code> ersetzen.", "Bedienung", 2],
    "fremdfenster-ohne-schutz": ["<code>rel=\"noopener\"</code> ergänzen. Ohne das kann die geöffnete Seite auf das Fenster zugreifen, aus dem sie kam.", "Sicherheit", 3],
    "verweis-nofollow-intern": ["Das <code>nofollow</code> von internen Verweisen entfernen. Innerhalb der eigenen Website ergibt es keinen Sinn.", "Indexierung", 2],
    "verweis-menge": ["Die Zahl der Verweise senken oder die Seite teilen. Über zweihundert Verweise verteilen ihr Gewicht auf nichts.", "Indexierung", 1],
    "verweis-gleicher-text": ["Gleichlautenden Verweisen mit verschiedenen Zielen unterscheidbare Texte oder <code>aria-label</code> geben.", "Bedienung", 2],
    "skript-blockierend": ["Den Skripten <code>defer</code> geben oder sie ans Ende des Körpers setzen. Im Kopf halten sie den Aufbau an.", "Ladezeit", 3],
    "stilblaetter-viele": ["Die Stilblätter zusammenlegen. Jede Datei ist eine eigene Wartezeit, bevor irgendetwas erscheint.", "Ladezeit", 2],
    "inline-stil-gross": ["Große <code>&lt;style&gt;</code>-Blöcke in eine Datei auslagern, die zwischengespeichert werden kann.", "Ladezeit", 1],
    "inline-stilattribute": ["Die <code>style</code>-Attribute in Klassen überführen. Sonst ist jede Änderung eine Suche über das ganze Dokument.", "Wartung", 1],
    "dom-gross": ["Die Verschachtelung abbauen oder die Seite teilen. Jedes Element kostet Speicher und Rechenzeit bei jeder Bewegung.", "Ladezeit", 2],
    "iframe-ohne-lazy": ["Eingebetteten Rahmen <code>loading=\"lazy\"</code> geben.", "Ladezeit", 2],
    "iframe-ohne-titel": ["Dem Rahmen ein <code>title</code> geben, das sagt was darin steckt.", "Bedienung", 2],
    "schriften-extern": ["Die Schriftdateien herunterladen und selbst ausliefern. Das spart eine fremde Verbindung und die Übermittlung der Adresse Ihrer Besucher.", "Datenschutz", 3],
    "gemischte-inhalte": ["Alle <code>http://</code>-Quellen auf <code>https://</code> umstellen. Der Browser blockiert sie sonst.", "Sicherheit", 4],
    "zaehldienste": ["Prüfen, ob eine Einwilligung vorliegt und der Dienst in der Datenschutzerklärung steht.", "Datenschutz", 2],
    "fremde-hosts": ["Die Liste durchgehen: was nicht gebraucht wird, entfernen; was bleibt, in die Datenschutzerklärung aufnehmen.", "Datenschutz", 1],
    "video-ohne-schutz": ["Auf die Variante ohne Verlaufsverfolgung umstellen, etwa <code>youtube-nocookie.com</code>, oder erst nach einem Klick laden.", "Datenschutz", 2],
    "og-fehlt": ["<code>og:title</code>, <code>og:description</code> und <code>og:image</code> ergänzen. Ohne sie sucht sich das Netzwerk selbst etwas aus.", "Geteilte Verweise", 2],
    "og-bild-relativ": ["Die Bildadresse absolut angeben. Netzwerke lösen relative Adressen nicht auf.", "Geteilte Verweise", 2],
    "twitter-karte-fehlt": ["<code>&lt;meta name=\"twitter:card\" content=\"summary_large_image\"&gt;</code> ergänzen.", "Geteilte Verweise", 1],
    "auszeichnung-fehlt": ["Einen JSON-LD-Block einsetzen, der beschreibt worum es geht: Artikel, Produkt, Veranstaltung, Unternehmen.", "Trefferliste", 2],
    "auszeichnung-kaputt": ["Den JSON-Block reparieren. Ein einziges Komma zu viel macht alles darin unbrauchbar.", "Trefferliste", 4],
    "auszeichnung-ohne-typ": ["<code>@type</code> ergänzen. Ohne Typ ist der Block ein Sack ohne Aufschrift.", "Trefferliste", 3],
    "hreflang-format": ["Auf den Zweibuchstabencode umstellen, gegebenenfalls mit Land: <code>de</code>, <code>de-AT</code>, <code>x-default</code>.", "Mehrsprachigkeit", 3],
    "hreflang-doppelt": ["Je Sprachangabe nur eine Adresse. Bei mehreren wird die ganze Gruppe verworfen.", "Mehrsprachigkeit", 3],
    "hreflang-ohne-standard": ["Ein <code>x-default</code> ergänzen für alle, deren Sprache nicht dabei ist.", "Mehrsprachigkeit", 2],
    "feld-ohne-beschriftung": ["Jedem Feld ein <code>&lt;label for=\"…\"&gt;</code> geben. Ein Platzhalter ist keine Beschriftung — er verschwindet beim Tippen.", "Bedienung", 3],
    "knopf-ohne-text": ["Dem Knopf Text geben oder ein <code>aria-label</code>. Ein Symbol allein wird als „Schaltfläche“ vorgelesen.", "Bedienung", 3],
    "tabindex-positiv": ["Auf <code>tabindex=\"0\"</code> zurücknehmen und die Reihenfolge über die Anordnung im Dokument regeln.", "Bedienung", 2],
    "autofocus": ["<code>autofocus</code> entfernen, außer auf einer Seite, die nur aus diesem einen Feld besteht.", "Bedienung", 1],
    "versteckt-aber-erreichbar": ["Verstecktes zusätzlich aus der Tabreihenfolge nehmen, etwa mit <code>inert</code> oder <code>display: none</code>.", "Bedienung", 2],
    "wenig-text": ["Ausbauen, bis die Seite die Frage beantwortet, für die jemand käme. Eine Seite mit hundert Wörtern beantwortet selten etwas.", "Auffindbarkeit", 3],
    "inhalt-nur-per-skript": ["Den Inhalt auf dem Server erzeugen oder vorrendern. Was erst ein Skript einträgt, sehen viele Leser nie.", "Auffindbarkeit", 4],
    "zusammenfassung-fehlt": ["Einen ersten Absatz voranstellen, der die Frage der Seite in zwei Sätzen beantwortet.", "KI-Antworten", 2],
    "frage-ohne-antwort": ["Direkt unter die Frage einen Absatz setzen, der sie beantwortet, ohne Umweg.", "KI-Antworten", 2],
    "absatz-zu-lang": ["Nach etwa 120 Wörtern umbrechen. Antwortmaschinen zitieren Absätze; überlange sind nicht zitierbar.", "KI-Antworten", 1],
    "keine-aufzaehlungen": ["Aufzählbares in <code>&lt;ul&gt;</code> oder <code>&lt;ol&gt;</code> setzen. Listen werden häufiger übernommen als Fließtext.", "KI-Antworten", 1],
    "ueberschrift-ohne-sprungmarke": ["Den Überschriften <code>id</code>-Kennungen geben. Dann lässt sich auf einen Abschnitt verweisen statt auf die ganze Seite.", "KI-Antworten", 1],
    "datum-fehlt": ["Ein sichtbares Datum setzen und es mit <code>&lt;time datetime=\"…\"&gt;</code> auszeichnen.", "KI-Antworten", 2],
    "herausgeber-fehlt": ["Ein <code>Organization</code>-Objekt im JSON-LD ergänzen und im Impressum darauf verweisen.", "KI-Antworten", 2],
    "autor-fehlt": ["Verfasser nennen, sichtbar und im JSON-LD als <code>author</code>.", "KI-Antworten", 2],
    "artikel-nicht-ausgezeichnet": ["Den Beitrag als <code>Article</code> oder <code>BlogPosting</code> auszeichnen, mit Datum und Verfasser.", "KI-Antworten", 2],
    "bild-ohne-bildunterschrift": ["Abbildungen eine <code>&lt;figcaption&gt;</code> geben. Sie wird häufiger gelesen als der umgebende Text.", "KI-Antworten", 1],
    "tabelle-ohne-beschriftung": ["Der Tabelle eine <code>&lt;caption&gt;</code> geben, die sagt wovon die Zahlen handeln.", "KI-Antworten", 1],
    "ki-ausgeschlossen": ["Nichts, wenn das gewollt ist. Wenn nicht: <code>noai</code> entfernen.", "KI-Antworten", 1],
    "adresse-fehlt": ["Eine kanonische Adresse setzen. Sie ist auch die Grundlage für die übrigen Adressprüfungen.", "Indexierung", 1],
    "adresse-lang": ["Den Pfad kürzen: Füllwörter raus, Ebenen zusammenlegen. Die Adresse soll vorlesbar bleiben.", "Trefferliste", 1],
    "adresse-parameter": ["Die Parameter in einen sprechenden Pfad überführen oder überzählige per canonical zusammenführen.", "Indexierung", 2],
    "adresse-versalien": ["Auf Kleinschreibung umstellen und die alte Form dauerhaft dorthin umleiten.", "Indexierung", 2],
    "adresse-unterstrich": ["Auf Bindestriche umstellen, alte Adressen mit 301 umleiten.", "Auffindbarkeit", 1],
    "adresse-sitzung": ["Die Sitzung über ein Cookie führen statt über die Adresse.", "Indexierung", 4],
    "adresse-tief": ["Die Gliederung flacher schneiden. Drei Ebenen reichen für die meisten Websites.", "Auffindbarkeit", 1],
    "adresse-dateiendung": ["Die Endung aus der Adresse nehmen und serverseitig auflösen.", "Wartung", 1],
    "adresse-sonderzeichen": ["Umlaute und Sonderzeichen im Pfad umschreiben: „ue“ statt „ü“, Bindestrich statt Leerzeichen.", "Trefferliste", 1],
    "doctype-fehlt": ["<code>&lt;!doctype html&gt;</code> als allererste Zeile setzen, vor jeder Leerzeile und jedem Kommentar.", "Darstellung", 4],
    "formular-unverschluesselt": ["Das Ziel auf <code>https://</code> umstellen. Solange das nicht geht, das Formular abschalten.", "Sicherheit", 5],
    "passwort-ungeschuetzt": ["Sofort auf https umstellen. Ein Passwort über http ist mitlesbar.", "Sicherheit", 5],
    "skript-ohne-integritaet": ["<code>integrity</code> und <code>crossorigin</code> ergänzen — oder das Skript selbst ausliefern.", "Sicherheit", 2],
    "verweisrichtlinie-fehlt": ["<code>&lt;meta name=\"referrer\" content=\"strict-origin-when-cross-origin\"&gt;</code> setzen.", "Datenschutz", 1],
    "sicherheitsrichtlinie-fehlt": ["Prüfen, ob der Server eine Richtlinie sendet; wenn nicht, eine einrichten.", "Sicherheit", 1],
    "veraltete-elemente": ["Durch heutige Elemente ersetzen und die Gestaltung ins Stilblatt verlagern.", "Wartung", 1],
    "kompatibilitaetsmodus": ["Die Zeile ersatzlos entfernen.", "Wartung", 1],
    "sprungmarke-fehlt": ["Als ersten Verweis im Körper einen Sprung zum Inhalt setzen, sichtbar sobald er den Fokus hat.", "Bedienung", 2],
    "aria-versteckt-fokussierbar": ["Entweder das Verstecken aufheben oder das Bedienbare zusätzlich aus der Tabreihenfolge nehmen.", "Bedienung", 3],
    "aria-verweist-ins-leere": ["Die Kennung berichtigen oder das Element ergänzen, auf das verwiesen wird.", "Bedienung", 3],
    "rolle-unbekannt": ["Den Wert gegen das Verzeichnis prüfen — oder die Rolle streichen und das passende Element benutzen.", "Bedienung", 2],
    "landmarke-ohne-namen": ["Jedem Bereich ein <code>aria-label</code> geben: „Hauptmenü“, „Fußnavigation“.", "Bedienung", 2],
    "kontrast-inline": ["Die Farben so wählen, dass mindestens 4,5:1 herauskommt. Bei großer Schrift genügen 3:1.", "Bedienung", 3],
    "bild-alt-redundant": ["Die Gattungsbezeichnung streichen und direkt beschreiben, was zu sehen ist.", "Bedienung", 1],
    "ueberschrift-als-stil": ["In eine echte Überschrift der passenden Ebene umwandeln.", "Gliederung", 2],
    "listenelement-ohne-liste": ["Die Einträge in <code>&lt;ul&gt;</code> oder <code>&lt;ol&gt;</code> fassen.", "Bedienung", 2],
    "abkuerzung-ohne-erklaerung": ["<code>title</code> mit der ausgeschriebenen Form ergänzen, oder die Abkürzung beim ersten Mal ausschreiben.", "Bedienung", 1],
    "ld-bild-fehlt": ["<code>image</code> mit einer absoluten Adresse ergänzen, möglichst in mehreren Seitenverhältnissen.", "Trefferliste", 2],
    "ld-preis-ohne-waehrung": ["<code>priceCurrency</code> ergänzen, etwa <code>\"EUR\"</code>.", "Trefferliste", 3],
    "ld-bewertung-unvollstaendig": ["<code>ratingCount</code> ergänzen — die tatsächliche Zahl, nicht eine geschätzte.", "Trefferliste", 3],
    "ld-brotkrumen-fehlt": ["Eine <code>BreadcrumbList</code> ergänzen, die dem sichtbaren Pfad entspricht.", "Trefferliste", 1],
    "ld-herausgeber-fehlt": ["Ein <code>Organization</code>- oder <code>WebSite</code>-Objekt ergänzen, einmal für die ganze Website.", "Trefferliste", 2],
    "ld-titel-weicht-ab": ["Die headline an den Titel angleichen, oder umgekehrt. Beide sollen dieselbe Seite meinen.", "Trefferliste", 1],
    "mikrodaten-gemischt": ["Auf eine Form festlegen; JSON-LD ist die, die sich leichter pflegen lässt.", "Wartung", 1],
    "zeitstempel-widerspruch": ["Die Daten berichtigen. Meist steht ein festes Datum in der Vorlage.", "KI-Antworten", 2],
    "vorrangbild-lazy": ["Beim ersten Bild <code>loading=\"lazy\"</code> entfernen und stattdessen <code>fetchpriority=\"high\"</code> setzen.", "Ladezeit", 4],
    "bild-ohne-srcset": ["<code>srcset</code> mit mehreren Breiten und <code>sizes</code> ergänzen.", "Ladezeit", 2],
    "schrift-ohne-vorabladen": ["Die wichtigste Schriftdatei per <code>&lt;link rel=\"preload\" as=\"font\" crossorigin&gt;</code> ankündigen.", "Ladezeit", 2],
    "schrift-ohne-anzeige": ["<code>font-display: swap</code> in jeden @font-face-Block setzen.", "Ladezeit", 2],
    "stil-import": ["Den @import durch ein zweites <code>&lt;link&gt;</code> im Kopfbereich ersetzen.", "Ladezeit", 2],
    "dokument-gross": ["Nachrangiges nachladen, Kommentare und tote Vorlagen entfernen.", "Ladezeit", 2],
    "bild-menge": ["Die Seite teilen oder die Bilder erst beim Heranrollen laden.", "Ladezeit", 1],
    "verweis-toter-anker": ["Die Kennung am Ziel ergänzen oder den Verweis berichtigen.", "Bedienung", 3],
    "verweis-http": ["Auf <code>https://</code> umstellen. Wenn das Ziel kein https kann, den Verweis überdenken.", "Sicherheit", 3],
    "verweis-auf-sich-selbst": ["Den Verweis entfernen oder als reinen Text ausgeben — im Menü kennzeichnet <code>aria-current=\"page\"</code> die aktuelle Seite.", "Bedienung", 1],
    "verweis-titel-doppelt": ["Das <code>title</code> entfernen oder mit etwas füllen, das der Text nicht schon sagt.", "Bedienung", 1],
    "verweis-wenig-intern": ["Auf verwandte Seiten verweisen. Eine Seite ohne Anschluss wird selten gefunden.", "Auffindbarkeit", 2],
    "verweis-adresse-im-text": ["Den Text durch den Titel des Ziels ersetzen.", "Bedienung", 1],
    "indexierung-widerspruch": ["Entscheiden: soll die Seite in den Index, dann noindex entfernen; wenn nicht, das canonical.", "Indexierung", 3],
    "kanonisch-widerspricht-og": ["Beide auf dieselbe Adresse setzen.", "Indexierung", 2],
    "weiterleitung-per-skript": ["Die Weiterleitung auf den Server verlagern, mit Statuscode 301.", "Indexierung", 2],
    "sitemap-nicht-verwiesen": ["<code>&lt;link rel=\"sitemap\" type=\"application/xml\" href=\"/sitemap.xml\"&gt;</code> ergänzen.", "Indexierung", 1],
    "platzhaltertext": ["Die Reste ersetzen. Platzhalter auf einer veröffentlichten Seite kosten mehr Vertrauen als sie an Zeit sparen.", "Vertrauen", 4],
    "text-code-anteil": ["Das Gerüst abbauen oder den Text ausbauen. Meist stammt der Überhang aus einem Baukasten.", "Ladezeit", 1],
    "satz-zu-lang": ["Lange Sätze teilen. Ein Gedanke je Satz.", "Verständlichkeit", 1],
    "schwer-lesbar": ["Kürzere Sätze, kürzere Wörter, weniger Schachtelung. Fachbegriffe beim ersten Mal erklären.", "Verständlichkeit", 1],
    "stichwort-gestopft": ["Wiederholungen durch Umschreibungen ersetzen. Häufigkeit war nie ein Rangfaktor.", "Trefferliste", 2],
    "titel-ohne-bezug-h1": ["Titel und Überschrift auf dasselbe Thema bringen.", "Trefferliste", 2],
    "beschreibung-ohne-bezug": ["Die Beschreibung aus dem tatsächlichen Text heraus schreiben.", "Trefferliste", 2],
    "absatz-doppelt": ["Die Wiederholung entfernen oder den Baustein nur einmal einbinden.", "Wartung", 1],
    "ueberschrift-doppelt": ["Die Überschriften unterscheidbar machen. Gleichlautende Einträge sind im Verzeichnis nutzlos.", "Gliederung", 1],
    "ueberschrift-sehr-viele": ["Prüfen, ob Überschriften als Gestaltungsmittel benutzt werden — oder die Seite teilen.", "Gliederung", 1],
    "abschnitt-ohne-ueberschrift": ["Eine Überschrift ergänzen oder <code>&lt;section&gt;</code> durch <code>&lt;div&gt;</code> ersetzen.", "Gliederung", 1],
    "artikel-ohne-ueberschrift": ["Dem Artikel eine Überschrift geben; er soll für sich allein stehen können.", "Gliederung", 2],
    "feld-ohne-namen": ["<code>name</code> ergänzen. Ohne name kommt der Inhalt des Feldes nirgends an.", "Bedienung", 3],
    "feld-ohne-autofuellhinweis": ["<code>autocomplete</code> setzen, etwa <code>given-name</code>, <code>email</code>, <code>postal-code</code>.", "Bedienung", 2],
    "formular-ohne-absenden": ["Einen <code>&lt;button type=\"submit\"&gt;</code> ergänzen.", "Bedienung", 3],
    "pflichtfeld-nicht-erkennbar": ["<code>required</code> am Feld setzen und im Text erklären, wofür das Sternchen steht.", "Bedienung", 2]
  };

  var REGELN = [

    /* ============ Titel und Beschreibung ============ */
    {
      id: "titel-fehlt", gruppe: "Titel und Beschreibung", name: "Titel fehlt", stufe: "kritisch", braucht: false,
      wozu: "Es gibt kein <code>title</code>-Element oder es ist leer. Dann erfindet die Suchmaschine selbst einen Titel aus dem Seiteninhalt.",
      pruefe: function (d) {
        var t = seitentitel(d);
        if (t.length === 0 || !t[0].textContent.trim()) return { wie: "Ohne title-Element hat die Suchmaschine keinen Aufhänger und bildet sich selbst einen." };
        return null;
      }
    },
    {
      id: "titel-mehrfach", gruppe: "Titel und Beschreibung", name: "Mehrere Titel", stufe: "kritisch", braucht: false,
      wozu: "Mehr als ein <code>title</code>-Element. Nur das erste wird gelesen, der Rest führt beim Pflegen in die Irre.",
      pruefe: function (d) {
        var t = seitentitel(d);
        if (t.length > 1) return { wie: t.length + " title-Elemente gefunden.", fund: liste(t.map(function (x) { return kurz(x.textContent, 60); })) };
        return null;
      }
    },
    {
      id: "titel-breit", gruppe: "Titel und Beschreibung", name: "Titel wird abgeschnitten", stufe: "wichtig", braucht: false,
      wozu: "Der Titel ist breiter als " + GRENZE_TITEL + " px, gemessen in 20 px Arial. Gezählt werden Pixel, nicht Zeichen, weil ein „i“ ein Drittel eines „W“ braucht.",
      pruefe: function (d) {
        var t = seitentitel(d)[0];
        if (!t) return null;
        var wert = t.textContent.trim();
        var b = px(wert, "20px Arial, sans-serif");
        if (b > GRENZE_TITEL) return { wie: "Der Titel ist " + b + " px breit. Ab etwa " + GRENZE_TITEL + " px schneidet die Trefferliste ab.", fund: wert };
        return null;
      }
    },
    {
      id: "titel-kurz", gruppe: "Titel und Beschreibung", name: "Titel sehr kurz", stufe: "hinweis", braucht: false,
      wozu: "Weniger als 30 Zeichen. Der Platz in der Trefferliste bleibt ungenutzt.",
      pruefe: function (d) {
        var t = seitentitel(d)[0];
        if (!t) return null;
        var wert = t.textContent.trim();
        if (wert && wert.length < 30) return { wie: "Nur " + wert.length + " Zeichen.", fund: wert };
        return null;
      }
    },
    {
      id: "titel-wiederholung", gruppe: "Titel und Beschreibung", name: "Wort im Titel mehrfach", stufe: "hinweis", braucht: false,
      wozu: "Ein Wort mit mehr als drei Buchstaben kommt im Titel dreimal oder öfter vor. Das liest sich nach Stichwortstopfen.",
      pruefe: function (d) {
        var t = seitentitel(d)[0];
        if (!t) return null;
        var zaehler = {}, treffer = [];
        t.textContent.toLowerCase().split(/[^a-zäöüß0-9]+/).forEach(function (w) {
          if (w.length > 3) { zaehler[w] = (zaehler[w] || 0) + 1; if (zaehler[w] === 3) treffer.push(w); }
        });
        if (treffer.length) return { wie: "Mehrfach im Titel: " + treffer.join(", "), fund: t.textContent.trim() };
        return null;
      }
    },
    {
      id: "beschreibung-fehlt", gruppe: "Titel und Beschreibung", name: "Beschreibung fehlt", stufe: "wichtig", braucht: false,
      wozu: "Kein <code>meta name=\"description\"</code> oder leerer Inhalt. Die Suchmaschine schneidet dann selbst einen Satz aus der Seite.",
      pruefe: function (d) {
        var m = d.querySelector('meta[name="description" i]');
        if (!m || !inhalt(m)) return { wie: "Ohne eigene Beschreibung entscheidet die Suchmaschine, welcher Satz unter dem Titel steht." };
        return null;
      }
    },
    {
      id: "beschreibung-mehrfach", gruppe: "Titel und Beschreibung", name: "Mehrere Beschreibungen", stufe: "wichtig", braucht: false,
      wozu: "Mehr als eine <code>description</code>-Angabe. Welche gewinnt, ist nicht verlässlich.",
      pruefe: function (d) {
        var m = alle(d, 'meta[name="description" i]');
        if (m.length > 1) return { wie: m.length + " description-Angaben gefunden.", fund: liste(m.map(function (x) { return kurz(inhalt(x), 70); })) };
        return null;
      }
    },
    {
      id: "beschreibung-breit", gruppe: "Titel und Beschreibung", name: "Beschreibung wird abgeschnitten", stufe: "hinweis", braucht: false,
      wozu: "Breiter als " + GRENZE_TEXT + " px in 14 px Arial, das sind etwa zwei Zeilen in der Trefferliste.",
      pruefe: function (d) {
        var m = d.querySelector('meta[name="description" i]');
        if (!m) return null;
        var wert = inhalt(m);
        var b = px(wert, "14px Arial, sans-serif");
        if (b > GRENZE_TEXT) return { wie: "Die Beschreibung ist " + b + " px breit.", fund: kurz(wert, 180) };
        return null;
      }
    },
    {
      id: "beschreibung-kurz", gruppe: "Titel und Beschreibung", name: "Beschreibung sehr kurz", stufe: "hinweis", braucht: false,
      wozu: "Unter 50 Zeichen. Zu wenig, um jemanden zum Klicken zu bewegen.",
      pruefe: function (d) {
        var m = d.querySelector('meta[name="description" i]');
        if (!m) return null;
        var wert = inhalt(m);
        if (wert && wert.length < 50) return { wie: "Nur " + wert.length + " Zeichen.", fund: wert };
        return null;
      }
    },

    /* ============ Gliederung und Semantik ============ */
    {
      id: "h1-fehlt", gruppe: "Gliederung und Semantik", name: "Keine H1", stufe: "kritisch", braucht: false,
      wozu: "Kein <code>h1</code>-Element. Die Seite sagt nirgends in einer Hauptüberschrift, worum es geht.",
      pruefe: function (d) {
        if (d.querySelectorAll("h1").length === 0) return { wie: "Die Seite hat keine Hauptüberschrift." };
        return null;
      }
    },
    {
      id: "h1-mehrfach", gruppe: "Gliederung und Semantik", name: "Mehrere H1", stufe: "wichtig", braucht: false,
      wozu: "Mehr als eine Hauptüberschrift. Eine Seite hat ein Thema.",
      pruefe: function (d) {
        var h = alle(d, "h1");
        if (h.length > 1) return { wie: h.length + " H1-Überschriften.", fund: liste(h.map(function (x) { return kurz(x.textContent, 60); })) };
        return null;
      }
    },
    {
      id: "h1-lang", gruppe: "Gliederung und Semantik", name: "H1 sehr lang", stufe: "hinweis", braucht: false,
      wozu: "Über 70 Zeichen. Eine Hauptüberschrift soll in einem Blick erfassbar sein.",
      pruefe: function (d) {
        var h = d.querySelector("h1");
        if (h && h.textContent.trim().length > 70) return { wie: h.textContent.trim().length + " Zeichen.", fund: kurz(h.textContent, 110) };
        return null;
      }
    },
    {
      id: "ueberschrift-sprung", gruppe: "Gliederung und Semantik", name: "Überschriftenebene übersprungen", stufe: "hinweis", braucht: false,
      wozu: "Die Ebenen laufen nicht der Reihe nach, etwa H2 direkt gefolgt von H4. Vorlesewerkzeuge verlieren dabei den Faden.",
      pruefe: function (d) {
        var vorher = 0, spruenge = [];
        alle(d, "h1, h2, h3, h4, h5, h6").forEach(function (h) {
          var s = parseInt(h.tagName.slice(1), 10);
          if (vorher && s > vorher + 1) spruenge.push("H" + vorher + " → H" + s + ": " + kurz(h.textContent, 50));
          vorher = s;
        });
        if (spruenge.length) return { wie: spruenge.length + " Sprung/Sprünge in der Gliederung.", fund: liste(spruenge) };
        return null;
      }
    },
    {
      id: "ueberschrift-leer", gruppe: "Gliederung und Semantik", name: "Leere Überschrift", stufe: "hinweis", braucht: false,
      wozu: "Eine Überschrift ohne Text und ohne beschriftetes Bild. Meist ein Rest aus dem Baukasten.",
      pruefe: function (d) {
        var leer = alle(d, "h1, h2, h3, h4, h5, h6").filter(function (h) {
          return !h.textContent.trim() && !h.querySelector("img[alt]");
        });
        if (leer.length) return { wie: leer.length + " Überschrift(en) ohne Text." };
        return null;
      }
    },
    {
      id: "main-fehlt", gruppe: "Gliederung und Semantik", name: "Kein main-Bereich", stufe: "hinweis", braucht: true,
      wozu: "Kein <code>main</code>-Element. Vorlesewerkzeuge können dann nicht direkt zum Hauptinhalt springen.",
      pruefe: function (d) {
        if (!d.querySelector("main, [role='main']")) return { wie: "Es gibt keinen ausgezeichneten Hauptinhalt." };
        return null;
      }
    },
    {
      id: "main-mehrfach", gruppe: "Gliederung und Semantik", name: "Mehrere main-Bereiche", stufe: "hinweis", braucht: false,
      wozu: "Mehr als ein <code>main</code>-Element. Genau eines soll den Hauptinhalt umschließen.",
      pruefe: function (d) {
        var m = d.querySelectorAll("main");
        if (m.length > 1) return { wie: m.length + " main-Elemente." };
        return null;
      }
    },
    {
      id: "doppelte-id", gruppe: "Gliederung und Semantik", name: "Doppelte id-Werte", stufe: "wichtig", braucht: false,
      wozu: "Derselbe <code>id</code>-Wert kommt mehrfach vor. Sprungmarken, Beschriftungen und Skripte greifen dann auf das falsche Element.",
      pruefe: function (d) {
        var gesehen = {}, doppelt = [];
        alle(d, "[id]").forEach(function (el) {
          var i = el.getAttribute("id");
          if (gesehen[i]) { if (doppelt.indexOf(i) === -1) doppelt.push(i); }
          gesehen[i] = true;
        });
        if (doppelt.length) return { wie: doppelt.length + " id-Wert(e) mehrfach vergeben.", fund: liste(doppelt) };
        return null;
      }
    },
    {
      id: "praesentationsmarkup", gruppe: "Gliederung und Semantik", name: "Veraltete Auszeichnung", stufe: "hinweis", braucht: false,
      wozu: "<code>font</code>, <code>center</code>, <code>b</code> oder <code>i</code> beschreiben Aussehen statt Bedeutung. Für Betonung gehören <code>strong</code> und <code>em</code> hin.",
      pruefe: function (d) {
        var gefunden = [];
        ["font", "center", "marquee", "b", "i"].forEach(function (tag) {
          var n = d.querySelectorAll(tag).length;
          if (n) gefunden.push("<" + tag + "> " + n + "x");
        });
        if (gefunden.length) return { wie: "Gefunden: " + gefunden.join(", ") };
        return null;
      }
    },
    {
      id: "tabelle-ohne-kopf", gruppe: "Gliederung und Semantik", name: "Tabelle ohne Kopfzellen", stufe: "hinweis", braucht: false,
      wozu: "Eine Datentabelle ohne <code>th</code>. Vorlesewerkzeuge können die Zellen dann keiner Spalte zuordnen.",
      pruefe: function (d) {
        var ohne = alle(d, "table").filter(function (t) { return !t.querySelector("th"); });
        if (ohne.length) return { wie: ohne.length + " Tabelle(n) ohne Kopfzellen." };
        return null;
      }
    },

    /* ============ Dokument und Kopfbereich ============ */
    {
      id: "sprache-fehlt", gruppe: "Dokument und Kopfbereich", name: "Sprache nicht angegeben", stufe: "wichtig", braucht: true,
      wozu: "Dem <code>html</code>-Element fehlt <code>lang</code>, oder der Wert ist kein Sprachkürzel. Vorlesewerkzeuge raten dann die Aussprache.",
      pruefe: function (d) {
        var lang = d.documentElement.getAttribute("lang");
        if (!lang) return { wie: "Kein lang-Attribut am html-Element." };
        if (!/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(lang)) return { wie: "Die Sprachangabe folgt keinem Sprachkürzel.", fund: 'lang="' + lang + '"' };
        return null;
      }
    },
    {
      id: "zeichensatz-fehlt", gruppe: "Dokument und Kopfbereich", name: "Zeichensatz nicht angegeben", stufe: "wichtig", braucht: true,
      wozu: "Weder <code>meta charset</code> noch die entsprechende <code>http-equiv</code>-Angabe. Umlaute werden dann gern zu Fragezeichen.",
      pruefe: function (d) {
        if (!d.querySelector("meta[charset], meta[http-equiv='Content-Type' i]")) return { wie: "Der Browser muss den Zeichensatz raten." };
        return null;
      }
    },
    {
      id: "zeichensatz-spaet", gruppe: "Dokument und Kopfbereich", name: "Zeichensatz zu spät angegeben", stufe: "hinweis", braucht: true,
      wozu: "Die Angabe steht nicht in den ersten 1024 Zeichen des Dokuments. Der Browser hat dann schon angefangen zu raten.",
      pruefe: function (d, roh) {
        if (!roh) return null;
        var stelle = roh.search(/<meta[^>]+charset/i);
        if (stelle > 1024) return { wie: "Die charset-Angabe steht erst an Zeichen " + stelle + "." };
        return null;
      }
    },
    {
      id: "ansichtsfeld-fehlt", gruppe: "Dokument und Kopfbereich", name: "Kein viewport für Mobilgeräte", stufe: "wichtig", braucht: true,
      wozu: "Kein <code>meta name=\"viewport\"</code>. Das Telefon zeigt die Seite dann in Schreibtischbreite und zoomt heraus.",
      pruefe: function (d) {
        if (!d.querySelector('meta[name="viewport" i]')) return { wie: "Ohne viewport-Angabe ist die Seite auf dem Telefon unlesbar klein." };
        return null;
      }
    },
    {
      id: "ansichtsfeld-sperrt-zoom", gruppe: "Dokument und Kopfbereich", name: "Zoom gesperrt", stufe: "wichtig", braucht: true,
      wozu: "Die viewport-Angabe enthält <code>user-scalable=no</code> oder ein zu kleines <code>maximum-scale</code>. Wer schlecht sieht, kann die Seite dann nicht vergrößern.",
      pruefe: function (d) {
        var v = inhalt(d.querySelector('meta[name="viewport" i]')).toLowerCase();
        if (!v) return null;
        var maxScale = (v.match(/maximum-scale\s*=\s*([\d.]+)/) || [])[1];
        if (/user-scalable\s*=\s*(no|0)/.test(v) || (maxScale && parseFloat(maxScale) < 2)) {
          return { wie: "Die Seite verbietet oder begrenzt das Vergrößern.", fund: v };
        }
        return null;
      }
    },
    {
      id: "favicon-fehlt", gruppe: "Dokument und Kopfbereich", name: "Kein Symbol für den Reiter", stufe: "hinweis", braucht: true,
      wozu: "Kein <code>link rel=\"icon\"</code>. In einer Reihe offener Reiter ist die Seite nicht wiederzufinden.",
      pruefe: function (d) {
        if (!d.querySelector('link[rel~="icon" i], link[rel="shortcut icon" i], link[rel="apple-touch-icon" i]')) return { wie: "Kein Symbol angegeben." };
        return null;
      }
    },
    {
      id: "basis-adresse", gruppe: "Dokument und Kopfbereich", name: "base-Element gesetzt", stufe: "hinweis", braucht: true,
      wozu: "Ein <code>base href</code> verschiebt die Auflösung aller relativen Adressen. Das wirkt unsichtbar auf jeden Verweis und jedes Bild der Seite.",
      pruefe: function (d) {
        var b = d.querySelector("base[href]");
        if (b) return { wie: "Alle relativen Adressen dieser Seite werden dagegen aufgelöst.", fund: b.outerHTML };
        return null;
      }
    },

    /* ============ Indexierung ============ */
    {
      id: "gesperrt", gruppe: "Indexierung", name: "Für Suchmaschinen gesperrt", stufe: "kritisch", braucht: false,
      wozu: "<code>noindex</code> in der robots- oder googlebot-Angabe. Wenn das gewollt ist, ist alles in Ordnung. Wenn nicht, erklärt es fehlende Rankings.",
      pruefe: function (d) {
        var m = alle(d, 'meta[name="robots" i], meta[name="googlebot" i]').filter(function (x) { return /noindex/i.test(inhalt(x)); });
        if (m.length) return { wie: "Diese Seite darf nicht in den Index.", fund: m[0].outerHTML };
        return null;
      }
    },
    {
      id: "nofollow-seitenweit", gruppe: "Indexierung", name: "Alle Verweise auf nofollow", stufe: "hinweis", braucht: false,
      wozu: "<code>nofollow</code> in der robots-Angabe gilt für jeden Verweis der Seite, auch für die eigenen.",
      pruefe: function (d) {
        if (/nofollow/.test(robotsAngabe(d))) return { wie: "Die Seite gibt an keinen einzigen Verweis Gewicht weiter." };
        return null;
      }
    },
    {
      id: "weiterleitung-meta", gruppe: "Indexierung", name: "Weiterleitung per meta refresh", stufe: "wichtig", braucht: false,
      wozu: "<code>meta http-equiv=\"refresh\"</code> statt einer richtigen Weiterleitung im Server. Suchmaschinen behandeln das unzuverlässig, und der Zurück-Knopf wird unbrauchbar.",
      pruefe: function (d) {
        var m = d.querySelector('meta[http-equiv="refresh" i]');
        if (m) return { wie: "Weiterleitung im Dokument statt im Server.", fund: m.outerHTML };
        return null;
      }
    },
    {
      id: "kanonisch-fehlt", gruppe: "Indexierung", name: "Keine kanonische Adresse", stufe: "hinweis", braucht: false,
      wozu: "Kein <code>canonical</code> gesetzt. Bei doppelten Inhalten entscheidet die Suchmaschine selbst, welche Adresse gewinnt. Auf einer Seite mit <code>noindex</code> greift die Regel nicht — was nicht in den Index soll, braucht keinen Vorzug.",
      pruefe: function (d) {
        if (robotsAngabe(d).indexOf("noindex") !== -1) return null;
        if (!d.querySelector('link[rel="canonical" i]')) return { wie: "Keine bevorzugte Adresse angegeben." };
        return null;
      }
    },
    {
      id: "kanonisch-mehrfach", gruppe: "Indexierung", name: "Mehrere kanonische Adressen", stufe: "kritisch", braucht: false,
      wozu: "Mehr als ein <code>link rel=\"canonical\"</code>. Bei Widerspruch werden alle ignoriert.",
      pruefe: function (d) {
        var l = alle(d, 'link[rel="canonical" i]');
        if (l.length > 1) return { wie: l.length + " canonical-Angaben.", fund: liste(l.map(function (x) { return x.getAttribute("href"); })) };
        return null;
      }
    },
    {
      id: "kanonisch-relativ", gruppe: "Indexierung", name: "Kanonische Adresse ist relativ", stufe: "hinweis", braucht: false,
      wozu: "Der Wert beginnt nicht mit <code>http</code>. Eine kanonische Adresse sollte vollständig sein, mit Schema und Domain.",
      pruefe: function (d) {
        var l = d.querySelector('link[rel="canonical" i]');
        if (!l) return null;
        var href = (l.getAttribute("href") || "").trim();
        if (href && !/^https?:\/\//i.test(href)) return { wie: "Unvollständige Adresse.", fund: href };
        return null;
      }
    },
    {
      id: "kanonisch-mit-fragment", gruppe: "Indexierung", name: "Kanonische Adresse mit Sprungmarke", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>#</code> in der kanonischen Adresse. Suchmaschinen schneiden den Teil ab, die Angabe zeigt also woandershin als gedacht.",
      pruefe: function (d) {
        var l = d.querySelector('link[rel="canonical" i]');
        if (!l) return null;
        var href = (l.getAttribute("href") || "");
        if (href.indexOf("#") !== -1) return { wie: "Sprungmarke in der kanonischen Adresse.", fund: href };
        return null;
      }
    },
    {
      id: "auszug-begrenzt", gruppe: "Indexierung", name: "Auszug in der Trefferliste begrenzt", stufe: "hinweis", braucht: false,
      wozu: "<code>nosnippet</code>, <code>noarchive</code> oder ein enges <code>max-snippet</code> schränken ein, was in der Trefferliste gezeigt werden darf.",
      pruefe: function (d) {
        var a = robotsAngabe(d);
        var treffer = ["nosnippet", "noarchive", "noimageindex", "max-snippet"].filter(function (w) { return a.indexOf(w) !== -1; });
        if (treffer.length) return { wie: "Gesetzt: " + treffer.join(", ") + ". Falls beabsichtigt, ist das in Ordnung." };
        return null;
      }
    },

    /* ============ Bilder und Medien ============ */
    {
      id: "bild-ohne-alt", gruppe: "Bilder und Medien", name: "Bilder ohne Alternativtext", stufe: "wichtig", braucht: false,
      wozu: "Ein <code>img</code> ohne <code>alt</code>-Attribut. Für rein schmückende Bilder gehört <code>alt=\"\"</code> hin, sonst eine Beschreibung. Ein leeres alt gilt als gesetzt.",
      pruefe: function (d) {
        var ohne = alle(d, "img").filter(function (i) { return !i.hasAttribute("alt"); });
        if (ohne.length) return {
          wie: ohne.length + " von " + d.querySelectorAll("img").length + " Bildern haben kein alt-Attribut.",
          fund: liste(ohne.map(function (i) { return i.getAttribute("src") || "(ohne src)"; }))
        };
        return null;
      }
    },
    {
      id: "bild-ohne-src", gruppe: "Bilder und Medien", name: "Bild ohne Quelle", stufe: "wichtig", braucht: false,
      wozu: "Ein <code>img</code> ohne <code>src</code> und ohne <code>srcset</code>. Der Browser fordert dann unter Umständen die Seite selbst noch einmal an.",
      pruefe: function (d) {
        var ohne = alle(d, "img").filter(function (i) { return !i.getAttribute("src") && !i.getAttribute("srcset"); });
        if (ohne.length) return { wie: ohne.length + " Bild(er) ohne Quelle." };
        return null;
      }
    },
    {
      id: "bild-ohne-masse", gruppe: "Bilder und Medien", name: "Bilder ohne Maßangabe", stufe: "hinweis", braucht: false,
      wozu: "Kein <code>width</code> und <code>height</code>. Beim Laden springt das Layout, und das zählt als schlechte Erfahrung.",
      pruefe: function (d) {
        var ohne = alle(d, "img").filter(function (i) { return !(i.hasAttribute("width") && i.hasAttribute("height")); });
        if (ohne.length) return { wie: ohne.length + " Bilder ohne width und height." };
        return null;
      }
    },
    {
      id: "bild-alt-lang", gruppe: "Bilder und Medien", name: "Alternativtext sehr lang", stufe: "hinweis", braucht: false,
      wozu: "Über 125 Zeichen. Ein Alternativtext soll das Bild benennen, nicht die Bildunterschrift ersetzen.",
      pruefe: function (d) {
        var lang = alle(d, "img[alt]").filter(function (i) { return i.getAttribute("alt").length > 125; });
        if (lang.length) return { wie: lang.length + " Alternativtext(e) über 125 Zeichen.", fund: liste(lang.map(function (i) { return kurz(i.getAttribute("alt"), 90); })) };
        return null;
      }
    },
    {
      id: "bild-alt-dateiname", gruppe: "Bilder und Medien", name: "Alternativtext ist der Dateiname", stufe: "hinweis", braucht: false,
      wozu: "Der Alternativtext sieht aus wie ein Dateiname, etwa <code>IMG_2481.jpg</code>. Das hilft niemandem.",
      pruefe: function (d) {
        var schlecht = alle(d, "img[alt]").filter(function (i) {
          var a = i.getAttribute("alt").trim();
          return a && /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(a);
        });
        if (schlecht.length) return { wie: schlecht.length + " Alternativtext(e) enthalten nur einen Dateinamen.", fund: liste(schlecht.map(function (i) { return i.getAttribute("alt"); })) };
        return null;
      }
    },
    {
      id: "bild-ohne-lazy", gruppe: "Bilder und Medien", name: "Bilder ohne verzögertes Laden", stufe: "hinweis", braucht: false,
      wozu: "Ab dem vierten Bild lohnt <code>loading=\"lazy\"</code>. Die ersten Bilder sollen es nicht haben, weil sie sofort sichtbar sind.",
      pruefe: function (d) {
        var bilder = alle(d, "img");
        if (bilder.length < 5) return null;
        var ohne = bilder.slice(3).filter(function (i) { return (i.getAttribute("loading") || "") !== "lazy"; });
        if (ohne.length) return { wie: ohne.length + " von " + (bilder.length - 3) + " nachrangigen Bildern laden sofort mit." };
        return null;
      }
    },
    {
      id: "video-ohne-untertitel", gruppe: "Bilder und Medien", name: "Video ohne Untertitelspur", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>video</code> ohne <code>track</code>. Ohne Untertitel ist der Inhalt für Gehörlose verloren und für Suchmaschinen unsichtbar.",
      pruefe: function (d) {
        var ohne = alle(d, "video").filter(function (v) { return !v.querySelector("track"); });
        if (ohne.length) return { wie: ohne.length + " Video(s) ohne Untertitelspur." };
        return null;
      }
    },
    {
      id: "svg-ohne-beschriftung", gruppe: "Bilder und Medien", name: "SVG ohne Beschriftung", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>svg</code> ohne <code>title</code>, <code>aria-label</code> oder <code>aria-hidden=\"true\"</code>. Vorlesewerkzeuge wissen nicht, ob sie es ansagen sollen.",
      pruefe: function (d) {
        var ohne = alle(d, "svg").filter(function (s) {
          return !s.querySelector("title") && !s.getAttribute("aria-label") && s.getAttribute("aria-hidden") !== "true" && s.getAttribute("role") !== "presentation";
        });
        if (ohne.length) return { wie: ohne.length + " SVG-Grafik(en) ohne Beschriftung und ohne Kennzeichnung als schmückend." };
        return null;
      }
    },

    /* ============ Verweise ============ */
    {
      id: "verweis-ohne-text", gruppe: "Verweise", name: "Verweise ohne Text", stufe: "wichtig", braucht: false,
      wozu: "Ein <code>a</code> mit Ziel, aber ohne Text, ohne <code>aria-label</code>, ohne <code>title</code> und ohne beschriftetes Bild.",
      pruefe: function (d) {
        var stumm = alle(d, "a[href]").filter(function (a) {
          if (a.textContent.trim()) return false;
          if (a.getAttribute("aria-label") || a.getAttribute("title")) return false;
          var bild = a.querySelector("img[alt], svg title, svg[aria-label]");
          if (bild && bild.tagName === "IMG") return !bild.getAttribute("alt").trim();
          return !bild;
        });
        if (stumm.length) return { wie: stumm.length + " Verweis(e) ohne erkennbaren Text.", fund: liste(stumm.map(function (a) { return a.getAttribute("href"); })) };
        return null;
      }
    },
    {
      id: "verweis-unspezifisch", gruppe: "Verweise", name: "Nichtssagender Verweistext", stufe: "hinweis", braucht: false,
      wozu: "Der Text lautet nur „hier“, „mehr“, „weiterlesen“ oder ähnlich. Er soll sagen, was am Ziel steht.",
      pruefe: function (d) {
        var schwach = alle(d, "a[href]").filter(function (a) {
          return UNSPEZIFISCH.indexOf(a.textContent.trim().toLowerCase().replace(/[.!:»›>]+$/, "").trim()) !== -1;
        });
        if (schwach.length) return { wie: schwach.length + " Verweis(e) mit nichtssagendem Text.", fund: liste(schwach.map(function (a) { return "„" + a.textContent.trim() + "“ → " + a.getAttribute("href"); })) };
        return null;
      }
    },
    {
      id: "verweis-leer", gruppe: "Verweise", name: "Verweis ohne Ziel", stufe: "hinweis", braucht: false,
      wozu: "<code>href=\"\"</code> oder <code>href=\"#\"</code>. Das führt zurück auf dieselbe Seite oder nach ganz oben, meist unbeabsichtigt.",
      pruefe: function (d) {
        var leer = alle(d, "a[href]").filter(function (a) {
          var h = (a.getAttribute("href") || "").trim();
          return h === "" || h === "#";
        });
        if (leer.length) return { wie: leer.length + " Verweis(e) ohne echtes Ziel.", fund: liste(leer.map(function (a) { return kurz(a.textContent, 40) || "(ohne Text)"; })) };
        return null;
      }
    },
    {
      id: "verweis-javascript", gruppe: "Verweise", name: "Verweis auf javascript:", stufe: "hinweis", braucht: false,
      wozu: "<code>href=&quot;javascript:…&quot;</code>. Ohne Skript passiert nichts, und Suchmaschinen folgen dem nicht. Für Aktionen ist <code>button</code> das richtige Element.",
      pruefe: function (d) {
        var js = alle(d, "a[href]").filter(function (a) { return /^javascript:/i.test((a.getAttribute("href") || "").trim()); });
        if (js.length) return { wie: js.length + " Verweis(e) mit javascript:-Ziel." };
        return null;
      }
    },
    {
      id: "fremdfenster-ohne-schutz", gruppe: "Verweise", name: "Neues Fenster ohne rel=noopener", stufe: "hinweis", braucht: false,
      wozu: "<code>target=\"_blank\"</code> ohne <code>rel=\"noopener\"</code>. Die Zielseite kann sonst auf das eigene Fenster zugreifen.",
      pruefe: function (d) {
        var offen = alle(d, 'a[target="_blank"]').filter(function (a) { return !/noopener|noreferrer/i.test(a.getAttribute("rel") || ""); });
        if (offen.length) return { wie: offen.length + " Verweis(e) öffnen ungeschützt ein neues Fenster." };
        return null;
      }
    },
    {
      id: "verweis-nofollow-intern", gruppe: "Verweise", name: "Interner Verweis auf nofollow", stufe: "hinweis", braucht: false,
      wozu: "Ein Verweis auf die eigene Seite mit <code>rel=\"nofollow\"</code>. Damit verschenkt man internes Gewicht ohne Gegenwert.",
      pruefe: function (d) {
        var intern = alle(d, "a[href][rel]").filter(function (a) {
          var h = (a.getAttribute("href") || "").trim();
          return /nofollow/i.test(a.getAttribute("rel")) && h && !/^(https?:)?\/\//i.test(h) && !/^(mailto|tel|javascript):/i.test(h);
        });
        if (intern.length) return { wie: intern.length + " interne(r) Verweis(e) mit nofollow.", fund: liste(intern.map(function (a) { return a.getAttribute("href"); })) };
        return null;
      }
    },
    {
      id: "verweis-menge", gruppe: "Verweise", name: "Sehr viele Verweise", stufe: "hinweis", braucht: false,
      wozu: "Über 300 Verweise auf einer Seite. Das verteilt internes Gewicht sehr dünn und macht die Seite schwer lesbar.",
      pruefe: function (d) {
        var n = d.querySelectorAll("a[href]").length;
        if (n > 300) return { wie: n + " Verweise auf dieser Seite." };
        return null;
      }
    },
    {
      id: "verweis-gleicher-text", gruppe: "Verweise", name: "Gleicher Verweistext, anderes Ziel", stufe: "hinweis", braucht: false,
      wozu: "Zwei Verweise tragen denselben zugänglichen Namen, führen aber woandershin. Ein <code>aria-label</code> zählt dabei vor dem sichtbaren Text. Wer sich durch eine Liste von Verweisen vorlesen lässt, kann sie nicht unterscheiden.",
      pruefe: function (d) {
        var nach = {}, treffer = [];
        alle(d, "a[href]").forEach(function (a) {
          var t = (a.getAttribute("aria-label") || a.textContent).trim().toLowerCase();
          var z = (a.getAttribute("href") || "").trim();
          if (!t || !z) return;
          if (!nach[t]) nach[t] = [];
          if (nach[t].indexOf(z) === -1) nach[t].push(z);
        });
        Object.keys(nach).forEach(function (t) { if (nach[t].length > 1) treffer.push("„" + kurz(t, 30) + "“ → " + nach[t].length + " verschiedene Ziele"); });
        if (treffer.length) return { wie: treffer.length + " Verweistext(e) mit mehreren Zielen.", fund: liste(treffer) };
        return null;
      }
    },

    /* ============ Ladeverhalten ============ */
    {
      id: "skript-blockierend", gruppe: "Ladeverhalten", name: "Skript blockiert den Aufbau", stufe: "wichtig", braucht: true,
      wozu: "Ein <code>script src</code> im Kopfbereich ohne <code>defer</code>, <code>async</code> oder <code>type=\"module\"</code>. Der Browser hält den Seitenaufbau an, bis es geladen ist.",
      pruefe: function (d) {
        var blockierend = alle(d, "head script[src]").filter(function (s) {
          return !s.hasAttribute("defer") && !s.hasAttribute("async") && (s.getAttribute("type") || "") !== "module";
        });
        if (blockierend.length) return { wie: blockierend.length + " blockierende(s) Skript(e) im Kopfbereich.", fund: liste(blockierend.map(function (s) { return s.getAttribute("src"); })) };
        return null;
      }
    },
    {
      id: "stilblaetter-viele", gruppe: "Ladeverhalten", name: "Viele Stilblätter", stufe: "hinweis", braucht: true,
      wozu: "Mehr als vier eingebundene Stilblätter. Jedes ist eine eigene Anfrage, die den ersten sichtbaren Aufbau verzögert.",
      pruefe: function (d) {
        var n = d.querySelectorAll('link[rel="stylesheet" i]').length;
        if (n > 4) return { wie: n + " Stilblätter eingebunden." };
        return null;
      }
    },
    {
      id: "inline-stil-gross", gruppe: "Ladeverhalten", name: "Großer Stilblock im Dokument", stufe: "hinweis", braucht: false,
      wozu: "Über 10.000 Zeichen in <code>style</code>-Blöcken. Das wird bei jedem Aufruf neu übertragen, statt aus dem Zwischenspeicher zu kommen.",
      pruefe: function (d) {
        var summe = 0;
        alle(d, "style").forEach(function (s) { summe += s.textContent.length; });
        if (summe > 10000) return { wie: Math.round(summe / 1024) + " KB Stilangaben stecken im Dokument selbst." };
        return null;
      }
    },
    {
      id: "inline-stilattribute", gruppe: "Ladeverhalten", name: "Viele style-Attribute", stufe: "hinweis", braucht: false,
      wozu: "Über 50 Elemente mit eigenem <code>style</code>-Attribut. Das lässt sich nicht zwischenspeichern und macht jede spätere Änderung mühsam.",
      pruefe: function (d) {
        var n = d.querySelectorAll("[style]").length;
        if (n > 50) return { wie: n + " Elemente mit eigenem style-Attribut." };
        return null;
      }
    },
    {
      id: "dom-gross", gruppe: "Ladeverhalten", name: "Sehr viele Elemente", stufe: "hinweis", braucht: false,
      wozu: "Über 1.500 Elemente im Dokument. Jede Änderung an der Seite kostet den Browser dann spürbar Rechenzeit.",
      pruefe: function (d) {
        var n = d.getElementsByTagName("*").length;
        if (n > 1500) return { wie: n.toLocaleString("de-DE") + " Elemente im Dokument." };
        return null;
      }
    },
    {
      id: "iframe-ohne-lazy", gruppe: "Ladeverhalten", name: "Eingebettete Seite lädt sofort", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>iframe</code> ohne <code>loading=\"lazy\"</code>. Eingebettete Karten und Videos ziehen sonst beim ersten Aufbau volle Ladezeit.",
      pruefe: function (d) {
        var ohne = alle(d, "iframe").filter(function (f) { return (f.getAttribute("loading") || "") !== "lazy"; });
        if (ohne.length) return { wie: ohne.length + " eingebettete Seite(n) laden sofort mit." };
        return null;
      }
    },
    {
      id: "iframe-ohne-titel", gruppe: "Ladeverhalten", name: "Eingebettete Seite ohne Titel", stufe: "wichtig", braucht: false,
      wozu: "Ein <code>iframe</code> ohne <code>title</code>. Vorlesewerkzeuge können den eingebetteten Bereich nicht benennen.",
      pruefe: function (d) {
        var ohne = alle(d, "iframe").filter(function (f) { return !(f.getAttribute("title") || "").trim(); });
        if (ohne.length) return { wie: ohne.length + " eingebettete Seite(n) ohne title." };
        return null;
      }
    },

    /* ============ Fremde Aufrufe und Datenschutz ============ */
    {
      id: "schriften-extern", gruppe: "Fremde Aufrufe und Datenschutz", name: "Schriften von fremden Servern", stufe: "wichtig", braucht: false,
      wozu: "Schriften werden von Google Fonts, Typekit oder einem ähnlichen Dienst nachgeladen. Dabei geht die IP-Adresse jedes Besuchers an den Anbieter. In Deutschland ist das ohne Einwilligung heikel und lässt sich vermeiden, indem die Dateien lokal liegen.",
      pruefe: function (d) {
        var treffer = fremdadressen(d).filter(function (a) {
          return SCHRIFTDIENSTE.some(function (dienst) { return a.toLowerCase().indexOf(dienst) !== -1; });
        });
        if (treffer.length) return { wie: treffer.length + " Aufruf(e) an fremde Schriftanbieter.", fund: liste(treffer) };
        return null;
      }
    },
    {
      id: "gemischte-inhalte", gruppe: "Fremde Aufrufe und Datenschutz", name: "Unverschlüsselt geladene Bestandteile", stufe: "kritisch", braucht: false,
      wozu: "Eine Ressource wird über <code>http://</code> geholt. Auf einer verschlüsselten Seite blockiert der Browser das oder warnt, und Teile der Seite fehlen.",
      pruefe: function (d) {
        var treffer = fremdadressen(d).filter(function (a) { return /^http:\/\//i.test(a); });
        if (treffer.length) return { wie: treffer.length + " Bestandteil(e) werden unverschlüsselt geladen.", fund: liste(treffer) };
        return null;
      }
    },
    {
      id: "zaehldienste", gruppe: "Fremde Aufrufe und Datenschutz", name: "Mess- oder Werbedienste eingebunden", stufe: "hinweis", braucht: false,
      wozu: "Ein bekannter Mess- oder Werbedienst wird geladen. Solche Dienste brauchen in der Regel eine Einwilligung, bevor sie starten dürfen.",
      pruefe: function (d) {
        var roh = fremdadressen(d).concat(alle(d, "script").map(function (s) { return s.textContent.slice(0, 4000); }));
        var gefunden = [];
        ZAEHLDIENSTE.forEach(function (paar) {
          if (roh.some(function (a) { return a.toLowerCase().indexOf(paar[0]) !== -1; })) gefunden.push(paar[1]);
        });
        if (gefunden.length) return { wie: "Erkannt: " + gefunden.join(", ") + "." };
        return null;
      }
    },
    {
      id: "fremde-hosts", gruppe: "Fremde Aufrufe und Datenschutz", name: "Aufrufe an fremde Server", stufe: "hinweis", braucht: false,
      wozu: "Auflistung aller Server, von denen die Seite etwas nachlädt. Jeder davon sieht die IP-Adresse Ihrer Besucher und gehört in die Datenschutzerklärung.",
      pruefe: function (d) {
        var hosts = {};
        fremdadressen(d).forEach(function (a) { var h = hostVon(a); if (h) hosts[h] = (hosts[h] || 0) + 1; });
        var namen = Object.keys(hosts);
        if (namen.length) return {
          wie: namen.length + " fremde(r) Server werden angesprochen.",
          fund: liste(namen.map(function (h) { return h + " (" + hosts[h] + "x)"; }), 8)
        };
        return null;
      }
    },
    {
      id: "video-ohne-schutz", gruppe: "Fremde Aufrufe und Datenschutz", name: "YouTube ohne erweiterten Datenschutz", stufe: "hinweis", braucht: false,
      wozu: "Ein eingebettetes YouTube-Video über <code>youtube.com</code> statt <code>youtube-nocookie.com</code>. Die datensparsame Variante setzt erst beim Abspielen Cookies.",
      pruefe: function (d) {
        var treffer = alle(d, "iframe[src]").filter(function (f) {
          var s = (f.getAttribute("src") || "").toLowerCase();
          return s.indexOf("youtube.com") !== -1 && s.indexOf("nocookie") === -1;
        });
        if (treffer.length) return { wie: treffer.length + " Video(s) ohne die datensparsame Einbettung." };
        return null;
      }
    },

    /* ============ Auszeichnung und Vorschau ============ */
    {
      id: "og-fehlt", gruppe: "Auszeichnung und Vorschau", name: "Keine Angaben für geteilte Vorschau", stufe: "hinweis", braucht: false,
      wozu: "Es fehlen <code>og:title</code>, <code>og:description</code> oder <code>og:image</code>. Beim Teilen in Netzwerken und Messengern bleibt die Vorschau leer.",
      pruefe: function (d) {
        var fehlen = ["og:title", "og:description", "og:image"].filter(function (n) {
          return !d.querySelector('meta[property="' + n + '" i]');
        });
        if (fehlen.length === 3) return { wie: "Beim Teilen gibt es kein Bild und keinen Titel." };
        if (fehlen.length) return { wie: "Es fehlen: " + fehlen.join(", ") + "." };
        return null;
      }
    },
    {
      id: "og-bild-relativ", gruppe: "Auszeichnung und Vorschau", name: "Vorschaubild mit relativer Adresse", stufe: "wichtig", braucht: false,
      wozu: "<code>og:image</code> ohne Schema und Domain. Fremde Dienste können das Bild dann nicht auflösen und zeigen gar keins.",
      pruefe: function (d) {
        var m = d.querySelector('meta[property="og:image" i]');
        if (!m) return null;
        var wert = inhalt(m);
        if (wert && !/^https?:\/\//i.test(wert)) return { wie: "Das Vorschaubild ist relativ angegeben.", fund: wert };
        return null;
      }
    },
    {
      id: "twitter-karte-fehlt", gruppe: "Auszeichnung und Vorschau", name: "Keine Twitter-Karte", stufe: "hinweis", braucht: false,
      wozu: "Kein <code>twitter:card</code>. Ohne die Angabe fällt die Vorschau in manchen Diensten auf die kleine Form zurück.",
      pruefe: function (d) {
        if (d.querySelector('meta[property="og:image" i]') && !d.querySelector('meta[name="twitter:card" i]')) {
          return { wie: "Ein Vorschaubild ist da, die Kartenform fehlt." };
        }
        return null;
      }
    },
    {
      id: "auszeichnung-fehlt", gruppe: "Auszeichnung und Vorschau", name: "Keine strukturierten Daten", stufe: "hinweis", braucht: false,
      wozu: "Kein JSON-LD vorhanden. Damit gibt es keine erweiterten Treffer, etwa Bewertungen, Preise oder Öffnungszeiten.",
      pruefe: function (d) {
        if (!d.querySelector('script[type="application/ld+json"]')) return { wie: "Keine strukturierten Daten im Dokument." };
        return null;
      }
    },
    {
      id: "auszeichnung-kaputt", gruppe: "Auszeichnung und Vorschau", name: "Strukturierte Daten sind kein gültiges JSON", stufe: "wichtig", braucht: false,
      wozu: "Ein <code>script type=\"application/ld+json\"</code> lässt sich nicht lesen. Fehlerhaftes JSON-LD wird vollständig verworfen.",
      pruefe: function (d) {
        var kaputt = [];
        alle(d, 'script[type="application/ld+json"]').forEach(function (s, i) {
          try { JSON.parse(s.textContent); } catch (e) { kaputt.push("Block " + (i + 1) + ": " + e.message); }
        });
        if (kaputt.length) return { wie: kaputt.length + " Block/Blöcke lassen sich nicht lesen.", fund: liste(kaputt) };
        return null;
      }
    },
    {
      id: "auszeichnung-ohne-typ", gruppe: "Auszeichnung und Vorschau", name: "Strukturierte Daten ohne @type", stufe: "wichtig", braucht: false,
      wozu: "Ein JSON-LD-Block ohne <code>@type</code>. Ohne Typ weiß die Suchmaschine nicht, was beschrieben wird, und ignoriert den Block.",
      pruefe: function (d) {
        var ohne = [];
        alle(d, 'script[type="application/ld+json"]').forEach(function (s, i) {
          var daten;
          try { daten = JSON.parse(s.textContent); } catch (e) { return; }
          var teile = Array.isArray(daten) ? daten : (daten["@graph"] || [daten]);
          teile.forEach(function (t) { if (t && typeof t === "object" && !t["@type"]) ohne.push("Block " + (i + 1)); });
        });
        if (ohne.length) return { wie: ohne.length + " Eintrag/Einträge ohne @type.", fund: liste(ohne) };
        return null;
      }
    },
    {
      id: "hreflang-format", gruppe: "Auszeichnung und Vorschau", name: "Ungültiges hreflang", stufe: "hinweis", braucht: false,
      wozu: "Eine <code>hreflang</code>-Angabe folgt nicht dem Muster Sprache oder Sprache-Land, etwa <code>de</code> oder <code>de-AT</code>.",
      pruefe: function (d) {
        var falsch = alle(d, "link[hreflang]").filter(function (l) {
          var w = l.getAttribute("hreflang");
          return !/^x-default$/i.test(w) && !/^[a-z]{2,3}(-[A-Za-z]{4})?(-([A-Za-z]{2}|[0-9]{3}))?$/.test(w);
        });
        if (falsch.length) return { wie: falsch.length + " Angabe(n) im falschen Format.", fund: liste(falsch.map(function (l) { return l.getAttribute("hreflang"); })) };
        return null;
      }
    },
    {
      id: "hreflang-doppelt", gruppe: "Auszeichnung und Vorschau", name: "hreflang mehrfach vergeben", stufe: "wichtig", braucht: false,
      wozu: "Dieselbe Sprache zeigt auf zwei verschiedene Adressen. Widersprüchliche Angaben werden komplett verworfen.",
      pruefe: function (d) {
        var nach = {}, doppelt = [];
        alle(d, "link[hreflang][href]").forEach(function (l) {
          var s = l.getAttribute("hreflang").toLowerCase();
          var z = l.getAttribute("href");
          if (!nach[s]) nach[s] = [];
          if (nach[s].indexOf(z) === -1) nach[s].push(z);
        });
        Object.keys(nach).forEach(function (s) { if (nach[s].length > 1) doppelt.push(s + " → " + nach[s].length + " Adressen"); });
        if (doppelt.length) return { wie: doppelt.length + " Sprachangabe(n) mit mehreren Zielen.", fund: liste(doppelt) };
        return null;
      }
    },
    {
      id: "hreflang-ohne-standard", gruppe: "Auszeichnung und Vorschau", name: "hreflang ohne x-default", stufe: "hinweis", braucht: false,
      wozu: "Es gibt Sprachvarianten, aber keinen <code>x-default</code>. Für Besucher, deren Sprache nicht dabei ist, fehlt der Rückfall.",
      pruefe: function (d) {
        var alleAngaben = alle(d, "link[hreflang]");
        if (!alleAngaben.length) return null;
        var hatStandard = alleAngaben.some(function (l) { return /^x-default$/i.test(l.getAttribute("hreflang")); });
        if (!hatStandard) return { wie: alleAngaben.length + " Sprachvarianten, kein x-default." };
        return null;
      }
    },

    /* ============ Formulare und Bedienung ============ */
    {
      id: "feld-ohne-beschriftung", gruppe: "Formulare und Bedienung", name: "Eingabefeld ohne Beschriftung", stufe: "wichtig", braucht: false,
      wozu: "Ein Feld ohne zugehöriges <code>label</code>, <code>aria-label</code> oder <code>title</code>. Ein Platzhaltertext genügt nicht, er verschwindet beim Tippen.",
      pruefe: function (d) {
        var ohne = alle(d, "input, select, textarea").filter(function (f) {
          var typ = (f.getAttribute("type") || "").toLowerCase();
          if (["hidden", "submit", "button", "reset", "image"].indexOf(typ) !== -1) return false;
          if (f.getAttribute("aria-label") || f.getAttribute("aria-labelledby") || f.getAttribute("title")) return false;
          if (f.closest("label")) return false;
          var id = f.getAttribute("id");
          return !(id && d.querySelector('label[for="' + id.replace(/"/g, '\\"') + '"]'));
        });
        if (ohne.length) return { wie: ohne.length + " Feld(er) ohne Beschriftung.", fund: liste(ohne.map(function (f) { return "<" + f.tagName.toLowerCase() + (f.getAttribute("name") ? ' name="' + f.getAttribute("name") + '"' : "") + ">"; })) };
        return null;
      }
    },
    {
      id: "knopf-ohne-text", gruppe: "Formulare und Bedienung", name: "Schaltfläche ohne Beschriftung", stufe: "wichtig", braucht: false,
      wozu: "Ein <code>button</code> ohne Text und ohne <code>aria-label</code>. Wer die Seite vorgelesen bekommt, hört nur „Schaltfläche“.",
      pruefe: function (d) {
        var ohne = alle(d, "button").filter(function (b) {
          if (b.textContent.trim()) return false;
          if (b.getAttribute("aria-label") || b.getAttribute("aria-labelledby") || b.getAttribute("title")) return false;
          var svg = b.querySelector("svg[aria-label], svg title, img[alt]");
          if (svg && svg.tagName === "IMG") return !svg.getAttribute("alt").trim();
          return !svg;
        });
        if (ohne.length) return { wie: ohne.length + " Schaltfläche(n) ohne Beschriftung." };
        return null;
      }
    },
    {
      id: "tabindex-positiv", gruppe: "Formulare und Bedienung", name: "tabindex größer als null", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>tabindex</code> über 0 reißt die Tastaturreihenfolge aus der Lesereihenfolge heraus. Das ist fast immer eine Verschlimmbesserung.",
      pruefe: function (d) {
        var hoch = alle(d, "[tabindex]").filter(function (el) { return parseInt(el.getAttribute("tabindex"), 10) > 0; });
        if (hoch.length) return { wie: hoch.length + " Element(e) mit eigenem tabindex." };
        return null;
      }
    },
    {
      id: "autofocus", gruppe: "Formulare und Bedienung", name: "Feld zieht den Fokus an sich", stufe: "hinweis", braucht: false,
      wozu: "<code>autofocus</code> springt beim Laden in ein Feld. Auf dem Telefon klappt dabei die Tastatur auf und verdeckt die halbe Seite.",
      pruefe: function (d) {
        if (d.querySelector("[autofocus]")) return { wie: "Ein Feld nimmt sich beim Laden den Fokus." };
        return null;
      }
    },
    {
      id: "versteckt-aber-erreichbar", gruppe: "Formulare und Bedienung", name: "Versteckter Bereich bleibt anspringbar", stufe: "wichtig", braucht: false,
      wozu: "Ein Element mit <code>aria-hidden=\"true\"</code> enthält Verweise oder Felder. Die Tastatur springt hinein, die Vorlesestimme schweigt dazu.",
      pruefe: function (d) {
        var falsch = alle(d, '[aria-hidden="true"]').filter(function (el) {
          return el.querySelector("a[href], button, input, select, textarea, [tabindex]");
        });
        if (falsch.length) return { wie: falsch.length + " versteckte(r) Bereich(e) mit bedienbaren Elementen." };
        return null;
      }
    },
    /* ============ Inhalt und KI-Sichtbarkeit ============ */
    {
      id: "wenig-text", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Wenig Fließtext", stufe: "hinweis", braucht: false,
      wozu: "Unter 300 Wörter im Text, ohne Skripte gezählt. Für eine Seite, die zu einem Thema ranken oder zitiert werden soll, ist das wenig.",
      pruefe: function (d) {
        var w = woerterZaehlen(d);
        if (w < 300) return { wie: "Etwa " + w + " Wörter Text." };
        return null;
      }
    },
    {
      id: "inhalt-nur-per-skript", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Inhalt steht nicht im Dokument", stufe: "kritisch", braucht: false,
      wozu: "Kaum Text, aber viele Skripte: der Inhalt wird offenbar erst im Browser erzeugt. Suchmaschinen rendern das mit Verzögerung, die Antwortmaschinen von ChatGPT und Perplexity meist gar nicht.",
      pruefe: function (d) {
        var w = woerterZaehlen(d);
        var skripte = d.querySelectorAll("script[src]").length;
        if (w < 120 && skripte >= 3) {
          return { wie: "Nur " + w + " Wörter im Dokument, dafür " + skripte + " nachgeladene Skripte." };
        }
        return null;
      }
    },
    {
      id: "zusammenfassung-fehlt", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Keine Antwort direkt unter der Überschrift", stufe: "hinweis", braucht: false,
      wozu: "Nach der H1 kommt sofort die nächste Überschrift statt eines erklärenden Absatzes. Antwortmaschinen zitieren fast immer den ersten Absatz unter der Überschrift.",
      pruefe: function (d) {
        var reihe = alle(d, "h1, h2, h3, p, ul, ol, dl, table, figure");
        for (var i = 0; i < reihe.length; i++) {
          if (reihe[i].localName !== "h1") continue;
          var naechstes = reihe[i + 1];
          if (!naechstes) return { wie: "Unter der H1 folgt kein Inhalt." };
          if (/^h[123]$/.test(naechstes.localName)) {
            return { wie: "Auf die H1 folgt direkt eine weitere Überschrift.", fund: kurz(reihe[i].textContent, 60) + " → " + naechstes.localName.toUpperCase() };
          }
          return null;
        }
        return null;
      }
    },
    {
      id: "frage-ohne-antwort", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Frage als Überschrift ohne Antwort darunter", stufe: "hinweis", braucht: false,
      wozu: "Eine Überschrift endet mit einem Fragezeichen, darunter steht kein Absatz. Genau solche Frage-Antwort-Paare greifen Antwortmaschinen am liebsten ab.",
      pruefe: function (d) {
        var reihe = alle(d, "h1, h2, h3, h4, h5, h6, p, ul, ol, dl, table");
        var offen = [];
        for (var i = 0; i < reihe.length; i++) {
          var el = reihe[i];
          if (!/^h[1-6]$/.test(el.localName)) continue;
          if (el.textContent.trim().slice(-1) !== "?") continue;
          var naechstes = reihe[i + 1];
          if (!naechstes || /^h[1-6]$/.test(naechstes.localName)) offen.push(kurz(el.textContent, 60));
        }
        if (offen.length) return { wie: offen.length + " Frage(n) ohne Antwort direkt darunter.", fund: liste(offen) };
        return null;
      }
    },
    {
      id: "absatz-zu-lang", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Sehr lange Absätze", stufe: "hinweis", braucht: false,
      wozu: "Absätze über 700 Zeichen lassen sich schlecht am Stück zitieren und werden am Telefon zur Wand aus Text.",
      pruefe: function (d) {
        var lang = alle(d, "p").filter(function (p) { return p.textContent.trim().length > 700; });
        if (lang.length) return { wie: lang.length + " Absatz/Absätze über 700 Zeichen.", fund: liste(lang.map(function (p) { return p.textContent.trim().length + " Zeichen: " + kurz(p.textContent, 70); })) };
        return null;
      }
    },
    {
      id: "keine-aufzaehlungen", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Nur Fließtext, keine Struktur", stufe: "hinweis", braucht: false,
      wozu: "Viel Text ohne eine einzige Liste oder Tabelle. Aufzählungen und Tabellen sind das, was aus einer Seite als Antwort herausgelöst werden kann.",
      pruefe: function (d) {
        var w = woerterZaehlen(d);
        if (w < 400) return null;
        if (d.querySelectorAll("ul, ol, dl, table").length === 0) {
          return { wie: "Etwa " + w + " Wörter, aber keine Liste und keine Tabelle." };
        }
        return null;
      }
    },
    {
      id: "ueberschrift-ohne-sprungmarke", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Überschriften ohne Sprungmarke", stufe: "hinweis", braucht: false,
      wozu: "Keine der Zwischenüberschriften hat ein <code>id</code>. Ohne Sprungmarke kann niemand auf einen bestimmten Abschnitt verweisen, und Antwortmaschinen können ihre Quelle nicht genau angeben.",
      pruefe: function (d) {
        var ueberschriften = alle(d, "h2, h3");
        if (ueberschriften.length < 5) return null;
        var mitMarke = ueberschriften.filter(function (h) { return h.getAttribute("id"); });
        if (mitMarke.length === 0) {
          return { wie: ueberschriften.length + " Zwischenüberschriften, keine einzige mit Sprungmarke." };
        }
        return null;
      }
    },
    {
      id: "datum-fehlt", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Kein Datum angegeben", stufe: "wichtig", braucht: false,
      wozu: "Weder <code>datePublished</code> oder <code>dateModified</code> in den strukturierten Daten noch ein <code>time</code>-Element. Ohne Datum kann niemand einschätzen, ob die Angaben noch gelten, und Antwortmaschinen bevorzugen Quellen mit Datum.",
      pruefe: function (d) {
        if (d.querySelector("time[datetime]")) return null;
        var treffer = ldObjekte(d).some(function (o) {
          return o.datePublished || o.dateModified || o.uploadDate;
        });
        if (!treffer) return { wie: "Kein Veröffentlichungs- oder Änderungsdatum zu finden." };
        return null;
      }
    },
    {
      id: "herausgeber-fehlt", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Kein Herausgeber ausgezeichnet", stufe: "hinweis", braucht: false,
      wozu: "In den strukturierten Daten steht keine <code>Organization</code> und kein <code>publisher</code>. Antwortmaschinen nennen bevorzugt Quellen, deren Urheber eindeutig ist.",
      pruefe: function (d) {
        var objekte = ldObjekte(d);
        if (!objekte.length) return null;
        var treffer = objekte.some(function (o) {
          var typ = [].concat(o["@type"] || []).join(" ");
          return o.publisher || /Organization|Person|LocalBusiness/i.test(typ);
        });
        if (!treffer) return { wie: "Strukturierte Daten sind da, aber ohne Angabe des Herausgebers." };
        return null;
      }
    },
    {
      id: "autor-fehlt", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Kein Autor bei längerem Text", stufe: "hinweis", braucht: false,
      wozu: "Ein längerer redaktioneller Text ohne <code>author</code> in den strukturierten Daten und ohne <code>meta name=\"author\"</code>. Wer etwas behauptet, sollte erkennbar sein.",
      pruefe: function (d) {
        if (woerterZaehlen(d) < 800) return null;
        if (d.querySelector('meta[name="author" i]')) return null;
        if (ldObjekte(d).some(function (o) { return o.author; })) return null;
        return { wie: "Längerer Text ohne erkennbaren Verfasser." };
      }
    },
    {
      id: "artikel-nicht-ausgezeichnet", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Langer Text ohne strukturierte Daten", stufe: "hinweis", braucht: false,
      wozu: "Über 1.200 Wörter, aber kein JSON-LD. Gerade lange Texte gewinnen dadurch, dass Thema, Datum und Herausgeber maschinenlesbar danebenstehen.",
      pruefe: function (d) {
        if (woerterZaehlen(d) < 1200) return null;
        if (d.querySelector('script[type="application/ld+json"]')) return null;
        return { wie: "Etwa " + woerterZaehlen(d) + " Wörter ohne jede maschinenlesbare Einordnung." };
      }
    },
    {
      id: "bild-ohne-bildunterschrift", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Abbildung ohne Bildunterschrift", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>figure</code> ohne <code>figcaption</code>. Die Bildunterschrift ist der Text, der beim Zitieren einer Abbildung mitgeht.",
      pruefe: function (d) {
        var ohne = alle(d, "figure").filter(function (f) { return !f.querySelector("figcaption"); });
        if (ohne.length) return { wie: ohne.length + " Abbildung(en) ohne Bildunterschrift." };
        return null;
      }
    },
    {
      id: "tabelle-ohne-beschriftung", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Tabelle ohne Beschriftung", stufe: "hinweis", braucht: false,
      wozu: "Eine Tabelle ohne <code>caption</code>. Ohne Beschriftung weiß niemand, wovon die Zahlen handeln, wenn die Tabelle allein zitiert wird.",
      pruefe: function (d) {
        var ohne = alle(d, "table").filter(function (t) { return !t.querySelector("caption"); });
        if (ohne.length) return { wie: ohne.length + " Tabelle(n) ohne caption." };
        return null;
      }
    },
    {
      id: "ki-ausgeschlossen", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Antwortmaschinen ausgeschlossen", stufe: "hinweis", braucht: false,
      wozu: "Die Seite setzt <code>noai</code> oder <code>noimageai</code>. Das ist eine legitime Entscheidung, schließt die Seite aber aus KI-Antworten aus. Hier steht es nur, damit es niemanden überrascht.",
      pruefe: function (d) {
        var angaben = alle(d, 'meta[name="robots" i], meta[name="googlebot" i], meta[name="ai" i]')
          .map(inhalt).join(",").toLowerCase();
        var treffer = ["noai", "noimageai", "noml"].filter(function (w) { return angaben.indexOf(w) !== -1; });
        if (treffer.length) return { wie: "Gesetzt: " + treffer.join(", ") + "." };
        return null;
      }
    },

    /* ============ Adresse und Aufbau ============ */
    {
      id: "adresse-fehlt", gruppe: "Adresse und Aufbau", name: "Keine Adresse ablesbar", stufe: "hinweis", braucht: false,
      wozu: "Weder <code>canonical</code> noch <code>og:url</code> nennen eine vollständige Adresse. Ohne sie lässt sich über den Aufbau der Adresse nichts sagen; acht Regeln dieser Gruppe fallen aus.",
      pruefe: function (d) {
        if (eigeneAdresse(d)) return null;
        return { wie: "Es steht keine absolute Adresse im Dokument. Die Adressprüfungen wurden übersprungen." };
      }
    },
    {
      id: "adresse-lang", gruppe: "Adresse und Aufbau", name: "Adresse sehr lang", stufe: "hinweis", braucht: false,
      wozu: "Die Adresse ist länger als 115 Zeichen. Lange Adressen werden in der Trefferliste gekürzt, brechen beim Teilen um und sind schwer vorzulesen.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        if (!a) return null;
        var s = a.href;
        if (s.length > 115) return { wie: s.length + " Zeichen. Ab etwa 115 Zeichen kürzt die Trefferliste die Adresse.", fund: s };
        return null;
      }
    },
    {
      id: "adresse-parameter", gruppe: "Adresse und Aufbau", name: "Viele Abfrageparameter", stufe: "hinweis", braucht: false,
      wozu: "Mehr als zwei Parameter hinter dem Fragezeichen. Jeder Parameter kann eine weitere Fassung derselben Seite erzeugen.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        if (!a || !a.search) return null;
        var teile = a.search.replace(/^\?/, "").split("&").filter(Boolean);
        if (teile.length > 2) return { wie: teile.length + " Parameter in der Adresse.", fund: teile.join("\n") };
        return null;
      }
    },
    {
      id: "adresse-versalien", gruppe: "Adresse und Aufbau", name: "Großbuchstaben in der Adresse", stufe: "hinweis", braucht: false,
      wozu: "Im Pfad stehen Großbuchstaben. Server unterscheiden meist zwischen groß und klein, damit gibt es dieselbe Seite unter zwei Adressen.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        if (!a) return null;
        if (/[A-Z]/.test(a.pathname)) return { wie: "Der Pfad enthält Großbuchstaben.", fund: a.pathname };
        return null;
      }
    },
    {
      id: "adresse-unterstrich", gruppe: "Adresse und Aufbau", name: "Unterstriche statt Bindestriche", stufe: "hinweis", braucht: false,
      wozu: "Unterstriche trennen Wörter für Suchmaschinen nicht; <code>eis_creme</code> gilt als ein Wort, <code>eis-creme</code> als zwei.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        if (!a) return null;
        if (a.pathname.indexOf("_") !== -1) return { wie: "Der Pfad trennt mit Unterstrichen.", fund: a.pathname };
        return null;
      }
    },
    {
      id: "adresse-sitzung", gruppe: "Adresse und Aufbau", name: "Sitzungskennung in der Adresse", stufe: "wichtig", braucht: false,
      wozu: "Ein Parameter wie <code>sid</code>, <code>PHPSESSID</code> oder <code>jsessionid</code> steht in der Adresse. Jede Sitzung erzeugt dann eine eigene Adresse für dieselbe Seite.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        if (!a) return null;
        var treffer = a.href.match(/[?&;](sid|sessionid|phpsessid|jsessionid|zenid|osCsid)=/i);
        if (treffer) return { wie: "Sitzungskennung gefunden: " + treffer[1], fund: a.href };
        return null;
      }
    },
    {
      id: "adresse-tief", gruppe: "Adresse und Aufbau", name: "Tief verschachtelte Adresse", stufe: "hinweis", braucht: false,
      wozu: "Mehr als vier Ebenen im Pfad. Je tiefer eine Seite liegt, desto seltener wird sie besucht und desto später gefunden.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        if (!a) return null;
        var ebenen = a.pathname.split("/").filter(Boolean);
        if (ebenen.length > 4) return { wie: ebenen.length + " Ebenen im Pfad.", fund: a.pathname };
        return null;
      }
    },
    {
      id: "adresse-dateiendung", gruppe: "Adresse und Aufbau", name: "Technische Dateiendung sichtbar", stufe: "hinweis", braucht: false,
      wozu: "Die Adresse endet auf <code>.php</code>, <code>.asp</code> oder ähnlich. Das bindet die Adresse an die eingesetzte Technik; ein Umbau macht sie ungültig.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        if (!a) return null;
        var treffer = a.pathname.match(/\.(php\d?|aspx?|jsp|cfm|cgi|pl)$/i);
        if (treffer) return { wie: "Die Adresse endet auf ." + treffer[1] + ".", fund: a.pathname };
        return null;
      }
    },
    {
      id: "adresse-sonderzeichen", gruppe: "Adresse und Aufbau", name: "Kodierte Sonderzeichen im Pfad", stufe: "hinweis", braucht: false,
      wozu: "Im Pfad stehen Prozentfolgen wie <code>%C3%BC</code>. Solche Adressen sind unleserlich, sobald sie irgendwo im Klartext auftauchen.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        if (!a) return null;
        var treffer = a.pathname.match(/%[0-9A-Fa-f]{2}/g);
        if (treffer && treffer.length > 1) return { wie: treffer.length + " kodierte Zeichen im Pfad.", fund: a.pathname };
        return null;
      }
    },

    /* ============ Sicherheit und Auslieferung ============ */
    {
      id: "doctype-fehlt", gruppe: "Sicherheit und Auslieferung", name: "Dokumenttyp fehlt", stufe: "wichtig", braucht: true,
      wozu: "Ohne <code>&lt;!doctype html&gt;</code> in der ersten Zeile schaltet der Browser in einen alten Darstellungsmodus. Abstände, Breiten und Kästen verhalten sich dann anders als gedacht.",
      pruefe: function (d, roh) {
        if (/^\s*<!doctype\s+html\s*>/i.test(String(roh))) return null;
        if (/<!doctype/i.test(String(roh))) return { wie: "Es steht ein Dokumenttyp da, aber nicht der kurze HTML-Typ.", fund: kurz(String(roh).slice(0, 120), 110) };
        return { wie: "Am Anfang des Dokuments steht kein <!doctype html>." };
      }
    },
    {
      id: "formular-unverschluesselt", gruppe: "Sicherheit und Auslieferung", name: "Formular sendet unverschlüsselt", stufe: "kritisch", braucht: false,
      wozu: "Ein Formular schickt seine Daten an eine <code>http://</code>-Adresse. Alles darin ist auf dem Weg mitlesbar, und der Browser warnt den Besucher.",
      pruefe: function (d) {
        var offen = alle(d, "form[action]").filter(function (f) {
          return /^http:\/\//i.test(f.getAttribute("action") || "");
        });
        if (offen.length) return { wie: offen.length + " Formular(e) senden über http.", fund: liste(offen.map(function (f) { return f.getAttribute("action"); })) };
        return null;
      }
    },
    {
      id: "passwort-ungeschuetzt", gruppe: "Sicherheit und Auslieferung", name: "Passwortfeld ohne sicheres Ziel", stufe: "kritisch", braucht: false,
      wozu: "Ein Feld vom Typ <code>password</code> steht in einem Formular, das über <code>http://</code> sendet. Browser zeigen dafür seit Jahren eine Warnung an.",
      pruefe: function (d) {
        var schlecht = alle(d, 'input[type="password" i]').filter(function (i) {
          var f = i.closest("form");
          return f && /^http:\/\//i.test(f.getAttribute("action") || "");
        });
        if (schlecht.length) return { wie: schlecht.length + " Passwortfeld(er) in einem unverschlüsselten Formular." };
        return null;
      }
    },
    {
      id: "skript-ohne-integritaet", gruppe: "Sicherheit und Auslieferung", name: "Fremdes Skript ohne Prüfsumme", stufe: "hinweis", braucht: false,
      wozu: "Ein Skript von einem fremden Host wird ohne <code>integrity</code> geladen. Ändert sich die Datei dort, läuft der neue Inhalt ungeprüft in Ihrer Seite.",
      pruefe: function (d) {
        var ohne = alle(d, "script[src]").filter(function (s) {
          var q = s.getAttribute("src") || "";
          return /^(https?:)?\/\//i.test(q) && !s.hasAttribute("integrity");
        });
        if (ohne.length) return { wie: ohne.length + " fremde(s) Skript(e) ohne integrity-Prüfsumme.", fund: liste(ohne.map(function (s) { return s.getAttribute("src"); })) };
        return null;
      }
    },
    {
      id: "verweisrichtlinie-fehlt", gruppe: "Sicherheit und Auslieferung", name: "Keine Angabe zum Verweisenden", stufe: "hinweis", braucht: false,
      wozu: "Ohne <code>meta name=\"referrer\"</code> gibt der Browser beim Weiterklicken die volle Adresse Ihrer Seite an den nächsten Server. Bei Adressen mit Parametern gibt das mehr preis als nötig.",
      pruefe: function (d) {
        if (d.querySelector('meta[name="referrer" i]')) return null;
        return { wie: "Keine referrer-Angabe im Kopfbereich." };
      }
    },
    {
      id: "sicherheitsrichtlinie-fehlt", gruppe: "Sicherheit und Auslieferung", name: "Keine Inhaltsrichtlinie", stufe: "hinweis", braucht: false,
      wozu: "Es gibt kein <code>Content-Security-Policy</code> als meta-Angabe. Das ist kein Fehler — meist steht sie im Server-Kopf, den dieser Prüfer nicht sieht. Hier steht es nur als Erinnerung.",
      pruefe: function (d) {
        if (d.querySelector('meta[http-equiv="Content-Security-Policy" i]')) return null;
        return { wie: "Keine Inhaltsrichtlinie im Dokument. Prüfen Sie, ob der Server eine sendet." };
      }
    },
    {
      id: "veraltete-elemente", gruppe: "Sicherheit und Auslieferung", name: "Abgeschaffte Elemente", stufe: "hinweis", braucht: false,
      wozu: "Elemente wie <code>center</code>, <code>font</code>, <code>marquee</code> oder <code>blink</code> sind aus dem Standard entfernt. Sie funktionieren noch, aber ihr Verhalten ist nirgends mehr zugesichert.",
      pruefe: function (d) {
        var namen = ["center", "font", "marquee", "blink", "big", "strike", "tt", "frame", "frameset", "applet"];
        var gefunden = [];
        namen.forEach(function (n) {
          var t = alle(d, n);
          if (t.length) gefunden.push(n + " (" + t.length + "×)");
        });
        if (gefunden.length) return { wie: "Gefunden: " + gefunden.join(", ") + "." };
        return null;
      }
    },
    {
      id: "kompatibilitaetsmodus", gruppe: "Sicherheit und Auslieferung", name: "Alter Darstellungsmodus erzwungen", stufe: "hinweis", braucht: false,
      wozu: "<code>X-UA-Compatible</code> stammt aus der Zeit des Internet Explorer. Heute wird die Angabe ignoriert und kostet nur Bytes.",
      pruefe: function (d) {
        var m = d.querySelector('meta[http-equiv="X-UA-Compatible" i]');
        if (m) return { wie: "X-UA-Compatible steht noch im Dokument.", fund: m.outerHTML };
        return null;
      }
    },

    /* ============ Barrierefreiheit ============ */
    {
      id: "sprungmarke-fehlt", gruppe: "Barrierefreiheit", name: "Kein Sprung zum Inhalt", stufe: "hinweis", braucht: true,
      wozu: "Es gibt keinen Verweis, der die Navigation überspringt. Wer mit der Tastatur bedient, muss sich sonst auf jeder Seite durch dasselbe Menü tabben.",
      pruefe: function (d) {
        if (!d.body) return null;
        var erste = alle(d, "a[href]").slice(0, 4);
        var hat = erste.some(function (a) {
          var ziel = (a.getAttribute("href") || "");
          var text = a.textContent.toLowerCase();
          return ziel.charAt(0) === "#" && /inhalt|content|hauptteil|main|springen|skip/.test(text + " " + ziel);
        });
        if (hat) return null;
        return { wie: "Unter den ersten Verweisen ist keiner, der zum Inhalt springt." };
      }
    },
    {
      id: "aria-versteckt-fokussierbar", gruppe: "Barrierefreiheit", name: "Versteckt, aber ansteuerbar", stufe: "wichtig", braucht: false,
      wozu: "Ein Element mit <code>aria-hidden=\"true\"</code> enthält einen Verweis oder ein Bedienelement. Die Tastatur landet dort, die Sprachausgabe sagt nichts.",
      pruefe: function (d) {
        var betroffen = [];
        alle(d, '[aria-hidden="true" i]').forEach(function (el) {
          var innen = alle(el, "a[href], button, input, select, textarea, [tabindex]");
          if (innen.length) betroffen.push(kurz(el.outerHTML, 90));
        });
        if (betroffen.length) return { wie: betroffen.length + " verstecktes Element / versteckte Elemente enthalten Bedienbares.", fund: liste(betroffen, 3) };
        return null;
      }
    },
    {
      id: "aria-verweist-ins-leere", gruppe: "Barrierefreiheit", name: "Beschriftung zeigt ins Leere", stufe: "wichtig", braucht: true,
      wozu: "<code>aria-labelledby</code> oder <code>aria-describedby</code> nennt eine Kennung, die es im Dokument nicht gibt. Die Sprachausgabe liest dann gar nichts vor.",
      pruefe: function (d) {
        var ids = kennungen(d), kaputt = [];
        alle(d, "[aria-labelledby], [aria-describedby]").forEach(function (el) {
          ["aria-labelledby", "aria-describedby"].forEach(function (name) {
            (el.getAttribute(name) || "").split(/\s+/).filter(Boolean).forEach(function (ziel) {
              if (!ids[ziel]) kaputt.push(name + '="' + ziel + '"');
            });
          });
        });
        if (kaputt.length) return { wie: kaputt.length + " Verweis(e) auf nicht vorhandene Kennungen.", fund: liste(kaputt) };
        return null;
      }
    },
    {
      id: "rolle-unbekannt", gruppe: "Barrierefreiheit", name: "Unbekannte Rolle", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>role</code>-Wert steht nicht im Verzeichnis. Unbekannte Rollen werden verworfen; das Element gilt dann als gewöhnlicher Kasten.",
      pruefe: function (d) {
        var schlecht = [];
        alle(d, "[role]").forEach(function (el) {
          (el.getAttribute("role") || "").split(/\s+/).filter(Boolean).forEach(function (r) {
            if (ROLLEN.indexOf(r.toLowerCase()) === -1 && schlecht.indexOf(r) === -1) schlecht.push(r);
          });
        });
        if (schlecht.length) return { wie: "Nicht im Verzeichnis: " + schlecht.join(", ") + "." };
        return null;
      }
    },
    {
      id: "landmarke-ohne-namen", gruppe: "Barrierefreiheit", name: "Gleiche Bereiche ohne Namen", stufe: "hinweis", braucht: true,
      wozu: "Mehrere <code>nav</code>- oder <code>aside</code>-Bereiche ohne <code>aria-label</code>. In der Bereichsübersicht der Sprachausgabe heißen sie dann alle gleich.",
      pruefe: function (d) {
        var meldungen = [];
        ["nav", "aside"].forEach(function (n) {
          var welche = alle(d, n);
          if (welche.length < 2) return;
          var ohne = welche.filter(function (el) { return !el.getAttribute("aria-label") && !el.getAttribute("aria-labelledby"); });
          if (ohne.length > 1) meldungen.push(ohne.length + " × " + n);
        });
        if (meldungen.length) return { wie: "Ohne eigenen Namen: " + meldungen.join(", ") + "." };
        return null;
      }
    },
    {
      id: "kontrast-inline", gruppe: "Barrierefreiheit", name: "Zu schwacher Kontrast", stufe: "wichtig", braucht: false,
      wozu: "Ein Element setzt Schrift- und Hintergrundfarbe direkt im <code>style</code>-Attribut, und das Verhältnis liegt unter 4,5:1. Nur direkt gesetzte Paare können hier gemessen werden — was aus dem Stilblatt kommt, sieht dieser Prüfer nicht.",
      pruefe: function (d) {
        var schlecht = [];
        alle(d, "[style]").forEach(function (el) {
          var vorn = farbeLesen(stilWert(el, "color"));
          var hinten = farbeLesen(stilWert(el, "background-color") || stilWert(el, "background"));
          if (!vorn || !hinten) return;
          var k = kontrast(vorn, hinten);
          if (k < 4.5) schlecht.push(k.toFixed(2) + ":1 — " + kurz(el.outerHTML, 80));
        });
        if (schlecht.length) return { wie: schlecht.length + " Paar(e) unter 4,5:1.", fund: liste(schlecht, 4) };
        return null;
      }
    },
    {
      id: "bild-alt-redundant", gruppe: "Barrierefreiheit", name: "Alternativtext sagt „Bild“", stufe: "hinweis", braucht: false,
      wozu: "Der Alternativtext beginnt mit „Bild von“, „Grafik“ oder „Foto“. Die Sprachausgabe kündigt ohnehin schon ein Bild an; die Wiederholung kostet nur Zeit.",
      pruefe: function (d) {
        var schlecht = alle(d, "img[alt]").filter(function (b) {
          return /^(bild|grafik|foto|abbildung|image|picture|photo|logo)\b/i.test((b.getAttribute("alt") || "").trim());
        });
        if (schlecht.length) return { wie: schlecht.length + " Alternativtext(e) beginnen mit einer Gattungsbezeichnung.", fund: liste(schlecht.map(function (b) { return b.getAttribute("alt"); })) };
        return null;
      }
    },
    {
      id: "ueberschrift-als-stil", gruppe: "Barrierefreiheit", name: "Fettschrift statt Überschrift", stufe: "hinweis", braucht: false,
      wozu: "Ein Absatz besteht nur aus <code>strong</code> oder <code>b</code>. Das sieht aus wie eine Überschrift, zählt aber nicht als eine — die Gliederung bleibt lückenhaft.",
      pruefe: function (d) {
        var treffer = alle(d, "p").filter(function (p) {
          var k = p.children;
          if (k.length !== 1) return false;
          if (["strong", "b"].indexOf(k[0].localName) === -1) return false;
          return p.textContent.trim() === k[0].textContent.trim() && p.textContent.trim().length > 3;
        });
        if (treffer.length) return { wie: treffer.length + " Absatz/Absätze bestehen nur aus Fettschrift.", fund: liste(treffer.map(function (p) { return kurz(p.textContent, 70); })) };
        return null;
      }
    },
    {
      id: "listenelement-ohne-liste", gruppe: "Barrierefreiheit", name: "Listeneintrag ohne Liste", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>li</code> steht nicht in <code>ul</code>, <code>ol</code> oder <code>menu</code>. Die Sprachausgabe kann dann nicht sagen, wie viele Einträge es gibt.",
      pruefe: function (d) {
        var lose = alle(d, "li").filter(function (li) {
          var e = li.parentElement;
          return !e || ["ul", "ol", "menu"].indexOf(e.localName) === -1;
        });
        if (lose.length) return { wie: lose.length + " Listeneintrag/-einträge ohne umgebende Liste.", fund: liste(lose.map(function (li) { return kurz(li.textContent, 60); })) };
        return null;
      }
    },
    {
      id: "abkuerzung-ohne-erklaerung", gruppe: "Barrierefreiheit", name: "Abkürzung ohne Auflösung", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>abbr</code>-Element ohne <code>title</code>. Die Auszeichnung sagt dann „das ist eine Abkürzung“, ohne zu verraten wofür.",
      pruefe: function (d) {
        var ohne = alle(d, "abbr").filter(function (a) { return !(a.getAttribute("title") || "").trim(); });
        if (ohne.length) return { wie: ohne.length + " Abkürzung(en) ohne title.", fund: liste(ohne.map(function (a) { return a.textContent.trim(); })) };
        return null;
      }
    },

    /* ============ Erweiterte Auszeichnung ============ */
    {
      id: "ld-bild-fehlt", gruppe: "Auszeichnung und Vorschau", name: "Auszeichnung ohne Bild", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>Article</code>, <code>Product</code> oder <code>Recipe</code> ohne <code>image</code>. Ohne Bild fällt die Anzeige in der Trefferliste auf die schlichte Form zurück.",
      pruefe: function (d) {
        var typen = ["Article", "NewsArticle", "BlogPosting", "Product", "Recipe"];
        var ohne = ldTief(d).filter(function (o) {
          var t = [].concat(o["@type"] || []).map(String);
          return t.some(function (x) { return typen.indexOf(x) !== -1; }) && !o.image;
        });
        if (ohne.length) return { wie: ohne.length + " Objekt(e) ohne image-Angabe.", fund: liste(ohne.map(function (o) { return [].concat(o["@type"]).join("/"); })) };
        return null;
      }
    },
    {
      id: "ld-preis-ohne-waehrung", gruppe: "Auszeichnung und Vorschau", name: "Preis ohne Währung", stufe: "wichtig", braucht: false,
      wozu: "Ein <code>Offer</code> nennt <code>price</code>, aber kein <code>priceCurrency</code>. Eine Zahl ohne Währung ist kein Preis und wird verworfen.",
      pruefe: function (d) {
        var schlecht = ldTief(d).filter(function (o) {
          var t = [].concat(o["@type"] || []).map(String);
          return t.indexOf("Offer") !== -1 && o.price !== undefined && !o.priceCurrency;
        });
        if (schlecht.length) return { wie: schlecht.length + " Angebot(e) mit Preis, aber ohne Währung.", fund: liste(schlecht.map(function (o) { return "price: " + o.price; })) };
        return null;
      }
    },
    {
      id: "ld-bewertung-unvollstaendig", gruppe: "Auszeichnung und Vorschau", name: "Bewertung ohne Anzahl", stufe: "wichtig", braucht: false,
      wozu: "Ein <code>AggregateRating</code> ohne <code>ratingCount</code> oder <code>reviewCount</code>. Ein Durchschnitt ohne Grundgesamtheit wird nicht angezeigt.",
      pruefe: function (d) {
        var schlecht = ldTief(d).filter(function (o) {
          var t = [].concat(o["@type"] || []).map(String);
          return t.indexOf("AggregateRating") !== -1 && !o.ratingCount && !o.reviewCount;
        });
        if (schlecht.length) return { wie: schlecht.length + " Bewertung(en) ohne Anzahl." };
        return null;
      }
    },
    {
      id: "ld-brotkrumen-fehlt", gruppe: "Auszeichnung und Vorschau", name: "Kein Pfad ausgezeichnet", stufe: "hinweis", braucht: true,
      wozu: "Es gibt keine <code>BreadcrumbList</code>. Ohne sie zeigt die Trefferliste die nackte Adresse statt eines lesbaren Pfads.",
      pruefe: function (d) {
        var hat = ldTief(d).some(function (o) {
          return [].concat(o["@type"] || []).map(String).indexOf("BreadcrumbList") !== -1;
        });
        if (hat) return null;
        if (!alle(d, 'script[type="application/ld+json"]').length) return null;
        return { wie: "Es ist JSON-LD vorhanden, aber keine BreadcrumbList." };
      }
    },
    {
      id: "ld-herausgeber-fehlt", gruppe: "Auszeichnung und Vorschau", name: "Keine Angabe zum Betreiber", stufe: "hinweis", braucht: true,
      wozu: "Weder <code>Organization</code> noch <code>Person</code> noch <code>WebSite</code> ist ausgezeichnet. Die Suchmaschine muss dann raten, wer hinter der Seite steht.",
      pruefe: function (d) {
        if (!alle(d, 'script[type="application/ld+json"]').length) return null;
        var hat = ldTief(d).some(function (o) {
          var t = [].concat(o["@type"] || []).map(String);
          return ["Organization", "WebSite", "Person", "LocalBusiness"].some(function (x) { return t.indexOf(x) !== -1; });
        });
        if (hat) return null;
        return { wie: "Kein Objekt vom Typ Organization, WebSite, Person oder LocalBusiness." };
      }
    },
    {
      id: "ld-titel-weicht-ab", gruppe: "Auszeichnung und Vorschau", name: "Auszeichnung widerspricht dem Titel", stufe: "hinweis", braucht: false,
      wozu: "Die <code>headline</code> im JSON-LD hat kein einziges längeres Wort mit dem <code>title</code> gemeinsam. Widersprüchliche Angaben schwächen beide.",
      pruefe: function (d) {
        var t = seitentitel(d)[0];
        if (!t) return null;
        var titelWorte = t.textContent.toLowerCase().split(/[^a-zäöüß0-9]+/).filter(function (w) { return w.length > 4; });
        if (!titelWorte.length) return null;
        var schlecht = [];
        ldTief(d).forEach(function (o) {
          if (typeof o.headline !== "string" || o.headline.length < 10) return;
          var h = o.headline.toLowerCase();
          if (!titelWorte.some(function (w) { return h.indexOf(w) !== -1; })) schlecht.push(o.headline);
        });
        if (schlecht.length) return { wie: schlecht.length + " headline ohne gemeinsames Wort mit dem Titel.", fund: liste(schlecht) };
        return null;
      }
    },
    {
      id: "mikrodaten-gemischt", gruppe: "Auszeichnung und Vorschau", name: "Zwei Auszeichnungsarten nebeneinander", stufe: "hinweis", braucht: false,
      wozu: "Die Seite benutzt <code>itemscope</code>-Mikrodaten und JSON-LD gleichzeitig. Widersprechen sich beide, ist nicht festgelegt, welche gewinnt.",
      pruefe: function (d) {
        var mikro = alle(d, "[itemscope]").length;
        var ld = alle(d, 'script[type="application/ld+json"]').length;
        if (mikro && ld) return { wie: mikro + " Mikrodaten-Bereich(e) und " + ld + " JSON-LD-Block/Blöcke." };
        return null;
      }
    },
    {
      id: "zeitstempel-widerspruch", gruppe: "Auszeichnung und Vorschau", name: "Änderung vor Veröffentlichung", stufe: "hinweis", braucht: false,
      wozu: "<code>dateModified</code> liegt vor <code>datePublished</code>. Eine der beiden Angaben stimmt nicht.",
      pruefe: function (d) {
        var schlecht = [];
        ldTief(d).forEach(function (o) {
          if (!o.datePublished || !o.dateModified) return;
          var a = Date.parse(o.datePublished), b = Date.parse(o.dateModified);
          if (!isNaN(a) && !isNaN(b) && b < a) schlecht.push(o.datePublished + " → " + o.dateModified);
        });
        if (schlecht.length) return { wie: "Änderungsdatum liegt vor dem Veröffentlichungsdatum.", fund: liste(schlecht) };
        return null;
      }
    },

    /* ============ Erweitertes Ladeverhalten ============ */
    {
      id: "vorrangbild-lazy", gruppe: "Ladeverhalten", name: "Erstes Bild wird verzögert geladen", stufe: "wichtig", braucht: true,
      wozu: "Das erste Bild im Dokument hat <code>loading=\"lazy\"</code>. Genau dieses Bild ist meist das große im sichtbaren Bereich; verzögert geladen verschiebt es den gemessenen Ladezeitpunkt nach hinten.",
      pruefe: function (d) {
        if (!d.body) return null;
        var bilder = alle(d.body, "img");
        if (!bilder.length) return null;
        var erstes = bilder[0];
        if ((erstes.getAttribute("loading") || "").toLowerCase() === "lazy") {
          return { wie: "Das erste Bild lädt verzögert.", fund: kurz(erstes.outerHTML, 120) };
        }
        return null;
      }
    },
    {
      id: "bild-ohne-srcset", gruppe: "Ladeverhalten", name: "Keine Bildgrößen angeboten", stufe: "hinweis", braucht: false,
      wozu: "Bilder ohne <code>srcset</code> werden auf dem Telefon in voller Größe geladen. Ein Bild für 1600 px kostet dort ein Vielfaches dessen, was gebraucht wird.",
      pruefe: function (d) {
        var ohne = alle(d, "img").filter(function (b) {
          if (b.hasAttribute("srcset")) return false;
          var e = b.parentElement;
          if (e && e.localName === "picture") return false;
          var breite = parseInt(b.getAttribute("width") || "0", 10);
          return breite === 0 || breite > 400;
        });
        if (ohne.length > 2) return { wie: ohne.length + " größere Bilder ohne srcset.", fund: liste(ohne.map(function (b) { return b.getAttribute("src") || "(ohne src)"; })) };
        return null;
      }
    },
    {
      id: "schrift-ohne-vorabladen", gruppe: "Ladeverhalten", name: "Schrift ohne Vorabladen", stufe: "hinweis", braucht: false,
      wozu: "Es werden eigene Schriften eingebunden, aber keine mit <code>rel=\"preload\"</code> angekündigt. Der Browser findet sie erst, wenn er das Stilblatt gelesen hat — die Schrift springt dann sichtbar um.",
      pruefe: function (d) {
        var hatSchrift = /@font-face/i.test(stilQuellen(d)) || alle(d, 'link[href]').some(function (l) {
          return /\.(woff2?|ttf|otf)(\?|$)/i.test(l.getAttribute("href") || "");
        });
        if (!hatSchrift) return null;
        var vorab = alle(d, 'link[rel="preload" i]').some(function (l) {
          return (l.getAttribute("as") || "").toLowerCase() === "font";
        });
        if (vorab) return null;
        return { wie: "Eigene Schriften vorhanden, aber keine per preload angekündigt." };
      }
    },
    {
      id: "schrift-ohne-anzeige", gruppe: "Ladeverhalten", name: "Schrift ohne Anzeigeregel", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>@font-face</code> ohne <code>font-display</code>. Der Text bleibt dann bis zu drei Sekunden unsichtbar, während die Schrift lädt.",
      pruefe: function (d) {
        var bloecke = stilQuellen(d).match(/@font-face\s*\{[^}]*\}/gi);
        if (!bloecke) return null;
        var ohne = bloecke.filter(function (b) { return !/font-display/i.test(b); });
        if (ohne.length) return { wie: ohne.length + " von " + bloecke.length + " @font-face ohne font-display.", fund: kurz(ohne[0], 160) };
        return null;
      }
    },
    {
      id: "stil-import", gruppe: "Ladeverhalten", name: "Stilblatt lädt Stilblatt nach", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>@import</code> im Stil. Der Browser sieht die zweite Datei erst, wenn die erste da ist — zwei Wartezeiten hintereinander statt nebeneinander.",
      pruefe: function (d) {
        var treffer = stilQuellen(d).match(/@import\s+[^;]{3,120};/gi);
        if (treffer) return { wie: treffer.length + " @import gefunden.", fund: liste(treffer) };
        return null;
      }
    },
    {
      id: "dokument-gross", gruppe: "Ladeverhalten", name: "Dokument sehr groß", stufe: "hinweis", braucht: true,
      wozu: "Der Quelltext ist größer als 150 KB. Alles davon muss übertragen und geparst werden, bevor überhaupt etwas zu sehen ist.",
      pruefe: function (d, roh) {
        var bytes = String(roh).length;
        if (bytes > 150000) return { wie: Math.round(bytes / 1024) + " KB Quelltext." };
        return null;
      }
    },
    {
      id: "bild-menge", gruppe: "Ladeverhalten", name: "Sehr viele Bilder", stufe: "hinweis", braucht: false,
      wozu: "Mehr als 50 Bilder auf einer Seite. Jedes ist eine eigene Anfrage; auf langsamen Verbindungen summiert sich das.",
      pruefe: function (d) {
        var n = alle(d, "img").length;
        if (n > 50) return { wie: n + " Bilder im Dokument." };
        return null;
      }
    },

    /* ============ Erweiterte Verweise ============ */
    {
      id: "verweis-toter-anker", gruppe: "Verweise", name: "Sprungmarke ohne Ziel", stufe: "wichtig", braucht: true,
      wozu: "Ein Verweis auf <code>#name</code>, zu dem es im Dokument keine passende Kennung gibt. Der Klick bewirkt nichts.",
      pruefe: function (d) {
        var ids = kennungen(d), kaputt = [];
        alle(d, "a[href]").forEach(function (a) {
          var ziel = a.getAttribute("href") || "";
          if (ziel.charAt(0) !== "#" || ziel === "#") return;
          var name = decodeURIComponent(ziel.slice(1));
          if (!ids[name] && name !== "top") kaputt.push(ziel);
        });
        if (kaputt.length) return { wie: kaputt.length + " Verweis(e) auf fehlende Sprungmarken.", fund: liste(kaputt) };
        return null;
      }
    },
    {
      id: "verweis-http", gruppe: "Verweise", name: "Verweis auf unverschlüsselte Adresse", stufe: "wichtig", braucht: false,
      wozu: "Ein Verweis zeigt auf <code>http://</code>. Der Besucher landet auf einer Seite, vor der sein Browser warnt — oder auf einer Weiterleitung, die Zeit kostet.",
      pruefe: function (d) {
        var offen = alle(d, "a[href]").filter(function (a) { return /^http:\/\//i.test(a.getAttribute("href") || ""); });
        if (offen.length) return { wie: offen.length + " Verweis(e) auf http.", fund: liste(offen.map(function (a) { return a.getAttribute("href"); })) };
        return null;
      }
    },
    {
      id: "verweis-auf-sich-selbst", gruppe: "Verweise", name: "Verweis auf die eigene Seite", stufe: "hinweis", braucht: false,
      wozu: "Ein Verweis zeigt genau auf die Adresse, unter der die Seite selbst steht. Der Klick lädt dieselbe Seite neu, ohne dass etwas passiert.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        if (!a) return null;
        var eigen = a.href.replace(/#.*$/, "").replace(/\/$/, "");
        var treffer = alle(d, "a[href]").filter(function (v) {
          var z = (v.getAttribute("href") || "").replace(/#.*$/, "").replace(/\/$/, "");
          return z && z === eigen;
        });
        if (treffer.length) return { wie: treffer.length + " Verweis(e) auf die eigene Adresse.", fund: liste(treffer.map(function (v) { return kurz(v.textContent, 50) + " → " + v.getAttribute("href"); })) };
        return null;
      }
    },
    {
      id: "verweis-titel-doppelt", gruppe: "Verweise", name: "title wiederholt den Verweistext", stufe: "hinweis", braucht: false,
      wozu: "Der <code>title</code> eines Verweises sagt dasselbe wie sein Text. Die Sprachausgabe liest beides vor, und die Maus zeigt eine Sprechblase ohne Neuigkeit.",
      pruefe: function (d) {
        var doppelt = alle(d, "a[title]").filter(function (a) {
          var t = (a.getAttribute("title") || "").trim().toLowerCase();
          return t && t === a.textContent.trim().toLowerCase();
        });
        if (doppelt.length) return { wie: doppelt.length + " Verweis(e) mit gleichlautendem title.", fund: liste(doppelt.map(function (a) { return a.getAttribute("title"); })) };
        return null;
      }
    },
    {
      id: "verweis-wenig-intern", gruppe: "Verweise", name: "Kaum interne Verweise", stufe: "hinweis", braucht: true,
      wozu: "Weniger als drei Verweise führen auf dieselbe Website. Eine Seite ohne Anschluss an den Rest wird selten besucht und selten gefunden.",
      pruefe: function (d) {
        var a = eigeneAdresse(d);
        var intern = alle(d, "a[href]").filter(function (v) {
          var z = (v.getAttribute("href") || "").trim();
          if (!z || z.charAt(0) === "#" || /^(mailto|tel|javascript):/i.test(z)) return false;
          if (!/^https?:\/\//i.test(z)) return true;
          return a ? hostVon(z) === a.host.toLowerCase() : false;
        });
        if (intern.length < 3) return { wie: "Nur " + intern.length + " interne(r) Verweis(e) gefunden." };
        return null;
      }
    },
    {
      id: "verweis-adresse-im-text", gruppe: "Verweise", name: "Adresse als Verweistext", stufe: "hinweis", braucht: false,
      wozu: "Der sichtbare Text eines Verweises ist eine Adresse. Vorgelesen ergibt das eine Buchstabenkette; als Beschreibung des Ziels taugt sie nicht.",
      pruefe: function (d) {
        var roh = alle(d, "a[href]").filter(function (a) {
          return /^(https?:\/\/|www\.)\S+$/i.test(a.textContent.trim());
        });
        if (roh.length) return { wie: roh.length + " Verweis(e) mit einer Adresse als Text.", fund: liste(roh.map(function (a) { return a.textContent.trim(); })) };
        return null;
      }
    },

    /* ============ Erweiterte Indexierung ============ */
    {
      id: "indexierung-widerspruch", gruppe: "Indexierung", name: "noindex trotz canonical", stufe: "wichtig", braucht: false,
      wozu: "Die Seite ist auf <code>noindex</code> gesetzt und nennt zugleich eine kanonische Adresse. Beides zusammen ist widersprüchlich: was nicht in den Index soll, braucht auch keinen Vorzug.",
      pruefe: function (d) {
        var robots = robotsAngabe(d);
        if (robots.indexOf("noindex") === -1) return null;
        var k = d.querySelector('link[rel="canonical" i]');
        if (!k) return null;
        return { wie: "noindex gesetzt und canonical vorhanden.", fund: k.outerHTML };
      }
    },
    {
      id: "kanonisch-widerspricht-og", gruppe: "Indexierung", name: "canonical und og:url weichen ab", stufe: "hinweis", braucht: false,
      wozu: "<code>canonical</code> und <code>og:url</code> nennen verschiedene Adressen. Suchmaschinen folgen der einen, geteilte Verweise der anderen.",
      pruefe: function (d) {
        var k = d.querySelector('link[rel="canonical" i]');
        var og = d.querySelector('meta[property="og:url" i]');
        if (!k || !og) return null;
        var a = (k.getAttribute("href") || "").trim().replace(/\/$/, "");
        var b = inhalt(og).replace(/\/$/, "");
        if (a && b && a !== b) return { wie: "Zwei verschiedene Adressen im selben Dokument.", fund: "canonical: " + a + "\nog:url:    " + b };
        return null;
      }
    },
    {
      id: "weiterleitung-per-skript", gruppe: "Indexierung", name: "Weiterleitung im Skript", stufe: "hinweis", braucht: false,
      wozu: "Ein Skript setzt <code>location.href</code> oder <code>location.replace</code>. Solche Weiterleitungen sind für Suchmaschinen schlecht lesbar; ein Server-Umzug mit Statuscode 301 ist eindeutig.",
      pruefe: function (d) {
        var treffer = skriptQuellen(d).match(/location\s*\.\s*(href|replace)\s*[=(]/gi);
        if (treffer) return { wie: treffer.length + " Weiterleitung(en) im Skript gefunden." };
        return null;
      }
    },
    {
      id: "sitemap-nicht-verwiesen", gruppe: "Indexierung", name: "Keine Sitemap genannt", stufe: "hinweis", braucht: true,
      wozu: "Es gibt keinen <code>link rel=\"sitemap\"</code>. Die Angabe ist selten, aber sie kostet eine Zeile und macht das Verzeichnis auffindbar.",
      pruefe: function (d) {
        if (d.querySelector('link[rel="sitemap" i]')) return null;
        return { wie: "Kein Verweis auf eine Sitemap im Kopfbereich." };
      }
    },

    /* ============ Erweiterter Inhalt ============ */
    {
      id: "platzhaltertext", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Platzhaltertext im Inhalt", stufe: "wichtig", braucht: false,
      wozu: "Im sichtbaren Text steht „Lorem ipsum“, „TODO“ oder eine eckige Klammer mit „ergänzen“. Solche Reste gehören nicht auf eine veröffentlichte Seite.",
      pruefe: function (d) {
        var text = sichtbarerText(d);
        /* Nur Muster, die auf einer fertigen Seite nichts zu suchen haben.
           Das blosse Wort „Platzhalter" reicht nicht — eine Seite darf
           ueber Platzhalter schreiben, ohne selbst einer zu sein. */
        var muster = [/lorem ipsum/i, /\bTODO\b/, /\bFIXME\b/, /blindtext/i,
          /\[[^\]]{0,40}(ergänzen|ergaenzen|platzhalter|tbd)\]/i];
        var treffer = [];
        muster.forEach(function (m) {
          var t = text.match(m);
          if (t) treffer.push(t[0]);
        });
        if (treffer.length) return { wie: "Gefunden: " + treffer.join(", ") + ".", fund: liste(treffer) };
        return null;
      }
    },
    {
      id: "text-code-anteil", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Wenig Text, viel Gerüst", stufe: "hinweis", braucht: true,
      wozu: "Der sichtbare Text macht weniger als ein Zehntel des Quelltextes aus. Das deutet auf ein aufgeblähtes Gerüst hin — nichts davon liest ein Mensch.",
      pruefe: function (d, roh) {
        var gesamt = String(roh).length;
        if (gesamt < 2000) return null;
        var text = sichtbarerText(d).length;
        var anteil = text / gesamt;
        if (anteil < 0.1) return { wie: Math.round(anteil * 1000) / 10 + " % des Quelltextes ist sichtbarer Text (" + text + " von " + gesamt + " Zeichen)." };
        return null;
      }
    },
    {
      id: "satz-zu-lang", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Sätze im Schnitt zu lang", stufe: "hinweis", braucht: false,
      wozu: "Der Durchschnittssatz hat mehr als 25 Wörter. Lange Sätze werden schlechter gelesen und liefern Antwortmaschinen keine zitierfähige Einheit.",
      pruefe: function (d) {
        var l = lesbarkeit(sichtbarerText(d));
        if (!l) return null;
        if (l.satzlaenge > 25) return { wie: "Im Schnitt " + l.satzlaenge + " Wörter je Satz, bei " + l.saetze + " Sätzen." };
        return null;
      }
    },
    {
      id: "schwer-lesbar", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Text schwer lesbar", stufe: "hinweis", braucht: false,
      wozu: "Der Lesbarkeitswert nach Amstad liegt unter 30, das entspricht Fachliteratur. Die Silbenzählung ist eine Näherung; der Wert ist ein Anhaltspunkt, kein Urteil.",
      pruefe: function (d) {
        var l = lesbarkeit(sichtbarerText(d));
        if (!l) return null;
        if (l.wert < 30) return { wie: "Lesbarkeitswert " + l.wert + " von 100, bei " + l.woerter + " Wörtern und " + l.satzlaenge + " Wörtern je Satz." };
        return null;
      }
    },
    {
      id: "stichwort-gestopft", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Ein Wort dominiert", stufe: "hinweis", braucht: false,
      wozu: "Ein einzelnes Wort macht mehr als vier Prozent des Textes aus. Das liest sich unnatürlich und war nie ein Rangfaktor.",
      pruefe: function (d) {
        var text = sichtbarerText(d);
        if (text.split(/\s+/).length < 120) return null;
        var feld = wortfeld(text, 1);
        var oben = feld.liste[0];
        if (!oben) return null;
        var anteil = oben.anzahl / feld.gesamt;
        if (anteil > 0.04) return { wie: "„" + oben.wort + "“ macht " + (Math.round(anteil * 1000) / 10) + " % aus (" + oben.anzahl + " von " + feld.gesamt + " Wörtern)." };
        return null;
      }
    },
    {
      id: "titel-ohne-bezug-h1", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Titel und Überschrift ohne Bezug", stufe: "hinweis", braucht: false,
      wozu: "<code>title</code> und <code>h1</code> haben kein längeres Wort gemeinsam. Wer über die Trefferliste kommt, findet oben auf der Seite ein anderes Thema vor.",
      pruefe: function (d) {
        var t = seitentitel(d)[0], h = d.querySelector("h1");
        if (!t || !h) return null;
        var a = t.textContent.toLowerCase().split(/[^a-zäöüß0-9]+/).filter(function (w) { return w.length > 4; });
        var b = h.textContent.toLowerCase();
        if (!a.length || !b.trim()) return null;
        if (a.some(function (w) { return b.indexOf(w) !== -1; })) return null;
        return { wie: "Kein gemeinsames Wort mit mehr als vier Buchstaben.", fund: "title: " + kurz(t.textContent, 70) + "\nh1:    " + kurz(h.textContent, 70) };
      }
    },
    {
      id: "beschreibung-ohne-bezug", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Beschreibung ohne Bezug zum Text", stufe: "hinweis", braucht: true,
      wozu: "Kein längeres Wort aus der <code>description</code> kommt im sichtbaren Text vor. Dann verspricht die Trefferliste etwas, das die Seite nicht einlöst.",
      pruefe: function (d) {
        var m = d.querySelector('meta[name="description" i]');
        if (!m) return null;
        var b = inhalt(m).toLowerCase();
        if (b.length < 30) return null;
        var worte = b.split(/[^a-zäöüß0-9]+/).filter(function (w) { return w.length > 5; });
        if (!worte.length) return null;
        var text = sichtbarerText(d).toLowerCase();
        if (text.length < 200) return null;
        var treffer = worte.filter(function (w) { return text.indexOf(w) !== -1; });
        if (treffer.length === 0) return { wie: "Keines der " + worte.length + " längeren Wörter aus der Beschreibung steht im Text.", fund: inhalt(m) };
        return null;
      }
    },
    {
      id: "absatz-doppelt", gruppe: "Inhalt und KI-Sichtbarkeit", name: "Absatz kommt doppelt vor", stufe: "hinweis", braucht: false,
      wozu: "Zwei Absätze mit mehr als zwanzig Wörtern sind wortgleich. Meist ein Kopierfehler, manchmal ein Baustein, der zweimal eingebunden wurde.",
      pruefe: function (d) {
        var gesehen = {}, doppelt = [];
        alle(d, "p").forEach(function (p) {
          var t = p.textContent.replace(/\s+/g, " ").trim();
          if (t.split(" ").length < 20) return;
          if (gesehen[t]) { if (doppelt.indexOf(t) === -1) doppelt.push(t); }
          else gesehen[t] = true;
        });
        if (doppelt.length) return { wie: doppelt.length + " Absatz/Absätze doppelt.", fund: liste(doppelt.map(function (t) { return kurz(t, 90); }), 3) };
        return null;
      }
    },
    {
      id: "ueberschrift-doppelt", gruppe: "Gliederung und Semantik", name: "Gleiche Überschrift mehrfach", stufe: "hinweis", braucht: false,
      wozu: "Dieselbe Überschrift steht mehrfach auf der Seite. Im Inhaltsverzeichnis und in der Bereichsübersicht sind die Einträge dann nicht unterscheidbar.",
      pruefe: function (d) {
        var gesehen = {}, doppelt = [];
        alle(d, "h1, h2, h3, h4, h5, h6").forEach(function (h) {
          var t = h.textContent.replace(/\s+/g, " ").trim().toLowerCase();
          if (t.length < 4) return;
          if (gesehen[t]) { if (doppelt.indexOf(t) === -1) doppelt.push(t); }
          else gesehen[t] = true;
        });
        if (doppelt.length) return { wie: doppelt.length + " Überschrift(en) kommen mehrfach vor.", fund: liste(doppelt) };
        return null;
      }
    },
    {
      id: "ueberschrift-sehr-viele", gruppe: "Gliederung und Semantik", name: "Sehr viele Überschriften", stufe: "hinweis", braucht: false,
      wozu: "Mehr als vierzig Überschriften. Entweder ist die Seite zu lang, oder Überschriften werden als Gestaltungsmittel benutzt statt als Gliederung.",
      pruefe: function (d) {
        var n = alle(d, "h1, h2, h3, h4, h5, h6").length;
        if (n > 40) return { wie: n + " Überschriften im Dokument." };
        return null;
      }
    },
    {
      id: "abschnitt-ohne-ueberschrift", gruppe: "Gliederung und Semantik", name: "Abschnitt ohne Überschrift", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>section</code>-Element ohne Überschrift und ohne <code>aria-label</code>. Ein Abschnitt, der nicht sagt worum es geht, ist nur ein Kasten.",
      pruefe: function (d) {
        var ohne = alle(d, "section").filter(function (s) {
          if (s.getAttribute("aria-label") || s.getAttribute("aria-labelledby")) return false;
          return !s.querySelector("h1, h2, h3, h4, h5, h6");
        });
        if (ohne.length) return { wie: ohne.length + " Abschnitt(e) ohne Überschrift und ohne Namen." };
        return null;
      }
    },
    {
      id: "artikel-ohne-ueberschrift", gruppe: "Gliederung und Semantik", name: "Artikel ohne Überschrift", stufe: "hinweis", braucht: false,
      wozu: "Ein <code>article</code> ohne eigene Überschrift. Ein Artikel soll für sich allein stehen können; ohne Titel gelingt das nicht.",
      pruefe: function (d) {
        var ohne = alle(d, "article").filter(function (a) { return !a.querySelector("h1, h2, h3, h4, h5, h6"); });
        if (ohne.length) return { wie: ohne.length + " Artikel ohne Überschrift." };
        return null;
      }
    },

    /* ============ Erweiterte Formulare ============ */
    {
      id: "feld-ohne-namen", gruppe: "Formulare und Bedienung", name: "Feld ohne name", stufe: "wichtig", braucht: false,
      wozu: "Ein Eingabefeld in einem Formular ohne <code>name</code> wird beim Absenden nicht mitgeschickt. Der Besucher tippt etwas ein, das nirgends ankommt. Felder ausserhalb eines Formulars sind nicht gemeint — die werden ohnehin nie abgeschickt.",
      pruefe: function (d) {
        var ohne = alle(d, "input, select, textarea").filter(function (f) {
          var typ = (f.getAttribute("type") || "").toLowerCase();
          if (["submit", "button", "reset", "image"].indexOf(typ) !== -1) return false;
          /* Ohne Formular gibt es kein Absenden und damit kein Problem. */
          if (!f.closest("form")) return false;
          return !(f.getAttribute("name") || "").trim();
        });
        if (ohne.length) return { wie: ohne.length + " Feld(er) ohne name-Angabe.", fund: liste(ohne.map(function (f) { return kurz(f.outerHTML, 80); })) };
        return null;
      }
    },
    {
      id: "feld-ohne-autofuellhinweis", gruppe: "Formulare und Bedienung", name: "Kein Hinweis zum Ausfüllen", stufe: "hinweis", braucht: false,
      wozu: "Felder für Namen, Anschrift oder E-Mail ohne <code>autocomplete</code>. Mit der Angabe füllt der Browser sie in einem Schritt; ohne sie tippt jeder alles neu.",
      pruefe: function (d) {
        var kandidaten = alle(d, "input").filter(function (f) {
          var typ = (f.getAttribute("type") || "text").toLowerCase();
          if (["email", "tel", "text"].indexOf(typ) === -1) return false;
          var name = ((f.getAttribute("name") || "") + " " + (f.getAttribute("id") || "")).toLowerCase();
          return /mail|name|stra|plz|ort|city|zip|phone|tel|adress|address/.test(name);
        });
        var ohne = kandidaten.filter(function (f) { return !(f.getAttribute("autocomplete") || "").trim(); });
        if (ohne.length) return { wie: ohne.length + " von " + kandidaten.length + " Kontaktfeld(ern) ohne autocomplete.", fund: liste(ohne.map(function (f) { return f.getAttribute("name") || f.getAttribute("id") || "(ohne Namen)"; })) };
        return null;
      }
    },
    {
      id: "formular-ohne-absenden", gruppe: "Formulare und Bedienung", name: "Formular ohne Absendeknopf", stufe: "wichtig", braucht: false,
      wozu: "Ein Formular ohne <code>submit</code>-Knopf. Mit der Tastatur ist es dann oft gar nicht abzuschicken.",
      pruefe: function (d) {
        var ohne = alle(d, "form").filter(function (f) {
          return !f.querySelector('button[type="submit" i], input[type="submit" i], input[type="image" i]')
            && !f.querySelector("button");
        });
        if (ohne.length) return { wie: ohne.length + " Formular(e) ohne Absendeknopf." };
        return null;
      }
    },
    {
      id: "pflichtfeld-nicht-erkennbar", gruppe: "Formulare und Bedienung", name: "Pflicht nur durch Sternchen", stufe: "hinweis", braucht: false,
      wozu: "Die Beschriftung trägt ein Sternchen, das Feld aber kein <code>required</code>. Wer nicht sieht, erfährt nichts von der Pflicht.",
      pruefe: function (d) {
        var verdacht = alle(d, "label").filter(function (l) { return l.textContent.indexOf("*") !== -1; });
        if (!verdacht.length) return null;
        var ids = {};
        alle(d, "input, select, textarea").forEach(function (f) {
          if (f.getAttribute("id")) ids[f.getAttribute("id")] = f;
        });
        var offen = verdacht.filter(function (l) {
          var f = ids[l.getAttribute("for")];
          return f && !f.hasAttribute("required") && !f.getAttribute("aria-required");
        });
        if (offen.length) return { wie: offen.length + " Beschriftung(en) mit Sternchen, aber ohne required am Feld.", fund: liste(offen.map(function (l) { return kurz(l.textContent, 50); })) };
        return null;
      }
    },
  ];

  /* Die Zusatzangaben anheften. Faellt eine Regel durch das Raster, bleibt
     sie nutzbar, faellt aber im Selbsttest auf. */
  REGELN.forEach(function (r) {
    var z = ZUSATZ[r.id];
    r.beheben = z ? z[0] : "";
    r.wirkung = z ? z[1] : "unbestimmt";
    r.gewicht = z ? z[2] : 1;
  });

  SEORANK_MESSEN.px = px;
  SEORANK_MESSEN.kurz = kurz;
  SEORANK_MESSEN.alle = alle;
  SEORANK_MESSEN.inhalt = inhalt;
  SEORANK_MESSEN.hostVon = hostVon;
  SEORANK_MESSEN.woerterZaehlen = woerterZaehlen;
  SEORANK_MESSEN.ldObjekte = ldObjekte;
  SEORANK_MESSEN.ldTief = ldTief;
  SEORANK_MESSEN.fremdadressen = fremdadressen;
  SEORANK_MESSEN.robotsAngabe = robotsAngabe;
  SEORANK_MESSEN.eigeneAdresse = eigeneAdresse;
  SEORANK_MESSEN.sichtbarerText = sichtbarerText;
  SEORANK_MESSEN.saetze = saetze;
  SEORANK_MESSEN.silben = silben;
  SEORANK_MESSEN.lesbarkeit = lesbarkeit;
  SEORANK_MESSEN.wortfeld = wortfeld;
  SEORANK_MESSEN.kontrast = kontrast;
  SEORANK_MESSEN.farbeLesen = farbeLesen;
  SEORANK_MESSEN.kennungen = kennungen;
  SEORANK_MESSEN.seitentitel = seitentitel;
  SEORANK_MESSEN.GRENZE_TITEL = GRENZE_TITEL;
  SEORANK_MESSEN.GRENZE_TEXT = GRENZE_TEXT;

  return REGELN;
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = SEORANK_KATALOG;
  module.exports.messen = SEORANK_MESSEN;
}
