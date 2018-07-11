/**
 * The global object for the project.
 */
window.pv = function() {
	const pv = {
		vis: {}
	};

	/**
	 * Execute enter-update-exit pipeline to bind data to a container.
	 */
	pv.enterUpdate = function(data, container, enter, update, key, classname) {
        const items = container.selectAll('.' + classname).data(data, key);
		items.enter().append('g').attr('class', classname).call(enter)
			.merge(items).call(update);
        items.exit().transition().attr('opacity', 0).remove();
	}

	/**
	 * Return [width, height] of the bounding rectangle, excluding padding and border.
	 */
	pv.getContentRect = function(element) {
		const cs = getComputedStyle(element),
			pad = (parseInt(cs.paddingTop) + parseInt(cs.borderTopWidth)) * 2,
			rect = element.getBoundingClientRect();
		return [rect.width - pad, rect.height - pad];
	}

    return pv;
}();