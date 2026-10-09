/* seo-rank.me — die Kontoseite bedienen.

   `konto.js` kann alles und zeichnet nichts. Diese Datei zeichnet und
   kann nichts — dieselbe Trennung wie zwischen `pruefwerk.js` und
   `werkzeuge.js`.

   Zwei Regeln, die hier tragen:

   - Der Ruhezustand ist der sichtbare Zustand. Ohne Skript zeigt die
     Seite das Anmeldeformular und den Leerstand darunter; nichts ist
     versteckt, was man braucht. Sichtbar wird NUR umgeschaltet, was
     erst nach einer Anmeldung Sinn hat.
   - Kein Formularelement. Die Seite hat absichtlich kein `form`: ein
     Formular ohne `name` meldet der eigene Katalog als
     `feld-ohne-namen`, eines mit `name` und ohne Skript schickt das
     Passwort in die Adresszeile. Derselbe Grund wie auf der
     Startseite. */

(function () {
  "use strict";

  if (typeof SEORANK_KONTO === "undefined") return;

  var teil = document.getElementById("konto-formular");
  if (!teil) return;

  var K = SEORANK_KONTO;
  var angemeldetKarte = document.getElementById("konto-angemeldet");
  var werZeile = document.getElementById("konto-wer");
  var begruessung = document.getElementById("konto-begruessung");
  var titel = document.getElementById("konto-titel");
  var unterzeile = document.getElementById("konto-unterzeile");
  var namefeld = document.getElementById("konto-name");
  var namensblock = document.getElementById("konto-namefeld");
  var postfeld = document.getElementById("konto-post");
  var passwortfeld = document.getElementById("konto-passwort");
  var codeblock = document.getElementById("konto-codefeld");
  var codefeld = document.getElementById("konto-code");
  var meldung = document.getElementById("konto-meldung");
  var abschicken = document.getElementById("konto-abschicken");
  var wechseln = document.getElementById("konto-wechseln");
  var vergessen = document.getElementById("konto-vergessen");
  var abmeldenKnopf = document.getElementById("konto-abmelden");
  var zusage = document.getElementById("konto-zusage");
  var tabelle = document.getElementById("konto-tabelle");
  var zeilen = document.getElementById("konto-zeilen");
  var leer = document.getElementById("konto-leer");

  var art = "anmelden";      /* oder "registrieren" */
  var offenerZustand = null; /* Zustandsschluessel, wenn Post bestaetigt werden muss */
  var offenerBesucher = null;

  /* ---------- Meldungen ---------- */

  function sagen(text, warnt) {
    meldung.textContent = text || "";
    meldung.classList.toggle("formhinweis--warn", !!warnt);
  }

  /* Die Zusage wird ERSETZT, nicht ergaenzt. Zwei einander
     widersprechende Saetze in einer Zeile sind schlimmer als einer. */
  function zusageNachAbruf() {
    if (!zusage) return;
    zusage.textContent = "Adresse und Passwort sind an www.wixapis.com gegangen — an die "
      + "Mitgliederverwaltung der Wix-Site hinter hnvr.me. Der Anmeldeschlüssel liegt in "
      + "sessionStorage und verschwindet mit diesem Reiter.";
    zusage.classList.add("zusage--warn");
  }

  /* ---------- Umschalten anmelden / registrieren ---------- */

  function formZeichnen() {
    var neu = art === "registrieren";
    titel.textContent = neu ? "Konto anlegen" : "Anmelden";
    unterzeile.textContent = neu
      ? "Adresse und Passwort werden bei der Mitgliederverwaltung angelegt."
      : "Mit einer Adresse, für die es schon ein Konto gibt.";
    abschicken.textContent = neu ? "registrieren" : "anmelden";
    wechseln.textContent = neu ? "schon ein Konto? anmelden" : "noch kein Konto? registrieren";
    namensblock.hidden = !neu;
    passwortfeld.setAttribute("autocomplete", neu ? "new-password" : "current-password");
    vergessen.hidden = neu;
    sagen("");
  }

  wechseln.addEventListener("click", function () {
    art = art === "anmelden" ? "registrieren" : "anmelden";
    codeblock.hidden = true;
    offenerZustand = null;
    formZeichnen();
    postfeld.focus();
  });

  /* ---------- Absenden ---------- */

  function sperren(an) {
    abschicken.disabled = an;
    wechseln.disabled = an;
    vergessen.disabled = an;
  }

  function ergebnisBehandeln(e) {
    sperren(false);
    if (!e.ok) { sagen(e.fehler || "Das hat nicht geklappt.", true); return; }
    if (e.offen === "post") {
      offenerZustand = e.zustandsToken;
      offenerBesucher = e.besucher;
      codeblock.hidden = false;
      abschicken.textContent = "code bestätigen";
      sagen(e.hinweis || "Bestätigungscode eingeben.", false);
      codefeld.focus();
      return;
    }
    if (e.offen === "freigabe") { sagen(e.hinweis, true); return; }
    codeblock.hidden = true;
    offenerZustand = null;
    sagen("");
    zeichnen();
    pruefungenZeichnen();
  }

  abschicken.addEventListener("click", function () {
    var post = postfeld.value.trim();
    var passwort = passwortfeld.value;

    if (offenerZustand) {
      var code = codefeld.value.trim();
      if (!code) { sagen("Ohne Code geht es nicht weiter.", true); codefeld.focus(); return; }
      sperren(true);
      sagen("Code wird geprüft …");
      zusageNachAbruf();
      K.bestaetigen(code, offenerZustand, offenerBesucher).then(ergebnisBehandeln);
      return;
    }

    if (!post || post.indexOf("@") < 0) { sagen("Bitte eine E-Mail-Adresse.", true); postfeld.focus(); return; }
    if (!passwort) { sagen("Bitte ein Passwort.", true); passwortfeld.focus(); return; }
    if (art === "registrieren" && passwort.length < 8) {
      sagen("Das Passwort braucht mindestens 8 Zeichen.", true); passwortfeld.focus(); return;
    }

    sperren(true);
    sagen(art === "registrieren" ? "Konto wird angelegt …" : "Anmeldung läuft …");
    zusageNachAbruf();
    var lauf = art === "registrieren"
      ? K.registrieren(post, passwort, namefeld.value)
      : K.anmelden(post, passwort);
    lauf.then(ergebnisBehandeln);
  });

  /* Eingabetaste im Passwortfeld soll abschicken — ohne `form` macht
     das kein Browser von allein. */
  [postfeld, passwortfeld, codefeld, namefeld].forEach(function (f) {
    f.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); abschicken.click(); }
    });
  });

  /* ---------- Passwort vergessen ---------- */

  vergessen.addEventListener("click", function () {
    var post = postfeld.value.trim();
    if (!post || post.indexOf("@") < 0) {
      sagen("Für die Wiederherstellung braucht es die E-Mail-Adresse im Feld darüber.", true);
      postfeld.focus();
      return;
    }
    sperren(true);
    sagen("Wiederherstellung wird angefragt …");
    zusageNachAbruf();
    K.wiederherstellen(post, location.href.split("#")[0]).then(function (e) {
      sperren(false);
      sagen(e.ok
        ? "Wenn es zu dieser Adresse ein Konto gibt, ist eine E-Mail unterwegs."
        : (e.fehler || "Das hat nicht geklappt."), !e.ok);
    });
  });

  /* ---------- Abmelden ---------- */

  abmeldenKnopf.addEventListener("click", function () {
    abmeldenKnopf.disabled = true;
    K.abmelden().then(function () {
      abmeldenKnopf.disabled = false;
      zeichnen();
      pruefungenZeichnen();
    });
  });

  /* ---------- Der Zustand der Seite ---------- */

  function zeichnen() {
    var w = K.wer();
    var an = !!w;
    angemeldetKarte.hidden = !an;
    teil.hidden = an;
    if (an) {
      begruessung.textContent = w.name ? "Angemeldet als " + w.name : "Angemeldet";
      werZeile.textContent = w.post || "";
    }
  }

  /* ---------- Abgelegte Pruefungen ---------- */

  function datumKurz(wert) {
    if (!wert) return "—";
    var d = new Date(wert);
    if (isNaN(d.getTime())) return "—";
    function zwei(n) { return (n < 10 ? "0" : "") + n; }
    return zwei(d.getDate()) + "." + zwei(d.getMonth() + 1) + "." + d.getFullYear()
      + " " + zwei(d.getHours()) + ":" + zwei(d.getMinutes());
  }

  function zelle(reihe, text, einstellungen) {
    var z = document.createElement("td");
    z.textContent = text;
    if (einstellungen && einstellungen.still) z.className = "still";
    reihe.appendChild(z);
    return z;
  }

  function pruefungenZeichnen() {
    if (!K.angemeldet()) {
      tabelle.hidden = true;
      leer.hidden = false;
      leer.textContent = "Ohne Anmeldung gibt es keine Ablage. Die Werkzeuge laufen trotzdem alle.";
      return;
    }
    leer.hidden = false;
    leer.textContent = "Ablage wird geholt …";
    tabelle.hidden = true;

    K.pruefungenHolen(50).then(function (e) {
      if (!e.ok) {
        tabelle.hidden = true;
        leer.hidden = false;
        leer.textContent = e.fehler || "Die Ablage antwortet nicht.";
        return;
      }
      zeilen.textContent = "";
      if (!e.pruefungen.length) {
        tabelle.hidden = true;
        leer.hidden = false;
        leer.textContent = "Noch nichts abgelegt. Eine Prüfung im Protokoll ablegen, dann steht sie hier.";
        return;
      }
      e.pruefungen.forEach(function (p) {
        var r = document.createElement("tr");
        zelle(r, p.adresse || p.titel || "—");
        zelle(r, datumKurz(p.geprueft), { still: true });
        zelle(r, p.umfang === "domain" ? "ganze Domain" : "nur diese Seite", { still: true });
        zelle(r, String(p.wert));
        zelle(r, p.kritisch + " / " + p.wichtig + " / " + p.hinweise, { still: true });
        var weg = document.createElement("td");
        var knopf = document.createElement("button");
        knopf.type = "button";
        knopf.className = "knopf knopf--leise";
        knopf.textContent = "löschen";
        knopf.addEventListener("click", function () {
          knopf.disabled = true;
          K.pruefungLoeschen(p.kennung).then(function (l) {
            if (l.ok) pruefungenZeichnen();
            else { knopf.disabled = false; sagen(l.fehler || "Löschen ging nicht.", true); }
          });
        });
        weg.appendChild(knopf);
        r.appendChild(weg);
        zeilen.appendChild(r);
      });
      tabelle.hidden = false;
      leer.hidden = true;
    });
  }

  /* ---------- Los ---------- */

  formZeichnen();
  zeichnen();
  pruefungenZeichnen();
  K.beiWechsel(function () { zeichnen(); });

  /* Wer ueber „konto" aus dem Protokoll kommt, will dort weitermachen. */
  if (location.hash === "#anmelden" && !K.angemeldet()) postfeld.focus();
})();
