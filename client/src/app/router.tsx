import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { ProtectedRoute, PublicRoute, RoleProtectedRoute } from '../components/auth/ProtectedRoute';
import RedirectProfileToSettings from '../components/auth/RedirectProfileToSettings';
import AppLayout from '../components/layout/AppLayout';
import Loader from '../components/common/Loader';
import { ROUTES } from '../constants';

// ── Lazy pages ────────────────────────────────────────────────────────────────
const Home           = lazy(() => import('../pages/Home'));
const Login          = lazy(() => import('../pages/Login'));
const Signup         = lazy(() => import('../pages/Signup'));
const ForgotPassword = lazy(() => import('../pages/ForgotPassword'));
const ResetPassword  = lazy(() => import('../pages/ResetPassword'));
const VerifyEmail    = lazy(() => import('../pages/VerifyEmail'));
const Dashboard      = lazy(() => import('../pages/Dashboard'));

const Settings       = lazy(() => import('../pages/Settings'));
const Lobby          = lazy(() => import('../pages/Lobby'));
// MeetingRoom in its own chunk — largest bundle, only needed inside a call
const MeetingRoom    = lazy(() => import('../pages/MeetingRoom'));
const Analytics      = lazy(() => import('../pages/Analytics'));
const Tasks          = lazy(() => import('../pages/Tasks'));
const AISummary      = lazy(() => import('../pages/AISummary'));
const Teams          = lazy(() => import('../pages/Teams'));
const Channels       = lazy(() => import('../pages/Channels'));
const Notifications  = lazy(() => import('../pages/Notifications'));
const Recordings     = lazy(() => import('../pages/Recordings'));
const RecordingDetail = lazy(() => import('../pages/RecordingDetail'));
const MediaLibrary        = lazy(() => import('../pages/MediaLibrary'));
const PostMeetingDashboard = lazy(() => import('../pages/PostMeetingDashboard'));
const NotFound             = lazy(() => import('../pages/NotFound'));
const GoogleAuthSuccess = lazy(() => import('../pages/GoogleAuthSuccess'));

// ── Prefetch heavy routes after first paint ───────────────────────────────────
const prefetchMeetingRoom = () => import('../pages/MeetingRoom');

const PageFallback = () => <Loader fullPage label="Loading…" />;

const AppRoutes = () => {
  const { pathname } = useLocation();

  // Prefetch MeetingRoom when user is on Lobby (likely next step)
  useEffect(() => {
    if (pathname === ROUTES.LOBBY) prefetchMeetingRoom();
  }, [pathname]);

  return (
    <Routes>
      {/* Public landing — own Suspense so auth pages don't block */}
      <Route
        path={ROUTES.HOME}
        element={
          <Suspense fallback={<PageFallback />}>
            <Home />
          </Suspense>
        }
      />

      {/* Auth pages — only for unauthenticated users */}
      <Route element={<PublicRoute />}>
        <Route
          path={ROUTES.LOGIN}
          element={
            <Suspense fallback={<PageFallback />}>
              <Login />
            </Suspense>
          }
        />
        <Route
          path={ROUTES.SIGNUP}
          element={
            <Suspense fallback={<PageFallback />}>
              <Signup />
            </Suspense>
          }
        />
        <Route path={ROUTES.FORGOT_PASSWORD} element={<Suspense fallback={<PageFallback />}><ForgotPassword /></Suspense>} />
      </Route>

      {/* Token-based pages — accessible to ALL users (email links must work regardless of auth state) */}
      <Route path={ROUTES.RESET_PASSWORD}  element={<Suspense fallback={<PageFallback />}><ResetPassword /></Suspense>} />
      <Route path="/reset-password"        element={<Suspense fallback={<PageFallback />}><ResetPassword /></Suspense>} />
      <Route path={ROUTES.VERIFY_EMAIL}    element={<Suspense fallback={<PageFallback />}><VerifyEmail /></Suspense>} />

      {/* Protected app shell */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route
            path={ROUTES.DASHBOARD}
            element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>}
          />
          <Route path={ROUTES.LOBBY}         element={<Suspense fallback={<PageFallback />}><Lobby /></Suspense>} />
          
          <Route path={ROUTES.ANALYTICS}   element={<Suspense fallback={<PageFallback />}><Analytics /></Suspense>} />

          <Route path={ROUTES.TASKS}         element={<Suspense fallback={<PageFallback />}><Tasks /></Suspense>} />
          <Route path={ROUTES.SETTINGS}      element={<Suspense fallback={<PageFallback />}><Settings /></Suspense>} />
          <Route path={ROUTES.PROFILE}       element={<Suspense fallback={null}><RedirectProfileToSettings /></Suspense>} />
          <Route path={ROUTES.AI_SUMMARY}    element={<Suspense fallback={<PageFallback />}><AISummary /></Suspense>} />
          <Route path={ROUTES.TEAMS}         element={<Suspense fallback={<PageFallback />}><Teams /></Suspense>} />
          <Route path={ROUTES.TEAM}          element={<Suspense fallback={<PageFallback />}><Channels /></Suspense>} />
          <Route path={ROUTES.CHANNELS}      element={<Suspense fallback={<PageFallback />}><Channels /></Suspense>} />
          <Route path={ROUTES.NOTIFICATIONS} element={<Suspense fallback={<PageFallback />}><Notifications /></Suspense>} />
          <Route path={ROUTES.RECORDINGS}    element={<Suspense fallback={<PageFallback />}><Recordings /></Suspense>} />
          <Route path={ROUTES.RECORDING_DETAIL} element={<Suspense fallback={<PageFallback />}><RecordingDetail /></Suspense>} />
          <Route path={ROUTES.MEDIA}         element={<Suspense fallback={<PageFallback />}><MediaLibrary /></Suspense>} />
          <Route path={ROUTES.POST_MEETING}  element={<Suspense fallback={<PageFallback />}><PostMeetingDashboard /></Suspense>} />
        </Route>

        {/* MeetingRoom — full-screen, outside AppLayout, isolated chunk */}
        <Route
          path={ROUTES.MEETING}
          element={
            <Suspense fallback={<PageFallback />}>
              <MeetingRoom />
            </Suspense>
          }
        />
      </Route>

      <Route path="/auth/google/success" element={<Suspense fallback={<PageFallback />}><GoogleAuthSuccess /></Suspense>} />
      <Route path={ROUTES.NOT_FOUND}     element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
    </Routes>
  );
};

export default AppRoutes;
