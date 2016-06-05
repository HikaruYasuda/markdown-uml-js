(function() {
  "use strict";

  var rules = {
    sequence: /^ *(?:sd *)(?: *(.*[^_])?)?_{2,}\/\n *(\S.*\|.*)\n((?:.*:.*(?:\n|$))*)(\n|$)/i,
    message: /^ *(x) *(<(?:-+|=+|\.+)|(?:-+|=+|\.+)>) *(x)$/,
    note: /^ *(x)? *\[ *(x(?: *, *x)*)? *] *(x)?$/,
    _x: '[^\\[\\] ]+'
  };
  rules.message = replace(rules.message)
  (/x/g, rules._x)
  ();
  rules.note = replace(rules.note)
  (/x/g, rules._x)
  ();
  merge(marked.Lexer.rules, rules);
  merge(marked.Lexer.rules.tables, rules);
  merge(marked.Lexer.rules.gfm, rules);
  marked.Lexer.prototype.sequence = function(cap) {
    var i, j, s, dict = {}, line,
      title = (cap[1]||'').replace(/ +$/, ''),
      actors = cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
      signals = cap[3].replace(/\n$/, '').split('\n');
    for (i = actors.length - 1; i >= 0; i--) {
      s = actors[i].split(/ *: */, 2);
      if (s[1]) {
        dict[s[0]] = i;
        actors[i] = s[1];
      } else {
        dict[actors[i]] = i;
      }
    }
    for (i = 0; i < signals.length; i++) {
      s = signals[i].split(/ *: */, 2);
      if (cap = this.rules.message.exec(s[0])) {
        signals[i] = {
          type: 'message',
          left: getActor(cap[1]),
          right: getActor(cap[3]),
          dir: cap[2][0] == '<' ? 'left' : 'right',
          desc: s[1]
        };
        line = cap[2][signals[i].dir == 'left' ? 1 : 0];
        signals[i].line = line == '=' ? 'async' : line == '.' ? 'reply' : 'sync';
      } else if (cap = this.rules.note.exec(s[0])) {
        signals[i] = {
          type: 'note',
          side: cap[2] ? 'over' : cap[1] ? 'right' : 'left',
          size: 1,
          desc: s[1]
        };
        if (signals[i].side == 'over') {
          s = cap[2].split(/ *, */);
          for (j = 0; j < s.length; j++) {
            s[j] = getActor(s[j]);
          }
          signals[i].on = Math.min.apply(Math, s);
          signals[i].size = Math.max.apply(Math, s) - signals[i].on + 1;
        } else if (signals[i].side == 'right') {
          signals[i].on = getActor(cap[1]);
        } else {
          signals[i].on = getActor(cap[3]);
        }
      } else {
        signals[i] = {
          error: s[0],
          desc: s[1]
        };
      }
    }
    return {
      type: 'sequence',
      title: title,
      actors: actors,
      signals: signals
    };

    function getActor(alias) {
      if (!defined(alias)) return null;
      if (!defined(dict[alias])) {
        dict[alias] = actors.length;
        actors.push(alias);
      }
      return dict[alias];
    }
  };
  marked.Lexer.prototype.token = function(src, top, bq) {
    var next, loose, cap, bull, b, item, space, i, l;
    src = src.replace(/^ +$/gm, '');

    while (src) {
      // newline
      if (cap = this.rules.newline.exec(src)) {
        src = src.substring(cap[0].length);
        if (cap[0].length > 1) {
          this.tokens.push({
            type: 'space'
          });
        }
      }

      // code
      if (cap = this.rules.code.exec(src)) {
        src = src.substring(cap[0].length);
        cap = cap[0].replace(/^ {4}/gm, '');
        this.tokens.push({
          type: 'code',
          text: !this.options.pedantic
            ? cap.replace(/\n+$/, '')
            : cap
        });
        continue;
      }

      // fences (gfm)
      if (cap = this.rules.fences.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'code',
          lang: cap[2],
          text: cap[3] || ''
        });
        continue;
      }

      // heading
      if (cap = this.rules.heading.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'heading',
          depth: cap[1].length,
          text: cap[2]
        });
        continue;
      }

      // sequence diagram
      if (top && (cap = this.rules.sequence.exec(src))) {
        src = src.substring(cap[0].length);
        this.tokens.push(this.sequence(cap));
        continue;
      }

      // table no leading pipe (gfm)
      if (top && (cap = this.rules.nptable.exec(src))) {
        src = src.substring(cap[0].length);

        item = {
          type: 'table',
          header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
          align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
          cells: cap[3].replace(/\n$/, '').split('\n')
        };

        for (i = 0; i < item.align.length; i++) {
          if (/^ *-+: *$/.test(item.align[i])) {
            item.align[i] = 'right';
          } else if (/^ *:-+: *$/.test(item.align[i])) {
            item.align[i] = 'center';
          } else if (/^ *:-+ *$/.test(item.align[i])) {
            item.align[i] = 'left';
          } else {
            item.align[i] = null;
          }
        }

        for (i = 0; i < item.cells.length; i++) {
          item.cells[i] = item.cells[i].split(/ *\| */);
        }

        this.tokens.push(item);

        continue;
      }

      // lheading
      if (cap = this.rules.lheading.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'heading',
          depth: cap[2] === '=' ? 1 : 2,
          text: cap[1]
        });
        continue;
      }

      // hr
      if (cap = this.rules.hr.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'hr'
        });
        continue;
      }

      // blockquote
      if (cap = this.rules.blockquote.exec(src)) {
        src = src.substring(cap[0].length);

        this.tokens.push({
          type: 'blockquote_start'
        });

        cap = cap[0].replace(/^ *> ?/gm, '');

        // Pass `top` to keep the current
        // "toplevel" state. This is exactly
        // how markdown.pl works.
        this.token(cap, top, true);

        this.tokens.push({
          type: 'blockquote_end'
        });

        continue;
      }

      // list
      if (cap = this.rules.list.exec(src)) {
        src = src.substring(cap[0].length);
        bull = cap[2];

        this.tokens.push({
          type: 'list_start',
          ordered: bull.length > 1
        });

        // Get each top-level item.
        cap = cap[0].match(this.rules.item);

        next = false;
        l = cap.length;
        i = 0;

        for (; i < l; i++) {
          item = cap[i];

          // Remove the list item's bullet
          // so it is seen as the next token.
          space = item.length;
          item = item.replace(/^ *([*+-]|\d+\.) +/, '');

          // Outdent whatever the
          // list item contains. Hacky.
          if (~item.indexOf('\n ')) {
            space -= item.length;
            item = !this.options.pedantic
              ? item.replace(new RegExp('^ {1,' + space + '}', 'gm'), '')
              : item.replace(/^ {1,4}/gm, '');
          }

          // Determine whether the next list item belongs here.
          // Backpedal if it does not belong in this list.
          if (this.options.smartLists && i !== l - 1) {
            b = block.bullet.exec(cap[i + 1])[0];
            if (bull !== b && !(bull.length > 1 && b.length > 1)) {
              src = cap.slice(i + 1).join('\n') + src;
              i = l - 1;
            }
          }

          // Determine whether item is loose or not.
          // Use: /(^|\n)(?! )[^\n]+\n\n(?!\s*$)/
          // for discount behavior.
          loose = next || /\n\n(?!\s*$)/.test(item);
          if (i !== l - 1) {
            next = item.charAt(item.length - 1) === '\n';
            if (!loose) loose = next;
          }

          this.tokens.push({
            type: loose
              ? 'loose_item_start'
              : 'list_item_start'
          });

          // Recurse.
          this.token(item, false, bq);

          this.tokens.push({
            type: 'list_item_end'
          });
        }

        this.tokens.push({
          type: 'list_end'
        });

        continue;
      }

      // html
      if (cap = this.rules.html.exec(src)) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: this.options.sanitize
            ? 'paragraph'
            : 'html',
          pre: !this.options.sanitizer
          && (cap[1] === 'pre' || cap[1] === 'script' || cap[1] === 'style'),
          text: cap[0]
        });
        continue;
      }

      // def
      if ((!bq && top) && (cap = this.rules.def.exec(src))) {
        src = src.substring(cap[0].length);
        this.tokens.links[cap[1].toLowerCase()] = {
          href: cap[2],
          title: cap[3]
        };
        continue;
      }

      // table (gfm)
      if (top && (cap = this.rules.table.exec(src))) {
        src = src.substring(cap[0].length);

        item = {
          type: 'table',
          header: cap[1].replace(/^ *| *\| *$/g, '').split(/ *\| */),
          align: cap[2].replace(/^ *|\| *$/g, '').split(/ *\| */),
          cells: cap[3].replace(/(?: *\| *)?\n$/, '').split('\n')
        };

        for (i = 0; i < item.align.length; i++) {
          if (/^ *-+: *$/.test(item.align[i])) {
            item.align[i] = 'right';
          } else if (/^ *:-+: *$/.test(item.align[i])) {
            item.align[i] = 'center';
          } else if (/^ *:-+ *$/.test(item.align[i])) {
            item.align[i] = 'left';
          } else {
            item.align[i] = null;
          }
        }

        for (i = 0; i < item.cells.length; i++) {
          item.cells[i] = item.cells[i]
            .replace(/^ *\| *| *\| *$/g, '')
            .split(/ *\| */);
        }

        this.tokens.push(item);

        continue;
      }

      // top-level paragraph
      if (top && (cap = this.rules.paragraph.exec(src))) {
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'paragraph',
          text: cap[1].charAt(cap[1].length - 1) === '\n'
            ? cap[1].slice(0, -1)
            : cap[1]
        });
        continue;
      }

      // text
      if (cap = this.rules.text.exec(src)) {
        // Top-level should never reach here.
        src = src.substring(cap[0].length);
        this.tokens.push({
          type: 'text',
          text: cap[0]
        });
        continue;
      }

      if (src) {
        throw new
          Error('Infinite loop on byte: ' + src.charCodeAt(0));
      }
    }

    return this.tokens;
  };
  marked.Parser.prototype.tok = function() {
    switch (this.token.type) {
      case 'space': {
        return '';
      }
      case 'hr': {
        return this.renderer.hr();
      }
      case 'heading': {
        return this.renderer.heading(
          this.inline.output(this.token.text),
          this.token.depth,
          this.token.text);
      }
      case 'code': {
        return this.renderer.code(this.token.text,
          this.token.lang,
          this.token.escaped);
      }
      case 'table': {
        var header = ''
          , body = ''
          , i
          , row
          , cell
          , flags
          , j;

        // header
        cell = '';
        for (i = 0; i < this.token.header.length; i++) {
          flags = { header: true, align: this.token.align[i] };
          cell += this.renderer.tablecell(
            this.inline.output(this.token.header[i]),
            { header: true, align: this.token.align[i] }
          );
        }
        header += this.renderer.tablerow(cell);

        for (i = 0; i < this.token.cells.length; i++) {
          row = this.token.cells[i];

          cell = '';
          for (j = 0; j < row.length; j++) {
            cell += this.renderer.tablecell(
              this.inline.output(row[j]),
              { header: false, align: this.token.align[j] }
            );
          }

          body += this.renderer.tablerow(cell);
        }
        return this.renderer.table(header, body);
      }
      case 'blockquote_start': {
        var body = '';

        while (this.next().type !== 'blockquote_end') {
          body += this.tok();
        }

        return this.renderer.blockquote(body);
      }
      case 'list_start': {
        var body = ''
          , ordered = this.token.ordered;

        while (this.next().type !== 'list_end') {
          body += this.tok();
        }

        return this.renderer.list(body, ordered);
      }
      case 'list_item_start': {
        var body = '';

        while (this.next().type !== 'list_item_end') {
          body += this.token.type === 'text'
            ? this.parseText()
            : this.tok();
        }

        return this.renderer.listitem(body);
      }
      case 'loose_item_start': {
        var body = '';

        while (this.next().type !== 'list_item_end') {
          body += this.tok();
        }

        return this.renderer.listitem(body);
      }
      case 'html': {
        var html = !this.token.pre && !this.options.pedantic
          ? this.inline.output(this.token.text)
          : this.token.text;
        return this.renderer.html(html);
      }
      case 'paragraph': {
        return this.renderer.paragraph(this.inline.output(this.token.text));
      }
      case 'text': {
        return this.renderer.paragraph(this.parseText());
      }
      case 'sequence': {
        return this.sequence(this.token);
      }
    }
  };
  marked.Parser.prototype.sequence = function(token) {
    console.log(token);
    var html = '', i, body,
      signals = token.signals,
      len = token.actors.length, width = len * 2 + 2;
    html += '<div class="sequence-diagram">' +
      '<div class="diagram-title">'+token.title+'</div>' +
      '<div class="diagram-body">' +
      '<table class="table">';
    for (i = 0; i < len; i++) {
      body = this.inline.output(token.actors[i]);
      if (i == 0) {
        html += '<tr><th></th><th colspan="2" class="actor"><div><span>'+body+'</span></div>'+body+'</th>\n' +
          '<th colspan="'+((len-i)*2-1) + '"></th></tr>\n';
      } else if (i == len-1) {
        html += '<tr><th colspan="'+(i*2+1)+'"></th>\n' +
          '<th colspan="2" class="actor"><div><span>'+body+'</span></div>'+body+'</th><th></th></tr>\n';
      } else {
        html += '<tr>' +
          '<th colspan="'+(i*2+1)+'"></th>\n' +
          '<th colspan="2" class="actor"><div><span>'+body+'</span></div>'+body+'</th>\n' +
          '<th colspan="'+((len-i)*2-1)+'"></th></tr>\n';
      }
    }
    html += '<tr class="actors"><td colspan="'+width+'">&nbsp;</td></tr>';
    for (i = 0; i < signals.length; i++) {
      html += padding();
      html += '<tr>';
      var sig = signals[i];
      body = this.inline.output(sig.desc);
      switch (sig.type) {
        case 'message':
          html += message(sig.left*2+2, (sig.right-sig.left)*2, body);
          break;
        case 'note':
          if (sig.side == 'over') {
            html += note(sig.on*2+1, sig.size*2, body);
          } else if (sig.side == 'left') {
            html += note(sig.on*2, sig.size*2, body);
          } else if (sig.side == 'right') {
            html += note(sig.on*2+2, sig.size*2, body);
          }
          break;
      }
      html += '</tr>';
    }
    html += padding();
    html += '</table>';
    html += '</div></div>';
    return html;
    function padding() {
      var html = '<tr class="padding">';
      for (var i = 0; i < width; i += 2) {
        html += '<td colspan="2"></td>';
      }
      return html + '</tr>';
    }
    function note(on, size, msg) {
      var html = '', pipe, next;
      size = size || 1;
      for (var i = 0; i < width; i=next) {
        next = i + (i == on ? size : 1);
        pipe = (next & 1 || next == width) ? '' : 'pipe';
        if (i == on) {
          html += '<td colspan="'+size+'" class="'+pipe+'"><div class="note">'+msg+'</div></td>';
          i += size - 1;
        } else {
          html += '<td class="'+pipe+'"></td>';
        }
      }
      return html;
    }
    function message(start, size, msg) {
      var html = '', next, pipe;
      size = size || 1;
      for (var i = 0; i < width; i=next) {
        next = i + (i == start ? size : 1);
        pipe = (next & 1 || next == width) ? '' : 'pipe';
        if (i == start) {
          html += '<td colspan="'+size+'" class="'+pipe+'"><div class="message '+sig.line+' '+sig.dir+'">'+msg+'</div></td>';
          i += size - 1;
        } else {
          html += '<td class="'+pipe+'"></td>';
        }
      }
      return html;
    }
  };

  marked.Lexer.lex = function(src, options) {
    var lexer = new marked.Lexer(options);
    return lexer.lex(src);
  };
  marked.Parser.parse = function(src, options, renderer) {
    var parser = new marked.Parser(options, renderer);
    return parser.parse(src);
  };
  var renderer = new marked.Renderer();
  renderer.listitem = function(text) {
    if (/^\s*\[[x ]]\s*/.test(text)) {
      text = text.replace(/^\s*\[ ]\s*/, '<input type="checkbox" class="task-list-item-checkbox"> ')
        .replace(/^\s*\[x]\s*/, '<input type="checkbox" class="task-list-item-checkbox" checked="checked"> ');
      return '<li style="list-style: none">' + text + '</li>';
    } else {
      return '<li>' + text + '</li>';
    }
  };
  marked.setOptions({
    renderer: renderer,
    highlight: function(code, lang) {
      return hljs.highlightAuto(code).value;
    }
  });
  window.markdown = function(src, opt, callback) {
    return marked.apply(marked, [].slice.call(arguments));
  };

  function escape(html, encode) {
    return html
      .replace(!encode ? /&(?!#?\w+;)/g : /&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function unescape(html) {
    return html.replace(/&([#\w]+);/g, function(_, n) {
      n = n.toLowerCase();
      if (n === 'colon') return ':';
      if (n.charAt(0) === '#') {
        return n.charAt(1) === 'x'
          ? String.fromCharCode(parseInt(n.substring(2), 16))
          : String.fromCharCode(+n.substring(1));
      }
      return '';
    });
  }

  function replace(regex, opt) {
    regex = regex.source;
    opt = opt || '';
    return function self(name, val) {
      if (!name) return new RegExp(regex, opt);
      val = val.source || val;
      val = val.replace(/(^|[^\[])\^/g, '$1');
      regex = regex.replace(name, val);
      return self;
    };
  }

  function noop() {}
  noop.exec = noop;

  function merge(obj) {
    var deep = false
      , args = Array.prototype.slice.call(arguments, 1);
    if (typeof obj == 'boolean') {
      deep = obj;
      obj = args.shift();
    }

    for (var i = 0, ii = args.length, src, v, k; i < ii; i++) {
      src = args[i];
      for (k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) {
          v = src[k];
          if (deep && obj[k] && v && typeof v == 'object') {
            obj[k] = merge(true, obj[k], v);
          } else {
            obj[k] = v;
          }
        }
      }
    }

    return obj;
  }

  function defined(v) {
    return typeof v !== 'undefined';
  }
}());
