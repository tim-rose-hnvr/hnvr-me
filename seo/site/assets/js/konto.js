/* seo-rank.me — Konto: Anmeldung und gespeicherte Pruefungen.

   Bis hierher hat diese Website nichts gewusst und nichts behalten. Ein
   Konto aendert das, und zwar genau an einer Stelle: wer angemeldet ist,
   kann eine Pruefung ABLEGEN und spaeter wiederfinden. Alles andere
   rechnet weiter im Browser, auch ohne Konto.

   Die Mitglieder liegen NICHT hier. Sie liegen auf der Wix-Site hinter
   hnvr.me; diese Website ist nur ein Client davon. Das hat zwei Folgen,
   die man wissen muss:

   - Es gibt kein Geheimnis in diesem Code. Die Client-Kennung ist
     oeffentlich (so ist OAuth mit PKCE gebaut), ein Passwort geht
     direkt an Wix und kommt hier nie zur Ruhe.
   - Ohne Netz gibt es keine Anmeldung. Jede Funktion hier gibt deshalb
     IMMER ein Objekt mit `ok` zurueck, nie eine abgelehnte Zusage —
     wie beim Relais in `abruf.js`. Ein Anmeldeproblem ist ein
     Ergebnis, kein Absturz.

   Das Sitzungsgedaechtnis liegt in `sessionStorage`, nicht in
   `localStorage`. Das Versprechen der Website lautet, dass alles mit
   dem Reiter verschwindet; ein Konto darf daran nichts aendern. Wer den
   Reiter schliesst, ist abgemeldet.

   GEMESSEN am 29.09.2026 aus dem Browser, Herkunft http://localhost:8099
   (also fremd), mit der Client-Kennung unten:
     Besucher-Token       HTTP 200, 811 Zeichen, refresh_token dabei
     Login V2             HTTP 404 "Identity not found" (Endpunkt lebt)
     Redirect Session     HTTP 200, liefert fullUrl
     Mitglieder-API       HTTP 403 "Missing site member id" (richtig)
   Alle vier sind CORS-offen. Was NICHT gemessen ist, steht bei
   `codeAusFenster` — dort und nur dort wird geraten. */

var SEORANK_KONTO = (function () {
  "use strict";

  /* Die Client-Kennung ist kein Geheimnis — sie steht in jedem
     Frontend, das OAuth mit PKCE benutzt. Sie gehoert zur vorhandenen
     Headless-App der Wix-Site hinter hnvr.me. Wer ein eigenes Konto
     anbindet, traegt seine eigene ein; dafuer gibt es denselben
     sessionStorage-Weg wie bei der Relais-Adresse. */
  var CLIENT_STANDARD = "0d78f0ce-1dba-41bc-a273-46accc6d481a";
  var S_CLIENT = "seorank-konto-client";
  var S_SITZUNG = "seorank-konto";
  var SAMMLUNG = "seorank-pruefungen";
  var WIX = "https://www.wixapis.com";

  /* ---------- Client-Kennung ---------- */

  function client() {
    try {
      var eigen = sessionStorage.getItem(S_CLIENT);
      if (eigen && eigen.trim()) return eigen.trim();
    } catch (e) { /* privater Modus */ }
    return CLIENT_STANDARD;
  }

  function merkenClient(wert) {
    try {
      if (wert && wert.trim()) sessionStorage.setItem(S_CLIENT, wert.trim());
      else sessionStorage.removeItem(S_CLIENT);
    } catch (e) { /* dann gilt es nur fuer diese Seite */ }
  }

  function istStandardClient() { return client() === CLIENT_STANDARD; }

  /* ---------- Sitzung ---------- */

  /* Der Stand der Sitzung: welche Token gelten, wie lange, und wer
     angemeldet ist. Ein leeres Objekt heisst „niemand". */
  function stand() {
    try {
      var rohtext = sessionStorage.getItem(S_SITZUNG);
      if (!rohtext) return {};
      var s = JSON.parse(rohtext);
      return s && typeof s === "object" ? s : {};
    } catch (e) { return {}; }
  }

  function standSetzen(s) {
    try {
      if (s && s.zugang) sessionStorage.setItem(S_SITZUNG, JSON.stringify(s));
      else sessionStorage.removeItem(S_SITZUNG);
    } catch (e) { /* dann gilt sie nur fuer diese Seite */ }
    melden();
  }

  function angemeldet() {
    var s = stand();
    return !!(s.zugang && s.mitglied);
  }

  /* Wer gerade angemeldet ist — oder null. Nur was Wix uns gesagt hat,
     nichts Ausgedachtes. */
  function wer() {
    var s = stand();
    if (!s.mitglied) return null;
    return {
      kennung: s.kennung || null,
      post: s.post || null,
      name: s.name || null
    };
  }

  /* Wer sich fuer den Wechsel anmelden will: Kopfzeile, Protokoll,
     Kontoseite. Sie sollen sich neu zeichnen, wenn jemand sich an- oder
     abmeldet, ohne dass die Seite neu geladen wird. */
  var hoerer = [];
  function beiWechsel(f) { if (typeof f === "function") hoerer.push(f); }
  function melden() {
    for (var i = 0; i < hoerer.length; i++) {
      try { hoerer[i](wer()); } catch (e) { /* ein Hoerer darf den Rest nicht aufhalten */ }
    }
  }

  /* ---------- Handwerk ---------- */

  function bytesZuBasis64Url(bytes) {
    var roh = "";
    for (var i = 0; i < bytes.length; i++) roh += String.fromCharCode(bytes[i]);
    return btoa(roh).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function zufall(laenge) {
    var b = new Uint8Array(laenge);
    crypto.getRandomValues(b);
    return bytesZuBasis64Url(b);
  }

  /* PKCE: der Pruefer bleibt hier, nur sein Hash geht zu Wix. Ohne das
     koennte ein abgefangener Autorisierungscode von jemand anderem
     eingeloest werden. */
  function pkce() {
    var pruefer = zufall(64);
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(pruefer))
      .then(function (hash) {
        return { pruefer: pruefer, frage: bytesZuBasis64Url(new Uint8Array(hash)) };
      });
  }

  /* Jeder Ruf nach Wix geht hier durch. Gibt { ok, status, daten } und
     wirft nie. */
  function ruf(pfad, einstellungen) {
    einstellungen = einstellungen || {};
    var kopf = { "content-type": "application/json" };
    if (einstellungen.token) kopf.authorization = einstellungen.token;
    return fetch(WIX + pfad, {
      method: einstellungen.art || "POST",
      headers: kopf,
      body: einstellungen.rumpf ? JSON.stringify(einstellungen.rumpf) : undefined
    }).then(function (a) {
      return a.text().then(function (text) {
        var daten = null;
        try { daten = text ? JSON.parse(text) : null; } catch (e) { daten = null; }
        return { ok: a.ok, status: a.status, daten: daten, text: text };
      });
    }).catch(function (f) {
      return { ok: false, status: 0, daten: null, text: String(f) };
    });
  }

  /* Eine Wix-Fehlermeldung in einen Satz uebersetzen, den man lesen
     kann. Was wir nicht kennen, geben wir unveraendert weiter — eine
     erfundene Erklaerung waere schlimmer als eine fremde. */
  function klartext(a) {
    if (a.status === 0) return "Keine Verbindung zur Mitgliederverwaltung.";
    var m = (a.daten && (a.daten.message || a.daten.details && a.daten.details.applicationError
      && a.daten.details.applicationError.description)) || "";
    if (/identity not found/i.test(m)) return "Diese Adresse oder das Passwort stimmt nicht.";
    if (/wrong password|invalid password|password/i.test(m) && a.status === 400) return "Diese Adresse oder das Passwort stimmt nicht.";
    if (/already exists|taken/i.test(m)) return "Zu dieser Adresse gibt es schon ein Konto.";
    if (/captcha/i.test(m)) return "Die Mitgliederverwaltung verlangt eine Captcha-Prüfung. Diese Website kann das nicht leisten.";
    if (a.status === 429) return "Zu viele Versuche. Später noch einmal.";
    return m || ("Die Mitgliederverwaltung antwortete mit " + a.status + ".");
  }

  /* ---------- Besucher-Token ---------- */

  /* Ohne Anmeldung, ohne Geheimnis: der anonyme Zugang. Er wird fuer
     die Anmeldung selbst gebraucht (Login V2 will einen Token) und
     gilt vier Stunden. */
  var besucherLauf = null;
  function besucherToken() {
    if (besucherLauf) return besucherLauf;
    besucherLauf = ruf("/oauth2/token", {
      rumpf: { clientId: client(), grantType: "anonymous" }
    }).then(function (a) {
      besucherLauf = null;
      if (!a.ok || !a.daten || !a.daten.access_token) {
        return { ok: false, fehler: klartext(a) };
      }
      return { ok: true, token: a.daten.access_token };
    });
    return besucherLauf;
  }

  /* ---------- Anmelden und Registrieren ---------- */

  /* Beide Wege enden gleich: mit einem `sessionToken`, der fuenf
     Minuten gilt und noch KEINE Erlaubnis fuer irgendetwas ist. Was
     danach kommt, macht `mitgliedWerden`. */

  function anmelden(post, passwort) {
    return besucherToken().then(function (b) {
      if (!b.ok) return b;
      return ruf("/_api/iam/authentication/v2/login", {
        token: b.token,
        rumpf: { loginId: { email: String(post || "").trim() }, password: String(passwort || "") }
      }).then(function (a) { return zustandBehandeln(a, b.token); });
    });
  }

  function registrieren(post, passwort, name) {
    var profil = {};
    var n = String(name || "").trim();
    if (n) {
      var teile = n.split(/\s+/);
      profil.firstName = teile.shift();
      if (teile.length) profil.lastName = teile.join(" ");
      profil.nickname = n;
    }
    return besucherToken().then(function (b) {
      if (!b.ok) return b;
      var rumpf = { loginId: { email: String(post || "").trim() }, password: String(passwort || "") };
      if (profil.firstName) rumpf.profile = profil;
      return ruf("/_api/iam/authentication/v2/register", {
        token: b.token, rumpf: rumpf
      }).then(function (a) { return zustandBehandeln(a, b.token); });
    });
  }

  /* Die vier Zustaende, die Wix melden kann. Wer nur SUCCESS behandelt,
     laesst den Benutzer bei „Post bestaetigen" im Leeren stehen. */
  function zustandBehandeln(a, besucher) {
    if (!a.ok || !a.daten) return { ok: false, fehler: klartext(a) };
    var z = a.daten.state;
    if (z === "SUCCESS") {
      return mitgliedWerden(a.daten.sessionToken, besucher, a.daten.identity);
    }
    if (z === "REQUIRE_EMAIL_VERIFICATION") {
      return {
        ok: true, offen: "post", zustandsToken: a.daten.stateToken, besucher: besucher,
        hinweis: "Wix hat einen Bestätigungscode an diese Adresse geschickt."
      };
    }
    if (z === "REQUIRE_OWNER_APPROVAL") {
      return { ok: true, offen: "freigabe", hinweis: "Das Konto muss erst freigegeben werden." };
    }
    return { ok: false, fehler: "Unbekannter Anmeldezustand: " + String(z) };
  }

  /* Den Code aus der Bestaetigungspost einloesen. */
  function bestaetigen(code, zustandsToken, besucher) {
    return (besucher ? Promise.resolve({ ok: true, token: besucher }) : besucherToken())
      .then(function (b) {
        if (!b.ok) return b;
        return ruf("/_api/iam/verification/v1/auth/verify", {
          token: b.token,
          rumpf: { code: String(code || "").trim(), stateToken: zustandsToken }
        }).then(function (a) { return zustandBehandeln(a, b.token); });
      });
  }

  /* ---------- Aus sessionToken wird ein Mitglied ---------- */

  /* Drei Schritte, die zusammengehoeren: eine Autorisierungs-Adresse
     holen, sie in einem unsichtbaren Fenster oeffnen, den Code gegen
     Mitglieder-Token tauschen. */
  function mitgliedWerden(sitzungsToken, besucher, kennzeichen) {
    if (!sitzungsToken) return Promise.resolve({ ok: false, fehler: "Wix hat keinen Sitzungsschlüssel geschickt." });
    var zustand = zufall(24);
    return pkce().then(function (p) {
      return ruf("/_api/redirects-api/v1/redirect-session", {
        token: besucher,
        rumpf: {
          auth: {
            authRequest: {
              clientId: client(),
              codeChallenge: p.frage,
              codeChallengeMethod: "S256",
              responseMode: "web_message",
              responseType: "code",
              scope: "offline_access",
              state: zustand,
              sessionToken: sitzungsToken
            }
          }
        }
      }).then(function (a) {
        var adresse = a.daten && a.daten.redirectSession && a.daten.redirectSession.fullUrl;
        if (!a.ok || !adresse) return { ok: false, fehler: klartext(a) };
        return codeAusFenster(adresse, zustand).then(function (c) {
          if (!c.ok) return c;
          return ruf("/oauth2/token", {
            rumpf: {
              clientId: client(),
              grantType: "authorization_code",
              code: c.code,
              codeVerifier: p.pruefer
            }
          }).then(function (t) {
            if (!t.ok || !t.daten || !t.daten.access_token) return { ok: false, fehler: klartext(t) };
            var post = kennzeichen && kennzeichen.email && kennzeichen.email.address;
            var name = kennzeichen && kennzeichen.identityProfile && kennzeichen.identityProfile.nickname;
            standSetzen({
              zugang: t.daten.access_token,
              erneuern: t.daten.refresh_token || null,
              bis: Date.now() + (Number(t.daten.expires_in) || 14400) * 1000,
              mitglied: true,
              kennung: (kennzeichen && kennzeichen.id) || null,
              post: post || null,
              name: name || null
            });
            return { ok: true, wer: wer() };
          });
        });
      });
    });
  }

  /* Das unsichtbare Fenster.

     NICHT GEPRUEFT: die genaue Gestalt der Nachricht, die Wix per
     postMessage zuruecksendet. Die Doku sagt nur, sie enthalte `code`
     und `state`; einen echten Lauf konnten wir nicht messen, weil
     dafuer ein echtes Mitglied in einer fremden Kundenliste haette
     entstehen muessen. Deshalb wird hier NICHT auf eine Form geraten:
     `suchen` geht die Nachricht rekursiv durch und nimmt das erste
     Paar aus `code` und `state`, das es findet — egal, wie tief es
     liegt oder wie die Huelle heisst.

     Was dagegen geprueft wird, und zwar streng: die Herkunft muss
     genau die der Autorisierungs-Adresse sein, und `state` muss
     stimmen. Ohne das koennte eine beliebige fremde Seite einen
     Anmeldecode hereinreichen. */
  function codeAusFenster(adresse, zustand) {
    return new Promise(function (fertig) {
      var herkunft;
      try { herkunft = new URL(adresse).origin; }
      catch (e) { fertig({ ok: false, fehler: "Wix hat eine unbrauchbare Adresse geschickt." }); return; }

      var rahmen = document.createElement("iframe");
      rahmen.setAttribute("title", "Anmeldung bei der Mitgliederverwaltung");
      rahmen.setAttribute("aria-hidden", "true");
      rahmen.className = "kontorahmen";
      var frist = null;

      function aufraeumen() {
        window.removeEventListener("message", empfangen);
        if (frist) clearTimeout(frist);
        if (rahmen.parentNode) rahmen.parentNode.removeChild(rahmen);
      }

      function suchen(wert, tiefe) {
        if (!wert || typeof wert !== "object" || tiefe > 6) return null;
        if (typeof wert.code === "string" && typeof wert.state === "string") {
          return { code: wert.code, state: wert.state };
        }
        for (var s in wert) {
          if (!Object.prototype.hasOwnProperty.call(wert, s)) continue;
          var t = suchen(wert[s], tiefe + 1);
          if (t) return t;
        }
        return null;
      }

      function empfangen(e) {
        if (e.origin !== herkunft) return;
        var inhalt = e.data;
        if (typeof inhalt === "string") {
          try { inhalt = JSON.parse(inhalt); } catch (f) { return; }
        }
        var gefunden = suchen(inhalt, 0);
        if (!gefunden) return;
        if (gefunden.state !== zustand) {
          aufraeumen();
          fertig({ ok: false, fehler: "Die Antwort der Anmeldung gehört nicht zu dieser Anfrage." });
          return;
        }
        aufraeumen();
        fertig({ ok: true, code: gefunden.code });
      }

      window.addEventListener("message", empfangen);
      frist = setTimeout(function () {
        aufraeumen();
        fertig({ ok: false, fehler: "Die Mitgliederverwaltung hat nicht geantwortet." });
      }, 30000);

      rahmen.src = adresse;
      document.body.appendChild(rahmen);
    });
  }

  /* ---------- Token frisch halten ---------- */

  /* Vier Stunden sind lang, aber nicht unendlich. Wer nach Ablauf
     speichert, bekaeme ein 401 und wuesste nicht, warum. */
  function frischerZugang() {
    var s = stand();
    if (!s.zugang) return Promise.resolve({ ok: false, fehler: "Nicht angemeldet." });
    if (s.bis && Date.now() < s.bis - 60000) return Promise.resolve({ ok: true, token: s.zugang });
    if (!s.erneuern) {
      standSetzen({});
      return Promise.resolve({ ok: false, fehler: "Die Anmeldung ist abgelaufen." });
    }
    return ruf("/oauth2/token", {
      rumpf: { clientId: client(), grantType: "refresh_token", refreshToken: s.erneuern }
    }).then(function (a) {
      if (!a.ok || !a.daten || !a.daten.access_token) {
        standSetzen({});
        return { ok: false, fehler: "Die Anmeldung ist abgelaufen." };
      }
      s.zugang = a.daten.access_token;
      if (a.daten.refresh_token) s.erneuern = a.daten.refresh_token;
      s.bis = Date.now() + (Number(a.daten.expires_in) || 14400) * 1000;
      standSetzen(s);
      return { ok: true, token: s.zugang };
    });
  }

  /* ---------- Abmelden ---------- */

  /* Der Reiter wird sofort geleert — das ist der Teil, den wir in der
     Hand haben. Wix wird zusaetzlich gebeten, die eigene Sitzung zu
     beenden; ob das klappt, darf die Abmeldung hier nicht aufhalten. */
  function abmelden() {
    var s = stand();
    standSetzen({});
    if (!s.zugang) return Promise.resolve({ ok: true });
    return ruf("/_api/redirects-api/v1/redirect-session", {
      token: s.zugang,
      rumpf: { logout: { clientId: client() } }
    }).then(function () { return { ok: true }; })
      .catch(function () { return { ok: true }; });
  }

  /* ---------- Passwort vergessen ---------- */

  /* Wix schickt die Wiederherstellungspost und braucht dafuer ein Ziel,
     zu dem der Benutzer danach zurueckkehrt. Dieses Ziel muss in der
     Headless-App als Rueckkehradresse EINGETRAGEN sein; ist es das
     nicht, lehnt Wix ab. Genau das sagt die Meldung dann auch — eine
     vage Fehlermeldung schickt den Benutzer sonst auf die falsche
     Suche. */
  function wiederherstellen(post, ziel) {
    return besucherToken().then(function (b) {
      if (!b.ok) return b;
      return ruf("/_api/iam/recovery/v1/send-email", {
        token: b.token,
        rumpf: {
          email: String(post || "").trim(),
          redirect: { url: ziel || location.href.split("#")[0], clientId: client() }
        }
      }).then(function (a) {
        if (a.ok) return { ok: true };
        var m = (a.daten && a.daten.message) || "";
        if (/redirect|uri|url/i.test(m) || a.status === 400) {
          return {
            ok: false,
            fehler: "Die Mitgliederverwaltung kennt die Adresse dieser Website nicht als "
              + "Rückkehrziel. Sie muss dort erst als erlaubte Adresse eingetragen werden."
          };
        }
        return { ok: false, fehler: klartext(a) };
      });
    });
  }

  /* ---------- Gespeicherte Pruefungen ---------- */

  /* Was abgelegt wird, steht hier und nirgends sonst: Adresse, Titel,
     Umfang, die vier Zahlen und die Regelkennungen der Befunde. NICHT
     der Quelltext der geprueften Seite — der kann alles enthalten, und
     niemand hat darum gebeten, ihn fortzugeben. */
  function ausBefund(b) {
    return {
      adresse: String(b.adresse || "").slice(0, 400),
      titel: String(b.titel || "").slice(0, 300),
      umfang: b.umfang === "domain" ? "domain" : "seite",
      wert: Number(b.wert) || 0,
      kritisch: Number(b.kritisch) || 0,
      wichtig: Number(b.wichtig) || 0,
      hinweise: Number(b.hinweise) || 0,
      befunde: { regeln: (b.regeln || []).slice(0, 400) },
      geprueft: { $date: new Date().toISOString() }
    };
  }

  function pruefungSpeichern(befund) {
    return frischerZugang().then(function (z) {
      if (!z.ok) return z;
      return ruf("/wix-data/v2/items", {
        token: z.token,
        rumpf: { dataCollectionId: SAMMLUNG, dataItem: { data: ausBefund(befund || {}) } }
      }).then(function (a) {
        if (!a.ok) return { ok: false, fehler: speicherKlartext(a) };
        return { ok: true, kennung: a.daten && a.daten.dataItem && a.daten.dataItem.id };
      });
    });
  }

  function pruefungenHolen(grenze) {
    return frischerZugang().then(function (z) {
      if (!z.ok) return z;
      return ruf("/wix-data/v2/items/query", {
        token: z.token,
        rumpf: {
          dataCollectionId: SAMMLUNG,
          query: { sort: [{ fieldName: "_createdDate", order: "DESC" }], paging: { limit: Number(grenze) || 50 } }
        }
      }).then(function (a) {
        if (!a.ok) return { ok: false, fehler: speicherKlartext(a) };
        var reihe = (a.daten && a.daten.dataItems) || [];
        return {
          ok: true,
          pruefungen: reihe.map(function (p) {
            var d = p.data || {};
            return {
              kennung: p.id || d._id,
              adresse: d.adresse || "",
              titel: d.titel || "",
              umfang: d.umfang || "seite",
              wert: Number(d.wert) || 0,
              kritisch: Number(d.kritisch) || 0,
              wichtig: Number(d.wichtig) || 0,
              hinweise: Number(d.hinweise) || 0,
              regeln: (d.befunde && d.befunde.regeln) || [],
              geprueft: (d.geprueft && d.geprueft.$date) || d.geprueft || d._createdDate || null
            };
          })
        };
      });
    });
  }

  function pruefungLoeschen(kennung) {
    if (!kennung) return Promise.resolve({ ok: false, fehler: "Ohne Kennung." });
    return frischerZugang().then(function (z) {
      if (!z.ok) return z;
      return ruf("/wix-data/v2/items/" + encodeURIComponent(kennung)
        + "?dataCollectionId=" + encodeURIComponent(SAMMLUNG), {
        art: "DELETE", token: z.token
      }).then(function (a) {
        if (!a.ok) return { ok: false, fehler: speicherKlartext(a) };
        return { ok: true };
      });
    });
  }

  /* Der eine Fehler, der hier wirklich vorkommt und den niemand
     erraten kann: die Sammlung gibt es auf der Wix-Site noch nicht.
     Wer das als „unbekannter Fehler" meldet, schickt den Benutzer auf
     die falsche Suche. */
  function speicherKlartext(a) {
    var m = (a.daten && a.daten.message) || "";
    if (a.status === 404 || /collection.*(not found|does not exist)/i.test(m)) {
      return "Der Ablageort für Prüfungen ist auf der Wix-Site noch nicht angelegt ("
        + SAMMLUNG + "). Anmelden geht, Speichern noch nicht.";
    }
    if (a.status === 403) return "Die Ablage hat den Zugriff abgelehnt.";
    if (a.status === 401) { standSetzen({}); return "Die Anmeldung ist abgelaufen."; }
    return klartext(a);
  }

  return {
    client: client,
    merkenClient: merkenClient,
    istStandardClient: istStandardClient,
    standardClient: CLIENT_STANDARD,
    sammlung: SAMMLUNG,

    angemeldet: angemeldet,
    wer: wer,
    beiWechsel: beiWechsel,

    besucherToken: besucherToken,
    anmelden: anmelden,
    registrieren: registrieren,
    bestaetigen: bestaetigen,
    wiederherstellen: wiederherstellen,
    abmelden: abmelden,

    pruefungSpeichern: pruefungSpeichern,
    pruefungenHolen: pruefungenHolen,
    pruefungLoeschen: pruefungLoeschen
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = SEORANK_KONTO;
