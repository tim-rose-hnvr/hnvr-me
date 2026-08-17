/**
 * Die Abgabe ist der einzige Weg, auf dem ein Entwurf heute bei uns ankommt.
 * Fehlt in der Mail der Link, ist die Arbeit des Kunden weg — und weil
 * Mailprogramme lange Adressen stillschweigend abschneiden, muss die Grenze
 * geprüft sein und nicht geschätzt.
 */

import { ok, strictEqual } from 'node:assert';
import { describe, it } from 'node:test';

import { abgabeAdresse, abgabeBetreff, abgabeRumpf, linkPasst, MAILTO_GRENZE, POSTFACH } from '../src/kern/abgabe.ts';
import { musterprofil } from '../src/kern/muster.ts';
import { packe } from '../src/kern/packung.ts';

const HERKUNFT = 'https://getintouch.hnvr.me';

async function vorschauLink(profil = musterprofil()): Promise<string> {
  return `${HERKUNFT}/werkstatt/vorschau?p=${await packe(profil)}`;
}

describe('Abgabe', () => {
  it('nennt Empfänger, Betreff und Adresse des Entwurfs', async () => {
    const profil = musterprofil();
    const link = await vorschauLink(profil);
    const adresse = new URL(abgabeAdresse(profil, 'link', link));

    strictEqual(adresse.protocol, 'mailto:');
    strictEqual(adresse.pathname, POSTFACH);
    strictEqual(adresse.searchParams.get('subject'), abgabeBetreff(profil));
    ok(abgabeBetreff(profil).includes(profil.slug));

    const rumpf = adresse.searchParams.get('body')!;
    ok(rumpf.includes(`/t/${profil.slug}`), 'die gewünschte Adresse fehlt');
    ok(rumpf.includes(link), 'der Vorschau-Link fehlt');
    ok(rumpf.includes(profil.kopf.name), 'der Absender fehlt');
  });

  it('trägt einen üblichen Entwurf in der Adresszeile', async () => {
    const profil = musterprofil();
    const link = await vorschauLink(profil);
    ok(linkPasst(profil, link), 'das Musterprofil passt nicht mehr in eine Mail');
    ok(abgabeAdresse(profil, 'link', link).length <= MAILTO_GRENZE);
  });

  it('erkennt einen Link, der die Grenze reißt', () => {
    const profil = musterprofil();
    const zulang = `${HERKUNFT}/werkstatt/vorschau?p=${'A'.repeat(MAILTO_GRENZE)}`;
    ok(!linkPasst(profil, zulang));
  });

  /* Bricht der Link weg, darf in der Mail keine Lücke stehen, sondern muss der
     Ausweichweg benannt sein — sonst schickt jemand eine leere Bitte ab. */
  it('sagt bei jedem Ausweichweg, wo der Entwurf steckt', async () => {
    const profil = musterprofil();
    const link = await vorschauLink(profil);

    const ablage = abgabeRumpf(profil, 'ablage', link);
    ok(!ablage.includes(link));
    ok(/Zwischenablage/.test(ablage));

    const datei = abgabeRumpf(profil, 'datei', link);
    ok(!datei.includes(link));
    ok(/Datei/.test(datei) && /anhängen/.test(datei));
  });

  it('bleibt auch beim Ausweichen weit unter der Grenze', async () => {
    const profil = musterprofil();
    const link = await vorschauLink(profil);
    for (const weg of ['ablage', 'datei'] as const) {
      ok(abgabeAdresse(profil, weg, link).length < 600, `Ausweichweg ${weg} ist zu lang`);
    }
  });
});
