/**
 * Visualisation of topics from a model.
 * Data input:
 * - corpusSize: the number of documents in the corpus
 * - topics: array of { [name, prob, color] }
 * - counts: array of { name as [topic1, topic2], value }
 */
pv.vis.topics = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 25, right: 5, bottom: 5, left: 5 },
        topicHeight = 25,
        pieRadius = 10,
        maxBarWidth = 40,
        maxBarHeight = 10,
        arcHeightRatio = 0.8;

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
        allTermsWidth,
        visTitle = 'Model Topics';

    /**
     * Accessors.
     */
    let termName = d => d[0],
        termProb = d => d[1],
        termColor = d => d[2];

    /**
     * Data binding to DOM elements.
     */
    let topicData = [],
        countData = [],
        pairCountData = [],
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        topicContainer,
        pairContainer;

    /**
     * D3.
     */
    const arc = d3.arc().innerRadius(0).outerRadius(pieRadius),
        pie = d3.pie().sort(null),
        lengthScale = d3.scaleLinear().range([0, maxBarWidth]),
        arcScale = d3.scaleLinear().range([0, maxBarHeight * arcHeightRatio]),
        colorScale = x => {
            const c = d3.rgb(termColor(x));
            // c.opacity = 0.5;
            return c;
        }, listeners = d3.dispatch('click');

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                const container = d3.select(this).append('g').attr('class', 'pv-topics');
                visContainer = container.append('g').attr('class', 'main-vis');
                topicContainer = visContainer.append('g').attr('class', 'topics');
                pairContainer = visContainer.append('g').attr('class', 'pairs');
                pairContainer.append('clipPath')
                    .attr('id', 'clip')
                    .append('rect');

                addSettings(container);

                this.visInitialized = true;
            }

            topicData = _data.topics;
            countData = _data.counts;
            pairCountData = buildPairCountData();
            lengthScale.domain([0, _data.corpusSize]);

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
        allTermsWidth = width / 2;

        visContainer.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        pairContainer.attr('transform', 'translate(' + (topicHeight + pieRadius * 2 + allTermsWidth + maxBarWidth) + ',0)');

        /**
         * Computation.
         */
        // Updates that depend only on data change
        if (dataChanged) {
            arcScale.domain([0, d3.max(pairCountData, d => d.value)]);
        }

        // Updates that depend on both data and display change
        layoutTopics();
        layoutPairs();

        pv.enterUpdate(topicData, topicContainer, enterTopics, updateTopics, null, 'topic');
        pv.enterUpdate(pairCountData, pairContainer, enterPairs, updatePairs, d => d.id, 'pair');
    }

    function enterTopics(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        // Term probabilities
        container.append('g').attr('class', 'probs')
            .attr('transform', 'translate(' + pieRadius + ',' + pieRadius + ')')
            .append('circle')
                .attr('r', pieRadius)
                .style('fill', 'none')
                .style('stroke', 'hsl(0, 0%, 90%)');

        // Term names
        container.append('foreignObject').attr('width', '100%').attr('height', topicHeight)
            .attr('transform', 'translate(' + topicHeight + ',0)')
            .append('xhtml:div')
                .attr('class', 'topic-words');

        // Topic size
        const count = container.append('g').attr('class', 'count');
        count.append('rect').attr('class', 'foreground');
        count.append('rect').attr('class', 'background');
    }

    function updateTopics(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            // Draw pie chart for term probabilities
            const values = d.map(termProb);
            values.push(1 - d3.sum(values));
            const arcs = pie(values);
            const probs = container.select('.probs').selectAll('.term').data(arcs);
            probs.enter().append('path').attr('class', 'term')
                .merge(probs)
                    .attr('d', arc)
                    .style('fill', (x, i) => i === values.length - 1 ? 'none' : i % 2 ? 'hsl(0, 0%, 80%)' : 'hsl(0, 0%, 0%)');

            // Draw term names
            container.select('.topic-words').style('width', allTermsWidth + 'px');
            const names = container.select('.topic-words').selectAll('.term').data(d);
            names.enter().append('div').attr('class', 'term')
                .merge(names)
                    .text(termName)
                    .style('background-color', colorScale);

            // Draw topic size
            container.select('.count')
                .attr('transform', 'translate(' + (topicHeight + pieRadius + allTermsWidth) + ',' + (pieRadius - maxBarHeight / 2) + ')');
            container.select('.count .background')
                .attr('width', maxBarWidth)
                .attr('height', maxBarHeight);
            container.select('.count .foreground')
                .attr('width', lengthScale(findTopicSize(i)))
                .attr('height', maxBarHeight);
        });
    }

    function findTopicSize(i) {
        const d = countData.find(x => x[0].length === 1 && x[0][0] === i);
        return d ? d[1] : 0;
    }

    function enterPairs(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 1);

        container.append('clipPath')
            .attr('id', d => 'clip' + d.id)
            .append('rect')
                .attr('width', width)
                .attr('height', height);

        container.append('path')
            .attr('clip-path', d => 'url(#clip' + d.id + ')');
    }

    function updatePairs(selection) {
        selection.each(function(d, i) {
            const container = d3.select(this);

            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            container.select('clipPath rect')
                .attr('x', d => -d.x)
                .attr('y', d => -d.y);

            const arc = d3.arc()
                .innerRadius(d.r - d.width / 2)
                .outerRadius(d.r + d.width / 2)
                .startAngle(0)
                .endAngle(Math.PI);

            container.select('path')
                .attr('d', arc);
        });
    }

    function buildPairCountData() {
        return countData
            .filter(x => x[0].length === 2)
            .map(x => ({
                id: x[0].join('-'),
                i1: x[0][0],
                i2: x[0][1],
                value: x[1]
            }));
    }

    function layoutTopics() {
        topicData.forEach((d, i) => {
            d.x = 0;
            d.y = topicHeight * i;
        });
    }

    // Find the centres to draw arcs
    function layoutPairs() {
        pairCountData.forEach(p => {
            p.r = (topicData[p.i2].y - topicData[p.i1].y) / 2 / arcHeightRatio;
            p.x = -Math.sqrt(1 - arcHeightRatio * arcHeightRatio) * p.r;
            p.y = (topicData[p.i1].y + topicData[p.i2].y) / 2 + 10; // 10 is half of the topic text height
            p.width = arcScale(p.value);
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