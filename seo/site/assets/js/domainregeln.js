/* seo-rank.me — Domain-Regeln.

   Eine Quelle fuer den Domain-Check auf der Kommandozeile und fuer die
   Auswertung eingefuegter Angaben im Browser. Diese Datei URTEILT nur —
   sie ruft nichts ab und kennt weder Netz noch Dateisystem. Was gemessen
   wird, sammelt `cli/domain.mjs`; was hier steht, bewertet es.

   Diese Trennung ist Absicht: so kann der Browser dieselben Regeln auf
   Angaben anwenden, die jemand von Hand einfuegt, ohne dass es zwei
   Fassungen derselben Bewertung gibt.

   Der Befund, den beide Seiten hereinreichen, hat diese Form — jedes Feld
   darf fehlen, dann wird die zugehoerige Regel UEBERSPRUNGEN und zaehlt
   weder positiv noch negativ:

   {
     domain, host,
     varianten: [{ url, status, ziel, kette: [{url,status}], fehler }],
     tls: { protokoll, aussteller, san, gueltigBis, tageRest, selbstsigniert,
            kettenlaenge, fehler },
     kopf: { "header-name": "wert" },
     ttfb, cookies: ["name=wert; ..."],
     dns: { a, aTtl, aaaa, ns, mx, spf, dmarc, caa, ptr },
     dateien: { robots, sitemap, favicon, securitytxt, zufallspfad },
     rdap: { registrar, erstellt, laeuftAb, tageRest, status }
   }
*/

var SEORANK_DOMAIN = (function () {
  "use strict";

  /* ---------------------------------------------------------------
     Hilfen
     --------------------------------------------------------------- */

  /* „Da" heisst: es wurde GEMESSEN. Ein leeres Feld heisst nicht null,
     sondern unbekannt — und unbekannt wird uebersprungen, nicht bemaengelt.
     Ein leeres Objekt ist deshalb NICHT da: wer keine Kopfzeilen einfuegt,
     bekommt keine dreizehn Befunde ueber fehlende Kopfzeilen.
     Ein leeres ARRAY dagegen ist da: der Sammler gibt es nur zurueck,
     wenn er nachgesehen und nichts gefunden hat. */
  function da(wert) {
    if (wert === null || wert === undefined) return false;
    if (Array.isArray(wert)) return true;
    if (typeof wert === "object") return Object.keys(wert).length > 0;
    return String(wert).length > 0;
  }

  function kopfLesen(befund, name) {
    if (!befund.kopf) return undefined;
    var k = befund.kopf;
    var suche = name.toLowerCase();
    for (var s in k) {
      if (Object.prototype.hasOwnProperty.call(k, s) && s.toLowerCase() === suche) return k[s];
    }
    return undefined;
  }

  function ohneWww(h) { return String(h || "").replace(/^www\./i, ""); }

  function variante(befund, kennung) {
    if (!befund.varianten) return null;
    for (var i = 0; i < befund.varianten.length; i++) {
      if (befund.varianten[i].kennung === kennung) return befund.varianten[i];
    }
    return null;
  }

  /* Deckt ein Zertifikatsname den Host? Ein fuehrendes Sternchen deckt
     genau EINE Ebene — *.beispiel.de deckt www.beispiel.de, aber nicht
     a.b.beispiel.de und auch nicht beispiel.de selbst. */
  function nameDeckt(muster, host) {
    muster = String(muster || "").toLowerCase().trim();
    host = String(host || "").toLowerCase().trim();
    if (!muster || !host) return false;
    if (muster === host) return true;
    if (muster.indexOf("*.") !== 0) return false;
    var rest = muster.slice(2);
    var punkt = host.indexOf(".");
    if (punkt === -1) return false;
    return host.slice(punkt + 1) === rest;
  }

  function zahlAusHsts(wert) {
    var m = String(wert || "").match(/max-age\s*=\s*"?(\d+)"?/i);
    return m ? parseInt(m[1], 10) : null;
  }

  /* ---------------------------------------------------------------
     Der Regelsatz

     Jede Regel: id, gruppe, name, stufe, gewicht, wozu, beheben.
     `braucht(b)` sagt, ob genug Angaben da sind — sonst uebersprungen.
     `pruefe(b)` gibt null zurueck, wenn alles in Ordnung ist, sonst
     einen Text mit dem Fund.
     --------------------------------------------------------------- */

  var REGELN = [

    /* ===== Erreichbarkeit ===== */
    {
      id: "dom-nicht-erreichbar", gruppe: "Erreichbarkeit", stufe: "kritisch", gewicht: 10,
      name: "Domain antwortet nicht",
      wozu: "Keine der vier Schreibweisen liefert eine Antwort. Dann ist die Website für niemanden erreichbar, und alles Weitere erübrigt sich.",
      beheben: "Prüfen Sie DNS-Eintrag, Server und Firewall. Die vier Schreibweisen sind http und https, jeweils mit und ohne www.",
      braucht: function (b) { return da(b.varianten) && b.varianten.length > 0; },
      pruefe: function (b) {
        var lebt = b.varianten.filter(function (v) { return v.status && !v.fehler; });
        if (lebt.length) return null;
        return b.varianten.map(function (v) { return v.kennung + ": " + (v.fehler || "keine Antwort"); }).join(" · ");
      }
    },
    {
      id: "dom-kein-https", gruppe: "Erreichbarkeit", stufe: "kritisch", gewicht: 9,
      name: "Kein HTTPS",
      wozu: "Ohne verschlüsselte Verbindung warnt jeder Browser sichtbar, und Google bevorzugt seit Jahren HTTPS. Formulare und Anmeldungen sind außerdem mitlesbar.",
      beheben: "Zertifikat einrichten — bei Let's Encrypt kostenlos — und den Server auf 443 antworten lassen.",
      braucht: function (b) { return da(b.varianten); },
      pruefe: function (b) {
        var sicher = b.varianten.filter(function (v) {
          return v.kennung.indexOf("https") === 0 && v.status && !v.fehler;
        });
        return sicher.length ? null : "Weder https:// noch https://www. antworten.";
      }
    },
    {
      id: "dom-http-ohne-weiterleitung", gruppe: "Erreichbarkeit", stufe: "kritisch", gewicht: 8,
      name: "HTTP leitet nicht auf HTTPS",
      wozu: "Wenn die unverschlüsselte Adresse mit 200 antwortet, gibt es die Seite zweimal: einmal sicher, einmal nicht. Das ist Doppelinhalt und ein Sicherheitsloch zugleich.",
      beheben: "Auf Port 80 dauerhaft (301) auf dieselbe Adresse unter https weiterleiten. Ein einziger Sprung genügt.",
      braucht: function (b) {
        var h = variante(b, "http") || variante(b, "http-www");
        return !!(h && h.status);
      },
      pruefe: function (b) {
        var schlecht = (b.varianten || []).filter(function (v) {
          return v.kennung.indexOf("http") === 0 && v.kennung.indexOf("https") !== 0
            && v.status === 200 && String(v.ziel || "").indexOf("https://") !== 0;
        });
        if (!schlecht.length) return null;
        return schlecht.map(function (v) { return v.url + " antwortet mit 200 statt weiterzuleiten"; }).join(" · ");
      }
    },
    {
      id: "dom-beide-hosts-erreichbar", gruppe: "Erreichbarkeit", stufe: "kritisch", gewicht: 8,
      name: "www und ohne www liefern beide Inhalt",
      wozu: "Google sieht zwei Websites mit demselben Inhalt. Die Bewertung teilt sich auf beide auf, und welche in der Trefferliste erscheint, entscheidet nicht mehr Sie.",
      beheben: "Eine Schreibweise festlegen und die andere dauerhaft dorthin weiterleiten. Welche, ist gleichgültig — nur eine darf mit 200 antworten.",
      braucht: function (b) {
        var a = variante(b, "https"), c = variante(b, "https-www");
        return !!(a && c && a.status && c.status);
      },
      pruefe: function (b) {
        var a = variante(b, "https"), c = variante(b, "https-www");
        if (a.status !== 200 || c.status !== 200) return null;
        var zielA = String(a.ziel || a.url), zielC = String(c.ziel || c.url);
        try {
          if (new URL(zielA).host === new URL(zielC).host) return null;
        } catch (e) { /* dann eben die Zeichenketten vergleichen */ }
        if (zielA === zielC) return null;
        return "Beide antworten mit 200 und bleiben auf verschiedenen Hosts: " + zielA + " und " + zielC;
      }
    },
    {
      id: "dom-weiterleitungskette", gruppe: "Erreichbarkeit", stufe: "wichtig", gewicht: 4,
      name: "Kette bis zur Startseite",
      wozu: "Von der unsichersten Schreibweise bis zur richtigen sollte ein Sprung genügen. Jeder weitere kostet eine Anfrage, und Crawler brechen irgendwann ab.",
      beheben: "Die Regel gleich auf die Endadresse zeigen lassen, statt erst auf https und dann auf www.",
      braucht: function (b) { return da(b.varianten); },
      pruefe: function (b) {
        var lang = (b.varianten || []).filter(function (v) {
          return v.kette && v.kette.length - 1 >= 2;
        });
        if (!lang.length) return null;
        return lang.map(function (v) { return v.url + ": " + (v.kette.length - 1) + " Sprünge"; }).join(" · ");
      }
    },
    {
      id: "dom-langsame-antwort", gruppe: "Erreichbarkeit", stufe: "wichtig", gewicht: 4,
      name: "Server antwortet langsam",
      wozu: "Die Zeit bis zum ersten Byte geht in jede Ladezeit ein, bevor überhaupt etwas gezeichnet wird. Google nennt 800 ms als guten Wert.",
      beheben: "Serverseitiges Zwischenspeichern, schnelleres Hosting oder weniger Arbeit vor der ersten Ausgabe.",
      braucht: function (b) { return typeof b.ttfb === "number" && b.ttfb > 0; },
      pruefe: function (b) {
        if (b.ttfb <= 800) return null;
        return b.ttfb + " ms bis zum ersten Byte (gut bis 800 ms, schlecht ab 1800 ms).";
      }
    },

    /* ===== Zertifikat ===== */
    {
      id: "tls-abgelaufen", gruppe: "Zertifikat", stufe: "kritisch", gewicht: 10,
      name: "Zertifikat abgelaufen",
      wozu: "Jeder Browser zeigt eine ganzseitige Warnung und die meisten Besucher gehen zurück. Die Website ist praktisch nicht mehr erreichbar.",
      beheben: "Zertifikat erneuern und die automatische Erneuerung einrichten.",
      braucht: function (b) { return b.tls && typeof b.tls.tageRest === "number"; },
      pruefe: function (b) {
        if (b.tls.tageRest >= 0) return null;
        return "Abgelaufen seit " + Math.abs(b.tls.tageRest) + " Tagen (" + b.tls.gueltigBis + ").";
      }
    },
    {
      id: "tls-laeuft-ab", gruppe: "Zertifikat", stufe: "wichtig", gewicht: 5,
      name: "Zertifikat läuft bald ab",
      wozu: "Ein abgelaufenes Zertifikat legt die Website still. Wer die Erneuerung von Hand macht, übersieht sie irgendwann.",
      beheben: "Erneuerung automatisieren. Bei Let's Encrypt ist das der Regelfall, nicht die Ausnahme.",
      braucht: function (b) { return b.tls && typeof b.tls.tageRest === "number" && b.tls.tageRest >= 0; },
      pruefe: function (b) {
        if (b.tls.tageRest > 30) return null;
        return "Noch " + b.tls.tageRest + " Tage gültig (bis " + b.tls.gueltigBis + ").";
      }
    },
    {
      id: "tls-name-passt-nicht", gruppe: "Zertifikat", stufe: "kritisch", gewicht: 9,
      name: "Zertifikat gilt nicht für diesen Namen",
      wozu: "Deckt das Zertifikat den aufgerufenen Namen nicht, warnt der Browser genauso wie bei einem abgelaufenen.",
      beheben: "Zertifikat für den richtigen Namen ausstellen lassen — meist als weiterer Eintrag im Feld „Subject Alternative Name“.",
      braucht: function (b) { return b.tls && da(b.tls.san) && da(b.host); },
      pruefe: function (b) {
        var passt = b.tls.san.some(function (n) { return nameDeckt(n, b.host); });
        if (passt) return null;
        return "Geprüft: " + b.host + " · im Zertifikat: " + b.tls.san.join(", ");
      }
    },
    {
      id: "tls-zweiter-name-fehlt", gruppe: "Zertifikat", stufe: "wichtig", gewicht: 4,
      name: "Zertifikat deckt die andere Schreibweise nicht",
      wozu: "Wer die Weiterleitung von www auf ohne www (oder umgekehrt) einrichtet, braucht auch für die WEITERLEITENDE Adresse ein gültiges Zertifikat — sonst warnt der Browser, bevor die Weiterleitung greift.",
      beheben: "Beide Namen ins Zertifikat aufnehmen. Ein Platzhalter *.beispiel.de deckt www, aber nicht beispiel.de selbst.",
      braucht: function (b) { return b.tls && da(b.tls.san) && da(b.host); },
      pruefe: function (b) {
        var blank = ohneWww(b.host);
        var andere = /^www\./i.test(b.host) ? blank : "www." + blank;
        var passt = b.tls.san.some(function (n) { return nameDeckt(n, andere); });
        if (passt) return null;
        return andere + " ist nicht im Zertifikat: " + b.tls.san.join(", ");
      }
    },
    {
      id: "tls-alte-version", gruppe: "Zertifikat", stufe: "wichtig", gewicht: 5,
      name: "Veraltete TLS-Version",
      wozu: "TLS 1.0 und 1.1 gelten als gebrochen und werden von aktuellen Browsern abgelehnt. Aeltere Besucher kommen dann noch durch, neue nicht mehr.",
      beheben: "Auf dem Server nur noch TLS 1.2 und 1.3 zulassen.",
      braucht: function (b) { return b.tls && da(b.tls.protokoll); },
      pruefe: function (b) {
        var p = String(b.tls.protokoll);
        if (/1\.[23]$/.test(p)) return null;
        return "Verhandelt wurde " + p + ".";
      }
    },
    {
      id: "tls-selbstsigniert", gruppe: "Zertifikat", stufe: "kritisch", gewicht: 9,
      name: "Selbst ausgestelltes Zertifikat",
      wozu: "Ein Zertifikat, das niemand bestätigt hat, wird von keinem Browser akzeptiert. Es ist für Besucher dasselbe wie gar keines.",
      beheben: "Ein Zertifikat einer anerkannten Stelle verwenden. Let's Encrypt kostet nichts.",
      braucht: function (b) { return b.tls && typeof b.tls.selbstsigniert === "boolean"; },
      pruefe: function (b) { return b.tls.selbstsigniert ? "Aussteller und Inhaber sind dieselbe Stelle." : null; }
    },
    {
      id: "tls-kette-unvollstaendig", gruppe: "Zertifikat", stufe: "wichtig", gewicht: 5,
      name: "Zertifikatskette unvollständig",
      wozu: "Fehlt das Zwischenzertifikat, funktioniert die Seite in vielen Browsern trotzdem — weil sie es zwischengespeichert haben. Auf frischen Geräten und in Programmen ohne Zwischenspeicher bricht die Verbindung ab.",
      beheben: "Die vollständige Kette ausliefern, nicht nur das eigene Zertifikat.",
      braucht: function (b) { return b.tls && typeof b.tls.kettenlaenge === "number"; },
      pruefe: function (b) {
        if (b.tls.kettenlaenge >= 2) return null;
        return "Der Server sendet nur " + b.tls.kettenlaenge + " Zertifikat, ohne Zwischenzertifikat.";
      }
    },

    /* ===== Kopfzeilen ===== */
    {
      id: "kopf-x-robots-noindex", gruppe: "Kopfzeilen", stufe: "kritisch", gewicht: 10,
      name: "Server sendet noindex",
      wozu: "Die Kopfzeile X-Robots-Tag mit noindex nimmt die Seite aus dem Index — und zwar unsichtbar, denn im Quelltext steht nichts davon.",
      beheben: "Die Kopfzeile entfernen, wenn die Seite gefunden werden soll. Sie stammt oft aus einer Testumgebung, die mitkopiert wurde.",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) {
        var w = kopfLesen(b, "x-robots-tag");
        if (!w || !/noindex|none/i.test(w)) return null;
        return "X-Robots-Tag: " + w;
      }
    },
    {
      id: "kopf-hsts-fehlt", gruppe: "Kopfzeilen", stufe: "wichtig", gewicht: 5,
      name: "HSTS fehlt",
      wozu: "Ohne Strict-Transport-Security ruft der Browser die Seite beim ersten Mal unverschlüsselt auf, auch wenn danach weitergeleitet wird. Genau dieser eine Aufruf ist angreifbar.",
      beheben: "Strict-Transport-Security mit max-age von mindestens einem halben Jahr senden. Vorher sicherstellen, dass wirklich alles unter https läuft.",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) { return kopfLesen(b, "strict-transport-security") ? null : "Keine Kopfzeile Strict-Transport-Security."; }
    },
    {
      id: "kopf-hsts-kurz", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 2,
      name: "HSTS zu kurz",
      wozu: "Ein kurzer Wert schützt nur kurz. Ueblich sind 180 Tage; für die Aufnahme in die Vorabliste der Browser sind 365 Tage nötig.",
      beheben: "max-age auf mindestens 15552000 Sekunden setzen.",
      braucht: function (b) { return da(kopfLesen(b, "strict-transport-security")); },
      pruefe: function (b) {
        var alter = zahlAusHsts(kopfLesen(b, "strict-transport-security"));
        if (alter === null) return "max-age fehlt in der Kopfzeile.";
        if (alter >= 15552000) return null;
        return "max-age=" + alter + " Sekunden, das sind " + Math.round(alter / 86400) + " Tage.";
      }
    },
    {
      id: "kopf-hsts-ohne-subdomains", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 1,
      name: "HSTS gilt nicht für Unterbereiche",
      wozu: "Ohne includeSubDomains bleiben shop., blog. und alle anderen Unterbereiche ungeschützt.",
      beheben: "includeSubDomains ergänzen — erst prüfen, ob wirklich jeder Unterbereich https kann.",
      braucht: function (b) { return da(kopfLesen(b, "strict-transport-security")); },
      pruefe: function (b) {
        var w = kopfLesen(b, "strict-transport-security");
        return /includeSubDomains/i.test(w) ? null : "Kopfzeile ohne includeSubDomains: " + w;
      }
    },
    {
      id: "kopf-csp-fehlt", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 2,
      name: "Keine Inhaltsrichtlinie",
      wozu: "Eine Content-Security-Policy begrenzt, woher Skripte und Stile geladen werden dürfen. Ohne sie kann eingeschleuster Code alles nachladen.",
      beheben: "Mit einer Richtlinie im Berichtsmodus beginnen, die Meldungen ansehen und dann scharf schalten.",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) {
        return (kopfLesen(b, "content-security-policy") || kopfLesen(b, "content-security-policy-report-only"))
          ? null : "Keine Kopfzeile Content-Security-Policy.";
      }
    },
    {
      id: "kopf-nosniff-fehlt", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 1,
      name: "Kein nosniff",
      wozu: "Ohne X-Content-Type-Options raten ältere Browser den Dateityp. Eine hochgeladene Bilddatei kann so als Skript ausgeführt werden.",
      beheben: "X-Content-Type-Options: nosniff senden. Nebenwirkungen hat es praktisch keine.",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) {
        var w = kopfLesen(b, "x-content-type-options");
        return (w && /nosniff/i.test(w)) ? null : "Keine Kopfzeile X-Content-Type-Options: nosniff.";
      }
    },
    {
      id: "kopf-referrer-fehlt", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 1,
      name: "Keine Referrer-Richtlinie",
      wozu: "Ohne Angabe sendet der Browser die vollständige Herkunftsadresse an fremde Server — samt Pfad und Abfrage, in denen manchmal mehr steht als gedacht.",
      beheben: "Referrer-Policy: strict-origin-when-cross-origin ist ein guter Standardwert.",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) { return kopfLesen(b, "referrer-policy") ? null : "Keine Kopfzeile Referrer-Policy."; }
    },
    {
      id: "kopf-frame-fehlt", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 1,
      name: "Einbetten nicht geregelt",
      wozu: "Ohne Angabe kann jede fremde Seite Ihre Website in einen Rahmen legen und Klicks abfangen.",
      beheben: "Entweder X-Frame-Options: SAMEORIGIN oder in der Inhaltsrichtlinie frame-ancestors setzen.",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) {
        if (kopfLesen(b, "x-frame-options")) return null;
        var csp = kopfLesen(b, "content-security-policy") || "";
        if (/frame-ancestors/i.test(csp)) return null;
        return "Weder X-Frame-Options noch frame-ancestors.";
      }
    },
    {
      id: "kopf-permissions-fehlt", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 1,
      name: "Keine Berechtigungsrichtlinie",
      wozu: "Permissions-Policy schaltet Kamera, Mikrofon und Standort für die Seite und alles Eingebettete ab, solange sie nicht gebraucht werden.",
      beheben: "Eine Zeile genügt, etwa camera=(), microphone=(), geolocation=().",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) { return kopfLesen(b, "permissions-policy") ? null : "Keine Kopfzeile Permissions-Policy."; }
    },
    {
      id: "kopf-server-verraet-version", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 1,
      name: "Serverkennung mit Versionsnummer",
      wozu: "Die genaue Version sagt einem Angreifer, welche bekannten Lücken er zuerst probieren kann. Genutzt wird die Angabe sonst von niemandem.",
      beheben: "Die Versionsnummer aus der Server-Kopfzeile nehmen — bei Apache ServerTokens Prod, bei nginx server_tokens off.",
      braucht: function (b) { return da(kopfLesen(b, "server")); },
      pruefe: function (b) {
        var w = kopfLesen(b, "server");
        return /\d+\.\d+/.test(w) ? "Server: " + w : null;
      }
    },
    {
      id: "kopf-x-powered-by", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 1,
      name: "X-Powered-By verrät die Technik",
      wozu: "Dieselbe Überlegung wie bei der Serverkennung: die Angabe nützt niemandem und hilft beim Suchen nach Lücken.",
      beheben: "Die Kopfzeile abschalten. In PHP genügt expose_php = Off.",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) {
        var w = kopfLesen(b, "x-powered-by");
        return w ? "X-Powered-By: " + w : null;
      }
    },
    {
      id: "kopf-keine-komprimierung", gruppe: "Kopfzeilen", stufe: "wichtig", gewicht: 5,
      name: "Keine Komprimierung",
      wozu: "HTML, CSS und JavaScript schrumpfen komprimiert auf etwa ein Viertel. Ohne Komprimierung lädt jede Seite unnötig lange, besonders im Mobilfunk.",
      beheben: "gzip oder brotli auf dem Server einschalten. Das ist eine Einstellung, keine Umbauarbeit.",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) {
        var w = kopfLesen(b, "content-encoding");
        if (w && /gzip|br|deflate|zstd/i.test(w)) return null;
        return "Keine Kopfzeile Content-Encoding in der Antwort.";
      }
    },
    {
      id: "kopf-cache-fehlt", gruppe: "Kopfzeilen", stufe: "hinweis", gewicht: 2,
      name: "Keine Anweisung zum Zwischenspeichern",
      wozu: "Ohne Cache-Control raten Browser und Vorschaltserver, wie lange sie eine Antwort behalten dürfen. Das Ergebnis ist unvorhersehbar.",
      beheben: "Für HTML etwas Kurzes oder no-cache, für Bilder und Schriften lange Zeiten mit Versionskennung im Dateinamen.",
      braucht: function (b) { return da(b.kopf); },
      pruefe: function (b) {
        return (kopfLesen(b, "cache-control") || kopfLesen(b, "expires")) ? null : "Weder Cache-Control noch Expires.";
      }
    },

    /* ===== Cookies ===== */
    {
      id: "cookie-vor-einwilligung", gruppe: "Cookies", stufe: "wichtig", gewicht: 5,
      name: "Cookie schon beim ersten Abruf",
      wozu: "Beim bloßen Aufruf der Startseite darf nur gesetzt werden, was technisch notwendig ist. Alles andere braucht eine Einwilligung — und die kann beim ersten Abruf noch niemand gegeben haben.",
      beheben: "Prüfen, welches Cookie das ist. Sitzungscookies eines Warenkorbs sind in Ordnung, ein Zählpixel nicht.",
      braucht: function (b) { return da(b.cookies); },
      pruefe: function (b) {
        if (!b.cookies.length) return null;
        return b.cookies.length + " Cookie(s) ohne Zutun: "
          + b.cookies.map(function (c) { return String(c).split("=")[0]; }).join(", ");
      }
    },
    {
      id: "cookie-ohne-secure", gruppe: "Cookies", stufe: "wichtig", gewicht: 4,
      name: "Cookie ohne Secure",
      wozu: "Ohne dieses Merkmal sendet der Browser das Cookie auch über eine unverschlüsselte Verbindung — dann ist es mitlesbar.",
      beheben: "Bei jedem Cookie Secure setzen. Auf einer reinen https-Website hat das keine Nebenwirkung.",
      braucht: function (b) { return da(b.cookies) && b.cookies.length > 0; },
      pruefe: function (b) {
        var schlecht = b.cookies.filter(function (c) { return !/;\s*Secure/i.test(c); });
        if (!schlecht.length) return null;
        return schlecht.map(function (c) { return String(c).split("=")[0]; }).join(", ");
      }
    },
    {
      id: "cookie-ohne-httponly", gruppe: "Cookies", stufe: "hinweis", gewicht: 2,
      name: "Cookie ohne HttpOnly",
      wozu: "Ohne HttpOnly kann jedes Skript auf der Seite das Cookie lesen. Bei einem Sitzungscookie ist das der Unterschied zwischen einer Lücke und einem übernommenen Konto.",
      beheben: "HttpOnly setzen, außer das Cookie wird nachweislich im Skript gebraucht.",
      braucht: function (b) { return da(b.cookies) && b.cookies.length > 0; },
      pruefe: function (b) {
        var schlecht = b.cookies.filter(function (c) { return !/;\s*HttpOnly/i.test(c); });
        if (!schlecht.length) return null;
        return schlecht.map(function (c) { return String(c).split("=")[0]; }).join(", ");
      }
    },
    {
      id: "cookie-ohne-samesite", gruppe: "Cookies", stufe: "hinweis", gewicht: 2,
      name: "Cookie ohne SameSite",
      wozu: "SameSite verhindert, dass eine fremde Seite Anfragen mit Ihrem Cookie auslöst. Browser nehmen inzwischen Lax an, aber verlassen sollte man sich darauf nicht.",
      beheben: "SameSite=Lax setzen, oder Strict, wo es geht.",
      braucht: function (b) { return da(b.cookies) && b.cookies.length > 0; },
      pruefe: function (b) {
        var schlecht = b.cookies.filter(function (c) { return !/;\s*SameSite/i.test(c); });
        if (!schlecht.length) return null;
        return schlecht.map(function (c) { return String(c).split("=")[0]; }).join(", ");
      }
    },

    /* ===== DNS ===== */
    {
      id: "dns-kein-a", gruppe: "DNS", stufe: "kritisch", gewicht: 10,
      name: "Kein A-Eintrag",
      wozu: "Ohne A-Eintrag weiss niemand, welcher Server zu dieser Domain gehört. Die Website ist nicht erreichbar.",
      beheben: "Beim Anbieter der Domain einen A-Eintrag auf die Adresse des Servers legen.",
      braucht: function (b) { return b.dns && da(b.dns.a); },
      pruefe: function (b) { return b.dns.a.length ? null : "Keine IPv4-Adresse hinterlegt."; }
    },
    {
      id: "dns-kein-ipv6", gruppe: "DNS", stufe: "hinweis", gewicht: 1,
      name: "Kein IPv6",
      wozu: "Ein wachsender Teil der Mobilfunknetze ist nur über IPv6 erreichbar. Ohne AAAA-Eintrag läuft alles über Umsetzer und wird langsamer.",
      beheben: "Beim Hoster nachfragen, ob IPv6 verfügbar ist, und einen AAAA-Eintrag anlegen.",
      braucht: function (b) { return b.dns && da(b.dns.aaaa); },
      pruefe: function (b) { return b.dns.aaaa.length ? null : "Kein AAAA-Eintrag."; }
    },
    {
      id: "dns-ein-nameserver", gruppe: "DNS", stufe: "wichtig", gewicht: 4,
      name: "Nur ein Nameserver",
      wozu: "Fällt der einzige Nameserver aus, ist die Domain für alle weg — auch wenn der Webserver einwandfrei läuft. Zwei sind Pflicht, nicht Kür.",
      beheben: "Einen zweiten Nameserver eintragen, möglichst an einem anderen Ort.",
      braucht: function (b) { return b.dns && da(b.dns.ns); },
      pruefe: function (b) {
        if (b.dns.ns.length >= 2) return null;
        return b.dns.ns.length + " Nameserver: " + b.dns.ns.join(", ");
      }
    },
    {
      id: "dns-kurze-ttl", gruppe: "DNS", stufe: "hinweis", gewicht: 1,
      name: "Sehr kurze Gültigkeitsdauer",
      wozu: "Eine TTL unter fünf Minuten lässt jeden Auflöser ständig nachfragen. Das kostet bei jedem Besuch Zeit und ist nur während eines Umzugs sinnvoll.",
      beheben: "Nach dem Umzug auf 3600 Sekunden oder mehr zurücksetzen.",
      braucht: function (b) { return b.dns && typeof b.dns.aTtl === "number" && b.dns.aTtl > 0; },
      pruefe: function (b) {
        if (b.dns.aTtl >= 300) return null;
        return "TTL " + b.dns.aTtl + " Sekunden.";
      }
    },
    {
      id: "dns-kein-caa", gruppe: "DNS", stufe: "hinweis", gewicht: 1,
      name: "Kein CAA-Eintrag",
      wozu: "Ein CAA-Eintrag legt fest, welche Stelle überhaupt Zertifikate für diese Domain ausstellen darf. Ohne ihn darf es jede.",
      beheben: "Einen CAA-Eintrag mit der genutzten Zertifizierungsstelle anlegen, etwa letsencrypt.org.",
      braucht: function (b) { return b.dns && da(b.dns.caa); },
      pruefe: function (b) { return b.dns.caa.length ? null : "Kein CAA-Eintrag."; }
    },
    {
      id: "dns-kein-spf", gruppe: "DNS", stufe: "wichtig", gewicht: 4,
      name: "Kein SPF-Eintrag",
      wozu: "SPF sagt, welche Server im Namen dieser Domain Post versenden dürfen. Ohne ihn kann jeder Absender fälschen, und eigene Post landet häufiger im Spam.",
      beheben: "Einen TXT-Eintrag anlegen, der mit v=spf1 beginnt und die eigenen Versandwege nennt, abgeschlossen mit -all.",
      braucht: function (b) { return b.dns && da(b.dns.mx) && b.dns.mx.length > 0 && da(b.dns.spf); },
      pruefe: function (b) { return b.dns.spf.length ? null : "Kein TXT-Eintrag mit v=spf1."; }
    },
    {
      id: "dns-spf-mehrfach", gruppe: "DNS", stufe: "wichtig", gewicht: 4,
      name: "Mehrere SPF-Einträge",
      wozu: "Mehr als ein SPF-Eintrag ist laut Norm ungültig. Empfangende Server werten dann gar keinen aus — die Wirkung ist dieselbe wie ohne Eintrag.",
      beheben: "Die Einträge zu einem zusammenfassen.",
      braucht: function (b) { return b.dns && da(b.dns.spf); },
      pruefe: function (b) {
        if (b.dns.spf.length <= 1) return null;
        return b.dns.spf.length + " Einträge: " + b.dns.spf.join(" | ");
      }
    },
    {
      id: "dns-spf-offen", gruppe: "DNS", stufe: "kritisch", gewicht: 7,
      name: "SPF erlaubt jeden Absender",
      wozu: "Endet der Eintrag auf +all, dürfen alle Server im Namen dieser Domain senden. Das ist schlechter als kein SPF, weil es Fälschungen ausdrücklich erlaubt.",
      beheben: "+all durch -all ersetzen, nachdem die eigenen Versandwege eingetragen sind.",
      braucht: function (b) { return b.dns && da(b.dns.spf) && b.dns.spf.length > 0; },
      pruefe: function (b) {
        var offen = b.dns.spf.filter(function (e) { return /[\s+]\+?all\s*$/i.test(e) && !/-all|~all/i.test(e); });
        return offen.length ? offen.join(" | ") : null;
      }
    },
    {
      id: "dns-kein-dmarc", gruppe: "DNS", stufe: "wichtig", gewicht: 4,
      name: "Kein DMARC-Eintrag",
      wozu: "DMARC sagt empfangenden Servern, was mit gefälschter Post im Namen dieser Domain geschehen soll. Ohne ihn entscheidet jeder Anbieter selbst.",
      beheben: "Einen TXT-Eintrag unter _dmarc anlegen, zu Beginn mit p=none und einer Berichtsadresse, später verschärfen.",
      braucht: function (b) { return b.dns && da(b.dns.mx) && b.dns.mx.length > 0 && da(b.dns.dmarc); },
      pruefe: function (b) { return b.dns.dmarc.length ? null : "Kein TXT-Eintrag unter _dmarc."; }
    },
    {
      id: "dns-dmarc-none", gruppe: "DNS", stufe: "hinweis", gewicht: 2,
      name: "DMARC ohne Wirkung",
      wozu: "p=none sammelt nur Berichte und lässt gefälschte Post durch. Als Anfang richtig, auf Dauer wirkungslos.",
      beheben: "Nach einigen Wochen Berichten auf quarantine und dann auf reject stellen.",
      braucht: function (b) { return b.dns && da(b.dns.dmarc) && b.dns.dmarc.length > 0; },
      pruefe: function (b) {
        var none = b.dns.dmarc.filter(function (e) { return /p\s*=\s*none/i.test(e); });
        return none.length ? none[0] : null;
      }
    },

    /* ===== Standarddateien ===== */
    {
      id: "datei-robots-fehlt", gruppe: "Standarddateien", stufe: "wichtig", gewicht: 4,
      name: "Keine robots.txt",
      wozu: "Ohne robots.txt darf jeder Crawler alles — auch Suchergebnisseiten und Druckansichten. Außerdem fehlt der übliche Ort, an dem die Sitemap genannt wird.",
      beheben: "Eine robots.txt anlegen, und sei es nur mit der Zeile Sitemap.",
      braucht: function (b) { return b.dateien && da(b.dateien.robots); },
      pruefe: function (b) {
        return b.dateien.robots.status === 200 ? null : "Antwort " + b.dateien.robots.status + " auf /robots.txt.";
      }
    },
    {
      id: "datei-robots-ohne-sitemap", gruppe: "Standarddateien", stufe: "hinweis", gewicht: 2,
      name: "robots.txt nennt keine Sitemap",
      wozu: "Die Zeile Sitemap in der robots.txt ist der Weg, auf dem Crawler die Sitemap ohne Anmeldung finden.",
      beheben: "Eine Zeile Sitemap: https://… mit der vollständigen Adresse ergänzen.",
      braucht: function (b) { return b.dateien && b.dateien.robots && b.dateien.robots.status === 200 && da(b.dateien.robots.text); },
      pruefe: function (b) {
        return /^\s*sitemap\s*:/im.test(b.dateien.robots.text) ? null : "Keine Zeile Sitemap in der robots.txt.";
      }
    },
    {
      id: "datei-sitemap-fehlt", gruppe: "Standarddateien", stufe: "wichtig", gewicht: 4,
      name: "Keine Sitemap gefunden",
      wozu: "Eine Sitemap ist der einzige Weg, Suchmaschinen ohne Verweise auf Seiten hinzuweisen — vor allem auf neue und tief liegende.",
      beheben: "Eine sitemap.xml erzeugen, unter der üblichen Adresse ablegen und in der robots.txt nennen.",
      braucht: function (b) { return b.dateien && da(b.dateien.sitemap); },
      pruefe: function (b) {
        return b.dateien.sitemap.status === 200 ? null : "Antwort " + b.dateien.sitemap.status + " unter " + b.dateien.sitemap.url + ".";
      }
    },
    {
      id: "datei-favicon-fehlt", gruppe: "Standarddateien", stufe: "hinweis", gewicht: 1,
      name: "Kein Favicon",
      wozu: "Google zeigt das Favicon in der mobilen Trefferliste neben dem Treffer. Fehlt es, steht dort ein Ersatzzeichen.",
      beheben: "Eine favicon.ico im Wurzelverzeichnis ablegen und zusätzlich per link rel=icon verweisen.",
      braucht: function (b) { return b.dateien && da(b.dateien.favicon); },
      pruefe: function (b) {
        return b.dateien.favicon.status === 200 ? null : "Antwort " + b.dateien.favicon.status + " auf /favicon.ico.";
      }
    },
    {
      id: "datei-securitytxt-fehlt", gruppe: "Standarddateien", stufe: "hinweis", gewicht: 1,
      name: "Keine security.txt",
      wozu: "Wer eine Lücke findet, sucht dort nach einer Kontaktadresse. Ohne sie wird die Meldung entweder gar nicht oder öffentlich abgesetzt.",
      beheben: "Unter /.well-known/security.txt eine Datei mit einer Kontaktadresse und einem Ablaufdatum ablegen.",
      braucht: function (b) { return b.dateien && da(b.dateien.securitytxt); },
      pruefe: function (b) {
        return b.dateien.securitytxt.status === 200 ? null : "Antwort " + b.dateien.securitytxt.status + " auf /.well-known/security.txt.";
      }
    },
    {
      id: "datei-soft404", gruppe: "Standarddateien", stufe: "kritisch", gewicht: 7,
      name: "Unbekannte Adressen antworten mit 200",
      wozu: "Ein erfundener Pfad muss 404 oder 410 sagen. Antwortet er mit 200, kann Google beliebig viele Adressen als eigene Seiten aufnehmen — und wertet das als Fehlerseiten voller Doppelinhalt.",
      beheben: "Den Server so einstellen, dass unbekannte Adressen wirklich 404 senden, nicht die Startseite mit 200.",
      braucht: function (b) { return b.dateien && da(b.dateien.zufallspfad); },
      pruefe: function (b) {
        var s = b.dateien.zufallspfad.status;
        if (s === 404 || s === 410) return null;
        return "Der Pfad " + b.dateien.zufallspfad.url + " antwortet mit " + s + ".";
      }
    },

    /* ===== Registrierung ===== */
    {
      id: "reg-laeuft-ab", gruppe: "Registrierung", stufe: "wichtig", gewicht: 6,
      name: "Domain läuft bald ab",
      wozu: "Eine abgelaufene Domain nimmt die Website und die Post mit. Zurückholen ist teuer, manchmal unmöglich, weil jemand anderes schneller war.",
      beheben: "Verlängerung einrichten und prüfen, ob die hinterlegte Kontaktadresse noch stimmt.",
      braucht: function (b) { return b.rdap && typeof b.rdap.tageRest === "number"; },
      pruefe: function (b) {
        if (b.rdap.tageRest > 60) return null;
        return "Noch " + b.rdap.tageRest + " Tage (bis " + b.rdap.laeuftAb + ").";
      }
    },
    {
      id: "reg-gesperrt", gruppe: "Registrierung", stufe: "hinweis", gewicht: 1,
      name: "Kein Übertragungsschutz",
      wozu: "Der Status clientTransferProhibited verhindert, dass die Domain ohne Zutun zu einem anderen Anbieter wandert. Er kostet nichts.",
      beheben: "Beim Anbieter der Domain die Übertragungssperre einschalten.",
      braucht: function (b) { return b.rdap && da(b.rdap.status); },
      pruefe: function (b) {
        var geschuetzt = b.rdap.status.some(function (s) { return /transfer\s*prohibited/i.test(String(s).replace(/\s+/g, " ")); });
        return geschuetzt ? null : "Status: " + b.rdap.status.join(", ");
      }
    }
  ];

  /* ---------------------------------------------------------------
     Anwenden
     --------------------------------------------------------------- */

  var RANG = { kritisch: 0, wichtig: 1, hinweis: 2 };

  function pruefen(befund) {
    var befunde = [];
    var bestanden = [];
    var uebersprungen = [];
    var moeglich = 0;
    var verloren = 0;
    var gruppen = {};

    REGELN.forEach(function (r) {
      var kannPruefen;
      try { kannPruefen = r.braucht(befund); } catch (e) { kannPruefen = false; }

      if (!kannPruefen) {
        uebersprungen.push({ id: r.id, name: r.name, gruppe: r.gruppe });
        return;
      }

      var fund;
      try { fund = r.pruefe(befund); } catch (e) { fund = null; }

      moeglich += r.gewicht;
      if (!gruppen[r.gruppe]) gruppen[r.gruppe] = { moeglich: 0, verloren: 0, befunde: 0, geprueft: 0 };
      gruppen[r.gruppe].moeglich += r.gewicht;
      gruppen[r.gruppe].geprueft++;

      if (fund) {
        verloren += r.gewicht;
        gruppen[r.gruppe].verloren += r.gewicht;
        gruppen[r.gruppe].befunde++;
        befunde.push({
          id: r.id, gruppe: r.gruppe, name: r.name, stufe: r.stufe,
          gewicht: r.gewicht, wozu: r.wozu, beheben: r.beheben, fund: fund
        });
      } else {
        bestanden.push({ id: r.id, gruppe: r.gruppe, name: r.name });
      }
    });

    befunde.sort(function (a, b) {
      return RANG[a.stufe] - RANG[b.stufe] || b.gewicht - a.gewicht || a.id.localeCompare(b.id);
    });

    Object.keys(gruppen).forEach(function (g) {
      var x = gruppen[g];
      x.wert = x.moeglich ? Math.round((1 - x.verloren / x.moeglich) * 100) : null;
    });

    return {
      befunde: befunde,
      bestanden: bestanden,
      uebersprungen: uebersprungen,
      gruppen: gruppen,
      moeglich: moeglich,
      verloren: verloren,
      punkte: moeglich ? Math.round((1 - verloren / moeglich) * 100) : null,
      zahl: {
        kritisch: befunde.filter(function (b) { return b.stufe === "kritisch"; }).length,
        wichtig: befunde.filter(function (b) { return b.stufe === "wichtig"; }).length,
        hinweis: befunde.filter(function (b) { return b.stufe === "hinweis"; }).length
      }
    };
  }

  /* ---------------------------------------------------------------
     Kopfzeilen aus eingefuegtem Text lesen

     Der Browser kann fremde Antwortkoepfe nicht abrufen. Er kann aber
     lesen, was jemand aus den Entwicklerwerkzeugen kopiert hat. Erlaubt
     ist beides: „Name: Wert" je Zeile, mit oder ohne Statuszeile davor.
     --------------------------------------------------------------- */

  function kopfzeilenLesen(text) {
    var kopf = {};
    var cookies = [];
    var status = null;
    var meldungen = [];

    String(text).split(/\r?\n/).forEach(function (roh) {
      var z = roh.trim();
      if (!z) return;

      var sm = z.match(/^HTTP\/[\d.]+\s+(\d{3})/i);
      if (sm) { status = parseInt(sm[1], 10); return; }
      if (/^:status:\s*(\d{3})/i.test(z)) { status = parseInt(z.match(/(\d{3})/)[1], 10); return; }

      var teiler = z.indexOf(":");
      if (teiler < 1) { meldungen.push(z.slice(0, 90)); return; }

      var name = z.slice(0, teiler).trim().replace(/^:/, "").toLowerCase();
      var wert = z.slice(teiler + 1).trim();
      if (!name) return;

      if (name === "set-cookie") { cookies.push(wert); return; }
      /* Mehrfach genannte Kopfzeilen werden zusammengefasst, so wie es
         auch der Browser tut. */
      kopf[name] = kopf[name] ? kopf[name] + ", " + wert : wert;
    });

    return { kopf: kopf, cookies: cookies, status: status, unverstanden: meldungen };
  }

  /* ---------------------------------------------------------------
     DNS aus eingefuegter Ausgabe lesen (dig oder nslookup)
     --------------------------------------------------------------- */

  function dnsLesen(text) {
    var dns = { a: [], aaaa: [], ns: [], mx: [], txt: [], spf: [], dmarc: [], caa: [], aTtl: null };
    var zeilen = String(text).split(/\r?\n/);

    zeilen.forEach(function (roh) {
      var z = roh.trim();
      if (!z || z.charAt(0) === ";") return;

      /* dig: name  ttl  IN  TYP  wert */
      var m = z.match(/^(\S+)\s+(\d+)\s+IN\s+(A|AAAA|NS|MX|TXT|CAA)\s+(.+)$/i);
      if (m) {
        var typ = m[3].toUpperCase();
        var wert = m[4].trim();
        if (typ === "A") { dns.a.push(wert); if (dns.aTtl === null) dns.aTtl = parseInt(m[2], 10); }
        else if (typ === "AAAA") dns.aaaa.push(wert);
        else if (typ === "NS") dns.ns.push(wert.replace(/\.$/, ""));
        else if (typ === "MX") dns.mx.push(wert);
        else if (typ === "CAA") dns.caa.push(wert);
        else if (typ === "TXT") {
          var roher = wert.replace(/^"|"$/g, "");
          dns.txt.push(roher);
          if (/^v=spf1/i.test(roher)) dns.spf.push(roher);
          if (/^v=DMARC1/i.test(roher) || /^_dmarc/i.test(m[1])) dns.dmarc.push(roher);
        }
        return;
      }

      /* nslookup: „Address: 1.2.3.4" und „internet address = 1.2.3.4" */
      var n = z.match(/^Address(?:es)?:\s*(\S+)$/i) || z.match(/internet address = (\S+)$/i);
      if (n) {
        if (n[1].indexOf(":") >= 0) dns.aaaa.push(n[1]);
        else if (/^\d+\.\d+\.\d+\.\d+$/.test(n[1])) dns.a.push(n[1]);
        return;
      }
      var ns = z.match(/nameserver = (\S+)/i);
      if (ns) { dns.ns.push(ns[1].replace(/\.$/, "")); return; }
      var mx = z.match(/mail exchanger = (\S+)/i);
      if (mx) { dns.mx.push(mx[1].replace(/\.$/, "")); return; }
      var txt = z.match(/text = "(.*)"/i);
      if (txt) {
        dns.txt.push(txt[1]);
        if (/^v=spf1/i.test(txt[1])) dns.spf.push(txt[1]);
        if (/^v=DMARC1/i.test(txt[1])) dns.dmarc.push(txt[1]);
      }
    });

    /* Doppelte entfernen: dig gibt bei mehreren Aufloesern dieselbe
       Antwort mehrfach aus. */
    ["a", "aaaa", "ns", "mx", "txt", "spf", "dmarc", "caa"].forEach(function (k) {
      var gesehen = {};
      dns[k] = dns[k].filter(function (w) {
        if (gesehen[w]) return false;
        gesehen[w] = true;
        return true;
      });
    });

    return dns;
  }

  return {
    REGELN: REGELN,
    pruefen: pruefen,
    kopfzeilenLesen: kopfzeilenLesen,
    dnsLesen: dnsLesen,
    nameDeckt: nameDeckt,
    anzahl: REGELN.length
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SEORANK_DOMAIN;
