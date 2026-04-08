import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Reply,
  Plus,
  Edit,
  Trash2,
  Play,
  GripVertical,
  Zap,
  Search,
  FileText,
  Code,
  Brain,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { api } from '@/services/api';
import { toast } from 'sonner';

interface AutoReplyRule {
  id: string;
  session_id: string;
  user_id: string;
  name: string;
  description?: string;
  match_type: 'exact' | 'contains' | 'regex' | 'ai';
  pattern: string;
  response_type: 'static' | 'ai';
  response?: string;
  instruction?: string;
  ai_config_source?: 'inherit' | 'basic' | 'full';
  ai_model?: string;
  ai_temperature?: number;
  ai_max_tokens?: number;
  priority: number;
  is_active: boolean;
  stop_on_match: boolean;
  match_count: number;
  last_matched?: string;
  created_at: string;
  updated_at: string;
}

interface Session {
  id: string;
  session_name: string;
  session_code?: string;
}

interface TestResult {
  matched: boolean;
  captures?: string[];
  confidence?: number;
  error?: string;
}

const matchTypeConfig = {
  exact: { icon: FileText, label: 'Exact', color: 'bg-blue-100 text-blue-700' },
  contains: { icon: Search, label: 'Contains', color: 'bg-purple-100 text-purple-700' },
  regex: { icon: Code, label: 'Regex', color: 'bg-orange-100 text-orange-700' },
  ai: { icon: Brain, label: 'AI Intent', color: 'bg-pink-100 text-pink-700' },
};

const AutoReplyList: React.FC = () => {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTestOpen, setIsTestOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutoReplyRule | null>(null);
  const [testMessage, setTestMessage] = useState('');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('all');

  const [formData, setFormData] = useState({
    session_id: '',
    name: '',
    description: '',
    match_type: 'contains' as 'exact' | 'contains' | 'regex' | 'ai',
    pattern: '',
    response_type: 'static' as 'static' | 'ai',
    response: '',
    instruction: '',
    ai_config_source: 'inherit' as 'inherit' | 'basic' | 'full',
    ai_model: '',
    ai_temperature: 0.7,
    ai_max_tokens: 2048,
    priority: 100,
    stop_on_match: true,
    is_active: true
  });

  const fetchRules = async () => {
    setLoading(true);
    try {
      let params = selectedSessionId && selectedSessionId !== 'all' ? `?session_id=${selectedSessionId}` : '';
      if (selectedSessionId && selectedSessionId !== 'all') {
        const session = sessions.find((s: any) => s.id === selectedSessionId);
        if (session && session.session_code) {
          params += `&session_code=${session.session_code}`;
        }
      }
      const res = await api.get(`/auto-reply-rules${params}`);
      setRules(res.data.data || []);
    } catch (error) {
      console.error('Failed to fetch rules', error);
      toast.error('Failed to load auto-reply rules');
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get('/whatsapp/v1/sessions');
      const sessionData = res.data?.data?.sessions || res.data?.data;
      setSessions(Array.isArray(sessionData) ? sessionData : []);
    } catch (error) {
      console.error('Failed to fetch sessions', error);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    fetchRules();
  }, [selectedSessionId]);

  const resetForm = () => {
    setFormData({
      session_id: sessions[0]?.id || '',
      name: '',
      description: '',
      match_type: 'contains',
      pattern: '',
      response_type: 'static',
      response: '',
      instruction: '',
      ai_config_source: 'inherit',
      ai_model: '',
      ai_temperature: 0.7,
      ai_max_tokens: 2048,
      priority: rules.length + 1,
      stop_on_match: true,
      is_active: true
    });
  };

  const handleCreate = async () => {
    if (!formData.session_id || !formData.name || !formData.pattern) {
      toast.error('Session, name, and pattern are required');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auto-reply-rules', formData);
      toast.success('Auto-reply rule created successfully');
      setIsCreateOpen(false);
      resetForm();
      fetchRules();
    } catch (error: any) {
      console.error('Failed to create rule', error);
      toast.error(error.response?.data?.error || 'Failed to create rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!selectedRule) return;

    setIsSubmitting(true);
    try {
      const payload: any = {};
      if (formData.name) payload.name = formData.name;
      if (formData.description) payload.description = formData.description;
      if (formData.match_type) payload.match_type = formData.match_type;
      if (formData.pattern) payload.pattern = formData.pattern;
      if (formData.response_type) payload.response_type = formData.response_type;
      if (formData.response) payload.response = formData.response;
      if (formData.instruction) payload.instruction = formData.instruction;
      if (formData.ai_config_source) payload.ai_config_source = formData.ai_config_source;
      if (formData.ai_model) payload.ai_model = formData.ai_model;
      payload.ai_temperature = formData.ai_temperature;
      payload.ai_max_tokens = formData.ai_max_tokens;
      payload.priority = formData.priority;
      payload.is_active = formData.is_active;
      payload.stop_on_match = formData.stop_on_match;

      await api.put(`/auto-reply-rules/${selectedRule.id}`, payload);
      toast.success('Auto-reply rule updated successfully');
      setIsEditOpen(false);
      setSelectedRule(null);
      fetchRules();
    } catch (error: any) {
      console.error('Failed to update rule', error);
      toast.error(error.response?.data?.error || 'Failed to update rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;

    try {
      await api.delete(`/auto-reply-rules/${ruleId}`);
      toast.success('Auto-reply rule deleted successfully');
      fetchRules();
    } catch (error) {
      console.error('Failed to delete rule', error);
      toast.error('Failed to delete rule');
    }
  };

  const handleTest = async () => {
    if (!testMessage || !formData.pattern) {
      toast.error('Please enter a test message and pattern');
      return;
    }

    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await api.post('/auto-reply-rules/test', {
        match_type: formData.match_type,
        pattern: formData.pattern,
        message: testMessage
      });
      setTestResult(res.data);
    } catch (error) {
      console.error('Failed to test pattern', error);
      toast.error('Failed to test pattern');
    } finally {
      setTestLoading(false);
    }
  };

  const openEdit = (rule: AutoReplyRule) => {
    setSelectedRule(rule);
    setFormData({
      session_id: rule.session_id,
      name: rule.name,
      description: rule.description || '',
      match_type: rule.match_type,
      pattern: rule.pattern,
      response_type: rule.response_type,
      response: rule.response || '',
      instruction: rule.instruction || '',
      ai_config_source: rule.ai_config_source || 'inherit',
      ai_model: rule.ai_model || '',
      ai_temperature: rule.ai_temperature || 0.7,
      ai_max_tokens: rule.ai_max_tokens || 2048,
      priority: rule.priority,
      stop_on_match: rule.stop_on_match,
      is_active: rule.is_active
    });
    setIsEditOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setIsCreateOpen(true);
  };

  const MatchTypeBadge = ({ type }: { type: string }) => {
    const config = matchTypeConfig[type as keyof typeof matchTypeConfig] || matchTypeConfig.contains;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Reply className="h-6 w-6 text-purple-600" />
            Auto-Reply Rules
          </h2>
          <p className="text-gray-500 mt-1">
            Create keyword-based auto-reply rules with AI integration
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedSessionId} onValueChange={setSelectedSessionId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Sessions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sessions</SelectItem>
              {sessions.map((session) => (
                <SelectItem key={session.id} value={session.id}>
                  {session.session_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={openCreate} className="bg-purple-600 hover:bg-purple-700">
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {loading ? (
          <Card className="bg-white/70 backdrop-blur-xl border-0 shadow-lg">
            <CardContent className="py-8 text-center text-gray-500">
              Loading rules...
            </CardContent>
          </Card>
        ) : rules.length === 0 ? (
          <Card className="bg-white/70 backdrop-blur-xl border-0 shadow-lg">
            <CardContent className="py-12 text-center">
              <Reply className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-600">No auto-reply rules yet</h3>
              <p className="text-gray-400 mt-1 mb-4">
                Create your first rule to start auto-replying to messages
              </p>
              <Button onClick={openCreate} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" />
                Create Rule
              </Button>
            </CardContent>
          </Card>
        ) : (
          rules.map((rule) => (
            <Card
              key={rule.id}
              className={`bg-white/70 backdrop-blur-xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 ${
                !rule.is_active ? 'opacity-60' : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="cursor-grab text-gray-400 hover:text-gray-600 mt-1">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800">{rule.name}</h3>
                      <MatchTypeBadge type={rule.match_type} />
                      {rule.response_type === 'ai' && (
                        <Badge className="bg-green-100 text-green-700 gap-1">
                          <Zap className="h-3 w-3" />
                          AI Response
                        </Badge>
                      )}
                      {!rule.is_active && (
                        <Badge className="bg-gray-100 text-gray-500">Inactive</Badge>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <code className="bg-gray-100 px-2 py-0.5 rounded text-purple-600 font-mono">
                        {rule.pattern}
                      </code>
                      <span className="mx-2">→</span>
                      <span className="text-gray-500 truncate">
                        {rule.response_type === 'ai'
                          ? rule.instruction?.substring(0, 50) + '...'
                          : rule.response?.substring(0, 50) + (rule.response && rule.response.length > 50 ? '...' : '')}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                      <span>Matches: {rule.match_count}</span>
                      {rule.last_matched && (
                        <span>Last: {new Date(rule.last_matched).toLocaleDateString()}</span>
                      )}
                      <span>Priority: {rule.priority}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(rule)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-600"
                      onClick={() => handleDelete(rule.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Auto-Reply Rule</DialogTitle>
            <DialogDescription>
              Create a new auto-reply rule with keyword matching and AI integration
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Rule Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Greeting Response"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session">Session *</Label>
                  <Select
                    value={formData.session_id}
                    onValueChange={(v) => setFormData({ ...formData, session_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map((session) => (
                        <SelectItem key={session.id} value={session.id}>
                          {session.session_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description for this rule"
                />
              </div>
            </div>

            {/* Matching Rules */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium text-gray-700">Matching Rules</h4>
              <div className="space-y-2">
                <Label>Match Type *</Label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(matchTypeConfig).map(([type, config]) => {
                    const Icon = config.icon;
                    return (
                      <Button
                        key={type}
                        type="button"
                        variant={formData.match_type === type ? 'default' : 'outline'}
                        className={`justify-start ${formData.match_type === type ? 'bg-purple-600' : ''}`}
                        onClick={() => setFormData({ ...formData, match_type: type as any })}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {config.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pattern">Pattern *</Label>
                <Textarea
                  id="pattern"
                  value={formData.pattern}
                  onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                  placeholder={
                    formData.match_type === 'exact' ? 'hello' :
                    formData.match_type === 'contains' ? 'price' :
                    formData.match_type === 'regex' ? 'order.*(\d{5,})' :
                    'User asking about product prices or discounts'
                  }
                  rows={2}
                />
                {formData.match_type === 'ai' && (
                  <p className="text-xs text-gray-500">
                    Describe the user intent (e.g., "User asking about refund policy")
                  </p>
                )}
              </div>
            </div>

            {/* Response Settings */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium text-gray-700">Response Settings</h4>
              <div className="space-y-2">
                <Label>Response Type *</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={formData.response_type === 'static' ? 'default' : 'outline'}
                    className={formData.response_type === 'static' ? 'bg-purple-600' : ''}
                    onClick={() => setFormData({ ...formData, response_type: 'static' })}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Static Text
                  </Button>
                  <Button
                    type="button"
                    variant={formData.response_type === 'ai' ? 'default' : 'outline'}
                    className={formData.response_type === 'ai' ? 'bg-purple-600' : ''}
                    onClick={() => setFormData({ ...formData, response_type: 'ai' })}
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    AI Generated
                  </Button>
                </div>
              </div>

              {formData.response_type === 'static' ? (
                <div className="space-y-2">
                  <Label htmlFor="response">Response Message *</Label>
                  <Textarea
                    id="response"
                    value={formData.response}
                    onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                    placeholder="Hello! 👋 Welcome to our store. How can I help you today?"
                    rows={3}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="instruction">AI Instruction *</Label>
                    <Textarea
                      id="instruction"
                      value={formData.instruction}
                      onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
                      placeholder="You are a helpful customer service assistant. Greet the customer warmly and offer assistance."
                      rows={3}
                    />
                  </div>

                  {/* AI Config */}
                  <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <div className="space-y-2">
                      <Label>AI Configuration</Label>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          type="button"
                          variant={formData.ai_config_source === 'inherit' ? 'default' : 'outline'}
                          size="sm"
                          className={formData.ai_config_source === 'inherit' ? 'bg-purple-600' : ''}
                          onClick={() => setFormData({ ...formData, ai_config_source: 'inherit' })}
                        >
                          Inherit
                        </Button>
                        <Button
                          type="button"
                          variant={formData.ai_config_source === 'basic' ? 'default' : 'outline'}
                          size="sm"
                          className={formData.ai_config_source === 'basic' ? 'bg-purple-600' : ''}
                          onClick={() => setFormData({ ...formData, ai_config_source: 'basic' })}
                        >
                          Basic
                        </Button>
                        <Button
                          type="button"
                          variant={formData.ai_config_source === 'full' ? 'default' : 'outline'}
                          size="sm"
                          className={formData.ai_config_source === 'full' ? 'bg-purple-600' : ''}
                          onClick={() => setFormData({ ...formData, ai_config_source: 'full' })}
                        >
                          Full
                        </Button>
                      </div>
                    </div>

                    {formData.ai_config_source !== 'inherit' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="ai_model">Model</Label>
                          <Input
                            id="ai_model"
                            value={formData.ai_model}
                            onChange={(e) => setFormData({ ...formData, ai_model: e.target.value })}
                            placeholder="google/gemini-2.5-flash"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ai_temperature">Temperature</Label>
                          <Input
                            id="ai_temperature"
                            type="number"
                            step="0.1"
                            min="0"
                            max="2"
                            value={formData.ai_temperature}
                            onChange={(e) => setFormData({ ...formData, ai_temperature: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                    )}

                    {formData.ai_config_source === 'full' && (
                      <div className="space-y-2">
                        <Label htmlFor="ai_max_tokens">Max Tokens</Label>
                        <Input
                          id="ai_max_tokens"
                          type="number"
                          value={formData.ai_max_tokens}
                          onChange={(e) => setFormData({ ...formData, ai_max_tokens: parseInt(e.target.value) })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Behavior */}
            <div className="space-y-4 border-t pt-4">
              <h4 className="font-medium text-gray-700">Behavior</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority (lower = higher)</Label>
                  <Input
                    id="priority"
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.stop_on_match}
                      onCheckedChange={(v) => setFormData({ ...formData, stop_on_match: v })}
                    />
                    <Label>Stop on match</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                    />
                    <Label>Active</Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestOpen(true)}>
              <Play className="h-4 w-4 mr-2" />
              Test Pattern
            </Button>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? 'Creating...' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Auto-Reply Rule</DialogTitle>
            <DialogDescription>
              Update the auto-reply rule settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Same form fields as create */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Rule Name *</Label>
                  <Input
                    id="edit-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Match Type *</Label>
                  <Select
                    value={formData.match_type}
                    onValueChange={(v) => setFormData({ ...formData, match_type: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="exact">Exact</SelectItem>
                      <SelectItem value="contains">Contains</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                      <SelectItem value="ai">AI Intent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-pattern">Pattern *</Label>
              <Textarea
                id="edit-pattern"
                value={formData.pattern}
                onChange={(e) => setFormData({ ...formData, pattern: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Response Type *</Label>
              <Select
                value={formData.response_type}
                onValueChange={(v) => setFormData({ ...formData, response_type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="static">Static Text</SelectItem>
                  <SelectItem value="ai">AI Generated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.response_type === 'static' ? (
              <div className="space-y-2">
                <Label htmlFor="edit-response">Response Message *</Label>
                <Textarea
                  id="edit-response"
                  value={formData.response}
                  onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                  rows={3}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="edit-instruction">AI Instruction *</Label>
                <Textarea
                  id="edit-instruction"
                  value={formData.instruction}
                  onChange={(e) => setFormData({ ...formData, instruction: e.target.value })}
                  rows={3}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-priority">Priority</Label>
                <Input
                  id="edit-priority"
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                />
              </div>
              <div className="flex items-center gap-4 pt-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label>Active</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.stop_on_match}
                    onCheckedChange={(v) => setFormData({ ...formData, stop_on_match: v })}
                  />
                  <Label>Stop on match</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isSubmitting ? 'Updating...' : 'Update Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Pattern Dialog */}
      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Test Pattern Matching</DialogTitle>
            <DialogDescription>
              Test your pattern against a sample message
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Current Pattern</Label>
              <code className="block bg-gray-100 px-3 py-2 rounded text-sm">
                {formData.pattern}
              </code>
            </div>
            <div className="space-y-2">
              <Label>Match Type</Label>
              <MatchTypeBadge type={formData.match_type} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-message">Test Message</Label>
              <Textarea
                id="test-message"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                placeholder="Enter a message to test..."
                rows={3}
              />
            </div>
            <Button onClick={handleTest} disabled={testLoading} className="w-full">
              {testLoading ? 'Testing...' : 'Test Match'}
            </Button>

            {testResult && (
              <div className={`p-4 rounded-lg ${testResult.matched ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {testResult.matched ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="font-medium text-green-700">Match Found!</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-gray-400" />
                      <span className="font-medium text-gray-600">No Match</span>
                    </>
                  )}
                </div>
                {testResult.captures && testResult.captures.length > 0 && (
                  <div className="text-sm text-gray-600">
                    Captures: {testResult.captures.join(', ')}
                  </div>
                )}
                {testResult.confidence !== undefined && (
                  <div className="text-sm text-gray-600">
                    Confidence: {(testResult.confidence * 100).toFixed(0)}%
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AutoReplyList;
