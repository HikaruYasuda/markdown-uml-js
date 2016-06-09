(function() {
  "use strict";
  $.event.fixHooks.drop = {props: ['dataTransfer']};
  $.fn.requestFullscreen = function() {
    var elm = this[0];
    if (!elm) return;
    var fn = elm['requestFullscreen'] ||
      elm['webkitRequestFullscreen'] ||
      elm['mozRequestFullscreen'] ||
      elm['msRequestFullscreen'];
    if (typeof fn == 'function') return fn.call(elm);
  };
  $.fn.setMarkdown = function(data, state) {
    this.val(data || '').trigger('change');
    if (typeof state == 'boolean') {
      changed = state;
    }
    return this;
  };
  $.fn.getRect = function() {
    if (!this.length) return null;
    /** @type {{left: Number?, top: Number?, right: Number?, bottom: Number?, width: Number?, height: Number?}} */
    var rect = {left: null, top: null, right: null, bottom: null, width: null, height: null};
    this.each(function() {
      var _rect = this.getBoundingClientRect();
      if (rect.left) {
        rect.left = Math.min(rect.left, _rect.left);
        rect.right = Math.max(rect.right, _rect.right);
        rect.top = Math.min(rect.top, _rect.top);
        rect.bottom = Math.max(rect.bottom, _rect.bottom);
      } else {
        rect = {left: _rect.left, top: _rect.top, right: _rect.right, bottom: _rect.bottom};
      }
    });
    rect.width = rect.right - rect.left;
    rect.height = rect.bottom - rect.top;
    return rect;
  };
  toastr.options = {timeOut: 1500};

  $(window).on('beforeunload', function() {
    return '閉じますか？';
  }).on('resize', function() {
    $('.virtual-border').each(function() {
      var $this = $(this)
        , cap = /(?:^|\s)(vb-\S+)/.exec(this.className)
        , rect = cap ? $('.'+cap[1]).getRect() : null;
      if (rect) $this.height(rect.height);
    });
  });

  var $menu = $('#menu'),
    $workspace = $('#workspace').on('drop', function(e) {
      readFile(e['dataTransfer'].files[0], function(text) {
        $markdown.setMarkdown(text);
      });
      return false;
    }),
    $markdown = $('#markdown').on('input change', function() {
      $preview.html(markdown(this.value));
      $(window).trigger('resize');
      changed = true;
    }),
    $preview = $('#preview'),
    changed = false;

  $menu.html(menu
    .add('Github', function() {})
    .add('Save', 'ex+s', function() {
      setLocal($markdown.val());
      changed = false;
      toastr.info('Saved.');
    })
    .add('Reload', 'ex+r', function() {
      $markdown.setMarkdown(getLocal(), false);
      toastr.info('Reloaded.');
    })
    .add('Export...', 'ex+e', function() {
      var m = /^\s*#\s+([^\n]+)/gm.exec($markdown.val()),
        title = m ? m[1] : 'download';
      download(title+'.md', $markdown.val());
    })
    .add('Import...', 'ex+i', function() {
      openFile(function(text) {
        $markdown.setMarkdown(text);
      });
    })
    .add('Open URL...', function() {
      var url = prompt('Input URL for open', 'https://raw.githubusercontent.com/HikaruYasuda/markdown-uml-js/master/README.md');
      if (url) loadURL(url);
    })
    .add('V/H', 'ex+h', function() {
      $workspace.toggleClass('vertical');
      localStorage.setItem('vh', $workspace.hasClass('vertical')?1:0);
    })
    .add('Editor', 'ex+E', function() {
      $markdown.toggle();
    })
    .add('Preview', 'ex+P', function() {
      $preview.toggle();
    })
    .add('FullScreen', function() {
      $workspace.requestFullscreen();
    })
    .start().html()
  );

  init();

  function init() {
    var opts = {}
      , vh = localStorage.getItem('vh')-0;
    if (location.search.length > 1) {
      var qs = location.search.slice(1).split(/&/g),
        i = 0, ii = qs.length, q;
      for (; i < ii; i++) {
        q = qs[i].split('=');
        opts[decodeURIComponent(q[0])] = decodeURIComponent(q[1]);
      }
    }
    console.debug('option', opts);
    $workspace.toggleClass('vertical', !!(defined(opts['vh']) ? opts['vh']-0 : vh));
    if (opts.url) {
      $markdown.setMarkdown('loading...\n'+opts.url);
      loadURL(opts.url);
    } else {
      $markdown.setMarkdown(getLocal(), false);
    }
  }
  function download(fileName, content) {
    var blob = new Blob([content]),
      url = window['URL'] || window['webkitURL'],
      blobURL = url['createObjectURL'](blob),
      a = document.createElement('a');
    a.download = fileName;
    a.href = blobURL;
    a.click();
  }
  function openFile(callback) {
    $('<input type="file">')
      .change(function(e) {
        readFile(e.target.files[0], callback);
      })
      .appendTo('body').each(function() {
        this.click();
        this.parentNode.removeChild(this);
      });
  }
  function readFile(file, callback) {
    if (!file) return;
    if (file.size > 100000) {
      return toastr.info('File size is too large. (max: 100kB)');
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      callback(e.target.result);
    };
    reader.readAsText(file);
  }
  function loadURL(url) {
    return $.ajax(url).then(function(data) {
      $markdown.setMarkdown(data);
      var fileName = decodeURIComponent(url.split(new RegExp('/','g')).pop().split(/[\?#]/)[0]);
      toastr.info(fileName, 'Loaded');
    }, function() {
      $markdown.setMarkdown('failed\n'+url);
      toastr.error(url, 'Load error ?');
    });
  }
  function getLocal() {
    var data = localStorage.getItem('md')||'',
      m = /^(\d{13}):/.exec(data);
    if (m) return data.substring(m[0].length);
    return data;
  }
  function setLocal(data) {
    var stamp = (new Date-0)+':';
    localStorage.setItem('md', stamp + data);
  }
  function defined(v) {
    return typeof v !== 'undefined';
  }
}());