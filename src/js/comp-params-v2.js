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
        rowGap = 5,
        maxBarHeight = 25,
        colGap = 10,
        barWidth = 4,
        barGap = 1,
        numBars = 5,
        colWidth = (barWidth + barGap) * numBars - barGap + colGap;


    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        showBaseline = false,
        showBackground = false;

    /**
     * Accessors.
     */
    let values = d => d.values;

    /**
     * Data binding to DOM elements.
     */
    let models,
        colData,
        rowData,
        activeRowData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        colContainer,
        rowContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click'),
        heightScale = d3.scaleLinear().range([0, maxBarHeight]);

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                visContainer = d3.select(this).append('g').attr('class', 'pv-comp-params');
                colContainer = visContainer.append('g').attr('class', 'cols');
                rowContainer = visContainer.append('g').attr('class', 'rows');

                this.visInitialized = true;
            }

            models = _data;
            colData = models.map(m => ({}));

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
            rowData = computeRowData();
        }

        // Updates that depend on both data and display change
        layoutRows();
        layoutCols();

        /**
         * Draw.
         */
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
            values: values(m)[rowIdx].map(v => ({ value: v }))
        }));
    }

    /**
     * Called when new cols added.
     */
    function enterCols(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('rect');
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

            container.classed('hidden', !showBackground);
            container.classed('even', i % 2 === 0);
            container.classed('odd', i % 2 == 1);

            container.select('rect')
                .attr('width', d.width)
                .attr('height', d.height);
        });
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
                .attr('x2', d.width)
                .classed('hidden', !showBaseline);

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

            layoutBars(d.values);

            const bars = container.selectAll('.bar').data(d.values);
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

        container.append('rect')
            .attr('width', barWidth);
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
                .attr('height', d.height);
        });
    }

    function layoutCols() {
        colData.forEach((d, i) => {
            d.x = colWidth * i;
            d.y = 0;
            d.width = colWidth;
            d.height = height;
        });
    }

    function layoutRows() {
        const numVisibleRows = Math.floor(height / (maxBarHeight + rowGap));
        activeRowData = rowData.slice(0, numVisibleRows);

        activeRowData.forEach((d, i) => {
            d.x = 0;
            d.y = (maxBarHeight + rowGap)  * i + maxBarHeight;
            d.width = colWidth * models.length - colGap;
        });
    }

    function layoutCells(data) {
        data.forEach((d, i) => {
            d.x = colWidth * i;
            d.y = 0;
        });
    }

    function layoutBars(data) {
        data.forEach((d, i) => {
            d.x = (barWidth + barGap) * i;
            d.height = heightScale(d.value);
            d.y = -d.height;
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