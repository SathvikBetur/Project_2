"""
app.py
Flask Web Application & REST API Server for
Student Academic Performance Prediction and Early Intervention System.
"""

import os
import io
import json
import pandas as pd
from flask import Flask, render_template, request, jsonify, send_file

# Resolve local paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONTEND_TEMPLATES = os.path.join(BASE_DIR, "frontend", "templates")
FRONTEND_STATIC = os.path.join(BASE_DIR, "frontend", "static")

try:
    from backend.data_pipeline import get_or_create_dataset, compute_dataset_analytics, generate_synthetic_dataset
    from backend.models import model_manager, FEATURE_COLUMNS
    from backend.intervention import generate_intervention_plan
except ImportError:
    from data_pipeline import get_or_create_dataset, compute_dataset_analytics, generate_synthetic_dataset
    from models import model_manager, FEATURE_COLUMNS
    from intervention import generate_intervention_plan

app = Flask(
    __name__,
    template_folder=FRONTEND_TEMPLATES,
    static_folder=FRONTEND_STATIC
)

# Ensure models are trained and ready on startup
@app.before_request
def ensure_initialized():
    if not model_manager.is_trained:
        df = get_or_create_dataset()
        model_manager.train_and_evaluate_all(df)

@app.route("/")
def index():
    """Renders the main dashboard."""
    return render_template("index.html")

@app.route("/api/summary", methods=["GET"])
def get_summary():
    """Returns cohort summary statistics, correlations, and distributions."""
    try:
        df = get_or_create_dataset()
        analytics = compute_dataset_analytics(df)
        return jsonify({"status": "success", "data": analytics})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/models", methods=["GET"])
def get_models():
    """Returns comparison metrics for all regression and classification models."""
    try:
        if not model_manager.is_trained:
            model_manager.train_and_evaluate_all()
        return jsonify({
            "status": "success",
            "metrics": model_manager.metrics,
            "feature_importance": model_manager.feature_importance
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/features", methods=["GET"])
def get_features():
    """Returns factor importance rankings and linear weights."""
    try:
        if not model_manager.is_trained:
            model_manager.train_and_evaluate_all()
        return jsonify({
            "status": "success",
            "feature_importance": model_manager.feature_importance
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route("/api/predict", methods=["POST"])
def predict():
    """
    Predicts student score & performance category, identifies risk factors,
    and returns tailored prescriptive intervention strategies.
    """
    try:
        data = request.get_json() or {}
        student_name = data.get("student_name", "Student").strip() or "Student"
        student_id = data.get("student_id", "STU-TARGET").strip() or "STU-TARGET"

        # Validate & parse features
        features = {}
        for col in FEATURE_COLUMNS:
            val = data.get(col)
            if val is not None:
                features[col] = float(val)

        # Run dual ML inference
        pred_result = model_manager.predict_single(features)

        # Generate Early Intervention Plan
        intervention = generate_intervention_plan(pred_result, student_name=student_name, student_id=student_id)

        return jsonify({
            "status": "success",
            "prediction": pred_result,
            "intervention": intervention
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/predict-batch", methods=["POST"])
def predict_batch():
    """
    Runs batch predictions either from an uploaded CSV or generated cohort.
    """
    try:
        # Check if CSV file was uploaded
        if "file" in request.files and request.files["file"].filename != "":
            file = request.files["file"]
            df = pd.read_csv(file)
        else:
            # Generate demo batch of 200 records
            data = request.get_json(silent=True) or {}
            sample_size = int(data.get("sample_size", 200))
            df = generate_synthetic_dataset(n_samples=sample_size, random_state=123)

        results_df = model_manager.predict_batch(df)

        # Build summary
        cat_counts = results_df["predicted_category"].value_counts().to_dict()
        summary = {
            "total_evaluated": len(results_df),
            "at_risk_count": cat_counts.get("At Risk", 0),
            "average_count": cat_counts.get("Average", 0),
            "good_count": cat_counts.get("Good", 0),
            "avg_predicted_score": round(float(results_df["predicted_score"].mean()), 1)
        }

        # Keep relevant columns for payload
        cols_to_return = [
            "student_id", "attendance_rate", "internal_marks",
            "study_hours_weekly", "previous_gpa", "predicted_score", "predicted_category"
        ]
        available_cols = [c for c in cols_to_return if c in results_df.columns]
        students_list = results_df[available_cols].to_dict(orient="records")

        return jsonify({
            "status": "success",
            "summary": summary,
            "students": students_list
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

@app.route("/api/retrain", methods=["POST"])
def retrain_models():
    """Triggers complete model re-training and re-evaluation."""
    try:
        df = get_or_create_dataset(force_regenerate=True)
        metrics = model_manager.train_and_evaluate_all(df, force_retrain=True)
        return jsonify({
            "status": "success",
            "message": "Models successfully retrained and cached.",
            "metrics": metrics
        })
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    print("Starting Student Academic Performance Prediction & Early Intervention System...")
    app.run(host="127.0.0.1", port=5000, debug=True)
