import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '@/lib/utils';
import SessionSelector from '@/components/whatsapp/SessionSelector';
import QuickSessionSwitcher from '@/components/whatsapp/QuickSessionSwitcher';
import { Plus } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User } from "lucide-react";
import authService from "@/services/auth.service";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSession } from '@/contexts/SessionContext';
import { SUPER_ADMIN } from '@/constants/roles';
import FloatingCSWidget from './FloatingCSWidget';

// Map sidebar item IDs to actual route paths
const ID_TO_PATH: Record<string, string> = {
    'dashboard': '/dashboard',
    'device-status': '/whatsapp/device-status',
    'broadcast': '/whatsapp/broadcast',
    'group-management': '/whatsapp/group-management',
    'contact-management': '/whatsapp/contact-management',
    'chat-management': '/whatsapp/chat-management',
    'bot-management': '/whatsapp/bot-management',
    'settings': '/settings',
    'profile': '/profile',
    'user-management': '/users',
    'users': '/users',
    'subscriptions': '/subscriptions',
    'licenses': '/licenses',
    'reports': '/reports',
    'revenue': '/revenue',
    'payment-history': '/payment-history',
    'inventory-products': '/inventory/products',
    'inventory-orders': '/inventory/orders',
    'sales-revenue': '/sales/revenue',
    'sales-payments': '/sales/payments',
    'sales-transactions': '/sales/transactions',
    'super-admin-transactions': '/super-admin/transactions',
    'super-admin-invoices': '/super-admin/invoices',
    'master-data-contacts': '/master-data/contacts',
};


// Derive the active sidebar item ID from the current URL path
const getActiveItemFromPath = (pathname: string): string => {
    if (pathname.startsWith('/whatsapp/')) {
        const segment = pathname.replace('/whatsapp/', '');
        return segment || 'broadcast';
    }
    if (pathname.startsWith('/dashboard')) return 'dashboard';
    if (pathname.startsWith('/settings')) return 'settings';
    if (pathname.startsWith('/profile')) return 'profile';
    if (pathname.startsWith('/users')) return 'users';
    if (pathname.startsWith('/subscriptions')) return 'subscriptions';
    if (pathname.startsWith('/licenses')) return 'licenses';
    if (pathname.startsWith('/revenue')) return 'revenue';
    if (pathname.startsWith('/reports')) return 'reports';
    if (pathname.startsWith('/payment-history')) return 'payment-history';
    if (pathname.startsWith('/inventory/products')) return 'inventory-products';
    if (pathname.startsWith('/inventory/orders')) return 'inventory-orders';
    if (pathname.startsWith('/sales/revenue')) return 'sales-revenue';
    if (pathname.startsWith('/sales/payments')) return 'sales-payments';
    if (pathname.startsWith('/sales/transactions')) return 'sales-transactions';
    if (pathname.startsWith('/super-admin/subscription-transactions')) return 'super-admin-transactions';
    if (pathname.startsWith('/master-data/contacts')) return 'master-data-contacts';
    return 'dashboard';
};

const WhatsAppLayoutInner: React.FC = () => {
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [sessionName, setSessionName] = useState('');
    const [creating, setCreating] = useState(false);

    const { createSession } = useSession();
    const navigate = useNavigate();
    const location = useLocation();

    const activeItem = getActiveItemFromPath(location.pathname);
    const userData = authService.getUserData();
    const isSuperAdmin = userData?.role_code === SUPER_ADMIN || userData?.role_id === SUPER_ADMIN;

    const handleNavigate = (id: string) => {
        const path = ID_TO_PATH[id];
        if (path) navigate(path);
    };

    const toggleSidebar = () => {
        setIsSidebarCollapsed(!isSidebarCollapsed);
    };

    const handleCreateSession = async () => {
        if (!sessionName.trim()) {
            return;
        }

        setCreating(true);

        try {
            await createSession(sessionName.trim());
            setShowCreateModal(false);
            setSessionName('');
        } catch (error) {
            console.error('Create session error:', error);
            alert('Failed to create session. Please try again.');
        } finally {
            setCreating(false);
        }
    };

    const handleOpenCreateModal = () => {
        setShowCreateModal(true);
        setSessionName('');
    };

    const handleLogout = async () => {
        await authService.logout();
        navigate('/');
    };

    return (
        <>
            {!isSuperAdmin && <QuickSessionSwitcher />}
            <div className="flex h-screen bg-background">
                {/* Sidebar Navigation */}
                <Sidebar
                    activeItem={activeItem}
                    onNavigate={handleNavigate}
                    isCollapsed={isSidebarCollapsed}
                    onToggle={toggleSidebar}
                />

                {/* Main Content Area */}
                <main
                    className={cn(
                        "flex-1 overflow-hidden transition-all duration-300 w-full",
                        // Mobile: bottom padding for bottom nav bar (80px height)
                        "pb-20 md:pb-0",
                        // Desktop: adjust margin and width based on sidebar state
                        isSidebarCollapsed ? "md:ml-16 md:w-[calc(100%-4rem)]" : "md:ml-80 md:w-[calc(100%-20rem)]"
                    )}
                >
                    {/* Header with Session Selector - Desktop Only */}
                    <div className="hidden md:flex sticky top-0 z-50 items-center justify-between px-6 py-3 bg-white border-b border-gray-200">
                        <div className="flex items-center gap-3">
                            
                        </div>

                        {/* Right Actions: Session Selector + User Profile */}
                        <div className="flex items-center gap-4">
                            {!isSuperAdmin && (
                                <SessionSelector
                                    variant="navbar"
                                    showCreateButton={true}
                                    onCreateClick={handleOpenCreateModal}
                                />
                            )}

                            {/* User Profile Dropdown */}
                            {userData && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                                            <Avatar className="h-9 w-9 border border-gray-200">
                                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${userData.username}`} alt={userData.name} />
                                                <AvatarFallback className="bg-blue-100 text-blue-700 font-medium">
                                                    {userData.name?.substring(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56" align="end" forceMount>
                                        <DropdownMenuLabel className="font-normal">
                                            <div className="flex flex-col space-y-1">
                                                <p className="text-sm font-medium leading-none">{userData.name}</p>
                                                <p className="text-xs leading-none text-muted-foreground">
                                                    @{userData.username}
                                                </p>
                                            </div>
                                        </DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
                                            <User className="mr-2 h-4 w-4" />
                                            <span>Profile</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600 focus:text-red-600">
                                            <LogOut className="mr-2 h-4 w-4" />
                                            <span>Log out</span>
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>
                    </div>

                    {/* Main Content - scrollable full height */}
                    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Create Session Modal */}
            <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
                <DialogContent className="backdrop-blur-xl bg-white/90">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5 text-blue-600" />
                            Create New WhatsApp Session
                        </DialogTitle>
                        <DialogDescription>
                            Give your WhatsApp session a friendly name to identify it easily
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Session Name</label>
                            <Input
                                placeholder="e.g., Personal WhatsApp, Business Account"
                                value={sessionName}
                                onChange={(e) => setSessionName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !creating) {
                                        handleCreateSession();
                                    }
                                }}
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateModal(false)}
                            disabled={creating}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateSession}
                            disabled={!sessionName.trim() || creating}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {creating ? 'Creating...' : 'Create Session'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* Hide FloatingCSWidget on chat-management page */}
            {location.pathname !== '/whatsapp/chat-management' && <FloatingCSWidget />}
        </>
    );
};

export default WhatsAppLayoutInner;
