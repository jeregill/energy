class ChordChart {

    /**
     * Class constructor with initial configuration
     * @param _config
     * @param _data
     * @param _forceGraph
     */
    constructor(_config, _data, _forceGraph) {

        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 700 * SCALE_FACTOR,
            containerHeight: 550 * SCALE_FACTOR,
            margin: { top: 260 * SCALE_FACTOR, right: 15 * SCALE_FACTOR, bottom: 35 * SCALE_FACTOR, left: 300 * SCALE_FACTOR },
            legendWidth: 170 * SCALE_FACTOR,
            legendHeight: 8 * SCALE_FACTOR,
            legendMargin: { top: 20 * SCALE_FACTOR, right: 20 * SCALE_FACTOR, bottom: 20 * SCALE_FACTOR, left: 45 * SCALE_FACTOR },
            tooltipPadding: 10,
            colorMap: _config.colorMap
        }
        this.tooltipWidth = this.config.containerWidth * 0.4;
        this.data = _data;
        this.forceGraphOriginal = _forceGraph;
        this.forceGraph = _forceGraph;
        this.initVis();
    }

    /**
     * Create scales, axes, and append static elements
     */
    initVis() {
        let vis = this;

        // Constants
        vis.linkOpacity = 0.1;
        vis.significantPercent = 10;
        vis.energyTypes = Array.from(vis.config.colorMap.keys());

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Create color scale
        vis.colorCodes = Array.from(vis.config.colorMap.values());
        vis.colorScale = d3.scaleOrdinal()
            .range(vis.colorCodes)
            .domain(Array.from(vis.config.colorMap.keys()));

        // Create line thickness scale for links in the force-directed graph
        vis.lineThicknessScale = d3.scaleLinear()
            .range([1, 10])
            .domain([10, 100]);

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight)
            .attr('border', 1);

        vis.chart = vis.svg.append('g')
            .attr('class', 'title')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Append group element that will contain the Chord diagram
        vis.chartArea = vis.chart.append('g')
            .attr('class', 'chord');

        // Create a matrix to determine the size of the outer rims on the chord chart
        vis.createMatrix();

        vis.chord = d3.chord()
            .padAngle(0.05)
            .sortSubgroups(d3.descending)(vis.chordRingWeight);

        vis.innerRadius = 170;
        vis.outerRadius = 178.5;

        vis.arc = d3.arc()
            .innerRadius(vis.innerRadius)
            .outerRadius(vis.outerRadius);

        // Render Chord diagram to drawing area
        const chordDiagram = vis.chartArea
            .datum(vis.chord)
            .append('g')
            .selectAll('g')
            .data(d => d.groups)
            .enter()
            .append('g')
            .append('path')
            .style('fill', (d, i) => vis.colorCodes[i])
            .style('stroke', 'black')
            .attr('d', vis.arc);

        // add groups
        // taken from: https://bl.ocks.org/mbostock/1308257
        const g = vis.chartArea.selectAll('group')
            .data(vis.chord.groups)
            .enter().append('g')
            .attr('class', (d, i) => `group section${i} rim`)
            .style('fill', (d, i) => vis.colorCodes[i])
            .on('mouseover', function (event, d) {
                d3.select(this).classed('hover-rim', true);
                vis.tooltipShow(event, d, false);
                if (countryFilter.length == 0 && !animationPlaying) {
                    d3.select(this).style('cursor', 'pointer');
                }
            })
            .on('mouseleave', function () {
                d3.select(this).style('cursor', 'default');
                d3.select(this).classed('hover-rim', false);
                vis.tooltipHide();
            })
            .on('mousemove', (event, d) => vis.tooltipMove(event, d, false))
            .on('click', function (event, d) {
                if (animationPlaying) return;
                removeCountryFilter();
                dispatcher.call('selectType', event, d.index);
            })
            .raise();

        g.append('path')
            .attr('id', d => `group${d.index}`)
            .attr('d', vis.arc);

        // Add the labels
        g.append('text')
            .attr('x', 6)
            .attr('dy', -5)
            .append('textPath')
            .attr('xlink:href', d => `#group${d.index}`)
            .text(d => {
                return vis.energyTypes[d.index] === 'Renewables' ? 'Renew.' : vis.energyTypes[d.index];
            })
            .attr('font-size', 15)
            .attr('font-weight', 700)
            .attr('class', 'rim-text');

        vis.getEnergyPositionsFromAngles();
        vis.initiateLegend();
        vis.updateVis();
    }

    /**
     * Prepare the data before rendering.
     */
    updateVis() {
        let vis = this;
        vis.forceGraph = JSON.parse(JSON.stringify(vis.forceGraphOriginal));  // there's no native way to perform a deep-copy in JS

        vis.dataProcessing();
        vis.setRadiusScale();

        vis.simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id((d) => d.id))
            .force('collision', d3.forceCollide().radius(10))
            .force('center', d3.forceCenter());

        vis.renderVis();
    }

    /** 
     * Render the visualization on screen
     */
    renderVis() {
        let vis = this;

        vis.createEnergyNodes();
        vis.createEnergyLinks();

        // Add data to the simulation
        vis.simulation.nodes(vis.forceGraph.nodes);
        vis.simulation.force('link').links(vis.forceGraph.links);

        // Update positions
        vis.simulation.on('tick', () => {
            nodes
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            links
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);
        });

        // Draw links
        const links = vis.chartArea
            .selectAll('line')
            .data(vis.forceGraph.links, d => [d.source, d.target])
            .join('line')
            .attr('stroke', 'grey')
            .attr('stroke-width', d => vis.lineThicknessScale(d.value))
            .attr('stroke-opacity', vis.linkOpacity)
            .attr('class', d => `${d.source.id} ${d.target.id} links`)
            .lower();

        // Draw nodes
        const nodes = vis.chartArea
            .selectAll('circle')
            .data(vis.forceGraph.nodes, d => d.id)
            .join('circle')
            .attr('r', d => vis.radiusScale(vis.normalizedConsumption.get(d.id)))
            .attr('fill', d => {
                let countryInfo = vis.countryEnergyPercentage.get(d.id);
                if (countryInfo == null) return;
                countryInfo = new Map(Array.from(countryInfo, a => a.reverse()));
                const percentagesSorted = Array.from(countryInfo.keys()).sort(d3.descending)
                const topType = countryInfo.get(percentagesSorted[0])
                return vis.config.colorMap.get(topType);
            }) // have the colour change based on continent or usage of energy
            .attr('fill-opacity', 1)
            .attr('stroke', 'grey')
            .attr('class', d => {
                let classes = 'points';
                let countryInfo = vis.countryEnergyPercentage.get(d.id);
                if (countryInfo == null) return classes;

                for (let [type, percent] of countryInfo.entries()) {
                    if (percent > vis.significantPercent) {
                        classes += ` ${type}`;
                    }
                }
                return `${classes} ${d.id}`;
            }).raise();

        nodes
            .on('mouseover', function (event, d) {
                d3.select(this).classed('hover', true);
                vis.tooltipShow(event, d, true);
                if (!animationPlaying) {
                    d3.select(this).style('cursor', 'pointer');
                }
            })
            .on('mouseleave', function () {
                d3.select(this).style('cursor', 'default');
                d3.select(this).classed('hover', false);
                vis.tooltipHide()
            })
            .on('mousemove', (event, d) => vis.tooltipMove(event, d, true))
            .on('click', function (event, d) {
                if (animationPlaying) return;
                removeTypeFilter();
                dispatcher.call('selectCountry', event, d.id);
            });
    }

    /** 
     * When a country is selected; highlight the correct node and links attached to it 
     */
    highlightActiveCountry(countryCode) {
        let vis = this;
        // Bring all node's opacity back to normal
        vis.chartArea.selectAll('.points')
            .attr('fill-opacity', 1)

        // Unhighlight links connected to this node
        vis.chartArea.selectAll(`.${countryCode}.links`)
            .attr('stroke', 'grey')
            .attr('stroke-opacity', vis.linkOpacity)
            .lower();

        vis.chartArea.selectAll(`.${countryCode}.points`)
            .classed('highlight-node', false)
    }

    /** 
     * When a country is deselected or a new country is selected;
     * remove the highlights from the old node and apply them to the new node
     */
    highlightNotActiveCountry(countryCode, oldCountryCode) {
        let vis = this;
        // Remove highlights from the previously selected node
        vis.chartArea.selectAll('.highlight-node').classed('highlight-node', false);
        if (oldCountryCode) {
            vis.chartArea.selectAll(`.${oldCountryCode}.points`)
                .attr('stroke', 'grey')
                .attr('stroke-width', 1)
                .attr('stroke-opacity', 1)

            vis.chartArea.selectAll(`.${oldCountryCode}.links`)
                .attr('stroke', 'grey')
                .attr('stroke-opacity', vis.linkOpacity)
                .lower();
        }

        // Reduce opacity of all nodes except this one
        vis.chartArea.selectAll('.points')
            .attr('fill-opacity', 0.2)

        // Highlight links connected to this node
        vis.chartArea.selectAll(`.${countryCode}.links`)
            .attr('stroke', 'black')
            .attr('stroke-opacity', 1)
            .attr('fill-opacity', 1)
            .raise()

        vis.chartArea.selectAll('.rim').raise();

        vis.chartArea.selectAll(`.${countryCode}.points`)
            .attr('fill-opacity', 1)
            .raise();

        vis.chartArea.selectAll(`.${countryCode}.points`)
            .classed('highlight-node', true)
    }

    /** 
     * When an energy type is selected; highlight the rim section and links attached to it
     */
    highlightActiveType(typeIndex) {
        let vis = this;

        typeFilter = typeFilter.filter(f => f !== typeIndex);
        vis.chartArea.selectAll('.links')
            .attr('stroke-opacity', vis.linkOpacity)
            .lower();
        vis.chartArea.selectAll(`.${vis.energyTypes[typeIndex]}.links`)
            .attr('stroke', 'grey')
            .attr('stroke-opacity', vis.linkOpacity)
        vis.chartArea.selectAll('.points')
            .attr('fill-opacity', 1)
            .attr('pointer-events', 'all')
        vis.chartArea.selectAll(`.${vis.energyTypes[typeIndex]}.points`)
            .classed('highlight-node', false)
        vis.chartArea.selectAll(`.section${typeIndex}`)
            .classed('highlight-rim', false)
    }

    /** 
     * When an energy type is deselected or a new type is selected;
     * remove the highlights from the old section and apply them to the new section
     */
    highlightNotActiveType(typeIndex) {
        let vis = this;

        vis.chartArea.selectAll('.highlight-rim').classed('highlight-rim', false);
        vis.chartArea.selectAll('.highlight-node').classed('highlight-node', false);
        vis.chartArea.selectAll('.links')
            .attr('stroke-opacity', 0)
        vis.chartArea.selectAll(`.${vis.energyTypes[typeIndex]}.links`)
            .attr('stroke', 'black')
            .attr('stroke-opacity', 1)
        vis.chartArea.selectAll('.points')  // Change all node's fill-opacity
            .attr('fill-opacity', 0.2)
            .attr('pointer-events', 'none')
        vis.chartArea.selectAll(`.${vis.energyTypes[typeIndex]}.points`)  // Only change node's fill-opacity if they're connected to the selected energy type
            .attr('fill-opacity', 1)
            .attr('pointer-events', 'all')
            .classed('highlight-node', true)
            .raise()
        vis.chartArea.selectAll(`.section${typeIndex}`)
            .classed('highlight-rim', true)
    }

    /** 
     * Create the tooltip that shows up when hovering over points or the outer sections
     */
    tooltipShow(event, d, isPoint) {
        let vis = this;
        // create and show tooltip
        d3.select('#chordchart-tooltip')
            .style('display', 'block')
            .style('left', () => {
                if (event.pageX > 1650 && !isPoint) {
                    return event.pageX - vis.tooltipWidth - vis.config.tooltipPadding + 'px';
                }
                return event.pageX + vis.config.tooltipPadding + 'px'
            }) 
            .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
            .html(isPoint ? vis.tooltipHTMLPoint(d) : vis.tooltipHTMLRim(d));
    }

    /**
     * Adjust the position of the tooltip
     * */
    tooltipMove(event, d, isPoint) {
        let vis = this;

        d3.select('#chordchart-tooltip')
            .style('left', () => {
                if (event.pageX > 1650 && !isPoint) {
                    return event.pageX - vis.tooltipWidth - vis.config.tooltipPadding + 'px';
                }
                return event.pageX + vis.config.tooltipPadding + 'px'
            })
            .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
    }

    /** 
     * Hide the tooltip
     */
    tooltipHide() {
        d3.select('#chordchart-tooltip').style('display', 'none');
    }

    /** 
     * Create the HTML portion of the tooltip for nodes
     */
    tooltipHTMLPoint(d) {
        let vis = this;

        let html = `<div class='tooltip-title'>${vis.countryCodeMap.get(d.id)}</div>`
        let countryInfo = vis.countryEnergyPercentage.get(d.id);
        countryInfo = new Map(Array.from(countryInfo, a => a.reverse()));
        const percentagesSorted = Array.from(countryInfo.keys()).sort(d3.descending)

        for (let percentage of percentagesSorted) {
            const row = `<div class='tooltip-subtitle'>${countryInfo.get(percentage)}: ${percentage.toFixed(2)}%</div>`
            html += row;
        }
        return html;
    }

    /** 
     * Create the HTML portion of the tooltip for the outer rim
     */
    tooltipHTMLRim(d) {
        let vis = this;

        const energyType = vis.energyTypes[d.index];
        let html = `<div class='tooltip-title'>${energyType}</div>`
        if (countryFilter.length != 0) {
            const countryCode = countryFilter[0];
            const countryName = vis.countryCodeMap.get(countryCode);
            const consumptionValue = vis.countryTypeAndConsumption.get(countryCode).get(energyType);
            html += `<div class='tooltip-subtitle'>Consumption for ${countryName}: ${consumptionValue.toFixed(2)} exajoules</div>`;
        } else {
            const consumptionValue = vis.consumptionByType.get(energyType);
            html += `<div class='tooltip-subtitle'>Total Consumption: ${consumptionValue.toFixed(2)} exajoules</div>`;
        }

        return html;
    }

    /** 
     * Create a radius scale for the circles in the chart and ensure that their area is squared
     * as to scale area size properly.
     */
    setRadiusScale() {
        let vis = this;

        // Get the least and most amount of consumption by a country
        const minMaxConsumption = d3.extent(Array.from(vis.normalizedConsumption.values()))

        vis.radiusScale = d3.scalePow().exponent(0.5)
            .range([8, 15])
            .domain(minMaxConsumption);
    }

    /** 
     * Process all of the data into various maps to be used by this class during initVis(), updateVis(), & renderVis()
     */
    dataProcessing() {
        let vis = this;

        // Count consumption by Country and Type of energy
        vis.countryTypeAndConsumption = d3.rollup(vis.data, v => d3.sum(v, d => d.Consumption), d => d.Country_Code, d => d.Type)

        // Count total consumption of each Country
        vis.countryTotalConsumption = d3.rollup(vis.data, v => d3.sum(v, d => d.Consumption), d => d.Country_Code);

        // Get total consumption of each Country normalized by population size
        vis.normalizedConsumption = d3.rollup(vis.data,
            v => d3.sum(v, d => d.Consumption * 100000000) / d3.sum(v, d => d.Population),
            d => d.Country_Code);

        // Get consumption by type
        vis.consumptionByType = d3.rollup(vis.data, v => d3.sum(v, d => d.Consumption), d => d.Type);

        // Get countries percentage of each energy type used of their total
        vis.countryEnergyPercentage = new Map();
        for (let [country, typeAmount] of vis.countryTypeAndConsumption.entries()) {
            let countryMap = new Map();
            for (let [type, amount] of typeAmount) {
                let percentage = amount / vis.countryTotalConsumption.get(country) * 100;
                countryMap.set(type, percentage);
            }
            vis.countryEnergyPercentage.set(country, countryMap);
        }

        // Map the country code to the country's full name
        vis.countryCodeMap = new Map();
        for (let d of vis.data) {
            vis.countryCodeMap.set(d.Country_Code, d.Country)
        }

        // Remove countries with zero consumption from the data
        vis.removeZeroConsumptionCountries();
    }

    /** 
     * Remove countries from vis.forceGraph if they have 0 consumption
     */
    removeZeroConsumptionCountries() {
        let vis = this;

        let filteredCountries = [];
        for (let country of vis.forceGraph.nodes) {
            if (vis.countryTotalConsumption.get(country.id) == 0) continue;
            filteredCountries.push(country);
        }
        vis.forceGraph.nodes = filteredCountries;
    }

    /** 
     * Create a matrix for the size of the outer rings of the Chord diagram
     */
    createMatrix() {
        let vis = this;

        // This makes it easier for the user to select certain energy types more easily
        vis.chordRingWeight = [
            [0, 3, 3, 3, 1, 1, 1, 1, 1],        // OIL
            [3, 0, 1, 1, 1, 1, 1, 1, 1],        // GAS
            [3, 3, 0, 3, 1, 1, 1, 1, 1],        // COAL
            [2, 2, 2, 0, 1, 1, 1, 1, 1],        // NUCLEAR
            [2, 2, 2, 1, 0, 1, 1, 1, 1],        // HYDRO
            [0.1, 0.1, 0.1, 1, 1, 0, 1, 1, 1],  // RENEWABLES
            [0.1, 0.1, 0.1, 1, 1, 1, 0, 1, 1],  // SOLAR
            [1, 1, 1, 1, 1, 1, 1, 0, 1],        // WIND
            [1, 1, 1, 1, 1, 1, 1, 1, 0],        // GEO
        ]
    }

    // Taken from other previous 436 class to figure out X and Y coordinates of the outside chord sections 
    getEnergyPositionsFromAngles() {
        let vis = this;

        vis.energyPositions = {};

        for (let i = 0; i < vis.energyTypes.length; i++) {
            let energyTypeGroup = vis.chord.groups[i];
            let x = vis.getXFromSection(energyTypeGroup, (vis.innerRadius + vis.outerRadius) / 2);
            let y = vis.getYFromSection(energyTypeGroup, (vis.innerRadius + vis.outerRadius) / 2);
            vis.energyPositions[vis.energyTypes[i]] = {
                x: x,
                y: y
            };
        }
    }

    /* Get the X coordinate of a energy type section */
    getXFromSection(group, radius) {
        return Math.cos((group.startAngle + group.endAngle) / 2 - Math.PI / 2) * radius;
    }

    /* Get the Y coordinate of a energy type section */
    getYFromSection(group, radius) {
        return Math.sin((group.startAngle + group.endAngle) / 2 - Math.PI / 2) * radius;
    }

    /* 
     * LEGEND: Create the legend
     * - Size scale legend (what the size channel represents)
     * - Shape legend (what the point mark represents)
     */
    initiateLegend() {
        let vis = this;

        vis.legend = vis.svg.append('g')
            .attr('class', 'legend')
            .attr('width', vis.config.legendWidth)
            .attr('height', vis.config.legendHeight);

        vis.legendItem = vis.legend.append('g').attr('class', 'legend-item');
        vis.legendItem.append('circle')
            .attr('cx', vis.config.legendMargin.left + 520 * SCALE_FACTOR)
            .attr('cy', vis.config.legendMargin.top + 215 * SCALE_FACTOR)
            .attr('r', 8)
            .attr('fill', 'grey')
            .attr('stroke', '#333')
            .attr('stroke-width', 0.3);

        vis.legendItem.append('text')
            .attr('x', vis.config.legendMargin.left + 540 * SCALE_FACTOR)
            .attr('y', vis.config.legendMargin.top + 200 * SCALE_FACTOR)
            .attr('alignment-baseline', 'middle')
            .attr('fill', 'grey')
            .text('Each point')
            .style('font-size', 12)
            .style('user-select', 'none')

        vis.legendItem.append('text')
            .attr('x', vis.config.legendMargin.left + 540 * SCALE_FACTOR)
            .attr('y', vis.config.legendMargin.top + 220 * SCALE_FACTOR)
            .attr('alignment-baseline', 'middle')
            .attr('fill', 'grey')
            .text('represents a')
            .style('font-size', 12)
            .style('user-select', 'none')

        vis.legendItem.append('text')
            .attr('x', vis.config.legendMargin.left + 540 * SCALE_FACTOR)
            .attr('y', vis.config.legendMargin.top + 240 * SCALE_FACTOR)
            .attr('alignment-baseline', 'middle')
            .attr('fill', 'grey')
            .text('single country')
            .style('font-size', 12)
            .style('user-select', 'none')

        let gap = 410 * 0.80;
        let radii = [8, 11.5, 15];
        for (let i = 0; i < 3; i++) {
            vis.legendItem = vis.legend.append('g').attr('class', 'legend-item');
            vis.legendItem.append('circle')
                .attr('cx', vis.config.legendMargin.left)
                .attr('cy', vis.config.legendMargin.top + gap - 10)
                .attr('r', radii[i])
                .attr('fill', 'grey')
                .attr('stroke', '#333')
                .attr('stroke-width', 0.3);

            if (i === 1) {
                vis.legendItem.append('text')
                    .attr('x', vis.config.legendMargin.left + 30 * SCALE_FACTOR)
                    .attr('y', vis.config.legendMargin.top + gap + 40 * SCALE_FACTOR)
                    .attr('alignment-baseline', 'middle')
                    .attr('fill', 'grey')
                    .text('The size correlates to the country\'s overall consumption normalized by population.')
                    .style('font-size', 13)
                    .style('user-select', 'none')
            }

            if (i === 0) {
                gap += 25
            } else {
                gap += 32
            }
        }

    }

    /* 
     * FORCE DIRECTED GRAPH: Create nodes at the center of each energy type section.
     * These nodes will be fixed in place during the simulation acting as anchor points.
     */
    createEnergyNodes() {
        let vis = this;

        for (let [type, pos] of Object.entries(vis.energyPositions)) {
            let node = {
                id: type,
                fx: pos.x,
                fy: pos.y,
            };
            vis.forceGraph.nodes.push(node);
        }
    }

    /* 
     * FORCE DIRECTED GRAPH: Depending on the energy makeup of each country, assign a value/weight to the link.
     * This value will be used to calculate the force each energy type will have on that node
     */
    createEnergyLinks() {
        let vis = this;

        for (let [country, typePercentages] of vis.countryEnergyPercentage.entries()) {
            for (let [type, percentage] of typePercentages) {
                if (percentage > vis.significantPercent) {
                    let link = {
                        source: country,
                        target: type,
                        value: percentage
                    };
                    vis.forceGraph.links.push(link);
                }
            }
        }
    }

}
