/**
 * A glyph for topic model.
 */
pv.vis.modelGlyph = function() {
    let radius = 16,
        modelParams = {
            'alpha': [0.01, 0.1, 1, 10],
            'beta': [0.01, 0.1, 1, 10],
            'num_topics': [5, 10, 15, 20]
        }, paramList = ['alpha', 'beta', 'num_topics'],
        numLevels = modelParams['alpha'].length,
        numParams = paramList.length;

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(d) {
            // Pie, one for each param
            const levelRadius = radius / numLevels,
                paramAngle = Math.PI * 2 / numParams;

            _.times(numParams, i => {
                let p = paramList[i],
                    paramValueIdx = modelParams[p].indexOf(d[p]),
                    emptyFill = paramValueIdx === -1;

                // If the param is missing, show as the biggest but with empty fill.
                if (paramValueIdx === -1) paramValueIdx = modelParams[p].length - 1;

                const arc = d3.arc()
                    .innerRadius(0)
                    .outerRadius((paramValueIdx + 1) * levelRadius)
                    .startAngle(paramAngle * i)
                    .endAngle(paramAngle * (i + 1));
                d3.select(this).append('path')
                    .attr('class', 'pv-model-glyph')
                    .classed('no-fill', emptyFill)
                    .attr('d', arc);
            });
        });
    }

    module.radius = function(value) {
        if (!arguments.length) return radius;
        radius = value;
        return this;
    };

    return module;
};