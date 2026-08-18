import re, os, json

namen = (
    # Die Verkaufsseiten
    "arrow-right badge-check bar-chart-3 battery-full building-2 calendar-heart camera check "
    "contact-round download file-spreadsheet git-branch globe grid-2x2 hammer image images inbox "
    "instagram link linkedin lock mail map-pin message-circle message-circle-heart nfc palette "
    "phone plus qr-code quote repeat rss share-2 shield-check sliders-horizontal smartphone-nfc "
    "sparkles star stethoscope users-round wand-sparkles wifi x youtube "
    # Dazu die App-Screens aus `GetInTouch Mockups.dc.html`
    "arrow-left arrow-up-right arrow-up-to-line calendar calendar-plus circle-check eye eye-off "
    "grip-vertical message-circle-question monitor moon newspaper send shopping-bag smartphone "
    "timer user-round"
).split()

quelle = 'node_modules/lucide-static/icons'

# Lucide hat einige Namen umbenannt. Der Prototyp nennt die alten; die Form ist
# dieselbe geblieben.
UMBENANNT = {'bar-chart-3': 'chart-column'}
eintraege = []
fehlt = []
for n in sorted(namen):
    p = os.path.join(quelle, UMBENANNT.get(n, n) + '.svg')
    if not os.path.exists(p):
        fehlt.append(n); continue
    t = open(p, encoding='utf-8').read()
    # Lizenzkommentar weg, dann alles zwischen dem Ende des oeffnenden
    # <svg …>-Tags und </svg>. Der Tag steht mehrzeilig, deshalb erst der
    # Kommentar raus und dann gezielt auf '<svg' aufsetzen.
    t = re.sub(r'<!--.*?-->', '', t, flags=re.S)
    auf = t.index('<svg')
    inhalt_ab = t.index('>', auf) + 1
    inner = t[inhalt_ab:t.rindex('</svg>')]
    inner = re.sub(r'\s+', ' ', inner).strip()
    eintraege.append((n, inner))

if fehlt:
    raise SystemExit('fehlen: ' + ', '.join(fehlt))

kopf = '''/**
 * Die Lucide-Zeichen aus dem Design-Handoff.
 *
 * Der Prototyp lädt Lucide von `unpkg.com` nach und ersetzt `<i data-lucide>`
 * im Browser. Das geht hier nicht: kein Fremdaufruf im Browser, das ist eine
 * der Zusagen auf der Startseite. Deshalb liegen die Pfade hier — erzeugt aus
 * `lucide-static` in derselben Fassung 0.446.0, die der Prototyp verlangt,
 * und danach ist das Paket nicht mehr nötig.
 *
 * Erzeugt, nicht von Hand geschrieben. Wer ein Zeichen ergänzen will, nimmt
 * `werkzeug/lucide-holen.py` und trägt den Namen dort ein.
 *
 * Lizenz der Pfaddaten: ISC, Lucide Contributors.
 */

/** Strichstärke 2, wie im Handoff festgelegt. Gefüllt ist nur der Stern. */
export type Lucidename =
'''

zeilen = [kopf]
zeilen.append('\n'.join(f"  | '{n}'" for n, _ in eintraege) + ';\n')
zeilen.append('\nconst PFADE: Record<Lucidename, string> = {\n')
for n, inner in eintraege:
    zeilen.append(f"  '{n}': {json.dumps(inner, ensure_ascii=False)},\n")
zeilen.append('};\n')
zeilen.append('''
/**
 * Ein Zeichen als SVG.
 *
 * `groesse` folgt dem Handoff: 14 px in Pillen, 18 px in Listen, 22 px in
 * Kartenköpfen. `gefuellt` gibt es nur für den Stern.
 */
export function lucide(name: Lucidename, groesse = 18, gefuellt = false): string {
  const fuellung = gefuellt ? 'currentColor' : 'none';
  return (
    `<svg class="ic" width="${groesse}" height="${groesse}" viewBox="0 0 24 24" ` +
    `fill="${fuellung}" stroke="currentColor" stroke-width="2" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true" focusable="false">${PFADE[name]}</svg>`
  );
}
''')

open('src/kern/lucide.ts', 'w', encoding='utf-8').write(''.join(zeilen))
print('geschrieben:', len(eintraege), 'Zeichen')
