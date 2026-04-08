package env

import "os"

func GetFirebaseURL() string {
	value := os.Getenv("FIREBASE_URL")
	if value == "" {
		value = "https://p34c3-khyrein-default-rtdb.asia-southeast1.firebasedatabase.app/"
	}
	return value
}
