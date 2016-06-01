(function(undefined) {
    function extend(base, parent, extend) {
        if (Object['setPrototypeOf']) {
            Object['setPrototypeOf'](base.prototype, parent.prototype);
        } else {
            base.prototype.__proto__ = parent.prototype;
        }
        for (var keys = Object.keys(extend||{}), i = 0, ii = keys.length; i < ii; i++) {
            base.prototype[keys[i]] = extend[keys[i]];
        }
    }
    
    function Lexer() {
        this.tokens = [];
        this.tokens.links = {};
    }
    Lexer.prototype = {
        rules: {
            nl: /^\n+/,
            code: /^( {4}[^\n]+\n*)+/,
            hr: /^( *[-*_]){3,} *(?:\n+|$)/,
            heading: /^ *(#{1,6}) *([^\n]+?) *#* *(?:\n+|$)/,
            lheading: /^([^\n]+)\n *(=|-){2,} *(?:\n+|$)/,
            blockquote: /^( *>[^\n]+(\n(?!def)[^\n]+)*\n*)+/,
            list: /^( *)(bull) [\s\S]+?(?:hr|def|\n{2,}(?! )(?!\1bull )\n*|\s*$)/,
            html: /^ *(?:comment *(?:\n|\s*$)|closed *(?:\n{2,}|\s*$)|closing *(?:\n{2,}|\s*$))/,
            def: /^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +["(]([^\n]+)[")])? *(?:\n+|$)/,
            paragraph: /^((?:[^\n]+\n?(?!hr|heading|lheading|blockquote|tag|def))+)\n*/,
            text: /^[^\n]+/
        },
        lex: function(src) {
            return this.token(src
                .replace(/\r\n|\r|\u2424/g, '\n')
                .replace(/\t/g, '    ')
                .replace(/\u00a0/g, ' ')
                .replace(/^ +$/gm, '')
            , true);
        },
        token: function(src, top, bq) {
            var next
                , loose
                , cap
                , bull
                , b
                , item
                , space
                , i
                , l;
            while (src) {
                // newline
                if (cap = this.rules.nl.exec(src)) {
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
                        text: cap
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
        }
    };
    
    function trim(v) {
        return v.replace(/^\s+|\s+$/g,'');
    }
    function isString(v) {
        return typeof v == 'string';
    }

    function Part() {
        this.text = null;
    }
    Part.prototype = {
        toString: function() {
            return this.text;
        },
        put: function(text) {
            if (!isString(text)) return;
            if (isString(this.text)) this.text += '\n';
            this.text = text;
        }
    };
    function Actor(name) {
        Part.call(this);
        this.name  = '';
        this.alias = '';
        name && this.put(name);
    }
    extend(Actor, Part, {
        put: function(name) {
            var m = /([\s\S]+) as ([\s\S]+)/.exec(name);
            if (m) {
                this.name = trim(m[1]);
                this.alias = trim(m[2]);
            } else {
                this.name = name;
                this.alias = name;
            }
        }
    });
    function Signal(actorA, signaltype, actorB, message) {
        this.type       = "Signal";
        this.actorA     = actorA;
        this.actorB     = actorB;
        this.linetype   = signaltype & 3;
        this.arrowtype  = (signaltype >> 2) & 3;
        this.message    = message;
    }
    extend(Signal, Part);
    function Note(actors, message) {
        Part.call(this);
        this.actors = actors;
        this.placement = actors.length ? 'right' : 'wrap';
        this.message = message;
        this.closed = false;
    }
    extend(Note, Part, {
        addActor: function(actor) {
            if (this.closed) {

                return;
            }
            this.actors.push(actor);
        }
    });
    function Block() {

    }
    extend(Block, Part);
    /**
     * @param {string} [input]
     * @returns {Diagram}
     * @constructor
     */
    function Diagram(input) {
        if (!(this instanceof Diagram)) return (new Diagram).parse(input);
        this.clear();
        input && this.parse(input);
    }
    Diagram.prototype = {
        clear: function() {
            this.actors  = [];
            this.messages = [];
            this.notes = [];
            this.fragments = [];
        },
        /**
         * @param {Actor|string} actor
         * @returns {Actor|void}
         */
        actor: function(actor) {
            var len = this.actors.length,
                alias = actor.alias || actor;
            for (var i = 0; i < len; i++) {
                if (this.actors[i].alias == alias) break;
            }
            if (!actor.alias) return this.actors[i];
            this.actors[i] = actor;
        },
        /**
         * @param {string} input
         * @returns {Diagram}
         */
        parse: function(input) {
            input.split(/\r\n|\r|\n/).forEach(function(line) {
                this.puts(line);
            }.bind(this));
            return this;
        },
        puts: function(line) {
            var m;
            if (m = /\s*> ([\s\S]+)/.exec(line)) {
                var actor = new Actor;
                this.actor(new Actor(m[1]));
                return;
            }
            this.messages.push(line);
            return;
            m = /(.+): (.+)/.exec(line) || [line, line, ''];
            var cmd = trim(m[1]), text = trim(m[2]);
            console.debug(cmd, '--', text);

            var t = '', note, signal, notePos, actors = [];

            for (var i = 0, ii = e.length; i < ii; i++) {
                switch (cmd.charAt(i)) {
                    case '[':
                        note = new Note(actors);
                        break;
                }
            }
        },
        /**
         * @returns {string}
         */
        drawHTML: function() {
            var html = '';
            this.actors.forEach(function(actor) {
                html += '<div class="actor">'+actor.name+'</div>';
            });
            html += this.messages.join('<br>');
            return html;
        }
    };
    window.Diagram = Diagram;
    
    (function() {
        var renderer = new marked.Renderer();
        renderer.listitem = function(text) {
            if (/^\s*\[[x ]]\s*/.test(text)) {
                text = text
                    .replace(/^\s*\[ ]\s*/, '<i class="empty checkbox icon"></i> ')
                    .replace(/^\s*\[x]\s*/, '<i class="checked checkbox icon"></i> ');
                return '<li style="list-style: none">' + text + '</li>';
            } else {
                return '<li>' + text + '</li>';
            }
        };
        marked.setOptions({
            renderer: renderer,
            highlight: function(code, lang) {
                if (lang == 'sequence') {
                    try {
                        $('#console').html(Diagram(code).drawHTML());
                    } catch (e) {
                        $('#console').text(e.toString()+'\n'+JSON.stringify(e.stack));
                    }
                }
                return hljs.highlightAuto(code).value;
            }
        });
        window.markdown = function(src, opt, callback) {
            return marked.apply(marked, [].slice.call(arguments));
        };
    }());
}());