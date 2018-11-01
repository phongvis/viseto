document.addEventListener('DOMContentLoaded', async function() {
    const metricLookup = {}; // model -> metrics
    const infoLookup = {}; // model -> info

    // Model collection
    const mcContainer = d3.select('.viseto-model-collection'),
        mcVis = pv.vis.modelCollection()
            .modelLookup(metricLookup);
            // .on('brush', onBrushed)
            // .on('hover', onHovered);

    // Parallel metrics
    const pmContainer = d3.select('.viseto-parallel-metrics'),
        pmVis = pv.vis.parallelMetrics()
            .on('brush', onBrushed)
            .on('hover', onHovered);
    let pmData;

    // Topic models
    const tmContainer = d3.select('.viseto-topic-models'),
        tmVis = pv.vis.topicModels()
            .on('brush', onBrushed)
            .on('hover', onHovered)
            .on('click', onClicked);
    let tmData;

    // Subgroups
    const sgContainer = d3.select('.viseto-subgroups'),
        sgVis = pv.vis.subgroups()
            .on('brush', onBrushed)
            .on('hover', onHovered);
    let sgData;

    // Model topics
    const mtContainer = d3.select('.viseto-topics'),
        mtVis = pv.vis.topics();
    let mtData;

    // Linked views management
    const views = [pmVis, tmVis, sgVis];

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    // Load data
    processAnalysisMetrics(await d3.json('../../data/lee-analysis-metrics.json'));
    processTopics(await d3.json('../../data/lee-topics.json'));

    // Build the vises
    update();

    function processAnalysisMetrics(data) {
        const metrics = [
            { name: 'perplexity', label: 'perplexity' },
            { name: 'u_mass', label: 'u_mass' },
            { name: 'c_v', label: 'c_v' },
            { name: 'c_uci', label: 'c_uci' },
            { name: 'c_npmi', label: 'c_npmi' },
            { name: 'c_w2v', label: 'c_w2v' }
        ];

        tmData = pmData = {
            metrics: metrics,
            models: data.metrics
        };

        // ID, tooltip
        pmData.models.forEach(m => {
            m.tooltip = `alpha: ${m.alpha}\nbeta: ${m.beta}\n# topics: ${m.num_topics}\nmean rank: ${m.mean_rank.toFixed(1)}\nbest rank: ${m.best_rank}`;
            metricLookup[m.modelId] = m;
        });

        const extraMetrics = [
            { name: 'mean_rank', label: 'mean rank' },
            { name: 'best_rank', label: 'best rank' }
        ];

        sgData = {
            metrics: extraMetrics.concat(metrics),
            items: data.ranks
        };
    }

    function processTopics(data) {
        data.forEach(m => {
            infoLookup[m.modelId] = m;
        });

        // Test by intially showing the first model
        mtData = data[0];
    }

    /**
     * Updates vises when window changed.
     */
    function update() {
        redrawView(mcContainer, mcVis);
        redrawView(pmContainer, pmVis, pmData);
        redrawView(tmContainer, tmVis, tmData);
        redrawView(sgContainer, sgVis, sgData);
        redrawView(mtContainer, mtVis, mtData);
    }

    function redrawView(container, vis, data, invalidated) {
        const rect = pv.getContentRect(container.node());
        vis.width(rect[0]).height(rect[1]);
        if (invalidated) vis.invalidate();
        container.datum(data).call(vis);
    }

    /**
     * One view brushes, other views respond.
     */
    function onBrushed(ids) {
        views.filter(v => v !== this).forEach(v => {
            if (v.handleBrush) v.handleBrush(ids);
        });

        mcVis.setBrushed(ids);
    }

    /**
     * One view hovers, other views respond.
     */
    function onHovered(id) {
        views.filter(v => v !== this).forEach(v => {
            if (v.handleHover) v.handleHover(id);
        });
    }

    /**
     * One view clicks, other views respond.
     */
    function onClicked(id) {
        // Only the model topics view needs to respond: show topics of that model
        mtData = infoLookup[id];
        redrawView(mtContainer, mtVis, mtData, true);
    }
});