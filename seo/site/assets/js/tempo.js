/* seo-rank.me — Tempo: Ladezeit aus Googles eigenen Messungen.

   ACHTUNG, und das steht auch auf der Seite: dies ist das EINZIGE Werkzeug
   hier, das etwas nach aussen gibt. Adresse und Schluessel gehen an Google
   (PageSpeed Insights und Chrome UX Report). Alle anderen Werkzeuge rechnen
   weiterhin vollstaendig im Browser.

   Zwei Quellen, die verschiedene Fragen beantworten:
     Labor (Lighthouse) — eine Messung auf Googles Geraet, jederzeit
       wiederholbar, gut zum Vergleichen von vorher und nachher.
     Feld (CrUX)        — was echte Besucher in den letzten 28 Tagen
       erlebt haben. Nur vorhanden, wenn die Seite genug Verkehr hat.

   Der Schluessel bleibt im sessionStorage: mit dem Reiter ist er weg.
   Er wird an niemanden ausser Google geschickt. */

(function () {
  "use strict";

  var werkzeug = document.getElementById("tempo");
  if (!werkzeug) return;

  var BEWEGUNG = window.SEORANK || null;
  var ANSICHT = (typeof SEORANK_ANSICHT !== "undefined") ? SEORANK_ANSICHT : null;

  var adressFeld = document.getElementById("t-adresse");
  var schluesselFeld = document.getElementById("t-schluessel");
  var starten = document.getElementById("t-starten");
  var leeren = document.getElementById("t-leeren");
  var ergebnis = document.getElementById("t-ergebnis");
  var hinweis = document.getElementById("t-hinweis");
  var registerleiste = document.getElementById("t-register");
  var blaetter = document.getElementById("t-blaetter");
  var geraeteWahl = werkzeug.querySelectorAll(".probe[data-geraet]");

  var SCHLUESSEL = "seorank-psi-schluessel";
  var geraet = "mobile";
  var waehlen = null;

  /* ---------- Schwellen der Core Web Vitals ----------
     Die Werte stammen von Google und sind seit Jahren unveraendert; sie
     stehen hier ausgeschrieben, damit die Bewertung nachlesbar ist. */
  var SCHWELLEN = {
    LARGEST_CONTENTFUL_PAINT_MS:   { gut: 2500, schlecht: 4000, einheit: "ms", name: "LCP · Größter Inhalt sichtbar" },
    INTERACTION_TO_NEXT_PAINT:     { gut: 200,  schlecht: 500,  einheit: "ms", name: "INP · Antwort auf Eingaben" },
    CUMULATIVE_LAYOUT_SHIFT_SCORE: { gut: 0.1,  schlecht: 0.25, einheit: "",   name: "CLS · Ruckeln im Aufbau" },
    FIRST_CONTENTFUL_PAINT_MS:     { gut: 1800, schlecht: 3000, einheit: "ms", name: "FCP · Erster Inhalt sichtbar" },
    EXPERIMENTAL_TIME_TO_FIRST_BYTE: { gut: 800, schlecht: 1800, einheit: "ms", name: "TTFB · Antwort des Servers" }
  };

  var LABOR = [
    ["first-contentful-paint", "FCP · Erster Inhalt sichtbar"],
    ["largest-contentful-paint", "LCP · Größter Inhalt sichtbar"],
    ["total-blocking-time", "TBT · Blockierte Zeit"],
    ["cumulative-layout-shift", "CLS · Ruckeln im Aufbau"],
    ["speed-index", "Speed Index"],
    ["interactive", "Bedienbar ab"]
  ];

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

  function blatt(name) { return blaetter.querySelector('[data-blatt="' + name + '"]'); }

  function urteil(wert, schwelle) {
    if (!schwelle) return "unbekannt";
    if (wert <= schwelle.gut) return "gut";
    if (wert <= schwelle.schlecht) return "mittel";
    return "schlecht";
  }

  function zeigeWert(wert, einheit) {
    if (einheit === "ms") {
      return wert >= 1000 ? (wert / 1000).toFixed(2).replace(".", ",") + " s" : Math.round(wert) + " ms";
    }
    return String(Math.round(wert * 1000) / 1000).replace(".", ",");
  }

  /* ---------- Abrufe ---------- */

  function psiHolen(adresse, schluessel, geraet) {
    var u = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
      + "?url=" + encodeURIComponent(adresse)
      + "&strategy=" + geraet
      + "&category=performance&category=seo&category=accessibility&category=best-practices";
    if (schluessel) u += "&key=" + encodeURIComponent(schluessel);
    return fetch(u).then(function (a) { return a.json().then(function (j) { return { status: a.status, daten: j }; }); });
  }

  function cruxHolen(adresse, schluessel, geraet) {
    if (!schluessel) return Promise.resolve(null);
    var koerper = { url: adresse, formFactor: geraet === "mobile" ? "PHONE" : "DESKTOP" };
    return fetch("https://chromeuxreport.googleapis.com/v1/records:queryRecord?key=" + encodeURIComponent(schluessel), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(koerper)
    }).then(function (a) { return a.json().then(function (j) { return { status: a.status, daten: j }; }); })
      .catch(function () { return null; });
  }

  /* ---------- Blatt: Feld ---------- */

  function feldZeichnen(ziel, crux, psi) {
    ziel.textContent = "";

    var messwerte = null, quelle = "";
    if (crux && crux.status === 200 && crux.daten.record && crux.daten.record.metrics) {
      messwerte = crux.daten.record.metrics;
      quelle = "Chrome UX Report, letzte 28 Tage, echte Besucher dieser Adresse.";
    } else if (psi && psi.daten.loadingExperience && psi.daten.loadingExperience.metrics) {
      messwerte = null;
      quelle = "";
    }

    if (!messwerte && psi && psi.daten.loadingExperience && psi.daten.loadingExperience.metrics) {
      /* PSI liefert dieselben Felddaten in anderer Gestalt. */
      var m = psi.daten.loadingExperience.metrics;
      ziel.appendChild(el("p", "blatthinweis", "Felddaten aus PageSpeed Insights (Chrome UX Report). "
        + "Vorhanden nur, wenn die Seite genug Besucher hat.").cloneNode(true));
      var liste = el("div", "wertbalken");
      Object.keys(m).forEach(function (k) {
        var s = SCHWELLEN[k];
        if (!s) return;
        var wert = m[k].percentile;
        var u = urteil(s.einheit === "" ? wert / 100 : wert, s);
        var w = s.einheit === "" ? wert / 100 : wert;
        liste.appendChild(vitalzeile(s.name, w, s, u, m[k].distributions));
      });
      ziel.appendChild(liste);
      return;
    }

    if (!messwerte) {
      ziel.appendChild(el("p", "leerstand",
        "Für diese Adresse liegen keine Felddaten vor. Das heißt nicht, dass die Seite langsam ist — "
        + "es heißt, dass Chrome zu wenige Besuche gemessen hat, um einen belastbaren Wert zu bilden. "
        + "Das Laborblatt gilt trotzdem."));
      return;
    }

    var kopf = el("p", "blatthinweis");
    kopf.style.marginTop = "0";
    kopf.style.borderTop = "none";
    kopf.style.paddingTop = "0";
    kopf.textContent = quelle + " Gezeigt ist das 75. Perzentil: drei von vier Besuchern hatten es "
      + "mindestens so gut. Der Balken darunter zeigt, wie sich alle Besuche verteilen.";
    ziel.appendChild(kopf);

    var behaelter = el("div", "wertbalken");
    Object.keys(SCHWELLEN).forEach(function (k) {
      var roh = messwerte[k.toLowerCase()] || messwerte[kleinName(k)];
      if (!roh || !roh.percentiles) return;
      var wert = roh.percentiles.p75;
      if (typeof wert === "string") wert = parseFloat(wert);
      var s = SCHWELLEN[k];
      behaelter.appendChild(vitalzeile(s.name, wert, s, urteil(wert, s), roh.histogram));
    });
    ziel.appendChild(behaelter);
  }

  function kleinName(k) {
    return ({
      LARGEST_CONTENTFUL_PAINT_MS: "largest_contentful_paint",
      INTERACTION_TO_NEXT_PAINT: "interaction_to_next_paint",
      CUMULATIVE_LAYOUT_SHIFT_SCORE: "cumulative_layout_shift",
      FIRST_CONTENTFUL_PAINT_MS: "first_contentful_paint",
      EXPERIMENTAL_TIME_TO_FIRST_BYTE: "experimental_time_to_first_byte"
    })[k] || k.toLowerCase();
  }

  var TONURTEIL = { gut: "var(--gut)", mittel: "var(--signal)", schlecht: "var(--warn)" };

  function vitalzeile(name, wert, schwelle, wieGut, verteilung) {
    var zeile = el("div", "vitalzeile");
    zeile.appendChild(el("span", "vitalzeile__name", name));

    var zahl = el("span", "vitalzeile__zahl", zeigeWert(wert, schwelle.einheit));
    zahl.style.color = TONURTEIL[wieGut] || "var(--text)";
    zeile.appendChild(zahl);

    /* Die Verteilung als dreiteiliger Balken: gut, mittel, schlecht. */
    var spur = el("span", "vitalspur");
    if (verteilung && verteilung.length === 3) {
      ["gut", "mittel", "schlecht"].forEach(function (art, i) {
        var teil = verteilung[i];
        var anteil = teil.density !== undefined ? teil.density
          : (teil.proportion !== undefined ? teil.proportion : 0);
        var st = el("span", "vitalspur__teil vitalspur__teil--" + art);
        st.style.width = (anteil * 100).toFixed(1) + "%";
        st.title = Math.round(anteil * 100) + " % " + art;
        spur.appendChild(st);
      });
    }
    zeile.appendChild(spur);

    zeile.appendChild(el("span", "vitalzeile__urteil", wieGut));
    zeile.appendChild(el("span", "vitalzeile__grenze",
      "gut bis " + zeigeWert(schwelle.gut, schwelle.einheit)));
    return zeile;
  }

  /* ---------- Blatt: Labor ---------- */

  function laborZeichnen(ziel, psi) {
    ziel.textContent = "";
    var lh = psi.daten.lighthouseResult;
    if (!lh) { ziel.appendChild(el("p", "leerstand", "Kein Laborergebnis erhalten.")); return; }

    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");
    var kopf = el("thead"), kz = el("tr");
    ["Messwert", "Ergebnis", "Bewertung von Lighthouse"].forEach(function (n) { kz.appendChild(el("th", null, n)); });
    kopf.appendChild(kz); t.appendChild(kopf);

    var koerper = el("tbody");
    LABOR.forEach(function (paar) {
      var a = lh.audits[paar[0]];
      if (!a) return;
      var tr = el("tr");
      tr.appendChild(el("td", null, paar[1]));
      tr.appendChild(el("td", "tabelle__zahl", a.displayValue || "—"));
      var td = el("td");
      var punkt = typeof a.score === "number" ? Math.round(a.score * 100) : null;
      var marke = el("span", "haken" + (punkt === null ? "" : (punkt >= 90 ? " haken--ja" : (punkt >= 50 ? "" : " haken--nein"))),
        punkt === null ? "—" : punkt + " / 100");
      td.appendChild(marke);
      tr.appendChild(td);
      koerper.appendChild(tr);
    });
    t.appendChild(koerper);
    rolle.appendChild(t);
    ziel.appendChild(rolle);

    var fuss = el("p", "blatthinweis");
    fuss.textContent = "Eine einzelne Messung auf Googles Gerät, mit gedrosselter Verbindung. "
      + "Gut, um vorher und nachher zu vergleichen — nicht, um zu behaupten, so schnell sei es bei Ihren Besuchern. "
      + "Dafür ist das Feldblatt da. Lighthouse-Version: " + (lh.lighthouseVersion || "unbekannt") + ".";
    ziel.appendChild(fuss);
  }

  /* ---------- Blatt: Was bremst ---------- */

  function bremseZeichnen(ziel, psi) {
    ziel.textContent = "";
    var lh = psi.daten.lighthouseResult;
    if (!lh || !lh.audits) { ziel.appendChild(el("p", "leerstand", "Kein Ergebnis erhalten.")); return; }

    var punkte = [];
    Object.keys(lh.audits).forEach(function (k) {
      var a = lh.audits[k];
      if (!a.details) return;
      var ersparnis = a.details.overallSavingsMs;
      var bytes = a.details.overallSavingsBytes;
      if (typeof a.score === "number" && a.score >= 0.9) return;
      if (!ersparnis && !bytes) return;
      punkte.push({
        titel: a.title, was: a.description ? a.description.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") : "",
        ms: ersparnis || 0, bytes: bytes || 0
      });
    });

    if (!punkte.length) {
      ziel.appendChild(el("p", "leerstand", "Lighthouse nennt keinen Punkt mit messbarer Ersparnis."));
      return;
    }

    punkte.sort(function (a, b) { return b.ms - a.ms || b.bytes - a.bytes; });
    var groesste = punkte[0].ms || 1;

    var kopf = el("p", "blatthinweis");
    kopf.style.marginTop = "0";
    kopf.style.borderTop = "none";
    kopf.style.paddingTop = "0";
    kopf.textContent = "Sortiert nach geschätzter Ersparnis. Die Schätzung stammt von Lighthouse und "
      + "gilt für die eine Messung — sie ist ein Anhaltspunkt für die Reihenfolge, keine Zusage.";
    ziel.appendChild(kopf);

    var behaelter = el("div", "prioritaeten");
    punkte.slice(0, 20).forEach(function (p, i) {
      var zeile = el("div", "priozeile");
      zeile.appendChild(el("span", "priozeile__rang", i + 1));

      var mitte = el("div", "priozeile__mitte");
      var kz = el("div", "priozeile__kopf");
      kz.appendChild(el("span", "priozeile__name", p.titel));
      mitte.appendChild(kz);
      if (p.was) mitte.appendChild(el("p", "priozeile__wie", p.was));
      var marken = el("div", "befund__marken");
      if (p.bytes) marken.appendChild(el("span", "befund__marke", Math.round(p.bytes / 1024) + " KB weniger"));
      marken.appendChild(el("span", "befund__marke befund__marke--wirkung", "Quelle: Lighthouse"));
      mitte.appendChild(marken);
      zeile.appendChild(mitte);

      var rechts = el("div", "priozeile__last");
      rechts.appendChild(el("span", "priozeile__zahl", p.ms ? Math.round(p.ms) : "—"));
      rechts.appendChild(el("span", "priozeile__label", p.ms ? "ms Ersparnis" : "ohne Zeitangabe"));
      var spur = el("span", "wertbalken__spur");
      var f = el("span", "wertbalken__fuellung wertbalken__fuellung--knapp");
      f.style.width = Math.max(3, Math.round((p.ms / groesste) * 100)) + "%";
      spur.appendChild(f);
      rechts.appendChild(spur);
      zeile.appendChild(rechts);

      behaelter.appendChild(zeile);
    });
    ziel.appendChild(behaelter);
  }

  /* ---------- Blatt: Lighthouse-Bereiche ---------- */

  function bereicheZeichnen(ziel, psi) {
    ziel.textContent = "";
    var lh = psi.daten.lighthouseResult;
    if (!lh || !lh.categories) { ziel.appendChild(el("p", "leerstand", "Kein Ergebnis erhalten.")); return; }

    var behaelter = el("div", "wertbalken");
    Object.keys(lh.categories).forEach(function (k) {
      var c = lh.categories[k];
      if (typeof c.score !== "number") return;
      var wert = Math.round(c.score * 100);
      var zeile = el("div", "wertbalken__zeile");
      zeile.appendChild(el("span", "wertbalken__name", c.title));
      var spur = el("span", "wertbalken__spur");
      var f = el("span", "wertbalken__fuellung" + (wert < 90 ? " wertbalken__fuellung--knapp" : ""));
      f.style.width = wert + "%";
      spur.appendChild(f);
      zeile.appendChild(spur);
      zeile.appendChild(el("span", "wertbalken__wert", wert));
      zeile.appendChild(el("span", "wertbalken__zusatz", wert >= 90 ? "gut" : (wert >= 50 ? "mittel" : "schlecht")));
      behaelter.appendChild(zeile);
    });
    ziel.appendChild(behaelter);

    var fuss = el("p", "blatthinweis");
    fuss.textContent = "Lighthouse prüft vier Bereiche. Der SEO-Bereich ist bewusst klein gehalten und "
      + "ersetzt den Seiten-Prüfer hier nicht: er kennt rund ein Dutzend Prüfungen, unser Katalog 158.";
    ziel.appendChild(fuss);
  }

  /* ---------- Lauf ---------- */

  function laufen() {
    var adresse = adressFeld.value.trim();
    var schluessel = schluesselFeld.value.trim();

    if (!adresse) { melden("Bitte eine vollständige Adresse eingeben.", true); adressFeld.focus(); return; }
    if (!/^https?:\/\//i.test(adresse)) {
      adresse = "https://" + adresse;
      adressFeld.value = adresse;
    }

    try { new URL(adresse); }
    catch (e) { melden("Das ist keine gültige Adresse.", true); return; }

    if (schluessel) {
      try { sessionStorage.setItem(SCHLUESSEL, schluessel); } catch (e) { /* privater Modus */ }
    }

    starten.disabled = true;
    melden("Google misst gerade — das dauert meist zehn bis dreißig Sekunden.", false);

    Promise.all([
      psiHolen(adresse, schluessel, geraet),
      cruxHolen(adresse, schluessel, geraet)
    ]).then(function (paar) {
      starten.disabled = false;
      var psi = paar[0], crux = paar[1];

      if (psi.status !== 200) {
        var meldung = psi.daten && psi.daten.error ? psi.daten.error.message : "Unbekannter Fehler";
        if (psi.status === 429) {
          melden("Googles gemeinsames Kontingent ist erschöpft (429). Mit einem eigenen Schlüssel "
            + "haben Sie 25.000 Abfragen am Tag — der Schlüssel ist kostenlos.", true);
        } else if (psi.status === 400 && /API key not valid/i.test(meldung)) {
          melden("Der Schlüssel wird abgelehnt: „API key not valid“. Prüfen Sie, ob die "
            + "PageSpeed-Insights-API im Google-Cloud-Projekt eingeschaltet ist.", true);
        } else {
          melden("Google antwortet mit " + psi.status + ": " + meldung.slice(0, 160), true);
        }
        return;
      }

      var lh = psi.daten.lighthouseResult;
      var wert = lh && lh.categories && lh.categories.performance
        ? Math.round(lh.categories.performance.score * 100) : 0;

      if (BEWEGUNG) {
        BEWEGUNG.zaehlen(document.getElementById("t-punkte"), wert);
      } else {
        document.getElementById("t-punkte").textContent = wert;
      }
      var zahlKnoten = document.getElementById("t-punkte");
      zahlKnoten.style.color = wert >= 90 ? "var(--gut)" : (wert >= 50 ? "var(--signal)" : "var(--warn)");

      document.getElementById("t-geraet").textContent = geraet === "mobile" ? "Telefon" : "Schreibtisch";
      document.getElementById("t-quelle").textContent =
        (crux && crux.status === 200 && crux.daten.record) ? "Labor und Feld" : "nur Labor";
      /* Googles Referenz nennt den Zeitpunkt oben als analysisUTCTimestamp;
         lighthouseResult.fetchTime gibt es zusaetzlich. Beide nehmen. */
      var zeitpunkt = (psi && psi.daten && psi.daten.analysisUTCTimestamp)
        || (lh && lh.fetchTime) || "";
      document.getElementById("t-gemessen").textContent =
        zeitpunkt ? new Date(zeitpunkt).toLocaleString("de-DE") : "—";

      feldZeichnen(blatt("feld"), crux, psi);
      laborZeichnen(blatt("labor"), psi);
      bremseZeichnen(blatt("bremse"), psi);
      bereicheZeichnen(blatt("bereiche"), psi);

      if (waehlen) waehlen("feld");
      ergebnis.hidden = false;
      melden("Gemessen von Google für " + adresse + ". Adresse und Schlüssel sind dabei an Google gegangen.", false);
    }).catch(function (e) {
      starten.disabled = false;
      melden("Der Abruf ist gescheitert: " + String(e).slice(0, 160), true);
    });
  }

  /* ---------- Bedienung ---------- */

  if (ANSICHT && registerleiste && blaetter) {
    waehlen = ANSICHT.registerAnschliessen(registerleiste, blaetter, null);
  }

  Array.prototype.forEach.call(geraeteWahl, function (k) {
    k.addEventListener("click", function () {
      geraet = k.getAttribute("data-geraet");
      Array.prototype.forEach.call(geraeteWahl, function (x) {
        x.setAttribute("aria-pressed", String(x === k));
      });
    });
  });

  starten.addEventListener("click", laufen);
  [adressFeld, schluesselFeld].forEach(function (f) {
    f.addEventListener("keydown", function (e) {
      if (e.key === "Enter") laufen();
    });
  });

  if (leeren) {
    leeren.addEventListener("click", function () {
      adressFeld.value = "";
      ergebnis.hidden = true;
      melden("", false);
      adressFeld.focus();
    });
  }

  /* Der Schluessel wird gemerkt, die Adresse nicht: die eine ist Zubehoer,
     die andere ist der Gegenstand der Pruefung. */
  try {
    var gemerkt = sessionStorage.getItem(SCHLUESSEL);
    if (gemerkt) schluesselFeld.value = gemerkt;
  } catch (e) { /* privater Modus */ }
})();
