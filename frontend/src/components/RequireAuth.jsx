import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { homePathFor, useAuth } from '../context/AuthContext';

export default function RequireAuth({ role }) {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (loading) return <p className="page-loading">Nalagam…</p>;
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (role && user.role !== role) return <Navigate to={homePathFor(user)} replace />;

  return <Outlet />;
}
