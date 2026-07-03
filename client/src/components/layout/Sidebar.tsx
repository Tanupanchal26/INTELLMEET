import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Video, Brain, CheckSquare, BarChart2,
  Settings, LogOut, Users, Bell, FolderOpen, Sparkles
} from 'lucide-react';
import { useAppSelector, useAppDispatch } from '../../hooks/useAppDispatch';
import { setMobileSidebar, toggleSidebar } from '../../store/ui/ui.slice';
import { ROUTES, ROLES } from '../../constants';
import { useAuth } from '../../hooks/useAuth';
import { clsx } from 'clsx';
import Logo from '../common/Logo';

const NAV_PRIMARY = [
  { label: 'Dashboard', icon: LayoutDashboard, to: ROUTES.DASHBOARD },
  { label: 'Meetings',  icon: Video,           to: ROUTES.LOBBY },
  { label: 'Teams',     icon: Users,           to: ROUTES.TEAMS },
];

interface NavItemProps {
  label: string;
  icon: React.ElementType;
  to: string;
  collapsed?: boolean;
}

const NavItem = ({ label, icon: Icon, to, collapsed }: NavItemProps) => (
  <NavLink
    to={to}
    aria-label={label}
    className={({ isActive }) =>
      clsx(
        'nav-item group relative flex items-center gap-3 rounded-xl text-sm font-medium',
        'transition-all duration-200 outline-none select-none active:scale-[0.98]',
        collapsed ? 'h-10 w-10 justify-center mx-auto' : 'py-2 px-3',
        isActive && 'active'
      )
    }
  >
    <span className="nav-icon flex items-center justify-center shrink-0 transition-colors rounded-lg w-8 h-8">
      <Icon size={16} aria-hidden="true" />
    </span>
    {!collapsed && <span className="truncate leading-none">{label}</span>}
    {collapsed && (
      <div className="sidebar-tooltip">
        {label}
      </div>
    )}
  </NavLink>
);

const SectionLabel = ({ children, collapsed }: { children: React.ReactNode; collapsed?: boolean }) =>
  collapsed ? (
    <div className="h-px bg-[var(--color-border)] my-2" />
  ) : (
    <p className="sidebar-section-label text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-wider px-3 mb-2 mt-4 select-none">
      {children}
    </p>
  );

const Sidebar = () => {
  const mobileSidebarOpen = useAppSelector((s) => s.ui.mobileSidebarOpen);
  const sidebarCollapsed  = useAppSelector((s) => s.ui.sidebarCollapsed);
  const dispatch          = useAppDispatch();
  const navigate          = useNavigate();
  const { user, logout }  = useAuth();

  const isAdmin = user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;
  const NAV_TOOLS = [
    { label: 'AI Summary',    icon: Sparkles,    to: ROUTES.AI_SUMMARY },
    { label: 'Tasks',         icon: CheckSquare, to: ROUTES.TASKS },
    { label: 'Analytics',     icon: BarChart2,   to: ROUTES.ANALYTICS },
    { label: 'Recordings',    icon: Video,       to: ROUTES.RECORDINGS },
    { label: 'Notifications', icon: Bell,        to: ROUTES.NOTIFICATIONS },
    { label: 'Media Library', icon: FolderOpen,  to: ROUTES.MEDIA },
  ];

  const handleLogout = async () => {
    dispatch(setMobileSidebar(false));
    await logout();
  };

  const initial = user?.name?.charAt(0).toUpperCase() ?? 'U';
  const name    = user?.name ?? 'User';
  const email   = user?.email ?? 'user@intellmeet.io';

  return (
    <aside
      className={clsx(
        'sidebar-container flex flex-col transition-all duration-300 h-screen shrink-0',
        sidebarCollapsed && 'is-collapsed',
        mobileSidebarOpen 
          ? 'w-64 fixed inset-y-0 left-0 z-40' 
          : sidebarCollapsed 
            ? 'w-[72px] hidden md:flex sticky top-0 z-20' 
            : 'w-[260px] hidden md:flex sticky top-0 z-20'
      )}
      aria-label="Main navigation"
    >
      {/* ── Logo Header ── */}
      <div className={clsx("sidebar-logo-container flex items-center shrink-0 h-16", sidebarCollapsed ? "justify-center px-0 overflow-visible" : "justify-between px-5")}>
        {!sidebarCollapsed && (
          <div className="flex items-center gap-3">
            <div className="sidebar-logo-box w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[var(--color-primary)] shadow-sm border border-[var(--color-border)]/15">
              <Logo width={20} height={8} className="text-white" aria-hidden="true" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-bold text-[var(--color-text)] text-base tracking-tight">IntellMeet</span>
              <span className="text-[11px] font-bold text-[var(--color-text-muted)] tracking-wide uppercase">AI Platform</span>
            </div>
          </div>
        )}
        
        {/* Toggle Button */}
        <button
          onClick={() => dispatch(toggleSidebar())}
          className="sidebar-toggle-btn group relative w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] transition-all cursor-pointer"
          aria-label={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200">
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <line x1="9" y1="3" x2="9" y2="21" />
            {sidebarCollapsed ? (
              <path d="M3 7a4 4 0 0 1 4-4h2v18H7a4 4 0 0 1-4-4V7z" fill="currentColor" opacity="0.15" />
            ) : (
              <path d="M9 3h8a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H9V3z" fill="currentColor" opacity="0.15" />
            )}
          </svg>
          {sidebarCollapsed && (
            <div className="sidebar-tooltip">
              Expand Sidebar
            </div>
          )}
        </button>
      </div>


      {/* ── Navigation ── */}
      <nav
        className={clsx(
          "flex flex-col gap-1.5 px-3 pt-2 pb-4 flex-1",
          sidebarCollapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden"
        )}
        aria-label="Primary"
      >
        <div className="flex flex-col gap-1">
          <SectionLabel collapsed={sidebarCollapsed}>Workspace</SectionLabel>
          {NAV_PRIMARY.map((item) => <NavItem key={item.label} {...item} collapsed={sidebarCollapsed} />)}
        </div>

        <div className={clsx("h-px bg-[var(--color-border)] my-1", sidebarCollapsed ? "mx-1" : "mx-2")} />

        <div className="flex flex-col gap-1">
          <SectionLabel collapsed={sidebarCollapsed}>Tools</SectionLabel>
          {NAV_TOOLS.map((item) => <NavItem key={item.label} {...item} collapsed={sidebarCollapsed} />)}
        </div>
      </nav>

      {/* ── Bottom Footer ── */}
      <div className={clsx("sidebar-footer-container px-3 pt-2 pb-3 flex flex-col gap-0.5 shrink-0", sidebarCollapsed && "overflow-visible")}>
        <NavItem label="Settings" icon={Settings} to={ROUTES.SETTINGS} collapsed={sidebarCollapsed} />

        <button
          onClick={handleLogout}
          className={clsx(
            "group relative flex items-center rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-red-500/10 hover:text-red-600 transition-all active:scale-[0.98] cursor-pointer",
            sidebarCollapsed ? "h-10 w-10 justify-center mx-auto" : "py-2.5 gap-3 px-3 w-full text-left"
          )}
          aria-label="Sign out of IntellMeet"
        >
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-red-500/10 group-hover:text-red-500 text-[var(--color-text-dim)] transition-colors">
            <LogOut size={16} aria-hidden="true" />
          </span>
          {!sidebarCollapsed && "Sign Out"}
          {sidebarCollapsed && (
            <div className="sidebar-tooltip danger">
              Sign Out
            </div>
          )}
        </button>

        {/* User profile card */}
        <button
          onClick={() => navigate(`${ROUTES.SETTINGS}?tab=profile`)}
          className={clsx(
            "sidebar-profile-btn group relative flex items-center rounded-xl bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-hover)] border border-[var(--color-border)] shadow-[var(--shadow-sm)] transition-all active:scale-[0.98] cursor-pointer",
            sidebarCollapsed ? "h-11 w-11 justify-center mx-auto mt-2 p-0" : "gap-3 mt-2 px-3 py-2.5 w-full text-left"
          )}
          aria-label={`Profile: ${name}`}
        >
          <div className="sidebar-profile-avatar w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white text-sm font-bold bg-[var(--color-primary)] shadow-sm border border-[var(--color-border)]/20">
            {initial}
          </div>
          {!sidebarCollapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-[var(--color-text)] truncate leading-tight">{name}</p>
                <p className="text-xs text-[var(--color-text-muted)] truncate leading-tight mt-1">{email}</p>
              </div>
              <span
                className="w-2 h-2 rounded-full bg-emerald-500 border border-white shrink-0 shadow-sm"
                title="Online"
                aria-label="Status: Online"
              />
            </>
          )}
          {sidebarCollapsed && (
            <div className="sidebar-tooltip">
              {name}
            </div>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
