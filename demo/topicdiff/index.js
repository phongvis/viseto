document.addEventListener('DOMContentLoaded', function() {
    // Instantiate vis and its parameters
    const vis = pv.vis.topicdiff()
        .term(d => d[0])
        .prob(d => d[1]);

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    // Data
    let data;

    d3.json('../../data/lss-17k-diff-topics-20.json').then(json => {
        // d3.json('../../data/lee-k-20topics.json').then(json => {
        // data = json.slice(5, 15);
        data = json;

        // Build the vis
        update();
    });

    /**
     * Updates vis when window changed.
     */
    function update() {
        // Update size of the vis
        vis.width(window.innerWidth)
            .height(window.innerHeight);

        // Update size of the vis container and redraw
        d3.select('.pv-vis-demo')
            .attr('width', window.innerWidth)
            .attr('height', window.innerHeight)
            .datum(data)
            .call(vis);
    }
});