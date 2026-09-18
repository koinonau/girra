<h1 align="center">
  <a href="https://onOrca.dev"><img src="../../resources/build/icon.png" alt="Girra" width="64" valign="middle" /></a> Girra
</h1>

<p align="center">
  <a href="https://github.com/stablyai/orca"><img src="https://img.shields.io/github/stars/stablyai/orca?style=flat&amp;label=%E2%98%85&amp;color=08C" alt="GitHub スター数" /></a>
  <a href="https://github.com/koinonau/girra/releases"><img src="../assets/readme-downloads.svg" alt="全リリースの合計ダウンロード数" /></a>
  <img src="https://img.shields.io/badge/license-MIT-08C?style=flat" alt="ライセンス: MIT" />
  <a href="https://discord.gg/fzjDKHxv8Q"><img src="https://img.shields.io/badge/Discord-5865F2?logo=discord&logoColor=white" alt="Orca の Discord に参加" /></a>
  <a href="https://x.com/orca_build"><img src="https://img.shields.io/badge/X-000000?logo=x&logoColor=white" alt="X で Orca をフォロー" /></a>
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-4493F8?style=flat-square" alt="対応プラットフォーム: macOS、Windows、Linux" />
</p>

<p align="center">
  <sub><a href="../../README.md">English</a> · <a href="README.zh-CN.md">中文</a> · <a href="README.ko.md">한국어</a> · <a href="README.es.md">Español</a> · <a href="README.fr.md">Français</a> · <a href="README.pt.md">Português</a></sub>
</p>

<p align="center">
  <strong>100x ビルダーのための AI オーケストレーター。</strong><br/>
  Claude Code、OpenCode、Pi を並べて実行 — それぞれを専用のワークツリーで動かし、1 か所で追跡できます。
</p>

<h3 align="center"><a href="https://onorca.dev/download"><ins>Girra をダウンロード</ins></a></h3>

<p align="center">
  <img src="../assets/readme-hero.jpg" alt="並列ワークツリーでエージェントを実行する Girra デスクトップアプリと、隅に表示された Girra モバイル companion アプリ" width="960" />
</p>

## 機能

<table>
<tr>
<td width="50%" valign="middle">

### 並列ワークツリー

1 つのプロンプトを 5 つのエージェントに展開し、それぞれを独立した git ワークツリーで実行 — 結果を比較して、最良のものをマージできます。

[ドキュメント →](https://www.onorca.dev/docs/model/worktrees)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/model/worktrees"><picture><source srcset="../assets/feature-wall/parallel-worktrees.gif" type="image/gif"><img src="../assets/feature-wall/parallel-worktrees.jpg" alt="並列ワークツリーのオーケストレーション" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### ターミナル分割

WebGL レンダリング、無制限の分割、再起動後も残るスクロールバックを備えた Ghostty クラスのターミナル。

[ドキュメント →](https://www.onorca.dev/docs/terminal)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/terminal"><picture><source srcset="../assets/feature-wall/terminal-splits.gif" type="image/gif"><img src="../assets/feature-wall/terminal-splits.jpg" alt="ターミナル分割" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### デザインモード

実際の Chromium ウィンドウで任意の UI 要素をクリックすると、その HTML、CSS、切り抜いたスクリーンショットがそのままエージェントのプロンプトに送られます。

[ドキュメント →](https://www.onorca.dev/docs/browser/design-mode)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/browser/design-mode"><picture><source srcset="../assets/feature-wall/design-mode.gif" type="image/gif"><img src="../assets/feature-wall/design-mode.jpg" alt="組み込みブラウザとデザインモード" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### GitHub &amp; Linear をネイティブに

PR、Issue、プロジェクトボードをアプリ内で閲覧 — 任意のタスクからワークツリーを開き、コンテキストスイッチなしでレビューできます。

[ドキュメント →](https://www.onorca.dev/docs/review/linear)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/review/linear"><picture><source srcset="../assets/feature-wall/github-linear.gif" type="image/gif"><img src="../assets/feature-wall/github-linear.jpg" alt="Girra の GitHub と Linear タスクワークフロー" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### SSH ワークツリー

強力なリモートマシン上でエージェントを実行 — ファイル編集、git、ターミナルをフルに使え、自動再接続とポートフォワーディングも付属します。

[ドキュメント →](https://www.onorca.dev/docs/ssh)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/ssh"><picture><source srcset="../assets/feature-wall/ssh-worktrees.gif" type="image/gif"><img src="../assets/feature-wall/ssh-worktrees.jpg" alt="SSH 経由のリモートワークツリー" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### AI Diff に注釈

任意の Diff 行にコメントを付けてエージェントへ送り返せます — Girra から離れずにレビュー、編集、コミットまで完結します。

[ドキュメント →](https://www.onorca.dev/docs/review/annotate-ai-diff)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/review/annotate-ai-diff"><picture><source srcset="../assets/feature-wall/annotate-diff.gif" type="image/gif"><img src="../assets/feature-wall/annotate-diff.jpg" alt="AI が生成した Diff への注釈" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### ファイルをエージェントへドラッグ

オートセーブが全面的に効く VS Code のエディタ — ファイルや画像をそのままエージェントのプロンプトへドラッグできます。

[ドキュメント →](https://www.onorca.dev/docs/editing/file-explorer)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/editing/file-explorer"><picture><source srcset="../assets/feature-wall/file-drag.gif" type="image/gif"><img src="../assets/feature-wall/file-drag.jpg" alt="ファイルや画像をエージェントのプロンプトへドラッグ" width="100%" /></picture></a>
</td>
</tr>
<tr>
<td width="50%" valign="middle">

### Girra CLI

エージェント自身も Girra を操作できます — `girra worktree create`、`snapshot`、`click`、`fill` であらゆるワークフローをスクリプト化できます。

[ドキュメント →](https://www.onorca.dev/docs/cli/overview)

</td>
<td width="50%">
  <a href="https://www.onorca.dev/docs/cli/overview"><picture><source srcset="../assets/feature-wall/orca-cli.gif" type="image/gif"><img src="../assets/feature-wall/orca-cli.jpg" alt="CLI から Girra をスクリプト操作" width="100%" /></picture></a>
</td>
</tr>
</table>

**さらに同梱:**

- **[クイックオープン](https://www.onorca.dev/docs/model/quick-open)** — フローを離れずに、ワークツリー、ファイル、エージェント、コマンド、リポジトリコンテキストを横断検索できます。
- **[アカウント切り替えと使用量トラッキング](https://www.onorca.dev/docs/agents/usage-tracking)** — Claude の使用量やレート制限のリセットを確認し、再ログインなしでアカウントを切り替えられます。
- **[リッチなリポジトリプレビュー](https://www.onorca.dev/docs/editing/markdown)** — Markdown、画像、PDF、リポジトリ文書をワークスペース内でプレビューできます。
- **[Computer Use](https://www.onorca.dev/docs/cli/computer-use)** — 実際の操作が必要なワークフローでは、エージェントにデスクトップアプリや画面上の UI を操作させられます。
- **[通知と未読ステータス](https://www.onorca.dev/docs/notifications)** — エージェントの完了や要対応をすぐに把握し、スレッドを未読に戻して後で確認できます。
- **その他、まだまだたくさん** — 毎日リリースしているので、このリストは常に追いついていません。本当の機能一覧は[チェンジログ](https://github.com/koinonau/girra/releases)です。

---

## 対応するエージェント

**あらゆる CLI エージェント**で動作します — ターミナルで動くものなら、Girra でも動きます。

<p>
  <a href="https://docs.anthropic.com/claude/docs/claude-code"><kbd><img src="../assets/claude-logo.svg" alt="Claude Code logo" width="16" valign="middle" /> Claude Code</kbd></a> &nbsp;
  <a href="https://opencode.ai/docs/cli/"><kbd><img src="https://www.google.com/s2/favicons?domain=opencode.ai&sz=64" alt="OpenCode logo" width="16" valign="middle" /> OpenCode</kbd></a> &nbsp;
  <a href="https://pi.dev"><kbd><img src="https://pi.dev/favicon.svg" alt="Pi logo" width="16" valign="middle" /> Pi</kbd></a> &nbsp;
  <kbd>+ any CLI agent</kbd>
</p>

---

## インストール

### デスクトップ — macOS, Windows, Linux

- **[onOrca.dev からダウンロード](https://onorca.dev/download)**
- またはビルドを直接入手: [macOS Apple Silicon](https://github.com/koinonau/girra/releases/latest/download/girra-macos-arm64.dmg) · [macOS Intel](https://github.com/koinonau/girra/releases/latest/download/girra-macos-x64.dmg) · [Windows (.exe)](https://github.com/koinonau/girra/releases/latest/download/girra-windows-setup.exe) · [Linux AppImage](https://github.com/koinonau/girra/releases/latest/download/girra-linux.AppImage) · [すべてのビルド](https://github.com/koinonau/girra/releases/latest)


---

## コミュニティとサポート

- **Discord:** **[Discord](https://discord.gg/fzjDKHxv8Q)** のコミュニティに参加してください。
- **Twitter / X:** アップデートやお知らせは **[@orca_build](https://x.com/orca_build)** をフォローしてください。
- **フィードバックとアイデア:** 私たちは高速にリリースしています。足りない機能がありますか？[機能リクエストを送信](https://github.com/stablyai/orca/issues)してください。
- **応援する:** 毎日のリリースを追うために、このリポジトリに[スター](https://github.com/stablyai/orca)を付けてください。

---

## 開発について

貢献したい、またはローカルで実行したいですか？ [CONTRIBUTING.md](../../.github/CONTRIBUTING.md) ガイドをご覧ください。

<a href="https://github.com/stablyai/orca/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=stablyai/orca" alt="Orca のコントリビューター" />
</a>

## ライセンス

Girra は [MIT License](../../LICENSE) の下で無料かつオープンソースです。
