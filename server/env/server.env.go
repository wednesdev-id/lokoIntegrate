package env

import (
	"os"
)

func GetServerName() string {
	value := os.Getenv("SERVER_NAME")
	if value == "" {
		value = "P34C3_KHYREIN"
	}
	return value
}

func GetEnvironment() string {
	value := os.Getenv("ENVIRONMENT")
	if value == "" {
		value = "development"
	}
	return value
}

func GetServerPort() string {
	value := os.Getenv("SERVER_PORT")
	if value == "" {
		value = "1234"
	}
	return value
}

func GetSecretKey() string {
	value := os.Getenv("SECRET_KEY")
	if value == "" {
		value = "your_secret_key"
	}
	return value
}


// adding googgle login
func GetGoogleOauthClientID() string {
    return os.Getenv("GOOGLE_OAUTH_CLIENT_ID")
}

func GetGoogleOauthClientSecret() string {
    return os.Getenv("GOOGLE_OAUTH_CLIENT_SECRET")
}

func GetGoogleOauthRedirectURL() string {
    value := os.Getenv("GOOGLE_OAUTH_REDIRECT_URL")
    // Tambahkan default jika perlu, misal:
    if value == "" {
        value = "http://localhost:" + GetServerPort() + "/api/auth/google/callback" // Sesuaikan port default
    }
    return value
}