document.addEventListener('DOMContentLoaded', function() {
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
            .on('hover', onHovered);
    let tmData;

    // Subgroups
    const sgContainer = d3.select('.viseto-subgroups'),
        sgVis = pv.vis.subgroups()
            .on('brush', onBrushed)
            .on('hover', onHovered);
    let sgData;

    // Linked views management
    const views = [pmVis, tmVis, sgVis];

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    d3.json('../../data/lee-analysis-metrics.json').then(data => {
        processData(data);

        // Build the vises
        update();
    });

    function processData(data) {
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
            m.modelId = m.alpha + '-' + m.beta + '-' + m.num_topics;
            m.tooltip = `alpha: ${m.alpha}\nbeta: ${m.beta}\n# topics: ${m.num_topics}\nmean rank: ${m.mean_rank.toFixed(1)}\nbest rank: ${m.best_rank}`;
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

    /**
     * Updates vises when window changed.
     */
    function update() {
        redrawView(pmContainer, pmVis, pmData);
        redrawView(tmContainer, tmVis, tmData);
        redrawView(sgContainer, sgVis, sgData);
    }

    function redrawView(container, vis, data) {
        const rect = pv.getContentRect(container.node());
        vis.width(rect[0]).height(rect[1]);
        container.datum(data).call(vis);
    }

    /**
     * One view brushes, other views respond.
     */
    function onBrushed(ids) {
        views.filter(v => v !== this).forEach(v => {
            if (v.handleBrush) v.handleBrush(ids);
        });
    }

    /**
     * One view hovers, other views respond.
     */
    function onHovered(id) {
        views.filter(v => v !== this).forEach(v => {
            if (v.handleHover) v.handleHover(id);
        });
    }
});