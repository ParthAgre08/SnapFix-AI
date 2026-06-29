import os
import cv2
from ultralytics import YOLO

# Load the YOLO model once when the module is imported
# This ensures it's only loaded once per worker/process when Flask starts
MODEL_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models', 'best.pt')

try:
    print(f"Loading YOLO model from {MODEL_PATH}...")
    model = YOLO(MODEL_PATH)
    print("YOLO model loaded successfully.")
except Exception as e:
    print(f"Error loading YOLO model: {e}")
    model = None

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
        
        # Save annotated image
        res = results[0]
        annotated_img = res.plot()
        filename = os.path.basename(image_path)
        predictions_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads', 'predictions')
        os.makedirs(predictions_dir, exist_ok=True)
        annotated_path = os.path.join(predictions_dir, filename)
        cv2.imwrite(annotated_path, annotated_img)
        
        relative_annotated_path = f"uploads/predictions/{filename}"
        
        # Parse results
        for r in results:
            boxes = r.boxes
            for box in boxes:
                cls_id = int(box.cls[0])
                conf = float(box.conf[0])
                class_name = model.names[cls_id]
                xyxy = box.xyxy[0].tolist()
                
                det = {
                    "class": class_name,
                    "confidence": conf,
                    "bbox": [round(x, 2) for x in xyxy]
                }
                detections.append(det)
                
                if conf > max_conf:
                    max_conf = conf
                    best_detection = det
                    
        # If no objects are detected
        if not best_detection:
            return {
                "success": False,
                "message": "No supported civic issue detected."
            }
            
        # TODO: Replace this mapping with Gemini AI.
        
        class_name = best_detection["class"].lower()
        confidence_percent = int(best_detection["confidence"] * 100)
        
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
            "severity": mapping['severity'],
            "title": mapping['title'],
            "description": mapping['description'],
            "annotatedImage": relative_annotated_path,
            "detectionCount": len(detections),
            "detections": detections
        }
        
    except Exception as e:
        print(f"YOLO inference error: {e}")
        return {
            "success": False,
            "message": f"Error running detection: {str(e)}"
        }