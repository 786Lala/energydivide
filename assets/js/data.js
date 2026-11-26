/* =========================================================
   ENERGY DIVIDE — data layer
   Modelled from public sources for education. Figures are
   rounded and illustrative, not policy-grade.
   ========================================================= */
(function () {
  "use strict";

  const SOURCES = [
    { key: "oil",        label: "Oil",                 colorVar: "--src-oil" },
    { key: "coal",       label: "Coal",                colorVar: "--src-coal" },
    { key: "gas",        label: "Natural gas",         colorVar: "--src-gas" },
    { key: "biomass",    label: "Traditional biomass", colorVar: "--src-biomass" },
    { key: "hydro",      label: "Hydro",               colorVar: "--src-hydro" },
    { key: "nuclear",    label: "Nuclear",             colorVar: "--src-nuclear" },
    { key: "renewables", label: "Wind, solar & other", colorVar: "--src-renewables" }
  ];

  /* Historical anchors. The two halves are always equal in
     population — this is a 50/50 split of people, ranked by
     per-capita energy use. */
  const HISTORY = {
    years:   [1990, 1995, 2000, 2005, 2010, 2015, 2020, 2023],
    popHalf: [2.66, 2.87, 3.06, 3.255, 3.48, 3.70, 3.92, 4.025],
    pcRich:  [115, 117, 120, 122, 123, 122, 120, 119],
    pcPoor:  [19, 20, 22, 24, 27, 30, 32.5, 34],
    co2Rich: [8.4, 8.2, 8.0, 7.9, 7.6, 7.4, 7.2, 7.1],
    co2Poor: [0.55, 0.6, 0.65, 0.75, 1.0, 1.25, 1.55, 1.8]
  };

  /* Energy-mix anchors, in % of each half's primary energy. */
  const MIX = {
    years: [1990, 2000, 2010, 2023],
    rich: [
      { oil: 36, coal: 25, gas: 27, nuclear: 6,   hydro: 5,   renewables: 1,   biomass: 0 },
      { oil: 35, coal: 27, gas: 26, nuclear: 5.5, hydro: 4,   renewables: 2.5, biomass: 0 },
      { oil: 33, coal: 29, gas: 26, nuclear: 5.5, hydro: 3,   renewables: 3.5, biomass: 0 },
      { oil: 32, coal: 29, gas: 26, nuclear: 5,   hydro: 2,   renewables: 6,   biomass: 0 }
    ],
    poor: [
      { oil: 24, coal: 17, gas: 11, nuclear: 0.2, hydro: 4,   renewables: 1.8, biomass: 42 },
      { oil: 25, coal: 19, gas: 12, nuclear: 0.3, hydro: 4.2, renewables: 2.5, biomass: 37 },
      { oil: 25, coal: 20, gas: 13, nuclear: 0.4, hydro: 4.5, renewables: 3,   biomass: 34.1 },
      { oil: 23, coal: 16, gas: 11, nuclear: 0.5, hydro: 4,   renewables: 4.5, biomass: 41 }
    ]
  };

  const FORECAST_BASE = {
    year: 2023,
    popTotal: 8.05,
    popHalf: 4.025,
    pcRich: 119,
    pcPoor: 34,
    energyRich: 478.975,
    energyPoor: 136.85,
    co2RichPC: 7.1,
    co2PoorPC: 1.8,
    carbonIntensityRich: 59.7, // kg CO2 per GJ
    carbonIntensityPoor: 52.9,
    defaults: {
      targetYear: 2050,
      popGrowth: 0.8,
      richGrowth: 0.4,
      poorGrowth: 1.6,
      efficiency: 0.4
    }
  };

  const DISPARITIES = [
    {
      id: "energy",
      label: "Primary energy per person",
      rich: 119,
      poor: 34,
      unit: "GJ",
      ratio: "3.5×",
      format: "int",
      note: "The energy that moves, heats, builds and powers daily life."
    },
    {
      id: "electricity",
      label: "Electricity use per person",
      rich: 6500,
      poor: 700,
      unit: "kWh",
      ratio: "9.3×",
      format: "int",
      note: "A rich-half household uses in a day what a poor-half household uses in over a week."
    },
    {
      id: "co2",
      label: "Energy CO₂ per person",
      rich: 7.1,
      poor: 1.8,
      unit: "tonnes",
      ratio: "3.9×",
      format: "dec1",
      note: "The carbon consequence of the energy gap — roughly 36 Gt in 2023."
    },
    {
      id: "fossil",
      label: "Fossil fuel share of energy",
      rich: 87,
      poor: 50,
      unit: "% of mix",
      ratio: "37 pt gap",
      format: "pct",
      note: "The poor half is less fossil-heavy, but 41% of its energy is traditional biomass."
    },
    {
      id: "cooking",
      label: "Access to clean cooking",
      rich: 98,
      poor: 48,
      unit: "% access",
      ratio: "50 pt gap",
      format: "pct",
      note: "About 2.3 billion people still cook with wood, charcoal or dung."
    },
    {
      id: "materials",
      label: "Material footprint per person",
      rich: 21,
      poor: 4.2,
      unit: "tonnes",
      ratio: "5.0×",
      format: "dec1",
      note: "Consumption shows up in materials: minerals, metals, biomass and fossil fuels."
    }
  ];

  const SOLUTIONS = [
    {
      id: "efficiency",
      n: "01",
      category: "Efficiency",
      title: "Make every unit of energy go further",
      summary: "Stronger standards for buildings, appliances, motors and industry cut demand in high-consuming economies without lowering well-being.",
      impact: "−18% rich-half demand by 2050",
      feasibility: 5,
      effectLabel: "Efficiency +0.55 pp/yr",
      effects: { efficiency: 0.55, carbon: 0.2 }
    },
    {
      id: "sufficiency",
      n: "02",
      category: "Equity",
      title: "Price the top, protect the bottom",
      summary: "Progressive tariffs, luxury energy taxes and sufficiency measures target the highest consumers while keeping basic needs affordable.",
      impact: "−15% rich-half demand by 2050",
      feasibility: 3,
      effectLabel: "Rich demand −0.70 pp/yr",
      effects: { richGrowth: -0.7, carbon: 0.1 }
    },
    {
      id: "subsidy",
      n: "03",
      category: "Policy",
      title: "Reform fossil subsidies, price carbon",
      summary: "Redirect the roughly $1 trillion spent supporting fossil fuels into clean energy, and put a rising price on emissions.",
      impact: "$1 trillion redirected every year",
      feasibility: 3,
      effectLabel: "Demand −0.25/−0.35 · carbon −0.9",
      effects: { richGrowth: -0.25, poorGrowth: -0.35, carbon: 0.9 }
    },
    {
      id: "finance",
      n: "04",
      category: "Clean energy",
      title: "Finance the clean-energy leapfrog",
      summary: "Meet and exceed the $100bn climate-finance goal with grants and low-cost loans for grids, storage and clean industry in the Global South.",
      impact: "Clean energy for 2 billion more people",
      feasibility: 4,
      effectLabel: "Poor demand +0.25 · carbon −0.5",
      effects: { poorGrowth: 0.25, carbon: 0.5 }
    },
    {
      id: "leapfrog",
      n: "05",
      category: "Clean energy",
      title: "Leapfrog to distributed renewables",
      summary: "Solar mini-grids, rooftop PV and battery storage can bypass coal-heavy grids and bring reliable power without waiting for large plants.",
      impact: "Avoids ~10 Gt CO₂ cumulatively",
      feasibility: 5,
      effectLabel: "Carbon −0.8 pp/yr",
      effects: { carbon: 0.8, poorGrowth: 0.1 }
    },
    {
      id: "cooking",
      n: "06",
      category: "Equity",
      title: "Universal clean cooking and electricity",
      summary: "Targeted subsidies, LPG and electric cooking, and last-mile grids end the most visible form of energy poverty.",
      impact: "2.3bn people gain clean cooking",
      feasibility: 4,
      effectLabel: "Poor demand +0.35 · carbon −0.3",
      effects: { poorGrowth: 0.35, carbon: 0.3 }
    },
    {
      id: "circular",
      n: "07",
      category: "Circularity",
      title: "Design for circularity and material efficiency",
      summary: "Longer-lived products, repair, reuse and recycling cut the material and energy embedded in everything we buy.",
      impact: "−20% material footprint by 2050",
      feasibility: 4,
      effectLabel: "Demand −0.15 both halves · carbon −0.2",
      effects: { richGrowth: -0.15, poorGrowth: -0.15, carbon: 0.2 }
    },
    {
      id: "defaults",
      n: "08",
      category: "Policy",
      title: "Make sustainable the default choice",
      summary: "Public procurement, eco-labels, right-to-repair rules and supply-chain disclosure shift markets without relying on individual virtue.",
      impact: "Mainstreams low-carbon products",
      feasibility: 4,
      effectLabel: "Demand −0.10 both halves · carbon −0.3",
      effects: { richGrowth: -0.1, poorGrowth: -0.1, carbon: 0.3 }
    }
  ];

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function interp(x, xs, ys) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    for (let i = 0; i < xs.length - 1; i++) {
      if (x >= xs[i] && x <= xs[i + 1]) {
        const t = (x - xs[i]) / (xs[i + 1] - xs[i]);
        return lerp(ys[i], ys[i + 1], t);
      }
    }
    return ys[ys.length - 1];
  }

  function mixFor(year, group) {
    const xs = MIX.years;
    const rows = MIX[group];
    let out = {};
    SOURCES.forEach(function (s) {
      const vals = rows.map(function (r) { return r[s.key]; });
      out[s.key] = interp(year, xs, vals);
    });
    const sum = Object.keys(out).reduce(function (acc, k) { return acc + out[k]; }, 0) || 1;
    SOURCES.forEach(function (s) { out[s.key] = out[s.key] / sum * 100; });
    return out;
  }

  function getYear(year) {
    const y = Math.max(1990, Math.min(2023, year));
    const popHalf = interp(y, HISTORY.years, HISTORY.popHalf);
    const pcRich = interp(y, HISTORY.years, HISTORY.pcRich);
    const pcPoor = interp(y, HISTORY.years, HISTORY.pcPoor);
    const co2RichPC = interp(y, HISTORY.years, HISTORY.co2Rich);
    const co2PoorPC = interp(y, HISTORY.years, HISTORY.co2Poor);
    const mixRich = mixFor(y, "rich");
    const mixPoor = mixFor(y, "poor");

    const energyRich = popHalf * pcRich;
    const energyPoor = popHalf * pcPoor;
    const energyTotal = energyRich + energyPoor;
    const co2Rich = popHalf * co2RichPC;
    const co2Poor = popHalf * co2PoorPC;
    const co2Total = co2Rich + co2Poor;

    const perSourceRich = {};
    const perSourcePoor = {};
    const worldMix = {};
    SOURCES.forEach(function (s) {
      perSourceRich[s.key] = energyRich * mixRich[s.key] / 100;
      perSourcePoor[s.key] = energyPoor * mixPoor[s.key] / 100;
      worldMix[s.key] = (perSourceRich[s.key] + perSourcePoor[s.key]) / energyTotal * 100;
    });

    return {
      year: y,
      popHalf: popHalf,
      popTotal: popHalf * 2,
      pcRich: pcRich,
      pcPoor: pcPoor,
      ratio: pcRich / pcPoor,
      energyRich: energyRich,
      energyPoor: energyPoor,
      energyTotal: energyTotal,
      shareRich: energyRich / energyTotal,
      co2Rich: co2Rich,
      co2Poor: co2Poor,
      co2Total: co2Total,
      co2RichPC: co2RichPC,
      co2PoorPC: co2PoorPC,
      mixRich: mixRich,
      mixPoor: mixPoor,
      perSourceRich: perSourceRich,
      perSourcePoor: perSourcePoor,
      worldMix: worldMix
    };
  }

  function history() {
    const rows = [];
    for (let y = 1990; y <= 2023; y++) rows.push(getYear(y));
    return rows;
  }

  window.SDG = {
    SOURCES: SOURCES,
    DISPARITIES: DISPARITIES,
    SOLUTIONS: SOLUTIONS,
    FORECAST_BASE: FORECAST_BASE,
    getYear: getYear,
    history: history,
    HISTORY_YEARS: HISTORY.years,
    MIX_YEARS: MIX.years
  };
})();
