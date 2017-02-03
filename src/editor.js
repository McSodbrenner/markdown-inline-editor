/*
Todo:
Erlauben, den ganzen raw-Text auf einmal zu bearbeiten. Nett um Copy&paste und das Bearbeiten von großen Blöcken zu ermöglichen
Wie verhalten sich Footnotes?

*/

/*
 * private methods start with "_"
 * not project specific helper methods start with "__"
 * [DOMElement].markdown contains the unrendered markup
*/

function Editor(view, input, renderer_callback) {
	var KEY_BACKSPACE	= 8;
	var KEY_ENTER		= 13;
	var KEY_ESCAPE		= 27;
	var KEY_LEFT		= 37;
	var KEY_UP			= 38;
	var KEY_RIGHT		= 39;
	var KEY_DOWN		= 40;
	var KEY_DELETE		= 46;

	// the index of the currently edited block
	var current_index;

	// the position of the cursor before the current position
	var cursor_position_last = null;

	// information about the rows of the current edited block
	var cursor_row;

	(function _init() {
		// trim input
		input = _cleanMarkup(input);

		if (input === '') {
			input = 'Start writing here ...';
		}

		// split input into clean chunks
		chunks = _splitIntoChunks(input);

		// remove content from view element
		view.innerHTML = '';

		// create a div for every chunk and save the text in the markdown attribute
		chunks.forEach(function(text, index){
			var div = document.createElement('div');
			div.markdown = text;
			view.appendChild(div);
			_stopEditingAndRender(index);
		});

		// edit on click
		__addEventDelegation(view, 'DIV', 'click', function(){
			_startEditing(__domIndexOf(this));
			_handleWysiwyg();
			cursor_row = _getCursorRow(this);
		});

		// render on focusout
		__addEventDelegation(view, 'DIV', 'focusout', function(){
			_stopEditingAndRender(__domIndexOf(this));
			_handleWysiwyg();
		});

		// move with the cursor on keydown
		__addEventDelegation(view, 'DIV', 'keydown', function(e){
			_keydown.call(this, e);
			cursor_row = _getCursorRow(this);
			_handleWysiwyg();
		});

		// edit the content on keyup
		__addEventDelegation(view, 'DIV', 'keyup', function(e){
			cursor_row = _getCursorRow(this);
			_keyup.call(this, e);
			_handleWysiwyg();
		});
	})();

	function _splitIntoChunks(input) {
		// could be as simple as that if there were no code fences
		var chunks = input.split(/\n{2,}/);

		// if we first encounter a code block starter we have to set the chunk as target for following codeblocks
		var target = false;

		// take care of code blocks
		// if there are chunks with only one code block marker we have to merge it with the next chunk
		for (var i=0; i<chunks.length; i++) {
			var match = chunks[i].match(/~~~|```/g);

			// copy content to the "target" block
			if (target !== false) {
				chunks[target] += '\n\n' + chunks[i];
				chunks[i] = '';
			}

			if (match !== null && match.length === 1) {
				if (target === false) {
					// set the current chunk as target for the next blocks belonging to this code block
					target = i;
				} else {
					// stop copying to the "target" block (code block is at its end)
					target = false;
				}
			}
		}

		// remove empty values
		chunks = chunks.filter(function(n){ return n !== '' });

		return chunks;
	}

	function _startEditing(index) {
		// define lower and upper bounds and set the current index
		current_index = Math.min(view.children.length-1, Math.max(0, index));

		var block = view.children[current_index];

		if (block.hasAttribute('contenteditable')) return false;
		block.setAttribute('contenteditable', true);
		block.textContent = block.markdown;
		block.focus();
	}

	function _stopEditingAndRender(index) {
		var block = view.children[index];
		block.removeAttribute('contenteditable');
		block.markdown = _cleanMarkup(block.markdown);
		block.innerHTML = renderer_callback(block.markdown);

		// remove empty blocks
		if (block.markdown === '') {
			view.removeChild(block);
		}
	}

	function _cleanMarkup(string) {
		return string
			.replace(/\r/g, '') // remove Carriage Return linebreaks
			.replace(/(^\n+|\n+$)/g, ''); // remove lines breaks at the beginning or the end
	}

	// returns the position of the cursor within a contenteditable field that also includes html elements
	function _getCursorPosition(element) {
		var sel = window.getSelection();
		if (sel.rangeCount === 0) return 0;

		var range = sel.getRangeAt(0);
		var preCaretRange = range.cloneRange();
		preCaretRange.selectNodeContents(element);
		preCaretRange.setEnd(range.endContainer, range.endOffset);
		var position = preCaretRange.toString().length;
		return position;
	};

	// set the cursor position in the currently active element
	function _setCursorPosition(position) {
		var sel = window.getSelection();
		if (sel.rangeCount === 0) return;

		var range = sel.getRangeAt(0);
		range.setStart(range.startContainer, position);
		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
	};

	function _insertAtCursorPosition(string) {
		var sel = window.getSelection();
		if (sel.rangeCount === 0) return 0;

		var range = sel.getRangeAt(0);
		var text = document.createTextNode(string);
		range.insertNode(text);
	}

	function _keydown(e) {
		var block			= this;
		var cursor_position	= _getCursorPosition(block);
		var text_length		= block.textContent.length;

		if (e.keyCode === KEY_ENTER && cursor_position === 0) {
			e.preventDefault();

		// navigating between the blocks
		} else if (e.keyCode === KEY_DOWN && cursor_row.last) {
			_startEditing(current_index+1);
			e.preventDefault(); // do not execute keyup

		} else if (e.keyCode === KEY_RIGHT && cursor_position === text_length && cursor_position === cursor_position_last) {
			_startEditing(current_index+1);
			e.preventDefault(); // do not execute keyup

		} else if (e.keyCode === KEY_UP && cursor_row.first && current_index > 0) {
			_startEditing(current_index-1);
			_setCursorPosition(view.children[current_index].markdown.length);
			e.preventDefault(); // do not execute keyup

		} else if (e.keyCode === KEY_LEFT && cursor_position === 0 && cursor_position === cursor_position_last && current_index > 0) {
			_startEditing(current_index-1);
			_setCursorPosition(view.children[current_index].markdown.length);
			e.preventDefault(); // do not execute keyup
		}
	}

	function _getCursorRow(block) {
		view.children[current_index];

		// get styles of the contenteditable element
		var styles = window.getComputedStyle(block);

		// create the mirror and append it to the body
		var mirror = document.createElement('div');
		mirror.style.visibility		= 'hidden';
		mirror.style.whiteSpace		= 'pre-wrap';
		mirror.style.padding		= styles.getPropertyValue('padding');
		mirror.style.width			= styles.getPropertyValue('width');
		mirror.style.fontFamily		= styles.getPropertyValue('font-family');
		mirror.style.fontSize		= styles.getPropertyValue('font-size');
		mirror.style.lineHeight		= styles.getPropertyValue('line-height');
		document.body.appendChild(mirror);

		// if there is no line-height set (and we need it), we set it to the value of "normal"
		if (mirror.style.lineHeight === 'normal') {
			block.style.lineHeight = '1.14rem';
			mirror.style.lineHeight = styles.getPropertyValue('line-height');
		}

		// create the content for the mirror
		position = _getCursorPosition(block);
		var text = block.innerText.substring(0, position);

		// add the complete current word otherwise it could be that the current part does not force a line break whlie the full word would
		while (/[\S]/i.test(block.innerText.substring(position, position+1))) {
			text += block.innerText.substring(position, ++position);
		}
		mirror.textContent = text;

		// clientHeight does not take padding into account so we have to correct this
		var padding_top		= parseInt(styles.getPropertyValue('padding-top'), 10);
		var padding_bottom	= parseInt(styles.getPropertyValue('padding-bottom'), 10);
		var block_height	= block.clientHeight - padding_top - padding_bottom;
		var mirror_height	= mirror.clientHeight - padding_top - padding_bottom;

		var returner = {};
		returner.rows		= block_height / parseInt(mirror.style.lineHeight, 10);
		returner.current	= mirror_height / parseInt(mirror.style.lineHeight, 10) || 1; // can be 0 if there is no content... then lets assume 1
		returner.last		= returner.rows === returner.current;
		returner.first		= returner.current === 1;

		// a hack if you have a line break as last character
		if (block.innerText.match(/\n\n$/)) {
			returner.current++;
			returner.last = true;
		}

		document.body.removeChild(mirror);
		return returner;
	}

	function _keyup(e) {
		var block			= this;
		var cursor_position	= _getCursorPosition(block);
		var text_length		= block.textContent.length;

		// save Content (do not use textContent otherwise we would have problems to extend a block via "enter")
		block.markdown = block.innerText;

		// "escape"
		if (e.keyCode === KEY_ESCAPE) {
			_stopEditingAndRender(current_index);

		 // "backspace" key at the beginning
	 	} else if (e.keyCode === KEY_BACKSPACE && cursor_position === 0 && cursor_position_last === 0) {
			// add the current content to the block before
			var old_length = view.children[current_index-1].markdown.length;
			view.children[current_index-1].markdown += "\n" + block.markdown;

			// remove block
			// we have to check if it is empty otherwise we get a problem with the "removeChild" in the _stopEditingAndRender function
			if (block.markdown !== '') {
				view.removeChild(block);
			}

			_startEditing(current_index-1);
			_setCursorPosition(old_length+1);

		// "del" key
		} else if (e.keyCode === KEY_DELETE && cursor_position === text_length) {
			// add the next content to the current block
			var text = document.createTextNode("\n" + view.children[current_index+1].markdown);
			block.appendChild(text);
			block.markdown += "\n" + view.children[current_index+1].markdown;

			// remove block
			view.removeChild(view.children[current_index+1]);

		// "return" key
		} else if (e.keyCode === KEY_ENTER) {
			// check if there are now multiple blocks
			if (matches = block.markdown.match(/\n\n([^$])/)) {
				var parts = block.markdown.split(matches[0]);

				// check if the linebreak is in a codeblock
				break_in_codeblock = false;
				var codeblocks = parts[0].match(/(~~~|```)/);
				if (codeblocks && codeblocks.length % 2 === 0) {
					break_in_codeblock = true;
				}

				if (parts.length > 1 && !break_in_codeblock) {
					block.markdown = parts[0];
					_stopEditingAndRender(current_index);

					current_index++;
					var div = document.createElement('div');
					div.markdown = matches[1] + parts[1];
					block.parentNode.insertBefore(div, block.nextSibling);
					_startEditing(current_index);
				}
			}
		}

		cursor_position_last = cursor_position;
	}

	function _handleWysiwyg() {
		[].forEach.call(view.children, function(block){
			block.removeAttribute('class');

			// only handle the block that is edited at the moment
			if (block.getAttribute('contenteditable') === null) return;

			// set class for headline
			if (match = block.markdown.match(/^(#+)/)) {
				block.setAttribute('class', 'h' + match[0].length);
			}

			// set class for headline (alternative syntax)
			if (match = block.markdown.match(/^==+/m)) {
				block.setAttribute('class', 'h1');
			}

			// set class for headline (alternative syntax)
			if (match = block.markdown.match(/^--+/m)) {
				block.setAttribute('class', 'h2');
			}

			// set class for code block
			if (match = block.markdown.match(/^(```|~~~| {4,}|\t)/)) {
				block.setAttribute('class', 'pre');
			}
		});
	}


	// add an event delegation helper
	function __addEventDelegation(element, target, event, callback){
		element.addEventListener(event, function(e){
			element = e.target;

			while (element.nodeName !== target) {
				if (element === this) return true;
				element = element.parentNode;
				if (!element) return true;
			}

			callback.call(element, e);
		});
	}

	// an indexOf helper for dom elements
	function __domIndexOf(element) {
		return Array.prototype.indexOf.call(element.parentNode.children, element);
	}

	/* public methods */
	this.getMarkdown = function() {
		var markdown = [];
		[].forEach.call(view.children, function(block){
			markdown.push(block.markdown);
		});

		return markdown.join('\n\n');
	}
}
