from ultralytics import YOLO

model = YOLO("models/best.pt")

results = model.predict(
    source="models/83_jpg.rf.ccb58d875b4935092e06f7adf3e18792.jpg",
    conf=0.90,
    save=True
)

print(results[0].boxes)

