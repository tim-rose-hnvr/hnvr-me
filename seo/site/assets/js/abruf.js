/* seo-rank.me — Abruf ueber ein Relais.

   Der Browser darf fremde Adressen nicht abrufen. Ein Relais darf es.
   Dieses Modul kennt die Adresse des Relais und spricht mit ihm; es
   urteilt nicht. Was zurueckkommt, geht in dieselben Regelsaetze wie
   eingefuegter Quelltext.

   Die Trennung ist der Kern: das Relais HOLT, der Browser URTEILT. Wer
   die Regeln in den Server legt, hat sie zweimal — und zwei Fassungen
   derselben Bewertung laufen auseinander.

   Die Adresse des Relais steht nicht fest im Code. Sie liegt im
   sessionStorage und ist auf jeder Seite, die abruft, sichtbar und
   aenderbar. Wer ein eigenes betreibt, traegt es dort ein; wer keines
   hat, benutzt keines. */

var SEORANK_ABRUF = (function () {
  "use strict";

  var SCHLUESSEL = "seorank-relais";
  var STANDARD = "https://www.hnvr.me/_functions";

  function adresse() {
    try {
      var eigen = sessionStorage.getItem(SCHLUESSEL);
      if (eigen) return eigen.replace(/\/+$/, "");
    } catch (e) { /* privater Modus */ }
    return STANDARD;
  }

  function merken(wert) {
    try {
      if (wert && wert.trim()) sessionStorage.setItem(SCHLUESSEL, wert.trim().replace(/\/+$/, ""));
      else sessionStorage.removeItem(SCHLUESSEL);
    } catch (e) { /* dann gilt es nur fuer diese Seite */ }
  }

  function istStandard() { return adresse() === STANDARD; }

  /* Eine Adresse vervollstaendigen: wer „beispiel.de" eintippt, meint
     „https://beispiel.de/". Ohne das schickt man dem Relais Unsinn und
     bekommt eine Fehlermeldung ueber etwas, das gar nicht gemeint war. */
  function vollstaendig(eingabe) {
    var t = String(eingabe || "").trim();
    if (!t) return null;
    if (!/^https?:\/\//i.test(t)) t = "https://" + t;
    try {
      var u = new URL(t);
      if (!u.hostname || u.hostname.indexOf(".") < 0) return null;
      return u.href;
    } catch (e) { return null; }
  }

  /* Holt eine Adresse ueber das Relais.
     Gibt IMMER ein Objekt mit `ok` zurueck — nie eine abgelehnte
     Zusage. Ein Abrufproblem ist ein Ergebnis, kein Absturz. */
  function holen(ziel, einstellungen) {
    einstellungen = einstellungen || {};
    var voll = vollstaendig(ziel);
    if (!voll) {
      return Promise.resolve({ ok: false, fehler: "Das ist keine vollständige Adresse." });
    }

    var u = adresse() + "/holen?url=" + encodeURIComponent(voll)
      + (einstellungen.nurKopf ? "&nurkopf=1" : "");

    var abbruch = null;
    var frist = null;
    if (typeof AbortController === "function") {
      abbruch = new AbortController();
      frist = window.setTimeout(function () { abbruch.abort(); }, einstellungen.zeitgrenze || 25000);
    }

    return fetch(u, abbruch ? { signal: abbruch.signal } : undefined)
      .then(function (a) {
        if (frist) window.clearTimeout(frist);
        if (!a.ok) {
          return { ok: false, fehler: "Das Relais antwortet mit " + a.status + "." };
        }
        return a.json();
      })
      .then(function (j) {
        if (!j || typeof j !== "object") {
          return { ok: false, fehler: "Das Relais hat keine lesbare Antwort geschickt." };
        }
        /* Die Selbstauskunft hat kein `ok` — wer das Relais falsch
           eingetragen hat, bekommt sonst eine ratlose Meldung. */
        if (!("ok" in j)) {
          return { ok: false, fehler: "Unter dieser Adresse antwortet kein Abrufrelais." };
        }
        return j;
      })
      .catch(function (e) {
        if (frist) window.clearTimeout(frist);
        var grund = (e && e.name === "AbortError")
          ? "Das Relais hat nicht rechtzeitig geantwortet."
          : "Das Relais war nicht erreichbar (" + String(e && e.message || e).slice(0, 60) + ").";
        return { ok: false, fehler: grund };
      });
  }

  /* Baut die Bedienung ein: ein Feld fuer die Adresse, ein Knopf, und
     ein Hinweis, wohin es geht. Wird von jedem Werkzeug benutzt, das
     abrufen kann — damit sieht es ueberall gleich aus und sagt ueberall
     dasselbe.

     `beiErfolg(daten)` bekommt die Antwort des Relais. */
  function bedienungEinbauen(einstellungen) {
    var wo = einstellungen.leiste;
    if (!wo) return null;

    var feld = document.createElement("input");
    feld.className = "feld feld--knapp";
    feld.type = "url";
    feld.id = einstellungen.id || "abruf-adresse";
    feld.placeholder = einstellungen.platzhalter || "https://ihre-domain.de/";
    feld.autocomplete = "url";
    feld.spellcheck = false;
    feld.setAttribute("aria-label", "Adresse zum Abrufen");

    var knopf = document.createElement("button");
    knopf.className = "knopf";
    knopf.type = "button";
    knopf.textContent = einstellungen.beschriftung || "adresse laden";
    knopf.title = "Ruft die Adresse über das Relais ab. Dabei geht sie an "
      + adresse() + ".";

    function frei() { knopf.disabled = false; feld.disabled = false; }

    function los() {
      var ziel = feld.value.trim();
      if (!ziel) {
        if (einstellungen.melden) einstellungen.melden("Bitte eine Adresse eingeben.", true);
        feld.focus();
        return;
      }
      knopf.disabled = true;
      feld.disabled = true;

      /* Wer einen eigenen Ablauf mitgibt, bekommt ihn — mehrere
         Adressen, eine feste Datei, ein Auslesen statt einer Pruefung.
         Er ist selbst dafuer zustaendig, `fertig` zu rufen. */
      if (einstellungen.eigenerLauf) {
        einstellungen.eigenerLauf(ziel, frei);
        return;
      }

      if (!vollstaendig(ziel)) {
        frei();
        if (einstellungen.melden) einstellungen.melden("Das ist keine vollständige Adresse.", true);
        feld.focus();
        return;
      }
      if (einstellungen.melden) {
        einstellungen.melden("Das Relais holt " + vollstaendig(ziel) + " …", false);
      }
      holen(ziel, { nurKopf: einstellungen.nurKopf }).then(function (daten) {
        frei();
        if (!daten.ok) {
          if (einstellungen.melden) einstellungen.melden(daten.fehler, true);
          return;
        }
        einstellungen.beiErfolg(daten, vollstaendig(ziel));
      });
    }

    knopf.addEventListener("click", los);
    feld.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); los(); }
    });

    /* Vor den ersten Knopf, damit die Adresse dort steht, wo man sie
       zuerst sucht. */
    wo.insertBefore(feld, wo.firstChild);
    wo.insertBefore(knopf, feld.nextSibling);

    return { feld: feld, knopf: knopf };
  }


  /* ---------------------------------------------------------------
     Selbsttaetiges Anhaengen

     Jedes Werkzeug, das eine Adresse laden koennen soll, meldet das an
     seiner Werkzeugleiste an:

       data-abruf-art    seite | robots | sitemap | mehrere | snippet
       data-abruf-feld   Kennung des Feldes, in das der Text kommt
       data-abruf-start  Kennung des Knopfes, der danach gedrueckt wird

     So steht die Zuordnung dort, wo sie hingehoert — auf der Seite, die
     sie betrifft — und es gibt trotzdem nur EINE Umsetzung. Wer ein
     neues Werkzeug baut, schreibt drei Attribute und nichts weiter.
     --------------------------------------------------------------- */

  function anhaengen() {
    var leisten = document.querySelectorAll(".werkzeugleiste[data-abruf-art]");
    Array.prototype.forEach.call(leisten, function (leiste) {
      var art = leiste.getAttribute("data-abruf-art");
      var feld = document.getElementById(leiste.getAttribute("data-abruf-feld") || "");
      var start = document.getElementById(leiste.getAttribute("data-abruf-start") || "");
      if (!feld && art !== "snippet") return;

      /* In das Meldefeld des Werkzeugs schreiben — das sind die Felder
         mit einer Kennung auf -hinweis, die das Werkzeug selbst
         beschreibt. Einen FESTEN Erklaertext darf man nicht ueberschreiben:
         auf der Snippet-Seite steht dort, wie der Umbruch gerechnet wird,
         und das gehoert nicht weg. Gibt es kein solches Feld, wird eines
         angelegt. */
      var hinweisfeld = leiste.querySelector('[id$="-hinweis"]');
      if (!hinweisfeld) {
        hinweisfeld = document.createElement("span");
        hinweisfeld.className = "formhinweis";
        hinweisfeld.id = "abruf-hinweis";
        leiste.appendChild(hinweisfeld);
      }

      function sagen(text, warnung) {
        if (!hinweisfeld) return;
        hinweisfeld.textContent = text;
        hinweisfeld.classList.toggle("formhinweis--warn", !!warnung);
      }

      var beschriftung = {
        robots: "robots.txt holen",
        sitemap: "sitemap holen",
        mehrere: "adressen laden",
        snippet: "adresse auslesen"
      }[art] || "adresse laden";

      var platzhalter = {
        robots: "ihre-domain.de",
        sitemap: "https://ihre-domain.de/sitemap.xml",
        mehrere: "adresse1, adresse2, adresse3"
      }[art] || "https://ihre-domain.de/seite";

      bedienungEinbauen({
        leiste: leiste,
        id: "abruf-" + (leiste.getAttribute("data-abruf-feld") || art),
        beschriftung: beschriftung,
        platzhalter: platzhalter,
        melden: sagen,
        eigenerLauf: function (eingabe, fertig) {
          if (art === "robots") return holeDatei(eingabe, "/robots.txt", sagen, feld, start, fertig);
          if (art === "sitemap") return holeDatei(eingabe, "/sitemap.xml", sagen, feld, start, fertig);
          if (art === "mehrere") return holeMehrere(eingabe, sagen, feld, start, fertig);
          if (art === "snippet") return holeSnippet(eingabe, sagen, fertig);
          return holeSeite(eingabe, sagen, feld, start, fertig);
        }
      });
    });
  }

  function nachher(start) {
    if (start) start.click();
  }

  /* Eine gewoehnliche Seite: Quelltext ins Feld, dann pruefen lassen. */
  function holeSeite(eingabe, sagen, feld, start, fertig) {
    return holen(eingabe).then(function (d) {
      fertig();
      if (!d.ok) { sagen(d.fehler, true); return; }
      if (!d.html) { sagen("Kein Quelltext erhalten (Status " + d.status + ").", true); return; }
      feld.value = d.html;
      nachher(start);
      sagen(d.ziel + " geladen — Status " + d.status + ", " + Math.round(d.bytes / 1024)
        + " kB. Geholt hat sie das Relais " + adresse() + "; geurteilt wird hier.", false);
    });
  }

  /* robots.txt und Sitemap liegen an einer festen Stelle. Wer nur den
     Namen eintippt, meint die Datei dort — wer eine vollstaendige
     Adresse eintippt, meint genau die. */
  function holeDatei(eingabe, standardpfad, sagen, feld, start, fertig) {
    var voll = vollstaendig(eingabe);
    if (!voll) { fertig(); sagen("Das ist keine vollständige Adresse.", true); return Promise.resolve(); }
    var u;
    try { u = new URL(voll); } catch (e) { fertig(); sagen("Das ist keine gültige Adresse.", true); return Promise.resolve(); }
    if (u.pathname === "/" || u.pathname === "") u.pathname = standardpfad;

    return holen(u.href).then(function (d) {
      fertig();
      if (!d.ok) { sagen(d.fehler, true); return; }
      if (d.status !== 200) {
        sagen(u.href + " antwortet mit " + d.status + " — dort liegt keine Datei.", true);
        return;
      }
      if (!d.html) { sagen("Die Datei ist leer.", true); return; }
      feld.value = d.html;
      nachher(start);
      sagen(u.href + " geladen — " + Math.round(d.bytes / 1024) + " kB. Geholt hat sie das Relais "
        + adresse() + "; geurteilt wird hier.", false);
    });
  }

  /* Mehrere Adressen fuer die Werkbank. Getrennt durch Komma, weil ein
     einzeiliges Feld keinen Zeilenumbruch aufnimmt. */
  function holeMehrere(eingabe, sagen, feld, start, fertig) {
    var liste = String(eingabe).split(",")
      .map(function (t) { return t.trim(); })
      .filter(Boolean);
    if (!liste.length) { fertig(); sagen("Keine Adresse angegeben.", true); return Promise.resolve(); }
    if (liste.length > 20) liste = liste.slice(0, 20);

    sagen("Das Relais holt " + liste.length + " Adressen …", false);
    return Promise.all(liste.map(function (a) { return holen(a); })).then(function (alle) {
      fertig();
      var gut = [];
      var schlecht = [];
      alle.forEach(function (d, i) {
        if (d.ok && d.html) gut.push(d.html);
        else schlecht.push(liste[i] + " (" + (d.fehler || "Status " + d.status) + ")");
      });
      if (!gut.length) { sagen("Keine der Adressen war ladbar: " + schlecht.join(" · "), true); return; }
      feld.value = gut.join("\n---\n");
      nachher(start);
      sagen(gut.length + " von " + liste.length + " Adressen geladen"
        + (schlecht.length ? ". Nicht geladen: " + schlecht.join(" · ") : "")
        + ". Geholt hat sie das Relais " + adresse() + "; geurteilt wird hier.",
        schlecht.length > 0);
    });
  }

  /* Die Snippet-Vorschau will Titel und Beschreibung, nicht Quelltext.
     Sie werden mit einem einfachen Ausdruck herausgeholt — der Prüfer
     mit dem richtigen Parser sitzt nebenan, hier genuegt das. */
  function holeSnippet(eingabe, sagen, fertig) {
    return holen(eingabe).then(function (d) {
      fertig();
      if (!d.ok) { sagen(d.fehler, true); return; }
      if (!d.html) { sagen("Kein Quelltext erhalten (Status " + d.status + ").", true); return; }

      var titel = (d.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "";
      var besch = (d.html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) || [])[1];
      if (besch === undefined) {
        besch = (d.html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i) || [])[1] || "";
      }

      function entschluesseln(t) {
        var k = document.createElement("textarea");
        k.innerHTML = t;
        return k.value.replace(/\s+/g, " ").trim();
      }

      var tf = document.getElementById("s-titel");
      var bf = document.getElementById("s-text");
      var pf = document.getElementById("s-pfad");
      if (tf) { tf.value = entschluesseln(titel); tf.dispatchEvent(new Event("input", { bubbles: true })); }
      if (bf) { bf.value = entschluesseln(besch); bf.dispatchEvent(new Event("input", { bubbles: true })); }
      if (pf) { try { pf.value = new URL(d.ziel).href; } catch (e) { pf.value = d.ziel; }
                pf.dispatchEvent(new Event("input", { bubbles: true })); }

      sagen(d.ziel + " ausgelesen: Titel " + entschluesseln(titel).length + " Zeichen, Beschreibung "
        + entschluesseln(besch).length + " Zeichen"
        + (besch ? "" : " (es gibt keine)")
        + ". Geholt hat sie das Relais " + adresse() + "; gemessen wird hier.", !besch);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", anhaengen);
  } else {
    anhaengen();
  }

  /* Adresse oder Quelltext? Eine Stelle fuer Startseite und Protokoll.
     Wer spitze Klammern schreibt, meint HTML; ein einzelnes Wort mit
     Punkt und ohne Leerzeichen ist eine Adresse. */
  function erkennen(text) {
    var t = String(text || "").trim();
    if (!t) return { art: "leer" };
    if (/[<>]/.test(t)) return { art: "quelltext", zeichen: t.length };
    if (!/\s/.test(t)) {
      var voll = vollstaendig(t);
      if (voll) return { art: "adresse", url: voll };
    }
    return { art: "unklar" };
  }

  return {
    erkennen: erkennen,
    adresse: adresse,
    merken: merken,
    istStandard: istStandard,
    standard: STANDARD,
    vollstaendig: vollstaendig,
    holen: holen,
    bedienungEinbauen: bedienungEinbauen
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SEORANK_ABRUF;
