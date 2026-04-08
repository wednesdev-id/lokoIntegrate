import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Copy, FileText, Code, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';

export interface BroadcastTemplate {
    id: string;
    name: string;
    body: string;
    createdAt: string;
    updatedAt: string;
}

const STORAGE_KEY = 'loko_broadcast_templates';

const loadTemplates = (): BroadcastTemplate[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveTemplates = (templates: BroadcastTemplate[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
};

interface BroadcastTemplatesProps {
    onUseTemplate: (body: string) => void;
}

const BroadcastTemplates: React.FC<BroadcastTemplatesProps> = ({ onUseTemplate }) => {
    const [templates, setTemplates] = useState<BroadcastTemplate[]>([]);
    const [editDialog, setEditDialog] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<BroadcastTemplate | null>(null);
    const [formName, setFormName] = useState('');
    const [formBody, setFormBody] = useState('');

    useEffect(() => {
        setTemplates(loadTemplates());
    }, []);

    const persist = (updated: BroadcastTemplate[]) => {
        setTemplates(updated);
        saveTemplates(updated);
    };

    const openCreate = () => {
        setEditingTemplate(null);
        setFormName('');
        setFormBody('');
        setEditDialog(true);
    };

    const openEdit = (tpl: BroadcastTemplate) => {
        setEditingTemplate(tpl);
        setFormName(tpl.name);
        setFormBody(tpl.body);
        setEditDialog(true);
    };

    const handleSave = () => {
        if (!formName.trim() || !formBody.trim()) return;

        const now = new Date().toISOString();

        if (editingTemplate) {
            // Update
            const updated = templates.map((t) =>
                t.id === editingTemplate.id
                    ? { ...t, name: formName.trim(), body: formBody, updatedAt: now }
                    : t
            );
            persist(updated);
        } else {
            // Create
            const newTpl: BroadcastTemplate = {
                id: Date.now().toString(),
                name: formName.trim(),
                body: formBody,
                createdAt: now,
                updatedAt: now,
            };
            persist([newTpl, ...templates]);
        }

        setEditDialog(false);
    };

    const handleDelete = () => {
        if (!editingTemplate) return;
        persist(templates.filter((t) => t.id !== editingTemplate.id));
        setDeleteDialog(false);
        setEditingTemplate(null);
    };

    const confirmDelete = (tpl: BroadcastTemplate) => {
        setEditingTemplate(tpl);
        setDeleteDialog(true);
    };

    const insertCodePlaceholder = () => {
        setFormBody((prev) => prev + '{{code}}');
    };

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Message Templates</h3>
                    <p className="text-sm text-gray-500">
                        Create reusable templates with <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">{'{{code}}'}</code> for unique codes
                    </p>
                </div>
                <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="h-4 w-4 mr-2" />
                    New Template
                </Button>
            </div>

            {/* Template list */}
            {templates.length === 0 ? (
                <Card className="border-dashed border-2 border-gray-300">
                    <CardContent className="p-8 text-center">
                        <FileText className="mx-auto h-10 w-10 text-gray-300 mb-3" />
                        <p className="text-sm text-gray-500 mb-1">No templates yet</p>
                        <p className="text-xs text-gray-400">
                            Create a template to quickly compose broadcast messages
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-3">
                    {templates.map((tpl) => (
                        <Card
                            key={tpl.id}
                            className="hover:shadow-md transition-shadow bg-white/80 backdrop-blur-sm"
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-semibold text-gray-900 truncate">{tpl.name}</h4>
                                            {tpl.body.includes('{{code}}') && (
                                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 shrink-0">
                                                    <Code className="h-3 w-3 mr-1" />
                                                    Unique Code
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-line">
                                            {tpl.body}
                                        </p>
                                        <p className="text-xs text-gray-400 mt-2">
                                            Updated {new Date(tpl.updatedAt).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => onUseTemplate(tpl.body)}
                                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                            title="Use this template"
                                        >
                                            <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => openEdit(tpl)}
                                            title="Edit template"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => confirmDelete(tpl)}
                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                            title="Delete template"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Create / Edit dialog */}
            <Dialog open={editDialog} onOpenChange={setEditDialog}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {editingTemplate ? 'Edit Template' : 'Create Template'}
                        </DialogTitle>
                        <DialogDescription>
                            Use <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono">{'{{code}}'}</code> to insert a unique code per recipient
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Template Name
                            </label>
                            <Input
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="e.g., Promo Diskon"
                                autoFocus
                            />
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-sm font-medium text-gray-700">
                                    Message Body
                                </label>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={insertCodePlaceholder}
                                    className="text-xs h-7"
                                >
                                    <Code className="h-3 w-3 mr-1" />
                                    Insert {'{{code}}'}
                                </Button>
                            </div>
                            <textarea
                                value={formBody}
                                onChange={(e) => setFormBody(e.target.value)}
                                rows={6}
                                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                                placeholder={`Halo! Promo spesial untuk Anda.\nGunakan kode {{code}} untuk diskon 10%.`}
                            />
                            <p className="text-xs text-gray-500 mt-1">{formBody.length} characters</p>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialog(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!formName.trim() || !formBody.trim()}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {editingTemplate ? 'Update' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete confirm dialog */}
            <Dialog open={deleteDialog} onOpenChange={setDeleteDialog}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Delete Template</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{editingTemplate?.name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialog(false)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleDelete}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default BroadcastTemplates;
