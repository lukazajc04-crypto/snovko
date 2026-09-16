import { startTransition } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { homePathFor, useAuth } from '../context/AuthContext';

export default function Topbar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    // Navigacija v RR v7 teče kot tranzicija; če bi odjava potekla prej, bi RequireAuth preusmeril na /login
    startTransition(() => {
      navigate('/');
      logout();
    });
  }

  return (
    <header className="topbar">
      <Link to={isAuthenticated ? homePathFor(user) : '/'} className="logo">
        Snovko
      </Link>

      <nav className="topbar-nav">
        {isAuthenticated ? (
          <>
            {user.role === 'parent' && <NavLink to="/dashboard">Pregled</NavLink>}
            {user.role === 'child' && <NavLink to="/child">Moja snov</NavLink>}
            {user.role === 'parent' && <NavLink to="/subscription">Naročnina</NavLink>}
            {user.role === 'parent' && <NavLink to="/settings">Nastavitve</NavLink>}
            <span className="topbar-user">{user.name}</span>
            <button type="button" className="btn btn-small" onClick={handleLogout}>
              Odjava
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login">Prijava</NavLink>
            <Link to="/register" className="btn btn-primary btn-small">
              Začni brezplačno
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
