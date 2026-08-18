/**
 * Das Downloadzentrum — welche Fassung liegt wo.
 *
 * Als Modul und nicht als JSON, weil zwei sehr verschiedene Leser dieselbe
 * Liste brauchen: die Website beim Bauen und der Wegweiser (`entry.mjs`) zur
 * Laufzeit. Ein JSON-Import bräuchte dort Einfuhrattribute, und ob die
 * Wix-Laufzeit die kennt, ist nicht gesagt — ein Modul kennt jede.
 *
 * Und sie liegt NEBEN dem Wegweiser, nicht bei den Seitendaten: Hochgeladen
 * wird nur dieser Ordner. Der erste Anlauf lag unter `src/daten/` und
 * beantwortete jede Anfrage mit
 *
 *   Cannot find module '/src/daten/downloads.mjs' imported from /user-code/entry.mjs
 *
 * Gepflegt von `tools/downloadzentrum.mjs`. Von Hand ändern geht, ist aber
 * ein guter Weg, Versatz und Prüfsumme auseinanderlaufen zu lassen.
 */

export const DOWNLOADS = {
  "hinweis": "Erzeugt und gepflegt von tools/downloadzentrum.mjs. Der Ablageort ist ein Umweg mit Grund: Die Medienverwaltung nimmt keine .exe an (UNSUPPORTED_FILE_FORMAT), wohl aber .zip. Das ZIP ist OHNE Verdichtung geschrieben, deshalb liegt das Installationsprogramm darin unverändert ab 'versatz'. Der Wegweiser reicht genau diesen Bereich durch — was hier ankommt, ist byte-gleich mit dem, was der Bau erzeugt hat (nachgemessen: SHA-512 stimmt, Kennung MZ).",
  "aktuell": "1.0.5",
  "fassungen": {
    "1.0.4": {
      "erschienen": "2026-08-18",
      "windows": {
        "datei": "youbooth-Setup-1.0.4.exe",
        "quelle": "https://0ff1e24b-98f7-4727-adcb-f15b39c63ab2.usrfiles.com/archives/d098ab_f43bf7e02f0a40528450075887e190e7.zip",
        "versatz": 54,
        "groesse": 106380248,
        "sha512": "6krLavqKx0i3oG+XzLEg0sB0l3+PSSpXuMGTAdN7gnfmGzpeDAtGXp+jGcaL6Hhncq+0A4aEdtXk34C3YiltUw=="
      }
    },
    "1.0.5": {
      "erschienen": "2026-08-18",
      "windows": {
        "datei": "youbooth-Setup-1.0.5.exe",
        "quelle": "https://0ff1e24b-98f7-4727-adcb-f15b39c63ab2.usrfiles.com/archives/d098ab_aec23849f0704dafac58758f01879c62.zip",
        "versatz": 54,
        "groesse": 106380527,
        "sha512": "gY7Z9WpJENluzxg8I0T8kIgSOZvGfArNh4Sc2mxA8lOoynHAS0cOoqWN0+M3Xd3FVOR6wi9U7269kCndej6GDw=="
      }
    }
  },
  "neuerungen": {
    "1.0.4": [
      "Die Box startet auch dann, wenn eine ältere Fassung noch im Hintergrund läuft",
      "Ein Dienst der Box überlebt das Programmfenster nicht mehr — keine hängenden Reste nach dem Aktualisieren",
      "22 gezeichnete Vorlagen: Blüten, Feuerwerk, Lorbeer, Neon, Art déco"
    ],
    "1.0.3": [
      "Installer repariert: die Box startet aus dem Paket heraus"
    ],
    "1.0.5": [
      "Aktualisierung und Download kommen von youbooth.me — keine fremde Adresse mehr",
      "Alles aus 1.0.4: Start trotz laufender Altfassung, keine hängenden Dienste, 22 gezeichnete Vorlagen"
    ]
  }
};

export default DOWNLOADS;
