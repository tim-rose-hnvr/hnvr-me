/* seo-rank.me — zwei weitere Werkzeuge, die im Browser rechnen:
   Prüfer für strukturierte Daten und Prüfer für hreflang.
   Wie die anderen: kein Server, kein Konto, nichts verlaesst das Fenster. */

(function () {
  "use strict";

  /* ---------- Gemeinsames (klein gehalten, damit die Datei allein laeuft) ---------- */

  var RANG = { kritisch: 0, wichtig: 1, hinweis: 2, gut: 3 };

  function kurz(text, laenge) {
    text = String(text).replace(/\s+/g, " ").trim();
    return text.length > laenge ? text.slice(0, laenge) + "…" : text;
  }

  function setzeText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function befundKnoten(b) {
    var zeile = document.createElement("div");
    zeile.className = "befund";
    zeile.setAttribute("data-stufe", b.stufe);

    var marker = document.createElement("span");
    marker.className = "befund__marker marker--" + (b.stufe === "gut" ? "hinweis" : b.stufe);
    if (b.stufe === "gut") { marker.style.background = "var(--signal)"; marker.style.border = "none"; }

    var mitte = document.createElement("div");
    var name = document.createElement("div");
    name.className = "befund__name";
    name.textContent = b.name;
    mitte.appendChild(name);

    var wie = document.createElement("p");
    wie.className = "befund__wie";
    wie.textContent = b.wie;
    mitte.appendChild(wie);

    if (b.fund) {
      var fund = document.createElement("code");
      fund.className = "befund__fund";
      fund.textContent = b.fund;
      mitte.appendChild(fund);
    }

    var stufe = document.createElement("span");
    stufe.className = "befund__stufe befund__stufe--" + b.stufe;
    stufe.textContent = b.stufe === "gut" ? "bestanden" : b.stufe;

    zeile.appendChild(marker);
    zeile.appendChild(mitte);
    zeile.appendChild(stufe);
    return zeile;
  }

  function zeichnen(ziel, befunde, leertext) {
    ziel.textContent = "";
    if (!befunde.length) {
      var leer = document.createElement("p");
      leer.className = "leerstand";
      leer.textContent = leertext;
      ziel.appendChild(leer);
      return;
    }
    befunde.slice().sort(function (a, b) { return RANG[a.stufe] - RANG[b.stufe]; })
      .forEach(function (b) { ziel.appendChild(befundKnoten(b)); });
  }

  function zaehlen(befunde, stufe) {
    return befunde.filter(function (b) { return b.stufe === stufe; }).length;
  }

  var ISO_DATUM = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?$/;

  /* =========================================================
     1. Prüfer für strukturierte Daten
     ========================================================= */

  /* Pflicht- und Empfehlungsfelder je Typ. Grundlage sind die Angaben,
     die Google fuer erweiterte Treffer verlangt beziehungsweise empfiehlt. */
  var TYPEN = {
    Article: { pflicht: ["headline"], empfohlen: ["image", "datePublished", "dateModified", "author", "publisher"] },
    NewsArticle: { pflicht: ["headline", "datePublished"], empfohlen: ["image", "dateModified", "author", "publisher"] },
    BlogPosting: { pflicht: ["headline"], empfohlen: ["image", "datePublished", "author", "publisher"] },
    Product: { pflicht: ["name"], empfohlen: ["image", "description", "brand", "offers", "sku", "aggregateRating"] },
    Offer: { pflicht: ["price", "priceCurrency"], empfohlen: ["availability", "url", "priceValidUntil"] },
    AggregateOffer: { pflicht: ["lowPrice", "priceCurrency"], empfohlen: ["highPrice", "offerCount"] },
    Organization: { pflicht: ["name"], empfohlen: ["url", "logo", "sameAs", "contactPoint"] },
    LocalBusiness: { pflicht: ["name", "address"], empfohlen: ["telephone", "openingHours", "geo", "url", "image"] },
    PostalAddress: { pflicht: ["addressLocality", "addressCountry"], empfohlen: ["streetAddress", "postalCode", "addressRegion"] },
    Person: { pflicht: ["name"], empfohlen: ["url", "jobTitle", "sameAs"] },
    WebSite: { pflicht: ["name", "url"], empfohlen: ["potentialAction", "publisher"] },
    WebPage: { pflicht: ["name"], empfohlen: ["description", "url", "inLanguage", "datePublished"] },
    FAQPage: { pflicht: ["mainEntity"], empfohlen: [] },
    Question: { pflicht: ["name", "acceptedAnswer"], empfohlen: [] },
    Answer: { pflicht: ["text"], empfohlen: [] },
    BreadcrumbList: { pflicht: ["itemListElement"], empfohlen: [] },
    ListItem: { pflicht: ["position"], empfohlen: ["name", "item"] },
    Event: { pflicht: ["name", "startDate", "location"], empfohlen: ["endDate", "description", "image", "offers", "performer"] },
    Recipe: { pflicht: ["name", "recipeIngredient", "recipeInstructions"], empfohlen: ["image", "author", "cookTime", "nutrition"] },
    VideoObject: { pflicht: ["name", "description", "thumbnailUrl", "uploadDate"], empfohlen: ["duration", "contentUrl"] },
    JobPosting: { pflicht: ["title", "description", "datePosted", "hiringOrganization", "jobLocation"], empfohlen: ["baseSalary", "employmentType", "validThrough"] },
    SoftwareApplication: { pflicht: ["name"], empfohlen: ["applicationCategory", "operatingSystem", "offers"] },
    WebApplication: { pflicht: ["name"], empfohlen: ["applicationCategory", "operatingSystem", "offers"] },
    HowTo: { pflicht: ["name", "step"], empfohlen: ["image", "totalTime", "supply", "tool"] },
    ImageObject: { pflicht: ["url"], empfohlen: ["width", "height", "caption"] },
    Review: { pflicht: ["reviewRating", "author"], empfohlen: ["itemReviewed", "datePublished", "reviewBody"] },
    Rating: { pflicht: ["ratingValue"], empfohlen: ["bestRating", "worstRating"] },
    AggregateRating: { pflicht: ["ratingValue", "ratingCount"], empfohlen: ["bestRating", "reviewCount"] },
    ContactPoint: { pflicht: [], empfohlen: ["telephone", "contactType", "email", "availableLanguage"] },
    Place: { pflicht: ["name"], empfohlen: ["address", "geo"] },
    GeoCoordinates: { pflicht: ["latitude", "longitude"], empfohlen: [] },
    Brand: { pflicht: ["name"], empfohlen: ["logo", "url"] },
    OpeningHoursSpecification: { pflicht: ["dayOfWeek"], empfohlen: ["opens", "closes"] },
    ItemList: { pflicht: ["itemListElement"], empfohlen: ["numberOfItems"] },
    SearchAction: { pflicht: ["target"], empfohlen: [] },
    EntryPoint: { pflicht: ["urlTemplate"], empfohlen: [] },
    Country: { pflicht: ["name"], empfohlen: [] },
    MonetaryAmount: { pflicht: ["currency"], empfohlen: ["value"] },
    QuantitativeValue: { pflicht: ["value"], empfohlen: ["unitCode"] },
    PropertyValue: { pflicht: ["name", "value"], empfohlen: [] },
    Comment: { pflicht: ["text"], empfohlen: ["author", "datePublished"] }
  };

  var DATUMSFELDER = ["datePublished", "dateModified", "startDate", "endDate", "uploadDate",
    "datePosted", "validThrough", "priceValidUntil", "dateCreated"];
  var ADRESSFELDER = ["url", "contentUrl", "thumbnailUrl", "logo", "image", "sameAs", "item"];

  function typenVon(objekt) {
    var t = objekt["@type"];
    if (!t) return [];
    return (Array.isArray(t) ? t : [t]).map(function (x) {
      return String(x).replace(/^https?:\/\/schema\.org\//i, "");
    });
  }

  function flachLegen(daten, sammlung, pfad) {
    if (!daten || typeof daten !== "object") return;

    if (Array.isArray(daten)) {
      daten.forEach(function (d, i) { flachLegen(d, sammlung, pfad + "[" + i + "]"); });
      return;
    }

    if (daten["@graph"]) {
      flachLegen(daten["@graph"], sammlung, pfad + " @graph");
      // Der aeussere Knoten kann trotzdem eigene Angaben tragen.
    }

    if (daten["@type"]) sammlung.push({ objekt: daten, pfad: pfad });

    Object.keys(daten).forEach(function (schluessel) {
      if (schluessel === "@graph" || schluessel.charAt(0) === "@") return;
      var wert = daten[schluessel];
      if (wert && typeof wert === "object") flachLegen(wert, sammlung, pfad + " › " + schluessel);
    });
  }

  function strukturPruefen(roh) {
    var deckung = [];
    var befunde = [];
    var bloecke = [];

    var text = roh.trim();

    if (text.charAt(0) === "{" || text.charAt(0) === "[") {
      bloecke.push({ name: "Eingefügtes JSON", text: text });
    } else {
      var d = new DOMParser().parseFromString(text, "text/html");
      var gefunden = d.querySelectorAll('script[type="application/ld+json"]');
      Array.prototype.forEach.call(gefunden, function (s, i) {
        bloecke.push({ name: "Block " + (i + 1), text: s.textContent });
      });

      if (!bloecke.length) {
        var mikro = d.querySelectorAll("[itemscope], [typeof]").length;
        befunde.push({
          name: "Keine strukturierten Daten gefunden", stufe: "wichtig",
          wie: mikro
            ? "Kein JSON-LD im Dokument. Es gibt " + mikro + " Element(e) mit Mikrodaten oder RDFa; die prüft dieses Werkzeug nicht."
            : "Im eingefügten Quelltext steht kein script vom Typ application/ld+json."
        });
        return { befunde: befunde, objekte: 0, typen: [] };
      }
    }

    var alleObjekte = [];

    bloecke.forEach(function (block) {
      var daten;
      try {
        daten = JSON.parse(block.text);
      } catch (fehler) {
        befunde.push({
          name: "Kein gültiges JSON", stufe: "kritisch",
          wie: block.name + " lässt sich nicht lesen. Fehlerhaftes JSON-LD wird vollständig verworfen.",
          fund: fehler.message
        });
        return;
      }

      var kontext = daten["@context"];
      if (!kontext) {
        befunde.push({
          name: "Kein @context", stufe: "kritisch",
          wie: block.name + " nennt keinen Kontext. Ohne ihn weiß die Suchmaschine nicht, welches Vokabular gemeint ist.",
          fund: 'Erwartet: "@context": "https://schema.org"'
        });
      } else if (!/schema\.org/.test(JSON.stringify(kontext))) {
        befunde.push({
          name: "Ungewöhnlicher @context", stufe: "wichtig",
          wie: block.name + " verweist nicht auf schema.org.",
          fund: JSON.stringify(kontext)
        });
      }

      var sammlung = [];
      flachLegen(daten, sammlung, block.name);
      if (!sammlung.length) {
        befunde.push({
          name: "Kein @type", stufe: "kritisch",
          wie: block.name + " enthält kein einziges Objekt mit @type. Ohne Typ wird der Block ignoriert."
        });
      }
      alleObjekte = alleObjekte.concat(sammlung);
    });

    var typenListe = [];

    alleObjekte.forEach(function (eintrag) {
      var o = eintrag.objekt;
      var typen = typenVon(o);
      typen.forEach(function (t) { if (typenListe.indexOf(t) === -1) typenListe.push(t); });

      typen.forEach(function (typ) {
        var regel = TYPEN[typ];
        if (!regel) return;

        /* Dieselbe Leer-Pruefung wie bei den Befunden darunter — die
           Deckungstabelle und die Meldungen muessen dasselbe zaehlen. */
        var da = function (feld) {
          return !(o[feld] === undefined || o[feld] === null || o[feld] === "");
        };
        deckung.push({
          typ: typ,
          pfad: eintrag.pfad,
          pflichtDa: regel.pflicht.filter(da).length,
          pflichtAlle: regel.pflicht.length,
          pflichtFehlt: regel.pflicht.filter(function (f) { return !da(f); }),
          empfDa: regel.empfohlen.filter(da).length,
          empfAlle: regel.empfohlen.length,
          empfFehlt: regel.empfohlen.filter(function (f) { return !da(f); })
        });

        var fehlendePflicht = regel.pflicht.filter(function (feld) {
          return o[feld] === undefined || o[feld] === null || o[feld] === "";
        });
        if (fehlendePflicht.length) {
          befunde.push({
            name: typ + ": Pflichtangabe fehlt", stufe: "kritisch",
            wie: "Ohne " + fehlendePflicht.join(", ") + " kann aus diesem Objekt kein erweiterter Treffer entstehen.",
            fund: eintrag.pfad
          });
        }

        var fehlendeEmpfehlung = regel.empfohlen.filter(function (feld) {
          return o[feld] === undefined || o[feld] === null || o[feld] === "";
        });
        if (fehlendeEmpfehlung.length) {
          befunde.push({
            name: typ + ": empfohlene Angaben fehlen", stufe: "hinweis",
            wie: "Es fehlen: " + fehlendeEmpfehlung.join(", ") + ". Pflicht ist das nicht, aber der Treffer wird damit vollständiger.",
            fund: eintrag.pfad
          });
        }
      });

      if (!typen.some(function (t) { return TYPEN[t]; }) && typen.length) {
        befunde.push({
          name: "Typ nicht im Prüfumfang", stufe: "hinweis",
          wie: "Für " + typen.join(", ") + " kennt dieses Werkzeug keine Feldliste. Der Typ kann trotzdem richtig sein.",
          fund: eintrag.pfad
        });
      }

      // Datumsangaben
      DATUMSFELDER.forEach(function (feld) {
        var wert = o[feld];
        if (typeof wert === "string" && !ISO_DATUM.test(wert.trim())) {
          befunde.push({
            name: "Datum nicht nach ISO 8601", stufe: "wichtig",
            wie: feld + " muss im Format 2026-08-24 oder 2026-08-24T09:30:00+02:00 stehen.",
            fund: eintrag.pfad + " › " + feld + ": " + wert
          });
        }
      });

      // Adressen
      ADRESSFELDER.forEach(function (feld) {
        var wert = o[feld];
        var werte = Array.isArray(wert) ? wert : [wert];
        werte.forEach(function (w) {
          if (typeof w === "string" && w && !/^https?:\/\//i.test(w) && !/^data:/i.test(w)) {
            befunde.push({
              name: "Adresse ist nicht vollständig", stufe: "wichtig",
              wie: feld + " sollte mit Schema und Domain stehen. Relative Adressen können fremde Dienste nicht auflösen.",
              fund: eintrag.pfad + " › " + feld + ": " + w
            });
          }
        });
      });

      // Preise
      if (o.price !== undefined) {
        var preis = String(o.price);
        if (/,/.test(preis)) {
          befunde.push({
            name: "Preis mit Komma", stufe: "wichtig",
            wie: "price muss den Punkt als Dezimaltrenner benutzen und darf kein Währungszeichen enthalten.",
            fund: eintrag.pfad + " › price: " + preis
          });
        }
        if (/[^\d.]/.test(preis)) {
          befunde.push({
            name: "Preis enthält Zeichen, die dort nicht hingehören", stufe: "wichtig",
            wie: "In price gehört nur die Zahl. Die Währung steht in priceCurrency.",
            fund: eintrag.pfad + " › price: " + preis
          });
        }
      }

      // Leere Werte
      Object.keys(o).forEach(function (feld) {
        if (o[feld] === "" || (Array.isArray(o[feld]) && !o[feld].length)) {
          befunde.push({
            name: "Leere Angabe", stufe: "hinweis",
            wie: feld + " ist gesetzt, aber leer. Besser ganz weglassen.",
            fund: eintrag.pfad + " › " + feld
          });
        }
      });
    });

    // FAQ genauer ansehen
    alleObjekte.forEach(function (eintrag) {
      if (typenVon(eintrag.objekt).indexOf("FAQPage") === -1) return;
      var fragen = eintrag.objekt.mainEntity;
      if (!Array.isArray(fragen)) return;
      var ohneAntwort = fragen.filter(function (f) {
        return !f || !f.acceptedAnswer || !(f.acceptedAnswer.text || "").trim();
      });
      if (ohneAntwort.length) {
        befunde.push({
          name: "FAQ: Frage ohne Antworttext", stufe: "kritisch",
          wie: ohneAntwort.length + " von " + fragen.length + " Fragen haben keine acceptedAnswer mit Text.",
          fund: eintrag.pfad
        });
      }
    });

    return { befunde: befunde, objekte: alleObjekte.length, typen: typenListe, deckung: deckung };
  }

  (function strukturWerkzeug() {
    var werkzeug = document.getElementById("struktur");
    if (!werkzeug) return;

    /* Je erkanntem Objekt: wie viel von dem, was der Typ verlangt und
       empfiehlt, ist tatsaechlich da — und was genau fehlt. */
    function deckungZeichnen(deckung) {
      var ziel = document.getElementById("sd-deckung");
      if (!ziel) return;
      ziel.textContent = "";
      if (!deckung || !deckung.length) {
        var leer = document.createElement("p");
        leer.className = "leerstand";
        leer.textContent = "Kein Objekt mit einem der 41 bekannten Typen gefunden.";
        ziel.appendChild(leer);
        return;
      }

      var rolle = document.createElement("div");
      rolle.className = "rolle";
      var t = document.createElement("table");
      t.className = "tabelle";

      var kopf = document.createElement("thead");
      var kz = document.createElement("tr");
      ["Typ", "Wo", "Pflichtfelder", "Empfohlen", "Was fehlt"].forEach(function (n) {
        var th = document.createElement("th");
        th.textContent = n;
        kz.appendChild(th);
      });
      kopf.appendChild(kz);
      t.appendChild(kopf);

      var koerper = document.createElement("tbody");
      deckung.forEach(function (d) {
        var tr = document.createElement("tr");
        var td1 = document.createElement("td");
        td1.textContent = d.typ;
        tr.appendChild(td1);

        var td2 = document.createElement("td");
        td2.className = "mono still";
        td2.textContent = d.pfad;
        tr.appendChild(td2);

        var td3 = document.createElement("td");
        td3.className = "tabelle__zahl" + (d.pflichtDa < d.pflichtAlle ? " tabelle__befund" : "");
        td3.textContent = d.pflichtDa + " / " + d.pflichtAlle;
        tr.appendChild(td3);

        var td4 = document.createElement("td");
        td4.className = "tabelle__zahl";
        td4.textContent = d.empfDa + " / " + d.empfAlle;
        tr.appendChild(td4);

        var td5 = document.createElement("td");
        td5.className = "still";
        var fehlt = d.pflichtFehlt.concat(d.empfFehlt);
        td5.textContent = fehlt.length ? fehlt.join(", ") : "—";
        tr.appendChild(td5);

        koerper.appendChild(tr);
      });
      t.appendChild(koerper);
      rolle.appendChild(t);
      ziel.appendChild(rolle);

      var fuss = document.createElement("p");
      fuss.className = "blatthinweis";
      fuss.textContent = "Pflichtfelder entscheiden, ob die Auszeichnung überhaupt zählt. Die "
        + "Empfehlungen entscheiden, wie viel die Trefferliste daraus macht. Gezählt wird nur, "
        + "ob ein Feld belegt ist — nicht, ob sein Inhalt stimmt; dafür sind die Befunde oben da.";
      ziel.appendChild(fuss);
    }

    var feld = document.getElementById("sd-eingabe");
    var ergebnis = document.getElementById("sd-ergebnis");
    var liste = document.getElementById("sd-befunde");
    var hinweis = document.getElementById("sd-hinweis");

    function melden(text, warnung) {
      hinweis.textContent = text;
      hinweis.classList.toggle("formhinweis--warn", !!warnung);
    }

    function laufen() {
      var roh = feld.value.trim();
      if (!roh) { melden("Bitte Quelltext oder JSON-LD einfügen.", true); return; }

      var lauf = strukturPruefen(roh);

      if (window.SEORANK) {
        window.SEORANK.zaehlen(document.getElementById("sd-objekte"), lauf.objekte);
        window.SEORANK.zaehlen(document.getElementById("sd-kritisch"), zaehlen(lauf.befunde, "kritisch"));
        window.SEORANK.zaehlen(document.getElementById("sd-meldungen"), lauf.befunde.length);
      } else {
        setzeText("sd-objekte", String(lauf.objekte));
        setzeText("sd-kritisch", String(zaehlen(lauf.befunde, "kritisch")));
        setzeText("sd-meldungen", String(lauf.befunde.length));
      }
      setzeText("sd-typen", lauf.typen.length ? lauf.typen.slice(0, 3).join(", ") + (lauf.typen.length > 3 ? " …" : "") : "—");
      deckungZeichnen(lauf.deckung);

      zeichnen(liste, lauf.befunde, "Keine Beanstandung: " + lauf.objekte + " Objekt(e), alle Pflichtangaben vorhanden.");
      if (window.SEORANK) window.SEORANK.staffeln(liste.querySelectorAll(".befund"));
      melden("Geprüft im Browser. Nichts davon hat dieses Fenster verlassen.", false);
      ergebnis.hidden = false;
    }

    document.getElementById("sd-starten").addEventListener("click", laufen);
    if (window.SEORANK) window.SEORANK.eingabeMerken(feld, "seo-rank.me-strukturdaten");

    var beispiel = document.getElementById("sd-beispiel");
    if (beispiel) {
      beispiel.addEventListener("click", function () {
        feld.value = [
          "{",
          '  "@context": "https://schema.org",',
          '  "@type": "Product",',
          '  "name": "Industriewaage IW-300",',
          '  "image": "/bilder/iw300.jpg",',
          '  "description": "",',
          '  "offers": {',
          '    "@type": "Offer",',
          '    "price": "1.299,00 EUR",',
          '    "priceValidUntil": "31.12.2026"',
          "  },",
          '  "aggregateRating": {',
          '    "@type": "AggregateRating",',
          '    "ratingValue": "4.6"',
          "  }",
          "}"
        ].join("\n");
        laufen();
      });
    }
  })();

  /* =========================================================
     2. hreflang-Prüfer
     ========================================================= */

  function hreflangLesen(block) {
    var d = new DOMParser().parseFromString(block, "text/html");
    var eigene = (d.querySelector('link[rel="canonical" i]') || {}).getAttribute
      ? d.querySelector('link[rel="canonical" i]').getAttribute("href")
      : null;

    var eintraege = Array.prototype.map.call(d.querySelectorAll("link[hreflang]"), function (l) {
      return {
        sprache: (l.getAttribute("hreflang") || "").trim(),
        ziel: (l.getAttribute("href") || "").trim()
      };
    });

    return { eigene: eigene, eintraege: eintraege, titel: (d.querySelector("title") || { textContent: "" }).textContent.trim() };
  }

  function hreflangPruefen(bloecke) {
    var befunde = [];
    var seiten = bloecke.map(hreflangLesen).filter(function (s) { return s.eintraege.length || s.eigene; });

    if (!seiten.length) {
      befunde.push({
        name: "Keine hreflang-Angaben gefunden", stufe: "wichtig",
        wie: "Im eingefügten Quelltext steht kein link mit hreflang."
      });
      return { befunde: befunde, seiten: 0, sprachen: 0, gelesene: [] };
    }

    var alleSprachen = {};

    seiten.forEach(function (seite, nr) {
      var kennung = seite.eigene || ("Block " + (nr + 1) + (seite.titel ? " (" + kurz(seite.titel, 40) + ")" : ""));

      // Format
      var falsch = seite.eintraege.filter(function (e) {
        return !/^x-default$/i.test(e.sprache) &&
          !/^[a-z]{2,3}(-[A-Za-z]{4})?(-([A-Za-z]{2}|[0-9]{3}))?$/.test(e.sprache);
      });
      if (falsch.length) {
        befunde.push({
          name: "Ungültige Sprachangabe", stufe: "wichtig",
          wie: kennung + ": " + falsch.length + " Angabe(n) folgen nicht dem Muster Sprache oder Sprache-Land.",
          fund: falsch.map(function (e) { return e.sprache; }).join(", ")
        });
      }

      // Doppelte Sprachen
      var gesehen = {}, doppelt = [];
      seite.eintraege.forEach(function (e) {
        var s = e.sprache.toLowerCase();
        if (gesehen[s] && gesehen[s] !== e.ziel && doppelt.indexOf(s) === -1) doppelt.push(s);
        gesehen[s] = e.ziel;
      });
      if (doppelt.length) {
        befunde.push({
          name: "Sprache mehrfach mit verschiedenen Zielen", stufe: "kritisch",
          wie: kennung + ": widersprüchliche Angaben werden vollständig verworfen.",
          fund: doppelt.join(", ")
        });
      }

      // Relative Adressen
      var relativ = seite.eintraege.filter(function (e) { return e.ziel && !/^https?:\/\//i.test(e.ziel); });
      if (relativ.length) {
        befunde.push({
          name: "Relative Adresse im hreflang", stufe: "wichtig",
          wie: kennung + ": jede hreflang-Adresse muss vollständig sein, mit Schema und Domain.",
          fund: relativ.map(function (e) { return e.sprache + " → " + e.ziel; }).join("\n")
        });
      }

      // Eigenverweis
      if (seite.eigene) {
        var zeigtAufSich = seite.eintraege.some(function (e) { return e.ziel === seite.eigene; });
        if (!zeigtAufSich) {
          befunde.push({
            name: "Kein Verweis auf sich selbst", stufe: "wichtig",
            wie: kennung + ": eine Seite muss sich in ihrer eigenen hreflang-Liste selbst nennen.",
            fund: "kanonisch: " + seite.eigene
          });
        }
      }

      // x-default
      if (!seite.eintraege.some(function (e) { return /^x-default$/i.test(e.sprache); })) {
        befunde.push({
          name: "Kein x-default", stufe: "hinweis",
          wie: kennung + ": für Besucher, deren Sprache nicht dabei ist, fehlt der Rückfall."
        });
      }

      seite.eintraege.forEach(function (e) { alleSprachen[e.sprache.toLowerCase()] = true; });
    });

    // Gegenseitigkeit, sofern mehrere Seiten eingefügt wurden
    if (seiten.length > 1) {
      var nachAdresse = {};
      seiten.forEach(function (s) { if (s.eigene) nachAdresse[s.eigene] = s; });

      seiten.forEach(function (seite) {
        if (!seite.eigene) return;
        seite.eintraege.forEach(function (e) {
          if (/^x-default$/i.test(e.sprache)) return;
          var gegenueber = nachAdresse[e.ziel];
          if (!gegenueber) return;
          var zurueck = gegenueber.eintraege.some(function (g) { return g.ziel === seite.eigene; });
          if (!zurueck) {
            befunde.push({
              name: "Verweis ohne Gegenverweis", stufe: "kritisch",
              wie: "Die Angaben müssen gegenseitig sein. Fehlt der Rückverweis, ignoriert die Suchmaschine das Paar.",
              fund: seite.eigene + "\n   nennt " + e.ziel + "\n   aber nicht umgekehrt"
            });
          }
        });
      });
    } else {
      befunde.push({
        name: "Gegenseitigkeit nicht prüfbar", stufe: "hinweis",
        wie: "Es wurde nur eine Seite eingefügt. Fügen Sie die Sprachvarianten mit einer Trennzeile aus drei Bindestrichen dazwischen ein, dann wird auch der Rückverweis geprüft."
      });
    }

    return { befunde: befunde, seiten: seiten.length, sprachen: Object.keys(alleSprachen).length, gelesene: seiten };
  }

  (function hreflangWerkzeug() {

    /* Die Matrix: Zeile je Seite, Spalte je Sprache. Eine Zelle traegt
       einen Haken, wenn die Seite die Sprache nennt — und einen Befundton,
       wenn irgendeine andere Seite die Sprache nennt, diese aber nicht.
       Genau diese Luecken sind es, die Paare zum Verwerfen bringen. */
    function matrixZeichnen(seiten) {
      var ziel = document.getElementById("hl-matrix");
      if (!ziel) return;
      ziel.textContent = "";
      if (!seiten || !seiten.length) return;

      var sprachen = [];
      seiten.forEach(function (seite) {
        seite.eintraege.forEach(function (e) {
          var sp = e.sprache.toLowerCase();
          if (sp && sprachen.indexOf(sp) === -1) sprachen.push(sp);
        });
      });
      if (!sprachen.length) return;
      sprachen.sort(function (a, b) {
        if (a === "x-default") return 1;
        if (b === "x-default") return -1;
        return a.localeCompare(b);
      });

      var rolle = document.createElement("div");
      rolle.className = "rolle";
      var t = document.createElement("table");
      t.className = "tabelle";

      var kopf = document.createElement("thead");
      var kz = document.createElement("tr");
      var th0 = document.createElement("th");
      th0.textContent = "Seite";
      kz.appendChild(th0);
      sprachen.forEach(function (sp) {
        var th = document.createElement("th");
        th.textContent = sp;
        kz.appendChild(th);
      });
      kopf.appendChild(kz);
      t.appendChild(kopf);

      var koerper = document.createElement("tbody");
      seiten.forEach(function (seite, nr) {
        var tr = document.createElement("tr");
        var td0 = document.createElement("td");
        td0.className = "mono";
        td0.textContent = kurz(seite.eigene || seite.titel || ("Block " + (nr + 1)), 44);
        tr.appendChild(td0);

        sprachen.forEach(function (sp) {
          var eintrag = null;
          seite.eintraege.forEach(function (e) {
            if (e.sprache.toLowerCase() === sp && !eintrag) eintrag = e;
          });

          var td = document.createElement("td");
          var zeichen = document.createElement("span");
          if (eintrag) {
            zeichen.className = "haken haken--ja";
            zeichen.textContent = "✓";
            zeichen.title = eintrag.ziel;
          } else {
            /* Fehlt hier, was anderswo genannt wird? Dann ist es eine
               Luecke und kein leeres Feld. */
            zeichen.className = "haken haken--nein";
            zeichen.textContent = "fehlt";
          }
          td.appendChild(zeichen);
          tr.appendChild(td);
        });
        koerper.appendChild(tr);
      });
      t.appendChild(koerper);
      rolle.appendChild(t);
      ziel.appendChild(rolle);

      var fuss = document.createElement("p");
      fuss.className = "blatthinweis";
      fuss.textContent = "Vollständig ist die Matrix, wenn jede Zeile jede Spalte trägt: jede Seite "
        + "nennt jede Sprache, einschließlich sich selbst. „fehlt“ heißt: eine andere Seite nennt "
        + "diese Sprache, diese Seite nicht — genau dort zerfällt die Gegenseitigkeit. Der Mauszeiger "
        + "über einem Haken zeigt die eingetragene Adresse.";
      ziel.appendChild(fuss);
    }
    var werkzeug = document.getElementById("hreflang");
    if (!werkzeug) return;

    var feld = document.getElementById("hl-eingabe");
    var ergebnis = document.getElementById("hl-ergebnis");
    var liste = document.getElementById("hl-befunde");
    var hinweis = document.getElementById("hl-hinweis");

    function melden(text, warnung) {
      hinweis.textContent = text;
      hinweis.classList.toggle("formhinweis--warn", !!warnung);
    }

    function laufen() {
      var roh = feld.value.trim();
      if (!roh) { melden("Bitte den Kopfbereich mindestens einer Seite einfügen.", true); return; }

      var bloecke = roh.split(/^\s*-{3,}\s*$/m).map(function (b) { return b.trim(); }).filter(Boolean);
      var lauf = hreflangPruefen(bloecke);
      matrixZeichnen(lauf.gelesene);

      if (window.SEORANK) {
        window.SEORANK.zaehlen(document.getElementById("hl-seiten"), lauf.seiten);
        window.SEORANK.zaehlen(document.getElementById("hl-sprachen"), lauf.sprachen);
        window.SEORANK.zaehlen(document.getElementById("hl-kritisch"), zaehlen(lauf.befunde, "kritisch"));
        window.SEORANK.zaehlen(document.getElementById("hl-meldungen"), lauf.befunde.length);
      } else {
        setzeText("hl-seiten", String(lauf.seiten));
        setzeText("hl-sprachen", String(lauf.sprachen));
        setzeText("hl-kritisch", String(zaehlen(lauf.befunde, "kritisch")));
        setzeText("hl-meldungen", String(lauf.befunde.length));
      }

      zeichnen(liste, lauf.befunde, "Keine Beanstandung in den eingefügten Sprachangaben.");
      if (window.SEORANK) window.SEORANK.staffeln(liste.querySelectorAll(".befund"));
      melden("Geprüft im Browser. Es wurde keine Adresse abgerufen.", false);
      ergebnis.hidden = false;
    }

    document.getElementById("hl-starten").addEventListener("click", laufen);
    if (window.SEORANK) window.SEORANK.eingabeMerken(feld, "seo-rank.me-hreflang");

    var beispiel = document.getElementById("hl-beispiel");
    if (beispiel) {
      beispiel.addEventListener("click", function () {
        feld.value = [
          '<link rel="canonical" href="https://beispiel-domain.de/de/waagen">',
          '<link rel="alternate" hreflang="de" href="https://beispiel-domain.de/de/waagen">',
          '<link rel="alternate" hreflang="en" href="https://beispiel-domain.de/en/scales">',
          '<link rel="alternate" hreflang="fr" href="/fr/balances">',
          "",
          "---",
          "",
          '<link rel="canonical" href="https://beispiel-domain.de/en/scales">',
          '<link rel="alternate" hreflang="en" href="https://beispiel-domain.de/en/scales">',
          '<link rel="alternate" hreflang="englisch" href="https://beispiel-domain.de/en/scales">'
        ].join("\n");
        laufen();
      });
    }
  })();
})();
