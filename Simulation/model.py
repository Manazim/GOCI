import pyrebase
import tensorflow as tf
import numpy as np
from tensorflow.keras.models import load_model
from concurrent.futures import ThreadPoolExecutor
import time
from pymongo import MongoClient
from pymongo.server_api import ServerApi
import requests  # Required for sending Telegram messages

# MongoDB configuration
mongo_uri = "mongodb+srv://aimanazim539:manzim@thirdeye.oev3a.mongodb.net/?retryWrites=true&w=majority&appName=ThirdEye"
client = MongoClient(mongo_uri, server_api=ServerApi('1'))
db_collection = client.GOCI.status

try:
    client.admin.command('ping')
    print("Connected to MongoDB successfully!")
except Exception as e:
    print(f"MongoDB connection error: {e}")

# Telegram credentials
TELEGRAM_BOT_TOKEN = '7051347273:AAGPpDVNTNx5K2rLvC2pB0on6QssBcC2sn0'
TELEGRAM_CHAT_ID = '-4725693285'

def send_telegram_message(message):
    """Send an alert message to Telegram."""
    url = f'https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage'
    payload = {'chat_id': TELEGRAM_CHAT_ID, 'text': message}
    try:
        requests.post(url, data=payload)
    except Exception as e:
        print(f"Failed to send Telegram message: {e}")

# Load the Trained Model and Preprocessing Details
model = load_model("water_system_model.h5")
print("Model loaded successfully.")

# Standardization values used during training; update these based on your training data.
feature_means = np.array([97.03, 52.16, 94.71, 20.08])
feature_stds = np.array([9.63, 7.17, 8.28, 2.47])

def preprocess_input(sensor_data):
    """
    Extract features from sensor_data and apply scaling.
    """
    features = np.array([
        sensor_data.get('Pressure'),
        sensor_data.get('Flow_rate'),
        sensor_data.get('Water_quality'),
        sensor_data.get('Temperature')
    ], dtype=np.float32)
    
    # Standardize the features
    features = (features - feature_means) / feature_stds
    return features.reshape(1, -1)

def get_anomaly_label(prediction):
    """
    Map the prediction index to an anomaly label.
    Adjust the mapping based on your label encoding during training.
    """
    predicted_index = np.argmax(prediction, axis=1)[0]
    label_mapping = {
        0: "Normal",
        1: "Pipe Leak",
        2: "Water Quality Issue",
        3: "Temperature Issue"
    }
    return label_mapping.get(predicted_index, "Unknown")

# Global variable to ensure Telegram alert is sent only once per anomaly occurrence.
last_alert_sent = "Normal"

def process_sensor_data(sensor_data):
    """
    Preprocess sensor data, run prediction, and handle alerts and MongoDB updates.
    This function is run in a separate thread.
    """
    global last_alert_sent
    try:
        input_data = preprocess_input(sensor_data)
        prediction = model.predict(input_data)
        anomaly_label = get_anomaly_label(prediction)
        print("Detected anomaly:", anomaly_label)
        
        # If anomaly is detected and no alert has been sent yet for this anomaly, send alert and update MongoDB.
        if anomaly_label != "Normal" and last_alert_sent == "Normal":
            alert_message = f"Alert, {anomaly_label} detected, please check the dashboard for further information"
            send_telegram_message(alert_message)
            # Update MongoDB record (using update_one with an empty filter since there's only one document)
            db_collection.update_one({}, {"$set": {"status": anomaly_label}}, upsert=True)
            last_alert_sent = anomaly_label
        # If the system has returned to normal, update MongoDB and reset alert flag.
        elif anomaly_label == "Normal" and last_alert_sent != "Normal":
            db_collection.update_one({}, {"$set": {"status": "Normal"}}, upsert=True)
            last_alert_sent = "Normal"
            
    except Exception as e:
        print("Error during prediction:", e)

# Setup Firebase Ingress Pod
firebaseConfig = {
    "apiKey": "AIzaSyC1fxZHgfn9lJSAr84k0PyrI3P3XSo04Ro",
    "authDomain": "goci-aab64.firebaseapp.com",
    "databaseURL": "https://goci-aab64-default-rtdb.asia-southeast1.firebasedatabase.app/",
    "storageBucket": "goci-aab64.appspot.com",
}

firebase = pyrebase.initialize_app(firebaseConfig)
db = firebase.database()

# Create a ThreadPoolExecutor with a specified number of worker threads.
executor = ThreadPoolExecutor(max_workers=4)

def stream_handler(message):
    """
    Callback triggered on data changes.
    Prints the event details and submits sensor data to the thread pool for processing.
    """
    print("-----")
    print("Event:", message["event"])
    print("Path:", message["path"])
    print("Data:", message["data"])
    print("-----\n")
    
    sensor_data = message["data"]
    # Ensure sensor_data is a dictionary before processing.
    if isinstance(sensor_data, dict):
        # Offload heavy processing to the thread pool.
        executor.submit(process_sensor_data, sensor_data)

# Start the Firebase stream listener on the "sensor_data" node.
my_stream = db.child("sensor_data").stream(stream_handler)

# -------------------------
# Main Loop to Keep the Script Running (Non-blocking)
# -------------------------
try:
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Stream stopped.")
    my_stream.close()
    executor.shutdown(wait=True)
