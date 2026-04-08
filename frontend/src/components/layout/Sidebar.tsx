import React, { useState } from 'react';
import {
    Send,
    Users,
    UserPlus,
    MessageCircle,
    Menu,
    LayoutDashboard,
    ChevronDown,
    ChevronRight,
    Home,
    History,
    Sparkles,
    Settings as SettingsIcon,
    ShieldCheck,
    Package,
    Key,
    TrendingUp,
    DollarSign,
    ShoppingCart,
    CreditCard,
    FileText
} from 'lucide-react';

import { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { SUPER_ADMIN } from '@/constants/roles';
import { useUser } from '@/contexts/UserContext';

interface MenuItem {
    id: string;
    label: string;
    icon: LucideIcon;
}

interface MenuGroup {
    id: string;
    label: string;
    icon: LucideIcon;
    items: MenuItem[];
}

interface SidebarProps {
    activeItem: string;
    onNavigate: (itemId: string) => void;
    isCollapsed: boolean;
    onToggle: () => void;
}

const menuGroups: (MenuItem | MenuGroup)[] = [
    // Dashboard
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },

    // Customer group - WhatsApp features
    {
        id: 'management',
        label: 'Customer',
        icon: Users,
        items: [
            { id: 'broadcast', label: 'Broadcast', icon: Send },
            { id: 'contact-management', label: 'Contacts', icon: UserPlus },
            { id: 'chat-management', label: 'Chats', icon: MessageCircle },
            { id: 'bot-management', label: 'Bots', icon: Sparkles },
        ]
    },

    // Inventory Group
    {
        id: 'inventory',
        label: 'Inventory',
        icon: Package,
        items: [
            { id: 'inventory-products', label: 'Products', icon: Package },
            { id: 'inventory-orders', label: 'Orders', icon: ShoppingCart },
        ]
    },

    // Sales Group
    {
        id: 'sales',
        label: 'Sales',
        icon: DollarSign,
        items: [
            { id: 'sales-revenue', label: 'Revenue Dashboard', icon: TrendingUp },
            { id: 'sales-payments', label: 'Payments', icon: CreditCard },
            { id: 'sales-transactions', label: 'Transactions', icon: History },
        ]
    },

    // Payment group
    { id: 'payment-history', label: 'Payment History', icon: History },

    // Settings
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

// Bottom nav items for mobile (quick access)
const bottomNavItems: MenuItem[] = [
    { id: 'dashboard', label: 'Home', icon: Home },
    { id: 'chat-management', label: 'Chats', icon: MessageCircle },
    { id: 'contact-management', label: 'Contacts', icon: Users },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

const isMenuGroup = (item: MenuItem | MenuGroup): item is MenuGroup => {
    return 'items' in item;
};

// Desktop Sidebar Content Component
const SidebarContent: React.FC<{
    activeItem: string;
    onNavigate: (id: string) => void;
    isCollapsed: boolean;
    isMobile?: boolean;
}> = ({ activeItem, onNavigate, isCollapsed, isMobile = false }) => {
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
        new Set(['management'])
    );

    const { user } = useUser();
    
    // Check if super admin
    // Also check for "Administrator" string from DB if inconsistent
    const isSuperAdmin = user?.role_code === SUPER_ADMIN || user?.role_code === 'Administrator';

    const activeModules = user?.active_modules ? user.active_modules.split(',') : [];

    const toggleGroup = (groupId: string) => {
        if (isCollapsed && !isMobile) return;
        const newExpanded = new Set(expandedGroups);
        if (newExpanded.has(groupId)) {
            newExpanded.delete(groupId);
        } else {
            newExpanded.add(groupId);
        }
        setExpandedGroups(newExpanded);
    };

    const handleNavigate = (id: string) => {
        onNavigate(id);
    };

    const renderMenuItem = (item: MenuItem, isSubItem = false) => {
        const Icon = item.icon;
        const isActive = activeItem === item.id;

        return (
            <Button
                key={item.id}
                variant={isActive ? "default" : "ghost"}
                className={cn(
                    "w-full justify-start gap-3 transition-all duration-300 group relative overflow-hidden",
                    isSubItem && !isCollapsed && "pl-12",
                    isCollapsed && !isMobile && "justify-center px-2",
                    isActive && "bg-zinc-800 text-white shadow-md",
                    !isActive && "hover:bg-zinc-100 hover:text-zinc-900 text-zinc-600 hover:shadow-sm"
                )}
                onClick={() => handleNavigate(item.id)}
                title={isCollapsed && !isMobile ? item.label : undefined}
            >
                {/* Shimmer effect for active items */}
                {isActive && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                )}

                <Icon className={cn(
                    "h-5 w-5 flex-shrink-0 transition-transform duration-300",
                    isActive && "drop-shadow-sm",
                    "group-hover:scale-110"
                )} />

                {(!isCollapsed || isMobile) && (
                    <span className={cn(
                        "text-sm font-medium transition-all duration-300",
                        isActive && "font-semibold"
                    )}>
                        {item.label}
                    </span>
                )}

                {/* Glow effect for active items */}
                {isActive && <div className="absolute inset-0 bg-white/5 blur-xl -z-10" />}
            </Button>
        );
    };

    const renderMenuGroup = (group: MenuGroup) => {
        const Icon = group.icon;
        const isExpanded = expandedGroups.has(group.id);
        const hasActiveChild = group.items.some(item => item.id === activeItem);

        if (isCollapsed && !isMobile) {
            return (
                <Button
                    key={group.id}
                    variant={hasActiveChild ? "default" : "ghost"}
                    className={cn(
                        "w-full justify-center px-2 transition-all duration-300 group",
                        hasActiveChild && "bg-zinc-800 text-white shadow-md"
                    )}
                    onClick={() => handleNavigate(group.items[0].id)}
                    title={group.label}
                >
                    <Icon className="h-5 w-5 transition-transform duration-300 group-hover:scale-110" />
                </Button>
            );
        }

        return (
            <Collapsible
                key={group.id}
                open={isExpanded}
                onOpenChange={() => toggleGroup(group.id)}
                className="space-y-1"
            >
                <CollapsibleTrigger asChild>
                    <Button
                        variant={hasActiveChild && !isExpanded ? "secondary" : "ghost"}
                        className={cn(
                            "w-full justify-between group hover:bg-zinc-100 transition-all duration-300 text-zinc-700",
                            hasActiveChild && !isExpanded && "bg-zinc-100 border-l-4 border-zinc-800 text-zinc-900"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110" />
                            <span className="text-sm font-medium">{group.label}</span>
                        </div>
                        <ChevronDown
                            className={cn(
                                "h-4 w-4 transition-all duration-300",
                                isExpanded ? "rotate-180" : "rotate-0",
                                "group-hover:text-zinc-900"
                            )}
                        />
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-1 overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    {group.items.map(item => renderMenuItem(item, true))}
                </CollapsibleContent>
            </Collapsible>
        );
    };

    return (
        <div className="space-y-1 py-2">
            {menuGroups.map((item) => {
                // Hide customer menu for Super Admin (WhatsApp Management, Inventory, Sales)
                if (isSuperAdmin && (item.id === 'management' || item.id === 'inventory' || item.id === 'sales')) return null;

                // Filter for Customer based on Subscription Package
                if (!isSuperAdmin) {
                    const alwaysShow = ['dashboard', 'settings', 'payment-history'];
                    const moduleMap: Record<string, string> = {
                        'management': 'whatsapp',
                        'inventory': 'inventory',
                        'sales': 'sales'
                    };
                    const moduleId = moduleMap[item.id] || item.id;
                    
                    // If not in always show list, check active modules
                    if (!alwaysShow.includes(item.id) && !activeModules.includes(moduleId)) {
                        return null;
                    }
                }

                return (
                    <div key={item.id}>
                        {isMenuGroup(item) ? renderMenuGroup(item) : renderMenuItem(item)}
                    </div>
                );
            })}
            {/* Admin-only: User Management & Subscriptions */}
            {isSuperAdmin && (
                <>
                    {renderMenuItem({ id: 'users', label: 'User Management', icon: ShieldCheck })}
                    {renderMenuItem({ id: 'master-data-contacts', label: 'Master Data Kontak', icon: Users })}
                    {renderMenuItem({ id: 'subscriptions', label: 'Subscriptions', icon: Package })}
                    {renderMenuItem({ id: 'licenses', label: 'License Generator', icon: Key })}
                    {renderMenuItem({ id: 'revenue', label: 'Revenue', icon: DollarSign })}
                    {renderMenuItem({ id: 'reports', label: 'Sub. Reports', icon: TrendingUp })}
                    {renderMenuItem({ id: 'super-admin-transactions', label: 'Transaction', icon: History })}
                    {renderMenuItem({ id: 'super-admin-invoices', label: 'Invoices', icon: FileText })}
                </>

            )}
        </div>
    );
};

// Main Sidebar Component
const Sidebar: React.FC<SidebarProps> = ({ activeItem, onNavigate, isCollapsed, onToggle }) => {
    const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

    const { user } = useUser();
    const isSuperAdmin = user?.role_code === SUPER_ADMIN || user?.role_code === 'Administrator';

    const handleMobileNavigate = (id: string) => {
        onNavigate(id);
        setMobileSheetOpen(false);
    };

    return (
        <>
            {/* Mobile Bottom Navigation Bar */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl bg-white/80 border-t border-gray-200/50 shadow-2xl">
                <div className="grid grid-cols-5 gap-1 p-2">
                    {/* Bottom nav quick access items */}
                    {bottomNavItems.map((item) => {
                        if (isSuperAdmin && (item.id === 'device-status' || item.id === 'chat-management' || item.id === 'contact-management')) {
                            return null;
                        }
                        const Icon = item.icon;
                        const isActive = activeItem === item.id;
                        return (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={cn(
                                    "flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 relative group",
                                    isActive
                                        ? "bg-zinc-800 text-white shadow-lg scale-105"
                                        : "text-gray-600 hover:bg-zinc-100 hover:scale-105 active:scale-95"
                                )}
                            >
                                {isActive && (
                                    <div className="absolute inset-0 bg-white/10 blur-lg rounded-xl" />
                                )}
                                <Icon className={cn(
                                    "h-5 w-5 mb-1 transition-transform duration-300",
                                    isActive && "drop-shadow-sm",
                                    "group-hover:scale-110"
                                )} />
                                <span className={cn(
                                    "text-xs font-medium truncate w-full text-center transition-all duration-300",
                                    isActive && "font-semibold"
                                )}>
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}

                    {/* Menu button to open full navigation */}
                    <Sheet open={mobileSheetOpen} onOpenChange={setMobileSheetOpen}>
                        <SheetTrigger asChild>
                            <button className="flex flex-col items-center justify-center p-2 rounded-xl text-gray-600 hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 hover:scale-105 active:scale-95 transition-all duration-300 group">
                                <Menu className="h-5 w-5 mb-1 transition-transform duration-300 group-hover:scale-110" />
                                <span className="text-xs font-medium">Menu</span>
                            </button>
                        </SheetTrigger>
                        <SheetContent side="bottom" className="h-[85vh] p-0 rounded-t-3xl backdrop-blur-xl bg-white/95 border-t-2 border-gray-200/50">
                            <div className="flex flex-col h-full">
                                {/* Sheet Header with glassmorphism */}
                                <div className="p-6 border-b border-gray-200/50 bg-gradient-to-br from-blue-50/80 via-indigo-50/80 to-purple-50/50 backdrop-blur-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-md opacity-50"></div>
                                            <div className="relative w-12 h-12 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                                                <span className="text-white font-bold text-2xl">L</span>
                                                <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400 animate-pulse" />
                                            </div>
                                        </div>
                                        <div>
                                            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                                Loko
                                            </h1>
                                            <p className="text-sm text-gray-600 font-medium">Management Panel</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Sheet Navigation */}
                                <ScrollArea className="flex-1 px-4">
                                    <SidebarContent
                                        activeItem={activeItem}
                                        onNavigate={handleMobileNavigate}
                                        isCollapsed={false}
                                        isMobile={true}
                                    />
                                </ScrollArea>

                                {/* Sheet Footer with gradient */}
                                <div className="p-4 border-t border-gray-200/50 bg-gradient-to-r from-gray-50 to-blue-50/50 backdrop-blur-sm">
                                    <p className="text-xs text-gray-500 text-center font-medium">
                                        v1.0.0 - Loko Backend © 2024
                                    </p>
                                </div>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>

            {/* Desktop Sidebar - Glassmorphism Design */}
            <div
                className={cn(
                    "hidden md:flex flex-col fixed left-0 top-0 h-screen transition-all duration-300 z-40",
                    "backdrop-blur-xl bg-white/90 border-r border-gray-200/50 shadow-2xl",
                    isCollapsed ? "w-20" : "w-80"
                )}
            >
                {/* Desktop Header with premium gradient */}
                <div className={cn(
                    "p-4 border-b border-gray-200/50 flex items-center justify-between",
                    "bg-gradient-to-br from-blue-50/80 via-indigo-50/80 to-purple-50/50 backdrop-blur-sm",
                    isCollapsed && "justify-center"
                )}>
                    {!isCollapsed && (
                        <div className="flex-1 flex items-center gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl blur-md opacity-50"></div>
                                <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-xl">
                                    <span className="text-white font-bold text-lg">L</span>
                                </div>
                            </div>
                            <div>
                                <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                                    Loko
                                </h1>
                                <p className="text-xs text-gray-600 font-medium">Management</p>
                            </div>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggle}
                        className="hover:bg-gradient-to-br hover:from-blue-100 hover:to-indigo-100 transition-all duration-300 shrink-0 group"
                        title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    >
                        {isCollapsed ? (
                            <ChevronRight className="h-5 w-5 transition-transform duration-300 group-hover:scale-110 group-hover:text-blue-600" />
                        ) : (
                            <ChevronDown className="h-5 w-5 rotate-90 transition-transform duration-300 group-hover:scale-110 group-hover:text-blue-600" />
                        )}
                    </Button>
                </div>

                {/* Desktop Navigation with scroll */}
                <ScrollArea className="flex-1 px-3 py-2">
                    <SidebarContent
                        activeItem={activeItem}
                        onNavigate={onNavigate}
                        isCollapsed={isCollapsed}
                    />
                </ScrollArea>

                {/* Desktop Footer with gradient */}
                {!isCollapsed && (
                    <>
                        <Separator className="bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                        <div className="p-4 bg-gradient-to-r from-gray-50 to-blue-50/50 backdrop-blur-sm">
                            <p className="text-xs text-gray-500 text-center font-medium">
                                v1.0.0 - Loko Backend
                            </p>
                            <p className="text-xs text-gray-400 text-center mt-1">
                                © 2024 All rights reserved
                            </p>
                        </div>
                    </>
                )}
            </div>
        </>
    );
};

export default Sidebar;
