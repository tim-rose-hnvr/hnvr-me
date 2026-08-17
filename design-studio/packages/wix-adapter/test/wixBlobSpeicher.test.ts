import { describe, expect, it, vi } from 'vitest';
import { SpeicherFehler, WixBlobSpeicher } from '../src/index.js';
import { MedienDoppelgaenger, mandant } from './doppelgaenger.js';

function antwort(koerper: unknown, status = 200): Response {
  return new Response(JSON.stringify(koerper), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('WixBlobSpeicher.schreibe', () => {
  it('holt eine Upload-URL und lädt dorthin hoch', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = vi.fn(async () => antwort({ file: { id: 'f-1', url: 'https://static/f-1' } }));
    const speicher = new WixBlobSpeicher(medien, { netz: netz as unknown as typeof fetch });

    const datei = await speicher.schreibe(
      mandant,
      'entwurf.json',
      'application/json',
      new Blob(['{}']),
    );

    expect(datei).toEqual({ id: 'f-1', url: 'https://static/f-1' });
    expect(medien.aufrufe[0]?.mimeType).toBe('application/json');
    expect(netz).toHaveBeenCalledWith(
      'https://upload.example/1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('legt Kundendateien privat und mit Organisationsetikett ab', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = vi.fn(async () => antwort({ file: { id: 'f-1', url: 'https://static/f-1' } }));
    const speicher = new WixBlobSpeicher(medien, { netz: netz as unknown as typeof fetch });

    await speicher.schreibe(mandant, 'logo.png', 'image/png', new Blob(['x']));

    expect(medien.aufrufe[0]?.optionen).toMatchObject({
      private: true,
      labels: ['org:org-1'],
      fileName: 'logo.png',
    });
  });

  it('reicht den Ordner je Organisation durch, wenn einer festgelegt ist', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = vi.fn(async () => antwort({ file: { id: 'f-1', url: 'https://static/f-1' } }));
    const speicher = new WixBlobSpeicher(medien, {
      netz: netz as unknown as typeof fetch,
      ordnerFuer: (m) => `ordner-${m.organisationId}`,
    });

    await speicher.schreibe(mandant, 'logo.png', 'image/png', new Blob(['x']));

    expect(medien.aufrufe[0]?.optionen).toMatchObject({ parentFolderId: 'ordner-org-1' });
  });

  it('meldet einen abgelehnten Upload mit Statuscode', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = vi.fn(async () => new Response('nope', { status: 413, statusText: 'Too Large' }));
    const speicher = new WixBlobSpeicher(medien, { netz: netz as unknown as typeof fetch });

    await expect(
      speicher.schreibe(mandant, 'gross.png', 'image/png', new Blob(['x'])),
    ).rejects.toThrow(/413 Too Large/);
  });

  it('meldet eine Antwort ohne Dateikennung, statt sie zu erfinden', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = vi.fn(async () => antwort({ ok: true }));
    const speicher = new WixBlobSpeicher(medien, { netz: netz as unknown as typeof fetch });

    await expect(
      speicher.schreibe(mandant, 'x.png', 'image/png', new Blob(['x'])),
    ).rejects.toThrow(SpeicherFehler);
  });
});

describe('WixBlobSpeicher.liesText', () => {
  it('liest über die beim Schreiben gemerkte URL', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = vi.fn(async (ziel: string | URL | Request) => {
      if (String(ziel).startsWith('https://upload.example')) {
        return antwort({ file: { id: 'f-1', url: 'https://static/f-1' } });
      }
      return new Response('{"a":1}', { status: 200 });
    });
    const speicher = new WixBlobSpeicher(medien, { netz: netz as unknown as typeof fetch });

    await speicher.schreibe(mandant, 'a.json', 'application/json', new Blob(['{"a":1}']));

    expect(await speicher.liesText('f-1')).toBe('{"a":1}');
    expect(netz).toHaveBeenLastCalledWith('https://static/f-1');
  });

  it('meldet eine nicht lesbare Datei mit Statuscode', async () => {
    const medien = new MedienDoppelgaenger();
    const netz = vi.fn(async () => new Response('', { status: 404, statusText: 'Not Found' }));
    const speicher = new WixBlobSpeicher(medien, { netz: netz as unknown as typeof fetch });

    await expect(speicher.liesText('https://static/weg')).rejects.toThrow(/404 Not Found/);
  });
});
