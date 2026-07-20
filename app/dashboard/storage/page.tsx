'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
    HardDrive, Upload, Folder, File as FileIcon, Search,
    Trash2, Download, Image, FileText, FileSpreadsheet,
    FileCode, Video, Music, Loader2, RefreshCw,
    CheckCircle, XCircle, Clock, Link2
} from 'lucide-react';
import { toast } from 'sonner';

type StorageFile = {
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    file_type: string | null;
    folder: string;
    company_id: string;
    created_at: string;
};

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function getFileIcon(fileType: string | null) {
    if (!fileType) return <FileIcon className="w-5 h-5 text-muted-foreground" />;
    const type = fileType.toLowerCase();
    if (type.includes('image')) return <Image className="w-5 h-5 text-blue-500" />;
    if (type.includes('pdf')) return <FileText className="w-5 h-5 text-red-500" />;
    if (type.includes('sheet') || type.includes('excel')) return <FileSpreadsheet className="w-5 h-5 text-green-500" />;
    return <FileIcon className="w-5 h-5 text-muted-foreground" />;
}

export default function StoragePage() {
    return (
        <RouteGuard>
            <StorageContent />
        </RouteGuard>
    );
}

function StorageContent() {
    const [files, setFiles] = useState<StorageFile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchFiles = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/v1/storage');
            const result = await response.json();
            if (result.success) {
                setFiles(result.data || []);
            } else {
                toast.error('فشل تحميل الملفات');
            }
        } catch (error) {
            console.error('Error fetching files:', error);
            toast.error('فشل تحميل الملفات');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 10 * 1024 * 1024) {
            toast.error('حجم الملف يتجاوز 10 ميغابايت');
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setUploadStatus('uploading');

        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('tenant_id', '1');

            const response = await fetch('/api/v1/storage', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (result.success) {
                setUploadStatus('success');
                toast.success(`✅ تم رفع ${file.name}`);
                fetchFiles();
                if (fileInputRef.current) fileInputRef.current.value = '';
                setTimeout(() => setUploadStatus('idle'), 3000);
            } else {
                setUploadStatus('error');
                toast.error(result.error || 'فشل رفع الملف');
                if (fileInputRef.current) fileInputRef.current.value = '';
                setTimeout(() => setUploadStatus('idle'), 3000);
            }
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('error');
            toast.error('فشل رفع الملف');
            if (fileInputRef.current) fileInputRef.current.value = '';
            setTimeout(() => setUploadStatus('idle'), 3000);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('⚠️ هل أنت متأكد من حذف هذا الملف؟')) return;

        try {
            const response = await fetch(`/api/v1/storage?id=${id}`, {
                method: 'DELETE',
            });
            const result = await response.json();
            if (result.success) {
                toast.success('🗑️ تم حذف الملف');
                fetchFiles();
            } else {
                toast.error(result.error || 'فشل حذف الملف');
            }
        } catch (error) {
            console.error('Delete error:', error);
            toast.error('فشل حذف الملف');
        }
    };

    const copyLink = (file: StorageFile) => {
        // ✅ استخدام API endpoint بدلاً من المسار المباشر
        const fullUrl = `${window.location.origin}/api/v1/storage?id=${file.id}`;
        navigator.clipboard.writeText(fullUrl);
        toast.success('✅ تم نسخ الرابط');
    };

    const filteredFiles = files.filter(file =>
        file.file_name.toLowerCase().includes(search.toLowerCase())
    );

    const totalSize = filteredFiles.reduce((sum, f) => sum + (f.file_size || 0), 0);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">إدارة التخزين</h1>
                    <p className="text-muted-foreground mt-1">إدارة ملفات العملاء</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={fetchFiles} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
                        تحديث
                    </Button>
                    <Button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadStatus === 'uploading'}
                    >
                        {uploadStatus === 'uploading' ? (
                            <>
                                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                                رفع...
                            </>
                        ) : uploadStatus === 'success' ? (
                            <>
                                <CheckCircle className="w-4 h-4 ml-2 text-green-500" />
                                تم الرفع
                            </>
                        ) : (
                            <>
                                <Upload className="w-4 h-4 ml-2" />
                                رفع ملف
                            </>
                        )}
                    </Button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handleUpload}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <HardDrive className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-lg font-bold">{formatBytes(totalSize)}</p>
                            <p className="text-xs text-muted-foreground">إجمالي الحجم</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                            <FileIcon className="w-5 h-5 text-success" />
                        </div>
                        <div>
                            <p className="text-lg font-bold">{filteredFiles.length}</p>
                            <p className="text-xs text-muted-foreground">عدد الملفات</p>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                            <Folder className="w-5 h-5 text-warning" />
                        </div>
                        <div>
                            <p className="text-lg font-bold">{
                                new Set(filteredFiles.map(f => f.folder)).size
                            }</p>
                            <p className="text-xs text-muted-foreground">عدد المجلدات</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="بحث عن ملف..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pr-10"
                />
            </div>

            <Card>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
                            <p className="text-muted-foreground mt-2">جاري تحميل الملفات...</p>
                        </div>
                    ) : filteredFiles.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <HardDrive className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p className="text-lg font-medium">لا توجد ملفات</p>
                            <p className="text-sm">قم برفع ملف جديد باستخدام زر "رفع ملف"</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto scrollbar-thin">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b bg-muted/30">
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">الملف</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">المجلد</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحجم</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">النوع</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground">التاريخ</th>
                                        <th className="text-right py-3 px-4 font-medium text-muted-foreground w-28">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredFiles.map((file) => (
                                        <tr key={file.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-2">
                                                    {getFileIcon(file.file_type)}
                                                    <span className="font-medium truncate max-w-[200px]" title={file.file_name}>
                                                        {file.file_name}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant="outline" className="font-mono text-xs">
                                                    {file.folder === '/' ? '/' : file.folder}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                                                {formatBytes(file.file_size || 0)}
                                            </td>
                                            <td className="py-3 px-4">
                                                <Badge variant="secondary" className="text-xs font-mono">
                                                    {file.file_type?.split('/')[1]?.toUpperCase() || 'UNKNOWN'}
                                                </Badge>
                                            </td>
                                            <td className="py-3 px-4 text-muted-foreground text-xs">
                                                {new Date(file.created_at).toLocaleDateString('ar')}
                                            </td>
                                            <td className="py-3 px-4">
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => copyLink(file)}
                                                        className="p-1.5 hover:bg-muted rounded transition"
                                                        title="نسخ الرابط"
                                                    >
                                                        <Link2 className="w-4 h-4" />
                                                    </button>
                                                    <a
                                                        href={`/api/v1/storage?id=${file.id}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 hover:bg-muted rounded transition"
                                                        title="عرض"
                                                    >
                                                        <Image className="w-4 h-4" />
                                                    </a>
                                                    <a
                                                        href={`/api/v1/storage?id=${file.id}&download=true`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 hover:bg-muted rounded transition"
                                                        title="تحميل"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </a>
                                                    <button
                                                        onClick={() => handleDelete(file.id)}
                                                        className="p-1.5 hover:bg-red-100 rounded transition text-red-500"
                                                        title="حذف"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}