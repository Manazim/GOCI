import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './PredictiveMaintenancePage.css';

type Schedule = {
  Date: string;
  Note: string;
};

const PredictiveMaintenancePage: React.FC = () => {
  const [selectedArea, setSelectedArea] = useState<string>('District Metered Area 1');
  const [lastMaintenance, setLastMaintenance] = useState<string>('Not available');
  const [failureOutput, setFailureOutput] = useState<string>(''); // Data from /api/
  const [predictOutput, setPredictOutput] = useState<string>(''); // Data from /api2/
  const [autoPromptOutput, setAutoPromptOutput] = useState<string>(''); // Combined prompt output
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [customPromptOutput, setCustomPromptOutput] = useState<string>('');
  const [failureLoading, setFailureLoading] = useState<boolean>(false);
  const [predictLoading, setPredictLoading] = useState<boolean>(false);
  const [promptLoading, setPromptLoading] = useState<boolean>(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [openEvents, setOpenEvents] = useState<{ [key: string]: boolean }>({});

  // Simulate fetching last maintenance date based on selected area.
  useEffect(() => {
    if (selectedArea === 'District Metered Area 1') {
      setLastMaintenance('2025-03-29 22:00:00');
    } else if (selectedArea === 'District Metered Area 2') {
      setLastMaintenance('2025-03-28 18:30:00');
    } else if (selectedArea === 'District Metered Area 3') {
      setLastMaintenance('2025-03-27 15:45:00');
    } else {
      setLastMaintenance('Not available');
    }
    // Clear previous outputs when area changes
    setFailureOutput('');
    setPredictOutput('');
    setAutoPromptOutput('');
    setCustomPrompt('');
    setCustomPromptOutput('');
  }, [selectedArea]);

  // Fetch schedules from /schedule endpoint
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const response = await fetch('http://192.168.1.159:30001/schedule');
        const data = await response.json();

        data.sort((a: Schedule, b: Schedule) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
        setSchedules(data);
      } catch (error) {
        console.error("Error fetching schedules:", error);
      }
    };
    fetchSchedules();
  }, []);

  const handleAreaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedArea(e.target.value);
  };

  // Group schedules into Tomorrow, Next Week, and Next Month.
  const groupSchedules = () => {
    const now = new Date();
    // Define tomorrow as the next calendar day.
    const tomorrowStart = new Date(now);
    tomorrowStart.setDate(now.getDate() + 1);
    tomorrowStart.setHours(0, 0, 0, 0);
    const tomorrowEnd = new Date(tomorrowStart);
    tomorrowEnd.setHours(23, 59, 59, 999);

    // Next week: from the day after tomorrow until 7 days from now.
    const nextWeekStart = new Date(tomorrowEnd);
    nextWeekStart.setDate(tomorrowEnd.getDate() + 1);
    const nextWeekEnd = new Date(now);
    nextWeekEnd.setDate(now.getDate() + 7);
    nextWeekEnd.setHours(23, 59, 59, 999);

    // Next month: from the day after next week until 30 days from now.
    const nextMonthStart = new Date(nextWeekEnd);
    nextMonthStart.setDate(nextWeekEnd.getDate() + 1);
    const nextMonthEnd = new Date(now);
    nextMonthEnd.setDate(now.getDate() + 30);
    nextMonthEnd.setHours(23, 59, 59, 999);

    const tomorrowEvents = schedules.filter(sch => {
      const schDate = new Date(sch.Date);
      return schDate >= tomorrowStart && schDate <= tomorrowEnd;
    });
    const nextWeekEvents = schedules.filter(sch => {
      const schDate = new Date(sch.Date);
      return schDate >= nextWeekStart && schDate <= nextWeekEnd;
    });
    const nextMonthEvents = schedules.filter(sch => {
      const schDate = new Date(sch.Date);
      return schDate >= nextMonthStart && schDate <= nextMonthEnd;
    });
    return { tomorrowEvents, nextWeekEvents, nextMonthEvents };
  };

  const { tomorrowEvents, nextWeekEvents, nextMonthEvents } = groupSchedules();

  const handleFailureAnalyze = async () => {
    setFailureLoading(true);
    try {
      const response = await fetch('/api/');
      const text = await response.text();
      setFailureOutput(text);
    } catch (error) {
      console.error('Error analyzing failure data:', error);
      setFailureOutput('Error analyzing failure data.');
    }
    setFailureLoading(false);
  };

  // Handler for Predict Next Maintenance (calls /newapi/)
  const handlePredict = async () => {
    setPredictLoading(true);
    try {
      const response = await fetch('/newapi/');
      const text = await response.text();
      setPredictOutput(text);
    } catch (error) {
      console.error('Error predicting next maintenance:', error);
      setPredictOutput('Error predicting next maintenance.');
    }
    setPredictLoading(false);
  };

  // Handler for AI Prompt (Auto Analyze) that combines data from /api and /newapi,
  const handleAutoPrompt = async () => {
    setPromptLoading(true);
    try {
      const [res1, res2] = await Promise.all([fetch('/api/'), fetch('/newapi/')]);
      const text1 = await res1.text();
      const text2 = await res2.text();
      const combinedPrompt = `Based on data from /api (potential problems):\n${text1}\n\nand data from /newapi (predict next maintenance):\n${text2}\n\nAnalyze this information and provide precautionary steps and recommendations for the technician.`;
      
      // Google AI Studio integration (inline; WARNING: Exposing API key is insecure for production)
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const apiKey = "################"; // Replace with your API key
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-pro-exp-03-25",
      });
      const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 64,
        maxOutputTokens: 4096,
        responseMimeType: "text/plain",
      };
      const chatSession = model.startChat({
        generationConfig,
        history: [],
      });
      const result = await chatSession.sendMessage(combinedPrompt);
      const promptText = result.response.text();
      
      setAutoPromptOutput(promptText);
    } catch (error) {
      console.error('Error processing auto prompt:', error);
      setAutoPromptOutput('Error processing auto prompt.');
    }
    setPromptLoading(false);
  };

  // Handler for sending custom prompt via /prompt endpoint
  const handleCustomPrompt = async () => {
    if (!customPrompt.trim()) return;
    setPromptLoading(true);
    try {
      const promptResponse = await fetch('/prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: customPrompt }),
      });
      const promptText = await promptResponse.text();
      setCustomPromptOutput(promptText);
    } catch (error) {
      console.error('Error processing custom prompt:', error);
      setCustomPromptOutput('Error processing custom prompt.');
    }
    setPromptLoading(false);
  };

  return (
    <div className="predictive-container">
      <div className="sidebar">
        <h3>Select Area</h3>
        <select value={selectedArea} onChange={handleAreaChange}>
          <option value="District Metered Area 1">District Metered Area 1</option>
          <option value="District Metered Area 2">District Metered Area 2</option>
          <option value="District Metered Area 3">District Metered Area 3</option>
        </select>
        <div className="maintenance-info">
          <h4>Last Maintenance</h4>
          <p>{lastMaintenance}</p>
        </div>
        <div className="schedule-section">
          <h4>Upcoming Schedule</h4>
          {tomorrowEvents.length > 0 && (
            <div className="schedule-group">
              <h5>Tomorrow</h5>
              {tomorrowEvents.map((event) => {
                const key = event.Date;
                return (
                  <div key={key} className="schedule-item">
                    <div
                      className="schedule-date"
                      onClick={() =>
                        setOpenEvents((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                    >
                      {new Date(event.Date).toLocaleString()}
                    </div>
                    {openEvents[key] && (
                      <div className="schedule-note">
                        <ReactMarkdown>{event.Note}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {nextWeekEvents.length > 0 && (
            <div className="schedule-group">
              <h5>Next Week</h5>
              {nextWeekEvents.map((event) => {
                const key = event.Date;
                return (
                  <div key={key} className="schedule-item">
                    <div
                      className="schedule-date"
                      onClick={() =>
                        setOpenEvents((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                    >
                      {new Date(event.Date).toLocaleString()}
                    </div>
                    {openEvents[key] && (
                      <div className="schedule-note">
                        <ReactMarkdown>{event.Note}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {nextMonthEvents.length > 0 && (
            <div className="schedule-group">
              <h5>Next Month</h5>
              {nextMonthEvents.map((event) => {
                const key = event.Date;
                return (
                  <div key={key} className="schedule-item">
                    <div
                      className="schedule-date"
                      onClick={() =>
                        setOpenEvents((prev) => ({ ...prev, [key]: !prev[key] }))
                      }
                    >
                      {new Date(event.Date).toLocaleString()}
                    </div>
                    {openEvents[key] && (
                      <div className="schedule-note">
                        <ReactMarkdown>{event.Note}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="output-column">
        <div className="analysis-section">
          <h3>Predict Failure</h3>
          <button className="analyze-button" onClick={handleFailureAnalyze} disabled={failureLoading}>
            {failureLoading ? 'Analyzing...' : 'Analyze Data'}
          </button>
          {failureOutput ? (
            <div className="output-card">
              <pre>{failureOutput}</pre>
            </div>
          ) : (
            <p>No failure analysis performed yet. Click the button above.</p>
          )}
        </div>
        <div className="predict-section">
          <h3>Predict Next Maintenance</h3>
          <button className="predict-button" onClick={handlePredict} disabled={predictLoading}>
            {predictLoading ? 'Predicting...' : 'Predict Next Maintenance'}
          </button>
          {predictOutput ? (
            <div className="output-card">
              <pre>{predictOutput}</pre>
            </div>
          ) : (
            <p>No prediction performed yet. Click the button above.</p>
          )}
        </div>
        <div className="prompt-section">
          <h3>AI Prompt Section</h3>
          <button className="auto-prompt-button" onClick={handleAutoPrompt} disabled={promptLoading}>
            {promptLoading ? 'Processing...' : 'Auto Analyze Prompt'}
          </button>
          {autoPromptOutput ? (
            <div className="output-card fixed-output">
              <ReactMarkdown>{autoPromptOutput}</ReactMarkdown>
            </div>
          ) : (
            <p>No auto prompt analysis yet. Click the button above.</p>
          )}
          <div className="custom-prompt">
            <textarea 
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Type your question here..."
            />
            <button className="send-prompt-button" onClick={handleCustomPrompt} disabled={promptLoading}>
              {promptLoading ? 'Sending...' : 'Send Prompt'}
            </button>
          </div>
          {customPromptOutput ? (
            <div className="output-card fixed-output">
              <ReactMarkdown>{customPromptOutput}</ReactMarkdown>
            </div>
          ) : (
            <p>No custom prompt response yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default PredictiveMaintenancePage;
