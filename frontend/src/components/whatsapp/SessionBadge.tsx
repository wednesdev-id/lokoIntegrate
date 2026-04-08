import React from 'react';
import { Session } from '@/contexts/SessionContext';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, AlertCircle, Circle } from 'lucide-react';

interface SessionBadgeProps {
    session: Session | null;
    size?: 'sm' | 'md' | 'lg';
    showPhone?: boolean;
    interactive?: boolean;
    onClick?: () => void;
    className?: string;
}

const SessionBadge: React.FC<SessionBadgeProps> = ({
    session,
    size = 'md',
    showPhone = true,
    interactive = false,
    onClick,
    className = ''
}) => {
    if (!session) {
        return (
            <div className={`flex items-center gap-2 text-gray-500 ${className}`}>
                <Circle className="h-4 w-4" />
                <span className="text-sm">No session selected</span>
            </div>
        );
    }

    // Size configurations
    const sizeConfig = {
        sm: {
            icon: 'h-3 w-3',
            text: 'text-xs',
            badge: 'text-[10px] py-0 px-1.5',
            container: 'gap-1.5 px-2 py-1'
        },
        md: {
            icon: 'h-4 w-4',
            text: 'text-sm',
            badge: 'text-xs py-0.5 px-2',
            container: 'gap-2 px-3 py-1.5'
        },
        lg: {
            icon: 'h-5 w-5',
            text: 'text-base',
            badge: 'text-sm py-1 px-2.5',
            container: 'gap-2.5 px-4 py-2'
        }
    };

    const config = sizeConfig[size];

    // Status configuration
    const statusConfig = {
        connected: {
            icon: CheckCircle2,
            iconColor: 'text-green-600',
            badgeClass: 'bg-green-500/10 text-green-700 border-green-500/20',
            label: 'Connected',
            glowClass: 'shadow-green-500/30'
        },
        qr_ready: {
            icon: AlertCircle,
            iconColor: 'text-yellow-600',
            badgeClass: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/20',
            label: 'QR Ready',
            glowClass: 'shadow-yellow-500/30'
        },
        connecting: {
            icon: AlertCircle,
            iconColor: 'text-blue-600',
            badgeClass: 'bg-blue-500/10 text-blue-700 border-blue-500/20',
            label: 'Connecting',
            glowClass: 'shadow-blue-500/30'
        },
        disconnected: {
            icon: Circle,
            iconColor: 'text-red-600',
            badgeClass: 'bg-red-500/10 text-red-700 border-red-500/20',
            label: 'Disconnected',
            glowClass: 'shadow-red-500/30'
        },
        created: {
            icon: Circle,
            iconColor: 'text-gray-600',
            badgeClass: 'bg-gray-500/10 text-gray-700 border-gray-500/20',
            label: 'Created',
            glowClass: 'shadow-gray-500/30'
        }
    };

    const status = statusConfig[session.status] || statusConfig.created;
    const StatusIcon = status.icon;

    return (
        <div
            className={`
        flex items-center ${config.container} 
        rounded-lg backdrop-blur-sm bg-white/60 border border-white/50
        transition-all duration-200
        ${interactive ? 'cursor-pointer hover:bg-white/80 hover:shadow-lg' : ''}
        ${session.status === 'connected' ? `shadow-lg ${status.glowClass}` : ''}
        ${className}
      `}
            onClick={interactive ? onClick : undefined}
        >
            {/* Icon */}
            <StatusIcon className={`${config.icon} ${status.iconColor}`} />

            {/* Session Info */}
            <div className="flex flex-col min-w-0">
                <span className={`font-medium ${config.text} truncate`}>
                    {session.session_name}
                </span>

                {showPhone && session.phone_number && (
                    <span className={`${config.text} text-gray-500 truncate`}>
                        {session.phone_number}
                    </span>
                )}
            </div>

            {/* Status Badge */}
            <Badge
                variant="outline"
                className={`${config.badge} ${status.badgeClass} whitespace-nowrap`}
            >
                {status.label}
            </Badge>
        </div>
    );
};

export default SessionBadge;
