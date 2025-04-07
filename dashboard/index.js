import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import JamAI from 'jamai'; // Adjust import based on your JamAI client version

const app = express();

app.use(cors());
app.use(express.json());

mongoose.connect(
  "###########", //Replace with mongodb credential
  {
    dbName: 'GOCI', //Replaec with mongodb name
  }
)
.then(() => {
  console.log("Connected to Database");
})
.catch((err) => {
  console.log("Not Connected to Database!", err);
});

const SensorModel = mongoose.model('sensors', new mongoose.Schema({}, { strict: false }));
const StatusModel = mongoose.model('status', new mongoose.Schema({}, { strict: false }));
const NotiModel = mongoose.model('notifications', new mongoose.Schema({}, { strict: false }));
const ScheduleModel = mongoose.model('schedules', new mongoose.Schema({}, { strict: false }));

app.get('/Status', async (req, res) => {
  const data = await StatusModel.find();
  res.json(data);
});

app.get('/Latestsensorvalue', async (req, res) => {
  try {
    const data = await SensorModel.find().sort({ Timestamp: -1 }).limit(10);
    res.json(data[0] || {}); // Return only the latest document
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data' });
  }
});

app.get('/Sensorvalue', async (req, res) => {
  const data = await SensorModel.find();
  res.json(data);
});

app.get('/Notification', async (req, res) => {
  const data = await NotiModel.find();
  res.json(data);
});

app.get('/schedule', async (req, res) => {
  const data = await ScheduleModel.find();
  res.json(data);
});

app.post('/analyzetrend', async (req, res) => {
  try {
    const { data1, data2 } = req.body;
    if (!data1 || !data2) {
      console.error("Payload missing data1 or data2:", req.body);
      return res.status(400).json({ error: "Missing data1 or data2 in payload." });
    }
    
    // Log the received payload for debugging
    console.log("Received payload:", { data1, data2 });
    
    // Initialize JamAI client with your credentials.
    const jamai = new JamAI({
      token: process.env.JAMAI_TOKEN || "#########", //replace with your jamiabase api
      projectId: process.env.JAMAI_PROJECT_ID || "#####", // replace with your project ID
      dangerouslyAllowBrowser: false,
    });
    
    // Check if the addRow method is available
    if (typeof jamai.addRow !== 'function') {
      console.error("JamAI.addRow is undefined. Check your JamAI client version.");
      return res.status(500).json({ error: "JamAI.addRow is undefined. Please check your JamAI client configuration." });
    }
    
    // Attempt to add a row with the payload.
    const jamaResponse = await jamai.addRow({
      table_type: "action",
      table_id: "GOCI",
      data: [
        {
          Data1: JSON.stringify(data1),
          Data2: JSON.stringify(data2),
        },
      ],
      reindex: null,
      concurrent: false,
    });
    
    console.log("Response from JamAI:", jamaResponse);
    
    if (
      jamaResponse &&
      jamaResponse.rows &&
      jamaResponse.rows[0] &&
      jamaResponse.rows[0].columns &&
      jamaResponse.rows[0].columns.Result &&
      jamaResponse.rows[0].columns.Result.choices &&
      jamaResponse.rows[0].columns.Result.choices[0] &&
      jamaResponse.rows[0].columns.Result.choices[0].message &&
      jamaResponse.rows[0].columns.Result.choices[0].message.content
    ) {
      const resultText = jamaResponse.rows[0].columns.Result.choices[0].message.content;
      return res.json({ result: resultText });
    } else {
      console.error("Unexpected response structure from JamAI:", jamaResponse);
      return res.status(500).json({ error: 'No result returned from JamAI.' });
    }
  } catch (error) {
    console.error("Error during trend analysis:", error);
    return res.status(500).json({ error: "An error occurred while analyzing trend data." });
  }
});


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
