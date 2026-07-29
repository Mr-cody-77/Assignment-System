import os
import requests
import json
import sys

# Try to load .env
try:
    from dotenv import load_dotenv
    load_dotenv(r'c:\Users\HP\OneDrive\Desktop\Assignment_System\Assignment-System\Centralized_Database\.env')
except ImportError:
    pass

api_key = os.environ.get("GEMINI_API_KEY")

if not api_key:
    print("No API Key found")
    sys.exit(1)

prompt = "Test prompt"
payload = {
    "contents": [{"parts": [{"text": prompt}]}],
    "generationConfig": {
        "responseMimeType": "application/json"
    }
}

models = ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-1.0-pro-latest"]

for model in models:
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    resp = requests.post(url, json=payload, headers={"Content-Type": "application/json"}, timeout=10)
    print(f"Model: {model}")
    print(f"Status: {resp.status_code}")
    print(f"Response: {resp.text[:300]}")
    print("-" * 40)
