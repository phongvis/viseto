/**
 * A visualization showing the difference between topics in mulitple models with different number of topics.
 * Data input: an array with each element detailing each model
 * - modelId
 * - topics: array of { (word, prob, color) } showing topic details
 */
pv.vis.modelTree = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 25, right: 5, bottom: 5, left: 5 },
        topicWidth = 50,
        topicHeight = 15,
        topicGap = 5,
        layerGap = 10;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        visTitle = 'Model Tree',
        minProb = 0.02;

    /**
     * Accessors.
     */
    let id = d => d.id,
        termName = d => d[0],
        termProb = d => d[1],
        termColor = d => d[2];

    /**
     * Data binding to DOM elements.
     */
    let modelData,
        treeData,
        topicLookup,
        topicData,
        lineData,
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        topicContainer;

    /**
     * D3.
     */
    const tree = d3.tree().nodeSize([topicWidth + topicGap, topicHeight + layerGap])
            .separation((a, b) => a.parent === b.parent ? 1 : 1.25),
        widthScale = d3.scaleLinear().range([0, topicWidth]).domain([0, 1]),
        listeners = d3.dispatch('click');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-model-tree');
                visContainer = container.append('g').attr('class', 'main-vis');
                topicContainer = visContainer.append('g').attr('class', 'topics');
                lineContainer = visContainer.append('g').attr('class', 'lines');

                addSettings(container);

                this.visInitialized = true;
            }

            modelData = _data;

            // Assign id for binding
            topicLookup = {};
            modelData.forEach((m, i) => {
                m.topics.forEach((topic, j) => {
                    topic.id = i + '-' + j;
                    topic.children = [];
                    topicLookup[topic.id] = topic;
                    topic.forEach((term, k) => {
                        term.id = k;
                    });
                });
            });

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
            const sumTerms = t => d3.sum(t.filter(x => termProb(x) >= minProb).map(termProb));
            const maxProb = d3.max(modelData, m => d3.max(m.topics, sumTerms));
            widthScale.domain([0, maxProb]);

            treeData = buildTree(modelData);
            treeData = tree(d3.hierarchy(treeData));
            topicData = treeData.descendants().slice(1); // Exclude the dummy root

            lineData = computeLineData(topicData);
        }

        // Updates that depend on both data and display change
        computeLayout(modelData);

        centerTree();

        /**
         * Draw.
         */
        pv.enterUpdate(topicData, topicContainer, enterTopics, updateTopics, id, 'topic');
        pv.enterUpdate(lineData, lineContainer, enterLines, updateLines, null, 'line');
    }

    function centerTree() {
        // Find tree size
        const minX = d3.min(topicData, t => t.x),
            maxX = d3.max(topicData, t => t.x) + topicWidth,
            w = maxX - minX,
            h = topicHeight + topicGap,
            t = 'translate(' + ((width - w) / 2 - minX) + ',' + -h + ')';

        topicContainer.attr('transform', t);
        lineContainer.attr('transform', t);
    }

    function addSettings(container) {
        container = container.append('foreignObject').attr('class', 'settings')
            .attr('width', '100%').attr('height', '20px')
            .append('xhtml:div').attr('class', 'vis-header');

        container.html(`
            <div class='title'>${visTitle}</div>
            <div class='setting prob'>
                Min Probability
                <input type='number' min=0.05 max=1 step=0.05 value=${minProb}></input>
            </div>
            `
        );

        // Min probability
        container.select('input[type=number]')
            .on('input', function() {
                minProb = this.value;
                dataChanged = true;
                update();
            });
    }

    function buildTree(models) {
        const root = {}; // a dummy root of the forest

        models.forEach((m, i) => {
            // Each topic in the first model is a child of the root
            if (i === 0) {
                root.children = m.topics;
                return;
            }

            // A topic c is a child of a topic p in the previous model
            // if of all topics in the previous model, p is the most similar topic to c.
            m.topics.forEach(c => {
                let minValue = Number.MAX_VALUE,
                    minTopic;

                models[i - 1].topics.forEach(p => {
                    const d = diffTopics(p, c);
                    if (d < minValue) {
                        minValue = d;
                        minTopic = p;
                    }
                });

                minTopic.children.push({ topic: c, value: minValue });
            });

            // Sort topics in the current model.
            // In fact, sort children topics in each parent topic in the previous model.
            models[i - 1].topics.forEach(topic => {
                topic.children.sort((a, b) => d3.ascending(a.value, b.value));
                topic.children = topic.children.map(t => t.topic);
            });
        });

        return root;
    }

    /**
     * Compare difference between two topics using Hellinger distance.
     */
    function diffTopics(a, b) {
        // Each topic is an array of (term, prob).
        // We need to create an array of shared terms between two given topics to make them comparable.
        const uniqueTerms = _.uniq(a.map(termName).concat(b.map(termName)));

        function toVector(topic) {
            const dict = {};
            topic.forEach(t => {
                dict[termName(t)] = termProb(t);
            });

            return uniqueTerms.map(t => dict[t] || 0);
        }

        return hellinger(toVector(a), toVector(b));
    }

    /**
     * Return the Hellinger distance between two discrete probability distributions.
     */
    function hellinger(p, q) {
        return Math.sqrt(0.5 * _.sum(_.times(p.length, i => Math.pow((Math.sqrt(p[i]) - Math.sqrt(q[i])), 2))));
    }

    /**
     * Called when new cells added.
     */
    function enterTopics(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .on('mouseover', function(d) {
                // topicContainer.selectAll('.bar rect')
                //     .style('fill', x => colorScale.domain().includes(termName(x)) ? colorScale(termName(x)) : normalFillColor);
            }).on('mouseout', function() {
            });

        container.append('rect').attr('class', 'container');
    }

    /**
     * Called when cells updated.
     */
    function updateTopics(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.attr('transform', 'translate(' + d.x + ',' + d.y + ')');

            computeBarLayout(d.data);

            const barData = d.data.filter(x => termProb(x) >= minProb);
            pv.enterUpdate(barData, container, enterBars, updateBars, id, 'bar');

            container.select('.container')
                .attr('width', topicWidth)
                .attr('height', topicHeight)
                .raise();
        });
    }

    /**
     * Called when new bars added.
     */
    function enterBars(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .on('mouseover', function(d) {
                d3.select(this).raise();

                // Hightlight same words
                topicContainer.selectAll('.bar').each(function(d2) {
                    d3.select(this).classed('hovered', termName(d2) === termName(d));
                    if (termName(d2) === termName(d)) {
                        d3.select(this).raise();
                    }
                });
            }).on('mouseout', function(d) {
                topicContainer.selectAll('.bar').classed('hovered', false).raise();
                topicContainer.selectAll('.cell').each(function() {
                    d3.select(this).select('.container').raise();
                });
            });

        container.append('rect');

        container.append('title');
    }

    /**
     * Called when bars updated.
     */
    function updateBars(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.attr('transform', 'translate(' + d.x + ',' + d.y + ')');

            container.select('rect')
                .attr('width', d.width)
                .attr('height', d.height)
                .style('fill', termColor);

            container.select('title')
                .text(termName(d) + ': ' + Math.round(termProb(d) * 100) + '%');
        });
    }

    /**
     * Called when new lines added.
     */
    function enterLines(selection) {
        selection.append('line');
    }

    /**
     * Called when lines updated.
     */
    function updateLines(selection) {
        selection.each(function(d) {
            d3.select(this).select('line')
                .attr('x1', d.source.topic.x + d.source.term.x + d.source.term.width / 2)
                .attr('y1', d.source.topic.y + topicHeight)
                .attr('x2', d.target.topic.x + d.target.term.x + d.target.term.width / 2)
                .attr('y2', d.target.topic.y);
        });
    }

    /**
     * Computes the position of each row.
     */
    function computeLayout(data) {
        data.forEach((d, i) => {
            d.x = 0;
            d.y = (topicHeight + layerGap) * i;
        });
    }

    function computeBarLayout(data) {
        let prevX = 0;
        data.forEach((d, i) => {
            d.x = prevX;
            d.y = 0;
            d.width = widthScale(termProb(d));
            d.height = topicHeight;
            prevX += d.width;
        });
    }

    /**
     * Return data bound to lines.
     * Each has { source, target }, each with { topic, term }.
     */
    function computeLineData(topics) {
        let lines = [];
        topics.filter(topic => topic.children).forEach(topic => {
            topic.children.forEach(c => {
                lines = lines.concat(findAllPairs(topic, c));
            });
        });

        return lines;
    }

    /**
     * Return all word pairs between two topics.
     */
    function findAllPairs(source, target) {
        const pairs = [];
        source.data.forEach(s => {
            target.data.forEach(t => {
                if (termName(s) === termName(t) && termProb(t) >= minProb) {
                    pairs.push({
                        source: { topic: source, term: s },
                        target: { topic: target, term: t }
                    });
                }
            });
        });

        return pairs;
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