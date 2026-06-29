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

        # Sync community post status badge to 'In Progress'
        try:
            update_community_post_status(report_id, 'In Progress')
        except Exception as ce:
            print(f"Warning: community post status sync failed: {ce}")

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

        # Calculate resolution time for community post
        try:
            resolution_time_str = None
            cursor.execute(
                "SELECT created_at, resolved_at FROM reports WHERE id = %s", (report_id,)
            )
            timing = cursor.fetchone()
            if timing and timing['resolved_at'] and timing['created_at']:
                diff_sec = (timing['resolved_at'] - timing['created_at']).total_seconds()
                if diff_sec < 3600:
                    resolution_time_str = f"{round(diff_sec / 60)} Mins"
                elif diff_sec < 86400:
                    resolution_time_str = f"{round(diff_sec / 3600, 1)} Hrs"
                else:
                    resolution_time_str = f"{round(diff_sec / 86400, 1)} Days"
        except Exception:
            resolution_time_str = None

        # Auto-generate resolution community post
        try:
            from services import gemini_service as _gs
            # Build resolution caption
            report_meta = get_report_details_for_officer(report_id)
            category = report_meta.get('issue_type', 'Issue') if report_meta else 'Issue'
            location = report_meta.get('location', 'Pune') if report_meta else 'Pune'
            officer_info = report_meta.get('assigned_officer') if report_meta else None
            officer_name_str = officer_info['name'] if officer_info else officer.get('name', 'PMC Officer')
            dept_name_str = officer_info['department'] if officer_info else officer.get('department', 'PMC')
            contrib_row = None
            try:
                cursor.execute(
                    "SELECT contributors_count FROM community_posts WHERE report_id=%s AND post_type='report' LIMIT 1",
                    (report_id,)
                )
                contrib_row = cursor.fetchone()
            except Exception:
                pass
            contrib_count = contrib_row['contributors_count'] if contrib_row else 1
            road_dmg = report_meta.get('road_damage_percentage') if report_meta else None
            citizen_desc = report_meta.get('user_description') if report_meta else None

            res_caption = _gs.generate_resolution_post_caption(
                category=category,
                location=location,
                department=dept_name_str,
                officer_name=officer_name_str,
                officer_notes=notes,
                contributor_count=contrib_count,
                resolution_time=resolution_time_str,
                road_damage_percentage=road_dmg,
                citizen_description=citizen_desc
            )
            create_community_resolution_post(
                report_id=report_id,
                officer_id=officer_id,
                resolution_image=resolution_image,
                resolution_post_caption=res_caption,
                resolution_time=resolution_time_str
            )
            # Also update original report post status badge
            update_community_post_status(report_id, 'Resolved')
        except Exception as ce:
            print(f"Warning: community resolution post creation failed: {ce}")

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


# =============================================================================
# COMMUNITY FEED — DATABASE SERVICE FUNCTIONS
# =============================================================================

def _format_iso(val):
    """Helper: safely convert datetime to ISO string."""
    if val is None:
        return None
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    return str(val)


def create_community_report_post(report_id, user_id, category, location,
                                  image_before, department_id, department_name,
                                  report_post_caption, ai_description=None,
                                  road_damage_percentage=None, confidence=None):
    """
    Creates a new community post of type 'report' immediately after a citizen
    submits a report. Also inserts the original reporter as a contributor.
    """
    conn = get_connection()
    cursor = conn.cursor()
    try:
        conn.start_transaction()

        short_loc = location.split(',')[0].strip() if location and ',' in location else (location or 'Pune')
        friendly_title = f"{category} — {short_loc}"
        content = ai_description or f"A {category.lower()} has been reported near {location}."

        cursor.execute("""
            INSERT INTO community_posts (
                report_id, post_type, author_type, department_id,
                title, friendly_title, content, image_before,
                report_post_caption, report_status, report_category,
                report_location, department_name, road_damage_percentage,
                contributors_count
            ) VALUES (%s, 'report', 'citizen', %s,
                      %s, %s, %s, %s,
                      %s, 'Reported', %s,
                      %s, %s, %s,
                      1)
        """, (
            report_id, department_id,
            friendly_title, friendly_title, content, image_before,
            report_post_caption, category,
            location, department_name, road_damage_percentage
        ))
        post_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO community_post_contributors
                (post_id, report_id, user_id, role, area, confidence)
            VALUES (%s, %s, %s, 'Original Reporter', %s, %s)
        """, (post_id, report_id, user_id, short_loc, float(confidence or 0)))

        conn.commit()
        print(f"✓ Community report post created: id={post_id} for report_id={report_id}")
        return post_id
    except Exception as e:
        conn.rollback()
        print(f"Error creating community report post: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def handle_duplicate_community_post(original_report_id, new_report_id,
                                     user_id, confidence=0, area=None):
    """
    When a duplicate report is detected:
    - Find community post linked to original_report_id
    - Add new reporter as Supporter contributor
    - Increment contributors_count on that post
    Returns the existing post_id.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()

        cursor.execute("""
            SELECT id, contributors_count FROM community_posts
            WHERE report_id = %s AND post_type = 'report'
            LIMIT 1
        """, (original_report_id,))
        post_row = cursor.fetchone()

        if not post_row:
            print(f"No community post found for original report {original_report_id}.")
            conn.rollback()
            return None

        post_id = post_row['id']

        cursor.execute("""
            INSERT INTO community_post_contributors
                (post_id, report_id, user_id, role, area, confidence)
            VALUES (%s, %s, %s, 'Supporter', %s, %s)
        """, (post_id, new_report_id, user_id, area or 'Pune', float(confidence or 0)))

        cursor.execute("""
            UPDATE community_posts
            SET contributors_count = contributors_count + 1, updated_at = NOW()
            WHERE id = %s
        """, (post_id,))

        new_count = post_row['contributors_count'] + 1
        if new_count % 5 == 0:
            cursor.execute("""
                INSERT INTO notifications (report_id, title, message, type)
                VALUES (%s, %s, %s, 'community_milestone')
            """, (
                original_report_id,
                f"Community Milestone — {new_count} Reports",
                f"{new_count} citizens have now reported Issue #{original_report_id}. Urgent attention needed!"
            ))

        conn.commit()
        print(f"✓ Duplicate contributor added to community post {post_id} (count={new_count})")
        return post_id
    except Exception as e:
        conn.rollback()
        print(f"Error handling duplicate community post: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def create_community_resolution_post(report_id, officer_id, resolution_image,
                                      resolution_post_caption, resolution_time=None):
    """
    Creates a new community post of type 'resolved' when an officer resolves an issue.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        conn.start_transaction()

        cursor.execute("""
            SELECT r.*, o.name as officer_name, o.department as officer_dept,
                   d.id as dept_id, d.name as dept_name
            FROM reports r
            LEFT JOIN officers o ON o.id = %s
            LEFT JOIN departments d ON d.name = o.department
            WHERE r.id = %s
        """, (officer_id, report_id))
        report = cursor.fetchone()
        if not report:
            conn.rollback()
            return None

        category = report.get('category') or 'Issue'
        location = report.get('address') or 'Pune'
        image_before = report.get('image_path') or ''
        officer_name = report.get('officer_name') or 'PMC Officer'
        dept_name = report.get('dept_name') or 'Municipal Corporation'
        dept_id = report.get('dept_id')
        road_damage_pct = report.get('road_damage_percentage')

        cursor.execute("""
            SELECT id, contributors_count FROM community_posts
            WHERE report_id = %s AND post_type = 'report'
            LIMIT 1
        """, (report_id,))
        original_post = cursor.fetchone()
        contrib_count = original_post['contributors_count'] if original_post else 1

        short_loc = location.split(',')[0].strip() if ',' in location else location
        friendly_title = f"{category} Restored — {short_loc}"
        content = resolution_post_caption or f"The {category.lower()} at {location} has been resolved."

        cursor.execute("""
            INSERT INTO community_posts (
                report_id, post_type, author_type, department_id,
                title, friendly_title, content,
                image_before, image_after,
                resolution_post_caption, report_status, report_category,
                report_location, department_name, officer_name,
                road_damage_percentage, resolution_time,
                contributors_count
            ) VALUES (
                %s, 'resolved', 'pmc', %s,
                %s, %s, %s,
                %s, %s,
                %s, 'Resolved', %s,
                %s, %s, %s,
                %s, %s,
                %s
            )
        """, (
            report_id, dept_id,
            friendly_title, friendly_title, content,
            image_before, resolution_image,
            resolution_post_caption, category,
            location, dept_name, officer_name,
            road_damage_pct, resolution_time,
            contrib_count
        ))
        post_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO notifications (report_id, title, message, type)
            VALUES (%s, 'Issue Resolved', %s, 'community_resolved')
        """, (
            report_id,
            f"The {category.lower()} near {short_loc} has been resolved by PMC Officer {officer_name}!"
        ))

        conn.commit()
        print(f"✓ Community resolution post created: id={post_id} for report_id={report_id}")
        return post_id
    except Exception as e:
        conn.rollback()
        print(f"Error creating community resolution post: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def update_community_post_status(report_id, new_status):
    """Syncs the report_status badge on all community posts tied to this report."""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE community_posts
            SET report_status = %s, updated_at = NOW()
            WHERE report_id = %s
        """, (new_status, report_id))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"Error updating community post status: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def get_community_feed(page=1, limit=8, status=None, category=None,
                        sort='Newest', search=None, user_id=None):
    """
    Returns paginated community posts with filtering, sorting and search.
    Includes has_liked flag per post for the current user.
    """
    import math
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        where_clauses = []
        params = []

        if status and status != 'All':
            if status == 'Resolved':
                where_clauses.append("cp.post_type = 'resolved'")
            elif status == 'Reported':
                where_clauses.append("cp.report_status = 'Reported' AND cp.post_type = 'report'")
            elif status == 'In Progress':
                where_clauses.append("cp.report_status = 'In Progress' AND cp.post_type = 'report'")

        if category and category != 'All':
            cat_map = {
                'Potholes': ['Pothole', 'Potholes', 'Road Crack', 'Road Cracks'],
                'Garbage': ['Garbage', 'Overflowing Dustbins', 'Garbage Overflow', 'Graffiti'],
                'Street Lights': ['Broken Street Light', 'Broken Street Lights', 'Electrical'],
                'Water Leakage': ['Water Leakage', 'Water Leak', 'Drainage Overflow']
            }
            cats = cat_map.get(category, [category])
            placeholders = ','.join(['%s'] * len(cats))
            where_clauses.append(f"cp.report_category IN ({placeholders})")
            params.extend(cats)

        if search and search.strip():
            s = f"%{search.strip()}%"
            where_clauses.append("""(
                cp.report_location LIKE %s OR cp.friendly_title LIKE %s OR
                cp.department_name LIKE %s OR cp.report_category LIKE %s
            )""")
            params.extend([s, s, s, s])

        where_str = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        sort_map = {
            'Newest': 'cp.created_at DESC',
            'Most Supported': 'cp.contributors_count DESC, cp.created_at DESC',
            'Recently Resolved': "CASE WHEN cp.post_type='resolved' THEN 0 ELSE 1 END ASC, cp.created_at DESC",
            'High Priority': 'cp.contributors_count DESC, cp.likes_count DESC',
            'Most Liked': 'cp.likes_count DESC, cp.created_at DESC'
        }
        order_by = sort_map.get(sort, 'cp.created_at DESC')

        cursor.execute(f"SELECT COUNT(*) as total FROM community_posts cp {where_str}", params)
        total = cursor.fetchone()['total'] or 0

        offset = (page - 1) * limit
        cursor.execute(
            f"SELECT cp.* FROM community_posts cp {where_str} ORDER BY {order_by} LIMIT %s OFFSET %s",
            params + [limit, offset]
        )
        rows = cursor.fetchall()

        liked_ids = set()
        if user_id and rows:
            post_ids = [r['id'] for r in rows]
            placeholders = ','.join(['%s'] * len(post_ids))
            cursor.execute(
                f"SELECT post_id FROM community_post_likes WHERE user_id = %s AND post_id IN ({placeholders})",
                [user_id] + post_ids
            )
            liked_ids = {row['post_id'] for row in cursor.fetchall()}

        posts = []
        for row in rows:
            posts.append({
                'id': row['id'],
                'report_id': row['report_id'],
                'post_type': row['post_type'],
                'author_type': row['author_type'],
                'department_id': row['department_id'],
                'title': row['title'],
                'friendly_title': row['friendly_title'],
                'content': row['content'],
                'report_post_caption': row['report_post_caption'],
                'resolution_post_caption': row['resolution_post_caption'],
                'image_before': row['image_before'],
                'image_after': row['image_after'],
                'report_status': row['report_status'],
                'report_category': row['report_category'],
                'report_location': row['report_location'],
                'department_name': row['department_name'],
                'officer_name': row['officer_name'],
                'road_damage_percentage': row['road_damage_percentage'],
                'resolution_time': row['resolution_time'],
                'contributors_count': row['contributors_count'] or 1,
                'likes_count': row['likes_count'] or 0,
                'comments_count': row['comments_count'] or 0,
                'views_count': row['views_count'] or 0,
                'has_liked': row['id'] in liked_ids,
                'created_at': _format_iso(row['created_at']),
                'updated_at': _format_iso(row['updated_at'])
            })

        return {
            'posts': posts,
            'total': total,
            'page': page,
            'limit': limit,
            'totalPages': math.ceil(total / limit) if total > 0 else 1
        }
    except Exception as e:
        print(f"Error in get_community_feed: {e}")
        return {'posts': [], 'total': 0, 'page': page, 'limit': limit, 'totalPages': 1}
    finally:
        cursor.close()
        conn.close()


def get_community_post_detail(post_id, user_id=None):
    """
    Returns full post details + comments + timeline + has_liked.
    """
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM community_posts WHERE id = %s", (post_id,))
        post = cursor.fetchone()
        if not post:
            return None

        cursor.execute("UPDATE community_posts SET views_count = views_count + 1 WHERE id = %s", (post_id,))
        conn.commit()

        cursor.execute("""
            SELECT c.id, c.comment, c.created_at,
                   u.full_name as author, u.profile_image as avatar
            FROM community_post_comments c
            LEFT JOIN users u ON u.id = c.user_id
            WHERE c.post_id = %s
            ORDER BY c.created_at DESC
        """, (post_id,))
        comments = [{
            'id': c['id'], 'comment': c['comment'],
            'author': c['author'] or 'Anonymous', 'avatar': c['avatar'],
            'created_at': _format_iso(c['created_at'])
        } for c in cursor.fetchall()]

        cursor.execute("""
            SELECT action, performed_by, remarks, created_at
            FROM report_workflow WHERE report_id = %s ORDER BY created_at ASC
        """, (post['report_id'],))
        timeline = [{
            'action': w['action'], 'performed_by': w['performed_by'],
            'remarks': w['remarks'], 'timestamp': _format_iso(w['created_at'])
        } for w in cursor.fetchall()]

        has_liked = False
        if user_id:
            cursor.execute(
                "SELECT id FROM community_post_likes WHERE post_id = %s AND user_id = %s",
                (post_id, user_id)
            )
            has_liked = cursor.fetchone() is not None

        return {
            'id': post['id'], 'report_id': post['report_id'],
            'post_type': post['post_type'], 'author_type': post['author_type'],
            'friendly_title': post['friendly_title'], 'title': post['title'],
            'content': post['content'],
            'report_post_caption': post['report_post_caption'],
            'resolution_post_caption': post['resolution_post_caption'],
            'image_before': post['image_before'], 'image_after': post['image_after'],
            'report_status': post['report_status'], 'report_category': post['report_category'],
            'report_location': post['report_location'], 'department_name': post['department_name'],
            'officer_name': post['officer_name'],
            'road_damage_percentage': post['road_damage_percentage'],
            'resolution_time': post['resolution_time'],
            'contributors_count': post['contributors_count'] or 1,
            'likes_count': post['likes_count'] or 0,
            'comments_count': post['comments_count'] or 0,
            'views_count': (post['views_count'] or 0) + 1,
            'has_liked': has_liked,
            'created_at': _format_iso(post['created_at']),
            'updated_at': _format_iso(post['updated_at']),
            'comments': comments,
            'timeline': timeline
        }
    except Exception as e:
        print(f"Error in get_community_post_detail: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def toggle_community_like(post_id, user_id):
    """Toggles like on a post. Returns (liked: bool, new_count: int)."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT id FROM community_post_likes WHERE post_id = %s AND user_id = %s",
            (post_id, user_id)
        )
        existing = cursor.fetchone()
        if existing:
            cursor.execute("DELETE FROM community_post_likes WHERE post_id = %s AND user_id = %s",
                           (post_id, user_id))
            cursor.execute("UPDATE community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = %s",
                           (post_id,))
            liked = False
        else:
            cursor.execute("INSERT INTO community_post_likes (post_id, user_id) VALUES (%s, %s)",
                           (post_id, user_id))
            cursor.execute("UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = %s",
                           (post_id,))
            liked = True

        cursor.execute("SELECT likes_count FROM community_posts WHERE id = %s", (post_id,))
        new_count = cursor.fetchone()['likes_count'] or 0
        conn.commit()
        return liked, new_count
    except Exception as e:
        conn.rollback()
        print(f"Error in toggle_community_like: {e}")
        return False, 0
    finally:
        cursor.close()
        conn.close()


def add_community_comment(post_id, user_id, comment_text):
    """Inserts a comment and increments comments_count. Returns comment dict."""
    import datetime
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            "INSERT INTO community_post_comments (post_id, user_id, comment) VALUES (%s, %s, %s)",
            (post_id, user_id, comment_text)
        )
        comment_id = cursor.lastrowid
        cursor.execute("UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = %s", (post_id,))
        cursor.execute("SELECT full_name, profile_image FROM users WHERE id = %s", (user_id,))
        user_row = cursor.fetchone()
        conn.commit()
        return {
            'id': comment_id, 'comment': comment_text,
            'author': user_row['full_name'] if user_row else 'Anonymous',
            'avatar': user_row['profile_image'] if user_row else None,
            'created_at': datetime.datetime.now().isoformat()
        }
    except Exception as e:
        conn.rollback()
        print(f"Error in add_community_comment: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_community_contributors(post_id):
    """Returns ordered list of contributors. Original Reporter first."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT ct.id, ct.user_id, ct.role, ct.area, ct.confidence, ct.created_at,
                   u.full_name as name, u.profile_image as avatar
            FROM community_post_contributors ct
            LEFT JOIN users u ON u.id = ct.user_id
            WHERE ct.post_id = %s
            ORDER BY FIELD(ct.role, 'Original Reporter', 'Supporter'), ct.created_at ASC
        """, (post_id,))
        return [{
            'id': r['id'], 'user_id': r['user_id'], 'role': r['role'],
            'name': r['name'] or 'Anonymous Citizen', 'avatar': r['avatar'],
            'area': r['area'] or 'Pune',
            'confidence': round(float(r['confidence'] or 0), 1),
            'created_at': _format_iso(r['created_at'])
        } for r in cursor.fetchall()]
    except Exception as e:
        print(f"Error in get_community_contributors: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_community_stats():
    """Returns live civic impact statistics + trending areas for the hero banner."""
    conn = get_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT COUNT(*) as cnt FROM reports WHERE duplicate_report_id IS NULL")
        issues_reported = cursor.fetchone()['cnt'] or 0

        cursor.execute("SELECT COUNT(*) as cnt FROM reports WHERE status IN ('Reported', 'In Progress')")
        live_issues = cursor.fetchone()['cnt'] or 0

        cursor.execute("SELECT COUNT(*) as cnt FROM reports WHERE status = 'Resolved'")
        issues_resolved = cursor.fetchone()['cnt'] or 0

        cursor.execute("SELECT COUNT(DISTINCT user_id) as cnt FROM reports")
        citizens_participated = cursor.fetchone()['cnt'] or 0

        cursor.execute("""
            SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, resolved_at)) as avg_sec
            FROM reports WHERE status = 'Resolved' AND resolved_at IS NOT NULL
        """)
        avg_sec_row = cursor.fetchone()['avg_sec']
        if avg_sec_row:
            avg_secs = float(avg_sec_row)
            if avg_secs < 3600:
                avg_resolution_time = f"{round(avg_secs / 60)} Mins"
            elif avg_secs < 86400:
                avg_resolution_time = f"{round(avg_secs / 3600, 1)} Hrs"
            else:
                avg_resolution_time = f"{round(avg_secs / 86400, 1)} Days"
        else:
            avg_resolution_time = "N/A"

        cursor.execute("SELECT AVG(ai_confidence) as avg_conf FROM reports WHERE ai_confidence IS NOT NULL")
        avg_conf_row = cursor.fetchone()['avg_conf']
        avg_ai_accuracy = f"{round(float(avg_conf_row), 1)}%" if avg_conf_row else "N/A"

        cursor.execute("""
            SELECT TRIM(SUBSTRING_INDEX(address, ',', 1)) as area, COUNT(*) as report_count
            FROM reports WHERE address IS NOT NULL AND address != ''
            GROUP BY TRIM(SUBSTRING_INDEX(address, ',', 1))
            ORDER BY report_count DESC LIMIT 6
        """)
        trending_areas = [{'area': r['area'], 'count': r['report_count']} for r in cursor.fetchall()]

        return {
            'issues_reported': issues_reported, 'live_issues': live_issues,
            'issues_resolved': issues_resolved, 'citizens_participated': citizens_participated,
            'avg_resolution_time': avg_resolution_time, 'avg_ai_accuracy': avg_ai_accuracy,
            'trending_areas': trending_areas
        }
    except Exception as e:
        print(f"Error in get_community_stats: {e}")
        return {
            'issues_reported': 0, 'live_issues': 0, 'issues_resolved': 0,
            'citizens_participated': 0, 'avg_resolution_time': 'N/A',
            'avg_ai_accuracy': 'N/A', 'trending_areas': []
        }
    finally:
        cursor.close()
        conn.close()
