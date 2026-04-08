package model

import (
	"time"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

type Repository struct {
	ID primitive.ObjectID `bson:"_id,omitempty" json:"id,omitempty"`

	UserID primitive.ObjectID `bson:"user_id" json:"user_id"`

	Provider string `bson:"provider" json:"provider"`

	RepoURL   string `bson:"repo_url" json:"repo_url"`
	Name      string `bson:"name" json:"name"`
	Owner     string `bson:"owner" json:"owner"`
	LocalPath string `bson:"local_path" json:"local_path"`

	DefaultBranch string `bson:"default_branch,omitempty" json:"default_branch,omitempty"`

	LastSyncedAt *time.Time `bson:"last_synced_at,omitempty" json:"last_synced_at,omitempty"`
	IsPrivate    bool       `bson:"is_private" json:"is_private"`

	CreatedAt time.Time `bson:"created_at" json:"created_at"`
	UpdatedAt time.Time `bson:"updated_at" json:"updated_at"`
}
