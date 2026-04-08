package auth

import (
	"crypto/rand"
	"loko/server/env"
	"encoding/base64"
	"errors"
	"fmt"
	"io"

	"github.com/gofiber/fiber/v2"
	"github.com/markbates/goth"
	"github.com/markbates/goth/providers/google"
)

type Goth struct{}

func (ref Goth) Init() {
	google_key := env.GetGoogleKey()
	google_secret := env.GetGoogleSecret()
	google_callback := env.GetGoogleCallback()

	goth.UseProviders(
		google.New(google_key, google_secret, google_callback, "email", "profile"),
	)
}

func (ref Goth) GetAuthURL(ctx *fiber.Ctx) (string, error) {
	providerName, err := getProviderName(ctx)
	if err != nil {
		return "", err
	}

	provider, err := goth.GetProvider(providerName)
	if err != nil {
		return "", err
	}

	sess, err := provider.BeginAuth(setState(ctx))
	if err != nil {
		return "", err
	}

	url, err := sess.GetAuthURL()
	if err != nil {
		return "", err
	}

	return url, err
}

// func (ref Goth) CompleteUserAuth(ctx *fiber.Ctx) (goth.User, error) {
// 	providerName, err := getProviderName(ctx)
// 	if err != nil {
// 		return goth.User{}, err
// 	}
// 	fmt.Printf("providerName: %s\n", providerName)

// 	provider, err := goth.GetProvider(providerName)
// 	if err != nil {
// 		return goth.User{}, err
// 	}
// 	fmt.Printf("provider: %s\n", provider)

// 	sess, err := provider.UnmarshalSession(setState(ctx))
// 	if err != nil {
// 		return goth.User{}, err
// 	}
// 	fmt.Printf("sess: %s\n", sess)

// 	gu, err := provider.FetchUser(sess)
// 	return gu, err
// }

// Custom Params type that implements goth.Params
type CustomParams map[string]string

// Implement the Get method required by the goth.Params interface
func (p CustomParams) Get(key string) string {
	return p[key]
}

func (ref Goth) CompleteUserAuth(ctx *fiber.Ctx) (goth.User, error) {
	providerName, err := getProviderName(ctx)
	if err != nil {
		return goth.User{}, err
	}

	provider, err := goth.GetProvider(providerName)
	if err != nil {
		return goth.User{}, err
	}

	state := ctx.Query("state")
	fmt.Printf("Received state: %s\n", state)

	// Tukar kode otorisasi dengan token
	code := ctx.Query("code")
	fmt.Printf("Received code: %s\n", code) // Log tambahan
	if code == "" {
		fmt.Println("Error: No code in request") // Log tambahan
		return goth.User{}, errors.New("no code in request")
	}

	// Ambil sesi dari `code` (tanpa UnmarshalSession)
	// Pastikan state yang digunakan di sini konsisten dengan yang dikirim ke Google
	sess, err := provider.BeginAuth(state) // Menggunakan state yang diterima dari query
	if err != nil {
		fmt.Printf("Error failed to start auth session: %v\n", err) // Log tambahan
		return goth.User{}, fmt.Errorf("failed to start auth session: %w", err)
	}
	fmt.Printf("Auth session started: %+v\n", sess) // Log tambahan

	// Authorize session dengan code dari query
	params := CustomParams{"code": code}
	_, err = sess.Authorize(provider, params)
	if err != nil {
		fmt.Printf("Error failed to authorize session: %v\n", err) // Log tambahan
		return goth.User{}, fmt.Errorf("failed to authorize session: %w", err)
	}
	fmt.Println("Session authorized successfully") // Log tambahan

	// Ambil informasi pengguna setelah token diterima
	user, err := provider.FetchUser(sess)
	if err != nil {
		fmt.Printf("Error failed to fetch user: %v\n", err) // Log tambahan
		return goth.User{}, fmt.Errorf("failed to fetch user: %w", err)
	}
	fmt.Printf("User fetched successfully: %+v\n", user) // Log tambahan

	return user, nil
}

// functions

func getProviderName(ctx *fiber.Ctx) (string, error) {
	// try to get it from the url param ":provider"
	provider_name := ctx.Params("provider")
	if provider_name != "" {
		return provider_name, nil
	}

	// As a fallback, loop over the used providers, if we already have a valid session for any provider (ie. user has already begun authentication with a provider), then return that provider name
	providers := goth.GetProviders()
	for _, provider := range providers {
		if p := provider.Name(); p != "" {
			if provider_name == provider.Name() {
				return p, nil
			}
		}
	}

	// if not found then return an empty string with the corresponding error
	return "", errors.New("you must select a provider")
}

func setState(ctx *fiber.Ctx) string {
	state := ctx.Query("state")
	if len(state) > 0 {
		return state
	}

	// If a state query param is not passed in, generate a random
	// base64-encoded nonce so that the state on the auth URL
	// is unguessable, preventing CSRF attacks, as described in
	//
	// https://auth0.com/docs/protocols/oauth2/oauth-state#keep-reading
	nonceBytes := make([]byte, 64)
	_, err := io.ReadFull(rand.Reader, nonceBytes)
	if err != nil {
		panic("gothic: source of randomness unavailable: " + err.Error())
	}
	return base64.URLEncoding.EncodeToString(nonceBytes)
}
