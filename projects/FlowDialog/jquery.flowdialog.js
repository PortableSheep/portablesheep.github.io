/*! v1.0.9 */
;(function($, window, document) {
	var pluginName = 'flowdialog',
		/*
		┌┬┐┌─┐┌─┐┌─┐┬ ┬┬ ┌┬┐  ┌─┐┌─┐┌┬┐┬┌─┐┌┐┌┌─┐
 		 ││├┤ ├┤ ├─┤│ ││  │   │ │├─┘ │ ││ ││││└─┐
		─┴┘└─┘└  ┴ ┴└─┘┴─┘┴   └─┘┴   ┴ ┴└─┘┘└┘└─┘
        */
		defaults = {
			height: 'auto',
			growToHeight: false,
			width: 600,
			showCloseButton: true,
			closeOnEscape: false,
			closeOnOverlayClick: false,
			autoOpen: false,
			appendTo: document.body,
			hideEmptyFooter: true,
			hideEmptyTitle: false,
			useTransitions: true,
			animateDuration: 250,
			flow: []
		};

	/*
	┌─┐┌─┐┌┐┌┌─┐┌┬┐┬─┐┬ ┬┌─┐┌┬┐┌─┐┬─┐
	│  │ ││││└─┐ │ ├┬┘│ ││   │ │ │├┬┘
	└─┘└─┘┘└┘└─┘ ┴ ┴└─└─┘└─┘ ┴ └─┘┴└─
	*/
	function construct(element, options) {
		//Extend the options with the defaults, and cache all the needed vars for later.
		this.options = $.extend({}, defaults, options);
		this.vendors = ['Webkit', 'Moz', 'O', 'Ms', 'Khtml'];
		this.element = element;
		this.$window = $(window);
		this.$document = $(document);
		this.$body = $(document.body);
		this.flowTemplate = '<div class="flowdialog-flowcontent">' +
								'<div class="flowdialog-header"><button type="button" class="flowdialog-close" data-dismiss="modal" aria-hidden="true">×</button><h4 class="flowdialog-title"></h4></div>' +
								'<div class="flowdialog-content"></div>' +
								'<div class="flowdialog-footer"></div>' +
							'</div>';
		this._flow = [];
		this.flowIndex = 0;
		this.isShowing = false;
		this.isFlowing = false;

		//Initialize the plugin.
		this.init();
		//Initialize any flow content.
		if (this.options.flow.length > 0) {
			for(var i = 0, len = this.options.flow.length; i < len; i++) {
				this.initFlow(this.options.flow[i]);
			}
		}
		this._trigger('onInitComplete');
	}

	/*
	┬  ┌─┐┌─┐┬┌─┐
	│  │ ││ ┬││  
	┴─┘└─┘└─┘┴└─┘
	*/
	construct.prototype = {
		init: function() {
			//Abort is we've already initialized.
			if (this.$modal !== undefined) return;

			var $overlayDom = $('<div class="flowdialog-overlay"></div>'),
				$modalDom = $('<div class="flowdialog-container"><div class="flowdialog-modal" tabindex="-1"></div></div>');

			//Bind to the window resize/scroll events to make sure we stay top/center.
			this.$window.on('resize.flowdialog', $.proxy(this.reposition, this));
			this.$window.on('scroll.flowdialog', $.proxy(this.reposition, this));

			//Append the dom to the document.
			this.$container = $modalDom.appendTo(this.options.appendTo);
			this.$modal = $('div.flowdialog-modal', this.$container);
			//Append the overlay to the body.
			this.$overlay = $overlayDom.appendTo(this.$body);

			//Bind up the click for any close icons.
			this.$modal.on('click', 'button.flowdialog-close', $.proxy(function(e) {
				e.preventDefault();
				this.close();
			}, this));

			//Initialize the default element as the first flow item.
			this.initFlow(this.element);

			//Refresh the options for the active flow item.
			this.refreshOptions();

			//Open the dialog if needed.
			if (this.options.autoOpen) {
				this.open();
			}
		},
		initFlow: function(obj) {
			//Convert obj to a propery object with a target to the previous obj.
			if (obj instanceof jQuery) {
				obj = { target: obj };
			}
			//If we don't have a proper object and target, bail.
			if (!($.isPlainObject(obj) && obj.target)) return;

			//Pull in the options per flow object.
			for(var k in this.options) {
				if (k === 'flow') continue;
				if (!obj.hasOwnProperty(k)) {
					obj[k] = this.options[k];
				}
			}

			//Append the flow container to the modal.
			var	$modalFlowDom = $(this.flowTemplate).appendTo(this.$modal);
			//Cache the various DOM elements for later.
		 	obj._$header = $('div.flowdialog-header', $modalFlowDom);
		 	obj._$btnClose = $('button.flowdialog-close', obj._$header);
		 	obj._$title = $('h4.flowdialog-title', $modalFlowDom).html(obj.target.attr('title')||'');
		 	obj._$content = $('div.flowdialog-content', $modalFlowDom);
		 	obj._$footer = $('div.flowdialog-footer', $modalFlowDom);

		 	//If we can find a footer, pull it out of the content, unwrap it, and shove it into the dialog footer area... otherwise hide the footer area.
		 	var $eleFooter = obj.target.find('div[data-type="footer"]:first');
		 	if ($eleFooter.length > 0) {
		 		$eleFooter.detach().unwrap().appendTo(obj._$footer);
		 	} else if (obj.hideEmptyFooter) {
		 		obj._$footer.hide();
		 	}
		 	//Append the target to the dialog content, and make sure it's visible since the container isn't.
		 	obj.target.appendTo(obj._$content).show(0);
		 	//Reassign the target to the new modal container so we can access it easier.
		 	obj.target = $modalFlowDom;
		 	//Push it onto the flow stack.
		 	this._flow.push(obj);
		},
		open: function(index) {
			if (index !== undefined && this._flow.length >= index && this._flow[index] !== null) {
				this.flowIndex = index;
			}

			//Reposition, fade the overlay in, show the modal container/layer, slide down the modal, and trigger the open event.
			this.$body.addClass('flowdialog-modalopen');
			this.refreshOptions();
			//Change the content opacity to make sure it's showing.
			if (this.options.useTransitions) {
				var opacity = this.$overlay.css('opacity'), top = this.$modal.css('top');
				//Set the opacity to nothing, show the overlay, and fade it in.
				this.$overlay.css('opacity', 0).show(0).animate({ opacity: opacity }, this.options.animateDuration, $.proxy(function() {
					//Show the container, fade in the target content, and slide in the dialog.
					this.$container.show(0);
					this._flow[this.flowIndex].target.show(0).animate({ opacity: 1 }, this.options.animateDuration);
					this.$modal.css({ top: '-30%', opacity: 0 }).show(0).animate({ top: top, opacity: 1 }, this.options.animateDuration);
				}, this));
			} else {
				this.$overlay.show();
				this.$container.show();
				this._flow[this.flowIndex].target.show(0).css('opacity', '1');
				this.$modal.show();
			}
			//Set a timeout to focus the modal to prevent the scroll wheel affecting the underlying page.
			setTimeout($.proxy(function() {
				this.$modal.focus();
			}, this), this.options.transitionDelay);
			//Trigger the dialog open event.
			this.isShowing = true;
			this._trigger('onOpen');
		},
		close: function() {
			//See if handlers will let us close the dialog.
			if (this._trigger('onPreClose')) {
				var def = $.Deferred();
				if (this.options.useTransitions) {
					//Slide the dialog up, and fade out.
					this.$modal.animate({ top: '-30%', opacity: 0 }, this.options.animateDuration, $.proxy(function() {
						//Hide the dialog, and clear the top/opacity styles.
						this.$modal.hide(0).css({ top: '', opacity: '' });
						//Hide the container, and fade out the overlay.
						this.$container.hide(0);
						this.$overlay.animate({ opacity: 0 }, this.options.animateDuration, $.proxy(function() {
							//Reset the opacity style after hiding it, remove the modalopen class, and resolve the promise.
							this.$overlay.hide(0).css('opacity', '');
							this.$body.removeClass('flowdialog-modalopen');
							def.resolve();
						}, this));
					}, this));
				} else {
					this.$modal.hide();
					this.$container.hide();
					this.$overlay.hide();
					this.$body.removeClass('flowdialog-modalopen');
					def.resolve();
				}
				def.done($.proxy(function() {
					this.flowIndex = 0;
					for(var i = 0, len = this._flow.length; i < len; i++) {
						this._flow[i].target.hide(0).css('opacity', '');
					}
					this.isShowing = false;
					this._trigger('onClose');
				}, this));
			}
		},
		option: function(k, v) {
			//If no options... return the element.
			if (k === undefined && v === undefined || k === 'target' && v !== undefined) {
				return this.element;
			}
			if ($.isPlainObject(k) && v === undefined) {
				//Set via the map.
				for(var i in k) {
					if (this._flow[this.flowIndex][i] !== k[i]) {
						this._flow[this.flowIndex][i] = k[i];
					}
				}
			} else if (k !== undefined && v !== undefined) {
				//Setter
				if (this._flow[this.flowIndex][k] !== v) {
					this._flow[this.flowIndex][k] = v;
				}
			} else {
				//Getter
				return this._flow[this.flowIndex][k];
			}
			//Set it up!!! Then refresh it up!!!
			this.refreshOptions();
		},
		refreshOptions: function(fromFlow) {
			//Get the current flow object so we can use the options, and handle the height change.
			var flowOpt = this._flow[this.flowIndex],
				heightOpts = {
                    'height': (flowOpt.growToHeight && flowOpt.height !== 'auto' ? 'auto' : flowOpt.height),
                    'max-height': (flowOpt.growToHeight && flowOpt.height !== 'auto' ? flowOpt.height : '')
				};
			
			//Reposition to handle the width and placement.
			this.reposition();
			if (!fromFlow) {
				if (this.options.useTransitions && this.isShowing) {
					//Strip the max-height if we're not growing.
					if (!flowOpt.growToHeight) {
						flowOpt._$content.css('max-height', '');
					}

					//Set the height using animate for jQ transitions.
					flowOpt._$content.animate(heightOpts, this.options.animateDuration);
				} else {
					flowOpt._$content.css(heightOpts);
				}
			} else {
			    flowOpt._$content.css(heightOpts);
			}

			//Set or remove the overflow CSS class if needed.
			if (flowOpt.height !== 'auto') {
				flowOpt._$content.addClass('flowdialog-overflow');
			} else {
				flowOpt._$content.removeClass('flowdialog-overflow');
			}

			//Toggle the close icon if needed.
			if (!flowOpt.showCloseButton) {
				flowOpt._$btnClose.hide();
			} else {
				flowOpt._$btnClose.show();
				flowOpt._$header.show();
			}

			//Hide the header if there is no title or close icon.
			if (flowOpt.hideEmptyTitle && $.trim(flowOpt._$title.text()).length === 0 && !flowOpt.showCloseButton) {
				flowOpt._$header.hide();
			} else {
				flowOpt._$header.show();
			}

			//Bind up the escape handler if needed.
			if (flowOpt.closeOnEscape) {
				this.$document.off('keyup.flowdialog');
				this.$document.on('keyup.flowdialog', function(e) {
					if ((e.which||e.keyCode) === 27) {
						this.close();
					}
				}.bind(this));
			} else {
				this.$document.off('keyup.flowdialog');
			}

			//Bind up the close on click handler if needed.
			if (flowOpt.closeOnOverlayClick) {
				this.$container.off('click.flowdialog');
				this.$container.on('click.flowdialog', function() {
					this.close();
				}.bind(this));
			} else {
				this.$container.off('click.flowdialog');
			}
		},
		reposition: function() {
			var overlayOpts = {
				'width': window.scrollWidth,
				'height': this.$window.height()
			};
			//Set the height/width of the overlays.
			this.$overlay.css(overlayOpts);
			this.$container.css(overlayOpts);

			//Reposition the modal to the top/center, and trigger the event for it.
			var width = this._flow[this.flowIndex].width,
				left = ((this.$container.width() - width) / 2 + this.$window.scrollLeft());

			if (!this.isShowing || !this.options.useTransitions) {
				this.$modal.css({ 'width': width, 'left': left });
			} else if (this.options.useTransitions) {
				this.$modal.css('left', left).animate({ 'width': width }, this.options.animateDuration);
			}
			this._trigger('onReposition');
		},
		flowTo: function(index) {
			var ret = $.Deferred();
			//Only try to flow to a index if the index is within the valid range.
			if (this._flow.length > 1 && (index <= this._flow.length-1 && index >= 0)) {
				//Get the current and target flows.
				var currentFlow = this._flow[this.flowIndex], targetFlow = this._flow[index];
				this.isFlowing = true;
				if (this.options.useTransitions) {
					var targetHeight;
					if (targetFlow.height === 'auto' || targetFlow.growToHeight) {
						//Position to target flow DOM off the page, hide it, but display it... needed to get the real height of the content.
						targetFlow.target.css({
							'position': 'absolute',
							'left': '-9999px',
							'visible': 'hidden',
							'display': 'block',
							'width': targetFlow.width
						});
						targetFlow._$content.css('height', 'auto');
						//Get the computed height of the content.
						targetHeight = targetFlow._$content.outerHeight();
						//Clear the previous positioning for height calculations.
						targetFlow.target.css({
							'position': '', 'left': '', 'visible': '', 'display': ''
						});
					}

					//Using jQuery animate... set the overflow to be hidden to avoid scrolling.
					this.$modal.css('overflow', 'hidden');
					//Animate the fade out.
					currentFlow.target.animate({ opacity: 0 }, this.options.animateDuration, $.proxy(function() {
						//Set the target content height to the current content height, so the animation will work.
						targetFlow._$content.css({ 'height': currentFlow._$content.css('height'), 'max-height': '' });
						//Animate the height change.
						targetFlow.target.show(0);
						currentFlow.target.hide(0);
						//Animate the height/width changes.
						targetFlow._$content.animate({ height: targetHeight||targetFlow.height }, this.options.animateDuration);
						this.$modal.animate({
							width: targetFlow.width,
							left: ((this.$container.width() - targetFlow.width) / 2 + this.$window.scrollLeft())
						}, this.options.animateDuration, $.proxy(function() {
							//Set the new flow index, and refresh the options.
							this.flowIndex = index;
							this.refreshOptions(true);
							//Reset the overflow.
							this.$modal.css('overflow', '');
							//Animate the fade in.
							targetFlow.target.animate({ opacity: 1 }, this.options.animateDuration);
							this.isFlowing = false;
							//Resolve our promise.
							ret.resolve();
						}, this));
					}, this));
				} else {
					//We're boring... just hide/show... whatever.
					currentFlow.target.hide();
					this.flowIndex = index;
					this.refreshOptions();
					targetFlow.target.css('opacity', '1').show();
					this.isFlowing = false;
					ret.resolve();
				}
			} else {
				//Reject because there's nothing to do.
				ret.reject();
			}
			return ret.promise();
		},
		flow: function(cmd, index) {
			if (cmd === 'next') {
				//Flow to the next index, and trigger the event if successful.
				this.flowTo(this.flowIndex+1).done($.proxy(function() {
					this._trigger('onFlow');
				}, this));
			} else if (cmd === 'prev') {
				//Flow to the previous index, and trigger the event if successful.
				this.flowTo(this.flowIndex-1).done($.proxy(function() {
					this._trigger('onFlow');
				}, this));
			} else if (cmd === 'index') {
				//No index, so return the current index.
				if (index === undefined) {
					return this.flowIndex;
				} else if (index !== this.flowIndex) {
					//An index was supplied, so try flowing to it... trigger the event if successful.
					this.flowTo(index).done($.proxy(function() {
						this._trigger('onFlow');
					}, this));
				}
			}
		},
		_trigger: function(event) {
			//Trigger a custom event for other handlers bound to the dom.
			var evt = $.Event(pluginName + '_' + event);
			this.element.triggerHandler(evt, [this]);
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