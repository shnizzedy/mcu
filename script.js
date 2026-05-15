const width = window.innerWidth, height = window.innerHeight;
const svg = d3.select("#viz").append("svg").attr("width", width).attr("height", height);
const g = svg.append("g");

const axisSvg = d3.select("#axis-overlay").append("svg").attr("width", 140).attr("height", height);
const labelGroup = axisSvg.append("g"); 

// 1. VERTICAL LANE SETUP
const laneSpacing = 110;
const laneStart = 100;
const lanes = {
    "Earth-TRN620": laneStart + (laneSpacing * 0), 
    "Earth-121698": laneStart + (laneSpacing * 1),
    "Earth-158664": laneStart + (laneSpacing * 2),
    "Earth-10005":  laneStart + (laneSpacing * 3),
    "Earth-TRN414": laneStart + (laneSpacing * 4),
    "Earth-41633":  laneStart + (laneSpacing * 5),
    "Earth-TRN634": laneStart + (laneSpacing * 6),
    "Earth-17315":  laneStart + (laneSpacing * 7)
};

Object.entries(lanes).forEach(([name, y]) => {
    labelGroup.append("text").attr("class", "lane-label").attr("x", 15).attr("y", y + 5).text(name);
    g.append("line").attr("x1", 0).attr("x2", 50000).attr("y1", y).attr("y2", y)
     .attr("stroke", "#1a1a1a").attr("stroke-width", 1);
});

// 2. ZOOM & KEYBOARD NAVIGATION
const zoom = d3.zoom()
    .scaleExtent([0.1, 2])
    .on("zoom", (e) => {
        g.attr("transform", e.transform);
        labelGroup.attr("transform", `translate(0, ${e.transform.y}) scale(${e.transform.k})`);
    });

svg.call(zoom);

d3.select(window).on("keydown", (e) => {
    const transform = d3.zoomTransform(svg.node());
    let { x, y, k } = transform;
    const step = 350;
    if (e.key === "ArrowRight") x -= step;
    if (e.key === "ArrowLeft") x += step;
    if (e.key === "ArrowDown") y -= step/2;
    if (e.key === "ArrowUp") y += step/2;
    svg.transition().duration(200).ease(d3.easeLinear).call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(k));
});

// 3. FETCH TSV AND RENDER
d3.tsv("data.tsv").then(data => {
    data.forEach(d => {
        d.yearNum = parseFloat(d.year);
        d.lane = d.lane.trim();
    });

    // Sequence sorting
    data.sort((a, b) => a.yearNum - b.yearNum);

    const itemGap = 210;
    const xScale = d3.scaleLinear()
        .domain([0, data.length - 1])
        .range([250, (data.length - 1) * itemGap + 250]);

    data.forEach((d, i) => {
        d.xPos = xScale(i);
        d.yPos = lanes[d.lane] || height / 2;
    });

    const links = [];
    data.forEach((d) => {
        if (d.connections) {
            d.connections.split(",").forEach(tId => {
                const target = data.find(m => m.id.trim() === tId.trim());
                if (target) links.push({ s: d, t: target });
            });
        }
    });

    // Drawing Path Arrows (Out-Right, In-Left)
    g.selectAll(".tt-link").data(links).enter().append("path")
        .attr("class", d => ((d.s.id == "47" && d.t.id == "45") || (d.s.id == "74" && d.t.id == "48")) ? "tt-link special-link" : "tt-link")
        .attr("marker-end", d => ((d.s.id == "47" && d.t.id == "45") || (d.s.id == "74" && d.t.id == "48")) ? "url(#arrowhead-special)" : "url(#arrowhead)")
        .attr("d", d => {
            const startX = d.s.xPos + 35, startY = d.s.yPos, endX = d.t.xPos - 35, endY = d.t.yPos;
            const dx = endX - startX;
            if (dx < 0) { // Legion Loop Backward Logic
                return `M${startX},${startY} C${startX + 200},${startY - 300} ${endX - 200},${endY - 300} ${endX},${endY}`;
            }
            const cp1x = startX + (dx * 0.5), cp2x = endX - (dx * 0.5);
            return `M${startX},${startY} C${cp1x},${startY} ${cp2x},${endY} ${endX},${endY}`;
        });

    // Drawing Posters
    const nodes = g.selectAll(".node").data(data).enter().append("g")
        .attr("class", "node").attr("transform", d => `translate(${d.xPos}, ${d.yPos})`);
    
    nodes.append("image")
        .attr("xlink:href", d => d.image)
        .attr("x", -35).attr("y", -50).attr("width", 70).attr("height", 100);
    
    nodes.append("text").attr("class", "label").attr("text-anchor", "middle").attr("y", 70).text(d => d.title);
});
