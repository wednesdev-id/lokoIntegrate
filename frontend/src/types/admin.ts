export interface MasterDataContactResponse {
  id: number;
  session_id: string;
  jid: string;
  name: string;
  phone_number: string;
  user_name: string; // From User table
  created_at: string;
}

export interface GetMasterDataContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  session_id?: string;
  session_code?: string;
}
