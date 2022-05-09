// Entry point for the build script in your package.json
import "@hotwired/turbo-rails"
import "./src/jquery"
import * as bootstrap from "bootstrap"
import "jquery-ujs"

function PieChart(data, {
    name = ([x]) => x,  // given d in data, returns the (ordinal) label
    value = ([, y]) => y, // given d in data, returns the (quantitative) value
    title, // given d in data, returns the title text
    width = 640, // outer width, in pixels
    height = 400, // outer height, in pixels
    innerRadius = 0, // inner radius of pie, in pixels (non-zero for donut)
    outerRadius = Math.min(width, height) / 2, // outer radius of pie, in pixels
    labelRadius = (innerRadius * 0.2 + outerRadius * 0.8), // center radius of labels
    format = ",", // a format specifier for values (in the label)
    names, // array of names (the domain of the color scale)
    colors, // array of colors for names
    stroke = innerRadius > 0 ? "none" : "white", // stroke separating widths
    strokeWidth = 1, // width of stroke separating wedges
    strokeLinejoin = "round", // line join of stroke separating wedges
    padAngle = stroke === "none" ? 1 / outerRadius : 0, // angular separation between wedges
  } = {}) {
    // Compute values.
    const N = d3.map(data, name);
    const V = d3.map(data, value);
    const I = d3.range(N.length).filter(i => !isNaN(V[i]));
  
    // Unique the names.
    if (names === undefined) names = N;
    names = new d3.InternSet(names);
  
    // Chose a default color scheme based on cardinality.
    if (colors == undefined && names.size == 1) colors = ["steelblue"]
    if (colors === undefined) colors = d3.schemeSpectral[names.size];
    if (colors === undefined) colors = d3.quantize(t => d3.interpolateSpectral(t * 0.8 + 0.1), names.size);
  
    // Construct scales.
    const color = d3.scaleOrdinal(names, colors);
  
    // Compute titles.
    if (title === undefined) {
      const formatValue = d3.format(format);
      title = i => `${N[i]}\n${formatValue(V[i])}`;
    } else {
      const O = d3.map(data, d => d);
      const T = title;
      title = i => T(O[i], i, data);
    }
  
    // Construct arcs.
    const arcs = d3.pie().padAngle(padAngle).sort(null).value(i => V[i])(I);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(outerRadius);
    const arcLabel = d3.arc().innerRadius(labelRadius).outerRadius(labelRadius);
    
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;");
  
    svg.append("g")
        .attr("stroke", stroke)
        .attr("stroke-width", strokeWidth)
        .attr("stroke-linejoin", strokeLinejoin)
      .selectAll("path")
      .data(arcs)
      .join("path")
        .attr("fill", d => color(N[d.data]))
        .attr("d", arc)
      .append("title")
        .text(d => title(d.data));
  
    svg.append("g")
        .attr("font-family", "sans-serif")
        .attr("font-size", 10)
        .attr("text-anchor", "middle")
      .selectAll("text")
      .data(arcs)
      .join("text")
        .attr("transform", d => `translate(${arcLabel.centroid(d)})`)
      .selectAll("tspan")
      .data(d => {
        const lines = `${title(d.data)}`.split(/\n/);
        return (d.endAngle - d.startAngle) > 0.25 ? lines : lines.slice(0, 1);
      })
      .join("tspan")
        .attr("x", 0)
        .attr("y", (_, i) => `${i * 1.1}em`)
        .attr("font-weight", (_, i) => i ? null : "bold")
        .text(d => d);
  
    return Object.assign(svg.node(), {scales: {color}});
}

function BeeswarmChart(data, {
    value = d => d, // convience alias for x
    label, // convenience alias for xLabel
    domain, // convenience alias for xDomain
    x = value, // given d in data, returns the quantitative x value
    title = null, // given d in data, returns the title
    radius = 3, // (fixed) radius of the circles
    padding = 1.5, // (fixed) padding between the circles
    marginTop = 10, // top margin, in pixels
    marginRight = 20, // right margin, in pixels
    marginBottom = 30, // bottom margin, in pixels
    marginLeft = 20, // left margin, in pixels
    width = 640, // outer width, in pixels
    height, // outer height, in pixels
    xLabel = label, // a label for the x-axis
    xDomain = domain, // [xmin, xmax]
    xRange = [marginLeft, width - marginRight] // [left, right]
  } = {}) {
    // Compute values.
    const X = d3.map(data, x);
    const T = title == null ? null : d3.map(data, title);
    
    // Compute which data points are considered defined.
    const I = d3.range(X.length).filter(i => !isNaN(X[i]));
  
    // Compute default domains.
    if (xDomain === undefined) xDomain = d3.extent(X);
  
    // Construct scales and axes.
    const xScale = d3.scaleLinear(xDomain, xRange);
    const xAxis = d3.axisBottom(xScale).tickSizeOuter(0)
                  .tickValues(d3.range(xScale.domain()[0], xScale.domain()[1] + 1, 1));
  
    // Compute the y-positions.
    const Y = dodge(I.map(i => xScale(X[i])), radius * 2 + padding);
  
    // Compute the default height;
    if (height === undefined) height = (d3.max(Y, Math.abs) + radius + padding) * 2 + marginTop + marginBottom;
  
    // Given an array of x-values and a separation radius, returns an array of y-values.
    function dodge(X, radius) {
      const Y = new Float64Array(X.length);
      const radius2 = radius ** 2;
      const epsilon = 1e-3;
      let head = null, tail = null;
    
      // Returns true if circle ⟨x,y⟩ intersects with any circle in the queue.
      function intersects(x, y) {
        let a = head;
        while (a) {
          const ai = a.index;
          if (radius2 - epsilon > (X[ai] - x) ** 2 + (Y[ai] - y) ** 2) return true;
          a = a.next;
        }
        return false;
      }
    
      // Place each circle sequentially.
      for (const bi of d3.range(X.length).sort((i, j) => X[i] - X[j])) {
    
        // Remove circles from the queue that can’t intersect the new circle b.
        while (head && X[head.index] < X[bi] - radius2) head = head.next;
    
        // Choose the minimum non-intersecting tangent.
        if (intersects(X[bi], Y[bi] = 0)) {
          let a = head;
          Y[bi] = Infinity;
          do {
            const ai = a.index;
            let y1 = Y[ai] + Math.sqrt(radius2 - (X[ai] - X[bi]) ** 2);
            let y2 = Y[ai] - Math.sqrt(radius2 - (X[ai] - X[bi]) ** 2);
            if (Math.abs(y1) < Math.abs(Y[bi]) && !intersects(X[bi], y1)) Y[bi] = y1;
            if (Math.abs(y2) < Math.abs(Y[bi]) && !intersects(X[bi], y2)) Y[bi] = y2;
            a = a.next;
          } while (a);
        }
    
        // Add b to the queue.
        const b = {index: bi, next: null};
        if (head === null) head = tail = b;
        else tail = tail.next = b;
      }
    
      return Y;
    }
  
    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [0, 0, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;");
  
    svg.append("g")
        .attr("transform", `translate(0,${height - marginBottom})`)
        .call(xAxis)
        .call(g => g.append("text")
            .attr("x", width)
            .attr("y", marginBottom - 4)
            .attr("fill", "currentColor")
            .attr("text-anchor", "end")
            .text(xLabel));
  
    const dot = svg.append("g")
      .selectAll("circle")
      .data(I)
      .join("circle")
        .attr("cx", i => xScale(X[i]))
        .attr("cy", i => (marginTop + height - marginBottom) / 2 + Y[i])
        .attr("r", radius);
  
    if (T) dot.append("title")
        .text(i => T[i]);
  
    return svg.node();
}

function load_graphs() {

    $(".poll_question_results").each(function (index) {
  
      let data_api = $(this).attr("data-path");
  
      let params = {
        graph_index: index,
        graph_type: $(this).attr("data-graph-type")
      }
  
      $.getJSON(data_api, params, function (data) {
  
        let domain = ""
        $(".poll_question_results").eq(params.graph_index).children('svg, table, .card-text').remove();
  
        if(data["vote_count"] == 0) {
          $(".poll_question_results").eq(params.graph_index).prepend('<p class="card-text">No responses</p>');
        }
        else{
        
        switch(params.graph_type) {
  
          case "Pie chart":
  
            data = data["data"]
            $(".poll_question_results").eq(params.graph_index).prepend(PieChart(data,{
              name: d => d.label,
              value: d => d.value,
              width: 640, 
              height: 300
            }));
  
            break;
  
          case "Bar graph":
  
            data = data["data"]
            $(".poll_question_results").eq(params.graph_index).prepend(BarChart(data,{
              x: d => d.label,
              y: d => d.value,
              width: 640, 
              height: 300,
              yFormat: 'r',
              color: 'steelblue',
              yLabel: 'votes'
            }));
  
            break;
          
          case "Horizontal bar graph":
  
            data = data["data"]
            $(".poll_question_results").eq(params.graph_index).prepend(HorizontalBarChart(data,{
              x: d => d.value,
              y: d => d.label,
              width: 640, 
              height: 300,
              yFormat: 'r',
              color: 'steelblue',
              yLabel: 'votes'
            }));
  
            break;
  
          case "Table":
            
            data = data["data"]
            $(".poll_question_results").eq(params.graph_index).prepend(`<table class="table table-striped">
                                                              <thead>
                                                                <tr>
                                                                  <th scope="col">#</th>
                                                                  <th scope="col">Response</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody id="graph_` + params.graph_index + `">
                                                            </tbody>
                                                            </table>`)
    
            let table_row = "";
            for(let i=0; i < data.length; i++) {
              table_row = `<tr>
                            <th scope="row">`+ i +`</th>
                            <td>`+data[i]+`</td>
                          </tr>`
    
              let table_id = "#graph_" + params.graph_index
              $(table_id).append(table_row);
            }
            break;
          
          case "Yes no beeswarm graph":
  
            domain = data["domain"]
            data = data["data"]
            $(".poll_question_results").eq(params.graph_index).prepend(BeeswarmChart(data,{
              x: d => d.value,
              label: "position",
              domain: domain,
              width: 640, 
              height: 300,
              title: d => d.label
            }));
  
            break;
  
          case "Yes no bar graph":
  
            domain = data["domain"]
            data = data["data"]
            $(".poll_question_results").eq(params.graph_index).prepend(BarChart(data,{
              x: d => d.label,
              y: d => d.value,
              width: 640, 
              height: 300,
              yFormat: 'r',
              color: 'steelblue',
              yLabel: 'Number of users',
              yTickSize: 1
            }));
  
            break;
  
          default:
            console.log("Chart not supported")
        }
      }
      });
    });
}

$(document).on('turbo:load', function() {
    console.log("hello");
    load_graphs();
});