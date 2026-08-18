/* Youbooth – Hashtag-Drucker: Beiträge aus dem Netz an die Box holen.
 *
 * Gäste posten mit einem verabredeten Hashtag, die Box holt die Bilder und
 * druckt sie. Drei Quellen, weil es *die eine* nicht gibt:
 *
 *   mastodon   Öffentliche Hashtag-Zeitleiste. **Braucht keinen Schlüssel** —
 *              deshalb ist das die Quelle, die sofort funktioniert und mit der
 *              sich der ganze Weg auch prüfen lässt.
 *   instagram  Graph-API. Funktioniert nur mit einem Meta-Business-Konto und
 *              einem geprüften Zugriffstoken. Der Code liegt hier bereit; ohne
 *              Token sagt er das offen, statt so zu tun als ginge es.
 *   endpunkt   Irgendein Dienst, der eine JSON-Liste liefert. Für alles, was
 *              ein Betreiber schon hat.
 *
 * ★ Was hier NICHT passiert: automatisch drucken, was das Internet schickt.
 *   Standardmäßig landet jeder Beitrag in einer Freigabeliste. Ein Drucker,
 *   der ungefiltert alles ausgibt, was unter einem Hashtag auftaucht, ist auf
 *   einer Hochzeit keine Funktion, sondern ein Haftungsfall.
 */

const https = require('https');

/** Holt eine Adresse und gibt Text zurück. Kein Fremdpaket, die Box soll
 *  ohne npm-Abhängigkeiten auskommen. */
function laden(url, kopf = {}) {
  return new Promise((ok, weg) => {
    const anfrage = https.get(url, { headers: { 'User-Agent': 'Youbooth/1.0', ...kopf }, timeout: 15000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return laden(res.headers.location, kopf).then(ok, weg);
      }
      const teile = [];
      res.on('data', (d) => teile.push(d));
      res.on('end', () => {
        const text = Buffer.concat(teile).toString('utf8');
        if (res.statusCode !== 200) return weg(new Error('HTTP ' + res.statusCode + ' ' + text.slice(0, 160)));
        ok(text);
      });
    });
    anfrage.on('timeout', () => { anfrage.destroy(new Error('Zeitüberschreitung')); });
    anfrage.on('error', weg);
  });
}

/** Lädt ein Bild als Puffer. */
function bildLaden(url) {
  return new Promise((ok, weg) => {
    const anfrage = https.get(url, { headers: { 'User-Agent': 'Youbooth/1.0' }, timeout: 20000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return bildLaden(res.headers.location).then(ok, weg);
      }
      if (res.statusCode !== 200) { res.resume(); return weg(new Error('Bild HTTP ' + res.statusCode)); }
      const typ = String(res.headers['content-type'] || '');
      if (!/^image\/(jpeg|png|webp)/.test(typ)) { res.resume(); return weg(new Error('Kein Bild: ' + typ)); }
      const teile = [];
      res.on('data', (d) => teile.push(d));
      res.on('end', () => ok({ puffer: Buffer.concat(teile), mime: typ.split(';')[0] }));
    });
    anfrage.on('timeout', () => { anfrage.destroy(new Error('Zeitüberschreitung')); });
    anfrage.on('error', weg);
  });
}

const sauber = (s, max = 300) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

/* ---------- Quellen ---------- */

async function ausMastodon(e) {
  const instanz = String(e.instanz || 'mastodon.social').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const tag = encodeURIComponent(String(e.tag || '').replace(/^#/, ''));
  if (!tag) throw new Error('Kein Hashtag angegeben');
  const url = `https://${instanz}/api/v1/timelines/tag/${tag}?limit=20&only_media=true`;
  const kopf = e.token ? { Authorization: 'Bearer ' + e.token } : {};
  const daten = JSON.parse(await laden(url, kopf));
  const raus = [];
  for (const p of Array.isArray(daten) ? daten : []) {
    for (const m of p.media_attachments || []) {
      if (m.type !== 'image' || !m.url) continue;
      raus.push({
        id: 'mastodon:' + p.id + ':' + m.id,
        autor: sauber(p.account && (p.account.display_name || p.account.acct), 60),
        text: sauber(p.content, 200),
        bildUrl: m.url,
        zeit: p.created_at || new Date().toISOString(),
        quelle: 'Mastodon',
      });
    }
  }
  return raus;
}

async function ausInstagram(e) {
  /* Zwei Schritte laut Graph-API: erst die Hashtag-Kennung, dann die
     jüngsten Beiträge dazu. Beides braucht ein geprüftes Token eines
     Instagram-Business-Kontos — ohne das gibt es hier keinen Weg, und das
     sagen wir auch so. */
  if (!e.token || !e.igNutzerId) {
    throw new Error('Instagram braucht ein Zugriffstoken und die Konto-Kennung eines Instagram-Business-Kontos');
  }
  const tag = encodeURIComponent(String(e.tag || '').replace(/^#/, ''));
  const suche = JSON.parse(await laden(
    `https://graph.facebook.com/v21.0/ig_hashtag_search?user_id=${encodeURIComponent(e.igNutzerId)}&q=${tag}&access_token=${encodeURIComponent(e.token)}`,
  ));
  const id = suche.data && suche.data[0] && suche.data[0].id;
  if (!id) throw new Error('Hashtag bei Instagram nicht gefunden');
  const felder = 'id,media_type,media_url,permalink,caption,timestamp';
  const liste = JSON.parse(await laden(
    `https://graph.facebook.com/v21.0/${id}/recent_media?user_id=${encodeURIComponent(e.igNutzerId)}&fields=${felder}&access_token=${encodeURIComponent(e.token)}`,
  ));
  return (liste.data || [])
    .filter((p) => p.media_type === 'IMAGE' && p.media_url)
    .map((p) => ({
      id: 'instagram:' + p.id,
      autor: '',
      text: sauber(p.caption, 200),
      bildUrl: p.media_url,
      zeit: p.timestamp || new Date().toISOString(),
      quelle: 'Instagram',
    }));
}

async function ausEndpunkt(e) {
  if (!/^https:\/\//.test(String(e.endpunkt || ''))) throw new Error('Kein gültiger Endpunkt (https)');
  const url = e.endpunkt.replace('{tag}', encodeURIComponent(String(e.tag || '').replace(/^#/, '')));
  const daten = JSON.parse(await laden(url, e.token ? { Authorization: 'Bearer ' + e.token } : {}));
  const liste = Array.isArray(daten) ? daten : (daten.beitraege || daten.items || daten.data || []);
  return liste
    .filter((p) => p && (p.bild || p.image || p.media_url))
    .map((p, i) => ({
      id: 'endpunkt:' + (p.id || p.name || i) + ':' + (p.bild || p.image || p.media_url).slice(-24),
      autor: sauber(p.autor || p.author || p.user, 60),
      text: sauber(p.text || p.caption, 200),
      bildUrl: p.bild || p.image || p.media_url,
      zeit: p.zeit || p.timestamp || new Date().toISOString(),
      quelle: 'Endpunkt',
    }));
}

/** Beiträge der eingestellten Quelle holen. Wirft mit einem Grund, den man
 *  im Cockpit anzeigen kann — stille Fehlschläge gibt es hier nicht. */
async function beitraegeHolen(e) {
  const quelle = String(e.quelle || 'mastodon');
  if (quelle === 'instagram') return ausInstagram(e);
  if (quelle === 'endpunkt') return ausEndpunkt(e);
  return ausMastodon(e);
}

module.exports = { beitraegeHolen, bildLaden };
