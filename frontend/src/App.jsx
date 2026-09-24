import { Navigate, Route, Routes } from 'react-router-dom';
import Topbar from './components/Topbar';
import RequireAuth from './components/RequireAuth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Onboarding from './pages/Onboarding';
import ParentDashboard from './pages/ParentDashboard';
import ChildDashboard from './pages/ChildDashboard';
import Results from './pages/Results';
import CheckResult from './pages/CheckResult';
import Worksheet from './pages/Worksheet';
import Subscription from './pages/Subscription';
import Settings from './pages/Settings';
import { homePathFor, useAuth } from './context/AuthContext';

// Nalaganje snovi je del otroškega zvezka, zato /upload vodi tja
function UploadRedirect() {
  const { user } = useAuth();
  return <Navigate to={user.role === 'child' ? '/child' : homePathFor(user)} replace />;
}

export default function App() {
  return (
    <>
      <Topbar />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<RequireAuth />}>
          <Route path="/upload" element={<UploadRedirect />} />
          <Route path="/results/:id" element={<Results />} />
          <Route path="/checks/:id" element={<CheckResult />} />
          <Route path="/ucni-list/:id" element={<Worksheet />} />
        </Route>

        <Route element={<RequireAuth role="parent" />}>
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<ParentDashboard />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        <Route element={<RequireAuth role="child" />}>
          <Route path="/child" element={<ChildDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
