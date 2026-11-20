import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Compass,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCircle,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { countFilledApiKeys } from '../utils/apiKeys';
import { ApiKeyModal } from './ApiKeyModal';

const ADMIN_ITEMS = [
  {
    label: 'Modul Ajar/RPM',
    path: '/administrasi/modul-ajar',
    icon: BookOpen,
  },
  {
    label: 'Analisis CP, TP dan ATP',
    path: '/administrasi/analisis-cp',
    icon: Compass,
  },
  {
    label: 'Generator LKPD',
    path: '/administrasi/lkpd',
    icon: FileSpreadsheet,
  },
  {
    label: 'Modul Kokurikuler',
    path: '/administrasi/kokurikuler',
    icon: FolderKanban,
  },
  {
    label: 'Generator Soal',
    path: '/administrasi/generator-soal',
    icon: ClipboardList,
  },
  {
    label: 'Bank Soal',
    path: '/administrasi/bank-soal',
    icon: Archive,
  },
] as const;

const ROUTE_LABELS: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/profil': 'Profil Saya',
  '/administrasi/modul-ajar': 'Administrasi / Modul Ajar/RPM',
  '/administrasi/analisis-cp': 'Administrasi / Analisis CP, TP dan ATP',
  '/administrasi/lkpd': 'Administrasi / Generator LKPD',
  '/administrasi/kokurikuler': 'Administrasi / Modul Kokurikuler',
  '/administrasi/generator-soal': 'Administrasi / Generator Soal',
  '/administrasi/bank-soal': 'Administrasi / Bank Soal',
};

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, profile, apiKeys, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminExpanded, setAdminExpanded] = useState(true);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const filledKeyCount = countFilledApiKeys(apiKeys);
  const displayName =
    profile?.namaLengkap?.trim() ||
    user?.displayName ||
    user?.email ||
    'Guru';
  const currentBreadcrumb = ROUTE_LABELS[location.pathname] ?? 'Dashboard';

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 shrink-0">
        <span className="font-display text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
          RuangGuru Digital
        </span>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu navigasi"
          className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="flex-1 overflow-y-auto px-3 py-4 space-y-1"
      >
        <NavLink
          to="/dashboard"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-teal-50 text-teal-800'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Dashboard</span>
        </NavLink>

        <NavLink
          to="/profil"
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              isActive
                ? 'bg-teal-50 text-teal-800'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
            }`
          }
        >
          <UserCircle className="w-4 h-4 shrink-0" />
          <span>Profil Saya</span>
        </NavLink>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setAdminExpanded((prev) => !prev)}
            aria-expanded={adminExpanded}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-3 whitespace-nowrap">
              <FileText className="w-4 h-4 shrink-0" />
              <span>Administrasi</span>
            </span>
            {adminExpanded ? (
              <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            )}
          </button>

          {adminExpanded && (
            <div className="mt-1 ml-3 pl-3 border-l border-slate-200 space-y-1">
              {ADMIN_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive
                          ? 'bg-teal-50 text-teal-800 font-medium'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`
                    }
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          )}
        </div>
      </nav>

      <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
        <p className="truncate font-medium text-slate-700">{displayName}</p>
        <p className="truncate">{user?.email}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop fixed left sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] h-full z-50">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              <span className="hidden sm:inline">RuangGuru</span>
              <span className="hidden sm:inline mx-2" aria-hidden="true">
                /
              </span>
              <span className="font-medium text-slate-900">
                {currentBreadcrumb}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setApiKeyModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <KeyRound className="w-4 h-4 text-teal-700 shrink-0" />
              <span className="hidden sm:inline">API Key</span>
              <span className="font-mono-tabular text-xs text-slate-500">
                {filledKeyCount}/3
              </span>
            </button>

            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 text-sm text-slate-700 max-w-[200px]">
              <span className="truncate font-medium">{displayName}</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-red-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{loggingOut ? 'Keluar...' : 'Keluar'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>

      <ApiKeyModal
        isOpen={apiKeyModalOpen}
        onClose={() => setApiKeyModalOpen(false)}
      />
    </div>
  );
}
