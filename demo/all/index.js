document.addEventListener('DOMContentLoaded', function() {
    // Parallel metrics
    const pmContainer = d3.select('.viseto-parallel-metrics'),
        pmVis = pv.vis.parallelMetrics();
    let pmData;

    // Topic models
    const tmContainer = d3.select('.viseto-topic-models'),
        tmVis = pv.vis.topicModels();
    let tmData;

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    d3.json('../../data/lee-metrics.json').then(data => {
        tmData = pmData = {
            metrics: [
                { name: 'perplexity', label: 'perplexity' },
                { name: 'u_mass', label: 'u_mass' },
                { name: 'c_v', label: 'c_v' },
                { name: 'c_uci', label: 'c_uci' },
                { name: 'c_npmi', label: 'c_npmi' },
                { name: 'c_w2v', label: 'c_w2v' }
            ],
            models: data
        };

        pmData.models.forEach(m => {
            m.modelId = m.alpha + '-' + m.beta + '-' + m.num_topics;
            m.tooltip = `alpha: ${m.alpha}\nbeta: ${m.beta}\n# topics: ${m.num_topics}`;
        });

        // Build the vises
        update();
    });

    /**
     * Updates vises when window changed.
     */
    function update() {
        redrawView(pmContainer, pmVis, pmData);
        redrawView(tmContainer, tmVis, tmData);
    }

    function redrawView(container, vis, data) {
        const rect = pv.getContentRect(container.node());
        vis.width(rect[0]).height(rect[1]);
        container.datum(data).call(vis);
    }
});