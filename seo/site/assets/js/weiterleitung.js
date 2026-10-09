/* seo-rank.me — Weiterleitungs-Pruefer.

   Weiterleitungen sind der haeufigste Ort, an dem bei einem Umzug still
   etwas kaputtgeht: eine Kette statt eines Sprungs, eine Schleife, eine
   Regel, die nie zum Zug kommt, weil eine fruehere sie verdeckt. Nichts
   davon meldet der Server; alles davon steht in den Regeln selbst.

   Deshalb wird hier NICHT abgerufen, sondern GELESEN. Sie fuegen Ihre
   Regeln ein — .htaccess, nginx oder eine schlichte Liste — und bekommen
   die Auswertung: welche Kette wie lang ist, welche Regel tot ist, welcher
   Sprung nur voruebergehend gemeldet wird.

   Das hat eine Grenze, die hier ausdruecklich steht: was der Server
   TATSAECHLICH sendet, sieht nur, wer ihn fragt. Der Browser darf fremde
   Adressen nicht abrufen und ihre Antwortkoepfe nicht lesen. Wer die
   wirkliche Auslieferung pruefen will, nimmt die Kommandozeile.

   Rechnet vollstaendig im Browser. */

(function () {
  "use strict";

  var werkzeug = document.getElementById("weiterleitung");
  if (!werkzeug) return;

  var BEWEGUNG = window.SEORANK || null;
  var ANSICHT = (typeof SEORANK_ANSICHT !== "undefined") ? SEORANK_ANSICHT : null;

  var regelFeld = document.getElementById("l-regeln");
  var probeFeld = document.getElementById("l-proben");
  var starten = document.getElementById("l-starten");
  var beispiel = document.getElementById("l-beispiel");
  var leeren = document.getElementById("l-leeren");
  var laden = document.getElementById("l-laden");
  var ergebnis = document.getElementById("l-ergebnis");
  var hinweis = document.getElementById("l-hinweis");
  var registerleiste = document.getElementById("l-register");
  var blaetter = document.getElementById("l-blaetter");

  var waehlen = null;
  var letzterLauf = null;

  var MAX_SPRUENGE = 12;

  /* =========================================================
     Einlesen
     ========================================================= */

  /* Apache kennt Woerter statt Zahlen. Sie bedeuten genau das Gleiche. */
  var WORTCODE = {
    permanent: 301, temp: 302, seeother: 303, gone: 410
  };

  function codeLesen(wort) {
    if (!wort) return null;
    var k = String(wort).toLowerCase();
    if (WORTCODE[k]) return WORTCODE[k];
    if (/^\d{3}$/.test(k)) return parseInt(k, 10);
    return null;
  }

  /* Aus einer Zeile wird eine Regel oder nichts. Der Rueckgabewert traegt
     immer die Herkunft mit: Zeilennummer und Rohtext, damit jeder Befund
     auf eine Stelle zeigen kann. */
  function zeileLesen(roh, nr, umgebung) {
    var z = roh.trim();
    if (!z || z.charAt(0) === "#") return null;

    var m;

    /* --- Apache: RedirectMatch 301 ^/alt/(.*)$ /neu/$1 --- */
    m = z.match(/^RedirectMatch\s+(?:(\S+)\s+)?(\S+)\s+(\S+)\s*$/i);
    if (m) {
      return regel({
        art: "muster", von: m[2], nach: m[3],
        code: codeLesen(m[1]) || 302, codeGenannt: !!m[1],
        quelle: "RedirectMatch", nr: nr, roh: z
      });
    }

    /* --- Apache: Redirect 301 /alt /neu --- */
    m = z.match(/^Redirect\s+(?:(\S+)\s+)?(\S+)\s+(\S+)\s*$/i);
    if (m && !/^\d{3}$/.test(m[2]) === true) {
      return regel({
        art: "praefix", von: m[2], nach: m[3],
        code: codeLesen(m[1]) || 302, codeGenannt: !!m[1],
        quelle: "Redirect", nr: nr, roh: z
      });
    }

    /* --- Apache: RewriteRule ^alt/?$ /neu [R=301,L] --- */
    m = z.match(/^RewriteRule\s+(\S+)\s+(\S+)(?:\s+\[([^\]]*)\])?\s*$/i);
    if (m) {
      var flaggen = (m[3] || "").split(",").map(function (f) { return f.trim(); });
      var rFlagge = flaggen.filter(function (f) { return /^R(=|$)/i.test(f); })[0];
      /* Ohne R-Flagge ist es ein internes Umschreiben, keine Weiterleitung:
         der Besucher merkt nichts und die Adresse bleibt. Das gehoert nicht
         in diese Auswertung, es ist aber auch kein Fehler. */
      if (!rFlagge) {
        return regel({
          art: "intern", von: m[1], nach: m[2], code: 200, codeGenannt: true,
          quelle: "RewriteRule (intern)", nr: nr, roh: z, flaggen: flaggen
        });
      }
      var c = rFlagge.indexOf("=") >= 0 ? codeLesen(rFlagge.split("=")[1]) : 302;
      return regel({
        art: "muster", von: m[1], nach: m[2],
        code: c || 302, codeGenannt: rFlagge.indexOf("=") >= 0,
        quelle: "RewriteRule", nr: nr, roh: z, flaggen: flaggen
      });
    }

    /* --- nginx: rewrite ^/alt$ /neu permanent; --- */
    m = z.match(/^rewrite\s+([^\s;]+)\s+([^\s;]+)\s*(permanent|redirect)?\s*;?\s*$/i);
    if (m) {
      return regel({
        art: "muster", von: m[1], nach: m[2],
        code: m[3] && m[3].toLowerCase() === "permanent" ? 301 : (m[3] ? 302 : 200),
        codeGenannt: !!m[3],
        quelle: m[3] ? "nginx rewrite" : "nginx rewrite (intern)", nr: nr, roh: z
      });
    }

    /* --- nginx: return 301 /neu;  (die Quelle steht im location davor) --- */
    m = z.match(/^return\s+(\d{3})\s+([^\s;]+)\s*;?\s*$/i);
    if (m) {
      if (!umgebung.location) return null;
      /* nginx return ersetzt die Adresse VOLLSTAENDIG. Anders als
         Apaches Redirect haengt es den Rest des Pfades NICHT an. Wer das
         gleichsetzt, rechnet Ketten aus, die es nicht gibt. */
      return regel({
        art: umgebung.exakt ? "exakt" : "praefixErsetzen",
        von: umgebung.location, nach: m[2],
        code: parseInt(m[1], 10), codeGenannt: true,
        quelle: "nginx return", nr: nr, roh: umgebung.rohLocation + "  " + z
      });
    }

    /* --- Schlichte Liste: /alt -> /neu   oder  /alt,/neu,301 --- */
    m = z.match(/^(\S+)\s*(?:->|=>|→|\t|[;,|])\s*(\S+?)\s*(?:[;,|]\s*(\d{3}))?\s*$/);
    if (m && /^[\/h]/.test(m[1])) {
      return regel({
        art: "exakt", von: m[1], nach: m[2],
        code: m[3] ? parseInt(m[3], 10) : 301, codeGenannt: !!m[3],
        quelle: "Liste", nr: nr, roh: z
      });
    }

    return null;
  }

  function regel(r) {
    r.flaggen = r.flaggen || [];
    return r;
  }

  function einlesen(text) {
    var zeilen = String(text).split(/\r?\n/);
    var regeln = [];
    var umgebung = { location: null, exakt: false, rohLocation: "" };
    var unverstanden = [];
    var bedingungen = [];

    zeilen.forEach(function (roh, i) {
      var z = roh.trim();

      /* nginx-Block merken: location = /alt {  ... } */
      var lm = z.match(/^location\s+(=\s*)?(\S+)\s*\{\s*$/i);
      if (lm) {
        umgebung = { location: lm[2], exakt: !!lm[1], rohLocation: z };
        return;
      }
      if (z === "}") { umgebung = { location: null, exakt: false, rohLocation: "" }; return; }

      var r = zeileLesen(roh, i + 1, umgebung);
      if (r) { regeln.push(r); return; }

      /* Nur melden, was nach einer Weiterleitung aussieht und trotzdem
         nicht gelesen werden konnte — Kommentare und Fremdzeilen nicht. */
      /* RewriteEngine, RewriteBase und RewriteCond sind keine
         Weiterleitungen. Sie als "nicht gelesen" zu melden waere ein
         falscher Alarm; RewriteCond bekommt weiter unten einen eigenen
         Hinweis, weil es die Bedeutung einer Regel einschraenkt. */
      if (/^Rewrite(Engine|Base|Cond)\b/i.test(z)) {
        if (/^RewriteCond/i.test(z)) bedingungen.push(i + 1);
        return;
      }
      if (/^(if|set|server|http|include|location)\b/i.test(z)) return;

      if (/redirect|rewrite|return\s+30\d|->|=>/i.test(z) && z.charAt(0) !== "#") {
        unverstanden.push({ nr: i + 1, roh: z.slice(0, 160) });
      }
    });

    return { regeln: regeln, unverstanden: unverstanden, bedingungen: bedingungen, zeilen: zeilen.length };
  }

  /* =========================================================
     Anwenden
     ========================================================= */

  function alsRegex(muster) {
    /* Apache und nginx schreiben POSIX-nahe Ausdruecke; JavaScript versteht
       sie fast alle. Was nicht uebersetzbar ist, faellt sauber durch. */
    try { return new RegExp(muster); } catch (e) { return null; }
  }

  function pfadVon(adresse) {
    var m = String(adresse).match(/^https?:\/\/[^\/]+(\/.*)?$/i);
    if (m) return m[1] || "/";
    return String(adresse);
  }

  function istAbsolut(a) { return /^https?:\/\//i.test(String(a)); }

  function anwenden(r, adresse) {
    if (r.art === "intern") return null;
    var pfad = pfadVon(adresse);

    if (r.art === "exakt") {
      return (pfad === r.von || adresse === r.von) ? r.nach : null;
    }

    if (r.art === "praefixErsetzen") {
      return (pfad === r.von || pfad.indexOf(r.von) === 0) ? r.nach : null;
    }

    if (r.art === "praefix") {
      /* Apache Redirect wirkt auf den Anfang und haengt den Rest an. */
      if (pfad === r.von) return r.nach;
      if (r.von !== "/" && pfad.indexOf(r.von) === 0) {
        var rest = pfad.slice(r.von.length);
        if (rest.charAt(0) === "/" || r.von.charAt(r.von.length - 1) === "/") {
          return r.nach.replace(/\/$/, "") + rest;
        }
      }
      return null;
    }

    /* Muster. RewriteRule bekommt den Pfad ohne fuehrenden Schraegstrich. */
    var re = alsRegex(r.von);
    if (!re) return null;
    var pruefling = /^RewriteRule/i.test(r.quelle) ? pfad.replace(/^\//, "") : pfad;
    var treffer = pruefling.match(re);
    if (!treffer) return null;

    return r.nach.replace(/\$(\d)/g, function (_, n) {
      return treffer[parseInt(n, 10)] !== undefined ? treffer[parseInt(n, 10)] : "";
    });
  }

  /* Eine Adresse durch alle Regeln fuehren. Der Server nimmt die ERSTE
     passende Regel und faengt danach von vorne an — genau so wird hier
     gerechnet, sonst stimmt die Kettenlaenge nicht. */
  function aufloesen(start, regeln) {
    var kette = [{ adresse: start, code: null, regel: null }];
    var gesehen = {};
    gesehen[start] = true;
    var jetzt = start;

    for (var sprung = 0; sprung < MAX_SPRUENGE; sprung++) {
      var getroffen = null, ziel = null;
      for (var i = 0; i < regeln.length; i++) {
        var z = anwenden(regeln[i], jetzt);
        if (z !== null && z !== undefined) { getroffen = regeln[i]; ziel = z; break; }
      }
      if (!getroffen) break;

      kette.push({ adresse: ziel, code: getroffen.code, regel: getroffen });

      if (ziel === jetzt) return { kette: kette, schleife: true, selbst: true };
      if (gesehen[ziel]) return { kette: kette, schleife: true, selbst: false };
      gesehen[ziel] = true;
      jetzt = ziel;
    }

    return {
      kette: kette,
      schleife: false,
      abgeschnitten: kette.length - 1 >= MAX_SPRUENGE
    };
  }

  /* =========================================================
     Urteilen
     ========================================================= */

  function befund(stufe, name, wie, fund) {
    return { stufe: stufe, name: name, wie: wie, fund: fund || "" };
  }

  function pruefen(gelesen, proben) {
    var regeln = gelesen.regeln.filter(function (r) { return r.art !== "intern"; });
    var intern = gelesen.regeln.filter(function (r) { return r.art === "intern"; });
    var befunde = [];
    var ketten = [];

    /* --- Ketten und Schleifen ueber alle Quellen --- */
    var laengste = 0;
    var schleifen = 0;
    var mitKette = 0;
    var abgeschnitten = false;
    var ringe = {};

    regeln.forEach(function (r) {
      /* Nur Quellen, die sich als konkrete Adresse lesen lassen. Ein
         Muster mit Klammern ist keine Adresse; dafuer gibt es den
         Probelauf, in den man echte Adressen eintraegt. */
      if (/[\(\)\[\]\*\+\?\|]/.test(r.von)) return;
      var start = r.von.replace(/^\^/, "").replace(/\$$/, "");
      if (start.charAt(0) !== "/" && !istAbsolut(start)) start = "/" + start;

      var e = aufloesen(start, regeln);
      var spruenge = e.kette.length - 1;
      if (spruenge < 1) return;
      if (spruenge > laengste) laengste = spruenge;
      if (e.abgeschnitten) abgeschnitten = true;
      if (e.schleife) {
        /* Ein Ring bleibt ein Ring, gleich an welcher Stelle man
           einsteigt. Ohne diese Zusammenfassung meldet A→B→A zwei
           Schleifen und die Zahl in der Bilanz ist doppelt so gross
           wie das Problem. */
        var glieder = {};
        e.kette.forEach(function (g) { glieder[g.adresse] = true; });
        var ring = Object.keys(glieder).sort().join(">");
        if (!ringe[ring]) { ringe[ring] = true; schleifen++; }
        else return;
      }
      if (spruenge >= 2 || e.schleife) {
        mitKette++;
        ketten.push({ start: start, kette: e.kette, schleife: e.schleife,
          selbst: e.selbst, abgeschnitten: e.abgeschnitten });
      }
    });

    if (schleifen > 0) {
      befunde.push(befund("kritisch", "Weiterleitungsschleife",
        "Eine Adresse führt über ihre Weiterleitungen wieder auf sich selbst zurück. Der Browser bricht mit einer Fehlermeldung ab, die Seite ist nicht erreichbar.",
        schleifen + " Schleife(n). Die Kette steht im Blatt „Ketten“."));
    }

    var langeKetten = ketten.filter(function (k) { return !k.schleife && k.kette.length - 1 >= 4; });
    if (langeKetten.length) {
      befunde.push(befund("kritisch", "Sehr lange Kette",
        "Vier und mehr Sprünge hintereinander. Suchmaschinen folgen zwar mehreren Sprüngen, brechen aber irgendwann ab; jeder Sprung kostet Zeit und einen Teil der Bewertung.",
        langeKetten.length + " Kette(n) mit " + Math.max.apply(null, langeKetten.map(function (k) { return k.kette.length - 1; })) + " Sprüngen."));
    }

    var kurzeKetten = ketten.filter(function (k) { return !k.schleife && k.kette.length - 1 >= 2 && k.kette.length - 1 < 4; });
    if (kurzeKetten.length) {
      befunde.push(befund("wichtig", "Kette statt einem Sprung",
        "Zwei oder drei Sprünge, wo einer genügt. Jede Zwischenstation kostet eine Anfrage. Die Regel sollte gleich auf das Endziel zeigen.",
        kurzeKetten.length + " Kette(n) betroffen."));
    }

    /* --- Praefixregel, deren Ziel wieder auf die eigene Quelle passt --- */
    /* Der Klassiker in .htaccess: „Redirect /waagen /waagen/industrie".
       Apache prueft den ANFANG der Adresse. Das Ziel faengt selbst mit
       /waagen an, passt also erneut — und der Browser laeuft, bis er
       aufgibt. Das sieht in der Kette wie eine sehr lange Kette aus, ist
       aber eine ganz andere Ursache und braucht deshalb einen eigenen
       Befund. */
    var ausreisser = regeln.filter(function (r) {
      if (r.art !== "praefix" || r.von === r.nach) return false;   /* nicht praefixErsetzen: nginx haengt nichts an */
      var ziel = pfadVon(r.nach);
      return ziel.indexOf(r.von) === 0 && ziel !== r.von;
    });
    if (ausreisser.length) {
      befunde.push(befund("kritisch", "Ziel passt wieder auf die eigene Quelle",
        "Redirect prüft den Anfang der Adresse. Fängt das Ziel mit derselben Zeichenfolge an wie die Quelle, greift die Regel erneut — und wieder, und wieder. Der Browser bricht nach einigen Sprüngen ab. Ausweg: RedirectMatch mit ^ und $ statt Redirect.",
        ausreisser.map(function (r) { return "Zeile " + r.nr + ": " + r.von + " → " + r.nach; }).join(" · ")));
    }

    /* --- Selbstverweis --- */
    var selbst = regeln.filter(function (r) {
      if (r.von === r.nach) return true;
      /* Pfade nur dann vergleichen, wenn kein Host im Spiel ist:
         https://alt.de/x -> https://neu.de/x hat denselben Pfad und ist
         trotzdem eine echte Weiterleitung. */
      if (istAbsolut(r.von) || istAbsolut(r.nach)) return false;
      return pfadVon(r.von) === pfadVon(r.nach);
    });
    if (selbst.length) {
      befunde.push(befund("kritisch", "Regel zeigt auf sich selbst",
        "Quelle und Ziel sind dieselbe Adresse. Das ergibt eine endlose Schleife.",
        selbst.map(function (r) { return "Zeile " + r.nr + ": " + r.von; }).join(" · ")));
    }

    /* --- Doppelte Quelle --- */
    var nachQuelle = {};
    regeln.forEach(function (r) { (nachQuelle[r.von] = nachQuelle[r.von] || []).push(r); });
    var doppelt = Object.keys(nachQuelle).filter(function (k) { return nachQuelle[k].length > 1; });
    if (doppelt.length) {
      befunde.push(befund("wichtig", "Dieselbe Quelle mehrfach",
        "Der Server nimmt die erste passende Regel. Jede weitere Regel mit derselben Quelle kommt nie zum Zug — wer sie später ändert, ändert nichts.",
        doppelt.slice(0, 6).map(function (k) {
          return k + " (Zeilen " + nachQuelle[k].map(function (r) { return r.nr; }).join(", ") + ")";
        }).join(" · ")));
    }

    /* --- Verdeckte Regel: ein frueheres Muster faengt die Quelle ab --- */
    var verdeckt = [];
    regeln.forEach(function (r, i) {
      if (/[\(\)\[\]\*\+\?\|]/.test(r.von)) return;
      var start = r.von.replace(/^\^/, "").replace(/\$$/, "");
      if (start.charAt(0) !== "/" && !istAbsolut(start)) start = "/" + start;
      for (var j = 0; j < i; j++) {
        if (anwenden(regeln[j], start) !== null) {
          verdeckt.push({ tot: r, durch: regeln[j] });
          return;
        }
      }
    });
    if (verdeckt.length) {
      befunde.push(befund("wichtig", "Regel wird nie erreicht",
        "Eine früher stehende Regel fängt diese Adresse bereits ab. Die spätere Regel ist wirkungslos, sieht aber aus, als täte sie etwas.",
        verdeckt.slice(0, 5).map(function (v) {
          return "Zeile " + v.tot.nr + " verdeckt durch Zeile " + v.durch.nr;
        }).join(" · ")));
    }

    /* --- Voruebergehend statt dauerhaft --- */
    var temporaer = regeln.filter(function (r) { return r.code === 302 || r.code === 307; });
    if (temporaer.length) {
      var anteil = Math.round(temporaer.length / Math.max(regeln.length, 1) * 100);
      befunde.push(befund(anteil >= 50 ? "wichtig" : "hinweis", "Vorübergehende Weiterleitung",
        "302 und 307 sagen: die alte Adresse gilt weiter. Die Bewertung bleibt dann bei der alten Adresse. Bei einem echten Umzug ist 301 oder 308 richtig.",
        temporaer.length + " von " + regeln.length + " Regeln (" + anteil + " %), Zeilen "
          + temporaer.slice(0, 8).map(function (r) { return r.nr; }).join(", ")));
    }

    /* --- Code gar nicht genannt --- */
    var ohneCode = regeln.filter(function (r) { return !r.codeGenannt; });
    if (ohneCode.length) {
      befunde.push(befund("wichtig", "Kein Statuscode angegeben",
        "Ohne Angabe sendet Apache 302, nginx leitet gar nicht um. Beides ist selten gemeint. Schreiben Sie die 301 hin.",
        ohneCode.slice(0, 8).map(function (r) { return "Zeile " + r.nr; }).join(", ")));
    }

    /* --- Muster ohne Anker --- */
    var ohneAnker = regeln.filter(function (r) {
      return r.art === "muster" && (r.von.indexOf("^") !== 0 || r.von.slice(-1) !== "$");
    });
    if (ohneAnker.length) {
      befunde.push(befund("hinweis", "Muster ohne Anfang oder Ende",
        "Ein Ausdruck ohne ^ am Anfang oder $ am Ende passt auch mitten in der Adresse. So werden mehr Seiten umgeleitet als gemeint.",
        ohneAnker.slice(0, 6).map(function (r) { return "Zeile " + r.nr + ": " + r.von; }).join(" · ")));
    }

    /* --- Alles auf die Startseite --- */
    var aufStart = regeln.filter(function (r) {
      var p = pfadVon(r.nach);
      return p === "/" || p === "";
    });
    if (aufStart.length >= 3 && aufStart.length / Math.max(regeln.length, 1) >= 0.3) {
      befunde.push(befund("wichtig", "Viele Weiterleitungen auf die Startseite",
        "Wenn eine gelöschte Seite auf die Startseite zeigt, wertet Google das häufig wie eine Fehlerseite — der Besucher findet dort nicht, was er gesucht hat. Besser auf die nächstliegende passende Seite zeigen, sonst ehrlich 410 senden.",
        aufStart.length + " von " + regeln.length + " Regeln."));
    }

    /* --- Fragment im Ziel --- */
    var fragment = regeln.filter(function (r) { return String(r.nach).indexOf("#") >= 0; });
    if (fragment.length) {
      befunde.push(befund("hinweis", "Sprungmarke im Ziel",
        "Ein # im Ziel erreicht den Server nie und wird beim Weiterleiten unterschiedlich behandelt. Verlassen Sie sich nicht darauf.",
        fragment.map(function (r) { return "Zeile " + r.nr; }).join(", ")));
    }

    /* --- RewriteRule: Abfrage geht verloren --- */
    var abfrageWeg = regeln.filter(function (r) {
      return /^RewriteRule/i.test(r.quelle) && String(r.nach).indexOf("?") >= 0
        && !r.flaggen.some(function (f) { return /^QSA$/i.test(f); });
    });
    if (abfrageWeg.length) {
      befunde.push(befund("wichtig", "Abfrageteil geht verloren",
        "Steht im Ziel ein Fragezeichen, ersetzt Apache die ursprüngliche Abfrage. Ohne die Flagge QSA sind Angaben wie ?seite=2 danach weg.",
        abfrageWeg.map(function (r) { return "Zeile " + r.nr; }).join(", ")));
    }

    /* --- RewriteRule ohne L --- */
    var ohneL = regeln.filter(function (r) {
      return /^RewriteRule/i.test(r.quelle)
        && !r.flaggen.some(function (f) { return /^L$/i.test(f); });
    });
    if (ohneL.length) {
      befunde.push(befund("hinweis", "Regel ohne Abschluss",
        "Ohne die Flagge L arbeitet Apache die folgenden Regeln weiter ab. Bei einer Weiterleitung ist das fast nie gewollt und erzeugt schwer auffindbare Doppelsprünge.",
        ohneL.slice(0, 8).map(function (r) { return "Zeile " + r.nr; }).join(", ")));
    }

    /* --- Uneinheitliche Ziele: Protokoll, www, Schraegstrich --- */
    var absolut = regeln.filter(function (r) { return istAbsolut(r.nach); });
    var mitHttp = absolut.filter(function (r) { return /^http:\/\//i.test(r.nach); });
    if (mitHttp.length && absolut.length > mitHttp.length) {
      befunde.push(befund("wichtig", "Ziele mischen http und https",
        "Ein Ziel auf http erzeugt einen zusätzlichen Sprung, sobald der Server auf https umleitet. Schreiben Sie überall https.",
        mitHttp.map(function (r) { return "Zeile " + r.nr; }).join(", ")));
    } else if (mitHttp.length === absolut.length && mitHttp.length > 0) {
      befunde.push(befund("wichtig", "Ziele zeigen auf http",
        "Alle absoluten Ziele stehen auf http. Wenn die Website auf https läuft, folgt hinter jeder dieser Weiterleitungen ein zweiter Sprung.",
        mitHttp.length + " Regel(n)."));
    }

    var mitWww = absolut.filter(function (r) { return /^https?:\/\/www\./i.test(r.nach); });
    if (mitWww.length && absolut.length > mitWww.length) {
      befunde.push(befund("hinweis", "Ziele mischen www und ohne www",
        "Beide Schreibweisen im selben Regelsatz führen regelmäßig zu einem zusätzlichen Sprung. Legen Sie sich auf eine fest.",
        mitWww.length + " mit www, " + (absolut.length - mitWww.length) + " ohne."));
    }

    var mitSchraeg = regeln.filter(function (r) { return /\/$/.test(pfadVon(r.nach)) && pfadVon(r.nach) !== "/"; });
    if (mitSchraeg.length && regeln.length - mitSchraeg.length > 0 && mitSchraeg.length >= 2) {
      befunde.push(befund("hinweis", "Schrägstrich am Ende uneinheitlich",
        "Manche Ziele enden auf einem Schrägstrich, andere nicht. Wenn der Server die eine Form auf die andere umleitet, entsteht daraus eine Kette.",
        mitSchraeg.length + " von " + regeln.length + " Zielen enden auf /."));
    }

    /* --- Gemischt relativ und absolut --- */
    if (absolut.length && absolut.length < regeln.length) {
      befunde.push(befund("hinweis", "Ziele gemischt relativ und absolut",
        "Kein Fehler, aber eine Quelle von Ueberraschungen: relative Ziele erben Protokoll und Host, absolute nicht.",
        absolut.length + " absolut, " + (regeln.length - absolut.length) + " relativ."));
    }

    /* --- 410 und andere Sonderfaelle --- */
    var weg = regeln.filter(function (r) { return r.code === 410 || r.code === 404; });
    if (weg.length) {
      befunde.push(befund("hinweis", "Seiten als entfernt gemeldet",
        "410 sagt „dauerhaft weg“ und ist bei wirklich gelöschten Seiten die ehrlichere Antwort als eine Weiterleitung ins Leere.",
        weg.length + " Regel(n)."));
    }

    /* --- Bedingungen, die nicht ausgewertet werden --- */
    if (gelesen.bedingungen && gelesen.bedingungen.length) {
      befunde.push(befund("hinweis", "Bedingungen nicht ausgewertet",
        "RewriteCond schränkt die darauffolgende Regel ein — auf ein Gerät, einen Host, eine Abfrage. Diese Bedingungen werden hier nicht mitgerechnet: in der Auswertung gilt jede Regel immer. Prüfen Sie die betroffenen Regeln von Hand.",
        gelesen.bedingungen.length + " Bedingung(en), Zeilen "
          + gelesen.bedingungen.slice(0, 10).join(", ")));
    }

    /* --- Nicht gelesene Zeilen --- */
    if (gelesen.unverstanden.length) {
      befunde.push(befund("hinweis", "Zeilen nicht gelesen",
        "Diese Zeilen sehen nach einer Weiterleitung aus, passen aber in keine bekannte Form. Sie sind in der Auswertung nicht enthalten.",
        gelesen.unverstanden.slice(0, 5).map(function (u) { return "Zeile " + u.nr; }).join(", ")));
    }

    if (intern.length) {
      befunde.push(befund("hinweis", "Internes Umschreiben erkannt",
        "Regeln ohne R-Flagge leiten nicht um, sie schreiben die Adresse nur intern um. Der Besucher merkt nichts, die Adresse bleibt stehen. Sie sind hier nicht mitgerechnet.",
        intern.length + " Regel(n), Zeilen " + intern.slice(0, 8).map(function (r) { return r.nr; }).join(", ")));
    }

    if (!befunde.length && regeln.length) {
      befunde.push(befund("gut", "Keine Auffälligkeit",
        "Alle Regeln springen genau einmal, keine Schleife, keine verdeckte Regel, kein fehlender Statuscode.",
        regeln.length + " Regel(n) geprüft."));
    }

    /* --- Probelauf --- */
    var laeufe = proben.map(function (p) {
      var e = aufloesen(p, regeln);
      return { start: p, kette: e.kette, schleife: e.schleife, abgeschnitten: e.abgeschnitten };
    });

    var RANG = { kritisch: 0, wichtig: 1, hinweis: 2, gut: 3 };
    befunde.sort(function (a, b) { return RANG[a.stufe] - RANG[b.stufe]; });

    return {
      regeln: regeln, intern: intern, befunde: befunde, ketten: ketten,
      laeufe: laeufe, laengste: laengste, schleifen: schleifen,
      abgeschnitten: abgeschnitten,
      unverstanden: gelesen.unverstanden
    };
  }

  /* =========================================================
     Zeichnen
     ========================================================= */

  function blatt(name) { return blaetter.querySelector('[data-blatt="' + name + '"]'); }

  function leerenKnoten(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  /* Eine Zahl, ein Wort. „1 Spruenge" liest sich wie ein Fehler und ist
     einer. Abgebrochene Ketten bekommen ein Zeichen davor, sonst sieht
     die Obergrenze wie ein Messwert aus. */
  function spruengeWort(anzahl, abgeschnitten) {
    if (anzahl === 0) return "kein Sprung";
    return (abgeschnitten ? "mehr als " : "") + anzahl + (anzahl === 1 ? " Sprung" : " Sprünge");
  }

  function befundKnoten(b) {
    var zeile = document.createElement("div");
    zeile.className = "befund";
    zeile.setAttribute("data-stufe", b.stufe);

    var marker = document.createElement("span");
    marker.className = "befund__marker marker--" + (b.stufe === "gut" ? "hinweis" : b.stufe);
    if (b.stufe === "gut") { marker.style.background = "var(--gut)"; marker.style.border = "none"; }

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

  /* Zwoelf fast gleiche Zeilen sagen nicht mehr als vier. Bei langen Ketten
     werden die ersten drei und der letzte Sprung gezeigt, dazwischen steht
     im Klartext, wie viele Spruenge gerafft wurden und ueber welche Regel —
     verschwiegen wird nichts. */
  var GLIEDER_SICHTBAR = 3;

  function gliedKnoten(glied) {
    var z = document.createElement("div");
    z.className = "kette__glied";
    var code = document.createElement("span");
    code.className = "kette__code kette__code--"
      + (glied.code === 301 || glied.code === 308 ? "gut" : "warn");
    code.textContent = glied.code;
    var adr = document.createElement("code");
    adr.textContent = glied.adresse;
    var her = document.createElement("span");
    her.className = "kette__her";
    her.textContent = glied.regel ? "Zeile " + glied.regel.nr : "";
    z.appendChild(code); z.appendChild(adr); z.appendChild(her);
    return z;
  }

  function gliederZeichnen(kasten, kette) {
    var glieder = kette.slice(1);
    if (glieder.length <= GLIEDER_SICHTBAR + 2) {
      glieder.forEach(function (g) { kasten.appendChild(gliedKnoten(g)); });
      return;
    }

    glieder.slice(0, GLIEDER_SICHTBAR).forEach(function (g) {
      kasten.appendChild(gliedKnoten(g));
    });

    var gerafft = glieder.slice(GLIEDER_SICHTBAR, glieder.length - 1);
    var zeilen = {};
    gerafft.forEach(function (g) { if (g.regel) zeilen[g.regel.nr] = true; });
    var welche = Object.keys(zeilen);

    var raff = document.createElement("div");
    raff.className = "kette__glied kette__glied--gerafft";
    var wort = document.createElement("span");
    wort.className = "kette__her";
    wort.textContent = gerafft.length + " weitere Sprünge"
      + (welche.length === 1 ? " über Zeile " + welche[0]
         : (welche.length ? " über die Zeilen " + welche.join(", ") : ""));
    raff.appendChild(wort);
    kasten.appendChild(raff);

    kasten.appendChild(gliedKnoten(glieder[glieder.length - 1]));
  }

  function befundeZeichnen(ziel, befunde) {
    leerenKnoten(ziel);
    befunde.forEach(function (b) { ziel.appendChild(befundKnoten(b)); });
    if (BEWEGUNG) BEWEGUNG.staffeln(ziel.querySelectorAll(".befund"));
  }

  function kettenZeichnen(ziel, ketten) {
    leerenKnoten(ziel);
    var einf = document.createElement("p");
    einf.className = "blatthinweis";
    einf.textContent = ketten.length
      ? "Jede Zeile ist ein Sprung. Was hier mehr als einen Pfeil hat, kostet unnötig eine Anfrage — die Regel sollte gleich auf die letzte Adresse zeigen."
      : "Keine Kette: jede Quelle erreicht ihr Ziel mit einem Sprung. Das ist der gewünschte Zustand.";
    ziel.appendChild(einf);
    if (!ketten.length) return;

    ketten.forEach(function (k) {
      var kasten = document.createElement("div");
      kasten.className = "kette" + (k.schleife ? " kette--schleife" : "");

      var kopf = document.createElement("div");
      kopf.className = "kette__kopf";
      var wieviel = document.createElement("span");
      wieviel.className = "kette__zahl";
      wieviel.textContent = k.schleife ? "Schleife"
        : spruengeWort(k.kette.length - 1, k.abgeschnitten);
      kopf.appendChild(wieviel);
      var start = document.createElement("code");
      start.textContent = k.start;
      kopf.appendChild(start);
      kasten.appendChild(kopf);

      gliederZeichnen(kasten, k.kette);

      if (k.abgeschnitten && !k.schleife) {
        var ab = document.createElement("p");
        ab.className = "kette__warnung";
        ab.textContent = "Nach " + MAX_SPRUENGE + " Sprüngen abgebrochen — die Kette hört hier nicht auf. "
          + "So weit folgt kein Browser und kein Crawler.";
        kasten.appendChild(ab);
      }

      if (k.schleife) {
        var w = document.createElement("p");
        w.className = "kette__warnung";
        w.textContent = k.selbst
          ? "Die Regel zeigt auf ihre eigene Adresse. Der Browser bricht ab."
          : "Diese Adresse war in der Kette schon einmal da. Der Browser bricht ab.";
        kasten.appendChild(w);
      }

      ziel.appendChild(kasten);
    });
  }

  function regelnZeichnen(ziel, regeln, intern) {
    leerenKnoten(ziel);
    var einf = document.createElement("p");
    einf.className = "blatthinweis";
    einf.textContent = "Alle gelesenen Regeln in der Reihenfolge, in der der Server sie abarbeitet. Die erste passende gewinnt.";
    ziel.appendChild(einf);

    var rolle = document.createElement("div");
    rolle.className = "rolle";
    var t = document.createElement("table");
    t.className = "tabelle";
    t.innerHTML = "<thead><tr><th>Zeile</th><th>Herkunft</th><th>Code</th><th>Von</th><th>Nach</th></tr></thead>";
    var tb = document.createElement("tbody");

    regeln.concat(intern).sort(function (a, b) { return a.nr - b.nr; }).forEach(function (r) {
      var tr = document.createElement("tr");
      function z(inhalt, klasse) {
        var td = document.createElement("td");
        if (klasse) td.className = klasse;
        td.textContent = inhalt;
        tr.appendChild(td);
      }
      z(r.nr);
      z(r.quelle);
      var td = document.createElement("td");
      var s = document.createElement("span");
      s.className = "kette__code kette__code--"
        + (r.art === "intern" ? "still" : (r.code === 301 || r.code === 308 ? "gut" : "warn"));
      s.textContent = r.art === "intern" ? "intern" : r.code;
      td.appendChild(s);
      tr.appendChild(td);
      z(r.von, "mono");
      z(r.nach, "mono");
      tb.appendChild(tr);
    });

    t.appendChild(tb);
    rolle.appendChild(t);
    ziel.appendChild(rolle);
  }

  function probelaufZeichnen(ziel, laeufe) {
    leerenKnoten(ziel);
    var einf = document.createElement("p");
    einf.className = "blatthinweis";
    einf.textContent = laeufe.length
      ? "Diese Adressen wurden durch den Regelsatz geführt — gerechnet, nicht abgerufen. Was der Server wirklich sendet, sagt nur der Server."
      : "Keine Adressen eingetragen. Tragen Sie oben Adressen ein, um zu sehen, wo sie landen — besonders solche mit Mustern in der Regel.";
    ziel.appendChild(einf);
    if (!laeufe.length) return;

    laeufe.forEach(function (l) {
      var kasten = document.createElement("div");
      kasten.className = "kette" + (l.schleife ? " kette--schleife" : "");
      var kopf = document.createElement("div");
      kopf.className = "kette__kopf";
      var w = document.createElement("span");
      w.className = "kette__zahl";
      w.textContent = l.schleife ? "Schleife"
        : spruengeWort(l.kette.length - 1, l.abgeschnitten);
      kopf.appendChild(w);
      var start = document.createElement("code");
      start.textContent = l.start;
      kopf.appendChild(start);
      kasten.appendChild(kopf);

      if (l.kette.length === 1) {
        var p = document.createElement("p");
        p.className = "kette__warnung kette__warnung--still";
        p.textContent = "Keine Regel greift. Diese Adresse wird ausgeliefert, wie sie ist.";
        kasten.appendChild(p);
      }

      gliederZeichnen(kasten, l.kette);

      if (l.abgeschnitten) {
        var a = document.createElement("p");
        a.className = "kette__warnung";
        a.textContent = "Nach " + MAX_SPRUENGE + " Sprüngen abgebrochen. So weit folgt kein Browser.";
        kasten.appendChild(a);
      }

      ziel.appendChild(kasten);
    });
  }

  /* =========================================================
     Ablauf
     ========================================================= */

  function melden(text, warnung) {
    if (!hinweis) return;
    hinweis.textContent = text;
    hinweis.classList.toggle("formhinweis--warn", !!warnung);
  }

  function laufen() {
    var text = regelFeld.value;
    if (!text.trim()) {
      melden("Bitte Weiterleitungsregeln einfügen — .htaccess, nginx oder eine Liste.", true);
      regelFeld.focus();
      return;
    }

    var gelesen = einlesen(text);
    if (!gelesen.regeln.length) {
      melden("Keine Weiterleitung erkannt. Erwartet werden Zeilen wie „Redirect 301 /alt /neu“, "
        + "„RewriteRule ^alt$ /neu [R=301,L]“, „rewrite ^/alt$ /neu permanent;“ oder „/alt -> /neu“.", true);
      ergebnis.hidden = true;
      return;
    }

    var proben = (probeFeld.value || "").split(/\r?\n/)
      .map(function (z) { return z.trim(); })
      .filter(function (z) { return z && z.charAt(0) !== "#"; });

    var e = pruefen(gelesen, proben);
    letzterLauf = e;

    var zahl = function (id, wert, klasse) {
      var el = document.getElementById(id);
      if (!el) return;
      el.className = "bilanz__zahl" + (klasse ? " " + klasse : "");
      if (BEWEGUNG && typeof wert === "number") BEWEGUNG.zaehlen(el, wert);
      else el.textContent = wert;
    };

    zahl("l-regeln-zahl", e.regeln.length);
    zahl("l-ketten", e.ketten.filter(function (k) { return !k.schleife; }).length,
      e.ketten.some(function (k) { return !k.schleife; }) ? "bilanz__zahl--signal" : "bilanz__zahl--gut");
    zahl("l-schleifen", e.schleifen, e.schleifen ? "bilanz__zahl--kritisch" : "bilanz__zahl--gut");
    if (e.abgeschnitten) {
      var lz = document.getElementById("l-laengste");
      lz.className = "bilanz__zahl bilanz__zahl--kritisch";
      lz.textContent = "> " + e.laengste;
    } else {
      zahl("l-laengste", e.laengste);
    }

    befundeZeichnen(blatt("befunde"), e.befunde);
    kettenZeichnen(blatt("ketten"), e.ketten);
    regelnZeichnen(blatt("regeln"), e.regeln, e.intern);
    probelaufZeichnen(blatt("probelauf"), e.laeufe);

    if (waehlen) waehlen("befunde");
    ergebnis.hidden = false;

    var kritisch = e.befunde.filter(function (b) { return b.stufe === "kritisch"; }).length;
    var wichtig = e.befunde.filter(function (b) { return b.stufe === "wichtig"; }).length;
    melden(e.regeln.length + " Regel(n) gelesen · " + kritisch + " kritisch, " + wichtig
      + " wichtig. Nichts hat dieses Fenster verlassen.", kritisch > 0);
  }

  /* =========================================================
     Bedienung
     ========================================================= */

  if (ANSICHT && registerleiste && blaetter) {
    waehlen = ANSICHT.registerAnschliessen(registerleiste, blaetter, null);
  }

  starten.addEventListener("click", laufen);
  [regelFeld, probeFeld].forEach(function (f) {
    if (!f) return;
    f.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") laufen();
    });
  });

  if (leeren) {
    leeren.addEventListener("click", function () {
      regelFeld.value = "";
      if (probeFeld) probeFeld.value = "";
      ergebnis.hidden = true;
      melden("", false);
      regelFeld.focus();
    });
  }

  /* Die Probe ist absichtlich fehlerhaft: sie enthaelt eine Kette, eine
     Schleife, eine verdeckte Regel und eine 302. So sieht man, was das
     Werkzeug findet, ohne eigene Regeln herzugeben. */
  if (beispiel) {
    beispiel.addEventListener("click", function () {
      regelFeld.value = [
        "# Beispiel mit Absicht fehlerhaft",
        "RewriteEngine On",
        "",
        "# Umzug der Produktseiten",
        "Redirect 301 /produkte/waagen /waagen",
        "Redirect 301 /waagen /waagen/industrie",
        "",
        "# Alte Kategorien",
        "RedirectMatch 302 ^/kategorie/(.*)$ /bereich/$1",
        "RedirectMatch 301 ^/kategorie/waagen$ /waagen/industrie",
        "",
        "# Sprachfassung",
        "RewriteRule ^en/(.*)$ http://beispiel-domain.de/english/$1 [R=301]",
        "",
        "# Aufgeräumt",
        "Redirect /alt/preisliste /",
        "Redirect /alt/kontakt /",
        "Redirect /alt/agb /",
        "",
        "# Ringschluss",
        "Redirect 301 /a /b",
        "Redirect 301 /b /a"
      ].join("\n");
      if (probeFeld) {
        probeFeld.value = [
          "/produkte/waagen",
          "/kategorie/waagen",
          "/en/about",
          "/gibt-es-nicht"
        ].join("\n");
      }
      melden("Beispiel eingesetzt. Auf „prüfen“ klicken.", false);
    });
  }

  if (laden) {
    laden.addEventListener("click", function () {
      if (!letzterLauf) return;
      var z = [];
      z.push("seo-rank.me — Weiterleitungs-Prüfung");
      z.push("Gerechnet im Browser, nichts abgerufen.");
      z.push("");
      z.push("Regeln: " + letzterLauf.regeln.length
        + " · Ketten: " + letzterLauf.ketten.filter(function (k) { return !k.schleife; }).length
        + " · Schleifen: " + letzterLauf.schleifen
        + " · Längste Kette: " + letzterLauf.laengste);
      z.push("");
      z.push("BEFUNDE");
      letzterLauf.befunde.forEach(function (b) {
        z.push("  [" + b.stufe + "] " + b.name);
        z.push("      " + b.wie);
        if (b.fund) z.push("      " + b.fund);
      });
      z.push("");
      z.push("KETTEN");
      if (!letzterLauf.ketten.length) z.push("  keine");
      letzterLauf.ketten.forEach(function (k) {
        z.push("  " + k.start + (k.schleife ? "  (SCHLEIFE)" : ""));
        k.kette.forEach(function (g, i) {
          if (i === 0) return;
          z.push("    -> " + g.code + "  " + g.adresse + (g.regel ? "   (Zeile " + g.regel.nr + ")" : ""));
        });
      });
      if (letzterLauf.laeufe.length) {
        z.push("");
        z.push("PROBELAUF");
        letzterLauf.laeufe.forEach(function (l) {
          z.push("  " + l.start + (l.schleife ? "  (SCHLEIFE)" : ""));
          if (l.kette.length === 1) z.push("    keine Regel greift");
          l.kette.forEach(function (g, i) {
            if (i === 0) return;
            z.push("    -> " + g.code + "  " + g.adresse);
          });
        });
      }

      var b = new Blob([z.join("\n")], { type: "text/plain;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "weiterleitungen.txt";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    });
  }
})();
