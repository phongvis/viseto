/**
 * Visualisation of topic models grouped by parameter values.
 * Data input:
 * - array of metrics
 * - array of subgroups, each has rank for each metric
 */
pv.vis.subgroups = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 25, right: 5, bottom: 5, left: 5 },
        radius = 16,
        itemHeight = radius * 2 + 35;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Subgroups',
        topN = 3,
        brushing = false;

    /**
     * Accessors.
     */
    let metricId = d => d.name,
        metricLabel = d => d.label,
        itemId = d => d.id,
        condition = d => d.condition,
        itemTooltip = d => 'Group (' + d.info + ')\nAverage rank of the group: ' + d.value.toFixed(1),
        modelParams = {
            'alpha': [0.01, 0.1, 1, 10],
            'beta': [0.01, 0.1, 1, 10],
            'num_topics': [5, 10, 15, 20]
        }, paramList = ['alpha', 'beta', 'num_topics'],
        numLevels = modelParams['alpha'].length,
        numParams = paramList.length;

    /**
     * Data binding to DOM elements.
     */
    let itemData,
        metricData,
        backgroundData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        metricContainer,
        itemContainer,
        backgroundContainer,
        brushContainer;

    /**
     * D3.
     */
    const metricScale = d3.scaleBand().paddingInner(0.15),
        itemRankScale = d3.scaleLinear(),
        brush = d3.brush().on('brush', onBrushed).on('end', onBrushended),
        listeners = d3.dispatch('click', 'hover', 'brush');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-subgroups');
                visContainer = container.append('g').attr('class', 'main-vis');
                backgroundContainer = visContainer.append('g').attr('class', 'backgrounds');
                brushContainer = visContainer.append('g').attr('class', 'brush');
                metricContainer = visContainer.append('g').attr('class', 'metrics');
                itemContainer = visContainer.append('g').attr('class', 'items');

                metricData = _data.metrics;
                itemData = buildData(_data.items);
                backgroundData = paramList.map(Object);

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
        metricScale.range([0, width]);
        itemRankScale.range([0, radius * 2]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            metricScale.domain(d3.range(metricData.length));
            itemRankScale.domain([1, d3.max(itemData, d => d.value)]);
        }

        brush.extent([[0, 0], [width, height]]);
        brushContainer.call(brush);

        // Updates that depend on both data and display change
        layoutMetrics();
        layoutItems();

        pv.enterUpdate(backgroundData, backgroundContainer, enterBackgrounds, updateBackgrounds, null, 'background');
        pv.enterUpdate(metricData, metricContainer, enterMetrics, updateMetrics, metricId, 'metric');
        pv.enterUpdate(itemData, itemContainer, enterItems, updateItems, itemId, 'item');
    }

    function buildData(data) {
        return _.flatten(_.range(1, numParams + 1).map(l => computeTopItems(data, l)));
    }

    function computeTopItems(data, numParams) {
        data = data.filter(d => condition(d).length === numParams);

        // For each metric, return top N
        const items = [];
        metricData.forEach((m, i) => {
            const metric = metricId(m);
            const metricItems = data
                .sort((a, b) => d3.descending(a[metric], b[metric]))
                .slice(0, topN)
                .map((d, j) => {
                    const item = {
                        id: extractItemId(condition(d)),
                        numParams: numParams,
                        metricIdx: i,
                        orderIdx: j,
                        value: d[metric]
                    };
                    condition(d).forEach(pair => {
                        item[pair[0]] = pair[1];
                    });
                    item.info = condition(d).map(pair => pair[0] + ': ' + pair[1]).join(', ');

                    return item;
                });
            items.push(...metricItems);
        });

        return items;
    }

    function extractItemId(c) {
        return paramList.map(p => {
            const pair = c.find(x => x[0] === p);
            return pair ? pair[1] : 'x';
        }).join('-');
    }

    function enterMetrics(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Label
        container.append('text').attr('class', 'label')
            .text(metricLabel);
    }

    function updateMetrics(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);
        });
    }

    function enterItems(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Pie, one for each param
        const levelRadius = radius / numLevels,
            paramAngle = Math.PI * 2 / numParams;
        container.each(function(d) {
            _.times(numParams, i => {
                let p = paramList[i],
                    paramValueIdx = modelParams[p].indexOf(d[p]),
                    emptyFill = paramValueIdx === -1;

                // If the param is missing, show as the biggest but with empty fill.
                if (paramValueIdx === -1) paramValueIdx = modelParams[p].length - 1;

                const arc = d3.arc()
                    .innerRadius(0)
                    .outerRadius((paramValueIdx + 1) * levelRadius)
                    .startAngle(paramAngle * i)
                    .endAngle(paramAngle * (i + 1));
                d3.select(this).append('path')
                    .classed('no-fill', emptyFill)
                    .attr('d', arc);
            });
        });

        // Rank bar
        container.append('rect').attr('class', 'rank')
            .attr('x', -radius)
            .attr('y', radius + 5)
            .attr('width', d => itemRankScale(d.value))
            .attr('height', 10);
        container.append('rect').attr('class', 'rank base')
            .attr('x', -radius)
            .attr('y', radius + 5)
            .attr('width', radius * 2)
            .attr('height', 10);

        container.append('title')
            .text(itemTooltip);

        container.on('mouseover', function(d) {
            if (brushing) return;

            itemContainer.selectAll('.item').classed('hovered', d2 => d2.id === d.id);
            listeners.call('hover', module, d.id);
        }).on('mouseout', function() {
            itemContainer.selectAll('.item').classed('hovered', false);
            listeners.call('hover', module, null);
        }).on('click', function(d) {
        });
    }

    function updateItems(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);
        });
    }

    function onBrushed() {
        brushing = true;

        const s = d3.event.selection;
        if (!s) {
            // Empty selection, turn back to no brushing mode
            itemContainer.selectAll('.item').each(function() {
                d3.select(this).classed('non-brushed', false);
                d3.select(this).classed('brushed', false);
            });

            // Broadcast
            listeners.call('brush', module, null);
        } else {
            const isBrushed = d => d.x >= s[0][0] && d.x <= s[1][0] && d.y >= s[0][1] && d.y <= s[1][1],
                brushedIds = itemData.filter(isBrushed).map(itemId);

            itemContainer.selectAll('.item').each(function(d) {
                d3.select(this).classed('non-brushed', !brushedIds.includes(itemId(d)));
                d3.select(this).classed('brushed', brushedIds.includes(itemId(d)));
            });

            // Broadcast
            listeners.call('brush', module, brushedIds);
        }
    }

    function onBrushended() {
        onBrushed.call(this);

        brushing = false;
    }

    function enterBackgrounds(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        container.append('rect');
    }

    function updateBackgrounds(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.classed('odd', i % 2)
                .classed('even', i % 2 === 0);

            container.select('rect')
                .attr('width', width)
                .attr('height', d.height);
        });
    }

    function layoutMetrics() {
        metricData.forEach((t, i) => {
            t.x = metricScale(i) + metricScale.bandwidth() / 2;
            t.y = 0;
        });
    }

    function layoutItems() {
        // Split items into groups of same length.
        // Within each group, use a grid layout
        let offset = 20 + radius;
        for (let i = 0; i < numParams; i++) {
            const data = itemData.filter(d => d.numParams === i + 1);

            data.forEach(d => {
                d.x = metricScale(d.metricIdx) + metricScale.bandwidth() / 2;
                d.y = offset + itemHeight * d.orderIdx;
            });

            backgroundData[i].x = 0;
            backgroundData[i].y = offset - 15 - radius;
            backgroundData[i].height = topN * itemHeight + 15;

            offset += topN * itemHeight + 10;
        }
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
     * Handles items that are brushed externally.
     */
    module.handleBrush = function(ids) {
        itemContainer.selectAll('.item')
            .classed('ext-brushed', !ids ? false: d => ids.length && ids.includes(itemId(d)))
            .classed('non-ext-brushed', d => !ids ? false: ids.length && !ids.includes(itemId(d)));
    };

    /**
     * Handle an item that is hovered externally.
     */
    module.handleHover = function(id) {
        itemContainer.selectAll('.item').classed('hovered', d => d.id === id);
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