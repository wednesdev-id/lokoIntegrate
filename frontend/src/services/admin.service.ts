import api from "./api";
import { WhatsAppPaginatedResponse } from "../types/whatsapp";
import { GetMasterDataContactsParams, MasterDataContactResponse } from "../types/admin";

class AdminService {
  private baseURL = '/whatsapp/v1/admin';

  async getMasterDataContacts(
    params: GetMasterDataContactsParams
  ): Promise<WhatsAppPaginatedResponse<MasterDataContactResponse[]>> {
    const response = await api.get(`${this.baseURL}/contacts`, { params });
    return response.data;
  }

  async exportMasterDataContacts(
    params: GetMasterDataContactsParams
  ): Promise<Blob> {
    const response = await api.get(`${this.baseURL}/contacts/export`, {
      params,
      responseType: 'blob',
    });
    return response.data;
  }
}

export const adminService = new AdminService();
export default adminService;
