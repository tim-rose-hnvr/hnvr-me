/* seo-rank.me — Verhalten
   Regel: Der Ruhezustand ist der sichtbare Zustand. Faellt dieses Skript aus,
   bleibt jeder Inhalt sichtbar und jede Navigation bedienbar. */

(function () {
  "use strict";

  /* ---------- Navigation auf schmalen Fenstern ---------- */

  var schalter = document.getElementById("navschalter");
  var nav = document.getElementById("hauptnav");
  var schmal = window.matchMedia("(max-width: 900px)");

  function navSchliessen() {
    if (!nav || !schalter) return;
    nav.hidden = true;
    schalter.setAttribute("aria-expanded", "false");
    schalter.setAttribute("aria-label", "Menü öffnen");
  }

  function navOeffnen() {
    if (!nav || !schalter) return;
    nav.hidden = false;
    schalter.setAttribute("aria-expanded", "true");
    schalter.setAttribute("aria-label", "Menü schließen");
  }

  function nachBreite() {
    if (!nav || !schalter) return;
    if (schmal.matches) {
      navSchliessen();
    } else {
      nav.hidden = false;
      schalter.setAttribute("aria-expanded", "false");
    }
  }

  if (schalter && nav) {
    nachBreite();

    schalter.addEventListener("click", function () {
      if (nav.hidden) {
        navOeffnen();
      } else {
        navSchliessen();
      }
    });

    nav.addEventListener("click", function (e) {
      if (e.target.closest("a") && schmal.matches) navSchliessen();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && schmal.matches && !nav.hidden) {
        navSchliessen();
        schalter.focus();
      }
    });

    if (schmal.addEventListener) {
      schmal.addEventListener("change", nachBreite);
    } else if (schmal.addListener) {
      schmal.addListener(nachBreite);
    }
  }

  /* ---------- Prüfformular ---------- */

  // Erkennt eine plausible Domain, mit oder ohne Schema und Pfad.
  var domainMuster = /^(https?:\/\/)?([a-z0-9](-*[a-z0-9])*\.)+[a-z]{2,24}(\/\S*)?$/i;

  function formAnschliessen(formId, hinweisId) {
    var form = document.getElementById(formId);
    var hinweis = document.getElementById(hinweisId);
    if (!form || !hinweis) return;

    var feld = form.querySelector(".pruefform__feld");
    var ruhetext = hinweis.textContent;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var wert = feld.value.trim();

      if (!wert) {
        melden("Bitte eine Adresse eintragen, zum Beispiel ihre-domain.de", true);
        feld.focus();
        return;
      }

      if (!domainMuster.test(wert)) {
        melden("Das sieht nicht nach einer Adresse aus: " + wert, true);
        feld.focus();
        return;
      }

      // Es gibt noch keinen Crawler hinter dieser Oberflaeche. Hier wird
      // spaeter der Auftrag an das Backend uebergeben; bis dahin sagen wir das.
      melden("Vorgemerkt für " + wert.replace(/^https?:\/\//i, "") + " · [Crawler noch nicht angeschlossen]", false);
    });

    feld.addEventListener("input", function () {
      if (hinweis.classList.contains("formhinweis--warn")) melden(ruhetext, false);
    });

    function melden(text, warnung) {
      hinweis.textContent = text;
      hinweis.classList.toggle("formhinweis--warn", !!warnung);
    }
  }

  formAnschliessen("pruefform", "formhinweis");
  formAnschliessen("pruefform-unten", "formhinweis-unten");
})();

/* ---------- Ausbau: Tabellen sortieren und filtern ---------- */

(function () {
  "use strict";

  function zahlAus(text) {
    // Deutsche Schreibweise: 1.284 und 2,5 — und Vorzeichen wie "↑ 3".
    var bereinigt = text.replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
    var n = parseFloat(bereinigt);
    return isNaN(n) ? null : n;
  }

  document.querySelectorAll("table[data-sortierbar]").forEach(function (tabelle) {
    var koerper = tabelle.tBodies[0];
    if (!koerper) return;

    tabelle.querySelectorAll("th .sortknopf").forEach(function (knopf, spalte) {
      knopf.addEventListener("click", function () {
        var richtung = knopf.getAttribute("data-richtung") === "auf" ? "ab" : "auf";

        tabelle.querySelectorAll("th .sortknopf").forEach(function (anderer) {
          anderer.removeAttribute("data-richtung");
          if (anderer.parentElement) anderer.parentElement.removeAttribute("aria-sort");
        });
        knopf.setAttribute("data-richtung", richtung);
        if (knopf.parentElement) {
          knopf.parentElement.setAttribute("aria-sort", richtung === "auf" ? "ascending" : "descending");
        }
        var pfeil = knopf.querySelector(".sortknopf__pfeil");
        if (pfeil) pfeil.textContent = richtung === "auf" ? "↑" : "↓";

        var index = Array.prototype.indexOf.call(knopf.closest("tr").children, knopf.closest("th"));
        var zeilen = Array.prototype.slice.call(koerper.rows);

        zeilen.sort(function (a, b) {
          var za = a.cells[index], zb = b.cells[index];
          var ta = (za.getAttribute("data-wert") || za.textContent).trim();
          var tb = (zb.getAttribute("data-wert") || zb.textContent).trim();
          var na = zahlAus(ta), nb = zahlAus(tb);
          var vergleich = (na !== null && nb !== null) ? na - nb : ta.localeCompare(tb, "de");
          return richtung === "auf" ? vergleich : -vergleich;
        });

        zeilen.forEach(function (z) { koerper.appendChild(z); });
      });
    });
  });

  document.querySelectorAll("[data-tabellenfilter]").forEach(function (leiste) {
    var ziel = document.getElementById(leiste.getAttribute("data-tabellenfilter"));
    if (!ziel) return;
    var koerper = ziel.tBodies[0];
    var leerstand = document.getElementById(leiste.getAttribute("data-leerstand"));
    var stand = leiste.querySelector(".filterstand");
    var knoepfe = leiste.querySelectorAll(".filter");

    function anwenden(art) {
      var sichtbar = 0;
      Array.prototype.forEach.call(koerper.rows, function (zeile) {
        var passt = art === "alle" || zeile.getAttribute("data-art") === art;
        zeile.hidden = !passt;
        if (passt) sichtbar++;
      });
      Array.prototype.forEach.call(knoepfe, function (k) {
        k.setAttribute("aria-pressed", String(k.getAttribute("data-art") === art));
      });
      if (leerstand) leerstand.hidden = sichtbar > 0;
      if (stand) stand.textContent = sichtbar + " von " + koerper.rows.length + " Zeilen";
    }

    Array.prototype.forEach.call(knoepfe, function (k) {
      k.addEventListener("click", function () { anwenden(k.getAttribute("data-art")); });
    });

    anwenden("alle");
  });
})();

/* ---------- Ausbau: Snippet-Werkzeug ----------

   Zeigt, was von Titel, Adresse und Beschreibung in der Trefferliste
   ankommt — auf dem Schreibtisch und am Telefon, mit echtem Zeilenumbruch
   statt einer Schaetzung. Die Breiten sind Erfahrungswerte, keine
   zugesicherten Grenzen: das steht auch auf der Seite.

   Gemessen wird mit derselben Arial-Rechnung wie im Regelkatalog. */

(function () {
  "use strict";

  var werkzeug = document.getElementById("snippetwerkzeug");
  if (!werkzeug) return;

  /* Pixelbudget fuer die Balken (wie bisher) und die Spaltenmodelle der
     beiden Geraete. Ein Modell, kein Versprechen. */
  var GRENZE = { titel: 600, text: 960 };

  var GERAETE = [
    {
      id: "tisch", name: "Schreibtisch",
      titel: { schrift: "20px Arial, sans-serif", spalte: 600, zeilen: 1 },
      text:  { schrift: "14px Arial, sans-serif", spalte: 600, zeilen: 2 }
    },
    {
      id: "telefon", name: "Telefon",
      titel: { schrift: "18px Arial, sans-serif", spalte: 400, zeilen: 2 },
      text:  { schrift: "14px Arial, sans-serif", spalte: 400, zeilen: 3 }
    }
  ];

  var messflaeche = document.createElement("canvas").getContext("2d");

  var titelFeld = document.getElementById("s-titel");
  var pfadFeld = document.getElementById("s-pfad");
  var textFeld = document.getElementById("s-text");
  var datumSchalter = document.getElementById("s-datum");
  var restZiel = document.getElementById("s-rest");
  var befundZiel = document.getElementById("s-befunde");

  function breite(text, schrift) {
    messflaeche.font = schrift;
    return Math.round(messflaeche.measureText(text).width);
  }

  /* Bricht wie ein Browser: Wort fuer Wort, und wenn ein einzelnes Wort
     nicht passt, wird es hart getrennt. Gibt die Zeilen und den Rest
     zurueck, der nicht mehr hineingeht. */
  function umbrechen(text, schrift, spalte, maxZeilen) {
    var worte = String(text).split(/\s+/).filter(Boolean);
    var zeilen = [], laufend = "", i = 0;

    while (i < worte.length && zeilen.length < maxZeilen) {
      var versuch = laufend ? laufend + " " + worte[i] : worte[i];
      if (breite(versuch, schrift) <= spalte) {
        laufend = versuch;
        i++;
        continue;
      }
      if (!laufend) {
        /* Ein einziges Wort ist breiter als die Spalte: hart trennen. */
        var stueck = worte[i];
        while (stueck.length > 1 && breite(stueck, schrift) > spalte) {
          stueck = stueck.slice(0, -1);
        }
        worte[i] = worte[i].slice(stueck.length);
        zeilen.push(stueck);
        continue;
      }
      zeilen.push(laufend);
      laufend = "";
    }
    if (laufend && zeilen.length < maxZeilen) zeilen.push(laufend);

    var rest = worte.slice(i).join(" ");
    if (laufend && zeilen.length >= maxZeilen && zeilen[zeilen.length - 1] !== laufend) {
      rest = (laufend + " " + rest).trim();
    }

    /* Die letzte Zeile bekommt die Auslassung, wenn etwas fehlt. */
    if (rest && zeilen.length) {
      var letzte = zeilen[zeilen.length - 1];
      while (letzte.length > 1 && breite(letzte + " …", schrift) > spalte) {
        letzte = letzte.replace(/\s*\S+$/, "");
        if (!letzte) break;
      }
      zeilen[zeilen.length - 1] = (letzte || zeilen[zeilen.length - 1]) + " …";
    }

    return { zeilen: zeilen, rest: rest };
  }

  function datumsvorspann() {
    if (!datumSchalter || !datumSchalter.checked) return "";
    var d = new Date();
    var monate = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sept.", "Okt.", "Nov.", "Dez."];
    return d.getDate() + ". " + monate[d.getMonth()] + " " + d.getFullYear() + " — ";
  }

  function pfadAnzeige(roh) {
    var wert = String(roh || "").trim();
    if (!wert) return "ihre-domain.de";
    return wert.replace(/^https?:\/\//i, "").replace(/\/+$/, "").replace(/\//g, " › ");
  }

  /* ---------- Balken und Zahlen an den Feldern ---------- */

  function messen(feld, schrift, grenze, name) {
    var wert = feld.value;
    var px = breite(wert, schrift);
    var anteil = Math.min(px / grenze, 1);
    var knapp = px > grenze;

    var anzeige = document.getElementById(name + "-mass");
    var balken = document.getElementById(name + "-balken");

    if (anzeige) {
      var woerter = wert.trim() ? wert.trim().split(/\s+/).length : 0;
      anzeige.textContent = wert.length + " Zeichen · " + woerter + " Wörter · " + px + " von " + grenze + " px";
      anzeige.classList.toggle("messwert--knapp", knapp);
    }
    if (balken) {
      balken.style.transform = "scaleX(" + anteil + ")";
      balken.classList.toggle("balkenklein__fuellung--knapp", knapp);
    }
    return wert;
  }

  /* ---------- Befunde ---------- */

  var EMOJI = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2190-\u27BF\u2B00-\u2BFF\uFE0F]/;

  function befundeSammeln(titel, text, pfad, schnitte) {
    var b = [];
    function melde(stufe, name, wie, beheben) {
      b.push({ stufe: stufe, name: name, wie: wie, beheben: beheben });
    }

    var titelPx = breite(titel, "20px Arial, sans-serif");
    var textPx = breite(text, "14px Arial, sans-serif");

    if (!titel.trim()) {
      melde("kritisch", "Kein Titel",
        "Ohne Titel erfindet die Suchmaschine selbst einen aus dem Seiteninhalt.",
        "Einen Titel setzen: erst worum es geht, dann der Name der Website.");
    } else {
      if (titelPx > GRENZE.titel) {
        melde("wichtig", "Titel wird abgeschnitten",
          "Der Titel ist " + titelPx + " px breit, sichtbar sind etwa " + GRENZE.titel + " px.",
          "Auf etwa 55 bis 60 Zeichen kürzen. Das Wichtigste nach vorn — abgeschnitten wird von hinten.");
      }
      if (titel.trim().length < 30) {
        melde("hinweis", "Titel sehr kurz",
          "Nur " + titel.trim().length + " Zeichen. Der Platz in der Trefferliste bleibt ungenutzt.",
          "Um das ergänzen, was diese Seite von anderen unterscheidet: Ort, Fachgebiet, Modell.");
      }
      /* Marke am Anfang UND am Ende */
      var teile = titel.split(/\s[–—|·]\s/).map(function (t) { return t.trim(); }).filter(Boolean);
      if (teile.length > 1) {
        var letzte = teile[teile.length - 1].toLowerCase();
        if (letzte && titel.toLowerCase().indexOf(letzte) === 0) {
          melde("hinweis", "Marke steht doppelt im Titel",
            "„" + teile[teile.length - 1] + "“ steht am Anfang und am Ende.",
            "Die Marke einmal ans Ende. Der Anfang gehört dem, was die Seite von anderen unterscheidet.");
        }
      }
      /* Wortwiederholung */
      var zaehler = {}, doppelt = [];
      titel.toLowerCase().split(/[^a-zäöüß0-9]+/).forEach(function (w) {
        if (w.length > 3) { zaehler[w] = (zaehler[w] || 0) + 1; if (zaehler[w] === 3) doppelt.push(w); }
      });
      if (doppelt.length) {
        melde("hinweis", "Wort mehrfach im Titel",
          "Dreimal oder öfter: " + doppelt.join(", ") + ".",
          "Die Wiederholungen streichen. Einmal im Titel reicht.");
      }
      if (EMOJI.test(titel)) {
        melde("hinweis", "Sonderzeichen im Titel",
          "Emoji und Symbole werden in der Trefferliste häufig entfernt.",
          "Nicht darauf bauen: der Titel muss ohne sie tragen.");
      }
    }

    if (!text.trim()) {
      melde("wichtig", "Keine Beschreibung",
        "Ohne eigene Beschreibung schneidet die Suchmaschine selbst einen Satz aus der Seite.",
        "Zwei Sätze schreiben, die sagen was die Seite liefert und für wen.");
    } else {
      if (textPx > GRENZE.text) {
        melde("hinweis", "Beschreibung wird abgeschnitten",
          "Die Beschreibung ist " + textPx + " px breit, sichtbar sind etwa " + GRENZE.text + " px.",
          "Auf etwa 155 Zeichen kürzen; den entscheidenden Satz zuerst.");
      }
      if (text.trim().length < 70) {
        melde("hinweis", "Beschreibung sehr kurz",
          "Nur " + text.trim().length + " Zeichen.",
          "Auf zwei vollständige Sätze ausbauen. Der Platz steht zur Verfügung.");
      }
    }

    /* Schneidet die Kürzung mitten im Satz? */
    schnitte.forEach(function (sch) {
      if (!sch.rest) return;
      melde("hinweis", sch.was + " endet am " + sch.geraet + " mitten im Satz",
        "Sichtbar bleibt: „…" + sch.zeilen[sch.zeilen.length - 1] + "“. Verloren geht: „" + sch.rest.slice(0, 60) + (sch.rest.length > 60 ? "…" : "") + "“",
        "So umstellen, dass die ersten Wörter allein schon eine vollständige Aussage sind.");
    });

    var adresse = String(pfad || "");
    var ebenen = adresse.replace(/^https?:\/\//i, "").split("/").slice(1).filter(Boolean);
    if (ebenen.length > 3) {
      melde("hinweis", "Adresse tief verschachtelt",
        ebenen.length + " Ebenen im Pfad. In der Trefferliste wird der Pfad dann gekürzt angezeigt.",
        "Die Gliederung flacher schneiden. Drei Ebenen reichen für die meisten Websites.");
    }
    if (adresse.indexOf("?") !== -1) {
      melde("hinweis", "Parameter in der Adresse",
        "Alles hinter dem Fragezeichen erscheint nicht als lesbarer Pfad.",
        "Die Parameter in einen sprechenden Pfad überführen.");
    }

    if (datumSchalter && datumSchalter.checked) {
      var vorspannPx = breite(datumsvorspann(), "14px Arial, sans-serif");
      melde("hinweis", "Das Datum kostet Platz",
        "Der Datumsvorspann belegt etwa " + vorspannPx + " px der ersten Zeile.",
        "Bei datierten Seiten die Beschreibung entsprechend kürzer fassen.");
    }

    return b;
  }

  function befundeZeichnen(befunde) {
    if (!befundZiel) return;
    befundZiel.textContent = "";
    if (!befunde.length) {
      var gut = document.createElement("p");
      gut.className = "leerstand";
      gut.textContent = "Titel, Adresse und Beschreibung passen in beide Ansichten, ohne dass etwas verloren geht.";
      befundZiel.appendChild(gut);
      return;
    }
    var rang = { kritisch: 0, wichtig: 1, hinweis: 2 };
    befunde.slice().sort(function (a, b) { return rang[a.stufe] - rang[b.stufe]; }).forEach(function (f) {
      var zeile = document.createElement("div");
      zeile.className = "befund";
      zeile.setAttribute("data-stufe", f.stufe);

      var marker = document.createElement("span");
      marker.className = "befund__marker marker--" + f.stufe;

      var mitte = document.createElement("div");
      var name = document.createElement("div");
      name.className = "befund__name";
      name.textContent = f.name;
      mitte.appendChild(name);

      var wie = document.createElement("p");
      wie.className = "befund__wie";
      wie.textContent = f.wie;
      mitte.appendChild(wie);

      var dl = document.createElement("dl");
      dl.className = "befund__detail";
      var punkt = document.createElement("div");
      punkt.className = "befund__punkt";
      var dt = document.createElement("dt");
      dt.textContent = "Was zu tun ist";
      var dd = document.createElement("dd");
      dd.textContent = f.beheben;
      punkt.appendChild(dt);
      punkt.appendChild(dd);
      dl.appendChild(punkt);
      mitte.appendChild(dl);

      var stufe = document.createElement("span");
      stufe.className = "befund__stufe befund__stufe--" + f.stufe;
      stufe.textContent = f.stufe === "gut" ? "bestanden" : f.stufe;

      zeile.appendChild(marker);
      zeile.appendChild(mitte);
      zeile.appendChild(stufe);
      befundZiel.appendChild(zeile);
    });
  }

  /* ---------- Auffrischen ---------- */

  function auffrischen() {
    var titel = messen(titelFeld, "20px Arial, sans-serif", GRENZE.titel, "s-titel");
    var text = messen(textFeld, "14px Arial, sans-serif", GRENZE.text, "s-text");
    var pfad = pfadFeld.value.trim();
    var vorspann = datumsvorspann();

    var schnitte = [];

    GERAETE.forEach(function (g) {
      var vPfad = document.getElementById("s-v-pfad-" + g.id);
      var vTitel = document.getElementById("s-v-titel-" + g.id);
      var vText = document.getElementById("s-v-text-" + g.id);
      if (!vTitel) return;

      var t = umbrechen(titel || "Titel dieser Seite", g.titel.schrift, g.titel.spalte, g.titel.zeilen);
      var b = umbrechen(vorspann + (text || "Hier steht die Beschreibung, die unter dem Titel erscheint."),
        g.text.schrift, g.text.spalte, g.text.zeilen);

      if (vPfad) vPfad.textContent = pfadAnzeige(pfad);
      vTitel.textContent = t.zeilen.join("\n");
      vText.textContent = b.zeilen.join("\n");

      if (titel && t.rest) schnitte.push({ geraet: g.name, was: "Der Titel", zeilen: t.zeilen, rest: t.rest });
      if (text && b.rest) schnitte.push({ geraet: g.name, was: "Die Beschreibung", zeilen: b.zeilen, rest: b.rest });
    });

    /* Was verloren geht, im Klartext. */
    if (restZiel) {
      restZiel.textContent = "";
      if (!schnitte.length) {
        var nichts = document.createElement("p");
        nichts.className = "blatthinweis";
        nichts.style.marginTop = "0";
        nichts.style.borderTop = "none";
        nichts.style.paddingTop = "0";
        nichts.textContent = "In beiden Ansichten geht nichts verloren.";
        restZiel.appendChild(nichts);
      } else {
        schnitte.forEach(function (sch) {
          var p = document.createElement("p");
          p.className = "schnittrest";
          var marke = document.createElement("span");
          marke.className = "schnittrest__marke";
          marke.textContent = sch.geraet + " · " + sch.was;
          var weg = document.createElement("span");
          weg.className = "schnittrest__weg";
          weg.textContent = sch.rest;
          p.appendChild(marke);
          p.appendChild(weg);
          restZiel.appendChild(p);
        });
      }
    }

    befundeZeichnen(befundeSammeln(titel, text, pfad, schnitte));
  }

  [titelFeld, pfadFeld, textFeld].forEach(function (feld) {
    if (feld) feld.addEventListener("input", auffrischen);
  });
  if (datumSchalter) datumSchalter.addEventListener("change", auffrischen);

  werkzeug.querySelectorAll("[data-vorschau]").forEach(function (knopf) {
    knopf.addEventListener("click", function () {
      var dunkel = knopf.getAttribute("data-vorschau") === "dunkel";
      werkzeug.querySelectorAll(".vorschau").forEach(function (v) {
        v.classList.toggle("vorschau--dunkel", dunkel);
      });
      werkzeug.querySelectorAll("[data-vorschau]").forEach(function (k) {
        k.setAttribute("aria-pressed", String(k === knopf));
      });
    });
  });

  auffrischen();
})();


/* ============================================================
   Weltschalter: hell oder dunkel
   ------------------------------------------------------------
   Dieselbe Gestaltung, andere Toene. Gemerkt wird im sessionStorage —
   nicht im localStorage: das Versprechen lautet, dass mit dem Reiter
   alles verschwindet. Der Ruhezustand ist hell; das Attribut steht nur
   da, wenn jemand es gesetzt hat.
   ============================================================ */

(function () {
  "use strict";

  var SCHLUESSEL = "seorank-welt";
  var schalter = document.getElementById("weltschalter");
  var beschriftung = document.getElementById("weltschalter-text");
  if (!schalter) return;

  function gemerkt() {
    try { return sessionStorage.getItem(SCHLUESSEL); } catch (e) { return null; }
  }

  /* Seit der Richtung „Plan" ist die DUNKLE Welt der Grundzustand.
     Gemerkt wird deshalb nur die Ausnahme: "hell". Wer das umdreht,
     muss auch das Skript im Kopf jeder Seite und seinen Hash in der
     Inhaltsrichtlinie mitziehen. */
  function merken(welt) {
    try {
      if (welt === "hell") sessionStorage.setItem(SCHLUESSEL, "hell");
      else sessionStorage.removeItem(SCHLUESSEL);
    } catch (e) { /* privater Modus: dann gilt die Wahl nur fuer diese Seite */ }
  }

  function anlegen(welt) {
    var hell = welt === "hell";

    /* Uebergaenge kurz stilllegen: der Wechsel soll vollstaendig sein,
       auch wenn die Zeitachse steht. Aufgehoben im naechsten Umlauf. */
    document.documentElement.classList.add("welt-wechselt");
    window.setTimeout(function () {
      document.documentElement.classList.remove("welt-wechselt");
    }, 50);

    if (hell) document.documentElement.setAttribute("data-welt", "hell");
    else document.documentElement.removeAttribute("data-welt");
    schalter.setAttribute("aria-pressed", String(hell));
    /* Der zugaengliche Name MUSS den sichtbaren Text enthalten (WCAG
       2.5.3): wer per Sprache „nacht" sagt, muss diesen Knopf treffen. */
    schalter.setAttribute("aria-label", hell
      ? "tag — zur Nachtansicht wechseln"
      : "nacht — zur Tagansicht wechseln");
    if (beschriftung) beschriftung.textContent = hell ? "tag" : "nacht";
  }

  anlegen(gemerkt() === "hell" ? "hell" : "dunkel");

  schalter.addEventListener("click", function () {
    var neu = document.documentElement.getAttribute("data-welt") === "hell" ? "dunkel" : "hell";
    anlegen(neu);
    merken(neu);
  });
})();

/* ============================================================
   Bericht als PDF

   Der Wettbewerb loest das mit einer Fremdbibliothek, die das Blatt
   als BILD in ein PDF legt: nicht durchsuchbar, nicht kopierbar, und
   ein Nachladen von einem fremden Server.

   Der Browser kann es besser, und er kann es schon: sein eigener
   Druckdialog schreibt ein PDF mit echtem Text. Was dabei auf dem
   Papier landet, bestimmt der Druckstil in seorank.css — Bedienung
   raus, alle Register aufgeschlagen, jedes Blatt mit seinem Namen.

   Der Knopf wird hier eingehaengt und nicht in jede Seite geschrieben:
   zwoelf Werkzeuge, eine Stelle. Er erscheint nur dort, wo es auch
   etwas zu drucken gibt.
   ============================================================ */

(function () {
  "use strict";

  var leiste = document.querySelector(".werkzeugleiste");
  if (!leiste) return;

  /* Nur wo es einen Ergebnisbereich gibt. Auf einer Seite ohne
     Ergebnis waere ein Druckknopf eine leere Zusage.
     Die Snippet-Vorschau hat keine Bilanz, aber ein druckbares
     Ergebnis: die zwei Geraete und die Befundliste. */
  var ergebnis = document.querySelector(".tafel .bilanz, .werkflaeche, .vorschauen");
  if (!ergebnis) return;

  var knopf = document.createElement("button");
  knopf.className = "knopf";
  knopf.type = "button";
  knopf.id = "als-pdf";
  knopf.textContent = "als pdf";
  knopf.title = "Öffnet den Druckdialog. Dort „Als PDF speichern“ wählen — "
    + "der Bericht kommt mit allen Registern und echtem Text heraus.";

  knopf.addEventListener("click", function () {
    /* Vor dem Druck alle Register aufschlagen — im Druckstil steht das
       zwar auch, aber manche Blaetter zeichnen sich erst beim Anklicken.
       Wer nur ausdruckt, was er gesehen hat, druckt zu wenig. */
    var register = document.querySelectorAll(".register .reiter[data-blatt]");
    if (register.length) {
      Array.prototype.forEach.call(register, function (r) { r.click(); });
      /* wieder auf das erste stellen, damit der Schirm bleibt, wie er war */
      register[0].click();
    }
    window.setTimeout(function () { window.print(); }, 60);
  });

  /* Vor „leeren“ einsortieren, damit die Reihenfolge überall gleich
     bleibt: erst tun, dann mitnehmen, dann wegwerfen. */
  var leerenKnopf = leiste.querySelector('[id$="-leeren"]');
  if (leerenKnopf) leiste.insertBefore(knopf, leerenKnopf);
  else leiste.appendChild(knopf);
})();
