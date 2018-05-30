/**
 * Compare the distribution of values in multiple models accross data points.
 * Data input: an array with each element detailing each model to compare
 * - values: an array of values, each for a data point
 */
pv.vis.compParams = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 40, right: 3, bottom: 10, left: 18 };

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Document Topics',
        cellWidth,
        cellHeight,
        rowLabel = '&alpha;',
        colLabel = '&beta;',
        termLabels = ['documents', 'topics'],
        minProbLabel = 'Min Topic Probability',
        minValue = 0.1,
        stepValue = 0.01;

    /**
     * Accessors.
     */
    let id = d => d.id,
        rowValue = d => d.alpha,
        colValue = d => d.beta,
        values = d => d.values;

    /**
     * Data binding to DOM elements.
     */
    let models,
        rowData,
        colData,
        cellData,
        bins, // d3-histogram bins
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        rowContainer,
        colContainer,
        cellContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click'),
        xScale = d3.scaleLinear(),
        yScale = d3.scaleLinear();

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-comp-params');
                visContainer = container.append('g').attr('class', 'main-vis');
                rowContainer = visContainer.append('g').attr('class', 'rows');
                colContainer = visContainer.append('g').attr('class', 'cols');
                cellContainer = visContainer.append('g').attr('class', 'cells');

                addSettings(container);

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
            rowData = buildRowData();
            colData = buildColData();
            cellData = buildCellData();

            const minBin = d3.min(cellData, m => d3.min(m.numTopics)),
                maxBin = d3.max(cellData, m => d3.max(m.numTopics)) + 1; // +1 because x1 of the last d3-bin is inclusive

            function createBins(m) {
                return d3.histogram()
                    .domain(xScale.domain())
                    .thresholds(maxBin - minBin)
                    (m.numTopics);
            }

            xScale.domain([minBin, maxBin]);
            bins = cellData.map(createBins);
            yScale.domain([0, d3.max(_.flatten(bins), d => d.length)]);
        }

        // Canvas update
        width = visWidth - margin.left - margin.right;
        height = visHeight - margin.top - margin.bottom;
        cellWidth = Math.floor(width / colData.length);
        cellHeight = Math.floor(height / rowData.length);

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        xScale.range([0, cellWidth]);
        yScale.range([cellHeight, 1]);

        // Updates that depend on both data and display change
        layoutRows();
        layoutCols();
        layoutCells();

        /**
         * Draw.
         */
        pv.enterUpdate(rowData, rowContainer, enterRows, updateRows, id, 'row');
        pv.enterUpdate(colData, colContainer, enterCols, updateCols, id, 'col');
        pv.enterUpdate(cellData, cellContainer, enterCells, updateCells, id, 'cell');
    }

    /**
     * Return data bound to each row, each is a unique value from `rowValue` in the models.
     */
    function buildRowData() {
        return _.uniq(models.map(rowValue))
            .sort(d3.ascending)
            .map(x => ({ id: x, value: x, label: rowLabel + '=' + x }));
    }

    /**
     * Return data bound to each col, each is a unique value from `colValue` in the models.
     */
    function buildColData() {
        return _.uniq(models.map(colValue))
            .sort(d3.ascending)
            .map(x => ({ id: x, value: x, label: colLabel + '=' + x }));
    }

    /**
     * Return data bound to each cell.
     */
    function buildCellData() {
        return models.map((m, i) => ({
            // Find position of cells in the matrix
            rowIdx: rowData.findIndex(r => r.value === rowValue(m)),
            colIdx: colData.findIndex(c => c.value === colValue(m)),

            // In each document/topic, count how many topics/terms that have probability above the threshold
            numTopics: values(m).map(d => d.filter(x => x >= minValue).length),

            // Assign id for binding
            id: i
        }));
    }

    /**
     * Compute x, y positions for each row datum.
     */
    function layoutRows() {
        rowData.forEach((d, i) => {
            d.x = cellWidth * (i + 0.5);
            d.y = 0;
        });
    }

    /**
     * Compute x, y positions for each col datum.
     */
    function layoutCols() {
        colData.forEach((d, i) => {
            d.x = 0;
            d.y = cellHeight * (colData.length - 0.5 - i);
        });
    }

    /**
     * Compute x, y positions for each cell datum.
     */
    function layoutCells() {
        cellData.forEach(d => {
            d.x = rowData[d.colIdx].x - cellWidth * 0.5;
            d.y = colData[d.rowIdx].y - cellHeight * 0.5;
            d.width = cellWidth;
            d.height = cellHeight;
        });
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '100%')
            .append('xhtml:div').attr('class', 'vis-header');

        // Title
        container.append('xhtml:div').attr('class', 'title').text(visTitle);

        // Min probability
        let div = container.append('xhtml:div').attr('class', 'setting min-prob');
        div.append('xhtml:label')
            .text(minProbLabel + ': ');
        div.append('xhtml:input')
            .attr('type', 'number')
            .attr('min', 0.01)
            .attr('max', 1)
            .attr('value', minValue)
            .attr('step', stepValue)
            .on('input', function() {
                minValue = this.value;
                div.select('#lblValue').text(minValue);
                dataChanged = true;
                update();
            });
    }

    /**
     * Called when new rows added.
     */
    function enterRows(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        container.append('text');
    }

    /**
     * Called when rows updated.
     */
    function updateRows(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('text')
                .html(d => d.label);
        });
    }

    /**
     * Called when new cols added.
     */
    function enterCols(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ') rotate(-90)')
            .attr('opacity', 0);

        container.append('text').attr('dy', '-3');
    }

    /**
     * Called when cols updated.
     */
    function updateCols(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ') rotate(-90)')
                .attr('opacity', 1);

            container.select('text')
                .html(d => d.label);
        });
    }

    /**
     * Called when new cells added.
     */
    function enterCells(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);

        // Border
        container.append('rect').attr('class', 'container');
    }

    /**
     * Called when cells updated.
     */
    function updateCells(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('.container')
                .attr('width', d.width)
                .attr('height', d.height);

            pv.enterUpdate(bins[i], container, enterBars, updateBars, d => d.x0, 'bar');
        });
    }

    /**
     * Called when new bars added.
     */
    function enterBars(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + xScale(d.x0) + ',' + yScale(d.length) + ')');

        container.append('rect')
            .attr('x', 1);

        container.append('text')

        container.append('title');
    }

    /**
     * Called when bars updated.
     */
    function updateBars(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this)
                .attr('transform', 'translate(' + xScale(d.x0) + ',' + yScale(d.length) + ')');

            container.select('rect')
                .attr('width', xScale(d.x1) - xScale(d.x0) - (i === selection.size() - 1 ? 2 : 1))
                .attr('height', Math.max(0, cellHeight - 1 - yScale(d.length)));

            container.select('text')
                .classed('hidden', d3.select(this.parentNode).datum().rowIdx) // Only visible in the last row
                .attr('y', cellHeight - yScale(d.length))
                .attr('x', (xScale(d.x1) - xScale(d.x0)) / 2)
                .text(d.x0);

            container.select('title')
                .text(d.length + ' ' + termLabels[0] + ' with ' + d.x0 + ' ' + termLabels[1]);
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
     * Sets/gets the title of the visualization.
     */
    module.visTitle = function(value) {
        if (!arguments.length) return visTitle;
        visTitle = value;
        return this;
    };

    /**
     * Sets/gets the minimum probability.
     */
    module.minValue = function(value) {
        if (!arguments.length) return minValue;
        minValue = value;
        return this;
    };

    /**
     * Sets/gets the term labels.
     */
    module.termLabels = function(value) {
        if (!arguments.length) return termLabels;
        termLabels = value;
        return this;
    };

    /**
     * Sets/gets the minimum probability label in the settings.
     */
    module.minProbLabel = function(value) {
        if (!arguments.length) return minProbLabel;
        minProbLabel = value;
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