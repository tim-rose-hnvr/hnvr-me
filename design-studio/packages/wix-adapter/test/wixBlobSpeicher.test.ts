import { describe, expect, it, vi } from 'vitest';
import { SpeicherFehler, WixBlobSpeicher } from '../src/index.js';
import { BEFRISTET, DAUERHAFT, MedienDoppelgaenger, mandant } from './doppelgaenger.js';

function jsonAntwort(koerper: unknown, status = 200): Response {
  return new Response(JSON.stringify(koerper), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Netz, das sich wie Wix bei privaten Dateien verhält: der Upload klappt, die
 * dauerhafte URL antwortet mit **403**, nur eine befristete Download-URL liefert
 * den Inhalt. Genau dieses Verhalten fehlte im ersten Anlauf — der Adapter las
 * über die dauerhafte URL und wäre in Produktion immer gescheitert.
 */
function wixAehnlichesNetz(inhalt = '{"a":1}') {
  return vi.fn(async (ziel: string | URL | Request) => {
    const adresse = String(ziel);
    if (adresse.startsWith('https://upload.example')) {
      return jsonAntwort({ file: { id: 'f-1', url: `${DAUERHAFT}f-1/entwurf.json` } });
    }
    if (adresse.startsWith(DAUERHAFT)) {
      return new Response('Forbidden', { status: 403, statusText: 'Forbidden' });
    }
    if (adresse.startsWith(BEFRISTET)) {
      return new Response(inhalt, { status: 200 });
    }
    return new Response('', { status: 404, statusText: 'Not Found' });
  });
}

function aufbau(netz = wixAehnlichesNetz()) {
  const medien = new MedienDoppelgaenger();
  const speicher = new WixBlobSpeicher(medien, { netz: netz as unknown as typeof fetch });
  return { medien, netz, speicher };
}

describe('schreibe', () => {
  it('holt eine Upload-URL und lädt dorthin hoch', async () => {
    const { medien, netz, speicher } = aufbau();

    const referenz = await speicher.schreibe(
      mandant,
      'entwurf.json',
      'application/json',
      new Blob(['{}']),
    );

    expect(referenz.id).toBe('f-1');
    expect(medien.aufrufe[0]?.mimeType).toBe('application/json');
    expect(netz).toHaveBeenCalledWith(
      'https://upload.example/1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('legt Kundendateien privat und mit Organisationsetikett ab', async () => {
    const { medien, speicher } = aufbau();

    await speicher.schreibe(mandant, 'logo.png', 'image/png', new Blob(['x']));

    expect(medien.aufrufe[0]?.optionen).toMatchObject({
      private: true,
      labels: ['org:org-1'],
      fileName: 'logo.png',
    });
  });

  it('reicht den Ordner je Organisation durch, wenn einer festgelegt ist', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = wixAehnlichesNetz();
    const speicher = new WixBlobSpeicher(medien, {
      netz: netz as unknown as typeof fetch,
      ordnerFuer: (m) => `ordner-${m.organisationId}`,
    });

    await speicher.schreibe(mandant, 'logo.png', 'image/png', new Blob(['x']));

    expect(medien.aufrufe[0]?.optionen).toMatchObject({ parentFolderId: 'ordner-org-1' });
  });

  it('meldet einen abgelehnten Upload mit Statuscode', async () => {
    const netz = vi.fn(async () => new Response('nope', { status: 413, statusText: 'Too Large' }));
    const { speicher } = aufbau(netz as unknown as ReturnType<typeof wixAehnlichesNetz>);

    await expect(
      speicher.schreibe(mandant, 'gross.png', 'image/png', new Blob(['x'])),
    ).rejects.toThrow(/413 Too Large/);
  });

  it('meldet eine Antwort ohne Dateikennung, statt sie zu erfinden', async () => {
    const netz = vi.fn(async () => jsonAntwort({ ok: true }));
    const { speicher } = aufbau(netz as unknown as ReturnType<typeof wixAehnlichesNetz>);

    await expect(speicher.schreibe(mandant, 'x.png', 'image/png', new Blob(['x']))).rejects.toThrow(
      SpeicherFehler,
    );
  });
});

describe('liesText', () => {
  it('liest über eine befristete Download-URL, nicht über die dauerhafte', async () => {
    const { medien, netz, speicher } = aufbau(wixAehnlichesNetz('{"gelesen":true}'));

    const referenz = await speicher.schreibe(
      mandant,
      'a.json',
      'application/json',
      new Blob(['{"gelesen":true}']),
    );
    const inhalt = await speicher.liesText(referenz);

    expect(inhalt).toBe('{"gelesen":true}');
    expect(medien.downloadAufrufe[0]?.fileId).toBe('f-1');
    // Die dauerhafte URL darf gar nicht erst angefragt worden sein.
    const angefragt = netz.mock.calls.map((c) => String(c[0]));
    expect(angefragt.some((a) => a.startsWith(DAUERHAFT))).toBe(false);
  });

  it('funktioniert ohne den Zustand des schreibenden Objekts', async () => {
    // Der Fall nach einem Seitenneuladen: nur der gespeicherte Verweis ist da,
    // kein Gedächtnis aus dem Upload. Ein Zwischenspeicher im Objekt hätte hier
    // funktioniert und wäre in Produktion trotzdem gescheitert.
    const { speicher: schreibender } = aufbau();
    const referenz = await schreibender.schreibe(
      mandant,
      'a.json',
      'application/json',
      new Blob(['{"a":1}']),
    );

    const { speicher: frischer } = aufbau();
    expect(await frischer.liesText(referenz)).toBe('{"a":1}');
  });

  it('öffnet die Datei im Browser statt sie herunterzuladen', async () => {
    const { medien, speicher } = aufbau();
    await speicher.liesText({ id: 'f-9', url: '' });

    expect(medien.downloadAufrufe[0]?.optionen).toMatchObject({ contentDisposition: 'INLINE' });
  });

  it('reicht eine eingestellte Gültigkeitsdauer durch', async () => {
    const medien = new MedienDoppelgaenger();
    const speicher = new WixBlobSpeicher(medien, {
      netz: wixAehnlichesNetz() as unknown as typeof fetch,
      gueltigkeitMinuten: 15,
    });

    await speicher.liesText({ id: 'f-9', url: '' });

    expect(medien.downloadAufrufe[0]?.optionen).toMatchObject({ expirationInMinutes: 15 });
  });

  it('erklärt einen 403 statt ihn nur durchzureichen', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = vi.fn(async () => new Response('', { status: 403, statusText: 'Forbidden' }));
    const speicher = new WixBlobSpeicher(medien, { netz: netz as unknown as typeof fetch });

    await expect(speicher.liesText({ id: 'f-1', url: '' })).rejects.toThrow(/befristete/);
  });

  it('weist eine Referenz ohne id ab', async () => {
    const { speicher } = aufbau();
    await expect(speicher.liesText({ id: '', url: 'https://irgendwo' })).rejects.toThrow(/ohne id/);
  });

  it('nennt den Ausweg, wenn der Client keine Download-URL ausstellen kann', async () => {
    const medien = new MedienDoppelgaenger();
    medien.kannDownloadUrl = false;
    const speicher = new WixBlobSpeicher(medien, {
      netz: wixAehnlichesNetz() as unknown as typeof fetch,
    });

    await expect(speicher.liesText({ id: 'f-1', url: '' })).rejects.toThrow(
      /Download-URL für "f-1" nicht erhalten/,
    );
  });

  it('benutzt einen eigenen Auflöser, wenn einer übergeben wurde', async () => {
    const medien = new MedienDoppelgaenger();
    const aufloeser = vi.fn(async (id: string) => `${BEFRISTET}${id}?eigener=1`);
    const speicher = new WixBlobSpeicher(medien, {
      netz: wixAehnlichesNetz('eigen') as unknown as typeof fetch,
      downloadUrlAufloeser: aufloeser,
    });

    expect(await speicher.liesText({ id: 'f-7', url: '' })).toBe('eigen');
    expect(aufloeser).toHaveBeenCalledWith('f-7');
    expect(medien.downloadAufrufe).toHaveLength(0);
  });

  it('meldet eine nicht lesbare Datei mit Statuscode', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = vi.fn(async () => new Response('', { status: 404, statusText: 'Not Found' }));
    const speicher = new WixBlobSpeicher(medien, { netz: netz as unknown as typeof fetch });

    await expect(speicher.liesText({ id: 'f-1', url: '' })).rejects.toThrow(/404 Not Found/);
  });
});
