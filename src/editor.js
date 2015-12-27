function Editor(input, view, renderer_callback) {
	// the index of the currently edited block 
	var current_index;
	
	// the position of the cursor before the current position
	var cursor_position_last = null;
	
	(function _init() {
		// trim input
		input = _clean(input);

		if (input === '') {
			input = 'Start writing here ...';
		}
	
		// split input into clean chunks
		chunks = input.split('\n\n');

		// remove content from view element
		view.innerHTML = '';

		// create a div for every chunk and save the text in the markdown attribute 
		chunks.forEach(function(text, index){
			var div = document.createElement('div');
			div.markdown = text;
			view.appendChild(div);
			_render(index);
		});

		// edit on click
		_addEventDelegation(view, 'DIV', 'click', function(){
			_startEditing(_domIndexOf(this));
		});
		
		// render on focusout
		_addEventDelegation(view, 'DIV', 'focusout', function(){
			_render(_domIndexOf(this));
		});
		
		// move with the cursor on keydown
		_addEventDelegation(view, 'DIV', 'keydown', _move);
	
		// edit the content on keyup
		_addEventDelegation(view, 'DIV', 'keyup', _edit);
	})();
	
	function _render(index) {
		var block = view.children[index];
		block.removeAttribute('contenteditable');
		block.markdown = _clean(block.markdown);
		block.innerHTML = renderer_callback(block.markdown);
	}

	// add an event delegation helper
	function _addEventDelegation(element, target, event, callback){
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
	function _domIndexOf(element) {
		return Array.prototype.indexOf.call(element.parentNode.children, element);
	}

	function _clean(string) {
		return string.replace(/\r/g, '').replace(/\n\s+\n/g, '\n\n').replace(/(^\n+|\n+$)/g, '');
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
	
	function _startEditing(index) {
		current_index = Math.min(view.children.length-1, Math.max(0, index));
		var block = view.children[current_index];
		if (block.hasAttribute('contenteditable')) return false;
		
		block.setAttribute('contenteditable', true);
		block.textContent = block.markdown;
		block.focus();
	}

	function _move(e) {
		var block			= this;
		var cursor_position	= _getCursorPosition(block);
		var text_length		= block.textContent.length;

		// "tab"
		if (e.keyCode === 9) {
			_insertAtCursorPosition('\t');
			_setCursorPosition(cursor_position+1);
			block.markdown = block.innerText;
			e.preventDefault();
			return false;

		// "up" or "left" at the first position
		} else if ((e.keyCode === 38 || e.keyCode === 37) && cursor_position === 0 && cursor_position_last === 0) {
			_startEditing(current_index-1);

			_setCursorPosition(view.children[current_index].markdown.length);
			e.preventDefault();
			return false;

		// "down" or
		} else if (e.keyCode === 40 && cursor_position === text_length) {
			_startEditing(current_index+1);
			e.preventDefault();
			return false;

		// "right" key at the end
		} else if (e.keyCode === 39 && cursor_position === text_length && cursor_position_last === cursor_position) {
			_startEditing(current_index+1);
			e.preventDefault();
			return false;
	
		// "ctrl+up"
		} else if (e.ctrlKey && e.keyCode === 38) {
			_startEditing(current_index-1);
			e.preventDefault();
			return false;
			
		// "ctrl+down"
		} else if (e.ctrlKey && e.keyCode === 40) {
			_startEditing(current_index+1);
			e.preventDefault();
			return false;
			
		// prevent "enter" at the first position (doesn't make sense)
		} else if (e.keyCode === 13 && cursor_position === 0) {
			e.preventDefault();
			return false;
		}
	}
	
	function _edit(e) {
		var block			= this;
		var cursor_position	= _getCursorPosition(block);
		var text_length		= block.textContent.length;

		// save Content (do not use textContent otherwise we would have problems to extend a block via "enter")
		block.markdown = block.innerText;

		// "escape"
		if (e.keyCode === 27) {
			_render(current_index);

		 // "backspace" key at the beginning
		} else if (e.keyCode === 8 && cursor_position === 0 && cursor_position_last === 0) {
			// add the current content to the block before
			var old_length = view.children[current_index-1].markdown.length;
			view.children[current_index-1].markdown += "\n" + block.markdown;

			// remove block
			view.removeChild(block);

			_startEditing(current_index-1);
			_setCursorPosition(old_length+1);

		// "del" key
		} else if (e.keyCode === 46 && cursor_position === text_length) {
			// add the next content to the current block
			var text = document.createTextNode("\n" + view.children[current_index+1].markdown);
			block.appendChild(text);
			block.markdown += "\n" + view.children[current_index+1].markdown;

			// remove block
			view.removeChild(view.children[current_index+1]);

		// "return" key
		} else if (e.keyCode === 13) {
			// check if there are now multiple blocks
			if (matches = block.markdown.match(/\n\n([^$])/)) {
				var parts = block.markdown.split(matches[0]);
				if (parts.length > 1) {
					block.markdown = parts[0];
					_render(current_index);

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
	
	function _getMarkdown() {
		var markdown = [];
		[].forEach.call(view.children, function(block){
			markdown.push(block.markdown);
		});
		
		return markdown.join('\n\n');
	}
	
	return {
		getMarkdown: _getMarkdown
	};
}
