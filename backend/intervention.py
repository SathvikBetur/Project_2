"""
intervention.py
Prescriptive Early Intervention Strategy Engine.
Generates tailored, multi-tiered educational interventions based on student risk classification,
performance predictions, and root-cause deficit factors.
"""

def generate_intervention_plan(prediction_result, student_name="Student", student_id=None):
    """
    Analyzes prediction output and raw student attributes to construct a prioritized,
    actionable intervention roadmap with targeted strategies and a 4-week timeline.
    """
    category = prediction_result.get("performance_category", "Average")
    score = prediction_result.get("predicted_score", 65.0)
    inputs = prediction_result.get("raw_inputs", {})

    attendance = float(inputs.get("attendance_rate", 75))
    internal = float(inputs.get("internal_marks", 60))
    study_hours = float(inputs.get("study_hours_weekly", 12))
    assignment_rate = float(inputs.get("assignment_completion_rate", 70))
    sleep = float(inputs.get("sleep_hours", 7.0))
    tutoring = int(inputs.get("tutoring_support", 0))
    participation = int(inputs.get("class_participation", 2))

    # Determine Urgency & Tier
    if category == "At Risk":
        urgency = "Tier 1: High Priority / Immediate Intervention"
        urgency_color = "danger"
        summary = (
            f"{student_name} is projected at a critical academic risk level ({score}/100). "
            f"Prompt proactive intervention is essential within 48-72 hours to prevent course failure or dropout."
        )
    elif category == "Average":
        urgency = "Tier 2: Moderate Priority / Targeted Support"
        urgency_color = "warning"
        summary = (
            f"{student_name} is performing at an average trajectory ({score}/100). "
            f"Targeted reinforcement and structured study habits will help bridge knowledge gaps to reach honors performance."
        )
    else:
        urgency = "Tier 3: Enrichment & Honors Track"
        urgency_color = "success"
        summary = (
            f"{student_name} demonstrates strong academic mastery ({score}/100). "
            f"Recommended for advanced enrichment, research opportunities, and peer mentoring roles."
        )

    # Specific Actionable Strategies based on root cause diagnostics
    strategies = []

    # 1. Attendance Action
    if attendance < 75.0:
        strategies.append({
            "title": "Attendance Recovery Protocol & Advisory Check-in",
            "priority": "Critical",
            "category": "Attendance & Engagement",
            "description": f"Current attendance is {attendance}%, breaching institutional 75% minimum threshold.",
            "actions": [
                "Mandatory weekly check-in meeting with the Academic Guidance Counselor.",
                "Automated attendance warning notification sent to student portal.",
                "Investigate potential transit, health, or personal impediments to lecture attendance.",
                "Enroll in lecture catch-up recordings and structured attendance recovery contracts."
            ]
        })
    elif attendance < 85.0:
        strategies.append({
            "title": "Attendance Stabilization",
            "priority": "Medium",
            "category": "Attendance & Engagement",
            "description": f"Attendance is {attendance}%. Maintaining steady presence is key for continuous assessment.",
            "actions": [
                "Set digital class schedule reminders 30 minutes before lecture periods.",
                "Review recorded seminars for any missed contact hours."
            ]
        })

    # 2. Internal Marks Remediation
    if internal < 50.0:
        strategies.append({
            "title": "Remedial Subject Clinic & Peer-Assisted Learning (PAL)",
            "priority": "Critical",
            "category": "Academic Performance",
            "description": f"Internal assessment score of {internal}/100 reveals conceptual deficit in core modules.",
            "actions": [
                "Assign 1-on-1 peer tutor for 3 hours of weekly guided problem-solving sessions.",
                "Attend mandatory bi-weekly faculty office hours for prerequisite clarification.",
                "Complete diagnostic practice problem sets with step-by-step solution keys.",
                "Permit one re-assessment opportunity following completion of remedial worksheets."
            ]
        })
    elif internal < 70.0:
        strategies.append({
            "title": "Concept Reinforcement & Quiz Review",
            "priority": "Moderate",
            "category": "Academic Performance",
            "description": f"Internal score ({internal}/100) indicates moderate comprehension with room for precision.",
            "actions": [
                "Form or join a study circle with 3-4 peers for collaborative test prep.",
                "Analyze previous test errors using an exam post-mortem worksheet.",
                "Engage in faculty office hours for difficult conceptual topics."
            ]
        })

    # 3. Study Hours & Time Management
    if study_hours < 8.0:
        strategies.append({
            "title": "Structured Time-Management & Study Habit Coaching",
            "priority": "High",
            "category": "Habits & Productivity",
            "description": f"Student logs only {study_hours} hrs/week of self-directed study (recommended: 15-20 hrs/week).",
            "actions": [
                "Conduct a 7-day time audit to identify time drains and non-productive hours.",
                "Implement Pomodoro technique (25 min focused study, 5 min break) for focused intervals.",
                "Block out fixed daily study slots (minimum 2 hours daily) in university library quiet zone.",
                "Install website blockers to prevent digital distraction during scheduled revision periods."
            ]
        })

    # 4. Assignment Completion
    if assignment_rate < 75.0:
        strategies.append({
            "title": "Milestone-Based Assignment Tracking",
            "priority": "High",
            "category": "Coursework Delivery",
            "description": f"Assignment submission rate is {assignment_rate}%, resulting in accumulated grade penalties.",
            "actions": [
                "Deconstruct major term assignments into 3-phase milestones (Outline, Draft, Final Submission).",
                "Enroll in university writing and problem-set tutoring lab 48 hours prior to due dates.",
                "Enable SMS calendar deadline triggers."
            ]
        })

    # 5. Wellness & Sleep Hygiene
    if sleep < 6.0:
        strategies.append({
            "title": "Cognitive Health & Sleep Hygiene Counseling",
            "priority": "Medium",
            "category": "Student Well-being",
            "description": f"Average sleep of {sleep} hrs/night impairs memory consolidation and exam stamina.",
            "actions": [
                "Establish a firm digital cut-off time at 10:30 PM to optimize REM sleep cycles.",
                "Offer a consultation with campus student wellness and stress management services.",
                "Encourage balanced caffeine consumption and regular circadian sleep scheduling."
            ]
        })

    # High Performer Track
    if category == "Good":
        strategies.append({
            "title": "Honors Track, Undergraduate Research & Leadership Mentorship",
            "priority": "Enrichment",
            "category": "Excellence & Growth",
            "description": f"Student is projected for top-tier academic standing ({score}/100).",
            "actions": [
                "Nominate for Departmental Undergraduate Research Assistantship or Lab Fellowship.",
                "Invite student to serve as a paid Peer Tutor or Class Representative.",
                "Recommend enrollment in advanced elective honors coursework or national collegiate competitions.",
                "Encourage participation in industry capstone showcases and professional networking seminars."
            ]
        })

    # 4-Week Milestone Action Plan
    four_week_plan = [
        {
            "week": "Week 1: Diagnosis & Alignment",
            "focus": "Diagnostic assessment and intervention agreement",
            "milestones": [
                "Sign academic improvement contract with advisor",
                "Audit study schedule and identify time bottlenecks",
                "Schedule first peer-tutoring appointment"
            ]
        },
        {
            "week": "Week 2: Habit Implementation",
            "focus": "Attendance correction and foundational catch-up",
            "milestones": [
                "Achieve 100% weekly attendance across all lecture & lab sections",
                "Complete backlogged problem sets for internal marks recovery",
                "Log minimum 12 hours of verified self-study"
            ]
        },
        {
            "week": "Week 3: Formative Assessment",
            "focus": "Mid-intervention mock testing and feedback",
            "milestones": [
                "Take practice midterm simulation under timed conditions",
                "Review error log with faculty instructor during office hours",
                "Submit all pending assignments 24 hours ahead of schedule"
            ]
        },
        {
            "week": "Week 4: Evaluation & Long-term Routine",
            "focus": "Outcome verification and sustained momentum",
            "milestones": [
                "Formal progress review meeting with department chair / advisor",
                "Re-evaluate performance forecast with updated internal scores",
                "Transition into continuous independent peer-study group"
            ]
        }
    ]

    return {
        "student_name": student_name,
        "student_id": student_id or "STU-TARGET",
        "predicted_score": score,
        "performance_category": category,
        "urgency_level": urgency,
        "urgency_color": urgency_color,
        "summary": summary,
        "strategies": strategies,
        "four_week_plan": four_week_plan
    }
