import { SessionProvider } from '@/contexts/SessionContext'
import ChatManagement from '@/components/whatsapp/ChatManagement'

function Chat() {
    return (
        <SessionProvider>
            <ChatManagement />
        </SessionProvider>
    )
}

export default Chat
