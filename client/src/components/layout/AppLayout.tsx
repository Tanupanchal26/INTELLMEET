import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './Navbar';
import { useAppSelector, useAppDispatch } from '../../hooks/useAppDispatch';
import { setMobileSidebar } from '../../store/ui/ui.slice';
import { ROUTES } from '../../constants';

const PAGE_TITLES: Record<string, string> = {
  [ROUTES.DASHBOARD]:     'Dashboard',
  [ROUTES.LOBBY]:         'Meetings',
  [ROUTES.ANALYTICS]:     'Analytics',
  [ROUTES.TASKS]:         'Task Board',
  [ROUTES.SETTINGS]:      'Settings',
  [ROUTES.PROFILE]:       'Profile',
  [ROUTES.AI_SUMMARY]:    'AI Summary',
  [ROUTES.TEAMS]:         'Teams',
  [ROUTES.NOTIFICATIONS]: 'Notifications',
  [ROUTES.RECORDINGS]:    'Recordings',
  [ROUTES.MEDIA]:         'Media Library',
};

const AppLayout = () => {
  const isAuthenticated   = useAppSelector((s) => s.auth.isAuthenticated);
  const mobileSidebarOpen = useAppSelector((s) => s.ui.mobileSidebarOpen);
  const dispatch          = useAppDispatch();
  const { pathname }      = useLocation();

  const title = PAGE_TITLES[pathname] ?? '';

  /* Close mobile sidebar on route change */
  useEffect(() => {
    dispatch(setMobileSidebar(false));
  }, [pathname, dispatch]);

  /* Announce page title to screen readers on navigation */
  useEffect(() => {
    const announcer = document.getElementById('a11y-announcer');
    if (announcer && title) announcer.textContent = `${title} — IntellMeet`;
  }, [title]);

  if (!isAuthenticated) return <Navigate to="/" replace />;  // guard after all hooks

  return (
    <div className="flex h-screen bg-[var(--color-bg)] overflow-hidden text-[var(--color-text)] font-sans">
      {/* WCAG 2.2 §2.4.1 — Bypass Blocks */}
      <a href="#main-content" className="skip-link">Skip to main content</a>

      {/* Mobile backdrop */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            className="fixed inset-0 bg-[#07070C]/25 backdrop-blur-sm md:hidden z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => dispatch(setMobileSidebar(false))}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-[var(--color-bg)] relative z-10">
        <TopBar title={title} />

        {/* WCAG §2.4.1 landmark — id target for skip link */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 md:px-6 lg:px-8 py-6 lg:py-8"
          tabIndex={-1}
          aria-label={title || 'Page content'}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
