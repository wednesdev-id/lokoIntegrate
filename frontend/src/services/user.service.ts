interface User {
  id: string; // Changed from _id to id to match backend
  name: string;
  username: string;
  email: string;
  role_id: string;
  is_active: boolean;
  is_verify: boolean;
  ai_quota: number;
  broadcast_quota?: number;
  business_address?: string;
  business_sector?: string;
  subscription_package_id?: string;
  subscription_expired_at?: string;
  created_at: string;
  updated_at?: string;
}

interface CreateUserRequest {
  name: string;
  username: string;
  email: string;
  password: string;
  role_id: string;
  is_active?: boolean;
  is_verify?: boolean;
  ai_quota?: number;
}

interface UpdateUserRequest {
  name?: string;
  username?: string;
  email?: string;
  role_id?: string;
  is_active?: boolean;
  is_verify?: boolean;
  ai_quota?: number;
}

interface SetupAdminRequest {
  name: string;
  username: string;
  email: string;
  password: string;
}

interface PaginationResponse {
  data: User[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

class UserService {
  private baseURL = '/api/users';
  private profileURL = '/api/profile';

  async getUsers(page: number = 1, limit: number = 10): Promise<PaginationResponse> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${this.baseURL}/paginate?page=${page}&limit=${limit}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengambil data user');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Terjadi kesalahan saat mengambil data user');
    }
  }

  async getUserById(id: string): Promise<User> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${this.baseURL}/detail/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengambil detail user');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Terjadi kesalahan saat mengambil detail user');
    }
  }

  async createUser(userData: CreateUserRequest): Promise<User> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${this.baseURL}/new`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal membuat user baru');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Terjadi kesalahan saat membuat user baru');
    }
  }

  async updateUser(id: string, userData: UpdateUserRequest): Promise<User> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${this.baseURL}/edit/${id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal mengupdate user');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Terjadi kesalahan saat mengupdate user');
    }
  }

  async deleteUser(id: string): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${this.baseURL}/remove/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal menghapus user');
      }
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Terjadi kesalahan saat menghapus user');
    }
  }

  async setupAdmin(adminData: SetupAdminRequest): Promise<User> {
    try {
      const response = await fetch(`${this.baseURL}/setup-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(adminData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Gagal membuat admin');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Terjadi kesalahan saat membuat admin');
    }
  }

  async getProfile(): Promise<User> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${this.profileURL}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal mengambil data profil');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Terjadi kesalahan saat mengambil profil');
    }
  }

  async updateProfile(data: { name: string; business_address: string; business_sector: string }): Promise<{ message: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${this.profileURL}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal memperbarui profil');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Terjadi kesalahan saat memperbarui profil');
    }
  }

  async updatePassword(passwordData: { current_password: string; new_password: string }): Promise<{ message: string }> {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${this.profileURL}/password`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(passwordData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Gagal memperbarui password');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) throw error;
      throw new Error('Terjadi kesalahan saat memperbarui password');
    }
  }
}

const userService = new UserService();
export default userService;
export type { User, CreateUserRequest, UpdateUserRequest, SetupAdminRequest, PaginationResponse };