import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer, ToastProps } from './Toast';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastContextType {
    addToast: (title: string, message: string, type?: ToastType, duration?: number) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Array<Omit<ToastProps, 'onClose'> & { id: string }>>([]);

    const addToast = useCallback((title: string, message: string, _type: ToastType = 'info', duration = 5000) => {
        const id = Math.random().toString(36).substr(2, 9);
        // Note: Currently Toast component doesn't support 'type' prop directly in UI, 
        // but we can extend it later. For now just passing title/message.
        setToasts((prev) => [...prev, { id, title, message, duration }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </ToastContext.Provider>
    );
};
