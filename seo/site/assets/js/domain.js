/* seo-rank.me — Domain-Check im Browser.

   Der Browser darf fremde Adressen nicht abrufen und ihre Antwortkoepfe
   nicht lesen. Ein Domain-Check, der im Browser selbst misst, ist also
   nicht moeglich — das ist keine Bequemlichkeit, das ist die Regel des
   Browsers, und sie gilt fuer jedes Werkzeug, auch fuer die kostenpflichtigen.

   Was moeglich ist: Sie holen die Angaben mit einem Befehl, den Sie ohnehin
   haben, fuegen sie ein, und hier wird geurteilt — mit GENAU DEMSELBEN
   Regelsatz, den auch die Kommandozeile benutzt (`domainregeln.js`).

   Was hier nicht geprueft werden kann, wird nicht verschwiegen, sondern
   im Blatt „Nicht prüfbar" beim Namen genannt. */

(function () {
  "use strict";

  var werkzeug = document.getElementById("domaincheck");
  if (!werkzeug) return;

  var D = (typeof SEORANK_DOMAIN !== "undefined") ? SEORANK_DOMAIN : null;
  if (!D) return;

  var BEWEGUNG = window.SEORANK || null;
  var ANSICHT = (typeof SEORANK_ANSICHT !== "undefined") ? SEORANK_ANSICHT : null;

  var hostFeld = document.getElementById("d-host");
  var kopfFeld = document.getElementById("d-kopf");
  var dnsFeld = document.getElementById("d-dns");
  var starten = document.getElementById("d-starten");
  var beispiel = document.getElementById("d-beispiel");
  var leeren = document.getElementById("d-leeren");
  var laden = document.getElementById("d-laden");
  var ergebnis = document.getElementById("d-ergebnis");
  var hinweis = document.getElementById("d-hinweis");
  var registerleiste = document.getElementById("d-register");
  var blaetter = document.getElementById("d-blaetter");

  var waehlen = null;
  var letzterLauf = null;

  /* Was selbst geholt wurde. Bleibt null, solange niemand darauf
     geklickt hat — und wird beim Leeren wieder null. */
  var geholt = { dns: null, rdap: null, relais: null, fuer: null };

  /* Welche Regeln koennen im Browser GRUNDSAETZLICH nicht geprueft werden,
     weil die noetige Angabe nur beim Abruf entsteht. Das ist keine Liste
     von Ausreden, sondern die Antwort auf „warum steht hier weniger“. */
  var NUR_ABRUF = {
    "dom-nicht-erreichbar": "Es müsste abgerufen werden.",
    "dom-kein-https": "Es müsste abgerufen werden.",
    "dom-http-ohne-weiterleitung": "Die vier Schreibweisen müssten abgerufen werden.",
    "dom-beide-hosts-erreichbar": "Beide Hosts müssten abgerufen werden.",
    "dom-weiterleitungskette": "Die Kette entsteht erst beim Abruf.",
    "dom-langsame-antwort": "Die Zeit bis zum ersten Byte wird beim Abruf gemessen.",
    "tls-abgelaufen": "Das Zertifikat liest nur, wer die Verbindung aufbaut.",
    "tls-laeuft-ab": "Das Zertifikat liest nur, wer die Verbindung aufbaut.",
    "tls-name-passt-nicht": "Das Zertifikat liest nur, wer die Verbindung aufbaut.",
    "tls-zweiter-name-fehlt": "Das Zertifikat liest nur, wer die Verbindung aufbaut.",
    "tls-alte-version": "Die Protokollfassung steht in der Verbindung, nicht im Text.",
    "tls-selbstsigniert": "Das Zertifikat liest nur, wer die Verbindung aufbaut.",
    "tls-kette-unvollstaendig": "Die Kette sendet der Server beim Verbindungsaufbau.",
    "datei-robots-fehlt": "Die Datei müsste abgerufen werden.",
    "datei-robots-ohne-sitemap": "Die Datei müsste abgerufen werden.",
    "datei-sitemap-fehlt": "Die Datei müsste abgerufen werden.",
    "datei-favicon-fehlt": "Die Datei müsste abgerufen werden.",
    "datei-securitytxt-fehlt": "Die Datei müsste abgerufen werden.",
    "datei-soft404": "Ein erfundener Pfad müsste abgerufen werden.",
    "reg-laeuft-ab": "Mit „dns und registrierung holen“ prüfbar, sofern rdap.org die Endung kennt.",
    "reg-gesperrt": "Mit „dns und registrierung holen“ prüfbar, sofern rdap.org die Endung kennt."
  };

  /* Die zehn DNS-Regeln stehen bewusst NICHT in dieser Liste: sie sind
     im Browser prüfbar, entweder aus einer eingefügten dig-Ausgabe oder
     über „dns und registrierung holen“. Wer nichts von beidem tut, dem
     fehlt eine Angabe — das ist etwas anderes, als dass es nicht ginge. */

  function el(name, klasse, text) {
    var k = document.createElement(name);
    if (klasse) k.className = klasse;
    if (text !== undefined && text !== null) k.textContent = String(text);
    return k;
  }

  function blatt(name) { return blaetter.querySelector('[data-blatt="' + name + '"]'); }

  function leerenKnoten(k) { while (k.firstChild) k.removeChild(k.firstChild); }

  function melden(text, warnung) {
    if (!hinweis) return;
    hinweis.textContent = text;
    hinweis.classList.toggle("formhinweis--warn", !!warnung);
  }

  /* ---------------------------------------------------------------
     Befund aus den eingefuegten Angaben bauen

     Wichtig: Felder, zu denen nichts eingefuegt wurde, werden GAR NICHT
     gesetzt. Ein leeres Feld waere die Behauptung „nachgesehen und nichts
     gefunden" — und erzeugte Befunde ueber Dinge, die niemand geprueft hat.
     --------------------------------------------------------------- */

  function befundBauen() {
    var befund = {};

    var host = (hostFeld.value || "").trim()
      .replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();

    var kopftext = (kopfFeld.value || "").trim();
    var gelesen = null;
    if (kopftext) {
      gelesen = D.kopfzeilenLesen(kopftext);
      if (Object.keys(gelesen.kopf).length) befund.kopf = gelesen.kopf;
      /* Cookies nur setzen, wenn ueberhaupt Kopfzeilen da sind: sonst
         hiesse eine leere Liste „es wurden keine gesetzt“, und das weiss
         hier niemand. */
      if (befund.kopf) befund.cookies = gelesen.cookies;
      /* Der Host steht oft schon in den eingefuegten Kopfzeilen. */
      if (!host && gelesen.kopf.host) host = gelesen.kopf.host;
    }

    var dnstext = (dnsFeld.value || "").trim();
    var dnsGelesen = null;
    if (dnstext) {
      dnsGelesen = D.dnsLesen(dnstext);
      var etwas = ["a", "aaaa", "ns", "mx", "txt", "caa"].some(function (k) {
        return dnsGelesen[k].length > 0;
      });
      if (etwas) befund.dns = dnsGelesen;
    }

    if (host) {
      befund.host = host;
      befund.domain = host.replace(/^www\./, "");
    }

    /* Selbst Geholtes gilt nur fuer die Domain, fuer die es geholt
       wurde. Wer danach den Host aendert, bekommt es NICHT weiter
       angerechnet — sonst stuenden fremde Messwerte unter einem
       anderen Namen. Eingefuegte Angaben haben Vorrang: sie stammen
       vom Benutzer selbst. */
    var domain = befund.domain || (host ? host.replace(/^www\./, "") : null);
    if (geholt.fuer && domain === geholt.fuer) {
      if (geholt.dns && !befund.dns) befund.dns = geholt.dns;
      if (geholt.rdap) befund.rdap = geholt.rdap;
      var r = geholt.relais;
      if (r) {
        /* Nur uebernehmen, was ANGEKOMMEN ist. Wenn das Relais gar nicht
           antwortet, tragen alle vier Schreibweisen status null — und der
           Regelsatz laese daraus „Domain antwortet nicht". Das waere ein
           Urteil ueber die Domain, obwohl der Bote gefehlt hat. Ohne
           Varianten werden die Erreichbarkeitsregeln uebersprungen, wie es
           bei jeder anderen fehlenden Angabe auch geschieht. */
        if (r.varianten && r.varianten.some(function (v) { return v.status; })) {
          befund.varianten = r.varianten;
        }
        if (r.dateien) befund.dateien = r.dateien;
        if (r.kopf && !befund.kopf) {
          befund.kopf = r.kopf;
          befund.cookies = r.cookies || [];
        }
        if (typeof r.ttfb === "number" && befund.ttfb === undefined) befund.ttfb = r.ttfb;
        if (r.host && !host) { befund.host = r.host; befund.domain = r.host.replace(/^www\./, ""); }
      }
    }

    return { befund: befund, kopfGelesen: gelesen, dnsGelesen: befund.dns ? dnsGelesen : null,
             ausAbruf: !!(geholt.fuer && domain === geholt.fuer) };
  }

  /* ---------------------------------------------------------------
     Selbst holen: DNS und Registrierung

     Der Browser darf kein DNS aufloesen — er kann aber einen Aufloeser
     ueber HTTPS fragen, der CORS erlaubt. Gemessen: cloudflare-dns.com
     und dns.google antworten beide mit 200 und offenem CORS, rdap.org
     ebenso. rdap.denic.de dagegen blockiert CORS; fuer .de-Domains
     bleibt die Registrierung hier deshalb offen.

     Das ist ein FREMDAUFRUF und damit die Ausnahme auf dieser Website.
     Er passiert nur auf ausdruecklichen Klick, nie beim Laden, nie beim
     gewoehnlichen Pruefen eingefuegter Angaben.
     --------------------------------------------------------------- */

  /* Die Sammler selbst stehen seit dem 22.09.2026 im Pruefwerk, weil
     auch das Protokoll sie braucht. Hier bleibt nur der Aufruf. */
  var PW = SEORANK_PRUEFWERK;
  var A = (typeof SEORANK_ABRUF !== "undefined") ? SEORANK_ABRUF : null;


  /* ---------------------------------------------------------------
     Zeichnen
     --------------------------------------------------------------- */

  function befundKnoten(b) {
    var zeile = el("div", "befund");
    zeile.setAttribute("data-stufe", b.stufe);

    var marker = el("span", "befund__marker marker--" + b.stufe);

    var mitte = el("div");
    mitte.appendChild(el("div", "befund__name", b.name));
    mitte.appendChild(el("p", "befund__wie", b.wozu));
    if (b.fund) mitte.appendChild(el("code", "befund__fund", b.fund));
    var beheben = el("p", "befund__wie");
    beheben.appendChild(el("strong", null, "Beheben: "));
    beheben.appendChild(document.createTextNode(b.beheben));
    mitte.appendChild(beheben);

    var stufe = el("span", "befund__stufe befund__stufe--" + b.stufe, b.stufe === "gut" ? "bestanden" : b.stufe);

    zeile.appendChild(marker);
    zeile.appendChild(mitte);
    zeile.appendChild(stufe);
    return zeile;
  }

  function befundeZeichnen(ziel, e) {
    leerenKnoten(ziel);
    var kopf = el("p", "blatthinweis");
    kopf.textContent = e.befunde.length
      ? "Beurteilt wurden " + (e.befunde.length + e.bestanden.length) + " von "
        + D.anzahl + " Regeln. Die übrigen brauchen einen Abruf und stehen im Blatt „Nicht prüfbar“."
      : "Kein Befund unter den " + (e.befunde.length + e.bestanden.length)
        + " Regeln, die sich aus Ihren Angaben beurteilen lassen.";
    ziel.appendChild(kopf);

    if (!e.befunde.length) {
      ziel.appendChild(el("p", "leerstand", "Nichts zu beanstanden."));
      return;
    }
    e.befunde.forEach(function (b) { ziel.appendChild(befundKnoten(b)); });
    if (BEWEGUNG) BEWEGUNG.staffeln(ziel.querySelectorAll(".befund"));
  }

  function tabelle(ueberschriften) {
    var rolle = el("div", "rolle");
    var t = el("table", "tabelle");
    var kopf = el("thead");
    var tr = el("tr");
    ueberschriften.forEach(function (u) { tr.appendChild(el("th", null, u)); });
    kopf.appendChild(tr);
    t.appendChild(kopf);
    var tb = el("tbody");
    t.appendChild(tb);
    rolle.appendChild(t);
    return { rolle: rolle, koerper: tb };
  }

  function gemessenZeichnen(ziel, gebaut, e) {
    leerenKnoten(ziel);
    ziel.appendChild(el("p", "blatthinweis",
      "Was aus Ihren Angaben gelesen wurde. Steht hier etwas nicht, das Sie eingefügt haben, "
      + "wurde die Zeile nicht verstanden — dann stimmt das Format nicht."));

    var b = gebaut.befund;

    if (b.kopf) {
      ziel.appendChild(el("h3", null, "Kopfzeilen"));
      var t1 = tabelle(["Kopfzeile", "Wert"]);
      Object.keys(b.kopf).sort().forEach(function (k) {
        var tr = el("tr");
        tr.appendChild(el("td", "mono", k));
        tr.appendChild(el("td", "mono still", b.kopf[k]));
        t1.koerper.appendChild(tr);
      });
      ziel.appendChild(t1.rolle);

      if (b.cookies && b.cookies.length) {
        ziel.appendChild(el("h3", null, "Cookies"));
        var t2 = tabelle(["Name", "Secure", "HttpOnly", "SameSite"]);
        b.cookies.forEach(function (c) {
          var tr = el("tr");
          tr.appendChild(el("td", "mono", String(c).split("=")[0]));
          [/;\s*Secure/i, /;\s*HttpOnly/i, /;\s*SameSite/i].forEach(function (muster) {
            var td = el("td");
            var ja = muster.test(c);
            td.appendChild(el("span", "haken haken--" + (ja ? "ja" : "nein"), ja ? "ja" : "nein"));
            tr.appendChild(td);
          });
          t2.koerper.appendChild(tr);
        });
        ziel.appendChild(t2.rolle);
      }
    }

    if (b.dns) {
      ziel.appendChild(el("h3", null, "DNS"));
      var t3 = tabelle(["Art", "Anzahl", "Werte"]);
      [["A", b.dns.a], ["AAAA", b.dns.aaaa], ["NS", b.dns.ns], ["MX", b.dns.mx],
       ["TXT", b.dns.txt], ["SPF", b.dns.spf], ["DMARC", b.dns.dmarc], ["CAA", b.dns.caa]
      ].forEach(function (paar) {
        var tr = el("tr");
        tr.appendChild(el("td", "mono", paar[0]));
        tr.appendChild(el("td", "tabelle__zahl", paar[1].length));
        tr.appendChild(el("td", "mono still", paar[1].slice(0, 3).join("  ·  ")));
        t3.koerper.appendChild(tr);
      });
      ziel.appendChild(t3.rolle);
      if (b.dns.aTtl) {
        ziel.appendChild(el("p", "blatthinweis", "Gültigkeitsdauer des A-Eintrags: " + b.dns.aTtl + " Sekunden."));
      }
    }

    if (!b.kopf && !b.dns) {
      ziel.appendChild(el("p", "leerstand", "Es wurde nichts gelesen. Fügen Sie Kopfzeilen oder eine DNS-Ausgabe ein."));
    }

    if (gebaut.kopfGelesen && gebaut.kopfGelesen.unverstanden.length) {
      ziel.appendChild(el("h3", null, "Nicht verstandene Zeilen"));
      var liste = el("div");
      gebaut.kopfGelesen.unverstanden.slice(0, 12).forEach(function (z) {
        liste.appendChild(el("code", "befund__fund", z));
      });
      ziel.appendChild(liste);
    }
  }

  function uebersprungenZeichnen(ziel, e) {
    leerenKnoten(ziel);
    ziel.appendChild(el("p", "blatthinweis",
      "Über diese Regeln wurde NICHT geurteilt. Sie zählen weder positiv noch negativ — "
      + "eine Punktzahl aus zwanzig Regeln wäre sonst mit einer aus achtundvierzig verwechselbar."));

    var nurAbruf = [], fehltAngabe = [];
    e.uebersprungen.forEach(function (u) {
      if (NUR_ABRUF[u.id]) nurAbruf.push({ u: u, grund: NUR_ABRUF[u.id] });
      else fehltAngabe.push(u);
    });

    if (fehltAngabe.length) {
      ziel.appendChild(el("h3", null, "Dafür fehlt eine Angabe von Ihnen"));
      var t1 = tabelle(["Regel", "Gruppe", "Kennung"]);
      fehltAngabe.forEach(function (u) {
        var tr = el("tr");
        tr.appendChild(el("td", null, u.name));
        tr.appendChild(el("td", "still", u.gruppe));
        tr.appendChild(el("td", "mono still", u.id));
        t1.koerper.appendChild(tr);
      });
      ziel.appendChild(t1.rolle);
    }

    if (nurAbruf.length) {
      ziel.appendChild(el("h3", null, "Das geht im Browser grundsätzlich nicht"));
      var t2 = tabelle(["Regel", "Warum nicht", "Kennung"]);
      nurAbruf.forEach(function (x) {
        var tr = el("tr");
        tr.appendChild(el("td", null, x.u.name));
        tr.appendChild(el("td", "still", x.grund));
        tr.appendChild(el("td", "mono still", x.u.id));
        t2.koerper.appendChild(tr);
      });
      ziel.appendChild(t2.rolle);
      var p = el("p", "blatthinweis");
      p.appendChild(document.createTextNode("Alle " + nurAbruf.length
        + " prüft die Kommandozeile in einem Durchgang: "));
      var c = el("code", null, "seo-rank domain ihre-domain.de");
      p.appendChild(c);
      p.appendChild(document.createTextNode(". Wie das eingerichtet wird, steht auf der Seite "));
      var a = el("a", null, "Kommandozeile und CI");
      a.href = "kommandozeile.html";
      p.appendChild(a);
      p.appendChild(document.createTextNode("."));
      ziel.appendChild(p);
    }
  }

  function anleitungZeichnen(ziel) {
    leerenKnoten(ziel);
    ziel.appendChild(el("p", "blatthinweis",
      "Drei Wege zu den Angaben. Alle drei laufen auf Ihrem Rechner; nichts davon geht über uns."));

    function block(titel, was, befehl) {
      ziel.appendChild(el("h3", null, titel));
      ziel.appendChild(el("p", "befund__wie", was));
      if (befehl) ziel.appendChild(el("code", "befund__fund", befehl));
    }

    block("Kopfzeilen aus dem Browser",
      "Entwicklerwerkzeuge öffnen (F12), Reiter „Netzwerk“, die Seite neu laden, den obersten Eintrag anklicken, "
      + "unter „Headers“ den Abschnitt „Response Headers“ auf „Raw“ stellen und alles kopieren.", null);

    block("Kopfzeilen mit curl",
      "Ein Befehl, kein Werkzeug nötig — curl liegt auf macOS, Linux und aktuellem Windows bei.",
      "curl -sSIL https://ihre-domain.de/");

    block("DNS mit dig",
      "Fragt alle Einträge auf einmal ab. Unter Windows entweder über das Windows-Subsystem für Linux oder mit nslookup, siehe unten.",
      "dig ihre-domain.de A AAAA NS MX TXT CAA +noall +answer\ndig _dmarc.ihre-domain.de TXT +noall +answer");

    block("DNS mit nslookup",
      "Liegt jedem Windows bei. Je Eintragsart ein Aufruf.",
      "nslookup -type=A ihre-domain.de\nnslookup -type=NS ihre-domain.de\nnslookup -type=MX ihre-domain.de\nnslookup -type=TXT ihre-domain.de");

    var p = el("p", "blatthinweis");
    p.appendChild(document.createTextNode(
      "Wer Node auf dem Rechner hat, spart sich das Einfügen: die Kommandozeile misst alle "
      + D.anzahl + " Regeln selbst, samt Zertifikat, Weiterleitungen und Standarddateien."));
    ziel.appendChild(p);
    ziel.appendChild(el("code", "befund__fund", "node cli/seorank.mjs domain ihre-domain.de --ausführlich"));
  }

  /* ---------------------------------------------------------------
     Ablauf
     --------------------------------------------------------------- */

  function laufen() {
    var gebaut = befundBauen();
    var b = gebaut.befund;

    if (!b.kopf && !b.dns && !b.rdap) {
      melden("Bitte Antwortkopfzeilen oder eine DNS-Ausgabe einfügen — oder oben einen Host eintragen "
        + "und „dns und registrierung holen“ klicken. Wie Sie an die Angaben kommen, steht im Blatt „Anleitung“.", true);
      kopfFeld.focus();
      return;
    }

    var e = D.pruefen(b);
    letzterLauf = { befund: b, urteil: e, gebaut: gebaut, ausAbruf: gebaut.ausAbruf };

    var geprueft = e.befunde.length + e.bestanden.length;

    function zahl(id, wert, klasse) {
      var k = document.getElementById(id);
      if (!k) return;
      k.className = "bilanz__zahl" + (klasse ? " " + klasse : "");
      if (BEWEGUNG && typeof wert === "number") BEWEGUNG.zaehlen(k, wert);
      else k.textContent = wert;
    }

    zahl("d-geprueft", geprueft);
    zahl("d-kritisch", e.zahl.kritisch, e.zahl.kritisch ? "bilanz__zahl--kritisch" : "bilanz__zahl--gut");
    zahl("d-wichtig", e.zahl.wichtig, e.zahl.wichtig ? "bilanz__zahl--signal" : "bilanz__zahl--gut");
    zahl("d-punkte", e.punkte === null ? "—" : e.punkte,
      e.punkte === null ? "" : (e.punkte >= 90 ? "bilanz__zahl--gut" : (e.punkte >= 70 ? "bilanz__zahl--signal" : "bilanz__zahl--kritisch")));

    befundeZeichnen(blatt("befunde"), e);
    gemessenZeichnen(blatt("gemessen"), gebaut, e);
    uebersprungenZeichnen(blatt("uebersprungen"), e);
    anleitungZeichnen(blatt("anleitung"));

    if (waehlen) waehlen("befunde");
    ergebnis.hidden = false;

    /* Diese Zusage darf nur stehen, wenn sie stimmt. Wurde etwas geholt,
       hat der Domainname das Fenster verlassen, und das wird gesagt. */
    melden(geprueft + " von " + D.anzahl + " Regeln beurteilt · " + e.zahl.kritisch
      + " kritisch, " + e.zahl.wichtig + " wichtig. "
      + (gebaut.ausAbruf
          ? "Dafür ist der Domainname an cloudflare-dns.com und rdap.org gegangen"
            + (geholt.relais && geholt.relais.varianten
                 && geholt.relais.varianten.some(function (v) { return v.status; })
                ? ", und das Relais " + (A ? A.adresse() : "") + " hat die Seite selbst abgerufen"
                : "")
            + (geholt.relais && geholt.relais.varianten
                 && !geholt.relais.varianten.some(function (v) { return v.status; })
                ? ". Das Relais " + (A ? A.adresse() : "") + " war nicht erreichbar, deshalb bleiben "
                  + "Erreichbarkeit, Kopfzeilen und Standarddateien offen"
                : "")
            + ". Eingefügte Angaben sind hier geblieben."
          : "Nichts hat dieses Fenster verlassen."),
      e.zahl.kritisch > 0);
  }

  if (ANSICHT && registerleiste && blaetter) {
    waehlen = ANSICHT.registerAnschliessen(registerleiste, blaetter, null);
  }

  starten.addEventListener("click", laufen);

  /* Der einzige Knopf auf dieser Seite, der etwas abruft. Er sagt das
     vorher, waehrenddessen und hinterher. */
  var holenKnopf = document.getElementById("d-holen");
  if (holenKnopf) {
    holenKnopf.addEventListener("click", function () {
      var host = (hostFeld.value || "").trim()
        .replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
      if (!host && kopfFeld.value.trim()) {
        var k = D.kopfzeilenLesen(kopfFeld.value);
        if (k.kopf.host) host = k.kopf.host;
      }
      if (!host || host.indexOf(".") < 0) {
        melden("Bitte erst einen Host eintragen — zum Beispiel beispiel-domain.de.", true);
        hostFeld.focus();
        return;
      }
      var domain = host.replace(/^www\./, "");

      holenKnopf.disabled = true;
      starten.disabled = true;
      melden("Frage Cloudflare nach dem DNS, rdap.org nach der Registrierung"
        + (A ? " und das Relais nach den vier Schreibweisen und den Standarddateien" : "")
        + " …", false);

      Promise.all([PW.dnsHolen(domain), PW.rdapHolen(domain), PW.relaisHolen(domain)]).then(function (paar) {
        var rdapGrund = paar[1].grund;
        paar[1] = paar[1].daten;
        holenKnopf.disabled = false;
        starten.disabled = false;
        geholt = { dns: paar[0], rdap: paar[1], relais: paar[2], fuer: domain };

        if (paar[2] && paar[2].varianten) {
          var lebend = paar[2].varianten.filter(function (v) { return v.status; }).length;
          /* Keine einzige Antwort heisst: der Bote fehlt. Das ist etwas
             anderes als eine stumme Domain, und es wird auch so gesagt. */
          melden(lebend
            ? "Geholt für " + domain + " — " + lebend + " von 4 Schreibweisen antworten, "
              + (paar[0] ? "DNS gelesen" : "DNS nicht erreichbar") + ". Wird ausgewertet …"
            : "Das Relais " + (A ? A.adresse() : "") + " war nicht erreichbar. "
              + (paar[0] ? "DNS und Registrierung wurden trotzdem gelesen; " : "")
              + "die Regeln zu Erreichbarkeit, Kopfzeilen und Standarddateien bleiben offen — "
              + "geraten wird nichts.",
            !lebend);
        }

        if (!paar[0] && !paar[1] && !paar[2]) {
          melden("Weder der DNS-Auflöser noch rdap.org waren erreichbar. "
            + "Es wurde nichts übernommen — geraten wird nicht.", true);
          return;
        }

        var teile = [];
        if (paar[0]) {
          teile.push(paar[0].a.length + " A, " + paar[0].aaaa.length + " AAAA, "
            + paar[0].ns.length + " NS, " + paar[0].mx.length + " MX, "
            + paar[0].spf.length + " SPF, " + paar[0].dmarc.length + " DMARC, "
            + paar[0].caa.length + " CAA");
        } else {
          teile.push("DNS nicht erreichbar");
        }
        teile.push(paar[1]
          ? "Registrierung: " + (paar[1].registrar || "ohne Registrarnamen")
          : "keine Registrierungsdaten (" + (rdapGrund || "unbekannter Grund") + ")");

        melden("Geholt für " + domain + " — " + teile.join(" · ")
          + ". Die Angaben sind an Cloudflare und rdap.org gegangen.", false);
        laufen();
      });
    });
  }

  [kopfFeld, dnsFeld].forEach(function (f) {
    if (!f) return;
    f.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") laufen();
    });
  });
  if (hostFeld) {
    hostFeld.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); laufen(); }
    });
  }

  if (leeren) {
    leeren.addEventListener("click", function () {
      hostFeld.value = "";
      kopfFeld.value = "";
      dnsFeld.value = "";
      geholt = { dns: null, rdap: null, fuer: null };
      ergebnis.hidden = true;
      melden("", false);
      hostFeld.focus();
    });
  }

  /* Die Probe zeigt einen Server, der vieles richtig macht und dreierlei
     nicht: keine Berechtigungsrichtlinie, ein Cookie ohne SameSite und
     eine sehr kurze Gueltigkeitsdauer im DNS. */
  if (beispiel) {
    beispiel.addEventListener("click", function () {
      hostFeld.value = "www.beispiel-domain.de";
      kopfFeld.value = [
        "HTTP/2 200",
        "date: Sat, 30 Aug 2026 09:12:44 GMT",
        "content-type: text/html; charset=utf-8",
        "content-encoding: br",
        "cache-control: public, max-age=600",
        "strict-transport-security: max-age=63072000; includeSubDomains",
        "x-content-type-options: nosniff",
        "referrer-policy: strict-origin-when-cross-origin",
        "content-security-policy: default-src 'self'",
        "x-frame-options: SAMEORIGIN",
        "server: nginx/1.24.0",
        "x-powered-by: PHP/8.2.12",
        "set-cookie: sitzung=abc123; Path=/; Secure; HttpOnly"
      ].join("\n");
      dnsFeld.value = [
        "beispiel-domain.de.\t120\tIN\tA\t203.0.113.42",
        "beispiel-domain.de.\t3600\tIN\tNS\tns1.hoster.de.",
        "beispiel-domain.de.\t3600\tIN\tNS\tns2.hoster.de.",
        "beispiel-domain.de.\t3600\tIN\tMX\t10 mail.hoster.de.",
        "beispiel-domain.de.\t3600\tIN\tTXT\t\"v=spf1 include:hoster.de -all\"",
        "_dmarc.beispiel-domain.de.\t3600\tIN\tTXT\t\"v=DMARC1; p=none; rua=mailto:post@beispiel-domain.de\""
      ].join("\n");
      melden("Beispiel eingesetzt. Auf „prüfen“ klicken.", false);
    });
  }

  if (laden) {
    laden.addEventListener("click", function () {
      if (!letzterLauf) return;
      var e = letzterLauf.urteil;
      var z = [];
      z.push("seo-rank.me — Domain-Prüfung aus eingefügten Angaben");
      z.push(letzterLauf.ausAbruf
        ? "Geurteilt im Browser. DNS und Registrierung wurden bei cloudflare-dns.com "
          + "und rdap.org geholt; eingefügte Angaben blieben hier."
        : "Gerechnet im Browser, nichts abgerufen.");
      if (letzterLauf.befund.host) z.push("Host: " + letzterLauf.befund.host);
      z.push("");
      z.push("Beurteilt: " + (e.befunde.length + e.bestanden.length) + " von " + D.anzahl + " Regeln");
      z.push("Punkte: " + (e.punkte === null ? "—" : e.punkte + " von 100"));
      z.push("Befunde: " + e.zahl.kritisch + " kritisch, " + e.zahl.wichtig + " wichtig, " + e.zahl.hinweis + " Hinweise");
      z.push("");
      z.push("BEFUNDE");
      if (!e.befunde.length) z.push("  keine");
      e.befunde.forEach(function (b) {
        z.push("  [" + b.stufe + "] " + b.name + "   (" + b.gruppe + " · " + b.id + ")");
        z.push("      Fund:    " + b.fund);
        z.push("      Warum:   " + b.wozu);
        z.push("      Beheben: " + b.beheben);
      });
      z.push("");
      z.push("NICHT BEURTEILT (" + e.uebersprungen.length + ")");
      e.uebersprungen.forEach(function (u) {
        z.push("  " + u.id + "  " + u.name + (NUR_ABRUF[u.id] ? "   — " + NUR_ABRUF[u.id] : "   — Angabe fehlt"));
      });

      var d = new Blob([z.join("\n")], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(d);
      a.download = "domain-pruefung.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });
  }
})();
