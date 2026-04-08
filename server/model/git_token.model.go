package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type GitToken struct {
	ID primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`
	UserID primitive.ObjectID `bson:"user_id" json:"user_id"` 
	Provider string `bson:"provider" json:"provider"`
	AccessToken string `bson:"access_token" json:"access_token"`
	RefreshToken string `bson:"refresh_token,omitempty" json:"refresh_token,omitempty"` 
	ExpiresAt *time.Time `bson:"expires_at,omitempty" json:"expires_at,omitempty"`
	Scopes []string `bson:"scopes,omitempty" json:"scopes,omitempty"`
	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}


// 