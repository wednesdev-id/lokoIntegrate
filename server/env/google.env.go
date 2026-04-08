package env

import "os"

func GetGoogleKey() string {
	value := os.Getenv("GOOGLE_OAUTH_CLIENT_ID")
	if value == "" {
		value = ""
	}
	return value
}

func GetGoogleSecret() string {
	value := os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")
	if value == "" {
		value = ""
	}
	return value
}

func GetGoogleCallback() string {
	value := os.Getenv("GOOGLE_OAUTH_REDIRECT_URL")
	if value == "" {
		value = ""
	}
	return value
}