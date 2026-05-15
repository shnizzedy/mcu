const width = window.innerWidth, height = window.innerHeight;
const svg = d3.select("#viz").append("svg").attr("width", width).attr("height", height);
const g = svg.append("g");
const axisSvg = d3.select("#axis-overlay").append("svg").attr("width", 140).attr("height", height);
const labelGroup = axisSvg.append("g"); 

const lanes = {
    "Earth-TRN620": 100, "Earth-121698": 210, "Earth-158664": 320,
    "Earth-10005": 430, "Earth-TRN414": 540, "Earth-41633": 650,
    "Earth-TRN634": 760, "Earth-17315": 870
};

Object.entries(lanes).forEach(([name, y]) => {
    labelGroup.append("text").attr("class", "lane-label").attr("x", 15).attr("y", y + 5).text(name);
    g.append("line").attr("x1", 0).attr("x2", 100000).attr("y1", y).attr("y2", y).attr("stroke", "#1a1a1a");
});

const zoom = d3.zoom().scaleExtent([0.1, 2]).on("zoom", (e) => {
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
    svg.transition().duration(200).call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(k));
});

d3.tsv("data.tsv").then(data => {
    data.forEach(d => { d.yearNum = parseFloat(d.year); d.lane = d.lane.trim(); });
    data.sort((a, b) => a.yearNum - b.yearNum);

    data.forEach((d, i) => {
        d.xPos = i * 210 + 250;
        d.yPos = lanes[d.lane] || 500;
    });

    const links = [];
    data.forEach(d => {
        if (d.connections) {
            d.connections.split(",").forEach(tId => {
                const target = data.find(m => m.id.trim() === tId.trim());
                if (target) links.push({ s: d, t: target });
            });
        }
    });

    g.selectAll(".tt-link").data(links).enter().append("path")
        .attr("class", d => ((d.s.id=="47" && d.t.id=="45") || (d.s.id=="74" && d.t.id=="48")) ? "tt-link special-link" : "tt-link")
        .attr("marker-end", d => ((d.s.id=="47" && d.t.id=="45") || (d.s.id=="74" && d.t.id=="48")) ? "url(#arrowhead-special)" : "url(#arrowhead)")
        .attr("d", d => {
            const sx = d.s.xPos + 35, sy = d.s.yPos, tx = d.t.xPos - 35, ty = d.t.yPos;
            const dx = tx - sx;
            if (dx < 0) { // Legion Backward Loop
                return `M${sx},${sy} C${sx + 150},${sy - 200} ${tx - 150},${ty - 200} ${tx},${ty}`;
            }
            // Standard forward curve
            return `M${sx},${sy} C${sx + dx/2},${sy} ${tx - dx/2},${ty} ${tx},${ty}`;
        });

    const nodes = g.selectAll(".node").data(data).enter().append("g")
        .attr("class", "node").attr("transform", d => `translate(${d.xPos}, ${d.yPos})`);
    
    nodes.append("image").attr("xlink:href", d => d.image).attr("x", -35).attr("y", -50).attr("width", 70).attr("height", 100);
    nodes.append("text").attr("class", "label").attr("text-anchor", "middle").attr("y", 70).text(d => d.title);
});
