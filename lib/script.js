(function() {
  "use strict";
  $.event.fixHooks.drop = { props: [ "dataTransfer" ] };
  $.fn.requestFullscreen = function() {
    var elm = this[0];
    if (!elm) return;
    var fn = elm['requestFullscreen'] ||
      elm['webkitRequestFullscreen'] ||
      elm['mozRequestFullscreen'] ||
      elm['msRequestFullscreen'];
    if (typeof fn == 'function') return fn.call(elm);
  };
  $.exitFullscreen = document['exitFullscreen'] ||
      document['webkitCancelFullScreen'] ||
      document['mozCancelFullScreen'] ||
      document['msExitFullscreen'];
  $.getFullscreenElement = function() { return document['fullScreenElement'] ||
      document['webkitFullscreenElement'] ||
      document['mozFullScreenElement'] ||
      document['msFullscreenElement']
    };
  $.fullscreenEvent = 'fullscreenchange mozfullscreenchange webkitfullscreenchange msfullscreenchange';

  var $workspace = $('#workspace'),
    $markdown = $('#markdown'),
    $preview = $('#preview'),
    $menu = $('#menu'),
    changed;
  $markdown.val(load())
    .on('input change', function() {
      $preview.html(markdown(this.value));
      changed = true;
    }).trigger('change');
  changed = false;

  $workspace.on('drop', function(e) {
    var file = e['dataTransfer'].files[0];
    console.log(file);
    if (!file || !/text.*/.test(file.type)) return false;
    var reader = new FileReader();
    reader.onload = function(e) {
      $markdown.val(e.target.result);
    };
    reader.readAsText(file);
    return false;
  });

  $(window).on('beforeunload', function() {
    return '閉じますか？';
  }).on($.fullscreenEvent, function(e) {
    console.log(e);
    if ($.getFullscreenElement()) {
      $workspace.addClass('full');
    } else {
      $workspace.removeClass('full');
    }
  });

  $menu.html(menu.init()
    .add('Github', function() {})
    .add('Save', 'meta+s', function() {
      save($markdown.val());
      toastr.info('saved.', null, {timeOut: 1500});
      changed = false;
    })
    .add('Reload', 'meta+r', function() {
      $markdown.val(load());
      changed = false;
      toastr.info('reloaded.', null, {timeOut: 1500});
    })
    .add('Export...', 'meta+e', function() {
      var m = /^\s*#\s+([^\n]+)/gm.exec($markdown.val()),
        title = m ? m[1] : 'download';
      download(title+'.md', $markdown.val());
    })
    .add('Import...', 'meta+i', function() {

    })
    .add('Open URL...', function() {

    })
    .add('V/H', 'meta+t', function() {
      if ($workspace.hasClass('vertical')) {
        $workspace.removeClass('vertical');
      } else {
        $workspace.addClass('vertical');
      }
    })
    .add('Editor', 'meta+E', function() {
      $markdown.toggle();
    })
    .add('Preview', 'meta+P', function() {
      $preview.toggle();
    })
    .add('FullScreen', function() {
      $workspace.requestFullscreen();
    })
    .html()
  );

  function download(fileName, content) {
    var blob = new Blob([content]),
      url = window['URL'] || window['webkitURL'],
      blobURL = url['createObjectURL'](blob),
      a = document.createElement('a');
    a.download = fileName;
    a.href = blobURL;
    a.click();
  }
  function upload() {
    var input = document.createElement('input');
    input.type = 'file';
    input.click();
    input.addEventListener('change', function(e) {
      var files = e.target.files;
      console.log(files);
    });
  }
  function load() {
    var data = localStorage.getItem('md')||'',
      m = /^(\d{13}):/.exec(data);
    if (m) return data.substring(m[0].length);
    return data;
  }
  function save(data) {
    var stamp = (new Date-0)+':';
    localStorage.setItem('md', stamp + data);
  }
}());