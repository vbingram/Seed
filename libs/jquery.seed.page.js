﻿/* 
* Seed Framework
* seedPage 
* ver. 1.4
* Kirill Ivanov
* create: 2015.07.06
*/

;(function ($, window, document, undefined) {
	'use strict';

	if (!$.seed) {
		$.seed = {};
	};

// данные для конструктора
	var name = 'seedPage';

	$.seed[name] = {};
	$.seed[name].VERSION = '1.4';
	$.seed[name]._inited = [];

	$.extend($.seed[name], {
		defaults: {
			'debug': false,
			'evented': false,

			'init' : true,

			'quant' : 20, // epp (element per page) - количество элементов на странице
			'offset' : 0, // количество с которых начинается просмотр
			'preloaded' : 0, // количество уже загруженных
			'preload' : false, // запоминать и подгружать элементы при возврате в список
			'total' : null,

			'until' : 5, // количество автоматически подгружаемых до кнопки
			'nav' : false,

			'delta' : 0, //параметр отвечающий за преждевременную подгрузку следующей страницы. указывается целым числом.

			'animation_delay' : 50, //задержка перед анимацей следующего элемента
			'animation_time' : 300,//время анимации элемента

			'selector': {
				'auto' : '[data-seed="page"], [role="list-infinity"]',
				'items' : '> *', // элементы которые нужно найти в ответе ajax
				'pages' : '.pages, .pagination, [role="pagination"], [role="pages"]' // класс тега где содержиться пагинация, нужно знать что скрывать
			},
			'cssclass': {
				'button' : 'btn btn-primary',
				'loader' : 'fa fa-spinner fa-pulse' //'fa fa-spinner fa-pulse' дополнительный стилевой класс для иконки загрузки
			},
			'event' : {
				'__on' : 'dynamic.seed.page',
				'on' : 'dynamic.seed.page'
			},
			'url': {
				'current' : window.location.href
			},
			'module': {
				'main' : '',
				'func' : ''
			},
			'func' : {
				'success' : null,  // функция пост редактирования контента после загрузки ajax
				'before_send' : null, // функция пред редактирования урла запроса ajax
				'error': null //callback-функция выполняющая после сериализации формы, оправки и при получение ответа об ошибке
			},
			'locale' : {
				'error' : {
					'data-name': 'не задано имя',
					'module.main': 'не задан ID модуля фильтра',
					'module.func': 'не задана функция фильтра',
					'selector.list': 'Не задан список для фильтрации',
					'total': 'Не указано общее количество элементов'
				},
				'interface' : {
					'page_next' : 'Следующая страница',
					'page_prev' : 'Предыдущая страница',
					'page' : 'Страница',
					'loading' : 'Загружаем еще'
				}
			}
		},

		build: function() {
			var self = this;

			this.config.module.main = this.config.module.main || this.$el.attr('data-module') || this._error(this.config.module.main, 'module.main');
			this.config.module.func = this.config.module.func || this.$el.attr('data-function') || this.$el.attr('data-func') || this._error(this.config.module.func, 'module.func');

			this.config.quant = this.$el.attr('data-quant') || this.config.quant;
			this.config.offset = this.$el.attr('data-offset') || this.config.offset;
			this.config.preloaded = this.$el.attr('data-preloaded') || this.config.preloaded;
			this.config.preload = Boolean(this.$el.attr('data-preload')) || this.config.preload;
			this.config.delta = this.$el.attr('data-delta') || this.config.delta;
			this.config.url.current = this.$el.attr('data-url') || this.config.url.current;
			this.config.total = this.config.total || this.$el.attr('data-total') || this.config.total || ''; // количество элементов всего

			this.offset_func = '';

			if( this.config.debug ) { console.log( this ); }

			if( this.config.preload ) {
				require('common.cookie', function() {
					self.create();
				});
			}
			else {
				this.create();
			}
		},

// создаем бинды для элементов библиотеки
		bind: function() {
			var self = this;
		},


		destroy: function() {
			try {
				this.$list.insertBefore( this.$holder );
				this.$holder.remove();
			} catch(e) {}
			this.$el.removeData(this._label);
			delete this;

			return false;
		},

		enable: function() {
			if( this.inited ) return false;
			if( $.fn.cookie ) { $.cookie('paging', 'scroll', { path: '/' }); }
			this.init();
		},

		disable: function() {
			if( $.fn.cookie ) { $.cookie('paging', 'page', { path: '/' }); }
			window.location.reload(false);
		},


// создаем необходимые переменные
		create: function() {
			if( this.config.cancel === true ) return false;

			$(this.config.selector.pages).hide();

			this.page_total = Math.ceil(this.config.total / this.config.quant);

			this.limit = 0;

			this.counter = 0; // количество подгруженных страниц

			this.page_last = this.page_total;
			this.url_prev_state = '';
			this.scroll_direction = 1; // направление скролла по умаолчанию вниз (1-вниз, 0-вверх)
			this.scroll_position = $(window).scrollTop(); // позиция скролл при инициализации

			this.page_current = Math.floor(this.config.preloaded/this.config.quant) + Math.floor(this.config.offset/this.config.quant) + ( (this.config.preload) ? 0 : 1 );
			if( this.page_current == 0 ) { this.page_current = 1; }

			this.page_current_next = this.page_current;
			this.page_current_prev = this.page_current;
			this.page_visible = this.page_current;

// массив загруженных страниц
			this.page_loaded = [];

// обнуляем куку предзагрузки после инициализации
			if( this.config.preload ) {
				$.removeCookie('quant'+this.config.module.func);
			}

// создаем область загрузки и область навигации
//				this.buildLoader().buildNavigation().globalBind();
			this.buildLoader().globalBind();
			this.showNavigation();
			this.check();
		},

// Создание областей загрузки
		buildLoader: function() {
			var self = this;

// Для каждой подгруженного страницы, делаем свою обертку
			this.$list = this.$el.attr('data-page', self.page_current);
			this.$list.wrap('<div>');

			this.page_loaded[this.page_current] = {el: this.$list };

			this.$wrapper = this.$list.parent();
			this.$wrapper.addClass('page-wrapper');
			this.$wrapper.wrap('<div>');

			this.$holder = this.$wrapper.parent();
			this.$holder.addClass('page-holder');		

			//Создание областей загрузки и кнопок
			this.$ajaxblock = $('<div>', {'class': 'loader page-loader'}).html('<span><i class="'+this.config.cssclass.loader+'"></i>' + this.config.locale.interface.loading + '</span>').insertAfter( this.$wrapper);

			this.$button_prev = $('<div>', {'class': 'btn btn-prev ' + this.config.cssclass.button }).text(this.config.locale.interface.page_prev).insertBefore( this.$wrapper);
			this.$button_next = $('<div>', {'class': 'btn btn-next ' + this.config.cssclass.button }).text(this.config.locale.interface.page_next).insertAfter( this.$ajaxblock);

			this.$ajaxblock_prev = $('<div>', {'class': 'loader page-loader'}).html('<span><i class="'+this.config.cssclass.loader+'"></i>' + this.config.locale.interface.loading + '</span>').insertAfter( this.$button_prev);
//			this.bindCut(this.$list);

			return self;
		},

		showNavigation: function(active) {
			if(active) { this.page_visible = active; }
			if(this.page_visible == 0) { this.page_visible = 1; }

			this.limit = (this.page_visible*1-1)*this.config.quant;
			this.offset_func = 'first'+this.config.module.func +'='+ this.limit;

			var newUrl = '';

			// если включена функции preload
			if( this.config.preload === true ) {
				// проверим есть ли знак вопроса в нашем урле
				if( /\?/.test(this.config.url.current) ) {
					// если знак вопроса есть, то проверим если параметр first
					if( /first/.test(this.config.url.current) ) {
						// заменим first на this.offset_func
						newUrl = this.config.url.current.replace(/first[a-zA-Z]+\=\d+/, this.offset_func);
					}
					// допишем this.offset_func в конце строки
					else {
						newUrl = this.config.url.current + '&' + this.offset_func;
					}
				}
				else {
					// напишем this.offset_func
					newUrl = this.config.url.current + '?' + this.offset_func;
				}
				this.config.url.current = newUrl;
			}
			// если функция preload выключена
			else {
				newUrl = (/\?/.test(window.location.search) ) ? ( ( /first/.test(window.location.search) ) ? window.location.search.replace(/first[a-zA-Z]+\=\d+/, this.offset_func) : window.location.href + '&'+this.offset_func ) : (window.location.href + '?'+this.offset_func);


				if( !/\?/.test(this.config.url.current) ) {
					this.config.url.current = newUrl;
				}

				if( window.history.pushState && this.url_prev_state != newUrl ) {
					this.url_prev_state = newUrl;
					window.history.pushState({}, 'page', newUrl);
				}
			}

			return self;
		},

		check: function() {
			( this.page_current_prev > 1 && !this.config.preload ) ? this.$button_prev.show() : this.$button_prev.hide();
			( this.page_current_next < this.page_last ) ? this.$button_next.show() : this.$button_next.hide();

			if( this.total == 0 ) {
				this.$button_next.hide();
				this.$button_prev.hide();
			}
		},

		// определение направления скролла
		scrollDirection: function() {
			var st = $(window).scrollTop();
			this.scroll_direction = (st > this.scroll_position) ? 1 : 0;
			this.scroll_position = st;
		},

		// проверка видимости элемента на экране пользователя
		isElementVisible: function(el, delta) {
			var type = ( typeof delta === 'number' ) ? 'in' : 'over';
			var delta = delta || 0;

		        var viewTop = $(window).scrollTop(),
				viewBottom      = viewTop + $(window).height() + delta,
				offset          = el.offset(),
				_top            = offset.top,
				_bottom         = _top + el.height(),
				compareTop      = _bottom,
				compareBottom   = _top;

			// если проверяем только видимость внутри вьюпорта
			return ((compareBottom <= viewBottom) && (compareTop >= viewTop));
		},


		globalBind: function() {
			var self = this;
			this.$button_next.on({
				'click' : function() {
					if(self.config.debug) { console.log('click next'); }
					self.counter = 0;
					self.load('next');
					return false;
				}
			});

			this.$button_prev.on({
				'click': function() {
					if(self.config.debug) { console.log('click prev'); }
					self.load('prev');
					return false;
				}
			});

			// во время скролла
			$(window).scroll(function() {
				self.scrollDirection(); // определяем текущее направление скроллинга

				// проверка отображения кнопка "Следующая страница"
				if( self.config.until > 0 ) {
					var pos = self.$button_next.position();
					if( self.counter >= self.config.until ) { return false; }
					if( self.isElementVisible( self.$button_next, self.config.delta ) ) {
						self.load('next');
					}
				}

				// проверка видимости во вьюпорт блоков страницы
				self.checkLoaderVisibility();
			});
		},

		// проверка видимости блоков
		checkLoaderVisibility: function() {
			var self = this;
			var $lists = self.$wrapper.find('[data-page]').removeClass('visible');
			$lists.each(function(i, el) {
				if( self.isElementVisible( $(el) ) ) {
					$(el).addClass('in-viewport');
				}
				else {
					$(el).removeClass('in-viewport');
				}
			});
			
			var $viewport = $lists.filter('.in-viewport');
			self.page_visible = $viewport.filter( ((this.scroll_direction === 1)) ? ':last' : ':first').data('page')*1 || 0;
			self.showNavigation();
		},

		bindLinks: function() {
			var self = this;
			if( this.limit > 0 && this.config.preload ) {
				this.$holder.find('a[href]').on('click', function() {
					$.cookie('quant'+self.config.module.func, self.limit*1+self.config.quant*1);
				});
			}
		},

		unblock: function() {
			this.blocked = false;
		},


		load: function(page, callback) {
			var self = this;

			this.config.url.current = this.query || this.config.url.current || window.location.href;

			if( ( page == 'next' && this.page_current_next >= this.page_last ) || this.blocked ) {
				return false;
			}

			if(page == 'next') {
				this.page_load_items = (this.page_current_next) * this.config.quant;
				this.$ajaxblock.show();
				this.$button_next.hide();
			}
			if(page == 'prev') {
				this.page_load_items = (this.page_current_prev - 2) * this.config.quant;
				this.$ajaxblock_prev.show();
				this.$button_prev.hide();
			}


			this.query = this.config.url.current;

			// если знак вопроса есть, то проверим есть ли параметр first
			if( /\?/.test(this.query) ) {
				if( /first/.test(this.query) ) {
					this.query = this.config.url.current.replace(/^\//,'').replace(/first([a-zA-Z]+)\=\d+/,'first$1'+'='+this.page_load_items);
				}
				else {
					this.query = this.config.url.current + '&' + this.offset_func.replace(/first([a-zA-Z]+)\=\d+/,'first$1'+'='+this.page_load_items);
				}
			}
			else {
				this.query = this.config.url.current + '?first'+ this.config.module.func  +'='+this.page_load_items;
			}

			this.counter++;

			if( this.config.preload == 'true' ) {
				if( this.config.debug ) { console.log('cookie plugin loaded') }
				$.cookie('quant'+this.config.module.func, this.config.quant);

				this.query = this.query.replace(/^\//,'').replace(/first([a-zA-Z]+)\=\d+/,'first$1'+'='+this.page_load_items);
			}

			this.query = this.query.replace('&&', '&');

			var qs = {};
			qs['mime'] = 'txt';
			qs['show'] = this.config.module.main;

			$.ajax({
				url: this.query,
				data: $.param(qs),
				cache: false,
				beforeSend: function() {
					self.blocked = true;
					if( self.config.func.before_send ) {
						(self.config.func.before_send)(self);
					}
				},
				statusCode : {
					404 : function() {
						console.error(self._name+': Нет такой страницы!');
						self.unblock();
					},
					503 : function() {
						console.error(self._name+': Страница недоступна!');
						self.unblock();
					}
				},
				success: function(data, textStatus, jqXHR) {
					if( jqXHR.status == 200 ) {
						self.$ajaxblock.hide();
						self.$ajaxblock_prev.hide();

						self.$answer = $('<div>').html(data);

						var $block = self.$answer.find(self._$list.selector);

						// добавим атрибут отключение обработки элемента через lazy, чтобы исключить повторную инициализацию
						$block.attr('data-config-lazy', 'false');
						var $items = $block.find(self.config.selector.items).hide();

//						var total = self.$answer.find(self._$list.selector).attr('data-total');

						var $cutter = $('<div>', {'class':'page-cut'}); 

						if(page == 'next') {
							$cutter.html('<span>'+self.config.locale.interface.page+': '+(self.page_current_next*1+1)+'</span>').appendTo( self.$wrapper );
							$block.appendTo( self.$wrapper );
							self.page_current_next++;
							$block.attr({'data-page':self.page_current_next});
							self.page_loaded[self.page_current_next] = {el: $block};
						}
						if(page == 'prev') {
							self.page_current_prev--;
							self.page_loaded.push( self.page_current_prev );
							$cutter.html('<span>'+self.config.locale.interface.page+': '+(self.page_current_prev*1+1)+'</span>').prependTo( self.$wrapper );
							$block.prependTo( self.$wrapper );
							$block.attr({'data-page':self.page_current_prev});
							self.page_visible = self.page_current_prev;
							self.page_loaded[self.page_current_prev] = {el: $block};
						}

						$items.each(function(i, el) {
							$(el).delay(i*self.config.animation_delay).fadeIn(self.config.animation_time);
						});

						self.check();
//						self.bindCut($block);
						self.bindLinks($block);
						self.unblock();

						if( self.config.func.success ) { (self.config.func.success)(self, $block); }
					}
				},
				error: function(jqXHR, textStatus) {
					console.error(self._name+': Произошла неизвестная ошибка!', jqXHR.status, textStatus);
					if( self.config.func.error ) { (self.config.func.error)(self); }
					self.unblock();
				}
			});
		}
	});
	var module = new $.fn.seedCore(name, $.seed[name]);
})(jQuery, window, document);