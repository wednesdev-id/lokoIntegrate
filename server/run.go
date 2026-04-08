package server

import (
	"loko/server/http"
)

func Run() {
	go func() {
		http.Server()
	}()
}
