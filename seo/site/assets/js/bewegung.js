/* seo-rank.me — Bewegung und Bedienung.
   Leitsatz: Bewegung zeigt eine Messung. Es gibt genau einen inszenierten
   Moment, den Augenblick, in dem ein Ergebnis entsteht. Alles andere ist
   kurze Rückmeldung auf eine Handlung.

   Alle Bewegungen laufen über die Web-Animations-API mit fill "backwards".
   Damit bleibt nach dem Lauf kein Zustand am Element hängen: fällt das
   Skript aus, steht der Inhalt einfach da. Der Ruhezustand ist sichtbar. */

window.SEORANK = (function () {
  "use strict";

  var KURVE = "cubic-bezier(0.16, 1, 0.3, 1)";
  var DAUER_MESSUNG = 620;
  var DAUER_ZUSTAND = 190;
  var VERSATZ = 28;      // Abstand zwischen zwei eintragenden Zeilen
  var GESTAFFELT_MAX = 12;

  var sanft = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

  function wenigerBewegung() {
    return Boolean(sanft && sanft.matches);
  }

  function kannAnimieren(el) {
    return Boolean(el && typeof el.animate === "function") && !wenigerBewegung();
  }

  /* Startet eine Animation und sichert sie ab: laeuft die Zeitachse nicht
     (verstecktes Fenster, angehaltene Darstellung, Fehler), wird sie nach
     Ablauf abgebrochen. Ein Abbruch nimmt die Wirkung zurueck, das Element
     steht danach in seinem eigenen, sichtbaren Zustand. */
  function sicherLaufen(el, bilder, einstellungen) {
    var lauf;
    try {
      lauf = el.animate(bilder, einstellungen);
    } catch (e) {
      return null;
    }

    var frist = (einstellungen.delay || 0) + (einstellungen.duration || 0) + 500;
    window.setTimeout(function () {
      if (lauf.playState !== "finished") {
        try { lauf.cancel(); } catch (e) { /* schon weg */ }
      }
    }, frist);

    return lauf;
  }

  /* ---------- Zahlen fahren hoch ---------- */

  function zaehlen(el, ziel, formatieren) {
    if (!el) return;
    formatieren = formatieren || function (n) { return String(n); };

    if (wenigerBewegung() || !window.requestAnimationFrame || ziel <= 0) {
      el.textContent = formatieren(ziel);
      return;
    }

    /* Der wahre Wert steht sofort im Dokument. Faellt die Bildfolge aus,
       hat der Zaehler nichts verdorben; laeuft sie, setzt der erste Bildlauf
       auf null zurueck, noch bevor irgendetwas gezeichnet wurde. */
    el.textContent = formatieren(ziel);

    var beginn = null;
    var fertig = false;

    function schritt(zeit) {
      /* Nach der Sicherung darf nichts mehr schreiben. In einem Reiter im
         Hintergrund kommen die Bildlaeufe stark verzoegert; ohne diese
         Sperre traegt ein spaeter Schritt einen alten Zwischenwert nach
         und die Zahl bleibt falsch stehen, bis der Reiter wieder vorn ist. */
      if (fertig) return;
      if (beginn === null) beginn = zeit;
      var anteil = Math.min((zeit - beginn) / DAUER_MESSUNG, 1);
      // Exponentielles Auslaufen, passend zur Kurve im Stilblatt.
      var wert = anteil === 1 ? 1 : 1 - Math.pow(2, -10 * anteil);
      el.textContent = formatieren(Math.round(ziel * wert));
      if (anteil < 1) window.requestAnimationFrame(schritt);
      else fertig = true;
    }

    window.requestAnimationFrame(schritt);

    // Sicherung: nach der Zeit steht in jedem Fall der richtige Wert da.
    window.setTimeout(function () {
      fertig = true;
      el.textContent = formatieren(ziel);
    }, DAUER_MESSUNG + 150);
  }

  /* ---------- Zeilen tragen sich nacheinander ein ---------- */

  function staffeln(knoten) {
    if (!knoten || !knoten.length) return;
    Array.prototype.forEach.call(knoten, function (k, i) {
      if (i >= GESTAFFELT_MAX || !kannAnimieren(k)) return;
      /* Nur Bewegung, keine Deckkraft. Eine Animation mit fill "backwards"
         haelt das Element vor dem Start auf dem ERSTEN Bild fest — bei
         opacity 0 hiesse das: unsichtbar, solange die Zeitachse nicht
         laeuft. Ein um sechs Pixel versetztes Element ist lesbar, ein
         unsichtbares nicht. */
      sicherLaufen(k,
        [{ transform: "translateY(6px)" }, { transform: "none" }],
        { duration: DAUER_ZUSTAND, delay: i * VERSATZ, easing: KURVE, fill: "backwards" }
      );
    });
  }

  /* ---------- Beim Filtern wechselt die Liste als ein Bild ---------- */

  function wechseln(behaelter, tun) {
    /* Der Inhalt wird immer sofort richtig gesetzt. Die Ueberblendung laeuft
       ueber die Animations-API ohne Fuellung: es bleibt kein Zustand am
       Element haengen, den jemand wieder aufraeumen muesste. Laeuft die
       Zeitachse nicht, ist einfach nichts getruebt. */
    tun();
    if (!behaelter || !kannAnimieren(behaelter)) return;

    sicherLaufen(behaelter,
      [{ opacity: 0.3 }, { opacity: 1 }],
      { duration: DAUER_ZUSTAND, easing: KURVE }
    );
  }

  /* ---------- Die Linie zeichnet sich ---------- */

  function linieZeichnen(pfad, verzoegerung) {
    if (!kannAnimieren(pfad) || typeof pfad.getTotalLength !== "function") return;
    var laenge;
    try { laenge = pfad.getTotalLength(); } catch (e) { return; }
    if (!laenge) return;

    sicherLaufen(pfad,
      [
        { strokeDasharray: laenge + " " + laenge, strokeDashoffset: laenge },
        { strokeDasharray: laenge + " " + laenge, strokeDashoffset: 0 }
      ],
      { duration: DAUER_MESSUNG, delay: verzoegerung || 0, easing: KURVE, fill: "backwards" }
    );
  }

  function flaecheAufblenden(pfad, verzoegerung) {
    if (!kannAnimieren(pfad)) return;
    var ziel = pfad.getAttribute("opacity") || "0.1";
    sicherLaufen(pfad,
      [{ opacity: 0 }, { opacity: ziel }],
      { duration: DAUER_MESSUNG, delay: verzoegerung || 0, easing: "linear", fill: "backwards" }
    );
  }

  /* ---------- Balken fahren aus ---------- */

  function balkenAusfahren(wurzel) {
    var fuellungen = (wurzel || document).querySelectorAll(".balken__fuellung");
    Array.prototype.forEach.call(fuellungen, function (f, i) {
      if (!kannAnimieren(f)) return;
      sicherLaufen(f,
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        { duration: DAUER_MESSUNG, delay: i * 60, easing: KURVE, fill: "backwards" }
      );
    });
  }

  /* ---------- Diagramme beim ersten Erscheinen zeichnen ---------- */

  function diagrammeBeleben(wurzel) {
    var tafeln = (wurzel || document).querySelectorAll("[data-diagramm]");
    if (!tafeln.length) return;

    function beleben(tafel) {
      if (tafel.getAttribute("data-gezeichnet") === "ja") return;
      tafel.setAttribute("data-gezeichnet", "ja");
      var linien = tafel.querySelectorAll("path[stroke]");
      var flaechen = tafel.querySelectorAll("path[fill]:not([stroke])");
      Array.prototype.forEach.call(flaechen, function (f) { flaecheAufblenden(f, 80); });
      Array.prototype.forEach.call(linien, function (l, i) {
        if (l.getAttribute("stroke-width") === "1") return;   // Gitternetz bleibt
        linieZeichnen(l, i * 90);
      });
      balkenAusfahren(tafel);
    }

    if (!("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(tafeln, beleben);
      return;
    }

    var beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        beleben(e.target);
        beobachter.unobserve(e.target);
      });
    }, { threshold: 0.25 });

    Array.prototype.forEach.call(tafeln, function (t) { beobachter.observe(t); });
  }

  /* ---------- Eingaben über den Reload retten ---------- */

  /* sessionStorage, nicht localStorage: das Versprechen lautet, dass
     alles verschwindet, sobald der Reiter zugeht. Genau das tut es hier. */
  function eingabeMerken(feld, schluessel) {
    if (!feld || !window.sessionStorage) return;
    try {
      var gemerkt = window.sessionStorage.getItem(schluessel);
      if (gemerkt && !feld.value) feld.value = gemerkt;
      feld.addEventListener("input", function () {
        try { window.sessionStorage.setItem(schluessel, feld.value); } catch (e) { /* voll */ }
      });
    } catch (e) { /* gesperrt, dann eben nicht */ }
  }

  /* ---------- Datei anbieten ---------- */

  function herunterladen(dateiname, inhalt, art) {
    var behaelter = new Blob([inhalt], { type: (art || "text/plain") + ";charset=utf-8" });
    var adresse = URL.createObjectURL(behaelter);
    var a = document.createElement("a");
    a.href = adresse;
    a.download = dateiname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(adresse); }, 1000);
  }

  /* ---------- Einblenden beim Heranrollen ----------
     Der Ruhezustand ist der sichtbare Zustand: nichts wird versteckt und
     spaeter aufgeraeumt. Wer heranrollt, sieht eine kurze Bewegung; wer
     ohne Skript kommt, sieht denselben Inhalt ohne sie. */

  var EINBLENDER = [
    ".abschnitt__kopf",
    ".werkzeugkarte",
    ".kennzahl",
    ".modul",
    ".schritt",
    ".faq__punkt",
    ".werkblock",
    ".tafel",
    ".werkplatte",
    ".merkmale li",
    ".regelgruppe"
  ].join(", ");

  function einblendenBeimRollen() {
    if (wenigerBewegung()) return 0;
    if (!window.IntersectionObserver) return 0;

    var ziele = Array.prototype.slice.call(document.querySelectorAll(EINBLENDER));
    if (!ziele.length) return 0;

    /* Was beim Laden schon im Bild steht, blendet sofort ein — sonst
       wartete der Aufmacher auf eine Rollbewegung, die nie kommt. */
    var sofort = [], spaeter = [];
    ziele.forEach(function (el) {
      var kasten = el.getBoundingClientRect();
      if (kasten.top < window.innerHeight * 0.92) sofort.push(el);
      else spaeter.push(el);
    });

    function eintreten(el, versatz) {
      /* Siehe staffeln(): keine Deckkraft. Ein Abschnitt, der auf eine
         Rollbewegung wartet, darf nicht unsichtbar warten — sonst
         verschwindet er fuer jeden, der nicht rollt: Druck, Vorlesehilfe,
         eine Suchmaschine, die die Seite nur rendert. */
      sicherLaufen(el, [
        { transform: "translateY(10px)" },
        { transform: "none" }
      ], {
        duration: DAUER_ZUSTAND + 120,
        delay: versatz,
        easing: KURVE,
        fill: "backwards"
      });
    }

    sofort.forEach(function (el, i) { eintreten(el, Math.min(i, 6) * 45); });

    var beobachter = new IntersectionObserver(function (eintraege) {
      eintraege.forEach(function (e) {
        if (!e.isIntersecting) return;
        beobachter.unobserve(e.target);
        eintreten(e.target, 0);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

    spaeter.forEach(function (el) { beobachter.observe(el); });
    return ziele.length;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", einblendenBeimRollen);
  } else {
    einblendenBeimRollen();
  }

  return {
    wenigerBewegung: wenigerBewegung,
    einblendenBeimRollen: einblendenBeimRollen,
    zaehlen: zaehlen,
    staffeln: staffeln,
    wechseln: wechseln,
    linieZeichnen: linieZeichnen,
    balkenAusfahren: balkenAusfahren,
    diagrammeBeleben: diagrammeBeleben,
    eingabeMerken: eingabeMerken,
    herunterladen: herunterladen,
    KURVE: KURVE
  };
})();

/* ============================================================
   Bedienung: Tastatur, Suche im Regelsatz, Ableseband
   ============================================================ */

(function () {
  "use strict";

  /* ---------- Tastenkürzel ---------- */

  document.addEventListener("keydown", function (e) {
    var ziel = e.target;
    var imFeld = ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA" || ziel.isContentEditable);

    // Schrägstrich springt in das erste Eingabefeld der Seite.
    if (e.key === "/" && !imFeld && !e.ctrlKey && !e.metaKey && !e.altKey) {
      var erstes = document.querySelector(".suchfeld, .eingabe, .pruefform__feld, .feld");
      if (erstes) {
        e.preventDefault();
        erstes.focus();
        if (erstes.select) erstes.select();
      }
      return;
    }

    // Escape verlässt das Feld, damit die Kürzel wieder greifen.
    if (e.key === "Escape" && imFeld) {
      if (ziel.classList.contains("suchfeld") && ziel.value) {
        ziel.value = "";
        ziel.dispatchEvent(new Event("input", { bubbles: true }));
        return;
      }
      ziel.blur();
    }
  });

  /* ---------- Sofortsuche im Regelsatz ---------- */

  (function regelsuche() {
    var feld = document.getElementById("regelsuche");
    if (!feld) return;

    var regeln = document.querySelectorAll(".regel");
    var gruppen = document.querySelectorAll(".regelgruppe");
    var stand = document.querySelector(".filterstand");
    var stufe = "alle";

    // Ursprungstexte sichern, damit die Hervorhebung rückstandslos bleibt.
    var vorrat = Array.prototype.map.call(regeln, function (r) {
      return {
        knoten: r,
        name: r.querySelector(".regel__name"),
        pruefung: r.querySelector(".regel__pruefung"),
        kennung: r.querySelector(".regel__stufe code"),
        nameHTML: r.querySelector(".regel__name").innerHTML,
        pruefungHTML: r.querySelector(".regel__pruefung").innerHTML,
        suchtext: r.textContent.toLowerCase()
      };
    });

    function hervorheben(el, ursprung, wort) {
      if (!wort) { el.innerHTML = ursprung; return; }
      // Nur in Textknoten ersetzen, damit Auszeichnung heil bleibt.
      var hilf = document.createElement("div");
      hilf.innerHTML = ursprung;
      var stapel = [hilf];
      var muster = new RegExp("(" + wort.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      while (stapel.length) {
        var knoten = stapel.pop();
        Array.prototype.slice.call(knoten.childNodes).forEach(function (k) {
          if (k.nodeType === 3) {
            if (!muster.test(k.textContent)) return;
            muster.lastIndex = 0;
            var ersatz = document.createElement("span");
            ersatz.innerHTML = k.textContent.replace(muster, '<mark class="treffer">$1</mark>');
            k.parentNode.replaceChild(ersatz, k);
          } else if (k.nodeType === 1 && k.tagName !== "MARK") {
            stapel.push(k);
          }
        });
      }
      el.innerHTML = hilf.innerHTML;
    }

    function anwenden() {
      var wort = feld.value.trim().toLowerCase();
      var sichtbar = 0;

      vorrat.forEach(function (e) {
        var passtStufe = stufe === "alle" || e.knoten.getAttribute("data-stufe") === stufe;
        var passtWort = !wort || e.suchtext.indexOf(wort) !== -1;
        var zeigen = passtStufe && passtWort;
        e.knoten.hidden = !zeigen;
        if (zeigen) sichtbar++;
        if (zeigen) {
          hervorheben(e.name, e.nameHTML, wort);
          hervorheben(e.pruefung, e.pruefungHTML, wort);
        }
      });

      Array.prototype.forEach.call(gruppen, function (g) {
        var offen = g.querySelectorAll(".regel:not([hidden])").length;
        g.hidden = offen === 0;
        var zaehler = g.querySelector("[data-gruppenzahl]");
        if (zaehler) zaehler.textContent = offen + (offen === 1 ? " Regel" : " Regeln");
      });

      if (stand) stand.textContent = sichtbar + " von " + vorrat.length + " Regeln";
    }

    feld.addEventListener("input", anwenden);

    // Die Stufenknöpfe teilen sich den Zustand mit der Suche.
    var leiste = document.querySelector("[data-regelfilter]");
    if (leiste) {
      Array.prototype.forEach.call(leiste.querySelectorAll(".filter"), function (k) {
        k.addEventListener("click", function () {
          stufe = k.getAttribute("data-stufe");
          Array.prototype.forEach.call(leiste.querySelectorAll(".filter"), function (x) {
            x.setAttribute("aria-pressed", String(x === k));
          });
          anwenden();
        });
      });
    }

    anwenden();
  })();

  /* ---------- Ableseband am Diagramm ---------- */

  (function ablesen() {
    var felder = document.querySelectorAll("[data-ablesen]");
    if (!felder.length) return;

    Array.prototype.forEach.call(felder, function (feld) {
      var werte;
      try { werte = JSON.parse(feld.getAttribute("data-ablesen")); } catch (e) { return; }
      if (!werte || !werte.punkte || !werte.punkte.length) return;

      feld.classList.add("ablesen");

      var linie = document.createElement("span");
      linie.className = "ablesen__linie";
      var wert = document.createElement("span");
      wert.className = "ablesen__wert";
      feld.appendChild(linie);
      feld.appendChild(wert);

      function zeigen(e) {
        var kasten = feld.getBoundingClientRect();
        var x = (e.clientX !== undefined ? e.clientX : 0) - kasten.left;
        var anteil = Math.max(0, Math.min(x / kasten.width, 1));
        var index = Math.round(anteil * (werte.punkte.length - 1));
        var punkt = werte.punkte[index];
        var xProzent = (index / (werte.punkte.length - 1)) * 100;

        linie.style.left = xProzent + "%";
        wert.style.left = xProzent + "%";
        wert.textContent = punkt.zeit + " · " + punkt.wert + (werte.einheit ? " " + werte.einheit : "");
        feld.setAttribute("data-aktiv", "ja");
      }

      feld.addEventListener("pointermove", zeigen);
      feld.addEventListener("pointerleave", function () { feld.setAttribute("data-aktiv", "nein"); });

      // Mit der Tastatur bedienbar: Pfeiltasten wandern durch die Punkte.
      feld.setAttribute("tabindex", "0");
      feld.setAttribute("role", "img");
      var stelle = 0;
      feld.addEventListener("keydown", function (e) {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        stelle = Math.max(0, Math.min(stelle + (e.key === "ArrowRight" ? 1 : -1), werte.punkte.length - 1));
        var punkt = werte.punkte[stelle];
        var xProzent = (stelle / (werte.punkte.length - 1)) * 100;
        linie.style.left = xProzent + "%";
        wert.style.left = xProzent + "%";
        wert.textContent = punkt.zeit + " · " + punkt.wert + (werte.einheit ? " " + werte.einheit : "");
        feld.setAttribute("data-aktiv", "ja");
      });
      feld.addEventListener("blur", function () { feld.setAttribute("data-aktiv", "nein"); });
    });
  })();

  /* ---------- Diagramme beleben ---------- */

  if (window.SEORANK) window.SEORANK.diagrammeBeleben(document);
})();
