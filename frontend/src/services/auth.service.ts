interface RegisterRequest {
  name: string;
  username: string; // The backend uses 'username' but we send Email or Phone
  password: string;
  business_address: string;
  business_sector: string;
  promo_code?: string;
  affiliate_code?: string;
}

interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    name: string;
    username: string;
    role_code: string;
  };
}

interface TokenValidationResponse {
  name: string;
  role_code: string;
  user_id: string;
  username: string;
}

class AuthService {
  private baseURL = '/api/auth';

  async register(data: RegisterRequest): Promise<void> {
    try {
      const response = await fetch(`${this.baseURL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registrasi gagal');
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Terjadi kesalahan saat registrasi');
    }
  }

  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await fetch(`${this.baseURL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login gagal');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Terjadi kesalahan saat login');
    }
  }

  async loginWithGoogle(): Promise<void> {
    // Redirect to Google SSO endpoint
    window.location.href = `${this.baseURL}/sso/google`;
  }

  async validateToken(): Promise<TokenValidationResponse> {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('Token tidak ditemukan');
      }

      const response = await fetch(`${this.baseURL}/token-validation`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Token tidak valid');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Terjadi kesalahan saat validasi token');
    }
  }

  async logout(): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch(`${this.baseURL}/logout`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Always clear local storage
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
    }
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('auth_token');
    return !!token;
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getUserData(): any {
    const userData = localStorage.getItem('user_data');
    return userData ? JSON.parse(userData) : null;
  }
}

const authService = new AuthService();
export default authService;