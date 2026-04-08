package dto

type DeviceDataResponse struct {
	DeviceID    string `json:"device_id"`
	UserAgent   string `json:"user_agent"`
	IpAddress   string `json:"ip_address"`
	IsBlocked   bool   `json:"is_blocked"`
	HasLogined  bool   `json:"has_logined"`
	LastLoginAt string `json:"last_login_at"`

	Users []DeviceUserDataResponse `json:"users,omitempty"`
}

type DeviceUserDataResponse struct {
	UserID      string `json:"user_id"`
	DeviceID    string `json:"device_id"`
	IsBlocked   bool   `json:"is_blocked"`
	HasLogined  bool   `json:"has_logined"`
	LastLoginAt string `json:"last_login_at"`

	Devices []DeviceDataResponse `json:"devices,omitempty"`
}