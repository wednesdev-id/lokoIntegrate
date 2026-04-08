import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Plus, Edit, Trash2, Bot as BotIcon, Copy, Check, Zap, Cpu, AlertCircle, Reply } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { api } from '@/services/api';
import { toast } from 'sonner';
import AutoReplyList from './AutoReplyList';

interface Bot {
    id: string;
    user_id: string;
    name: string;
    description: string;
    instruction: string;
    trigger?: string;
    bot_code: string;
    is_active: boolean;
    temperature?: number;
    max_tokens?: number;
    template_id?: string;
    ai_provider?: string;
    ai_model?: string;
    created_at: string;
}

interface BotTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    instruction: string;
    is_system: boolean;
}

interface BotUsage {
    current_bots: number;
    max_bots: number;
    available_bots: number;
    usage_percent: number;
    is_limit_reached: boolean;
    ai_quota: number;
    ai_limit: number;
}

const BotManagement: React.FC = () => {
    const [activeTab, setActiveTab] = useState('bots');
    const [bots, setBots] = useState<Bot[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        instruction: '',
        trigger: '',
        template_id: undefined as string | undefined,
        temperature: undefined as number | undefined,
        max_tokens: undefined as number | undefined,
        is_active: true
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);
    const [usage, setUsage] = useState<BotUsage | null>(null);
    const [usageLoading, setUsageLoading] = useState(true);
    const [templates, setTemplates] = useState<BotTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [aiConfig, setAiConfig] = useState<{ provider: string; model: string } | null>(null);

    const fetchBots = async () => {
        setLoading(true);
        try {
            const res = await api.get('/bots');
            setBots(res.data.data);
        } catch (error) {
            console.error('Failed to fetch bots', error);
            toast.error('Failed to load bots');
        } finally {
            setLoading(false);
        }
    };

    const fetchUsage = async () => {
        setUsageLoading(true);
        try {
            const res = await api.get('/bots/usage');
            setUsage(res.data.data);
            // Set AI config from first bot's subscription (they all use same subscription)
            if (res.data.data.current_bots > 0) {
                const botsRes = await api.get('/bots');
                const firstBot = botsRes.data.data[0];
                if (firstBot) {
                    setAiConfig({
                        provider: firstBot.ai_provider || 'openai',
                        model: firstBot.ai_model || 'gpt-4o'
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch usage', error);
        } finally {
            setUsageLoading(false);
        }
    };

    const fetchTemplates = async () => {
        setTemplatesLoading(true);
        try {
            const res = await api.get('/bot-templates');
            setTemplates(res.data.data);
        } catch (error) {
            console.error('Failed to fetch templates', error);
        } finally {
            setTemplatesLoading(false);
        }
    };

    useEffect(() => {
        fetchBots();
        fetchUsage();
        fetchTemplates();
    }, []);

    const handleCreate = async () => {
        if (!formData.name) {
            toast.error('Bot name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload: any = {
                name: formData.name,
                description: formData.description,
                trigger: formData.trigger,
                template_id: formData.template_id || undefined
            };
            // Only include instruction if not using template
            if (!formData.template_id) {
                payload.instruction = formData.instruction;
            }
            // Optional overrides
            if (formData.temperature !== undefined) {
                payload.temperature = formData.temperature;
            }
            if (formData.max_tokens !== undefined) {
                payload.max_tokens = formData.max_tokens;
            }

            await api.post('/bots', payload);
            toast.success('Bot created successfully');
            setIsCreateOpen(false);
            resetForm();
            fetchBots();
            fetchUsage();
        } catch (error: any) {
            console.error('Create error:', error);
            toast.error(error.response?.data?.message || 'Failed to create bot');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async () => {
        if (!selectedBot) return;

        setIsSubmitting(true);
        try {
            const payload: any = {
                name: formData.name,
                description: formData.description,
                instruction: formData.instruction,
                trigger: formData.trigger,
                // Must be sent explicitly so backend can toggle bot activation state.
                is_active: formData.is_active
            };
            // Optional overrides
            if (formData.temperature !== undefined) {
                payload.temperature = formData.temperature;
            }
            if (formData.max_tokens !== undefined) {
                payload.max_tokens = formData.max_tokens;
            }

            await api.put(`/bots/${selectedBot.id}`, payload);
            toast.success('Bot updated successfully');
            setIsEditOpen(false);
            setSelectedBot(null);
            resetForm();
            fetchBots();
        } catch (error: any) {
            console.error('Update error:', error);
            toast.error(error.response?.data?.message || 'Failed to update bot');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this bot?')) return;

        try {
            await api.delete(`/bots/${id}`);
            toast.success('Bot deleted successfully');
            fetchBots();
            fetchUsage();
        } catch (error) {
            toast.error('Failed to delete bot');
        }
    };

    const openEdit = (bot: Bot) => {
        setSelectedBot(bot);
        setFormData({
            name: bot.name,
            description: bot.description,
            instruction: bot.instruction,
            trigger: bot.trigger || '',
            template_id: bot.template_id,
            temperature: bot.temperature,
            max_tokens: bot.max_tokens,
            is_active: bot.is_active
        });
        setIsEditOpen(true);
    };

    const resetForm = () => {
        setFormData({
            name: '',
            description: '',
            instruction: '',
            trigger: '',
            template_id: undefined,
            temperature: undefined,
            max_tokens: undefined,
            is_active: true
        });
    };

    const handleTemplateSelect = (templateId: string) => {
        if (templateId === 'custom') {
            setFormData({
                ...formData,
                template_id: undefined,
                instruction: ''
            });
            return;
        }
        const template = templates.find(t => t.id === templateId);
        if (template) {
            setFormData({
                ...formData,
                template_id: templateId,
                instruction: template.instruction
            });
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedCode(text);
        setTimeout(() => setCopiedCode(null), 2000);
        toast.success('Bot Code copied to clipboard');
    };

    return (
        <div className="space-y-6">
            {/* AI Config Card - Shows subscription AI settings */}
            {!usageLoading && aiConfig && (
                <Card className="backdrop-blur-xl bg-gradient-to-br from-blue-50/80 to-cyan-50/80 border-blue-200/50 shadow-xl">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="p-2 bg-blue-600/20 rounded-lg">
                                <Cpu className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-blue-900">AI Configuration</h3>
                                <p className="text-sm text-blue-700/70">From your subscription package</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white/60 rounded-lg p-3">
                                <p className="text-xs text-blue-700/70 mb-1">AI Provider</p>
                                <p className="font-semibold text-blue-900 capitalize">{aiConfig.provider}</p>
                            </div>
                            <div className="bg-white/60 rounded-lg p-3">
                                <p className="text-xs text-blue-700/70 mb-1">AI Model</p>
                                <p className="font-semibold text-blue-900">{aiConfig.model}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Usage Card */}
            {!usageLoading && usage && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Bots Usage */}
                    <Card className="backdrop-blur-xl bg-gradient-to-br from-purple-50/80 to-indigo-50/80 border-purple-200/50 shadow-xl">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-600/20 rounded-lg">
                                        <Zap className="h-5 w-5 text-purple-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-purple-900">Bot Usage</h3>
                                        <p className="text-sm text-purple-700/70">Based on your subscription package</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-2xl font-bold ${usage.is_limit_reached ? 'text-red-600' : 'text-purple-600'}`}>
                                        {usage.current_bots}/{usage.max_bots}
                                    </span>
                                    <p className="text-xs text-purple-700/70">bots used</p>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="h-3 bg-purple-200/50 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            usage.is_limit_reached
                                                ? 'bg-red-500'
                                                : usage.usage_percent > 75
                                                    ? 'bg-orange-500'
                                                    : 'bg-purple-600'
                                        }`}
                                        style={{ width: `${Math.min(usage.usage_percent, 100)}%` }}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 text-sm">
                                <span className="text-purple-700/70">
                                    {usage.available_bots} bot{usage.available_bots !== 1 ? 's' : ''} available
                                </span>
                                {usage.is_limit_reached && (
                                    <span className="flex items-center gap-1 text-red-600 font-medium">
                                        <AlertCircle className="h-4 w-4" />
                                        Limit reached
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* AI Quota Usage */}
                    <Card className="backdrop-blur-xl bg-gradient-to-br from-blue-50/80 to-cyan-50/80 border-blue-200/50 shadow-xl">
                        <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-blue-600/20 rounded-lg">
                                        <Cpu className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-blue-900">AI Quota</h3>
                                        <p className="text-sm text-blue-700/70">Remaining monthly quota</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-2xl font-bold ${usage.ai_quota <= 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                        {usage.ai_quota}/{usage.ai_limit}
                                    </span>
                                    <p className="text-xs text-blue-700/70">credits left</p>
                                </div>
                            </div>
                            <div className="relative">
                                <div className="h-3 bg-blue-200/50 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                            usage.ai_quota <= 0
                                                ? 'bg-red-500'
                                                : usage.ai_quota < usage.ai_limit * 0.2
                                                    ? 'bg-orange-500'
                                                    : 'bg-blue-600'
                                        }`}
                                        style={{ width: `${Math.min((usage.ai_quota / usage.ai_limit) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 text-sm">
                                <span className="text-blue-700/70">
                                    {usage.ai_quota} credits available
                                </span>
                                {usage.ai_quota <= 0 && (
                                    <span className="flex items-center gap-1 text-red-600 font-medium">
                                        <AlertCircle className="h-4 w-4" />
                                        Quota exceeded
                                    </span>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tabs for Bots and Auto-Reply */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="bots" className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        AI Bots
                    </TabsTrigger>
                    <TabsTrigger value="autoreply" className="flex items-center gap-2">
                        <Reply className="h-4 w-4" />
                        Auto-Reply
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="bots">
                    <Card className="backdrop-blur-xl bg-white/70 border-white/50 shadow-xl">
                        <CardHeader className="border-b border-white/50 bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Sparkles className="h-6 w-6 text-purple-600" />
                                    <div>
                                        <CardTitle>AI Bots</CardTitle>
                                        <CardDescription>Create and manage your AI assistants</CardDescription>
                                    </div>
                                </div>
                                <Button
                                    onClick={() => setIsCreateOpen(true)}
                                    className="bg-purple-600 hover:bg-purple-700"
                                    disabled={usage?.is_limit_reached || false}
                                >
                                    {usage?.is_limit_reached ? (
                                        <>
                                            <AlertCircle className="h-4 w-4 mr-2" />
                                            Limit Reached
                                        </>
                                    ) : (
                                        <>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Create Bot
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Loading bots...</div>
                    ) : bots.length === 0 ? (
                        <div className="p-12 text-center">
                            <BotIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No Bots Created</h3>
                            <p className="text-gray-500 mb-6">Create your first AI bot to automate your conversations.</p>
                            <Button
                                onClick={() => setIsCreateOpen(true)}
                                variant="outline"
                                disabled={usage?.is_limit_reached || false}
                            >
                                {usage?.is_limit_reached ? (
                                    <>
                                        <AlertCircle className="h-4 w-4 mr-2" />
                                        Limit Reached
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Create Bot
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Bot Details</TableHead>
                                    <TableHead>Bot Code</TableHead>
                                    <TableHead>Trigger</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {bots.map((bot) => (
                                    <TableRow key={bot.id}>
                                        <TableCell>
                                            <div className="font-medium">{bot.name}</div>
                                            <div className="text-xs text-gray-500 truncate max-w-[200px]">{bot.description}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono text-gray-600">
                                                    {bot.bot_code}
                                                </code>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => copyToClipboard(bot.bot_code)}
                                                >
                                                    {copiedCode === bot.bot_code ? (
                                                        <Check className="h-3 w-3 text-green-500" />
                                                    ) : (
                                                        <Copy className="h-3 w-3 text-gray-400" />
                                                    )}
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {bot.trigger ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {bot.trigger.split(',').map((t, i) => (
                                                        <Badge key={i} variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                                                            {t.trim()}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            ) : (
                                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                                    Default
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={bot.is_active ? 'default' : 'secondary'} className={bot.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : ''}>
                                                {bot.is_active ? 'Active' : 'Inactive'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button variant="ghost" size="icon" onClick={() => openEdit(bot)}>
                                                    <Edit className="h-4 w-4 text-blue-600" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => handleDelete(bot.id)}>
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
                </TabsContent>

                <TabsContent value="autoreply">
                    <AutoReplyList />
                </TabsContent>
            </Tabs>

            {/* Create Dialog */}
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Create New Bot</DialogTitle>
                        <DialogDescription>
                            Start with a template or create your own custom bot instructions.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                        <div className="grid gap-2">
                            <Label htmlFor="name">Bot Name</Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                                placeholder="e.g. Sales Assistant"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="description">Description (Optional)</Label>
                            <Input
                                id="description"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                                placeholder="Short description for internal use"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="trigger">Trigger Keywords (Optional)</Label>
                            <Input
                                id="trigger"
                                value={formData.trigger}
                                onChange={(e) => setFormData({...formData, trigger: e.target.value})}
                                placeholder="e.g. sales, pricing, buy (leave empty for default bot)"
                            />
                            <p className="text-xs text-muted-foreground">Bot will reply if message contains these keywords. Empty = Default Bot.</p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="template">Start from Template (Optional)</Label>
                            <Select
                                value={formData.template_id || 'custom'}
                                onValueChange={(value) => handleTemplateSelect(value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a template or write custom instructions" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="custom">Custom Instructions</SelectItem>
                                    {!templatesLoading && templates.map((template) => (
                                        <SelectItem key={template.id} value={template.id}>
                                            <div>
                                                <span className="font-medium">{template.name}</span>
                                                {template.category && (
                                                    <Badge variant="outline" className="ml-2 text-xs">
                                                        {template.category}
                                                    </Badge>
                                                )}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="instruction">Instruction (The Brief)</Label>
                            <Textarea
                                id="instruction"
                                value={formData.instruction}
                                onChange={(e) => setFormData({...formData, instruction: e.target.value})}
                                placeholder="You are a helpful assistant for [Company Name]. Your goal is to..."
                                className="min-h-[150px]"
                                disabled={!!formData.template_id}
                            />
                            <p className="text-xs text-gray-500">
                                {formData.template_id
                                    ? 'Instruction loaded from template. You can clear template selection to edit manually.'
                                    : 'Provide detailed instructions on how the bot should behave, answer questions, and handle specific scenarios.'
                                }
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreate} disabled={isSubmitting}>
                            {isSubmitting ? 'Creating...' : 'Create Bot'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Bot</DialogTitle>
                        <DialogDescription>
                            Update your bot's configuration.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="edit-name">Bot Name</Label>
                            <Input
                                id="edit-name"
                                value={formData.name}
                                onChange={(e) => setFormData({...formData, name: e.target.value})}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-description">Description</Label>
                            <Input
                                id="edit-description"
                                value={formData.description}
                                onChange={(e) => setFormData({...formData, description: e.target.value})}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-trigger">Trigger Keywords</Label>
                            <Input
                                id="edit-trigger"
                                value={formData.trigger}
                                onChange={(e) => setFormData({...formData, trigger: e.target.value})}
                                placeholder="e.g. sales, pricing (leave empty for default)"
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="edit-instruction">Instruction</Label>
                            <Textarea
                                id="edit-instruction"
                                value={formData.instruction}
                                onChange={(e) => setFormData({...formData, instruction: e.target.value})}
                                className="min-h-[150px]"
                            />
                        </div>
                        <div className="flex items-center space-x-2 pt-2">
                            <Switch
                                id="active-mode"
                                checked={formData.is_active}
                                onCheckedChange={(checked: boolean) => setFormData({...formData, is_active: checked})}
                            />
                            <Label htmlFor="active-mode">Active Status</Label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpdate} disabled={isSubmitting}>
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BotManagement;
