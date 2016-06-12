(function() {
  "use strict";
  $.event.fixHooks.drop = {props: ['dataTransfer']};
  $._requestFullScreen = (function(e) { return e['requestFullscreen'] || e['webkitRequestFullscreen'] || e['mozRequestFullscreen'] || e['msRequestFullscreen'] || function(){}; }(document.body));
  $.fn.requestFullscreen = function() { return this.each(function() { $._requestFullScreen(this); return false; }); };
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
    }(new marked.Renderer)),
    highlight: function(code, lang) {
      return hljs.highlightAuto(code, [lang]).value;
    }
  });

  $(window).on('beforeunload', function() {
    return '閉じますか？';
  });

  var changed = false,
    $workspace = $('#workspace').on('drop', function(e) {
      readFile(e['dataTransfer'].files[0], function(text) {
        setMarkdown(text);
      });
      return false;
    }),
    $markdown = $('#markdown').on('input change', function() {
      marked(this.value, function(err, out) {
        if (err) return console.error(err);
        $preview.html(out).trigger('resize');
        changed = true;
      });
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
        var data = get(k);
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
    .add('V/H', 'ex+h', function() {
      $workspace.toggleClass('vertical');
      config.set('vh', $workspace.hasClass('vertical')-0);
    })
    .add('View', 'ex+/', function() {
      
    })
    .add('Editor', 'ex+E', function() {
      $markdown.toggle();
      config.set('e', $markdown.is(':visible')-0);
    })
    .add('Preview', 'ex+P', function() {
      $preview.toggle();
      config.set('p', $preview.is(':visible')-0);
    })
    .add('FullScreen', function() {
      $workspace.requestFullscreen();
    })
    .html()
  );

  init();

  function init() {
    var url
      , vh = config.get('vh')-0
      , e = config.get('e', 1)
      , p = config.get('p', 1);
    run_opts({
      url: function(v) {
        url = v;
      },
      vh: function(v) {
        vh = v-0;
      },
      editor: function() {
        e = !(p = !0);
        console.info('editor mode: on');
      },
      preview: function() {
        p = !(e = !1);
        console.info('preview mode: on');
      }
    });
    $workspace.toggleClass('vertical', !!vh);
    $markdown.toggle(!!e);
    $preview.toggle(!!p);
    if (url) {
      setMarkdown('loading...\n'+url);
      loadURL(url);
    } else {
      setMarkdown(getLocal(), false);
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