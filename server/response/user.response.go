package response

type ResponseUserMapping struct {
	// from sso
	Provider         string `json:"provider"`
	Email            string `json:"email"`
	Name             string `json:"name"`
	FirstName        string `json:"first_name"`
	LastName         string `json:"last_name"`
	Nickname         string `json:"nickname"`
	Description      string `json:"description"`
	UserID           string `json:"user_id"`
	AvatarURL        string `json:"avatar_url"`
	Location         string `json:"location"`
	IsSubmitRegister bool   `json:"is_submit_register"`

	RoleCode   string  `json:"role_code"`
	IsRegister bool    `json:"is_register"` // jika login by email / baru, maka auto true
	IsActive   bool    `json:"is_active"`
	CreatedAt  string  `json:"created_at"`
	UpdatedAt  *string `json:"updated_at,omitempty"`
}

// ----------------------------------------------------------------------------- //

type ResponseUserCheckUserIdExist struct {
	Success bool                `json:"success"`
	Message string              `json:"message,omitempty"`
	ID      string              `json:"id,omitempty"`
	Data    ResponseUserMapping `json:"data,omitempty"`
}

type ResponseGetUserByEmail struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`

	Data ResponseUserMapping `json:"data,omitempty"`
}

type ResponseUserRegisterSSO struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}