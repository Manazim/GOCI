import React, { useState, useEffect } from 'react';
import './NotificationPage.css';

interface NotificationData {
  Timestamp: string;
  Message: string;
  Type: string;
}

const NotificationPage: React.FC = () => {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [filteredNotifications, setFilteredNotifications] = useState<NotificationData[]>([]);
  const [selectedType, setSelectedType] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://192.168.1.159:30001/notification');
      const data = await response.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        setFilteredNotifications(data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
    setLoading(false);
  };

  const filterNotifications = () => {
    let filtered = notifications;

    // Filter by type if not "All"
    if (selectedType !== 'All') {
      filtered = filtered.filter((n: NotificationData) => n.Type === selectedType);
    }

    // Filter by date if both start and end are provided.
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filtered = filtered.filter((n: NotificationData) => {
        // Convert Timestamp string ("YYYY-MM-DD HH:MM:SS") to ISO format ("YYYY-MM-DDTHH:MM:SS")
        const isoTimestamp = n.Timestamp.replace(' ', 'T');
        const nDate = new Date(isoTimestamp);
        return nDate >= start && nDate <= end;
      });
    }
    setFilteredNotifications(filtered);
  };

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    filterNotifications();
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  return (
    <div className="notification-container">
      <h2>Notifications</h2>
      <form onSubmit={handleFilterSubmit} className="filter-form">
        <div className="form-group">
          <label htmlFor="type">Type:</label>
          <select id="type" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
            <option value="All">All</option>
            <option value="Alert">Alert</option>
            <option value="Warning">Warning</option>
            <option value="Update">Update</option>
          </select>
        </div>
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
        <button type="submit">Filter</button>
      </form>
      {loading ? (
        <p>Loading notifications...</p>
      ) : filteredNotifications.length > 0 ? (
        <ul className="notification-list">
          {filteredNotifications.map((n, index) => (
            <li key={index} className="notification-item">
              <div className="notification-header">
                <span className="notification-type">{n.Type}</span>
                <span className="notification-timestamp">{n.Timestamp}</span>
              </div>
              <div className="notification-message">{n.Message}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p>No notifications available for the selected filters.</p>
      )}
    </div>
  );
};

export default NotificationPage;
