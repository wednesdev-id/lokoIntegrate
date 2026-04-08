import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Smartphone, Bot, Settings as SettingsIcon, AlertCircle, RefreshCw, QrCode, Trash2, Power, Plus, Clock, PhoneCall } from "lucide-react";
import { useSession } from "@/contexts/SessionContext";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SUPER_ADMIN } from "@/constants/roles";

// Interface for Session typing identical to context
export interface Session {
  id: number;
  session_id: string;
  session_name: string;
  phone_number?: string;
  status: 'created' | 'qr_ready' | 'connecting' | 'connected' | 'disconnected';
  qr_code?: string;
  last_connected?: string;
  ai_auto_reply?: boolean;
  ai_prompt?: string;
  api_key_id?: string;
  ai_model?: string;
  created_at: string;
  updated_at: string;
}

const SessionManagementTab = () => {
  const { sessions, createSession, deleteSession, connectSession, disconnectSession, refreshSessions } = useSession();
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrSession, setQrSession] = useState<Session | null>(null);
  const [qrCodeString, setQrCodeString] = useState<string>('');
  const [qrLoading, setQrLoading] = useState(false);
  const [qrExpiry, setQrExpiry] = useState(60);
  const [qrExpired, setQrExpired] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // AI Config Modal state
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiSession, setAiSession] = useState<Session | null>(null);
  const [aiAutoReply, setAiAutoReply] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiApiKeyId, setAiApiKeyId] = useState<string>('');
  const [aiModel, setAiModel] = useState<string>('');
  const [availableKeys, setAvailableKeys] = useState<any[]>([]);
  const [aiModels, setAiModels] = useState<any[]>([]);
  const [isSavingAI, setIsSavingAI] = useState(false);

  const fetchAiModels = async () => {
    try {
      const res = await fetch('/api/whatsapp/sessions/ai-models', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
      });
      const data = await res.json();
      setAiModels(data.ai_models || []);
    } catch (e) {
      console.error("Failed to fetch AI models", e);
    }
  };


  const fetchAvailableKeys = async () => {
    try {
      const res = await fetch('/api/whatsapp/sessions/api-keys', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
      });
      const data = await res.json();
      setAvailableKeys(data.api_keys || []);
    } catch (e) {
      console.error("Failed to fetch available keys", e);
    }
  };

  useEffect(() => {
    fetchAvailableKeys();
    fetchAiModels();
  }, []);


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Connected</Badge>;
      case 'qr_ready':
        return <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100">Waiting Scan</Badge>;
      default:
        return <Badge variant="secondary" className="bg-gray-100 text-gray-700 hover:bg-gray-100">Disconnected</Badge>;
    }
  };

  const handleCreate = async () => {
    const name = prompt('Enter a name for the new session:');
    if (!name) return;
    setIsCreating(true);
    try {
      const result: any = await createSession(name);
      if (result && result.session_id) {
        handleConnect(result.session_id);
      }
    } catch (e) {
      console.error("Failed to create", e);
    } finally {
      setIsCreating(false);
    }
  }

  const handleConnect = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      const result: any = await connectSession(sessionId);
      if (result && (result.status === 'qr_ready' || result.data?.status === 'qr_ready')) {
        setQrSession(sessions.find(s => s.session_id === sessionId) || null);
        setShowQRModal(true);
        setQrCodeString('');
        setQrExpired(false);
        setQrExpiry(60);
      }
    } catch (error) {
      console.error('Connect error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (session: Session) => {
    if (!confirm(`Are you sure you want to delete session "${session.session_name}"?`)) return;
    setActionLoading(session.session_id);
    try {
      await deleteSession(session.session_id);
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (sessionId: string) => {
    setActionLoading(sessionId);
    try {
      await disconnectSession(sessionId);
    } catch (error) {
      console.error('Disconnect error:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleShowQR = (session: Session) => {
    setQrSession(session);
    setQrCodeString('');
    setQrExpired(false);
    setQrExpiry(60);
    setShowQRModal(true);
  };

  const handleRefreshQR = async () => {
    if (!qrSession) return;
    setQrLoading(true);
    setQrCodeString('');
    setQrExpired(false);
    setQrExpiry(60);
    try {
      await connectSession(qrSession.session_id);
      refreshSessions();
    } catch (error) {
      console.error('Failed to refresh QR:', error);
      setQrExpired(true);
    }
  };

  const handleOpenAIConfig = (session: Session) => {
    setAiSession(session);
    setAiAutoReply(session.ai_auto_reply || false);
    setAiPrompt(session.ai_prompt || '');
    setAiApiKeyId(session.api_key_id || '');
    setAiModel(session.ai_model || '');
    setShowAIModal(true);
  };

  const handleSaveAIConfig = async () => {
    if (!aiSession) return;
    setIsSavingAI(true);
    try {
      const res = await fetch(`/api/whatsapp/v1/sessions/${aiSession.session_id}/ai-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          ai_auto_reply: aiAutoReply,
          ai_prompt: aiPrompt,
          api_key_id: aiApiKeyId || null,
          ai_model: aiModel
        })
      });
      if (!res.ok) throw new Error("Failed to save AI config");
      setShowAIModal(false);
      refreshSessions(); // refresh the list to show updated config
    } catch (error) {
      console.error('Failed to save AI config:', error);
      alert('Failed to save AI configuration');
    } finally {
      setIsSavingAI(false);
    }
  };

  useEffect(() => {
    if (!showQRModal || !qrSession || qrExpired) return;
    let isSubscribed = true;
    setQrLoading(true);

    const fetchQR = async () => {
      try {
        const res = await fetch(`/api/whatsapp/v1/sessions/${qrSession.session_id}/qr`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
        });
        const data = await res.json().catch(() => ({}));

        if (res.status === 404) {
          if (data?.error?.includes('QR code not available')) {
            setQrCodeString(prev => {
              if (prev) setQrExpired(true);
              return prev;
            });
          } else {
            setShowQRModal(false);
            refreshSessions();
          }
          return;
        }

        if (isSubscribed && data.success && data.data?.qr_code) {
          setQrCodeString(prev => {
            if (prev !== data.data.qr_code) {
              setQrExpiry(60);
              return data.data.qr_code;
            }
            return prev;
          });
          setQrLoading(false);
        }
      } catch (error) {
        console.error('Failed to fetch QR:', error);
      }
    };

    fetchQR();
    const pollInterval = setInterval(fetchQR, 3000);
    return () => {
      isSubscribed = false;
      clearInterval(pollInterval);
    };
  }, [showQRModal, qrSession?.session_id, qrExpired]);

  useEffect(() => {
    if (!showQRModal || qrExpired) return;
    const interval = setInterval(() => {
      setQrExpiry(prev => {
        if (prev <= 1) {
          setQrExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showQRModal, qrExpired]);

  return (
    <div className="bg-white p-6 rounded-lg shadow min-h-[400px]">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-medium text-gray-900">WhatsApp Sessions</h2>
          <p className="text-sm text-gray-500">Manage your connected WhatsApp devices and sessions.</p>
        </div>
        <Button onClick={handleCreate} disabled={isCreating} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Add Session
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session Name</TableHead>
              <TableHead>Phone Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Connected</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((session) => (
              <TableRow key={session.session_id}>
                <TableCell className="font-medium">{session.session_name}</TableCell>
                <TableCell className="text-gray-500">{session.phone_number || '-'}</TableCell>
                <TableCell>{getStatusBadge(session.status)}</TableCell>
                <TableCell className="text-gray-500 truncate max-w-[150px]">
                  {session.last_connected ? new Date(session.last_connected).toLocaleString() : '-'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {session.status === 'connected' ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleDisconnect(session.session_id)} disabled={actionLoading === session.session_id}>
                          <Power className="h-4 w-4 mr-2 text-orange-600" /> Disconnect
                        </Button>
                      </>
                    ) : session.status === 'qr_ready' ? (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleShowQR(session as any)} disabled={actionLoading === session.session_id}>
                          <QrCode className="h-4 w-4 mr-2 text-blue-600" /> Show QR
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleConnect(session.session_id)} disabled={actionLoading === session.session_id}>
                          <Power className="h-4 w-4 mr-2 text-green-600" /> Connect
                        </Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" className="text-purple-600 hover:text-purple-700 hover:bg-purple-50" onClick={() => handleOpenAIConfig(session as any)} disabled={actionLoading === session.session_id}>
                      <Bot className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleDelete(session as any)} disabled={actionLoading === session.session_id}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                  No WhatsApp sessions found. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={showQRModal} onOpenChange={setShowQRModal}>
        <DialogContent className="backdrop-blur-xl bg-white/90 border-white/50 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-blue-600" />
              Scan QR Code
            </DialogTitle>
            <DialogDescription>
              {qrSession?.session_name || 'Session'}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6">
            {qrLoading ? (
              <div className="flex flex-col items-center justify-center h-64 gap-4">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm text-gray-500">Generating secure QR code...</p>
              </div>
            ) : qrExpired ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="bg-red-50 p-4 rounded-full mb-4">
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">QR Code Expired</h3>
                <p className="text-center text-sm text-gray-600 mb-6 px-4">
                  For security reasons, the QR code has expired. Please refresh to generate a new one.
                </p>
                <Button onClick={handleRefreshQR} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Refresh QR Code
                </Button>
              </div>
            ) : qrCodeString ? (
              <>
                <div className="bg-white p-6 rounded-lg shadow-inner flex items-center justify-center">
                  <QRCodeSVG value={qrCodeString} size={256} level="H" />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    Open WhatsApp → Settings → Linked Devices → Link a Device
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-4 w-4 text-gray-500" />
                    <p className="text-xs text-gray-500">
                      Expires in {qrExpiry}s
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">QR code not available yet</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Config Modal */}
      <Dialog open={showAIModal} onOpenChange={setShowAIModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-600" />
              AI Auto-Reply Configuration
            </DialogTitle>
            <DialogDescription>
              Configure AI assistant for session: <strong>{aiSession?.session_name}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Enable AI Auto-Reply</h3>
                <p className="text-sm text-gray-500">Automatically reply to incoming messages when enabled.</p>
              </div>
              <input
                type="checkbox"
                checked={aiAutoReply}
                onChange={(e) => setAiAutoReply(e.target.checked)}
                className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
              />
            </div>

            {aiAutoReply && (
              <div className="space-y-3 pt-2">
                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                   <select 
                      className="w-full px-3 py-1.5 border rounded-md text-sm bg-white"
                      value={aiApiKeyId}
                      onChange={e => setAiApiKeyId(e.target.value)}
                   >
                      <option value="">Use Global Fallback</option>
                      {availableKeys.map(k => (
                         <option key={k.id} value={k.id}>{k.name} ({k.provider})</option>
                      ))}
                   </select>
                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">AI Model</label>
                   <select 
                      className="w-full px-3 py-1.5 border rounded-md text-sm bg-white"
                      value={aiModel}
                      onChange={e => setAiModel(e.target.value)}
                   >
                      <option value="">Select a model...</option>
                      {aiModels.map((m: any) => (
                         <option key={m.id} value={m.model_code}>{m.name} ({m.provider})</option>
                      ))}
                      {aiModel && !aiModels.find((m: any) => m.model_code === aiModel) && (
                         <option value={aiModel}>{aiModel}</option>
                      )}
                   </select>

                </div>

                <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">
                     System Prompt (Optional)
                   </label>
                   <textarea
                     className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-purple-500 focus:border-purple-500 min-h-[80px] text-sm"
                     placeholder="E.g., You are a customer service assistant..."
                     value={aiPrompt}
                     onChange={(e) => setAiPrompt(e.target.value)}
                   />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAIModal(false)}>Cancel</Button>
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handleSaveAIConfig}
              disabled={isSavingAI}
            >
              {isSavingAI ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const AIIntegrationTab = () => {
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [formData, setFormData] = useState({
    code: '',
    provider: 'openrouter',
    name: '',
    key: '',
    models: '',
    webhook_url: '',
    is_active: true
  });

  const [models, setModels] = useState<any[]>([]);
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [modelFormData, setModelFormData] = useState({ provider: 'openrouter', name: '', model_code: '' });

  const fetchModels = async () => {
    try {
      const res = await fetch('/api/settings/ai-models', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
      });
      const data = await res.json();
      setModels(data.ai_models || []);
    } catch (e) {
      console.error("Failed to fetch models", e);
    }
  };

  const handleSaveModel = async () => {
    try {
      const res = await fetch('/api/settings/ai-models', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify(modelFormData)
      });
      if (!res.ok) throw new Error("Failed to save model");
      setIsModelModalOpen(false);
      setModelFormData({ provider: 'openrouter', name: '', model_code: '' });
      fetchModels();
    } catch (e) {
      console.error(e);
      alert('Failed to save model');
    }
  };

  useEffect(() => {
    fetchApiKeys();
    fetchModels();
  }, []);


  const fetchApiKeys = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/settings/api-keys', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
      });
      if (res.status === 403) {
         throw new Error("Only Super Admins can configure global AI Providers.");
      }
      if (!res.ok) throw new Error("Failed to fetch API keys");
      const data = await res.json();
      setApiKeys(data.api_keys || []);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (key: any | null = null) => {
    if (key) {
      setEditingKey(key);
      setFormData({
        code: key.code,
        provider: key.provider,
        name: key.name,
        key: '', 
        models: key.models || '',
        webhook_url: key.webhook_url || '',
        is_active: key.is_active
      });
    } else {
      setEditingKey(null);
      setFormData({
        code: '',
        provider: 'openrouter',
        name: '',
        key: '',
        models: '',
        webhook_url: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setErrorMsg('');
    try {
      const url = editingKey ? `/api/settings/api-keys/${editingKey.id}` : '/api/settings/api-keys';
      const method = editingKey ? 'PUT' : 'POST';
      
      const payload = { ...formData };
      if (editingKey && !payload.key) {
         delete (payload as any).key; 
      }

      const res = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
         const errorData = await res.json();
         throw new Error(errorData.message || "Failed to save API key");
      }

      setIsModalOpen(false);
      fetchApiKeys();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this API Key?")) return;
    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
      });
      if (!res.ok) throw new Error("Failed to delete");
      fetchApiKeys();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  if (isLoading) return <div className="p-6">Loading AI settings...</div>;

  if (errorMsg === "Only Super Admins can configure global AI Providers.") {
    return (
      <div className="bg-red-50 p-6 rounded-lg border border-red-100 flex items-center gap-3">
        <AlertCircle className="w-6 h-6 text-red-500" />
        <p className="text-red-700 font-medium">{errorMsg}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-lg shadow">
         <div className="flex justify-between items-center mb-4">
            <div>
               <h2 className="text-lg font-medium text-gray-900">AI Keys Configuration</h2>
               <p className="text-sm text-gray-500">Manage multiple AI Providers & API Keys for WhatsApp Sessions.</p>
            </div>
            <Button onClick={() => handleOpenModal()} className="bg-purple-600 hover:bg-purple-700 text-white flex gap-1 items-center">
               <Plus className="w-4 h-4" /> Add Key
            </Button>
         </div>

         {errorMsg && (
            <div className="mb-4 bg-red-50 p-3 rounded text-red-600 text-sm flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" /> {errorMsg}
            </div>
         )}

         <div className="rounded-md border">
            <Table>
               <TableHeader>
                  <TableRow>
                     <TableHead>Code</TableHead>
                     <TableHead>Name</TableHead>
                     <TableHead>Provider</TableHead>
                     <TableHead>Models</TableHead>
                     <TableHead>Status</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {apiKeys.map((key) => (
                     <TableRow key={key.id}>
                        <TableCell className="font-medium"><code>{key.code}</code></TableCell>
                        <TableCell>{key.name}</TableCell>
                        <TableCell><Badge variant="outline">{key.provider}</Badge></TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-gray-500">{key.models || 'Any'}</TableCell>
                        <TableCell>
                           {key.is_active ? <Badge className="bg-green-100 text-green-800">Active</Badge> : <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                           <Button variant="ghost" size="sm" onClick={() => handleOpenModal(key)}>Edit</Button>
                           <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(key.id)}>
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </TableCell>
                     </TableRow>
                  ))}
               </TableBody>
            </Table>
         </div>
       </div>


       {/* AI Models Card */}
       <div className="bg-white p-6 rounded-lg shadow">
         <div className="flex justify-between items-center mb-4">
            <div>
               <h2 className="text-lg font-medium text-gray-900">AI Models Management</h2>
               <p className="text-sm text-gray-500">Manage available models for selection in WhatsApp sessions.</p>
            </div>
            <Button onClick={() => setIsModelModalOpen(true)} className="bg-purple-600 hover:bg-purple-700 text-white flex gap-1 items-center">
               <Plus className="w-4 h-4" /> Add Model
            </Button>
         </div>

         <div className="rounded-md border">
            <Table>
               <TableHeader>
                  <TableRow>
                     <TableHead>Name</TableHead>
                     <TableHead>Model Code</TableHead>
                     <TableHead>Provider</TableHead>
                     <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                  {models.map((model) => (
                     <TableRow key={model.id}>
                        <TableCell className="font-medium">{model.name}</TableCell>
                        <TableCell><code>{model.model_code}</code></TableCell>
                        <TableCell><Badge variant="outline">{model.provider}</Badge></TableCell>
                        <TableCell className="text-right space-x-2">
                           <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={async () => {
                              if (!confirm("Are you sure you want to delete this AI model?")) return;
                              await fetch(`/api/settings/ai-models/${model.id}`, {
                                 method: 'DELETE',
                                 headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
                              });
                              fetchModels();
                           }}>
                              <Trash2 className="w-4 h-4" />
                           </Button>
                        </TableCell>
                     </TableRow>
                  ))}
                  {models.length === 0 && (
                     <TableRow>
                        <TableCell colSpan={4} className="text-center py-4 text-gray-500">No models added. Add one to show in selection.</TableCell>
                     </TableRow>
                  )}
               </TableBody>
            </Table>
         </div>
       </div>


       {/* Create/Edit Modal */}
       <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
             <DialogHeader>
                <DialogTitle>{editingKey ? 'Edit API Key' : 'Add API Key'}</DialogTitle>
                <DialogDescription>Configure API credential and provider endpoints.</DialogDescription>
             </DialogHeader>
             <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                   <label className="text-right text-sm font-medium">Code</label>
                   <input className="col-span-3 px-3 py-1.5 border rounded-md text-sm" placeholder="e.g., OPENAI_SUPPORT" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                   <label className="text-right text-sm font-medium">Provider</label>
                   <input className="col-span-3 px-3 py-1.5 border rounded-md text-sm" placeholder="e.g., openrouter, openai" value={formData.provider} onChange={e => setFormData({...formData, provider: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                   <label className="text-right text-sm font-medium">Name</label>
                   <input className="col-span-3 px-3 py-1.5 border rounded-md text-sm" placeholder="e.g., Support Bot" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                   <label className="text-right text-sm font-medium">API Key</label>
                   <input type="password" className="col-span-3 px-3 py-1.5 border rounded-md text-sm" placeholder={editingKey ? "•••••••• (Leave blank to keep)" : "sk-..."} value={formData.key} onChange={e => setFormData({...formData, key: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                   <label className="text-right text-sm font-medium">Models</label>
                   <input className="col-span-3 px-3 py-1.5 border rounded-md text-sm" placeholder="comma-separated list" value={formData.models} onChange={e => setFormData({...formData, models: e.target.value})} />
                </div>
                 <div className="grid grid-cols-4 items-center gap-4">
                    <label className="text-right text-sm font-medium">Webhook URL</label>
                    <input className="col-span-3 px-3 py-1.5 border rounded-md text-sm" placeholder="https://..." value={(formData as any).webhook_url} onChange={e => setFormData({...formData, webhook_url: e.target.value})} />
                 </div>
                <div className="grid grid-cols-4 items-center gap-4">
                   <label className="text-right text-sm font-medium">Active</label>
                   <input type="checkbox" className="h-4 w-4" checked={formData.is_active} onChange={e => setFormData({...formData, is_active: e.target.checked})} />
                </div>
             </div>
             <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button className="bg-purple-600 text-white hover:bg-purple-700" onClick={handleSave}>Save</Button>
             </div>
          </DialogContent>
       </Dialog>

       {/* Create Model Modal */}
       <Dialog open={isModelModalOpen} onOpenChange={setIsModelModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
             <DialogHeader>
                <DialogTitle>Add AI Model</DialogTitle>
                <DialogDescription>Add a new LLM model with corresponding value identification keys.</DialogDescription>
             </DialogHeader>
             <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                   <label className="text-right text-sm font-medium">Name</label>
                   <input className="col-span-3 px-3 py-1.5 border rounded-md text-sm" placeholder="e.g., Gemini 2.5 Flash" value={modelFormData.name} onChange={e => setModelFormData({...modelFormData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                   <label className="text-right text-sm font-medium">Model Code</label>
                   <input className="col-span-3 px-3 py-1.5 border rounded-md text-sm" placeholder="e.g., google/gemini-2.5-flash" value={modelFormData.model_code} onChange={e => setModelFormData({...modelFormData, model_code: e.target.value})} />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                   <label className="text-right text-sm font-medium">Provider</label>
                   <input className="col-span-3 px-3 py-1.5 border rounded-md text-sm" placeholder="e.g., openrouter, openai" value={modelFormData.provider} onChange={e => setModelFormData({...modelFormData, provider: e.target.value})} />
                </div>
             </div>
             <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsModelModalOpen(false)}>Cancel</Button>
                <Button className="bg-purple-600 text-white hover:bg-purple-700" onClick={handleSaveModel}>Save</Button>
             </div>
          </DialogContent>
       </Dialog>

    </div>
  );
};

const GeneralSettingsTab = () => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const fetchWebhook = async () => {
      try {
        const res = await fetch('/api/whatsapp/webhook/status', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}` }
        });
        const data = await res.json();
        if (data.success && data.data) {
           setWebhookUrl(data.data.url || '');
           setIsEnabled(data.data.enabled || false);
        }
      } catch (e) {
        console.error("Failed to fetch webhook", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchWebhook();
  }, []);

  const handleSaveWebhook = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/whatsapp/webhook/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`
        },
        body: JSON.stringify({
          url: webhookUrl,
          enabled: isEnabled,
          max_retries: 3,
          retry_delay_seconds: 5
        })
      });
      if (res.ok) {
         setIsSaved(true);
         setTimeout(() => setIsSaved(false), 3000);
      }
    } catch (err) {
      console.error("Save webhook failed", err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-6">Loading general settings...</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex justify-between items-center mb-4 border-b pb-2">
           <h2 className="text-lg font-medium text-gray-900">API Configuration</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-500 bg-gray-50 text-sm"
                value="loko_test_key_v1_xyz..."
                readOnly
              />
              <Button variant="outline" className="mt-1">Regenerate</Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Use this key to authenticate external requests to the Loko platform.</p>
          </div>

          <div className="pt-2">
            <div className="flex justify-between items-center mb-1">
               <label className="block text-sm font-medium text-gray-700">Webhook URL</label>
               <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{isEnabled ? 'Enabled' : 'Disabled'}</span>
                  <input type="checkbox" className="h-4 w-4" checked={isEnabled} onChange={e => setIsEnabled(e.target.checked)} />
               </div>
            </div>
            <input
              type="url"
              className="mt-1 block w-full px-3 py-1.5 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 text-sm"
              placeholder="https://your-domain.com/webhook"
              value={webhookUrl}
              onChange={e => setWebhookUrl(e.target.value)}
            />
          </div>

          <div className="pt-2 flex items-center gap-4">
             <Button onClick={handleSaveWebhook} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                {isSaving ? 'Saving...' : 'Save Webhook'}
             </Button>
             {isSaved && <span className="text-sm text-green-600 flex items-center">Saved successfully</span>}
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Notification Settings</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900">Push Notifications</h3>
              <p className="text-sm text-gray-500">Receive alerts when sessions disconnect unexpectedly</p>
            </div>
            <input type="checkbox" defaultChecked className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
          </div>
          <div className="flex items-center justify-between">
            <div>
               <h3 className="text-sm font-medium text-gray-900">Email Reports</h3>
               <p className="text-sm text-gray-500">Weekly summary of message activity</p>
            </div>
            <input type="checkbox" className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

interface CsNumber {
  id: number;
  name: string;
  number: string;
  is_active: boolean;
}

const CsConfigurationTab = () => {
  const [numbers, setNumbers] = useState<CsNumber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CsNumber | null>(null);
  const [formData, setFormData] = useState({ name: '', number: '' });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchNumbers();
  }, []);

  const fetchNumbers = async () => {
    setIsLoading(true);
    try {
      const resp = await import('axios').then(m => m.default.get('/api/settings/cs-numbers'));
      setNumbers(resp.data.cs_numbers || []);
    } catch (e) {
      console.error("Fetch CS Numbers failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (item?: CsNumber) => {
    if (item) {
      setEditingItem(item);
      setFormData({ name: item.name, number: item.number });
    } else {
      setEditingItem(null);
      setFormData({ name: '', number: '' });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.number.trim()) return;
    setIsSaving(true);
    try {
      const axios = await import('axios').then(m => m.default);
      if (editingItem) {
        await axios.put(`/api/settings/cs-numbers/${editingItem.id}`, formData);
      } else {
        await axios.post('/api/settings/cs-numbers', formData);
      }
      setIsModalOpen(false);
      fetchNumbers();
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this CS number?")) return;
    try {
      const axios = await import('axios').then(m => m.default);
      await axios.delete(`/api/settings/cs-numbers/${id}`);
      fetchNumbers();
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const toggleActive = async (item: CsNumber) => {
    try {
      const axios = await import('axios').then(m => m.default);
      await axios.put(`/api/settings/cs-numbers/${item.id}`, { is_active: !item.is_active });
      fetchNumbers();
    } catch (e) {
      console.error("Toggle active failed", e);
    }
  };

  if (isLoading) return <div className="p-6">Loading CS configuration...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
        <div>
          <h2 className="text-lg font-medium text-gray-900">CS Support Configuration</h2>
          <p className="text-sm text-gray-500">Manage WhatsApp numbers display for the floating widget.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2">
          <Plus className="h-4 w-4" /> Add Number
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>No</TableHead>
              <TableHead>Operator Name</TableHead>
              <TableHead>WhatsApp Number</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {numbers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">No CS numbers configured.</TableCell>
              </TableRow>
            ) : (
              numbers.map((item, index) => (
                <TableRow key={item.id} className="hover:bg-gray-50">
                  <TableCell>{index + 1}</TableCell>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>{item.number}</TableCell>
                  <TableCell>
                     <button onClick={() => toggleActive(item)} className="cursor-pointer">
                        <Badge className={`${item.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {item.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                     </button>
                  </TableCell>
                  <TableCell className="text-right flex items-center justify-end gap-2 px-6 py-4">
                     <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(item)}><Power className="h-4 w-4 text-blue-500"/></Button>
                     <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-red-500"/></Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
         <DialogContent className="backdrop-blur-xl bg-white/90">
            <DialogHeader>
                <DialogTitle>{editingItem ? 'Edit CS Number' : 'Add CS Support Number'}</DialogTitle>
                <DialogDescription>Add name and WhatsApp number (with area code, e.g., 6281..)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 border-t border-b border-gray-100">
               <div className="space-y-1">
                  <label className="text-sm font-medium">Operator Name</label>
                  <input className="w-full px-3 py-2 border rounded-md text-sm" placeholder="e.g., Support Team 1" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
               </div>
               <div className="space-y-1">
                  <label className="text-sm font-medium">WhatsApp Number</label>
                  <input className="w-full px-3 py-2 border rounded-md text-sm" placeholder="e.g., 628123456789" value={formData.number} onChange={e => setFormData({...formData, number: e.target.value})} />
               </div>
            </div>
            <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={isSaving || !formData.name || !formData.number} className="bg-purple-600 hover:bg-purple-700">
                   {isSaving ? 'Saving...' : 'Save'}
                </Button>
            </div>
         </DialogContent>
      </Dialog>
    </div>
  );
}

const Settings = () => {
  // Read current user role from localStorage
  const userData = (() => {
    try { return JSON.parse(localStorage.getItem('user_data') || '{}'); } catch { return {}; }
  })();
  const isSuperAdminUser = userData?.role_code === SUPER_ADMIN ||
    userData?.role_id === SUPER_ADMIN;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="pb-4 border-b">
        <h1 className="text-2xl font-bold text-gray-900">Platform Settings</h1>
        <p className="text-gray-600 mt-1">Configure your workspace, AI integrations, and WhatsApp sessions.</p>
        {isSuperAdminUser && (
          <span className="inline-flex items-center mt-2 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
            Super Admin Access
          </span>
        )}
      </div>

      <Tabs defaultValue="sessions" className="w-full">
        <TabsList className={`grid w-full max-w-lg mb-8 ${isSuperAdminUser ? 'grid-cols-4' : 'grid-cols-2'}`}>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Sessions
          </TabsTrigger>
          {isSuperAdminUser && (
            <TabsTrigger value="ai" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Config
            </TabsTrigger>
          )}
          {isSuperAdminUser && (
            <TabsTrigger value="cs_config" className="flex items-center gap-2">
              <PhoneCall className="h-4 w-4" />
              CS Config
            </TabsTrigger>
          )}
          <TabsTrigger value="general" className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            General
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="mt-0 outline-none">
          <SessionManagementTab />
        </TabsContent>

        {isSuperAdminUser && (
          <TabsContent value="ai" className="mt-0 outline-none">
            <AIIntegrationTab />
          </TabsContent>
        )}

        {isSuperAdminUser && (
          <TabsContent value="cs_config" className="mt-0 outline-none">
            <CsConfigurationTab />
          </TabsContent>
        )}

        <TabsContent value="general" className="mt-0 outline-none">
          <GeneralSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Settings;