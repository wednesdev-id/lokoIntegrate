import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import authService from '@/services/auth.service';

const ProtectedRoute: React.FC = () => {
    const isAuthenticated = authService.isAuthenticated();
    const location = useLocation();

    if (!isAuthenticated) {
        // Redirect to the login page, but save the current location they were trying to go to
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
