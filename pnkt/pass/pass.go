// Package pass prueft einen Produktpass auf Vollstaendigkeit.
//
// Was hier geprueft wird, ist keine Rechtsauskunft. Die ESPR
// (Verordnung (EU) 2024/1781) legt den Rahmen fest, die Einzelheiten je
// Produktgruppe stehen in delegierten Rechtsakten, die nach und nach
// kommen — welche Angabe fuer eine Waschmaschine Pflicht ist und welche
// fuer ein T-Shirt, steht dort und nicht hier.
//
// Geprueft wird deshalb das, was ueber alle Produktgruppen hinweg gilt
// und was ein Pass ohne fremdes Wissen selbst beantworten kann: Ist der
// Artikel eindeutig bezeichnet? Ist ein Verantwortlicher genannt? Steht
// da, was drin ist, was man damit macht, wenn es kaputt ist, und wohin
// damit, wenn es zu Ende ist? Ein Pass, der diese vier Fragen nicht
// beantwortet, ist in keiner Auslegung vollstaendig.
package pass

import (
	"fmt"
	"strings"
	"time"

	"pnkt.me/pnkt/gs1"
	"pnkt.me/pnkt/speicher"
)

// Befund ist eine Luecke oder ein Fehler im Pass.
type Befund struct {
	Feld    string `json:"feld"`
	Schwere string `json:"schwere"` // fehler, warnung, hinweis
	Text    string `json:"text"`
	Grund   string `json:"grund,omitempty"`
}

// Urteil fasst die Pruefung zusammen.
type Urteil struct {
	Tragfaehig bool     `json:"tragfaehig"` // keine Fehler
	Anteil     int      `json:"anteil"`     // erfuellte Abschnitte in Prozent
	Befunde    []Befund `json:"befunde"`
}

// Die vier Abschnitte, an denen ein Pass gemessen wird.
var abschnitte = []string{"Identitaet", "Verantwortlicher", "Stoffe", "Nutzung und Ende"}

// Pruefe misst einen Pass. Fehler verhindern die Veroeffentlichung,
// Warnungen nicht — welche Angabe Pflicht ist, entscheidet der delegierte
// Rechtsakt der Produktgruppe, und den kennt dieses Programm nicht.
func Pruefe(p *speicher.Produktpass) Urteil {
	var u Urteil
	melde := func(feld, schwere, text, grund string) {
		u.Befunde = append(u.Befunde, Befund{feld, schwere, text, grund})
	}

	// --- Identitaet ---
	erfuellt := 0
	if strings.TrimSpace(p.Bezeichnung) == "" {
		melde("bezeichnung", "fehler", "Der Artikel hat keine Bezeichnung.",
			"Ohne sie weiss niemand, wovon der Pass handelt.")
	}
	if _, err := gs1.PruefeGTIN(p.GTIN); err != nil {
		melde("gtin", "fehler", "Die GTIN ist nicht gueltig: "+err.Error(),
			"Der Datentraeger loest ueber die GTIN auf. Stimmt sie nicht, "+
				"fuehrt der Code am Produkt ins Leere.")
	} else if strings.TrimSpace(p.Bezeichnung) != "" {
		erfuellt++
	}
	if p.Modell == "" {
		melde("modell", "hinweis", "Keine Modellbezeichnung.",
			"Bei mehreren Ausfuehrungen unter einer GTIN ist sie das einzige "+
				"Unterscheidungsmerkmal fuer den Leser.")
	}
	if p.Herstelldatum != "" {
		if _, err := time.Parse("2006-01-02", p.Herstelldatum); err != nil {
			melde("herstelldatum", "warnung",
				"Das Herstelldatum ist nicht in der Form JJJJ-MM-TT.",
				"Eine Maschine liest es sonst nicht.")
		}
	}

	// --- Verantwortlicher ---
	switch {
	case p.Hersteller == "":
		melde("hersteller", "fehler", "Kein Verantwortlicher genannt.",
			"Ein Pass ohne benannten Verantwortlichen ist fuer die Marktaufsicht wertlos.")
	case p.HerstellerAnschrift == "" && p.HerstellerKennung == "":
		melde("herstellerAnschrift", "warnung",
			"Zum Hersteller fehlen Anschrift und Kennung.",
			"Ein Name allein reicht nicht, um jemanden zu erreichen. "+
				"GLN oder EORI genuegt, wenn keine Anschrift auf die Seite soll.")
		erfuellt++
	default:
		erfuellt++
	}

	// --- Stoffe ---
	if len(p.Stoffe) == 0 {
		melde("stoffe", "warnung", "Keine Angaben zu den Bestandteilen.",
			"Ohne sie kann ein Verwerter nicht trennen und ein Kaeufer nicht vergleichen.")
	} else {
		erfuellt++
		summe := 0.0
		for i, st := range p.Stoffe {
			if strings.TrimSpace(st.Name) == "" {
				melde(fmt.Sprintf("stoffe[%d].name", i), "fehler",
					"Ein Bestandteil hat keinen Namen.", "")
			}
			summe += st.AnteilPro
			if st.AnteilPro < 0 || st.AnteilPro > 100 {
				melde(fmt.Sprintf("stoffe[%d].anteilProzent", i), "fehler",
					fmt.Sprintf("Anteil %.1f %% liegt ausserhalb von 0 bis 100.", st.AnteilPro), "")
			}
			if st.Rezykliert < 0 || st.Rezykliert > 100 {
				melde(fmt.Sprintf("stoffe[%d].rezykliertProzent", i), "fehler",
					fmt.Sprintf("Rezyklatanteil %.1f %% liegt ausserhalb von 0 bis 100.", st.Rezykliert), "")
			}
			if st.Besorgnis && st.CASNummer == "" {
				melde(fmt.Sprintf("stoffe[%d].casNummer", i), "warnung",
					"Besorgniserregender Stoff ohne CAS-Nummer: "+st.Name,
					"Ein Name ist mehrdeutig, eine CAS-Nummer nicht. "+
						"Genau diese Angabe braucht der Verwerter.")
			}
		}
		// Eine Summe knapp ueber 100 ist Rundung, eine deutlich darueber
		// ein Fehler. Unter 100 ist erlaubt: nicht jeder gibt alles an.
		if summe > 100.5 {
			melde("stoffe", "fehler",
				fmt.Sprintf("Die Anteile ergeben zusammen %.1f %%.", summe),
				"Mehr als hundert Prozent eines Produkts gibt es nicht.")
		}
	}

	// --- Nutzung und Ende ---
	if p.Reparatur == "" && p.Ersatzteile == "" {
		melde("reparatur", "warnung", "Nichts zu Reparatur und Ersatzteilen.",
			"Die Reparierbarkeit ist der Kern der Oekodesign-Verordnung. "+
				"Ein Pass, der dazu schweigt, verfehlt seinen Zweck.")
	}
	if p.Entsorgung == "" && p.Ruecknahme == "" {
		melde("entsorgung", "warnung", "Nichts zu Ruecknahme und Entsorgung.",
			"Am Ende steht jemand mit dem Produkt in der Hand und weiss nicht wohin.")
	}
	if p.Reparatur != "" || p.Ersatzteile != "" || p.Entsorgung != "" || p.Ruecknahme != "" {
		erfuellt++
	}

	// --- Belege ---
	for i, b := range p.Belege {
		if strings.TrimSpace(b.URL) == "" {
			melde(fmt.Sprintf("belege[%d].url", i), "fehler",
				"Beleg ohne Verweis: "+b.Titel, "")
			continue
		}
		if !strings.HasPrefix(b.URL, "https://") {
			melde(fmt.Sprintf("belege[%d].url", i), "warnung",
				"Beleg ohne https: "+b.Titel,
				"Ein Pass, der auf ungesicherte Dokumente zeigt, ist unterwegs veraenderbar.")
		}
	}
	if len(p.Belege) == 0 {
		melde("belege", "hinweis", "Keine Belege hinterlegt.",
			"Konformitaetserklaerung, Pruefbericht und Anleitung gehoeren hierher.")
	}

	u.Anteil = erfuellt * 100 / len(abschnitte)
	u.Tragfaehig = true
	for _, f := range u.Befunde {
		if f.Schwere == "fehler" {
			u.Tragfaehig = false
			break
		}
	}
	return u
}
