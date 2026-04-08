import { Routes, Route, Navigate } from 'react-router-dom'
import DeviceStatus from '../components/whatsapp/DeviceStatus'
import SendMessage from '../components/whatsapp/SendMessage'
import BulkMessage from '../components/whatsapp/BulkMessage'
import MessageHistory from '../components/whatsapp/MessageHistory'
import GroupManagement from '../components/whatsapp/GroupManagement'
import ContactManagement from '../components/whatsapp/ContactManagement'
import ChatManagement from '../components/whatsapp/ChatManagement'
import SessionList from '../components/whatsapp/SessionList'
import StatusList from '../components/whatsapp/StatusList'
import BotManagement from '../components/whatsapp/BotManagement'

function WhatsApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="device-status" replace />} />
      <Route path="device-status" element={<DeviceStatus />} />
      <Route path="sessions" element={<SessionList />} />
      <Route path="send-message" element={<SendMessage />} />
      <Route path="broadcast" element={<BulkMessage />} />
      <Route path="message-history" element={<MessageHistory />} />
      <Route path="group-management" element={<GroupManagement />} />
      <Route path="contact-management" element={<ContactManagement />} />
      <Route path="chat-management" element={<ChatManagement />} />
      <Route path="bot-management" element={<BotManagement />} />
      <Route path="status" element={<StatusList />} />
    </Routes>
  )
}

export default WhatsApp