'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Cloud, Key, Database, Shield, Zap, CheckCircle, XCircle, Loader2,
  ArrowRight, Lock, Server, Layers, GitBranch, Terminal,
} from 'lucide-react';

type TestStep = {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  result?: string;
};

const TENANT_A_KEY = 'mt_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';
const TENANT_B_KEY = 'mt_live_b1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0';

export default function PoCPage() {
  const [steps, setSteps] = useState<TestStep[]>([
    { id: '1', title: 'تسجيل الدخول إلى الـ API', description: 'إرسال طلب بمفتاح API للتحقق من المصادقة', status: 'pending' },
    { id: '2', title: 'قراءة بيانات العميل A', description: 'جلب الطلبات من schema العميل الأول', status: 'pending' },
    { id: '3', title: 'إرسال طلب جديد للعميل A', description: 'إنشاء طلب جديد من تطبيق المبيعات', status: 'pending' },
    { id: '4', title: 'قراءة بيانات العميل B', description: 'جلب الطلبات من schema العميل الثاني', status: 'pending' },
    { id: '5', title: 'اختبار العزل', description: 'التأكد أن العميل A لا يرى بيانات العميل B', status: 'pending' },
  ]);

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [newOrder, setNewOrder] = useState({
    customer_name: 'محمد العتيبي',
    product_name: 'هاتف Samsung Galaxy',
    quantity: 2,
    unit_price: 2500,
  });

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString('ar')}] ${msg}`]);
  };

  const updateStep = (id: string, updates: Partial<TestStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const runTest = async () => {
    setRunning(true);
    setLogs([]);
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'pending', result: undefined })));

    // Step 1: Authenticate
    updateStep('1', { status: 'running' });
    addLog('▶ الخطوة 1: اختبار المصادقة بمفتاح API...');
    try {
      const res = await fetch('/api/v1/data/products?limit=5', {
        headers: { 'X-API-Key': TENANT_A_KEY },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateStep('1', { status: 'success', result: `تم المصادقة بنجاح — العميل: ${data.meta.tenant}` });
        addLog(`✓ نجح: تم التعرف على العميل "${data.meta.tenant}"`);
      } else {
        throw new Error(data.error || 'Authentication failed');
      }
    } catch (err) {
      updateStep('1', { status: 'failed', result: err instanceof Error ? err.message : 'Failed' });
      addLog(`✗ فشل: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRunning(false);
      return;
    }

    // Step 2: Read Tenant A data
    updateStep('2', { status: 'running' });
    addLog('▶ الخطوة 2: قراءة بيانات العميل A (orders)...');
    try {
      const res = await fetch('/api/v1/data/orders?limit=10', {
        headers: { 'X-API-Key': TENANT_A_KEY },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateStep('2', { status: 'success', result: `تم العثور على ${data.meta.total} طلب` });
        addLog(`✓ نجح: ${data.meta.total} طلب في schema العميل A`);
        addLog(`  البيانات: ${JSON.stringify(data.data.map((d: Record<string, unknown>) => ({ customer: d.customer_name, product: d.product_name })))}`);
      } else {
        throw new Error(data.error || 'Read failed');
      }
    } catch (err) {
      updateStep('2', { status: 'failed', result: err instanceof Error ? err.message : 'Failed' });
      addLog(`✗ فشل: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRunning(false);
      return;
    }

    // Step 3: Create new order for Tenant A
    updateStep('3', { status: 'running' });
    addLog('▶ الخطوة 3: إرسال طلب جديد من تطبيق المبيعات إلى الـ API...');
    try {
      const res = await fetch('/api/v1/data/orders', {
        method: 'POST',
        headers: {
          'X-API-Key': TENANT_A_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newOrder),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateStep('3', { status: 'success', result: `تم إنشاء الطلب — ID: ${data.data.id}` });
        addLog(`✓ نجح: تم حفظ الطلب في schema العميل A`);
        addLog(`  الطلب: ${newOrder.customer_name} - ${newOrder.product_name} x${newOrder.quantity}`);
      } else {
        throw new Error(data.error || 'Create failed');
      }
    } catch (err) {
      updateStep('3', { status: 'failed', result: err instanceof Error ? err.message : 'Failed' });
      addLog(`✗ فشل: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRunning(false);
      return;
    }

    // Step 4: Read Tenant B data
    updateStep('4', { status: 'running' });
    addLog('▶ الخطوة 4: قراءة بيانات العميل B (بمفتاح مختلف)...');
    try {
      const res = await fetch('/api/v1/data/orders?limit=10', {
        headers: { 'X-API-Key': TENANT_B_KEY },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        updateStep('4', { status: 'success', result: `تم العثور على ${data.meta.total} طلب — العميل: ${data.meta.tenant}` });
        addLog(`✓ نجح: ${data.meta.total} طلب في schema العميل B`);
        addLog(`  البيانات: ${JSON.stringify(data.data.map((d: Record<string, unknown>) => ({ customer: d.customer_name, product: d.product_name })))}`);
      } else {
        throw new Error(data.error || 'Read failed');
      }
    } catch (err) {
      updateStep('4', { status: 'failed', result: err instanceof Error ? err.message : 'Failed' });
      addLog(`✗ فشل: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setRunning(false);
      return;
    }

    // Step 5: Isolation test
    updateStep('5', { status: 'running' });
    addLog('▶ الخطوة 5: اختبار العزل — مقارنة بيانات العميل A مع B...');
    try {
      const [resA, resB] = await Promise.all([
        fetch('/api/v1/data/orders?limit=100', { headers: { 'X-API-Key': TENANT_A_KEY } }).then(r => r.json()),
        fetch('/api/v1/data/orders?limit=100', { headers: { 'X-API-Key': TENANT_B_KEY } }).then(r => r.json()),
      ]);

      const ordersA = resA.data as Array<{ id: string; customer_name: string }>;
      const ordersB = resB.data as Array<{ id: string; customer_name: string }>;

      // Check that no order IDs overlap
      const idsA = new Set(ordersA.map(o => o.id));
      const idsB = new Set(ordersB.map(o => o.id));
      const overlap = ordersA.filter(o => idsB.has(o.id));

      if (overlap.length === 0 && ordersA.length > 0 && ordersB.length > 0) {
        updateStep('5', { status: 'success', result: `العزل مضمون — A: ${ordersA.length} طلب، B: ${ordersB.length} طلب، لا يوجد تداخل` });
        addLog(`✓ نجح: العزل مضمون!`);
        addLog(`  العميل A: ${ordersA.length} طلب (customers: ${ordersA.map(o => o.customer_name).join(', ')})`);
        addLog(`  العميل B: ${ordersB.length} طلب (customers: ${ordersB.map(o => o.customer_name).join(', ')})`);
        addLog(`  لا يوجد أي تداخل في البيانات — كل عميل في schema معزول تماماً`);
      } else {
        updateStep('5', { status: 'failed', result: `تداخل في البيانات! ${overlap.length} سجل مشترك` });
        addLog(`✗ فشل: تم اكتشاف تداخل في البيانات`);
      }
    } catch (err) {
      updateStep('5', { status: 'failed', result: err instanceof Error ? err.message : 'Failed' });
      addLog(`✗ فشل: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }

    setRunning(false);
    addLog('');
    addLog('═══════════════════════════════════════');
    addLog('اكتمل اختبار الإثبات (PoC)');
    addLog('═══════════════════════════════════════');
  };

  return (
    <div className="min-h-screen bg-background p-4 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Cloud className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold">MadarTech Cloud</h1>
          </div>
          <p className="text-muted-foreground">إثبات المعمارية (Proof of Concept) — Backend API مستقل مع عزل العملاء</p>
        </div>

        {/* Architecture diagram */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              معمارية النظام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              {/* External App */}
              <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5 text-center">
                <Terminal className="w-8 h-8 mx-auto mb-2 text-primary" />
                <p className="font-semibold text-sm">تطبيق المبيعات</p>
                <p className="text-xs text-muted-foreground mt-1">External Application</p>
                <div className="mt-2 text-xs font-mono text-muted-foreground">
                  X-API-Key: mt_live_...
                </div>
              </div>

              {/* Arrow */}
              <div className="flex flex-col items-center justify-center gap-2">
                <ArrowRight className="w-6 h-6 text-muted-foreground rotate-180 md:rotate-0" />
                <p className="text-xs text-muted-foreground">REST API</p>
                <ArrowRight className="w-6 h-6 text-muted-foreground rotate-180 md:rotate-0" />
              </div>

              {/* Platform */}
              <div className="p-4 rounded-lg border-2 border-success/30 bg-success/5 text-center">
                <Server className="w-8 h-8 mx-auto mb-2 text-success" />
                <p className="font-semibold text-sm">Platform Backend</p>
                <p className="text-xs text-muted-foreground mt-1">API Gateway + Tenant Manager</p>
                <div className="mt-2 text-xs font-mono text-muted-foreground">
                  PostgreSQL (Schema-per-Tenant)
                </div>
              </div>
            </div>

            {/* Tenant schemas */}
            <Separator className="my-4" />
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <Database className="w-6 h-6 mx-auto mb-1 text-chart-1" />
                <p className="text-xs font-mono">tenant_a0000000...001</p>
                <p className="text-xs text-muted-foreground">شركة النور التجارية</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 text-center">
                <Database className="w-6 h-6 mx-auto mb-1 text-chart-2" />
                <p className="text-xs font-mono">tenant_b0000000...002</p>
                <p className="text-xs text-muted-foreground">مؤسسة الفجر</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* API Keys */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              مفاتيح API للاختبار
            </CardTitle>
            <CardDescription>مفاتيح جاهزة للاختبار — كل مفتاح يصل إلى tenant مختلف</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Badge variant="success">Tenant A</Badge>
              <code className="text-xs font-mono flex-1" dir="ltr">{TENANT_A_KEY}</code>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Badge variant="warning">Tenant B</Badge>
              <code className="text-xs font-mono flex-1" dir="ltr">{TENANT_B_KEY}</code>
            </div>
          </CardContent>
        </Card>

        {/* New order form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              بيانات الطلب الجديد (للاختبار)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم العميل</Label>
                <Input value={newOrder.customer_name} onChange={(e) => setNewOrder({ ...newOrder, customer_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>المنتج</Label>
                <Input value={newOrder.product_name} onChange={(e) => setNewOrder({ ...newOrder, product_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الكمية</Label>
                <Input type="number" value={newOrder.quantity} onChange={(e) => setNewOrder({ ...newOrder, quantity: Number(e.target.value) })} />
              </div>
              <div className="space-y-2">
                <Label>السعر</Label>
                <Input type="number" value={newOrder.unit_price} onChange={(e) => setNewOrder({ ...newOrder, unit_price: Number(e.target.value) })} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Run button */}
        <div className="flex justify-center">
          <Button size="lg" onClick={runTest} disabled={running} className="min-w-48">
            {running ? (
              <>
                <Loader2 className="w-5 h-5 ml-2 animate-spin" />
                جاري الاختبار...
              </>
            ) : (
              <>
                <Zap className="w-5 h-5 ml-2" />
                تشغيل اختبار الإثبات
              </>
            )}
          </Button>
        </div>

        {/* Test steps */}
        {steps.some((s) => s.status !== 'pending') && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-primary" />
                خطوات الاختبار
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {steps.map((step) => (
                <div key={step.id} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {step.status === 'pending' && <div className="w-6 h-6 rounded-full border-2 border-muted" />}
                    {step.status === 'running' && <Loader2 className="w-6 h-6 text-primary animate-spin" />}
                    {step.status === 'success' && <CheckCircle className="w-6 h-6 text-success" />}
                    {step.status === 'failed' && <XCircle className="w-6 h-6 text-destructive" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                    {step.result && (
                      <p className={`text-xs mt-1 ${step.status === 'success' ? 'text-success' : 'text-destructive'}`}>
                        {step.result}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Logs */}
        {logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Terminal className="w-5 h-5 text-primary" />
                سجل التنفيذ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs font-mono bg-muted/30 p-4 rounded-lg overflow-auto max-h-80 scrollbar-thin" dir="ltr">
                {logs.join('\n')}
              </pre>
            </CardContent>
          </Card>
        )}

        {/* Security info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              كيف يعمل العزل؟
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. كل عميل يحصل على <strong className="text-foreground">schema PostgreSQL مستقل</strong> — ليس مجرد صفوف في جدول مشترك.</p>
            <p>2. مفتاح الـ API يحدد العميل، والـ Backend يبدّل <code className="text-xs bg-muted px-1.5 py-0.5 rounded">search_path</code> إلى schema العميل قبل أي استعلام.</p>
            <p>3. حتى لو حدث خطأ برمجي، لا يمكن للعميل A الوصول إلى schema العميل B — العزل على مستوى PostgreSQL نفسه.</p>
            <p>4. في الإنتاج، استبدل ملف <code className="text-xs bg-muted px-1.5 py-0.5 rounded">lib/db/driver.ts</code> بـ <code className="text-xs bg-muted px-1.5 py-0.5 rounded">pg.Pool</code> — لا يحتاج أي تغيير آخر.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
