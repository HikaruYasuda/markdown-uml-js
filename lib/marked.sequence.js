/**
 * marked.sequence
 * Copyright (c) 2016, Hikaru Yasuda. (MIT Licensed)
 */
(function() {
  "use strict";

  var rules = {
    sequence: /^ *(?:sd *)(?: *(.*[^_])?)?_{2,}\/\n(?: *(\S.*\|.*)\n)?((?: *\S.*(?:\n|$))*)(?:\n|$)/i,
    sd_message: /^ *(x) *(<(?:-+|=+|\.+)|(?:-+|=+|\.+)>) *(x)? *$/,
    sd_fragment_start: /^ *(x) *\[ *(x(?: *, *x)*) *] *$/,
    sd_fragment_end: /^ *\/(x) *$/,
    sd_guard: /^ *([\[{]) *: *(.+)[\]}]? *$/,
    sd_note: /^ *(x)? *\[ *(x(?: *, *x)*)? *] *(x)? *$/,
    _x: /[^\[\]\-:=.<> ]+/
  };
  rules.sd_message = replace(rules.sd_message)(/x/g, rules._x)();
  rules.sd_note = replace(rules.sd_note)(/x/g, rules._x)();
  rules.sd_fragment_start = replace(rules.sd_fragment_start)(/x/g, rules._x)();
  rules.sd_fragment_end = replace(rules.sd_fragment_end)(/x/g, rules._x)();

  var block = merge(marked.Lexer.rules, rules);
  merge(marked.Lexer.rules.tables, rules);
  merge(marked.Lexer.rules.gfm, rules);
  marked.Lexer.prototype.sequence = function(cap) {
    var i, j, cmd, sig, desc, split
      , lineTypes = {'-': 'sync', '=': 'async', '.': 'reply'}
      , dict = {}
      , fragments = []
      , runs = {}
      , title = (cap[1]||'').replace(/ +$/, '')
      , actors = cap[2] ? cap[2].replace(/^ *|( *\|)? *$/g, '').split(/ *\| */) : []
      , commands = cap[3] ? cap[3].replace(/\n+$/, '').split('\n') : []
      , signals = [];
    for (i = actors.length - 1; i >= 0; i--) {
      split = actors[i].replace(/ *= */, '\t').split('\t');
      if (split.length > 1) {
        dict[split[0]] = i;
        actors[i] = split[1];
      } else {
        dict[actors[i]] = i;
      }
    }

    while (cmd = commands.shift()) {
      desc = cmd.replace(/ *: */, '\t').split('\t');
      sig = desc[0];
      desc = desc[1];

      if (cap = this.rules.sd_message.exec(sig)) {
        split = /(^<)?([-=\.])+(>$)?/.exec(cap[2]);
        sig = {
          type: 'message',
          left: getActor(cap[1]),
          right: getActor(cap[3]),
          dir: 'self',
          line: lineTypes[split[2]],
          desc: desc
        };
        if (cap[3]) {
          if (split[1]) sig.dir = 'left';
          else if (split[3]) sig.dir = 'right';
        }
        sig.from = (sig.dir == 'left') ? sig.right : sig.left;
        sig.to = (sig.dir == 'right') ? sig.right : sig.left;
        sig.starts = {};
        sig.ends = {};
        if (!runs[sig.from]) runs[sig.from] = sig.starts[sig.from] = true;
        if (cap[3] && !runs[sig.to]) runs[sig.to] = sig.starts[sig.to] = true;
        for (j = signals.length - 1; j >= 0; j--) {
          if (signals[j].type == 'message') {
            if (signals[j].dir != 'self'
              && signals[j].to == sig.from) {
              delete sig.starts[sig.from];
              break;
            } else {
              delete signals[j].starts[sig.from];
              delete signals[j].ends[sig.from];
            }
          }
        }
        if (sig.line == 'reply') {
          delete runs[sig.from];
          sig.ends[sig.from] = true;
        }
        signals.push(sig);
        continue;
      }

      if (cap = this.rules.sd_fragment_start.exec(sig)) {
        sig = {
          type: 'fragment_start',
          name: cap[1],
          depth: fragments.length,
          desc: desc
        };
        split = cap[2].split(/ *, */);
        for (j = 0; j < split.length; j++) {
          split[j] = getActor(split[j]);
        }
        sig.on = minOf(split);
        sig.size = maxOf(split) - sig.on + 1;
        signals.push(sig);
        fragments.push(sig);
        continue;
      }

      if ((cap = this.rules.sd_guard.exec(cmd)) && fragments.length) {
        signals.push({
          type: 'guard',
          ends: cap[1],
          desc: desc
        });
        continue;
      }

      if (cap = this.rules.sd_fragment_end.exec(sig)) {
        split = [];
        for (j = fragments.length - 1; j >= 0; j--) {
          split.push({
            type: 'fragment_end'
          });
          if (fragments[j].name == cap[1]) {
            Array.prototype.push.apply(signals, split);
            split = null;
            break;
          }
        }
        if (split === null) continue;
      }

      if (cap = this.rules.sd_note.exec(sig)) {
        sig = {
          type: 'note',
          size: 1,
          desc: desc
        };
        if (cap[2]) {
          sig.side = 'over';
          split = cap[2].split(/ *, */);
          for (j = split.length - 1; j >= 0; j--) {
            split[j] = getActor(split[j]);
          }
          sig.on = minOf(split);
          sig.size = maxOf(split) - sig.on + 1;
        } else if (cap[1]) {
          sig.side = 'right';
          sig.on = getActor(cap[1]);
        } else {
          sig.side = 'left';
          sig.on = getActor(cap[3]);
        }
        signals.push(sig);
        continue;
      }

      if (signals.length) {
        sig = signals.pop();
        sig.desc += '\n' + cmd;
        signals.push(sig);
      } else {
        console.log('unmatch', cmd);
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
  var super_tok = marked.Parser.prototype.tok;
  marked.Parser.prototype.tok = function() {
    if (this.token.type == 'sequence') {
      return this.sequence(this.token);
    }
    return super_tok.call(this);
  };
  marked.Parser.prototype.sequence = function(token) {
    // console.log(token);
    var html = '', i, j, sig, frag, starts
      , renderer = this.renderer.sequence
      , lives = token.actors.length
      , runs = new Array(lives)
      , signals = token.signals
      , fragments = []
      , cols = lives * 2 + 2
      , body = this.inline.output(token.title)
      , id = getID();
    html += '<div class="sequence-diagram">\n' +
      '<div class="diagram-title"><span>' + body + '</span></div>' +
      '<div class="diagram-body">\n' +
      '<table class="table"><thead><tr><th></th>\n';
    for (i = 0; i < lives; i++) {
      body = this.inline.output(token.actors[i]);
      html += '<th colspan="2"><div class="actor">' + body + '</div></th>\n';
    }
    html += '<th></th></tr></thead><tbody class="fill-'+id+'">\n';
    html += renderer.padding(lives, id);
    for (i = 0; i < signals.length; i++) {
      sig = signals[i];
      body = this.inline.output(sig.desc);
      switch (sig.type) {
        case 'message':
          starts = {};
          html += renderer.message(sig, body, cols);
          for (j in sig.starts) if (sig.starts.hasOwnProperty(j)) {
            starts[j] = runs[j] = getID();
          }
          html += renderer.execution(lives, runs, starts);
          for (j in sig.ends) if (sig.ends.hasOwnProperty(j)) {
            delete runs[j];
          }
          break;
        case 'note':
          html += renderer.note(sig, body, cols);
          break;
        case 'fragment_start':
          fragments.unshift({
            name: sig.name,
            on: sig.on,
            size: sig.size,
            guards: 0,
            depth: fragments.length,
            id: getID(sig.name)
          });
          html += renderer.fragment_start(fragments[0], body, cols);
          if (signals[i+1] && signals[i+1].type == 'guard') {
            continue;
          }
          break;
        case 'fragment_end':
          frag = fragments.shift();
          html += renderer.fragment_end(frag, cols);
          break;
        case 'guard':
          if (fragments.length) {
            html += renderer.guard(fragments[0], sig.ends, body, cols);
            fragments[0].guards++;
          }
          break;
      }
      html += renderer.padding(lives);
    }
    while (fragments.length) {
      html += renderer.fragment_end(fragments[0], cols);
      html += renderer.padding(lives);
      fragments.shift();
    }
    html += '</tbody></table></div></div>\n';
    return html;
  };

  marked.Renderer.prototype.sequence = {
    fragment_start: function(frag, body, cols) {
      var start = frag.on * 2 + 1
        , size = frag.size * 2
        , cls = 'fragment--' + frag.name + ' fragment-depth--' + frag.depth
        , fill = '<div class="fill fill-'+frag.id+'"></div>'
        , content = '<div class="fragment '+cls+'">'+fill+'<div class="fragment-title"><span>'+frag.name+' '+body+'</span></div></div>';
      return this._row(start, size, content, cols);
    },
    fragment_end: function(frag, cols) {
      var start = frag.on * 2 + 1
        , size = frag.size * 2
        , cls = 'fragment--' + frag.name + ' fragment-depth--' + frag.depth
        , content = '<div class="fragment-end '+cls+' fill-'+frag.id+'"></div>';
      return this._row(start, size, content, cols);
    },
    guard: function(frag, ends, body, cols) {
      var start = frag.on * 2 + 1
        , size = frag.size * 2
        , cls = 'fragment--' + frag.name + ' fragment-depth--' + frag.depth
        , pairs = {'[': ']', '{': '}'}
        , pair = pairs[ends]
        , content = '<div class="guard '+cls+' '+(frag.guards ?'bordered':'')+'"><span>'+ends+body+pair+'</span></div>';
      return this._row(start, size, content, cols);
    },
    message: function(sig, body, cols) {
      var start = sig.left * 2 + 2
        , size = Math.max((sig.right - sig.left) * 2, 1)
        , content = '<div class="message '+sig.line+' '+sig.dir+'"><span>'+body+'</span></div>';
      return this._row(start, size, content, cols);
    },
    note: function(sig, body, cols) {
      var start = sig.on * 2 + (sig.side == 'left' ? 0 : sig.side == 'over' ? 1 : 2)
        , size = Math.max(sig.size * 2, 1)
        , content = '<div class="note">'+body+'</div>';
      return this._row(start, size, content, cols);
    },
    padding: function(lives, id) {
      var html = '<tr class="padding"><td colspan="2"></td>'
        , td = '<td colspan="2">' +
        (id?'<div class="fill fill-'+id+'"></div>':'') +'</td>';
      return html + new Array(lives + 1).join(td) + '</tr>';
    },
    execution: function(lives, ids, starts) {
      var html = '<tr class="execution"><td colspan="2"></td>';
      ids = ids || [];
      for (var i = 0; i < lives; i++) {
        html += '<td colspan="2">';
        if (starts[i]) html += '<div class="fill fill-'+starts[i]+'"></div>';
        else if (ids[i]) html += '<div class="fill--end fill-'+ids[i]+'"></div>';
        html += '</td>';
      }
      return html + '</tr>';
    },
    _row: function(start, size, body, cols) {
      var html = '<tr>', pipe, i = 0;
      do {
        pipe = (i&1) ? '' : 'class="pipe"';
        if (i == start) {
          html += '<td colspan="'+size+'" '+pipe+'>'+body+'</td>';
        } else {
          html += '<td '+pipe+'></td>';
        }
      } while ((i += (i == start ? size : 1)) < cols);
      return html + '</tr>\n';
    }
  };

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
  function minOf(arr) {
    return Math.min.apply(Math, arr);
  }
  function maxOf(arr) {
    return Math.max.apply(Math, arr);
  }
  function getID(prefix) {
    var s = prefix||'', rnd, i;
    for (i = 0; i < 6; i++) {
      rnd = Math.random() * 16 | 0;
      s += (i == 12 ? 4 : (i == 16 ? (rnd & 3 | 8) : rnd)).toString(16);
    }
    return s;
  }
}());
