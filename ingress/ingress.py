import pyrebase
import tensorflow as tf
import numpy as np
from tensorflow.keras.models import load_model
from concurrent.futures import ThreadPoolExecutor
import time

# -------------------------
# 1. Load the Trained Model and Preprocessing Details
# -------------------------
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

def process_sensor_data(sensor_data):
    """
    Preprocess sensor data, run prediction, and print the result.
    This function is run in a separate thread.
    """
    try:
        input_data = preprocess_input(sensor_data)
        prediction = model.predict(input_data)
        anomaly_label = get_anomaly_label(prediction)
        print("Detected anomaly:", anomaly_label)
    except Exception as e:
        print("Error during prediction:", e)

# -------------------------
# 2. Setup Firebase Ingress Pod
# -------------------------
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
# 3. Main Loop to Keep the Script Running (Non-blocking)
# -------------------------
try:
    # Instead of a busy-wait loop, use sleep to yield control.
    while True:
        time.sleep(1)
except KeyboardInterrupt:
    print("Stream stopped.")
    my_stream.close()
    executor.shutdown(wait=True)
