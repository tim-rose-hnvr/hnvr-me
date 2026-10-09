/* seo-rank.me — WDF·IDF: Begriffsgewicht im Vergleich.

   WDF·IDF ist kein Rangfaktor und keine Zauberzahl. Es ist ein
   Vergleichsinstrument: es sagt, welche Begriffe die Seiten zu einem Thema
   tragen — und welche davon auf Ihrer Seite fehlen oder ueberbetont sind.

   Die Rechnung:
     WDF  = log2(Haeufigkeit + 1) / log2(Woerter im Dokument)
     IDF  = log2(Dokumente gesamt / Dokumente mit diesem Begriff)
     Wert = WDF x IDF

   Entscheidend und hier ausdruecklich gesagt: der Wert haengt VOLLSTAENDIG
   an dem Vergleichsfeld, das Sie einlegen. Ohne Vergleichsseiten ist IDF
   bedeutungslos. Es werden keine Seiten abgerufen — Sie fuegen ein, was
   verglichen werden soll. Genau deshalb ist die Rechnung nachvollziehbar.

   Rechnet vollstaendig im Browser. */

(function () {
  "use strict";

  var werkzeug = document.getElementById("wdf");
  if (!werkzeug) return;

  var M = (typeof SEORANK_MESSEN !== "undefined") ? SEORANK_MESSEN : null;
  var BEWEGUNG = window.SEORANK || null;
  var ANSICHT = (typeof SEORANK_ANSICHT !== "undefined") ? SEORANK_ANSICHT : null;
  if (!M) return;

  var eigenFeld = document.getElementById("w-eigen");
  var korpusFeld = document.getElementById("w-korpus");
  var starten = document.getElementById("w-starten");
  var beispiel = document.getElementById("w-beispiel");
  var leeren = document.getElementById("w-leeren");
  var laden = document.getElementById("w-laden");
  var ergebnis = document.getElementById("w-ergebnis");
  var hinweis = document.getElementById("w-hinweis");
  var registerleiste = document.getElementById("w-register");
  var blaetter = document.getElementById("w-blaetter");

  var HOECHSTE_VERGLEICH = 10;
  var ZEILEN = 40;
  var letzterLauf = null;
  var waehlen = null;

  function melden(text, warnung) {
    hinweis.textContent = text;
    hinweis.classList.toggle("formhinweis--warn", !!warnung);
  }

  function el(name, klasse, text) {
    var k = document.createElement(name);
    if (klasse) k.className = klasse;
    if (text !== undefined && text !== null) k.textContent = String(text);
    return k;
  }

  function blatt(name) {
    return blaetter.querySelector('[data-blatt="' + name + '"]');
  }

  /* ---------- Text aus einem Block holen ----------
     Angenommen wird HTML; wer reinen Text einfuegt, bekommt ihn ebenso
     gemessen — der Parser laesst ihn dann einfach stehen. */

  function textVon(block) {
    var d = new DOMParser().parseFromString(block, "text/html");
    return {
      text: M.sichtbarerText(d),
      name: (function () {
        var t = M.seitentitel ? M.seitentitel(d)[0] : d.querySelector("title");
        if (t && t.textContent.trim()) return t.textContent.replace(/\s+/g, " ").trim().slice(0, 48);
        var a = M.eigeneAdresse ? M.eigeneAdresse(d) : null;
        return a ? a.host + a.pathname : null;
      })()
    };
  }

  /* ---------- Die Rechnung ---------- */

  function wdfVon(anzahl, woerter) {
    if (!anzahl || woerter < 2) return 0;
    return Math.log2(anzahl + 1) / Math.log2(woerter);
  }

  function rechnen(eigen, vergleiche, laenge) {
    var dokumente = [eigen].concat(vergleiche);
    var anzahlDok = dokumente.length;

    /* Haeufigkeiten je Dokument */
    var felder = dokumente.map(function (d) {
      var feld = M.wortfeld(d.text, laenge);
      var karte = {};
      feld.liste.forEach(function (e) { karte[e.wort] = e.anzahl; });
      return { karte: karte, gesamt: feld.gesamt };
    });

    /* In wie vielen Dokumenten kommt ein Begriff vor? */
    var vorkommen = {};
    felder.forEach(function (f) {
      Object.keys(f.karte).forEach(function (w) {
        vorkommen[w] = (vorkommen[w] || 0) + 1;
      });
    });

    var eigenes = felder[0];
    var reihe = Object.keys(vorkommen).map(function (wort) {
      var idf = Math.log2(anzahlDok / vorkommen[wort]);

      var eigenerWdf = wdfVon(eigenes.karte[wort] || 0, eigenes.gesamt);
      var eigenerWert = eigenerWdf * idf;

      var fremdeWerte = felder.slice(1).map(function (f) {
        return wdfVon(f.karte[wort] || 0, f.gesamt) * idf;
      });
      var summe = fremdeWerte.reduce(function (s, x) { return s + x; }, 0);
      var mittel = fremdeWerte.length ? summe / fremdeWerte.length : 0;
      var hoechster = fremdeWerte.length ? Math.max.apply(null, fremdeWerte) : 0;

      /* In wie vielen VERGLEICHSSEITEN steht der Begriff? */
      var inVergleich = felder.slice(1).filter(function (f) { return f.karte[wort]; }).length;

      return {
        wort: wort,
        eigenAnzahl: eigenes.karte[wort] || 0,
        eigen: eigenerWert,
        mittel: mittel,
        hoechster: hoechster,
        inVergleich: inVergleich,
        vergleichsseiten: felder.length - 1,
        idf: idf
      };
    });

    /* Urteil je Begriff. Die Schwellen sind Handwerk, keine Wissenschaft —
       sie stehen deshalb auf der Seite. */
    reihe.forEach(function (e) {
      var haelfte = Math.ceil(e.vergleichsseiten / 2);
      /* WICHTIG: „steht auf meiner Seite" wird an der Haeufigkeit gemessen,
         nicht am Wert. Ein Begriff, der in JEDEM Dokument steht, hat
         IDF = 0 und damit Wert 0 — vorhanden ist er trotzdem. */
      if (e.eigenAnzahl === 0 && e.inVergleich >= haelfte && e.inVergleich > 0) e.urteil = "fehlt";
      else if (e.eigenAnzahl === 0) e.urteil = "nicht vorhanden";
      else if (e.inVergleich === 0) e.urteil = "nur bei Ihnen";
      else if (e.idf === 0) e.urteil = "überall";
      else if (e.mittel > 0 && e.eigen < e.mittel * 0.5) e.urteil = "schwach";
      else if (e.hoechster > 0 && e.eigen > e.hoechster * 2) e.urteil = "überbetont";
      else e.urteil = "passend";
    });

    /* Sortiert nach dem, was das Vergleichsfeld traegt. */
    reihe.sort(function (a, b) {
      return b.inVergleich - a.inVergleich || b.mittel - a.mittel
        || b.eigen - a.eigen || a.wort.localeCompare(b.wort);
    });

    return {
      reihe: reihe,
      dokumente: anzahlDok,
      woerterEigen: eigenes.gesamt,
      namen: dokumente.map(function (d, i) { return d.name || (i === 0 ? "Ihre Seite" : "Vergleich " + i); })
    };
  }

  /* ---------- Zeichnen ---------- */

  var TON = {
    "fehlt": "haken haken--nein",
    "schwach": "haken haken--nein",
    "überbetont": "haken haken--nein",
    "passend": "haken haken--ja",
    "nicht vorhanden": "haken",
    "nur bei Ihnen": "haken",
    "überall": "haken"
  };

  function tabelleZeichnen(ziel, reihe, ueberschrift) {
    ziel.textContent = "";
    if (!reihe.length) {
      ziel.appendChild(el("p", "leerstand", "Zu wenig Text für eine Auswertung."));
      return;
    }

    var oben = reihe.slice(0, ZEILEN);
    var groesster = Math.max.apply(null, oben.map(function (e) {
      return Math.max(e.eigen, e.hoechster);
    })) || 1;

    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");
    var kopf = el("thead"), kz = el("tr");
    ["Begriff", "Ihre Seite", "Vergleich Ø", "Vergleich max", "Auf wie vielen", "Verhältnis", "Urteil"].forEach(function (n) {
      kz.appendChild(el("th", null, n));
    });
    kopf.appendChild(kz);
    t.appendChild(kopf);

    var koerper = el("tbody");
    oben.forEach(function (e) {
      var tr = el("tr");
      tr.appendChild(el("td", null, e.wort));
      tr.appendChild(el("td", "tabelle__zahl", e.eigen.toFixed(3).replace(".", ",")));
      tr.appendChild(el("td", "tabelle__zahl", e.mittel.toFixed(3).replace(".", ",")));
      tr.appendChild(el("td", "tabelle__zahl", e.hoechster.toFixed(3).replace(".", ",")));
      tr.appendChild(el("td", "tabelle__zahl", e.inVergleich + " / " + e.vergleichsseiten));

      /* Zwei Balken uebereinander: Ihrer und das Vergleichsfeld. */
      var td = el("td");
      var paar = el("span", "wdfpaar");
      var oben1 = el("span", "wdfpaar__spur");
      var f1 = el("span", "wdfpaar__eigen");
      f1.style.width = Math.round((e.eigen / groesster) * 100) + "%";
      oben1.appendChild(f1);
      var unten1 = el("span", "wdfpaar__spur");
      var f2 = el("span", "wdfpaar__fremd");
      f2.style.width = Math.round((e.mittel / groesster) * 100) + "%";
      unten1.appendChild(f2);
      paar.appendChild(oben1);
      paar.appendChild(unten1);
      td.appendChild(paar);
      tr.appendChild(td);

      var tdU = el("td");
      tdU.appendChild(el("span", TON[e.urteil] || "haken", e.urteil));
      tr.appendChild(tdU);

      koerper.appendChild(tr);
    });
    t.appendChild(koerper);
    rolle.appendChild(t);
    ziel.appendChild(rolle);

    var fuss = el("p", "blatthinweis");
    fuss.textContent = "Der obere Balken ist Ihre Seite, der untere der Durchschnitt der Vergleichsseiten. "
      + "Gezeigt sind die " + Math.min(ZEILEN, reihe.length) + " Begriffe mit dem höchsten Gewicht im Feld, von "
      + reihe.length.toLocaleString("de-DE") + " insgesamt. "
      + "Sortiert ist nach der Zahl der Vergleichsseiten, die den Begriff tragen — das geteilte Vokabular steht oben. "
      + "„überall“ heißt: der Begriff steht in jedem Dokument, sein IDF ist damit null und er unterscheidet nichts. "
      + "Die Schwellen: „fehlt“ = bei Ihnen null, aber auf mindestens der Hälfte der Vergleichsseiten; "
      + "„schwach“ = unter der Hälfte des Durchschnitts; „überbetont“ = über dem Doppelten des höchsten Vergleichswerts.";
    ziel.appendChild(fuss);
  }

  function lueckenZeichnen(ziel, reihe1, reihe2) {
    ziel.textContent = "";

    var fehlen = reihe1.filter(function (e) { return e.urteil === "fehlt"; }).slice(0, 25);
    var schwach = reihe1.filter(function (e) { return e.urteil === "schwach"; }).slice(0, 25);
    var zuviel = reihe1.filter(function (e) { return e.urteil === "überbetont"; }).slice(0, 15);
    var folgen = reihe2.filter(function (e) { return e.urteil === "fehlt"; }).slice(0, 15);

    function block(titel, liste, erklaerung) {
      if (!liste.length) return;
      ziel.appendChild(el("h3", "blattkopf", titel));
      var p = el("p", "blatthinweis");
      p.style.marginTop = "0";
      p.style.borderTop = "none";
      p.style.paddingTop = "0";
      p.textContent = erklaerung;
      ziel.appendChild(p);

      var wolke = el("div", "begriffswolke");
      liste.forEach(function (e) {
        var marke = el("span", "begriffsmarke");
        marke.appendChild(el("span", "begriffsmarke__wort", e.wort));
        marke.appendChild(el("span", "begriffsmarke__zahl", e.inVergleich + "/" + e.vergleichsseiten));
        wolke.appendChild(marke);
      });
      ziel.appendChild(wolke);
    }

    block("Begriffe, die Ihnen ganz fehlen", fehlen,
      "Diese Begriffe tragen das Thema auf mindestens der Hälfte der Vergleichsseiten — auf Ihrer kommen sie nicht vor. "
      + "Das ist kein Auftrag, sie einzustreuen: es ist die Frage, ob Ihre Seite einen Teil des Themas gar nicht behandelt.");

    block("Zu schwach gegenüber dem Feld", schwach,
      "Vorhanden, aber deutlich unter dem Durchschnitt der Vergleichsseiten.");

    block("Überbetont", zuviel,
      "Mehr als doppelt so schwer wie die stärkste Vergleichsseite. Liest sich meist unnatürlich.");

    block("Wortfolgen, die fehlen", folgen,
      "Dieselbe Rechnung über Zweierfolgen. Sie zeigt eher, wie über das Thema gesprochen wird, als worum es geht.");

    if (!ziel.children.length) {
      ziel.appendChild(el("p", "leerstand",
        "Keine auffällige Lücke: Ihre Seite trägt die Begriffe des Vergleichsfelds in vergleichbarem Gewicht."));
    }
  }

  function feldZeichnen(ziel, lauf) {
    ziel.textContent = "";
    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");
    var kopf = el("thead"), kz = el("tr");
    ["Dokument", "Rolle", "Wörter"].forEach(function (n) { kz.appendChild(el("th", null, n)); });
    kopf.appendChild(kz);
    t.appendChild(kopf);
    var koerper = el("tbody");
    lauf.namen.forEach(function (n, i) {
      var tr = el("tr");
      tr.appendChild(el("td", null, n));
      tr.appendChild(el("td", "still", i === 0 ? "Ihre Seite" : "Vergleich"));
      tr.appendChild(el("td", "tabelle__zahl", lauf.woerterJe[i].toLocaleString("de-DE")));
      koerper.appendChild(tr);
    });
    t.appendChild(koerper);
    rolle.appendChild(t);
    ziel.appendChild(rolle);

    var fuss = el("p", "blatthinweis");
    fuss.textContent = "IDF rechnet gegen genau dieses Feld. Mit zwei Dokumenten ist die Zahl grob, "
      + "mit fünf bis zehn wird sie aussagekräftig. Wer Seiten einlegt, die ein anderes Thema behandeln, "
      + "bekommt ein Ergebnis über ein anderes Thema — das Werkzeug kann das nicht wissen.";
    ziel.appendChild(fuss);
  }

  /* ---------- Bericht ---------- */

  function bericht(lauf) {
    var z = [];
    z.push("seo-rank.me - WDF*IDF");
    z.push(lauf.dokumente + " Dokumente, " + lauf.woerterEigen + " gezaehlte Woerter auf Ihrer Seite");
    z.push("");
    z.push("WAS FEHLT");
    lauf.einzel.reihe.filter(function (e) { return e.urteil === "fehlt"; }).slice(0, 30).forEach(function (e) {
      z.push("  " + e.wort.padEnd(28) + " auf " + e.inVergleich + " von " + e.vergleichsseiten + " Vergleichsseiten");
    });
    z.push("");
    z.push("BEGRIFFE IM FELD (Ihr Wert | Vergleich Mittel | max)");
    lauf.einzel.reihe.slice(0, 40).forEach(function (e) {
      z.push("  " + e.wort.padEnd(28)
        + e.eigen.toFixed(3).padStart(7)
        + e.mittel.toFixed(3).padStart(9)
        + e.hoechster.toFixed(3).padStart(9) + "   " + e.urteil);
    });
    return z.join("\n");
  }

  /* ---------- Lauf ---------- */

  function laufen() {
    var eigenRoh = eigenFeld.value.trim();
    var korpusRoh = korpusFeld.value.trim();

    if (!eigenRoh) { melden("Bitte Ihre Seite einfügen.", true); eigenFeld.focus(); return; }
    if (!korpusRoh) { melden("Ohne Vergleichsseiten ist WDF·IDF bedeutungslos — bitte mindestens eine einfügen.", true); korpusFeld.focus(); return; }

    var bloecke = korpusRoh.split(/^\s*-{3,}\s*$/m)
      .map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 40; });

    if (!bloecke.length) { melden("Die Vergleichsseiten sind zu kurz für eine Auswertung.", true); return; }
    if (bloecke.length > HOECHSTE_VERGLEICH) {
      melden("Mehr als " + HOECHSTE_VERGLEICH + " Vergleichsseiten wären hier zu langsam.", true);
      return;
    }

    var eigen = textVon(eigenRoh);
    eigen.name = eigen.name || "Ihre Seite";
    var vergleiche = bloecke.map(function (b, i) {
      var v = textVon(b);
      v.name = v.name || ("Vergleich " + (i + 1));
      return v;
    });

    if (eigen.text.split(/\s+/).filter(Boolean).length < 50) {
      melden("Ihre Seite hat zu wenig Text für eine sinnvolle Gewichtung.", true);
      return;
    }

    var einzel = rechnen(eigen, vergleiche, 1);
    var folgen = rechnen(eigen, vergleiche, 2);

    var woerterJe = [eigen].concat(vergleiche).map(function (d) {
      return M.wortfeld(d.text, 1).gesamt;
    });

    var fehlen = einzel.reihe.filter(function (e) { return e.urteil === "fehlt"; }).length;
    var passend = einzel.reihe.filter(function (e) { return e.urteil === "passend"; }).length;
    /* Deckung gegen das GETEILTE Vokabular: Begriffe, die auf mindestens der
       Haelfte der Vergleichsseiten stehen. Gegen jeden Einzelfund einer
       beliebigen Seite zu rechnen ergaebe eine Zahl, die mit dem Feld
       waechst und nichts aussagt. */
    var haelfteDok = Math.ceil(vergleiche.length / 2);
    var geteilt = einzel.reihe.filter(function (e) { return e.inVergleich >= haelfteDok; });
    var deckung = geteilt.length
      ? Math.round((geteilt.filter(function (e) { return e.eigenAnzahl > 0; }).length / geteilt.length) * 100)
      : 0;

    letzterLauf = { einzel: einzel, folgen: folgen, dokumente: einzel.dokumente,
      woerterEigen: einzel.woerterEigen, namen: einzel.namen, woerterJe: woerterJe };

    if (BEWEGUNG) {
      BEWEGUNG.zaehlen(document.getElementById("w-dokumente"), einzel.dokumente);
      BEWEGUNG.zaehlen(document.getElementById("w-deckung"), deckung, function (n) { return n + " %"; });
      BEWEGUNG.zaehlen(document.getElementById("w-fehlend"), fehlen);
      BEWEGUNG.zaehlen(document.getElementById("w-passend"), passend);
    } else {
      document.getElementById("w-dokumente").textContent = einzel.dokumente;
      document.getElementById("w-deckung").textContent = deckung + " %";
      document.getElementById("w-fehlend").textContent = fehlen;
      document.getElementById("w-passend").textContent = passend;
    }

    tabelleZeichnen(blatt("begriffe"), einzel.reihe);
    tabelleZeichnen(blatt("folgen"), folgen.reihe);
    lueckenZeichnen(blatt("luecken"), einzel.reihe, folgen.reihe);
    feldZeichnen(blatt("feld"), letzterLauf);

    if (waehlen) waehlen("luecken");
    ergebnis.hidden = false;
    melden(einzel.dokumente + " Dokumente verglichen, " + einzel.reihe.length.toLocaleString("de-DE")
      + " Begriffe gewichtet. Nichts hat dieses Fenster verlassen.", false);
  }

  if (ANSICHT && registerleiste && blaetter) {
    waehlen = ANSICHT.registerAnschliessen(registerleiste, blaetter, null);
  }

  starten.addEventListener("click", laufen);
  [eigenFeld, korpusFeld].forEach(function (f) {
    f.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") laufen();
    });
  });

  if (leeren) {
    leeren.addEventListener("click", function () {
      eigenFeld.value = "";
      korpusFeld.value = "";
      ergebnis.hidden = true;
      melden("", false);
      eigenFeld.focus();
    });
  }

  if (laden) {
    laden.addEventListener("click", function () {
      if (!letzterLauf) return;
      BEWEGUNG.herunterladen("seo-rank-wdf.txt", bericht(letzterLauf), "text/plain");
      melden("Bericht als Datei angeboten.", false);
    });
  }

  /* Ein Vergleichsfeld zum Ausprobieren. Erfundene Beispielseiten, wie die
     Beispielseite des Pruefers auch — als solche gekennzeichnet und nur
     dazu da, die Rechnung vorzufuehren. */
  if (beispiel) {
    beispiel.addEventListener("click", function () {
      eigenFeld.value = [
        "<!doctype html><html lang=\"de\"><head><title>Industriewaagen kaufen</title></head><body>",
        "<h1>Industriewaagen für Produktion und Logistik</h1>",
        "<p>Wir liefern geeichte Industriewaagen für Produktion und Logistik. Plattformwaagen",
        "von 3 kg bis 3 Tonnen, mit Eichung vor Ort und Lieferung in 48 Stunden. Auf Wunsch",
        "als Mietgerät. Unsere Waagen sind robust und wartungsarm.</p>",
        "<p>Die Eichung übernehmen wir, ebenso den Service. Fragen Sie nach einem Angebot.</p>",
        "</body></html>"
      ].join("\n");

      korpusFeld.value = [
        "<!doctype html><html lang=\"de\"><head><title>Beispiel A: Plattformwaagen</title></head><body>",
        "<h1>Plattformwaagen und Bodenwaagen für die Industrie</h1>",
        "<p>Plattformwaagen mit Eichung nach Eichrecht, Wägebereich von 60 kg bis 3000 kg.",
        "Die Wägezelle aus Edelstahl ist gegen Staub und Strahlwasser geschützt, Schutzart IP68.",
        "Anzeigegerät mit Stückzählung, Tara und Schnittstelle zur Warenwirtschaft.</p>",
        "<p>Kalibrierung und Eichung führen wir jährlich durch. Die Genauigkeitsklasse III",
        "ist für den eichpflichtigen Verkehr zugelassen. Wartung im Servicevertrag.</p>",
        "</body></html>",
        "",
        "---",
        "",
        "<!doctype html><html lang=\"de\"><head><title>Beispiel B: Zählwaagen</title></head><body>",
        "<h1>Zählwaagen für Lager und Kommissionierung</h1>",
        "<p>Zählwaagen ermitteln Stückzahlen über das Referenzgewicht. Auflösung bis 1/300000,",
        "Wägebereich 6 kg bis 60 kg. Mit Eichung und Kalibrierung, Genauigkeitsklasse II.</p>",
        "<p>Die Anzeige zeigt Stückgewicht, Stückzahl und Gesamtgewicht. Schnittstelle RS232",
        "zur Warenwirtschaft. Akkubetrieb für den mobilen Einsatz im Lager.</p>",
        "<p>Eichung, Kalibrierung und Wartung übernimmt unser Service vor Ort.</p>",
        "</body></html>",
        "",
        "---",
        "",
        "<!doctype html><html lang=\"de\"><head><title>Beispiel C: Kontrollwaagen</title></head><body>",
        "<h1>Kontrollwaagen für die Produktion</h1>",
        "<p>Kontrollwaagen prüfen Füllmengen in der laufenden Produktion. Toleranzanzeige",
        "in Ampelfarben, Protokollierung nach Fertigpackungsverordnung, Wägebereich bis 30 kg.</p>",
        "<p>Die Wägezelle ist temperaturkompensiert, Schutzart IP65 für die Reinigung.",
        "Eichung und Kalibrierung nach Eichrecht, Genauigkeitsklasse II, Servicevertrag möglich.</p>",
        "<p>Schnittstelle zur Warenwirtschaft, Stückzählung und Tara serienmäßig.</p>",
        "</body></html>"
      ].join("\n");

      laufen();
    });
  }

  if (BEWEGUNG) {
    BEWEGUNG.eingabeMerken(eigenFeld, "seorank-wdf-eigen");
    BEWEGUNG.eingabeMerken(korpusFeld, "seorank-wdf-korpus");
  }
})();
