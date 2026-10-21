# 容器照合Webアプリ（モデルURL自動読み込み版）

## 変更点
- Teachable MachineのモデルURLを設定済み
- ページを開くと自動でモデルを読み込むため、毎回URLを貼り付ける必要はありません

設定済みURL: https://teachablemachine.withgoogle.com/models/GWbRVGZwk/

## GitHub Pagesへの反映
1. GitHubリポジトリを開きます。
2. ZIP内の `index.html`、`app.js`、`style.css` で既存ファイルを置き換えます。
3. 変更をCommitします。
4. GitHub Pagesを再読み込みし、「モデル読み込み完了」と表示されるか確認します。

## 注意
モデルの公開URLが有効で、クラス名が「血ガス容器」「PN2」「尿コップ」と一致している必要があります。
初回読み込みにはインターネット接続が必要です。
この試作版のAI結果だけで容器・検体の適合性を確定せず、施設の手順に従って目視確認してください。
