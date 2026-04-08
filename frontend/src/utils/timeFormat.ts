import { format, differenceInMinutes, differenceInHours, isToday, isYesterday } from 'date-fns';

/**
 * Format timestamp in WhatsApp style:
 * - Less than 1 hour: "X minutes ago" or "just now"
 * - Same day: HH:mm (24-hour format)
 * - Yesterday: "Yesterday"
 * - Older: DD/MM/YYYY
 */
export const formatWhatsAppTime = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    const now = new Date();

    const minutesDiff = differenceInMinutes(now, date);
    const hoursDiff = differenceInHours(now, date);

    // Less than 1 hour ago - show minutes
    if (hoursDiff < 1) {
        if (minutesDiff < 1) return 'just now';
        return `${minutesDiff}m`;
    }

    // Same day - show time in 24-hour format
    if (isToday(date)) {
        return format(date, 'HH:mm');
    }

    // Yesterday
    if (isYesterday(date)) {
        return 'Yesterday';
    }

    // Older - show date
    return format(date, 'dd/MM/yyyy');
};

/**
 * Format for chat list preview (last message time)
 */
export const formatChatListTime = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;

    if (isToday(date)) {
        return format(date, 'HH:mm');
    }

    if (isYesterday(date)) {
        return 'Yesterday';
    }

    return format(date, 'dd/MM/yyyy');
};
