import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

@app.route('/analyze-image', methods=['POST'])
def analyze_image():
    if 'image' not in request.files:
        return jsonify({"success": False, "message": "No image provided"}), 400
        
    image_file = request.files['image']
    
    # Save the image temporarily in AI_Service/uploads
    uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads')
    os.makedirs(uploads_dir, exist_ok=True)
    
    import datetime
    timestamp_str = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    original_name = image_file.filename or 'image.jpg'
    ext = os.path.splitext(original_name)[1] or '.jpg'
    random_hex = os.urandom(3).hex()
    filename = f"analyze_{timestamp_str}_{random_hex}{ext}"
    filepath = os.path.join(uploads_dir, filename)
    
    try:
        image_file.save(filepath)
    except Exception as e:
        return jsonify({"success": False, "message": f"Failed to save image in AI Service: {str(e)}"}), 500
        
    # Run YOLO detection service
    from services.yolo_service import analyze_image_with_yolo
    result = analyze_image_with_yolo(filepath)
    
    # Clean up the saved image file
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print(f"Warning: Could not remove temp file {filepath}: {e}")
        
    return jsonify(result)

@app.route('/check-duplicate', methods=['POST'])
def check_duplicate():
    data = request.json
    
    if not data or 'target' not in data or 'candidates' not in data:
        return jsonify({"success": False, "message": "Missing target or candidates in request"}), 400
        
    target = data['target']
    candidates = data['candidates']
    similarity_threshold = data.get('similarity_threshold', 0.85)
    
    try:
        from model_loader import get_sentence_model
        from services.duplicate_service import check_duplicate_stateless
        
        similarity_model = get_sentence_model()
        is_duplicate, duplicate_id, status, similarity_score = check_duplicate_stateless(
            target=target,
            candidates=candidates,
            similarity_model=similarity_model,
            similarity_threshold=similarity_threshold
        )
        return jsonify({
            "success": True,
            "isDuplicate": is_duplicate,
            "duplicateIssueId": duplicate_id,
            "existingStatus": status,
            "similarityScore": similarity_score
        })
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv("PORT", 5001))
    app.run(host='0.0.0.0', port=port)
