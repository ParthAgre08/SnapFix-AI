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

def generate_resolution_summary(category, location, officer_notes, department):
    """
    Generates a professional, concise completion summary using Gemini based on 
    issue details, resolution notes, and the assigned department.
    """
    if not GEMINI_API_KEY:
        print("Warning: GEMINI_API_KEY is not defined. Skipping Gemini summary call.")
        return f"The reported {category.lower()} at {location} was successfully resolved by the PMC {department}. Work details: {officer_notes or 'Repaired and restored'}"
        
    prompt = f"""You are a Pune Municipal Corporation (PMC) Officer assistant.
Your task is to write a professional, formal, and concise summary of a resolved public issue.

This summary will be permanently stored in the municipal archive and shared with citizens.

Issue Details:
- Category: {category}
- Location: {location}
- Officer Notes: {officer_notes if officer_notes else 'Completed required repairs and cleanup.'}
- Department: {department}

Guidelines:
1. Write the summary in a professional, formal third-person perspective (e.g. "The reported pothole on Janta Road was inspected by the PMC Road Department...").
2. State the problem, the department responsible, the action taken, and the current status (e.g., restored for public use).
3. Do not include placeholders, internal codes, or instructions.
4. Keep it concise (max 45 to 60 words).
5. Output ONLY the plain text paragraph summary. Do not wrap in JSON, markdown quotes, or code blocks.
"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    headers = {
        "Content-Type": "application/json"
    }

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2
        }
    }

    try:
        print("Calling Gemini API to generate resolution summary...")
        response = requests.post(url, headers=headers, json=payload, timeout=20)
        response.raise_for_status()
        
        result_json = response.json()
        summary = result_json["candidates"][0]["content"]["parts"][0]["text"].strip()
        
        if summary.startswith("```"):
            summary = clean_json_string(summary)
            
        print("Gemini resolution summary generated successfully.")
        return summary
    except Exception as e:
        print(f"Gemini resolution summary call failed: {e}")
        return f"The reported {category.lower()} at {location} was inspected and resolved by the PMC {department}. Work details: {officer_notes or 'Repaired and restored'}"


def generate_report_post_caption(category, location, department, ai_description=None,
                                  contributor_count=1, confidence=None):
    """
    Generates a professional, citizen-friendly community announcement (120-180 words)
    for a newly submitted report. Stored as report_post_caption.
    """
    if not GEMINI_API_KEY:
        return (
            f"🚧 {category} Alert\n\n"
            f"A {category.lower()} has been reported near {location}.\n\n"
            f"Our AI successfully detected the issue and forwarded the complaint to the "
            f"Pune Municipal Corporation {department}.\n\n"
            f"This issue is now awaiting inspection. If you have noticed the same issue, "
            f"you can support this report.\n\n"
            f"Stay informed. Help improve your city.\n\n"
            f"#SnapFixAI #Pune #{category.replace(' ', '')}"
        )

    conf_text = f"{round(float(confidence))}%" if confidence else "high"
    contrib_text = (
        f"This issue has already been supported by {contributor_count} citizens."
        if contributor_count > 1 else
        "If you have noticed the same issue, you can support this report."
    )

    prompt = f"""You are a civic engagement writer for SnapFix AI, a smart municipal reporting platform in Pune, India.

A citizen has just reported a civic issue and it has been verified by our AI system.

Issue Details:
- Category: {category}
- Location: {location}
- Department: {department}
- AI Detection Confidence: {conf_text}
- AI Summary: {ai_description or 'Not provided'}

Write a professional, citizen-friendly community announcement for the SnapFix AI Community Feed.

Requirements:
1. Start with a one-line impactful header (e.g. "🚧 Road Safety Alert")
2. Briefly describe the issue and its location (1-2 sentences)
3. Mention that SnapFix AI detected it and forwarded to the correct department
4. State it is awaiting inspection
5. Encourage community participation ({contrib_text})
6. End with a positive civic message and 2-3 relevant hashtags
7. Keep total length between 120 and 180 words
8. Professional, positive, citizen-friendly tone
9. No emojis except the optional warning icon in the header

Output ONLY the plain announcement text. No JSON, no markdown quotes, no code blocks."""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4}
    }

    try:
        print(f"Generating community report caption for {category} at {location}...")
        response = requests.post(url, headers={"Content-Type": "application/json"},
                                 json=payload, timeout=20)
        response.raise_for_status()
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        if text.startswith("```"):
            text = clean_json_string(text)
        print("✓ Report post caption generated.")
        return text
    except Exception as e:
        print(f"Report caption generation failed: {e}")
        return (
            f"🚧 {category} Alert\n\n"
            f"A {category.lower()} has been reported near {location}. "
            f"SnapFix AI has automatically detected and forwarded this complaint to the "
            f"Pune Municipal Corporation {department}.\n\n"
            f"This issue is now awaiting inspection.\n\n"
            f"Help build a smarter Pune.\n\n"
            f"#SnapFixAI #Pune #{category.replace(' ', '')}"
        )


def generate_resolution_post_caption(category, location, department, officer_name,
                                      officer_notes=None, contributor_count=1,
                                      resolution_time=None, road_damage_percentage=None,
                                      citizen_description=None):
    """
    Generates a civic success story (150-200 words) for a resolved issue.
    Naturally acknowledges community participation. Stored as resolution_post_caption.
    """
    if not GEMINI_API_KEY:
        contrib_sentence = (
            f"This issue was brought to our attention through the support of {contributor_count} local citizens."
            if contributor_count > 1 else
            "This issue was reported by a diligent citizen."
        )
        return (
            f"{category} Restored Successfully\n\n"
            f"The {category.lower()} reported near {location} has been successfully resolved by "
            f"the Pune Municipal Corporation {department}.\n\n"
            f"{contrib_sentence} Their timely reporting enabled the department to prioritize and "
            f"complete the work efficiently.\n\n"
            f"We sincerely thank all citizens who reported and supported this issue. "
            f"Your participation helps us build a safer and smarter Pune.\n\n"
            f"Together, we are improving our city.\n\n"
            f"#PMC #SnapFixAI #SmartCity #Pune"
        )

    contrib_context = (
        f"{contributor_count} citizens collectively reported this issue, helping the department prioritize it."
        if contributor_count > 1 else
        "A citizen reported this issue promptly, enabling fast action."
    )
    res_time_text = f"Resolution Time: {resolution_time}" if resolution_time else ""
    damage_text = f"Road Damage: {road_damage_percentage}" if road_damage_percentage else ""

    prompt = f"""You are a Pune Municipal Corporation (PMC) communications officer writing a civic success story for the SnapFix AI Community Feed.

An issue has just been successfully resolved. Write a professional, warm, and celebratory public announcement.

Resolution Details:
- Category: {category}
- Location: {location}
- Department: {department}
- Officer: {officer_name}
- Resolution Notes: {officer_notes or 'Issue repaired and restored to normal condition.'}
- Citizen Description: {citizen_description or 'Not provided'}
- Community Participation: {contrib_context}
- {res_time_text}
- {damage_text}

Requirements:
1. Start with a clear success headline (e.g. "Road Restored Successfully")
2. Describe the problem that was fixed and its location
3. Mention the department and officer who resolved it
4. Naturally acknowledge the community: how many citizens helped, and why it mattered
5. Thank citizens for their participation
6. Encourage reporting future issues
7. End with 3-4 relevant hashtags
8. Total length: 150-200 words
9. Warm, celebratory, professional civic tone
10. No emojis

Output ONLY the plain announcement text. No JSON, no markdown, no code blocks."""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0.4}
    }

    try:
        print(f"Generating community resolution caption for {category} at {location}...")
        response = requests.post(url, headers={"Content-Type": "application/json"},
                                 json=payload, timeout=20)
        response.raise_for_status()
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        if text.startswith("```"):
            text = clean_json_string(text)
        print("✓ Resolution post caption generated.")
        return text
    except Exception as e:
        print(f"Resolution caption generation failed: {e}")
        contrib_sentence = (
            f"This issue was brought to our attention through the support of {contributor_count} local citizens."
            if contributor_count > 1 else "A citizen reported this issue."
        )
        return (
            f"{category} Resolved Successfully\n\n"
            f"The {category.lower()} near {location} has been successfully resolved by Officer {officer_name} "
            f"of the PMC {department}.\n\n"
            f"{contrib_sentence} Their participation enabled prompt resolution.\n\n"
            f"Thank you for helping improve Pune.\n\n"
            f"#PMC #SnapFixAI #SmartCity"
        )
