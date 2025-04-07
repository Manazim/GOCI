import pandas as pd
import numpy as np
from pymongo import MongoClient
from pymongo.server_api import ServerApi
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta
from flask_cors import CORS, cross_origin
from flask import Flask, Response


app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

# --------------------------
# Connect to MongoDB and fetch sensor data
mongo_uri = "#####################################################e"
client = MongoClient(mongo_uri, server_api=ServerApi('1'))

# Fetch sensor data from "sensors" collection
db_sensors = client.GOCI.sensors
sensor_cursor = db_sensors.find({})
sensor_data = list(sensor_cursor)
df = pd.DataFrame(sensor_data)
if '_id' in df.columns:
    df = df.drop(columns=['_id'])
# Convert Timestamp to datetime and sort
df['Timestamp'] = pd.to_datetime(df['Timestamp'], format='%Y-%m-%d %H:%M:%S')
df = df.sort_values('Timestamp')

print("Latest sensor data sample:")
print(df.tail(1000))

# --------------------------
# Fetch the last maintenance timestamp from "lastmaintenances" collection
db_last = client.GOCI.lastmaintenances
maintenance_cursor = db_last.find({}).sort("Timestamp", -1).limit(1)
maintenance_data = list(maintenance_cursor)
if maintenance_data:
    last_maintenance = pd.to_datetime(maintenance_data[0]['Timestamp'], format='%Y-%m-%d %H:%M:%S')
else:
    # If no maintenance record exists, use the earliest sensor data timestamp
    last_maintenance = df['Timestamp'].min()

# --------------------------
# Filter sensor data from the last maintenance date to now
df_filtered = df[df['Timestamp'] >= last_maintenance].copy()

# Compute elapsed hours since last maintenance
df_filtered['Hours'] = (df_filtered['Timestamp'] - last_maintenance).dt.total_seconds() / 3600

# --------------------------
# We will use two features for prediction:
#   - Water_quality: Lower values indicate potential corrosion
#   - Temperature: Extreme values (too high or too low) may trigger maintenance
# Define thresholds (adjust these based on real-life criteria)
wq_threshold = 95           # e.g., if water quality drops below 95, it could be a sign of corrosion
temp_upper_threshold = 22   # upper bound for normal water temperature
temp_lower_threshold = 18   # lower bound for normal water temperature

# --------------------------
# Fit linear regression for water quality trend
X = df_filtered[['Hours']].values  # independent variable: hours since last maintenance
y_wq = df_filtered['Water_quality'].values.reshape(-1, 1)
lr_wq = LinearRegression()
lr_wq.fit(X, y_wq)

# Solve for the time when predicted water quality reaches the threshold
if lr_wq.coef_[0][0] != 0:
    x_wq = (wq_threshold - lr_wq.intercept_[0]) / lr_wq.coef_[0][0]
else:
    x_wq = np.inf

# --------------------------
# Fit linear regression for temperature trend
y_temp = df_filtered['Temperature'].values.reshape(-1, 1)
lr_temp = LinearRegression()
lr_temp.fit(X, y_temp)

# Solve for the time when predicted temperature exceeds upper threshold and when it falls below lower threshold
x_temp_upper = np.inf
x_temp_lower = np.inf
if lr_temp.coef_[0][0] != 0:
    x_temp_upper = (temp_upper_threshold - lr_temp.intercept_[0]) / lr_temp.coef_[0][0]
    x_temp_lower = (temp_lower_threshold - lr_temp.intercept_[0]) / lr_temp.coef_[0][0]

# --------------------------
# Decide on the predicted maintenance time:
# We consider only positive time differences (future predictions).
pred_times = []
recommendations = []

if x_wq > 0:
    pred_times.append(x_wq)
    recommendations.append("Inspection for corrosion due to significant water quality drop.")

if x_temp_upper > 0:
    pred_times.append(x_temp_upper)
    recommendations.append("Maintenance for temperature regulation to prevent pipe break (temperature too high).")

if x_temp_lower > 0:
    pred_times.append(x_temp_lower)
    recommendations.append("Maintenance for temperature regulation to prevent pipe break (temperature too low).")

# Prepare the output message
current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
output_lines = []
output_lines.append(f"Last maintenance timestamp: {last_maintenance.strftime('%Y-%m-%d %H:%M:%S')}")
if len(pred_times) == 0:
    output_lines.append("No maintenance needed based on current trends.")
else:
    pred_hours = min(pred_times)
    predicted_maintenance_date = last_maintenance + timedelta(hours=pred_hours)
    output_lines.append(f"Predicted next maintenance date: {predicted_maintenance_date.strftime('%Y-%m-%d %H:%M:%S')}")
    idx = pred_times.index(pred_hours)
    final_recommendation = recommendations[idx]
    output_lines.append(f"Maintenance Recommendation: {final_recommendation}")
output_lines.append(f"Time (current local time): {current_time}")

output = "\n".join(output_lines)

@app.route('/', methods=['GET'])
def analyze():
    return Response(output, status=200, mimetype='text/plain')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
