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
        
        # Determine assigned department by category mapping
        category_lower = (category or "").lower()
        if any(c in category_lower for c in ['pothole', 'road crack', 'road cracks', 'potholes', 'road']):
            dept_name = 'Road Department'
        elif any(c in category_lower for c in ['garbage', 'overflowing dustbins', 'garbage overflow', 'graffiti', 'sanitation']):
            dept_name = 'Sanitation'
        elif any(c in category_lower for c in ['broken street light', 'broken street lights', 'electrical', 'streetlight', 'lamp', 'exposed wire']):
            dept_name = 'Electrical'
        elif any(c in category_lower for c in ['water leakage', 'water leak', 'drainage overflow', 'drainage', 'water']):
            dept_name = 'Water Department'
        else:
            dept_name = 'Road Department'
            
        cursor.execute("SELECT id FROM departments WHERE name = %s", (dept_name,))
        dept_row = cursor.fetchone()
        assigned_dept_id = dept_row[0] if dept_row else 1

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
                ai_response_json, user_description, assigned_department_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id, title, description, category, address, latitude, longitude,
            image_path, status, ai_confidence, duplicate_report_id,
            description, # ai_description maps to generated report description
            annotated_image, detection_count, bbox_json,
            severity, priority, recommended_action, ai_social_caption, road_damage_percentage,
            ai_resp_json, user_description, assigned_dept_id
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
        
        # Insert workflow history record for initial submission
        workflow_remarks = 'Found duplicate during submission' if duplicate_report_id else 'Initial submission via Citizen Portal'
        cursor.execute("""
            INSERT INTO report_workflow (report_id, previous_status, new_status, action, performed_by, remarks)
            VALUES (%s, NULL, %s, 'Reported', 'Citizen', %s)
        """, (report_id, status, workflow_remarks))
        
        # Insert notification into dedicated table
        notif_title = "New Report"
        notif_msg = f"New {category.lower()} reported at {address} (Issue #{report_id})"
        notif_type = "reported"
        
        if duplicate_report_id:
            notif_title = "Duplicate Report Detected"
            notif_msg = f"Duplicate {category.lower()} detected at {address} (Issue #{report_id})"
            notif_type = "duplicate"
        elif severity == 'Critical' or priority == 'Urgent':
            notif_title = "High Priority Report"
            notif_msg = f"High priority {category.lower()} reported at {address} (Issue #{report_id})"
            notif_type = "high_priority"
            
        cursor.execute("""
            INSERT INTO notifications (report_id, title, message, type)
            VALUES (%s, %s, %s, %s)
        """, (report_id, notif_title, notif_msg, notif_type))

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

def officer_login(email, password):
    from werkzeug.security import check_password_hash
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Check shortcut credentials 'pmc' / 'pmc'
        if email == "pmc" and password == "pmc":
            cursor.execute("SELECT * FROM officers WHERE email = 'ramesh.kumar@pmc.gov.in'")
            officer = cursor.fetchone()
            if officer:
                del officer['password_hash']
                return officer
            return None

        cursor.execute("SELECT * FROM officers WHERE email = %s", (email,))
        officer = cursor.fetchone()
        if officer and check_password_hash(officer['password_hash'], password):
            # remove password_hash before returning
            del officer['password_hash']
            return officer
        return None
    finally:
        cursor.close()
        conn.close()

def get_officer_dashboard_stats():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Total
        cursor.execute("SELECT COUNT(*) as total FROM reports")
        total = cursor.fetchone()['total'] or 0
        
        # Pending (Reported or Pending status)
        cursor.execute("SELECT COUNT(*) as pending FROM reports WHERE status IN ('Reported', 'Pending')")
        pending = cursor.fetchone()['pending'] or 0
        
        # In Progress
        cursor.execute("SELECT COUNT(*) as in_progress FROM reports WHERE status = 'In Progress'")
        in_progress = cursor.fetchone()['in_progress'] or 0
        
        # Resolved
        cursor.execute("SELECT COUNT(*) as resolved FROM reports WHERE status = 'Resolved'")
        resolved = cursor.fetchone()['resolved'] or 0
        
        # High Priority
        cursor.execute("SELECT COUNT(*) as high_priority FROM reports WHERE priority IN ('High', 'Urgent') OR severity IN ('High', 'Critical')")
        high_priority = cursor.fetchone()['high_priority'] or 0
        
        # Duplicate
        cursor.execute("SELECT COUNT(*) as duplicate FROM reports WHERE status = 'Duplicate'")
        duplicate = cursor.fetchone()['duplicate'] or 0
        
        return {
            "total": total,
            "pending": pending,
            "in_progress": in_progress,
            "resolved": resolved,
            "high_priority": high_priority,
            "duplicate": duplicate
        }
    finally:
        cursor.close()
        conn.close()

def get_department_pending_stats():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM departments")
        depts = cursor.fetchall()
        
        results = []
        for dept in depts:
            dept_id = dept['id']
            dept_name = dept['name']
            
            category_mapping = {
                "Road Department": ['Pothole', 'Road Crack', 'Road Cracks', 'Potholes'],
                "Sanitation": ['Garbage', 'Overflowing Dustbins', 'Garbage Overflow', 'Graffiti'],
                "Electrical": ['Broken Street Light', 'Broken Street Lights', 'Electrical'],
                "Water Department": ['Water Leakage', 'Water Leak', 'Drainage Overflow']
            }
            
            cats = category_mapping.get(dept_name, [])
            
            if cats:
                cursor.execute("""
                    SELECT COUNT(*) as pending_count 
                    FROM reports 
                    WHERE status IN ('Reported', 'Pending') 
                      AND (assigned_department_id = %s OR (assigned_department_id IS NULL AND category IN ({}) ))
                """.format(",".join(["%s"] * len(cats))), [dept_id] + cats)
            else:
                cursor.execute("""
                    SELECT COUNT(*) as pending_count 
                    FROM reports 
                    WHERE status IN ('Reported', 'Pending') AND assigned_department_id = %s
                """, (dept_id,))
            pending_count = cursor.fetchone()['pending_count'] or 0
            
            if cats:
                cursor.execute("""
                    SELECT COUNT(*) as high_priority_count 
                    FROM reports 
                    WHERE status IN ('Reported', 'Pending') 
                      AND (assigned_department_id = %s OR (assigned_department_id IS NULL AND category IN ({}) ))
                      AND (priority IN ('High', 'Urgent') OR severity IN ('High', 'Critical'))
                """.format(",".join(["%s"] * len(cats))), [dept_id] + cats)
            else:
                cursor.execute("""
                    SELECT COUNT(*) as high_priority_count 
                    FROM reports 
                    WHERE status IN ('Reported', 'Pending') AND assigned_department_id = %s
                      AND (priority IN ('High', 'Urgent') OR severity IN ('High', 'Critical'))
                """, (dept_id,))
            high_priority_count = cursor.fetchone()['high_priority_count'] or 0
            
            cursor.execute("""
                SELECT AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours
                FROM reports
                WHERE assigned_department_id = %s AND status = 'Resolved' AND resolved_at IS NOT NULL
            """, (dept_id,))
            avg_hours = cursor.fetchone()['avg_hours']
            if avg_hours is not None:
                if avg_hours < 24:
                    avg_res_time = f"{round(avg_hours, 1)} hrs"
                else:
                    avg_res_time = f"{round(avg_hours / 24, 1)} days"
            else:
                default_times = {
                    "Road Department": "3.5 days",
                    "Sanitation": "1.2 days",
                    "Electrical": "18.5 hrs",
                    "Water Department": "1.8 days"
                }
                avg_res_time = default_times.get(dept_name, "2.4 days")
                
            results.append({
                "id": dept_id,
                "name": dept_name,
                "description": dept['description'],
                "icon": dept['icon'],
                "pending_count": pending_count,
                "high_priority_count": high_priority_count,
                "avg_resolution_time": avg_res_time
            })
        return results
    finally:
        cursor.close()
        conn.close()

def get_all_reports_for_officers(status_filter=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT r.*, u.full_name as reporter_name, u.email as reporter_email
            FROM reports r
            LEFT JOIN users u ON r.user_id = u.id
        """
        params = []
        if status_filter:
            if status_filter == 'Pending':
                query += " WHERE r.status IN ('Reported', 'Pending')"
            else:
                query += " WHERE r.status = %s"
                params.append(status_filter)
        query += " ORDER BY r.created_at DESC"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        reports = []
        for row in rows:
            bbox = row.get("bounding_boxes")
            if isinstance(bbox, str):
                try:
                    bbox = json.loads(bbox)
                except Exception:
                    bbox = []
            elif bbox is None:
                bbox = []
                
            reports.append({
                "id": row["id"],
                "issue_type": row["category"] or "Unknown",
                "ai_confidence_score": row["ai_confidence"] or 0.0,
                "location": row["address"] or "Unknown",
                "user_description": row["user_description"] or row["description"],
                "ai_description": row["ai_description"] or row["description"],
                "ai_title": row["title"],
                "severity": row["severity"] or "Medium",
                "priority": row["priority"] or "Medium",
                "recommended_action": row["recommended_action"],
                "road_damage_percentage": row["road_damage_percentage"],
                "annotated_image": row["annotated_image"],
                "uploaded_image": row["image_path"],
                "status": row["status"],
                "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
                "reporter_name": row["reporter_name"] or "Anonymous Citizen",
                "reporter_email": row["reporter_email"] or "N/A",
                "assigned_officer_id": row["assigned_officer_id"],
                "assigned_department_id": row["assigned_department_id"],
                "resolution_summary": row["resolution_summary"]
            })
        return reports
    finally:
        cursor.close()
        conn.close()

def get_report_details_for_officer(report_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT r.*, u.full_name as reporter_name, u.email as reporter_email, u.firebase_uid as reporter_uid
            FROM reports r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.id = %s
        """, (report_id,))
        row = cursor.fetchone()
        if not row:
            return None
            
        bbox = row.get("bounding_boxes")
        if isinstance(bbox, str):
            try:
                bbox = json.loads(bbox)
            except Exception:
                bbox = []
        elif bbox is None:
            bbox = []
            
        # Calculate total resolution time
        total_res_time = "N/A"
        if row["resolved_at"] and row["created_at"]:
            try:
                created = row["created_at"]
                resolved = row["resolved_at"]
                diff = resolved - created
                diff_seconds = diff.total_seconds()
                if diff_seconds < 86400:
                    total_res_time = f"{round(diff_seconds / 3600, 1)} hrs"
                else:
                    total_res_time = f"{round(diff_seconds / 86400, 1)} Days"
            except Exception as e:
                print(f"Error calculating total resolution time: {e}")

        report = {
            "id": row["id"],
            "issue_type": row["category"] or "Unknown",
            "ai_confidence_score": row["ai_confidence"] or 0.0,
            "location": row["address"] or "Unknown",
            "latitude": float(row["latitude"]) if row["latitude"] is not None else None,
            "longitude": float(row["longitude"]) if row["longitude"] is not None else None,
            "user_description": row["user_description"] or row["description"],
            "ai_description": row["ai_description"] or row["description"],
            "ai_title": row["title"],
            "severity": row["severity"] or "Medium",
            "priority": row["priority"] or "Medium",
            "recommended_action": row["recommended_action"],
            "road_damage_percentage": row["road_damage_percentage"],
            "annotated_image": row["annotated_image"],
            "uploaded_image": row["image_path"],
            "status": row["status"],
            "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
            "reporter_name": row["reporter_name"] or "Anonymous Citizen",
            "reporter_email": row["reporter_email"] or "N/A",
            "reporter_uid": row["reporter_uid"] or "N/A",
            "assigned_officer_id": row["assigned_officer_id"],
            "assigned_department_id": row["assigned_department_id"],
            "estimated_completion": row["estimated_completion"].isoformat() if row["estimated_completion"] and hasattr(row["estimated_completion"], "isoformat") else str(row["estimated_completion"]) if row["estimated_completion"] else None,
            "resolved_at": row["resolved_at"].isoformat() if row["resolved_at"] and hasattr(row["resolved_at"], "isoformat") else str(row["resolved_at"]) if row["resolved_at"] else None,
            "resolution_summary": row["resolution_summary"],
            "total_resolution_time": total_res_time
        }
        
        if row["assigned_officer_id"]:
            cursor.execute("SELECT name, email, department, designation FROM officers WHERE id = %s", (row["assigned_officer_id"],))
            report["assigned_officer"] = cursor.fetchone()
        else:
            report["assigned_officer"] = None
            
        cursor.execute("SELECT * FROM report_workflow WHERE report_id = %s ORDER BY created_at ASC", (report_id,))
        workflow = cursor.fetchall()
        report["workflow_history"] = []
        for step in workflow:
            report["workflow_history"].append({
                "previous_status": step["previous_status"],
                "new_status": step["new_status"],
                "action": step["action"],
                "performed_by": step["performed_by"],
                "remarks": step["remarks"],
                "created_at": step["created_at"].isoformat() if hasattr(step["created_at"], "isoformat") else str(step["created_at"])
            })
            
        cursor.execute("SELECT * FROM report_assignments WHERE report_id = %s ORDER BY assigned_at DESC", (report_id,))
        assignments = cursor.fetchall()
        report["assignments_history"] = []
        for assign in assignments:
            report["assignments_history"].append({
                "assigned_at": assign["assigned_at"].isoformat() if hasattr(assign["assigned_at"], "isoformat") else str(assign["assigned_at"]),
                "accepted_at": assign["accepted_at"].isoformat() if assign["accepted_at"] and hasattr(assign["accepted_at"], "isoformat") else str(assign["accepted_at"]) if assign["accepted_at"] else None,
                "completed_at": assign["completed_at"].isoformat() if assign["completed_at"] and hasattr(assign["completed_at"], "isoformat") else str(assign["completed_at"]) if assign["completed_at"] else None,
                "status": assign["status"],
                "officer_notes": assign["officer_notes"],
                "resolution_image": assign["resolution_image"],
                "resolution_summary": assign["resolution_summary"]
            })
            
        if row["duplicate_report_id"]:
            cursor.execute("SELECT title, category, status, address FROM reports WHERE id = %s", (row["duplicate_report_id"],))
            report["duplicate_info"] = cursor.fetchone()
            if report["duplicate_info"]:
                report["duplicate_info"]["id"] = row["duplicate_report_id"]
        else:
            report["duplicate_info"] = None
            
        return report
    finally:
        cursor.close()
        conn.close()

def assign_report_to_officer(report_id, officer_id, remarks="Issue assigned to officer"):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()
        
        cursor.execute("SELECT name, department FROM officers WHERE id = %s", (officer_id,))
        officer = cursor.fetchone()
        if not officer:
            raise ValueError(f"Officer with ID {officer_id} not found.")
            
        cursor.execute("SELECT id FROM departments WHERE name = %s", (officer['department'],))
        dept = cursor.fetchone()
        dept_id = dept['id'] if dept else 1
        
        cursor.execute("SELECT status FROM reports WHERE id = %s", (report_id,))
        report_row = cursor.fetchone()
        if not report_row:
            raise ValueError(f"Report with ID {report_id} not found.")
        prev_status = report_row['status']
        
        cursor.execute("""
            UPDATE reports 
            SET status = 'In Progress', 
                assigned_officer_id = %s, 
                assigned_department_id = %s,
                estimated_completion = DATE_ADD(NOW(), INTERVAL 2 DAY)
            WHERE id = %s
        """, (officer_id, dept_id, report_id))
        
        cursor.execute("""
            INSERT INTO report_assignments (report_id, officer_id, department_id, assigned_at, accepted_at, status, officer_notes)
            VALUES (%s, %s, %s, NOW(), NOW(), 'In Progress', %s)
        """, (report_id, officer_id, dept_id, remarks))
        
        cursor.execute("""
            INSERT INTO report_workflow (report_id, previous_status, new_status, action, performed_by, remarks)
            VALUES (%s, %s, 'In Progress', 'Take Issue', %s, %s)
        """, (report_id, prev_status, officer['name'], remarks))
        
        # Insert notification
        cursor.execute("""
            INSERT INTO notifications (report_id, title, message, type)
            VALUES (%s, 'Issue Assigned', %s, 'assigned')
        """, (report_id, f"Issue #{report_id} has been assigned to {officer['name']} ({officer['department']})"))
        
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in assign_report_to_officer: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()

def resolve_report(report_id, officer_id, notes, resolution_image, resolution_summary):
    if not resolution_image or resolution_image.strip() == "":
        raise ValueError("Resolution image is mandatory to resolve the report.")
        
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()
        
        cursor.execute("SELECT name, department FROM officers WHERE id = %s", (officer_id,))
        officer = cursor.fetchone()
        if not officer:
            raise ValueError(f"Officer with ID {officer_id} not found.")
            
        cursor.execute("SELECT id FROM departments WHERE name = %s", (officer['department'],))
        dept = cursor.fetchone()
        dept_id = dept['id'] if dept else 1
        
        cursor.execute("""
            UPDATE reports 
            SET status = 'Resolved', 
                resolved_at = NOW(),
                resolution_summary = %s
            WHERE id = %s
        """, (resolution_summary, report_id))
        
        cursor.execute("""
            UPDATE report_assignments
            SET completed_at = NOW(),
                status = 'Resolved',
                officer_notes = %s,
                resolution_image = %s,
                resolution_summary = %s
            WHERE report_id = %s AND officer_id = %s AND status = 'In Progress'
        """, (notes, resolution_image, resolution_summary, report_id, officer_id))
        
        cursor.execute("""
            INSERT INTO report_resolution_images (report_id, image_path, uploaded_by)
            VALUES (%s, %s, %s)
        """, (report_id, resolution_image, officer_id))
        
        cursor.execute("""
            INSERT INTO report_workflow (report_id, previous_status, new_status, action, performed_by, remarks)
            VALUES (%s, 'In Progress', 'Resolved', 'Resolve Issue', %s, %s)
        """, (report_id, officer['name'], f"Resolved: {notes[:100]}..."))
        
        # Insert notification
        cursor.execute("""
            INSERT INTO notifications (report_id, title, message, type)
            VALUES (%s, 'Issue Resolved', %s, 'resolved')
        """, (report_id, f"Issue #{report_id} has been marked as Resolved by Officer {officer['name']}"))
        
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in resolve_report: {e}")
        raise e
    finally:
        cursor.close()
        conn.close()

def save_manual_resolution_summary(report_id, resolution_summary):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE reports
            SET resolution_summary = %s
            WHERE id = %s
        """, (resolution_summary, report_id))
        
        cursor.execute("""
            UPDATE report_assignments
            SET resolution_summary = %s
            WHERE report_id = %s AND status = 'Resolved'
        """, (resolution_summary, report_id))
        
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error saving manual summary: {e}")
        return False
    finally:
        cursor.close()
        conn.close()

def add_notification(report_id, title, message, type_name):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO notifications (report_id, title, message, type)
            VALUES (%s, %s, %s, %s)
        """, (report_id, title, message, type_name))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in add_notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()

def get_notifications():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # Fetch latest 10 notifications
        cursor.execute("""
            SELECT * FROM notifications 
            ORDER BY created_at DESC 
            LIMIT 10
        """)
        notifs = cursor.fetchall()
        
        # Calculate unread count
        cursor.execute("SELECT COUNT(*) as unread FROM notifications WHERE is_read = 0")
        unread_count = cursor.fetchone()['unread'] or 0
        
        formatted = []
        for n in notifs:
            formatted.append({
                "id": n["id"],
                "report_id": n["report_id"],
                "title": n["title"],
                "message": n["message"],
                "type": n["type"],
                "is_read": bool(n["is_read"]),
                "created_at": n["created_at"].isoformat() if hasattr(n["created_at"], "isoformat") else str(n["created_at"])
            })
        return {
            "notifications": formatted,
            "unread_count": unread_count
        }
    finally:
        cursor.close()
        conn.close()

def mark_notifications_as_read():
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("UPDATE notifications SET is_read = 1 WHERE is_read = 0")
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error in mark_notifications_as_read: {e}")
        return False
    finally:
        cursor.close()
        conn.close()

def get_dashboard_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. Fetch Stats
        cursor.execute("""
            SELECT
                COUNT(*) as `total`,
                SUM(CASE WHEN status = 'Reported' THEN 1 ELSE 0 END) as `reported`,
                SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as `in_progress`,
                SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as `resolved`,
                SUM(CASE WHEN severity = 'Critical' OR priority = 'Urgent' THEN 1 ELSE 0 END) as `high_priority`,
                SUM(CASE WHEN duplicate_report_id IS NOT NULL THEN 1 ELSE 0 END) as `duplicate`,
                SUM(CASE WHEN DATE(created_at) = CURDATE() THEN 1 ELSE 0 END) as `today`
            FROM reports
        """)
        stats_row = cursor.fetchone()
        stats = {
            "total": int(stats_row["total"] or 0),
            "reported": int(stats_row["reported"] or 0),
            "in_progress": int(stats_row["in_progress"] or 0),
            "resolved": int(stats_row["resolved"] or 0),
            "high_priority": int(stats_row["high_priority"] or 0),
            "duplicate": int(stats_row["duplicate"] or 0),
            "today": int(stats_row["today"] or 0)
        }

        # 2. Fetch Department Summary
        cursor.execute("""
            SELECT 
                d.name,
                SUM(CASE WHEN r.status = 'Reported' THEN 1 ELSE 0 END) AS reported_count,
                SUM(CASE WHEN r.status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_count,
                SUM(CASE WHEN r.status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_count,
                SUM(CASE WHEN r.severity = 'Critical' OR r.priority = 'Urgent' THEN 1 ELSE 0 END) AS high_priority_count,
                AVG(CASE WHEN r.status = 'Resolved' AND r.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, r.created_at, r.resolved_at) ELSE NULL END) AS avg_res_seconds
            FROM departments d
            LEFT JOIN reports r ON r.assigned_department_id = d.id
            GROUP BY d.id, d.name
        """)
        dept_rows = cursor.fetchall()
        department_summary = []
        for dr in dept_rows:
            avg_sec = dr["avg_res_seconds"]
            if avg_sec is not None:
                if avg_sec < 86400:
                    avg_res = f"{round(float(avg_sec) / 3600, 1)} hrs"
                else:
                    avg_res = f"{round(float(avg_sec) / 86400, 1)} Days"
            else:
                avg_res = "N/A"
            department_summary.append({
                "name": dr["name"],
                "reported": int(dr["reported_count"] or 0),
                "in_progress": int(dr["in_progress_count"] or 0),
                "resolved": int(dr["resolved_count"] or 0),
                "high_priority": int(dr["high_priority_count"] or 0),
                "avg_resolution_time": avg_res
            })

        # 3. Fetch Notifications
        notif_data = get_notifications()

        return {
            "stats": stats,
            "departmentSummary": department_summary,
            "notifications": notif_data["notifications"],
            "unread_count": notif_data["unread_count"]
        }
    finally:
        cursor.close()
        conn.close()

def get_analytics_data():
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        # 1. Reports by Department
        cursor.execute("""
            SELECT d.name as department, COUNT(r.id) as count
            FROM departments d
            LEFT JOIN reports r ON r.assigned_department_id = d.id
            GROUP BY d.id, d.name
        """)
        by_dept = cursor.fetchall()

        # 2. Issue Category Distribution
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM reports
            WHERE category IS NOT NULL AND category != ''
            GROUP BY category
        """)
        by_cat = cursor.fetchall()

        # 3. Status Distribution
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM reports
            WHERE status IN ('Reported', 'In Progress', 'Resolved')
            GROUP BY status
        """)
        by_status = cursor.fetchall()

        # 4. Priority Distribution
        cursor.execute("""
            SELECT priority, COUNT(*) as count
            FROM reports
            WHERE priority IN ('Low', 'Medium', 'High', 'Urgent')
            GROUP BY priority
        """)
        by_priority = cursor.fetchall()

        # 5. Monthly Reports Trend
        cursor.execute("""
            SELECT DATE_FORMAT(created_at, '%b %Y') as month, COUNT(*) as count, MIN(created_at) as sort_date
            FROM reports
            GROUP BY DATE_FORMAT(created_at, '%b %Y')
            ORDER BY sort_date ASC
        """)
        monthly_rows = cursor.fetchall()
        monthly_trend = [{ "month": r["month"], "count": r["count"] } for r in monthly_rows]

        # 6. Resolution Performance
        cursor.execute("""
            SELECT 
                d.name as department, 
                COALESCE(AVG(CASE WHEN r.status = 'Resolved' AND r.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, r.created_at, r.resolved_at) ELSE NULL END) / 86400, 0) as avg_days
            FROM departments d
            LEFT JOIN reports r ON r.assigned_department_id = d.id
            GROUP BY d.id, d.name
        """)
        res_perf = cursor.fetchall()
        for rp in res_perf:
            rp["avg_days"] = round(float(rp["avg_days"]), 2)

        # 7. Department Detailed operational metrics
        cursor.execute("""
            SELECT 
                d.name,
                COUNT(r.id) as total_reports,
                COALESCE(AVG(r.ai_confidence), 0) as avg_confidence,
                COALESCE(AVG(CAST(REPLACE(IFNULL(r.road_damage_percentage, '0%'), '%', '') AS DECIMAL(5,2))), 0) as avg_damage_pct,
                AVG(CASE WHEN r.status = 'Resolved' AND r.resolved_at IS NOT NULL THEN TIMESTAMPDIFF(SECOND, r.created_at, r.resolved_at) ELSE NULL END) as avg_res_seconds,
                COALESCE(SUM(CASE WHEN r.duplicate_report_id IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(r.id), 0), 0) as duplicate_pct
            FROM departments d
            LEFT JOIN reports r ON r.assigned_department_id = d.id
            GROUP BY d.id, d.name
        """)
        detailed_dept_rows = cursor.fetchall()
        department_analytics = []
        for dr in detailed_dept_rows:
            avg_sec = dr["avg_res_seconds"]
            if avg_sec is not None:
                if avg_sec < 86400:
                    avg_res = f"{round(float(avg_sec) / 3600, 1)} hrs"
                else:
                    avg_res = f"{round(float(avg_sec) / 86400, 1)} Days"
            else:
                avg_res = "N/A"
            department_analytics.append({
                "name": dr["name"],
                "total_reports": int(dr["total_reports"] or 0),
                "avg_confidence": round(float(dr["avg_confidence"] or 0), 1),
                "avg_damage_pct": round(float(dr["avg_damage_pct"] or 0), 1),
                "avg_resolution_time": avg_res,
                "duplicate_pct": round(float(dr["duplicate_pct"] or 0), 1)
            })

        return {
            "by_department": by_dept,
            "by_category": by_cat,
            "by_status": by_status,
            "by_priority": by_priority,
            "monthly_trend": monthly_trend,
            "resolution_performance": res_perf,
            "department_analytics": department_analytics
        }
    finally:
        cursor.close()
        conn.close()

def get_paginated_reports(page=1, limit=20, status=None, priority=None, department_id=None, search=None):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        count_query = "SELECT COUNT(*) as total FROM reports r"
        select_query = "SELECT r.id, r.category, r.title, r.ai_confidence, r.address, r.image_path, r.status, r.severity, r.priority, r.created_at, r.duplicate_report_id, r.ai_description, r.user_description FROM reports r"
        
        where_clauses = []
        params = []
        
        if status:
            if status == 'Pending':
                where_clauses.append("r.status IN ('Reported', 'Pending')")
            else:
                where_clauses.append("r.status = %s")
                params.append(status)
                
        if priority:
            where_clauses.append("r.priority = %s")
            params.append(priority)
            
        if department_id:
            where_clauses.append("r.assigned_department_id = %s")
            params.append(department_id)
            
        if search:
            if search.isdigit():
                where_clauses.append("(r.id = %s OR r.address LIKE %s OR r.category LIKE %s OR r.title LIKE %s)")
                params.append(int(search))
                params.append(f"%{search}%")
                params.append(f"%{search}%")
                params.append(f"%{search}%")
            else:
                where_clauses.append("(r.address LIKE %s OR r.category LIKE %s OR r.title LIKE %s)")
                params.append(f"%{search}%")
                params.append(f"%{search}%")
                params.append(f"%{search}%")
                
        if where_clauses:
            where_str = " WHERE " + " AND ".join(where_clauses)
            count_query += where_str
            select_query += where_str
            
        select_query += " ORDER BY r.created_at DESC"
        
        offset = (page - 1) * limit
        select_query += " LIMIT %s OFFSET %s"
        select_params = params + [limit, offset]
        
        cursor.execute(count_query, params)
        total = cursor.fetchone()['total'] or 0
        
        cursor.execute(select_query, select_params)
        rows = cursor.fetchall()
        
        reports = []
        for row in rows:
            reports.append({
                "id": row["id"],
                "issue_type": row["category"] or "Unknown",
                "ai_confidence_score": row["ai_confidence"] or 0.0,
                "location": row["address"] or "Unknown",
                "user_description": row["user_description"] or row["ai_description"],
                "ai_description": row["ai_description"] or row["user_description"],
                "ai_title": row["title"],
                "severity": row["severity"] or "Medium",
                "priority": row["priority"] or "Medium",
                "uploaded_image": row["image_path"],
                "status": row["status"],
                "created_at": row["created_at"].isoformat() if hasattr(row["created_at"], "isoformat") else str(row["created_at"]),
                "duplicate_report_id": row["duplicate_report_id"],
                "badges": {
                    "ai_generated": True,
                    "duplicate": row["duplicate_report_id"] is not None,
                    "high_priority": row["severity"] == 'Critical' or row["priority"] == 'Urgent',
                    "urgent": row["priority"] == 'Urgent'
                }
            })
            
        import math
        pages = math.ceil(total / limit) if total > 0 else 1
        
        return {
            "reports": reports,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "pages": pages
            }
        }
    finally:
        cursor.close()
        conn.close()

def get_officer_profile(officer_id):
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT id, name, email, department, designation, employee_code FROM officers WHERE id = %s", (officer_id,))
        officer = cursor.fetchone()
        if not officer:
            return None
            
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM report_assignments 
            WHERE officer_id = %s AND DATE(assigned_at) = CURDATE()
        """, (officer_id,))
        assigned_today = cursor.fetchone()['count'] or 0

        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM report_assignments 
            WHERE officer_id = %s AND status = 'Resolved' AND DATE(completed_at) = CURDATE()
        """, (officer_id,))
        resolved_today = cursor.fetchone()['count'] or 0

        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM reports 
            WHERE assigned_officer_id = %s AND status = 'In Progress'
        """, (officer_id,))
        active_issues = cursor.fetchone()['count'] or 0

        cursor.execute("""
            SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, resolved_at)) as avg_seconds
            FROM reports 
            WHERE assigned_officer_id = %s AND status = 'Resolved' AND resolved_at IS NOT NULL
        """, (officer_id,))
        avg_seconds = cursor.fetchone()['avg_seconds']
        if avg_seconds is not None:
            if avg_seconds < 86400:
                avg_res_time = f"{round(avg_seconds / 3600, 1)} hrs"
            else:
                avg_res_time = f"{round(avg_seconds / 86400, 1)} days"
        else:
            avg_res_time = "N/A"

        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM report_assignments 
            WHERE officer_id = %s
        """, (officer_id,))
        total_assigned = cursor.fetchone()['count'] or 0

        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM report_assignments 
            WHERE officer_id = %s AND status = 'Resolved'
        """, (officer_id,))
        total_resolved = cursor.fetchone()['count'] or 0

        if total_assigned > 0:
            success_rate = f"{round((total_resolved / total_assigned) * 100, 1)}%"
        else:
            success_rate = "100.0%"

        return {
            "id": officer["id"],
            "name": officer["name"],
            "email": officer["email"],
            "department": officer["department"],
            "designation": officer["designation"],
            "employee_code": officer["employee_code"],
            "assigned_today": assigned_today,
            "resolved_today": resolved_today,
            "active_issues": active_issues,
            "avg_resolution_time": avg_res_time,
            "success_rate": success_rate
        }
    finally:
        cursor.close()
        conn.close()

