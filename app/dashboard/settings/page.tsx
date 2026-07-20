'use client';

import { useState } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/components/theme-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, Shield, Bell, Globe, Server, Mail, Lock, Key, Smartphone, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
    return (
        <RouteGuard>
            <SettingsContent />
        </RouteGuard>
    );
}

function SettingsContent() {
    const { user } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [twoFactor, setTwoFactor] = useState(true);
    const [emailNotifs, setEmailNotifs] = useState(true);
    const [autoBackups, setAutoBackups] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [allowSignup, setAllowSignup] = useState(false);
    const [loading, setLoading] = useState(false);

    // ✅ حالة البريد الإلكتروني
    const [email, setEmail] = useState(user?.email || '');
    
    // ✅ حالة كلمة المرور
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // ✅ دالة حفظ الإعدادات العامة
    const handleSaveSettings = async () => {
        setLoading(true);
        try {
            // حفظ البريد الإلكتروني إذا تغير
            if (email !== user?.email) {
                const res = await fetch('/api/admin/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        key: 'email',
                        value: email,
                        user_id: user?.id || 1
                    })
                });
                const data = await res.json();
                if (!data.success) throw new Error(data.error);
            }
            
            toast.success('تم حفظ الإعدادات بنجاح');
        } catch (error) {
            console.error('❌ Save error:', error);
            toast.error('فشل حفظ الإعدادات');
        } finally {
            setLoading(false);
        }
    };

    // ✅ دالة تحديث كلمة المرور
    const handleUpdatePassword = async () => {
        if (newPassword !== confirmPassword) {
            toast.error('كلمة المرور الجديدة وتأكيدها غير متطابقين');
            return;
        }
        
        if (newPassword.length < 6) {
            toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }
        
        setLoading(true);
        try {
            const res = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: 'password',
                    value: newPassword,
                    user_id: user?.id || 1
                })
            });
            const data = await res.json();
            if (!data.success) throw new Error(data.error);
            
            toast.success('تم تحديث كلمة المرور بنجاح');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error) {
            console.error('❌ Password error:', error);
            toast.error('فشل تحديث كلمة المرور');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">الإعدادات</h1>
                <p className="text-muted-foreground mt-1">إعدادات المنصة والحساب</p>
            </div>

            <Tabs defaultValue="general">
                <TabsList>
                    <TabsTrigger value="general">عام</TabsTrigger>
                    <TabsTrigger value="security">الأمان</TabsTrigger>
                    <TabsTrigger value="notifications">الإشعارات</TabsTrigger>
                    <TabsTrigger value="system">النظام</TabsTrigger>
                </TabsList>

                {/* General */}
                <TabsContent value="general" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <SettingsIcon className="w-5 h-5" />
                                الإعدادات العامة
                            </CardTitle>
                            <CardDescription>معلومات المنصة الأساسية</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>اسم المنصة</Label>
                                <Input defaultValue="MadarTech Cloud" />
                            </div>
                            <div className="space-y-2">
                                <Label>النطاق</Label>
                                <Input defaultValue="cloud.madartech.uk" dir="ltr" />
                            </div>
                            <div className="space-y-2">
                                <Label>بريد المدير</Label>
                                <Input 
                                    value={email} 
                                    onChange={(e) => setEmail(e.target.value)}
                                    dir="ltr" 
                                />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Globe className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">الوضع الداكن</p>
                                        <p className="text-xs text-muted-foreground">تبديل بين الوضع الداكن والفاتح</p>
                                    </div>
                                </div>
                                <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">السماح بإنشاء الحسابات</p>
                                        <p className="text-xs text-muted-foreground">السماح للعملاء بالتسجيل الذاتي (غير موصى به)</p>
                                    </div>
                                </div>
                                <Switch checked={allowSignup} onCheckedChange={setAllowSignup} />
                            </div>
                            <div className="flex justify-end pt-2">
                                <Button onClick={handleSaveSettings} disabled={loading}>
                                    <Save className="w-4 h-4 ml-2" />
                                    {loading ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Security */}
                <TabsContent value="security" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Shield className="w-5 h-5" />
                                إعدادات الأمان
                            </CardTitle>
                            <CardDescription>المصادقة والحماية</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Smartphone className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">المصادقة الثنائية (2FA)</p>
                                        <p className="text-xs text-muted-foreground">طبقة حماية إضافية بتطبيق المصادقة</p>
                                    </div>
                                </div>
                                <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label>تغيير كلمة المرور</Label>
                                <div className="space-y-2">
                                    <div className="relative">
                                        <Lock className="absolute right-3 top-3.5 w-4 h-4 text-muted-foreground" />
                                        <Input 
                                            type="password" 
                                            placeholder="كلمة المرور الجديدة" 
                                            className="pr-10"
                                            value={newPassword}
                                            onChange={(e) => setNewPassword(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute right-3 top-3.5 w-4 h-4 text-muted-foreground" />
                                        <Input 
                                            type="password" 
                                            placeholder="تأكيد كلمة المرور" 
                                            className="pr-10"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                        />
                                    </div>
                                </div>
                                <Button 
                                    variant="outline" 
                                    className="mt-2" 
                                    onClick={handleUpdatePassword}
                                    disabled={loading}
                                >
                                    {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                                </Button>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2"><Key className="w-4 h-4" /> JWT انتهاء صلاحية الجلسة</Label>
                                <Input type="number" defaultValue="60" dir="ltr" />
                                <p className="text-xs text-muted-foreground">مدة الجلسة بالدقائق قبل طلب إعادة تسجيل الدخول</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Notifications */}
                <TabsContent value="notifications" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Bell className="w-5 h-5" />
                                إعدادات الإشعارات
                            </CardTitle>
                            <CardDescription>تخصيص الإشعارات المرسلة</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* ... نفس المحتوى السابق ... */}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* System */}
                <TabsContent value="system" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Server className="w-5 h-5" />
                                إعدادات النظام
                            </CardTitle>
                            <CardDescription>إعدادات البنية التحتية والخدمات</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* ... نفس المحتوى السابق ... */}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}