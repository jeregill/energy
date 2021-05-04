/*
global values
 */

let data, geoData;
let forceGraph;
let allData, filteredData;
let mapChart, barChart, chordChart;
let minYear, maxYear;
let countryFilter = [];
let typeFilter = [];
let animationPlaying = false;
const dispatcher = d3.dispatch('selectCountry', 'selectType');
let countryCodeToNameMap = new Map();
let countryNameToCodeMap = new Map();
const MIN_YEAR = 1965;
const MAX_YEAR = 2019;


const colorArr = [
    ['Oil', '#a6cee3'],
    ['Gas', '#1f78b4'],
    ['Coal', '#b2df8a'],
    ['Nuclear', '#33a02c'],
    ['Hydro', '#fb9a99'],
    ['Renewables', '#e31a1c'],
    ['Solar', '#fdbf6f'],
    ['Wind', '#ff7f00'],
    ['Geo', '#cab2d6']
]

Promise.all([
    d3.csv('data/energyData_merged.csv'),
    d3.json('data/world-110m_edited.json'),
    d3.json('data/forceGraph.json')
]).then(_data => {
    // Convert year, consumption, and emissions to numerical values
    _data[0].forEach(d => {
        Object.keys(d).forEach(attr => {
            let categorical_atts = ['Country', 'Type', 'Country_ID', 'Country_Code'];
            if (!categorical_atts.includes(attr)) {
                d[attr] = (d[attr] == 'NA') ? null : +d[attr];
            }
        });
    });

    allData = _data[0];
    filteredData = allData;
    geoData = _data[1];
    forceGraph = _data[2];

    for (let d of allData) {
        countryCodeToNameMap.set(d.Country_Code, d.Country);
        countryNameToCodeMap.set(d.Country, d.Country_Code);
    }

    // instantiate each of the charts
    mapChart = new MapChart({
        parentElement: '#mapchart',
    }, allData, geoData);

    chordChart = new ChordChart({
        parentElement: '#chordchart',
        colorMap: new Map(colorArr)
    }, allData, forceGraph)

    barChart = new BarChart({
        parentElement: '#barchart'
    }, allData)



    let countryList = d3.groups(allData, d => d.Country).map(d => d[0]);
    /*initiate the autocomplete function on the "myInput" element, and pass along the countries array as possible autocomplete values:*/
    autocomplete(document.getElementById('myInput'), countryList);
});

/* Time Slider */
let timeSlider = document.getElementById('time-slider');
noUiSlider.create(timeSlider, {
    start: [1965, 2019],
    animate: false,
    margin: 1, // ensure a minimum 1 year range 
    step: 1,
    padding: [0, 0],
    format: {
        // 'to' the formatted value. Receives a number.
        to: function (value) {
            return Math.floor(value);
        },
        // 'from' the formatted value.
        // Receives a string, should return a number.
        from: function (value) {
            return Math.floor(value);
        }
    },
    connect: [false, true, false],
    tooltips: [true, true],
    range: {
        'min': MIN_YEAR,
        'max': MAX_YEAR
    }
});

/** 
 * Update time slider values when changed
 */
timeSlider.noUiSlider.on('update', (values) => {
    minYear = values[0];
    maxYear = values[1];
});

/** 
 * Filter data using the global time slider; update all views accordingly
 */
function refreshValues() {
    filteredData = allData.filter(d => {
        return d['Year'] >= minYear && d['Year'] <= maxYear;
    });
    removeAllFilters();
    mapChart.data = filteredData;
    mapChart.updateVis();
    chordChart.data = filteredData;
    chordChart.updateVis();
    barChart.data = filteredData;
    barChart.globalFilterCalled();
}


/* play button to go through each year and update the map */
async function clickPlay() {
    animationPlaying = true;
    removeAllFilters();
    disableGlobalDataFilter();
    disableBarChartButtons();
    timeSlider.noUiSlider.updateOptions({
        tooltips: [false, true],
        margin:0,
    });
    for (let i = MIN_YEAR; i <= MAX_YEAR; i++) {
        await sleep(moveToggle, i);
        playButtonFilter(i);
    }
    playButtonDone();
}

/* move the toggle one year at a time */
async function moveToggle(i) {
    timeSlider.noUiSlider.set([i, i]);
}

/* filter the data as we move through the years */
function playButtonFilter(i) {
    filteredData = allData.filter(d => {
        return d['Year'] === i;
    });
    mapChart.data = filteredData;
    mapChart.updateVis();
}

/* reset filters when play button is done */
function playButtonDone() {
    minYear = MIN_YEAR;
    maxYear = MAX_YEAR;
    timeSlider.noUiSlider.set([minYear, maxYear]);
    refreshValues();
    animationPlaying = false;
    enableGlobalDataFilter();
    enableBarChartButtons();
    timeSlider.noUiSlider.updateOptions({
        tooltips: [true, true],
        margin: 1
    });
}

/* 
 * click on radio buttons to filter number of buttons in the barchart
 */
function barchartRadioClick(event) {
    barChart.radioFilter(event.target.value);
}

/** 
 * Handle linking between the three charts based on country selection
 */
dispatcher.on('selectCountry', selectedCountry => {
    const isActive = countryFilter.includes(selectedCountry);
    // if the country does not have data clicking does nothing
    if (!doesCountryExist(selectedCountry)) return;
    if (isActive) {
        countryFilter = countryFilter.filter(f => f !== selectedCountry);
        chordChart.highlightActiveCountry(selectedCountry);
        mapChart.highlightActiveCountry(selectedCountry);
        barChart.highlightActiveCountry(selectedCountry);
    } else {
        const oldCountry = countryFilter.pop();
        countryFilter.push(selectedCountry);
        chordChart.highlightNotActiveCountry(selectedCountry, oldCountry);
        mapChart.highlightNotActiveCountry(selectedCountry, oldCountry);
        barChart.highlightNotActiveCountry(selectedCountry, oldCountry);
    }
})

/** 
 * Handle selection of type of energy in chordchart
 */
dispatcher.on('selectType', selectedTypeIndex => {
    const isActive = typeFilter.includes(selectedTypeIndex);
    if (isActive) {
        typeFilter = typeFilter.filter(f => f !== selectedTypeIndex);
        chordChart.highlightActiveType(selectedTypeIndex);
    } else {
        typeFilter.pop();
        typeFilter.push(selectedTypeIndex);
        chordChart.highlightNotActiveType(selectedTypeIndex);
    }
})

/** 
 * Remove all filters (reset vis):
 */
function removeAllFilters() {
    removeCountryFilter();
    removeTypeFilter();
}

/** 
 * Remove the selected country and update visualizations:
 */
function removeCountryFilter() {
    if (countryFilter.length !== 0) {
        const selectedCountry = countryFilter[0];
        countryFilter = countryFilter.filter(f => f !== selectedCountry);
        chordChart.highlightActiveCountry(selectedCountry);
        mapChart.highlightActiveCountry(selectedCountry);
        barChart.highlightActiveCountry(selectedCountry);
    }
}

/** 
 * Remove type filters (energy types)
 */
function removeTypeFilter() {
    if (typeFilter.length !== 0) {
        const selectedTypeIndex = typeFilter[0];
        typeFilter = typeFilter.filter(f => f !== selectedTypeIndex);
        chordChart.highlightActiveType(selectedTypeIndex)
    }
}

/* check if data for the given country exists and their total consumption is greater than 0 */
function doesCountryExist(selectedCountry) {
    return filteredData.find(d => {
        return d['Country_Code'] === selectedCountry && d['Consumption'] > 0;
    });
}