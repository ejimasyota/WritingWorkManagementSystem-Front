# Nuxt Minimal Starter

Look at the [Nuxt documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## 既存画面から移植したページ

- `/`（別名 `/login`、`/index.html`）：ログイン。ロック残時間、参加URLトークン、再ログイン時の復帰に対応。
- `/registration`（別名 `/Front/Html/Registration.html`）：会員登録。利用規約への同意後に登録可能。
- `/main`（別名 `/Front/Html/Main.html`）：セッション取得後に作品一覧を表示。旧メニューの会員・管理者・通知・作品一覧・元号・テンプレート管理を含む。
- `/test`：共通コンポーネントの確認用画面。

利用規約は旧 `Config/Messages.json` を `public/config/Messages.json` にそのまま収録しています。UIは既存の `main.css` とFont Awesomeのクラスを使用します。

### 既存PHP APIへの接続

バックエンドのPHPソース・JSON形式・区分値は変更していません。既定の公開パスは旧 `Common.js` と同じ `/Back/Api` です。配置先が異なる場合は以下の環境変数で変更できます。

```dotenv
NUXT_PUBLIC_API_BASE=/Back/Api
NUXT_PUBLIC_LEGACY_WORK_PATH=/Front/Html/WorkManagement.html
```

ログイン、登録、メイン画面からの通信はブラウザから既存PHPへ直接送ります。PHPセッションCookieと `Csrf.php` のOrigin検証を利用するため、NuxtとPHP APIは同じスキーム・ホスト・ポートで公開してください。開発時にNuxtを3000番ポートで起動する場合も、Webサーバーで `/Back/Api` をPHPへ、画面をNuxtへ振り分ける構成が必要です。Nuxt単体ではPHPを実行しません。

作品の「移動」は `SetCurrentWork.php` が成功した後、既存の作品詳細画面へ遷移します。作品詳細画面自体は今回の移植対象に含めていません。実際に公開している作品詳細画面のパスを `NUXT_PUBLIC_LEGACY_WORK_PATH` に設定してください。

### メイン画面の処理

一覧のソート・絞り込み・ページ切替は共通TableComponentを使用します。作成、削除／退出、参加URL発行、資料出力、CSVバックアップ・復元を既存APIへ接続しています。更新・削除時には取得時の `UpdateDate` を送信し、既存の排他制御を維持します。

管理者メニューは `GetSessionInfo.php` の `IsAdmin` に基づいて表示・選択を制御し、API側でも既存の権限チェックが実行されます。通知、表示設定、パスワード変更、操作があった場合の60秒間隔のセッション再確認も実装しています。


### Apacheを経由した開発時の起動

`deploy/apache/newworkmanagement.conf` は、`/Back/Api/` を既存PHP APIへ、その他をNuxtの3000番ポートへ振り分ける設定例です。ServerNameを実際のIPに合わせて配置し、`proxy` と `proxy_http` を有効にしてください。詳細はドキュメントリポジトリの `02_環境構築/開発環境構築手順書.md` の51～53項を参照してください。

```bash
npm run dev -- --host 127.0.0.1 --port 3000
```

ブラウザはApacheの80番ポートを開きます。Nuxtの3000番ポートを直接開くと、ApacheのAliasによるAPIへの振り分けは行われません。未ログインで `/Back/Api/GetSessionInfo.php` にアクセスした際、HTTP 401とJSONが返れば振り分けは正常です。

説明アイコンのpropsは `infoIconFlg`（テンプレートでは `info-icon-flg`）に統一しています。単独で指定するとtrue、省略するとfalseになり、trueの場合に説明アイコンを表示します。


Apache経由でHTMLだけが表示されてイベントが動かない場合は、開発者ツールのNetworkで
`/_nuxt/@id/virtual:nuxt:...%2F...` が404になっていないか確認してください。
設定例の `AllowEncodedSlashes NoDecode` と、`/_nuxt/` に対する `ProxyPass ... nocanon` が必要です。
設定変更後はApacheをreloadし、ブラウザでハードリロードしてください。


### 本番は静的ファイルを配信

本番は `npm run generate` で生成した `.output/public` をApacheで直接配信します。
フロント配信用のNode.jsサーバーは常駐不要です。既存PHP APIは同じオリジンの `/Back/Api/` で実行します。

本番用設定例は `deploy/apache/newworkmanagement.production.conf`、手順はドキュメントリポジトリの
`02_環境構築/本番環境静的配信手順書.md` に記載しています。開発用のApache設定は引き続き
`deploy/apache/newworkmanagement.conf` を使用します。

静的配信の `NUXT_PUBLIC_API_BASE` 等は生成時の値です。変更後は再生成・再配置してください。


### 認証後の権限制御・セッション管理

`useAuthSession()` で認証状態を共用し、PHPの `GetSessionInfo.php` を基準に画面遷移とAPI送信を制御します。
`/main` は認証必須、`/test` は管理者専用です。ログイン済みユーザーがログイン・登録画面を開くとメインへ戻ります。

401は状態を破棄して一度だけ通知し、通常の403はログアウトと区別します。別タブのログアウト・ブラウザ復帰にも対応し、
ログアウト前の遅い応答で状態が復元しないようにしています。無操作中は定期確認を止め、PHPの無操作期限を自動延長しません。
ログアウトAPIが失敗した場合は、ログアウト完了として扱いません。

静的配信でも利用できます。認証APIはブラウザで実行し、ユーザー情報を生成HTMLへ埋め込みません。
実際のデータの認可は引き続き既存PHP APIが担当します。`IsAdmin` は同APIの返却値に準拠し、バックエンドの権限再照合仕様は変更していません。
詳細と確認手順はドキュメントリポジトリの `02_環境構築/認証・セッション動作確認手順書.md` を参照してください。
