/* =========================================================
   ENERGY DIVIDE — application logic
   ========================================================= */
(function () {
  "use strict";

  const $ = function (sel, root) { return (root || document).querySelector(sel); };
  const $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  const REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BASE = SDG.FORECAST_BASE;
  const DEFAULTS = Object.assign({}, BASE.defaults);

  const PRESETS = {
    bau: {
      controls: Object.assign({}, DEFAULTS),
      interventions: []
    },
    sdg: {
      controls: { targetYear: 2050, popGrowth: 0.7, richGrowth: -0.2, poorGrowth: 2.8, efficiency: 1.1 },
      interventions: SDG.SOLUTIONS.map(function (s) { return s.id; })
    },
    converge: {
      controls: { targetYear: 2050, popGrowth: 0.8, richGrowth: -0.1, poorGrowth: 2.4, efficiency: 0.8 },
      interventions: ["sufficiency", "finance", "cooking", "leapfrog"]
    }
  };

  const SHORT_NAMES = {
    efficiency: "Efficiency standards",
    sufficiency: "Sufficiency for top consumers",
    subsidy: "Subsidy reform & carbon price",
    finance: "Climate finance & tech transfer",
    leapfrog: "Distributed renewables",
    cooking: "Clean cooking & electricity",
    circular: "Circular economy",
    defaults: "Sustainable defaults"
  };

  const state = {
    year: 2023,
    sourceUnit: "share",
    forecastTab: "energy",
    preset: "bau",
    controls: Object.assign({}, DEFAULTS),
    interventions: new Set(),
    solutionFilter: "All",
    playing: false
  };

  /* ---------- helpers ---------- */
  function color(name) { return Charts.cssVar(name); }
  function sourceColor(src) { return color(src.colorVar); }
  function richColor() { return color("--gold"); }
  function poorColor() { return color("--teal"); }

  function fmt(n, d) {
    d = d || 0;
    return Number(n).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function pct(n, d) { return fmt(n, d === undefined ? 1 : d) + "%"; }
  function signed(n, d) {
    const sign = n > 0 ? "+" : (n < 0 ? "−" : "");
    return sign + fmt(Math.abs(n), d === undefined ? 1 : d);
  }
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove("is-visible"); }, 2600);
  }

  /* =========================================================
     HERO
     ========================================================= */
  function renderSplit() {
    const d = SDG.getYear(2023);
    const co2Share = d.co2Rich / d.co2Total * 100;
    const materialRich = 21;
    const materialPoor = 4.2;
    const matShare = materialRich / (materialRich + materialPoor) * 100;

    const rows = [
      { label: "Population", rich: 50, poor: 50 },
      { label: "Primary energy", rich: d.shareRich * 100, poor: (1 - d.shareRich) * 100 },
      { label: "CO₂ emissions", rich: co2Share, poor: 100 - co2Share },
      { label: "Material footprint", rich: matShare, poor: 100 - matShare }
    ];

    const holder = $("#splitRows");
    if (!holder) return;
    holder.innerHTML = rows.map(function (r, i) {
      return '<div class="split-row">' +
        '<div class="split-row-top"><span>' + r.label + '</span>' +
        '<span class="split-vals"><span class="v-rich">' + pct(r.rich, 1) + '</span>' +
        '<span class="v-poor">' + pct(r.poor, 1) + '</span></span></div>' +
        '<div class="split-bar">' +
        '<span class="seg seg-rich" style="width:' + r.rich.toFixed(1) + '%;animation-delay:' + (i * 70) + 'ms"></span>' +
        '<span class="seg seg-poor" style="width:' + r.poor.toFixed(1) + '%;animation-delay:' + (i * 70 + 90) + 'ms"></span>' +
        '</div></div>';
    }).join("");

    const ratioEl = $("#heroRatio");
    if (ratioEl) ratioEl.textContent = d.ratio.toFixed(1) + "×";
  }

  function renderHeroSpark() {
    const holder = $("#heroSpark");
    if (!holder) return;
    const hist = SDG.history();
    Charts.lineChart(holder, {
      xs: hist.map(function (d) { return d.year; }),
      series: [{
        name: "Rich share",
        values: hist.map(function (d) { return d.shareRich * 100; }),
        color: richColor(),
        width: 1.8,
        area: true
      }],
      yMin: 74,
      yMax: 88,
      height: 52,
      minimal: true,
      interactive: false,
      ariaLabel: "Rich half's share of global energy, 1990 to 2023, falling from 86% to 78%."
    });
  }

  /* =========================================================
     ENERGY MIX SECTION
     ========================================================= */
  function renderData() {
    const d = SDG.getYear(state.year);
    const out = $("#yearOut");
    if (out) out.textContent = d.year;

    $("#richPeople").textContent = d.popHalf.toFixed(2);
    $("#poorPeople").textContent = d.popHalf.toFixed(2);
    $("#richEnergy").textContent = fmt(d.energyRich, 0);
    $("#poorEnergy").textContent = fmt(d.energyPoor, 0);
    $("#richCapita").textContent = fmt(d.pcRich, 0);
    $("#poorCapita").textContent = fmt(d.pcPoor, 0);
    $("#richCo2").textContent = fmt(d.co2RichPC, 1);
    $("#poorCo2").textContent = fmt(d.co2PoorPC, 1);

    renderDonutCard("rich", d.mixRich, d.pcRich);
    renderDonutCard("poor", d.mixPoor, d.pcPoor);

    $("#worldEnergy").textContent = fmt(d.energyTotal, 0);
    $("#insightYear").textContent = d.year;
    $("#worldPop").textContent = d.popTotal.toFixed(2);
    $("#richShare").textContent = pct(d.shareRich * 100, 1);

    const fossilWorld = d.worldMix.oil + d.worldMix.coal + d.worldMix.gas;
    $("#fossilShare").textContent = pct(fossilWorld, 0);
    $("#biomassShare").textContent = pct(d.worldMix.biomass, 0);

    const mixBar = $("#worldMix");
    if (mixBar) {
      mixBar.innerHTML = SDG.SOURCES.map(function (s) {
        const v = d.worldMix[s.key];
        return '<span style="width:' + v.toFixed(2) + '%;background:' + sourceColor(s) + '" title="' +
          s.label + ': ' + pct(v, 1) + '"></span>';
      }).join("");
    }

    const biomassPoor = Math.round(d.mixPoor.biomass);
    $("#insightNote").textContent = "The poor half relies on traditional biomass for about " +
      biomassPoor + "% of its energy — a source that is inefficient, polluting and linked to millions of premature deaths each year.";

    renderSourceBars(d);
  }

  function renderDonutCard(group, mix, pc) {
    const isRich = group === "rich";
    const holder = isRich ? $("#donutRich") : $("#donutPoor");
    const legend = isRich ? $("#legendRich") : $("#legendPoor");
    if (!holder || !legend) return;

    Charts.donut(holder, {
      segments: SDG.SOURCES.map(function (s) {
        return { label: s.label, value: mix[s.key], color: sourceColor(s) };
      }),
      centerValue: fmt(pc, 0),
      centerUnit: "GJ per person",
      ariaLabel: (isRich ? "Rich" : "Poor") + " half energy mix by source"
    });

    legend.innerHTML = SDG.SOURCES.map(function (s) {
      return '<li data-index="' + SDG.SOURCES.indexOf(s) + '"><span class="swatch" style="background:' + sourceColor(s) + '"></span>' +
        '<span class="lg-name">' + s.label + '</span>' +
        '<b>' + pct(mix[s.key], 0) + '</b></li>';
    }).join("");

    /* Tie each legend row to its arc so the chart is readable without
       relying on colour alone. */
    const segments = holder.querySelectorAll(".donut-seg");
    const valueEl = holder.querySelector(".donut-value");
    const unitEl = holder.querySelector(".donut-unit");
    const baseValue = valueEl ? valueEl.textContent : "";
    const baseUnit = unitEl ? unitEl.textContent : "";

    function clearFocus() {
      holder.classList.remove("is-focused");
      segments.forEach(function (seg) { seg.classList.remove("is-hot"); });
      if (valueEl) valueEl.textContent = baseValue;
      if (unitEl) unitEl.textContent = baseUnit;
    }

    $$("li", legend).forEach(function (li, i) {
      const src = SDG.SOURCES[i];
      li.addEventListener("mouseenter", function () {
        holder.classList.add("is-focused");
        segments.forEach(function (seg, j) {
          seg.classList.toggle("is-hot", j === i);
        });
        if (valueEl) valueEl.textContent = pct(mix[src.key], 0);
        if (unitEl) unitEl.textContent = src.label;
      });
      li.addEventListener("mouseleave", clearFocus);
    });
  }

  function renderSourceBars(d) {
    const holder = $("#sourceBars");
    if (!holder) return;
    const unit = state.sourceUnit;

    const values = SDG.SOURCES.map(function (s) {
      let rich, poor;
      if (unit === "share") {
        rich = d.mixRich[s.key];
        poor = d.mixPoor[s.key];
      } else if (unit === "total") {
        rich = d.perSourceRich[s.key];
        poor = d.perSourcePoor[s.key];
      } else {
        rich = d.mixRich[s.key] / 100 * d.pcRich;
        poor = d.mixPoor[s.key] / 100 * d.pcPoor;
      }
      return { src: s, rich: rich, poor: poor };
    });

    const max = Math.max.apply(null, values.map(function (v) { return Math.max(v.rich, v.poor); })) || 1;

    function formatValue(v) {
      if (unit === "share") return pct(v, 0);
      if (unit === "total") return fmt(v, v >= 100 ? 0 : 1) + " EJ";
      return fmt(v, 1) + " GJ";
    }

    holder.innerHTML = values.map(function (v) {
      const richW = clamp(v.rich / max * 100, 0, 100);
      const poorW = clamp(v.poor / max * 100, 0, 100);
      const ratio = v.poor > 0 ? v.rich / v.poor : null;
      return '<div class="source-row">' +
        '<div class="source-label"><span class="swatch" style="background:' + sourceColor(v.src) + '"></span>' + v.src.label + '</div>' +
        '<div class="source-bars-holder">' +
          '<div class="sbar" title="Rich half · ' + v.src.label + '">' +
            '<div class="sbar-track"><span class="sbar-fill rich" style="--w:' + richW.toFixed(1) + '%"></span></div>' +
            '<b>' + formatValue(v.rich) + '</b>' +
          '</div>' +
          '<div class="sbar" title="Poor half · ' + v.src.label + '">' +
            '<div class="sbar-track"><span class="sbar-fill poor" style="--w:' + poorW.toFixed(1) + '%"></span></div>' +
            '<b>' + formatValue(v.poor) + '</b>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join("");

    const note = $("#sourceNote");
    if (note) {
      if (unit === "share") {
        note.textContent = "Shares are a percentage of each half's own energy mix. Bars are scaled to the largest value shown.";
      } else if (unit === "total") {
        note.textContent = "Total primary energy in exajoules (EJ). Bars are scaled to the largest source shown.";
      } else {
        note.textContent = "Gigajoules per person per year. Bars are scaled to the largest source shown.";
      }
    }
  }

  /* =========================================================
     DISPARITY SECTION
     ========================================================= */
  function renderMetrics() {
    const holder = $("#metricsGrid");
    if (!holder) return;

    function formatValue(v, format) {
      if (format === "pct") return fmt(v, 0) + "%";
      if (format === "dec1") return fmt(v, 1);
      return fmt(v, 0);
    }

    holder.innerHTML = SDG.DISPARITIES.map(function (m) {
      const isPct = m.format === "pct";
      const max = isPct ? 100 : Math.max(m.rich, m.poor);
      return '<article class="metric-card glass">' +
        '<div class="metric-head"><h3>' + m.label + '</h3><span class="ratio-chip">' + m.ratio + '</span></div>' +
        '<div class="metric-values">' +
          '<div><span class="metric-value">' + formatValue(m.rich, m.format) + '</span>' +
          '<span class="metric-unit">' + m.unit + ' · rich half</span></div>' +
          '<div><span class="metric-value">' + formatValue(m.poor, m.format) + '</span>' +
          '<span class="metric-unit">' + m.unit + ' · poor half</span></div>' +
        '</div>' +
        '<div class="metric-bars">' +
          '<div class="metric-bar-track"><span class="metric-bar-fill rich" style="width:' + (m.rich / max * 100) + '%"></span></div>' +
          '<div class="metric-bar-track"><span class="metric-bar-fill poor" style="width:' + (m.poor / max * 100) + '%"></span></div>' +
        '</div>' +
        '<p class="metric-note">' + m.note + '</p>' +
      '</article>';
    }).join("");
  }

  function renderTrends() {
    const hist = SDG.history();
    const xs = hist.map(function (d) { return d.year; });
    const gold = richColor();

    Charts.lineChart($("#shareChart"), {
      xs: xs,
      series: [{
        name: "Rich share",
        values: hist.map(function (d) { return d.shareRich * 100; }),
        color: gold,
        width: 2.4,
        area: true
      }],
      yMin: 70,
      yMax: 90,
      height: 252,
      xTicks: [1990, 2000, 2010, 2023],
      formatY: function (v) { return Math.round(v) + "%"; },
      formatX: function (v) { return String(v); },
      tipTitle: function (x) { return x + " · actual"; },
      tipRows: function (i) {
        return [
          { name: "Rich share", value: hist[i].shareRich * 100, color: gold, format: function (v) { return pct(v, 1); } },
          { name: "Rich energy", value: hist[i].energyRich, color: gold, dim: true, format: function (v) { return fmt(v, 0) + " EJ"; } }
        ];
      },
      ariaLabel: "Line chart of the rich half's share of global primary energy from 1990 to 2023, falling from 85.8% to 77.8%."
    });

    Charts.lineChart($("#gapChart"), {
      xs: xs,
      series: [{
        name: "Per-person gap",
        values: hist.map(function (d) { return d.ratio; }),
        color: gold,
        width: 2.4,
        area: true
      }],
      yMin: 0,
      yMax: 7,
      height: 252,
      xTicks: [1990, 2000, 2010, 2023],
      formatY: function (v) { return fmt(v, 0) + "×"; },
      tipTitle: function (x) { return x + " · actual"; },
      tipRows: function (i) {
        return [
          { name: "Gap", value: hist[i].ratio, color: gold, format: function (v) { return fmt(v, 1) + "×"; } },
          { name: "Rich half", value: hist[i].pcRich, color: gold, dim: true, format: function (v) { return fmt(v, 0) + " GJ"; } },
          { name: "Poor half", value: hist[i].pcPoor, color: poorColor(), dim: true, format: function (v) { return fmt(v, 0) + " GJ"; } }
        ];
      },
      ariaLabel: "Line chart of the per-person energy gap between the rich and poor halves from 1990 to 2023, falling from 6.1 times to 3.5 times."
    });
  }

  /* =========================================================
     FORECAST MODEL
     ========================================================= */
  function aggregate() {
    let efficiency = state.controls.efficiency;
    let richAdd = 0;
    let poorAdd = 0;
    let carbonAdd = 0;

    state.interventions.forEach(function (id) {
      const sol = SDG.SOLUTIONS.find(function (s) { return s.id === id; });
      if (!sol) return;
      const e = sol.effects;
      efficiency += e.efficiency || 0;
      richAdd += e.richGrowth || 0;
      poorAdd += e.poorGrowth || 0;
      carbonAdd += e.carbon || 0;
    });

    return { efficiency: efficiency, richAdd: richAdd, poorAdd: poorAdd, carbonAdd: carbonAdd };
  }

  function project(opts) {
    const target = opts.targetYear;
    const gR = clamp((opts.richGrowth - opts.efficiency + opts.richAdd) / 100, -0.09, 0.09);
    const gP = clamp((opts.poorGrowth - opts.efficiency + opts.poorAdd) / 100, -0.09, 0.09);
    const rows = [];

    for (let y = 2023; y <= target; y++) {
      const n = y - 2023;
      const popHalf = BASE.popHalf * Math.pow(1 + opts.popGrowth / 100, n);
      const pcRich = clamp(BASE.pcRich * Math.pow(1 + gR, n), 40, 320);
      const pcPoor = clamp(BASE.pcPoor * Math.pow(1 + gP, n), 15, 220);
      const eRich = pcRich * popHalf;
      const ePoor = pcPoor * popHalf;
      const ciFactor = Math.pow(1 - (0.010 + opts.carbonAdd / 100), n);
      const ciRich = Math.max(4, BASE.carbonIntensityRich * ciFactor);
      const ciPoor = Math.max(4, BASE.carbonIntensityPoor * ciFactor);
      const co2Rich = eRich * ciRich / 1000;
      const co2Poor = ePoor * ciPoor / 1000;

      rows.push({
        year: y,
        popHalf: popHalf,
        popTotal: popHalf * 2,
        pcRich: pcRich,
        pcPoor: pcPoor,
        eRich: eRich,
        ePoor: ePoor,
        energyRich: eRich,
        energyPoor: ePoor,
        eTotal: eRich + ePoor,
        shareRich: eRich / (eRich + ePoor),
        co2Rich: co2Rich,
        co2Poor: co2Poor,
        co2Total: co2Rich + co2Poor
      });
    }
    return rows;
  }

  function scenarioModel() {
    const agg = aggregate();
    return project({
      targetYear: state.controls.targetYear,
      popGrowth: state.controls.popGrowth,
      richGrowth: state.controls.richGrowth,
      poorGrowth: state.controls.poorGrowth,
      efficiency: agg.efficiency,
      richAdd: agg.richAdd,
      poorAdd: agg.poorAdd,
      carbonAdd: agg.carbonAdd
    });
  }

  function bauModel() {
    return project({
      targetYear: state.controls.targetYear,
      popGrowth: DEFAULTS.popGrowth,
      richGrowth: DEFAULTS.richGrowth,
      poorGrowth: DEFAULTS.poorGrowth,
      efficiency: DEFAULTS.efficiency,
      richAdd: 0,
      poorAdd: 0,
      carbonAdd: 0
    });
  }

  /* =========================================================
     FORECAST UI
     ========================================================= */
  let forecastRaf = null;
  function scheduleForecast() {
    if (forecastRaf) return;
    forecastRaf = requestAnimationFrame(function () {
      forecastRaf = null;
      renderForecast();
    });
  }

  function sliderText(name, value) {
    if (name === "targetYear") return String(value);
    if (name === "efficiency") return "−" + Number(value).toFixed(2) + "% / yr";
    return signed(Number(value), 2) + "% / yr";
  }

  function syncControls() {
    Object.keys(state.controls).forEach(function (name) {
      const input = document.getElementById(name);
      const out = document.getElementById(name + "Out");
      if (input) input.value = state.controls[name];
      if (out) out.textContent = sliderText(name, state.controls[name]);
    });
  }

  function updatePresetUI() {
    $$("#presets .preset").forEach(function (btn) {
      btn.classList.toggle("is-active", btn.dataset.preset === state.preset);
    });
    const el = $("#presetState");
    if (!el) return;
    if (state.preset === "bau") {
      el.textContent = "Baseline · today's trends, no new interventions";
    } else if (state.preset === "sdg") {
      el.textContent = "SDG 12 pathway · all 8 interventions, rapid convergence";
    } else if (state.preset === "converge") {
      el.textContent = "Convergence first · four equity-led interventions";
    } else {
      el.textContent = "Custom scenario · " + state.interventions.size + " intervention" +
        (state.interventions.size === 1 ? "" : "s");
    }
  }

  function syncInterventionUI() {
    $$("#interventionList input").forEach(function (input) {
      input.checked = state.interventions.has(input.value);
    });
    const chip = $("#interventionCount");
    if (chip) chip.textContent = state.interventions.size + " selected";
    syncSolutionButtons();
  }

  function buildForecastControls() {
    syncControls();

    Object.keys(state.controls).forEach(function (name) {
      const input = document.getElementById(name);
      if (!input) return;
      input.addEventListener("input", function () {
        state.controls[name] = parseFloat(input.value);
        state.preset = "custom";
        const out = document.getElementById(name + "Out");
        if (out) out.textContent = sliderText(name, state.controls[name]);
        updatePresetUI();
        scheduleForecast();
      });
    });

    const list = $("#interventionList");
    if (list) {
      list.innerHTML = SDG.SOLUTIONS.map(function (s) {
        return '<li><label for="int-' + s.id + '">' +
          '<input type="checkbox" id="int-' + s.id + '" value="' + s.id + '">' +
          '<span class="int-text"><b>' + (SHORT_NAMES[s.id] || s.title) + '</b>' +
          '<span>' + s.effectLabel + '</span></span>' +
          '</label></li>';
      }).join("");
      list.addEventListener("change", function (e) {
        if (!e.target.matches("input[type=checkbox]")) return;
        toggleSolution(e.target.value, e.target.checked, "lab");
      });
    }

    $$("#presets .preset").forEach(function (btn) {
      btn.addEventListener("click", function () {
        applyPreset(btn.dataset.preset);
      });
    });

    const reset = $("#resetBtn");
    if (reset) {
      reset.addEventListener("click", function () {
        applyPreset("bau");
        toast("Scenario reset to the current trajectory");
      });
    }

    const csv = $("#csvBtn");
    if (csv) csv.addEventListener("click", downloadCSV);
  }

  function applyPreset(key) {
    const preset = PRESETS[key];
    if (!preset) return;
    state.preset = key;
    state.controls = Object.assign({}, preset.controls);
    state.interventions = new Set(preset.interventions);
    syncControls();
    syncInterventionUI();
    updatePresetUI();
    renderForecast();
  }

  function toggleSolution(id, force, source) {
    const has = state.interventions.has(id);
    const next = force === undefined ? !has : !!force;
    if (next) state.interventions.add(id);
    else state.interventions.delete(id);

    state.preset = "custom";
    syncInterventionUI();
    updatePresetUI();
    scheduleForecast();

    if (source === "card") {
      const sol = SDG.SOLUTIONS.find(function (s) { return s.id === id; });
      toast(next ? "“" + (sol ? sol.title : "Intervention") + "” added to the forecast" : "Intervention removed from the forecast");
    }
  }

  function forecastTabConfig(tab) {
    if (tab === "capita") {
      return {
        unit: "GJ",
        label: "primary energy per person",
        caption: "Primary energy per person in gigajoules (GJ) per year.",
        formatY: function (v) { return fmt(v, 0); },
        tipFormat: function (v) { return fmt(v, 0) + " GJ"; }
      };
    }
    if (tab === "co2") {
      return {
        unit: "Gt",
        label: "energy CO₂",
        caption: "Energy-related CO₂ emissions in gigatonnes (Gt) per year.",
        formatY: function (v) { return fmt(v, 0); },
        tipFormat: function (v) { return fmt(v, 1) + " Gt"; }
      };
    }
    return {
      unit: "EJ",
      label: "primary energy",
      caption: "Primary energy use in exajoules (EJ) per year.",
      formatY: function (v) { return fmt(v, 0); },
      tipFormat: function (v) { return fmt(v, 0) + " EJ"; }
    };
  }

  function renderForecast() {
    const scenario = scenarioModel();
    const bau = bauModel();
    const last = scenario[scenario.length - 1];
    const lastBau = bau[bau.length - 1];
    const tab = state.forecastTab;

    const chartEl = $("#forecastChart");
    if (!chartEl) return;

    const hist = SDG.history().filter(function (d) { return d.year <= 2023; });
    const years = hist.map(function (d) { return d.year; });
    for (let y = 2024; y <= state.controls.targetYear; y++) years.push(y);

    const histMap = {};
    hist.forEach(function (d) { histMap[d.year] = d; });
    const scMap = {};
    scenario.forEach(function (d) { scMap[d.year] = d; });
    const bauMap = {};
    bau.forEach(function (d) { bauMap[d.year] = d; });

    const gold = richColor();
    const teal = poorColor();
    const faint = color("--faint");

    function pick(metric, year) {
      if (year <= 2023) {
        const d = histMap[year];
        return d ? d[metric] : null;
      }
      return scMap[year] ? scMap[year][metric] : null;
    }
    function pickBau(metric, year) {
      if (year < 2023) return null;
      return bauMap[year] ? bauMap[year][metric] : null;
    }

    let scRich = null, scPoor = null, bauRich = null, bauPoor = null;
    if (tab === "capita") {
      scRich = years.map(function (y) { return pick("pcRich", y); });
      scPoor = years.map(function (y) { return pick("pcPoor", y); });
      bauRich = years.map(function (y) { return pickBau("pcRich", y); });
      bauPoor = years.map(function (y) { return pickBau("pcPoor", y); });
    } else if (tab === "co2") {
      scRich = years.map(function (y) { return pick("co2Rich", y); });
      scPoor = years.map(function (y) { return pick("co2Poor", y); });
      bauRich = years.map(function (y) { return pickBau("co2Rich", y); });
      bauPoor = years.map(function (y) { return pickBau("co2Poor", y); });
    } else {
      scRich = years.map(function (y) { return pick("energyRich", y); });
      scPoor = years.map(function (y) { return pick("energyPoor", y); });
      bauRich = years.map(function (y) { return pickBau("energyRich", y); });
      bauPoor = years.map(function (y) { return pickBau("energyPoor", y); });
    }

    const cfg = forecastTabConfig(tab);
    const target = state.controls.targetYear;

    const ticks = window.innerWidth < 640
      ? [1990, 2020, target]
      : (function () {
          const base = [1990, 2000, 2010, 2020, 2030, 2040, 2050, 2060].filter(function (t) { return t <= target; });
          if (base.indexOf(target) === -1) base.push(target);
          return base;
        })();

    const differs = Math.abs(last.eTotal - lastBau.eTotal) > 0.5 ||
      Math.abs(last.co2Total - lastBau.co2Total) > 0.2 ||
      Math.abs(last.pcRich - lastBau.pcRich) > 0.2;

    const series = [
      { name: "Current path · rich", values: bauRich, color: gold, width: 1.4, dashed: true, opacity: 0.5, noDot: true, dim: true },
      { name: "Current path · poor", values: bauPoor, color: teal, width: 1.4, dashed: true, opacity: 0.5, noDot: true, dim: true },
      { name: "Poor half", values: scPoor, color: teal, width: 2.6 },
      { name: "Rich half", values: scRich, color: gold, width: 2.6 }
    ];

    const ariaValue = tab === "capita"
      ? fmt(last.pcRich, 0) + " gigajoules for the rich half and " + fmt(last.pcPoor, 0) + " for the poor half"
      : (tab === "co2"
        ? fmt(last.co2Rich, 1) + " gigatonnes for the rich half and " + fmt(last.co2Poor, 1) + " for the poor half"
        : fmt(last.eRich, 0) + " exajoules for the rich half and " + fmt(last.ePoor, 0) + " for the poor half");

    Charts.lineChart(chartEl, {
      xs: years,
      series: series,
      yMin: 0,
      height: window.innerWidth < 700 ? 300 : 382,
      xTicks: ticks,
      formatY: cfg.formatY,
      formatX: function (v) { return String(v); },
      refX: 2023,
      refLabel: "2023 · today",
      shadeFrom: 2023,
      shadeLabel: "PROJECTION",
      gap: tab === "capita" ? { top: 3, bottom: 2, fromX: 2023, color: gold, opacity: 0.08 } : null,
      tipRows: function (i) {
        const y = years[i];
        const rows = [
          { name: "Rich half", value: scRich[i], color: gold, format: cfg.tipFormat },
          { name: "Poor half", value: scPoor[i], color: teal, format: cfg.tipFormat }
        ];
        if (differs && y > 2023) {
          rows.push({ name: "Rich · current path", value: bauRich[i], color: faint, dim: true, format: cfg.tipFormat });
          rows.push({ name: "Poor · current path", value: bauPoor[i], color: faint, dim: true, format: cfg.tipFormat });
        }
        return rows;
      },
      tipTitle: function (x) { return x + (x > 2023 ? " · projection" : " · actual"); },
      ariaLabel: "Line chart of " + cfg.label + " from 1990 to " + target +
        ". In " + target + ", " + ariaValue + ". Dashed lines show the current trajectory."
    });

    const legend = $("#forecastLegend");
    if (legend) {
      legend.innerHTML =
        '<span><i class="line" style="background:' + gold + '"></i>Rich half</span>' +
        '<span><i class="line" style="background:' + teal + '"></i>Poor half</span>' +
        '<span><i class="line dashed"></i>Current trajectory</span>';
    }

    const caption = $("#forecastCaption");
    if (caption) {
      caption.textContent = cfg.caption +
        " Dashed lines show what happens if today's trends continue." +
        (tab === "capita" ? " Shaded band = per-person gap." : "") +
        (differs ? "" : " Your scenario currently matches this path.");
    }

    renderOutcomes(last, lastBau, target);
    $("#interventionCount").textContent = state.interventions.size + " selected";
  }

  function deltaLine(value, base, options) {
    options = options || {};
    const lowerIsBetter = options.lowerIsBetter !== false;
    const unit = options.unit || "%";
    if (!isFinite(value) || !isFinite(base) || base === 0) {
      return '<span class="outcome-delta neutral">–</span>';
    }
    if (unit === "pp") {
      const diff = value - base;
      if (Math.abs(diff) < 0.05) return '<span class="outcome-delta neutral">≈ current path</span>';
      const good = lowerIsBetter ? diff < 0 : diff > 0;
      return '<span class="outcome-delta ' + (good ? "good" : "bad") + '">' +
        (diff > 0 ? "+" : "−") + fmt(Math.abs(diff), 1) + " pt vs current path</span>";
    }
    const rel = (value - base) / base * 100;
    if (Math.abs(rel) < 0.4) return '<span class="outcome-delta neutral">≈ current path</span>';
    const good = lowerIsBetter ? rel < 0 : rel > 0;
    return '<span class="outcome-delta ' + (good ? "good" : "bad") + '">' +
      (rel > 0 ? "+" : "−") + fmt(Math.abs(rel), 0) + "% vs current path</span>";
  }

  function renderOutcomes(last, lastBau, target) {
    const holder = $("#outcomes");
    if (!holder) return;
    const gap = last.pcRich / last.pcPoor;
    const bauGap = lastBau.pcRich / lastBau.pcPoor;

    holder.innerHTML =
      '<div class="outcome">' +
        '<span class="outcome-label">Global energy in ' + target + '</span>' +
        '<span class="outcome-value">' + fmt(last.eTotal, 0) + '<em>EJ</em></span>' +
        deltaLine(last.eTotal, lastBau.eTotal, { lowerIsBetter: true }) +
      '</div>' +
      '<div class="outcome">' +
        '<span class="outcome-label">Per-person gap in ' + target + '</span>' +
        '<span class="outcome-value">' + fmt(gap, 1) + '<em>×</em></span>' +
        '<span class="outcome-delta ' + (gap < bauGap - 0.02 ? "good" : (gap > bauGap + 0.02 ? "bad" : "neutral")) + '">' +
          fmt(last.pcRich, 0) + " vs " + fmt(last.pcPoor, 0) + " GJ</span>" +
      '</div>' +
      '<div class="outcome">' +
        '<span class="outcome-label">Energy CO₂ in ' + target + '</span>' +
        '<span class="outcome-value">' + fmt(last.co2Total, 1) + '<em>Gt</em></span>' +
        deltaLine(last.co2Total, lastBau.co2Total, { lowerIsBetter: true }) +
      '</div>' +
      '<div class="outcome">' +
        '<span class="outcome-label">Rich half\'s share of energy</span>' +
        '<span class="outcome-value">' + pct(last.shareRich * 100, 1) + '</span>' +
        deltaLine(last.shareRich * 100, lastBau.shareRich * 100, { lowerIsBetter: true, unit: "pp" }) +
      '</div>';
  }

  function downloadCSV() {
    const scenario = scenarioModel();
    const bau = bauModel();
    const bauMap = {};
    bau.forEach(function (r) { bauMap[r.year] = r; });

    const lines = ["Year,Scenario rich (EJ),Scenario poor (EJ),Scenario total (EJ),Current rich (EJ),Current poor (EJ),Current total (EJ),Scenario CO2 (Gt),Current CO2 (Gt)"];
    scenario.forEach(function (r) {
      const b = bauMap[r.year];
      lines.push([
        r.year,
        r.eRich.toFixed(2),
        r.ePoor.toFixed(2),
        r.eTotal.toFixed(2),
        b ? b.eRich.toFixed(2) : "",
        b ? b.ePoor.toFixed(2) : "",
        b ? b.eTotal.toFixed(2) : "",
        r.co2Total.toFixed(3),
        b ? b.co2Total.toFixed(3) : ""
      ].join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "energy-divide-scenario-" + state.controls.targetYear + ".csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast("Scenario downloaded as CSV");
  }

  /* =========================================================
     SOLUTIONS
     ========================================================= */
  function buildSolutions() {
    const filters = $("#solutionFilters");
    const grid = $("#solutionsGrid");
    if (!filters || !grid) return;

    const categories = ["All"];
    SDG.SOLUTIONS.forEach(function (s) {
      if (categories.indexOf(s.category) === -1) categories.push(s.category);
    });

    filters.innerHTML = categories.map(function (c) {
      return '<button type="button" class="filter-chip' + (c === "All" ? " is-active" : "") +
        '" data-filter="' + c + '">' + c + '</button>';
    }).join("");

    filters.addEventListener("click", function (e) {
      const btn = e.target.closest(".filter-chip");
      if (!btn) return;
      state.solutionFilter = btn.dataset.filter;
      $$(".filter-chip", filters).forEach(function (b) {
        b.classList.toggle("is-active", b === btn);
      });
      $$(".solution-card", grid).forEach(function (card) {
        card.classList.toggle("is-hidden", state.solutionFilter !== "All" && card.dataset.category !== state.solutionFilter);
      });
    });

    grid.innerHTML = SDG.SOLUTIONS.map(function (s) {
      const dots = Array.from({ length: 5 }, function (_, i) {
        return '<i class="' + (i < s.feasibility ? "on" : "") + '"></i>';
      }).join("");
      const feasLabel = s.feasibility >= 5 ? "Very high" : (s.feasibility >= 4 ? "High" : "Medium");
      return '<article class="solution-card glass" data-category="' + s.category + '">' +
        '<div class="solution-top"><span class="cat-chip">' + s.category + '</span></div>' +
        '<h3>' + s.title + '</h3>' +
        '<p class="solution-summary">' + s.summary + '</p>' +
        '<div class="solution-impact"><span>Potential impact</span><b>' + s.impact + '</b></div>' +
        '<div class="solution-foot">' +
          '<div class="feasibility"><span>Feasibility</span><div class="feas-row"><div class="feas-dots">' + dots + '</div><em>' + feasLabel + '</em></div></div>' +
          '<button type="button" class="add-btn" data-id="' + s.id + '" aria-pressed="false">' +
            '<span class="plus" aria-hidden="true">+</span><span class="add-label">Add to forecast</span>' +
          '</button>' +
        '</div>' +
      '</article>';
    }).join("");

    grid.addEventListener("click", function (e) {
      const btn = e.target.closest(".add-btn");
      if (!btn) return;
      toggleSolution(btn.dataset.id, undefined, "card");
    });

    syncSolutionButtons();
  }

  function syncSolutionButtons() {
    $$(".add-btn").forEach(function (btn) {
      const added = state.interventions.has(btn.dataset.id);
      btn.classList.toggle("is-added", added);
      btn.setAttribute("aria-pressed", String(added));
      const plus = $(".plus", btn);
      const label = $(".add-label", btn);
      if (plus) plus.textContent = added ? "✓" : "+";
      if (label) label.textContent = added ? "Added" : "Add to forecast";
    });
  }

  /* =========================================================
     THEME
     ========================================================= */
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const toggle = $("#themeToggle");
    if (toggle) {
      toggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#080b0a" : "#f3f1ea");
  }

  function refreshThemeDependent() {
    renderHeroSpark();
    renderData();
    renderTrends();
    renderForecast();
  }

  function setTheme(theme, persist) {
    applyTheme(theme);
    if (persist !== false) {
      try { localStorage.setItem("energy-divide-theme", theme); } catch (e) { /* ignore */ }
    }
    refreshThemeDependent();
  }

  /* =========================================================
     SCROLL / REVEAL / COUNT-UP
     ========================================================= */
  function initScrollUI() {
    const header = $("#siteHeader");
    const bar = $("#scrollBar");

    function onScroll() {
      const top = window.scrollY || document.documentElement.scrollTop;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (header) header.classList.toggle("is-scrolled", top > 8);
      if (bar) bar.style.width = (max > 0 ? clamp(top / max * 100, 0, 100) : 0) + "%";
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    const revealEls = $$(".reveal");
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            io.unobserve(entry.target);
          }
        });
      }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
      revealEls.forEach(function (el) { io.observe(el); });
    } else {
      revealEls.forEach(function (el) { el.classList.add("in"); });
    }

    $$("[data-count]").forEach(function (el) {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || "0", 10);
      if (REDUCED) {
        el.textContent = fmt(target, decimals);
        return;
      }
      el.textContent = fmt(0, decimals);
      const io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const duration = 1300;
        function frame(now) {
          const t = Math.min(1, (now - start) / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          el.textContent = fmt(target * eased, decimals);
          if (t < 1) requestAnimationFrame(frame);
          else el.textContent = fmt(target, decimals);
        }
        requestAnimationFrame(frame);
      }, { threshold: 0.5 });
      io.observe(el);
    });
  }

  function initNav() {
    const menuBtn = $("#menuToggle");
    const nav = $("#primaryNav");
    if (!menuBtn || !nav) return;

    function close() {
      nav.classList.remove("is-open");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Open menu");
    }

    menuBtn.addEventListener("click", function () {
      const open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      menuBtn.setAttribute("aria-expanded", String(open));
      menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });

    $$(".nav-link", nav).forEach(function (link) {
      link.addEventListener("click", function () {
        $$(".nav-link", nav).forEach(function (l) { l.classList.remove("is-active"); });
        link.classList.add("is-active");
        close();
      });
    });

    document.addEventListener("click", function (e) {
      if (!nav.classList.contains("is-open")) return;
      if (nav.contains(e.target) || menuBtn.contains(e.target)) return;
      close();
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
    });

    if ("IntersectionObserver" in window) {
      const links = $$(".nav-link", nav);
      const sections = links.map(function (l) { return document.querySelector(l.getAttribute("href")); }).filter(Boolean);
      const io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (l) {
            l.classList.toggle("is-active", l.getAttribute("href") === "#" + entry.target.id);
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
      sections.forEach(function (s) { io.observe(s); });
    }
  }

  /* =========================================================
     YEAR TIMELINE
     ========================================================= */
  let yearRaf = null;
  function scheduleData() {
    if (yearRaf) return;
    yearRaf = requestAnimationFrame(function () {
      yearRaf = null;
      renderData();
    });
  }

  function initTimeline() {
    const range = $("#yearRange");
    const play = $("#playBtn");
    if (!range || !play) return;

    range.addEventListener("input", function () {
      stopPlayback();
      state.year = parseInt(range.value, 10);
      scheduleData();
    });

    play.addEventListener("click", function () {
      if (state.playing) {
        stopPlayback();
        return;
      }
      if (state.year >= 2023) state.year = 1990;
      state.playing = true;
      play.classList.add("is-playing");
      play.setAttribute("aria-label", "Pause the timeline");
      play.innerHTML = "&#10073;&#10073;";
      range.value = state.year;
      scheduleData();
      play._timer = setInterval(function () {
        state.year += 1;
        if (state.year >= 2023) {
          state.year = 2023;
          stopPlayback();
        }
        range.value = state.year;
        scheduleData();
      }, 130);
    });

    function stopPlayback() {
      state.playing = false;
      clearInterval(play._timer);
      play.classList.remove("is-playing");
      play.setAttribute("aria-label", "Play the timeline");
      play.innerHTML = "&#9654;";
    }
  }

  function initTabs() {
    const tabs = $$("#forecastTabs button");
    const panel = $("#forecastPanel");

    function select(btn, focus) {
      state.forecastTab = btn.dataset.tab;
      tabs.forEach(function (b) {
        const active = b === btn;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-selected", String(active));
        b.tabIndex = active ? 0 : -1;
      });
      if (panel) panel.setAttribute("aria-labelledby", btn.id);
      renderForecast();
      if (focus) btn.focus();
    }

    tabs.forEach(function (btn, i) {
      btn.addEventListener("click", function () { select(btn, false); });
      btn.addEventListener("keydown", function (e) {
        let next = null;
        if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
        else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === "Home") next = tabs[0];
        else if (e.key === "End") next = tabs[tabs.length - 1];
        if (next) {
          e.preventDefault();
          select(next, true);
        }
      });
    });
  }

  function initSourceUnits() {
    $$("#sourceUnitSeg button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.sourceUnit = btn.dataset.unit;
        $$("#sourceUnitSeg button").forEach(function (b) { b.classList.toggle("is-active", b === btn); });
        renderSourceBars(SDG.getYear(state.year));
      });
    });
  }

  function initTheme() {
    let stored = null;
    try { stored = localStorage.getItem("energy-divide-theme"); } catch (e) { /* ignore */ }
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: light)") : null;
    const initial = (stored === "light" || stored === "dark")
      ? stored
      : (mq && mq.matches ? "light" : "dark");

    applyTheme(initial);

    const toggle = $("#themeToggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        const current = document.documentElement.dataset.theme || "dark";
        setTheme(current === "dark" ? "light" : "dark", true);
      });
    }

    if (mq && mq.addEventListener) {
      mq.addEventListener("change", function (e) {
        let saved = null;
        try { saved = localStorage.getItem("energy-divide-theme"); } catch (err) { /* ignore */ }
        if (saved !== "light" && saved !== "dark") {
          setTheme(e.matches ? "light" : "dark", false);
        }
      });
    }
  }

  /* =========================================================
     RESIZE
     ========================================================= */
  let resizeTimer = null;
  function initResize() {
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        renderHeroSpark();
        renderTrends();
        renderForecast();
      }, 180);
    });
  }

  /* =========================================================
     INIT
     ========================================================= */
  function init() {
    const footerYear = $("#footerYear");
    if (footerYear) footerYear.textContent = new Date().getFullYear();

    initTheme();
    renderSplit();
    renderHeroSpark();
    renderData();
    renderMetrics();
    renderTrends();
    buildForecastControls();
    renderForecast();
    buildSolutions();
    initScrollUI();
    initNav();
    initTimeline();
    initTabs();
    initSourceUnits();
    initResize();
    updatePresetUI();
    syncInterventionUI();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
