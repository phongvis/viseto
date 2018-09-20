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
    const margin = { top: 45, right: 10, bottom: 5, left: 10 },
        shapeSize = Math.PI * 4 * 4;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Parallel Metrics',
        modelTooltip = d => d.tooltip,
        maxBarHeight,
        ranked = true, // Show metrics as ranks instead of absolute values
        yAxisParams = ['jitter', 'beeswarm', 'alpha', 'beta', 'num_topics'],
        yAxisMapping = 'alpha',
        colorParams = ['none', 'mean rank', 'best rank', 'alpha', 'beta', 'num_topics'],
        colorMapping = 'beta',
        shapeParams = ['none', 'alpha', 'beta', 'num_topics'],
        shapeMapping = 'num_topics',
        modelParams = {
            'alpha': [0.01, 0.1, 1, 10],
            'beta': [0.01, 0.1, 1, 10],
            'num_topics': [5, 10, 15, 20]
        };

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
    const metricScale = d3.scaleBand().paddingInner(0.15),
        yScale = d3.scalePoint(),
        colorScale = d3.scaleOrdinal().range(['#fdbe85','#fd8d3c','#e6550d','#a63603']),
        shapeScale = d3.scaleOrdinal().range([d3.symbolTriangle, d3.symbolDiamond, d3.symbolStar, d3.symbolCircle]),
        greyScale = d3.interpolateGreys,
        rankScale = d3.scaleLinear(),
        listeners = d3.dispatch('click', 'hover', 'brush');

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
            rankScale.domain([modelData.length, 1]);

            modelData.forEach(d => {
                metricData.forEach(t => {
                    jitterLookup[modelId(d) + '-' + metricId(t)] = Math.random();
                });
            });
        }

        // Encodings
        if (modelParams[yAxisMapping]) {
            yScale.domain(modelParams[yAxisMapping])
                .range([0, -maxBarHeight]);
        }

        if (modelParams[colorMapping]) {
            colorScale.domain(modelParams[colorMapping]);
        }

        if (modelParams[shapeMapping]) {
            shapeScale.domain(modelParams[shapeMapping]);
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
        const metric = metricId(d) + (ranked ? '-rank' : '');
        if (d3.event.selection) {
            // If holding SHIFT, add the metric to the query. Otherwise, set the metric to the only one.
            if (!d3.event.sourceEvent.shiftKey) {
                query = {};

                // Also clear other metric brushes.
                metricContainer.selectAll('.brush').filter(d2 => d2 !== d).each(function(d2) {
                    d2.brush.move(d3.select(this), null);
                });
            }
            query[metric] = d3.event.selection.map(getScale(d).invert);
        } else {
            delete query[metric];
        }

        // x needs to satisfy all querying conditions (AND)
        let brushedIds = [];
        metricContainer.selectAll('.model').classed('non-brushed', false);
        if (_.size(query)) {
            const isBrushed = x => d3.entries(query).every(q => x[q.key] >= q.value[0] && x[q.key] <= q.value[1]);
            brushedIds = modelData.filter(isBrushed).map(modelId);
            metricContainer.selectAll('.model').classed('non-brushed', d2 => !brushedIds.includes(d2.id));
        }

        metricContainer.selectAll('.model').classed('brushed', d2 => brushedIds.includes(d2.id));
        metricContainer.selectAll('.model').filter(d2 => brushedIds.includes(d2.id)).raise();

        // Broadcast
        listeners.call('brush', module, brushedIds);
    }

    function getScale(d) {
        return ranked ? d.rankScale : d.scale;
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
            getScale(d).rangeRound([0, metricScale.bandwidth()]).nice();
            container.select('.axis').call(d3.axisBottom(getScale(d)).ticks(5));

            // Brush
            d.brush.extent([[0, -maxBarHeight - 4], [metricScale.bandwidth(), 3]]);
            container.select('.brush').call(d.brush);

            // Model dots
            const data = modelData.map(x => ({
                id: modelId(x),
                tooltip: modelTooltip(x),
                metric: metricId(d),
                value: x[metricId(d)],
                rank: x[metricId(d) + '-rank'],
                meanRank: x.meanRank,
                bestRank: x.bestRank,
                alpha: x.alpha,
                beta: x.beta,
                num_topics: x.num_topics
            }));

            // Sort increasingly so that higher values will place on top of lower values
            data.sort((a, b) => d3.ascending(a.value, b.value));

            layoutModels(data, d);

            pv.enterUpdate(data, d3.select(this), enterModels, updateModels, d => d.id, 'model');
        });
    }

    function enterModels(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

        // Glyph
        container.append('path');
        container.append('title')
            .text(modelTooltip);

        container.on('mouseover', function(d, i) {
            metricContainer.selectAll('.model').classed('hovered', d2 => d2.id === d.id);
            metricContainer.selectAll('.model').filter(d2 => d2.id === d.id).raise();
            listeners.call('hover', module, d.id);
        }).on('mouseout', function() {
            metricContainer.selectAll('.model').classed('hovered', false);
            listeners.call('hover', module, null);
        }).on('click', function(d) {
        });
    }

    function updateModels(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')');

            container.select('path')
                .style('fill', fillFunction)
                .attr('d', d3.symbol().size(shapeSize).type(shapeScale(d[shapeMapping])));
        });
    }

    function fillFunction(d) {
        if (colorMapping === 'none') return 'hsl(0, 0%, 70%)';
        if (colorMapping === 'mean rank') return greyScale(rankScale(d.meanRank));
        if (colorMapping === 'best rank') return greyScale(rankScale(d.bestRank));

        return colorScale(d[colorMapping]);
    }

    function layoutMetrics() {
        metricData.forEach((t, i) => {
            t.x = metricScale(i);
            t.y = maxBarHeight;
        });
    }

    function layoutModels(data, t) {
        if (yAxisMapping === 'beeswarm') {
            const swarm = d3.beeswarm()
                .data(data)
                .distributeOn(d => ranked ? t.rankScale(d.rank) : t.scale(d.value))
                .radius(Math.sqrt(shapeSize / Math.PI) + 0.5)
                .orientation('horizontal')
                .side('symetric')
                .arrange();
            // Shift y-coordinate so that the lowest one is at the bottom
            const offset = (d3.max(swarm, d => d.y) - d3.min(swarm, d => d.y)) / 2;
            data.forEach((d, i) => {
                d.x = swarm[i].x;
                d.y = swarm[i].y - offset;
            });
        } else {
            data.forEach(d => {
                d.x = ranked ? t.rankScale(d.rank) : t.scale(d.value);
                if (yAxisMapping === 'jitter') {
                    d.y = -jitterLookup[d.id + '-' + metricId(t)] * maxBarHeight;
                } else {
                    d.y = yScale(d[yAxisMapping]);
                }
            });
        }
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        container.html(`
            <div class='title'>${visTitle}</div>
            <div class='setting shape'>
                Shape
                <select>
                </select>
            </div>
            <div class='setting color'>
                Color
                <select>
                </select>
            </div>
            <div class='setting y-axis'>
                Y-axis
                <select>
                </select>
            </div>
            <div class='setting x-axis'>
                X-axis
                <label>
                    <input type='radio' value='score' name='x-axis'> Score
                </label>
                <label>
                    <input type='radio' value='rank' name='x-axis'> Rank
                </label>
            </div>
            `
        );

        // X-axis
        container.select('input[value=' + (ranked ? 'rank' : 'score') + ']').node().checked = true;
        container.selectAll('input[name=x-axis]').on('change', function () {
            ranked = this.value === 'rank';
            update();
        });

        // Y-axis, Color, Shape
        pv.addSelectOptions(container, '.y-axis select', yAxisParams, yAxisMapping, value => { yAxisMapping = value; update(); });
        pv.addSelectOptions(container, '.color select', colorParams, colorMapping, value => { colorMapping = value; update(); });
        pv.addSelectOptions(container, '.shape select', shapeParams, shapeMapping, value => { shapeMapping = value; update(); });
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
     * Handle an item that is hovered externally.
     */
    module.handleHover = function(id) {
        metricContainer.selectAll('.model').classed('hovered', d => d.id === id);
        metricContainer.selectAll('.model').filter(d => d.id === id).raise();
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