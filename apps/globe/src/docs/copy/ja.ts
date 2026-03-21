import type { DocsCopy } from '../content';

const ja: DocsCopy = {
  meta: {
    title: 'Namazue ドキュメント',
    description: 'Namazue 地震インテリジェンスコンソールの製品ドキュメント。',
  },
  hero: {
    kicker: '製品ドキュメント',
    title: '使う前に、まずコンソールの読み方を理解する。',
    summary:
      'Namazue は地震活動を、地図文脈、露出資産、判断に必要なパネルを通して読める運用状況へ整理します。',
  },
  sections: {
    'what-this-product-does': {
      title: 'この製品が行うこと',
      body:
        '地震活動を読み取り、運用上の状況像へ整理し、地図とパネルの解釈を同じ文脈に保ったまま理解しやすくします。',
    },
    'core-workflow': {
      title: '基本フロー',
      body:
        'イベントまたはシナリオが有効になると、コンソールは想定される影響を読み替え、ユーザーはメイン画面を離れずにリプレイ、地点、資産の文脈を掘り下げられます。',
    },
    capabilities: {
      title: '主要機能',
      body:
        '機能はメニュー名ではなく、ユーザーが何を理解したいかという目的単位で整理します。',
    },
    'console-anatomy': {
      title: 'コンソールの構成',
      body:
        '各パネルに役割をひとつだけ持たせ、地図、確認項目、説明が同じ運用フレームに収まることで、メイン画面の読みやすさを維持します。',
    },
    'how-to-use-it': {
      title: '使い方',
      body:
        '現在のイベント姿勢を確認し、露出資産を見て、直近の確認事項を読み、そのうえで必要に応じてリプレイやシナリオシフトで比較します。',
    },
    'trust-boundaries': {
      title: '信頼境界',
      body:
        'Namazue は意思決定支援のための画面です。運用上の解釈を示しますが、現地確認や公的警報の代替として扱うべきではありません。',
    },
    'go-deeper': {
      title: 'さらに深く見る',
      body:
        '稼働中の読み取りにはライブコンソール、内部レビューにはラボ画面、実装や根拠の確認には技術ドキュメントを使います。',
    },
  },
  capabilities: {
    'see-the-event': {
      title: 'イベントを読む',
      summary: '生のフィード項目ではなく、運用上の状況として現在のイベントを把握します。',
      whyItMatters: 'まず現在のイベント状態とその周辺文脈が見えなければ、何に注意すべきか判断できません。',
      nextAction: '現在のイベント姿勢を開き、地図上の一次的な文脈を確認します。',
    },
    'read-operational-impact': {
      title: '運用影響を読む',
      summary: '現在のイベント下で、資産と確認項目がどう並び替わるかを把握します。',
      whyItMatters: '運用価値はマグニチュードそのものではなく、結果としての優先順位づけにあります。',
      nextAction: '露出資産と現在のアクションスタックを並べて読みます。',
    },
    'explore-replay-and-scenario-shift': {
      title: 'リプレイとシナリオシフトを比較する',
      summary: '時間の経過や仮定の変化によって、コンソールがどう変わるかを見比べます。',
      whyItMatters: '比較が必要な場面では、リプレイとシナリオシフトが推論の筋道を見える形にします。',
      nextAction: 'リプレイレールまたはシナリオ操作で、結果の動きを比較します。',
    },
    'inspect-place-and-asset-context': {
      title: '地点と資産の文脈を見る',
      summary: '全体の事象像を保ったまま、特定地点や資産の文脈へ入ります。',
      whyItMatters: '多くの場合、ユーザーは全体像を失わずに特定地点や資産の問いへ答える必要があります。',
      nextAction: '地点または資産を選び、つながるローカル文脈を読みます。',
    },
    'understand-why-the-console-says-this': {
      title: 'なぜそう表示するのかを理解する',
      summary: '対話UIにせず、短い説明でコンソールの判断理由を読みます。',
      whyItMatters: '平易な運用言語で理由が示されると、画面への信頼が上がります。',
      nextAction: '現在の姿勢に添えられた説明と関連文脈を確認します。',
    },
  },
  anatomy: {
    'event-snapshot': {
      title: 'Event Snapshot',
      body: '何が変わったのかを運用の言葉で最初に示し、すぐに状況把握できるようにします。',
    },
    'asset-exposure': {
      title: 'Asset Exposure',
      body: '影響を受ける資産を結果の大きさ順に並べ、優先度を推測させないようにします。',
    },
    'check-these-now': {
      title: 'Check These Now',
      body: '現在の状態を、最初に読むべき短い確認項目へ変換します。',
    },
    'replay-rail': {
      title: 'Replay Rail',
      body: '時間の流れに沿ってコンソール状態がどう変わるかを示し、連続性を読みやすく保ちます。',
    },
  },
};

export default ja;
