// Package main WhatsApp API Server
// @title WhatsApp API Server
// @version 1.0
// @description API server untuk mengelola WhatsApp messaging, status, dan webhook
// @termsOfService http://swagger.io/terms/
// @contact.name API Support
// @contact.url http://www.swagger.io/support
// @contact.email support@swagger.io
// @license.name Apache 2.0
// @license.url http://www.apache.org/licenses/LICENSE-2.0.html
// @host localhost:8080
// @BasePath /api/v1
// @schemes http https
package main

import (
	"log"
	_ "loko/docs" // Import docs untuk Swagger
	"loko/server"
	"loko/server/auth" // Tambahkan import untuk package auth
	"loko/server/util"
	"loko/server/variable"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	// ---------------------------------

	Env := util.Env{}
	Env.Load()

	// err = Env.SetTimezone()
	// if err != nil {
	// 	log.Fatalf("error on set timezone: %s", err.Error())
	// 	return
	// }

	Dir := util.Dir{}
	Dir.Make(variable.TempPath)

	// ---------------------------------

	// PostgreSQL is now initialized in server.Run() via http.Module()
	// Session manager and whatsmeow store use PostgreSQL

	// RabbitMQ := connection.RabbitMQ{}
	// RabbitMQ.Connect()

	// Redis := connection.Redis{}
	// Redis.Connect()

	// ---------------------------------

	// Inisialisasi Goth provider
	gothProvider := auth.Goth{}
	gothProvider.Init()
	log.Println("✅ Goth providers initialized")

	// cron.Start()
	server.Run()

	// ---------------------------------

	// Listen to Ctrl+C (you can also do something else that prevents the program from exiting)
	time.Sleep(3 * time.Second)
	log.Println("🚦 Listen to Ctrl+C ...")
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	<-c

}
