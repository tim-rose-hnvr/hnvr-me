/**
 * Fernauslöser — der Knopf auf dem Handy des Gastes.
 *
 * Am Screen steht ein QR-Code, der hierher führt. Wer ihn abfotografiert,
 * bekommt einen einzigen großen Knopf. Mehr braucht diese Seite nicht: Sie
 * wird im Halbdunkel bedient, mit einer Hand, während die andere jemanden
 * festhält.
 *
 * Ausgelöst wird über die Box. Sie schickt den Auftrag an den Booth und legt
 * dazwischen eine kurze Sperre — sonst hält ein Kind den Finger auf dem Knopf
 * und der Booth kommt nicht mehr zur Ruhe.
 */

import './stil.css';
import './fern.css';

const wurzel = document.getElementById('fern');
if (wurzel) zeichne(wurzel);

function zeichne(ziel: HTMLElement): void {
  const titel = document.createElement('h1');
  titel.textContent = 'Auslösen';

  const zeile = document.createElement('p');
  zeile.className = 'ffliess';
  zeile.textContent = 'Stellt euch vor die Box. Der Countdown läuft am Bildschirm.';

  const knopf = document.createElement('button');
  knopf.className = 'fknopf';
  knopf.type = 'button';
  knopf.textContent = 'Los';

  const meldung = document.createElement('p');
  meldung.className = 'fmeldung';
  meldung.setAttribute('role', 'status');

  let laeuft = false;
  knopf.addEventListener('click', async () => {
    if (laeuft) return;
    laeuft = true;
    knopf.disabled = true;
    meldung.textContent = '';

    try {
      const antwort = await fetch('/api/fern/ausloesen', { method: 'POST' });
      if (antwort.ok) {
        meldung.textContent = 'Läuft — schaut zur Box!';
      } else {
        const daten = (await antwort.json().catch(() => ({}))) as { error?: string };
        meldung.textContent = daten.error || 'Gerade nicht möglich.';
      }
    } catch {
      meldung.textContent = 'Keine Verbindung zur Box. Seid ihr im richtigen WLAN?';
    }

    // Genauso lange gesperrt wie auf der Box — sonst tippt man ins Leere.
    window.setTimeout(() => {
      laeuft = false;
      knopf.disabled = false;
    }, 3000);
  });

  ziel.replaceChildren(titel, zeile, knopf, meldung);
}
