from geopy.distance import geodesic
import numpy as np

def compute_cosine_similarity(vec1, vec2):
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))

def check_duplicate_stateless(target, candidates, similarity_model, similarity_threshold=0.85):
    """
    Check if target report is a duplicate of any active reports in the candidates list.
    target: {"description": str, "latitude": float, "longitude": float}
    candidates: list of {"id": int, "description": str, "latitude": float, "longitude": float, "status": str}
    """
    if not similarity_model or not target or not candidates:
        return False, None, None, 0.0

    target_desc = target.get('description')
    target_lat = target.get('latitude')
    target_lon = target.get('longitude')
    
    if not target_desc or target_lat is None or target_lon is None:
        return False, None, None, 0.0

    try:
        # Encode target description
        target_embedding = similarity_model.encode(target_desc).tolist()
        
        for candidate in candidates:
            cand_id = candidate.get('id')
            cand_desc = candidate.get('description')
            cand_lat = candidate.get('latitude')
            cand_lon = candidate.get('longitude')
            cand_status = candidate.get('status')
            
            if cand_lat is None or cand_lon is None or not cand_desc:
                continue
                
            # Geographic distance check
            distance = geodesic((target_lat, target_lon), (cand_lat, cand_lon)).meters
            
            if distance <= 100:
                cand_embedding = similarity_model.encode(cand_desc).tolist()
                similarity = compute_cosine_similarity(target_embedding, cand_embedding)
                if similarity > similarity_threshold:
                    return True, cand_id, cand_status, float(similarity)
                    
        return False, None, None, 0.0
    except Exception as e:
        print(f"Error in check_duplicate_stateless: {e}")
        return False, None, None, 0.0
