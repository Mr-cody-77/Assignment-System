import os
import requests
import sys

try:
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
    load_dotenv(env_path)
except ImportError:
    pass

api_key = os.environ.get("GEMINI_API_KEY")

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
resp = requests.get(url)
data = resp.json()

if "models" in data:
    for m in data["models"]:
        if "generateContent" in m.get("supportedGenerationMethods", []):
            print(m["name"])
else:
    print(data)
