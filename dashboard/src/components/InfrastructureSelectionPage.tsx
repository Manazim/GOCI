import React from 'react';
import { useNavigate } from 'react-router-dom';
import './InfrastructureSelectionPage.css';
import waterIcon from '../assets/water.png';
import damIcon from '../assets/dam.png';
import powerIcon from '../assets/power.png';
import agriIcon from '../assets/agriculture.png';




const InfrastructureSelectionPage: React.FC = () => {
  const navigate = useNavigate();

  const handleClick = (infrastructure: string) => {
    if (infrastructure === 'water system') {
      navigate('/login');
    } else {
      alert('Only Water System is available for monitoring at this time.');
    }
  };

  const infrastructures = [
    { name: 'Power Grid', icon: powerIcon, clickable: false },
    { name: 'Dam & Reservoir', icon: damIcon, clickable: false },
    { name: 'Water System', icon: waterIcon, clickable: true },
    { name: 'Agriculture', icon: agriIcon, clickable: false }
  ];

  return (
    <div className="infra-selection-container">
      <h2>Select Critical Infrastructure</h2>
      <div className="infra-cards">
        {infrastructures.map((infra) => (
          <div 
            key={infra.name} 
            className={`infra-card ${infra.clickable ? 'clickable' : 'disabled'}`}
            onClick={() => infra.clickable && handleClick(infra.name.toLowerCase())}
          >
            <div className="infra-icon">
              {infra.icon && <img src={infra.icon} alt={infra.name} className="infra-img" />}
            </div>
            <div className="infra-name">{infra.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default InfrastructureSelectionPage;
