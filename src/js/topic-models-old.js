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
pv.vis.topicModels = function () {
    /**
     * Visual configs.
     */
    const margin = { top: 25, right: 5, bottom: 5, left: 5 },
        radius = 16,
        itemGap = 3,
        axisOffsetX = 25,
        axisOffsetY = 15;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Scatter Metrics',
        layout = 'two', // one/two
        modelTooltip = d => d.tooltip,
        modelParams = {
            'alpha': [0.01, 0.1, 1, 10],
            'beta': [0.01, 0.1, 1, 10],
            'num_topics': [5, 10, 15, 20]
        }, paramList = ['alpha', 'beta', 'num_topics'],
        numLevels = modelParams['alpha'].length,
        numParams = paramList.length,
        colorParams = ['none', 'mean rank', 'best rank'],
        color = 'none',
        axisMappings = ['dim 1', 'dim 2', 'mean rank', 'best rank'],
        xAxisMappingIdx = 2,
        yAxisMappingIdx = 3,
        brushing = false;

    /**
     * Accessors.
     */
    let modelId = d => d.modelId,
        meanRank = d => d.mean_rank,
        bestRank = d => d.best_rank,
        mappingAccessors = [
            d => d.coords[0],
            d => d.coords[1],
            meanRank,
            bestRank
        ];

    /**
     * Data binding to DOM elements.
     */
    let modelData,
        groupData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        modelContainer,
        groupContainer,
        brushContainer,
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
        colorScale = d3.interpolateGreys,
        rankScale = d3.scaleLinear().range([0, 0.75]),
        brush = d3.brush().on('brush', onBrushed).on('end', onBrushended),
        listeners = d3.dispatch('click', 'hover', 'brush');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function (_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-topic-models');
                visContainer = container.append('g').attr('class', 'main-vis');
                brushContainer = visContainer.append('g').attr('class', 'brush');
                modelContainer = visContainer.append('g').attr('class', 'models');
                groupContainer = visContainer.append('g').attr('class', 'groups');

                modelData = _data.models;
                groupData = _data.groups;
                console.log(groupData[0]);

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
            xScale.domain(d3.extent(modelData, mappingAccessors[xAxisMappingIdx]).reverse()).nice();
            yScale.domain(d3.extent(modelData, mappingAccessors[yAxisMappingIdx]).reverse()).nice();
            rankScale.domain([1, modelData.length]);
        }

        xAxisContainer.classed('hidden', layout === 'one').call(xAxis);
        yAxisContainer.classed('hidden', layout === 'one').call(yAxis);
        xAxisLabel.attr('transform', 'translate(' + width + ',-3)');
        yAxisLabel.attr('transform', 'translate(0,-3) rotate(-90)');

        brush.extent([[0, 0], [width, height]]);
        brushContainer.call(brush);

        // Updates that depend on both data and display change
        layoutModels();

        pv.enterUpdate(modelData, modelContainer, enterModels, updateModels, modelId, 'model');
        pv.enterUpdate(groupData, groupContainer, enterGroups, updateGroups, groupId, 'group');

        // modelContainer.selectAll('.model').sort(orderSort);
    }

    function orderSort(a, b) {
        if (color === 'mean rank') return d3.descending(meanRank(a), meanRank(b)) || d3.ascending(modelId(a), modelId(b));
        if (color === 'best rank') return d3.descending(bestRank(a), bestRank(b)) || d3.ascending(modelId(a), modelId(b));
    }

    function enterModels(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Pie, one for each param
        const levelRadius = radius / numLevels,
            paramAngle = Math.PI * 2 / numParams;
        container.each(function (d) {
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

        container.append('title')
            .text(modelTooltip);

        container.on('mouseover', function (d) {
            if (brushing) return;

            modelContainer.selectAll('.model').classed('hovered', d2 => d2 === d);
            modelContainer.selectAll('.model').filter(d2 => d2 === d).raise();
            listeners.call('hover', module, modelId(d));
        }).on('mouseout', function () {
            modelContainer.selectAll('.model').classed('hovered', false);
            listeners.call('hover', module, null);
        }).on('click', function (d) {
            listeners.call('click', module, modelId(d));
        });
    }

    function updateModels(selection) {
        selection.each(function (d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            const c = findColor(d);
            container.style('fill', c)
                .style('stroke', d3.color(c).darker());
        });
    }

    function enterGroups(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Pie, one for each param
        const levelRadius = radius / numLevels,
            paramAngle = Math.PI * 2 / numParams;
        container.each(function (d) {
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

        // container.append('title')
        //     .text(itemTooltip);

        // container.on('mouseover', function(d) {
        //     if (brushing) return;

        //     itemContainer.selectAll('.item').classed('hovered', d2 => d2.id === d.id);
        //     listeners.call('hover', module, d.id);
        // }).on('mouseout', function() {
        //     itemContainer.selectAll('.item').classed('hovered', false);
        //     listeners.call('hover', module, null);
        // }).on('click', function(d) {
        // });
    }

    function updateGroups(selection) {
        selection.each(function (d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);
        });
    }

    function findColor(d) {
        return c = {
            'none': 'hsl(0, 0%, 90%)',
            'mean rank': colorScale(rankScale(meanRank(d))),
            'best rank': colorScale(rankScale(bestRank(d)))
        }[color];
    }

    function layoutModels() {
        if (layout === 'one') {
            const numItemsPerRow = Math.floor((width + itemGap) / (radius * 2 + itemGap));

            modelData.forEach((d, i) => {
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

    function onBrushed() {
        brushing = true;

        const s = d3.event.selection;
        if (!s) {
            // Empty selection, turn back to no brushing mode
            modelContainer.selectAll('.model').each(function () {
                d3.select(this).classed('non-brushed', false);
                d3.select(this).classed('brushed', false);
            });

            // Broadcast
            listeners.call('brush', module, null);
        } else {
            const isBrushed = d => d.x >= s[0][0] && d.x <= s[1][0] && d.y >= s[0][1] && d.y <= s[1][1],
                brushedIds = modelData.filter(isBrushed).map(modelId);

            modelContainer.selectAll('.model').each(function (d) {
                d3.select(this).classed('non-brushed', !brushedIds.includes(modelId(d)));
                d3.select(this).classed('brushed', brushedIds.includes(modelId(d)));
            });

            // Broadcast
            listeners.call('brush', module, brushedIds);
        }
    }

    function onBrushended() {
        onBrushed.call(this);

        brushing = false;
    }

    function addAxes() {
        xAxisContainer = visContainer.append('g').attr('class', 'axis x');
        xAxisLabel = xAxisContainer.append('text').attr('class', 'label-button x')
            .text(axisMappings[xAxisMappingIdx])
            .on('click', function () {
                xAxisMappingIdx = (xAxisMappingIdx + 1) % axisMappings.length;
                d3.select(this).text(axisMappings[xAxisMappingIdx]);
                dataChanged = true;
                update();
            });

        yAxisContainer = visContainer.append('g').attr('class', 'axis y');
        yAxisLabel = yAxisContainer.append('text').attr('class', 'label-button y')
            .text(axisMappings[yAxisMappingIdx])
            .on('click', function () {
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
            `
        );

        // container.html(`
        //     <div class='title'>${visTitle}</div>
        //     <div class='setting layout'>
        //         Layout
        //         <label>
        //             <input type='radio' value='one' name='layout'> 1d
        //         </label>
        //         <label>
        //             <input type='radio' value='two' name='layout'> 2d
        //         </label>
        //     </div>
        //     <div class='setting color'>
        //         Color
        //         <select>
        //         </select>
        //     </div>
        //     `
        // );

        // container.select('input[value=' + layout + ']').node().checked = true;
        // container.selectAll('input[name=layout]').on('change', function () {
        //     layout = this.value;
        //     update();
        // });

        // pv.addSelectOptions(container, '.color select', colorParams, color, value => { color = value; update(); });
    }

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
        modelContainer.selectAll('.model')
            .classed('ext-brushed', !ids ? false : d => ids.length && ids.includes(modelId(d)))
            .classed('non-ext-brushed', d => !ids ? false : ids.length && !ids.includes(modelId(d)));
    };

    /**
     * Handle an item that is hovered externally.
     */
    module.handleHover = function (id) {
        modelContainer.selectAll('.model')
            .classed('hovered', d => modelId(d) === id)
            .filter(d => modelId(d) === id).raise();

        if (!id) modelContainer.selectAll('.model').sort(orderSort);
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