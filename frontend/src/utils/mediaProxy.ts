/**
 * Transform WhatsApp media URL to use proxy endpoint
 * WhatsApp CDN URLs require authentication and can't be loaded directly in browser
 */
export function getProxiedMediaUrl(
    mediaUrl: string | undefined,
    sessionId: string,
    mediaType: 'image' | 'video' | 'audio' | 'document' | 'sticker' = 'image',
    sessionCode?: string
): string | undefined {
    if (!mediaUrl) return undefined;

    // If already a data URL (base64), return as-is
    if (mediaUrl.startsWith('data:')) {
        return mediaUrl;
    }

    // If it's a WhatsApp CDN URL, proxy it
    if (mediaUrl.includes('mmg.whatsapp.net') || mediaUrl.includes('mmg-fna.whatsapp.net')) {
        const encodedUrl = encodeURIComponent(mediaUrl);
        let token = '';
        try {
            token = localStorage.getItem('auth_token') || '';
        } catch (e) {
            console.error('Failed to access localStorage for authToken', e);
        }

        // Build URL with session_code if available for better security
        let proxyUrl = `/api/whatsapp/v1/media/download?session_id=${sessionId}&url=${encodedUrl}&type=${mediaType}&token=${token}`;
        if (sessionCode) {
            proxyUrl += `&session_code=${encodeURIComponent(sessionCode)}`;
        }
        return proxyUrl;
    }

    // For other URLs, return as-is
    return mediaUrl;
}
