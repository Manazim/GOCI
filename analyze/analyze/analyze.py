import pandas as pd
import numpy as np
import requests
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from sklearn.preprocessing import MinMaxScaler
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from flask import Flask, Response
from flask_cors import CORS, cross_origin


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --------------------------
# Function to get ambient temperature from OpenWeather API
def get_ambient_temperature(city="Muar", api_key="81c60f1022c42dd9f3da5a4cb9dec18d"):
    url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
    try:
        response = requests.get(url)
        data = response.json()
        ambient_temp = data['main']['temp']
        return ambient_temp
    except Exception as e:
        return 20  # default value

@app.route('/', methods=['GET'])
@cross_origin()

def analyze():
    # 1. Connect to MongoDB and fetch sensor data
    mongo_uri = "mongodb+srv://aimanazim539:manzim@thirdeye.oev3a.mongodb.net/?retryWrites=true&w=majority&appName=ThirdEye"
    client = MongoClient(mongo_uri, server_api=ServerApi('1'))
    db_collection = client.GOCI.sensors

    cursor = db_collection.find({})
    data_list = list(cursor)
    df = pd.DataFrame(data_list)
    if '_id' in df.columns:
        df = df.drop(columns=['_id'])

    # Convert Timestamp to datetime and sort
    df['Timestamp'] = pd.to_datetime(df['Timestamp'], format='%Y-%m-%d %H:%M:%S')
    df = df.sort_values('Timestamp')

    # 2. Use the last 500 readings (error if not enough records)
    if len(df) >= 500:
        df = df.iloc[-500:]
    else:
        return Response("Warning: less than 500 records available.", status=400, mimetype='text/plain')

    # Define features and extract data
    features = ['Pressure', 'Flow_rate', 'Water_quality', 'Temperature']
    data = df[features].values

    # 3. Normalize the data to [0,1]
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(data)

    # 4. Split data: first 380 readings for training, last 120 for testing
    train_size = 380
    train_data = scaled_data[:train_size]
    test_data = scaled_data[train_size:]

    # 5. Create training sequences using a sliding window
    time_step = 20
    def create_dataset(dataset, time_step):
        X, y = [], []
        for i in range(len(dataset) - time_step):
            X.append(dataset[i:i+time_step])
            y.append(dataset[i+time_step])
        return np.array(X), np.array(y)

    X_train, y_train = create_dataset(train_data, time_step)

    # 6. Build and train an LSTM model for multivariate output
    model = Sequential()
    model.add(LSTM(50, return_sequences=True, input_shape=(time_step, len(features))))
    model.add(LSTM(50))
    model.add(Dense(len(features)))
    model.compile(loss='mean_squared_error', optimizer='adam')
    model.fit(X_train, y_train, epochs=50, batch_size=32, validation_split=0.1, verbose=0)

    # 7. Recursive multi-step forecasting for 120 steps
    num_steps = 120
    input_seq = train_data[-time_step:]
    predictions = []
    for _ in range(num_steps):
        pred = model.predict(input_seq[np.newaxis, :, :], verbose=0)
        predictions.append(pred[0])
        input_seq = np.concatenate([input_seq[1:], pred], axis=0)
    predictions = np.array(predictions)

    # 8. Inverse transform predictions and actual test data to original scale
    predictions_inv = scaler.inverse_transform(predictions)
    test_data_inv = scaler.inverse_transform(test_data)

    # 10. Anomaly detection:
    # Get ambient temperature and set dynamic threshold for Temperature anomaly.
    ambient_temp = get_ambient_temperature()
    if ambient_temp >= 30 or ambient_temp <= 10:
        dynamic_threshold_temp = 5.0
    else:
        dynamic_threshold_temp = 2.0

    # Define fixed thresholds for other features
    thresholds = {
        'Pressure': 5.0,
        'Flow_rate': 5.0,
        'Water_quality': 5.0,
        'Temperature': dynamic_threshold_temp
    }

    # Compare over overlapping region
    n_compare = min(test_data_inv.shape[0], predictions_inv.shape[0])
    pressure_flags = np.abs(test_data_inv[:n_compare, 0] - predictions_inv[:n_compare, 0]) > thresholds['Pressure']
    flow_flags     = np.abs(test_data_inv[:n_compare, 1] - predictions_inv[:n_compare, 1]) > thresholds['Flow_rate']
    wq_flags       = np.abs(test_data_inv[:n_compare, 2] - predictions_inv[:n_compare, 2]) > thresholds['Water_quality']
    temp_flags     = np.abs(test_data_inv[:n_compare, 3] - predictions_inv[:n_compare, 3]) > thresholds['Temperature']

    # Combine Pressure and Flow anomalies for Leakage detection
    leakage_flags = pressure_flags & flow_flags

    # 11. Calculate anomaly percentages for each
    leakage_percent = np.mean(leakage_flags) * 100
    wq_percent = np.mean(wq_flags) * 100
    temp_percent = np.mean(temp_flags) * 100

    # 12. Final output message (only return the required output)
    output = (
        f"Ambient Temperature (from API): {ambient_temp} °C\n"
        f"Dynamic Temperature Anomaly Threshold: {dynamic_threshold_temp} °C\n\n"
        "Anomaly Summary:\n"
        f"Leakage (Pressure & Flow): {leakage_percent:.2f}% of readings flagged as potential leakage\n"
        f"Water Quality Drop: {wq_percent:.2f}% of readings flagged\n"
        f"Temperature Anomaly (with ambient adjustment): {temp_percent:.2f}% of readings flagged"
    )

    return Response(output, status=200, mimetype='text/plain')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
