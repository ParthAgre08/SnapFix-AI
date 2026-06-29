import os
import json
import mysql.connector
from dotenv import load_dotenv

load_dotenv()

def get_connection():
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST"),
        user=os.getenv("MYSQL_USER"),
        password=os.getenv("MYSQL_PASSWORD"),
        database=os.getenv("MYSQL_DATABASE"),
        port=os.getenv("MYSQL_PORT")
    )

def check_duplicate_exists(latitude, longitude, description, model, similarity_threshold=0.85):
    """
    Checks if a similar unresolved issue exists within 100 meters and similarity score > threshold.
    Returns:
        tuple: (is_duplicate, duplicate_issue_id, similarity_score)
    """
    from geopy.distance import geodesic
    import numpy as np

    def compute_cosine_similarity(vec1, vec2):
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

    if not model or not description:
        return False, None, 0.0

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Fetch only unresolved/active reports
        cursor.execute("""
            SELECT id, latitude, longitude, description, user_description 
            FROM reports 
            WHERE status IN ('Pending', 'Under Review', 'Assigned', 'In Progress')
        """)
        recent_issues = cursor.fetchall()
        
        embedding = model.encode(description).tolist()
        
        for issue in recent_issues:
            issue_lat = issue.get('latitude')
            issue_lon = issue.get('longitude')
            # Fallback to description if user_description is not filled
            issue_desc = issue.get('user_description') or issue.get('description')
            
            if issue_lat is None or issue_lon is None or not issue_desc:
                continue
                
            distance = geodesic((latitude, longitude), (issue_lat, issue_lon)).meters
            
            if distance <= 100:
                issue_embedding = model.encode(issue_desc).tolist()
                similarity = compute_cosine_similarity(embedding, issue_embedding)
                if similarity > similarity_threshold:
                    return True, issue['id'], float(similarity)
                    
        return False, None, 0.0
    except Exception as e:
        print(f"Error in check_duplicate_exists: {e}")
        return False, None, 0.0
    finally:
        cursor.close()
        conn.close()

def save_report_transaction(user_id, title, description, category, address, latitude, longitude, 
                            image_path, status, ai_confidence, annotated_image, detection_count, 
                            bounding_boxes, severity, priority, recommended_action, ai_social_caption, 
                            road_damage_percentage, ai_response_json, user_description, 
                            duplicate_report_id=None, similarity_score=0.0):
    """
    Saves the entire report data structure within a database transaction.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        # Print database insertion details to the terminal
        print("\n" + "="*60)
        print(" DATABASE INSERT DETAILS (PERSISTING REPORT):")
        print("="*60)
        print(f"  User ID:             {user_id}")
        print(f"  Title:               {title}")
        print(f"  AI Description:      {description}")
        print(f"  Category:            {category}")
        print(f"  Address:             {address}")
        print(f"  Coordinates:         {latitude}, {longitude}")
        print(f"  Uploaded Image:      {image_path}")
        print(f"  Annotated Image:     {annotated_image}")
        print(f"  Status:              {status}")
        print(f"  AI Confidence:       {ai_confidence}%")
        print(f"  Detection Count:     {detection_count}")
        print(f"  Severity:            {severity}")
        print(f"  Priority:            {priority}")
        print(f"  Recommended Action:  {recommended_action}")
        print(f"  Social Caption:      {ai_social_caption}")
        print(f"  Damage Percentage:   {road_damage_percentage}")
        print(f"  User Description:    {user_description}")
        print(f"  Duplicate Report ID: {duplicate_report_id}")
        print(f"  Similarity Score:    {similarity_score}")
        print(f"  Raw AI Response JSON: {ai_response_json is not None}")
        print("="*60 + "\n")

        conn.start_transaction()
        
        # Serialize json structures
        bbox_json = json.dumps(bounding_boxes) if bounding_boxes else None
        ai_resp_json = json.dumps(ai_response_json) if ai_response_json else None
        
        # Insert report into reports table
        cursor.execute("""
            INSERT INTO reports (
                user_id, title, description, category, address, latitude, longitude, 
                image_path, status, ai_confidence, duplicate_report_id, 
                ai_description, annotated_image, detection_count, bounding_boxes, 
                severity, priority, recommended_action, ai_social_caption, road_damage_percentage, 
                ai_response_json, user_description
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id, title, description, category, address, latitude, longitude,
            image_path, status, ai_confidence, duplicate_report_id,
            description, # ai_description maps to generated report description
            annotated_image, detection_count, bbox_json,
            severity, priority, recommended_action, ai_social_caption, road_damage_percentage,
            ai_resp_json, user_description
        ))
        
        report_id = cursor.lastrowid
        
        # Insert original image into report_images table
        cursor.execute("""
            INSERT INTO report_images (report_id, image_path)
            VALUES (%s, %s)
        """, (report_id, image_path))
        
        # Insert annotated image into report_images table if it exists
        if annotated_image:
            cursor.execute("""
                INSERT INTO report_images (report_id, image_path)
                VALUES (%s, %s)
            """, (report_id, annotated_image))
            
        # Insert status history record
        remarks = 'Found duplicate during submission' if duplicate_report_id else 'Initial submission'
        cursor.execute("""
            INSERT INTO report_status_history (report_id, status, remarks, updated_by)
            VALUES (%s, %s, %s, %s)
        """, (report_id, status, remarks, user_id))
        
        # Insert duplicate check record if duplicate detected
        if duplicate_report_id:
            cursor.execute("""
                INSERT INTO duplicate_checks (report_id, matched_report_id, similarity_score, ai_message)
                VALUES (%s, %s, %s, %s)
            """, (report_id, duplicate_report_id, similarity_score, "Detected as a duplicate based on location and description"))
            
        conn.commit()
        return report_id
    except Exception as e:
        conn.rollback()
        print(f"Error executing database save transaction: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()

def get_report_by_id(report_id):
    """
    Fetches the persisted report record from the database and maps it to the standard API response format.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("SELECT * FROM reports WHERE id = %s", (report_id,))
        row = cursor.fetchone()
        if not row:
            return None
            
        # Parse bounding boxes
        bbox = row.get("bounding_boxes")
        if isinstance(bbox, str):
            try:
                bbox = json.loads(bbox)
            except Exception:
                bbox = []
        elif bbox is None:
            bbox = []
            
        # Format mapping as requested
        report = {
            "report_id": row["id"],
            "issue_type": row["category"],
            "ai_confidence_score": row["ai_confidence"],
            "location": row["address"],
            "user_description": row["user_description"],
            "ai_title": row["title"],
            "ai_description": row["ai_description"],
            "severity": row["severity"],
            "priority": row["priority"],
            "recommended_action": row["recommended_action"],
            "ai_social_caption": row["ai_social_caption"],
            "road_damage_percentage": row["road_damage_percentage"],
            "detection_count": row["detection_count"],
            "bounding_boxes": bbox,
            "annotated_image": row["annotated_image"],
            "uploaded_image": row["image_path"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"])
        }
        return report
    except Exception as e:
        print(f"Error fetching report: {e}")
        return None
    finally:
        cursor.close()
        conn.close()

def sync_user(uid, email, name, photo_url):
    """
    Sync user authentication data with local users table.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users WHERE firebase_uid = %s", (uid,))
        user = cursor.fetchone()
        if user:
            cursor.execute("""  
                UPDATE users 
                SET full_name = %s, profile_image = %s, email = %s
                WHERE firebase_uid = %s
            """, (name, photo_url, email, uid))
            user_id = user['id']
        else:
            cursor.execute("""
                INSERT INTO users (firebase_uid, full_name, email, profile_image, role)
                VALUES (%s, %s, %s, %s, 'user')
            """, (uid, name, email, photo_url))
            user_id = cursor.lastrowid
        conn.commit()
        return user_id
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

def get_profile_stats(uid):
    """
    Retrieve report summary stats for a given user.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id FROM users WHERE firebase_uid = %s", (uid,))
        user = cursor.fetchone()
        if not user:
            return None
            
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
        return {
            "reported": int(stats['reported'] or 0),
            "pending": int(stats['pending'] or 0),
            "resolved": int(stats['resolved'] or 0)
        }
    except Exception as e:
        raise e
    finally:
        cursor.close()
        conn.close()

def check_duplicate_for_endpoint(lat, lon, description, similarity_model):
    """
    Direct duplicate checking logic for the duplicate check controller endpoint.
    """
    from geopy.distance import geodesic
    import numpy as np

    def compute_cosine_similarity(vec1, vec2):
        vec1 = np.array(vec1)
        vec2 = np.array(vec2)
        return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

    if not similarity_model or not description:
        return False, None, None

    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT id, latitude, longitude, description, user_description, status 
            FROM reports 
            WHERE status IN ('Pending', 'Under Review', 'Assigned', 'In Progress')
        """)
        recent_issues = cursor.fetchall()
        
        embedding = similarity_model.encode(description).tolist()
        
        for issue in recent_issues:
            issue_lat = issue.get('latitude')
            issue_lon = issue.get('longitude')
            issue_desc = issue.get('user_description') or issue.get('description')
            
            if issue_lat is None or issue_lon is None or not issue_desc:
                continue
                
            distance = geodesic((lat, lon), (issue_lat, issue_lon)).meters
            
            if distance <= 100:
                issue_embedding = similarity_model.encode(issue_desc).tolist()
                similarity = compute_cosine_similarity(embedding, issue_embedding)
                if similarity > 0.85:
                    return True, issue.get('id'), issue.get('status')
                    
        return False, None, None
    finally:
        cursor.close()
        conn.close()
