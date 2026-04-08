package connection

import (
	"log"

	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types/events"
)

// ParsedMessage represents a parsed WhatsApp message with all relevant data
type ParsedMessage struct {
	Content     string
	MessageType string
	MediaURL    string

	// Media Decryption
	MediaKey      []byte
	DirectPath    string
	FileEncSHA256 []byte
	FileSHA256    []byte

	// Quoted message data
	QuotedMessageID      *string
	QuotedMessageSender  *string
	QuotedMessageContent *string

	// Additional metadata for specific message types
	Metadata map[string]interface{}
}

// ParseMessage extracts content from various WhatsApp message types
// Returns structured ParsedMessage with content, type, and metadata
func ParseMessage(evt *events.Message) ParsedMessage {
	msg := evt.Message

	// Try each message type in order of likelihood
	if msg.GetConversation() != "" {
		return parseTextMessage(msg)
	}

	if msg.GetExtendedTextMessage() != nil {
		return parseExtendedTextMessage(msg)
	}

	if msg.GetImageMessage() != nil {
		return parseImageMessage(msg)
	}

	if msg.GetVideoMessage() != nil {
		return parseVideoMessage(msg)
	}

	if msg.GetAudioMessage() != nil {
		return parseAudioMessage(msg)
	}

	if msg.GetDocumentMessage() != nil {
		return parseDocumentMessage(msg)
	}

	if msg.GetStickerMessage() != nil {
		return parseStickerMessage(msg)
	}

	if msg.GetLocationMessage() != nil {
		return parseLocationMessage(msg)
	}

	if msg.GetLiveLocationMessage() != nil {
		return parseLiveLocationMessage(msg)
	}

	if msg.GetContactMessage() != nil {
		return parseContactMessage(msg)
	}

	if msg.GetContactsArrayMessage() != nil {
		return parseContactsArrayMessage(msg)
	}

	if msg.GetPollCreationMessage() != nil {
		return parsePollMessage(msg)
	}

	if msg.GetPollUpdateMessage() != nil {
		return parsePollUpdateMessage(msg)
	}

	if msg.GetReactionMessage() != nil {
		return parseReactionMessage(msg)
	}

	if msg.GetCall() != nil {
		return parseCallMessage(msg)
	}

	if msg.GetProtocolMessage() != nil {
		return parseProtocolMessage(msg)
	}

	// Group-specific messages
	if msg.GetGroupInviteMessage() != nil {
		return parseGroupInviteMessage(msg)
	}

	// Template messages (business)
	if msg.GetTemplateMessage() != nil {
		return parseTemplateMessage(msg)
	}

	if msg.GetTemplateButtonReplyMessage() != nil {
		return parseTemplateButtonReplyMessage(msg)
	}

	// List/button messages
	if msg.GetListMessage() != nil {
		return parseListMessage(msg)
	}

	if msg.GetListResponseMessage() != nil {
		return parseListResponseMessage(msg)
	}

	if msg.GetButtonsMessage() != nil {
		return parseButtonsMessage(msg)
	}

	if msg.GetButtonsResponseMessage() != nil {
		return parseButtonsResponseMessage(msg)
	}

	// View once messages
	if msg.GetViewOnceMessage() != nil {
		return parseViewOnceMessage(msg)
	}

	// Ephemeral (disappearing) messages
	if msg.GetEphemeralMessage() != nil {
		return parseEphemeralMessage(msg)
	}

	// Product messages (business catalogs)
	if msg.GetProductMessage() != nil {
		return parseProductMessage(msg)
	}

	if msg.GetOrderMessage() != nil {
		return parseOrderMessage(msg)
	}

	// Reaction messages (emoji reactions)
	if msg.GetReactionMessage() != nil {
		return parseReactionMessage(msg)
	}

	// Default fallback
	return ParsedMessage{
		Content:     "[Unsupported Message Type]",
		MessageType: "unsupported",
	}
}

// Text message parsing functions

func parseTextMessage(msg *waProto.Message) ParsedMessage {
	return ParsedMessage{
		Content:     msg.GetConversation(),
		MessageType: "text",
	}
}

func parseReactionMessage(msg *waProto.Message) ParsedMessage {
	reactionMsg := msg.GetReactionMessage()
	if reactionMsg == nil {
		return ParsedMessage{
			Content:     "[Reaction]",
			MessageType: "reaction",
		}
	}

	emoji := reactionMsg.GetText()
	targetMsgID := reactionMsg.GetKey().GetID() // Fixed: GetID() instead of GetId()

	content := emoji
	if emoji == "" {
		content = "[Reaction Removed]"
	}

	return ParsedMessage{
		Content:         content,
		MessageType:     "reaction",
		QuotedMessageID: &targetMsgID, // Store target message ID
	}
}

func parseExtendedTextMessage(msg *waProto.Message) ParsedMessage {
	extMsg := msg.GetExtendedTextMessage()
	result := ParsedMessage{
		Content:     extMsg.GetText(),
		MessageType: "text",
	}

	// Extract quoted message context
	extractQuotedContext(&result, extMsg.GetContextInfo())

	return result
}

// Media message parsing functions

func parseImageMessage(msg *waProto.Message) ParsedMessage {
	imgMsg := msg.GetImageMessage()

	log.Printf("🖼️  Parsing IMAGE message - URL exists: %v, DirectPath exists: %v",
		imgMsg.GetURL() != "", imgMsg.GetDirectPath() != "")

	caption := imgMsg.GetCaption()
	if caption == "" {
		caption = "[Image]"
	}

	result := ParsedMessage{
		Content:       caption,
		MessageType:   "image",
		MediaURL:      extractMediaURL(imgMsg.GetURL(), imgMsg.GetDirectPath()),
		MediaKey:      imgMsg.MediaKey,
		DirectPath:    imgMsg.GetDirectPath(),
		FileEncSHA256: imgMsg.FileEncSHA256,
		FileSHA256:    imgMsg.FileSHA256,
		Metadata: map[string]interface{}{
			"mimetype": imgMsg.GetMimetype(),
			"filesize": imgMsg.GetFileLength(),
		},
	}

	extractQuotedContext(&result, imgMsg.GetContextInfo())
	return result
}

func parseVideoMessage(msg *waProto.Message) ParsedMessage {
	videoMsg := msg.GetVideoMessage()

	log.Printf("🎥 Parsing VIDEO message - URL exists: %v, DirectPath exists: %v",
		videoMsg.GetURL() != "", videoMsg.GetDirectPath() != "")

	caption := videoMsg.GetCaption()
	if caption == "" {
		caption = "[Video]"
	}

	result := ParsedMessage{
		Content:       caption,
		MessageType:   "video",
		MediaURL:      extractMediaURL(videoMsg.GetURL(), videoMsg.GetDirectPath()),
		MediaKey:      videoMsg.MediaKey,
		DirectPath:    videoMsg.GetDirectPath(),
		FileEncSHA256: videoMsg.FileEncSHA256,
		FileSHA256:    videoMsg.FileSHA256,
		Metadata: map[string]interface{}{
			"mimetype": videoMsg.GetMimetype(),
			"filesize": videoMsg.GetFileLength(),
			"duration": videoMsg.GetSeconds(),
		},
	}

	extractQuotedContext(&result, videoMsg.GetContextInfo())
	return result
}

func parseAudioMessage(msg *waProto.Message) ParsedMessage {
	audioMsg := msg.GetAudioMessage()
	content := "[Audio Message]"
	if audioMsg.GetPTT() {
		content = "[Voice Message]"
	}

	result := ParsedMessage{
		Content:       content,
		MessageType:   "audio",
		MediaURL:      extractMediaURL(audioMsg.GetURL(), audioMsg.GetDirectPath()),
		MediaKey:      audioMsg.MediaKey,
		DirectPath:    audioMsg.GetDirectPath(),
		FileEncSHA256: audioMsg.FileEncSHA256,
		FileSHA256:    audioMsg.FileSHA256,
		Metadata: map[string]interface{}{
			"mimetype":     audioMsg.GetMimetype(),
			"filesize":     audioMsg.GetFileLength(),
			"duration":     audioMsg.GetSeconds(),
			"is_voice_msg": audioMsg.GetPTT(),
		},
	}

	extractQuotedContext(&result, audioMsg.GetContextInfo())
	return result
}

func parseDocumentMessage(msg *waProto.Message) ParsedMessage {
	docMsg := msg.GetDocumentMessage()
	fileName := docMsg.GetFileName()
	if fileName == "" {
		fileName = "[Document]"
	}

	result := ParsedMessage{
		Content:       fileName,
		MessageType:   "document",
		MediaURL:      extractMediaURL(docMsg.GetURL(), docMsg.GetDirectPath()),
		MediaKey:      docMsg.MediaKey,
		DirectPath:    docMsg.GetDirectPath(),
		FileEncSHA256: docMsg.FileEncSHA256,
		FileSHA256:    docMsg.FileSHA256,
		Metadata: map[string]interface{}{
			"mimetype": docMsg.GetMimetype(),
			"filesize": docMsg.GetFileLength(),
			"filename": fileName,
		},
	}

	extractQuotedContext(&result, docMsg.GetContextInfo())
	return result
}

func parseStickerMessage(msg *waProto.Message) ParsedMessage {
	stickerMsg := msg.GetStickerMessage()

	result := ParsedMessage{
		Content:       "[Sticker]",
		MessageType:   "sticker",
		MediaURL:      extractMediaURL(stickerMsg.GetURL(), stickerMsg.GetDirectPath()),
		MediaKey:      stickerMsg.MediaKey,
		DirectPath:    stickerMsg.GetDirectPath(),
		FileEncSHA256: stickerMsg.FileEncSHA256,
		FileSHA256:    stickerMsg.FileSHA256,
		Metadata: map[string]interface{}{
			"mimetype":    stickerMsg.GetMimetype(),
			"filesize":    stickerMsg.GetFileLength(),
			"is_animated": stickerMsg.GetIsAnimated(),
		},
	}

	extractQuotedContext(&result, stickerMsg.GetContextInfo())
	return result
}

// Location message parsing functions

func parseLocationMessage(msg *waProto.Message) ParsedMessage {
	locMsg := msg.GetLocationMessage()

	content := "📍 Location"
	if name := locMsg.GetName(); name != "" {
		content = "📍 " + name
	}

	return ParsedMessage{
		Content:     content,
		MessageType: "location",
		Metadata: map[string]interface{}{
			"latitude":  locMsg.GetDegreesLatitude(),
			"longitude": locMsg.GetDegreesLongitude(),
			"name":      locMsg.GetName(),
			"address":   locMsg.GetAddress(),
		},
	}
}

func parseLiveLocationMessage(msg *waProto.Message) ParsedMessage {
	liveLocMsg := msg.GetLiveLocationMessage()

	content := "📍 Live Location"
	if caption := liveLocMsg.GetCaption(); caption != "" {
		content = "📍 Live Location: " + caption
	}

	return ParsedMessage{
		Content:     content,
		MessageType: "live_location",
		Metadata: map[string]interface{}{
			"latitude":  liveLocMsg.GetDegreesLatitude(),
			"longitude": liveLocMsg.GetDegreesLongitude(),
			"accuracy":  liveLocMsg.GetAccuracyInMeters(),
			"speed":     liveLocMsg.GetSpeedInMps(),
		},
	}
}

// Contact message parsing functions

func parseContactMessage(msg *waProto.Message) ParsedMessage {
	contactMsg := msg.GetContactMessage()

	displayName := contactMsg.GetDisplayName()
	if displayName == "" {
		displayName = "Unknown Contact"
	}

	return ParsedMessage{
		Content:     "👤 Contact: " + displayName,
		MessageType: "contact",
		Metadata: map[string]interface{}{
			"display_name": displayName,
			"vcard":        contactMsg.GetVcard(),
		},
	}
}

func parseContactsArrayMessage(msg *waProto.Message) ParsedMessage {
	contactsMsg := msg.GetContactsArrayMessage()
	contacts := contactsMsg.GetContacts()

	content := "👥 Contacts"
	if len(contacts) > 0 {
		content = "👥 " + string(rune(len(contacts))) + " Contacts"
	}

	return ParsedMessage{
		Content:     content,
		MessageType: "contacts",
		Metadata: map[string]interface{}{
			"count": len(contacts),
		},
	}
}

// Poll message parsing functions

func parsePollMessage(msg *waProto.Message) ParsedMessage {
	pollMsg := msg.GetPollCreationMessage()

	question := pollMsg.GetName()
	options := pollMsg.GetOptions()

	content := "📊 Poll: " + question

	optionTexts := make([]string, 0, len(options))
	for _, opt := range options {
		optionTexts = append(optionTexts, opt.GetOptionName())
	}

	return ParsedMessage{
		Content:     content,
		MessageType: "poll",
		Metadata: map[string]interface{}{
			"question":   question,
			"options":    optionTexts,
			"selectable": pollMsg.GetSelectableOptionsCount(),
		},
	}
}

func parsePollUpdateMessage(msg *waProto.Message) ParsedMessage {
	pollUpdateMsg := msg.GetPollUpdateMessage()

	return ParsedMessage{
		Content:     "📊 Poll Vote",
		MessageType: "poll_update",
		Metadata: map[string]interface{}{
			"poll_creation_message_key": pollUpdateMsg.GetPollCreationMessageKey(),
		},
	}
}

// Call message parsing

func parseCallMessage(msg *waProto.Message) ParsedMessage {
	callMsg := msg.GetCall()

	content := "📞 Call"
	// Note: Call message doesn't have much info in the protobuf

	return ParsedMessage{
		Content:     content,
		MessageType: "call",
		Metadata: map[string]interface{}{
			"call_key": callMsg.GetCallKey(),
		},
	}
}

// Protocol message parsing (system messages)

func parseProtocolMessage(msg *waProto.Message) ParsedMessage {
	protoMsg := msg.GetProtocolMessage()
	msgType := protoMsg.GetType()

	var content string
	var messageType string

	switch msgType {
	case waProto.ProtocolMessage_REVOKE:
		content = "🚫 Message deleted"
		messageType = "deleted"
	case waProto.ProtocolMessage_EPHEMERAL_SETTING:
		content = "⏱️ Disappearing messages setting changed"
		messageType = "ephemeral_settings"
	default:
		content = "[Protocol Message]"
		messageType = "protocol"
	}

	return ParsedMessage{
		Content:     content,
		MessageType: messageType,
		Metadata: map[string]interface{}{
			"protocol_type": msgType.String(),
		},
	}
}

// Group invite message parsing

func parseGroupInviteMessage(msg *waProto.Message) ParsedMessage {
	inviteMsg := msg.GetGroupInviteMessage()

	groupName := inviteMsg.GetGroupName()
	content := "👥 Group Invite"
	if groupName != "" {
		content = "👥 Group Invite: " + groupName
	}

	return ParsedMessage{
		Content:     content,
		MessageType: "group_invite",
		Metadata: map[string]interface{}{
			"group_name":  groupName,
			"invite_code": inviteMsg.GetInviteCode(),
		},
	}
}

// Business template messages

func parseTemplateMessage(msg *waProto.Message) ParsedMessage {
	templateMsg := msg.GetTemplateMessage()

	// Template messages can have various structures
	content := "[Template Message]"
	if hydratedTemplate := templateMsg.GetHydratedTemplate(); hydratedTemplate != nil {
		if body := hydratedTemplate.GetHydratedContentText(); body != "" {
			content = body
		}
	}

	return ParsedMessage{
		Content:     content,
		MessageType: "template",
	}
}

func parseTemplateButtonReplyMessage(msg *waProto.Message) ParsedMessage {
	replyMsg := msg.GetTemplateButtonReplyMessage()

	selectedID := replyMsg.GetSelectedID()
	content := "🔘 Template Button: " + selectedID

	return ParsedMessage{
		Content:     content,
		MessageType: "template_button_reply",
		Metadata: map[string]interface{}{
			"selected_id":   selectedID,
			"selected_text": replyMsg.GetSelectedDisplayText(),
		},
	}
}

// List and button messages

func parseListMessage(msg *waProto.Message) ParsedMessage {
	listMsg := msg.GetListMessage()

	title := listMsg.GetTitle()
	content := "📋 List: " + title

	return ParsedMessage{
		Content:     content,
		MessageType: "list",
		Metadata: map[string]interface{}{
			"title":       title,
			"description": listMsg.GetDescription(),
			"button_text": listMsg.GetButtonText(),
		},
	}
}

func parseListResponseMessage(msg *waProto.Message) ParsedMessage {
	responseMsg := msg.GetListResponseMessage()

	title := responseMsg.GetTitle()
	content := "📋 List Response: " + title

	return ParsedMessage{
		Content:     content,
		MessageType: "list_response",
		Metadata: map[string]interface{}{
			"title":       title,
			"description": responseMsg.GetDescription(),
		},
	}
}

func parseButtonsMessage(msg *waProto.Message) ParsedMessage {
	buttonsMsg := msg.GetButtonsMessage()

	content := "[Buttons Message]"
	if contentText := buttonsMsg.GetContentText(); contentText != "" {
		content = contentText
	}

	return ParsedMessage{
		Content:     content,
		MessageType: "buttons",
	}
}

func parseButtonsResponseMessage(msg *waProto.Message) ParsedMessage {
	responseMsg := msg.GetButtonsResponseMessage()

	selectedButtonID := responseMsg.GetSelectedButtonID()
	content := "🔘 Button: " + selectedButtonID

	return ParsedMessage{
		Content:     content,
		MessageType: "buttons_response",
		Metadata: map[string]interface{}{
			"selected_button_id": selectedButtonID,
			"selected_text":      responseMsg.GetSelectedDisplayText(),
		},
	}
}

// View once message parsing

func parseViewOnceMessage(msg *waProto.Message) ParsedMessage {
	viewOnceMsg := msg.GetViewOnceMessage()

	// View once wraps another message
	innerMsg := viewOnceMsg.GetMessage()
	if innerMsg != nil {
		// Create a temporary event to parse the inner message
		tempEvt := &events.Message{
			Message: innerMsg,
		}
		innerResult := ParseMessage(tempEvt)
		innerResult.Content = "👁️ View Once: " + innerResult.Content
		innerResult.MessageType = "view_once_" + innerResult.MessageType
		return innerResult
	}

	return ParsedMessage{
		Content:     "👁️ View Once Message",
		MessageType: "view_once",
	}
}

// Ephemeral (disappearing) message parsing

func parseEphemeralMessage(msg *waProto.Message) ParsedMessage {
	ephemeralMsg := msg.GetEphemeralMessage()

	// Ephemeral wraps another message
	innerMsg := ephemeralMsg.GetMessage()
	if innerMsg != nil {
		tempEvt := &events.Message{
			Message: innerMsg,
		}
		innerResult := ParseMessage(tempEvt)
		innerResult.Content = "⏱️ " + innerResult.Content
		return innerResult
	}

	return ParsedMessage{
		Content:     "⏱️ Disappearing Message",
		MessageType: "ephemeral",
	}
}

// Product/Order messages (business)

func parseProductMessage(msg *waProto.Message) ParsedMessage {
	productMsg := msg.GetProductMessage()

	product := productMsg.GetProduct()
	title := ""
	if product != nil {
		title = product.GetTitle()
	}

	content := "🛍️ Product"
	if title != "" {
		content = "🛍️ Product: " + title
	}

	return ParsedMessage{
		Content:     content,
		MessageType: "product",
		Metadata: map[string]interface{}{
			"product_id": product.GetProductID(),
		},
	}
}

func parseOrderMessage(msg *waProto.Message) ParsedMessage {
	orderMsg := msg.GetOrderMessage()

	content := "🛒 Order"
	if orderMsg.GetItemCount() > 0 {
		content = "🛒 Order (" + string(rune(orderMsg.GetItemCount())) + " items)"
	}

	return ParsedMessage{
		Content:     content,
		MessageType: "order",
		Metadata: map[string]interface{}{
			"item_count": orderMsg.GetItemCount(),
		},
	}

}

// Helper functions

func extractMediaURL(url, directPath string) string {
	if url != "" {
		log.Printf("📥 Media URL extracted from URL field: %s", url[:min(len(url), 80)])
		return url
	}
	if directPath != "" {
		fullURL := "https://mmg.whatsapp.net" + directPath
		log.Printf("📥 Media URL constructed from directPath: %s", fullURL[:min(len(fullURL), 80)])
		return fullURL
	}
	log.Printf("⚠️  No media URL available (both url and directPath are empty)")
	return ""
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func extractQuotedContext(result *ParsedMessage, ctxInfo *waProto.ContextInfo) {
	if ctxInfo == nil {
		return
	}

	if ctxInfo.StanzaID != nil {
		result.QuotedMessageID = ctxInfo.StanzaID
	}

	if ctxInfo.Participant != nil {
		result.QuotedMessageSender = ctxInfo.Participant
	}

	if ctxInfo.QuotedMessage != nil {
		quotedText := extractQuotedMessageContent(ctxInfo.QuotedMessage)
		result.QuotedMessageContent = &quotedText
	}
}

func extractQuotedMessageContent(quotedMsg *waProto.Message) string {
	if quotedMsg.GetConversation() != "" {
		return quotedMsg.GetConversation()
	}
	if quotedMsg.GetExtendedTextMessage() != nil {
		return quotedMsg.GetExtendedTextMessage().GetText()
	}
	if quotedMsg.GetImageMessage() != nil {
		caption := quotedMsg.GetImageMessage().GetCaption()
		if caption != "" {
			return "[Image] " + caption
		}
		return "[Image]"
	}
	if quotedMsg.GetVideoMessage() != nil {
		caption := quotedMsg.GetVideoMessage().GetCaption()
		if caption != "" {
			return "[Video] " + caption
		}
		return "[Video]"
	}
	if quotedMsg.GetDocumentMessage() != nil {
		return "[Document] " + quotedMsg.GetDocumentMessage().GetFileName()
	}
	if quotedMsg.GetAudioMessage() != nil {
		return "[Audio]"
	}
	if quotedMsg.GetStickerMessage() != nil {
		return "[Sticker]"
	}
	return "[Media Message]"
}
