import React, { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/services/api';
import { toast } from 'sonner';
import { SUPER_ADMIN } from '@/constants/roles';

export const SubscriptionGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user, loading, refreshUser } = useUser();
    const [licenseKey, setLicenseKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // While loading, render children (ProtectedRoute already guards auth)
    // This prevents the full-screen loading flash that blocks the UI
    if (loading) {
        return <>{children}</>;
    }

    // If user is not logged in, let ProtectedRoute handle it
    if (!user) {
        return <>{children}</>;
    }

    // Super Admin bypass — no subscription required
    const isAdmin = user.role_code === SUPER_ADMIN || user.role_code === 'Administrator';
    if (isAdmin) {
        return <>{children}</>;
    }

    // Check expiration
    const isExpired = !user.subscription_expired_at || new Date(user.subscription_expired_at) < new Date();

    if (!isExpired) {
        return <>{children}</>;
    }

    const handleRedeem = async () => {
        if (!licenseKey.trim()) return;
        setIsSubmitting(true);
        try {
            await api.post('/subscription-packages/redeem', { key: licenseKey });
            toast.success('License activated successfully!');
            await refreshUser();
            setLicenseKey('');
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Failed to redeem license');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/login';
    };

    // Subscription expired: render children normally but show dialog on top.
    // Children are NOT blurred/blocked — dialog uses Radix backdrop naturally.
    return (
        <>
            {children}
            <Dialog open={true} onOpenChange={() => {}}>
                <DialogContent
                    className="sm:max-w-[425px] [&>button]:hidden"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Subscription Expired</DialogTitle>
                        <DialogDescription>
                            Your subscription has expired or is invalid. Please enter a valid license key to continue.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="license" className="text-right">
                                License Key
                            </Label>
                            <Input
                                id="license"
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value)}
                                className="col-span-3"
                                placeholder="LOKO-XXXX-YYYY"
                                onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex-row justify-between sm:justify-between">
                        <Button variant="ghost" onClick={handleLogout} className="text-red-500 hover:text-red-600 hover:bg-red-50">
                            Logout
                        </Button>
                        <Button type="submit" onClick={handleRedeem} disabled={isSubmitting || !licenseKey.trim()}>
                            {isSubmitting ? 'Activating...' : 'Activate License'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
};
