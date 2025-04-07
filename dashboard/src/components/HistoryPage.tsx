import React, { useState} from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import './HistoryPage.css';

interface HistoryData {
  Timestamp: string;
  Pressure: number;
  Flow_rate: number;
  Water_quality: number;
  Temperature: number;
}

const HistoryPage: React.FC = () => {
  // State for DMA selection
  const [selectedArea, setSelectedArea] = useState<string>('District Metered Area 1');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [historyData, setHistoryData] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [analysisOutput, setAnalysisOutput] = useState<string>('');

  // If needed, you can use the selectedArea value to filter sensor data on the backend.
  // For now, it is simply stored as state and displayed in the header.

  // Fetch history data for charting using fetch
  const fetchHistory = async () => {
    setLoading(true);
    try {
      // Optionally, you can pass selectedArea as a query parameter if your backend supports it.
      const response = await fetch(`http://192.168.1.159:30001/Sensorvalue?start=${startDate}&end=${endDate}`);
      const data: HistoryData[] = await response.json();
      if (Array.isArray(data) && data.length > 0 && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        const filteredData = data.filter((item) => {
          // Convert "YYYY-MM-DD HH:MM:SS" to ISO format ("YYYY-MM-DDTHH:MM:SS")
          const isoTimestamp = item.Timestamp.replace(' ', 'T');
          const itemDate = new Date(isoTimestamp);
          return itemDate >= start && itemDate <= end;
        });
        setHistoryData(filteredData);
      } else {
        setHistoryData(data);
      }
    } catch (error) {
      console.error('Error fetching history data:', error);
    }
    setLoading(false);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  // Handler for analyzing trend using the backend /analyzetrend endpoint (using fetch)
  const handleAnalyzeTrend = async () => {
    try {
      // Fetch last 200 readings from Sensorvalue API
      const response = await fetch('http://192.168.1.159:30001/Sensorvalue');
      const allData: HistoryData[] = await response.json();
      
      if (allData.length < 200) {
        setAnalysisOutput("Not enough data to perform trend analysis (need at least 200 records).");
        return;
      }
      
      // Sort data by Timestamp (ascending)
      const sortedData = allData.sort(
        (a, b) => new Date(a.Timestamp).getTime() - new Date(b.Timestamp).getTime()
      );
      
      // Split into two parts:
      // Data1: second last 100 readings, Data2: last 100 readings.
      const data1 = sortedData.slice(-200, -100);
      const data2 = sortedData.slice(-100);
      
      // Prepare payload: extract only sensor fields.
      const payloadData1 = data1.map((d) => ({
        Pressure: d.Pressure,
        Flow_rate: d.Flow_rate,
        Water_quality: d.Water_quality,
        Temperature: d.Temperature,
      }));
      const payloadData2 = data2.map((d) => ({
        Pressure: d.Pressure,
        Flow_rate: d.Flow_rate,
        Water_quality: d.Water_quality,
        Temperature: d.Temperature,
      }));
      
      console.log("Payload Data1:", payloadData1);
      console.log("Payload Data2:", payloadData2);
      
      const payload = JSON.stringify({
        data1: payloadData1,
        data2: payloadData2,
      });
      
      // Call the backend /analyzetrend endpoint using fetch
      const trendResponse = await fetch('http://192.168.1.159:30001/analyzetrend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });
      
      if (!trendResponse.ok) {
        throw new Error(`Request failed with status ${trendResponse.status}`);
      }
      
      const result = await trendResponse.json();
      console.log("Response from backend analyze-trend:", result);
      
      if (result.result) {
        setAnalysisOutput(result.result);
      } else {
        setAnalysisOutput("No result returned from trend analysis.");
      }
    
    } catch (error) {
      console.error('Error during trend analysis:', error);
      setAnalysisOutput("An error occurred while analyzing trend data.");
    }
  };

  return (
    <div className="history-container">
      <h2>History of Sensor Readings</h2>
      
      {/* DMA Selection */}
      <div className="dma-selection">
        <label htmlFor="dma">Select DMA:</label>
        <select id="dma" value={selectedArea} onChange={(e) => setSelectedArea(e.target.value)}>
          <option value="District Metered Area 1">District Metered Area 1</option>
          <option value="District Metered Area 2">District Metered Area 2</option>
          <option value="District Metered Area 3">District Metered Area 3</option>
        </select>
      </div>
      
      <form onSubmit={handleFilterSubmit} className="filter-form">
        <div className="form-group">
          <label htmlFor="start">Start Date &amp; Time:</label>
          <div className="date-input-container">
            <input
              type="datetime-local"
              id="start"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
            />
            <span className="calendar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 16 16">
                <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1.5A1.5 1.5 0 0 1 16 2.5v11A1.5 1.5 0 0 1 14.5 15h-13A1.5 1.5 0 0 1 0 13.5v-11A1.5 1.5 0 0 1 1.5 1H3V.5a.5.5 0 0 1 .5-.5zM1.5 2A.5.5 0 0 0 1 2.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-13z"/>
                <path d="M3 5h10v1H3V5zm0 2h10v1H3V7zm0 2h10v1H3V9z"/>
              </svg>
            </span>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="end">End Date &amp; Time:</label>
          <div className="date-input-container">
            <input
              type="datetime-local"
              id="end"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
            />
            <span className="calendar-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="white" viewBox="0 0 16 16">
                <path d="M3.5 0a.5.5 0 0 1 .5.5V1h8V.5a.5.5 0 0 1 1 0V1h1.5A1.5 1.5 0 0 1 16 2.5v11A1.5 1.5 0 0 1 14.5 15h-13A1.5 1.5 0 0 1 0 13.5v-11A1.5 1.5 0 0 1 1.5 1H3V.5a.5.5 0 0 1 .5-.5zM1.5 2A.5.5 0 0 0 1 2.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5h-13z"/>
                <path d="M3 5h10v1H3V5zm0 2h10v1H3V7zm0 2h10v1H3V9z"/>
              </svg>
            </span>
          </div>
        </div>
        <button type="submit">Fetch History</button>
      </form>
      {loading ? (
        <p>Loading history data...</p>
      ) : historyData.length > 0 ? (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={historyData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="Timestamp" tick={{ fill: '#e0e0e0' }} />
            <YAxis tick={{ fill: '#e0e0e0' }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Pressure" stroke="#8884d8" />
            <Line type="monotone" dataKey="Flow_rate" stroke="#82ca9d" />
            <Line type="monotone" dataKey="Water_quality" stroke="#ffc658" />
            <Line type="monotone" dataKey="Temperature" stroke="#ff7300" />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p>No history data available for the selected range.</p>
      )}
      <div className="trend-analysis-section">
        <h3>Analyze Trend</h3>
        <button className="analyze-button" onClick={handleAnalyzeTrend}>
          Analyze Trend
        </button>
        {analysisOutput ? (
          <div className="output-card fixed-output">
            <ReactMarkdown>{analysisOutput}</ReactMarkdown>
          </div>
        ) : (
          <p>No trend analysis performed yet. Click the button above.</p>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
