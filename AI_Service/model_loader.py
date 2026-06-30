import os

_sentence_model = None
_yolo_model = None

def get_sentence_model():
    """
    Lazy loads and caches the SentenceTransformer model.
    Prints status during initialization only.
    """
    global _sentence_model
    if _sentence_model is None:
        print("Loading SentenceTransformer...")
        from sentence_transformers import SentenceTransformer
        _sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
    return _sentence_model

def get_yolo_model():
    """
    Lazy loads and caches the YOLO model.
    Prints status during initialization only.
    """
    global _yolo_model
    if _yolo_model is None:
        print("Loading YOLO...")
        from ultralytics import YOLO
        model_path = os.path.join(os.path.dirname(__file__), 'models', 'best.pt')
        _yolo_model = YOLO(model_path)
    return _yolo_model
