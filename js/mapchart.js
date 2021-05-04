class MapChart {

  /**
   * Class constructor with initial configuration
   * @param _config
   * @param _data
   * @param _geoData
   */
  constructor(_config, _data, _geoData) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: 1200,
      containerHeight: 500,
      margin: _config.margin || { top: 0, right: 0, bottom: 0, left: 0 },
      tooltipPadding: 10,
    }
    this.tooltipHeight = this.config.containerHeight * 0.8;
    this.tooltipWidth = this.config.containerWidth * 0.5;
    this.geoData = _geoData;
    this.data = _data;
    this.initVis();
  }

  /**
   * We initialize scales/axes and append static elements, such as axis titles.
   */
  initVis() {
    let vis = this;

    // Define Main Countries and Exceptions, Energy Types
    vis.mainCountries = ['Central America', 'Canada', 'US', 'Brazil', 'Russian Federation', 'India', 'Australia', 'China'];
    vis.combinedLocales = ['Western Africa', 'Eastern Africa', 'Middle Africa', 'Central America'];
    vis.energyTypes = ['Oil', 'Gas', 'Coal', 'Nuclear', 'Hydro', 'Renewables', 'Solar', 'Wind', 'Geo', 'No Data'];

    // Calculate inner chart size. Margin specifies the space around the actual chart.
    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    // Define size of SVG drawing area
    vis.svg = d3.select(vis.config.parentElement)
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight);

    // Append group element that will contain our actual chart 
    // and position it according to the given margin config
    vis.chart = vis.svg.append('g')
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    // Defines the scale and translate of the projection so that the geometry fits within the SVG area
    // We crop Antartica because it takes up a lot of space that is not needed for our data
    vis.projection = d3.geoEquirectangular()
      .center([0, 15]) // set centre to further North
      .scale([vis.width / (2 * Math.PI)]) // scale to fit size of svg group
      .translate([vis.width / 2, vis.height / 2]); // ensure centered within svg group

    // Set projection
    vis.geoPath = d3.geoPath().projection(vis.projection);

    // Define color scale for all energy types
    vis.colorScale = d3.scaleOrdinal()
      //      OIL        GAS       COAL        NUCLEAR     HYDRO     RENEWABLES SOLAR     WIND        GEO
      .range(['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6'])
      .domain(['Oil', 'Gas', 'Coal', 'Nuclear', 'Hydro', 'Renewables', 'Solar', 'Wind', 'Geo']);

    vis.indexColorScale = d3.scaleOrdinal()
      //      OIL        GAS       COAL        NUCLEAR     HYDRO     RENEWABLES SOLAR     WIND        GEO
      .range(['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6'])
      .domain(d3.range([0, 8]));


    // Add Legend
    vis.chart.selectAll('legendDots')
      .data(vis.energyTypes)
      .join('circle')
      .attr('class', 'legendCircle')
      .attr('cx', 50)
      .attr('cy', (d, i) => 200 + i * 20)
      .attr('r', 7)
      .style('fill', d => {
        if (d === 'No Data') return '#c5cacb';
        return vis.colorScale(d);
      });

    vis.chart.selectAll('legendText')
      .data(vis.energyTypes)
      .join('text')
      .text(d => d)
      .attr('transform', (d, i) => `translate(60, ${205 + i * 20})`)
      .attr('fill', 9)
      .attr('');

    // Set Linechart tooltip
    vis.linechart = d3.select('#mapchart-tooltip')
      .attr('width', vis.tooltipWidth)
      .attr('height', vis.tooltipHeight)
      .append('g');

    // Append axes groups for Linechart
    vis.xAxisG = vis.linechart.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${vis.tooltipHeight * 0.9})`);

    vis.yAxisG = vis.linechart.append('g')
      .attr('class', 'axis y-axis')
      .attr('transform', `translate(40, 0)`);

    // Set Linechart tooltip scales and axes
    vis.xScale = d3.scaleTime();
    vis.yScale = d3.scaleLinear();

    vis.xScale.range([40, vis.tooltipWidth - 30]);
    vis.yScale.range([vis.tooltipHeight * .9, vis.tooltipHeight * .15]);

    // Initialize axes
    vis.xAxis = d3.axisBottom(vis.xScale)
      .ticks(10)
      .tickFormat(d3.format('y'))
      .tickSizeOuter(0)
      .tickPadding(10);

    vis.yAxis = d3.axisLeft(vis.yScale)
      .ticks(5, '.1f')
      .tickSize(-vis.width)
      .tickSizeOuter(0)
      .tickPadding(10);

    // Set tooltip title and axis labels
    vis.tooltipTitle = d3.select('#mapchart-tooltip')
      .append('text')
      .attr('class', 'title')
      .attr('x', vis.tooltipWidth / 2)
      .attr('y', 25)
      .attr('font-size', 16)
      .style('text-anchor', 'middle');

    vis.tooltipAxis = d3.select('#mapchart-tooltip')
      .append('text')
      .attr('class', 'axis-title')
      .attr('x', 25)
      .attr('y', 50)
      .attr('font-size', 10)
      .text('Energy Consumption (exJ)');

    vis.updateVis();
  }

  /**
   * Prepare the data before rendering.
   */
  updateVis() {
    let vis = this;

    // Data Processing Functions: 
    vis.groups = d3.rollup(vis.data, v => d3.mean(v, d => d.Consumption), d => d.Country, d => d.Type); // Mean Consumption across all time for country by type
    vis.countries = d3.rollup(vis.data, v => [v[0].lat, v[0].lon], d => d.Country); // LatLon by Country
    vis.linegroups = d3.group(vis.data, d => d.Country, d => d.Type); // Scatterplot Data for each type, by country
    vis.years = d3.extent(vis.data, d => d.Year); // Extent Year Range
    vis.consumption = d3.rollup(vis.data, v => d3.extent(v, d => d.Consumption), d => d.Country); // Consumption extent, by country
    vis.renderVis();
  }

  /** 
   * Render the visualization on screen.
   */
  renderVis() {
    let vis = this;
    let type;

    // Append world map
    let geoPath = vis.chart.selectAll('.geo-path')
      .data(topojson.feature(vis.geoData, vis.geoData.objects.countries).features)
      .join('path');

    geoPath.attr('class', d => `geo-path ${countryNameToCodeMap.get(d.properties.name)} country`)
      .transition().duration(d => {
        return animationPlaying ? 10 : 2000;
      }).on('start', function () {
        d3.select(this).attr('pointer-events', 'none');  // disable clicking as the map is being drawn
      }).on('end', function () {
        d3.select(this).attr('pointer-events', 'all');   // enable clicking after the map has been drawn 
      })
      .attr('d', vis.geoPath)
      .attr('stroke', d => {
        try {
          if (vis.africanLocales.includes(d.properties.name)) {
            throw 'Part of a Bigger Locale';
          }
          else {
            vis.groups.get(d.properties.name).entries();
            return 'black';
          }
        } catch (e) { return 'grey'; }
      })
      .attr('fill', d => {
        try {
          type = [...vis.groups.get(d.properties.name).entries()].reduce((a, e) => e[1] > a[1] ? e : a);
          if (type[1] === 0) {
            throw 'no data available'
          }
          if (countryFilter.length != 0 && (countryCodeToNameMap.get(countryFilter[0]) == d.properties.name)) {
            return vis.createFillPattern(d, type[0]);
          }
          return vis.colorScale(type[0]);
        } catch (e) {
          return '#c5cacb';
        }
      })


    // Append pie charts for major countries
    for (const [key, value] of (vis.groups.entries())) {
      let lonlat = vis.projection([vis.countries.get(key)[1], vis.countries.get(key)[0]]);
      if (vis.mainCountries.includes(key)) { // change to hover to display instead
        let c = vis.chart.selectAll('.' + classKey(key))
          .data(d3.sum(value.values()) == 0 ? pie(0) : pie(Array.from(value.values())))
          .join('path');
        c.attr('transform', `translate(${lonlat[0]}, ${lonlat[1]})`)
          .attr('class', classKey(key))
          .attr('stroke', 'black')
          .attr('stroke-width', '0.5px')
          .attr('fill', d => {
            return vis.indexColorScale(d.index);
          })
          .transition().duration(d => {
            return animationPlaying ? 0 : 3000;
          })
          .attrTween('d', function (d) {
            var start = { startAngle: d.startAngle, endAngle: d.startAngle };
            var interpolate = d3.interpolate(start, d);
            return function (t) {
              return arc(interpolate(t));
            }
          });
      }
    }

    // Mouse Event Handler
    geoPath.on('mouseover', function (event, d) {
        const countryCode = countryNameToCodeMap.get(d.properties.name);
        if (!animationPlaying && doesCountryExist(countryCode)) {
          d3.select(this).style('cursor', 'pointer')
        } else {
          d3.select(this).attr('pointer-events', 'none');
        }
        return animationPlaying ? null : vis.tooltipShow(event, d, vis);
      })
      .on('mousemove', (event, d) => vis.tooltipMove(event, d, vis))
      .on('mouseleave', function () {
        d3.select(this).style('cursor', 'default');
        vis.tooltipHide(vis)
      })
      .on('click', function (event, d) {
        if (animationPlaying) return;
        removeTypeFilter();
        dispatcher.call('selectCountry', event, countryNameToCodeMap.get(d.properties.name));
      });
  }

  /** 
   * When a country is selected; highlight the country
   */
  highlightActiveCountry(countryCode) {
    let vis = this;

    const countryName = countryCodeToNameMap.get(countryCode);
    const type = [...vis.groups.get(countryName).entries()].reduce((a, e) => e[1] > a[1] ? e : a)[0];
    try {
      vis.chart.selectAll(`.${countryCode}.country`)
        .attr('fill', vis.colorScale(type));
    } catch (e) {
      vis.chart.selectAll(`.${countryCode}.country`)
        .attr('fill', '#c5cacb');
    }
  }

  /** 
   * When a country is deselected or a new country is selected;
   * remove the highlights from the old country and apply them to the new country
   */
  highlightNotActiveCountry(countryCode, oldCountryCode) {
    let vis = this;

    const oldCountryName = countryCodeToNameMap.get(oldCountryCode);
    if (oldCountryCode) {
      const energyType = [...vis.groups.get(oldCountryName).entries()].reduce((a, e) => e[1] > a[1] ? e : a)[0];
      vis.chart.selectAll(`.${oldCountryCode}.country`)
        .attr('fill', vis.colorScale(energyType))
    }

    const countryName = countryCodeToNameMap.get(countryCode);
    const type = [...vis.groups.get(countryName).entries()].reduce((a, e) => e[1] > a[1] ? e : a)[0];
    vis.chart.selectAll(`.${countryCode}.country`).attr('fill', vis.createFillPattern(countryName, type));
  }

  /* Handle Event MouseOver - Update and Render Line Chart */
  tooltipShow(event, d, vis) {
    moveTimeSliderLayerDown();
    vis.lineData = vis.linegroups.get(d.properties.name);
    if (vis.lineData === undefined) {
      d3.select('#mapchart-tooltip').style('display', 'none');
      return null;
    }

    // Update Domain
    vis.xScale.domain(vis.years);
    vis.yScale.domain(vis.consumption.get(d.properties.name));

    // Redraw Lines
    let tooltip = d3.select('#mapchart-tooltip');
    let tooltipLines = tooltip
      .style('display', 'block')
      .selectAll('.line')
      .data(vis.lineData)
      .join('path');
    tooltipLines
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', d => vis.colorScale(d[0]))
      .attr('stroke-width', 3)
      .attr('d', d => d3.line()
        .defined(d => d.Consumption != 0)
        .x(d => vis.xScale(d.Year))
        .y(d => vis.yScale(d.Consumption))
        (d[1]));

    // Update Piechart
    let data = Array.from(vis.groups.get(d.properties.name).values());
    let tooltipPie = tooltip
      .selectAll('.test')
      .data(d3.sum(data) == 0 ? pie(0) : pie(data))
      .join('path');
    tooltipPie
      .attr('transform', 'translate(25, 20)')
      .attr('class', 'test')
      .attr('fill', d => {
        return vis.indexColorScale(d.index);
      })
      .attr('d', arc)
      .attr('stroke', 'black')
      .attr('stroke-width', '1px');

    // Update Line Chart Title, Call Axes
    vis.tooltipTitle.text(`Energy Consumption of
      ${d.properties.name} between ${vis.years[0]} - ${vis.years[1]} `);
    vis.xAxisG.call(vis.xAxis);
    vis.yAxisG.call(vis.yAxis);
  }

  /* Handle Event MouseMove - Adjust Line Chart Tooltip Position */
  tooltipMove(event, d, vis) {
    d3.select('#mapchart-tooltip')
      .style('left', () => {
        if (event.pageX > 750)
          return event.pageX - vis.tooltipWidth - vis.config.tooltipPadding + 'px';
        return event.pageX + vis.config.tooltipPadding + 'px';
      })
      .style('top', () => {
        if (event.pageY > 500)
          return event.pageY - vis.tooltipHeight - vis.config.tooltipPadding + 'px';
        return event.pageY + vis.config.tooltipPadding + 'px';
      });
  }

  /* Handle Event MouseLeave - Hide Line Chart */
  tooltipHide(vis) {
    moveTimeSliderLayerUp();
    d3.select('#mapchart-tooltip').style('display', 'none');
  }

  /* Inspired by: https://www.simontimms.com/2014/07/17/d3-patterns/ */
  createFillPattern(d, type) {
    let vis = this;

    // remove spaces from the country's name so the return string works as a fill attribute
    const idName = `rectpattern_${d.replace(/ /g, '')}`;

    vis.pattern = vis.svg.append('pattern')
      .attr('id', idName)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', 10)
      .attr('height', 10)
      .attr('patternTransform', 'rotate(45)');

    vis.pattern.append('rect')
      .attr('height', 20)
      .attr('width', 5)
      .attr('fill', vis.colorScale(type))

    return `url(#${idName})`;
  }
}

/* Define function for generating pie chart areas */
const pie = d3.pie()
  .sort(null)
  .value(d => d);

/* Define function for setting pie chart arc radii */
const arc = d3.arc()
  .innerRadius(5)
  .outerRadius(16);

/* Define function for translating key into suitable string for class naming */
const classKey = c => c.indexOf(' ') >= 0 ? c.replace(/\s+/g, '') : c;