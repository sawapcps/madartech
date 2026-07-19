'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Cloud,
  LayoutDashboard,
  Users,
  AppWindow,
  KeyRound,
  Database,
  HardDrive,
  Archive,
  ScrollText,
  Activity,
  Settings,
  Sun,
  Moon,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { href: '/dashboard/clients', label: 'العملاء', icon: Users },
  { href: '/dashboard/applications', label: 'التطبيقات', icon: AppWindow },
  { href: '/dashboard/licenses', label: 'التراخيص', icon: KeyRound },
  { href: '/dashboard/databases', label: 'قواعد البيانات', icon: Database },
  { href: '/dashboard/storage', label: 'التخزين', icon: HardDrive },
  { href: '/dashboard/backups', label: 'النسخ الاحتياطي', icon: Archive },
  { href: '/dashboard/logs', label: 'السجلات', icon: ScrollText },
  { href: '/dashboard/monitoring', label: 'المراقبة', icon: Activity },
  { href: '/dashboard/api-keys', label: 'مفاتيح API', icon: KeyRound },
  { href: '/dashboard/settings', label: 'الإعدادات', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  const initials = user?.email?.[0]?.toUpperCase() ?? 'A';

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          'fixed top-0 right-0 z-40 h-full w-72 bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 h-16 border-b border-sidebar-foreground/10">
            <div className="w-9 h-9 rounded-lg bg-sidebar-accent flex items-center justify-center">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm">MadarTech Cloud</p>
              <p className="text-xs text-sidebar-foreground/50">منصة الإدارة</p>
            </div>
            <button
              className="mr-auto lg:hidden text-sidebar-foreground/60"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto scrollbar-thin py-4 px-3 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-sidebar-accent text-white shadow-lg shadow-primary/20'
                      : 'text-sidebar-foreground/60 hover:bg-sidebar-foreground/5 hover:text-sidebar-foreground'
                  )}
                >
                  <item.icon className="w-4.5 h-4.5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User */}
          <div className="p-3 border-t border-sidebar-foreground/10">
            <div className="flex items-center gap-3 px-3 py-2 rounded-lg">
              <Avatar className="w-9 h-9 border-2 border-sidebar-accent/30">
                <AvatarFallback className="bg-sidebar-accent/20 text-sidebar-accent text-sm font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.email}</p>
                <p className="text-xs text-sidebar-foreground/50">مدير المنصة</p>
              </div>
              <button
                onClick={handleSignOut}
                className="text-sidebar-foreground/40 hover:text-destructive transition-colors"
                title="تسجيل الخروج"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pr-72">
        {/* Topbar */}
        <header className="sticky top-0 z-20 h-16 glass border-b border-border flex items-center px-4 lg:px-8 gap-4">
          <button
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="relative flex-1 max-w-md hidden md:block">
            <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="بحث..."
              className="w-full h-9 pr-10 pl-4 rounded-lg bg-muted/50 text-sm border border-transparent focus:border-primary focus:bg-background focus:outline-none transition-all"
            />
          </div>

          <div className="mr-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleTheme} title="تبديل المظهر">
              {theme === 'dark' ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="relative" title="الإشعارات">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-2 left-2 w-2 h-2 bg-primary rounded-full" />
            </Button>
            <div className="hidden sm:block w-px h-8 bg-border mx-1" />
            <div className="hidden sm:flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{user?.email?.split('@')[0]}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8 min-h-[calc(100vh-4rem)]">{children}</main>
      </div>
    </div>
  );
}
