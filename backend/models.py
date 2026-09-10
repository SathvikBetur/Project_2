"""
models.py
Trains, evaluates, and manages regression and classification machine learning models
for the Student Academic Performance Prediction and Early Intervention System.
"""

import os
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score,
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.tree import DecisionTreeRegressor, DecisionTreeClassifier
from sklearn.ensemble import RandomForestRegressor, RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier

try:
    from backend.data_pipeline import (
        get_or_create_dataset,
        FEATURE_COLUMNS,
        FEATURE_LABELS
    )
except ImportError:
    from data_pipeline import (
        get_or_create_dataset,
        FEATURE_COLUMNS,
        FEATURE_LABELS
    )

MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_CACHE_FILE = os.path.join(MODEL_DIR, "trained_models.joblib")

CATEGORY_LABELS = ["At Risk", "Average", "Good"]

class StudentModelManager:
    """
    Manages training, evaluation, persistence, and inference for all student performance models.
    """
    def __init__(self):
        self.scaler = None
        self.models = {}
        self.metrics = {}
        self.feature_importance = {}
        self.X_train_mean = None
        self.is_trained = False

    def train_and_evaluate_all(self, df=None, force_retrain=False):
        """
        Trains both regression and classification models following ML best practices:
        - Splits data into train and test BEFORE fitting scalers.
        - Evaluates models thoroughly with MAE, RMSE, R2, Accuracy, Precision, Recall, F1, and Confusion Matrices.
        """
        if not force_retrain and os.path.exists(MODEL_CACHE_FILE):
            try:
                cached = joblib.load(MODEL_CACHE_FILE)
                self.scaler = cached["scaler"]
                self.models = cached["models"]
                self.metrics = cached["metrics"]
                self.feature_importance = cached["feature_importance"]
                self.X_train_mean = cached["X_train_mean"]
                self.is_trained = True
                return self.metrics
            except Exception:
                pass

        if df is None:
            df = get_or_create_dataset()

        X = df[FEATURE_COLUMNS].copy()
        y_reg = df["final_score"].values
        y_cls = df["performance_category"].values

        # Strict featurization ordering: split before scaling
        X_train_raw, X_test_raw, y_reg_train, y_reg_test, y_cls_train, y_cls_test = train_test_split(
            X, y_reg, y_cls, test_size=0.2, random_state=42, stratify=y_cls
        )

        self.X_train_mean = X_train_raw.mean().to_dict()

        # Fit scaler ONLY on training data
        self.scaler = StandardScaler()
        X_train = self.scaler.fit_transform(X_train_raw)
        X_test = self.scaler.transform(X_test_raw)

        # -------------------------------------------------------------
        # 1. Regression Models (Linear Regression, Decision Tree, Random Forest)
        # -------------------------------------------------------------
        reg_models = {
            "Linear Regression": LinearRegression(),
            "Decision Tree Regressor": DecisionTreeRegressor(max_depth=5, random_state=42),
            "Random Forest Regressor": RandomForestRegressor(n_estimators=100, max_depth=6, random_state=42)
        }

        reg_metrics = {}
        for name, model in reg_models.items():
            model.fit(X_train, y_reg_train)
            preds = model.predict(X_test)

            mae = mean_absolute_error(y_reg_test, preds)
            rmse = np.sqrt(mean_squared_error(y_reg_test, preds))
            r2 = r2_score(y_reg_test, preds)

            reg_metrics[name] = {
                "mae": round(float(mae), 3),
                "rmse": round(float(rmse), 3),
                "r2": round(float(r2), 4),
                "r2_pct": round(float(r2) * 100, 2)
            }
            self.models[name] = model

        # -------------------------------------------------------------
        # 2. Classification Models (Logistic Regression, Decision Tree, Random Forest, KNN)
        # -------------------------------------------------------------
        cls_models = {
            "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
            "Decision Tree Classifier": DecisionTreeClassifier(max_depth=4, random_state=42),
            "Random Forest Classifier": RandomForestClassifier(n_estimators=100, max_depth=5, random_state=42),
            "K-Nearest Neighbors (KNN)": KNeighborsClassifier(n_neighbors=5)
        }

        cls_metrics = {}
        for name, model in cls_models.items():
            model.fit(X_train, y_cls_train)
            preds = model.predict(X_test)

            acc = accuracy_score(y_cls_test, preds)
            prec = precision_score(y_cls_test, preds, labels=CATEGORY_LABELS, average="weighted", zero_division=0)
            rec = recall_score(y_cls_test, preds, labels=CATEGORY_LABELS, average="weighted", zero_division=0)
            f1 = f1_score(y_cls_test, preds, labels=CATEGORY_LABELS, average="weighted", zero_division=0)

            # Confusion matrix
            cm = confusion_matrix(y_cls_test, preds, labels=CATEGORY_LABELS)

            cls_metrics[name] = {
                "accuracy": round(float(acc) * 100, 2),
                "precision": round(float(prec) * 100, 2),
                "recall": round(float(rec) * 100, 2),
                "f1_score": round(float(f1) * 100, 2),
                "confusion_matrix": cm.tolist(),
                "labels": CATEGORY_LABELS
            }
            self.models[name] = model

        # -------------------------------------------------------------
        # 3. Factor Importance & Feature Weights
        # -------------------------------------------------------------
        rf_reg = self.models["Random Forest Regressor"]
        rf_importances = rf_reg.feature_importances_

        lr_reg = self.models["Linear Regression"]
        lr_coefs = lr_reg.coef_

        feature_ranking = []
        for feat, imp, coef in zip(FEATURE_COLUMNS, rf_importances, lr_coefs):
            feature_ranking.append({
                "feature": feat,
                "label": FEATURE_LABELS.get(feat, feat),
                "importance": round(float(imp) * 100, 2),
                "linear_coefficient": round(float(coef), 3),
                "impact_direction": "Positive" if coef >= 0 else "Negative"
            })

        feature_ranking.sort(key=lambda x: x["importance"], reverse=True)
        self.feature_importance = {
            "ranking": feature_ranking,
            "top_factor": feature_ranking[0]["label"],
            "summary": (
                f"The most influential predictor of final academic performance is "
                f"'{feature_ranking[0]['label']}' accounting for {feature_ranking[0]['importance']}% of predictive weight, "
                f"followed by '{feature_ranking[1]['label']}' ({feature_ranking[1]['importance']}%) and "
                f"'{feature_ranking[2]['label']}' ({feature_ranking[2]['importance']}%)."
            )
        }

        self.metrics = {
            "regression": reg_metrics,
            "classification": cls_metrics,
            "test_sample_size": len(X_test_raw),
            "train_sample_size": len(X_train_raw)
        }

        # Cache to file
        joblib.dump({
            "scaler": self.scaler,
            "models": self.models,
            "metrics": self.metrics,
            "feature_importance": self.feature_importance,
            "X_train_mean": self.X_train_mean
        }, MODEL_CACHE_FILE)

        self.is_trained = True
        return self.metrics

    def predict_single(self, input_dict):
        """
        Runs dual prediction (Regression Score + Classification Risk Category)
        for a single student input, identifying key contributing factors.
        """
        if not self.is_trained:
            self.train_and_evaluate_all()

        # Build feature vector
        vector = []
        for col in FEATURE_COLUMNS:
            val = input_dict.get(col, self.X_train_mean.get(col, 0.0))
            vector.append(float(val))

        raw_df = pd.DataFrame([vector], columns=FEATURE_COLUMNS)
        scaled_vec = self.scaler.transform(raw_df)

        # 1. Best Regression Model: Random Forest Regressor & Linear Regression
        rf_reg = self.models["Random Forest Regressor"]
        lr_reg = self.models["Linear Regression"]
        pred_score_rf = float(rf_reg.predict(scaled_vec)[0])
        pred_score_lr = float(lr_reg.predict(scaled_vec)[0])
        final_predicted_score = round(np.clip(0.65 * pred_score_rf + 0.35 * pred_score_lr, 0, 100), 1)

        # 2. Best Classification Model: Random Forest Classifier
        rf_cls = self.models["Random Forest Classifier"]
        pred_category = str(rf_cls.predict(scaled_vec)[0])
        probs = rf_cls.predict_proba(scaled_vec)[0]
        prob_dict = {
            cls_name: round(float(p) * 100, 1)
            for cls_name, p in zip(rf_cls.classes_, probs)
        }

        # Ensure consistency between regression score and category
        if final_predicted_score < 50.0:
            category_tag = "At Risk"
        elif final_predicted_score >= 75.0:
            category_tag = "Good"
        else:
            category_tag = "Average"

        # 3. Factor Analysis for this specific student
        factors = []
        # Attendance check
        att = input_dict.get("attendance_rate", 75)
        if att < 70:
            factors.append({
                "factor": "Low Attendance",
                "impact": "Negative",
                "detail": f"Attendance is {att}%, significantly below the 75% institutional threshold."
            })
        elif att >= 90:
            factors.append({
                "factor": "Exemplary Attendance",
                "impact": "Positive",
                "detail": f"Attendance is {att}%, providing strong lecture continuity."
            })

        # Internal marks check
        internal = input_dict.get("internal_marks", 60)
        if internal < 45:
            factors.append({
                "factor": "Struggling Internal Assessments",
                "impact": "Negative",
                "detail": f"Internal score is {internal}/100, signaling foundational knowledge gaps."
            })
        elif internal >= 75:
            factors.append({
                "factor": "Strong Midterm Fundamentals",
                "impact": "Positive",
                "detail": f"Internal score is {internal}/100, showing firm grasp of core material."
            })

        # Study hours check
        study = input_dict.get("study_hours_weekly", 10)
        if study < 6:
            factors.append({
                "factor": "Insufficient Study Hours",
                "impact": "Negative",
                "detail": f"{study} hrs/week is insufficient for mastery."
            })
        elif study >= 18:
            factors.append({
                "factor": "High Independent Study Dedication",
                "impact": "Positive",
                "detail": f"{study} hrs/week of self-directed preparation."
            })

        # Previous GPA check
        gpa = input_dict.get("previous_gpa", 3.0)
        if gpa < 2.5:
            factors.append({
                "factor": "Historical Academic Vulnerability",
                "impact": "Negative",
                "detail": f"Prior GPA of {gpa} indicates persistent difficulty."
            })

        # Sleep check
        sleep = input_dict.get("sleep_hours", 7.0)
        if sleep < 5.5:
            factors.append({
                "factor": "Sleep Deprivation Risk",
                "impact": "Negative",
                "detail": f"Average sleep of {sleep} hours impairs cognitive retention and focus."
            })

        return {
            "predicted_score": final_predicted_score,
            "performance_category": category_tag,
            "category_probabilities": prob_dict,
            "contributing_factors": factors,
            "raw_inputs": input_dict
        }

    def predict_batch(self, df):
        """
        Batch prediction for a dataframe of students.
        """
        if not self.is_trained:
            self.train_and_evaluate_all()

        clean_df = df.copy()
        for col in FEATURE_COLUMNS:
            if col not in clean_df.columns:
                clean_df[col] = self.X_train_mean.get(col, 50.0)
            clean_df[col] = pd.to_numeric(clean_df[col], errors="coerce").fillna(self.X_train_mean.get(col, 50.0))

        X_batch = clean_df[FEATURE_COLUMNS]
        X_scaled = self.scaler.transform(X_batch)

        rf_reg = self.models["Random Forest Regressor"]
        lr_reg = self.models["Linear Regression"]
        pred_scores = np.clip(0.65 * rf_reg.predict(X_scaled) + 0.35 * lr_reg.predict(X_scaled), 0, 100).round(1)

        categories = []
        for s in pred_scores:
            if s < 50.0:
                categories.append("At Risk")
            elif s >= 75.0:
                categories.append("Good")
            else:
                categories.append("Average")

        clean_df["predicted_score"] = pred_scores
        clean_df["predicted_category"] = categories

        if "student_id" not in clean_df.columns:
            clean_df["student_id"] = [f"STU-{2000 + i}" for i in range(len(clean_df))]

        return clean_df

# Global singleton instance
model_manager = StudentModelManager()

if __name__ == "__main__":
    mm = StudentModelManager()
    metrics = mm.train_and_evaluate_all(force_retrain=True)
    print("=== REGRESSION MODEL COMPARISON ===")
    for k, v in metrics["regression"].items():
        print(f"{k}: R2={v['r2']} ({v['r2_pct']}%), MAE={v['mae']}, RMSE={v['rmse']}")

    print("\n=== CLASSIFICATION MODEL COMPARISON ===")
    for k, v in metrics["classification"].items():
        print(f"{k}: Acc={v['accuracy']}%, F1={v['f1_score']}%, Prec={v['precision']}%, Rec={v['recall']}%")

    print("\n=== FEATURE IMPORTANCE RANKING ===")
    for item in mm.feature_importance["ranking"]:
        print(f"{item['label']}: {item['importance']}% (Direction: {item['impact_direction']})")

    # Test single prediction
    test_student = {
        "attendance_rate": 55.0,
        "internal_marks": 38.0,
        "study_hours_weekly": 4.5,
        "previous_gpa": 2.2,
        "assignment_completion_rate": 45.0,
        "tutoring_support": 0,
        "class_participation": 1,
        "extracurricular_hours": 12.0,
        "sleep_hours": 5.0
    }
    result = mm.predict_single(test_student)
    print("\n=== TEST PREDICTION (At-Risk Candidate) ===")
    print(f"Predicted Score: {result['predicted_score']}/100")
    print(f"Category: {result['performance_category']}")
    print(f"Probabilities: {result['category_probabilities']}")
    print(f"Factors: {result['contributing_factors']}")
