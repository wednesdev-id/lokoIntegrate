package util

import (
	"context"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ParsePaginationParams parses pagination and sorting query parameters
func PaginationParseParams(c *fiber.Ctx) (int, int, string, int) {
	// Parse query parameters
	page, err := strconv.Atoi(c.Query("page", "1"))
	if err != nil || page < 1 {
		page = 1
	}
	limit, err := strconv.Atoi(c.Query("limit", "10"))
	if err != nil || limit < 1 {
		limit = 10
	}
	sortBy := c.Query("sortby", "_id")

	// Parse sort order, default is descending (-1)
	sortOrderParam := c.Query("order", "desc")
	sortOrder := 1 // Default to Ascending
	if sortOrderParam == "desc" {
		sortOrder = -1 // Descending
	}

	return page, limit, sortBy, sortOrder
}

// GetPaginatedResults fetches documents with pagination from a MongoDB collection
func PaginateGetResults[T any](
	ctx context.Context,
	collection *mongo.Collection,
	page int,
	limit int,
	sortBy string,
	sortOrder int,
	filter bson.M,
) ([]T, error) {
	// Create filter and sort options
	findOptions := options.Find()
	findOptions.SetSkip(int64((page - 1) * limit))
	findOptions.SetLimit(int64(limit))
	findOptions.SetSort(bson.D{{Key: sortBy, Value: sortOrder}})

	// Retrieve documents with pagination
	results := make([]T, 0)
	cursor, err := collection.Find(ctx, filter, findOptions)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	// Decode the cursor into the results slice
	if err = cursor.All(ctx, &results); err != nil {
		return nil, err
	}

	return results, nil
}

// GetTotalPages calculates the total pages for pagination
func PaginationGetTotalPages(ctx context.Context, collection *mongo.Collection, filter bson.M, limit int) (int, error) {
	// Count total documents for pagination
	totalDocuments, err := collection.CountDocuments(ctx, filter)
	if err != nil {
		return 0, err
	}
	lastPage := int(totalDocuments) / limit
	if int(totalDocuments)%limit != 0 {
		lastPage++
	}
	return lastPage, nil
}
