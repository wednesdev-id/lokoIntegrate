package dto

type AuthEncryptBody struct {
	Text string `json:"text"`
}
type AuthDecryptBody struct {
	EncryptedText string `json:"encrypted_text"`
}

type AuthRegisterBody struct {
	Name     string  `json:"name" bson:"name"`
	Username string  `json:"username" bson:"username"`
	Email    *string `json:"email,omitempty" bson:"email,omitempty"`
	Password string  `json:"password" bson:"password"`
}

type AuthLoginBody struct {
	Username string `json:"username" bson:"username"` // Bisa berupa username atau email
	Password string `json:"password" bson:"password"`
}
