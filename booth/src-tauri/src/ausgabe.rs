//! Ablage der Aufnahmen und ihre Auslieferung im lokalen Netz.
//!
//! Das ist die Stelle, an der das Versprechen „QR-Download ohne Internet"
//! eingeloest wird: Die Box legt jede Aufnahme als Datei ab und bietet sie
//! ueber einen kleinen HTTP-Server im eigenen Netz an. Der QR-Code am Screen
//! zeigt auf `http://<adresse-der-box>:<port>/f/<kennung>`.

use std::fs;
use std::io::Cursor;
use std::net::{IpAddr, SocketAddr};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

/// Standard-Port des Auslieferungsdienstes.
pub const PORT: u16 = 8322;

/// Endungen, die die Box ablegt und ausliefert — mehr gibt es nicht.
const ENDUNGEN: [(&str, &str); 2] = [("jpg", "image/jpeg"), ("gif", "image/gif")];

/// Prueft eine Endung gegen die Liste; alles andere wird zu `jpg`.
fn saubere_endung(endung: &str) -> &'static str {
    ENDUNGEN
        .iter()
        .find(|(e, _)| *e == endung)
        .map(|(e, _)| *e)
        .unwrap_or("jpg")
}

fn inhaltsart(endung: &str) -> &'static str {
    ENDUNGEN
        .iter()
        .find(|(e, _)| *e == endung)
        .map(|(_, art)| *art)
        .unwrap_or("application/octet-stream")
}

/// Schreibt eine Aufnahme in den Ablageordner.
///
/// `endung` entscheidet nur zwischen den bekannten Formaten — Standbild als
/// JPEG, Bewegtbild als GIF. Ein unbekannter Wert landet bei `jpg`, damit von
/// aussen keine beliebige Dateiendung entsteht.
pub fn lege_ab(ordner: &Path, kennung: &str, endung: &str, daten: &[u8]) -> std::io::Result<PathBuf> {
    fs::create_dir_all(ordner)?;
    let ziel = ordner.join(format!(
        "{}.{}",
        saubere_kennung(kennung),
        saubere_endung(endung)
    ));
    fs::write(&ziel, daten)?;
    Ok(ziel)
}

/// Laesst nur zu, was ein Dateiname sein darf — kein Pfadwechsel von aussen.
fn saubere_kennung(kennung: &str) -> String {
    kennung
        .chars()
        .filter(|z| z.is_ascii_alphanumeric() || *z == '-' || *z == '_')
        .take(64)
        .collect()
}

/// Adresse, die der QR-Code tragen soll.
pub fn netzadresse(port: u16) -> String {
    match local_ip_address::local_ip() {
        Ok(IpAddr::V4(v4)) => format!("http://{}:{}", v4, port),
        Ok(IpAddr::V6(v6)) => format!("http://[{}]:{}", v6, port),
        Err(_) => format!("http://127.0.0.1:{}", port),
    }
}

/// Startet den Auslieferungsdienst in einem eigenen Faden.
///
/// Liefert nur Dateien aus dem Ablageordner und nur unter `/f/<kennung>`;
/// alles andere bekommt 404. Gibt den tatsaechlich belegten Port zurueck.
pub fn starte_dienst(ordner: PathBuf, port: u16) -> std::io::Result<u16> {
    let adresse = SocketAddr::from(([0, 0, 0, 0], port));
    let server = tiny_http::Server::http(adresse)
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::AddrInUse, e.to_string()))?;
    let belegter_port = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(port);
    let server = Arc::new(server);

    thread::spawn(move || {
        for anfrage in server.incoming_requests() {
            let pfad = anfrage.url().to_string();
            let antwort = beantworte(&ordner, &pfad);
            let _ = match antwort {
                Antwort::Datei(daten, art) => anfrage.respond(
                    tiny_http::Response::new(
                        tiny_http::StatusCode(200),
                        vec![
                            kopfzeile("Content-Type", art),
                            kopfzeile("Cache-Control", "no-store"),
                        ],
                        Cursor::new(daten.clone()),
                        Some(daten.len()),
                        None,
                    ),
                ),
                Antwort::Fehlt => anfrage.respond(
                    tiny_http::Response::from_string("Nicht gefunden")
                        .with_status_code(404),
                ),
            };
        }
    });

    Ok(belegter_port)
}

enum Antwort {
    Datei(Vec<u8>, &'static str),
    Fehlt,
}

/// `/f/<kennung>.<endung>` liefert genau diese Datei; ohne Endung gewinnt das
/// Standbild, und fehlt es, wird das Bewegtbild ausgeliefert.
fn beantworte(ordner: &Path, pfad: &str) -> Antwort {
    let ohne_frage = pfad.split('?').next().unwrap_or("");
    let Some(rest) = ohne_frage.strip_prefix("/f/") else {
        return Antwort::Fehlt;
    };

    let (name, gewuenscht) = match rest.rsplit_once('.') {
        Some((name, endung)) if ENDUNGEN.iter().any(|(e, _)| *e == endung) => {
            (name, Some(saubere_endung(endung)))
        }
        _ => (rest, None),
    };

    let kennung = saubere_kennung(name);
    if kennung.is_empty() {
        return Antwort::Fehlt;
    }

    let reihe: Vec<&str> = match gewuenscht {
        Some(endung) => vec![endung],
        None => ENDUNGEN.iter().map(|(e, _)| *e).collect(),
    };

    for endung in reihe {
        if let Ok(daten) = fs::read(ordner.join(format!("{}.{}", kennung, endung))) {
            return Antwort::Datei(daten, inhaltsart(endung));
        }
    }

    Antwort::Fehlt
}

fn kopfzeile(name: &str, wert: &str) -> tiny_http::Header {
    tiny_http::Header::from_bytes(name.as_bytes(), wert.as_bytes())
        .expect("feste Kopfzeile ist gueltig")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn kennung_laesst_keinen_pfadwechsel_zu() {
        assert_eq!(saubere_kennung("../../etc/passwd"), "etcpasswd");
        assert_eq!(saubere_kennung("abc-123_XY"), "abc-123_XY");
        assert_eq!(saubere_kennung(""), "");
    }

    #[test]
    fn legt_ab_und_liefert_aus() {
        let ordner = std::env::temp_dir().join(format!("youbooth-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&ordner);

        lege_ab(&ordner, "test-1", "jpg", b"BILDDATEN").expect("ablegen");
        lege_ab(&ordner, "test-2", "gif", b"GIF89aBEWEGT").expect("ablegen");
        lege_ab(&ordner, "test-3", "exe", b"NICHTERLAUBT").expect("ablegen");

        let port = starte_dienst(ordner.clone(), 0).expect("dienst startet");
        assert!(port > 0);

        // Der Dienst laeuft im Hintergrund — kurz Zeit geben.
        std::thread::sleep(std::time::Duration::from_millis(120));

        let gefunden = hole(port, "/f/test-1");
        assert!(gefunden.contains("BILDDATEN"), "Datei wird ausgeliefert");

        let fehlt = hole(port, "/f/gibtesnicht");
        assert!(fehlt.contains("404"), "Unbekannte Kennung ergibt 404");

        let ausbruch = hole(port, "/f/../../etc/passwd");
        assert!(!ausbruch.contains("root:"), "Kein Pfadwechsel nach draussen");

        let bewegt = hole(port, "/f/test-2.gif");
        assert!(bewegt.contains("BEWEGT"), "Bewegtbild wird ausgeliefert");
        assert!(bewegt.contains("image/gif"), "Bewegtbild kommt als GIF");

        let ohne_endung = hole(port, "/f/test-2");
        assert!(
            ohne_endung.contains("BEWEGT"),
            "Ohne Standbild greift der Dienst auf das Bewegtbild zurueck"
        );

        let standbild_gewinnt = hole(port, "/f/test-1");
        assert!(
            standbild_gewinnt.contains("image/jpeg"),
            "Mit Standbild gewinnt das Standbild"
        );

        // Eine unbekannte Endung landet als jpg in der Ablage, nicht als .exe.
        assert!(ordner.join("test-3.jpg").exists(), "Fremde Endung wird zu jpg");
        assert!(!ordner.join("test-3.exe").exists(), "Keine fremde Endung auf der Platte");

        let _ = fs::remove_dir_all(&ordner);
    }

    /// Winziger HTTP-Abruf, damit der Test ohne weitere Abhaengigkeit auskommt.
    fn hole(port: u16, pfad: &str) -> String {
        use std::io::{Read, Write};
        let mut strom = std::net::TcpStream::connect(("127.0.0.1", port)).expect("verbindung");
        write!(strom, "GET {} HTTP/1.0\r\nHost: localhost\r\n\r\n", pfad).expect("anfrage");
        let mut antwort = Vec::new();
        strom.read_to_end(&mut antwort).expect("antwort");
        String::from_utf8_lossy(&antwort).to_string()
    }
}
