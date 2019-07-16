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
pv.vis.parallelMetrics = function () {
    /**
     * Visual configs.
     */
    const margin = { top: 45, right: 10, bottom: 5, left: 10 },
        radius = 3,
        shapeSize = Math.PI * radius * radius,
        yAxisWidth = 25;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Parallel Metrics',
        maxBarHeight,
        ranked = true, // Show metrics as ranks instead of absolute values
        yAxisParams = ['jitter', 'beeswarm', 'alpha', 'beta', 'num_topics'],
        yAxisMapping = 'alpha',
        colorParams = ['none', 'mean rank', 'best rank', 'alpha', 'beta', 'num_topics'],
        colorMapping = 'beta',
        shapeParams = ['none', 'alpha', 'beta', 'num_topics'],
        shapeMapping = 'none',
        overlap = false,
        modelParams = {
            'alpha': [0.01, 0.1, 1, 10],
            'beta': [0.01, 0.1, 1, 10],
            'num_topics': [5, 10, 15, 20]
        }, brushing = false;

    /**
     * Accessors.
     */
    let modelId = d => d.modelId,
        metricId = d => d.name,
        metricLabel = d => d.label,
        modelTooltip = d => d.tooltip,
        meanRank = d => d.mean_rank,
        bestRank = d => d.best_rank;

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
        axisContainer,
        metricContainer;

    /**
     * D3.
     */
    const metricScale = d3.scaleBand().paddingInner(0.2),
        yScale = d3.scalePoint(),
        colorScale = d3.scaleOrdinal().range(['#d9d9d9', '#a6a6a6', '#595959', '#000000']),
        shapeScale = d3.scaleOrdinal().range([d3.symbolCircle, d3.symbolTriangle, d3.symbolCross, d3.symbolStar]),
        greyScale = d3.interpolateGreys,
        rankScale = d3.scaleLinear(),
        listeners = d3.dispatch('click', 'hover', 'brush');

    const jitterLookup = {}; // Random noise adding to models to avoid overplotting

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function (_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-parallel-metrics');
                visContainer = container.append('g').attr('class', 'main-vis');
                metricContainer = visContainer.append('g').attr('class', 'metrics')
                axisContainer = metricContainer.append('g').attr('class', 'axis y-axis');

                if (!overlap) {
                    margin.top += 20;
                }

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
        metricScale.range([yAxisWidth, width]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            metricScale.domain(d3.range(metricData.length));
            rankScale.domain([1, modelData.length]);

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
            .text(metricLabel)
            .attr('dy', overlap ? 0 : -20);

        // Axis and brush
        selection.each(function (d, i) {
            d.scale = d3.scaleLinear().domain(d3.extent(modelData.map(x => x[metricId(d)])));
            d.rankScale = d3.scaleLinear().domain(d3.extent(modelData.map(x => x[metricId(d) + '-rank'])));
            d.brush = d3.brush().on('start', onBrushstarted).on('brush', onBrushed).on('end', onBrushended);
            d3.select(this).append('g').attr('class', 'axis x-axis')
                .attr('transform', 'translate(0, 5)');
            d3.select(this).append('g').attr('class', 'brush');
        });
    }

    function onBrushstarted(d) {
    }

    function onBrushed() {
        brushing = true;

        const s = d3.event.selection;
        if (!s) {
            // Empty selection, turn back to no brushing mode
            metricContainer.selectAll('.model').each(function () {
                d3.select(this).classed('non-brushed', false);
                d3.select(this).classed('brushed', false);
            });

            // Broadcast
            listeners.call('brush', module, null);
        } else {
            const isBrushed = d => d.x >= s[0][0] && d.x <= s[1][0] && d.y >= s[0][1] && d.y <= s[1][1],
                brushedIds = [];

            // Find the brushed elements using the brushing metric, then brush the same ids from other metrics
            d3.select(this.parentNode).selectAll('.model').each(function (d) {
                if (isBrushed(d)) brushedIds.push(d.id);
            });

            metricContainer.selectAll('.model').each(function (d) {
                d3.select(this).classed('non-brushed', !brushedIds.includes(d.id));
                d3.select(this).classed('brushed', brushedIds.includes(d.id));
            });

            // Broadcast
            listeners.call('brush', module, brushedIds);
        }
    }

    function getScale(d) {
        return ranked ? d.rankScale : d.scale;
    }

    function onBrushended() {
        onBrushed.call(this);
        brushing = false;
    }

    function updateMetrics(selection) {
        selection.each(function (d, i) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            // Label
            container.select('text')
                .attr('x', metricScale.bandwidth() / 2)
                .attr('y', -maxBarHeight - 23);

            // Axis
            if (ranked) {
                getScale(d).rangeRound([metricScale.bandwidth(), 0]).nice();
            } else {
                getScale(d).rangeRound([0, metricScale.bandwidth()]).nice();
            }
            container.select('.axis').call(d3.axisBottom(getScale(d)).ticks(5));

            // Y-axis on the left most
            if (!i) {
                axisContainer.attr('transform', 'translate(' + (yAxisWidth - 5) + ',' + maxBarHeight + ')')
                    .call(d3.axisLeft(yScale))
                    .classed('hidden', ['jitter', 'beeswarm'].includes(yAxisMapping));
            }

            // Brush
            d.brush.extent([[-radius, -maxBarHeight - radius * 2 - 30], [metricScale.bandwidth() + radius, radius + 5]]);
            container.select('.brush').call(d.brush);

            // Model dots
            const data = modelData.map(x => ({
                id: modelId(x),
                tooltip: modelTooltip(x),
                metric: metricId(d),
                value: x[metricId(d)],
                rank: x[metricId(d) + '-rank'],
                meanRank: meanRank(x),
                bestRank: bestRank(x),
                alpha: x.alpha,
                beta: x.beta,
                num_topics: x.num_topics
            }));

            // Sort increasingly so that higher values will place on top of lower values
            data.sort((a, b) => d3.ascending(a.value, b.value));

            layoutModels(data, d);

            // Lines connecting dots
            const showLines = ['alpha', 'beta', 'num_topics'].includes(yAxisMapping) && !overlap && ['alpha', 'beta', 'num_topics'].includes(colorMapping) && colorMapping !== yAxisMapping;
            if (showLines) {
                const lineData = Object.entries(_.groupBy(data, d => d[yAxisMapping] + '-' + d[colorMapping])).map(x => x[1]);
                layoutLines(lineData);

                pv.enterUpdate(lineData, d3.select(this), enterLines, updateLines, null, 'line-item');
            }
            d3.select(this).selectAll('.line-item').classed('hidden', !showLines);

            pv.enterUpdate(data, d3.select(this), enterModels, updateModels, d => d.id, 'model');
        });
    }

    function enterLines(selection) {
        const container = selection;

        container.append('line');
    }

    function updateLines(selection) {
        selection.each(function (d) {
            const container = d3.select(this);
            container.select('line')
                .attr('x1', d.x1)
                .attr('x2', d.x2)
                .attr('y1', d.y1)
                .attr('y2', d.y2);
        });
    }

    function enterModels(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

        // Glyph
        container.append('path');
        container.append('title')
            .text(modelTooltip);

        container.on('mouseover', function (d, i) {
            if (brushing) return;

            metricContainer.selectAll('.model').classed('hovered', d2 => d2.id === d.id);
            metricContainer.selectAll('.model').filter(d2 => d2.id === d.id).raise();
            listeners.call('hover', module, d.id);
        }).on('mouseout', function () {
            metricContainer.selectAll('.model').classed('hovered', false);
            listeners.call('hover', module, null);
        }).on('click', function (d) {
        });
    }

    function updateModels(selection) {
        selection.each(function (d) {
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

            if (yAxisMapping !== 'jitter' && !overlap && ['alpha', 'beta', 'num_topics'].includes(colorMapping) && colorMapping !== yAxisMapping) {
                _.each(_.groupBy(data, d => d[yAxisMapping]), (v, k) => {
                    groupVertically(v);
                });
            }
        }
    }

    function layoutLines(data) {
        data.forEach(g => {
            const m1 = _.minBy(g, d => d.rank);
            const m2 = _.maxBy(g, d => d.rank);

            g.x1 = m2.x;
            g.x2 = m1.x;
            g.y1 = g.y2 = m1.y;
        });
    }

    /**
     * Within each band (same y), splits data into separate chunks so that there is no overlap between them.
     * Chunks can move up down to avoid overlap.
     */
    function groupVertically(data) {
        // Sort 4 groups and 4 elements in the group
        data.sort((a, b) => d3.descending(a.rank, b.rank));

        // Groups are sorted based on the first item
        const groups = Object.entries(_.groupBy(data, d => d[colorMapping])).map(x => [+x[0], x[1]]);
        groups.sort((a, b) => d3.ascending(a[0], b[0]));

        // The first group stays at the same level
        // Maintain the last item in each level for overlap check
        // const lastItem = { 0: _.last(groups[0]) };
        // groups.slice(1).forEach(g => {
        //     let i = 0;
        //     // Start from the bottom and move up.
        //     for (i; i < _.size(lastItem); i++) {
        //         // Overlap if rank of the first item in the group is greater than rank of the last item
        //         if (lastItem[i].rank > g[0].rank) {
        //             break;
        //         }
        //     }

        //     // level is always equal to i, in both cases
        //     lastItem[i] = _.last(g);

        //     // translate
        //     g.forEach(d => {
        //         d.y -= (radius * 2 + 1) * i;
        //     });
        // });

        // Option 2: always allocate a row for each subgroup
        groups.forEach((g, i) => {
            g[1].forEach(d => {
                d.y -= (radius * 2 + 1) * i;
            });
        });
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        container.html(`
            <div class='title'>${visTitle}</div>
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

        // <div class='setting shape'>
        //         Shape
        //         <select>
        //         </select>
        //     </div>

        // X-axis
        container.select('input[value=' + (ranked ? 'rank' : 'score') + ']').node().checked = true;
        container.selectAll('input[name=x-axis]').on('change', function () {
            ranked = this.value === 'rank';
            update();
        });

        // Y-axis, Color, Shape
        addSelectOptions(container, '.y-axis select', yAxisParams, yAxisMapping, value => { yAxisMapping = value; update(); });
        addSelectOptions(container, '.color select', colorParams, colorMapping, value => { colorMapping = value; update(); });
        // addSelectOptions(container, '.shape select', shapeParams, shapeMapping, value => { shapeMapping = value; update(); });
    }

    function addSelectOptions(container, css, values, defaultValue, callback) {
        const labels = values.map(v => {
            if (modelParams[v]) {
                return v + ' (' + modelParams[v].join(', ') + ')';
            } else {
                return v;
            }
        });

        const select = container.select(css);
        const options = select.selectAll('option').data(values);
        options.enter().append('option')
            .attr('value', String)
            .text((d, i) => labels[i]);
        select.node().value = defaultValue;
        select.on('change', function () {
            callback(this.value);
        });
    };

    /**
     * Sets/gets the width of the visualization.
     */
    module.width = function (value) {
        if (!arguments.length) return visWidth;
        visWidth = value;
        return this;
    };

    /**
     * Sets/gets the height of the visualization.
     */
    module.height = function (value) {
        if (!arguments.length) return visHeight;
        visHeight = value;
        return this;
    };

    /**
     * Sets the flag indicating data input has been changed.
     */
    module.invalidate = function () {
        dataChanged = true;
    };

    /**
     * Handles items that are brushed externally.
     */
    module.handleBrush = function (ids) {
        metricContainer.selectAll('.model')
            .classed('ext-brushed', !ids ? false : d => ids.length && ids.includes(d.id))
            .classed('non-ext-brushed', d => !ids ? false : ids.length && !ids.includes(d.id));
    };

    /**
     * Handle an item that is hovered externally.
     */
    module.handleHover = function (id) {
        metricContainer.selectAll('.model')
            .classed('hovered', d => d.id === id)
            .filter(d => d.id === id).raise();
    };

    /**
     * Binds custom events.
     */
    module.on = function () {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};