/**
 * Visualisation of topic models using evaluation metrics and model parameters.
 * Data input:
 * - array of metrics, each has:
 *  - name
 *  - label
 * - array of models, each has:
 *  - modelId
 *  - metric values
 */
pv.vis.topicModels = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 25, right: 5, bottom: 5, left: 5 },
        radius = 16,
        itemGap = 3,
        itemSize = 30,
        axisOffsetX = 25,
        axisOffsetY = 15;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Model Metrics',
        sort = 'rank', // rank
        layout = 'two', // one/two
        modelTooltip = d => d.tooltip,
        modelParams = {
            'alpha': [0.01, 0.1, 1, 10],
            'beta': [0.01, 0.1, 1, 10],
            'num_topics': [5, 10, 15, 20]
        }, numLevels = 4,
        numParams = 3,
        paramList = ['alpha', 'beta', 'num_topics'],
        axisMappings = ['dim 1', 'dim 2', 'mean rank', 'best rank'],
        mappingAccessors = [
            d => d.coords[0],
            d => d.coords[1],
            d => d.meanRank,
            d => d.bestRank
        ], xAxisMappingIdx = 0,
        yAxisMappingIdx = 1;

    /**
     * Accessors.
     */
    let modelId = d => d.modelId;

    /**
     * Data binding to DOM elements.
     */
    let modelData,
        metricData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        modelContainer,
        xAxisContainer,
        yAxisContainer,
        xAxisLabel,
        yAxisLabel;

    /**
     * D3.
     */
    const xScale = d3.scaleLinear(),
        yScale = d3.scaleLinear(),
        xAxis = d3.axisBottom(xScale),
        yAxis = d3.axisLeft(yScale),
        listeners = d3.dispatch('click');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-topic-models');
                visContainer = container.append('g').attr('class', 'main-vis');
                modelContainer = visContainer.append('g').attr('class', 'models');

                modelData = _data.models;

                addAxes();
                addSettings(container);

                this.visInitialized = true;
            }

            update();
        });

        dataChanged = false;
    }

    /**
     * Updates the visualization when data or display attributes changes.
     */
    function update() {
        // Canvas update
        width = visWidth - margin.left - margin.right;
        height = visHeight - margin.top - margin.bottom;
        xScale.range([axisOffsetX, width - axisOffsetX]);
        yScale.range([height - axisOffsetY, 5]);

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        xAxisContainer.attr('transform', 'translate(0,' + (height - axisOffsetY) + ')');
        yAxisContainer.attr('transform', 'translate(' + axisOffsetX + ',0)');

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            xScale.domain(d3.extent(modelData, mappingAccessors[xAxisMappingIdx])).nice();
            yScale.domain(d3.extent(modelData, mappingAccessors[yAxisMappingIdx])).nice();
        }

        xAxisContainer.classed('hidden', layout === 'one').call(xAxis);
        yAxisContainer.classed('hidden', layout === 'one').call(yAxis);
        xAxisLabel.attr('transform', 'translate(' + width + ',-3)');
        yAxisLabel.attr('transform', 'translate(0,-3) rotate(-90)');

        // Updates that depend on both data and display change
        layoutModels();

        pv.enterUpdate(modelData, modelContainer, enterModels, updateModels, modelId, 'model');
    }

    function enterModels(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Pie, one for each param
        const levelRadius = radius / numLevels;
        const paramAngle = Math.PI * 2 / numParams;
        container.each(function(d) {
            _.times(numParams, i => {
                const p = paramList[i],
                    paramValueIdx = modelParams[p].indexOf(d[p]);

                const arc = d3.arc()
                    .innerRadius(0)
                    .outerRadius((paramValueIdx + 1) * levelRadius)
                    .startAngle(paramAngle * i)
                    .endAngle(paramAngle * (i + 1));
                d3.select(this).append('path')
                    .attr('d', arc);
            });
        });

        // Bar, one for each param
        // const levelWidth = itemSize / numLevels;
        // const paramHeight = itemSize / numParams;
        // container.each(function(d) {
        //     _.times(numParams, i => {
        //         const p = paramList[i],
        //             paramValueIdx = modelParams[p].indexOf(d[p]);

        //         d3.select(this).append('rect')
        //             .attr('x', -itemSize / 2)
        //             .attr('y', paramHeight * i - itemSize / 2)
        //             .attr('width', (paramValueIdx + 1) * levelWidth)
        //             .attr('height', paramHeight);
        //     });
        // });
    }

    function updateModels(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);
        });
    }

    function layoutModels() {
        if (layout === 'one') {
            const numItemsPerRow = Math.floor((width + itemGap) / (radius * 2 + itemGap));
            const data = rankSort(modelData);

            data.forEach((d, i) => {
                d.row = Math.floor(i / numItemsPerRow);
                d.col = i % numItemsPerRow;
                d.x = d.col * (radius * 2 + itemGap) + radius;
                d.y = d.row * (radius * 2 + itemGap) + radius;
            });
        } else if (layout === 'two') {
            modelData.forEach(d => {
                d.x = xScale(mappingAccessors[xAxisMappingIdx](d));
                d.y = yScale(mappingAccessors[yAxisMappingIdx](d));
            });
        }
    }

    function rankSort(data) {
        return data.slice().sort((a, b) => d3.ascending(a.avgRank, b.avgRank));
    }

    function addAxes() {
        xAxisContainer = visContainer.append('g').attr('class', 'axis x');
        xAxisLabel = xAxisContainer.append('text').attr('class', 'label-button x')
            .text(axisMappings[xAxisMappingIdx])
            .on('click', function() {
                xAxisMappingIdx = (xAxisMappingIdx + 1) % axisMappings.length;
                d3.select(this).text(axisMappings[xAxisMappingIdx]);
                dataChanged = true;
                update();
            });

        yAxisContainer = visContainer.append('g').attr('class', 'axis y');
        yAxisLabel = yAxisContainer.append('text').attr('class', 'label-button y')
            .text(axisMappings[yAxisMappingIdx])
            .on('click', function() {
                yAxisMappingIdx = (yAxisMappingIdx + 1) % axisMappings.length;
                d3.select(this).text(axisMappings[yAxisMappingIdx]);
                dataChanged = true;
                update();
            });
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        container.html(`
            <div class='title'>${visTitle}</div>
            <div class='setting layout'>
                Layout
                <label>
                    <input type='radio' value='one' name='layout'> 1d
                </label>
                <label>
                    <input type='radio' value='two' name='layout'> 2d
                </label>
            </div>
            `
        );

        container.select('input[value=' + layout + ']').node().checked = true;
        container.selectAll('input[name=layout]').on('change', function () {
            layout = this.value;
            update();
        });
    }

    /**
     * Sets/gets the width of the visualization.
     */
    module.width = function(value) {
        if (!arguments.length) return visWidth;
        visWidth = value;
        return this;
    };

    /**
     * Sets/gets the height of the visualization.
     */
    module.height = function(value) {
        if (!arguments.length) return visHeight;
        visHeight = value;
        return this;
    };

    /**
     * Sets the flag indicating data input has been changed.
     */
    module.invalidate = function() {
        dataChanged = true;
    };

    /**
     * Handles items that are brushed externally.
     */
    module.handleBrush = function(ids) {
        modelContainer.selectAll('.model').classed('ext-brushed', d => ids.includes(modelId(d)));
    };

    /**
     * Binds custom events.
     */
    module.on = function() {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};