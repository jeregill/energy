# Energy

*Reference and source any external material here*

### Target Monitor Size
1920p x 1080p

### Data Links:

- Countries with Lat/Lon:
    - https://www.kaggle.com/eidanch/counties-geographic-coordinates?select=countries.csv
- Country Codes:
    - https://www.iso.org/obp/ui/#search
    - https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes
- Population:
    - https://data.worldbank.org/indicator/SP.POP.TOTL
     - https://www.worldometers.info/population
- Energy Data:
    - http://www.bp.com/statisticalreview

### Code/File Structure
Each of the charts are modularized into their own javascript file and class, and there
is a main class which reads in our data and instantiates our charts. 

For the respective charts, if needed, we have an accompanying CSS file for any style elements related
to the particular chart, as well as a global styles file for the webpage as a well. Each chart class follows
the enter-update-exit pattern via the 'join()' function and also follows the initVis(), updateVis(), and 
renderVis() class structure, with associated helper methods as needed. 

External scripts (d3, bootstrap, jQuery) are placed in the 'scripts' directory to keep the file structure neat.

All data and any pre-processing code are stored in the data directory.

#### <u>Map View</u>
The map view was created using Tutorial 5's symbol map as a starting point. To achieve the current view, we created 
color scales that mapped energy types to specific colours in our own defined colour scheme. Geographic location data 
(lot, lon) and TopoJSON data was sourced externally, and is used to appropriately draw the country outlines as well as
provide a fixed location for appending additional visual elements. We also included data processing steps to properly
group and aggregate data as it gets filtered from user interaction. These functions were included as part of the join
sequence for each element we wanted to add/append to the visualization. Additional pie charts are joined in using the
same techniques used in tutorials and the programming assignments, in addition to the d3.pie() function.

#### <u> Force-Directed Circle Graph </u>
This view was created using the template from the d3-graph-gallery for their examples of Chord implementations, and 
also used the template provided in tutorial 6 for the Force Directed Graph implementation.

This view ingests two data sources, one is the data that all three views use and the other is a JSON file that contains
the nodes that will be used in the force directed graph. The links and their weightings for the nodes are dynamically 
generated.

Data processing also occurs, such as getting overall consumption of countries, getting overall consumption by energy 
type, and getting countries percentages of each energy type used.

#### <u> Bar Chart </u>
1) Base Implementation of Bar Chart: This was fairly straightforward, as we had considerable practice making bar charts from
the assignments and tutorials. The challenging parts were mainly with styling, and having the country abbreviations conditionally 
appear based on the number of items visible.

2) Adding Radio Buttons and Sorting: The buttons themselves were styled via Bootstrap, and so we mainly had to implement
   the event listeners. This involved adding some extra configuration properties to the barchart itself to reflect
   the number of items that should be displayed as well as what direction to sort the items.

#### <u> Time Slider/Data Filter </u>
This was fairly easy to implement, as it only involved performing a simple filter on the data and we were able to
use a jQuery plugin (noUI slider) to create the actual element in the DOM. Thanks to the use of 'join()' and 
the enter-update-exit pattern, this was very easy to integrate to the visualization.


### External Sources
#### Map Chart
  - https://github.com/UBC-InfoVis/2021-436V-tutorials/tree/master/5_D3_tutorial#mapping-geo-data
  - https://codesandbox.io/s/github/UBC-InfoVis/2021-436V-examples/tree/master/d3-symbol-map
  - https://codesandbox.io/s/github/UBC-InfoVis/2021-436V-examples/tree/master/d3-choropleth-map

Used tutorials as a guide, but substantial changes were made to create our map projection.

#### Bar Chart
  - Past Programming Assignments

P0 and P2 were used to help implement this visualization, but again, major changes to adapt to our visualization. Bootstrap documentation used to create the radio buttons and sorting buttons.

#### Animations/Transitions
  - https://github.com/UBC-InfoVis/2021-436V-tutorials/tree/master/3_D3_Tutorial
  - http://bl.ocks.org/nadinesk/99393098950665c471e035ac517c2224
Used as a guide to implement tooltips and animations (second link for pie chart animation transition)

#### Time Slider
  - https://refreshless.com/nouislider/

Used to help implement the time slider. Major chunks of code copied from their templates.

#### Force-Directed Circle Graph
  - https://observablehq.com/@d3/force-directed-graph
  - https://codesandbox.io/s/github/UBC-InfoVis/2021-436V-examples/tree/master/d3-force-directed-graph?file=/js/forceDirectedGraph.js
  - https://github.com/UBC-InfoVis/2021-436V-tutorials/tree/master/6_D3_tutorial#11-force-directed-graph-layout
  - https://github.com/Ethan-Tam/actor-adaptability/blob/master/js/classes/network.js#L265-L271
  - https://www.d3-graph-gallery.com/graph/chord_basic.html

Used to help implement the force-directed circle graph. The circular part of the graph was heavily influenced and took design cue elements from the D3 chord chart. The force-directed part of the graph, which was contained within the circle took cues from Tutorial 6, and examples that were on Observable HQ.

#### Autocomplete Search Bar
  - https://www.w3schools.com/howto/howto_js_autocomplete.asp

Copied most of the code from this source for the country search bar.

