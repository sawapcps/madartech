'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Cloud, Lock, Mail, Loader2, Shield, Zap, Globe } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user, loading: authLoading } = useAuth(); // ✅ تغيير signIn → login
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) router.push('/dashboard');
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password); // ✅ استخدام login بدلاً من signIn
      // login يقوم بتوجيه المستخدم تلقائياً
    } catch (err: any) {
      setError(err.message || 'فشل تسجيل الدخول');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-background">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-chart-5/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-24">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Cloud className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">MadarTech Cloud</h1>
              <p className="text-sm text-muted-foreground">منصة الإدارة السحابية الخاصة</p>
            </div>
          </div>

          <h2 className="text-4xl font-bold mb-4 leading-tight">
            منصة سحابية خاصة <br />
            <span className="gradient-text">لإدارة تطبيقاتك وعملائك</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-12 max-w-md">
            تحكم كامل في قواعد البيانات، التخزين، التراخيص، والنسخ الاحتياطية — كل ذلك من مكان واحد.
          </p>

          <div className="space-y-4">
            {[
              { icon: Shield, title: 'عزل كامل بين العملاء', desc: 'بيانات معزولة لكل عميل' },
              { icon: Zap, title: 'أداء عالٍ وموثوقية', desc: 'مراقبة فورية للنظام' },
              { icon: Globe, title: 'متوافق مع Cloudflare', desc: 'نشر مرن على أي بيئة' },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Cloud className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">MadarTech Cloud</span>
          </div>

          <h2 className="text-2xl font-bold mb-2">تسجيل الدخول</h2>
          <p className="text-muted-foreground mb-8">منصة خاصة — للمدير فقط</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@madartech.uk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pr-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3.5 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 rounded-md px-4 py-2.5">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                  جاري التحقق...
                </>
              ) : (
                'دخول المنصة'
              )}
            </Button>
          </form>

          <p className="text-xs text-muted-foreground text-center mt-8">
            لا يمكن إنشاء حساب من هذه الصفحة. يتم إضافة المستخدمين من قبل المدير فقط.
          </p>
        </div>
      </div>
    </div>
  );
}