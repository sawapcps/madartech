'use client';

import { useState, useEffect } from 'react';
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
    const { user, updateUser } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [twoFactor, setTwoFactor] = useState(true);
    const [emailNotifs, setEmailNotifs] = useState(true);
    const [autoBackups, setAutoBackups] = useState(true);
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [allowSignup, setAllowSignup] = useState(false);

    // ✅ تعيين البريد الإلكتروني من المستخدم
    useEffect(() => {
        if (user?.email) {
            setEmail(user.email);
        }
    }, [user]);

    // ✅ حفظ البريد الإلكتروني
    const handleSaveEmail = async () => {
        if (!email || email === user?.email) {
            toast.info('لم يتم تغيير البريد الإلكتروني');
            return;
        }

        setLoading(true);
        try {
            console.log('📤 Sending email update:', { email, user_id: user?.id });
            
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
            console.log('📥 Response:', data);

            if (data.success) {
                // ✅ تحديث حالة المستخدم فوراً
                if (user) {
                    updateUser({ ...user, email: email });
                }
                toast.success('تم تحديث البريد الإلكتروني بنجاح');
            } else {
                toast.error(data.error || 'فشل تحديث البريد الإلكتروني');
            }
        } catch (error) {
            console.error('❌ Save email error:', error);
            toast.error('حدث خطأ أثناء تحديث البريد الإلكتروني');
        } finally {
            setLoading(false);
        }
    };

    // ✅ تحديث كلمة المرور
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
            console.log('📤 Sending password update');
            
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
            console.log('📥 Password Response:', data);

            if (data.success) {
                toast.success('تم تحديث كلمة المرور بنجاح');
                setNewPassword('');
                setConfirmPassword('');
            } else {
                toast.error(data.error || 'فشل تحديث كلمة المرور');
            }
        } catch (error) {
            console.error('❌ Password error:', error);
            toast.error('حدث خطأ أثناء تحديث كلمة المرور');
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

                {/* تبويب عام */}
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
                                <div className="flex gap-2">
                                    <Input 
                                        value={email} 
                                        onChange={(e) => setEmail(e.target.value)}
                                        dir="ltr" 
                                        className="flex-1"
                                        placeholder="البريد الإلكتروني"
                                    />
                                    <Button 
                                        onClick={handleSaveEmail} 
                                        disabled={loading || email === user?.email}
                                        variant="outline"
                                    >
                                        <Save className="w-4 h-4 ml-2" />
                                        {loading ? 'جاري...' : 'حفظ'}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">تغيير البريد الإلكتروني للمدير</p>
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
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* تبويب الأمان */}
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
                                    disabled={loading || !newPassword || !confirmPassword}
                                >
                                    {loading ? 'جاري التحديث...' : 'تحديث كلمة المرور'}
                                </Button>
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Key className="w-4 h-4" /> 
                                    JWT انتهاء صلاحية الجلسة
                                </Label>
                                <Input type="number" defaultValue="60" dir="ltr" />
                                <p className="text-xs text-muted-foreground">مدة الجلسة بالدقائق قبل طلب إعادة تسجيل الدخول</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* تبويب الإشعارات */}
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
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">إشعارات البريد الإلكتروني</p>
                                        <p className="text-xs text-muted-foreground">إرسال إشعارات عبر البريد للأحداث المهمة</p>
                                    </div>
                                </div>
                                <Switch checked={emailNotifs} onCheckedChange={setEmailNotifs} />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Bell className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">تنبيهات النظام</p>
                                        <p className="text-xs text-muted-foreground">تنبيهات عند تجاوز الحدود أو الأخطاء</p>
                                    </div>
                                </div>
                                <Switch defaultChecked />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Shield className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">تنبيهات الأمان</p>
                                        <p className="text-xs text-muted-foreground">إشعار عند محاولات الدخول المشبوهة</p>
                                    </div>
                                </div>
                                <Switch defaultChecked />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* تبويب النظام */}
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>PostgreSQL URL</Label>
                                    <Input defaultValue="postgresql://localhost:5432" dir="ltr" className="font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Redis URL</Label>
                                    <Input defaultValue="redis://localhost:6379" dir="ltr" className="font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label>MinIO Endpoint</Label>
                                    <Input defaultValue="http://localhost:9000" dir="ltr" className="font-mono text-xs" />
                                </div>
                                <div className="space-y-2">
                                    <Label>Socket.IO URL</Label>
                                    <Input defaultValue="http://localhost:3001" dir="ltr" className="font-mono text-xs" />
                                </div>
                            </div>

                            <Separator />

                            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                                <div className="flex items-center gap-3">
                                    <Server className="w-5 h-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm font-medium">النسخ الاحتياطي التلقائي</p>
                                        <p className="text-xs text-muted-foreground">نسخ احتياطي يومي تلقائي لجميع العملاء</p>
                                    </div>
                                </div>
                                <Switch checked={autoBackups} onCheckedChange={setAutoBackups} />
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                                <div className="flex items-center gap-3">
                                    <Shield className="w-5 h-5 text-destructive" />
                                    <div>
                                        <p className="text-sm font-medium">وضع الصيانة</p>
                                        <p className="text-xs text-muted-foreground">إيقاف الوصول للمنصة مؤقتاً للصيانة</p>
                                    </div>
                                </div>
                                <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}