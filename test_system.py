"""
test_system.py
Automated verification tests for the Student Academic Performance Prediction and Early Intervention System.
"""

import sys
import os
import json
import unittest

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from backend.app import app
from backend.models import model_manager
from backend.data_pipeline import get_or_create_dataset

class SystemVerificationTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = app.test_client()
        df = get_or_create_dataset()
        model_manager.train_and_evaluate_all(df)

    def test_01_index_page(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Student Academic Performance Prediction & Early Intervention System", response.data)
        self.assertIn(b"EduPredict AI", response.data)

    def test_02_summary_api(self):
        response = self.client.get("/api/summary")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["status"], "success")
        stats = data["data"]["stats"]
        self.assertGreater(stats["total_students"], 1000)
        self.assertIn("at_risk_count", stats)
        self.assertIn("avg_attendance", stats)
        # Check Pearson correlations
        corrs = data["data"]["correlations"]["final_score"]
        self.assertGreater(corrs["internal_marks"], 0.7)
        self.assertGreater(corrs["attendance_rate"], 0.4)

    def test_03_models_comparison_api(self):
        response = self.client.get("/api/models")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        metrics = data["metrics"]
        # Regression models checked
        self.assertIn("Linear Regression", metrics["regression"])
        self.assertIn("Decision Tree Regressor", metrics["regression"])
        self.assertIn("Random Forest Regressor", metrics["regression"])
        # Classification models checked
        self.assertIn("Logistic Regression", metrics["classification"])
        self.assertIn("Decision Tree Classifier", metrics["classification"])
        self.assertIn("Random Forest Classifier", metrics["classification"])
        self.assertIn("K-Nearest Neighbors (KNN)", metrics["classification"])
        # Verify metric thresholds
        self.assertGreater(metrics["regression"]["Linear Regression"]["r2"], 0.70)
        self.assertGreater(metrics["classification"]["Random Forest Classifier"]["accuracy"], 80.0)

    def test_04_factors_api(self):
        response = self.client.get("/api/features")
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        ranking = data["feature_importance"]["ranking"]
        self.assertGreater(len(ranking), 5)
        # Top factor is internal marks or attendance
        self.assertEqual(ranking[0]["feature"], "internal_marks")

    def test_05_predict_at_risk_student(self):
        payload = {
            "student_name": "Test At-Risk Student",
            "student_id": "STU-TEST-01",
            "attendance_rate": 48.0,
            "internal_marks": 32.0,
            "study_hours_weekly": 4.0,
            "previous_gpa": 2.1,
            "assignment_completion_rate": 40.0,
            "sleep_hours": 4.5,
            "tutoring_support": 0,
            "class_participation": 1,
            "extracurricular_hours": 15.0
        }
        response = self.client.post("/api/predict", json=payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        pred = data["prediction"]
        interv = data["intervention"]
        self.assertEqual(pred["performance_category"], "At Risk")
        self.assertLess(pred["predicted_score"], 50.0)
        self.assertIn("Tier 1", interv["urgency_level"])
        self.assertGreater(len(interv["strategies"]), 0)
        self.assertEqual(len(interv["four_week_plan"]), 4)

    def test_06_predict_good_student(self):
        payload = {
            "student_name": "Test High Performer",
            "student_id": "STU-TEST-02",
            "attendance_rate": 96.0,
            "internal_marks": 92.0,
            "study_hours_weekly": 24.0,
            "previous_gpa": 3.9,
            "assignment_completion_rate": 98.0,
            "sleep_hours": 7.5,
            "tutoring_support": 1,
            "class_participation": 3,
            "extracurricular_hours": 6.0
        }
        response = self.client.post("/api/predict", json=payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        pred = data["prediction"]
        interv = data["intervention"]
        self.assertEqual(pred["performance_category"], "Good")
        self.assertGreaterEqual(pred["predicted_score"], 75.0)
        self.assertIn("Tier 3", interv["urgency_level"])

    def test_07_batch_prediction_api(self):
        response = self.client.post("/api/predict-batch", json={"sample_size": 50})
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data["summary"]["total_evaluated"], 50)
        self.assertEqual(len(data["students"]), 50)

if __name__ == "__main__":
    unittest.main()
