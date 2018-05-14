/**
 * A visualization showing the difference between topics in mulitple runs with different number of topics.
 * Data input: an array with each element detailing each run
 * - topics: array of { (word, prob) } showing topic details
 * - diff: 2d numerical matrix showing difference between the previous run and the current run
 */
pv.vis.topicdiff = function() {
    /**
     * Visual configs.
     */
    const margin = { top: 25, right: 5, bottom: 5, left: 5 },
        cellWidth = 50,
        cellHeight = 15,
        cellGap = 5,
        rowGap = 10,
        normalFillColor = 'hsl(0, 0%, 90%)';

    let visWidth = 960, visHeight = 600, // Size of the visualization, including margins
        width, height, // Size of the main content, excluding margins
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
        dataChanged = true; // True to redo all data-related computations

    /**
     * DOM.
     */
    let visContainer, // Containing the entire visualization
        rowContainer;

    /**
     * D3.
     */
    const listeners = d3.dispatch('click'),
        widthScale = d3.scaleLinear().range([0, cellWidth]).domain([0, 1]),
        colorScale = d3.scaleOrdinal(['#8dd3c7','#ffffb3','#bebada','#fb8072','#80b1d3','#fdb462','#b3de69','#fccde5','#bc80bd','#ccebc5']);

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(_data) {
            // Initialize
            if (!this.visInitialized) {
                visContainer = d3.select(this).append('g').attr('class', 'pv-topicdiff');
                rowContainer = visContainer.append('g').attr('class', 'rows');

                addSettings();

                this.visInitialized = true;
            }

            data = _data;

            // Assign id for binding
            data.forEach((run, i) => {
                run.id = i;
                run.topics.forEach((topic, j) => {
                    topic.id = j;
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
            sortTopics(data);
            colorScale.domain(computeTopWords(data));
            computeLineData(data);
        }

        // Updates that depend on both data and display change
        computeLayout(data);

        /**
         * Draw.
         */
        const rows = rowContainer.selectAll('.row').data(data, id);
        rows.enter().append('g').attr('class', 'row').call(enterRows)
            .merge(rows).call(updateRows);
        rows.exit().transition().attr('opacity', 0).remove();
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

    function sortTopics(runs) {
        let prevRun;

        runs.forEach((r, i) => {
            if (prevRun) {
                const mapping = greedy(r.diff);
                const newTopics = new Array(r.topics.length);

                for (k in mapping) {
                    newTopics[k] = r.topics[mapping[k]];
                }

                r.topics = newTopics;

                // Also apply the mapping for the next diff so that it can be used properly in the next run
                if (i < runs.length - 1) {
                    const nextDiff = new Array (r.topics.length);

                    for (k in mapping) {
                        nextDiff[k] = runs[i + 1].diff[mapping[k]];
                    }

                    runs[i + 1].diff = nextDiff;
                }

                // if (i < 10) testGreedy(mapping, r.diff);
            } else {
                prevRun = r;
            }
        });
    }

    /**
     * Reorder the order of columns in the given matrix so that
     * the sum of distance between all pairs (row, column) are smallest.
     * Greedy algorithm:
     *      Pick the lowest distance, fix that pair,
     *      then pick the next one that doesn't involve the two picked, and so on.
     */
    function greedy(matrix) {
        const mapping = {}, // newIndex -> oldIndex
            rowIndices = _.range(matrix.length),
            colLength = matrix[0].length,
            colIndices = _.range(colLength);

        for (let i = 0; i < colLength; i++) {
            if (i === colLength - 1) {
                // The last one has to take the remaining index
                mapping[i] = colIndices[0];
            } else {
                // Find smallest distance
                let min = Number.MAX_VALUE, rowMin, colMin;
                rowIndices.forEach(r => {
                    colIndices.forEach(c => {
                        if (matrix[r][c] < min) {
                            min = matrix[r][c];
                            rowMin = r;
                            colMin = c;
                        }
                    });
                });

                // Set the mapping
                mapping[rowMin] = colMin;

                // Delete indices so that they will be excluded next iteration
                rowIndices.splice(rowIndices.indexOf(rowMin), 1);
                colIndices.splice(colIndices.indexOf(colMin), 1);
            }
        }

        return mapping;
    }

    function testGreedy(gd, diff) {
        const bt = bruteforce(diff);

        let same = true;
        for (k in gd) {
            if (gd[k] !== bt[k]) same = false;
        }

        console.log(same);
    }

    function factorial(n) {
        if (n === 1) return [[0]];

        const newFactorial = factorial(n - 1).map(f => {
            // Insert n into each possible place of the previous factorial
            return _.range(n).map(i => {
                const tmp = _.clone(f);
                tmp.splice(i, 0, n - 1);
                return tmp;
            });
        });

        return _.flatten(newFactorial);
    }

    function bruteforce(matrix) {
        const mapping = {}, // newIndex -> oldIndex
            colLength = matrix[0].length;

        let min = Number.MAX_VALUE,
            sum = 0;
        factorial(colLength).forEach(p => {
            for (let i = 0; i < p.length - 1; i++) {
                sum += matrix[i][p[i]];
            }
            if (sum < min) {
                min = sum;
                for (let i = 0; i < p.length; i++) {
                    mapping[i] = p[i];
                }
            }

            sum = 0;
        });

        return mapping;
    }

    /**
     * Called when new rows added.
     */
    function enterRows(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0);
    }

    /**
     * Called when rows updated.
     */
    function updateRows(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            computeCellLayout(d.topics);

            const cells = container.selectAll('.cell').data(d.topics, id);
            cells.enter().append('g').attr('class', 'cell').call(enterCells)
                .merge(cells).call(updateCells);
            cells.exit().transition().attr('opacity', 0).remove();
        });
    }

    /**
     * Called when new cells added.
     */
    function enterCells(selection) {
        const container = selection
            .attr('transform', d => 'translate(' + d.x + ',' + d.y + ')')
            .attr('opacity', 0)
            .on('mouseover', function(d) {
                if (!exploringMode) return;

                // Color code all bars in the hovered cell
                colorScale.domain(d.filter(x => prob(x) >= minProb).map(term).slice(0, colorScale.range().length));
                rowContainer.selectAll('.bar rect')
                    .style('fill', x => colorScale.domain().includes(term(x)) ? colorScale(term(x)) : normalFillColor);
            }).on('mouseout', function() {
                if (!exploringMode) return;

                rowContainer.selectAll('.bar rect')
                    .style('fill', x => getFillColor(term(x)));
            });

        container.append('rect').attr('class', 'cell-border');
    }

    /**
     * Called when cells updated.
     */
    function updateCells(selection) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('transform', 'translate(' + d.x + ',' + d.y + ')')
                .attr('opacity', 1);

            computeBarLayout(d);

            const barData = d.filter(x => prob(x) >= minProb);
            const bars = container.selectAll('.bar').data(barData, id);
            bars.enter().append('g').attr('class', 'bar').call(enterBars)
                .merge(bars).call(updateBars);
            bars.exit().transition().attr('opacity', 0).remove();

            container.select('.cell-border')
                .attr('width', cellWidth)
                .attr('height', cellHeight)
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
                rowContainer.selectAll('.bar').each(function(d2) {
                    d3.select(this).classed('hovered', term(d2) === term(d));
                    if (term(d2) === term(d)) {
                        d3.select(this).raise();
                    }
                });
            }).on('mouseout', function(d) {
                rowContainer.selectAll('.bar').classed('hovered', false).raise();
                rowContainer.selectAll('.cell').each(function() {
                    d3.select(this).select('.cell-border').raise();
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

            const lineData = d.lines ? d.lines.filter(l => prob(l) >= minProb) : [];
            const lines = container.selectAll('.line').data(lineData);
            lines.enter().append('g').attr('class', 'line').call(enterLines)
                .merge(lines).call(updateLines, d);
            lines.exit().transition().attr('opacity', 0).remove();
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
    function updateLines(selection, source) {
        selection.each(function(d) {
            const container = d3.select(this);

            // Transition location & opacity
            container.transition()
                .attr('opacity', 1);

            container.select('line')
                .attr('x1', source.width / 2)
                .attr('y1', 0)
                .attr('x2', d.x + d.width / 2 - source.x)
                .attr('y2', -rowGap);
        });
    }

    /**
     * Computes the position of each row.
     */
    function computeLayout(data) {
        data.forEach((d, i) => {
            d.x = 0;
            d.y = (cellHeight + rowGap) * i;
        });
    }

    function computeCellLayout(data) {
        data.forEach((d, i) => {
            d.x = (cellWidth + cellGap) * i;
            d.y = 0;
        });
    }

    function computeBarLayout(data) {
        let prevX = 0;
        data.forEach((d, i) => {
            d.x = prevX;
            d.y = 0;
            d.width = widthScale(prob(d));
            d.height = cellHeight;
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
        return !exploringMode && colorCodeTopWords && colorScale.domain().includes(word) ? colorScale(word) : normalFillColor;
    }

    function computeLineData(data) {
        let prevTopics;

        data.forEach(d => { // Each run
            if (prevTopics) {
                d.topics.forEach((t, i) => {
                    if (i === d.topics.length - 1) return;

                    // Check with the corresponding topic in the previous run
                    findAllPairs(prevTopics[i], t);
                });
            }

            prevTopics = d.topics;
        });
    }

    /**
     * Return all word pairs between two topics.
     */
    function findAllPairs(t1, t2) {
        const pairs = [];
        t1.forEach(w1 => {
            t2.forEach(w2 => {
                if (term(w1) === term(w2)) {
                    w2.lines = [ w1 ];
                }
            });
        });
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