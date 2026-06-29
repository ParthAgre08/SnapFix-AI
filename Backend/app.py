from flask import Flask, request, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth
from sentence_transformers import SentenceTransformer
from geopy.distance import geodesic
import numpy as np
import datetime
import os
from database import get_connection
from services.yolo_service import analyze_image_with_yolo

app = Flask(__name__)
CORS(app)

# Initialize Firebase Admin (Only for Auth/Token Verification)
cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'serviceAccountKey.json')
if os.path.exists(cred_path):
    cred = credentials.Certificate(cred_path)
    if not firebase_admin._apps:
        firebase_admin.initialize_app(cred)
    print("Firebase Admin initialized successfully.")
else:
    print(f"Warning: Firebase credentials not found at {cred_path}. Token verification may fail.")

# Load the SentenceTransformer model
print("Loading SentenceTransformer model...")
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Model loaded successfully.")
except Exception as e:
    print(f"Warning: Failed to load model: {e}")
    model = None

def compute_cosine_similarity(vec1, vec2):
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

@app.route('/analyze-image', methods=['POST'])
def analyze_image():
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image provided"}), 400
        
    image_file = request.files['image']
    
    # Save the image locally to uploads/
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
        
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    original_name = image_file.filename
    ext = os.path.splitext(original_name)[1]
    if not ext:
        ext = '.jpg'
    random_hex = os.urandom(3).hex()
    filename = f"analyze_{timestamp_str}_{random_hex}{ext}"
    filepath = os.path.join(uploads_dir, filename)
    
    try:
        image_file.save(filepath)
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to save image: {str(e)}"}), 500
        
    # Run YOLO detection
    result = analyze_image_with_yolo(filepath)
    
    return jsonify(result)

@app.route('/sync-user', methods=['POST'])
def sync_user():
    """
    Synchronizes the Firebase user with the MySQL users table.
    Matches by email. Updates profile information if user exists.
    """
    data = request.json
    uid = data.get('uid')
    email = data.get('email')
    name = data.get('name')
    photo_url = data.get('photoURL')

    if not uid:
        return jsonify({"success": False, "message": "Firebase UID is required"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Check if user exists by firebase_uid
        cursor.execute("SELECT id FROM users WHERE firebase_uid = %s", (uid,))
        user = cursor.fetchone()
        
        if user:
            # Update user profile
            cursor.execute("""  
                UPDATE users 
                SET full_name = %s, profile_image = %s, email = %s
                WHERE firebase_uid = %s
            """, (name, photo_url, email, uid))
            user_id = user['id']
        else:
            # Insert new user
            cursor.execute("""
                INSERT INTO users (firebase_uid, full_name, email, profile_image, role)
                VALUES (%s, %s, %s, %s, 'user')
            """, (uid, name, email, photo_url))
            user_id = cursor.lastrowid
            
        conn.commit()       
        
        return jsonify({"success": True, "userId": user_id})
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/profile/stats', methods=['GET'])
def profile_stats():
    uid = request.args.get('uid')
    if not uid and request.is_json:
        uid = request.json.get('uid')

    if not uid:
        return jsonify({"success": False, "message": "Firebase UID is required"}), 400

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute("SELECT id FROM users WHERE firebase_uid = %s", (uid,))
        user = cursor.fetchone()

        if not user:
            return jsonify({"success": False, "message": "User not found"}), 200

        user_id = user['id']
        cursor.execute("""
            SELECT
                COUNT(*) AS reported,
                SUM(CASE WHEN status IN ('Pending', 'Under Review', 'Assigned', 'In Progress') THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved
            FROM reports
            WHERE user_id = %s
        """, (user_id,))
        stats = cursor.fetchone()

        return jsonify({
            "success": True,
            "reported": int(stats['reported'] or 0),
            "pending": int(stats['pending'] or 0),
            "resolved": int(stats['resolved'] or 0)
        })
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/check-duplicate', methods=['POST'])
def check_duplicate():
    data = request.json
    
    if not data or 'latitude' not in data or 'longitude' not in data or 'description' not in data:
        return jsonify({"success": False, "message": "Missing required fields"}), 400
        
    try:
        lat = float(data['latitude'])
        lon = float(data['longitude'])
    except ValueError:
        return jsonify({"success": False, "message": "Invalid latitude or longitude"}), 400
        
    description = data['description']
    
    if model:
        embedding = model.encode(description).tolist()
    else:
        embedding = []
        
    is_duplicate = False
    duplicate_issue_id = None
    existing_status = None
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT id, latitude, longitude, description, status FROM reports WHERE status IN ('Pending', 'Under Review', 'Assigned', 'In Progress')")
        recent_issues = cursor.fetchall()
        
        for issue in recent_issues:
            issue_lat = issue.get('latitude')
            issue_lon = issue.get('longitude')
            issue_desc = issue.get('description')
            
            if issue_lat is None or issue_lon is None or not issue_desc:
                continue
                
            distance = geodesic((lat, lon), (issue_lat, issue_lon)).meters
            
            if distance <= 100 and model:
                issue_embedding = model.encode(issue_desc).tolist()
                similarity = compute_cosine_similarity(embedding, issue_embedding)
                if similarity > 0.85:
                    is_duplicate = True
                    duplicate_issue_id = issue.get('id')
                    existing_status = issue.get('status')
                    break
                    
        return jsonify({
            "success": True,
            "isDuplicate": is_duplicate,
            "duplicateIssueId": duplicate_issue_id,
            "existingStatus": existing_status
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()


@app.route('/submit-issue', methods=['POST'])
def submit_issue():
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image provided"}), 400
        
    image_file = request.files['image']
    data = request.form
    
    # Required fields
    required_fields = ['title', 'description', 'latitude', 'longitude', 'address', 'userId', 'userEmail', 'issueType', 'severity']
    for field in required_fields:
        if field not in data:
            return jsonify({"success": False, "message": f"Missing field: {field}"}), 400
            
    try:
        lat = float(data['latitude'])
        lon = float(data['longitude'])
    except ValueError:
        return jsonify({"success": False, "message": "Invalid latitude or longitude"}), 400
        
    description = data['description']
    
    # Save the image locally
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
        
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    original_name = image_file.filename
    ext = os.path.splitext(original_name)[1]
    if not ext:
        ext = '.jpg'
    random_hex = os.urandom(3).hex()
    filename = f"{timestamp_str}_{random_hex}{ext}"
    filepath = os.path.join(uploads_dir, filename)
    image_file.save(filepath)
    
    local_image_path = f"uploads/{filename}"
    
    # Generate embedding for the description
    if model:
        embedding = model.encode(description).tolist()
    else:
        embedding = []
        
    is_duplicate = False
    duplicate_issue_id = None
    similarity_score = 0.0
    
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Frontend should now send the MySQL user id directly
        internal_user_id = int(data['userId'])
            
        # Check for duplicates by fetching recent/unresolved issues
        cursor.execute("SELECT id, latitude, longitude, description FROM reports WHERE status IN ('Pending', 'Under Review', 'Assigned', 'In Progress')")
        recent_issues = cursor.fetchall()
        
        for issue in recent_issues:
            issue_lat = issue.get('latitude')
            issue_lon = issue.get('longitude')
            issue_desc = issue.get('description')
            
            if issue_lat is None or issue_lon is None or not issue_desc:
                continue
                
            distance = geodesic((lat, lon), (issue_lat, issue_lon)).meters
            
            if distance <= 100 and model:
                # Dynamically compute embedding for existing issue description
                issue_embedding = model.encode(issue_desc).tolist()
                similarity = compute_cosine_similarity(embedding, issue_embedding)
                if similarity > 0.85:
                    is_duplicate = True
                    duplicate_issue_id = issue.get('id')
                    similarity_score = float(similarity)
                    break
        
        status_val = 'Duplicate' if is_duplicate else 'Pending'
        ai_confidence_val = data.get('confidence', 96) # Default to 96 if not provided
        
        # Insert report
        cursor.execute("""
            INSERT INTO reports (user_id, title, description, category, address, latitude, longitude, image_path, status, ai_confidence, duplicate_report_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            internal_user_id, data['title'], description, data['issueType'], 
            data['address'], lat, lon, local_image_path, status_val, 
            ai_confidence_val, duplicate_issue_id
        ))
        issue_id = cursor.lastrowid
        
        # Insert report image
        cursor.execute("""
            INSERT INTO report_images (report_id, image_path)
            VALUES (%s, %s)
        """, (issue_id, local_image_path))
        
        # Insert status history
        remarks = 'Found duplicate during submission' if is_duplicate else 'Initial submission'
        cursor.execute("""
            INSERT INTO report_status_history (report_id, status, remarks, updated_by)
            VALUES (%s, %s, %s, %s)
        """, (issue_id, status_val, remarks, internal_user_id))
        
        if is_duplicate:
            # Insert duplicate check
            cursor.execute("""
                INSERT INTO duplicate_checks (report_id, matched_report_id, similarity_score, ai_message)
                VALUES (%s, %s, %s, %s)
            """, (issue_id, duplicate_issue_id, similarity_score, "Detected as a duplicate based on location and description"))
            
            conn.commit()
            return jsonify({
                "success": True,
                "isDuplicate": True,
                "issueId": issue_id,
                "message": "This issue has already been reported. Your report has been linked to the existing issue."
            })
        else:
            conn.commit()
            return jsonify({
                "success": True,
                "isDuplicate": False,
                "issueId": issue_id,
                "message": "Issue reported successfully."
            })
            
    except Exception as e:
        conn.rollback()
        return jsonify({"success": False, "message": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, port=5000)
