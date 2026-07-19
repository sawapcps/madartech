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
                <Input defaultValue={user?.email ?? 'admin@madartech.uk'} dir="ltr" />
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
                    <Input type="password" placeholder="كلمة المرور الحالية" className="pr-10" />
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3.5 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="كلمة المرور الجديدة" className="pr-10" />
                  </div>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3.5 w-4 h-4 text-muted-foreground" />
                    <Input type="password" placeholder="تأكيد كلمة المرور" className="pr-10" />
                  </div>
                </div>
                <Button variant="outline" className="mt-2" onClick={() => toast.success('تم تحديث كلمة المرور')}>
                  تحديث كلمة المرور
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

              <div className="flex justify-end pt-2">
                <Button onClick={() => toast.success('تم حفظ الإعدادات')}>
                  <Save className="w-4 h-4 ml-2" />
                  حفظ الإعدادات
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
