package env

import "os"

func GetSsoCallbackFrontendHostname() string {
	value := os.Getenv("SSO_CALLBACK_FRONTEND_HOSTNAME")
	if value == "" {
		value = ""
	}
	return value
}