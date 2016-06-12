(function() {
  "use strict";

  var isOSX = /Mac|PPC/.test(navigator.userAgent),
    ex = {
      ex: ['e.ctrlKey ^ e.metaKey', '&#x2318;', 'Ctrl'],
      ctrl: ['e.ctrlKey', '&#x2303;', 'Ctrl'],
      alt: ['e.altKey', '&#x2325;', 'Alt'],
      esc: ['e.keyCode == 27', '&#x238B;', 'Esc'],
      shift: ['e.shiftKey', '&#x21E7;', 'Shift']
    };

  window.menu = {
    menus: [],
    eventTarget: window,
    start: function(target) {
      this.eventTarget = target || window;
      $(this.eventTarget).off('keydown.menu').on('keydown.menu', function(e) {
        for (var i = 0, ii = this.menus.length; i < ii; i++) {
          if (check(this.menus[i], e)) {
            this.call(i, e);
            return false;
          }
        }
      }.bind(this));
      return this;
    },
    stop: function() {
      $(this.eventTarget).off('keydown.menu');
      return this;
    },
    html: function() {
      var html = '';
      this.menus.forEach(function(menu, i) {
        if (!menu.title) return;
        var short = menu.shortcuts.join(isOSX ? '' : '+');
        html += '<li><a href="javascript:menu.call('+i+')">' +
          '<span>' + escape(menu.title) + '</span>';
        if (short.length) {
          html += '<span class="shortcut">' + escape(short) + '</span>';
        }
        html += '</a></li>\n';
      });
      return html;
    },
    call: function(index, e) {
      var menu = this.menus[index];
      if (menu && typeof menu.callback == 'function') {
        menu.callback(e||window.event, menu);
      }
    },
    add: function(title, key, callback) {
      if (typeof key == 'function') {
        callback = key;
        key = '';
      }
      var keys = key.split(/\+/g)
        , i = 0
        , ii = keys.length
        , requires = []
        , shortcuts = []
        , cap;
      for (; i < ii; i++) {
        if (ex[keys[i]]) {
          requires.push(ex[keys[i]][0]);
          shortcuts.push(isOSX ? ex[keys[i]][1] : ex[keys[i]][2]);
        } else if (typeof keys[i] == 'number') {
          requires.push('e.keyCode===' + keys[i]);
          shortcuts.push(String.fromCharCode(keys[i]));
        } else if (cap = /^F([12][0-9]|[1-9])/i.exec(keys[i])) {
          requires.push('e.keyCode===' + (cap[1] + 111));
          shortcuts.push(cap[0]);
        } else if (typeof keys[i] == 'string') {
          if (keys[i].toLowerCase() != keys[i]) {
            requires.push(ex.shift[0]);
            shortcuts.push(isOSX ? ex.shift[1] : ex.shift[2]);
          } else if (!~requires.indexOf('e.shiftKey')) {
            requires.push('!e.shiftKey');
          }
          keys[i] = keys[i].substr(0,1).toUpperCase();
          requires.push('e.keyCode==='+keys[i].charCodeAt(0));
          shortcuts.push(keys[i]);
        }
      }
      this.menus.push({
        requires: requires,
        callback: callback,
        title: title,
        shortcuts: shortcuts
      });
      return this;
    }
  };

  function check(menu, e) {
    for (var i = 0, ii = menu.requires.length; i < ii; i++) {
      if (!eval(menu.requires[i])) return false;
    }
    return !!e;
  }
  function escape(html) {
    return html
      .replace(/&(?!#?\w+;)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}());