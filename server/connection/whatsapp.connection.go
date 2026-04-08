package connection

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"loko/server/dto"
	"loko/server/env"
	"loko/server/model"
	"loko/server/structure"
	"loko/server/util"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/mdp/qrterminal/v3"
	qrcode "github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	"gorm.io/gorm"
)

type WhatsApp struct{}

var WhatsAppClient *whatsmeow.Client // save session connection
var WhatsAppQrCode string
var WhatsAppQrCodeString string // QR code string for frontend library
var connectionMutex sync.Mutex
var isConnecting bool

var WhatsAppMessageTopic = "whatsapp-message"

var PostgresDB *gorm.DB

func (ref WhatsApp) Connect() {
	go func() {
		// Use mutex to prevent concurrent connections
		connectionMutex.Lock()
		defer connectionMutex.Unlock()

		// Initialize PostgreSQL connection if not exists
		if PostgresDB == nil {
			sqlConn := SQL{}
			db, err := sqlConn.Connect()
			if err != nil {
				fmt.Println("Failed to connect to PostgreSQL:", err)
				return
			}
			PostgresDB = db
		}

		// Check if already connecting
		if isConnecting {
			fmt.Println("WhatsApp connection already in progress")
			return
		}

		// Check if client already exists and is connected
		if WhatsAppClient != nil {
			if WhatsAppClient.IsConnected() {
				fmt.Println("WhatsApp client already connected")
				return
			}
			// If client exists but not connected, disconnect and cleanup first
			ref.Disconnect()
		}

		// Set connecting flag
		isConnecting = true
		defer func() {
			isConnecting = false
		}()

		// Auto migrate WhatsApp models to PostgreSQL
		err := PostgresDB.AutoMigrate(
			&model.WhatsAppMessage{},
			&model.WhatsAppContact{},
			&model.WhatsAppGroup{},
			&model.GroupParticipant{},
			&model.WhatsAppChat{},
			&model.WhatsAppReceipt{},
			&model.WhatsAppPresence{},
			&model.WhatsAppStatus{},
			&model.WhatsAppDevice{},
		)
		if err != nil {
			fmt.Println("Error migrating WhatsApp models:", err)
			return
		}
		fmt.Println("✅ WhatsApp models migrated to PostgreSQL")

		// Setup WhatsApp session store with SQLite (required by whatsmeow library)
		// This is only for session management, not for main application data
		sessionsDir := filepath.Join(env.GetPwd(), "sessions")
		if _, statErr := os.Stat(sessionsDir); os.IsNotExist(statErr) {
			mkdirErr := os.MkdirAll(sessionsDir, 0755)
			if mkdirErr != nil {
				fmt.Println("Error creating sessions directory:", mkdirErr)
				return
			}
			fmt.Println("✅ Sessions directory created successfully")
		}

		// Use sessions directory for WhatsApp session database
		sessionDbPath := filepath.Join(sessionsDir, "whatsapp.db")
		dbLog := waLog.Stdout("Database", "DEBUG", true)
		container, containerErr := sqlstore.New(context.Background(), "sqlite3", "file:"+sessionDbPath+"?_foreign_keys=on", dbLog)
		if containerErr != nil {
			panic(containerErr)
		}

		deviceStore, err := container.GetFirstDevice(context.Background())
		if err != nil {
			panic(err)
		}

		// fmt.Println("AAA")
		// clientLog := waLog.Stdout("Client", "DEBUG", true)
		// Create client with logging for better debugging
		clientLog := waLog.Stdout("Client", "DEBUG", true)
		WhatsAppClient = whatsmeow.NewClient(deviceStore, clientLog)

		// Add event handler sesuai dengan contoh yang diberikan
		WhatsAppClient.AddEventHandler(ref.eventHandler)

		if WhatsAppClient.Store.ID == nil {
			// No ID stored, new login - sesuai dengan contoh
			qrChan, _ := WhatsAppClient.GetQRChannel(context.Background())
			err = WhatsAppClient.Connect()
			if err != nil {
				panic(err)
			}

			for evt := range qrChan {
				if evt.Event == "code" {
					// Store the original QR code string for frontend library
					WhatsAppQrCodeString = evt.Code

					// Generate base64 QR code for API response
					ref.generateQRCodeImage(evt.Code)

					// Render the QR code here - sesuai dengan contoh
					// e.g. qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
					// or just manually `echo 2@... | qrencode -t ansiutf8` in a terminal
					fmt.Println("QR code:", evt.Code)

					// Display QR code in terminal
					fmt.Println("\n🔗 Scan QR Code dengan WhatsApp Anda:")
					fmt.Println("📱 Buka WhatsApp > Linked Devices > Link a Device")
					fmt.Println("📷 Scan QR code di bawah ini:")
					qrterminal.GenerateHalfBlock(evt.Code, qrterminal.L, os.Stdout)
					fmt.Println("\n⏰ QR Code akan expired dalam 60 detik...")
					fmt.Println("🔄 Jika expired, QR code baru akan muncul otomatis")
				} else {
					fmt.Println("Login event:", evt.Event)
				}
			}
		} else {
			// Already logged in, just connect - sesuai dengan contoh
			err = WhatsAppClient.Connect()
			if err != nil {
				panic(err)
			}
		}

		// Clear QR codes after successful connection
		WhatsAppQrCode = ""
		WhatsAppQrCodeString = ""

		ref.Listener()
		ref.Consumer()

		log.Println("✅ WhatsApp Success Connected...")
	}()
}

func (ref WhatsApp) Disconnect() {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()

	if WhatsAppClient != nil && WhatsAppClient.IsConnected() {
		WhatsAppClient.Disconnect()
	}
	WhatsAppClient = nil
	WhatsAppQrCode = ""
	isConnecting = false
	fmt.Println("WhatsApp Disconnect ✅")
}

// IsConnecting returns true if a connection attempt is in progress
func IsConnecting() bool {
	connectionMutex.Lock()
	defer connectionMutex.Unlock()
	return isConnecting
}

func (ref WhatsApp) Listener() {
	WhatsAppClient.AddEventHandler(func(evt interface{}) {
		switch v := evt.(type) {
		case *events.Message:
			ref.handleMessage(v)
		case *events.Receipt:
			ref.handleReceipt(v)
		case *events.Presence:
			ref.handlePresence(v)
		case *events.ConnectFailure:
			log.Printf("WhatsApp connection failed: %+v", v)
		case *events.Disconnected:
			log.Printf("WhatsApp disconnected: %+v", v)
		case *events.Connected:
			log.Printf("WhatsApp connected successfully")
		case *events.LoggedOut:
			log.Printf("WhatsApp logged out: %+v", v)
		default:
			// Log unknown events for debugging
			log.Printf("Unknown WhatsApp event: %T", v)
		}
	})
}

func (ref WhatsApp) Consumer() {

	go func() {
		rabbitMQClient := RabbitMQ{}
		msgs, Connection, Channel := rabbitMQClient.CreateConsumer(WhatsAppMessageTopic)
		defer Connection.Close()
		defer Channel.Close()

		for d := range msgs {
			var err error
			body := d.Body

			var data structure.IWhatsAppSendQueueRabbitMQ
			err = json.Unmarshal(body, &data)
			if err != nil {
				log.Printf("Error deserializing message: %s", err)
				d.Ack(false) // acknowledge the message because data is not object
				continue
			}

			_type := data.Type
			target_number := data.TargetNumber
			if _type == "text" {
				message := *data.Message
				recipient, err := types.ParseJID(target_number)
				if err != nil {
					log.Printf("Error parsing JID: %s", err)
					d.Ack(false) // acknowledge the message
					continue
				}

				resp, err := WhatsAppClient.SendMessage(context.Background(), recipient, &waProto.Message{
					Conversation: proto.String(message),
				})
				if err != nil {
					log.Printf("Error sending message: %s", err)
					err = d.Nack(false, false) // multiple set to false, requeue set to false
					if err != nil {
						log.Printf("Error sending Nack: %s", err)
					}
					continue
				}

				fmt.Printf("\nresp: %+v\nmessage: %+v\n\n", resp, message) // debug...
			} else if _type == "image" || _type == "file" {
				if data.FileName == nil {
					log.Println("FileName not found")
					d.Ack(false) // acknowledge the message
					continue
				}

				message := ""
				if data.Message != nil {
					message = *data.Message
				}
				filename := *data.FileName
				recipient, err := types.ParseJID(target_number)
				if err != nil {
					log.Printf("Error parsing JID: %s", err)
					d.Ack(false) // acknowledge the message
					continue
				}
				fmt.Println(
					"type:", _type,
					"| target_number:", target_number,
					"| filename:", filename,
					"| message:", message,
				)

				tempFile := filepath.Join(env.GetPwd(), "temp", filename)
				data, err := os.ReadFile(tempFile) // data
				if err != nil {
					log.Printf("Error ReadFile: %s", err)
					d.Ack(false) // acknowledge the message
					continue
				}
				fmt.Printf("tempFile: %+v\n", tempFile)

				uploaded, err := WhatsAppClient.Upload(context.Background(), data, whatsmeow.MediaImage)
				if err != nil {
					log.Printf("failed upload %s to whatsapp server", _type)
					d.Ack(false) // acknowledge the message
					continue
				}

				msg := &waProto.Message{ImageMessage: &waProto.ImageMessage{
					Caption:       proto.String(message),
					URL:           proto.String(uploaded.URL),
					DirectPath:    proto.String(uploaded.DirectPath),
					MediaKey:      uploaded.MediaKey,
					Mimetype:      proto.String(http.DetectContentType(data)),
					FileEncSHA256: uploaded.FileEncSHA256,
					FileSHA256:    uploaded.FileSHA256,
					FileLength:    proto.Uint64(uint64(len(data))),
				}}
				resp, err := WhatsAppClient.SendMessage(context.Background(), recipient, msg)
				if err != nil {
					log.Printf("Error sending image message: %v", err)
					err = d.Nack(false, false) // multiple set to false, requeue set to false
					if err != nil {
						log.Printf("Error sending Nack: %s", err)
					}
					continue
				} else {
					log.Printf("Image message sent (server timestamp: %s)", resp.Timestamp)
				}
			} else {
				fmt.Println(
					"type:", _type,
					"| target_number:", target_number,
				)
			}

			d.Ack(true) // finished...
			time.Sleep(3 * time.Second)
		}
	}()

}

// handleMessage processes incoming messages and sends webhook
func (ref WhatsApp) handleMessage(evt *events.Message) {
	log.Printf("Received message from %s: %s", evt.Info.Sender, evt.Message.GetConversation())

	// Convert to DTO
	messageResponse := dto.MessageResponse{
		ID:          uuid.New().String(),
		JID:         evt.Info.Sender.String(),
		ChatJID:     evt.Info.Chat.String(),
		MessageID:   evt.Info.ID,
		MessageType: "text",
		Content:     evt.Message.GetConversation(),
		IsFromMe:    evt.Info.IsFromMe,
		IsGroup:     evt.Info.IsGroup,
		Timestamp:   evt.Info.Timestamp,
		Status:      "received",
		CreatedAt:   time.Now(),
	}

	// Handle different message types
	if evt.Message.GetImageMessage() != nil {
		messageResponse.MessageType = "image"
		if evt.Message.GetImageMessage().Caption != nil {
			messageResponse.Caption = evt.Message.GetImageMessage().Caption
		}
	} else if evt.Message.GetVideoMessage() != nil {
		messageResponse.MessageType = "video"
		if evt.Message.GetVideoMessage().Caption != nil {
			messageResponse.Caption = evt.Message.GetVideoMessage().Caption
		}
	} else if evt.Message.GetAudioMessage() != nil {
		messageResponse.MessageType = "audio"
	} else if evt.Message.GetDocumentMessage() != nil {
		messageResponse.MessageType = "document"
		if evt.Message.GetDocumentMessage().FileName != nil {
			messageResponse.FileName = evt.Message.GetDocumentMessage().FileName
		}
	}

	// Send webhook
	payload := util.CreateMessageWebhookPayload("message_received", messageResponse, map[string]interface{}{
		"chat_name": evt.Info.PushName,
		"device_id": WhatsAppClient.Store.ID.String(),
	})

	util.SendWebhookAsync(payload)
}

// eventHandler processes WhatsApp events - sesuai dengan contoh yang diberikan
func (ref WhatsApp) eventHandler(evt interface{}) {
	switch v := evt.(type) {
	case *events.Message:
		fmt.Println("Received a message!", v.Message.GetConversation())
		ref.handleMessage(v)
	case *events.Receipt:
		ref.handleReceipt(v)
	case *events.Presence:
		ref.handlePresence(v)
	}
}

// generateQRCodeImage generates base64 encoded QR code image for API response
func (ref WhatsApp) generateQRCodeImage(code string) {
	tempDir := filepath.Join(env.GetPwd(), "temp")
	uuidv4 := uuid.NewString()
	tempPath := filepath.Join(tempDir, uuidv4+".png")

	err := qrcode.WriteFile(code, qrcode.Medium, 256, tempPath)
	if err != nil {
		fmt.Println("error on write file qr-code image:", err.Error())
		return
	}

	qrFile, err := os.Open(tempPath)
	if err != nil {
		fmt.Println("error on open qr-code:", err.Error())
		return
	}
	defer qrFile.Close()

	stat, _ := qrFile.Stat()
	size := stat.Size()
	qrBytes := make([]byte, size)
	_, err = qrFile.Read(qrBytes)
	if err != nil {
		fmt.Println("error on read file qr-code image:", err.Error())
		return
	}

	WhatsAppQrCode = base64.StdEncoding.EncodeToString(qrBytes)
	os.Remove(tempPath)
}

// handleReceipt processes delivery and read receipts
func (ref WhatsApp) handleReceipt(evt *events.Receipt) {
	log.Printf("Received receipt: %s for messages %v", evt.Type, evt.MessageIDs)

	for _, msgID := range evt.MessageIDs {
		payload := util.CreateReceiptWebhookPayload("message_"+strings.ToLower(string(evt.Type)), map[string]interface{}{
			"message_id": msgID,
			"chat_jid":   evt.Chat.String(),
			"from_jid":   evt.Sender.String(),
			"type":       string(evt.Type),
			"timestamp":  evt.Timestamp,
		}, map[string]interface{}{
			"device_id": WhatsAppClient.Store.ID.String(),
		})

		util.SendWebhookAsync(payload)
	}
}

// handlePresence processes typing and online/offline status
func (ref WhatsApp) handlePresence(evt *events.Presence) {
	log.Printf("Received presence from %s: unavailable=%t", evt.From, evt.Unavailable)

	eventType := "presence_update"
	if evt.Unavailable {
		eventType = "offline"
	} else {
		eventType = "online"
	}

	payload := util.CreatePresenceWebhookPayload(eventType, map[string]interface{}{
		"jid":       evt.From.String(),
		"chat_jid":  evt.From.String(),
		"type":      eventType,
		"timestamp": time.Now(),
	}, map[string]interface{}{
		"device_id": WhatsAppClient.Store.ID.String(),
	})

	util.SendWebhookAsync(payload)
}
