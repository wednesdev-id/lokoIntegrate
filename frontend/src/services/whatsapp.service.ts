import api from "./api";
import {
  WhatsAppBaseResponse,
  WhatsAppPaginatedResponse,
  DeviceStatus,
  QRCodeResponse,
  SendMessageRequest,
  MessageResponse,
  GetMessagesRequest,
  CreateGroupRequest,
  GroupInfoResponse,
  AddParticipantRequest,
  RemoveParticipantRequest,
  ContactResponse,
  ChatResponse,
  SendTypingRequest,
  MarkReadRequest,
  SendStatusRequest,
  StatusResponse,
  WebhookPayload,
  SessionResponse,
  ListSessionsResponse,
} from "../types/whatsapp";

class WhatsAppService {
  // Device Management
  async getDeviceStatus(): Promise<WhatsAppBaseResponse<DeviceStatus>> {
    const response = await api.get("/whatsapp/v1/status");
    return response.data;
  }

  async getDevices(): Promise<WhatsAppPaginatedResponse<DeviceStatus[]>> {
    const response = await api.get("/whatsapp/v1/devices");
    return response.data;
  }

  async getQRCode(): Promise<WhatsAppBaseResponse<QRCodeResponse>> {
    const response = await api.get("/whatsapp/v1/device/qr");
    return response.data;
  }

  async connectDevice(): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post("/whatsapp/v1/connect");
    return response.data;
  }

  async disconnectDevice(): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post("/whatsapp/v1/device/disconnect");
    return response.data;
  }

  async restartDevice(): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post("/whatsapp/v1/device/restart");
    return response.data;
  }

  // Session Management
  async createSession(
    sessionName: string,
  ): Promise<WhatsAppBaseResponse<SessionResponse>> {
    const response = await api.post("/whatsapp/v1/sessions", {
      session_name: sessionName,
    });
    return response.data;
  }

  async listSessions(): Promise<WhatsAppBaseResponse<ListSessionsResponse>> {
    const response = await api.get("/whatsapp/v1/sessions");
    return response.data;
  }

  async getSessionDetail(
    sessionId: string,
  ): Promise<WhatsAppBaseResponse<SessionResponse>> {
    const response = await api.get(`/whatsapp/v1/sessions/${sessionId}`);
    return response.data;
  }

  async deleteSession(
    sessionId: string,
  ): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.delete(`/whatsapp/v1/sessions/${sessionId}`);
    return response.data;
  }

  async getSessionQR(
    sessionId: string,
  ): Promise<WhatsAppBaseResponse<{ qr_code: string; qr_code_string: string }>> {
    const response = await api.get(`/whatsapp/v1/sessions/${sessionId}/qr`);
    return response.data;
  }

  async connectSession(
    sessionId: string,
  ): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post(`/whatsapp/v1/sessions/${sessionId}/connect`);
    return response.data;
  }

  async disconnectSession(
    sessionId: string,
  ): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post(`/whatsapp/v1/sessions/${sessionId}/disconnect`);
    return response.data;
  }

  async getSessionContacts(
    sessionId: string,
  ): Promise<WhatsAppBaseResponse<ContactResponse[]>> {
    const response = await api.get(`/whatsapp/v1/sessions/${sessionId}/contacts`);
    return response.data;
  }

  // Message Management
  async sendMessage(
    data: SendMessageRequest,
  ): Promise<WhatsAppBaseResponse<MessageResponse>> {
    const response = await api.post("/whatsapp/v1/send", data);
    return response.data;
  }

  async getMessages(
    params: GetMessagesRequest,
  ): Promise<WhatsAppPaginatedResponse<MessageResponse[]>> {
    const response = await api.get("/whatsapp/v1/messages", { params });
    return response.data;
  }

  async getMessageById(
    messageId: string,
  ): Promise<WhatsAppBaseResponse<MessageResponse>> {
    const response = await api.get(`/whatsapp/v1/messages/${messageId}`);
    return response.data;
  }

  async deleteMessage(messageId: string): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.delete(`/whatsapp/v1/messages/${messageId}`);
    return response.data;
  }

  async forwardMessage(
    messageId: string,
    phoneNumber: string,
  ): Promise<WhatsAppBaseResponse<MessageResponse>> {
    const response = await api.post(
      `/whatsapp/v1/messages/${messageId}/forward`,
      {
        phone_number: phoneNumber,
      },
    );
    return response.data;
  }

  // Group Management
  async createGroup(
    data: CreateGroupRequest,
  ): Promise<WhatsAppBaseResponse<GroupInfoResponse>> {
    const response = await api.post("/whatsapp/v1/groups", data);
    return response.data;
  }

  async getGroups(): Promise<WhatsAppPaginatedResponse<GroupInfoResponse[]>> {
    const response = await api.get("/whatsapp/v1/groups");
    return response.data;
  }

  async getGroupInfo(
    groupId: string,
  ): Promise<WhatsAppBaseResponse<GroupInfoResponse>> {
    const response = await api.get(`/whatsapp/v1/groups/${groupId}`);
    return response.data;
  }

  async updateGroupInfo(
    groupId: string,
    data: Partial<CreateGroupRequest>,
  ): Promise<WhatsAppBaseResponse<GroupInfoResponse>> {
    const response = await api.put(`/whatsapp/v1/groups/${groupId}`, data);
    return response.data;
  }

  async deleteGroup(groupId: string): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.delete(`/whatsapp/v1/groups/${groupId}`);
    return response.data;
  }

  async addParticipants(
    data: AddParticipantRequest,
  ): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post(
      `/whatsapp/v1/groups/${data.group_id}/participants`,
      {
        participants: data.participants,
      },
    );
    return response.data;
  }

  async removeParticipants(
    data: RemoveParticipantRequest,
  ): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.delete(
      `/whatsapp/v1/groups/${data.group_id}/participants`,
      {
        data: { participants: data.participants },
      },
    );
    return response.data;
  }

  async leaveGroup(groupId: string): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post(`/whatsapp/v1/groups/${groupId}/leave`);
    return response.data;
  }

  // Contact Management
  async getContacts(): Promise<WhatsAppPaginatedResponse<ContactResponse[]>> {
    const response = await api.get("/whatsapp/v1/contacts");
    return response.data;
  }

  async getContactInfo(
    phoneNumber: string,
  ): Promise<WhatsAppBaseResponse<ContactResponse>> {
    const response = await api.get(`/whatsapp/v1/contacts/${phoneNumber}`);
    return response.data;
  }

  async blockContact(phoneNumber: string): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post(
      `/whatsapp/v1/contacts/${phoneNumber}/block`,
    );
    return response.data;
  }

  async unblockContact(
    phoneNumber: string,
  ): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post(
      `/whatsapp/v1/contacts/${phoneNumber}/unblock`,
    );
    return response.data;
  }

  // Chat Management
  async getChats(): Promise<WhatsAppPaginatedResponse<ChatResponse[]>> {
    const response = await api.get("/whatsapp/v1/chats");
    return response.data;
  }

  async getChatInfo(
    chatId: string,
  ): Promise<WhatsAppBaseResponse<ChatResponse>> {
    const response = await api.get(`/whatsapp/v1/chats/${chatId}`);
    return response.data;
  }

  async deleteChat(chatId: string): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.delete(`/whatsapp/v1/chats/${chatId}`);
    return response.data;
  }

  async archiveChat(chatId: string): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post(`/whatsapp/v1/chats/${chatId}/archive`);
    return response.data;
  }

  async unarchiveChat(chatId: string): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post(`/whatsapp/v1/chats/${chatId}/unarchive`);
    return response.data;
  }

  // Presence Management
  async sendTyping(
    data: SendTypingRequest,
  ): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post("/whatsapp/v1/presence/typing", data);
    return response.data;
  }

  async markAsRead(data: MarkReadRequest): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post("/whatsapp/v1/presence/read", data);
    return response.data;
  }

  async setPresence(
    presence: "available" | "unavailable",
  ): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post("/whatsapp/v1/presence", { presence });
    return response.data;
  }

  // Status Management
  async sendStatus(
    data: SendStatusRequest,
  ): Promise<WhatsAppBaseResponse<StatusResponse>> {
    const response = await api.post("/whatsapp/v1/status/send", data);
    return response.data;
  }

  async getStatuses(): Promise<WhatsAppPaginatedResponse<StatusResponse[]>> {
    const response = await api.get("/whatsapp/v1/status");
    return response.data;
  }

  async deleteStatus(statusId: string): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.delete(`/whatsapp/v1/status/${statusId}`);
    return response.data;
  }

  // Webhook Management
  async getWebhooks(): Promise<WhatsAppPaginatedResponse<WebhookPayload[]>> {
    const response = await api.get("/whatsapp/v1/webhooks");
    return response.data;
  }

  async createWebhook(
    url: string,
    events: string[],
  ): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.post("/whatsapp/v1/webhooks", { url, events });
    return response.data;
  }

  async deleteWebhook(webhookId: string): Promise<WhatsAppBaseResponse<any>> {
    const response = await api.delete(`/whatsapp/v1/webhooks/${webhookId}`);
    return response.data;
  }

  // Utility Methods
  async checkPhoneNumber(
    phoneNumber: string,
  ): Promise<WhatsAppBaseResponse<{ exists: boolean; registered: boolean }>> {
    const response = await api.get(`/whatsapp/v1/check/${phoneNumber}`);
    return response.data;
  }

  async downloadMedia(mediaId: string): Promise<Blob> {
    const response = await api.get(`/whatsapp/v1/media/${mediaId}`, {
      responseType: "blob",
    });
    return response.data;
  }

  getMediaUrl(url: string, sessionId: string, type: 'image' | 'video' | 'audio' | 'document' = 'image'): string {
    if (!url) return '';
    // Use the base URL from the API instance or default to window.location if relative
    // Assuming api.defaults.baseURL is set, but accessing it might be tricky if it's an interceptor
    const baseUrl = 'http://localhost:8080/api'; // Hardcoded for dev, normally from env
    const encodedUrl = encodeURIComponent(url);
    const token = localStorage.getItem('auth_token') || '';
    return `${baseUrl}/whatsapp/v1/media/download?session_id=${sessionId}&url=${encodedUrl}&type=${type}&token=${token}`;
  }
}

export const whatsappService = new WhatsAppService();
export default whatsappService;
