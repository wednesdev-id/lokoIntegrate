// Base Response Types
export interface WhatsAppBaseResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface WhatsAppPaginatedResponse<T = any> extends WhatsAppBaseResponse<T> {
  pagination?: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// Device Management Types
export interface DeviceStatus {
  device_id: string;
  phone_number: string;
  status: 'connected' | 'disconnected' | 'connecting';
  last_seen?: string;
  qr_code?: string;
}

export interface QRCodeResponse {
  qr_code: string;
  qr_code_string: string;
  device_id?: string;
  expires_at?: string;
}

// Message Types
export interface SendMessageRequest {
  phone_number: string;
  message: string;
  message_type?: 'text' | 'image' | 'document' | 'audio' | 'video';
  media_url?: string;
  caption?: string;
}

export interface MessageResponse {
  message_id: string;
  phone_number: string;
  message: string;
  message_type: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  media_url?: string;
  caption?: string;
}

export interface GetMessagesRequest {
  phone_number?: string;
  limit?: number;
  offset?: number;
  start_date?: string;
  end_date?: string;
}

// Group Types
export interface CreateGroupRequest {
  name: string;
  description?: string;
  participants: string[];
}

export interface GroupInfoResponse {
  group_id: string;
  name: string;
  description?: string;
  participants: GroupParticipant[];
  created_at: string;
  admin: string[];
}

export interface GroupParticipant {
  phone_number: string;
  name?: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface AddParticipantRequest {
  group_id: string;
  participants: string[];
}

export interface RemoveParticipantRequest {
  group_id: string;
  participants: string[];
}

// Contact Types
export interface ContactResponse {
  jid: string;
  phone_number: string;
  name?: string;
  profile_picture?: string;
  status?: string;
  last_seen?: string;
}

// Chat Types
export interface ChatResponse {
  chat_id: string;
  phone_number: string;
  name?: string;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
  chat_type: 'individual' | 'group';
}

// Presence Types
export interface SendTypingRequest {
  phone_number: string;
  typing: boolean;
}

export interface MarkReadRequest {
  phone_number: string;
  message_id?: string;
}

// Status Types
export interface SendStatusRequest {
  content: string;
  media_url?: string;
  background_color?: string;
  font?: string;
}

export interface StatusResponse {
  status_id: string;
  content: string;
  media_url?: string;
  timestamp: string;
  views: number;
}

// Webhook Types
export interface WebhookPayload {
  event_type: string;
  device_id: string;
  data: any;
  timestamp: string;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  validation_errors?: ValidationError[];
}

// Session Management Types
export interface SessionResponse {
  session_id: string;
  session_code: string;
  session_name: string;
  phone_number?: string;
  status: 'created' | 'connecting' | 'connected' | 'disconnected' | 'qr_ready' | 'qr_expired';
  qr_code?: string;
  qr_code_string?: string;
  last_connected?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSessionRequest {
  session_name: string;
}

export interface ListSessionsResponse {
  sessions: SessionResponse[];
  total: number;
}