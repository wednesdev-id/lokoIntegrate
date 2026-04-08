package module

import (
	"loko/server/connection"
	"loko/server/middleware"
	"loko/server/model"
	"loko/server/util"
	"loko/server/variable"
	"math"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type User struct{}

func (ref User) Route(api fiber.Router) {
	handler := UserHandler{}

	// All user routes require authentication + super_admin role
	user := api.Group("/users", middleware.UseAuth, middleware.RoleAccess([]string{variable.SuperAdmin}))

	// List & paginate
	user.Get("/", handler.ListUsers)
	user.Get("/paginate", handler.PaginateUsers)

	// CRUD
	user.Post("/new", handler.CreateUser)
	user.Get("/detail/:id", handler.GetUser)
	user.Put("/edit/:id", handler.UpdateUser)
	user.Delete("/remove/:id", handler.DeleteUser)

	// Quota & Subscription
	user.Put("/:id/quota", handler.UpdateQuota)
	user.Post("/:id/subscribe", handler.AssignSubscription)
}

type UserHandler struct{}

// --- helpers ---

func dbConnect() (*gorm.DB, error) {
	sql := connection.SQL{}
	return sql.Connect()
}

func superAdminOnly(c *fiber.Ctx) bool {
	rc, _ := c.Locals("role_code").(string)
	return rc == variable.SuperAdmin
}

// --- ListUsers (flat, no pagination) ---
func (handler UserHandler) ListUsers(c *fiber.Ctx) error {
	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var users []model.UserResponse
	if err := db.Model(&model.User{}).Find(&users).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve users"})
	}

	return c.JSON(fiber.Map{"users": users})
}

// --- PaginateUsers (paginated) ---
func (handler UserHandler) PaginateUsers(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "10"))
	search := c.Query("search", "")

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 10
	}
	offset := (page - 1) * limit

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	query := db.Model(&model.User{})
	if search != "" {
		like := "%" + search + "%"
		query = query.Where("name ILIKE ? OR username ILIKE ? OR email::text ILIKE ?", like, like, like)
	}

	var total int64
	query.Count(&total)

	var users []model.User
	if err := query.Preload("SubscriptionPackage").Offset(offset).Limit(limit).Order("created_at DESC").Find(&users).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to retrieve users", "error": err.Error()})
	}

	var userResponses []model.UserResponse
	for _, u := range users {
		userResponses = append(userResponses, model.UserResponse{
			ID:                    u.ID,
			Name:                  u.Name,
			Email:                 u.Email,
			Username:              u.Username,
			IsVerify:              u.IsVerify,
			IsActive:              u.IsActive,
			RoleID:                u.RoleID,
			Credits:               u.Credits,
			AIQuota:               u.AIQuota,
			ProjectCount:          u.ProjectCount,
			MaxProjects:           u.MaxProjects,
			BroadcastQuota:        u.BroadcastQuota,
			SubscriptionPackageID: u.SubscriptionPackageID,
			SubscriptionPackage:   u.SubscriptionPackage,
			SubscriptionExpiredAt: u.SubscriptionExpiredAt,
			CreatedAt:             u.CreatedAt,
		})
	}

	totalPages := int(math.Ceil(float64(total) / float64(limit)))

	return c.JSON(fiber.Map{
		"data":        userResponses,
		"total":       total,
		"page":        page,
		"limit":       limit,
		"total_pages": totalPages,
	})
}

// --- GetUser ---
func (handler UserHandler) GetUser(c *fiber.Ctx) error {
	userID := c.Params("id")

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	var user model.UserResponse
	var userDB model.User
	if err := db.Model(&model.User{}).Preload("SubscriptionPackage").Where("id = ?", userID).First(&userDB).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "User not found"})
	}

	user = model.UserResponse{
		ID:                    userDB.ID,
		Name:                  userDB.Name,
		Email:                 userDB.Email,
		Username:              userDB.Username,
		IsVerify:              userDB.IsVerify,
		IsActive:              userDB.IsActive,
		RoleID:                userDB.RoleID,
		Credits:               userDB.Credits,
		AIQuota:               userDB.AIQuota,
		ProjectCount:          userDB.ProjectCount,
		MaxProjects:           userDB.MaxProjects,
		BroadcastQuota:        userDB.BroadcastQuota,
		SubscriptionPackageID: userDB.SubscriptionPackageID,
		SubscriptionPackage:   userDB.SubscriptionPackage,
		SubscriptionExpiredAt: userDB.SubscriptionExpiredAt,
		CreatedAt:             userDB.CreatedAt,
	}

	return c.JSON(user)
}

// --- CreateUser ---
type CreateUserBody struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	RoleID   string `json:"role_id"`
	IsActive bool   `json:"is_active"`
	IsVerify bool   `json:"is_verify"`
	AIQuota  int    `json:"ai_quota"`
}

func (handler UserHandler) CreateUser(c *fiber.Ctx) error {
	var body CreateUserBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	if body.Name == "" || body.Username == "" || body.Password == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Name, username, and password are required"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	// Check duplicate username
	var existing model.User
	if err := db.Where("username = ?", body.Username).First(&existing).Error; err == nil {
		return c.Status(fiber.StatusConflict).JSON(fiber.Map{"message": "Username already exists"})
	}

	hashedPass, err := util.HashPassword(body.Password)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Password hashing failed"})
	}

	roleID := body.RoleID
	if roleID == "" {
		roleID = variable.Customer
	}

	var emailPtr *string
	if body.Email != "" {
		emailPtr = &body.Email
	}

	newUser := model.User{
		Name:      body.Name,
		Username:  body.Username,
		Email:     emailPtr,
		Password:  hashedPass,
		RoleID:    roleID,
		IsVerify:  body.IsVerify,
		IsActive:  body.IsActive,
		AIQuota:   body.AIQuota,
		Provider:  "email",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := db.Create(&newUser).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to create user"})
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message": "User created successfully",
		"user": model.UserResponse{
			ID:       newUser.ID,
			Name:     newUser.Name,
			Username: newUser.Username,
			Email:    newUser.Email,
			RoleID:   newUser.RoleID,
			IsActive: newUser.IsActive,
			IsVerify: newUser.IsVerify,
			AIQuota:  newUser.AIQuota,
		},
	})
}

// --- UpdateUser ---
type UpdateUserBody struct {
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	RoleID   string `json:"role_id"`
	IsActive *bool  `json:"is_active"`
	IsVerify *bool  `json:"is_verify"`
	AIQuota  *int   `json:"ai_quota"`
}

func (handler UserHandler) UpdateUser(c *fiber.Ctx) error {
	userID := c.Params("id")

	var body UpdateUserBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	uid, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid user ID"})
	}

	var user model.User
	if err := db.Where("id = ?", uid).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "User not found"})
	}

	if body.Name != "" {
		user.Name = body.Name
	}
	if body.Username != "" {
		user.Username = body.Username
	}
	if body.Email != "" {
		user.Email = &body.Email
	}
	if body.RoleID != "" {
		user.RoleID = body.RoleID
	}
	if body.IsActive != nil {
		user.IsActive = *body.IsActive
	}
	if body.IsVerify != nil {
		user.IsVerify = *body.IsVerify
	}
	if body.AIQuota != nil {
		user.AIQuota = *body.AIQuota
	}
	if body.Password != "" {
		hashed, err := util.HashPassword(body.Password)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Password hashing failed"})
		}
		user.Password = hashed
	}
	user.UpdatedAt = time.Now()

	if err := db.Save(&user).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update user"})
	}

	return c.JSON(fiber.Map{
		"message": "User updated successfully",
		"user": model.UserResponse{
			ID:       user.ID,
			Name:     user.Name,
			Username: user.Username,
			Email:    user.Email,
			RoleID:   user.RoleID,
			IsActive: user.IsActive,
			IsVerify: user.IsVerify,
			AIQuota:  user.AIQuota,
		},
	})
}

// --- DeleteUser ---
func (handler UserHandler) DeleteUser(c *fiber.Ctx) error {
	userID := c.Params("id")

	// Prevent self-deletion
	currentUserID, _ := c.Locals("user_id").(string)
	if currentUserID == userID {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Cannot delete your own account"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	result := db.Where("id = ?", userID).Delete(&model.User{})
	if result.Error != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to delete user"})
	}
	if result.RowsAffected == 0 {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "User not found"})
	}

	return c.JSON(fiber.Map{"message": "User deleted successfully"})
}

// --- UpdateQuota ---
type UpdateQuotaBody struct {
	AIQuota int `json:"ai_quota"`
}

func (handler UserHandler) UpdateQuota(c *fiber.Ctx) error {
	userID := c.Params("id")
	if userID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "User ID is required"})
	}

	var body UpdateQuotaBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	if err := db.Model(&model.User{}).Where("id = ?", userID).Update("ai_quota", body.AIQuota).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to update AI quota"})
	}

	return c.JSON(fiber.Map{"message": "AI Quota updated successfully"})
}

// --- AssignSubscription ---
type AssignSubscriptionBody struct {
	PackageID string `json:"package_id"`
}

func (handler UserHandler) AssignSubscription(c *fiber.Ctx) error {
	userID := c.Params("id")
	if userID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "User ID is required"})
	}

	var body AssignSubscriptionBody
	if err := c.BodyParser(&body); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid request body"})
	}

	db, err := dbConnect()
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Database connection failed"})
	}

	// Fetch target user
	uid, err := uuid.Parse(userID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid user ID"})
	}

	var user model.User
	if err := db.Where("id = ?", uid).First(&user).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "User not found"})
	}

	// Fetch subscription package
	pkgID, err := uuid.Parse(body.PackageID)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"message": "Invalid subscription package ID"})
	}

	var pkg model.SubscriptionPackage
	if err := db.Where("id = ?", pkgID).First(&pkg).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"message": "Subscription package not found"})
	}

	// Assign properties to user
	expiration := time.Now().Add(time.Duration(pkg.DurationDays) * 24 * time.Hour)

	updates := map[string]interface{}{
		"subscription_package_id": pkg.ID,
		"subscription_expired_at": expiration,
		"broadcast_quota":         pkg.BroadcastLimit,
		"ai_quota":                pkg.AILimit,
	}

	if err := db.Model(&user).Updates(updates).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"message": "Failed to assign subscription package"})
	}

	return c.JSON(fiber.Map{"message": "Subscription package assigned and quotas refilled successfully"})
}
