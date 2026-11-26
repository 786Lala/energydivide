# Energy Divide — SDG 12

An interactive web project about **global energy inequality and sustainable consumption**, built around **UN Sustainable Development Goal 12**: *Ensure sustainable consumption and production patterns.*

The site studies the energy consumption of the world's major energy sources and splits the global population into two equal halves — the **rich half** and the **poor half** — to show how energy, electricity, carbon and materials are distributed. It then lets you forecast future energy use under today's trends and under alternative policy pathways.

## Features

- **Hero snapshot** — population, primary energy, CO₂ and material footprints split 50/50 by population.
- **Energy mix explorer** — donut charts and source-by-source bars for oil, coal, gas, traditional biomass, hydro, nuclear and modern renewables.
  - Scrub the year from 1990 to 2023, or press play to animate the timeline.
  - Toggle between share of mix, total exajoules and per-person gigajoules.
- **The divide** — six disparity metrics with ratios, bars and context, plus historical trend charts for the rich half's energy share and the per-person energy gap.
- **Forecast lab** — a transparent, adjustable model that projects energy use, per-person energy and CO₂ to 2030–2060.
  - Dashed line = current trajectory (business as usual).
  - Scenario presets: *Current trajectory*, *SDG 12 pathway*, *Convergence first*.
  - Sliders for population growth, rich/poor demand growth, efficiency and target year.
  - Eight interventions that can be switched on individually (and from the solutions cards).
  - Live outcome tiles and CSV export.
- **Solutions** — eight policy and technology levers, filterable by category, each adding its modelled effect to the forecast.
- **UI** — responsive, with a system-aware light/dark appearance and a manual override; animated counters and reveals; custom SVG charts with tooltips; 44 px touch targets on touch devices; keyboard-navigable tabs; reduced-motion, reduced-transparency and increased-contrast support.

## Design notes

The interface applies Apple Human Interface Guidelines principles as a web translation:

- **Two layers.** Charts, cards and text sit on solid content surfaces; translucency and blur are reserved for the header, menu, tooltip and toast — the functional layer.
- **One meaning per color.** Gold encodes the rich half and teal the poor half in every chart; primary actions use a neutral ink/paper button instead of borrowing a data color.
- **Type that reads.** All UI text is ≥ 11 px, with a clear display/body/caption hierarchy and tabular numerals for data.
- **Native behavior.** Real range inputs and checkboxes, visible focus rings, 44 px touch targets on coarse pointers, and `prefers-reduced-motion`, `prefers-reduced-transparency` and `prefers-contrast` fallbacks.
- **Accessible charts.** Every chart has a descriptive accessible label, the forecast's key outcomes are available as text, and hovering a donut legend row highlights its arc so color is never the only way to read the chart.

The appearance follows the device setting by default; the header toggle stores an explicit override.

## Run it

No build step or dependencies. Open `index.html` directly in a browser, or serve the folder locally:

```bash
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Project structure

```
index.html
assets/
  css/style.css      layout, themes, components, responsive rules
  js/data.js         historical data, energy mixes, disparities, solutions
  js/charts.js       lightweight SVG line/donut chart engine
  js/app.js          state, forecast model, interactions, rendering
```

## Methodology (short version)

- The two halves are **equal halves of the global population**, ranked by per-capita primary energy use. This is not a country-income split.
- Historical anchors (1990–2023) and energy-mix snapshots are interpolated and modelled from public datasets.
- The forecast compounds per-person demand at a chosen annual rate, adjusted for efficiency and selected interventions. Population grows at the chosen rate; CO₂ is energy × carbon intensity, which declines faster with clean-energy policies.
- The **current trajectory** holds today's default rates constant. It is a trend extrapolation, not a prediction.
- All figures are rounded and illustrative. This is an educational project, not a policy-grade model.

## Data inspiration

IEA energy statistics and World Energy Outlook · World Bank / Energy Progress Report · Our World in Data · UN SDG 7 and 12 · IPCC AR6.
