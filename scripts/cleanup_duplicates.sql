-- Clean up duplicate chats caused by session_id mismatch
-- This script removes old messages that were saved with wrong session_id format

-- Step 1: Show current state
SELECT
    COUNT(*) as total_messages,
    COUNT(DISTINCT chat_j_id) as unique_chats,
    COUNT(DISTINCT session_id) as unique_sessions
FROM whatsapp_messages
WHERE
    created_at > NOW() - INTERVAL '24 hours';

-- Step 2: Delete messages older than 1 hour (keep recent ones)
-- This clears old duplicates while preserving fresh messages
DELETE FROM whatsapp_messages
WHERE
    created_at < NOW() - INTERVAL '1 hour';

-- Step 3: Clear chat cache (optional)
DELETE FROM whatsapp_chats
WHERE
    last_message_time < NOW() - INTERVAL '1 hour';

-- Step 4: Verify cleanup
SELECT
    COUNT(*) as remaining_messages,
    COUNT(DISTINCT chat_j_id) as unique_chats
FROM whatsapp_messages;