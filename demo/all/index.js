document.addEventListener('DOMContentLoaded', function() {
    // Parallel metrics
    const pmContainer = d3.select('.viseto-parallel-metrics'),
        pmVis = pv.vis.parallelMetrics()
            .on('brush', onBrushed);
    let pmData;

    // Topic models
    const tmContainer = d3.select('.viseto-topic-models'),
        tmVis = pv.vis.topicModels();
    let tmData;

    // Linked views management
    const views = [pmVis, tmVis];

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    d3.json('../../data/lee-metrics.json').then(data => {
        processData(data);

        // Build the vises
        update();
    });

    function processData(data) {
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

        // Assign rank per metric for each data point
        pmData.metrics.forEach(t => {
            const sortedData = data.map(d => d[t.name]).sort(d3.descending);
            data.forEach(d => {
                d[t.name + '-rank'] = sortedData.indexOf(d[t.name]);
            });
        });

        // Average rank
        data.forEach(d => {
            d.meanRank = _.mean(_.filter(d, (v, k) => k.includes('-rank'))).toFixed(1);
            d.bestRank = _.min(_.filter(d, (v, k) => k.includes('-rank')));
        });
    }

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

    /**
     * One view brushes, other views respond.
     */
    function onBrushed(ids) {
        views.filter(v => v !== this).forEach(v => {
            if (v.handleBrush) v.handleBrush(ids);
        });
    }
});