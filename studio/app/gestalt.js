/* Gestalt — in welcher Hand das Studio gezeichnet ist.

   Eigenständig trägt es die Atelier-Gestaltung (Papier, Kupfer, Bodoni).
   Kommt es aus der Konsole von hnvr.me (`?von=hnvr` im Einstieg), trägt es
   die Hand der Konsole — damit wer dort klickt, nicht das Haus wechselt.
   Beides ist dasselbe Programm; nur die Werte in stil.css unterscheiden sich
   (`:root[data-gestalt="hnvr"]`).

   Ein klassisches Skript im Kopf, kein Modul: es muss laufen, bevor die
   Seite zum ersten Mal gezeichnet wird, sonst blitzt die falsche Hand auf.
   Die Wahl gilt für diesen Tab (sessionStorage) — wer in der Konsole
   angekommen ist und im Studio eine Datei öffnet, bleibt in der Konsole.
   Ohne Speicher (privates Fenster, gesperrt) gilt nur die Adresse. */
(function () {
  var gestalt = null;
  try {
    var von = new URLSearchParams(location.search).get('von');
    if (von === 'hnvr' || von === 'atelier') {
      gestalt = von;
      try { sessionStorage.setItem('studio:gestalt', von); } catch (e) { /* ohne Speicher */ }
    } else {
      try { gestalt = sessionStorage.getItem('studio:gestalt'); } catch (e) { gestalt = null; }
    }
  } catch (e) { gestalt = null; }
  if (gestalt === 'hnvr') document.documentElement.setAttribute('data-gestalt', 'hnvr');
})();
