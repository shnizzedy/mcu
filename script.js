const width = window.innerWidth, height = window.innerHeight;
const svg = d3.select("#viz").append("svg").attr("width", width).attr("height", height);
const g = svg.append("g");
const axisSvg = d3.select("#axis-overlay").append("svg").attr("width", 140).attr("height", height);

// 1. FIXED VERTICAL ALIGNMENT: Definitive Y-coordinates
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

// Draw static lane labels on the overlay
Object.entries(lanes).forEach(([name, y]) => {
    axisSvg.append("text")
        .attr("class", "lane-label")
        .attr("x", 15)
        .attr("y", y + 5)
        .text(name);
    
    // Draw horizontal guide lines in the background
    g.append("line")
        .attr("x1", 0).attr("x2", 25000)
        .attr("y1", y).attr("y2", y)
        .attr("stroke", "#1a1a1a")
        .attr("stroke-width", 1);
});

// 2. ZOOM & KEYBOARD NAVIGATION
const zoom = d3.zoom()
    .scaleExtent([0.1, 2])
    .on("zoom", (e) => g.attr("transform", e.transform));

svg.call(zoom);

d3.select(window).on("keydown", (e) => {
    const currentTransform = d3.zoomTransform(svg.node());
    let { x, y, k } = currentTransform;
    const step = 600; // Increased step for easier travel

    if (e.key === "ArrowRight") x -= step;
    if (e.key === "ArrowLeft") x += step;
    if (e.key === "ArrowDown") y -= step/2;
    if (e.key === "ArrowUp") y += step/2;
    
    svg.transition().duration(250).ease(d3.easeCubicOut)
       .call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(k));
});

// 3. DATA PROCESSING
d3.tsv("data.tsv").then(data => {
    // Parse years and trim lanes to prevent alignment errors
    data.forEach(d => {
        d.yearNum = parseFloat(d.year);
        d.lane = d.lane.trim();
    });

    // Sort by time
    data.sort((a, b) => a.yearNum - b.yearNum);

    // X Scale: Maps 1962-2029 to a wide horizontal range
    const minYear = d3.min(data, d => d.yearNum);
    const maxYear = d3.max(data, d => d.yearNum);
    const xScale = d3.scaleLinear()
        .domain([minYear, maxYear])
        .range([300, (maxYear - minYear) * 180 + 500]);

    // Apply positions to data objects
    data.forEach(d => {
        d.xPos = xScale(d.yearNum);
        d.yPos = lanes[d.lane] || height / 2;
    });

    // 4. DRAW LINKS (Connections)
    const links = [];
    data.forEach((d) => {
        if (d.connections) {
            d.connections.split(",").forEach(tId => {
                const target = data.find(m => m.id.trim() === tId.trim());
                if (target) links.push({ s: d, t: target });
            });
        }
    });

    g.selectAll(".tt-link")
        .data(links)
        .enter().append("path")
        .attr("class", d => {
            // Highlight Logan->D&W and Legion Loop
            const isSpecial = (d.s.id == "47" && d.t.id == "45") || (d.s.id == "74" && d.t.id == "48");
            return isSpecial ? "tt-link special-link" : "tt-link";
        })
        .attr("d", d => {
            const midX = (d.s.xPos + d.t.xPos) / 2;
            // Bezier curve: M (start) C (control point 1, control point 2, end)
            return `M${d.s.xPos},${d.s.yPos} C${midX},${d.s.yPos} ${midX},${d.t.yPos} ${d.t.xPos},${d.t.yPos}`;
        });

    // 5. DRAW NODES (Posters)
    const nodes = g.selectAll(".node")
        .data(data)
        .enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${d.xPos}, ${d.yPos})`);

    nodes.append("image")
        .attr("xlink:href", d => d.image)
        .attr("x", -35).attr("y", -50)
        .attr("width", 70).attr("height", 100);

    nodes.append("text")
        .attr("class", "label")
        .attr("text-anchor", "middle")
        .attr("y", 68)
        .text(d => `${Math.floor(d.yearNum)}: ${d.title}`);
});
