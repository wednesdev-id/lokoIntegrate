package model

import (
	"context"
	"loko/server/util"
	"loko/server/variable"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

type Device struct {
	ID primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`

	DeviceID  string `json:"device_id"   bson:"device_id"` // primary key
	UserAgent string `json:"user_agent"  bson:"user_agent"`
	IpAddress string `json:"ip_address"  bson:"ip_address"`

	IsBlocked  bool `json:"is_blocked"   bson:"is_blocked"`
	HasLogined bool `json:"has_logined"  bson:"has_logined"`

	LastLoginAt primitive.DateTime `json:"last_login_at"  bson:"last_login_at"`
}

type DeviceUser struct {
	ID primitive.ObjectID `json:"_id,omitempty"  bson:"_id,omitempty"`

	UserID   string `json:"user_id"    bson:"user_id"`   // primary key
	DeviceID string `json:"device_id"  bson:"device_id"` //  foreign key

	IsBlocked  bool `json:"is_blocked"   bson:"is_blocked"`
	HasLogined bool `json:"has_logined"  bson:"has_logined"`

	LastLoginAt primitive.DateTime `json:"last_login_at"  bson:"last_login_at"`
}

func DevicePaginate(c *fiber.Ctx, ctx context.Context, database *mongo.Database) ([]Device, int, int, int, error) {
	DeviceCollection := database.Collection(variable.DeviceColl)

	// Parse pagination parameters
	page, limit, sortBy, sortOrder := util.PaginationParseParams(c)

	// Define the filter for query (add your filter logic here)
	filter := bson.M{} // Add your custom filter if needed

	// Get paginated results as []Device
	results, err := util.PaginateGetResults[Device](ctx, DeviceCollection, page, limit, sortBy, sortOrder, filter)
	if err != nil {
		return nil, 0, 0, 0, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("paginate error: %s", err.Error()))
	}

	// Get total pages
	lastPage, err := util.PaginationGetTotalPages(ctx, DeviceCollection, filter, limit)
	if err != nil {
		return nil, 0, 0, 0, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("count documents error: %s", err.Error()))
	}

	return results, page, limit, lastPage, nil
}

func UserPaginate(c *fiber.Ctx, ctx context.Context, database *mongo.Database) ([]DeviceUser, int, int, int, error) {
	DeviceUserCollection := database.Collection(variable.DeviceUserColl)

	// Parse pagination parameters
	page, limit, sortBy, sortOrder := util.PaginationParseParams(c)

	// Define the filter for query (add your filter logic here)
	filter := bson.M{} // Add your custom filter if needed

	// Get paginated results as []DeviceUser
	results, err := util.PaginateGetResults[DeviceUser](ctx, DeviceUserCollection, page, limit, sortBy, sortOrder, filter)
	if err != nil {
		return nil, 0, 0, 0, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("paginate error: %s", err.Error()))
	}

	// Get total pages
	lastPage, err := util.PaginationGetTotalPages(ctx, DeviceUserCollection, filter, limit)
	if err != nil {
		return nil, 0, 0, 0, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("count documents error: %s", err.Error()))
	}

	return results, page, limit, lastPage, nil
}

func DeviceIn(c *fiber.Ctx, ctx context.Context, database *mongo.Database, devices []string) ([]Device, error) {
	if len(devices) == 0 {
		return []Device{}, nil
	}

	// Specify the collection
	DeviceCollection := database.Collection(variable.DeviceColl)

	// Define the struct to store the result
	deviceData := make([]Device, 0)

	// Query to find all documents
	cursor, err := DeviceCollection.Find(ctx, bson.M{
		"device_id": bson.M{"$in": devices},
	})
	if err != nil {
		return deviceData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error finding data: %s", err.Error()))
	}
	// Decode the cursor into the deviceData struct
	if err := cursor.All(ctx, &deviceData); err != nil {
		return deviceData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error decoding data: %s", err.Error()))
	}
	return deviceData, nil
}

func DeviceUserIn(c *fiber.Ctx, ctx context.Context, database *mongo.Database, users []string) ([]DeviceUser, error) {
	if len(users) == 0 {
		return []DeviceUser{}, nil
	}

	// Specify the collection
	DeviceUserCollection := database.Collection(variable.DeviceUserColl)

	// Define the struct to store the result
	userData := make([]DeviceUser, 0)

	// Query to find all documents
	cursor, err := DeviceUserCollection.Find(ctx, bson.M{
		"user_id": bson.M{"$in": users},
	})
	if err != nil {
		return userData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error finding data: %s", err.Error()))
	}
	// Decode the cursor into the userData struct
	if err := cursor.All(ctx, &userData); err != nil {
		return userData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error decoding data: %s", err.Error()))
	}
	return userData, nil
}

func DeviceInUserID(c *fiber.Ctx, ctx context.Context, database *mongo.Database, user_id string) ([]Device, error) {
	// Specify the collection
	DeviceUserCollection := database.Collection(variable.DeviceUserColl)

	// Define the struct to store the result
	deviceData := make([]Device, 0)
	deviceUserData := make([]DeviceUser, 0)

	// Query to find all documents
	cursor, err := DeviceUserCollection.Find(ctx, bson.M{
		"user_id": user_id,
	})
	if err != nil {
		return deviceData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error finding data: %s", err.Error()))
	}
	// Decode the cursor into the deviceUserData struct
	if cursorErr := cursor.All(ctx, &deviceUserData); cursorErr != nil {
		return deviceData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error decoding data: %s", cursorErr.Error()))
	}

	// get device_ids
	device_ids := make([]string, 0)
	for _, deviceUser := range deviceUserData {
		device_ids = append(device_ids, deviceUser.DeviceID)
	}
	if len(device_ids) == 0 {
		return deviceData, nil
	}

	// ===========================

	// Specify the collection
	DeviceCollection := database.Collection(variable.DeviceColl)

	// Query to find all documents
	cursor, err = DeviceCollection.Find(ctx, bson.M{
		"device_id": bson.M{"$in": device_ids},
	})
	if err != nil {
		return deviceData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error finding data: %s", err.Error()))
	}
	// Decode the cursor into the deviceData struct
	if err := cursor.All(ctx, &deviceData); err != nil {
		return deviceData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error decoding data: %s", err.Error()))
	}
	return deviceData, nil
}

func DeviceUserInDeviceID(c *fiber.Ctx, ctx context.Context, database *mongo.Database, device_id string) ([]DeviceUser, error) {
	// Specify the collection
	DeviceUserCollection := database.Collection(variable.DeviceUserColl)

	// Define the struct to store the result
	deviceUserData := make([]DeviceUser, 0)

	// Query to find all documents
	cursor, err := DeviceUserCollection.Find(ctx, bson.M{
		"device_id": device_id,
	})
	if err != nil {
		return deviceUserData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error finding data: %s", err.Error()))
	}
	// Decode the cursor into the deviceUserData struct
	if err := cursor.All(ctx, &deviceUserData); err != nil {
		return deviceUserData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error decoding data: %s", err.Error()))
	}
	return deviceUserData, nil
}

func DeviceDetail(c *fiber.Ctx, ctx context.Context, database *mongo.Database, device_id string) (Device, error) {
	// Specify the collection
	DeviceCollection := database.Collection(variable.DeviceColl)

	// Define the struct to store the result
	var deviceData Device

	// Query to find one document by device_id
	result := DeviceCollection.FindOne(ctx, bson.M{
		"device_id": device_id,
	})
	if err := result.Err(); err != nil {
		if err == mongo.ErrNoDocuments {
			// Handle case where no document is found
			return deviceData, fiber.NewError(fiber.StatusNotFound, "data not found")
		}
		// Handle other potential errors
		return deviceData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error finding data: %s", err.Error()))
	}

	// Decode the result into the deviceData struct
	if err := result.Decode(&deviceData); err != nil {
		return deviceData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error decoding data: %s", err.Error()))
	}

	// Return the found document
	return deviceData, nil
}

func UserDetail(c *fiber.Ctx, ctx context.Context, database *mongo.Database, user_id string) (DeviceUser, error) {
	// Specify the collection
	DeviceUserCollection := database.Collection(variable.DeviceUserColl)

	// Define the struct to store the result
	var deviceUserData DeviceUser

	// Query to find one document by user_id
	result := DeviceUserCollection.FindOne(ctx, bson.M{
		"user_id": user_id,
	})
	if err := result.Err(); err != nil {
		if err == mongo.ErrNoDocuments {
			// Handle case where no document is found
			return deviceUserData, fiber.NewError(fiber.StatusNotFound, "data not found")
		}
		// Handle other potential errors
		return deviceUserData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error finding data: %s", err.Error()))
	}

	// Decode the result into the deviceUserData struct
	if err := result.Decode(&deviceUserData); err != nil {
		return deviceUserData, fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error decoding data: %s", err.Error()))
	}

	// Return the found document
	return deviceUserData, nil
}

func DeviceSetBlock(c *fiber.Ctx, ctx context.Context, database *mongo.Database, device_id string, isBlocked bool) error {
	// Specify the collection
	DeviceCollection := database.Collection(variable.DeviceColl)

	// Define filter and update operation to change the active status
	filter := bson.M{"device_id": device_id}
	update := bson.M{"$set": bson.M{"is_blocked": isBlocked}}

	// Perform update
	result, err := DeviceCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error updating active status: %s", err.Error()))
	}

	// If no document was matched
	if result.MatchedCount == 0 {
		return fiber.NewError(fiber.StatusNotFound, "data not found")
	}

	return nil
}

func UserSetBlock(c *fiber.Ctx, ctx context.Context, database *mongo.Database, user_id string, isBlocked bool) error {
	// Specify the collection
	DeviceUserCollection := database.Collection(variable.DeviceUserColl)

	// Define filter and update operation to change the active status
	filter := bson.M{"user_id": user_id}
	update := bson.M{"$set": bson.M{"is_blocked": isBlocked}}

	// Perform update
	result, err := DeviceUserCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, fmt.Sprintf("error updating active status: %s", err.Error()))
	}

	// If no document was matched
	if result.MatchedCount == 0 {
		return fiber.NewError(fiber.StatusNotFound, "data not found")
	}

	return nil
}
