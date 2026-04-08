package env

import "os"

func GetAuthServiceURL() string {
	value := os.Getenv("AUTH_SERVICE")
	if value == "" {
		value = "http://localhost:2000"
	}
	return value
}

func GetCoreServiceURL() string {
	value := os.Getenv("CORE_SERVICE")
	if value == "" {
		value = "http://localhost:2020"
	}
	return value
}

func GetNotificationServiceURL() string {
	value := os.Getenv("NOTIFICATION_SERVICE")
	if value == "" {
		value = "http://localhost:2030"
	}
	return value
}

func GetAiServiceURL() string {
	value := os.Getenv("AI_SERVICE")
	if value == "" {
		value = "http://localhost:4000"
	}
	return value
}

func GetWebSocketServiceURL() string {
	value := os.Getenv("WEBSOCKET_SERVICE")
	if value == "" {
		value = "http://localhost:5000"
	}
	return value
}

func GetPaymentGatewayServiceURL() string {
	value := os.Getenv("PAYMENT_GATEWAY_SERVICE")
	if value == "" {
		value = "http://localhost:6000"
	}
	return value
}
