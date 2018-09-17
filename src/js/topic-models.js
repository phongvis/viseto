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
        itemSize = 30;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Model Metrics',
        modelTooltip = d => d.tooltip,
        modelParams = {
            'alpha': [0.01, 0.1, 1, 10],
            'beta': [0.01, 0.1, 1, 10],
            'num_topics': [5, 10, 15, 20]
        }, numLevels = 4,
        numParams = 3,
        paramList = ['alpha', 'beta', 'num_topics'];

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
        modelContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click');

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

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
        }

        // Updates that depend on both data and display change
        layoutModels();

        pv.enterUpdate(modelData, modelContainer, enterModels, updateModels, modelId, 'model');
    }

    function enterModels(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Pie, one for each param
        // const levelRadius = radius / numLevels;
        // const paramAngle = Math.PI * 2 / numParams;
        // container.each(function(d) {
        //     _.times(numParams, i => {
        //         const p = paramList[i],
        //             paramValueIdx = modelParams[p].indexOf(d[p]);

        //         const arc = d3.arc()
        //             .innerRadius(0)
        //             .outerRadius((paramValueIdx + 1) * levelRadius)
        //             .startAngle(paramAngle * i)
        //             .endAngle(paramAngle * (i + 1));
        //         d3.select(this).append('path')
        //             .attr('d', arc);
        //     });
        // });

        // Bar, one for each param
        const levelWidth = itemSize / numLevels;
        const paramHeight = itemSize / numParams;
        container.each(function(d) {
            _.times(numParams, i => {
                const p = paramList[i],
                    paramValueIdx = modelParams[p].indexOf(d[p]);

                d3.select(this).append('rect')
                    .attr('x', -itemSize / 2)
                    .attr('y', paramHeight * i - itemSize / 2)
                    .attr('width', (paramValueIdx + 1) * levelWidth)
                    .attr('height', paramHeight);
            });
        });
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
        const numItemsPerRow = Math.floor((width + itemGap) / (radius * 2 + itemGap));
        modelData.forEach((d, i) => {
            d.row = Math.floor(i / numItemsPerRow);
            d.col = i % numItemsPerRow;
            d.x = d.col * (radius * 2 + itemGap) + radius;
            d.y = d.row * (radius * 2 + itemGap) + radius;
        });
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        container.html(`
            <div class='title'>${visTitle}</div>
            `
        );
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
     * Binds custom events.
     */
    module.on = function() {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};