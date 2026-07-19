'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Image, Upload, Search, Trash2, Copy, CheckCircle,
  Loader2, RefreshCw, Folder, HardDrive
} from 'lucide-react';
import { toast } from 'sonner';

type ImageFile = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  folder: string;
  created_at: string;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export default function ImagesPage() {
  return (
    <RouteGuard>
      <ImagesContent />
    </RouteGuard>
  );
}

function ImagesContent() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const API_KEY = process.env.NEXT_PUBLIC_API_KEY || '';

  const fetchImages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/images', {
        headers: { 'X-API-Key': API_KEY }
      });
      const result = await response.json();
      if (result.success) {
        setImages(result.data || []);
      }
    } catch (error) {
      toast.error('فشل تحميل الصور');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يتجاوز 5 ميغابايت');
      e.target.value = '';
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('category', 'products');

      const response = await fetch('/api/v1/images/upload', {
        method: 'POST',
        headers: { 'X-API-Key': API_KEY },
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        toast.success(`✅ تم رفع ${file.name}`);
        fetchImages();
      } else {
        toast.error(result.error || 'فشل الرفع');
      }
    } catch (error) {
      toast.error('خطأ في الرفع');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`⚠️ هل تريد حذف "${fileName}"؟`)) return;

    try {
      const response = await fetch(`/api/v1/images/delete?id=${id}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': API_KEY }
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`🗑️ تم حذف ${fileName}`);
        fetchImages();
      } else {
        toast.error(result.error || 'فشل الحذف');
      }
    } catch (error) {
      toast.error('خطأ في الحذف');
    }
  };

  const copyLink = (url: string, id: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    toast.success('✅ تم نسخ الرابط');
    setTimeout(() => setCopiedId(null), 3000);
  };

  const filteredImages = images.filter(img =>
    img.file_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">إدارة الصور</h1>
          <p className="text-muted-foreground mt-1">رفع وإدارة صور المنتجات والعملاء</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchImages} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleUpload}
              disabled={uploading}
            />
            <Button as="span" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  رفع...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 ml-2" />
                  رفع صورة
                </>
              )}
            </Button>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Image className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold">{images.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي الصور</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <Folder className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-lg font-bold">{new Set(images.map(i => i.folder)).size}</p>
              <p className="text-xs text-muted-foreground">عدد المجلدات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold">
                {formatBytes(images.reduce((sum, i) => sum + i.file_size, 0))}
              </p>
              <p className="text-xs text-muted-foreground">إجمالي الحجم</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="بحث عن صورة..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pr-10"
        />
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted/30 animate-pulse" />
          ))}
        </div>
      ) : filteredImages.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-lg font-medium">لا توجد صور</p>
            <p className="text-sm">قم برفع صورة جديدة باستخدام زر "رفع صورة"</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredImages.map((img) => {
            const fullUrl = `${window.location.origin}${img.file_path}`;
            return (
              <Card key={img.id} className="overflow-hidden group">
                <div className="aspect-square relative bg-muted/30">
                  <img
                    src={img.file_path}
                    alt={img.file_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder-image.png';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => copyLink(img.file_path, img.id)}
                      className="h-8 w-8 p-0"
                    >
                      {copiedId === img.id ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 w-8 p-0"
                      onClick={() => window.open(fullUrl, '_blank')}
                    >
                      <Image className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 w-8 p-0"
                      onClick={() => handleDelete(img.id, img.file_name)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <CardContent className="p-2">
                  <p className="text-xs truncate" title={img.file_name}>
                    {img.file_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(img.file_size)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}