/* =========================================================
   ENERGY DIVIDE — lightweight SVG chart engine
   No external chart library. Responsive, theme-aware,
   keyboard-friendly tooltips.
   ========================================================= */
window.Charts = (function () {
  "use strict";

  const NS = "http://www.w3.org/2000/svg";
  let uid = 0;

  function svgEl(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (attrs[k] !== undefined && attrs[k] !== null) node.setAttribute(k, attrs[k]);
      });
    }
    return node;
  }

  function cssVar(name, fallback) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback || "#888";
  }

  function fmtNum(n, digits) {
    if (n === null || n === undefined || !isFinite(n)) return "–";
    digits = digits || 0;
    return n.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function niceStep(rawStep) {
    const exponent = Math.floor(Math.log10(rawStep));
    const fraction = rawStep / Math.pow(10, exponent);
    let nice;
    if (fraction <= 1) nice = 1;
    else if (fraction <= 2) nice = 2;
    else if (fraction <= 2.5) nice = 2.5;
    else if (fraction <= 5) nice = 5;
    else nice = 10;
    return nice * Math.pow(10, exponent);
  }

  function scaleFor(min, max, count) {
    if (max <= min) max = min + 1;
    const step = niceStep((max - min) / (count || 4));
    const niceMin = Math.floor(min / step) * step;
    const niceMax = Math.ceil(max / step) * step;
    return { min: niceMin, max: niceMax, step: step };
  }

  function lineChart(container, cfg) {
    if (!container) return;
    const width = Math.max(280, Math.round(container.clientWidth || 640));
    const height = cfg.height || 360;
    const minimal = !!cfg.minimal;
    const margin = minimal
      ? { top: 5, right: 5, bottom: 5, left: 5 }
      : { top: 22, right: 18, bottom: 34, left: 54 };

    const xs = cfg.xs || [];
    const series = (cfg.series || []).filter(function (s) { return s && s.values && s.values.length; });
    if (!xs.length || !series.length) return;

    const xMin = xs[0];
    const xMax = xs[xs.length - 1];

    let rawMax = -Infinity;
    series.forEach(function (s) {
      s.values.forEach(function (v) {
        if (v !== null && v !== undefined && isFinite(v) && v > rawMax) rawMax = v;
      });
    });
    if (!isFinite(rawMax) || rawMax <= 0) rawMax = 1;

    let yMin = cfg.yMin !== undefined ? cfg.yMin : 0;
    let yMax = cfg.yMax;
    let step;
    if (yMax !== undefined) {
      step = niceStep((yMax - yMin) / 4);
    } else {
      const scale = scaleFor(yMin, rawMax * 1.08, 4);
      yMin = scale.min;
      yMax = scale.max;
      step = scale.step;
    }

    const plotW = width - margin.left - margin.right;
    const plotH = height - margin.top - margin.bottom;
    const X = function (v) { return margin.left + (v - xMin) / (xMax - xMin || 1) * plotW; };
    const Y = function (v) { return margin.top + plotH - (v - yMin) / (yMax - yMin || 1) * plotH; };

    container.innerHTML = "";

    const svg = svgEl("svg", {
      viewBox: "0 0 " + width + " " + height,
      width: width,
      height: height,
      role: "img",
      "aria-label": cfg.ariaLabel || "Line chart"
    });
    svg.style.width = "100%";
    svg.style.height = "auto";
    svg.style.display = "block";

    const defs = svgEl("defs");
    svg.appendChild(defs);

    /* ---- projection shading ---- */
    if (cfg.shadeFrom !== undefined && cfg.shadeFrom >= xMin && cfg.shadeFrom <= xMax) {
      const sx = X(cfg.shadeFrom);
      svg.appendChild(svgEl("rect", {
        x: sx,
        y: margin.top,
        width: Math.max(0, width - margin.right - sx),
        height: plotH,
        fill: cssVar("--text", "#ffffff"),
        "fill-opacity": 0.022
      }));
      if (cfg.shadeLabel) {
        if (width >= 520) {
          const shadeLabel = svgEl("text", {
            x: width - margin.right - 4,
            y: margin.top + 10,
            "text-anchor": "end",
            class: "ref-label",
            fill: cssVar("--faint", "#7b8a82"),
            "font-size": 8,
            "font-family": "Inter, Segoe UI, system-ui, sans-serif",
            "letter-spacing": "0.12em"
          });
          shadeLabel.textContent = cfg.shadeLabel;
          svg.appendChild(shadeLabel);
        }
      }
    }

    const fontFamily = "Inter, Segoe UI, system-ui, sans-serif";
    const gridColor = cssVar("--grid", "rgba(255,255,255,0.07)");
    const lineColor = cssVar("--line", "rgba(255,255,255,0.09)");
    const faint = cssVar("--faint", "#7c8a82");

    /* ---- grid + y labels ---- */
    if (!minimal) {
      const tickCount = Math.round((yMax - yMin) / step);
      for (let i = 0; i <= tickCount; i++) {
        const value = yMin + i * step;
        const y = Y(value);
        const grid = svgEl("line", {
          x1: margin.left, x2: width - margin.right,
          y1: y, y2: y,
          class: "grid-line"
        });
        grid.setAttribute("stroke", gridColor);
        svg.appendChild(grid);

        const label = svgEl("text", {
          x: margin.left - 10,
          y: y + 3.5,
          "text-anchor": "end",
          class: "axis-label",
          fill: faint,
          "font-size": 10,
          "font-family": fontFamily
        });
        label.textContent = cfg.formatY ? cfg.formatY(value) : fmtNum(value, 0);
        svg.appendChild(label);
      }

      /* ---- x labels ---- */
      const ticks = cfg.xTicks && cfg.xTicks.length ? cfg.xTicks : xs.filter(function (_, i) {
        return i % Math.max(1, Math.ceil(xs.length / 6)) === 0;
      });
      ticks.forEach(function (t) {
        if (t < xMin || t > xMax) return;
        const x = X(t);
        const label = svgEl("text", {
          x: x,
          y: height - 10,
          "text-anchor": "middle",
          class: "axis-label",
          fill: faint,
          "font-size": 10,
          "font-family": fontFamily
        });
        label.textContent = cfg.formatX ? cfg.formatX(t) : String(t);
        svg.appendChild(label);
      });

      const baseLine = svgEl("line", {
        x1: margin.left, x2: width - margin.right,
        y1: Y(yMin), y2: Y(yMin),
        class: "axis-line"
      });
      baseLine.setAttribute("stroke", lineColor);
      svg.appendChild(baseLine);
    }

    /* ---- gap band ---- */
    if (cfg.gap && series[cfg.gap.top] && series[cfg.gap.bottom]) {
      const top = series[cfg.gap.top].values;
      const bottom = series[cfg.gap.bottom].values;
      const fromX = cfg.gap.fromX !== undefined ? cfg.gap.fromX : xMin;
      const pairs = [];
      xs.forEach(function (x, i) {
        if (x < fromX) return;
        if (top[i] == null || bottom[i] == null) return;
        pairs.push([x, top[i], bottom[i]]);
      });
      if (pairs.length > 1) {
        let d = "";
        pairs.forEach(function (p, i) {
          d += (i === 0 ? "M" : "L") + X(p[0]).toFixed(1) + " " + Y(p[1]).toFixed(1) + " ";
        });
        for (let i = pairs.length - 1; i >= 0; i--) {
          d += "L" + X(pairs[i][0]).toFixed(1) + " " + Y(pairs[i][2]).toFixed(1) + " ";
        }
        d += "Z";
        const area = svgEl("path", {
          d: d,
          fill: cfg.gap.color || cssVar("--gold", "#f2b84b"),
          "fill-opacity": cfg.gap.opacity || 0.07,
          stroke: "none"
        });
        svg.appendChild(area);
      }
    }

    /* ---- lines ---- */
    series.forEach(function (s) {
      const stroke = s.color || cssVar("--gold");
      if (s.area) {
        const gradId = "area-" + (++uid);
        const grad = svgEl("linearGradient", { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 });
        const stopA = svgEl("stop", { offset: "0%", "stop-color": stroke, "stop-opacity": 0.28 });
        const stopB = svgEl("stop", { offset: "100%", "stop-color": stroke, "stop-opacity": 0 });
        grad.appendChild(stopA);
        grad.appendChild(stopB);
        defs.appendChild(grad);

        const points = [];
        xs.forEach(function (x, i) {
          const v = s.values[i];
          if (v == null) return;
          points.push([X(x), Y(v)]);
        });
        if (points.length > 1) {
          let d = "M" + points[0][0].toFixed(1) + " " + Y(yMin).toFixed(1) + " ";
          points.forEach(function (p) { d += "L" + p[0].toFixed(1) + " " + p[1].toFixed(1) + " "; });
          d += "L" + points[points.length - 1][0].toFixed(1) + " " + Y(yMin).toFixed(1) + " Z";
          svg.appendChild(svgEl("path", { d: d, fill: "url(#" + gradId + ")", stroke: "none" }));
        }
      }

      let d = "";
      let drawing = false;
      s.values.forEach(function (v, i) {
        if (v == null || !isFinite(v)) { drawing = false; return; }
        d += (drawing ? "L" : "M") + X(xs[i]).toFixed(1) + " " + Y(v).toFixed(1) + " ";
        drawing = true;
      });
      if (!d) return;
      const path = svgEl("path", {
        d: d,
        fill: "none",
        stroke: stroke,
        "stroke-width": s.width || 2.4,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-opacity": s.opacity != null ? s.opacity : 1
      });
      if (s.dashed) path.setAttribute("stroke-dasharray", "5 5");
      if (s.animate) {
        path.style.strokeDasharray = "1200";
        path.style.strokeDashoffset = "1200";
        path.style.transition = "stroke-dashoffset 1.1s cubic-bezier(.2,.7,.2,1)";
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { path.style.strokeDashoffset = "0"; });
        });
      }
      svg.appendChild(path);

      /* last point marker */
      if (s.endDot) {
        let lastIndex = -1;
        s.values.forEach(function (v, i) { if (v != null) lastIndex = i; });
        if (lastIndex >= 0) {
          svg.appendChild(svgEl("circle", {
            cx: X(xs[lastIndex]), cy: Y(s.values[lastIndex]), r: 3.2,
            fill: stroke, stroke: cssVar("--bg", "#070a09"), "stroke-width": 2
          }));
        }
      }
    });

    /* ---- reference line ---- */
    if (cfg.refX !== undefined && cfg.refX >= xMin && cfg.refX <= xMax) {
      const x = X(cfg.refX);
      const ref = svgEl("line", {
        x1: x, x2: x, y1: margin.top, y2: height - margin.bottom,
        class: "ref-line"
      });
      ref.setAttribute("stroke", lineColor);
      svg.appendChild(ref);
      if (!minimal) {
        const label = svgEl("text", {
          x: x + 6,
          y: margin.top + 10,
          class: "ref-label",
          fill: faint,
          "font-size": 9,
          "font-family": fontFamily,
          "letter-spacing": "0.08em"
        });
        label.textContent = cfg.refLabel || "Today";
        svg.appendChild(label);
      }
    }

    container.appendChild(svg);

    /* ---- hover layer ---- */
    if (!minimal && cfg.interactive !== false) {
      const hoverGroup = svgEl("g", { "pointer-events": "none" });
      const hoverLine = svgEl("line", {
        y1: margin.top, y2: height - margin.bottom,
        stroke: cssVar("--line-strong", "rgba(255,255,255,0.16)"),
        "stroke-width": 1, "stroke-dasharray": "3 4"
      });
      hoverLine.style.opacity = "0";
      hoverGroup.appendChild(hoverLine);

      const dots = series.map(function (s) {
        if (s.noDot) return null;
        const dot = svgEl("circle", {
          r: 3.6,
          fill: s.color || cssVar("--gold"),
          stroke: cssVar("--bg", "#070a09"),
          "stroke-width": 2
        });
        dot.style.opacity = "0";
        hoverGroup.appendChild(dot);
        return dot;
      });

      const overlay = svgEl("rect", {
        x: margin.left,
        y: margin.top,
        width: plotW,
        height: plotH,
        fill: "transparent",
        style: "cursor:crosshair"
      });
      svg.appendChild(hoverGroup);
      svg.appendChild(overlay);

      const tip = document.createElement("div");
      tip.className = "chart-tip";
      container.appendChild(tip);

      function hide() {
        tip.classList.remove("is-visible");
        hoverLine.style.opacity = "0";
        dots.forEach(function (d) { if (d) d.style.opacity = "0"; });
      }

      function move(evt) {
        const rect = svg.getBoundingClientRect();
        if (!rect.width) return;
        const px = (evt.clientX - rect.left) * (width / rect.width);
        const targetX = xMin + (px - margin.left) / plotW * (xMax - xMin);
        let index = 0;
        let best = Infinity;
        xs.forEach(function (x, i) {
          const diff = Math.abs(x - targetX);
          if (diff < best) { best = diff; index = i; }
        });

        const hx = X(xs[index]);
        hoverLine.setAttribute("x1", hx);
        hoverLine.setAttribute("x2", hx);
        hoverLine.style.opacity = "1";

        let minY = height;
        series.forEach(function (s, i) {
          const dot = dots[i];
          if (!dot) return;
          const v = s.values[index];
          if (v == null || !isFinite(v)) {
            dot.style.opacity = "0";
            return;
          }
          const y = Y(v);
          dot.setAttribute("cx", hx);
          dot.setAttribute("cy", y);
          dot.style.opacity = s.dim ? "0.35" : "1";
          if (y < minY) minY = y;
        });

        let html = '<div class="tip-year">' + (cfg.tipTitle ? cfg.tipTitle(xs[index]) : xs[index]) + "</div>";
        const rows = cfg.tipRows
          ? cfg.tipRows(index)
          : series.map(function (s) {
              return {
                name: s.name,
                value: s.values[index],
                color: s.color,
                dim: s.dim,
                format: s.format || cfg.formatY
              };
            });
        rows.forEach(function (r) {
          if (r.value == null || !isFinite(r.value)) return;
          html += '<div class="tip-row' + (r.dim ? " dim" : "") + '">' +
            '<i style="background:' + (r.color || "transparent") + '"></i>' +
            "<span>" + r.name + "</span>" +
            "<b>" + (r.format ? r.format(r.value) : fmtNum(r.value)) + "</b></div>";
        });
        tip.innerHTML = html;

        const scaleX = rect.width / width;
        let left = hx * scaleX;
        const tipW = tip.offsetWidth || 150;
        left = Math.max(tipW / 2 + 4, Math.min(rect.width - tipW / 2 - 4, left));
        let top = Math.max(minY, margin.top) * scaleX - 10;
        const tipH = tip.offsetHeight || 70;
        if (top - tipH < 2) top = Math.max(minY, margin.top) * scaleX + tipH + 22;
        tip.style.left = left + "px";
        tip.style.top = top + "px";
        tip.classList.add("is-visible");
      }

      overlay.addEventListener("pointermove", move);
      overlay.addEventListener("pointerleave", hide);
      overlay.addEventListener("pointercancel", hide);
    }

    return { width: width, height: height };
  }

  function donut(container, cfg) {
    if (!container) return;
    const size = cfg.size || 188;
    const thickness = cfg.thickness || 21;
    const r = (size - thickness) / 2 - 2;
    const c = 2 * Math.PI * r;
    const segments = (cfg.segments || []).filter(function (s) { return s.value > 0; });
    const total = segments.reduce(function (acc, s) { return acc + s.value; }, 0) || 1;

    container.innerHTML = "";

    const svg = svgEl("svg", {
      viewBox: "0 0 " + size + " " + size,
      width: size,
      height: size,
      role: "img",
      "aria-label": cfg.ariaLabel || "Donut chart"
    });
    svg.style.width = "100%";
    svg.style.maxWidth = size + "px";
    svg.style.height = "auto";
    svg.style.overflow = "visible";

    svg.appendChild(svgEl("circle", {
      cx: size / 2, cy: size / 2, r: r,
      fill: "none",
      stroke: cssVar("--track", "rgba(255,255,255,0.06)"),
      "stroke-width": thickness
    }));

    let offset = 0;
    segments.forEach(function (s, i) {
      const len = s.value / total * c;
      const gap = 1.8;
      const circle = svgEl("circle", {
        cx: size / 2, cy: size / 2, r: r,
        fill: "none",
        stroke: s.color,
        "stroke-width": thickness,
        "stroke-dasharray": Math.max(len - gap, 0.5) + " " + (c - Math.max(len - gap, 0.5)),
        "stroke-dashoffset": -offset,
        "stroke-linecap": "butt",
        transform: "rotate(-90 " + size / 2 + " " + size / 2 + ")"
      });
      circle.setAttribute("class", "donut-seg");
      circle.dataset.index = i;
      svg.appendChild(circle);
      offset += len;
    });

    const value = svgEl("text", {
      x: size / 2,
      y: size / 2 + 2,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "class": "donut-value"
    });
    const unit = svgEl("text", {
      x: size / 2,
      y: size / 2 + 24,
      "text-anchor": "middle",
      "dominant-baseline": "middle",
      "class": "donut-unit"
    });
    value.textContent = cfg.centerValue || "";
    unit.textContent = cfg.centerUnit || "";
    svg.appendChild(value);
    svg.appendChild(unit);

    container.appendChild(svg);

    container.querySelectorAll(".donut-seg").forEach(function (seg) {
      const item = segments[Number(seg.dataset.index)];
      if (!item) return;
      seg.addEventListener("mouseenter", function () {
        value.textContent = Math.round(item.value) + "%";
        unit.textContent = item.label;
      });
      seg.addEventListener("mouseleave", function () {
        value.textContent = cfg.centerValue || "";
        unit.textContent = cfg.centerUnit || "";
      });
    });
  }

  return {
    lineChart: lineChart,
    donut: donut,
    cssVar: cssVar,
    fmtNum: fmtNum
  };
})();
