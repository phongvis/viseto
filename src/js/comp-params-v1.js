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
    const margin = { top: 10, right: 5, bottom: 5, left: 5 },
        rowGap = 20,
        radius = 4;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height; // Size of the main content, excluding margins

    /**
     * Accessors.
     */
    let values = d => d.values;

    /**
     * Data binding to DOM elements.
     */
    let models,
        rowData,
        activeRowData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        rowContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click');
        xScale = d3.scaleLinear().domain([0, 1]),
        idxScale = d3.scaleLinear().range([0.2, 1]),
        colorScale = idx => d3.interpolateGreys(idxScale(idx));

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                visContainer = d3.select(this).append('g').attr('class', 'pv-comp-params');
                rowContainer = visContainer.append('g').attr('class', 'rows');

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
        // Canvas update
        width = visWidth - margin.left - margin.right;
        height = visHeight - margin.top - margin.bottom;

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        xScale.range([0, width]);

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            rowData = computeRowData();
            idxScale.domain([0, models.length - 1]);
        }

        // Updates that depend on both data and display change
        layoutRows();

        /**
         * Draw.
         */
        const rows = rowContainer.selectAll('.row').data(activeRowData);
        rows.enter().append('g').attr('class', 'row').call(enterRows)
            .merge(rows).call(updateRows);
        rows.exit().transition().attr('opacity', 0).remove();
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
        return models.map((m, i) => values(m)[rowIdx].map(v => (
            { value: v, modelIdx: i }
        )));
    }

    /**
     * Called when new rows added.
     */
    function enterRows(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('line').attr('class', 'baseline');
    }

    /**
     * Called when rows updated.
     */
    function updateRows(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('line')
                .attr('x2', d.width);

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
    }

    /**
     * Called when cells updated.
     */
    function updateCells(selection) {
        selection.each(function(d) {
            layoutDots(d);

            const dots = d3.select(this).selectAll('.dot').data(d);
            dots.enter().append('g').attr('class', 'dot').call(enterDots)
                .merge(dots).call(updatedots);
            dots.exit().transition().attr('opacity', 0).remove();
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
            .attr('r', radius);

        container.on('mouseover', function(d) {
            rowContainer.selectAll('.dot').classed('hovered', x => x.modelIdx === d.modelIdx);
        }).on('mouseout', function() {
            rowContainer.selectAll('.dot').classed('hovered', false);
        });
    }

    /**
     * Called when dots updated.
     */
    function updatedots(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('circle')
                .style('fill', colorScale(d.modelIdx));
        });
    }

    function layoutRows() {
        const numVisibleRows = Math.floor(height / rowGap) + 1;
        activeRowData = rowData.slice(0, numVisibleRows);

        activeRowData.forEach((d, i) => {
            d.x = 0;
            d.y = rowGap * i;
            d.width = width;
        });
    }

    function layoutDots(data) {
        data.forEach(d => {
            d.x = xScale(d.value);
            d.y = 0;
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