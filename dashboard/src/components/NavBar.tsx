import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './NavBar.css';

interface NavBarProps {
  onLogout: () => void;
}

const NavBar: React.FC<NavBarProps> = ({ onLogout }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-logo">GOCI Dashboard</div>
      <ul className="navbar-links">
        <li><Link to="/home">Home</Link></li>
        <li><Link to="/notifications">Notifications</Link></li>
        <li><Link to="/predictive">Predictive Maintenance</Link></li>
        <li><Link to="/history">History</Link></li>
      </ul>
      <button className="logout-button" onClick={handleLogout}>Logout</button>
    </nav>
  );
};

export default NavBar;
