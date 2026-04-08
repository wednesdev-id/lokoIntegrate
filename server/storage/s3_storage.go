package storage

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"strings"
	"sync"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// S3Client wraps the AWS S3 client for media storage operations.
type S3Client struct {
	client   *s3.Client
	bucket   string
	endpoint string
}

var (
	globalS3Client *S3Client
	s3Once         sync.Once
)

// NewS3Client creates and returns a singleton S3-compatible client using env vars.
// Required env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_ENDPOINT, AWS_S3_REGION, AWS_S3_BUCKET
func NewS3Client() (*S3Client, error) {
	var initErr error

	s3Once.Do(func() {
		accessKey := os.Getenv("S3_ACCESS_KEY")
		if accessKey == "" {
			accessKey = os.Getenv("AWS_ACCESS_KEY_ID")
		}

		secretKey := os.Getenv("S3_SECRET_KEY")
		if secretKey == "" {
			secretKey = os.Getenv("AWS_SECRET_ACCESS_KEY")
		}

		endpoint := os.Getenv("S3_ENDPOINT")
		if endpoint == "" {
			endpoint = os.Getenv("AWS_S3_ENDPOINT")
		}

		region := os.Getenv("S3_REGION")
		if region == "" {
			region = os.Getenv("AWS_S3_REGION")
		}

		bucket := os.Getenv("S3_BUCKET")
		if bucket == "" {
			bucket = os.Getenv("AWS_S3_BUCKET")
		}

		if accessKey == "" || secretKey == "" || endpoint == "" || bucket == "" {
			log.Println("⚠️  S3 storage not configured (missing env vars). Media will fallback to local disk.")
			return
		}

		if region == "" {
			region = "us-east-1"
		}

		// Build a custom S3 client pointing to MinIO
		client := s3.New(s3.Options{
			Region:       region,
			BaseEndpoint: aws.String(endpoint),
			Credentials:  credentials.NewStaticCredentialsProvider(accessKey, secretKey, ""),
			UsePathStyle: true, // Required for MinIO
		})

		// Auto-initialize bucket if it doesn't exist
		_, err := client.HeadBucket(context.Background(), &s3.HeadBucketInput{
			Bucket: aws.String(bucket),
		})
		if err != nil {
			log.Printf("⚠️ Bucket '%s' not found. Attempting to create...", bucket)
			_, createErr := client.CreateBucket(context.Background(), &s3.CreateBucketInput{
				Bucket: aws.String(bucket),
			})
			if createErr != nil {
				log.Printf("❌ Failed to auto-create bucket '%s': %v", bucket, createErr)
			} else {
				log.Printf("✅ Automatically created bucket '%s' in MinIO/S3", bucket)

				// Set public read policy for the created bucket
				policy := fmt.Sprintf(`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}`, bucket)
				_, policyErr := client.PutBucketPolicy(context.Background(), &s3.PutBucketPolicyInput{
					Bucket: aws.String(bucket),
					Policy: aws.String(policy),
				})
				if policyErr != nil {
					log.Printf("⚠️ Failed to set public policy on bucket '%s': %v", bucket, policyErr)
				} else {
					log.Printf("✅ Set public-read policy on bucket '%s'", bucket)
				}
			}
		}

		globalS3Client = &S3Client{
			client:   client,
			bucket:   bucket,
			endpoint: endpoint,
		}

		log.Printf("✅ S3 Client initialized (endpoint=%s, bucket=%s)", endpoint, bucket)
	})

	return globalS3Client, initErr
}

// GetS3Client returns the singleton S3 client (may be nil if not configured).
func GetS3Client() *S3Client {
	return globalS3Client
}

// IsAvailable returns true if the S3 client is initialized.
func (s *S3Client) IsAvailable() bool {
	return s != nil && s.client != nil
}

// Upload uploads data to an S3-compatible bucket.
// key is the object key (e.g. "whatsapp/media/{session_id}/{hash}").
// Returns the public URL of the uploaded object.
func (s *S3Client) Upload(ctx context.Context, key string, data []byte, contentType string) (string, error) {
	if !s.IsAvailable() {
		return "", fmt.Errorf("S3 client not available")
	}

	input := &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	}

	_, err := s.client.PutObject(ctx, input)
	if err != nil {
		// Auto-create bucket if we get a NoSuchBucket error during upload
		if strings.Contains(err.Error(), "NoSuchBucket") {
			log.Printf("⚠️ Bucket '%s' not found during upload. Attempting to create...", s.bucket)
			_, createErr := s.client.CreateBucket(ctx, &s3.CreateBucketInput{
				Bucket: aws.String(s.bucket),
			})
			if createErr == nil {
				log.Printf("✅ Automatically created bucket '%s' in MinIO/S3", s.bucket)

				// Set public read policy
				policy := fmt.Sprintf(`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}`, s.bucket)
				_, policyErr := s.client.PutBucketPolicy(ctx, &s3.PutBucketPolicyInput{
					Bucket: aws.String(s.bucket),
					Policy: aws.String(policy),
				})
				if policyErr != nil {
					log.Printf("⚠️ Failed to set public policy on bucket '%s': %v", s.bucket, policyErr)
				} else {
					log.Printf("✅ Set public-read policy on bucket '%s'", s.bucket)
				}

				// Retry the original upload
				_, retryErr := s.client.PutObject(ctx, input)
				if retryErr != nil {
					return "", fmt.Errorf("failed to upload to S3 after bucket creation: %w", retryErr)
				}
			} else {
				return "", fmt.Errorf("failed to create bucket: %v. Original upload error: %w", createErr, err)
			}
		} else {
			return "", fmt.Errorf("failed to upload to S3: %w", err)
		}
	}

	publicURL := s.GetPublicURL(key)
	log.Printf("☁️  S3 Upload: %s (%d bytes) → %s", key, len(data), publicURL)
	return publicURL, nil
}

// Download downloads an object from S3 by key.
func (s *S3Client) Download(ctx context.Context, key string) ([]byte, error) {
	if !s.IsAvailable() {
		return nil, fmt.Errorf("S3 client not available")
	}

	output, err := s.client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to download from S3: %w", err)
	}
	defer output.Body.Close()

	data, err := io.ReadAll(output.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read S3 object body: %w", err)
	}

	return data, nil
}

// Exists checks whether an object exists in the bucket.
func (s *S3Client) Exists(ctx context.Context, key string) bool {
	if !s.IsAvailable() {
		return false
	}

	_, err := s.client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	return err == nil
}

// GetPublicURL constructs the public URL for an object.
func (s *S3Client) GetPublicURL(key string) string {
	return fmt.Sprintf("%s/%s/%s", s.endpoint, s.bucket, key)
}
