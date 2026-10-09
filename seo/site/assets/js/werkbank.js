/* seo-rank.me — die Werkbank.

   Ein Arbeitsplatz statt sieben Formulare: mehrere Seiten auf einmal
   einlegen, alles darauf laufen lassen, und am Ende die eine Frage
   beantwortet bekommen, die zaehlt — was zuerst?

   Das Neue gegenueber dem Seiten-Pruefer ist nicht die Menge, sondern die
   Verdichtung: derselbe Befund auf zehn Seiten ist EIN Fehler in der
   Vorlage, kein zehnfacher Einzelfall. Die Prioritaetenliste rechnet das
   aus und sortiert danach, was an Gewicht wirklich verloren geht.

   Rechnet vollstaendig im Browser, mit demselben Regelkatalog wie alles
   andere hier. */

(function () {
  "use strict";

  var werkzeug = document.getElementById("werkbank");
  if (!werkzeug) return;
  if (typeof SEORANK_KATALOG === "undefined") return;

  var katalog = SEORANK_KATALOG;
  var ANALYSE = (typeof SEORANK_ANALYSE !== "undefined") ? SEORANK_ANALYSE : null;
  var M = (typeof SEORANK_MESSEN !== "undefined") ? SEORANK_MESSEN : null;
  var BEWEGUNG = window.SEORANK || null;

  var feld = document.getElementById("wb-eingabe");
  var starten = document.getElementById("wb-starten");
  var beispiel = document.getElementById("wb-beispiel");
  var leeren = document.getElementById("wb-leeren");
  var laden = document.getElementById("wb-laden");
  var ergebnis = document.getElementById("wb-ergebnis");
  var hinweis = document.getElementById("wb-hinweis");
  var registerleiste = document.getElementById("wb-register");
  var blaetter = document.getElementById("wb-blaetter");

  var ANSICHT = (typeof SEORANK_ANSICHT !== "undefined") ? SEORANK_ANSICHT : null;
  var letzterLauf = null;

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

  /* ---------- Einlesen ----------
     Mehrere Seiten werden mit einer Zeile aus drei Strichen getrennt. Das
     ist dieselbe Trennung wie im hreflang-Pruefer. */

  function zerlegen(roh) {
    return String(roh)
      .split(/^\s*-{3,}\s*$/m)
      .map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length > 20; });
  }

  function namen(d, nummer) {
    var t = M && M.seitentitel ? M.seitentitel(d)[0] : d.querySelector("title");
    if (t && t.textContent.trim()) return t.textContent.replace(/\s+/g, " ").trim().slice(0, 60);
    var a = M && M.eigeneAdresse ? M.eigeneAdresse(d) : null;
    if (a) return a.pathname;
    return "Seite " + nummer;
  }

  /* ---------- Messen ---------- */

  function seitePruefen(roh, nummer) {
    var vollstaendig = /<html[\s>]/i.test(roh);
    var d = new DOMParser().parseFromString(roh, "text/html");

    var befunde = [], uebersprungen = {}, geprueft = 0, bestanden = 0;

    katalog.forEach(function (regel) {
      if (regel.braucht && !vollstaendig) { uebersprungen[regel.id] = true; return; }
      geprueft++;
      var treffer;
      try { treffer = regel.pruefe(d, roh); } catch (e) { treffer = null; }
      if (treffer) {
        befunde.push({
          id: regel.id, name: regel.name, gruppe: regel.gruppe, stufe: regel.stufe,
          gewicht: regel.gewicht, wirkung: regel.wirkung, beheben: regel.beheben,
          wie: treffer.wie, fund: treffer.fund || null
        });
      } else {
        bestanden++;
      }
    });

    var punkte = ANALYSE ? ANALYSE.punktzahl(katalog, befunde, uebersprungen) : null;
    var profil = ANALYSE ? ANALYSE.profil(d, roh) : null;

    return {
      nummer: nummer,
      name: namen(d, nummer),
      dokument: d,
      vollstaendig: vollstaendig,
      geprueft: geprueft,
      bestanden: bestanden,
      befunde: befunde,
      punkte: punkte,
      profil: profil,
      kritisch: befunde.filter(function (b) { return b.stufe === "kritisch"; }).length,
      wichtig: befunde.filter(function (b) { return b.stufe === "wichtig"; }).length,
      hinweise: befunde.filter(function (b) { return b.stufe === "hinweis"; }).length
    };
  }

  /* ---------- Verdichten ----------
     Aus n Seiten mit je m Befunden wird eine Liste von Regeln mit der
     Angabe, wie viele Seiten sie trifft und wie viel Gewicht insgesamt
     daran haengt. Das ist die Reihenfolge, in der man arbeitet. */

  function verdichten(seiten) {
    var nach = {};
    seiten.forEach(function (s) {
      s.befunde.forEach(function (b) {
        if (!nach[b.id]) {
          nach[b.id] = {
            id: b.id, name: b.name, gruppe: b.gruppe, stufe: b.stufe,
            gewicht: b.gewicht, wirkung: b.wirkung, beheben: b.beheben,
            wie: b.wie, seiten: []
          };
        }
        nach[b.id].seiten.push(s.name);
      });
    });

    var gesamt = seiten.length;
    return Object.keys(nach).map(function (k) {
      var e = nach[k];
      e.anzahl = e.seiten.length;
      e.verlust = e.gewicht * e.anzahl;
      e.anteil = gesamt ? e.anzahl / gesamt : 0;
      /* Trifft ein Befund fast alle Seiten, sitzt er in der Vorlage.
         Dann ist es EIN Handgriff, nicht zehn. */
      e.art = (gesamt > 1 && e.anteil >= 0.6) ? "Vorlage" : "Einzelfall";
      return e;
    }).sort(function (a, b) {
      return b.verlust - a.verlust || a.name.localeCompare(b.name);
    });
  }

  /* ---------- Blatt: Prioritaeten ---------- */

  function prioritaetenZeichnen(ziel, liste, seitenzahl) {
    ziel.textContent = "";
    if (!liste.length) {
      ziel.appendChild(el("p", "leerstand", "Keine Regel hat auf keiner Seite angeschlagen."));
      return;
    }

    var groesster = liste[0].verlust || 1;

    var kopf = el("p", "blatthinweis");
    kopf.style.marginTop = "0";
    kopf.style.borderTop = "none";
    kopf.style.paddingTop = "0";
    kopf.textContent = "Sortiert nach verlorenem Gewicht, nicht nach Stufe. Ein Hinweis auf allen "
      + "zwölf Seiten wiegt schwerer als ein kritischer Befund auf einer. „Vorlage“ heißt: der Befund "
      + "trifft mindestens sechs von zehn Seiten und sitzt damit fast sicher im Baukasten — "
      + "ein Handgriff statt vieler.";
    ziel.appendChild(kopf);

    var behaelter = el("div", "prioritaeten");
    liste.forEach(function (e, i) {
      var zeile = el("div", "priozeile");
      zeile.setAttribute("data-stufe", e.stufe);

      zeile.appendChild(el("span", "priozeile__rang", i + 1));

      var mitte = el("div", "priozeile__mitte");
      var kopfzeile = el("div", "priozeile__kopf");
      kopfzeile.appendChild(el("span", "priozeile__name", e.name));
      kopfzeile.appendChild(el("span", "priozeile__art" + (e.art === "Vorlage" ? " priozeile__art--vorlage" : ""), e.art));
      mitte.appendChild(kopfzeile);

      mitte.appendChild(el("p", "priozeile__wie", e.wie));

      var dd = el("p", "priozeile__beheben");
      dd.innerHTML = "<b>Zu tun:</b> " + e.beheben;
      mitte.appendChild(dd);

      var marken = el("div", "befund__marken");
      marken.appendChild(el("span", "befund__marke befund__marke--wirkung", "wirkt auf: " + e.wirkung));
      marken.appendChild(el("span", "befund__marke", e.stufe + " · Gewicht " + e.gewicht));
      marken.appendChild(el("span", "befund__marke", e.anzahl + " von " + seitenzahl + " Seiten"));
      marken.appendChild(el("span", "befund__marke", e.id));
      mitte.appendChild(marken);

      zeile.appendChild(mitte);

      var rechts = el("div", "priozeile__last");
      rechts.appendChild(el("span", "priozeile__zahl", e.verlust));
      rechts.appendChild(el("span", "priozeile__label", "Gewicht verloren"));
      var spur = el("span", "wertbalken__spur");
      var f = el("span", "wertbalken__fuellung wertbalken__fuellung--knapp");
      f.style.width = Math.max(4, Math.round((e.verlust / groesster) * 100)) + "%";
      spur.appendChild(f);
      rechts.appendChild(spur);
      zeile.appendChild(rechts);

      behaelter.appendChild(zeile);
    });
    ziel.appendChild(behaelter);

    if (BEWEGUNG) BEWEGUNG.staffeln(behaelter.querySelectorAll(".priozeile"));
  }

  /* ---------- Blatt: Uebersicht ---------- */

  function uebersichtZeichnen(ziel, seiten) {
    ziel.textContent = "";
    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");

    var kopf = el("thead"), kz = el("tr");
    ["Seite", "Punkte", "Kritisch", "Wichtig", "Hinweise", "Bestanden", "Wörter", "Verweise", "Titel"].forEach(function (n) {
      kz.appendChild(el("th", null, n));
    });
    kopf.appendChild(kz); t.appendChild(kopf);

    var koerper = el("tbody");
    seiten.slice().sort(function (a, b) {
      return (a.punkte ? a.punkte.gesamt : 100) - (b.punkte ? b.punkte.gesamt : 100);
    }).forEach(function (s) {
      var tr = el("tr");
      tr.appendChild(el("td", null, s.name));

      var td = el("td", "tabelle__zahl");
      var wert = s.punkte ? s.punkte.gesamt : "—";
      var span = el("span", null, wert);
      if (s.punkte) span.style.color = s.punkte.gesamt < 70 ? "var(--warn)" : (s.punkte.gesamt < 90 ? "var(--signal)" : "var(--gut)");
      td.appendChild(span);
      tr.appendChild(td);

      tr.appendChild(el("td", "tabelle__zahl" + (s.kritisch ? " tabelle__befund" : ""), s.kritisch));
      tr.appendChild(el("td", "tabelle__zahl", s.wichtig));
      tr.appendChild(el("td", "tabelle__zahl", s.hinweise));
      tr.appendChild(el("td", "tabelle__zahl", s.bestanden + " / " + s.geprueft));
      tr.appendChild(el("td", "tabelle__zahl", s.profil ? s.profil.woerter.toLocaleString("de-DE") : "—"));
      tr.appendChild(el("td", "tabelle__zahl", s.profil ? s.profil.verweise : "—"));
      tr.appendChild(el("td", "tabelle__zahl", s.profil ? s.profil.titelPixel + " px" : "—"));
      koerper.appendChild(tr);
    });
    t.appendChild(koerper);
    rolle.appendChild(t);
    ziel.appendChild(rolle);

    var unvollstaendig = seiten.filter(function (s) { return !s.vollstaendig; }).length;
    var fuss = el("p", "blatthinweis");
    fuss.textContent = "Aufsteigend nach Punktzahl: oben steht, was zuerst Arbeit macht."
      + (unvollstaendig ? " " + unvollstaendig + " Eingabe(n) waren kein vollständiges Dokument — dort wurden die Regeln übersprungen, die eines brauchen." : "");
    ziel.appendChild(fuss);
  }

  /* ---------- Blatt: Wirkung ---------- */

  function wirkungZeichnen(ziel, liste) {
    ziel.textContent = "";
    var nach = {};
    liste.forEach(function (e) {
      var w = e.wirkung || "unbestimmt";
      if (!nach[w]) nach[w] = { name: w, verlust: 0, regeln: 0 };
      nach[w].verlust += e.verlust;
      nach[w].regeln++;
    });
    var reihe = Object.keys(nach).map(function (k) { return nach[k]; })
      .sort(function (a, b) { return b.verlust - a.verlust; });

    if (!reihe.length) { ziel.appendChild(el("p", "leerstand", "Nichts zu verteilen.")); return; }

    var groesste = reihe[0].verlust || 1;
    var balken = el("div", "wertbalken");
    reihe.forEach(function (w) {
      var zeile = el("div", "wertbalken__zeile");
      zeile.appendChild(el("span", "wertbalken__name", w.name));
      var spur = el("span", "wertbalken__spur");
      var f = el("span", "wertbalken__fuellung wertbalken__fuellung--knapp");
      f.style.width = Math.round((w.verlust / groesste) * 100) + "%";
      spur.appendChild(f);
      zeile.appendChild(spur);
      zeile.appendChild(el("span", "wertbalken__wert", w.verlust));
      zeile.appendChild(el("span", "wertbalken__zusatz", w.regeln + " Regeln"));
      balken.appendChild(zeile);
    });
    ziel.appendChild(balken);

    var fuss = el("p", "blatthinweis");
    fuss.textContent = "Nicht wo der Fehler sitzt, sondern was er kostet. Die Zahl ist das über alle "
      + "Seiten summierte Gewicht — wer den obersten Bereich angeht, holt am meisten heraus.";
    ziel.appendChild(fuss);
  }

  /* ---------- Blatt: Vergleich der Profile ---------- */

  function profileZeichnen(ziel, seiten) {
    ziel.textContent = "";
    var mit = seiten.filter(function (s) { return s.profil; });
    if (!mit.length) { ziel.appendChild(el("p", "leerstand", "Keine Messwerte.")); return; }

    var spalten = [
      ["Wörter", function (p) { return p.woerter.toLocaleString("de-DE"); }],
      ["Textanteil", function (p) { return p.textanteil + " %"; }],
      ["Elemente", function (p) { return p.elemente.toLocaleString("de-DE"); }],
      ["Tiefe", function (p) { return p.tiefe; }],
      ["Sätze", function (p) { return p.lesbarkeit === null ? "—" : p.saetze; }],
      ["Satzlänge", function (p) { return p.lesbarkeit === null ? "—" : p.satzlaenge; }],
      ["Lesbarkeit", function (p) { return p.lesbarkeit === null ? "—" : p.lesbarkeit; }],
      ["Titel px", function (p) { return p.titelPixel; }],
      ["Beschr. px", function (p) { return p.beschreibungPixel; }],
      ["Überschriften", function (p) { return p.ueberschriften; }],
      ["Bilder", function (p) { return p.bilder; }],
      ["ohne alt", function (p) { return p.bilderOhneAlt; }],
      ["Verweise", function (p) { return p.verweise; }],
      ["intern", function (p) { return p.verweiseIntern; }],
      ["extern", function (p) { return p.verweiseExtern; }],
      ["Fremde Hosts", function (p) { return p.fremdhosts; }]
    ];

    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");
    var kopf = el("thead"), kz = el("tr");
    kz.appendChild(el("th", null, "Messwert"));
    mit.forEach(function (s) { kz.appendChild(el("th", null, s.name.slice(0, 26))); });
    kopf.appendChild(kz); t.appendChild(kopf);

    var koerper = el("tbody");
    spalten.forEach(function (sp) {
      var tr = el("tr");
      tr.appendChild(el("td", null, sp[0]));
      mit.forEach(function (s) { tr.appendChild(el("td", "tabelle__zahl", sp[1](s.profil))); });
      koerper.appendChild(tr);
    });
    t.appendChild(koerper);
    rolle.appendChild(t);
    ziel.appendChild(rolle);

    var fuss = el("p", "blatthinweis");
    fuss.textContent = "Dieselben Messwerte über alle eingelegten Seiten nebeneinander. Ausreißer "
      + "fallen hier auf, bevor eine Regel darauf anschlägt.";
    ziel.appendChild(fuss);
  }

  /* ---------- Bericht ---------- */

  function bericht(lauf) {
    var z = [];
    z.push("seo-rank.me - Werkbank");
    z.push(lauf.seiten.length + " Seite(n) gegen " + katalog.length + " Regeln");
    z.push("");
    z.push("UEBERSICHT");
    lauf.seiten.slice().sort(function (a, b) {
      return (a.punkte ? a.punkte.gesamt : 100) - (b.punkte ? b.punkte.gesamt : 100);
    }).forEach(function (s) {
      z.push("  " + String(s.punkte ? s.punkte.gesamt : "--").padStart(3) + "  " + s.name
        + "   (" + s.kritisch + "k " + s.wichtig + "w " + s.hinweise + "h)");
    });
    z.push("");
    z.push("WAS ZUERST");
    lauf.prioritaeten.forEach(function (e, i) {
      z.push("  " + String(i + 1).padStart(2) + ". [" + e.art + "] " + e.name
        + "  (" + e.anzahl + " von " + lauf.seiten.length + " Seiten, Gewicht " + e.verlust + ")");
      z.push("      " + e.wie);
      z.push("      Zu tun: " + String(e.beheben).replace(/<[^>]+>/g, ""));
      z.push("");
    });
    return z.join("\n");
  }

  /* ---------- Lauf ---------- */

  function laufen() {
    var roh = feld.value.trim();
    if (!roh) { melden("Bitte mindestens eine Seite einfügen.", true); return; }

    var teile = zerlegen(roh);
    if (!teile.length) { melden("Der eingefügte Text ist zu kurz für eine Prüfung.", true); return; }
    if (teile.length > 40) {
      melden("Mehr als 40 Seiten auf einmal wären hier zu langsam. Für ganze Domains gibt es den Crawl auf der Kommandozeile.", true);
      return;
    }

    var seiten = teile.map(function (t, i) { return seitePruefen(t, i + 1); });
    var prioritaeten = verdichten(seiten);

    var gewichtVerloren = prioritaeten.reduce(function (s, e) { return s + e.verlust; }, 0);
    var moeglich = seiten.reduce(function (s, x) { return s + (x.punkte ? x.punkte.moeglich : 0); }, 0);
    var schnitt = seiten.length
      ? Math.round(seiten.reduce(function (s, x) { return s + (x.punkte ? x.punkte.gesamt : 0); }, 0) / seiten.length)
      : 0;
    var ausVorlage = prioritaeten.filter(function (e) { return e.art === "Vorlage"; }).length;

    letzterLauf = { seiten: seiten, prioritaeten: prioritaeten };

    if (BEWEGUNG) {
      BEWEGUNG.zaehlen(document.getElementById("wb-seiten"), seiten.length);
      BEWEGUNG.zaehlen(document.getElementById("wb-schnitt"), schnitt);
      BEWEGUNG.zaehlen(document.getElementById("wb-regeln"), prioritaeten.length);
      BEWEGUNG.zaehlen(document.getElementById("wb-vorlage"), ausVorlage);
    } else {
      document.getElementById("wb-seiten").textContent = seiten.length;
      document.getElementById("wb-schnitt").textContent = schnitt;
      document.getElementById("wb-regeln").textContent = prioritaeten.length;
      document.getElementById("wb-vorlage").textContent = ausVorlage;
    }

    prioritaetenZeichnen(blatt("prioritaeten"), prioritaeten, seiten.length);
    uebersichtZeichnen(blatt("uebersicht"), seiten);
    wirkungZeichnen(blatt("wirkung"), prioritaeten);
    profileZeichnen(blatt("profile"), seiten);

    if (waehlen) waehlen("prioritaeten");
    ergebnis.hidden = false;

    melden(seiten.length + " Seite(n) geprüft, " + gewichtVerloren + " von "
      + moeglich + " Gewichtspunkten verloren. Nichts hat dieses Fenster verlassen.", false);
  }

  var waehlen = null;
  if (ANSICHT && registerleiste && blaetter) {
    waehlen = ANSICHT.registerAnschliessen(registerleiste, blaetter, null);
  }

  starten.addEventListener("click", laufen);
  feld.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") laufen();
  });

  if (leeren) {
    leeren.addEventListener("click", function () {
      feld.value = "";
      ergebnis.hidden = true;
      melden("", false);
      feld.focus();
    });
  }

  if (laden) {
    laden.addEventListener("click", function () {
      if (!letzterLauf) return;
      BEWEGUNG.herunterladen("seorank-werkbank.txt", bericht(letzterLauf), "text/plain");
      melden("Bericht als Datei angeboten.", false);
    });
  }

  if (beispiel) {
    beispiel.addEventListener("click", function () {
      if (typeof SEORANK_BEISPIEL === "undefined") return;
      /* Zwei Fassungen derselben Beispielseite: die zweite hat Titel und
         Beschreibung in Ordnung, sonst nichts. So ist sichtbar, was ein
         Befund aus der Vorlage von einem Einzelfall unterscheidet. */
      var a = SEORANK_BEISPIEL;
      var b = a
        .replace("<title>Waagen</title>", '<title>Industriewaagen für Produktion und Logistik – Beispiel GmbH</title>')
        .replace("</head>", '  <meta name="description" content="Industriewaagen für Produktion, Logistik und Labor: Plattformwaagen, Zählwaagen und Kontrollwaagen mit Eichung und Service.">\n</head>');
      feld.value = a + "\n\n---\n\n" + b;
      laufen();
    });
  }

  if (BEWEGUNG) BEWEGUNG.eingabeMerken(feld, "seorank-werkbank");
})();
