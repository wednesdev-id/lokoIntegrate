package util

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"net/http"
	"strings"
	"time"
)

type RestOptions struct {
	Method  string
	URL     string
	Headers map[string]string
	Body    interface{} // Bisa diisi dengan struct, map, atau nil jika tidak ada body
}

type RestResponseError struct {
	StatusCode int    `json:"status_code"`
	Message    string `json:"message"`
	Response   string `json:"response"`
}

type RestErrorMessage struct {
	Message string `json:"message"`
}

func ParseErrorResponse(response string) (*RestErrorMessage, error) {
	// Periksa apakah response tidak kosong
	if response == "" {
		return nil, fmt.Errorf("empty response")
	}

	// Buat struct untuk memegang message dari JSON
	var errorMsg RestErrorMessage

	// Unmarshal response JSON ke dalam struct RestErrorMessage
	err := json.Unmarshal([]byte(response), &errorMsg)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %v", err)
	}

	return &errorMsg, nil
}

func RestHit[T any](options RestOptions) (*T, RestResponseError) {
	// Marshal body ke JSON jika ada body
	var reqBody []byte
	var err error
	if options.Body != nil {
		reqBody, err = json.Marshal(options.Body)
		if err != nil {
			return nil, RestResponseError{
				StatusCode: 500,
				Message:    fmt.Sprintf("failed to marshal body: %v", err),
			}
		}
	}

	// Buat request HTTP baru
	req, err := http.NewRequest(options.Method, options.URL, bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, RestResponseError{
			StatusCode: 500,
			Message:    fmt.Sprintf("failed to create request: %v", err),
		}
	}

	// Tambahkan headers
	for key, value := range options.Headers {
		req.Header.Set(key, value)
	}

	// Set Content-Type untuk POST atau PUT
	if options.Method == http.MethodPost || options.Method == http.MethodPut {
		req.Header.Set("Content-Type", "application/json")
	}

	// Tambahkan timeout untuk client
	client := &http.Client{
		Timeout: 10 * time.Second, // Tambahkan timeout agar tidak menggantung
	}

	// Kirim request
	resp, err := client.Do(req)
	if err != nil {
		statusCode := 500
		if resp != nil {
			statusCode = resp.StatusCode
		}
		return nil, RestResponseError{
			StatusCode: statusCode,
			Message:    fmt.Sprintf("failed to send request: %v", err),
		}
	}
	defer resp.Body.Close()

	// Pastikan response status code adalah 2xx
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		// Baca response body untuk memberikan error yang lebih informatif
		bodyBytes, _ := ioutil.ReadAll(resp.Body)
		bodyString := string(bodyBytes)
		return nil, RestResponseError{
			StatusCode: resp.StatusCode,
			Response:   bodyString,
		}
	}

	// Baca response body terlebih dahulu
	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, RestResponseError{
			StatusCode: resp.StatusCode,
			Message:    fmt.Sprintf("failed to read response body: %v", err),
		}
	}

	// Periksa Content-Type respons
	contentType := resp.Header.Get("Content-Type")
	if !strings.Contains(contentType, "application/json") {
		// Jika bukan JSON, kembalikan error dengan respons asli
		return nil, RestResponseError{
			StatusCode: resp.StatusCode,
			Message:    fmt.Sprintf("unexpected content type: %s", contentType),
			Response:   string(bodyBytes),
		}
	}

	// Decode response body ke dalam struct T
	var result T
	err = json.Unmarshal(bodyBytes, &result)
	if err != nil {
		return nil, RestResponseError{
			StatusCode: resp.StatusCode,
			Message:    fmt.Sprintf("failed to unmarshal response: %v", err),
			Response:   string(bodyBytes),
		}
	}

	return &result, RestResponseError{}
}
