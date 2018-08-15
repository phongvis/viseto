/**
 * A visualization showing the difference between topics in mulitple models with different number of topics.
 * Data input: an array with each element detailing each model
 * - topics: array of { (word, prob) } showing topic details
 * - diff: 2d numerical matrix showing difference between the previous model and the current model
 */
pv.vis.topicdiff = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 25, right: 5, bottom: 5, left: 5 },
        topicWidth = 50,
        topicHeight = 15,
        topicGap = 5,
        layerGap = 10,
        normalFillColor = 'hsl(0, 0%, 90%)';

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        colorMap,
        colorCodeTopWords = true,
        exploringMode = false,
        minProb = 0.1;

    /**
     * Accessors.
     */
    let id = d => d.id,
        term = d => d.term,
        prob = d => d.prob;

    /**
     * Data binding to DOM elements.
     */
    let data,
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
        colorScale = d3.scaleOrdinal(['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#bc80bd','#ccebc5']),
        listeners = d3.dispatch('click');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                visContainer = d3.select(this).append('g').attr('class', 'pv-topicdiff');
                topicContainer = visContainer.append('g').attr('class', 'topics');
                lineContainer = visContainer.append('g').attr('class', 'lines');

                addSettings();

                this.visInitialized = true;
            }

            data = _data;

            // Assign id for binding
            topicLookup = {};
            data.forEach((model, i) => {
                model.id = i;
                model.topics.forEach((topic, j) => {
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
            colorScale.domain(computeTopWords(data));

            treeData = buildTree(data);
            treeData = tree(d3.hierarchy(treeData));
            topicData = treeData.descendants().slice(1); // Exclude the dummy root

            lineData = computeLineData(topicData);
        }

        // Updates that depend on both data and display change
        computeLayout(data);

        centerTree();

        /**
         * Draw.
         */
        const topics = topicContainer.selectAll('.topic').data(topicData, id);
        topics.enter().append('g').attr('class', 'topic').call(enterTopics)
            .merge(topics).call(updateTopics);
        topics.exit().transition().attr('opacity', 0).remove();

        const lines = lineContainer.selectAll('.line').data(lineData);
        lines.enter().append('g').attr('class', 'line').call(enterLines)
            .merge(lines).call(updateLines);
        lines.exit().transition().attr('opacity', 0).remove();
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

    function addSettings() {
        const container = visContainer.append('foreignObject').attr('class', 'settings')
            .attr('transform', 'translate(0,' + -margin.top + ')')
            .attr('width', '100%').attr('height', '100%');

        // Min probability
        let div = container.append('xhtml:div').attr('class', 'prob');
        div.append('xhtml:label')
            .attr('for', 'prob')
            .text('Min Probability');
        div.append('xhtml:input')
            .attr('type', 'number')
            .attr('id', 'prob')
            .style('margin-left', '5px')
            .attr('min', 0.05)
            .attr('max', 1)
            .attr('value', minProb)
            .attr('step', 0.05)
            .on('input', function() {
                minProb = this.value;
                dataChanged = true;
                update();
            });

        // Color code
        div = container.append('xhtml:div').attr('class', 'color-code');
        div.append('xhtml:input')
            .attr('type', 'checkbox')
            .attr('id', 'color-code')
            .attr('checked', colorCodeTopWords || undefined)
            .on('change', function() {
                colorCodeTopWords = this.checked;
                update();
            });
        div.append('xhtml:label')
            .attr('for', 'color-code')
            .text('Colour-code Common Words');

        // Exploration mode
        div = container.append('xhtml:div').attr('class', 'exploration');
        div.append('xhtml:input')
            .attr('type', 'checkbox')
            .attr('id', 'exploration')
            .attr('checked', exploringMode || undefined)
            .on('change', function() {
                exploringMode = this.checked;
                colorScale.domain(computeTopWords(data));
                update();
            });
        div.append('xhtml:label')
            .attr('for', 'exploration')
            .text('Explore Topics');
    }

    function buildTree(models) {
        const root = {}; // a dummy root of the forest

        models.forEach((m, i) => {
            // Each topic in the first model is a child of the root
            if (i === 0) {
                root.children = m.topics;
                return;
            }

            // // A topic c is a child of a topic p in the previous model
            // // if of all topics in the previous model, p is the most similar topic to c.
            // for (let c = 0; c < m.diff[0].length; c++) { // each topic in the current model
            //     let min = Number.MAX_VALUE,
            //         minIdx;

            //     for (let p = 0; p < m.diff.length; p++) { // each topic in the previous model
            //         if (m.diff[p][c] < min) {
            //             min = m.diff[p][c];
            //             minIdx = p;
            //         }
            //     };

            //     models[i - 1].topics[minIdx].children.push({ topic: m.topics[c], value: min });
            // }

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

    function printMatrix(matrix) {
        matrix.forEach(row => {
            console.log(row.map(col => col.toFixed(2)).join(' '));
        });
    }

    /**
     * Return the Hellinger distance between two discrete probability distributions.
     */
    function hellinger(p, q) {
        return Math.sqrt(0.5 * _.sum(_.times(p.length, i => Math.pow((Math.sqrt(p[i]) - Math.sqrt(q[i])), 2))));
    }

    /**
     * Compare difference between two topics using Hellinger distance.
     */
    function diffTopics(a, b) {
        // Each topic is an array of (term, prob).
        // We need to create an array of shared terms between two given topics to make them comparable.
        const uniqueTerms = _.uniq(a.map(term).concat(b.map(term)));

        function toVector(topic) {
            const dict = {};
            topic.forEach(t => {
                dict[term(t)] = prob(t);
            });

            return uniqueTerms.map(t => dict[t] || 0);
        }

        return hellinger(toVector(a), toVector(b));
    }

    /**
     * Called when new cells added.
     */
    function enterTopics(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0)
            .on('mouseover', function(d) {
                if (!exploringMode) return;

                // Color code all bars in the hovered cell
                colorScale.domain(d.filter(x => prob(x) >= minProb).map(term).slice(0, colorScale.range().length));
                topicContainer.selectAll('.bar rect')
                    .style('fill', x => colorScale.domain().includes(term(x)) ? colorScale(term(x)) : normalFillColor);
            }).on('mouseout', function() {
                if (!exploringMode) return;

                topicContainer.selectAll('.bar rect')
                    .style('fill', x => getFillColor(term(x)));
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
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            computeBarLayout(d.data);

            const barData = d.data.filter(x => prob(x) >= minProb);
            const bars = container.selectAll('.bar').data(barData, id);
            bars.enter().append('g').attr('class', 'bar').call(enterBars)
                .merge(bars).call(updateBars);
            bars.exit().transition().attr('opacity', 0).remove();

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
            .attr('opacity', 0)
            .on('mouseover', function(d) {
                d3.select(this).raise();

                // Hightlight same words
                topicContainer.selectAll('.bar').each(function(d2) {
                    d3.select(this).classed('hovered', term(d2) === term(d));
                    if (term(d2) === term(d)) {
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
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('rect')
                .attr('width', d.width)
                .attr('height', d.height)
                .style('fill', getFillColor(term(d)));

            container.select('title')
                .text(term(d) + ': ' + Math.round(prob(d) * 100) + '%');
        });
    }

    /**
     * Called when new lines added.
     */
    function enterLines(selection) {
        const container = selection
            .attr('opacity', 0);

        container.append('line');
    }

    /**
     * Called when lines updated.
     */
    function updateLines(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('opacity', 1);

            container.select('line')
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

    function computeCellLayout(data) {
        data.forEach((d, i) => {
            d.x = (topicWidth + topicGap) * i;
            d.y = 0;
        });
    }

    function computeBarLayout(data) {
        let prevX = 0;
        data.forEach((d, i) => {
            d.x = prevX;
            d.y = 0;
            d.width = widthScale(prob(d));
            d.height = topicHeight;
            prevX += d.width;
        });
    }

    function computeTopWords(data) {
        const wordLookup = {}; // word, total probability
        data.forEach(d => {
            d.topics.forEach(t => {
                t.forEach(w => {
                    if (!wordLookup[term(w)]) wordLookup[term(w)] = 0;
                    wordLookup[term(w)] += prob(w);
                });
            });
        });

        const topWords = _.orderBy(_.entries(wordLookup), d => d[1], 'desc');
        return topWords.slice(0, 10).map(w => term(w));
    }

    function getFillColor(word) {
        // return colorMap[word];
        return !exploringMode && colorCodeTopWords && colorScale.domain().includes(word) ? colorScale(word) : normalFillColor;
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
                if (term(s) === term(t) && prob(t) >= minProb) {
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
     * Sets/gets the `term` attriute of the object.
     */
    module.term = function(value) {
        if (!arguments.length) return term;
        term = value;
        return this;
    };

    /**
     * Sets/gets the `probability` attriute of the object.
     */
    module.prob = function(value) {
        if (!arguments.length) return prob;
        prob = value;
        return this;
    };

    /**
     * Sets/gets the color mapping.
     */
    module.colorMap = function(value) {
        if (!arguments.length) return colorMap;
        colorMap = value;
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