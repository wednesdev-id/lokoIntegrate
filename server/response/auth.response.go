package response

import (
	"time"

	"github.com/google/uuid"
)

type ResponseAuthTokenValidation struct {
	Name                  string     `json:"name"`
	RoleCode              string     `json:"role_code"`
	UserID                string     `json:"user_id"`
	Username              string     `json:"username"`
	SubscriptionPackageID *uuid.UUID `json:"subscription_package_id,omitempty"`
	SubscriptionExpiredAt *time.Time `json:"subscription_expired_at,omitempty"`
}
