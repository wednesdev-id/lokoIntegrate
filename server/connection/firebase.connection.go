package connection

import (
	"context"
	"loko/server/env"
	"log"

	firebase "firebase.google.com/go"
	"firebase.google.com/go/db"
	"google.golang.org/api/option"
)

type Firebase struct{}

func (ref Firebase) Connect() (*db.Client, context.Context, error) {
	ctx := context.Background()

	// Initialize Firebase Admin SDK with service account
	opt := option.WithCredentialsFile("./firebase.json")
	config := &firebase.Config{
		DatabaseURL: env.GetFirebaseURL(),
	}

	app, err := firebase.NewApp(ctx, config, opt)
	if err != nil {
		log.Fatalf("error initializing app: %v", err)
	}

	// Initialize the Firebase database client
	client, err := app.Database(ctx)
	if err != nil {
		log.Fatalf("error initializing database client: %v", err)
	}

	return client, ctx, nil
}
