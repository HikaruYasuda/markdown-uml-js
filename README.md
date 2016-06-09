# Markdownでシーケンス図 Demo

## シーケンス図記法

#### 開始

先頭に`SD (任意タイトル)__/`を付ければ以降シーケンス図のコマンドになります。（空改行で終了）  
`SD`でも`sd`でもどちらでも構いません。末尾の`__/`もアンダースコアが2個以上連続してスラッシュが付いていればOKです。
sdは Sequence Diagram の略で一般的なシーケンスUMLの頭についているものです。

SD (任意タイトル)__/

#### メッセージとメモ

`---`が同期、`...`が応答、`===`が非同期です。（`=`が非同期なのは平行線だからと覚えてください）

```
sd__/
のび太 -> ドラえもん : 道具要求(同期)
のび太 <. ドラえもん : ひみつ道具(応答)
のび太 => ジャイアン : 奪われる(非同期)
[]ジャイアン : お前のものは  
おれのもの
[ジャイアン,スネ夫] : いたずら
```

sd__/
のび太 -> ドラえもん : 道具要求(同期)
のび太 <. ドラえもん : ひみつ道具(応答)
のび太 => ジャイアン : 奪われる(非同期)
[]ジャイアン : お前のものは  
おれのもの
[ジャイアン,スネ夫] : いたずら


#### アクター（オブジェクト）にエイリアス名をつける

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

#### サンプル

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


