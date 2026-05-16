const width = window.innerWidth, height = window.innerHeight;
const svg = d3.select("#viz").append("svg").attr("width", width).attr("height", height);
const g = svg.append("g");

const axisSvg = d3.select("#axis-overlay").append("svg").attr("width", width).attr("height", 60);
const labelGroup = axisSvg.append("g");

// SYNCED ZOOM
const zoom = d3.zoom()
    .scaleExtent([0.1, 2])
    .on("zoom", (e) => {
        g.attr("transform", e.transform);
        labelGroup.attr("transform", `translate(${e.transform.x}, 0) scale(${e.transform.k})`);
    });

svg.call(zoom);

// Keyboard Navigation
d3.select(window).on("keydown", (e) => {
    const transform = d3.zoomTransform(svg.node());
    let { x, y, k } = transform;
    const step = 300;
    if (e.key === "ArrowRight") x -= step/2;
    if (e.key === "ArrowLeft") x += step/2;
    if (e.key === "ArrowDown") y -= step;
    if (e.key === "ArrowUp") y += step;
    svg.transition().duration(200).ease(d3.easeLinear).call(zoom.transform, d3.zoomIdentity.translate(x, y).scale(k));
});

// LOAD DATA
d3.tsv("data.tsv").then(data => {
    data.forEach(d => {
        d.yearNum = parseFloat(d.year);
        d.lane = d.lane.trim();
    });

    // 1. DATA-DRIVEN STRIPPED NUMERIC SORTING FOR LANES
    const uniqueLanes = [...new Set(data.map(d => d.lane))].sort((a, b) => {
        const numA = parseInt(a.replace(/\D/g, ""), 10) || 0;
        const numB = parseInt(b.replace(/\D/g, ""), 10) || 0;
        return numA - numB;
    });

    const laneSpacing = 160;
    const laneStart = 150;
    const laneMap = {};
    uniqueLanes.forEach((laneName, index) => {
        laneMap[laneName] = laneStart + (index * laneSpacing);
    });

    // Balanced Neon Color Palette
    const colorScale = d3.scaleOrdinal()
        .domain(uniqueLanes)
        .range(["#00d4ff", "#ff007f", "#00ff66", "#9933ff", "#ffaa00", "#00ffff", "#ff3333", "#aaeebb"]);

    // Draw Lane vertical timeline guidelines and Dynamic Column Titles
    uniqueLanes.forEach(name => {
        const xCoord = laneMap[name];

        // Header Text synced with Lane Color configuration
        labelGroup.append("text")
            .attr("class", "lane-label")
            .attr("x", xCoord)
            .attr("y", 40)
            .attr("text-anchor", "middle")
            .style("fill", colorScale(name)) // Synchronizes header color to match lines
            .text(name);

        g.append("line")
            .attr("x1", xCoord).attr("x2", xCoord)
            .attr("y1", 0).attr("y2", 100000)
            .attr("stroke", "#141414").attr("stroke-width", 1.5);
    });

    // 2. SCRUNCH ENGINE
    data.sort((a, b) => a.yearNum - b.yearNum);

    const verticalStep = 150;
    const laneNextAvailableY = {};
    const rowsRegistry = [];

    uniqueLanes.forEach(lane => { laneNextAvailableY[lane] = 120; });

    data.forEach((d) => {
        d.xPos = laneMap[d.lane];
        let targetRow = 0;
        let foundSlot = false;

        while (!foundSlot) {
            let potentialY = 120 + (targetRow * verticalStep);
            const isRowOccupied = rowsRegistry[targetRow] && rowsRegistry[targetRow].includes(d.lane);
            const isBelowLaneSequence = potentialY >= laneNextAvailableY[d.lane];

            if (!isRowOccupied && isBelowLaneSequence) {
                d.yPos = potentialY;
                if (!rowsRegistry[targetRow]) rowsRegistry[targetRow] = [];
                rowsRegistry[targetRow].push(d.lane);
                laneNextAvailableY[d.lane] = d.yPos + verticalStep;
                foundSlot = true;
            } else {
                targetRow++;
            }
        }
    });

    // 3. GENERATE CONNECTIONS
    const links = [];
    data.forEach(targetNode => {
        if (targetNode.connections) {
            targetNode.connections.split(",").forEach(sourceId => {
                const sourceNode = data.find(m => m.id.trim() === sourceId.trim());
                if (sourceNode) {
                    links.push({ s: sourceNode, t: targetNode });
                }
            });
        }
    });

    // 4. DRAW PATH LINES with Multi-attribute Color Tracking
    g.selectAll(".tt-link").data(links).enter().append("path")
        .attr("class", "tt-link")  // d => ((d.s.id=="47" && d.t.id=="45") || (d.t.id=="48" && d.s.id=="74")) ? "tt-link special-link" :
        .attr("stroke", d => colorScale(d.s.lane))
        .style("color", d => colorScale(d.s.lane)) // Passes color value down so marker-end can read 'currentColor'
        .attr("marker-end", d => ((d.s.id=="47" && d.t.id=="45") || (d.t.id=="48" && d.s.id=="74")) ? "url(#arrowhead-special)" : "url(#arrowhead)")
        .attr("d", d => {
            const sx = d.s.xPos;
            const sy = d.s.yPos + 50;
            const tx = d.t.xPos;
            const ty = d.t.yPos - 55;

            const dy = ty - sy;

            if (dy < 0) { // Backward Loop
                const loopSpread = 240;
                return `M${sx},${sy} C${sx - loopSpread},${sy + 100} ${tx - loopSpread},${ty - 100} ${tx},${ty}`;
            }

            // S-Curve Fall Logic
            const verticalPull = Math.max(dy * 0.6, 60);
            const cp1x = sx;
            const cp1y = sy + verticalPull;
            const cp2x = tx;
            const cp2y = ty - verticalPull;

            return `M${sx},${sy} C${cp1x},${cp1y} ${cp2x},${cp2y} ${tx},${ty}`;
        });

    // 5. DRAW POSTERS
    const nodes = g.selectAll(".node").data(data).enter().append("g")
        .attr("class", "node").attr("transform", d => `translate(${d.xPos}, ${d.yPos})`);

    nodes.append("image")
        .attr("xlink:href", d => d.image)
        .attr("x", -35).attr("y", -50)
        .attr("width", 70).attr("height", 100);

    nodes.append("text")
        .attr("class", "label")
        .attr("text-anchor", "middle")
        .attr("y", 68)
        .text(d => d.title);
});
