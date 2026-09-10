"""
run.py
Convenient entry point for the Student Academic Performance Prediction and Early Intervention System.
Initializes data, models, and starts the local web server.
"""

import sys
import os

# Add root directory to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app import app
from backend.data_pipeline import get_or_create_dataset
from backend.models import model_manager

def main():
    print("=" * 70)
    print("Student Academic Performance Prediction and Early Intervention System")
    print("=" * 70)
    print("[1/3] Checking benchmark dataset...")
    df = get_or_create_dataset()
    print(f"      Dataset ready ({len(df)} student records).")

    print("[2/3] Training and loading ML models (Regression & Classification)...")
    model_manager.train_and_evaluate_all(df)
    print("      Models ready:")
    print("      - Regression: Linear Regression, Decision Tree, Random Forest")
    print("      - Classification: Logistic Regression, Decision Tree, Random Forest, KNN")

    port = 5000
    print(f"[3/3] Starting web server at http://127.0.0.1:{port}")
    print(f"      Access dashboard in your web browser: http://localhost:{port}")
    print("=" * 70)
    app.run(host="0.0.0.0", port=port, debug=False)

if __name__ == "__main__":
    main()
