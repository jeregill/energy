class BarChart {

    /**
     * Class constructor with initial configuration
     * @param _config
     * @param _data
     */
    constructor(_config, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 525,
            containerHeight: 325,
            margin: { top: 10, right: 45, bottom: 25, left: 75 },
            tooltipPadding: 10,
            isDescending: _config.reverse || true,
            numItems: _config.numItems || 10,
            selectedCountry: _config.selectedCountry || null
        };
        this.tooltipWidth = this.config.containerWidth * 0.5;
        this.data = _data;
        // helper function to setup data when initialized or global filter called
        this.setupData();
        this.initVis();
    }

    /** 
     * Create scales, axes, and append static elements
     */
    initVis() {
        let vis = this;
        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        // Initialize scales
        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.xScale = d3.scaleBand()
            .range([0, vis.width])
            .paddingInner(0.2)
            .paddingOuter(0.2);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .tickSizeOuter(0)
            .tickFormat(d => {
                return vis.config.numItems === 10 ? d : [];
            });

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(6)
            .tickSizeOuter(0);

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement)
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight);

        vis.chart = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Append x-axis
        vis.xAxisG = vis.chart.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`);

        // Append y-axis
        vis.yAxisG = vis.chart.append('g')
            .attr('class', 'axis y-axis');

        // y-axis label
        vis.chart.append('text')
            .attr('class', 'y-label')
            .attr('text-anchor', 'end')
            .attr('x', - vis.height / 6)
            .attr('y', 6)
            .attr('dy', '-4em')
            .attr('transform', 'rotate(-90)')
            .text('Carbon Dioxide Per Capita (tonnes)');

        vis.updateVis();
    }

    /** 
     * Prepare the data before rendering.
     */
    updateVis() {
        let vis = this;
        // sort data
        vis.data.sort(function (x, y) {
            return vis.config.isDescending ? d3.descending(x.value, y.value) : d3.ascending(x.value, y.value);
        })
        // get the number of elements we want
        vis.displayData = vis.data.slice(0, vis.config.numItems);

        vis.accessorsAndSetDomain();

        vis.renderVis();
    }

    // set accessors and domain
    accessorsAndSetDomain() {
        let vis = this;
        // accessors
        vis.xValue = d => d.key;
        vis.yValue = d => d.value;

        // Set the scale input domains
        vis.xScale.domain(vis.displayData.map(vis.xValue));
        vis.yScale.domain([0, d3.max(vis.displayData, vis.yValue)]);

    }

    /** 
     * Render the visualization on screen
     */
    renderVis() {
        let vis = this;

        // Add rectangles
        let bars = vis.chart.selectAll('.bar')
            .data(vis.displayData, vis.xValue)
            .join('rect');

        // animate bars
        bars.attr('class', d => {
            if (!vis.config.selectedCountry) {
                return 'bar'
            } else if (vis.config.selectedCountry === d) {
                return 'bar selected'
            } else {
                // something selected, but different country
                return 'bar not-selected'
            }
        })
            .transition().duration(1000)
            .attr('x', d => vis.xScale(vis.xValue(d)))
            .attr('width', vis.xScale.bandwidth())
            .attr('height', d => vis.height - vis.yScale(vis.yValue(d)))
            .attr('y', d => vis.yScale(vis.yValue(d)));

        // tooltip helper functions
        bars.on('mouseover', function (event, d) {
                if (!animationPlaying) d3.select(this).style('cursor', 'pointer');
                vis.tooltipShow(event, d, vis)
            })
            .on('mouseleave', function () {
                d3.select(this).style('cursor', 'default');
                vis.tooltipHide();
            })
            .on('mousemove', (event, d) => vis.tooltipMove(event, d, vis))
            .on('click', function (event, d) {
                if (animationPlaying) return;
                removeTypeFilter();
                dispatcher.call('selectCountry', event, d.key);
            });

        vis.xAxisG.call(vis.xAxis);
        vis.yAxisG.call(vis.yAxis);
        vis.enableSort();
    }

    /** 
     * static data setup to rollup values:
     */
    setupData() {
        let vis = this;
        // since emissions were not tracked by type, we only need one type of emissions to track
        vis.data = d3.filter(vis.data, d => {
            return d['Type'] === 'Oil';
        });
        // need a country code so we can show abbreviations on the x-axis
        vis.countryIndex = d3.rollup(vis.data,
            v => v[0]['Country'],
            d => d['Country_Code']);

        // rollup data since we need it by country
        const aggregatedDataMap = d3.rollup(vis.data,
            v => d3.sum(v, v1 => v1['Emissions'] * 1000000) / d3.sum(v, v1 => v1['Population']),
            d => d['Country_Code']);

        vis.data = Array.from(aggregatedDataMap, ([key, value]) => ({ key, value }));
    }

    /** 
     * Create the tooltip that shows up when hovering over a bar
     */
    tooltipShow(event, d, vis) {
        // create and show tooltip
        d3.select('#barchart-tooltip')
            .style('display', 'block')
            .style('left', () => {
                if (event.pageX > 1650)
                    return event.pageX - vis.tooltipWidth - vis.config.tooltipPadding + 'px';
                return event.pageX + vis.config.tooltipPadding + 'px';
            })
            .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
            .html(`
              <div class='tooltip-title'>${this.countryIndex.get(d.key)}</div>
              <div class='tooltip-subtitle'>${numberWithDecimals(d.value)} tonnes of carbon dioxide per capita </div>
            `);
    }

        /**
     * Adjust the position of the tooltip
     * */
    tooltipMove(event, d) {
        let vis = this; 

        d3.select('#barchart-tooltip')
            .style('left', () => {
                if (event.pageX > 1650)
                    return event.pageX - vis.tooltipWidth - vis.config.tooltipPadding + 30 + 'px';
                return event.pageX + vis.config.tooltipPadding + 'px'
            })
            .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
    }

    /** 
     * Hide tooltip
     */
    tooltipHide() {
        d3.select('#barchart-tooltip').style('display', 'none');
    }

    // when global filter is called, we need to re-initialize data and then update the viz
    globalFilterCalled() {
        let vis = this;
        vis.setupData();
        vis.updateVis();
    }

    // sort ascending or descending
    enableSort() {
        let vis = this;
        let label = document.getElementById('barchart-sort');
        d3.select('#barchart-sort').on('click', () => {
            vis.config.isDescending = !vis.config.isDescending;
            if (vis.config.isDescending) {
                label.innerHTML = `<i class="bi-sort-down" id="sort-icon"></i> Descending`;
            } else {
                label.innerHTML = `<i class="bi-sort-up" id="sort-icon"></i> Ascending`;
            }
            vis.updateVis();
        });
    }

    /* Click on a radio button to adjust the number of items displayed in the graph
    if a country is selected make the radio buttons non-clickable */
    radioFilter(value) {
        let vis = this;
        vis.config.numItems = value === 'all' ? vis.data.length : parseInt(value);
        vis.updateVis();
    }

    /** 
     * When a country is selected; highlight the country
     */
    highlightActiveCountry(countryCode) {
        let vis = this;
        // find country
        let selectedCountry = d3.filter(vis.data, d => {
            return d.key === countryCode;
        });
        if (vis.config.selectedCountry === selectedCountry[0]) {
            // this should always be true
            vis.config.selectedCountry = null;
            vis.updateVis();
        }
        // enable buttons
        enableBarChartButtons();

    }

    /** 
     * When a country is deselected or a new country is selected;
     * remove the highlights from the old country and apply them to the new country
     */
    highlightNotActiveCountry(countryCode, oldCountryCode) {
        let vis = this;
        // find country
        let selectedCountry = d3.filter(vis.data, d => {
            return d.key === countryCode;
        });
        // find old country
        let oldCountry = d3.filter(vis.data, d => {
            return d.key === oldCountryCode;
        });
        // if country selected previously
        if (oldCountry.length !== 0) {
            // country was selected before
            // first reset data by sorting
            vis.data.sort(function (x, y) {
                return vis.config.isDescending ? d3.descending(x.value, y.value) : d3.ascending(x.value, y.value);
            })
        }
        vis.config.selectedCountry = selectedCountry[0];
        vis.moveBarAndRedraw(selectedCountry[0]);
        // disable buttons
        disableBarChartButtons();
    }

    /* move bar to the front and redraw axis */
    moveBarAndRedraw(selectedCountry) {
        let vis = this;
        vis.displayData = vis.data.filter(d => d !== selectedCountry);
        vis.displayData.unshift(selectedCountry);
        vis.displayData = vis.displayData.slice(0, vis.config.numItems);
        vis.accessorsAndSetDomain();
        vis.renderVis();
    }
}

