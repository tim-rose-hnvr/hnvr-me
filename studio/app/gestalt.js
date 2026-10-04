/* Gestalt und Herkunft — in welcher Hand das Studio gezeichnet ist und ob
   es aus der Konsole von hnvr.me kommt.

   Das Studio trägt die Atelier-Gestaltung (Papier, Kupfer, Bodoni) — auch,
   wenn es aus der Konsole von hnvr.me geöffnet wird. Die Herkunft
   (`?von=hnvr` im Einstieg) zeigt nur den Rückweg „Konsole / PDF Studio"
   (app/anmeldung.js), sie zieht dem Studio keine andere Hand an: so steht es
   im Entwurf, und so hat es der Inhaber entschieden.

   Die Hand der Konsole gibt es weiter, ausdrücklich gewählt mit
   `?gestalt=hnvr` (zurück mit `?gestalt=atelier`). Beides ist dasselbe
   Programm; nur die Werte in stil.css unterscheiden sich
   (`:root[data-gestalt="hnvr"]`).

   Ein klassisches Skript im Kopf, kein Modul: es muss laufen, bevor die
   Seite zum ersten Mal gezeichnet wird, sonst blitzt die falsche Hand auf.
   Beides gilt für diesen Tab (sessionStorage) — wer aus der Konsole kam und
   im Studio eine Datei öffnet, behält den Rückweg. Ohne Speicher (privates
   Fenster, gesperrt) gilt nur die Adresse. Der Schlüssel heißt „studio:hand“
   und nicht mehr „studio:gestalt“: unter dem alten stand bis Oktober 2026 die
   Herkunft, und ein noch offener Tab soll nicht in der alten Hand bleiben. */
(function () {
  function merke(schluessel, werte, wert) {
    if (werte.indexOf(wert) > -1) {
      try { sessionStorage.setItem(schluessel, wert); } catch (e) { /* ohne Speicher */ }
      return wert;
    }
    try { return sessionStorage.getItem(schluessel); } catch (e) { return null; }
  }
  var suche = null;
  try { suche = new URLSearchParams(location.search); } catch (e) { suche = null; }
  var herkunft = merke('studio:herkunft', ['hnvr', 'selbst'], suche && suche.get('von'));
  var gestalt = merke('studio:hand', ['hnvr', 'atelier'], suche && suche.get('gestalt'));
  if (herkunft === 'hnvr') document.documentElement.setAttribute('data-herkunft', 'hnvr');
  if (gestalt === 'hnvr') document.documentElement.setAttribute('data-gestalt', 'hnvr');
})();
