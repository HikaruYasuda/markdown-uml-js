/**
 * marked-uml
 * Copyright (c) 2016 Hikaru Yasuda. (MIT Licensed)
 * https://github.com/HikaruYasuda/marked-uml
 *
 * marked - a markdown parser
 * Copyright (c) 2011-2014, Christopher Jeffrey. (MIT Licensed)
 * https://github.com/chjj/marked
 */
;(function() {
  "use strict";

  /**
   * Block-Level Grammar
   */

  var block = {
    newline: /^\n+/,
    code: /^( {4}[^\n]+\n*)+/,
    fences: noop,
    hr: /^( *[-*_]){3,} *(?:\n+|$)/,
    heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
    nptable: noop,
    lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
    blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
    list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
    html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
    def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
    table: noop,
    paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
    text: /^[^\n]+/
  };

  block.bullet = /(?:[*+-]|\d+\.)/;
  block.item = /^( *)(bull) [^\n]*(?:\n(?!\1bull )[^\n]*)*/;
  block.item = replace(block.item, 'gm')
  (/bull/g, block.bullet)
  ();

  block.list = replace(block.list)
  (/bull/g, block.bullet)
  ('hr', '\\n+(?=\\1?(?:[-*_] *){3,}(?:\\n+|$))')
  ('def', '\\n+(?=' + block.def.source + ')')
  ();

  block.blockquote = replace(block.blockquote)
  ('def', block.def)
  ();

  block._tag = '(?!(?:'
    + 'a|em|strong|small|s|cite|q|dfn|abbr|data|time|code'
    + '|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo'
    + '|span|br|wbr|ins|del|img)\\b)\\w+(?!:/|[^\\w\\s@]*@)\\b';

  block.html = replace(block.html)
  ('comment', /<!--[\s\S]*?-->/)
  ('closed', /<(tag)[\s\S]+?<\/\1>/)
  ('closing', /<tag(?:"[^"]*"|'[^']*'|[^'">])*?>/)
  (/tag/g, block._tag)
  ();

  block.paragraph = replace(block.paragraph)
  ('hr', block.hr)
  ('heading', block.heading)
  ('lheading', block.lheading)
  ('blockquote', block.blockquote)
  ('tag', '<' + block._tag)
  ('def', block.def)
  ();

  /**
   * Sequence-diagram
   */

  block.sequence = /^ *(?:sd *)(?: *(.*[^_])?)?_{2,}\/\n(?: *(\S.*\|.*)\n)?((?: *\S.*(?:\n|$))*)(?:\n|$)/i;
  block.sd_message = /^ *(x) *(<(?:-+|=+|\.+)|(?:-+|=+|\.+)>) *(x)? *$/;
  block.sd_fragment_start = /^ *(x) *\[ *(x(?: *, *x)*) *] *$/;
  block.sd_fragment_end = /^ *\/(x) *$/;
  block.sd_guard = /^ *([\[{]) *: *(.+)[\]}]? *$/;
  block.sd_note = /^ *(x)? *\[ *(<?x(?: *, *x)*>?)? *] *(x)? *$/;
  block._x = /[^\[\]\-:=.<> ]+(?:[^\[\]:.<> ]+[^\[\]\-:=.<> ])?/;

  block.sd_message = replace(block.sd_message)
  (/x/g, block._x)
  ();
  block.sd_note = replace(block.sd_note)
  (/x/g, block._x)
  ();
  block.sd_fragment_start = replace(block.sd_fragment_start)
  (/x/g, block._x)
  ();
  block.sd_fragment_end = replace(block.sd_fragment_end)
  (/x/g, block._x)
  ();

  /**
   * Normal Block Grammar
   */

  block.normal = merge({}, block);

  /**
   * GFM Block Grammar
   */

  block.gfm = merge({}, block.normal, {
    fences: /^ *(`{3,}|~{3,})[ \.]*(\S+)? *\n([\s\S]*?)\s*\1 *(?:\n+|$)/,
    paragraph: /^/,
    heading: /^ *(#{1,6}) +([^\n]+?) *#* *(?:\n+|$)/
  });

  block.gfm.paragraph = replace(block.paragraph)
  ('(?!', '(?!'
    + block.gfm.fences.source.replace('\\1', '\\2') + '|'
    + block.list.source.replace('\\1', '\\3') + '|')
  ();

  /**
   * GFM + Tables Block Grammar
   */

  block.tables = merge({}, block.gfm, {
    nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
    table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/
  });

  /**
   * Block Lexer
   */

  function Lexer(options) {
    this.tokens = [];
    this.tokens.links = {};
    this.options = options || marked.defaults;
    this.rules = block.normal;

    if (this.options.gfm) {
      if (this.options.tables) {
        this.rules = block.tables;
      } else {
        this.rules = block.gfm;
      }
    }
  }

  /**
   * Expose Block Rules
   */

  Lexer.rules = block;

  /**
   * Static Lex Method
   */

  Lexer.lex = function(src, options) {
    var lexer = new Lexer(options);
    return lexer.lex(src);
  };

  /**
   * Preprocessing
   */

  Lexer.prototype.lex = function(src) {
    src = src
      .replace(/\r\n|\r/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/\u00a0/g, ' ')
      .replace(/\u2424/g, '\n');

    return this.token(src, true);
  };

  /**
   * Lexing
   */

  Lexer.prototype.token = function(src, top, bq) {
    var next
      , loose
      , cap
      , bull
      , b
      , item
      , space
      , i
      , l;
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

  Lexer.prototype.sequence = function(cap) {
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
            fragments = fragments.slice(0, -split.length);
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
          align: 'center',
          desc: desc
        };
        if (cap[2]) {
          if (/^</.exec(cap[2])) {
            cap[2] = cap[2].replace(/^</, '');
            sig.align = 'left';
          } else if (/>$/.exec(cap[2])) {
            cap[2] = cap[2].replace(/>$/, '');
            sig.align = 'right';
          }
        }
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
      if (alias === void 0) return null;
      if (dict[alias] === void 0) {
        dict[alias] = actors.length;
        actors.push(alias);
      }
      return dict[alias];
    }
  };

  /**
   * Inline-Level Grammar
   */

  var inline = {
    escape: /^\\([\\`*{}\[\]()#+\-.!_>])/,
    autolink: /^<([^ >]+(@|:\/)[^ >]+)>/,
    url: noop,
    tag: /^<!--[\s\S]*?-->|^<\/?\w+(?:"[^"]*"|'[^']*'|[^'">])*?>/,
    link: /^!?\[(inside)\]\(href\)/,
    reflink: /^!?\[(inside)\]\s*\[([^\]]*)\]/,
    nolink: /^!?\[((?:\[[^\]]*\]|[^\[\]])*)\]/,
    strong: /^__([\s\S]+?)__(?!_)|^\*\*([\s\S]+?)\*\*(?!\*)/,
    em: /^\b_((?:[^_]|__)+?)_\b|^\*((?:\*\*|[\s\S])+?)\*(?!\*)/,
    code: /^(`+)\s*([\s\S]*?[^`])\s*\1(?!`)/,
    br: /^ {2,}\n(?!\s*$)/,
    del: noop,
    text: /^[\s\S]+?(?=[\\<!\[_*`]| {2,}\n|$)/
  };

  inline._inside = /(?:\[[^\]]*\]|[^\[\]]|\](?=[^\[]*\]))*/;
  inline._href = /\s*<?([\s\S]*?)>?(?:\s+['"]([\s\S]*?)['"])?\s*/;

  inline.link = replace(inline.link)
  ('inside', inline._inside)
  ('href', inline._href)
  ();

  inline.reflink = replace(inline.reflink)
  ('inside', inline._inside)
  ();

  /**
   * Normal Inline Grammar
   */

  inline.normal = merge({}, inline);

  /**
   * Pedantic Inline Grammar
   */

  inline.pedantic = merge({}, inline.normal, {
    strong: /^__(?=\S)([\s\S]*?\S)__(?!_)|^\*\*(?=\S)([\s\S]*?\S)\*\*(?!\*)/,
    em: /^_(?=\S)([\s\S]*?\S)_(?!_)|^\*(?=\S)([\s\S]*?\S)\*(?!\*)/
  });

  /**
   * GFM Inline Grammar
   */

  inline.gfm = merge({}, inline.normal, {
    escape: replace(inline.escape)('])', '~|])')(),
    url: /^(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/,
    del: /^~~(?=\S)([\s\S]*?\S)~~/,
    text: replace(inline.text)
    (']|', '~]|')
    ('|', '|https?://|')
    ()
  });

  /**
   * GFM + Line Breaks Inline Grammar
   */

  inline.breaks = merge({}, inline.gfm, {
    br: replace(inline.br)('{2,}', '*')(),
    text: replace(inline.gfm.text)('{2,}', '*')()
  });

  /**
   * Inline Lexer & Compiler
   */

  function InlineLexer(links, options) {
    this.options = options || marked.defaults;
    this.links = links;
    this.rules = inline.normal;
    this.renderer = this.options.renderer || new Renderer;
    this.renderer.options = this.options;

    if (!this.links) {
      throw new
        Error('Tokens array requires a `links` property.');
    }

    if (this.options.gfm) {
      if (this.options.breaks) {
        this.rules = inline.breaks;
      } else {
        this.rules = inline.gfm;
      }
    } else if (this.options.pedantic) {
      this.rules = inline.pedantic;
    }
  }

  /**
   * Expose Inline Rules
   */

  InlineLexer.rules = inline;

  /**
   * Static Lexing/Compiling Method
   */

  InlineLexer.output = function(src, links, options) {
    var inline = new InlineLexer(links, options);
    return inline.output(src);
  };

  /**
   * Lexing/Compiling
   */

  InlineLexer.prototype.output = function(src) {
    var out = ''
      , link
      , text
      , href
      , cap;

    while (src) {
      // escape
      if (cap = this.rules.escape.exec(src)) {
        src = src.substring(cap[0].length);
        out += cap[1];
        continue;
      }

      // autolink
      if (cap = this.rules.autolink.exec(src)) {
        src = src.substring(cap[0].length);
        if (cap[2] === '@') {
          text = cap[1].charAt(6) === ':'
            ? this.mangle(cap[1].substring(7))
            : this.mangle(cap[1]);
          href = this.mangle('mailto:') + text;
        } else {
          text = escape(cap[1]);
          href = text;
        }
        out += this.renderer.link(href, null, text);
        continue;
      }

      // url (gfm)
      if (!this.inLink && (cap = this.rules.url.exec(src))) {
        src = src.substring(cap[0].length);
        text = escape(cap[1]);
        href = text;
        out += this.renderer.link(href, null, text);
        continue;
      }

      // tag
      if (cap = this.rules.tag.exec(src)) {
        if (!this.inLink && /^<a /i.test(cap[0])) {
          this.inLink = true;
        } else if (this.inLink && /^<\/a>/i.test(cap[0])) {
          this.inLink = false;
        }
        src = src.substring(cap[0].length);
        out += this.options.sanitize
          ? this.options.sanitizer
          ? this.options.sanitizer(cap[0])
          : escape(cap[0])
          : cap[0]
        continue;
      }

      // link
      if (cap = this.rules.link.exec(src)) {
        src = src.substring(cap[0].length);
        this.inLink = true;
        out += this.outputLink(cap, {
          href: cap[2],
          title: cap[3]
        });
        this.inLink = false;
        continue;
      }

      // reflink, nolink
      if ((cap = this.rules.reflink.exec(src))
        || (cap = this.rules.nolink.exec(src))) {
        src = src.substring(cap[0].length);
        link = (cap[2] || cap[1]).replace(/\s+/g, ' ');
        link = this.links[link.toLowerCase()];
        if (!link || !link.href) {
          out += cap[0].charAt(0);
          src = cap[0].substring(1) + src;
          continue;
        }
        this.inLink = true;
        out += this.outputLink(cap, link);
        this.inLink = false;
        continue;
      }

      // strong
      if (cap = this.rules.strong.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.strong(this.output(cap[2] || cap[1]));
        continue;
      }

      // em
      if (cap = this.rules.em.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.em(this.output(cap[2] || cap[1]));
        continue;
      }

      // code
      if (cap = this.rules.code.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.codespan(escape(cap[2], true));
        continue;
      }

      // br
      if (cap = this.rules.br.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.br();
        continue;
      }

      // del (gfm)
      if (cap = this.rules.del.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.del(this.output(cap[1]));
        continue;
      }

      // text
      if (cap = this.rules.text.exec(src)) {
        src = src.substring(cap[0].length);
        out += this.renderer.text(escape(this.smartypants(cap[0])));
        continue;
      }

      if (src) {
        throw new
          Error('Infinite loop on byte: ' + src.charCodeAt(0));
      }
    }

    return out;
  };

  /**
   * Compile Link
   */

  InlineLexer.prototype.outputLink = function(cap, link) {
    var href = escape(link.href)
      , title = link.title ? escape(link.title) : null;

    return cap[0].charAt(0) !== '!'
      ? this.renderer.link(href, title, this.output(cap[1]))
      : this.renderer.image(href, title, escape(cap[1]));
  };

  /**
   * Smartypants Transformations
   */

  InlineLexer.prototype.smartypants = function(text) {
    if (!this.options.smartypants) return text;
    return text
    // em-dashes
      .replace(/---/g, '\u2014')
      // en-dashes
      .replace(/--/g, '\u2013')
      // opening singles
      .replace(/(^|[-\u2014/(\[{"\s])'/g, '$1\u2018')
      // closing singles & apostrophes
      .replace(/'/g, '\u2019')
      // opening doubles
      .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, '$1\u201c')
      // closing doubles
      .replace(/"/g, '\u201d')
      // ellipses
      .replace(/\.{3}/g, '\u2026');
  };

  /**
   * Mangle Links
   */

  InlineLexer.prototype.mangle = function(text) {
    if (!this.options.mangle) return text;
    var out = ''
      , l = text.length
      , i = 0
      , ch;

    for (; i < l; i++) {
      ch = text.charCodeAt(i);
      if (Math.random() > 0.5) {
        ch = 'x' + ch.toString(16);
      }
      out += '&#' + ch + ';';
    }

    return out;
  };

  /**
   * Renderer
   */

  function Renderer(options) {
    this.options = options || {};
  }

  Renderer.prototype.code = function(code, lang, escaped) {
    if (this.options.highlight) {
      var out = this.options.highlight(code, lang);
      if (out != null && out !== code) {
        escaped = true;
        code = out;
      }
    }

    if (!lang) {
      return '<pre><code>'
        + (escaped ? code : escape(code, true))
        + '\n</code></pre>';
    }

    return '<pre><code class="'
      + this.options.langPrefix
      + escape(lang, true)
      + '">'
      + (escaped ? code : escape(code, true))
      + '\n</code></pre>\n';
  };

  Renderer.prototype.blockquote = function(quote) {
    return '<blockquote>\n' + quote + '</blockquote>\n';
  };

  Renderer.prototype.html = function(html) {
    return html;
  };

  Renderer.prototype.heading = function(text, level, raw) {
    return '<h'
      + level
      + ' id="'
      + this.options.headerPrefix
      + raw.toLowerCase().replace(/[^\w]+/g, '-')
      + '">'
      + text
      + '</h'
      + level
      + '>\n';
  };

  Renderer.prototype.hr = function() {
    return this.options.xhtml ? '<hr/>\n' : '<hr>\n';
  };

  Renderer.prototype.list = function(body, ordered) {
    var type = ordered ? 'ol' : 'ul';
    return '<' + type + '>\n' + body + '</' + type + '>\n';
  };

  Renderer.prototype.listitem = function(text) {
    return '<li>' + text + '</li>\n';
  };

  Renderer.prototype.paragraph = function(text) {
    return '<p>' + text + '</p>\n';
  };

  Renderer.prototype.table = function(header, body) {
    return '<table>\n'
      + '<thead>\n'
      + header
      + '</thead>\n'
      + '<tbody>\n'
      + body
      + '</tbody>\n'
      + '</table>\n';
  };

  Renderer.prototype.tablerow = function(content) {
    return '<tr>\n' + content + '</tr>\n';
  };

  Renderer.prototype.tablecell = function(content, flags) {
    var type = flags.header ? 'th' : 'td';
    var tag = flags.align
      ? '<' + type + ' style="text-align:' + flags.align + '">'
      : '<' + type + '>';
    return tag + content + '</' + type + '>\n';
  };

// span level renderer
  Renderer.prototype.strong = function(text) {
    return '<strong>' + text + '</strong>';
  };

  Renderer.prototype.em = function(text) {
    return '<em>' + text + '</em>';
  };

  Renderer.prototype.codespan = function(text) {
    return '<code>' + text + '</code>';
  };

  Renderer.prototype.br = function() {
    return this.options.xhtml ? '<br/>' : '<br>';
  };

  Renderer.prototype.del = function(text) {
    return '<del>' + text + '</del>';
  };

  Renderer.prototype.link = function(href, title, text) {
    if (this.options.sanitize) {
      try {
        var prot = decodeURIComponent(unescape(href))
          .replace(/[^\w:]/g, '')
          .toLowerCase();
      } catch (e) {
        return '';
      }
      if (prot.indexOf('javascript:') === 0 || prot.indexOf('vbscript:') === 0) {
        return '';
      }
    }
    var out = '<a href="' + href + '"';
    if (title) {
      out += ' title="' + title + '"';
    }
    out += '>' + text + '</a>';
    return out;
  };

  Renderer.prototype.image = function(href, title, text) {
    var out = '<img src="' + href + '" alt="' + text + '"';
    if (title) {
      out += ' title="' + title + '"';
    }
    out += this.options.xhtml ? '/>' : '>';
    return out;
  };

  Renderer.prototype.text = function(text) {
    return text;
  };

  Renderer.prototype.sequence = {
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
        , align = ' align-' + sig.align
        , content = '<div class="note'+align+'">'+body+'</div>';
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

  /**
   * Parsing & Compiling
   */

  function Parser(options) {
    this.tokens = [];
    this.token = null;
    this.options = options || marked.defaults;
    this.options.renderer = this.options.renderer || new Renderer;
    this.renderer = this.options.renderer;
    this.renderer.options = this.options;
  }

  /**
   * Static Parse Method
   */

  Parser.parse = function(src, options, renderer) {
    var parser = new Parser(options, renderer);
    return parser.parse(src);
  };

  /**
   * Parse Loop
   */

  Parser.prototype.parse = function(src) {
    this.inline = new InlineLexer(src.links, this.options, this.renderer);
    this.tokens = src.reverse();

    var out = '';
    while (this.next()) {
      out += this.tok();
    }

    return out;
  };

  /**
   * Next Token
   */

  Parser.prototype.next = function() {
    return this.token = this.tokens.pop();
  };

  /**
   * Preview Next Token
   */

  Parser.prototype.peek = function() {
    return this.tokens[this.tokens.length - 1] || 0;
  };

  /**
   * Parse Text Tokens
   */

  Parser.prototype.parseText = function() {
    var body = this.token.text;

    while (this.peek().type === 'text') {
      body += '\n' + this.next().text;
    }

    return this.inline.output(body);
  };

  /**
   * Parse Current Token
   */

  Parser.prototype.tok = function() {
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
      case 'sequence': {
        return this.sequence(this.token);
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
    }
  };

  Parser.prototype.sequence = function(token) {
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
    html += renderer.padding(lives);
    html += '</tbody></table></div></div>\n';
    return html;
  };

  /**
   * Helpers
   */

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
    var i = 1
      , target
      , key;

    for (; i < arguments.length; i++) {
      target = arguments[i];
      for (key in target) {
        if (Object.prototype.hasOwnProperty.call(target, key)) {
          obj[key] = target[key];
        }
      }
    }

    return obj;
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

  /**
   * Marked
   */

  function marked(src, opt, callback) {
    if (callback || typeof opt === 'function') {
      if (!callback) {
        callback = opt;
        opt = null;
      }

      opt = merge({}, marked.defaults, opt || {});

      var highlight = opt.highlight
        , tokens
        , pending
        , i = 0;

      try {
        tokens = Lexer.lex(src, opt)
      } catch (e) {
        return callback(e);
      }

      pending = tokens.length;

      var done = function(err) {
        if (err) {
          opt.highlight = highlight;
          return callback(err);
        }

        var out;

        try {
          out = Parser.parse(tokens, opt);
        } catch (e) {
          err = e;
        }

        opt.highlight = highlight;

        return err
          ? callback(err)
          : callback(null, out);
      };

      if (!highlight || highlight.length < 3) {
        return done();
      }

      delete opt.highlight;

      if (!pending) return done();

      for (; i < tokens.length; i++) {
        (function(token) {
          if (token.type !== 'code') {
            return --pending || done();
          }
          return highlight(token.text, token.lang, function(err, code) {
            if (err) return done(err);
            if (code == null || code === token.text) {
              return --pending || done();
            }
            token.text = code;
            token.escaped = true;
            --pending || done();
          });
        })(tokens[i]);
      }

      return;
    }
    try {
      if (opt) opt = merge({}, marked.defaults, opt);
      return Parser.parse(Lexer.lex(src, opt), opt);
    } catch (e) {
      e.message += '\nPlease report this to https://github.com/chjj/marked.';
      if ((opt || marked.defaults).silent) {
        return '<p>An error occured:</p><pre>'
          + escape(e.message + '', true)
          + '</pre>';
      }
      throw e;
    }
  }

  /**
   * Options
   */

  marked.options =
    marked.setOptions = function(opt) {
      merge(marked.defaults, opt);
      return marked;
    };

  marked.defaults = {
    gfm: true,
    tables: true,
    breaks: false,
    pedantic: false,
    sanitize: false,
    sanitizer: null,
    mangle: true,
    smartLists: false,
    silent: false,
    highlight: null,
    langPrefix: 'lang-',
    smartypants: false,
    headerPrefix: '',
    renderer: new Renderer,
    xhtml: false
  };

  /**
   * Expose
   */

  marked.Parser = Parser;
  marked.parser = Parser.parse;

  marked.Renderer = Renderer;

  marked.Lexer = Lexer;
  marked.lexer = Lexer.lex;

  marked.InlineLexer = InlineLexer;
  marked.inlineLexer = InlineLexer.output;

  marked.parse = marked;

  if (typeof module !== 'undefined' && typeof exports === 'object') {
    module.exports = marked;
  } else if (typeof define === 'function' && define.amd) {
    define(function() { return marked; });
  } else {
    this.marked = marked;
  }

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());
