/**
 * Die Belebung der Verkaufsseiten.
 *
 * Fünf Dinge, alle klein, alle abschaltbar:
 *
 * 1. **Einblenden beim Scrollen** — Abschnitte steigen auf, sobald sie ins
 *    Bild kommen. Dieselbe Bewegung wie `gtRise`, nur später ausgelöst.
 * 2. **Vorlagen-Schieber** — die Anrisse laufen als Schlitten mit Punkten,
 *    Pfeilen, Wischen und einem Selbstlauf, der beim Berühren anhält.
 * 3. **Live-Vorschau** — was im Handle-Feld steht, steht sofort im Gerät.
 * 4. **vCard-Schalter** — die Felder lassen sich wirklich umlegen, die
 *    Handy-Vorschau daneben zeigt die Folge.
 * 5. **Preisumschalter** — monatlich oder jährlich, mit gerechneten Zahlen.
 *
 * Wer „Bewegung reduzieren" eingeschaltet hat, bekommt alle Inhalte sofort
 * und ohne Selbstlauf. Das ist keine Höflichkeit, sondern der Unterschied
 * zwischen benutzbar und unbenutzbar.
 */

const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* --- 1. Einblenden beim Scrollen -------------------------- */

function einblenden(): void {
  const ziele = document.querySelectorAll<HTMLElement>('[data-auf]');
  if (!ziele.length) return;

  if (ruhig || !('IntersectionObserver' in window)) {
    ziele.forEach((z) => z.classList.add('auf--da'));
    return;
  }

  const beobachter = new IntersectionObserver(
    (eintraege) => {
      for (const e of eintraege) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('auf--da');
        beobachter.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
  );

  ziele.forEach((z) => beobachter.observe(z));
}

/* --- 2. Vorlagen-Schieber --------------------------------- */

function schieber(): void {
  const wurzel = document.querySelector<HTMLElement>('[data-schieber]');
  if (!wurzel) return;

  const bahn = wurzel.querySelector<HTMLElement>('.schieber__bahn');
  if (!bahn) return;
  const punkte = Array.from(wurzel.querySelectorAll<HTMLElement>('.schieber__punkt'));
  const zurueck = wurzel.querySelector<HTMLElement>('[data-zurueck]');
  const vor = wurzel.querySelector<HTMLElement>('[data-vor]');

  const karten = Array.from(bahn.children) as HTMLElement[];
  if (!karten.length) return;

  /* Wie viele Karten nebeneinander stehen, entscheidet das Raster — also
     nicht raten, sondern messen. */
  const proBild = () => {
    const b = karten[0]!.getBoundingClientRect().width + 16;
    return Math.max(1, Math.round(bahn.clientWidth / b));
  };

  const seiten = () => Math.max(1, Math.ceil(karten.length / proBild()));
  let seite = 0;

  const zeigen = (n: number, sanft = true): void => {
    const max = seiten() - 1;
    seite = n < 0 ? max : n > max ? 0 : n;
    const ziel = karten[seite * proBild()];
    if (!ziel) return;
    bahn.scrollTo({ left: ziel.offsetLeft - bahn.offsetLeft, behavior: sanft && !ruhig ? 'smooth' : 'auto' });
    punkte.forEach((p, i) => p.classList.toggle('schieber__punkt--hier', i === seite));
  };

  /* Die Punkte richten sich nach der Zahl der Seiten, nicht der Karten. */
  const punkteAnpassen = (): void => {
    const n = seiten();
    punkte.forEach((p, i) => {
      p.hidden = i >= n;
    });
    if (seite >= n) zeigen(0, false);
  };

  punkte.forEach((p, i) => p.addEventListener('click', () => zeigen(i)));
  zurueck?.addEventListener('click', () => zeigen(seite - 1));
  vor?.addEventListener('click', () => zeigen(seite + 1));

  /* Wer selbst wischt, führt — die Punkte laufen mit. */
  let stillstand: number | undefined;
  bahn.addEventListener('scroll', () => {
    window.clearTimeout(stillstand);
    stillstand = window.setTimeout(() => {
      const b = karten[0]!.getBoundingClientRect().width + 16;
      seite = Math.round(bahn.scrollLeft / (b * proBild()));
      punkte.forEach((p, i) => p.classList.toggle('schieber__punkt--hier', i === seite));
    }, 120);
  });

  window.addEventListener('resize', punkteAnpassen);
  punkteAnpassen();

  /* Selbstlauf — hält an, sobald jemand hinsieht oder anfasst, und läuft
     gar nicht erst, wenn Bewegung reduziert ist. */
  if (ruhig) return;
  let uhr = window.setInterval(() => zeigen(seite + 1), 5200);
  const anhalten = () => window.clearInterval(uhr);
  const weiter = () => {
    anhalten();
    uhr = window.setInterval(() => zeigen(seite + 1), 5200);
  };
  wurzel.addEventListener('pointerenter', anhalten);
  wurzel.addEventListener('pointerleave', weiter);
  wurzel.addEventListener('focusin', anhalten);
  document.addEventListener('visibilitychange', () => (document.hidden ? anhalten() : weiter()));
}

/* --- 3. Live-Vorschau im Gerät ---------------------------- */

function handleVorschau(): void {
  const feld = document.querySelector<HTMLInputElement>('.handle__feld');
  const ziel = document.querySelector<HTMLElement>('[data-handle]');
  if (!feld || !ziel) return;

  const saeubern = (roh: string) =>
    roh
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .slice(0, 24);

  feld.addEventListener('input', () => {
    const wert = saeubern(feld.value);
    ziel.textContent = wert || 'deinname';
    if (!ruhig && wert) {
      ziel.classList.remove('an-pop');
      void ziel.offsetWidth;
      ziel.classList.add('an-pop');
    }
  });
}

/* --- 4. vCard-Schalter ------------------------------------ */

function vcardSchalter(): void {
  const zeilen = document.querySelectorAll<HTMLButtonElement>('[data-feld]');
  if (!zeilen.length) return;

  zeilen.forEach((zeile) => {
    zeile.addEventListener('click', () => {
      const an = zeile.getAttribute('aria-pressed') === 'true';
      zeile.setAttribute('aria-pressed', String(!an));
      zeile.querySelector('.schalter')?.classList.toggle('schalter--aus', an);

      const name = zeile.dataset.feld;
      document.querySelectorAll<HTMLElement>(`[data-zeigt="${name}"]`).forEach((el) => {
        el.hidden = an;
        if (!an && !ruhig) {
          el.classList.remove('an-pop');
          void el.offsetWidth;
          el.classList.add('an-pop');
        }
      });
    });
  });
}

/* --- 5. Preisumschalter ----------------------------------- */

function preistakt(): void {
  const leiste = document.querySelector<HTMLElement>('[data-takt]');
  if (!leiste) return;

  const knoepfe = Array.from(leiste.querySelectorAll<HTMLButtonElement>('button'));
  const preise = Array.from(document.querySelectorAll<HTMLElement>('[data-monat]'));

  const setzen = (jaehrlich: boolean): void => {
    knoepfe.forEach((k) => k.classList.toggle('takt__hier', k.dataset.wahl === (jaehrlich ? 'jahr' : 'monat')));
    for (const p of preise) {
      const monat = Number(p.dataset.monat ?? '0');
      /* Jährlich heißt: zwei Monate geschenkt. Also zehn zahlen, zwölf
         nutzen — und der angezeigte Monatspreis ist ein Zwölftel davon. */
      const wert = jaehrlich ? (monat * 10) / 12 : monat;
      p.textContent = wert === 0 ? '0' : wert.toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
      const takt = p.parentElement?.querySelector<HTMLElement>('.plan__takt');
      if (takt) takt.textContent = jaehrlich ? '€ / Monat, jährlich' : '€ / Monat';
    }
  };

  knoepfe.forEach((k) => k.addEventListener('click', () => setzen(k.dataset.wahl === 'jahr')));
  setzen(false);
}

einblenden();
schieber();
handleVorschau();
vcardSchalter();
preistakt();
