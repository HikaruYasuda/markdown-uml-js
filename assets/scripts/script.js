(function() {
  "use strict";
  $.event.fixHooks.drop = {props: ['dataTransfer']};
  $.fn.getRect = function() {
    if (!this.length) return null;
    var rect = {};
    this.each(function() {
      var _rect = this.getBoundingClientRect();
      if (rect.left !== void 0) {
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
  marked.setOptions({
    renderer: (function(renderer) {
      renderer.listitem = function(text) {
        if (/^\s*\[[x ]]\s*/.test(text)) {
          text = text.replace(/^\s*\[ ]\s*/, '<input type="checkbox" class="task-list-item-checkbox"> ')
            .replace(/^\s*\[x]\s*/, '<input type="checkbox" class="task-list-item-checkbox" checked="checked"> ');
          return '<li style="list-style: none">' + text + '</li>';
        } else {
          return '<li>' + text + '</li>';
        }
      };
      return renderer;
    }(new marked.Renderer)),
    highlight: function(code, lang) {
      return hljs.highlightAuto(code, [lang]).value;
    }
  });

  $(window).on('beforeunload', function() {
    return '閉じますか？';
  });

  var changed = false,
    queue = null,
    delay = 30,
    $workspace = $('#workspace').on('drop', function(e) {
      readFile(e['dataTransfer'].files[0], function(text) {
        setMarkdown(text);
      });
      return false;
    }),
    $markdown = $('#markdown').on('input change', function() {
      if (queue) clearTimeout(queue);
      queue = setTimeout(function() {
        marked(this.value, function(err, out) {
          if (err) return console.error(err);
          $preview.html(out).trigger('resize');
          changed = true;
        });
      }.bind(this), delay);
    }),
    $preview = $('#preview').on('resize', function() {
      $('.fill').each(function() {
        var $this = $(this)
          , cap = /(?:^|\s)fill-(\S+)/.exec(this.className)
          , rect = cap ? $('.fill-'+cap[1]).getRect() : null;
        if (rect) $this.height(rect.height);
      });
    }),
    setMarkdown = function(data, state) {
      $markdown.val(data || '').trigger('change');
      if (typeof state == 'boolean') {
        changed = state;
      }
      return this;
    },
    config = {
      get: function(k, def) {
        try { var data = JSON.parse(localStorage.getItem('config')); } catch (e) {}
        data = data||{};
        if (!k) return data;
        if (data[k] === void 0) return def;
        return data[k];
      },
      set: function(k, v) {
        if (!k) return;
        var data = this.get();
        if (v === void 0) {
          delete data[k];
        } else {
          data[k] = v;
        }
        localStorage.setItem('config', JSON.stringify(data));
      }
    },
    run_opts = function(opts, query) {
      if (query = (query || location.search.slice(1))) {
        var qs = query.split(/&/g),
          i = 0, ii = qs.length, q;
        for (; i < ii; i++) {
          q = qs[i].split('=');
          if (opts[q[0]]) opts[q[0]](decodeURIComponent(q[1]));
        }
      }
    };

  $('#menu').html(menu.start()
    .add('Github', function() {
      window.open('https://github.com/HikaruYasuda/markdown-uml-js', '_blank');
    })
    .add('Save', 'ex+s', function() {
      setLocal($markdown.val());
      changed = false;
      toastr.info('Saved.');
    })
    .add('Reload', 'ex+r', function() {
      setMarkdown(getLocal(), false);
      toastr.info('Reloaded.');
    })
    .add('Export...', 'ex+e', function() {
      var m = /^\s*#\s+([^\n]+)/gm.exec($markdown.val()),
        title = m ? m[1] : 'download';
      download(title+'.md', $markdown.val());
    })
    .add('Import...', 'ex+i', function() {
      openFile(setMarkdown);
    })
    .add('Open URL...', function() {
      var url = prompt('Input URL for open', 'https://raw.githubusercontent.com/HikaruYasuda/markdown-uml-js/master/README.md');
      if (url) loadURL(url);
    })
    .add('Attach Image...', function() {
      attachImage(function(url) {
        console.log(url);
      });
    })
    .add('V/H', 'ex+h', function() {
      config.set('vh', vertical(! vertical()));
    })
    .add('View', 'ex+/', function() {
      config.set('v', viewMode(config.get('v', 0) + 1));
    })
    .add('Presentation', 'ex+P', function() {
    })
    .html()
  );

  init();

  function init() {
    var url
      , vh = config.get('vh')-0
      , view = config.get('v', 0);
    run_opts({
      'url': function(v) { url = v; },
      'vh': function(v) { vh = v-0; },
      'editor': function() { view = 2; },
      'preview': function() { view = 1; }
    });
    vertical(vh);
    viewMode(view);
    if (url) {
      setMarkdown('loading...\n'+url);
      loadURL(url);
    } else {
      setMarkdown(getLocal(), false);
    }
  }
  function vertical(state) {
    if (state !== void 0) {
      $workspace.toggleClass('vertical', !!state);
      $preview.trigger('resize');
    }
    return $workspace.hasClass('vertical')-0;
  }
  function viewMode(v) {
    v = v % 3;
    switch (v) {
      case 0: $markdown.show(); $preview.show(); break;
      case 1: $markdown.hide(); $preview.show(); break;
      case 2: $markdown.show(); $preview.hide(); break;
    }
    $preview.trigger('resize');
    return v;
  }
  function download(fileName, content) {
    var blobURL = createObjectURL(new Blob([content], 'text/markdown')),
      a = document.createElement('a');
    a.download = fileName;
    a.href = blobURL;
    a.click();
  }
  function chooseFile(callback) {
    $('<input type="file">')
      .change(function(e) {
        e.target.files.length && callback(e.target.files[0]);
      })
      .appendTo('body')
      .each(function() {
        this.click();
        $(this).remove();
      });
  }
  function openFile(callback) {
    chooseFile(function(file) {
      readFile(file, callback);
    });
  }
  function attachImage(callback) {
    chooseFile(function(file) {
      toBlobURL(file, callback);
    });
  }
  function readFile(file, callback) {
    if (!file) return;
    if (file.size > 100000) return toastr.info('File size is too large. (max: 100kB)');
    var reader = new FileReader();
    reader.onload = function(e) {
      callback(e.target.result);
    };
    reader.readAsText(file);
  }
  function toBlobURL(blob, callback) {
    if (!blob) return;
    if (blob.size > 1000000) return toastr.info('File size is too large. (max: 1MB)');
    callback(createObjectURL(blob));
  }
  function createObjectURL(blob) {
    var URL = window['URL'] || window['webkitURL'];
    return URL['createObjectURL'](blob);
  }
  function loadURL(url) {
    return $.ajax(url).then(function(data) {
      setMarkdown(data);
      var fileName = decodeURIComponent(url.split(new RegExp('/','g')).pop().split(/[\?#]/)[0]);
      toastr.info(fileName, 'Loaded');
    }, function() {
      setMarkdown('failed\n'+url);
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
}());