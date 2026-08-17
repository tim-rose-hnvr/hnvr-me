//! Desktop-Huelle des Booths.
//!
//! Die Oberflaeche liegt im Webteil; hier steht nur, was das Betriebssystem
//! beisteuert. Kiosk-Betrieb heisst: Vollbild, kein Fenstermenue, und der
//! Rechner darf waehrend eines Events nicht in den Ruhezustand.

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(fenster) = app.get_webview_window("main") {
                // Im Saal laeuft der Booth im Vollbild. Zum Einrichten laesst
                // sich das mit F11 wieder aufheben.
                let _ = fenster.set_fullscreen(true);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Booth konnte nicht starten");
}
