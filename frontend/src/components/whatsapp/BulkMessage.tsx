import React, { useState } from 'react';
import { Radio, FileText, Smartphone, AlertCircle, Users, Calendar } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import SessionBadge from './SessionBadge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BroadcastCompose from './BroadcastCompose';
import BroadcastTemplates from './BroadcastTemplates';
import GroupBroadcastPanel from './GroupBroadcastPanel';
import BroadcastScheduleList from './BroadcastScheduleList';

const BulkMessage: React.FC = () => {
  const { activeSession } = useSession();
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('compose');

  // Called when user clicks "Use" on a template
  const handleUseTemplate = (templateBody: string) => {
    setMessage(templateBody);
    setActiveTab('compose');
  };

  // No active session
  if (!activeSession) {
    return (
      <Card className="backdrop-blur-xl bg-white/70 border-white/50">
        <CardContent className="p-12">
          <div className="text-center">
            <Smartphone className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No WhatsApp Session Selected</h3>
            <p className="text-sm text-gray-600">
              Please select a WhatsApp session to send broadcasts
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
              The session "{activeSession.session_name}" must be connected to send broadcasts
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
            <Radio className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>Broadcast</CardTitle>
              <CardDescription>Send personalized messages to multiple recipients</CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="compose" className="flex items-center gap-2">
              <Radio className="h-4 w-4" />
              Compose
            </TabsTrigger>
            <TabsTrigger value="group" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Group Broadcast
            </TabsTrigger>
            <TabsTrigger value="schedules" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Broadcast History
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Templates
            </TabsTrigger>
          </TabsList>

          <TabsContent value="compose">
            <BroadcastCompose message={message} setMessage={setMessage} />
            <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/40 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-blue-900">Broadcast History</p>
                <p className="text-xs text-blue-700">Lihat status kirim per penerima dan retry yang gagal.</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-blue-200 text-blue-700 hover:bg-blue-100"
                onClick={() => setActiveTab('schedules')}
              >
                Buka History
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="group">
            <GroupBroadcastPanel />
          </TabsContent>

          <TabsContent value="schedules">
            <BroadcastScheduleList />
          </TabsContent>

          <TabsContent value="templates">
            <BroadcastTemplates onUseTemplate={handleUseTemplate} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default BulkMessage;