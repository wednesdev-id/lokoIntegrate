/**
 * WhatsApp JID Parser Utilities
 * Converts WhatsApp JID format to valid phone numbers
 */

/**
 * Extract phone number from WhatsApp JID
 * @example "6281234567890@s.whatsapp.net" -> "6281234567890"
 */
export function parseWhatsAppJID(jid: string): string {
    const atIndex = jid.indexOf('@');
    if (atIndex !== -1) {
        return jid.substring(0, atIndex);
    }
    return jid;
}

/**
 * Format phone number with country code
 * @example "6281234567890" -> "+62 812-3456-7890"
 */
export function formatPhoneNumber(phone: string): string {
    // Remove any non-numeric characters
    const cleaned = phone.replace(/\D/g, '');

    // Indonesian format (country code 62)
    if (cleaned.startsWith('62') && cleaned.length >= 10) {
        // Format: +62 812-3456-7890
        return `+${cleaned.substring(0, 2)} ${cleaned.substring(2, 5)}-${cleaned.substring(5, 9)}-${cleaned.substring(9)}`;
    }

    // Local format starting with 0
    if (cleaned.startsWith('0') && cleaned.length >= 10) {
        // Convert to international format
        return `+62 ${cleaned.substring(1, 4)}-${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
    }

    // Generic international format
    if (cleaned.length >= 10) {
        return `+${cleaned}`;
    }

    return cleaned;
}

/**
 * Convert WhatsApp JID to formatted phone number
 * @example "6281234567890@s.whatsapp.net" -> "+62 812-3456-7890"
 */
export function jidToPhoneNumber(jid: string): string {
    const phone = parseWhatsAppJID(jid);
    return formatPhoneNumber(phone);
}

/**
 * Check if JID is a group
 * @example "120363123456789@g.us" -> true
 */
export function isGroupJID(jid: string): boolean {
    return jid.endsWith('@g.us');
}

/**
 * Check if string is a valid WhatsApp JID
 */
export function isValidJID(jid: string): boolean {
    return jid.includes('@') &&
        (jid.endsWith('@s.whatsapp.net') ||
            jid.endsWith('@g.us') ||
            jid.endsWith('@lid'));
}

/**
 * Convert phone number to WhatsApp JID
 * @example "081234567890" -> "6281234567890@s.whatsapp.net"
 * @example "+62 812-3456-7890" -> "6281234567890@s.whatsapp.net"
 */
export function phoneToJID(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with country code 62
    if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
    }

    // If doesn't start with country code, add 62
    if (!cleaned.startsWith('62')) {
        cleaned = '62' + cleaned;
    }

    return cleaned + '@s.whatsapp.net';
}

/**
 * Get best display name for a contact
 * Priority: fullName > pushName > formatted phone number
 */
export function getContactDisplayName(
    fullName: string | undefined,
    pushName: string | undefined,
    jid: string
): string {
    if (fullName) return fullName;
    if (pushName) return pushName;
    return jidToPhoneNumber(jid);
}

/**
 * Format phone number for display (short format)
 * @example "6281234567890" -> "0812-3456-7890"
 */
export function formatPhoneNumberShort(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');

    // Indonesian format
    if (cleaned.startsWith('62') && cleaned.length >= 10) {
        // Convert to local format: 0812-3456-7890
        return `0${cleaned.substring(2, 5)}-${cleaned.substring(5, 9)}-${cleaned.substring(9)}`;
    }

    // Already local format
    if (cleaned.startsWith('0') && cleaned.length >= 10) {
        return `${cleaned.substring(0, 4)}-${cleaned.substring(4, 8)}-${cleaned.substring(8)}`;
    }

    return cleaned;
}
