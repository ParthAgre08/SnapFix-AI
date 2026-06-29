from ultralytics import YOLO


def main():
    model = YOLO("yolov8s.pt")

    model.train(
        data="dataset/data.yaml",
        epochs=1,
        plots=True
    )


if __name__ == "__main__":
    main()