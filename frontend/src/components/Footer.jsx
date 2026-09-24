import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="site-footer">
      <span className="logo logo-small">Snovko</span>
      <nav className="site-footer-nav" aria-label="Pravne informacije">
        <Link to="/pogoji">Pogoji uporabe</Link>
        <Link to="/zasebnost">Zasebnost</Link>
      </nav>
      <span className="site-footer-copy">© {new Date().getFullYear()} Snovko</span>
    </footer>
  );
}
