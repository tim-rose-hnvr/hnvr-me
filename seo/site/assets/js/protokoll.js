/* seo-rank.me — Das Protokoll.

   Seit dem 22.09.2026 der Seiten-Pruefer. Ein Feld fuer Adresse ODER
   Quelltext, zwei Umfaenge, und ein Ergebnis, das mit dem Wichtigsten
   anfaengt: hoechstens fuenf Punkte „Zuerst beheben", dann die acht
   Bereiche mit ehrlichem Zustand, dann alle Befunde.

   Geurteilt wird ausschliesslich mit vorhandenen Quellen:
   - regelkatalog.js      die 158 Regeln ueber den Quelltext
   - pruefwerk.js         robots.txt, Sitemap, Domain-Sammler
   - domainregeln.js      die 48 Domain-Regeln
   Dieses Skript zeichnet und ordnet. Es bewertet nichts selbst.

   Was die Seite verlaesst, steht vorher in einem Satz da und wird nach
   dem Lauf durch das ERSETZT, was wirklich gegangen ist. */

(function () {
  "use strict";

  var wurzel = document.getElementById("pruefer");
  var ergebnis = document.getElementById("p-ergebnis");
  if (!wurzel || !ergebnis) return;

  var K = (typeof SEORANK_KATALOG !== "undefined") ? SEORANK_KATALOG : [];
  var ANALYSE = (typeof SEORANK_ANALYSE !== "undefined") ? SEORANK_ANALYSE : null;
  var ANSICHT = (typeof SEORANK_ANSICHT !== "undefined") ? SEORANK_ANSICHT : null;
  var A = (typeof SEORANK_ABRUF !== "undefined") ? SEORANK_ABRUF : null;
  var PW = (typeof SEORANK_PRUEFWERK !== "undefined") ? SEORANK_PRUEFWERK : null;
  var D = (typeof SEORANK_DOMAIN !== "undefined") ? SEORANK_DOMAIN : null;
  var BEISPIEL = (typeof SEORANK_BEISPIEL !== "undefined") ? SEORANK_BEISPIEL : "";
  var BEW = window.SEORANK || null;

  function $(id) { return document.getElementById(id); }

  var feld = $("p-eingabe");
  var starten = $("p-starten");
  var erkanntZeile = $("p-erkannt");
  var zusage = $("p-hinweis");
  var umfangDomain = $("p-umfang-domain");
  var umfangSatz = $("p-umfang-satz");

  var RANG = { kritisch: 0, wichtig: 1, hinweis: 2, gut: 3 };
  var SCHLUESSEL_VORHER = "seorank-protokoll-vorher";
  var SCHLUESSEL_UMFANG = "seorank-umfang";

  var letzter = null;      // der zuletzt gezeichnete Lauf
  var reihe = [];          // die Befunde in der Reihenfolge der Liste, fuers Blaettern
  var offenIndex = -1;     // welcher Befund im Blatt steht
  var ausloeser = null;    // wohin der Fokus nach dem Schliessen zurueckgeht

  /* ---------------------------------------------------------------
     Hilfen
     --------------------------------------------------------------- */

  function el(name, klasse, text) {
    var k = document.createElement(name);
    if (klasse) k.className = klasse;
    if (text !== undefined && text !== null) k.textContent = String(text);
    return k;
  }

  function ohneTags(s) { return String(s || "").replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&amp;/g, "&"); }

  function merken(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ohne Speicher geht es auch */ } }
  function lesen(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function vergessen(k) { try { sessionStorage.removeItem(k); } catch (e) { /* egal */ } }

  function stufenWort(s) { return s === "gut" ? "bestanden" : s; }

  function stempel(stufe) {
    return el("span", "befund__stufe befund__stufe--" + stufe, stufenWort(stufe));
  }

  function zahlSetzen(id, wert, format) {
    var k = $(id);
    if (!k) return;
    if (BEW && BEW.zaehlen) BEW.zaehlen(k, wert, format);
    else k.textContent = format ? format(wert) : String(wert);
  }

  /* ---------------------------------------------------------------
     Erkennen: Adresse oder Quelltext
     --------------------------------------------------------------- */

  /* Die Erkennung steht in abruf.js — dieselbe wie auf der Startseite.
     Ohne Relais gibt es keine Adresse, nur Quelltext. */
  function erkennen(text) {
    if (A) return A.erkennen(text);
    var t = String(text || "").trim();
    if (!t) return { art: "leer" };
    return /[<>]/.test(t) ? { art: "quelltext", zeichen: t.length } : { art: "unklar" };
  }

  function umfang() {
    var gewaehlt = wurzel.querySelector('input[name="umfang"]:checked');
    return gewaehlt ? gewaehlt.value : "seite";
  }

  function relaisName() { return A ? A.adresse() : "—"; }

  /* Die Zeile unter dem Feld und die Zusage sagen VOR dem Start, was
     passieren wird. Beide richten sich nach dem, was erkannt wurde. */
  function vorschauAktualisieren() {
    var e = erkennen(feld.value);
    /* HTML steht in Mono, eine Adresse in der Textschrift. */
    feld.classList.toggle("hauptfeld__eingabe--quelltext", e.art === "quelltext");
    var domainMoeglich = e.art === "adresse";
    umfangDomain.disabled = !domainMoeglich;
    if (!domainMoeglich && umfangDomain.checked) {
      wurzel.querySelector('input[name="umfang"][value="seite"]').checked = true;
    }
    umfangSatz.textContent = domainMoeglich
      ? "Dazu robots.txt, Sitemap, DNS, Kopfzeilen und Registrierung."
      : "Dazu robots.txt, Sitemap, DNS, Kopfzeilen und Registrierung. Braucht eine Adresse.";

    erkanntZeile.classList.remove("hauptfeld__erkannt--warn");
    if (e.art === "leer") {
      erkanntZeile.textContent = "Eine Adresse wird über das Relais geholt, eingefügter Quelltext bleibt hier. Strg + Eingabe startet.";
    } else if (e.art === "quelltext") {
      erkanntZeile.textContent = "Erkannt: Quelltext, " + e.zeichen.toLocaleString("de-DE") + " Zeichen.";
    } else if (e.art === "adresse") {
      erkanntZeile.textContent = "Erkannt: Adresse " + e.url;
    } else {
      erkanntZeile.textContent = "Weder eine Adresse noch HTML erkannt. Eine Adresse hat einen Punkt und keine Leerzeichen, HTML beginnt mit <.";
      erkanntZeile.classList.add("hauptfeld__erkannt--warn");
    }

    zusage.classList.remove("zusage--warn");
    if (e.art === "adresse") {
      zusage.textContent = umfang() === "domain"
        ? "Beim Prüfen gehen die Adresse und ihre Domain an das Relais " + relaisName() + ", DNS-Anfragen an cloudflare-dns.com und die Registrierung an rdap.org. Geurteilt wird hier."
        : "Beim Prüfen geht die Adresse an das Relais " + relaisName() + ". Geurteilt wird hier.";
    } else {
      zusage.textContent = "Eingefügter Quelltext verlässt diesen Browser nicht.";
    }
  }

  /* Das Feld waechst mit dem Inhalt, bis zu einer Grenze. Eine Adresse
     bleibt einzeilig, eingefuegtes HTML bekommt Platz. */
  function feldHoehe() {
    feld.style.height = "auto";
    feld.style.height = Math.min(feld.scrollHeight, 320) + "px";
  }

  /* ---------------------------------------------------------------
     Pruefen
     --------------------------------------------------------------- */

  function melden(text, warnung) {
    zusage.textContent = text;
    zusage.classList.toggle("zusage--warn", !!warnung);
  }

  function beschaeftigt(ja) {
    starten.disabled = ja;
    var erneut = $("p-erneut");
    if (erneut) erneut.disabled = ja;
    wurzel.setAttribute("aria-busy", ja ? "true" : "false");
    starten.textContent = ja ? "prüft …" : "prüfen";
  }

  function laufen() {
    var e = erkennen(feld.value);
    if (e.art === "leer") { melden("Bitte eine Adresse oder einen Quelltext eingeben.", true); feld.focus(); return; }
    if (e.art === "unklar") { melden("Das ist weder eine Adresse noch HTML.", true); feld.focus(); return; }

    if (e.art === "quelltext") {
      auswerten({ html: feld.value.trim(), herkunft: "quelltext", ziel: null });
      return;
    }

    if (!A) { melden("Ohne Abrufrelais kann keine Adresse geholt werden. Bitte den Quelltext einfügen.", true); return; }

    var weit = umfang() === "domain";
    beschaeftigt(true);
    melden("Das Relais " + relaisName() + " holt " + e.url + " …", false);

    A.holen(e.url).then(function (daten) {
      if (!daten.ok) {
        beschaeftigt(false);
        melden("Nicht geholt: " + daten.fehler + " Geurteilt wurde nichts.", true);
        return;
      }
      if (!daten.html) {
        beschaeftigt(false);
        melden("Das Relais hat keinen Quelltext geliefert (Status " + daten.status + ").", true);
        return;
      }

      var host;
      try { host = new URL(daten.ziel || e.url).hostname; } catch (x) { host = null; }

      if (!weit || !host || !PW) {
        beschaeftigt(false);
        auswerten({ html: daten.html, herkunft: "adresse", ziel: daten.ziel || e.url, abruf: daten });
        return;
      }

      var domain = host.replace(/^www\./, "");
      melden("Geholt. Jetzt robots.txt, Sitemap und Kopfzeilen über das Relais, DNS über cloudflare-dns.com, Registrierung über rdap.org …", false);
      Promise.all([
        PW.relaisHolen(domain, { mitText: true }),
        PW.dnsHolen(domain),
        PW.rdapHolen(domain)
      ]).then(function (teile) {
        beschaeftigt(false);
        auswerten({
          html: daten.html, herkunft: "adresse", ziel: daten.ziel || e.url, abruf: daten,
          domain: { name: domain, relais: teile[0], dns: teile[1], rdap: teile[2].daten, rdapGrund: teile[2].grund }
        });
      });
    });
  }

  /* Der Katalog ueber den Quelltext — dieselbe Schleife wie auf der
     Kommandozeile: uebersprungene Regeln zaehlen weder so noch so. */
  function katalogLaufen(roh) {
    var vollstaendig = /<html[\s>]/i.test(roh);
    var d = new DOMParser().parseFromString(roh, "text/html");
    var befunde = [], bestandene = [], uebersprungeneIds = {};
    var geprueft = 0, uebersprungen = 0;

    K.forEach(function (regel) {
      if (regel.braucht && !vollstaendig) { uebersprungen++; uebersprungeneIds[regel.id] = true; return; }
      geprueft++;
      var treffer;
      try { treffer = regel.pruefe(d, roh); }
      catch (x) { treffer = { wie: "Diese Regel konnte nicht ausgeführt werden: " + x.message }; }
      var eintrag = {
        id: regel.id, gruppe: regel.gruppe, bereich: regel.gruppe, name: regel.name,
        stufe: treffer ? regel.stufe : "gut", wie: treffer ? treffer.wie : "Bestanden.",
        fund: treffer ? treffer.fund : null, wozu: regel.wozu, beheben: regel.beheben,
        wirkung: regel.wirkung, gewicht: regel.gewicht, katalog: true
      };
      (treffer ? befunde : bestandene).push(eintrag);
    });

    return { d: d, befunde: befunde, bestandene: bestandene, geprueft: geprueft,
             uebersprungen: uebersprungen, uebersprungeneIds: uebersprungeneIds, vollstaendig: vollstaendig };
  }

  function pfadVon(url) {
    try { var u = new URL(url); return u.pathname + u.search; } catch (x) { return "/"; }
  }

  /* Die acht Bereiche. Jeder hat einen Zustand; „nicht gepruefte"
     Bereiche verschwinden nie, sie sagen, was fehlt. */
  function bereicheBauen(lauf, punkte) {
    var gruppe = {};
    (punkte ? punkte.gruppen : []).forEach(function (g) { gruppe[g.name] = g; });

    function ausGruppe(name, titel, werkzeug, link) {
      var g = gruppe[name];
      if (!g) return { titel: titel, zustand: "offen", unter: werkzeug, satz: "Diese Regeln wurden übersprungen, weil nur ein Ausschnitt geprüft wurde.", link: link };
      return { titel: titel, zustand: "geprueft", wert: g.wert, unter: "Gruppe " + name + " · " + g.regeln + " Regeln",
               satz: g.befunde ? g.befunde + (g.befunde === 1 ? " Befund" : " Befunde") : "ohne Befund", link: link };
    }

    var istAdresse = lauf.herkunft === "adresse";
    var dom = lauf.domain;
    var ohneDomain = istAdresse
      ? "Mit „Ganze Domain“ wird das mitgeholt."
      : "Braucht eine Adresse statt Quelltext.";

    var liste = [];
    liste.push({ titel: "Diese Seite", zustand: "geprueft", wert: punkte ? punkte.gesamt : null,
                 unter: lauf.katalog.geprueft + " Regeln · 14 Gruppen",
                 satz: lauf.zahl.kritisch + " kritisch · " + lauf.zahl.wichtig + " wichtig · " + lauf.zahl.hinweis + " Hinweise",
                 link: { text: "Befunde", href: "#alle" } });
    liste.push(ausGruppe("Titel und Beschreibung", "Snippet", "Snippet-Vorschau", { text: "Snippet-Vorschau", href: "snippet.html" }));
    liste.push(ausGruppe("Auszeichnung und Vorschau", "Strukturierte Daten", "JSON-LD-Prüfer", { text: "JSON-LD-Prüfer", href: "strukturdaten.html" }));

    if (dom && lauf.robots) {
      liste.push({ titel: "robots.txt", zustand: "geprueft", unter: "robots-Prüfer · 15 Crawler",
                   urteil: lauf.robots.urteil.erlaubt ? "erlaubt" : "gesperrt",
                   satz: "Googlebot · " + lauf.robots.pfad + ": " + (lauf.robots.urteil.erlaubt ? "erlaubt" : "gesperrt") + " · " + lauf.robots.befunde.filter(function (b) { return b.stufe !== "gut"; }).length + " Befunde",
                   link: { text: "robots-Prüfer", href: "robots.html" } });
    } else if (dom) {
      var rs = dom.relais && dom.relais.dateien && dom.relais.dateien.robots ? dom.relais.dateien.robots.status : null;
      liste.push({ titel: "robots.txt", zustand: "offen", unter: "robots-Prüfer",
                   satz: rs ? "Keine robots.txt gefunden (Status " + rs + "). Das bewertet der Bereich Domain." : "Die robots.txt war über das Relais nicht zu holen.",
                   link: { text: "robots-Prüfer", href: "robots.html" } });
    } else {
      liste.push({ titel: "robots.txt", zustand: "offen", unter: "robots-Prüfer · 15 Crawler", satz: ohneDomain, link: { text: istAdresse ? "Ganze Domain wählen" : "Adresse eingeben", href: "#pruefer" } });
    }

    if (dom && lauf.sitemap) {
      liste.push({ titel: "Sitemap", zustand: "geprueft", unter: "Sitemap-Prüfer",
                   satz: lauf.sitemap.locs.length.toLocaleString("de-DE") + " Adressen · " + lauf.sitemap.befunde.length + " Befunde",
                   link: { text: "Sitemap-Prüfer", href: "sitemap.html" } });
    } else if (dom) {
      var ss = dom.relais && dom.relais.dateien && dom.relais.dateien.sitemap ? dom.relais.dateien.sitemap.status : null;
      liste.push({ titel: "Sitemap", zustand: "offen", unter: "Sitemap-Prüfer",
                   satz: ss ? "Keine Sitemap gefunden (Status " + ss + "). Das bewertet der Bereich Domain." : "Die Sitemap war über das Relais nicht zu holen.",
                   link: { text: "Sitemap-Prüfer", href: "sitemap.html" } });
    } else {
      liste.push({ titel: "Sitemap", zustand: "offen", unter: "Sitemap-Prüfer", satz: ohneDomain, link: { text: istAdresse ? "Ganze Domain wählen" : "Adresse eingeben", href: "#pruefer" } });
    }

    liste.push({ titel: "Sprachversionen", zustand: "offen", unter: "hreflang-Prüfer",
                 satz: "Die Gegenseitigkeit lässt sich nur mit allen Sprachversionen zusammen prüfen.",
                 link: { text: "hreflang-Prüfer", href: "hreflang.html" } });

    if (dom && lauf.domainUrteil && lauf.domainUrteil.punkte !== null) {
      var du = lauf.domainUrteil;
      liste.push({ titel: "Domain", zustand: "geprueft", wert: du.punkte,
                   unter: "Domain-Check · " + (du.befunde.length + du.bestanden.length) + " von " + D.anzahl + " Regeln",
                   satz: du.zahl.kritisch + " kritisch · " + du.zahl.wichtig + " wichtig · " + du.zahl.hinweis + " Hinweise",
                   link: { text: "Domain-Check", href: "domain.html" } });
    } else {
      liste.push({ titel: "Domain", zustand: "offen", unter: "Domain-Check · 48 Regeln",
                   satz: dom ? "Weder Relais noch DNS haben geantwortet. Geraten wird nicht." : "Kopfzeilen, DNS und Registrierung gibt es nur mit einer Adresse und „Ganze Domain“.",
                   link: { text: "Domain-Check", href: "domain.html" } });
    }

    liste.push({ titel: "Ladezeit", zustand: "schluessel", unter: "Tempo · PageSpeed Insights",
                 satz: "Braucht einen kostenlosen Google-Schlüssel. Das einzige Werkzeug, das Google fragt.",
                 link: { text: "Tempo öffnen", href: "tempo.html" } });
    return liste;
  }

  /* Der Befund fuer die Domain-Regeln — aus dem, was geholt wurde.
     Felder ohne Messung bleiben WEG: ein leeres Feld hiesse „nachgesehen
     und nichts gefunden". */
  function domainBefund(dom) {
    var b = { domain: dom.name };
    var r = dom.relais;
    if (dom.dns) b.dns = dom.dns;
    if (dom.rdap) b.rdap = dom.rdap;
    if (r) {
      if (r.varianten) b.varianten = r.varianten;
      if (r.dateien) b.dateien = r.dateien;
      if (r.kopf) { b.kopf = r.kopf; b.cookies = r.cookies || []; }
      if (typeof r.ttfb === "number") b.ttfb = r.ttfb;
      if (r.host) b.host = r.host;
    }
    return b;
  }

  function auswerten(eingang) {
    var kat = katalogLaufen(eingang.html);
    var punkte = ANALYSE ? ANALYSE.punktzahl(K, kat.befunde, kat.uebersprungeneIds) : null;

    var lauf = {
      herkunft: eingang.herkunft, ziel: eingang.ziel, abruf: eingang.abruf || null, domain: eingang.domain || null,
      html: eingang.html, katalog: kat, punkte: punkte, zeit: new Date()
    };

    var alle = kat.befunde.slice();

    /* Umfang „Ganze Domain": robots.txt, Sitemap und Domain-Regeln kommen
       dazu — geurteilt vom Pruefwerk und von domainregeln.js. */
    if (lauf.domain && PW) {
      var dat = lauf.domain.relais && lauf.domain.relais.dateien;
      if (dat && dat.robots && dat.robots.status === 200 && dat.robots.text) {
        lauf.robots = PW.robotsUrteil(dat.robots.text, pfadVon(lauf.ziel), "Googlebot");
        lauf.robots.befunde.forEach(function (b) {
          if (b.stufe === "gut") return;
          alle.push({ id: null, gruppe: "robots.txt", bereich: "robots.txt", name: b.name, stufe: b.stufe, wie: b.wie, fund: b.fund || null, gewicht: null });
        });
      }
      if (dat && dat.sitemap && dat.sitemap.status === 200 && dat.sitemap.text) {
        lauf.sitemap = PW.sitemapUrteil(dat.sitemap.text);
        lauf.sitemap.befunde.forEach(function (b) {
          alle.push({ id: null, gruppe: "Sitemap", bereich: "Sitemap", name: b.name, stufe: b.stufe, wie: b.wie, fund: b.fund || null, gewicht: null });
        });
      }
      if (D) {
        lauf.domainUrteil = D.pruefen(domainBefund(lauf.domain));
        lauf.domainUrteil.befunde.forEach(function (b) {
          alle.push({ id: b.id, gruppe: "Domain · " + b.gruppe, bereich: "Domain", name: b.name, stufe: b.stufe,
                      wie: b.fund, fund: null, wozu: b.wozu, beheben: b.beheben, gewicht: b.gewicht, domainregel: true });
        });
      }
    }

    lauf.alle = alle;
    lauf.zahl = {
      kritisch: kat.befunde.filter(function (b) { return b.stufe === "kritisch"; }).length,
      wichtig: kat.befunde.filter(function (b) { return b.stufe === "wichtig"; }).length,
      hinweis: kat.befunde.filter(function (b) { return b.stufe === "hinweis"; }).length
    };
    lauf.bereiche = bereicheBauen(lauf, punkte);
    lauf.vergleich = vergleichen(lauf);

    letzter = lauf;
    zeichnen(lauf);
  }

  /* ---------------------------------------------------------------
     Erneut pruefen: was ist seit dem letzten Lauf behoben, was neu?
     Der letzte Lauf liegt nur im Reiter (sessionStorage) und nur fuer
     dasselbe Ziel.
     --------------------------------------------------------------- */

  function schluesselVon(b) { return (b.id || b.bereich + ":" + b.name); }

  /* Welche Seite ist das? Bei einer Adresse die Adresse. Bei eingefuegtem
     Quelltext die kanonische Adresse, sonst der Titel — beides bleibt
     gleich, wenn man die Seite ausbessert und erneut einfuegt. Ein
     Schluessel ueber den Inhalt taete das nicht, und ohne Kennung wuerden
     zwei verschiedene Seiten miteinander verglichen (gemessen: „5 behoben,
     42 neu" zwischen Beispielseite und einer fremden Probe). */
  function seitenKennung(lauf) {
    if (lauf.ziel) return lauf.ziel;
    var d = lauf.katalog.d;
    var kan = d.querySelector('link[rel="canonical"]');
    if (kan && kan.getAttribute("href")) return "quelltext:" + kan.getAttribute("href");
    var titel = d.querySelector("title");
    if (titel && titel.textContent.trim()) return "quelltext:" + titel.textContent.trim();
    return null;
  }

  function vergleichen(lauf) {
    var ziel = seitenKennung(lauf);
    if (!ziel) return null;
    var jetzt = lauf.alle.map(schluesselVon);
    var vorher = null;
    try { vorher = JSON.parse(lesen(SCHLUESSEL_VORHER) || "null"); } catch (x) { vorher = null; }
    merken(SCHLUESSEL_VORHER, JSON.stringify({ ziel: ziel, ids: jetzt }));
    if (!vorher || vorher.ziel !== ziel) return null;
    var menge = {};
    vorher.ids.forEach(function (i) { menge[i] = true; });
    var jetztMenge = {};
    jetzt.forEach(function (i) { jetztMenge[i] = true; });
    return {
      neu: jetzt.filter(function (i) { return !menge[i]; }),
      behoben: vorher.ids.filter(function (i) { return !jetztMenge[i]; })
    };
  }

  /* ---------------------------------------------------------------
     Zeichnen
     --------------------------------------------------------------- */

  function ordnen(liste) {
    return liste.slice().sort(function (a, b) {
      return RANG[a.stufe] - RANG[b.stufe] || (b.gewicht || 0) - (a.gewicht || 0);
    });
  }

  function zeileBauen(b, zuerst, neu) {
    var li = el("li", "bzeile" + (zuerst ? " bzeile--zuerst" : ""));
    li.setAttribute("data-stufe", b.stufe);
    var knopf = el("button", "bzeile__knopf");
    knopf.type = "button";
    knopf.setAttribute("aria-haspopup", "dialog");
    knopf.appendChild(stempel(b.stufe));
    var inhalt = el("span", "bzeile__inhalt");
    var name = el("span", "bzeile__name", b.name);
    if (neu) name.appendChild(el("span", "bzeile__neu", "neu"));
    inhalt.appendChild(name);
    inhalt.appendChild(el("span", "bzeile__wie", b.wie || String(b.fund || "").split("\n")[0]));
    knopf.appendChild(inhalt);
    knopf.appendChild(el("span", "bzeile__bereich", b.bereich));
    knopf.appendChild(el("span", "bzeile__gewicht", b.gewicht ? String(b.gewicht) : "–"));
    var pfeil = el("span", "bzeile__pfeil", "→");
    pfeil.setAttribute("aria-hidden", "true");
    knopf.appendChild(pfeil);
    knopf.addEventListener("click", function () { blattOeffnen(b, knopf); });
    li.appendChild(knopf);
    return li;
  }

  function kopfZeichnen(lauf) {
    var p = lauf.punkte;
    var gesamt = p ? p.gesamt : 0;
    zahlSetzen("p-wert", gesamt);
    $("p-skala").style.width = gesamt + "%";
    $("p-verloren").textContent = p
      ? p.verloren + " von " + p.moeglich + " Gewichtspunkten verloren. Keine Kurve, kein Bonus."
      : "";

    var ziel = lauf.ziel || "Eingefügter Quelltext";
    var titel = lauf.katalog.d.querySelector("title");
    if (!lauf.ziel && titel && titel.textContent.trim()) ziel = titel.textContent.trim();
    if (lauf.html === BEISPIEL) ziel = "Beispielseite mit Fehlern";
    $("p-ziel").textContent = ziel.replace(/^https?:\/\//, "");

    var meta = [];
    meta.push(lauf.herkunft === "adresse" ? "über das Relais geholt" : "eingefügter Quelltext");
    meta.push(lauf.domain ? "Ganze Domain" : "Nur diese Seite");
    meta.push(lauf.katalog.geprueft + " Regeln");
    if (lauf.katalog.uebersprungen) meta.push(lauf.katalog.uebersprungen + " übersprungen (Ausschnitt)");
    meta.push(lauf.zeit.toLocaleDateString("de-DE") + ", " + lauf.zeit.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    $("p-meta").textContent = meta.join(" · ");

    zahlSetzen("p-kritisch", lauf.zahl.kritisch);
    zahlSetzen("p-wichtig", lauf.zahl.wichtig);
    zahlSetzen("p-hinweise", lauf.zahl.hinweis);
    zahlSetzen("p-bestanden", lauf.katalog.bestandene.length);

    var v = $("p-vergleich");
    if (lauf.vergleich) {
      v.hidden = false;
      v.textContent = "Seit dem letzten Lauf: " + lauf.vergleich.behoben.length + " behoben, " + lauf.vergleich.neu.length + " neu.";
    } else {
      v.hidden = true;
      v.textContent = "";
    }
  }

  function zuerstZeichnen(lauf) {
    var ziel = $("p-zuerst");
    ziel.textContent = "";
    var geordnet = ordnen(lauf.alle.filter(function (b) { return b.stufe !== "gut"; }));
    var fuenf = geordnet.slice(0, 5);
    var neuMenge = {};
    if (lauf.vergleich) lauf.vergleich.neu.forEach(function (i) { neuMenge[i] = true; });
    fuenf.forEach(function (b) { ziel.appendChild(zeileBauen(b, true, neuMenge[schluesselVon(b)])); });
    if (!fuenf.length) ziel.appendChild(el("li", "leerstand", "Keine Regel hat angeschlagen. Es gibt nichts, was zuerst zu tun wäre."));
    $("p-zuerst-satz").textContent = geordnet.length > 5
      ? "Nach Stufe, dann nach Gewicht. Die anderen " + (geordnet.length - 5) + " offenen Punkte stehen unter „Alle Befunde“."
      : "Nach Stufe, dann nach Gewicht.";
    $("p-n-zuerst").textContent = String(fuenf.length);
    if (BEW && BEW.staffeln) BEW.staffeln(ziel.querySelectorAll(".bzeile"));
  }

  function bereicheZeichnen(lauf) {
    var ziel = $("p-bereiche");
    ziel.textContent = "";
    lauf.bereiche.forEach(function (b) {
      var z = el("div", "bereich bereich--" + b.zustand);
      var name = el("div", "bereich__name");
      name.appendChild(el("span", "bereich__titel", b.titel));
      name.appendChild(el("span", "bereich__unter", b.unter));
      z.appendChild(name);

      var wert = el("div", "bereich__wert");
      if (b.zustand === "geprueft" && typeof b.wert === "number") {
        wert.appendChild(el("span", "bereich__zahl", b.wert));
        wert.appendChild(el("span", "bereich__von", "/100"));
      } else if (b.zustand === "geprueft" && b.urteil) {
        wert.appendChild(stempel(b.urteil === "erlaubt" ? "gut" : "kritisch"));
        wert.lastChild.textContent = b.urteil;
      } else if (b.zustand === "geprueft") {
        wert.appendChild(stempel("gut"));
        wert.lastChild.textContent = "geprüft";
      } else {
        wert.appendChild(el("span", "befund__stufe befund__stufe--offen", "nicht geprüft"));
      }
      z.appendChild(wert);

      var mitte = el("div", "bereich__zustand");
      if (b.zustand === "geprueft" && typeof b.wert === "number") {
        var spur = el("span", "bereich__spur");
        spur.setAttribute("aria-hidden", "true");
        var f = el("span", "bereich__fuellung");
        f.style.width = b.wert + "%";
        spur.appendChild(f);
        mitte.appendChild(spur);
      }
      mitte.appendChild(el("span", "bereich__satz", b.satz));
      z.appendChild(mitte);

      var a = el("a", "bereich__weg", b.link.text + " →");
      a.href = b.link.href;
      z.appendChild(a);
      ziel.appendChild(z);
    });
  }

  var filterWahl = "alle";

  function alleZeichnen(lauf) {
    var ziel = $("p-befunde");
    ziel.textContent = "";
    var offen = lauf.alle.filter(function (b) { return b.stufe !== "gut"; });
    var neuMenge = {};
    if (lauf.vergleich) lauf.vergleich.neu.forEach(function (i) { neuMenge[i] = true; });

    /* Nach Gruppe, in der Reihenfolge des Katalogs; innerhalb nach Stufe
       und Gewicht. Die Reihe fuers Blaettern ist genau diese Folge. */
    var reihenfolge = [];
    offen.forEach(function (b) { if (reihenfolge.indexOf(b.gruppe) === -1) reihenfolge.push(b.gruppe); });
    reihe = [];
    reihenfolge.forEach(function (g) {
      var inGruppe = ordnen(offen.filter(function (b) { return b.gruppe === g; }));
      var block = el("div", "befundgruppe-block");
      var kopf = el("div", "befundgruppe");
      kopf.appendChild(el("span", null, g));
      kopf.appendChild(el("span", "befundgruppe__zahl", inGruppe.length));
      block.appendChild(kopf);
      var ol = el("ol", "zeilenliste");
      inGruppe.forEach(function (b) { reihe.push(b); ol.appendChild(zeileBauen(b, false, neuMenge[schluesselVon(b)])); });
      block.appendChild(ol);
      ziel.appendChild(block);
    });
    if (!offen.length) ziel.appendChild(el("p", "leerstand", "Keine Regel hat angeschlagen. Diese Seite besteht alle " + lauf.katalog.geprueft + " Prüfungen."));

    var zahl = { alle: offen.length, kritisch: 0, wichtig: 0, hinweis: 0 };
    offen.forEach(function (b) { zahl[b.stufe]++; });
    Object.keys(zahl).forEach(function (k) {
      var s = $("p-filter").querySelector('[data-anzahl="' + k + '"]');
      if (s) s.textContent = String(zahl[k]);
    });
    $("p-n-alle").textContent = String(offen.length);
    filterWahl = "alle";
    $("p-suche").value = "";
    filtern();
  }

  function filtern() {
    var suche = $("p-suche").value.trim().toLowerCase();
    var sichtbar = 0;
    var bloecke = $("p-befunde").querySelectorAll(".befundgruppe-block");
    Array.prototype.forEach.call(bloecke, function (block) {
      var imBlock = 0;
      Array.prototype.forEach.call(block.querySelectorAll(".bzeile"), function (z) {
        var passtStufe = filterWahl === "alle" || z.getAttribute("data-stufe") === filterWahl;
        var passtText = !suche || z.textContent.toLowerCase().indexOf(suche) !== -1;
        z.hidden = !(passtStufe && passtText);
        if (!z.hidden) imBlock++;
      });
      block.hidden = imBlock === 0;
      var zahl = block.querySelector(".befundgruppe__zahl");
      if (zahl) zahl.textContent = String(imBlock);
      sichtbar += imBlock;
    });
    Array.prototype.forEach.call($("p-filter").querySelectorAll(".filter[data-stufe]"), function (f) {
      f.setAttribute("aria-pressed", String(f.getAttribute("data-stufe") === filterWahl));
    });
    $("p-stand").textContent = sichtbar + (sichtbar === 1 ? " Befund" : " Befunde") + " angezeigt";
  }

  function messwerteZeichnen(lauf) {
    var q = $("p-quelle");
    q.value = lauf.html;
    if (!ANALYSE || !ANSICHT) return;
    var kat = lauf.katalog;
    var blaetter = $("p-blaetter");
    function blatt(name) { return blaetter.querySelector('[data-blatt="' + name + '"]'); }
    ANSICHT.punkteZeichnen($("p-punkte"), lauf.punkte);
    ANSICHT.profilZeichnen(blatt("profil"), ANALYSE.profil(kat.d, lauf.html));
    ANSICHT.gliederungZeichnen(blatt("gliederung"), ANALYSE.gliederung(kat.d));
    ANSICHT.wortfeldZeichnen(blatt("wortfeld"), ANALYSE, kat.d);
    ANSICHT.verweiseZeichnen(blatt("verweise"), ANALYSE.verweise(kat.d));
    ANSICHT.bilderZeichnen(blatt("bilder"), ANALYSE.bilder(kat.d));
    ANSICHT.wirkungZeichnen(blatt("wirkung"), ANALYSE.wirkungen(K, kat.befunde));
    var zahlKnoten = $("p-punkte").querySelector("[data-zaehler]");
    if (zahlKnoten && BEW && BEW.zaehlen) BEW.zaehlen(zahlKnoten, lauf.punkte.gesamt);
  }

  function bestandenZeichnen(lauf) {
    var ul = $("p-bestandene");
    ul.textContent = "";
    lauf.katalog.bestandene.forEach(function (b) {
      var li = el("li", "bestandenliste__punkt");
      li.appendChild(el("span", null, b.name));
      li.appendChild(el("span", "bestandenliste__gruppe", b.gruppe));
      ul.appendChild(li);
    });
    var n = lauf.katalog.bestandene.length;
    $("p-bestanden-satz").textContent = n + " Regeln haben nichts gefunden. Anzeigen";
    $("p-n-bestanden").textContent = String(n);
  }

  function zusageNachLauf(lauf) {
    var kat = lauf.katalog;
    var satz = kat.vollstaendig
      ? kat.geprueft + " Regeln geprüft."
      : kat.geprueft + " Regeln geprüft, " + kat.uebersprungen + " übersprungen, weil nur ein Ausschnitt eingefügt wurde.";
    if (lauf.herkunft === "quelltext") {
      melden(satz + " Nichts hat dieses Fenster verlassen.", false);
      return;
    }
    /* Nach einem Abruf stimmt „nichts hat das Fenster verlassen" nicht
       mehr. Der Satz wird ERSETZT durch das, was wirklich gegangen ist. */
    var d = lauf.abruf;
    var teile = ["Status " + d.status];
    if (d.spruenge > 0) teile.push(d.spruenge + (d.spruenge === 1 ? " Sprung" : " Sprünge"));
    if (typeof d.ttfb === "number") teile.push(d.ttfb + " ms bis zum ersten Byte");
    if (typeof d.bytes === "number") teile.push(Math.round(d.bytes / 1024) + " kB");
    if (d.abgeschnitten) teile.push("gekürzt");
    var gegangen = "Die Adresse ging an das Relais " + relaisName();
    if (lauf.domain) gegangen += ", DNS-Anfragen an cloudflare-dns.com, die Registrierung an rdap.org"
      + (lauf.domain.rdap ? "" : " (" + (lauf.domain.rdapGrund || "keine Angaben") + ")");
    melden(satz + " " + gegangen + ". Geholt: " + (d.ziel || "") + " (" + teile.join(", ") + "). Geurteilt wurde hier.", false);
  }

  function zeichnen(lauf) {
    kopfZeichnen(lauf);
    zuerstZeichnen(lauf);
    bereicheZeichnen(lauf);
    alleZeichnen(lauf);
    bestandenZeichnen(lauf);
    ergebnis.hidden = false;
    messwerteZeichnen(lauf);
    zusageNachLauf(lauf);
    blattSchliessen(false);
    var ziel = $("p-ziel");
    ergebnis.scrollIntoView({ behavior: bewegungErlaubt() ? "smooth" : "auto", block: "start" });
    ziel.focus({ preventScroll: true });
  }

  function bewegungErlaubt() {
    return !(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  /* ---------------------------------------------------------------
     Das Befundblatt: rechts neben der Liste, auf dem Telefon von unten.
     Die Liste bleibt stehen; man blaettert durch dieselbe Reihe.
     --------------------------------------------------------------- */

  var blatt = $("p-blatt");

  function teil(id, zeigen) { $(id).hidden = !zeigen; }

  function blattFuellen(b) {
    var st = $("p-blatt-stufe");
    st.textContent = "";
    st.appendChild(stempel(b.stufe));
    $("p-blatt-ort").textContent = b.bereich + (b.gewicht ? " · Gewicht " + b.gewicht : "");
    $("p-blatt-titel").textContent = b.name;
    $("p-blatt-wie").textContent = b.wie || "";
    $("p-blatt-fund").textContent = b.fund || "";
    $("p-blatt-fund").hidden = !b.fund;
    $("p-blatt-zeigen").hidden = !(b.fund && b.katalog);
    /* wozu und beheben stammen aus den eigenen Regelsaetzen und duerfen
       <code> tragen. Fremder Text landet hier nie. */
    teil("p-blatt-warumteil", !!b.wozu);
    $("p-blatt-warum").innerHTML = b.wozu || "";
    teil("p-blatt-behebenteil", !!b.beheben);
    $("p-blatt-beheben").innerHTML = b.beheben || "";
    teil("p-blatt-wirkungteil", !!b.wirkung);
    $("p-blatt-wirkung").textContent = b.wirkung || "";
    var regel = $("p-blatt-regel");
    regel.hidden = !b.katalog;
    if (b.katalog) regel.href = "regelsatz.html#regel-" + b.id;
    var i = reihe.indexOf(b);
    offenIndex = i;
    $("p-blatt-stelle").textContent = i >= 0 ? (i + 1) + " von " + reihe.length : "";
    $("p-blatt-zurueck").disabled = i <= 0;
    $("p-blatt-vor").disabled = i < 0 || i >= reihe.length - 1;
  }

  function blattOeffnen(b, knopf) {
    ausloeser = knopf || null;
    blattFuellen(b);
    Array.prototype.forEach.call(document.querySelectorAll(".bzeile--offen"), function (z) { z.classList.remove("bzeile--offen"); });
    if (knopf) knopf.parentNode.classList.add("bzeile--offen");
    blatt.hidden = false;
    document.documentElement.classList.add("blatt-offen");
    $("p-blatt-titel").focus();
  }

  function blattSchliessen(fokusZurueck) {
    if (blatt.hidden) return;
    blatt.hidden = true;
    document.documentElement.classList.remove("blatt-offen");
    Array.prototype.forEach.call(document.querySelectorAll(".bzeile--offen"), function (z) { z.classList.remove("bzeile--offen"); });
    if (fokusZurueck !== false && ausloeser && document.body.contains(ausloeser)) ausloeser.focus();
  }

  function blaettern(schritt) {
    var i = offenIndex + schritt;
    if (i < 0 || i >= reihe.length) return;
    var b = reihe[i];
    blattFuellen(b);
    var zeilen = $("p-befunde").querySelectorAll(".bzeile");
    Array.prototype.forEach.call(document.querySelectorAll(".bzeile--offen"), function (z) { z.classList.remove("bzeile--offen"); });
    if (zeilen[i]) { zeilen[i].classList.add("bzeile--offen"); ausloeser = zeilen[i].querySelector(".bzeile__knopf"); }
    $("p-blatt-titel").focus();
  }

  /* Die Stelle im geprueften Quelltext zeigen: den Block aufklappen und
     die erste Zeile des Funds markieren. */
  function stelleZeigen() {
    if (offenIndex < 0 || !letzter) return;
    var b = reihe[offenIndex];
    var q = $("p-quelle");
    var suche = String(b.fund || "").split("\n")[0].trim();
    var stelle = suche ? letzter.html.indexOf(suche) : -1;
    if (stelle === -1 && suche) {
      var kern = suche.replace(/^[^\w<\/]+/, "").slice(0, 40);
      stelle = kern.length > 3 ? letzter.html.indexOf(kern) : -1;
      if (stelle !== -1) suche = kern;
    }
    $("p-quellblock").open = true;
    blattSchliessen(false);
    q.scrollIntoView({ behavior: bewegungErlaubt() ? "smooth" : "auto", block: "center" });
    q.focus();
    if (stelle === -1) return;
    q.setSelectionRange(stelle, stelle + Math.min(suche.length, 300));
    var zeile = letzter.html.slice(0, stelle).split("\n").length;
    var hoehe = parseFloat(window.getComputedStyle(q).lineHeight) || 20;
    q.scrollTop = Math.max(0, (zeile - 3) * hoehe);
  }

  /* ---------------------------------------------------------------
     Bericht als Text
     --------------------------------------------------------------- */

  function bericht(lauf) {
    var z = [];
    z.push("seo-rank.me - Protokoll");
    z.push(($("p-ziel").textContent || "") + "  (" + $("p-meta").textContent + ")");
    if (lauf.punkte) z.push("Wert dieser Seite: " + lauf.punkte.gesamt + " von 100  (" + lauf.punkte.verloren + " von " + lauf.punkte.moeglich + " Gewichtspunkten verloren)");
    z.push(lauf.zahl.kritisch + " kritisch, " + lauf.zahl.wichtig + " wichtig, " + lauf.zahl.hinweis + " Hinweise, " + lauf.katalog.bestandene.length + " bestanden");
    z.push("");
    z.push("== Zuerst beheben ==");
    ordnen(lauf.alle.filter(function (b) { return b.stufe !== "gut"; })).slice(0, 5).forEach(function (b) {
      z.push("[" + b.stufe.toUpperCase() + "] " + b.name + "  (" + b.bereich + (b.gewicht ? ", Gewicht " + b.gewicht : "") + ")");
      if (b.beheben) z.push("    Zu tun: " + ohneTags(b.beheben));
    });
    z.push("");
    z.push("== Bereiche ==");
    lauf.bereiche.forEach(function (b) {
      z.push("  " + b.titel + ": " + (b.zustand === "geprueft" ? (typeof b.wert === "number" ? b.wert + "/100 · " : "") + b.satz : "nicht geprüft · " + b.satz));
    });
    z.push("");
    z.push("== Alle Befunde ==");
    var gruppe = null;
    reihe.forEach(function (b) {
      if (b.gruppe !== gruppe) { gruppe = b.gruppe; z.push("-- " + gruppe + " --"); }
      z.push("[" + b.stufe.toUpperCase() + "] " + b.name + (b.id ? "  (" + b.id + ")" : ""));
      if (b.wie) z.push("    " + b.wie);
      if (b.fund) String(b.fund).split("\n").forEach(function (x) { z.push("      " + x); });
      if (b.beheben) z.push("    Zu tun: " + ohneTags(b.beheben));
    });
    return z.join("\n");
  }

  function kopieren() {
    if (!letzter) return;
    var text = bericht(letzter);
    function ersatz() {
      var h = el("textarea");
      h.value = text;
      h.setAttribute("readonly", "readonly");
      h.style.position = "fixed";
      h.style.left = "-9999px";
      document.body.appendChild(h);
      h.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (x) { ok = false; }
      document.body.removeChild(h);
      melden(ok ? "Bericht in die Zwischenablage gelegt." : "Das Kopieren hat der Browser abgelehnt.", !ok);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { melden("Bericht in die Zwischenablage gelegt.", false); }, ersatz);
    } else {
      ersatz();
    }
  }

  function drucken() {
    /* Vor dem Druck alle Blaetter einmal aufschlagen: manche zeichnen sich
       erst beim Anklicken. Danach wieder das erste. */
    var reiter = document.querySelectorAll("#p-register .reiter[data-blatt]");
    Array.prototype.forEach.call(reiter, function (r) { r.click(); });
    if (reiter.length) reiter[0].click();
    blattSchliessen(false);
    window.setTimeout(function () { window.print(); }, 60);
  }

  /* ---------------------------------------------------------------
     Die Inhaltsleiste weiss, wo man gerade ist.
     --------------------------------------------------------------- */

  function leisteBeobachten() {
    if (!("IntersectionObserver" in window)) return;
    var punkte = document.querySelectorAll(".inhaltsleiste__punkt");
    var beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        Array.prototype.forEach.call(punkte, function (p) {
          var an = p.getAttribute("href") === "#" + e.target.id;
          if (an) p.setAttribute("aria-current", "true"); else p.removeAttribute("aria-current");
        });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    Array.prototype.forEach.call(document.querySelectorAll(".protokollteil"), function (s) { beobachter.observe(s); });
  }

  /* ---------------------------------------------------------------
     Anschliessen
     --------------------------------------------------------------- */

  starten.addEventListener("click", laufen);
  $("p-erneut").addEventListener("click", laufen);
  feld.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); laufen(); }
    /* Eine Adresse ist eine Zeile: Eingabe startet, solange kein HTML drinsteht. */
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && erkennen(feld.value).art === "adresse") { e.preventDefault(); laufen(); }
  });
  feld.addEventListener("input", function () { vorschauAktualisieren(); feldHoehe(); });

  Array.prototype.forEach.call(wurzel.querySelectorAll('input[name="umfang"]'), function (r) {
    r.addEventListener("change", function () { merken(SCHLUESSEL_UMFANG, umfang()); vorschauAktualisieren(); });
  });

  $("p-beispiel").addEventListener("click", function () {
    feld.value = BEISPIEL;
    vorschauAktualisieren();
    feldHoehe();
    laufen();
  });

  $("p-leeren").addEventListener("click", function () {
    feld.value = "";
    ergebnis.hidden = true;
    blattSchliessen(false);
    letzter = null;
    vorschauAktualisieren();
    feldHoehe();
    feld.focus();
  });

  Array.prototype.forEach.call($("p-filter").querySelectorAll(".filter[data-stufe]"), function (f) {
    f.addEventListener("click", function () { filterWahl = f.getAttribute("data-stufe"); filtern(); });
  });
  $("p-suche").addEventListener("input", filtern);

  $("p-kopieren").addEventListener("click", kopieren);
  $("p-laden").addEventListener("click", function () {
    if (!letzter || !BEW || !BEW.herunterladen) return;
    BEW.herunterladen("seo-rank-protokoll.txt", bericht(letzter), "text/plain");
    melden("Protokoll als Textdatei angeboten.", false);
  });
  $("p-pdf").addEventListener("click", drucken);

  $("p-blatt-zu").addEventListener("click", function () { blattSchliessen(true); });
  $("p-blatt-zurueck").addEventListener("click", function () { blaettern(-1); });
  $("p-blatt-vor").addEventListener("click", function () { blaettern(1); });
  $("p-blatt-zeigen").addEventListener("click", stelleZeigen);
  document.addEventListener("keydown", function (e) {
    if (blatt.hidden) return;
    if (e.key === "Escape") { blattSchliessen(true); }
  });

  if (ANSICHT && ANSICHT.registerAnschliessen) {
    ANSICHT.registerAnschliessen($("p-register"), $("p-blaetter"), null);
  }

  if (BEW && BEW.eingabeMerken) BEW.eingabeMerken(feld, "seorank-pruefer");
  var gemerkterUmfang = lesen(SCHLUESSEL_UMFANG);

  vorschauAktualisieren();
  if (gemerkterUmfang === "domain" && !umfangDomain.disabled) { umfangDomain.checked = true; vorschauAktualisieren(); }
  feldHoehe();
  leisteBeobachten();

  /* Uebergabe von der Startseite: sie legt die Eingabe unter
     „seorank-pruefer" ab und setzt „seorank-sofort". Nichts davon steht
     in der Adresse — Eingaben gehoeren nicht in eine URL. */
  if (location.hash === "#beispiel") {
    feld.value = BEISPIEL;
    vorschauAktualisieren();
    feldHoehe();
    laufen();
  } else if (lesen("seorank-sofort") === "1") {
    vergessen("seorank-sofort");
    if (feld.value.trim()) laufen();
  }
})();
