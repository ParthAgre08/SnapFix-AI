from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth
from sentence_transformers import SentenceTransformer
import datetime
import os
import json

from services.yolo_service import analyze_image_with_yolo
from services import database_service
from services import report_service

app = Flask(__name__)
CORS(app)

# # Initialize Firebase Admin (Only for Auth/Token Verification)
# cred_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS', 'serviceAccountKey.json')
# if os.path.exists(cred_path):
#     cred = credentials.Certificate(cred_path)
#     if not firebase_admin._apps:
#         firebase_admin.initialize_app(cred)
#     print("Firebase Admin initialized successfully.")
# else:
#     print(f"Warning: Firebase credentials not found at {cred_path}. Token verification may fail.")

# =============================================================================
# Firebase Admin Initialization (Local + Render Compatible)
# =============================================================================

import json

try:
    if not firebase_admin._apps:

        # -----------------------------
        # Option 1 : Render Environment Variable
        # FIREBASE_SERVICE_ACCOUNT contains the full JSON
        # -----------------------------
        firebase_json = os.getenv("FIREBASE_SERVICE_ACCOUNT")

        if firebase_json:
            cred = credentials.Certificate(json.loads(firebase_json))
            firebase_admin.initialize_app(cred)
            print("Firebase Admin initialized from FIREBASE_SERVICE_ACCOUNT.")

        else:
            # -----------------------------
            # Option 2 : Local Development
            # -----------------------------
            cred_path = os.getenv(
                "GOOGLE_APPLICATION_CREDENTIALS",
                "serviceAccountKey.json"
            )

            if os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                print("Firebase Admin initialized from serviceAccountKey.json.")

            else:
                print("Firebase Admin credentials not found. Running without Firebase Admin.")

except Exception as e:
    print(f"Firebase initialization failed: {e}")

# Load the SentenceTransformer model for similarity matching
print("Loading SentenceTransformer model...")
try:
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("Model loaded successfully.")
except Exception as e:
    print(f"Warning: Failed to load SentenceTransformer model: {e}")
    model = None

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
        
    # Run YOLO detection service
    result = analyze_image_with_yolo(filepath)
    
    return jsonify(result)

@app.route('/sync-user', methods=['POST'])
def sync_user():
    """
    Synchronizes the Firebase user with the MySQL users table via database_service.
    """
    data = request.json
    uid = data.get('uid')
    email = data.get('email')
    name = data.get('name')
    photo_url = data.get('photoURL')

    if not uid:
        return jsonify({"success": False, "message": "Firebase UID is required"}), 400

    try:
        user_id = database_service.sync_user(uid, email, name, photo_url)
        return jsonify({"success": True, "userId": user_id})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/profile/stats', methods=['GET'])
def profile_stats():
    """
    Retrieves statistics (reported, pending, resolved counts) via database_service.
    """
    uid = request.args.get('uid')
    if not uid and request.is_json:
        uid = request.json.get('uid')

    if not uid:
        return jsonify({"success": False, "message": "Firebase UID is required"}), 400

    try:
        stats = database_service.get_profile_stats(uid)
        if stats is None:
            return jsonify({"success": False, "message": "User not found"}), 200

        return jsonify({
            "success": True,
            "reported": stats["reported"],
            "pending": stats["pending"],
            "resolved": stats["resolved"]
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/check-duplicate', methods=['POST'])
def check_duplicate():
    """
    Checks if a similar unresolved report is nearby using database_service.
    """
    data = request.json
    
    if not data or 'latitude' not in data or 'longitude' not in data or 'description' not in data:
        return jsonify({"success": False, "message": "Missing required fields"}), 400
        
    try:
        lat = float(data['latitude'])
        lon = float(data['longitude'])
    except ValueError:
        return jsonify({"success": False, "message": "Invalid latitude or longitude"}), 400
        
    description = data['description']
    
    try:
        is_duplicate, duplicate_id, status = database_service.check_duplicate_for_endpoint(
            lat=lat,
            lon=lon,
            description=description,
            similarity_model=model
        )
        return jsonify({
            "success": True,
            "isDuplicate": is_duplicate,
            "duplicateIssueId": duplicate_id,
            "existingStatus": status
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/submit-issue', methods=['POST'])
def submit_issue():
    """
    Registers a complete report. It saves the uploaded image, coordinates
    report generation with Grok, runs checks, commits transactions, and returns
    the saved database record to the client.
    """
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image provided"}), 400
        
    image_file = request.files['image']
    data = request.form
    
    # Required parameters check
    required_fields = ['latitude', 'longitude', 'userId', 'issueType']
    for field in required_fields:
        if field not in data:
            return jsonify({"success": False, "message": f"Missing field: {field}"}), 400
            
    # Save the original image locally to uploads/
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
    
    try:
        image_file.save(filepath)
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to save image: {str(e)}"}), 500
        
    local_image_path = f"uploads/{filename}"
    
    # Parse coordinates & identifiers
    lat = data.get('latitude')
    lon = data.get('longitude')
    address = data.get('address', '')
    user_id = data.get('userId')
    
    # Extract optional user description notes
    user_desc = data.get('additionalNotes', '')
    if not user_desc and data.get('description'):
        # Fallback to description field if additionalNotes is empty
        user_desc = data.get('description')

    # YOLO outputs passed by frontend
    issue_type = data.get('issueType')
    confidence = data.get('confidence') or data.get('ai_confidence') or 96
    detection_count = data.get('detectionCount') or 1
    
    # Parse bounding boxes
    detections_raw = data.get('detections')
    bounding_boxes = []
    if detections_raw:
        try:
            bounding_boxes = json.loads(detections_raw)
        except Exception:
            bounding_boxes = []
            
    # Parse annotated prediction image
    annotated_image = data.get('annotatedImage')
    if not annotated_image:
        # Generate prediction path matching uploads/annotated/{filename}_ai.jpg
        base_name, file_ext = os.path.splitext(filename)
        annotated_image = f"uploads/annotated/{base_name}_ai{file_ext}"
        
        # If the file does not exist, copy original image as fallback
        full_annotated_path = os.path.join(os.path.dirname(__file__), annotated_image)
        if not os.path.exists(full_annotated_path):
            os.makedirs(os.path.dirname(full_annotated_path), exist_ok=True)
            try:
                import shutil
                shutil.copy2(filepath, full_annotated_path)
            except Exception as e:
                print(f"Warning: Could not copy fallback annotated image: {e}")
                annotated_image = local_image_path

    # Parse estimated size
    estimated_size = data.get('estimatedSize')
    if not estimated_size:
        estimated_size = "Medium"
        if bounding_boxes and len(bounding_boxes) > 0:
            estimated_size = bounding_boxes[0].get("size", "Medium")

    # Parse road damage percentage
    road_damage_percentage = data.get('roadDamagePercentage') or data.get('road_damage_percentage')
    if not road_damage_percentage:
        if bounding_boxes and len(bounding_boxes) > 0:
            first_bbox = bounding_boxes[0]
            if isinstance(first_bbox, dict) and "road_damage_percentage" in first_bbox:
                road_damage_percentage = first_bbox["road_damage_percentage"]
            elif isinstance(first_bbox, dict) and "bbox" in first_bbox:
                # Calculate it from bbox
                bbox = first_bbox["bbox"]
                if len(bbox) == 4:
                    x1, y1, x2, y2 = bbox
                    box_area = (x2 - x1) * (y2 - y1)
                    # We can assume a standard 375x375 image for ratio calculation
                    ratio = box_area / 140625
                    pct = max(1, round(ratio * 100))
                    road_damage_percentage = f"{pct}%"
        if not road_damage_percentage:
            road_damage_percentage = "18%"

    try:
        # Delegate report generation and database transactions to the report_service
        result = report_service.create_report(
            user_id=user_id,
            image_path=local_image_path,
            annotated_image=annotated_image,
            latitude=lat,
            longitude=lon,
            address=address,
            issue_type=issue_type,
            confidence=confidence,
            detection_count=detection_count,
            bounding_boxes=bounding_boxes,
            estimated_size=estimated_size,
            road_damage_percentage=road_damage_percentage,
            user_description=user_desc,
            similarity_model=model
        )
        return jsonify(result)
    except Exception as e:
        print(f"Error handling submit-issue request: {e}")
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/uploads/<path:filename>')
def serve_uploads(filename):
    """
    Serves files from the Backend/uploads folder.
    """
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    return send_from_directory(uploads_dir, filename)

@app.route('/api/officer/login', methods=['POST'])
def officer_login():
    data = request.json
    if not data or 'email' not in data or 'password' not in data:
        return jsonify({"success": False, "message": "Missing email or password"}), 400
        
    email = data['email']
    password = data['password']
    
    try:
        officer = database_service.officer_login(email, password)
        if officer:
            return jsonify({"success": True, "officer": officer})
        return jsonify({"success": False, "message": "Invalid email or password"}), 401
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/officer/dashboard', methods=['GET'])
def officer_dashboard_consolidated():
    try:
        data = database_service.get_dashboard_data()
        return jsonify({"success": True, **data})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/officer/analytics', methods=['GET'])
def officer_analytics():
    try:
        data = database_service.get_analytics_data()
        return jsonify({"success": True, **data})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/officer/reports', methods=['GET'])
def officer_reports():
    page = request.args.get('page', default=1, type=int)
    limit = request.args.get('limit', default=20, type=int)
    status = request.args.get('status')
    priority = request.args.get('priority')
    department_id = request.args.get('department_id', type=int)
    
    # Support department name mapping as query param if string provided
    dept_name = request.args.get('department')
    if dept_name and not department_id:
        if 'road' in dept_name.lower():
            department_id = 1
        elif 'sanit' in dept_name.lower():
            department_id = 2
        elif 'elec' in dept_name.lower():
            department_id = 3
        elif 'water' in dept_name.lower():
            department_id = 4
            
    search = request.args.get('search')
    try:
        data = database_service.get_paginated_reports(
            page=page,
            limit=limit,
            status=status,
            priority=priority,
            department_id=department_id,
            search=search
        )
        return jsonify({"success": True, **data})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/officer/reports/<int:report_id>', methods=['GET'])
@app.route('/api/officer/report/<int:report_id>', methods=['GET'])
def officer_report_details(report_id):
    try:
        report = database_service.get_report_details_for_officer(report_id)
        if report:
            return jsonify({"success": True, "report": report})
        return jsonify({"success": False, "message": "Report not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/officer/profile', methods=['GET'])
def officer_profile_details():
    officer_id = request.args.get('officer_id', type=int)
    if not officer_id:
        return jsonify({"success": False, "message": "Officer ID is required"}), 400
    try:
        profile = database_service.get_officer_profile(officer_id)
        if profile:
            return jsonify({"success": True, "profile": profile})
        return jsonify({"success": False, "message": "Officer not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/officer/notifications', methods=['GET'])
def officer_notifications():
    try:
        data = database_service.get_notifications()
        return jsonify({"success": True, **data})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/officer/notifications/read', methods=['POST'])
def officer_notifications_read():
    try:
        success = database_service.mark_notifications_as_read()
        return jsonify({"success": success})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/officer/take-issue', methods=['POST'])
def officer_take_issue():
    data = request.json
    if not data or 'reportId' not in data or 'officerId' not in data:
        return jsonify({"success": False, "message": "Missing reportId or officerId"}), 400
        
    report_id = int(data['reportId'])
    officer_id = int(data['officerId'])
    remarks = data.get('remarks', 'Officer accepted the issue and initiated resolution workflow.')
    
    try:
        database_service.assign_report_to_officer(report_id, officer_id, remarks)
        return jsonify({"success": True, "message": "Report successfully assigned. Status updated to In Progress."})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/officer/upload-resolution', methods=['POST'])
def officer_upload_resolution():
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No resolution image provided"}), 400
        
    image_file = request.files['image']
    
    # Save the resolution image locally to uploads/resolutions/
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'resolutions')
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir)
        
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    ext = os.path.splitext(image_file.filename)[1] or '.jpg'
    random_hex = os.urandom(3).hex()
    filename = f"res_{timestamp_str}_{random_hex}{ext}"
    filepath = os.path.join(uploads_dir, filename)
    
    try:
        image_file.save(filepath)
        resolution_image_path = f"uploads/resolutions/{filename}"
        return jsonify({"success": True, "imagePath": resolution_image_path})
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to save image: {str(e)}"}), 500

@app.route('/api/officer/resolve-issue', methods=['POST'])
def officer_resolve_issue():
    data = request.json
    if not data or 'reportId' not in data or 'officerId' not in data or 'resolutionImage' not in data:
        return jsonify({"success": False, "message": "Missing required fields"}), 400
        
    report_id = int(data['reportId'])
    officer_id = int(data['officerId'])
    resolution_image = data['resolutionImage']
    notes = data.get('notes', 'Issue resolved.')
    
    try:
        # Fetch report details to get category and location for Gemini prompt
        report = database_service.get_report_details_for_officer(report_id)
        if not report:
            return jsonify({"success": False, "message": "Report not found"}), 404
            
        category = report.get('category') or report.get('issue_type') or 'Pothole'
        location = report.get('address') or report.get('location') or 'Pune'
        
        # Get officer's department for Gemini prompt
        officer_dept = "Municipal Corporation"
        if report.get('assigned_officer'):
            officer_dept = report['assigned_officer'].get('department', 'Municipal Corporation')
        elif 'department' in data:
            officer_dept = data['department']
            
        # Call Gemini service to generate summary
        from services import gemini_service
        print(f"Generating resolution summary for report {report_id}...")
        resolution_summary = gemini_service.generate_resolution_summary(
            category=category,
            location=location,
            officer_notes=notes,
            department=officer_dept
        )
        
        # Resolve the issue in database
        database_service.resolve_report(
            report_id=report_id,
            officer_id=officer_id,
            notes=notes,
            resolution_image=resolution_image,
            resolution_summary=resolution_summary
        )
        
        return jsonify({
            "success": True,
            "message": "Issue successfully marked as Resolved.",
            "resolutionSummary": resolution_summary
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

@app.route('/api/officer/generate-summary', methods=['POST'])
def officer_generate_summary():
    data = request.json
    if not data or 'reportId' not in data:
        return jsonify({"success": False, "message": "Missing reportId"}), 400
        
    report_id = int(data['reportId'])
    
    try:
        report = database_service.get_report_details_for_officer(report_id)
        if not report:
            return jsonify({"success": False, "message": "Report not found"}), 404
            
        category = report.get('category') or report.get('issue_type') or 'Pothole'
        location = report.get('address') or report.get('location') or 'Pune'
        notes = "No notes available."
        
        # Look for notes in assignment history
        if report.get('assignments_history'):
            for assign in report['assignments_history']:
                if assign.get('status') == 'Resolved' or assign.get('completed_at'):
                    notes = assign.get('officer_notes', 'Resolved.')
                    break
        
        officer_dept = "Municipal Corporation"
        if report.get('assigned_officer'):
            officer_dept = report['assigned_officer'].get('department', 'Municipal Corporation')
            
        from services import gemini_service
        resolution_summary = gemini_service.generate_resolution_summary(
            category=category,
            location=location,
            officer_notes=notes,
            department=officer_dept
        )
        
        # Save to database
        database_service.save_manual_resolution_summary(report_id, resolution_summary)
        
        return jsonify({
            "success": True,
            "resolutionSummary": resolution_summary
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

# =============================================================================
# COMMUNITY FEED ROUTES
# =============================================================================

@app.route('/api/community/stats', methods=['GET'])
def community_stats():
    """Returns live civic impact statistics for the Community Feed hero banner."""
    try:
        stats = database_service.get_community_stats()
        return jsonify({"success": True, "stats": stats})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/community/feed', methods=['GET'])
def community_feed():
    """
    Returns paginated community posts.
    Supports: page, limit, status, category, sort, search, userId
    """
    page = request.args.get('page', default=1, type=int)
    limit = request.args.get('limit', default=8, type=int)
    status = request.args.get('status')
    category = request.args.get('category')
    sort = request.args.get('sort', default='Newest')
    search = request.args.get('search')
    user_id = request.args.get('userId', type=int)

    try:
        data = database_service.get_community_feed(
            page=page,
            limit=limit,
            status=status,
            category=category,
            sort=sort,
            search=search,
            user_id=user_id
        )
        return jsonify({"success": True, **data})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/community/post/<int:post_id>', methods=['GET'])
def community_post_detail(post_id):
    """
    Returns full post detail including comments and workflow timeline.
    Supports: userId query param to check has_liked.
    """
    user_id = request.args.get('userId', type=int)
    try:
        post = database_service.get_community_post_detail(post_id, user_id=user_id)
        if post:
            return jsonify({"success": True, "post": post})
        return jsonify({"success": False, "message": "Post not found"}), 404
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/community/contributors/<int:post_id>', methods=['GET'])
def community_contributors(post_id):
    """Returns ordered list of contributors for a community post."""
    try:
        contributors = database_service.get_community_contributors(post_id)
        return jsonify({"success": True, "contributors": contributors})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/community/like', methods=['POST'])
def community_like():
    """
    Toggles like on a community post.
    Body: { postId, userId }
    """
    data = request.json
    if not data or 'postId' not in data or 'userId' not in data:
        return jsonify({"success": False, "message": "Missing postId or userId"}), 400

    post_id = int(data['postId'])
    user_id = int(data['userId'])

    try:
        liked, likes_count = database_service.toggle_community_like(post_id, user_id)
        return jsonify({"success": True, "liked": liked, "likesCount": likes_count})
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/api/community/comment', methods=['POST'])
def community_comment():
    """
    Adds a comment to a community post.
    Body: { postId, userId, comment }
    """
    data = request.json
    if not data or 'postId' not in data or 'userId' not in data or 'comment' not in data:
        return jsonify({"success": False, "message": "Missing required fields"}), 400

    post_id = int(data['postId'])
    user_id = int(data['userId'])
    comment_text = data['comment'].strip()

    if not comment_text:
        return jsonify({"success": False, "message": "Comment cannot be empty"}), 400

    try:
        comment = database_service.add_community_comment(post_id, user_id, comment_text)
        if comment:
            return jsonify({"success": True, "comment": comment})
        return jsonify({"success": False, "message": "Failed to add comment"}), 500
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)


