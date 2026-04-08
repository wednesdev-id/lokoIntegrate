package cache

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisCache wraps Redis client for media caching
type RedisCache struct {
	client *redis.Client
}

// NewRedisCache creates a new Redis cache connection
func NewRedisCache(addr string) *RedisCache {
	client := redis.NewClient(&redis.Options{
		Addr:         addr,
		Password:     "", // No password by default
		DB:           0,  // Use default DB
		MaxRetries:   3,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
		PoolSize:     10,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("⚠️  Redis unavailable: %v (will fallback to direct download)", err)
		return &RedisCache{client: nil}
	}

	log.Printf("✅ Redis connected successfully at %s", addr)
	return &RedisCache{client: client}
}

// Get retrieves a value from Redis cache
func (r *RedisCache) Get(ctx context.Context, key string) ([]byte, error) {
	if r.client == nil {
		return nil, redis.Nil
	}
	return r.client.Get(ctx, key).Bytes()
}

// Set stores a value in Redis cache with TTL
func (r *RedisCache) Set(ctx context.Context, key string, value []byte, ttl time.Duration) error {
	if r.client == nil {
		return nil
	}
	return r.client.Set(ctx, key, value, ttl).Err()
}

// Close closes the Redis connection
func (r *RedisCache) Close() error {
	if r.client == nil {
		return nil
	}
	return r.client.Close()
}

// IsAvailable checks if Redis is available
func (r *RedisCache) IsAvailable() bool {
	return r.client != nil
}

// ZAdd adds a member to a sorted set
func (r *RedisCache) ZAdd(ctx context.Context, key string, score float64, member interface{}) error {
	if r.client == nil {
		return nil
	}
	return r.client.ZAdd(ctx, key, redis.Z{
		Score:  score,
		Member: member,
	}).Err()
}

// HSet sets fields in a hash
func (r *RedisCache) HSet(ctx context.Context, key string, values ...interface{}) error {
	if r.client == nil {
		return nil
	}
	return r.client.HSet(ctx, key, values...).Err()
}

// ZRevRange gets range of members from sorted set (highest score first)
func (r *RedisCache) ZRevRange(ctx context.Context, key string, start, stop int64) ([]string, error) {
	if r.client == nil {
		return nil, redis.Nil
	}
	return r.client.ZRevRange(ctx, key, start, stop).Result()
}

// HGetAll gets all fields from a hash
func (r *RedisCache) HGetAll(ctx context.Context, key string) (map[string]string, error) {
	if r.client == nil {
		return nil, redis.Nil
	}
	return r.client.HGetAll(ctx, key).Result()
}

// ZScore gets score of a member in sorted set
func (r *RedisCache) ZScore(ctx context.Context, key string, member string) (float64, error) {
	if r.client == nil {
		return 0, redis.Nil
	}
	return r.client.ZScore(ctx, key, member).Result()
}

// ZCard gets the number of members in a sorted set
func (r *RedisCache) ZCard(ctx context.Context, key string) (int64, error) {
	if r.client == nil {
		return 0, redis.Nil
	}
	return r.client.ZCard(ctx, key).Result()
}

// Expire sets TTL for a key
func (r *RedisCache) Expire(ctx context.Context, key string, ttl time.Duration) error {
	if r.client == nil {
		return nil
	}
	return r.client.Expire(ctx, key, ttl).Err()
}

// HIncrBy increments a field in a hash
func (r *RedisCache) HIncrBy(ctx context.Context, key string, field string, incr int64) (int64, error) {
	if r.client == nil {
		return 0, redis.Nil
	}
	return r.client.HIncrBy(ctx, key, field, incr).Result()
}

// Del deletes one or more keys
func (r *RedisCache) Del(ctx context.Context, keys ...string) error {
	if r.client == nil {
		return nil
	}
	return r.client.Del(ctx, keys...).Err()
}

// ZRem removes member(s) from sorted set
func (r *RedisCache) ZRem(ctx context.Context, key string, members ...interface{}) error {
	if r.client == nil {
		return nil
	}
	return r.client.ZRem(ctx, key, members...).Err()
}
