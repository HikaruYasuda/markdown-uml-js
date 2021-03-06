# そうだ、MarkdownでUMLを書こう

## Concept

- マークダウン自体でも見やすく記述したい
- プレビューを画像ファイルやCanvasなどの固定ではなくリキッドなHTMLで出力したい

## Hosting

```bash
$ git clone https://github.com/HikaruYasuda/markdown-uml-js.git
$ npm i
$ npm run serve -- --port 8000
```

## Demo

https://hikaruyasuda.github.io/markdown-uml-js/

[README.md をDemoサイトで開く](https://hikaruyasuda.github.io/markdown-uml-js/?url=https://raw.githubusercontent.com/HikaruYasuda/markdown-uml-js/master/README.md)

### 起動オプション

To specify startup options with GET queries.

key          |hint
-------------|----
`url=<url>`  |Open the contents of the specified URL. 指定したURLのファイルを読み込みます
`vh=<0 or 1>`|0 for horizontal, 1 for vertical. エディタとプレビューを`0`の場合横並びに、`1`の場合縦並びに配置します
`editor`     |Show editor only. プレビューを隠してエディタだけを表示します
`preview`    |Show preview only. エディタを隠してプレビューだけを表示します

## シーケンス図記法

### ヘッダ

`SD (任意タイトル)__/`で開始します。（空改行で終了）  

SD (任意タイトル)__/

### メッセージとメモ

メッセージは`---`(同期)、`...`(応答)、または`===`(非同期)に`<`か`>`をつけて方向を指示します。

メモは`[]`を配置したいオブジェクトに添えます。

```
sd__/
のび太 -> ドラえもん : 道具要求
のび太 <. ドラえもん : ひみつ道具
のび太 => ジャイアン : 奪われる
[]ジャイアン : お前のものは  
おれのもの
[ジャイアン,スネ夫] : いたずら
```

sd__/
のび太 -> ドラえもん : 道具要求
のび太 <. ドラえもん : ひみつ道具
のび太 => ジャイアン : 奪われる
[]ジャイアン : お前のものは  
おれのもの
[ジャイアン,スネ夫] : いたずら

### アクターにエイリアス名をつける

`<alias> = <display name>`をヘッダの次に記述します。
複数ある場合はパイプ`|`で連結します。
エイリアス名を付けない場合でも、ソーステキストの一覧性を考慮して先頭に列挙した方がよいでしょう。

```
sd__/
甲=のび太 | 乙=ジャイアン | 丙=ドラえもん
甲<-乙     : 野球来い
甲----->丙 : なんか道具だして
甲<.....丙 : しょうがないな
```

sd__/
甲=のび太 | 乙=ジャイアン | 丙=ドラえもん
甲<-乙     : 野球来い
甲----->丙 : なんか道具だして
甲<.....丙 : しょうがないな

### 複合フラグメント

sd__/


### サンプル

SD 決済処理 __/
u=ユーザ | s= アプリケーションサーバ | a =アプリケーション | d=データベース
  u->s         : 決済情報登録画面取得(Cookie)
     s->a      : 決済情報登録画面取得(Cookie)
    [s,    d]  : 共通ログインチェック
        a->d   : 登録可能プラン検索
          [d]  : 登録可能プラン検索
        a<.d   :
opt [s,    d]  : エラー
[              : 入力フォーマットエラー OR 入力プランが登録可能プランリストにない
     s<.a      : エラー画面出力
[              : もう一個
/opt
      []a      : キャンペーン期間中プランは
キャンペーン用の表示をする
     s<.a      : プラン一覧と入力フォームを出力
  u<.s         :
  u->          : self-call
  u->s         : 決済情報登録(Cookie,プランID,個人情報,カード情報)
     s->a      : 決済情報登録(Cookie,プランID,個人情報,カード情報)
    [s,    d]  : 共通ログインチェック
        a->d   : 登録可能プラン検索
        a->    : self-call
          [d]  : 登録可能プラン検索
opt [s, a]     : エラー
[              : 入力フォーマットエラー OR 入力プランが登録可能プランリストにない
     s<.a      : エラー画面出力
/opt:
        a->d   : ユーザ情報更新(ユーザID,個人情報)
        a<.d   :


## License

MIT license
