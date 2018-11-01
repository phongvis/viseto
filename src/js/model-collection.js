/**
 * Management of selected models.
 * Data input:
 *  - a dictionary of models
 *  - data set through brushedModels as ids that can be retrieved from the dictionary
 */
pv.vis.modelCollection = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 25, right: 5, bottom: 5, left: 3 };

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Model Collection',
        modelLookup,
        modelGlyph = pv.vis.modelGlyph(),
        modelGap = 3,
        brushedModels = [],
        brushing = false;

    /**
     * Accessors.
     */
    let metricId = d => d.name,
        metricLabel = d => d.label,
        modelId = d => d.modelId,
        itemTooltip = d => 'Group (' + d.info + ')\nAverage rank of the group: ' + d.value.toFixed(1);

    /**
     * Data binding to DOM elements.
     */
    let modelData = [],
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        brushContainer;

    /**
     * D3.
     */
    const brush = d3.brush().on('brush', onBrushed).on('end', onBrushended),
        listeners = d3.dispatch('click', 'hover', 'brush');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function() {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-model-collection');
                visContainer = container.append('g').attr('class', 'main-vis');
                brushContainer = visContainer.append('g').attr('class', 'brush');

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

        // brush.extent([[0, 0], [width, height]]);
        // brushContainer.call(brush);

        // Updates that depend on both data and display change
        layoutModels();

        pv.enterUpdate(modelData, visContainer, enterModels, updateModels, modelId, 'model');
    }

    function enterModels(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')');

        container.call(modelGlyph)
            .on('click', function(d) {
            });



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

    function updateModels(selection) {
        selection.each(function(d) {
            d3.select(this).attr('transform', 'translate(' + d.x + ',' + d.y + ')');
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

    function layoutModels() {
        modelData.forEach((d, i) => {
            d.x = (modelGlyph.radius() * 2 + modelGap) * (i + 0.5);
            d.y = modelGlyph.radius();
        });
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        container.html(`
            <div class='title'>${visTitle}</div>
            <label class='setting file-container'>
                Load collection
                <input type='file' class='load'>
            </label>
            <button class='setting save'>Save collection</button>
            <button class='setting remove'>Remove models</button>
            <button class='setting add'>Add models</button>
            `
        );

        container.select('.add').on('click', function() {
            brushedModels.forEach(m => {
                if (!modelData.includes(m)) modelData.push(m);
            })

            update();
        });

        container.select('.remove').on('click', function() {
            brushedModels.forEach(m => {
                if (modelData.includes(m)) modelData.splice(modelData.indexOf(m), 1);
            })

            update();
        });

        container.select('.save').on('click', function() {
            const text = JSON.stringify(modelData.map(modelId), null, 4);
            saveAs(new Blob([text]), 'models.json');
        });

        container.select('.load').node().addEventListener('change', function(e) {
            pv.readFile(e, function(text) {
                modelData = JSON.parse(text).map(id => modelLookup[id]);
                update();
            })
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
     * Sets/gets the dictionary of models (id -> model).
     */
    module.modelLookup = function(value) {
        if (!arguments.length) return modelLookup;
        modelLookup = value;
        return this;
    };

    /**
     * Sets the flag indicating data input has been changed.
     */
    module.invalidate = function() {
        dataChanged = true;
    };

    /**
     * Set brushed models.
     */
    module.setBrushed = function(value) {
        brushedModels = (value || []).map(d => modelLookup[d]);
    };

    // /**
    //  * Handles items that are brushed externally.
    //  */
    // module.handleBrush = function(ids) {
    //     itemContainer.selectAll('.item')
    //         .classed('ext-brushed', !ids ? false: d => ids.length && ids.includes(itemId(d)))
    //         .classed('non-ext-brushed', d => !ids ? false: ids.length && !ids.includes(itemId(d)));
    // };

    // /**
    //  * Handle an item that is hovered externally.
    //  */
    // module.handleHover = function(id) {
    //     itemContainer.selectAll('.item').classed('hovered', d => d.id === id);
    // };

    /**
     * Binds custom events.
     */
    module.on = function() {
        const value = listeners.on.apply(listeners, arguments);
        return value === listeners ? module : value;
    };

    return module;
};