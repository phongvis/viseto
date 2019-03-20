document.addEventListener('DOMContentLoaded', function() {
    // Instantiate vis and its parameters
    const vis = pv.vis
        .compParams()
        .values(d => d.topic_terms)
        .groupBy1(d => d.beta)
        .groupBy2(d => d.alpha);

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    // Data
    let data;

    d3.json('../../data/lee-params.json').then(json => {
        data = json;

        // Set label
        data.forEach(d => {
            d.label = '&alpha;=' + d.alpha;
        });

        // Build the vis
        update();
    });

    /**
     * Updates vis when window changed.
     */
    function update() {
        // Update size of the vis
        vis.width(window.innerWidth).height(window.innerHeight);

        // Update size of the vis container and redraw
        d3.select('.pv-vis-demo')
            .attr('width', window.innerWidth)
            .attr('height', window.innerHeight)
            .datum(data)
            .call(vis);
    }
});
