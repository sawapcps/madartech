'use client';

import { useState, useEffect } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
    Archive, Plus, MoreVertical, Download, Trash2, RotateCcw,
    Clock, CheckCircle, XCircle, Loader2, Calendar, Upload
} from 'lucide-react';
import { toast } from 'sonner';

// ✅ تم إضافة tenant_id و tenant_name
type Backup = {
    id: string;
    client_id: string;
    tenant_id?: string;
    client_name: string;
    tenant_name?: string;
    type: 'auto' | 'manual' | 'upload';
    status: 'completed' | 'failed' | 'pending' | 'running' | 'uploaded';
    size_bytes: number;
    schedule: 'none' | 'daily' | 'weekly' | 'monthly';
    created_at: string;
    started_at?: string | null;
    completed_at?: string | null;
};

type Client = {
    id: string;
    name: string;
    code?: string;
    email?: string;
};

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export default function BackupsPage() {
    return (
        <RouteGuard>
            <BackupsContent />
        </RouteGuard>
    );
}

function BackupsContent() {
    const [backups, setBackups] = useState<Backup[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [createData, setCreateData] = useState({ client_id: '', schedule: 'none' as Backup['schedule'] });

    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [uploadTenant, setUploadTenant] = useState('');
    const [uploadNote, setUploadNote] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const res = await fetch('/api/admin/tenants');
                if (!res.ok) throw new Error('Failed to fetch clients');
                const data = await res.json();
                setClients(data.data || []);
            } catch (error) {
                console.error('❌ Error fetching clients:', error);
                toast.error('فشل جلب العملاء');
                setClients([]);
            }
        };

        const fetchBackups = async () => {
            try {
                const res = await fetch('/api/admin/backups');
                if (!res.ok) throw new Error('Failed to fetch backups');
                const data = await res.json();
                setBackups(data.data || []);
            } catch (error) {
                console.error('❌ Error fetching backups:', error);
                toast.error('فشل جلب النسخ الاحتياطية');
                setBackups([]);
            } finally {
                setLoading(false);
            }
        };

        fetchClients();
        fetchBackups();
    }, []);

    const handleCreate = async () => {
        if (!createData.client_id) {
            toast.error('يرجى اختيار العميل');
            return;
        }

        try {
            const res = await fetch('/api/admin/backups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenant_id: createData.client_id,
                    schedule: createData.schedule,
                    note: 'نسخة احتياطية يدوية',
                }),
            });

            if (!res.ok) throw new Error('Failed to create backup');

            const data = await res.json();
            toast.success('✅ تم إنشاء النسخة الاحتياطية بنجاح');

            const clientName = clients.find(c => c.id === createData.client_id)?.name || 'غير معروف';

            const newBackup: Backup = {
                id: data.data.id,
                client_id: createData.client_id,
                tenant_id: createData.client_id,
                client_name: clientName,
                tenant_name: clientName,
                type: 'manual',
                status: 'completed',
                size_bytes: data.data.size_bytes || 0,
                schedule: createData.schedule,
                created_at: data.data.created_at || new Date().toISOString(),
                started_at: data.data.started_at || null,
                completed_at: data.data.completed_at || null,
            };

            setBackups(prev => [newBackup, ...prev]);
            setDialogOpen(false);
            setCreateData({ client_id: '', schedule: 'none' });

        } catch (error) {
            console.error('❌ Error creating backup:', error);
            toast.error('فشل إنشاء النسخة الاحتياطية');
        }
    };

    const handleRestore = async (backup: Backup) => {
        try {
            const res = await fetch(`/api/admin/backups/restore?id=${backup.id}`, {
                method: 'PUT',
            });

            if (!res.ok) throw new Error('Failed to restore backup');

            const data = await res.json();
            toast.success(`✅ ${data.message || 'تم استعادة النسخة بنجاح'}`);
        } catch (error) {
            console.error('❌ Error restoring backup:', error);
            toast.error('فشل استعادة النسخة الاحتياطية');
        }
    };

    const handleDownload = async (backup: Backup) => {
        try {
            const res = await fetch(`/api/admin/backups?id=${backup.id}&download=true`);

            if (!res.ok) throw new Error('Failed to download backup');

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${backup.client_name}_${backup.id}.json`;
            a.click();
            window.URL.revokeObjectURL(url);

            toast.success('✅ تم تنزيل النسخة الاحتياطية');
        } catch (error) {
            console.error('❌ Error downloading backup:', error);
            toast.error('فشل تنزيل النسخة الاحتياطية');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('⚠️ هل أنت متأكد من حذف هذه النسخة الاحتياطية؟')) return;

        try {
            const res = await fetch(`/api/admin/backups?id=${id}`, {
                method: 'DELETE',
            });

            if (!res.ok) throw new Error('Failed to delete backup');

            setBackups(prev => prev.filter(b => b.id !== id));
            toast.success('✅ تم حذف النسخة الاحتياطية');
        } catch (error) {
            console.error('❌ Error deleting backup:', error);
            toast.error('فشل حذف النسخة الاحتياطية');
        }
    };

    const handleUpload = async () => {
        if (!uploadFile || !uploadTenant) {
            toast.error('يرجى اختيار ملف وعميل');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('tenant_id', uploadTenant);
            formData.append('note', uploadNote || 'تم الرفع من ملف خارجي');

            const res = await fetch('/api/admin/backups/upload', {
                method: 'POST',
                body: formData,
            });

            const result = await res.json();

            if (result.success) {
                toast.success('✅ تم رفع الملف بنجاح');
                setUploadDialogOpen(false);
                setUploadFile(null);
                setUploadTenant('');
                setUploadNote('');

                const clientName = clients.find(c => c.id === uploadTenant)?.name || 'غير معروف';

                const newBackup: Backup = {
                    id: result.data.id,
                    client_id: uploadTenant,
                    tenant_id: uploadTenant,
                    client_name: clientName,
                    tenant_name: clientName,
                    type: 'upload',
                    status: result.data.status || 'uploaded',
                    size_bytes: result.data.size_bytes || 0,
                    schedule: 'none',
                    created_at: result.data.created_at || new Date().toISOString(),
                    started_at: result.data.started_at || null,
                    completed_at: result.data.completed_at || null,
                };
                setBackups(prev => [newBackup, ...prev]);
            } else {
                toast.error(result.error || 'فشل الرفع');
            }
        } catch (error) {
            console.error('❌ Upload error:', error);
            toast.error('خطأ في رفع الملف');
        } finally {
            setIsUploading(false);
        }
    };

    const statusBadge = (status: string) => {
        if (status === 'completed') return <Badge variant="success"><CheckCircle className="w-3 h-3 ml-1" />مكتمل</Badge>;
        if (status === 'failed') return <Badge variant="destructive"><XCircle className="w-3 h-3 ml-1" />فشل</Badge>;
        if (status === 'running') return <Badge variant="warning"><Loader2 className="w-3 h-3 ml-1 animate-spin" />قيد التنفيذ</Badge>;
        if (status === 'uploaded') return <Badge variant="outline"><Upload className="w-3 h-3 ml-1" />مرفوع</Badge>;
        return <Badge variant="warning"><Clock className="w-3 h-3 ml-1" />بانتظار</Badge>;
    };

    const completedCount = backups.filter((b) => b.status === 'completed' || b.status === 'uploaded').length;
    const totalSize = backups.filter((b) => b.status === 'completed' || b.status === 'uploaded').reduce((sum, b) => sum + b.size_bytes, 0);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">النسخ الاحتياطي</h1>
                    <p className="text-muted-foreground mt-1">إدارة النسخ الاحتياطية للعملاء</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                        <Upload className="w-4 h-4 ml-2" />
                        استيراد ملف
                    </Button>
                    <Button onClick={() => setDialogOpen(true)}>
                        <Plus className="w-4 h-4 ml-2" />
                        نسخة احتياطية جديدة
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Archive className="w-5.5 h-5.5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{backups.length}</p>
                            <p className="text-sm text-muted-foreground">إجمالي النسخ</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center">
                            <CheckCircle className="w-5.5 h-5.5 text-success" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{completedCount}</p>
                            <p className="text-sm text-muted-foreground">نسخ مكتملة</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center">
                            <Calendar className="w-5.5 h-5.5 text-warning" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold">{formatBytes(totalSize)}</p>
                            <p className="text-sm text-muted-foreground">إجمالي الحجم</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardContent className="p-0">
                    {backups.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <Archive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>لا توجد نسخ احتياطية</p>
                            <div className="flex gap-2 justify-center mt-3">
                                <Button variant="outline" onClick={() => setUploadDialogOpen(true)}>
                                    <Upload className="w-4 h-4 ml-2" />
                                    استيراد ملف
                                </Button>
                                <Button variant="outline" onClick={() => setDialogOpen(true)}>
                                    <Plus className="w-4 h-4 ml-2" />
                                    إنشاء أول نسخة
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto scrollbar-thin">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">العميل</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">النوع</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحجم</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">الجدولة</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحالة</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">التاريخ</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground w-12"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {backups.map((backup) => (
                                        <tr key={backup.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            {/* ✅ عرض اسم العميل مع دعم tenant_name */}
                                            <td className="py-3 px-4 font-medium">
                                                {backup.tenant_name || backup.client_name || 'غير معروف'}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant="outline">
                                                    {backup.type === 'auto' ? 'تلقائي' : backup.type === 'upload' ? 'مرفوع' : 'يدوي'}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground">{backup.size_bytes ? formatBytes(backup.size_bytes) : '-'}</td>
                                            <td className="py-3 px-4 text-muted-foreground">
                                                {backup.schedule === 'none' ? '-' : backup.schedule === 'daily' ? 'يومي' : backup.schedule === 'weekly' ? 'أسبوعي' : 'شهري'}
                                            </td>
                                            <td className="py-3 px-4">{statusBadge(backup.status)}</td>
                                            <td className="py-3 px-4 text-muted-foreground">{new Date(backup.created_at).toLocaleDateString('ar')}</td>
                                            <td className="py-3 px-4">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="start">
                                                        <DropdownMenuItem
                                                            onClick={() => handleRestore(backup)}
                                                            disabled={backup.status !== 'completed' && backup.status !== 'uploaded'}
                                                        >
                                                            <RotateCcw className="w-4 h-4 ml-2" />
                                                            استعادة
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => handleDownload(backup)}>
                                                            <Download className="w-4 h-4 ml-2" />
                                                            تنزيل
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(backup.id)}>
                                                            <Trash2 className="w-4 h-4 ml-2" />
                                                            حذف
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setDialogOpen(false)}>
                    <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold mb-4">إنشاء نسخة احتياطية</h2>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">العميل *</label>
                                <select
                                    value={createData.client_id}
                                    onChange={(e) => setCreateData({ ...createData, client_id: e.target.value })}
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="">اختر العميل</option>
                                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">الجدولة</label>
                                <select
                                    value={createData.schedule}
                                    onChange={(e) => setCreateData({ ...createData, schedule: e.target.value as Backup['schedule'] })}
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="none">بدون (نسخة واحدة)</option>
                                    <option value="daily">يومي</option>
                                    <option value="weekly">أسبوعي</option>
                                    <option value="monthly">شهري</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
                            <Button onClick={handleCreate}>إنشاء</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Upload dialog */}
            {uploadDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setUploadDialogOpen(false)}>
                    <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-semibold mb-4">استيراد ملف نسخ احتياطي</h2>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">اختر العميل *</label>
                                <select
                                    value={uploadTenant}
                                    onChange={(e) => setUploadTenant(e.target.value)}
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="">-- اختر --</option>
                                    {clients.map((c) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">اختر ملف JSON *</label>
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                                />
                                <p className="text-xs text-muted-foreground">يجب أن يكون الملف بصيغة JSON صالحة</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">ملاحظات (اختياري)</label>
                                <input
                                    type="text"
                                    value={uploadNote}
                                    onChange={(e) => setUploadNote(e.target.value)}
                                    placeholder="مثال: نسخة من نظام قديم"
                                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>إلغاء</Button>
                            <Button onClick={handleUpload} disabled={isUploading}>
                                {isUploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                        جاري الرفع...
                                    </>
                                ) : (
                                    'رفع الملف'
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}