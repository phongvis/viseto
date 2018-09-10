/**
 * Side-by-side dot plots of models.
 * Data input:
 * - array of metrics, each has:
 *  - name
 *  - label
 * - array of models, each has:
 *  - modelId
 *  - metric values
 */
pv.vis.parallelMetrics = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 45, right: 10, bottom: 5, left: 10 };

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Evaluation Metrics',
        maxBarHeight,
        ranked = true; // Show metrics as ranks instead of absolute values

    /**
     * Accessors.
     */
    let modelId = d => d.modelId,
        metricId = d => d.name,
        metricLabel = d => d.label;

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
        metricContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click'),
        metricScale = d3.scaleBand().paddingInner(0.1);

    const jitterLookup = {}; // Random noise adding to models to avoid overplotting
    let query = {};

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-parallel-metrics');
                visContainer = container.append('g').attr('class', 'main-vis');
                metricContainer = visContainer.append('g').attr('class', 'metrics');

                metricData = _data.metrics;
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
        maxBarHeight = height - 20;

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        metricScale.range([0, width]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            metricScale.domain(d3.range(metricData.length));

            modelData.forEach(t => {
                metricData.forEach(f => {
                    jitterLookup[modelId(t) + '-' + metricId(f)] = Math.random();
                });
            });

            // Rank the metric values
            metricData.forEach(f => {
                const data = modelData.map(m => m[metricId(f)]),
                    sortedData = data.slice().sort(d3.ascending);
                modelData.forEach(t => {
                    const key = metricId(f) + '-rank';
                    t[key] = sortedData.indexOf(t[metricId(f)]);
                });
            });
        }

        // Updates that depend on both data and display change
        layoutMetrics();

        pv.enterUpdate(metricData, metricContainer, enterMetrics, updateMetrics, metricId, 'metric');
    }

    function enterMetrics(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Label
        container.append('text').attr('class', 'label')
            .text(metricLabel);

        // Axis and brush
        selection.each(function(d) {
            d.scale = d3.scaleLinear().domain(d3.extent(modelData.map(x => x[metricId(d)])));
            d.rankScale = d3.scaleLinear().domain(d3.extent(modelData.map(x => x[metricId(d) + '-rank'])));
            d.brush = d3.brushX().on('brush', onBrushed).on('end', onBrushed);
            d3.select(this).append('g').attr('class', 'axis x-axis')
                .attr('transform', 'translate(0, 5)');
            d3.select(this).append('g').attr('class', 'brush');
        });
    }

    function onBrushed(d) {
        const metric = metricId(d);
        if (d3.event.selection) {
            // If holding SHIFT, add the metric to the query. Otherwise, set the metric to the only one.
            if (!d3.event.sourceEvent.shiftKey) {
                query = {};

                // Also clear other metric brushes.
                metricContainer.selectAll('.brush').filter(d2 => d2 !== d).each(function(d2) {
                    d2.brush.move(d3.select(this), null);
                });
            }
            query[metric] = d3.event.selection.map(d.scale.invert);
        } else {
            delete query[metric];
        }

        // x needs to satisfy all querying conditions (AND)
        let brushedIds = [];
        if (_.size(query)) {
            const isBrushed = x => d3.entries(query).every(q => x[q.key] >= q.value[0] && x[q.key] <= q.value[1]);
            brushedIds = modelData.filter(isBrushed).map(modelId);
        }

        metricContainer.selectAll('.model').classed('brushed', d2 => brushedIds.includes(d2.id));
        metricContainer.selectAll('.model').filter(d2 => brushedIds.includes(d2.id)).raise();
    }

    function updateMetrics(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            // Label
            container.select('text')
                .attr('x', metricScale.bandwidth() / 2)
                .attr('y', -maxBarHeight - 23);

            // Axis
            const scale = ranked ? d.rankScale : d.scale;
            scale.rangeRound([0, metricScale.bandwidth()]).nice();
            container.select('.axis').call(d3.axisBottom(scale).ticks(5));

            // Brush
            d.brush.extent([[0, -maxBarHeight - 4], [metricScale.bandwidth(), 3]]);
            container.select('.brush').call(d.brush);

            // Model dots
            const data = modelData.map(x => ({ id: modelId(x), metric: metricId(d), value: x[metricId(d)], rank: x[metricId(d) + '-rank'] }));
            layoutModels(data, d);
            pv.enterUpdate(data, d3.select(this), enterModels, updateModels, modelId, 'model');
        });
    }

    function enterModels(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

        // Circle
        container.append('circle')
            .attr('r', 3);

        container.on('mouseover', function(d, i) {
            metricContainer.selectAll('.model').classed('hovered', d2 => d2.id === d.id);
            metricContainer.selectAll('.model').filter(d2 => d2.id === d.id).raise();
        }).on('mouseout', function() {
            metricContainer.selectAll('.model').classed('hovered', false);
        }).on('click', function(d) {
            listeners.call('click', this, modelData.find(t => modelId(t) === d.id));
        });
    }

    function updateModels(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.attr('transform', 'translate(' + d.x + ',' + d.y + ')');
        });
    }

    function layoutMetrics() {
        metricData.forEach((f, i) => {
            f.x = metricScale(i);
            f.y = maxBarHeight;
        });
    }

    function layoutModels(data, f) {
        data.forEach(d => {
            d.x = ranked ? f.rankScale(d.rank) : f.scale(d.value);
            d.y = -jitterLookup[d.id + '-' + metricId(f)] * maxBarHeight;
        });
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        // Title
        container.append('xhtml:div').attr('class', 'title').text(visTitle);
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