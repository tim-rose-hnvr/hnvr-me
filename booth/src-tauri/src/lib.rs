//! Desktop-Huelle des Booths.
//!
//! Die Oberflaeche liegt im Webteil; hier steht, was das Betriebssystem
//! beisteuert: Vollbild fuer den Kiosk-Betrieb, die Ablage der Aufnahmen als
//! Datei und der kleine Auslieferungsdienst, ueber den Gaeste ihr Bild per QR
//! aus dem WLAN der Box laden — ohne Internet.

mod ausgabe;

use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};

use tauri::{Manager, State};

/// Was der Webteil ueber die Ablage wissen muss.
#[derive(Default)]
struct Dienstzustand {
    ordner: Option<PathBuf>,
    adresse: Option<String>,
    /// Zaehlt die Ausloesungen von der Fernbedienung im Netz der Box.
    ausloeser: Option<Arc<AtomicU64>>,
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

/// Stand des Fernausloesers. Der Booth schaut hier nach; steigt die Zahl,
/// startet er eine Aufnahme. Ein Zaehler statt eines Ereignisses, damit eine
/// verpasste Abfrage nichts verschluckt.
#[tauri::command]
fn fern_stand(zustand: State<'_, Mutex<Dienstzustand>>) -> u64 {
    zustand
        .lock()
        .ok()
        .and_then(|z| z.ausloeser.as_ref().map(|a| a.load(Ordering::Relaxed)))
        .unwrap_or(0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(Dienstzustand::default()))
        .invoke_handler(tauri::generate_handler![
            sichere_aufnahme,
            ausgabe_adresse,
            fern_stand
        ])
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
            let ausloeser = Arc::new(AtomicU64::new(0));
            let adresse =
                match ausgabe::starte_dienst(ordner.clone(), ausgabe::PORT, ausloeser.clone()) {
                    Ok(port) => Some(ausgabe::netzadresse(port)),
                    Err(_) => None,
                };

            let zustand = app.state::<Mutex<Dienstzustand>>();
            if let Ok(mut z) = zustand.lock() {
                z.ordner = Some(ordner);
                z.adresse = adresse;
                z.ausloeser = Some(ausloeser);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Booth konnte nicht starten");
}
