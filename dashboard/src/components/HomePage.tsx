import React, { useEffect, useState } from 'react';
import './HomePage.css';

interface SensorData {
  Pressure: number;
  Flow_rate: number;
  Water_quality: number;
  Temperature: number;
  Timestamp?: string;
}

interface StatusData {
  status: string;
}

const HomePage: React.FC = () => {
  const [selectedArea, setSelectedArea] = useState<string>('District Metered Area 1');
  const [sensorData, setSensorData] = useState<SensorData | null>(null);
  const [statusData, setStatusData] = useState<StatusData | null>(null);

  const fetchSensorData = async () => {
    try {
      const response = await fetch('http://192.168.1.159:30001/Latestsensorvalue');
      const data: SensorData = await response.json(); 
  
      if (data && Object.keys(data).length > 0) {
        setSensorData(data);
      }
    } catch (error) {
      console.error('Error fetching sensor data:', error);
    }
  };
  

  const fetchStatusData = async () => {
    try {
      const response = await fetch('http://192.168.1.159:30001/status');
      const data: any[] = await response.json();
      if (data && data.length > 0) {
        setStatusData({ status: data[0].status });
      }
    } catch (error) {
      console.error('Error fetching status data:', error);
    }
  };

  useEffect(() => {
    fetchSensorData();
    fetchStatusData();
    const interval = setInterval(() => {
      fetchSensorData();
      fetchStatusData();
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedArea]);

  const handleAreaChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const area = event.target.value;
    setSelectedArea(area);
    setSensorData(null);
  };

  return (
    <div className="home-container">
      <h2>Dashboard Home</h2>
      <div className="area-selection">
        <label htmlFor="area-select">Select Area:</label>
        <select id="area-select" value={selectedArea} onChange={handleAreaChange}>
          <option value="District Metered Area 1">District Metered Area 1</option>
          {/* Add more areas as needed */}
        </select>
      </div>
      <div className="junction-info">
        <h3>{selectedArea} - Unit 101</h3>
        <p>Location: Section A, Building 3</p>
      </div>
      <div className="sensor-readings">
        <h3>Real-Time Sensor Readings</h3>
        {sensorData ? (
          <div className="cards-container">
            <div className="reading-card">
              <h4>Pressure</h4>
              <p>{sensorData.Pressure.toFixed(2)} PSI</p>
            </div>
            <div className="reading-card">
              <h4>Flow Rate</h4>
              <p>{sensorData.Flow_rate.toFixed(2)} L/s</p>
            </div>
            <div className="reading-card">
              <h4>Water Quality</h4>
              <p>{sensorData.Water_quality.toFixed(2)} %</p>
            </div>
            <div className="reading-card">
              <h4>Temperature</h4>
              <p>{sensorData.Temperature.toFixed(2)} °C</p>
            </div>
          </div>
        ) : (
          <p>Loading sensor data...</p>
        )}
        {sensorData?.Timestamp && (
          <div className="timestamp">
            <span>Last Updated:</span> <span>{sensorData.Timestamp}</span>
          </div>
        )}
      </div>
      {statusData && (
        <div className={`status-alert ${statusData.status === 'Normal' ? 'alert-green' : 'alert-red'}`}>
          <strong>{statusData.status}</strong>
        </div>
      )}
    </div>
  );
};

export default HomePage;
