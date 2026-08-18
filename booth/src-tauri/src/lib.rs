//! Desktop-Huelle des Booths.
//!
//! Die Oberflaeche liegt im Webteil; hier steht, was das Betriebssystem
//! beisteuert: Vollbild fuer den Kiosk-Betrieb, die Ablage der Aufnahmen als
//! Datei und der kleine Auslieferungsdienst, ueber den Gaeste ihr Bild per QR
//! aus dem WLAN der Box laden — ohne Internet.

mod ausgabe;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Manager, State};

/// Was der Webteil ueber die Ablage wissen muss.
#[derive(Default)]
struct Dienstzustand {
    ordner: Option<PathBuf>,
    adresse: Option<String>,
}

/// Legt eine Aufnahme als Datei ab und gibt den Pfad zurueck.
#[tauri::command]
fn sichere_aufnahme(
    zustand: State<'_, Mutex<Dienstzustand>>,
    kennung: String,
    endung: Option<String>,
    daten: Vec<u8>,
) -> Result<String, String> {
    let gesperrt = zustand.lock().map_err(|_| "Zustand nicht lesbar".to_string())?;
    let ordner = gesperrt
        .ordner
        .clone()
        .ok_or_else(|| "Ablageordner steht nicht bereit".to_string())?;

    ausgabe::lege_ab(&ordner, &kennung, endung.as_deref().unwrap_or("jpg"), &daten)
        .map(|pfad| pfad.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

/// Adresse, auf die der QR-Code zeigt. Leer, wenn der Dienst nicht laeuft.
#[tauri::command]
fn ausgabe_adresse(zustand: State<'_, Mutex<Dienstzustand>>) -> String {
    zustand
        .lock()
        .ok()
        .and_then(|z| z.adresse.clone())
        .unwrap_or_default()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(Dienstzustand::default()))
        .invoke_handler(tauri::generate_handler![sichere_aufnahme, ausgabe_adresse])
        .setup(|app| {
            // Im Saal laeuft der Booth im Vollbild. Zum Einrichten laesst sich
            // das mit F11 wieder aufheben.
            if let Some(fenster) = app.get_webview_window("main") {
                let _ = fenster.set_fullscreen(true);
            }

            let ordner = app
                .path()
                .app_data_dir()
                .map(|p| p.join("aufnahmen"))
                .unwrap_or_else(|_| std::env::temp_dir().join("youbooth-aufnahmen"));

            // Laeuft der Port schon, startet die Box trotzdem — dann fehlt nur
            // der QR-Weg, und das steht am Screen.
            let adresse = match ausgabe::starte_dienst(ordner.clone(), ausgabe::PORT) {
                Ok(port) => Some(ausgabe::netzadresse(port)),
                Err(_) => None,
            };

            let zustand = app.state::<Mutex<Dienstzustand>>();
            if let Ok(mut z) = zustand.lock() {
                z.ordner = Some(ordner);
                z.adresse = adresse;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Booth konnte nicht starten");
}
