"""
data_pipeline.py
Handles data generation, loading, preprocessing, and statistical correlation analysis
for the Student Academic Performance Prediction and Early Intervention System.
"""

import os
import numpy as np
import pandas as pd

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE_PATH = os.path.join(DATA_DIR, "student_data.csv")

FEATURE_COLUMNS = [
    "attendance_rate",
    "internal_marks",
    "study_hours_weekly",
    "previous_gpa",
    "assignment_completion_rate",
    "tutoring_support",
    "class_participation",
    "extracurricular_hours",
    "sleep_hours"
]

FEATURE_LABELS = {
    "attendance_rate": "Attendance Rate (%)",
    "internal_marks": "Internal Assessment Marks (0-100)",
    "study_hours_weekly": "Weekly Study Hours",
    "previous_gpa": "Previous GPA (0.0 - 4.0)",
    "assignment_completion_rate": "Assignment Completion Rate (%)",
    "tutoring_support": "Tutoring Support (0=No, 1=Yes)",
    "class_participation": "Class Participation (1=Low, 2=Med, 3=High)",
    "extracurricular_hours": "Extracurricular Hours / Week",
    "sleep_hours": "Average Sleep Hours / Day"
}

def generate_synthetic_dataset(n_samples=1200, random_state=42):
    """
    Generates a realistic educational dataset modeling real-world correlations
    among attendance, internal marks, study hours, past GPA, and academic engagement.
    """
    np.random.seed(random_state)

    # 1. Attendance rate (skewed towards higher attendance, with a struggling tail)
    attendance_rate = np.clip(np.random.beta(6, 2, n_samples) * 100, 35, 100).round(1)

    # 2. Previous GPA (2.0 to 4.0 bell curve centered ~3.1)
    previous_gpa = np.clip(np.random.normal(3.05, 0.45, n_samples), 1.8, 4.0).round(2)

    # 3. Weekly Study Hours (correlated with previous GPA + independent variability)
    study_noise = np.random.gamma(3, 2, n_samples)
    study_hours_weekly = np.clip(2 + (previous_gpa - 1.8) * 4.5 + study_noise, 2, 35).round(1)

    # 4. Assignment Completion Rate (correlated with attendance & study hours)
    assignment_rate = np.clip(
        0.55 * attendance_rate + 1.2 * study_hours_weekly + np.random.normal(10, 8, n_samples),
        25, 100
    ).round(1)

    # 5. Internal Marks (strongly correlated with study hours, attendance, and past GPA)
    internal_raw = (
        0.38 * attendance_rate +
        0.35 * (previous_gpa / 4.0 * 100) +
        1.1 * study_hours_weekly +
        0.15 * assignment_rate +
        np.random.normal(0, 6.0, n_samples) - 15
    )
    internal_marks = np.clip(internal_raw, 18, 98).round(1)

    # 6. Tutoring Support (struggling or highly motivated students often have tutoring)
    p_tutoring = np.where(internal_marks < 55, 0.45, np.where(internal_marks > 85, 0.35, 0.20))
    tutoring_support = (np.random.rand(n_samples) < p_tutoring).astype(int)

    # 7. Class Participation (1=Low, 2=Medium, 3=High)
    part_score = 0.02 * attendance_rate + 0.02 * internal_marks + np.random.normal(0, 0.6, n_samples)
    class_participation = np.digitize(part_score, bins=[2.0, 3.2]) + 1
    class_participation = np.clip(class_participation, 1, 3)

    # 8. Extracurricular Hours
    extracurricular_hours = np.clip(np.random.normal(8, 4, n_samples), 0, 25).round(1)

    # 9. Sleep hours (optimal around 7.2 hrs)
    sleep_hours = np.clip(np.random.normal(7.0, 1.2, n_samples), 4.0, 10.0).round(1)

    # 10. True Final Exam Performance (continuous target out of 100)
    # Balanced educational distribution with realistic standard deviation (~13)
    score = (
        0.35 * internal_marks +
        0.24 * attendance_rate +
        0.75 * np.minimum(study_hours_weekly, 22) +
        3.8 * (previous_gpa / 4.0 * 10) +
        0.08 * assignment_rate +
        2.0 * tutoring_support +
        1.5 * class_participation -
        np.where(sleep_hours < 5.0, (5.0 - sleep_hours) * 3.0, 0) +
        np.random.normal(0, 4.2, n_samples) - 22.0
    )
    final_score = np.clip(score, 15.0, 99.0).round(1)

    # 11. Performance Category (Categorical target for classification)
    # At Risk: < 50
    # Average: 50 <= score < 75
    # Good: >= 75
    conditions = [
        (final_score < 50.0),
        (final_score >= 50.0) & (final_score < 75.0),
        (final_score >= 75.0)
    ]
    categories = ["At Risk", "Average", "Good"]
    performance_category = np.select(conditions, categories, default="Average")

    df = pd.DataFrame({
        "student_id": [f"STU-{1000 + i}" for i in range(n_samples)],
        "attendance_rate": attendance_rate,
        "internal_marks": internal_marks,
        "study_hours_weekly": study_hours_weekly,
        "previous_gpa": previous_gpa,
        "assignment_completion_rate": assignment_rate,
        "tutoring_support": tutoring_support,
        "class_participation": class_participation,
        "extracurricular_hours": extracurricular_hours,
        "sleep_hours": sleep_hours,
        "final_score": final_score,
        "performance_category": performance_category
    })

    return df

def get_or_create_dataset(force_regenerate=False):
    """Loads existing dataset or generates fresh benchmark data."""
    if not force_regenerate and os.path.exists(DATA_FILE_PATH):
        try:
            return pd.read_csv(DATA_FILE_PATH)
        except Exception:
            pass

    df = generate_synthetic_dataset(n_samples=1200)
    df.to_csv(DATA_FILE_PATH, index=False)
    return df

def compute_dataset_analytics(df):
    """Computes high-level cohort statistics, distributions, and correlation matrix."""
    total_students = len(df)
    category_counts = df["performance_category"].value_counts().to_dict()

    at_risk_count = category_counts.get("At Risk", 0)
    average_count = category_counts.get("Average", 0)
    good_count = category_counts.get("Good", 0)

    stats = {
        "total_students": total_students,
        "at_risk_count": at_risk_count,
        "at_risk_percentage": round((at_risk_count / total_students) * 100, 1),
        "average_count": average_count,
        "average_percentage": round((average_count / total_students) * 100, 1),
        "good_count": good_count,
        "good_percentage": round((good_count / total_students) * 100, 1),
        "avg_attendance": round(float(df["attendance_rate"].mean()), 1),
        "avg_internal_marks": round(float(df["internal_marks"].mean()), 1),
        "avg_study_hours": round(float(df["study_hours_weekly"].mean()), 1),
        "avg_final_score": round(float(df["final_score"].mean()), 1),
        "median_final_score": round(float(df["final_score"].median()), 1),
    }

    # Pearson correlation matrix for key variables
    corr_cols = [
        "attendance_rate",
        "internal_marks",
        "study_hours_weekly",
        "previous_gpa",
        "assignment_completion_rate",
        "final_score"
    ]
    corr_matrix = df[corr_cols].corr().round(3).to_dict()

    # Scatter sample for visualization (capped at 150 points for snappy rendering)
    scatter_sample = df.sample(min(150, len(df)), random_state=42)[
        ["student_id", "attendance_rate", "internal_marks", "study_hours_weekly", "final_score", "performance_category"]
    ].to_dict(orient="records")

    # Category distributions by study hours
    study_buckets = {
        "< 8 hrs": df[df["study_hours_weekly"] < 8]["performance_category"].value_counts().to_dict(),
        "8-15 hrs": df[(df["study_hours_weekly"] >= 8) & (df["study_hours_weekly"] < 15)]["performance_category"].value_counts().to_dict(),
        "15-22 hrs": df[(df["study_hours_weekly"] >= 15) & (df["study_hours_weekly"] < 22)]["performance_category"].value_counts().to_dict(),
        "> 22 hrs": df[df["study_hours_weekly"] >= 22]["performance_category"].value_counts().to_dict(),
    }

    return {
        "stats": stats,
        "correlations": corr_matrix,
        "scatter_sample": scatter_sample,
        "study_buckets": study_buckets,
        "sample_rows": df.head(10).to_dict(orient="records")
    }

if __name__ == "__main__":
    df = get_or_create_dataset(force_regenerate=True)
    analytics = compute_dataset_analytics(df)
    print(f"Dataset generated successfully with {len(df)} records.")
    print("Cohort Stats:", analytics["stats"])
    print("Correlations with Final Score:")
    for k, v in analytics["correlations"]["final_score"].items():
        print(f"  {k}: {v}")
