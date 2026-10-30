/* global document, ResizeObserver, devicePixelRatio */
const data = JSON.parse(document.getElementById("data").textContent);
const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const selector = document.getElementById("record");

const element = id => document.getElementById(id);
element("scope").textContent = `${data.environment.toUpperCase()} / ${data.options.table} / section ${data.options.section} / EPSG:${data.options.srid} (meters, north upwards)`;
element("summary").textContent = JSON.stringify(data.summary, null, 2);
element("review-warning").textContent = `${data.summary.recordsDisplacedOver10cm} records displaced over 10 cm; ${data.summary.linkedMarkersLosingCoverage} linked markers lose exact polygon coverage. Review required.`;
for (const record of data.records) {
  const option = document.createElement("option");
  option.value = record.id;
  option.textContent = record.label;
  selector.append(option);
}

function polygons(geometry) {
  if (geometry?.type === "Polygon") return [geometry.coordinates];
  if (geometry?.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function coordinates(records) {
  return records.flatMap(record => [record.original_plot, record.proposed_plot]
    .flatMap(geometry => polygons(geometry).flat(2)))
    .filter(point => point.every(Number.isFinite));
}

function bounds(points, padding = 0) {
  return {
    left: Math.min(...points.map(p => p[0])) - padding,
    right: Math.max(...points.map(p => p[0])) + padding,
    bottom: Math.min(...points.map(p => p[1])) - padding,
    top: Math.max(...points.map(p => p[1])) + padding,
  };
}

const wholeScope = bounds(coordinates(data.records));
function draw() {
  const selected = data.records.find(record => record.id === selector.value);
  const view = selected ? bounds(coordinates([selected]), 2) : wholeScope;
  const box = canvas.getBoundingClientRect();
  const ratio = devicePixelRatio || 1;
  canvas.width = box.width * ratio;
  canvas.height = box.height * ratio;
  context.scale(ratio, ratio);
  const scale = Math.min((box.width - 48) / Math.max(view.right - view.left, 1),
    (box.height - 48) / Math.max(view.top - view.bottom, 1));
  const offsetX = (box.width - (view.right - view.left) * scale) / 2;
  const offsetY = (box.height - (view.top - view.bottom) * scale) / 2;
  const project = point => [offsetX + (point[0] - view.left) * scale,
    box.height - offsetY - (point[1] - view.bottom) * scale];

  for (const kind of ["original", "proposed"]) {
    if (!element(kind).checked) continue;
    context.strokeStyle = kind === "original" ? "#2166ac" : "#d95f02";
    for (const record of data.records) {
      context.globalAlpha = !selected || selected.id === record.id ? 0.9 : 0.2;
      context.lineWidth = selected?.id === record.id ? 3 : 1.2;
      for (const polygon of polygons(record[`${kind}_plot`])) {
        context.beginPath();
        for (const ring of polygon) {
          ring.forEach((point, index) => {
            const [x, y] = project(point);
            if (index === 0) context.moveTo(x, y);
            else context.lineTo(x, y);
          });
          context.closePath();
        }
        context.stroke();
      }
      if (element("labels").checked) {
        const point = polygons(record[`${kind}_plot`])[0]?.[0]?.[0];
        if (point) {
          context.fillStyle = context.strokeStyle;
          context.fillText(record.label, ...project(point));
        }
      }
    }
  }
  context.globalAlpha = 1;
  if (element("markers").checked) {
    context.fillStyle = "#147348";
    for (const marker of data.markers) {
      const [x, y] = project(marker.geometry.coordinates);
      context.beginPath();
      context.arc(x, y, 3, 0, Math.PI * 2);
      context.fill();
    }
  }
  element("metrics").textContent = selected
    ? `${selected.label}: changed area ${selected.changed_area_m2.toFixed(6)} m²; Hausdorff distance ${(selected.hausdorff_m ?? 0).toFixed(4)} m; confidence ${selected.geometry_confidence}`
    : "Select a record to zoom in and inspect its candidate boundary.";
}

for (const control of document.querySelectorAll("input,select")) control.addEventListener("change", draw);
new ResizeObserver(draw).observe(canvas);
draw();
