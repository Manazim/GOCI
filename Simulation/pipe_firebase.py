import tkinter as tk
from PIL import Image, ImageTk
import random
import threading
import pyrebase  # Install with pip install pyrebase4
import time
from pymongo import MongoClient
from pymongo.server_api import ServerApi

# Firebase configuration – replace these with your actual credentials
firebaseConfig = {
    "apiKey": "#######################################",
    "authDomain": "",
    "databaseURL": "",
    "storageBucket": "",
}

# Initialize Firebase
firebase = pyrebase.initialize_app(firebaseConfig)
db = firebase.database()

# MongoDB configuration
mongo_uri = ""
client = MongoClient(mongo_uri, server_api=ServerApi('1'))
db_collection = client.GOCI.sensors

try:
    client.admin.command('ping')
    print("Connected to MongoDB successfully!")
except Exception as e:
    print(f"MongoDB connection error: {e}")

def update_firebase(data):
    try:
        db.child("sensor_data").set(data)
    except Exception as e:
        print("Firebase update error:", e)

def store_mongo(data):
    try:
        db_collection.insert_one(data)
        print("Data sent to MongoDB:", data)
    except Exception as e:
        print("MongoDB insert error:", e)

class WaterSystemSimulation:
    def __init__(self, master):
        self.master = master
        master.title("Water Supply System Simulation")

        # Sensor variables
        self.pressure = 100    # arbitrary starting pressure value
        self.flow_rate = 50    # arbitrary starting flow rate
        self.water_quality = 100  # quality index (100 means ideal)
        self.temperature = 20  # in Celsius

        # Create main frame with two columns: left (canvas) and right (readings & buttons)
        self.main_frame = tk.Frame(master)
        self.main_frame.pack(fill=tk.BOTH, expand=True)

        # Left: Canvas for simulation
        self.canvas = tk.Canvas(self.main_frame, width=500, height=300, bg="lightblue")
        self.canvas.grid(row=0, column=0, rowspan=4, padx=10, pady=10)

        # Load the real image for the horizontal pipe
        self.load_images()

        # Draw the system on the canvas using the image
        self.draw_system()

        # Right: Sensor readings at the top right
        self.readings_frame = tk.Frame(self.main_frame)
        self.readings_frame.grid(row=0, column=1, sticky="n", padx=10, pady=10)

        self.pressure_label = tk.Label(self.readings_frame, text=f"Water Pressure: {self.pressure:.1f}")
        self.pressure_label.pack(anchor="e")
        self.flow_label = tk.Label(self.readings_frame, text=f"Flow Rate: {self.flow_rate:.1f}")
        self.flow_label.pack(anchor="e")
        self.quality_label = tk.Label(self.readings_frame, text=f"Water Quality: {self.water_quality:.1f}")
        self.quality_label.pack(anchor="e")
        self.temp_label = tk.Label(self.readings_frame, text=f"Temperature: {self.temperature:.1f}°C")
        self.temp_label.pack(anchor="e")

        # Right: Buttons for individual actions
        self.buttons_frame = tk.Frame(self.main_frame)
        self.buttons_frame.grid(row=1, column=1, sticky="n", padx=10, pady=10)

        self.leak_button = tk.Button(self.buttons_frame, text="Simulate Pipe Leak", command=self.simulate_leak)
        self.leak_button.pack(fill=tk.X, pady=5)

        self.quality_button = tk.Button(self.buttons_frame, text="Drop Water Quality", command=self.drop_quality)
        self.quality_button.pack(fill=tk.X, pady=5)

        self.temp_button = tk.Button(self.buttons_frame, text="Adjust Temperature", command=self.adjust_temperature)
        self.temp_button.pack(fill=tk.X, pady=5)

        # Start the simulation update loop
        self.update_simulation()

    def load_images(self):
        """
        Load the image to be used for the horizontal pipe.
        Ensure 'pip.png' is in your working directory or provide the correct path.
        """
        pipe_img = Image.open("pip.png")
        # Resize to 400x50 pixels using LANCZOS resampling (replacing deprecated ANTIALIAS)
        pipe_img = pipe_img.resize((400, 50), Image.LANCZOS)
        self.pipe_image = ImageTk.PhotoImage(pipe_img)

    def draw_system(self):
        # Use the real image for the horizontal pipe
        self.canvas.create_image(250, 150, image=self.pipe_image)
        
        # Draw branch pipes using simple lines
        self.canvas.create_line(200, 150, 200, 50, width=6, fill="blue")   # Upper branch
        self.canvas.create_line(350, 150, 350, 250, width=6, fill="blue")  # Lower branch

        # Create a leak indicator that can change color (default green)
        self.leak_indicator = self.canvas.create_oval(240-10, 150-10, 240+10, 150+10, fill="green")

    def update_simulation(self):
        # Normal random variations in sensor readings
        self.pressure += random.uniform(-0.5, 0.5)
        self.flow_rate += random.uniform(-0.3, 0.3)
        self.water_quality += random.uniform(-0.2, 0.2)
        self.temperature += random.uniform(-0.2, 0.2)

        # Ensure the values remain within realistic ranges
        self.pressure = max(0, min(120, self.pressure))
        self.flow_rate = max(0, min(100, self.flow_rate))
        self.water_quality = max(0, min(100, self.water_quality))
        self.temperature = max(-10, min(40, self.temperature))

        # Update sensor labels
        self.pressure_label.config(text=f"Water Pressure: {self.pressure:.1f}")
        self.flow_label.config(text=f"Flow Rate: {self.flow_rate:.1f}")
        self.quality_label.config(text=f"Water Quality: {self.water_quality:.1f}")
        self.temp_label.config(text=f"Temperature: {self.temperature:.1f}°C")

        # Change the leak indicator color based on water quality
        if self.water_quality > 80:
            self.canvas.itemconfig(self.leak_indicator, fill="green")
        else:
            self.canvas.itemconfig(self.leak_indicator, fill="red")

        # Create the data dictionary with a timestamp
        data = {
            'Timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            "Pressure": self.pressure,
            "Flow_rate": self.flow_rate,
            "Water_quality": self.water_quality,
            "Temperature": self.temperature
        }

        # Offload Firebase update to a separate thread so it doesn't block the GUI
        threading.Thread(target=update_firebase, args=(data,), daemon=True).start()

        # Offload MongoDB storage to a separate thread so it doesn't block the GUI
        threading.Thread(target=store_mongo, args=(data,), daemon=True).start()

        # Continue updating every 500 ms
        self.master.after(500, self.update_simulation)

    def simulate_leak(self):
        # Simulate a pipe leak: drop water pressure significantly
        self.pressure -= random.uniform(10, 20)
        self.pressure = max(0, self.pressure)
        # Visual change: change leak indicator to red
        self.canvas.itemconfig(self.leak_indicator, fill="red")

    def drop_quality(self):
        # Simulate a drop in water quality (e.g., contamination)
        self.water_quality -= random.uniform(20, 30)
        self.water_quality = max(0, self.water_quality)
        # Visual change: if quality falls, indicator turns red
        self.canvas.itemconfig(self.leak_indicator, fill="red")

    def adjust_temperature(self):
        # Simulate a temperature adjustment (e.g., due to environmental effects)
        self.temperature -= random.uniform(5, 10)
        self.temperature = max(-10, self.temperature)

if __name__ == "__main__":
    root = tk.Tk()
    sim = WaterSystemSimulation(root)
    root.mainloop()
