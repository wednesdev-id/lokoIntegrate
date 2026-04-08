import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '@/services/api';

export interface User {
    id: string; // Match backend ID
    username: string;
    name: string;
    email?: string;
    role_code: string;
    subscription_package_id?: string;
    subscription_expired_at?: string;
    active_modules?: string;
    max_sessions?: number;
    business_address?: string;
    business_sector?: string;
    broadcast_quota?: number;
    ai_quota?: number;
    created_at?: string;
}

interface UserContextType {
    user: User | null;
    loading: boolean;
    refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const refreshUser = async () => {
        try {
            const token = localStorage.getItem('auth_token');
            if (!token) {
                setLoading(false);
                return;
            }

            const response = await api.get('/auth/token-validation');
            // The API returns the user object directly based on our previous backend modification
            // However, the standard response wrapper might be in play.
            // Let's assume the response.data is the user object as per auth.module.go
            
            // Wait, auth.module.go returns c.JSON(userMap).
            // So response.data is the user map.
            setUser(response.data);
        } catch (error) {
            console.error('Failed to fetch user profile:', error);
            // If 401, clear token? Handled by interceptor.
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, []);

    return (
        <UserContext.Provider value={{ user, loading, refreshUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUser = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
};
