import React from 'react';
import { Users, Smartphone, AlertCircle } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import SessionBadge from './SessionBadge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const GroupManagement: React.FC = () => {
  const { activeSession } = useSession();

  // No active session
  if (!activeSession) {
    return (
      <Card className="backdrop-blur-xl bg-white/70 border-white/50">
        <CardContent className="p-12">
          <div className="text-center">
            <Smartphone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No WhatsApp Session Selected</h3>
            <p className="text-sm text-gray-600">
              Please select a session to manage WhatsApp groups
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Session not connected
  if (activeSession.status !== 'connected') {
    return (
      <Card className="backdrop-blur-xl bg-white/70 border-white/50">
        <CardContent className="p-12">
          <div className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Session Not Connected</h3>
            <p className="text-sm text-gray-600 mb-4">
              Connect the session "{activeSession.session_name}" to manage groups
            </p>
            <SessionBadge session={activeSession} size="md" showPhone={false} />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl">
      <CardHeader className="border-b border-white/50 bg-gradient-to-r from-blue-500/10 to-indigo-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>Group Management</CardTitle>
              <CardDescription>Manage WhatsApp groups for this session</CardDescription>
            </div>
          </div>
          <SessionBadge session={activeSession} size="sm" showPhone={true} />
        </div>
      </CardHeader>

      <CardContent className="p-12">
        <div className="text-center">
          <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Group Management</h3>
          <p className="text-gray-500 mb-4">
            Group management features for session: <span className="font-medium text-blue-600">{activeSession.session_name}</span>
          </p>
          <p className="text-sm text-gray-400">
            Group features will be implemented here (create, list, manage members, etc.)
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default GroupManagement;