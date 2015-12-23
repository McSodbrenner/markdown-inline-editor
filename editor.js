/*
Bei Tab wirklich Tab einfügen
Entfernen-Taste am Ende sollte funktionieren
Cursor-Tasten sollten funktionieren
Event-Delegation mit Hören auf DIV kann schief gehen bei handgeschriebenem DIV
Klick außerhalb des Views sollte Editor aufhören lassen
Warum gehen Code-Blöcke nur einmal?
Der Zähler für Zeichen in Block zählt schräg? (Ablösen durch Funktion zum Abfragen der letzten Zeile)
*/

function Editor(view, input) {
	marked.setOptions({
	  renderer: new marked.Renderer(),
	  gfm: true,
	  tables: true,
	  breaks: true,
	  pedantic: false,
	  sanitize: false,
	  smartLists: true,
	  smartypants: false
	});

	var obj							= this;
	var text_position_last			= null;
	var text_position_in_line_last	= null;

	// initial split of markdown text: split into chunks
	input = input.replace(/\n\s+\n/g, "\n\n").split("\n\n");

	input.forEach(function(item, key){
		var block = document.createElement('div');
		view.appendChild(block);
		block.markdown = item;
		preview(key);
	});

	// adds native event delegation
	HTMLElement.prototype.addEventDelegation = function(target, event, callback){
		this.addEventListener(event, function(e){
			element = e.target;

			while (element.nodeName !== target) {
				if (element === this) return true;
				element = element.parentNode;
				if (!element) return true;
			}

			callback.call(element, e);
		});
	}

	function getCaretPositionInLine(element) {
		return window.getSelection().baseOffset;
	};

	function getCaretLineIn(element) {
		return 25543543;
		return window.getSelection().baseOffset;
	};

	// returns the position of the cursor within a contenteditable field that also includes html elements
	function getCaretPositionIn(element) {
		var caretOffset = 0;
		var sel = window.getSelection();

		if (sel.rangeCount > 0) {
			var range = sel.getRangeAt(0);
			var preCaretRange = range.cloneRange();
			preCaretRange.selectNodeContents(element);
			preCaretRange.setEnd(range.endContainer, range.endOffset);
			caretOffset = preCaretRange.toString().length;
		}
		return caretOffset;
	};

	function getIndexOfCurrentContenteditable() {
		var length = view.childNodes.length;
		while (length--) {
			if (view.childNodes[length].hasAttribute('contenteditable')) return length;
		}

		return false;
	}

	function getIndex(element, parent) {
		var index = parent.childNodes.length;
		while (index--) {
			if (parent.childNodes[index] == element) return index;
		}

		return false;
	}

	function edit(index) {
		var block = view.childNodes[index];
		block.setAttribute('contenteditable', true);
		block.textContent = block.markdown;
		block.focus();
	}

	function preview(index) {
		var block = view.childNodes[index];
		block.removeAttribute('contenteditable');
		block.innerHTML = marked(block.markdown);
	}

	view.addEventDelegation('DIV', 'click', function(e){
		var index = getIndex(this, view);

		// at click on an between the containers, return ...
		if (index === false) return true;

		// click on the current active should do nothing
		if (getIndexOfCurrentContenteditable() === index) return true;

		edit(index);
	});
	view.addEventDelegation('DIV', 'focusout', function(e){
		var index = getIndex(this, view);
		preview(index);
	});
	view.addEventDelegation('DIV', 'keydown', function(e){
		var block					= this;
		var current					= getIndexOfCurrentContenteditable();
		var keycode					= e.keyCode;
		var text_position			= getCaretPositionIn(block);
		var text_position_in_line	= getCaretPositionInLine(block);
		var text_length				= block.textContent.replace(/(\r\n|\n)/g, "").length;
		var line					= getCaretLineIn(block);

		console.log({keycode: keycode, position: text_position + '/' + text_length, line: line, position_in_line: text_position_in_line, position_last: text_position_last});

		// "up" key or
		if (keycode === 38 && text_position === 0 && text_position_last === 0) {
			edit(current-1);

		// "left" at the beginning
		} else if (keycode === 37 && text_position === 0 && text_position_last === 0) {
			edit(current-1);
			window.getSelection().modify('move', 'right', 'documentboundary');

	 	// "down" or
		} else if (keycode === 40 && text_position === text_length) {
			edit(current+1);

		// "right" key at the end
		} else if (keycode === 39 && text_position === text_length && text_position_last === text_position) {
			edit(current+1);
		}

	});
	view.addEventDelegation('DIV', 'keyup', function(e){
		var block					= this;
		var current					= getIndexOfCurrentContenteditable();
		var keycode					= e.keyCode;
		var text_position			= getCaretPositionIn(block);
		var text_position_in_line	= getCaretPositionInLine(block);
		var text_length				= block.textContent.replace(/(\r\n|\n)/g, "").length;
		var line					= getCaretLineIn(block);

		//console.log({keycode: keycode, position: text_position + '/' + text_length, line: line, position_in_line: text_position_in_line, position_last: text_position_last});

		// save Content
		block.markdown = block.innerText;

		if (keycode === 27) {
			var already_in_edit = getIndexOfCurrentContenteditable();
			preview(already_in_edit);

		 // "backspace" key at the beginning
		} else if (keycode === 8 && text_position === 0) {
			// add the current content to the block before
			view.childNodes[current-1].markdown += "\n" + block.markdown;

			// remove block
			view.removeChild(block);

			edit(current-1);

		// "del" key
		} else if (keycode === 46 && text_position === text_length) {
			// add the next content to the current block
			var text = document.createTextNode("\n" + view.childNodes[current+1].markdown);
			block.appendChild(text);
			block.markdown += "\n" + view.childNodes[current+1].markdown;

			// remove block
			view.removeChild(view.childNodes[current+1]);

		// "return" key
		} else if (keycode === 13) {
			// check if there are now multiple blocks
			var parts = block.markdown.split("\n\n");
			console.log(parts);

		}

		text_position_last = text_position;
		text_position_in_line_last = text_position_in_line;
	});
}
