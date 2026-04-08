import React, { useState, useEffect } from 'react';
import { MessageSquare, RefreshCw, Clock, Check, CheckCheck, Smartphone } from 'lucide-react';
import { useSession } from '@/contexts/SessionContext';
import SessionBadge from './SessionBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import axios from 'axios';

interface Message {
  id: number;
  message_id: string;
  chat_jid: string;
  message_type: string;
  content: string;
  is_from_me: boolean;
  timestamp: string;
  status: string;
  created_at: string;
}

const MessageHistory: React.FC = () => {
  const { activeSession } = useSession();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [chatJID, setChatJID] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [isFromMe, setIsFromMe] = useState<string>('all');

  const fetchMessages = async () => {
    if (!activeSession) return;

    try {
      setLoading(true);

      const params: any = {
        session_id: activeSession.session_id,
        limit,
        offset
      };

      if (chatJID) params.chat_jid = chatJID;
      if (isFromMe !== 'all') params.is_from_me = isFromMe === 'sent';

      const response = await axios.get('/api/whatsapp/v1/messages', { params });

      if (response.data.success) {
        setMessages(response.data.data || []);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeSession && activeSession.status === 'connected') {
      fetchMessages();
    }
  }, [activeSession, limit, offset, chatJID, isFromMe]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <Check className="h-3 w-3 text-gray-400" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3 text-gray-400" />;
      case 'read':
        return <CheckCheck className="h-3 w-3 text-blue-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-400" />;
    }
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
              Please select a session to view message history
            </p>
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
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <div>
              <CardTitle>Message History</CardTitle>
              <CardDescription>View messages from this session</CardDescription>
            </div>
          </div>
          <SessionBadge session={activeSession} size="sm" showPhone={true} />
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Chat JID</label>
            <input
              type="text"
              value={chatJID}
              onChange={(e) => setChatJID(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md backdrop-blur-sm bg-white/60"
              placeholder="628123456789@s.whatsapp.net"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Direction</label>
            <select
              value={isFromMe}
              onChange={(e) => setIsFromMe(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md backdrop-blur-sm bg-white/60"
            >
              <option value="all">All Messages</option>
              <option value="sent">Sent</option>
              <option value="received">Received</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md backdrop-blur-sm bg-white/60"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-end">
            <Button
              onClick={fetchMessages}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-500 to-indigo-600"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Messages */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading messages...</p>
          </div>
        ) : messages.length > 0 ? (
          <>
            <div className="space-y-3 mb-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg border backdrop-blur-sm transition-all ${msg.is_from_me
                    ? 'bg-blue-50/60 border-blue-200 ml-auto mr-0'
                    : 'bg-white/60 border-gray-200'
                    } max-w-[80%]`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">
                        {msg.chat_jid}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {msg.message_type}
                      </Badge>
                    </div>
                    {getStatusIcon(msg.status)}
                  </div>

                  <p className="text-gray-900 text-sm mb-2">{msg.content}</p>

                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{new Date(msg.timestamp).toLocaleString()}</span>
                    <span className="capitalize">{msg.status}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-200">
              <Button
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
                variant="outline"
              >
                Previous
              </Button>
              <span className="text-sm text-gray-600">
                Showing {offset + 1} - {offset + messages.length}
              </span>
              <Button
                onClick={() => setOffset(offset + limit)}
                disabled={messages.length < limit}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No messages found</p>
            <p className="text-sm text-gray-400 mt-2">
              Messages will appear here once you start chatting
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MessageHistory;