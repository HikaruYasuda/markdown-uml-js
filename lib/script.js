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
  toastr.options = {timeOut: 1500};

  $(window).on('beforeunload', function() {
    return '閉じますか？';
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
      alert('準備中');
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
    $markdown.setMarkdown(getLocal(), false);
    $workspace.toggleClass('vertical', !!(defined(opts['vh']) ? opts['vh']-0 : vh));
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
  function getAjax(url) {
    return $.ajax(url).then(function() {

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