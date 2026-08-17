/**
 * Die Packung trägt einen ganzen Entwurf durch die Adresszeile. Geht dabei
 * etwas verloren, zeigt die Vorschau etwas anderes als der Editor — der
 * schlimmste Fehler, den ein Werkzeug mit Vorschau machen kann.
 */

import { deepStrictEqual, ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { entpacke, packe } from '../src/kern/packung.ts';
import { lieseProfil } from '../src/kern/profil.ts';

const PROFIL = {
  slug: 'muster',
  kopf: { name: 'Müller & Söhne', rolle: 'Dachdeckerei · Seelze', beschreibung: 'Erste Zeile\nZweite Zeile' },
  bloecke: [
    { id: 'a', art: 'aktion', kanal: 'telefon', beschriftung: 'Anrufen', ziel: '+4951112282286', aktiv: true },
    { id: 'b', art: 'aktion', kanal: 'whatsapp', beschriftung: 'WhatsApp', ziel: '+4917683025781', aktiv: true },
  ],
  kanaele: [{ netzwerk: 'instagram', ziel: 'mueller' }],
  erreichbarkeit: { zeitzone: 'Europe/Berlin', fenster: [{ tag: 1, von: '07:00', bis: '16:00' }] },
  gestaltung: { vorlage: 'papier', akzent: '#B23A0C' },
};

describe('Packung', () => {
  it('gibt heraus, was hineingegangen ist', async () => {
    deepStrictEqual(await entpacke(await packe(PROFIL)), PROFIL);
  });

  it('übersteht Umlaute und Zeilenumbrüche', async () => {
    const wert = { text: 'Ötzi Müller-Lüdenscheidt\nZweite Zeile\tTab „Anführung" 😀' };
    deepStrictEqual(await entpacke(await packe(wert)), wert);
  });

  it('erzeugt nur Zeichen, die in einer Adresse nichts anrichten', async () => {
    const gepackt = await packe(PROFIL);
    ok(/^[a-z][A-Za-z0-9_-]+$/.test(gepackt), gepackt.slice(0, 40));
    strictEqual(encodeURIComponent(gepackt), gepackt, 'muss ohne Kodierung in die Adresse passen');
  });

  it('bleibt bei einem vollen Profil weit unter der Adressgrenze', async () => {
    // Ein Profil mit zwölf Blöcken, Visitenkarte und Öffnungszeiten ist das,
    // was in der Praxis entsteht. Zwischenserver schneiden Adressen gern bei
    // 8 kB ab; alles unter 2 kB ist unbedenklich.
    const voll = {
      ...PROFIL,
      bloecke: Array.from({ length: 12 }, (_, i) => ({
        id: `b${i}`,
        art: 'aktion',
        kanal: 'link',
        beschriftung: `Sehr ausführliche Beschriftung Nummer ${i}`,
        unterzeile: 'Eine Unterzeile, die auch etwas länger ausfällt',
        ziel: `https://hnvr.me/seite-${i}`,
        aktiv: true,
      })),
      visitenkarte: {
        vorname: 'Tim', nachname: 'Rose', firma: 'hnvr.me · viel Liebe Media UG', funktion: 'Inhaber',
        telefon: '+49 511 12282286', mobil: '+49 176 83025781', mail: 'tim@hnvr.me',
        strasse: 'Am Bahnhof 8', plz: '30926', ort: 'Seelze', land: 'Deutschland',
      },
    };

    const roh = JSON.stringify(voll).length;
    const gepackt = (await packe(voll)).length;

    ok(gepackt < 2000, `${gepackt} Zeichen — zu lang für eine Adresse`);
    ok(gepackt < roh * 0.6, `${gepackt} von ${roh} Zeichen — zu wenig gespart`);
  });

  it('spart bei kurzen Datensätzen wenig — base64 kostet ein Drittel', async () => {
    // Absichtlich festgehalten: bei wenigen hundert Byte frisst die Kodierung
    // den Gewinn fast auf. Das ist in Ordnung, solange es niemanden überrascht.
    const kurz = { a: 1 };
    ok((await packe(kurz)).length < 40);
  });

  it('gibt bei Beschädigung null zurück, statt zu werfen', async () => {
    strictEqual(await entpacke(''), null);
    strictEqual(await entpacke('x-kein-kennzeichen'), null);
    strictEqual(await entpacke('zGARNICHTBASE64!!!'), null);
    const gepackt = await packe(PROFIL);
    strictEqual(await entpacke(gepackt.slice(0, gepackt.length - 12)), null);
  });

  it('liefert ein Profil, das die Prüfung besteht', async () => {
    const zurueck = await entpacke(await packe(PROFIL));
    const ergebnis = lieseProfil(zurueck);
    ok(ergebnis.ok, JSON.stringify((ergebnis as { fehler?: unknown }).fehler));
    strictEqual(ergebnis.profil.kopf.name, 'Müller & Söhne');
    strictEqual(ergebnis.profil.gestaltung.akzent, '#B23A0C');
  });
});
