document.addEventListener('DOMContentLoaded', function() {
    // Instantiate vis and its parameters
    const visDocTopics = pv.vis.compParams()
        .values(d => d.doc_topics)
        .visTitle('Document Topics')
        .minValue(0.1)
        .termLabels(['documents', 'topics'])
        .minProbLabel('Min Topic Probability');
    const visTopicTerms = pv.vis.compParams()
        .values(d => d.topic_terms)
        .visTitle('Topic Terms')
        .minValue(0.02)
        .termLabels(['topics', 'terms'])
        .minProbLabel('Min Term Probability');

    // Make the vis responsive to window resize
    window.onresize = _.throttle(update, 100);

    // Data
    let data;

    d3.json('../../data/lee-params.json').then(json => {
        data = json;

        // Build the vis
        update();
    });

    /**
     * Updates vis when window changed.
     */
    function update() {
        // Update size of the vis
        let rect = pv.getContentRect(document.querySelector('.doc-topics'));
        visDocTopics.width(rect[0]).height(rect[1]);
console.log(rect);

        rect = pv.getContentRect(document.querySelector('.topic-terms'));
        visTopicTerms.width(rect[0]).height(rect[1]);

        // Update size of the vis container and redraw
        d3.select('.doc-topics')
            .datum(data)
            .call(visDocTopics);
        d3.select('.topic-terms')
            .datum(data)
            .call(visTopicTerms);
    }
});