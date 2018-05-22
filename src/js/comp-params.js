/**
 * Compare the distribution of values in multiple models accross data points.
 * Data input: an array with each element detailing each model to compare
 * - label: the parameter that makes those models different
 * - values: an array of values, each for a data point
 */
pv.vis.compParams = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 15, right: 5, bottom: 5, left: 5 },
        sumRowHeight = 0,
        rowHeight = 15,
        rowGap = 0,
        maxCellWidth = 40,
        cellGap = 5,
        sumLabelWidth = 50,
        groupGap = 15,
        groupHeight = 15;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        detailHeight, // Height for the detail view
        detailOffset,
        groupWidth;

    /**
     * Accessors.
     */
    let values = d => d.values,
        label = d => d.label,
        groupBy1 = d => d.groupBy1,
        groupBy2 = d => d.groupBy2;

    /**
     * Data binding to DOM elements.
     */
    let models,
        sumData,
        groupData,
        rowData,
        activeRowData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        sumContainer,
        groupContainer,
        colContainer,
        rowContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click'),
        widthScale = d3.scaleLinear().range([0, maxCellWidth]),
        sumScale = d3.scaleLog(),
        sumAxis = d3.axisBottom(sumScale);

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                visContainer = d3.select(this).append('g').attr('class', 'pv-comp-params');
                sumContainer = visContainer.append('g').attr('class', 'sums');
                groupContainer = visContainer.append('g').attr('class', 'groups');
                colContainer = visContainer.append('g').attr('class', 'cols');
                rowContainer = visContainer.append('g').attr('class', 'rows');

                // sumContainer.append('g').attr('class', 'axis').call(sumAxis);

                this.visInitialized = true;
            }

            models = _data;

            update();
        });

        dataChanged = false;
    }

    /**
     * Updates the visualization when data or display attributes changes.
     */
    function update() {
        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            detailOffset = models.length * sumRowHeight + groupHeight + 30;
            rowData = computeRowData();
            colData = models;
            sumData = computeSummaryData();
            groupData = groupModels(models);

            widthScale.domain([0, d3.max(_.flatten(models.map(values)).map(_.sum))]);

            sumScale.domain([d3.min(sumData, d => d.min), d3.max(sumData, d => d.max)]);
        }

        // Canvas update
        width = visWidth - margin.left - margin.right;
        height = visHeight - margin.top - margin.bottom;
        detailHeight = height - detailOffset;
        sumScale.range([0, width - sumLabelWidth]);

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        groupContainer.attr('transform', 'translate(0,' + (detailOffset - groupHeight) + ')');
        rowContainer.attr('transform', 'translate(0,' + detailOffset + ')');
        colContainer.attr('transform', 'translate(0,' + detailOffset + ')');
        sumContainer.attr('transform', 'translate(' + sumLabelWidth + ',0)');
        sumContainer.select('.axis').attr('transform', 'translate(0,' + (models.length * sumRowHeight - 10) + ')')
            .call(sumAxis);

        // Updates that depend on both data and display change
        layoutGroups();
        layoutSums();
        layoutRows();
        layoutCols();

        /**
         * Draw.
         */
        // const sums = sumContainer.selectAll('.sum').data(sumData);
        // sums.enter().append('g').attr('class', 'sum').call(enterSums)
        //     .merge(sums).call(updateSums);
        // sums.exit().transition().attr('opacity', 0).remove();

        const groups = groupContainer.selectAll('.group').data(groupData);
        groups.enter().append('g').attr('class', 'group').call(enterGroups)
            .merge(groups).call(updateGroups);
        groups.exit().transition().attr('opacity', 0).remove();

        const cols = colContainer.selectAll('.col').data(colData);
        cols.enter().append('g').attr('class', 'col').call(enterCols)
            .merge(cols).call(updateCols);
        cols.exit().transition().attr('opacity', 0).remove();

        const rows = rowContainer.selectAll('.row').data(activeRowData);
        rows.enter().append('g').attr('class', 'row').call(enterRows)
            .merge(rows).call(updateRows);
        rows.exit().transition().attr('opacity', 0).remove();
    }

    /**
     * Return data bound to each summary.
     */
    function computeSummaryData() {
        return models.map((m, i) => {
            // Exclude 0 for log axis
            const values = rowData.map(r => r[i].variance).filter(v => v > 0).sort(d3.ascending);

            return {
                label: label(m),
                min: values[0],
                max: _.last(values),
                mean: d3.mean(values),
                deviation: d3.deviation(values),
                q1: d3.quantile(values, 0.25),
                q2: d3.quantile(values, 0.5),
                q3: d3.quantile(values, 0.75),
                values: values.map(v => ({ value: v }))
            };
        });
    }

    /**
     * Return data bound to each row.
     */
    function computeRowData() {
        if (!models.length) return [];

        const numRows = values(models[0]).length;
        return _.range(numRows).map(getRowDatum);
    }

    function getRowDatum(rowIdx) {
        return models.map((m, i) => ({
            modelIdx: i,
            values: values(m)[rowIdx].map(v => ({ value: v })),
            variance: d3.variance(values(m)[rowIdx]),
            title: values(m)[rowIdx].join('\n')
        }));
    }

    /**
     * Called when new sums added.
     */
    function enterSums(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('text')
            .attr('x', -sumLabelWidth)
            .html(label);

        // Quantiles
        container.append('rect').attr('class', 'iqr')
            .attr('y', -10)
            .attr('height', 10);
        container.append('line').attr('class', 'q2')
            .attr('y1', -10)
            .attr('y2', 0);
        container.append('line').attr('class', 'low')
            .attr('y1', -5)
            .attr('y2', -5);
        container.append('line').attr('class', 'high')
            .attr('y1', -5)
            .attr('y2', -5);
    }

    /**
     * Called when sums updated.
     */
    function updateSums(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            const k = 4.5,
                iqr = d.q3 - d.q1,
                low = d.q1 - k * iqr,
                high = d.q3 + k * iqr,
                dotData = d.values.filter(x => x.value < low || x.value > high);

            layoutDots(dotData);

            const dots = container.selectAll('.dot').data(dotData);
            dots.enter().append('g').attr('class', 'dot').call(enterDots)
                .merge(dots).call(updateDots);
            dots.exit().transition().attr('opacity', 0).remove();

            // Quantiles
            container.select('.iqr')
                .attr('x', sumScale(d.q1))
                .attr('width', sumScale(d.q3) - sumScale(d.q1));
            container.select('.q2')
                .attr('x1', sumScale(d.q2))
                .attr('x2', sumScale(d.q2));
            container.select('.low')
                .attr('x1', sumScale(low) || 0)
                .attr('x2', sumScale(d.q1));
            container.select('.high')
                .attr('x1', sumScale(high))
                .attr('x2', sumScale(d.q3));
        });
    }

    /**
     * Called when new dots added.
     */
    function enterDots(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('circle')
            .attr('r', 2.5)
            .append('title').text(d => d.values);
    }

    /**
     * Called when dots updated.
     */
    function updateDots(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);
        });
    }

    /**
     * Called when new groups added.
     */
    function enterGroups(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('text')
            .html(d => d.label);
    }

    /**
     * Called when groups updated.
     */
    function updateGroups(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);
        });
    }

    /**
     * Called when new cols added.
     */
    function enterCols(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('text')
            .html(label);
    }

    /**
     * Called when cols updated.
     */
    function updateCols(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);
        });
    }

    /**
     * Called when new rows added.
     */
    function enterRows(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);
    }

    /**
     * Called when rows updated.
     */
    function updateRows(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            layoutCells(d);

            const cells = container.selectAll('.cell').data(d);
            cells.enter().append('g').attr('class', 'cell').call(enterCells)
                .merge(cells).call(updateCells);
            cells.exit().transition().attr('opacity', 0).remove();
        });
    }

    /**
     * Called when new cells added.
     */
    function enterCells(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('g').attr('class', 'bars');
        container.append('rect').attr('class', 'container');
        container.append('title').text(d => d.title);

        container.on('mouseover', function() {
            // Move the '.row' up to make its border stand out (:hover in css)
            d3.select(this.parentNode).raise();
        });
    }

    /**
     * Called when cells updated.
     */
    function updateCells(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('.container')
                .attr('width', d.width)
                .attr('height', d.height);

            layoutBars(d.values);

            const bars = container.select('.bars').selectAll('.bar').data(d.values);
            bars.enter().append('g').attr('class', 'bar').call(enterBars)
                .merge(bars).call(updateBars);
            bars.exit().transition().attr('opacity', 0).remove();
        });
    }

    /**
     * Called when new bars added.
     */
    function enterBars(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('rect');
    }

    /**
     * Called when bars updated.
     */
    function updateBars(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('rect')
                .attr('width', d.width)
                .attr('height', d.height);
        });
    }

    function groupModels(models) {
        const groups = _.uniq(models.map(groupBy1)).sort((a, b) => d3.ascending(a, b));
        groups.forEach((g, i) => {
            models.filter(m => groupBy1(m) === g)
                .sort((a,b) => d3.ascending(groupBy2(a), groupBy2(b)))
                .forEach((m, j) => {
                    m.level1 = i
                    m.level2 = j;
                });
        });

        groupWidth = (maxCellWidth + cellGap) * groups.length + groupGap;

        return groups.map(g => ({
            label: '&beta;=' + g
        }));
    }

    function layoutSums() {
        sumData.forEach((d, i) => {
            d.x = 0;
            d.y = sumRowHeight * i;
        });
    }

    function layoutDots(data) {
        data.forEach(d => {
            d.x = sumScale(d.value);
            d.y = -5;
        });
    }

    function layoutGroups() {
        groupData.forEach((d, i) => {
            d.x = groupWidth * i;
            d.y = 0;
        });
    }

    function layoutCols() {
        colData.forEach(d => {
            d.x = groupWidth * d.level1 + (maxCellWidth + cellGap) * d.level2;
            d.y = 0;
        });
    }

    function layoutRows() {
        const numVisibleRows = Math.floor(detailHeight / (rowHeight + rowGap));
        activeRowData = rowData.slice(0, numVisibleRows);

        activeRowData.forEach((d, i) => {
            d.x = 0;
            d.y = (rowHeight + rowGap)  * i;
        });
    }

    function layoutCells(data) {
        data.forEach((d, i) => {
            d.x = colData[i].x;
            d.y = 0;
            d.width = maxCellWidth;
            d.height = rowHeight;
        });
    }

    function layoutBars(data) {
        let sum = 0;
        data.forEach((d, i) => {
            d.x = sum;
            sum += d.width = widthScale(d.value);
            d.y = 0;
            d.height = rowHeight;
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
     * Sets/gets the label for each model.
     */
    module.label = function(value) {
        if (!arguments.length) return label;
        label = value;
        return this;
    };

    /**
     * Sets/gets the values for each model.
     */
    module.values = function(value) {
        if (!arguments.length) return values;
        values = value;
        return this;
    };

    /**
     * Sets/gets the groupBy level 1 for each model.
     */
    module.groupBy1 = function(value) {
        if (!arguments.length) return groupBy1;
        groupBy1 = value;
        return this;
    };

    /**
     * Sets/gets the groupBy level 2 for each model.
     */
    module.groupBy2 = function(value) {
        if (!arguments.length) return groupBy2;
        groupBy2 = value;
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