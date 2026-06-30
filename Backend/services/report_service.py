import os
from services import gemini_service
from services import database_service

def generate_fallback_report(issue_type, user_description=None):
    """
    Generates fallback report details when Gemini Vision API fails.
    """
    title = f"Detected {issue_type}"
    base_desc = f"A {issue_type.lower()} has been detected by the AI system. Municipal inspection is recommended."
    
    if user_description:
        description = f"{user_description} (System Note: {base_desc})"
    else:
        description = base_desc
        
    return {
        "title": title,
        "description": description,
        "severity": "Medium",
        "priority": "Medium",
        "recommended_action": "Schedule an inspection and repair."
    }

def create_report(user_id, image_path, annotated_image, latitude, longitude, address, 
                  issue_type, confidence, detection_count, bounding_boxes, estimated_size, 
                  road_damage_percentage="18%", user_description=None, similarity_model=None):
    """
    Coordinates YOLO output and Gemini response, runs duplicate checks,
    and commits the report to the database.
    """
    # 1. Validation
    if not user_id:
        raise ValueError("User ID is required.")
    if not image_path:
        raise ValueError("Uploaded image path is required.")
    if not issue_type:
        raise ValueError("Detected issue type is required.")
    if latitude is None or longitude is None:
        raise ValueError("Latitude and Longitude are required.")

    # Convert coordinates to floats
    try:
        lat = float(latitude)
        lon = float(longitude)
    except (ValueError, TypeError):
        raise ValueError("Invalid latitude or longitude.")

    # Clean description input
    user_desc_clean = user_description.strip() if user_description else ""

    # 2. Build Location String for Gemini Prompt
    location_str = address if address else f"Coordinates: {lat:.6f}, {lon:.6f}"

    # 3. Call Gemini Vision API
    # Send original image path, YOLO category, confidence, object count, location, and user description
    gemini_result = gemini_service.generate_gemini_report(
        image_path=image_path,
        issue_type=issue_type,
        confidence=confidence,
        count=detection_count,
        location=location_str,
        bounding_boxes=bounding_boxes,
        road_damage_percentage=road_damage_percentage,
        user_description=user_desc_clean if user_desc_clean else None
    )

    if gemini_result:
        # Use Gemini generated report content
        ai_title = gemini_result.get("title")
        ai_desc = gemini_result.get("description")
        severity = gemini_result.get("severity", "Medium")
        priority = gemini_result.get("priority", "Medium")
        recommended_action = gemini_result.get("recommended_action")
        social_caption = gemini_result.get("social_caption") or gemini_result.get("ai_social_caption")
        road_damage_pct = gemini_result.get("road_damage_percentage") or road_damage_percentage
        raw_response = gemini_result.get("raw_content")
        
        # In case Gemini forgot to merge user description, report_service will double-check
        # or rely on Gemini instructions to have merged it.
    else:
        # 4. Fallback to YOLO + Default details on Gemini error or if API key is not configured
        print("Using fallback report details...")
        fallback = generate_fallback_report(issue_type, user_desc_clean)
        ai_title = fallback["title"]
        ai_desc = fallback["description"]
        severity = fallback["severity"]
        priority = fallback["priority"]
        recommended_action = fallback["recommended_action"]
        social_caption = f"Urgent: {issue_type} reported at {location_str}. Please be careful!"
        road_damage_pct = road_damage_percentage
        raw_response = None

    # 5. Duplicate Check
    # Check if a similar issue exists within 100 meters
    try:
        # Fetch candidate reports from database
        recent_issues = database_service.get_unresolved_reports_for_duplicate_check()
        
        # Format the candidates for the stateless AI Service
        candidates = []
        for issue in recent_issues:
            candidates.append({
                "id": issue["id"],
                "latitude": float(issue["latitude"]) if issue["latitude"] is not None else None,
                "longitude": float(issue["longitude"]) if issue["longitude"] is not None else None,
                "description": issue.get("user_description") or issue.get("description"),
                "status": issue.get("status")
            })
            
        # Call the AI Service
        import requests
        ai_service_url = os.getenv("AI_SERVICE_URL")
        if not ai_service_url:
            raise Exception("AI_SERVICE_URL environment variable is not configured.")
            
        payload = {
            "target": {
                "latitude": lat,
                "longitude": lon,
                "description": user_desc_clean if user_desc_clean else ai_desc
            },
            "candidates": candidates
        }
        
        response = requests.post(f"{ai_service_url.rstrip('/')}/check-duplicate", json=payload, timeout=60)
        response.raise_for_status()
        res_data = response.json()
        
        is_duplicate = res_data.get("isDuplicate", False)
        duplicate_issue_id = res_data.get("duplicateIssueId")
        similarity_score = res_data.get("similarityScore", 0.0)
    except Exception as e:
        print(f"Error checking duplicate during report creation: {e}")
        is_duplicate = False
        duplicate_issue_id = None
        similarity_score = 0.0

    status = 'Duplicate' if is_duplicate else 'Reported'

    # 6. Database Persistence via database_service
    report_id = database_service.save_report_transaction(
        user_id=int(user_id),
        title=ai_title,
        description=ai_desc, # stored in main description
        category=issue_type,
        address=address,
        latitude=lat,
        longitude=lon,
        image_path=image_path,
        status=status,
        ai_confidence=float(confidence),
        annotated_image=annotated_image,
        detection_count=int(detection_count),
        bounding_boxes=bounding_boxes,
        severity=severity,
        priority=priority,
        recommended_action=recommended_action,
        ai_social_caption=social_caption,
        road_damage_percentage=road_damage_pct,
        ai_response_json=raw_response,
        user_description=user_desc_clean,
        duplicate_report_id=duplicate_issue_id,
        similarity_score=similarity_score
    )

    # 7. Community Feed Integration (automatic, non-blocking)
    try:
        # Resolve department info from category
        category_lower = (issue_type or "").lower()
        if any(c in category_lower for c in ['pothole', 'road', 'crack']):
            dept_name = 'Road Department'
        elif any(c in category_lower for c in ['garbage', 'sanit', 'graffiti']):
            dept_name = 'Sanitation'
        elif any(c in category_lower for c in ['electric', 'streetlight', 'lamp', 'wire']):
            dept_name = 'Electrical'
        elif any(c in category_lower for c in ['water', 'drainage']):
            dept_name = 'Water Department'
        else:
            dept_name = 'Road Department'

        # Lookup department id
        dept_id = None
        try:
            dept_lookup = database_service.get_connection()
            dept_cursor = dept_lookup.cursor(dictionary=True)
            dept_cursor.execute("SELECT id FROM departments WHERE name = %s", (dept_name,))
            dept_row = dept_cursor.fetchone()
            dept_id = dept_row['id'] if dept_row else None
            dept_cursor.close()
            dept_lookup.close()
        except Exception:
            pass

        location_str = address if address else f"{lat:.6f}, {lon:.6f}"
        short_area = location_str.split(',')[0].strip() if ',' in location_str else location_str

        if is_duplicate and duplicate_issue_id:
            # Add as contributor to existing post
            database_service.handle_duplicate_community_post(
                original_report_id=duplicate_issue_id,
                new_report_id=report_id,
                user_id=int(user_id),
                confidence=float(confidence or 0),
                area=short_area
            )
        else:
            # Generate community report caption
            report_post_caption = gemini_service.generate_report_post_caption(
                category=issue_type,
                location=location_str,
                department=dept_name,
                ai_description=ai_desc,
                contributor_count=1,
                confidence=confidence
            )
            # Create fresh community post
            database_service.create_community_report_post(
                report_id=report_id,
                user_id=int(user_id),
                category=issue_type,
                location=location_str,
                image_before=image_path,
                department_id=dept_id,
                department_name=dept_name,
                report_post_caption=report_post_caption,
                ai_description=ai_desc,
                road_damage_percentage=road_damage_pct,
                confidence=float(confidence or 0)
            )
    except Exception as e:
        # Community post creation is non-critical — log and continue
        print(f"Warning: Community post auto-creation failed for report {report_id}: {e}")

    # 8. Fetch the fully saved database record to return
    saved_report = database_service.get_report_by_id(report_id)
    
    return {
        "success": True,
        "isDuplicate": is_duplicate,
        "issueId": report_id,
        "message": "This issue has already been reported. Your report has been linked to the existing issue." if is_duplicate else "Report generated successfully.",
        "report": saved_report
    }
