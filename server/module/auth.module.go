package module

import (
	"errors"
	"log"
	"time"

	"loko/server/connection"
	"loko/server/dto"
	"loko/server/enigma"
	"loko/server/model"
	"loko/server/util"
	"loko/server/variable"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type Auth struct{}

func (ref Auth) Route(api fiber.Router) {
	handler := AuthHandler{}

	auth := api.Group("/auth")
	auth.Post("/login", handler.Login)
	auth.Post("/register", handler.Register)
	auth.Get("/token-validation", handler.ValidateToken)
	auth.Post("/encrypt", handler.Encrypt)
	auth.Post("/decrypt", handler.Decrypt)

	// Google SSO Routes
	auth.Get("/sso/:provider", handler.SSOLogin)
	auth.Get("/:provider/callback", handler.SSOCallback)
}

type AuthHandler struct{}

func (handler AuthHandler) Login(c *fiber.Ctx) error {
	var body model.UserLoginBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	// Connect to PostgreSQL
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		log.Printf("Database connection error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Database connection failed",
		})
	}

	// Find user by username using GORM
	var user model.User
	err = db.Where("username = ?", body.Username).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
				"message": "Invalid credentials",
			})
		}
		log.Printf("Database error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Database error",
		})
	}

	// Verify password
	if !util.CheckPasswordHash(body.Password, user.Password) {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid credentials",
		})
	}

	// Generate JWT token using util.JWT
	jwtUtil := util.JWT{}
	email := ""
	if user.Email != nil {
		email = *user.Email
	}

	token_string, _, err := jwtUtil.Generate(
		user.ID.String(),
		email,
		user.Name,
		user.Name, // firstName
		user.Name, // lastName
		user.RoleID,
	)
	if err != nil {
		log.Printf("JWT generation error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Token generation failed",
		})
	}

	return c.JSON(fiber.Map{
		"token": token_string,
		"user":  user,
	})
}

func (handler AuthHandler) Register(c *fiber.Ctx) error {
	var body model.UserRegisterBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	// Connect to PostgreSQL
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		log.Printf("Database connection error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Database connection failed",
		})
	}

	// Check if user already exists
	var existingUser model.User
	err = db.Where("username = ?", body.Username).First(&existingUser).Error
	if err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{
			"message": "User already exists",
		})
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("Database error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Database error",
		})
	}

	// Hash password
	hashedPassword, err := util.HashPassword(body.Password)
	if err != nil {
		log.Printf("Password hashing error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Password hashing failed",
		})
	}

	// Check for Promo or Affiliate codes
	var promo model.PromoCode
	var affiliate model.AffiliateCode
	var pkg model.SubscriptionPackage

	if body.PromoCode != "" {
		if err := db.Where("code = ? AND is_active = ?", body.PromoCode, true).First(&promo).Error; err == nil {
			// Check date
			now := time.Now()
			if now.After(promo.StartDate) && now.Before(promo.EndDate) {
				if promo.MaxUses == 0 || promo.UsedCount < promo.MaxUses {
					if promo.PackageID != nil {
						db.Where("id = ?", *promo.PackageID).First(&pkg)
					}
				}
			}
		}
	}

	if body.AffiliateCode != "" && pkg.ID == uuid.Nil {
		if err := db.Where("code = ? AND is_active = ?", body.AffiliateCode, true).First(&affiliate).Error; err == nil {
			// Affiliate restricts or can grant discount rate too? For now just log if found.
		}
	}

	// Create new user with 'customer' role by default
	user := model.User{
		Name:            body.Name,
		Username:        body.Username,
		Password:        hashedPassword,
		BusinessAddress: body.BusinessAddress,
		BusinessSector:  body.BusinessSector,
		RoleID:          variable.Customer, // Default role is 'customer'
		IsVerify:        true,
		IsActive:        true,
		Provider:        "email",
		Credits:         0.0,
		ProjectCount:    0,
		MaxProjects:     1,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if pkg.ID != uuid.Nil {
		now := time.Now()
		expiresAt := now.Add(time.Duration(pkg.DurationDays) * 24 * time.Hour)
		user.SubscriptionPackageID = &pkg.ID
		user.SubscriptionExpiredAt = &expiresAt
		user.BroadcastQuota = pkg.BroadcastLimit
		user.AIQuota = pkg.AILimit
	}

	// Start Transaction
	tx := db.Begin()

	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		log.Printf("User creation error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "User creation failed",
		})
	}

	// Log SubscriptionTransaction if package applied
	if pkg.ID != uuid.Nil {
		discountAmount := 0.0
		if promo.ID != uuid.Nil {
			if promo.DiscountType == "percent" {
				discountAmount = (pkg.Price * promo.DiscountValue) / 100
			} else {
				discountAmount = promo.DiscountValue
			}
			// Increment promo usage
			tx.Model(&promo).UpdateColumn("used_count", gorm.Expr("used_count + ?", 1))
		}

		actualPaid := pkg.Price - discountAmount
		if actualPaid < 0 {
			actualPaid = 0
		}

		commission := 0.0
		var affiliateID *uuid.UUID
		if affiliate.ID != uuid.Nil {
			commission = (actualPaid * affiliate.CommissionRate) / 100
			affiliateID = &affiliate.UserID
		}

		transaction := model.SubscriptionTransaction{
			UserID:              user.ID,
			PackageID:           pkg.ID,
			OriginalPrice:       pkg.Price,
			DiscountAmount:      discountAmount,
			ActualPaid:          actualPaid,
			PromoCode:           body.PromoCode,
			AffiliateID:         affiliateID,
			AffiliateCommission: commission,
			CreatedAt:           time.Now(),
		}

		if err := tx.Create(&transaction).Error; err != nil {
			tx.Rollback()
			log.Printf("Transaction log error: %v", err)
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "Failed to log subscription transaction",
			})
		}
	}

	tx.Commit()

	return c.JSON(fiber.Map{
		"message": "User registered successfully",
		"user":    user,
	})
}

func (handler AuthHandler) Encrypt(c *fiber.Ctx) error {
	var body dto.AuthEncryptBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	encrypted, err := enigma.Encrypt(body.Text)
	if err != nil {
		log.Printf("Encryption error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Encryption failed",
		})
	}

	return c.JSON(fiber.Map{
		"encrypted_text": encrypted,
	})
}

func (handler AuthHandler) Decrypt(c *fiber.Ctx) error {
	var body dto.AuthDecryptBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
			"message": "Invalid request body",
		})
	}

	decrypted, err := enigma.Decrypt(body.EncryptedText)
	if err != nil {
		log.Printf("Decryption error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Decryption failed",
		})
	}

	return c.JSON(fiber.Map{
		"text": decrypted,
	})
}

// ValidateToken validates JWT token from Authorization header
func (handler AuthHandler) ValidateToken(c *fiber.Ctx) error {
	// Get token from Authorization header
	authorization := c.Get("Authorization")
	if authorization == "" {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Authorization header required",
		})
	}

	// Extract token (remove "Bearer " prefix)
	var tokenString string
	if len(authorization) > 7 && authorization[:7] == "Bearer " {
		tokenString = authorization[7:]
	} else {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Invalid authorization format",
		})
	}

	// Validate token using JWT util
	jwtUtil := util.JWT{}
	claims, err := jwtUtil.Validate(tokenString)
	if err != nil {
		log.Printf("Token validation error: %v", err)
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{
			"message": "Token tidak valid",
		})
	}

	// Return user info from claims
	userID, _ := claims["user_id"].(string)

	// Query DB for up-to-date subscription status
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err == nil {
		var user model.User
		if err := db.Preload("SubscriptionPackage").Where("id = ?", userID).First(&user).Error; err == nil {
			activeModules := ""
			maxSessions := 1
			if user.SubscriptionPackage != nil {
				activeModules = user.SubscriptionPackage.ActiveModules
				maxSessions = user.SubscriptionPackage.MaxSessions
			}
			return c.JSON(fiber.Map{
				"user_id":                 user.ID.String(),
				"username":                user.Username,
				"name":                    user.Name,
				"role_code":               user.RoleID,
				"subscription_package_id": user.SubscriptionPackageID,
				"subscription_expired_at": user.SubscriptionExpiredAt,
				"active_modules":          activeModules,
				"max_sessions":            maxSessions,
				"business_address":        user.BusinessAddress,
				"business_sector":         user.BusinessSector,
			})
		}
	}

	// Fallback to claims if DB fails (shouldn't happen often)
	email, _ := claims["email"].(string)
	name, _ := claims["name"].(string)
	roleCode, _ := claims["role_code"].(string)

	return c.JSON(fiber.Map{
		"user_id":   userID,
		"username":  email, // Using email as username
		"name":      name,
		"role_code": roleCode,
	})
}

// SSOLogin redirects to the provider's auth page
func (handler AuthHandler) SSOLogin(c *fiber.Ctx) error {
	gothAuth := auth.Goth{}
	url, err := gothAuth.GetAuthURL(c)
	if err != nil {
		log.Printf("Goth Auth URL error: %v", err)
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
			"message": "Failed to get auth URL",
		})
	}
	return c.Redirect(url)
}

// SSOCallback handles the provider's callback
func (handler AuthHandler) SSOCallback(c *fiber.Ctx) error {
	gothAuth := auth.Goth{}
	gothUser, err := gothAuth.CompleteUserAuth(c)
	if err != nil {
		log.Printf("Goth callback error: %v", err)
		return c.Redirect("http://localhost:3000/login?error=auth_failed")
	}

	// Connect to PostgreSQL
	sql := connection.SQL{}
	db, err := sql.Connect()
	if err != nil {
		log.Printf("Database connection error: %v", err)
		return c.Redirect("http://localhost:3000/login?error=db_error")
	}

	// Find or Create User
	var user model.User
	err = db.Where("username = ?", gothUser.Email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Create new user for first time SSO
			user = model.User{
				Name:         gothUser.Name,
				Username:     gothUser.Email,
				Email:        &gothUser.Email,
				RoleID:       variable.Customer,
				IsVerify:     true,
				IsActive:     true,
				Provider:     "google",
				Credits:      0.0,
				ProjectCount: 0,
				MaxProjects:  1,
				CreatedAt:    time.Now(),
				UpdatedAt:    time.Now(),
			}
			if err := db.Create(&user).Error; err != nil {
				log.Printf("Failed to create SSO user: %v", err)
				return c.Redirect("http://localhost:3000/login?error=user_creation_failed")
			}
		} else {
			log.Printf("Database error: %v", err)
			return c.Redirect("http://localhost:3000/login?error=db_error")
		}
	}

	// Generate JWT token
	jwtUtil := util.JWT{}
	email := ""
	if user.Email != nil {
		email = *user.Email
	}

	token_string, _, err := jwtUtil.Generate(
		user.ID.String(),
		email,
		user.Name,
		user.Name,
		user.Name,
		user.RoleID,
	)
	if err != nil {
		log.Printf("JWT generation error: %v", err)
		return c.Redirect("http://localhost:3000/login?error=token_failed")
	}

	// Redirect to frontend with token
	return c.Redirect("http://localhost:3000/login?token=" + token_string)
}
