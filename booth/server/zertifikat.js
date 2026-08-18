/**
 * Eigenes Zertifikat für die Box.
 *
 * Warum überhaupt: Safari auf dem iPad gibt die **Kamera nur in sicherem
 * Kontext** frei. Über `http://192.168.x.x:3377` bleibt sie schwarz — ein iPad
 * als Fotobox ist damit ohne HTTPS gar nicht möglich. Dasselbe gilt für Wake
 * Lock (Bildschirm wachhalten) und den Selfie-Finder der Gäste.
 *
 * Woher das Zertifikat: von Windows selbst. `New-SelfSignedCertificate` steckt
 * in jedem Windows 10/11, braucht **keine Administratorrechte** (Ablage im
 * Konto des Nutzers) und keine zusätzliche Bibliothek im Installer.
 *
 * Grenze, ehrlich: ein selbst ausgestelltes Zertifikat kennt kein Gerät. Am
 * iPad muss es einmal geladen und unter Einstellungen → Info → Zertifikats-
 * vertrauen freigeschaltet werden. Danach ist Ruhe. Für Gästehandys ist das
 * nichts — die bekommen weiter die Cloud-Adresse.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');

const ps = (skript) => new Promise((ok, weg) => {
  execFile('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', skript],
    { windowsHide: true, timeout: 60000 },
    (err, out, fehler) => (err ? weg(new Error((fehler || err.message).toString().slice(0, 300))) : ok(String(out).trim())));
});

/**
 * Sorgt dafür, dass ein Zertifikat für genau diese Namen da ist.
 * Ändert sich die IP (anderes WLAN), wird neu ausgestellt.
 */
async function sicherstellen(ordner, hosts) {
  if (process.platform !== 'win32') {
    throw new Error('Automatische Zertifikate gibt es zurzeit nur unter Windows');
  }
  fs.mkdirSync(ordner, { recursive: true });
  const pfx = path.join(ordner, 'youbooth.pfx');
  const cer = path.join(ordner, 'youbooth.cer');
  const merk = path.join(ordner, 'youbooth-zertifikat.json');
  const namen = [...new Set(hosts.filter(Boolean))];
  const passwort = 'youbooth-lokal';

  /* Passt das vorhandene noch? */
  try {
    const alt = JSON.parse(fs.readFileSync(merk, 'utf8'));
    const gleich = JSON.stringify(alt.namen) === JSON.stringify(namen);
    const gueltig = new Date(alt.laeuftAb) > new Date(Date.now() + 7 * 864e5);
    if (gleich && gueltig && fs.existsSync(pfx) && fs.existsSync(cer)) {
      return { pfx, cer, passwort, namen, neu: false };
    }
  } catch { /* noch keins da */ }

  /* ★ Eine IP-Adresse muss als IPAddress im Alternativnamen stehen. Trägt man
     sie nur als DNS-Namen ein (was `-DnsName` allein tut), lehnt Safari die
     Verbindung auch nach dem Installieren ab – der Name passt dann nicht. */
  const istIp = (n) => /^\d{1,3}(\.\d{1,3}){3}$/.test(n);
  const san = namen.map((n) => (istIp(n) ? 'IPAddress=' : 'DNS=') + n).join('&');
  /* ★ `-DnsName` und eine eigene SAN-Erweiterung vertragen sich nicht
     ("Der DnsName-Parameter steht in Konflikt …") – also alle Namen
     ausschliesslich ueber die Erweiterung setzen. */
  const skript = [
    "$ErrorActionPreference='Stop'",
    "$c = New-SelfSignedCertificate -Subject 'CN=Youbooth Fotobox'" +
      " -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.1'," +
      `'2.5.29.17={text}${san}')` +
      " -CertStoreLocation 'Cert:\\CurrentUser\\My' -NotAfter (Get-Date).AddYears(3) -KeyExportPolicy Exportable",
    `$pw = ConvertTo-SecureString -String '${passwort}' -Force -AsPlainText`,
    `Export-PfxCertificate -Cert $c -FilePath '${pfx.replace(/\\/g, '/')}' -Password $pw | Out-Null`,
    `Export-Certificate -Cert $c -FilePath '${cer.replace(/\\/g, '/')}' | Out-Null`,
    '$c.NotAfter.ToString("o")',
  ].join('; ');

  const laeuftAb = await ps(skript);
  fs.writeFileSync(merk, JSON.stringify({ namen, laeuftAb, erstellt: new Date().toISOString() }, null, 2));
  return { pfx, cer, passwort, namen, neu: true };
}

module.exports = { sicherstellen };
