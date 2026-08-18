//! Drucken ueber den Systemdrucker.
//!
//! Der Weg der Fassung 1.30 war richtig gedacht und halb gebaut: Sie legt das
//! Bild als Datei ab und laesst das Betriebssystem drucken, randlos zentriert
//! auf die Blattgroesse. Nur lief das ausschliesslich ueber PowerShell — auf
//! einem Mac gab es Druckknoepfe, die nichts tun konnten.
//!
//! Hier steht derselbe Gedanke fuer beide Systeme:
//!   Windows  System.Drawing.Printing ueber PowerShell
//!   macOS    CUPS (`lp`), Linux ebenso
//!
//! Warum nicht der Druckdialog des Browsers: Auf einer Feier steht niemand am
//! Rechner, der einen Dialog wegklickt. Der Kiosk laeuft im Vollbild, und der
//! Gast tippt „Drucken" — danach muss Papier kommen, ohne weitere Frage.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Welche Drucker das System kennt.
pub fn liste() -> Vec<String> {
    let ausgabe = if cfg!(target_os = "windows") {
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-Printer | Select-Object -ExpandProperty Name",
            ])
            .output()
    } else {
        // `lpstat -a` listet die Warteschlangen, die Auftraege annehmen.
        Command::new("lpstat").arg("-a").output()
    };

    let Ok(aus) = ausgabe else { return Vec::new() };
    let text = String::from_utf8_lossy(&aus.stdout);

    text.lines()
        .filter_map(|zeile| {
            let z = zeile.trim();
            if z.is_empty() {
                return None;
            }
            if cfg!(target_os = "windows") {
                Some(z.to_string())
            } else {
                // „HP_Officejet accepting requests since …" — nur der Name.
                z.split_whitespace().next().map(|s| s.to_string())
            }
        })
        .collect()
}

/// Der Standarddrucker des Systems, wenn es einen gibt.
pub fn standard() -> Option<String> {
    if cfg!(target_os = "windows") {
        let aus = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-CimInstance -Class Win32_Printer -Filter \"Default=true\").Name",
            ])
            .output()
            .ok()?;
        let name = String::from_utf8_lossy(&aus.stdout).trim().to_string();
        if name.is_empty() { None } else { Some(name) }
    } else {
        let aus = Command::new("lpstat").arg("-d").output().ok()?;
        let text = String::from_utf8_lossy(&aus.stdout);
        // „system default destination: HP_Officejet"
        text.split(':').nth(1).map(|s| s.trim().to_string()).filter(|s| !s.is_empty())
    }
}

/// Der PowerShell-Befehl fuer einen randlos zentrierten Druck.
///
/// Eigene Funktion, damit die Zeichenmasse pruefbar sind, ohne zu drucken:
/// Ein Hochkommen im Drucker- oder Dateinamen wuerde den Befehl sonst
/// aufbrechen — in PowerShell wird es durch Verdoppeln entschaerft.
fn windows_befehl(datei: &Path, drucker: &str) -> String {
    let pfad = datei.to_string_lossy().replace('\'', "''");
    let ziel = drucker.replace('\'', "''");
    format!(
        r#"Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Image]::FromFile('{pfad}')
$pd = New-Object System.Drawing.Printing.PrintDocument
$pd.PrinterSettings.PrinterName = '{ziel}'
$pd.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0)
$pd.add_PrintPage({{ param($s, $e)
  $b = $e.PageBounds
  $r = [Math]::Min($b.Width / $img.Width, $b.Height / $img.Height)
  $w = $img.Width * $r; $h = $img.Height * $r
  $e.Graphics.DrawImage($img, ($b.Width - $w) / 2, ($b.Height - $h) / 2, $w, $h)
}})
$pd.Print()
$img.Dispose()"#
    )
}

/// Die CUPS-Zeilenbestandteile fuer denselben Druck.
///
/// `fit-to-page` passt das Bild in die Seite ein, ohne es zu verzerren —
/// dasselbe Ergebnis wie die Rechnung oben unter Windows.
fn cups_argumente(datei: &Path, drucker: &str) -> Vec<String> {
    vec![
        "-d".into(),
        drucker.to_string(),
        "-o".into(),
        "fit-to-page".into(),
        "-o".into(),
        "media=Custom.4x6in".into(),
        datei.to_string_lossy().to_string(),
    ]
}

/// Schreibt die Bilddaten in eine Datei und schickt sie an den Drucker.
///
/// Die Datei liegt im Ablageordner der Box und wird danach wieder entfernt —
/// im Temp-Ordner haben sich in 1.30 abgebrochene Druckdateien gesammelt, bis
/// die Selbstpruefung sie wegraeumte.
pub fn drucke(ordner: &Path, daten: &[u8], drucker: &str, endung: &str) -> Result<(), String> {
    if drucker.trim().is_empty() {
        return Err("Kein Drucker gewaehlt".into());
    }
    fs::create_dir_all(ordner).map_err(|e| e.to_string())?;

    let name = format!(
        "druck-{}.{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
        if endung == "png" { "png" } else { "jpg" }
    );
    let datei: PathBuf = ordner.join(name);
    fs::write(&datei, daten).map_err(|e| e.to_string())?;

    let ergebnis = if cfg!(target_os = "windows") {
        Command::new("powershell")
            .args(["-NoProfile", "-NonInteractive", "-Command", &windows_befehl(&datei, drucker)])
            .output()
    } else {
        Command::new("lp").args(cups_argumente(&datei, drucker)).output()
    };

    // Die Druckdatei wird in beiden Faellen wieder entfernt — auch wenn der
    // Druck schiefging. Was liegen bleibt, findet niemand wieder.
    let _ = fs::remove_file(&datei);

    match ergebnis {
        Ok(aus) if aus.status.success() => Ok(()),
        Ok(aus) => {
            let fehler = String::from_utf8_lossy(&aus.stderr);
            Err(if fehler.trim().is_empty() {
                "Der Druckbefehl endete mit einem Fehler".to_string()
            } else {
                fehler.trim().chars().take(200).collect()
            })
        }
        Err(e) => Err(format!(
            "{} liess sich nicht starten: {}",
            if cfg!(target_os = "windows") { "PowerShell" } else { "lp" },
            e
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hochkomma_bricht_den_befehl_nicht_auf() {
        let befehl = windows_befehl(Path::new(r"C:\tmp\bild.jpg"), "Tim's Drucker");
        assert!(befehl.contains("'Tim''s Drucker'"), "Hochkomma wird verdoppelt");
        // Kein unmaskiertes Hochkomma zwischen Zuweisung und Zeilenende.
        let zeile = befehl
            .lines()
            .find(|z| z.contains("PrinterName"))
            .expect("Zeile mit dem Druckernamen");
        assert_eq!(zeile.matches('\'').count() % 2, 0, "Hochkommas sind paarig");
    }

    #[test]
    fn cups_bekommt_drucker_und_datei() {
        let args = cups_argumente(Path::new("/tmp/bild.jpg"), "HP_Officejet");
        assert_eq!(args[0], "-d");
        assert_eq!(args[1], "HP_Officejet");
        assert!(args.contains(&"fit-to-page".to_string()));
        assert_eq!(args.last().unwrap(), "/tmp/bild.jpg");
    }

    #[test]
    fn ohne_drucker_wird_nicht_gedruckt() {
        let ordner = std::env::temp_dir().join("youbooth-druck-test");
        let fehler = drucke(&ordner, b"egal", "   ", "jpg").unwrap_err();
        assert!(fehler.contains("Kein Drucker"), "Ohne Drucker gibt es eine klare Ansage");
        // Und es darf auch keine Datei zurueckbleiben.
        assert!(!ordner.join("druck.jpg").exists());
    }

    #[test]
    fn druckdatei_bleibt_nicht_liegen() {
        let ordner = std::env::temp_dir().join(format!("youbooth-druck-{}", std::process::id()));
        let _ = fs::remove_dir_all(&ordner);
        // Der Druck scheitert hier (kein solcher Drucker) — die Datei muss
        // trotzdem weg sein.
        let _ = drucke(&ordner, b"BILDDATEN", "gibtesnicht-xyz", "jpg");
        let liegen: Vec<_> = fs::read_dir(&ordner)
            .map(|d| d.flatten().map(|e| e.file_name()).collect())
            .unwrap_or_default();
        assert!(liegen.is_empty(), "Es bleibt keine Druckdatei liegen: {liegen:?}");
        let _ = fs::remove_dir_all(&ordner);
    }
}
