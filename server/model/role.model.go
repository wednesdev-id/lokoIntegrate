package model

import (
	"context"
	"loko/server/variable"
	"fmt"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
)

// -> main collection
type Role struct {
	ID       primitive.ObjectID `json:"_id,omitempty" bson:"_id,omitempty"`
	Name     string             `json:"name"          bson:"name" unique:"true"` // Administrator | Partai | Pelaksana | Saksi | Kandidat
	Code     string             `json:"code"          bson:"code"`
	IsActive bool               `json:"is_active"     bson:"is_active"`
}

func GetRoleID(c *fiber.Ctx, ctx context.Context, database *mongo.Database, name string) (string, error) {
	var err error

	role := Role{}
	collection := database.Collection(variable.RoleColl)
	err = collection.FindOne(ctx, bson.M{
		"name": name,
	}).Decode(&role)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return "", c.Status(fiber.StatusBadRequest).JSON(fiber.Map{
				"message": fmt.Sprintf("role %s not found", variable.AdministratorRole),
			})
		} else {
			return "", c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
				"message": "internal server error",
			})
		}
	}

	return role.ID.Hex(), nil
}
