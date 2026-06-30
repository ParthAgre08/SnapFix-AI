import os
import cv2
import base64

# Temporary mapping until Gemini is integrated
CLASS_MAPPING = {
    'pothole': {
        'issueType': 'Pothole',
        'severity': 'High',
        'title': 'Large Road Pothole',
        'description': 'AI detected a pothole on the road that may require municipal repair.'
    },
    'garbage': {
        'issueType': 'Garbage',
        'severity': 'Medium',
        'title': 'Illegal Garbage Dump',
        'description': 'Garbage accumulation detected.'
    },
    'broken_street_light': {
        'issueType': 'Broken Street Light',
        'severity': 'Medium',
        'title': 'Broken Street Light',
        'description': 'Street light appears damaged.'
    }
}

def analyze_image_with_yolo(image_path):
    # Dynamic import of model loader to avoid startup import
    import sys
    sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from model_loader import get_yolo_model
    
    model = get_yolo_model()
    if not model:
        return {
            "success": False,
            "message": "YOLO model failed to load internally."
        }
    
    try:
        # Run inference
        results = model(image_path)
        
        detections = []
        best_detection = None
        max_conf = -1
        
        res = results[0]
        annotated_img = res.plot()
        
        # Base64 encode the annotated image
        ext = os.path.splitext(image_path)[1] or '.jpg'
        _, buffer = cv2.imencode(ext, annotated_img)
        annotated_base64 = base64.b64encode(buffer).decode('utf-8')
        
        # Get image dimensions to compute relative bounding box size
        img_h, img_w = res.orig_shape if hasattr(res, 'orig_shape') else (None, None)
        
        # Parse results
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                class_name = model.names[cls_id]
                xyxy = box.xyxy[0].tolist()
                
                # Calculate estimated size programmatically
                x1, y1, x2, y2 = xyxy
                box_area = (x2 - x1) * (y2 - y1)
                size_label = "Medium"
                
                if img_w and img_h:
                    img_area = img_w * img_h
                    ratio = box_area / img_area
                    if ratio < 0.05:
                        size_label = "Small"
                    elif ratio < 0.15:
                        size_label = "Medium"
                    else:
                        size_label = "Large"
                    damage_percentage = round(ratio * 100)
                else:
                    if box_area < 20000:
                        size_label = "Small"
                        ratio = box_area / 409600
                    elif box_area < 60000:
                        size_label = "Medium"
                        ratio = box_area / 409600
                    else:
                        size_label = "Large"
                        ratio = box_area / 409600
                    damage_percentage = round(ratio * 100)
                
                # Ensure percentage is at least 1%
                damage_percentage = max(1, damage_percentage)
                
                det = {
                    "class": class_name,
                    "confidence": conf,
                    "bbox": [round(x, 2) for x in xyxy],
                    "size": size_label,
                    "road_damage_percentage": f"{damage_percentage}%"
                }
                detections.append(det)
                
                if conf > max_conf:
                    max_conf = conf
                    best_detection = det
                    best_damage_percentage = damage_percentage
                    
        # If no objects are detected
        if not best_detection:
            return {
                "success": False,
                "message": "No supported civic issue detected."
            }
            
        class_name = best_detection["class"].lower()
        confidence_percent = int(best_detection["confidence"] * 100)
        best_size = best_detection["size"]
        best_percentage_str = best_detection["road_damage_percentage"]
        
        # Fallback if class not in mapping
        mapping = CLASS_MAPPING.get(class_name, {
            'issueType': class_name.capitalize(),
            'severity': 'Low',
            'title': f'Detected {class_name}',
            'description': f'AI detected {class_name} in the provided image.'
        })
        
        return {
            "success": True,
            "issueType": mapping['issueType'],
            "confidence": confidence_percent,
            "estimatedSize": best_size,
            "roadDamagePercentage": best_percentage_str,
            "severity": mapping['severity'],
            "title": mapping['title'],
            "description": mapping['description'],
            "annotatedImage": f"uploads/annotated/{os.path.basename(image_path)}",
            "annotatedImageBase64": annotated_base64,
            "detectionCount": len(detections),
            "detections": detections
        }
        
    except Exception as e:
        print(f"YOLO inference error: {e}")
        return {
            "success": False,
            "message": f"Error running detection: {str(e)}"
        }
