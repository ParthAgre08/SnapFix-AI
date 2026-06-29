import os
import json
import base64
import requests
from dotenv import load_dotenv

load_dotenv()

# Configuration variables
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY_RESPONSE")
GEMINI_MODEL = os.getenv("GEMINI_MODEL_RESPONSE", "gemini-2.5-flash")

def encode_image_to_base64(image_path):
    """
    Reads an image file, detects its file format/MIME type, and encodes it to base64.
    """
    try:
        if not os.path.exists(image_path):
            # Try absolute path relative to Backend/ folder
            base_dir = os.path.dirname(os.path.dirname(__file__))
            possible_path = os.path.join(base_dir, image_path)
            if os.path.exists(possible_path):
                image_path = possible_path
            else:
                print(f"Error: Image file not found at {image_path}")
                return None, None
                
        with open(image_path, "rb") as image_file:
            data = base64.b64encode(image_file.read()).decode('utf-8')
            # Detect MIME type
            ext = os.path.splitext(image_path)[1].lower()
            mime_type = "image/jpeg"
            if ext == ".png":
                mime_type = "image/png"
            elif ext == ".webp":
                mime_type = "image/webp"
            elif ext == ".gif":
                mime_type = "image/gif"
            return data, mime_type
    except Exception as e:
        print(f"Error encoding image to base64: {e}")
        return None, None

def clean_json_string(s):
    """
    Strips markdown block codes from the response string to ensure clean parsing.
    """
    s = s.strip()
    if s.startswith("```"):
        lines = s.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines[-1].startswith("```"):
            lines = lines[:-1]
        s = "\n".join(lines).strip()
    return s

def generate_gemini_report(image_path, issue_type, confidence, count, location, 
                           bounding_boxes=None, road_damage_percentage="18%", user_description=None):
    """
    Constructs the prompt, sends the image and prompt to Gemini Vision API, and parses the response.
    Returns:
        dict: The AI generated JSON fields if successful, None otherwise.
    """
    if not GEMINI_API_KEY:
        print("Warning: GEMINI_API_KEY is not defined. Skipping Gemini Vision call.")
        return None

    # Format Bounding Boxes for prompt
    bbox_str = "None"
    if bounding_boxes and len(bounding_boxes) > 0:
        if isinstance(bounding_boxes[0], dict) and "bbox" in bounding_boxes[0]:
            bbox_str = str([round(val) for val in bounding_boxes[0]["bbox"]])
        else:
            bbox_str = str(bounding_boxes[0])

    # Construct the Structured Prompt
    prompt = f"""You are an AI assistant for SnapFix AI.

An AI detection model has already analyzed the uploaded image.

Detection Details

Issue Type:
{issue_type}

Confidence:
{confidence}%

Road Damage Percentage:
{road_damage_percentage if road_damage_percentage else 'Unknown'}

Approximate Bounding Box:
{bbox_str}

Location:
{location}

User Description:
{user_description if user_description else 'None'}

The uploaded image is attached.

Your task is NOT to detect the object.

The object has already been detected.

Instead analyze the scene and generate a municipal report.

Consider

• apparent road condition
• possible risk to pedestrians
• possible risk to vehicles
• surrounding environment
• visible severity
• likely impact on traffic

Return ONLY JSON

{{
"title":"",
"description":"",
"severity":"",
"priority":"",
"recommended_action":"",
"social_caption":"",
"road_damage_percentage":""
}}

Generate the respose in max 300 to 350 words
Never mention bounding box coordinates in the response.
"""
    
    # Get base64 encoded image and MIME type
    base64_image, mime_type = encode_image_to_base64(image_path)
    if not base64_image:
        print("Gemini Service Error: Image encoding failed. Skipping Gemini API call.")
        return None

    # Gemini GenerateContent endpoint
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    headers = {
        "Content-Type": "application/json"
    }

    # Gemini Vision completions payload
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    },
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_image
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2
        }
    }

    try:
        print(f"Calling Gemini Vision API using model: {GEMINI_MODEL}...")
        response = requests.post(url, headers=headers, json=payload, timeout=25)
        response.raise_for_status()
        
        result_json = response.json()
        content = result_json["candidates"][0]["content"]["parts"][0]["text"]
        
        # Clean markdown codeblocks and parse
        cleaned_content = clean_json_string(content)
        gemini_data = json.loads(cleaned_content)
        
        # Ensure all required keys exist
        required_keys = [
            "title", 
            "description", 
            "severity", 
            "priority", 
            "recommended_action", 
            "social_caption", 
            "road_damage_percentage"
        ]
        for key in required_keys:
            if key not in gemini_data:
                gemini_data[key] = ""
                
        # If road_damage_percentage is missing, fallback to passed parameter
        if not gemini_data["road_damage_percentage"] and road_damage_percentage:
            gemini_data["road_damage_percentage"] = road_damage_percentage
        
        # Normalize severity: Low, Medium, High, Critical
        severity_map = {"low": "Low", "medium": "Medium", "high": "High", "critical": "Critical"}
        sev_input = str(gemini_data.get("severity", "Medium")).strip().lower()
        gemini_data["severity"] = severity_map.get(sev_input, "Medium")
        
        # Normalize priority: Low, Medium, High, Urgent
        priority_map = {"low": "Low", "medium": "Medium", "high": "High", "urgent": "Urgent"}
        pri_input = str(gemini_data.get("priority", "Medium")).strip().lower()
        gemini_data["priority"] = priority_map.get(pri_input, "Medium")
        
        # Add the raw response content back as a key
        gemini_data["raw_content"] = content
        
        print("Gemini Vision API call successful.")
        return gemini_data
        
    except Exception as e:
        print(f"Gemini API call failed: {e}")
        if 'response' in locals() and response is not None:
            try:
                print(f"API Error details: {response.text}")
            except:
                pass
        return None
