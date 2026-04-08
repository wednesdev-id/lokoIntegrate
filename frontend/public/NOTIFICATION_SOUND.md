# Notification Sound File

⚠️ **Manual Download Required**

Download a WhatsApp-style notification sound and save as `/frontend/public/notification.mp3`

## Recommended Sources:

1. **Pristine Sound (Light, pleasant)**
   - URL: https://notificationsounds.com/notification-sounds/pristine-609/download/mp3
   - Duration: ~1 second
   
2. **WhatsApp Default**
   - Extract from WhatsApp app or search "whatsapp notification sound mp3"

3. **Alternative: Use any short notification sound**
   - Format: MP3 or OGG
   - Duration: 0.5-2 seconds
   - Size: <100KB recommended

## Installation:
```bash
# Download to correct location
curl -o frontend/public/notification.mp3 [URL]

# Or manually place file in:
# /Users/macbookairm2/Code/Dev/ztech/Loko/loko-backend/frontend/public/notification.mp3
```

## Fallback:
If no sound file is provided, the notification system will still work silently (Toast only, no sound).
