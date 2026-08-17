// Package wix spricht die Wix-REST-Schnittstellen an.
//
// Anmeldung über einen Account-API-Schlüssel. Jeder Aufruf trägt den Kopf
// wix-site-id und läuft damit auf der Site der jeweiligen Kundin.
package wix

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const basis = "https://www.wixapis.com"

// Client hält den API-Schlüssel und führt die Aufrufe aus.
type Client struct {
	schluessel string
	http       *http.Client
	basis      string
}

// NeuerClient legt einen Client an. Der Schlüssel darf nicht leer sein —
// ein leerer Schlüssel führt sonst erst beim ersten Aufruf zu einem 401,
// und zwar ohne erkennbaren Grund.
func NeuerClient(schluessel string) (*Client, error) {
	if strings.TrimSpace(schluessel) == "" {
		return nil, errors.New("wix: kein API-Schlüssel gesetzt (KANALWERK_WIX_SCHLUESSEL)")
	}
	return &Client{
		schluessel: schluessel,
		http:       &http.Client{Timeout: 30 * time.Second},
		basis:      basis,
	}, nil
}

// MitBasis richtet den Client auf eine andere Adresse — für Tests.
func (c *Client) MitBasis(u string) *Client {
	kopie := *c
	kopie.basis = u
	return &kopie
}

// Fehler ist ein Fehler, den die Wix-Schnittstelle gemeldet hat.
//
// Der Anwendungscode `Code` ist wichtiger als der HTTP-Status: die
// Publisher-Schnittstelle liefert für „nie verbunden" und „Verbindung
// erloschen" beide 400, unterscheidet sie aber im Code. Diese
// Unterscheidung trägt den Kanalzustand und darf nicht verlorengehen.
type Fehler struct {
	Status  int
	Code    string
	Meldung string
	Roh     string
}

func (f *Fehler) Error() string {
	if f.Code != "" {
		return fmt.Sprintf("wix: %s (HTTP %d): %s", f.Code, f.Status, f.Meldung)
	}
	return fmt.Sprintf("wix: HTTP %d: %s", f.Status, f.Meldung)
}

// Voruebergehend sagt, ob ein erneuter Versuch Sinn hat.
func (f *Fehler) Voruebergehend() bool {
	return f.Status == 429 || f.Status >= 500
}

// CodeVon zieht den Anwendungscode aus einem Fehler, falls vorhanden.
func CodeVon(err error) string {
	var f *Fehler
	if errors.As(err, &f) {
		return f.Code
	}
	return ""
}

type fehlerHuelle struct {
	Message   string `json:"message"`
	ErrorCode int    `json:"errorCode"`
	Details   struct {
		ApplicationError struct {
			Code        string `json:"code"`
			Description string `json:"description"`
		} `json:"applicationError"`
	} `json:"details"`
}

// Ruf führt einen Aufruf gegen eine Site aus und legt die Antwort in ziel ab.
// rumpf darf nil sein.
func (c *Client) Ruf(ctx context.Context, methode, pfad, siteID string, rumpf, ziel any) error {
	var leser io.Reader
	if rumpf != nil {
		b, err := json.Marshal(rumpf)
		if err != nil {
			return fmt.Errorf("wix: Rumpf konnte nicht kodiert werden: %w", err)
		}
		leser = bytes.NewReader(b)
	}

	anfrage, err := http.NewRequestWithContext(ctx, methode, c.basis+pfad, leser)
	if err != nil {
		return fmt.Errorf("wix: Anfrage konnte nicht gebaut werden: %w", err)
	}
	anfrage.Header.Set("Authorization", c.schluessel)
	anfrage.Header.Set("wix-site-id", siteID)
	anfrage.Header.Set("Accept", "application/json")
	if rumpf != nil {
		anfrage.Header.Set("Content-Type", "application/json")
	}

	antwort, err := c.http.Do(anfrage)
	if err != nil {
		return fmt.Errorf("wix: Aufruf fehlgeschlagen: %w", err)
	}
	defer antwort.Body.Close()

	// Begrenzt lesen: eine unerwartet riesige Antwort darf den Dienst nicht umbringen.
	roh, err := io.ReadAll(io.LimitReader(antwort.Body, 8<<20))
	if err != nil {
		return fmt.Errorf("wix: Antwort konnte nicht gelesen werden: %w", err)
	}

	if antwort.StatusCode < 200 || antwort.StatusCode >= 300 {
		f := &Fehler{Status: antwort.StatusCode, Roh: string(roh), Meldung: string(roh)}
		var h fehlerHuelle
		if json.Unmarshal(roh, &h) == nil {
			if h.Message != "" {
				f.Meldung = h.Message
			}
			f.Code = h.Details.ApplicationError.Code
		}
		return f
	}

	if ziel == nil || len(roh) == 0 {
		return nil
	}
	if err := json.Unmarshal(roh, ziel); err != nil {
		return fmt.Errorf("wix: Antwort konnte nicht ausgewertet werden: %w", err)
	}
	return nil
}
