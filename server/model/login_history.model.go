package model

import "go.mongodb.org/mongo-driver/bson/primitive"

// -> main collection
type LoginHistory struct {
	ID        primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	UserID    string             `json:"user_id"       bson:"user_id"`
	JwtID     string             `json:"jti"           bson:"jti"`
	UserAgent string             `json:"user_agent"    bson:"user_agent"`
	IpAddress string             `json:"ip_address"    bson:"ip_address"`
	DeviceID  string             `json:"device_id"     bson:"device_id"`
	LoginAt   primitive.DateTime `json:"login_at"      bson:"login_at"`
	ExpiredAt primitive.DateTime `json:"expired_at"    bson:"expired_at"`
}
