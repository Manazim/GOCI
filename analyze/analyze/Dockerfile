FROM python:3.9-slim

WORKDIR /analyze

# Install required Python libraries without using requirements.txt
RUN pip install --no-cache-dir pandas numpy requests pymongo scikit-learn tensorflow matplotlib flask

COPY . .

CMD ["python", "analyze.py"]
