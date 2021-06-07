;(function($, window, document) {
	var pluginName = 'weeble',
		/*
		┌┬┐┌─┐┌─┐┌─┐┬ ┬┬ ┌┬┐  ┌─┐┌─┐┌┬┐┬┌─┐┌┐┌┌─┐
 		 ││├┤ ├┤ ├─┤│ ││  │   │ │├─┘ │ ││ ││││└─┐
		─┴┘└─┘└  ┴ ┴└─┘┴─┘┴   └─┘┴   ┴ ┴└─┘┘└┘└─┘
        */
		defaults = {
			target: null
		};

	/*
	┌─┐┌─┐┌┐┌┌─┐┌┬┐┬─┐┬ ┬┌─┐┌┬┐┌─┐┬─┐
	│  │ ││││└─┐ │ ├┬┘│ ││   │ │ │├┬┘
	└─┘└─┘┘└┘└─┘ ┴ ┴└─└─┘└─┘ ┴ └─┘┴└─
	*/
	function construct(element, options) {
		//Extend the options with the defaults, and cache all the needed vars for later.
		this.options = $.extend({}, defaults, options);
		this.element = element;
		this.$window = $(window);
		this.$document = $(document);

		//Initialize the plugin.
		this.init();
	}

	/*
	┬  ┌─┐┌─┐┬┌─┐
	│  │ ││ ┬││  
	┴─┘└─┘└─┘┴└─┘
	*/
	construct.prototype = {
		init: function() {
			//Abort is we've already initialized.
			if (this.$menu !== undefined) return;
			
			this.$menu = $(this.element).addClass('weeble-menu').detach().appendTo('body');
			this.$menu.on('click', 'li', this.menuItemClickHandler.bind(this));
			this.$document.on('contextmenu', this.options.target, this.contextMenuHandler.bind(this));
		},
		contextMenuHandler: function(e) {
			e.preventDefault();
			//Position the menu and show it.
			this.$menu.css({ top: e.pageY, left: e.pageX }).show();

			//Bind a one time use handler to hide the menu when the document receives a click.
			this.$document.one('click', function() {
				this.$menu.hide();
			}.bind(this));
		},
		menuItemClickHandler: function(e) {
			var $li = $(e.target);
			if (!$li.is('li')) {
				$li = $li.parents('li:first');
			}
			var position = ($('li', this.$menu).index($li[0]) + 1);
			this._trigger('onItemClick', [$li, position]);
		},
		_trigger: function(event, args) {
			//Trigger a custom event for other handlers bound to the dom.
			var evt = $.Event(pluginName + '_' + event);

			if (!args) {
				args = [this];
			} else {
				args.unshift(this);
			}

			this.element.triggerHandler(evt, args);
			//Return truthy if no one prevented default action.
			return evt.isDefaultPrevented() === false;
		}
	};

	/*
	┬┌┐┌┌─┐┌┬┐┌─┐┌┐┌┌┬┐┬┌─┐┌┬┐┬┌─┐┌┐┌
	││││└─┐ │ ├─┤│││ │ │├─┤ │ ││ ││││
	┴┘└┘└─┘ ┴ ┴ ┴┘└┘ ┴ ┴┴ ┴ ┴ ┴└─┘┘└┘
	*/
	$.fn[pluginName] = function(o) {
		//Prep the options object in case this is the first time in, and try to get any current instance.
		var options = ($.isPlainObject(o) ? o : {}),
			instance = $.data(this, 'plugin_' + pluginName);

		if (instance) {
			//We have an instance, so check if the argument is a string and a valid function name.
			if (typeof o === 'string' && instance[o] && $.isFunction(instance[o])) {
				//Parse the arguments. We need two to support setting options from a map.
				var args = (arguments.length >= 2 ? Array.prototype.slice.call(arguments, 1) : []),
				//Call the instance function and return the functions result, or the current context.
					ret = instance[o].apply(instance, args);
				return ret === undefined ? this : ret;
			}
			//We ain't got jack!
			return this;
		} else {
			//No instance was found, so construct one, then store and return it.
			instance = new construct(this, options);
			$.data(this, 'plugin_' + pluginName, instance);
			return this;
		}
	};
})(jQuery, window, document);