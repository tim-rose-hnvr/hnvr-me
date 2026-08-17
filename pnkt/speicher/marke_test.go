package speicher

import "testing"

func mitKonten(t *testing.T) (*Speicher, *Konto, *Konto) {
	t.Helper()
	s, _ := Oeffne(t.TempDir())
	t.Cleanup(func() { s.Schliesse() })
	inhaber, err := s.LegeKontoAn("Agentur", "chef@agentur.de", "einlangespasswort")
	if err != nil {
		t.Fatal(err)
	}
	mit, err := s.LegeKontoAn("Mitarbeit", "mit@agentur.de", "einlangespasswort")
	if err != nil {
		t.Fatal(err)
	}
	return s, inhaber, mit
}

func TestMarkeNachHost(t *testing.T) {
	s, inhaber, _ := mitKonten(t)
	if err := s.SetzeMarke(&Marke{OrgID: inhaber.ID, Name: "Bäckerei Klein",
		Host: "QR.Baecker.de", Primaer: "#7a4a12"}); err != nil {
		t.Fatal(err)
	}
	// Gross- und Kleinschreibung darf im Hostnamen nicht trennen.
	for _, host := range []string{"qr.baecker.de", "QR.BAECKER.DE", "qr.baecker.de:8080"} {
		if m := s.MarkeNachHost(host); m.Name != "Bäckerei Klein" {
			t.Errorf("%q fand %q statt der Marke", host, m.Name)
		}
	}
	if m := s.MarkeNachHost("fremd.de"); m.Name != "pnkt" {
		t.Errorf("unbekannter Host muss die Standardmarke bekommen, war %q", m.Name)
	}
}

func TestHostGehoertGenauEinerMarke(t *testing.T) {
	s, inhaber, anderer := mitKonten(t)
	if err := s.SetzeMarke(&Marke{OrgID: inhaber.ID, Name: "A", Host: "code.de"}); err != nil {
		t.Fatal(err)
	}
	err := s.SetzeMarke(&Marke{OrgID: anderer.ID, Name: "B", Host: "code.de"})
	if err == nil {
		t.Error("zwei Organisationen auf demselben Hostnamen waeren nicht aufloesbar")
	}
	// Die eigene Marke darf man weiter aendern.
	if err := s.SetzeMarke(&Marke{OrgID: inhaber.ID, Name: "A neu", Host: "code.de"}); err != nil {
		t.Errorf("die eigene Marke muss aenderbar bleiben: %v", err)
	}
	if s.MarkeNachHost("code.de").Name != "A neu" {
		t.Error("Aenderung nicht wirksam")
	}
}

func TestMarkeUeberlebtNeustart(t *testing.T) {
	verzeichnis := t.TempDir()
	s, _ := Oeffne(verzeichnis)
	k, _ := s.LegeKontoAn("A", "a@b.de", "einlangespasswort")
	s.SetzeMarke(&Marke{OrgID: k.ID, Name: "Bleibt", Host: "bleibt.de"})
	s.Schliesse()

	wieder, err := Oeffne(verzeichnis)
	if err != nil {
		t.Fatal(err)
	}
	defer wieder.Schliesse()
	if m := wieder.MarkeNachHost("bleibt.de"); m.Name != "Bleibt" {
		t.Errorf("Marke nach Neustart verloren: %q", m.Name)
	}
}

func TestMitarbeitende(t *testing.T) {
	s, inhaber, mit := mitKonten(t)

	if _, err := s.NimmMitarbeitendeAuf(inhaber.ID, "mit@agentur.de", "inhaber"); err == nil {
		t.Error("ein zweiter Inhaber darf nicht aufgenommen werden")
	}
	if _, err := s.NimmMitarbeitendeAuf(inhaber.ID, "gibtsnicht@x.de", "leser"); err == nil {
		t.Error("ohne bestehendes Konto darf niemand aufgenommen werden")
	}

	k, err := s.NimmMitarbeitendeAuf(inhaber.ID, "mit@agentur.de", "redakteur")
	if err != nil {
		t.Fatal(err)
	}
	if k.Organisation() != inhaber.ID {
		t.Errorf("Organisation falsch: %s", k.Organisation())
	}
	if inhaber.Organisation() != inhaber.ID {
		t.Error("der Inhaber muss auf sich selbst zeigen")
	}
	if len(s.Mitarbeitende(inhaber.ID)) != 2 {
		t.Errorf("erwartet zwei Personen, sind %d", len(s.Mitarbeitende(inhaber.ID)))
	}

	// Eine fremde Organisation kann sie nicht abwerben.
	dritter, _ := s.LegeKontoAn("C", "c@d.de", "einlangespasswort")
	if _, err := s.NimmMitarbeitendeAuf(dritter.ID, "mit@agentur.de", "leser"); err == nil {
		t.Error("wer schon zu einer Organisation gehoert, darf nicht abgeworben werden")
	}

	if err := s.EntlasseMitarbeitende(dritter.ID, mit.ID); err == nil {
		t.Error("nur die eigene Organisation darf entlassen")
	}
	if err := s.EntlasseMitarbeitende(inhaber.ID, mit.ID); err != nil {
		t.Fatal(err)
	}
	// Das Konto bleibt bestehen — es gehoert der Person.
	if _, da := s.KontoNachID(mit.ID); !da {
		t.Error("das Konto darf beim Entlassen nicht verschwinden")
	}
}

func TestRollenrechte(t *testing.T) {
	faelle := map[string][2]bool{ // schreiben, verwalten
		RolleInhaber:   {true, true},
		RolleRedakteur: {true, false},
		RolleLeser:     {false, false},
	}
	for rolle, soll := range faelle {
		if DarfSchreiben(rolle) != soll[0] || DarfVerwalten(rolle) != soll[1] {
			t.Errorf("%s: schreiben %v verwalten %v, erwartet %v",
				rolle, DarfSchreiben(rolle), DarfVerwalten(rolle), soll)
		}
	}
}

func TestSchluesselErbtDieRolle(t *testing.T) {
	s, inhaber, _ := mitKonten(t)
	s.NimmMitarbeitendeAuf(inhaber.ID, "mit@agentur.de", "leser")

	_, klartext, err := s.LegeSchluesselAn(inhaber.ID, "chef", false)
	if err != nil {
		t.Fatal(err)
	}
	sch, _ := s.PruefeSchluessel(klartext)
	if !DarfSchreiben(s.RolleVon(sch)) {
		t.Error("der Schluessel des Inhabers muss schreiben duerfen")
	}
	if s.OrgVon(sch) != inhaber.ID {
		t.Error("Organisation des Schluessels falsch")
	}
}
