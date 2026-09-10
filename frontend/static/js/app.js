/**
 * app.js
 * Frontend logic and Chart.js visualizations for
 * Student Academic Performance Prediction and Early Intervention System
 */

document.addEventListener("DOMContentLoaded", () => {
  // Global State
  const state = {
    summary: null,
    models: null,
    features: null,
    batchStudents: [],
    charts: {},
    currentPrediction: null,
    batchCurrentPage: 1,
    batchPageSize: 25,
    batchSortColumn: null,
    batchSortDirection: "asc"
  };

  // -------------------------------------------------------------
  // 1. Theme Management (Dark / Light)
  // -------------------------------------------------------------
  const themeToggleBtn = document.getElementById("theme-toggle");
  const htmlElem = document.documentElement;

  const savedTheme = localStorage.getItem("edupredict_theme") || "dark";
  htmlElem.setAttribute("data-theme", savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const currentTheme = htmlElem.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    htmlElem.setAttribute("data-theme", newTheme);
    localStorage.setItem("edupredict_theme", newTheme);
    showToast(`Switched to ${newTheme} mode`);
    // Refresh charts for theme colors
    refreshAllCharts();
    if (window.ThreeSceneManager && typeof window.ThreeSceneManager.updateTheme === "function") {
      window.ThreeSceneManager.updateTheme(newTheme);
    }
  });

  // -------------------------------------------------------------
  // 2. Tab Navigation
  // -------------------------------------------------------------
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-panel");

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      tabButtons.forEach(b => b.classList.remove("active"));
      tabPanels.forEach(p => p.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      const targetPanel = document.getElementById(tabId);
      if (targetPanel) {
        targetPanel.classList.add("active");
      }

      // Re-render / update chart layouts and 3D scenes when switching tabs
      window.dispatchEvent(new Event("resize"));
      setTimeout(() => {
        if (window.ThreeSceneManager && typeof window.ThreeSceneManager.handleResize === "function") {
          window.ThreeSceneManager.handleResize();
        }
      }, 60);
    });
  });

  // -------------------------------------------------------------
  // 3. Slider Binding & Value Displays
  // -------------------------------------------------------------
  function setupSlider(sliderId, displayId, formatter) {
    const slider = document.getElementById(sliderId);
    const display = document.getElementById(displayId);
    if (!slider || !display) return;

    slider.addEventListener("input", () => {
      display.textContent = formatter(slider.value);
    });
  }

  setupSlider("input-attendance", "disp-attendance", v => `${v}%`);
  setupSlider("input-internal", "disp-internal", v => `${v} / 100`);
  setupSlider("input-study-hours", "disp-study-hours", v => `${parseFloat(v).toFixed(1)} hrs`);
  setupSlider("input-gpa", "disp-gpa", v => parseFloat(v).toFixed(2));
  setupSlider("input-assignments", "disp-assignments", v => `${v}%`);
  setupSlider("input-sleep", "disp-sleep", v => `${parseFloat(v).toFixed(1)} hrs`);

  // -------------------------------------------------------------
  // 4. Quick Presets for Single Student Prediction
  // -------------------------------------------------------------
  const presets = {
    atRisk: {
      name: "Marcus Vance",
      id: "STU-1042",
      attendance: 52,
      internal: 34,
      study: 4.5,
      gpa: 2.15,
      assignments: 45,
      sleep: 5.0,
      tutoring: 0,
      participation: 1,
      extra: 14
    },
    average: {
      name: "Sarah Jenkins",
      id: "STU-1088",
      attendance: 78,
      internal: 62,
      study: 12.0,
      gpa: 3.10,
      assignments: 78,
      sleep: 6.5,
      tutoring: 0,
      participation: 2,
      extra: 8
    },
    good: {
      name: "Elena Rostova",
      id: "STU-1195",
      attendance: 96,
      internal: 91,
      study: 22.5,
      gpa: 3.88,
      assignments: 98,
      sleep: 7.5,
      tutoring: 1,
      participation: 3,
      extra: 6
    }
  };

  function applyPreset(preset) {
    document.getElementById("input-student-name").value = preset.name;
    document.getElementById("input-student-id").value = preset.id;

    const setSlider = (id, val) => {
      const el = document.getElementById(id);
      if (el) {
        el.value = val;
        el.dispatchEvent(new Event("input"));
      }
    };

    setSlider("input-attendance", preset.attendance);
    setSlider("input-internal", preset.internal);
    setSlider("input-study-hours", preset.study);
    setSlider("input-gpa", preset.gpa);
    setSlider("input-assignments", preset.assignments);
    setSlider("input-sleep", preset.sleep);

    document.getElementById("input-tutoring").value = preset.tutoring;
    document.getElementById("input-participation").value = preset.participation;
    document.getElementById("input-extracurricular").value = preset.extra;

    // Trigger prediction automatically
    document.getElementById("prediction-form").dispatchEvent(new Event("submit"));
  }

  document.getElementById("preset-at-risk")?.addEventListener("click", () => applyPreset(presets.atRisk));
  document.getElementById("preset-average")?.addEventListener("click", () => applyPreset(presets.average));
  document.getElementById("preset-good")?.addEventListener("click", () => applyPreset(presets.good));

  // -------------------------------------------------------------
  // 5. Prediction Form Submission & Early Intervention Engine
  // -------------------------------------------------------------
  const predictionForm = document.getElementById("prediction-form");
  if (predictionForm) {
    predictionForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const btn = document.getElementById("btn-run-prediction");
      const originalText = btn.innerHTML;
      btn.innerHTML = `<span class="status-dot pulse"></span> Computing Multi-Model Inference...`;
      btn.disabled = true;

      const payload = {
        student_name: document.getElementById("input-student-name").value,
        student_id: document.getElementById("input-student-id").value,
        attendance_rate: parseFloat(document.getElementById("input-attendance").value),
        internal_marks: parseFloat(document.getElementById("input-internal").value),
        study_hours_weekly: parseFloat(document.getElementById("input-study-hours").value),
        previous_gpa: parseFloat(document.getElementById("input-gpa").value),
        assignment_completion_rate: parseFloat(document.getElementById("input-assignments").value),
        sleep_hours: parseFloat(document.getElementById("input-sleep").value),
        tutoring_support: parseInt(document.getElementById("input-tutoring").value),
        class_participation: parseInt(document.getElementById("input-participation").value),
        extracurricular_hours: parseFloat(document.getElementById("input-extracurricular").value) || 0
      };

      try {
        const response = await fetch("/api/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const resData = await response.json();

        if (resData.status === "success") {
          state.currentPrediction = resData;
          renderPredictionResults(resData);
          showToast(`Inference complete for ${payload.student_name}`);
        } else {
          showToast(`Error: ${resData.message || "Prediction failed"}`);
        }
      } catch (err) {
        showToast(`Network error: ${err.message}`);
      } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
      }
    });
  }

  function renderPredictionResults(data) {
    const pred = data.prediction;
    const interv = data.intervention;

    // Header info
    document.getElementById("res-student-name").textContent = interv.student_name;
    document.getElementById("res-student-id-tag").textContent = `STUDENT: ${interv.student_id}`;

    const badgeContainer = document.getElementById("res-badge-container");
    const categoryClass = pred.performance_category.toLowerCase().replace(" ", "-");
    badgeContainer.innerHTML = `<span class="badge-status ${categoryClass}" id="res-risk-badge">${pred.performance_category}</span>`;

    // Results card top accent color
    const resultsPanel = document.getElementById("results-panel");
    if (pred.performance_category === "At Risk") {
      resultsPanel.style.borderTopColor = "var(--danger)";
    } else if (pred.performance_category === "Average") {
      resultsPanel.style.borderTopColor = "var(--warning)";
    } else {
      resultsPanel.style.borderTopColor = "var(--success)";
    }

    // Scores with smooth rolling counter animation
    const scoreElem = document.getElementById("res-predicted-score");
    const currentScore = parseFloat(scoreElem?.textContent) || 45;
    animateValue(scoreElem, currentScore, pred.predicted_score, 700, v => `${v.toFixed(1)}<small>/100</small>`);

    const catText = document.getElementById("res-predicted-category");
    catText.textContent = pred.performance_category;
    catText.className = `metric-score category-text ${
      pred.performance_category === "At Risk" ? "text-danger" :
      pred.performance_category === "Average" ? "text-warning" : "text-success"
    }`;

    // Update 3D Holographic Student Digital Twin Risk Core
    if (window.ThreeSceneManager && typeof window.ThreeSceneManager.updateDigitalTwin === "function") {
      window.ThreeSceneManager.updateDigitalTwin(pred.predicted_score, pred.performance_category);
    }

    // Trigger celebratory particle confetti if predicted in Good Academic Standing
    if (pred.performance_category === "Good") {
      triggerConfettiBurst();
    }

    // Probabilities
    const probs = pred.category_probabilities;
    const pRisk = probs["At Risk"] || 0;
    const pAvg = probs["Average"] || 0;
    const pGood = probs["Good"] || 0;

    document.getElementById("prob-at-risk-val").textContent = `${pRisk}%`;
    document.getElementById("prob-at-risk-bar").style.width = `${pRisk}%`;

    document.getElementById("prob-average-val").textContent = `${pAvg}%`;
    document.getElementById("prob-average-bar").style.width = `${pAvg}%`;

    document.getElementById("prob-good-val").textContent = `${pGood}%`;
    document.getElementById("prob-good-bar").style.width = `${pGood}%`;

    // Contributing Factors
    const factorsList = document.getElementById("res-factors-list");
    factorsList.innerHTML = "";
    if (pred.contributing_factors && pred.contributing_factors.length > 0) {
      pred.contributing_factors.forEach(f => {
        const item = document.createElement("div");
        item.className = `factor-item ${f.impact.toLowerCase()}`;
        item.innerHTML = `
          <span class="factor-badge">${f.factor}:</span>
          <span class="factor-detail">${f.detail}</span>
        `;
        factorsList.appendChild(item);
      });
    } else {
      factorsList.innerHTML = `<div class="factor-item positive"><span class="factor-detail">Balanced performance profile across all measured metrics.</span></div>`;
    }

    // Intervention Summary
    document.getElementById("res-intervention-summary").textContent = interv.summary;

    // Strategies Cards
    const stratContainer = document.getElementById("res-strategies-container");
    stratContainer.innerHTML = "";
    interv.strategies.forEach(s => {
      const card = document.createElement("div");
      card.className = "strategy-card";
      const priorityBadgeClass = s.priority === "Critical" ? "badge-danger" :
                                 s.priority === "High" ? "badge-warning" :
                                 s.priority === "Enrichment" ? "badge-success" : "badge-info";

      const actionsHtml = s.actions.map(act => `<li>${act}</li>`).join("");

      card.innerHTML = `
        <div class="strategy-title-row">
          <h4>${s.title}</h4>
          <span class="badge ${priorityBadgeClass}">${s.priority} Priority</span>
        </div>
        <p class="strategy-desc">${s.description}</p>
        <ul class="strategy-actions-list">
          ${actionsHtml}
        </ul>
      `;
      stratContainer.appendChild(card);
    });

    // 4-Week Milestone Roadmap
    const timeline = document.getElementById("res-milestones-timeline");
    timeline.innerHTML = "";
    interv.four_week_plan.forEach((step, idx) => {
      const item = document.createElement("div");
      item.className = "milestone-item";
      item.innerHTML = `
        <div class="milestone-marker">${idx + 1}</div>
        <div class="milestone-content">
          <h5>${step.week}: ${step.focus}</h5>
          <p>${step.milestones.join(" • ")}</p>
        </div>
      `;
      timeline.appendChild(item);
    });
  }

  // -------------------------------------------------------------
  // 6. Printable Intervention Modal
  // -------------------------------------------------------------
  const modal = document.getElementById("intervention-modal");
  const btnPrint = document.getElementById("btn-print-intervention");
  const modalCloseBtn = document.getElementById("modal-close-btn");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");

  function openInterventionModal() {
    if (!state.currentPrediction) return;
    const interv = state.currentPrediction.intervention;

    document.getElementById("modal-student-name").textContent = interv.student_name;
    document.getElementById("modal-student-id").textContent = `Student ID: ${interv.student_id}`;
    document.getElementById("modal-score").textContent = `${interv.predicted_score} / 100`;
    document.getElementById("modal-category").textContent = interv.performance_category;
    document.getElementById("modal-urgency").textContent = interv.urgency_level;

    // Strategies
    const stratDiv = document.getElementById("modal-strategies-list");
    stratDiv.innerHTML = "";
    interv.strategies.forEach(s => {
      const actions = s.actions.map(a => `<li>${a}</li>`).join("");
      stratDiv.innerHTML += `
        <div class="strategy-card mt-2">
          <strong>${s.title} (${s.priority})</strong>
          <p class="text-secondary" style="font-size:0.8rem;">${s.description}</p>
          <ul style="padding-left:1.2rem; font-size:0.8rem;">${actions}</ul>
        </div>
      `;
    });

    // Milestones
    const milesDiv = document.getElementById("modal-milestones-list");
    milesDiv.innerHTML = "";
    interv.four_week_plan.forEach(step => {
      milesDiv.innerHTML += `
        <div style="margin-top: 0.5rem; font-size:0.82rem;">
          <strong>${step.week}</strong>: ${step.milestones.join(" • ")}
        </div>
      `;
    });

    modal.classList.add("show");
  }

  function closeInterventionModal() {
    modal.classList.remove("show");
  }

  btnPrint?.addEventListener("click", openInterventionModal);
  modalCloseBtn?.addEventListener("click", closeInterventionModal);
  modalCancelBtn?.addEventListener("click", closeInterventionModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeInterventionModal();
  });

  // -------------------------------------------------------------
  // 7. Load Data from Backend API
  // -------------------------------------------------------------
  async function loadInitialData() {
    try {
      // 1. Fetch Cohort Summary
      const sumRes = await fetch("/api/summary");
      const sumJson = await sumRes.json();
      if (sumJson.status === "success") {
        state.summary = sumJson.data;
        renderCohortSummary(state.summary);
      }

      // 2. Fetch Models Benchmarking
      const modRes = await fetch("/api/models");
      const modJson = await modRes.json();
      if (modJson.status === "success") {
        state.models = modJson.metrics;
        state.features = modJson.feature_importance;
        renderModelBenchmarks(state.models);
        renderFactorImportance(state.features);
      }

      // 3. Trigger initial sample student prediction
      applyPreset(presets.atRisk);

      // 4. Preload demo cohort batch
      loadDemoBatchCohort();

      // 5. Initialize 3D WebGL Constellation, 3D Digital Twin, and 3D Card Tilt Physics
      if (window.ThreeSceneManager) {
        window.ThreeSceneManager.initHeroConstellation();
        window.ThreeSceneManager.initDigitalTwinOrb();
      }
      initCardTiltPhysics();

    } catch (err) {
      console.error("Initialization error:", err);
      showToast("Error connecting to analytics engine.");
    }
  }

  // -------------------------------------------------------------
  // 8. Render Cohort Analytics & Charts (Tab 1)
  // -------------------------------------------------------------
  function renderCohortSummary(data) {
    const s = data.stats;

    // KPI Cards - Smooth animated numeric counters
    animateValue(document.getElementById("val-total-students"), 0, s.total_students, 1200, v => Math.round(v).toLocaleString());
    animateValue(document.getElementById("val-avg-attendance"), 0, s.avg_attendance, 1000, v => `${v.toFixed(1)}%`);
    animateValue(document.getElementById("val-avg-score"), 0, s.avg_final_score, 1000, v => `${v.toFixed(1)} / 100`);
    document.getElementById("val-at-risk").innerHTML = `${s.at_risk_count} <small class="kpi-sub">(${s.at_risk_percentage}%)</small>`;

    // Initialize 3D Multi-Dimensional Student Cluster Space
    if (window.ThreeSceneManager && typeof window.ThreeSceneManager.initClusterUniverse === "function") {
      window.ThreeSceneManager.initClusterUniverse(data);
    }

    // 1. Scatter Chart: Attendance vs Final Score
    const scatterCtx = document.getElementById("chartAttendanceScore")?.getContext("2d");
    if (scatterCtx) {
      const points = data.scatter_sample.map(d => ({
        x: d.attendance_rate,
        y: d.final_score,
        category: d.performance_category
      }));

      state.charts.attendanceScatter = new Chart(scatterCtx, {
        type: "scatter",
        data: {
          datasets: [{
            label: "Students",
            data: points,
            backgroundColor: points.map(p =>
              p.category === "At Risk" ? "#ef4444" :
              p.category === "Average" ? "#f59e0b" : "#10b981"
            ),
            pointRadius: 5,
            pointHoverRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => `Attendance: ${ctx.raw.x}% | Final Score: ${ctx.raw.y} (${ctx.raw.category})`
              }
            }
          },
          scales: {
            x: {
              title: { display: true, text: "Attendance Rate (%)", color: "#94a3b8" },
              min: 30,
              max: 100,
              grid: { color: "rgba(255,255,255,0.05)" }
            },
            y: {
              title: { display: true, text: "Final Score (0-100)", color: "#94a3b8" },
              min: 15,
              max: 100,
              grid: { color: "rgba(255,255,255,0.05)" }
            }
          }
        }
      });
    }

    // 2. Donut Chart: Risk Category Breakdown
    const donutCtx = document.getElementById("chartRiskDistribution")?.getContext("2d");
    if (donutCtx) {
      state.charts.riskDonut = new Chart(donutCtx, {
        type: "doughnut",
        data: {
          labels: ["At Risk (<50)", "Average (50-74)", "Good (≥75)"],
          datasets: [{
            data: [s.at_risk_count, s.average_count, s.good_count],
            backgroundColor: ["#ef4444", "#f59e0b", "#10b981"],
            borderWidth: 2,
            borderColor: "rgba(17, 24, 39, 0.85)"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "68%",
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    // 3. Internal Marks vs Score Correlation Impact
    const internalCtx = document.getElementById("chartInternalImpact")?.getContext("2d");
    if (internalCtx) {
      const sortedByInternal = [...data.scatter_sample].sort((a, b) => a.internal_marks - b.internal_marks);
      const labels = sortedByInternal.map(d => d.internal_marks);
      const scores = sortedByInternal.map(d => d.final_score);

      state.charts.internalImpact = new Chart(internalCtx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [{
            label: "Final Score",
            data: scores,
            borderColor: "#6366f1",
            backgroundColor: "rgba(99, 102, 241, 0.15)",
            fill: true,
            tension: 0.35,
            pointRadius: 2
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              title: { display: true, text: "Internal Assessment Marks", color: "#94a3b8" },
              grid: { display: false }
            },
            y: {
              title: { display: true, text: "Final Score", color: "#94a3b8" },
              grid: { color: "rgba(255,255,255,0.05)" }
            }
          }
        }
      });
    }

    // 4. Study Buckets Bar Chart
    const studyCtx = document.getElementById("chartStudyBuckets")?.getContext("2d");
    if (studyCtx) {
      const buckets = data.study_buckets;
      const bucketLabels = Object.keys(buckets);
      const atRiskCounts = bucketLabels.map(k => buckets[k]["At Risk"] || 0);
      const avgCounts = bucketLabels.map(k => buckets[k]["Average"] || 0);
      const goodCounts = bucketLabels.map(k => buckets[k]["Good"] || 0);

      state.charts.studyBuckets = new Chart(studyCtx, {
        type: "bar",
        data: {
          labels: bucketLabels,
          datasets: [
            { label: "At Risk (<50)", data: atRiskCounts, backgroundColor: "#ef4444" },
            { label: "Average (50-74)", data: avgCounts, backgroundColor: "#f59e0b" },
            { label: "Good (≥75)", data: goodCounts, backgroundColor: "#10b981" }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "top", labels: { color: "#94a3b8" } }
          },
          scales: {
            x: {
              title: { display: true, text: "Weekly Study Time Bracket", color: "#94a3b8" },
              grid: { display: false }
            },
            y: {
              title: { display: true, text: "Number of Students", color: "#94a3b8" },
              grid: { color: "rgba(255,255,255,0.05)" }
            }
          }
        }
      });
    }

    // 5. Pearson Correlation Table
    const tbodyCorr = document.getElementById("tbody-correlation");
    if (tbodyCorr && data.correlations) {
      tbodyCorr.innerHTML = "";
      const matrix = data.correlations;
      const rows = [
        { label: "Attendance Rate", key: "attendance_rate" },
        { label: "Internal Marks", key: "internal_marks" },
        { label: "Weekly Study Hours", key: "study_hours_weekly" },
        { label: "Previous GPA", key: "previous_gpa" },
        { label: "Assignment Completion", key: "assignment_completion_rate" },
        { label: "Final Exam Score", key: "final_score" }
      ];

      rows.forEach(r => {
        const tr = document.createElement("tr");
        let html = `<td><strong>${r.label}</strong></td>`;
        rows.forEach(c => {
          const val = matrix[r.key]?.[c.key] ?? 1.0;
          const highlightClass = Math.abs(val) > 0.6 && r.key !== c.key ? "text-danger" : "";
          html += `<td class="${highlightClass}"><strong>${val.toFixed(3)}</strong></td>`;
        });
        tr.innerHTML = html;
        tbodyCorr.appendChild(tr);
      });
    }
  }

  // -------------------------------------------------------------
  // 9. Render Model Benchmarking (Tab 3)
  // -------------------------------------------------------------
  function renderModelBenchmarks(modelsData) {
    const regModels = modelsData.regression;
    const clsModels = modelsData.classification;

    // 1. Regression Table
    const tbodyReg = document.getElementById("tbody-regression-models");
    if (tbodyReg) {
      tbodyReg.innerHTML = "";
      const regRecommendations = {
        "Linear Regression": "Optimal for transparent linear institutional reporting",
        "Decision Tree Regressor": "Interpretable threshold decision splits",
        "Random Forest Regressor": "Recommended: Best balanced non-linear variance"
      };

      for (const [name, m] of Object.entries(regModels)) {
        const isTop = name.includes("Random Forest") || name.includes("Linear");
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${name}</strong> ${isTop ? '<span class="badge badge-primary">Leader</span>' : ''}</td>
          <td><span style="font-family:var(--font-mono); font-weight:700;">${m.r2}</span></td>
          <td><strong>${m.r2_pct}%</strong></td>
          <td>${m.mae} pts</td>
          <td>${m.rmse} pts</td>
          <td><span class="text-secondary" style="font-size:0.8rem;">${regRecommendations[name] || "Benchmark model"}</span></td>
        `;
        tbodyReg.appendChild(tr);
      }
    }

    // Regression Comparison Bar Chart
    const regChartCtx = document.getElementById("chartRegressionComparison")?.getContext("2d");
    if (regChartCtx) {
      const regNames = Object.keys(regModels);
      const r2Values = regNames.map(k => regModels[k].r2_pct);
      const maeValues = regNames.map(k => regModels[k].mae);

      state.charts.regressionComp = new Chart(regChartCtx, {
        type: "bar",
        data: {
          labels: regNames,
          datasets: [
            { label: "Explained Variance R² (%)", data: r2Values, backgroundColor: "#6366f1" },
            { label: "Mean Absolute Error (MAE points)", data: maeValues, backgroundColor: "#f59e0b" }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { grid: { color: "rgba(255,255,255,0.05)" } }
          }
        }
      });
    }

    // 2. Classification Table
    const tbodyCls = document.getElementById("tbody-classification-models");
    if (tbodyCls) {
      tbodyCls.innerHTML = "";
      const specialties = {
        "Logistic Regression": "High linear separability & rapid inference",
        "Decision Tree Classifier": "Rule-based auditability for counselors",
        "Random Forest Classifier": "Recommended: Robust risk probability calibration",
        "K-Nearest Neighbors (KNN)": "Cohort cluster-based similarity matching"
      };

      for (const [name, m] of Object.entries(clsModels)) {
        const isTop = name.includes("Logistic") || name.includes("Random Forest");
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>${name}</strong> ${isTop ? '<span class="badge badge-success">Top Performer</span>' : ''}</td>
          <td><strong style="color:var(--success);">${m.accuracy}%</strong></td>
          <td>${m.precision}%</td>
          <td>${m.recall}%</td>
          <td><span style="font-family:var(--font-mono); font-weight:700;">${m.f1_score}%</span></td>
          <td><span class="text-secondary" style="font-size:0.8rem;">${specialties[name] || "General classification"}</span></td>
        `;
        tbodyCls.appendChild(tr);
      }
    }

    // Classification Comparison Chart
    const clsChartCtx = document.getElementById("chartClassificationComparison")?.getContext("2d");
    if (clsChartCtx) {
      const clsNames = Object.keys(clsModels);
      const accValues = clsNames.map(k => clsModels[k].accuracy);
      const f1Values = clsNames.map(k => clsModels[k].f1_score);

      state.charts.classificationComp = new Chart(clsChartCtx, {
        type: "bar",
        data: {
          labels: clsNames,
          datasets: [
            { label: "Accuracy (%)", data: accValues, backgroundColor: "#10b981" },
            { label: "F1-Score Weighted (%)", data: f1Values, backgroundColor: "#06b6d4" }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 70, max: 100, grid: { color: "rgba(255,255,255,0.05)" } }
          }
        }
      });
    }

    // 3. Confusion Matrix Visualizer
    renderConfusionMatrix("Random Forest Classifier");
    const selectCm = document.getElementById("select-confusion-model");
    if (selectCm) {
      selectCm.addEventListener("change", (e) => {
        renderConfusionMatrix(e.target.value);
      });
    }
  }

  function renderConfusionMatrix(modelName) {
    const container = document.getElementById("confusion-matrix-container");
    if (!container || !state.models) return;

    const m = state.models.classification[modelName];
    if (!m || !m.confusion_matrix) return;

    const cm = m.confusion_matrix;
    const labels = m.labels;

    let html = `
      <div class="cm-grid">
        <div class="cm-label"></div>
        <div class="cm-label">Pred: At Risk</div>
        <div class="cm-label">Pred: Average</div>
        <div class="cm-label">Pred: Good</div>
    `;

    for (let i = 0; i < 3; i++) {
      html += `<div class="cm-label" style="text-align:right; padding-right:8px;">True: ${labels[i]}</div>`;
      for (let j = 0; j < 3; j++) {
        const val = cm[i][j];
        const isDiag = (i === j);
        const bg = isDiag
          ? "background: rgba(16, 185, 129, 0.25); color: #10b981; border-color: rgba(16, 185, 129, 0.4);"
          : val > 0
            ? "background: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.3);"
            : "background: rgba(255, 255, 255, 0.02); color: #64748b;";

        html += `
          <div class="cm-cell" style="${bg}">
            <span>${val}</span>
            <small>${isDiag ? "Correct" : "Misclass"}</small>
          </div>
        `;
      }
    }
    html += `</div>`;
    container.innerHTML = html;
  }

  // -------------------------------------------------------------
  // 10. Render Factor Influence Analysis (Tab 4)
  // -------------------------------------------------------------
  function renderFactorImportance(featuresData) {
    if (!featuresData) return;
    const ranking = featuresData.ranking;

    // 1. Horizontal Bar Chart
    const featCtx = document.getElementById("chartFeatureImportance")?.getContext("2d");
    if (featCtx) {
      const labels = ranking.map(r => r.label);
      const values = ranking.map(r => r.importance);

      state.charts.featureImportance = new Chart(featCtx, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [{
            label: "Relative Importance (%)",
            data: values,
            backgroundColor: ranking.map((_, idx) =>
              idx === 0 ? "#6366f1" :
              idx === 1 ? "#8b5cf6" :
              idx === 2 ? "#06b6d4" : "rgba(99, 102, 241, 0.45)"
            ),
            borderRadius: 6
          }]
        },
        options: {
          indexAxis: "y",
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: {
              title: { display: true, text: "Importance Weight (%)", color: "#94a3b8" },
              grid: { color: "rgba(255,255,255,0.05)" }
            },
            y: { grid: { display: false } }
          }
        }
      });
    }

    // 2. Table of Coefficients
    const tbodyFeat = document.getElementById("tbody-feature-ranking");
    if (tbodyFeat) {
      tbodyFeat.innerHTML = "";
      ranking.forEach((item, idx) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td><strong>#${idx + 1}</strong></td>
          <td><strong>${item.label}</strong></td>
          <td><strong style="color:var(--primary); font-family:var(--font-mono);">${item.importance}%</strong></td>
          <td><span class="badge ${item.impact_direction === 'Positive' ? 'badge-success' : 'badge-danger'}">${item.impact_direction} (+${item.linear_coefficient})</span></td>
        `;
        tbodyFeat.appendChild(tr);
      });
    }
  }

  // -------------------------------------------------------------
  // 11. Cohort Management & Batch CSV Triage (Tab 5)
  // -------------------------------------------------------------
  const btnLoadDemoBatch = document.getElementById("btn-load-demo-batch");
  const inputCsvUpload = document.getElementById("input-csv-upload");
  const batchSearchInput = document.getElementById("batch-search-input");
  const batchFilterCategory = document.getElementById("batch-filter-category");
  const btnExportBatchCsv = document.getElementById("btn-export-batch-csv");

  async function loadDemoBatchCohort() {
    try {
      const res = await fetch("/api/predict-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample_size: 200 })
      });
      const data = await res.json();
      if (data.status === "success") {
        state.batchStudents = data.students;
        state.batchCurrentPage = 1;
        renderBatchSummary(data.summary);
        renderBatchTable(data.students);
      }
    } catch (err) {
      console.error("Batch load error:", err);
    }
  }

  btnLoadDemoBatch?.addEventListener("click", async () => {
    btnLoadDemoBatch.disabled = true;
    btnLoadDemoBatch.innerHTML = `<span class="status-dot pulse"></span> Generating Cohort...`;
    await loadDemoBatchCohort();
    btnLoadDemoBatch.disabled = false;
    btnLoadDemoBatch.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Load Demo Class Cohort (200 Students)`;
    showToast("Loaded 200 student records for batch triage");
  });

  inputCsvUpload?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      showToast("Uploading and triaging CSV file...");
      const res = await fetch("/api/predict-batch", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.status === "success") {
        state.batchStudents = data.students;
        state.batchCurrentPage = 1;
        renderBatchSummary(data.summary);
        renderBatchTable(data.students);
        showToast(`Successfully processed ${data.students.length} students from CSV`);
      } else {
        showToast(`CSV Error: ${data.message}`);
      }
    } catch (err) {
      showToast(`Upload failed: ${err.message}`);
    }
  });

  function renderBatchSummary(summary) {
    document.getElementById("batch-total-count").textContent = summary.total_evaluated;
    document.getElementById("batch-at-risk-count").textContent = summary.at_risk_count;
    document.getElementById("batch-average-count").textContent = summary.average_count;
    document.getElementById("batch-good-count").textContent = summary.good_count;
    document.getElementById("batch-avg-score").textContent = `${summary.avg_predicted_score} / 100`;
  }

  // Sorting helper
  function sortCohortStudents(students, col, dir) {
    if (!col) return students;
    return [...students].sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      if (col === "student_id") {
        const numA = parseInt(String(valA).replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(String(valB).replace(/\D/g, ""), 10) || 0;
        return dir === "asc" ? numA - numB : numB - numA;
      }

      if (typeof valA === "string") {
        return dir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return dir === "asc" ? (valA - valB) : (valB - valA);
    });
  }

  function updateSortHeaders() {
    document.querySelectorAll("#table-batch-roster th.sortable").forEach(th => {
      const col = th.getAttribute("data-sort");
      const icon = th.querySelector(".sort-icon");
      th.classList.remove("sorted-asc", "sorted-desc");
      if (col === state.batchSortColumn) {
        th.classList.add(state.batchSortDirection === "asc" ? "sorted-asc" : "sorted-desc");
        if (icon) icon.innerHTML = state.batchSortDirection === "asc" ? "&#9650;" : "&#9660;";
      } else {
        if (icon) icon.innerHTML = "&#x21C5;";
      }
    });
  }

  function renderBatchPagination(totalFiltered, totalOverall) {
    const info = document.getElementById("batch-pagination-info");
    const btnFirst = document.getElementById("btn-batch-page-first");
    const btnPrev = document.getElementById("btn-batch-page-prev");
    const btnNext = document.getElementById("btn-batch-page-next");
    const btnLast = document.getElementById("btn-batch-page-last");
    const pageNumbersContainer = document.getElementById("batch-page-numbers");

    const totalPages = Math.ceil(totalFiltered / state.batchPageSize) || 1;
    if (state.batchCurrentPage > totalPages) {
      state.batchCurrentPage = totalPages;
    }

    const startIdx = totalFiltered === 0 ? 0 : (state.batchCurrentPage - 1) * state.batchPageSize + 1;
    const endIdx = Math.min(state.batchCurrentPage * state.batchPageSize, totalFiltered);

    if (info) {
      if (totalFiltered < totalOverall) {
        info.innerHTML = `Showing <strong id="batch-pagination-start">${startIdx}</strong> to <strong id="batch-pagination-end">${endIdx}</strong> of <strong id="batch-pagination-total">${totalFiltered}</strong> students <span style="color:var(--text-muted); font-size:0.8rem;">(filtered from ${totalOverall})</span>`;
      } else {
        info.innerHTML = `Showing <strong id="batch-pagination-start">${startIdx}</strong> to <strong id="batch-pagination-end">${endIdx}</strong> of <strong id="batch-pagination-total">${totalFiltered}</strong> students`;
      }
    }

    if (btnFirst) btnFirst.disabled = state.batchCurrentPage <= 1;
    if (btnPrev) btnPrev.disabled = state.batchCurrentPage <= 1;
    if (btnNext) btnNext.disabled = state.batchCurrentPage >= totalPages;
    if (btnLast) btnLast.disabled = state.batchCurrentPage >= totalPages;

    if (pageNumbersContainer) {
      pageNumbersContainer.innerHTML = "";

      let pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        if (state.batchCurrentPage <= 4) {
          pages = [1, 2, 3, 4, 5, "...", totalPages];
        } else if (state.batchCurrentPage >= totalPages - 3) {
          pages = [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
        } else {
          pages = [1, "...", state.batchCurrentPage - 1, state.batchCurrentPage, state.batchCurrentPage + 1, "...", totalPages];
        }
      }

      pages.forEach(p => {
        if (p === "...") {
          const span = document.createElement("span");
          span.className = "pagination-ellipsis";
          span.textContent = "...";
          pageNumbersContainer.appendChild(span);
        } else {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `btn-page ${p === state.batchCurrentPage ? "active" : ""}`;
          btn.textContent = p;
          btn.setAttribute("aria-label", `Page ${p}`);
          btn.addEventListener("click", () => {
            state.batchCurrentPage = p;
            renderBatchTable(state.batchStudents);
          });
          pageNumbersContainer.appendChild(btn);
        }
      });
    }
  }

  function renderBatchTable(students) {
    const tbody = document.getElementById("tbody-batch-roster");
    if (!tbody) return;
    tbody.innerHTML = "";

    const searchTerm = (batchSearchInput?.value || "").toLowerCase().trim();
    const filterCat = batchFilterCategory?.value || "ALL";

    const filtered = students.filter(s => {
      const matchId = String(s.student_id).toLowerCase().includes(searchTerm);
      const matchCat = filterCat === "ALL" || s.predicted_category === filterCat;
      return matchId && matchCat;
    });

    const sorted = sortCohortStudents(filtered, state.batchSortColumn, state.batchSortDirection);
    updateSortHeaders();

    renderBatchPagination(sorted.length, students.length);

    if (sorted.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:2.5rem; color:var(--text-muted);">No student records match the search filter.</td></tr>`;
      return;
    }

    const startIdx = (state.batchCurrentPage - 1) * state.batchPageSize;
    const endIdx = Math.min(startIdx + state.batchPageSize, sorted.length);
    const pageRecords = sorted.slice(startIdx, endIdx);

    pageRecords.forEach(s => {
      const tr = document.createElement("tr");
      const badgeClass = s.predicted_category === "At Risk" ? "badge-danger" :
                         s.predicted_category === "Average" ? "badge-warning" : "badge-success";

      tr.innerHTML = `
        <td><strong>${s.student_id}</strong></td>
        <td>${s.attendance_rate}%</td>
        <td>${s.internal_marks} / 100</td>
        <td>${s.study_hours_weekly} hrs</td>
        <td>${s.previous_gpa}</td>
        <td><strong style="font-family:var(--font-mono);">${s.predicted_score}</strong></td>
        <td><span class="badge ${badgeClass}">${s.predicted_category}</span></td>
        <td>
          <button type="button" class="btn btn-outline-sm btn-inspect-student" data-id="${s.student_id}">
            Intervene
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach click events to "Intervene" buttons
    tbody.querySelectorAll(".btn-inspect-student").forEach(btn => {
      btn.addEventListener("click", () => {
        const studentId = btn.getAttribute("data-id");
        const found = state.batchStudents.find(s => s.student_id === studentId);
        if (found) {
          // Switch to predict tab and fill form
          document.getElementById("nav-predict")?.click();
          document.getElementById("input-student-name").value = `Student ${found.student_id}`;
          document.getElementById("input-student-id").value = found.student_id;

          const setSlider = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
              el.value = val;
              el.dispatchEvent(new Event("input"));
            }
          };

          setSlider("input-attendance", found.attendance_rate);
          setSlider("input-internal", found.internal_marks);
          setSlider("input-study-hours", found.study_hours_weekly);
          setSlider("input-gpa", found.previous_gpa);
          predictionForm?.dispatchEvent(new Event("submit"));
        }
      });
    });
  }

  batchSearchInput?.addEventListener("input", () => {
    state.batchCurrentPage = 1;
    renderBatchTable(state.batchStudents);
  });

  batchFilterCategory?.addEventListener("change", () => {
    state.batchCurrentPage = 1;
    renderBatchTable(state.batchStudents);
  });

  // Pagination Navigation Handlers
  document.getElementById("btn-batch-page-first")?.addEventListener("click", () => {
    if (state.batchCurrentPage > 1) {
      state.batchCurrentPage = 1;
      renderBatchTable(state.batchStudents);
    }
  });

  document.getElementById("btn-batch-page-prev")?.addEventListener("click", () => {
    if (state.batchCurrentPage > 1) {
      state.batchCurrentPage--;
      renderBatchTable(state.batchStudents);
    }
  });

  document.getElementById("btn-batch-page-next")?.addEventListener("click", () => {
    const totalPages = Math.ceil(state.batchStudents.length / state.batchPageSize) || 1;
    if (state.batchCurrentPage < totalPages) {
      state.batchCurrentPage++;
      renderBatchTable(state.batchStudents);
    }
  });

  document.getElementById("btn-batch-page-last")?.addEventListener("click", () => {
    const totalPages = Math.ceil(state.batchStudents.length / state.batchPageSize) || 1;
    if (state.batchCurrentPage < totalPages) {
      state.batchCurrentPage = totalPages;
      renderBatchTable(state.batchStudents);
    }
  });

  // Page Size Selector
  document.getElementById("batch-page-size")?.addEventListener("change", (e) => {
    state.batchPageSize = parseInt(e.target.value, 10) || 25;
    state.batchCurrentPage = 1;
    renderBatchTable(state.batchStudents);
  });

  // Column Header Sorting
  document.querySelectorAll("#table-batch-roster th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.getAttribute("data-sort");
      if (state.batchSortColumn === col) {
        state.batchSortDirection = state.batchSortDirection === "asc" ? "desc" : "asc";
      } else {
        state.batchSortColumn = col;
        state.batchSortDirection = "asc";
      }
      state.batchCurrentPage = 1;
      renderBatchTable(state.batchStudents);
    });
  });

  // Export Batch to CSV
  btnExportBatchCsv?.addEventListener("click", () => {
    if (!state.batchStudents || state.batchStudents.length === 0) {
      showToast("No student data available to export");
      return;
    }

    const headers = ["student_id", "attendance_rate", "internal_marks", "study_hours_weekly", "previous_gpa", "predicted_score", "predicted_category"];
    let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";

    state.batchStudents.forEach(row => {
      const values = headers.map(h => row[h] ?? "");
      csvContent += values.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `student_early_intervention_triage_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported student predictions to CSV");
  });

  // -------------------------------------------------------------
  // 12. Helpers (Toast & Refresh)
  // -------------------------------------------------------------
  function showToast(message) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
      <span>${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(100%)";
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  function refreshAllCharts() {
    Object.values(state.charts).forEach(chart => {
      if (chart && typeof chart.update === "function") {
        chart.update();
      }
    });
  }

  // =============================================================
  // 13. Three.js 3D WebGL Graphics & Real Animations Engine
  // =============================================================
  window.ThreeSceneManager = {
    hero: null,
    cluster: null,
    twin: null,

    updateTheme(theme) {
      if (this.hero && this.hero.updateTheme) this.hero.updateTheme(theme);
      if (this.cluster && this.cluster.updateTheme) this.cluster.updateTheme(theme);
      if (this.twin && this.twin.updateTheme) this.twin.updateTheme(theme);
    },

    handleResize() {
      if (this.hero && this.hero.onResize) this.hero.onResize();
      if (this.cluster && this.cluster.onResize) this.cluster.onResize();
      if (this.twin && this.twin.onResize) this.twin.onResize();
    },

    initHeroConstellation() {
      const canvas = document.getElementById("hero-3d-canvas");
      if (!canvas || typeof THREE === "undefined") return;

      try {
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1000);
        camera.position.z = 220;

        function resize() {
          const p = canvas.parentElement;
          if (!p) return;
          const w = p.clientWidth;
          const h = p.clientHeight || 120;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
        resize();
        window.addEventListener("resize", resize);

        const nodeCount = 95;
        const positions = new Float32Array(nodeCount * 3);
        const velocities = [];
        const isDark = () => document.documentElement.getAttribute("data-theme") !== "light";

        for (let i = 0; i < nodeCount; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 450;
          positions[i * 3 + 1] = (Math.random() - 0.5) * 140;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 160;
          velocities.push({
            x: (Math.random() - 0.5) * 0.22,
            y: (Math.random() - 0.5) * 0.22,
            z: (Math.random() - 0.5) * 0.14
          });
        }

        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const pMat = new THREE.PointsMaterial({
          color: isDark() ? 0x818cf8 : 0x4f46e5,
          size: 3.5,
          transparent: true,
          opacity: 0.85
        });
        const points = new THREE.Points(pGeo, pMat);
        scene.add(points);

        const maxLines = nodeCount * 7;
        const linePositions = new Float32Array(maxLines * 6);
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));

        const lineMat = new THREE.LineBasicMaterial({
          color: isDark() ? 0x6366f1 : 0x4338ca,
          transparent: true,
          opacity: isDark() ? 0.28 : 0.18
        });
        const lineMesh = new THREE.LineSegments(lineGeo, lineMat);
        scene.add(lineMesh);

        let mouseX = 0, mouseY = 0;
        let targetCamX = 0, targetCamY = 0;
        window.addEventListener("mousemove", e => {
          const cx = window.innerWidth / 2;
          mouseX = (e.clientX - cx) * 0.06;
          mouseY = (e.clientY - 60) * 0.06;
        });

        let animId;
        function animate() {
          animId = requestAnimationFrame(animate);

          const pos = pGeo.attributes.position.array;
          for (let i = 0; i < nodeCount; i++) {
            pos[i * 3] += velocities[i].x;
            pos[i * 3 + 1] += velocities[i].y;
            pos[i * 3 + 2] += velocities[i].z;

            if (pos[i * 3] < -225 || pos[i * 3] > 225) velocities[i].x *= -1;
            if (pos[i * 3 + 1] < -75 || pos[i * 3 + 1] > 75) velocities[i].y *= -1;
            if (pos[i * 3 + 2] < -85 || pos[i * 3 + 2] > 85) velocities[i].z *= -1;
          }
          pGeo.attributes.position.needsUpdate = true;

          let lineIdx = 0;
          const lPos = lineGeo.attributes.position.array;
          for (let i = 0; i < nodeCount; i++) {
            for (let j = i + 1; j < nodeCount; j++) {
              const dx = pos[i * 3] - pos[j * 3];
              const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
              const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
              const distSq = dx * dx + dy * dy + dz * dz;
              if (distSq < 2900 && lineIdx < maxLines) {
                lPos[lineIdx * 6] = pos[i * 3];
                lPos[lineIdx * 6 + 1] = pos[i * 3 + 1];
                lPos[lineIdx * 6 + 2] = pos[i * 3 + 2];
                lPos[lineIdx * 6 + 3] = pos[j * 3];
                lPos[lineIdx * 6 + 4] = pos[j * 3 + 1];
                lPos[lineIdx * 6 + 5] = pos[j * 3 + 2];
                lineIdx++;
              }
            }
          }
          lineGeo.setDrawRange(0, lineIdx * 2);
          lineGeo.attributes.position.needsUpdate = true;

          targetCamX += (mouseX - targetCamX) * 0.05;
          targetCamY += (-mouseY - targetCamY) * 0.05;
          camera.position.x = targetCamX;
          camera.position.y = targetCamY;
          camera.lookAt(0, 0, 0);

          renderer.render(scene, camera);
        }
        animate();

        this.hero = {
          onResize: resize,
          updateTheme(theme) {
            const dark = theme !== "light";
            pMat.color.setHex(dark ? 0x818cf8 : 0x4f46e5);
            lineMat.color.setHex(dark ? 0x6366f1 : 0x4338ca);
            lineMat.opacity = dark ? 0.28 : 0.18;
          }
        };
      } catch (e) {
        console.warn("WebGL Hero Constellation init error:", e);
      }
    },

    initClusterUniverse(cohortData) {
      const container = document.getElementById("cluster-3d-wrapper");
      const canvas = document.getElementById("cluster-3d-canvas");
      if (!container || !canvas || typeof THREE === "undefined") return;

      if (this.cluster && this.cluster.destroy) {
        this.cluster.destroy();
      }

      try {
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 1000);
        camera.position.set(130, 110, 160);
        camera.lookAt(0, 0, 0);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
        dirLight.position.set(100, 150, 100);
        scene.add(dirLight);

        const grid = new THREE.GridHelper(160, 16, 0x6366f1, 0x1e293b);
        grid.position.y = -60;
        scene.add(grid);

        const boxGeo = new THREE.BoxGeometry(160, 120, 140);
        const boxWire = new THREE.WireframeGeometry(boxGeo);
        const boxLine = new THREE.LineSegments(boxWire, new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.35 }));
        scene.add(boxLine);

        const sphereGeo = new THREE.SphereGeometry(2.4, 16, 16);
        const matGood = new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.3, metalness: 0.2, emissive: 0x059669, emissiveIntensity: 0.35 });
        const matAvg  = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.3, metalness: 0.2, emissive: 0xd97706, emissiveIntensity: 0.35 });
        const matRisk = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, metalness: 0.2, emissive: 0xdc2626, emissiveIntensity: 0.45 });

        const studentMeshes = [];
        const sample = (cohortData && cohortData.scatter_sample) ? cohortData.scatter_sample : [];

        const recordsToRender = [...sample];
        if (recordsToRender.length < 180) {
          for (let i = recordsToRender.length; i < 220; i++) {
            const rand = Math.random();
            let cat = "Average";
            let att = 60 + Math.random() * 35;
            let mark = 50 + Math.random() * 35;
            let study = 6 + Math.random() * 16;
            let score = 55 + Math.random() * 30;

            if (rand < 0.16) {
              cat = "At Risk";
              att = 40 + Math.random() * 30;
              mark = 25 + Math.random() * 30;
              study = 2 + Math.random() * 7;
              score = 30 + Math.random() * 20;
            } else if (rand > 0.72) {
              cat = "Good";
              att = 82 + Math.random() * 18;
              mark = 75 + Math.random() * 25;
              study = 14 + Math.random() * 18;
              score = 78 + Math.random() * 22;
            }
            recordsToRender.push({
              student_id: `STU-${1000 + i}`,
              attendance_rate: parseFloat(att.toFixed(1)),
              internal_marks: parseFloat(mark.toFixed(1)),
              study_hours_weekly: parseFloat(study.toFixed(1)),
              final_score: parseFloat(score.toFixed(1)),
              performance_category: cat
            });
          }
        }

        recordsToRender.forEach((stu, idx) => {
          const mat = stu.performance_category === "At Risk" ? matRisk.clone() :
                      stu.performance_category === "Good" ? matGood.clone() : matAvg.clone();
          const mesh = new THREE.Mesh(sphereGeo, mat);

          const x = (stu.attendance_rate - 50) * 1.4;
          const y = (stu.internal_marks - 50) * 1.0;
          const study = stu.study_hours_weekly ?? (stu.study_hours ?? 12);
          const z = (study - 15) * 3.8;

          mesh.position.set(x, y, z);
          mesh.userData = {
            student_id: stu.student_id || `STU-${1000 + idx}`,
            attendance_rate: stu.attendance_rate,
            internal_marks: stu.internal_marks,
            study_hours: study,
            score: stu.final_score || 55,
            category: stu.performance_category
          };
          scene.add(mesh);
          studentMeshes.push(mesh);
        });

        let isDragging = false;
        let prevMouseX = 0, prevMouseY = 0;
        let rotX = 0.45, rotY = 0.75;
        let targetRotX = 0.45, targetRotY = 0.75;
        let distance = 220;
        let targetDistance = 220;
        let autoRotate = true;

        const autoRotateBtn = document.getElementById("btn-3d-autorotate");
        const resetBtn = document.getElementById("btn-3d-reset");

        autoRotateBtn?.addEventListener("click", () => {
          autoRotate = !autoRotate;
          autoRotateBtn.classList.toggle("active", autoRotate);
        });

        resetBtn?.addEventListener("click", () => {
          targetRotX = 0.45;
          targetRotY = 0.75;
          targetDistance = 220;
        });

        const filterBtns = document.querySelectorAll("#cluster-filter-group .cluster-btn");
        filterBtns.forEach(btn => {
          btn.addEventListener("click", () => {
            filterBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const filter = btn.getAttribute("data-filter");

            studentMeshes.forEach(m => {
              const cat = m.userData.category;
              if (filter === "all") {
                m.visible = true;
                m.material.opacity = 1.0;
                m.material.transparent = false;
              } else if (filter === "at-risk") {
                const match = cat === "At Risk";
                m.visible = match;
                m.material.transparent = !match;
                m.material.opacity = match ? 1.0 : 0.05;
              } else if (filter === "good") {
                const match = cat === "Good";
                m.visible = match;
                m.material.transparent = !match;
                m.material.opacity = match ? 1.0 : 0.05;
              }
            });
          });
        });

        canvas.addEventListener("mousedown", e => {
          isDragging = true;
          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        });

        window.addEventListener("mouseup", () => { isDragging = false; });

        window.addEventListener("mousemove", e => {
          if (!isDragging) return;
          const dx = e.clientX - prevMouseX;
          const dy = e.clientY - prevMouseY;
          targetRotY += dx * 0.007;
          targetRotX += dy * 0.007;
          targetRotX = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, targetRotX));
          prevMouseX = e.clientX;
          prevMouseY = e.clientY;
        });

        canvas.addEventListener("wheel", e => {
          e.preventDefault();
          targetDistance += e.deltaY * 0.15;
          targetDistance = Math.max(90, Math.min(360, targetDistance));
        }, { passive: false });

        const raycaster = new THREE.Raycaster();
        const mouseVec = new THREE.Vector2();
        const tooltip = document.getElementById("cluster-hud-tooltip");
        let hoveredMesh = null;

        canvas.addEventListener("mousemove", e => {
          const rect = canvas.getBoundingClientRect();
          mouseVec.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouseVec.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

          raycaster.setFromCamera(mouseVec, camera);
          const visibleSpheres = studentMeshes.filter(m => m.visible);
          const intersects = raycaster.intersectObjects(visibleSpheres);

          if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (hoveredMesh !== hit) {
              if (hoveredMesh) {
                hoveredMesh.scale.set(1, 1, 1);
                hoveredMesh.material.emissiveIntensity = 0.35;
              }
              hoveredMesh = hit;
              hoveredMesh.scale.set(1.9, 1.9, 1.9);
              hoveredMesh.material.emissiveIntensity = 0.9;
            }

            const u = hit.userData;
            document.getElementById("hud-tt-id").textContent = u.student_id;
            const statusElem = document.getElementById("hud-tt-status");
            statusElem.textContent = u.category;
            statusElem.className = u.category === "At Risk" ? "text-danger" :
                                   u.category === "Good" ? "text-success" : "text-warning";
            document.getElementById("hud-tt-att").textContent = `${u.attendance_rate}%`;
            document.getElementById("hud-tt-marks").textContent = `${u.internal_marks}/100`;
            document.getElementById("hud-tt-study").textContent = `${u.study_hours} hrs/wk`;
            document.getElementById("hud-tt-score").textContent = `${u.score}`;

            const vector = hit.position.clone();
            vector.project(camera);
            const px = (vector.x * 0.5 + 0.5) * rect.width;
            const py = -(vector.y * 0.5 - 0.5) * rect.height;
            tooltip.style.left = `${px}px`;
            tooltip.style.top = `${py}px`;
            tooltip.style.display = "block";
          } else {
            if (hoveredMesh) {
              hoveredMesh.scale.set(1, 1, 1);
              hoveredMesh.material.emissiveIntensity = 0.35;
              hoveredMesh = null;
            }
            if (tooltip) tooltip.style.display = "none";
          }
        });

        canvas.addEventListener("mouseleave", () => {
          if (hoveredMesh) {
            hoveredMesh.scale.set(1, 1, 1);
            hoveredMesh.material.emissiveIntensity = 0.35;
            hoveredMesh = null;
          }
          if (tooltip) tooltip.style.display = "none";
        });

        function resize() {
          const w = container.clientWidth;
          const h = container.clientHeight || 480;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
        resize();

        let animId;
        function animate() {
          animId = requestAnimationFrame(animate);

          if (autoRotate && !isDragging) {
            targetRotY += 0.0025;
          }

          rotX += (targetRotX - rotX) * 0.08;
          rotY += (targetRotY - rotY) * 0.08;
          distance += (targetDistance - distance) * 0.08;

          camera.position.x = distance * Math.sin(rotY) * Math.cos(rotX);
          camera.position.y = distance * Math.sin(rotX);
          camera.position.z = distance * Math.cos(rotY) * Math.cos(rotX);
          camera.lookAt(0, 0, 0);

          renderer.render(scene, camera);
        }
        animate();

        this.cluster = {
          onResize: resize,
          updateTheme(theme) {
            const dark = theme !== "light";
            grid.material.color.setHex(dark ? 0x6366f1 : 0x4f46e5);
          },
          destroy() {
            cancelAnimationFrame(animId);
            renderer.dispose();
          }
        };
      } catch (e) {
        console.warn("WebGL Student Cluster Universe init error:", e);
      }
    },

    initDigitalTwinOrb() {
      const container = document.getElementById("digital-twin-container");
      const canvas = document.getElementById("digital-twin-canvas");
      if (!container || !canvas || typeof THREE === "undefined") return;

      try {
        const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
        camera.position.z = 85;

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
        scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1.6, 200);
        pointLight.position.set(40, 50, 60);
        scene.add(pointLight);

        const twinGroup = new THREE.Group();
        scene.add(twinGroup);

        const icoGeo = new THREE.IcosahedronGeometry(20, 1);
        const icoMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          wireframe: true,
          roughness: 0.1,
          metalness: 0.9,
          emissive: 0xef4444,
          emissiveIntensity: 0.5
        });
        const icoMesh = new THREE.Mesh(icoGeo, icoMat);
        twinGroup.add(icoMesh);

        const coreGeo = new THREE.SphereGeometry(12, 32, 32);
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          roughness: 0.2,
          metalness: 0.8,
          emissive: 0xdc2626,
          emissiveIntensity: 0.7
        });
        const coreMesh = new THREE.Mesh(coreGeo, coreMat);
        twinGroup.add(coreMesh);

        const ring1Geo = new THREE.TorusGeometry(30, 0.9, 16, 64);
        const ring1Mat = new THREE.MeshStandardMaterial({ color: 0x818cf8, metalness: 0.9, roughness: 0.1 });
        const ring1 = new THREE.Mesh(ring1Geo, ring1Mat);
        twinGroup.add(ring1);

        const ring2Geo = new THREE.TorusGeometry(34, 0.7, 16, 64);
        const ring2Mat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.9, roughness: 0.1 });
        const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
        ring2.rotation.x = Math.PI / 2;
        twinGroup.add(ring2);

        const pCount = 50;
        const pPositions = new Float32Array(pCount * 3);
        for (let i = 0; i < pCount; i++) {
          const theta = Math.random() * Math.PI * 2;
          const rad = 28 + Math.random() * 12;
          pPositions[i * 3] = Math.cos(theta) * rad;
          pPositions[i * 3 + 1] = (Math.random() - 0.5) * 16;
          pPositions[i * 3 + 2] = Math.sin(theta) * rad;
        }
        const pGeo = new THREE.BufferGeometry();
        pGeo.setAttribute("position", new THREE.BufferAttribute(pPositions, 3));
        const pMat = new THREE.PointsMaterial({ color: 0xef4444, size: 2.5, transparent: true, opacity: 0.8 });
        const particles = new THREE.Points(pGeo, pMat);
        twinGroup.add(particles);

        let isDragging = false;
        let prevX = 0, prevY = 0;
        let spinSpeed = 0.034;

        canvas.addEventListener("mousedown", e => {
          isDragging = true;
          prevX = e.clientX;
          prevY = e.clientY;
        });
        window.addEventListener("mouseup", () => { isDragging = false; });
        window.addEventListener("mousemove", e => {
          if (!isDragging) return;
          const dx = e.clientX - prevX;
          const dy = e.clientY - prevY;
          twinGroup.rotation.y += dx * 0.015;
          twinGroup.rotation.x += dy * 0.015;
          prevX = e.clientX;
          prevY = e.clientY;
        });

        function resize() {
          const w = container.clientWidth;
          const h = container.clientHeight || 220;
          renderer.setSize(w, h, false);
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
        }
        resize();

        let animId;
        let pulsePhase = 0;
        function animate() {
          animId = requestAnimationFrame(animate);

          pulsePhase += 0.05;
          const pulse = 1 + Math.sin(pulsePhase) * 0.06;
          coreMesh.scale.set(pulse, pulse, pulse);

          if (!isDragging) {
            twinGroup.rotation.y += spinSpeed;
          }

          ring1.rotation.x += spinSpeed * 1.3;
          ring1.rotation.z += spinSpeed * 0.7;
          ring2.rotation.y -= spinSpeed * 1.1;
          ring2.rotation.z += spinSpeed * 0.5;

          particles.rotation.y += spinSpeed * 0.6;

          renderer.render(scene, camera);
        }
        animate();

        this.twin = {
          onResize: resize,
          updateStatus(score, category) {
            const statusTag = document.getElementById("twin-status-tag");
            const statusText = document.getElementById("twin-status-text");
            const speedVal = document.getElementById("telem-speed");
            const eqVal = document.getElementById("telem-equilibrium");
            const urgVal = document.getElementById("telem-urgency");

            if (score >= 75 || category === "Good") {
              spinSpeed = 0.012;
              icoMat.color.setHex(0x10b981);
              icoMat.emissive.setHex(0x059669);
              coreMat.color.setHex(0x10b981);
              coreMat.emissive.setHex(0x10b981);
              pMat.color.setHex(0x10b981);
              if (statusTag) {
                statusTag.className = "twin-status-tag status-good";
                statusText.textContent = "Safe Equilibrium";
              }
              if (speedVal) speedVal.textContent = "1.2 rad/s";
              if (eqVal) eqVal.textContent = `${score.toFixed(1)}%`;
              if (urgVal) { urgVal.textContent = "Optimal"; urgVal.className = "telem-value text-success"; }
            } else if (score >= 50 || category === "Average") {
              spinSpeed = 0.022;
              icoMat.color.setHex(0xf59e0b);
              icoMat.emissive.setHex(0xd97706);
              coreMat.color.setHex(0xf59e0b);
              coreMat.emissive.setHex(0xf59e0b);
              pMat.color.setHex(0xf59e0b);
              if (statusTag) {
                statusTag.className = "twin-status-tag status-avg";
                statusText.textContent = "Moderate Variance";
              }
              if (speedVal) speedVal.textContent = "2.2 rad/s";
              if (eqVal) eqVal.textContent = `${score.toFixed(1)}%`;
              if (urgVal) { urgVal.textContent = "Monitoring"; urgVal.className = "telem-value text-warning"; }
            } else {
              spinSpeed = 0.038;
              icoMat.color.setHex(0xef4444);
              icoMat.emissive.setHex(0xdc2626);
              coreMat.color.setHex(0xef4444);
              coreMat.emissive.setHex(0xdc2626);
              pMat.color.setHex(0xef4444);
              if (statusTag) {
                statusTag.className = "twin-status-tag status-risk";
                statusText.textContent = "Critical Flux Alert";
              }
              if (speedVal) speedVal.textContent = "3.8 rad/s";
              if (eqVal) eqVal.textContent = `${score.toFixed(1)}%`;
              if (urgVal) { urgVal.textContent = "Immediate Action"; urgVal.className = "telem-value text-danger"; }
            }
          }
        };
      } catch (e) {
        console.warn("WebGL Digital Twin init error:", e);
      }
    },

    updateDigitalTwin(score, category) {
      if (this.twin && typeof this.twin.updateStatus === "function") {
        this.twin.updateStatus(score, category);
      }
    }
  };

  // -------------------------------------------------------------
  // 14. Animation Engine (Card 3D Tilt, Counters, Confetti)
  // -------------------------------------------------------------
  function initCardTiltPhysics() {
    const cards = document.querySelectorAll(".kpi-card, .chart-card, .results-card, .cluster-3d-card, .strategy-card");
    cards.forEach(card => {
      card.classList.add("tilt-card");
      card.addEventListener("mousemove", e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const rotX = ((y - cy) / cy) * -6;
        const rotY = ((x - cx) / cx) * 6;
        card.style.transform = `perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.015, 1.015, 1.015)`;
        card.style.setProperty("--glare-x", `${x}px`);
        card.style.setProperty("--glare-y", `${y}px`);
      });
      card.addEventListener("mouseleave", () => {
        card.style.transform = "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)";
      });
    });
  }

  function animateValue(elem, start, end, duration = 800, formatFn = Math.round) {
    if (!elem) return;
    const startTime = performance.now();
    const diff = end - start;
    function update(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = start + diff * ease;
      elem.innerHTML = formatFn(current);
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        elem.innerHTML = formatFn(end);
      }
    }
    requestAnimationFrame(update);
  }

  function triggerConfettiBurst() {
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#10b981", "#6366f1", "#06b6d4", "#f59e0b", "#ec4899", "#8b5cf6"];
    const particles = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 260,
        y: canvas.height * 0.45 + (Math.random() - 0.5) * 120,
        vx: (Math.random() - 0.5) * 18,
        vy: (Math.random() - 0.85) * 20,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        alpha: 1
      });
    }

    let animId;
    function render() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.45;
        p.vx *= 0.98;
        p.rotation += p.rotSpeed;
        p.alpha -= 0.014;

        if (p.alpha > 0 && p.y < canvas.height) {
          alive = true;
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        }
      });

      if (alive) {
        animId = requestAnimationFrame(render);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        cancelAnimationFrame(animId);
      }
    }
    render();
  }

  // Initialize App
  loadInitialData();
});
