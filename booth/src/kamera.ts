/**
 * Kamera der Box.
 *
 * Heute: die Kamera, die das Betriebssystem meldet (Webcam, Capture-Karte,
 * per Tethering durchgereichte Systemkamera). Der native Weg zu DSLRs
 * (gphoto2, Canon EDSDK) hängt später hinter derselben Schnittstelle —
 * `starte`, `standbild`, `stoppe` bleiben dann unverändert.
 */

export type Kamerafehler = 'verweigert' | 'keine' | 'belegt' | 'unbekannt';

export class Kamera {
  private strom: MediaStream | null = null;
  private video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  get laeuft(): boolean {
    return this.strom !== null;
  }

  /** Auflösung des Live-Bildes, sobald es steht. */
  get groesse(): { breite: number; hoehe: number } {
    return { breite: this.video.videoWidth, hoehe: this.video.videoHeight };
  }

  async starte(): Promise<void> {
    if (this.strom) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('keine');
    }

    this.strom = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
      audio: false,
    });

    this.video.srcObject = this.strom;
    await this.video.play();

    // Erst wenn Maße bekannt sind, lässt sich ein Standbild ziehen.
    if (this.video.videoWidth === 0) {
      await new Promise<void>((fertig) => {
        this.video.addEventListener('loadedmetadata', () => fertig(), { once: true });
      });
    }
  }

  stoppe(): void {
    this.strom?.getTracks().forEach((spur) => spur.stop());
    this.strom = null;
    this.video.srcObject = null;
  }

  /**
   * Standbild aus dem Live-Bild. `spiegeln` dreht es zurück, damit Schrift im
   * Bild lesbar bleibt — der Screen zeigt gespiegelt, der Abzug nicht.
   */
  standbild(spiegeln: boolean): HTMLCanvasElement {
    const breite = this.video.videoWidth || 1280;
    const hoehe = this.video.videoHeight || 720;

    const flaeche = document.createElement('canvas');
    flaeche.width = breite;
    flaeche.height = hoehe;

    const stift = flaeche.getContext('2d');
    if (!stift) throw new Error('Zeichenfläche nicht verfügbar');

    if (spiegeln) {
      stift.translate(breite, 0);
      stift.scale(-1, 1);
    }
    stift.drawImage(this.video, 0, 0, breite, hoehe);
    return flaeche;
  }
}

/** Übersetzt Browser-Fehler in etwas, das am Screen stehen darf. */
export function deuteFehler(fehler: unknown): { art: Kamerafehler; text: string } {
  const name = fehler instanceof Error ? fehler.name || fehler.message : String(fehler);

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        art: 'verweigert',
        text: 'Die Kamera ist nicht freigegeben. In der Einrichtung die Freigabe erteilen.',
      };
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'keine':
      return {
        art: 'keine',
        text: 'Keine Kamera gefunden. Kabel prüfen, dann in den Einstellungen erneut suchen.',
      };
    case 'NotReadableError':
    case 'AbortError':
      return {
        art: 'belegt',
        text: 'Die Kamera ist von einem anderen Programm belegt. Programm schließen und erneut versuchen.',
      };
    default:
      return { art: 'unbekannt', text: 'Die Kamera meldet einen Fehler. Details im Protokoll.' };
  }
}
