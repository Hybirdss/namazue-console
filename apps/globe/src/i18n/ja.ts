/**
 * Namazue — Japanese locale strings
 */

const ja: Record<string, string> = {
	// Sidebar
	"sidebar.title": "\u5730\u9707\u30e2\u30cb\u30bf\u30fc",
	"sidebar.totalQuakes": "\u5730\u9707\u7dcf\u6570",
	"sidebar.maxMag": "\u6700\u5927M",
	"sidebar.avgMag": "\u5e73\u5747M",
	"sidebar.latest": "\u6700\u65b0",
	"sidebar.magDistribution":
		"\u30de\u30b0\u30cb\u30c1\u30e5\u30fc\u30c9\u5206\u5e03",

	// Detail panel / Tooltip shared labels
	"detail.time": "\u6642\u523b",
	"detail.location": "\u4f4d\u7f6e",
	"detail.depth": "\u6df1\u3055",
	"detail.faultType": "\u65ad\u5c64\u30bf\u30a4\u30d7",
	"detail.jmaIntensity": "JMA\u9707\u5ea6",
	"detail.tsunami": "\u6d25\u6ce2",

	// Timeline
	"timeline.play": "\u518d\u751f",
	"timeline.pause": "\u4e00\u6642\u505c\u6b62",
	"timeline.prev": "\u524d\u3078",
	"timeline.next": "\u6b21\u3078",
	"timeline.scrub":
		"\u30bf\u30a4\u30e0\u30e9\u30a4\u30f3\u30b9\u30af\u30e9\u30d0\u30fc",

	// Intensity legend
	"legend.title": "JMA\u9707\u5ea6",
	"legend.violent": "\u6fc0\u70c8",
	"legend.severe": "\u731b\u70c8",
	"legend.strongPlus": "\u975e\u5e38\u306b\u5f37\u3044",
	"legend.veryStrong": "強震",
	"legend.ratherStrong": "やや強い",
	"legend.strong": "中程度",
	"legend.moderate": "\u4e2d",
	"legend.weak": "\u5f31\u3044",
	"legend.slight": "\u8efd\u5fae",
	"legend.notFelt": "\u7121\u611f",

	// Asset legend
	"legend.asset.nuclear": "\u539f\u5b50\u529b",
	"legend.asset.airport": "\u7a7a\u6e2f",
	"legend.asset.port": "\u6e2f\u6e7e",
	"legend.asset.hospital": "\u75c5\u9662",
	"legend.asset.rail": "\u9244\u9053",
	"legend.asset.power": "\u96fb\u529b",
	"legend.asset.water": "\u4e0a\u6c34\u9053",
	"legend.asset.dam": "\u30c0\u30e0",
	"legend.asset.lng": "LNG",
	"legend.asset.eoc": "\u9632\u707d\u62e0\u70b9",
	"legend.asset.telecom": "\u901a\u4fe1",
	"legend.asset.evacuation": "\u907f\u96e3\u6240",
	"legend.asset.building": "\u5efa\u7269\u7fa4",

	// Scenario picker
	"scenario.title": "訓練シナリオ",

	// HUD overlay
	"hud.cam": "\u30ab\u30e1\u30e9",
	"hud.time": "\u6642\u9593",
	"hud.zoom": "\u30ba\u30fc\u30e0",

	// Mode switcher
	"mode.realtime": "\u30ea\u30a2\u30eb\u30bf\u30a4\u30e0",
	"mode.timeline": "アーカイブ",
	"mode.scenario": "訓練",
	"mode.load": "\u8aad\u8fbc",
	"mode.from": "\u958b\u59cb",
	"mode.to": "\u7d42\u4e86",
	"mode.start": "\u958b\u59cb\u65e5",
	"mode.end": "\u7d42\u4e86\u65e5",
	"mode.error.required":
		"\u958b\u59cb\u65e5\u3068\u7d42\u4e86\u65e5\u306e\u4e21\u65b9\u3092\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002",
	"mode.error.invalidDate":
		"\u65e5\u4ed8\u5f62\u5f0f\u304c\u4e0d\u6b63\u3067\u3059\u3002",
	"mode.error.order":
		"\u958b\u59cb\u65e5\u306f\u7d42\u4e86\u65e5\u3088\u308a\u524d\u3067\u3042\u308b\u5fc5\u8981\u304c\u3042\u308a\u307e\u3059\u3002",
	"mode.error.rangeTooLong":
		"\u671f\u9593\u306f366\u65e5\u4ee5\u5185\u3067\u9078\u629e\u3057\u3066\u304f\u3060\u3055\u3044\u3002",

	// Layer toggles
	"layer.title": "\u30ec\u30a4\u30e4\u30fc",
	"layer.plates": "\u30d7\u30ec\u30fc\u30c8",
	"layer.quakes": "\u5730\u9707",
	"layer.waves": "\u6ce2\u52d5",
	"layer.contours": "\u7b49\u9707\u5ea6\u7dda",
	"layer.shakeMap": "ShakeMap",
	"layer.slab2": "Slab2",
	"layer.labels": "\u30e9\u30d9\u30eb",

	// GSI overlay layers
	"layer.gsiFaults": "活断層図",
	"layer.gsiRelief": "色別標高図",
	"layer.gsiSlope": "傾斜量図",
	"layer.gsiPale": "淡色地図",
	"layer.adminBoundary": "行政区域",
	"layer.jshisHazard": "地震動予測",
	"layer.gsiBaseGroup": "背景地図",
	"layer.gsiOverlayGroup": "オーバーレイ",

	// Data integration layers
	"layer.activeFaults": "活断層線",
	"layer.hazardComparison": "J-SHIS比較",
	"layer.landslideRisk": "土砂災害リスク",

	// Impact panel
	"impact.title": "影響地域",
	"impact.totalExposed": "総影響人口",

	// Alert bar
	"alert.prefix": "地震速報",

	// Tsunami
	"tsunami.warning": "\u8b66\u5831",
	"tsunami.risk.high": "津波警報 — 直ちに高台へ避難してください",
	"tsunami.risk.moderate": "津波注意 — 海岸から離れてください",
	"tsunami.risk.low":
		"津波の発生は予想されませんが、念のため今後の情報にご注意ください",
	"tsunami.risk.none":
		"現時点で津波リスクは低いとみられますが、公式発表は引き続き確認してください",
	"tsunami.label.high": "津波警報",
	"tsunami.label.moderate": "津波注意",
	"tsunami.label.low": "津波情報に注意",
	"tsunami.label.none": "津波リスク低め",

	// Fault types
	"faultType.crustal": "\u5730\u6bbb\u5185",
	"faultType.interface": "\u30d7\u30ec\u30fc\u30c8\u9593",
	"faultType.intraslab": "\u30b9\u30e9\u30d6\u5185",

	// Sidebar extras
	"sidebar.eventCount": "件 / 7日間",
	"sidebar.eventCount.one": "件 / 7日間",
	"sidebar.scenarios": "\u30b7\u30ca\u30ea\u30aa",
	"sidebar.training": "訓練",
	"sidebar.alert": "M5+ 警報",
	"sidebar.empty": "過去7日間にM2.5以上の地震はありません",
	"sidebar.loading": "地震データを取得中…",
	"sidebar.lastUpdated": "更新",
	"sidebar.justNow": "たった今",
	"sidebar.agoMin": "分前",
	"sidebar.offline": "接続が切れました — 再試行中",

	// Relative time
	"time.justNow": "たった今",
	"time.minAgo": "分前",
	"time.hrAgo": "時間前",
	"time.dayAgo": "日前",
	"time.monthAgo": "ヶ月前",
	"time.yearAgo": "年",
	"sidebar.mmiTitle": "改良メルカリ震度",
	"sidebar.source.shakemap": "ShakeMap",
	"sidebar.source.gmpe": "GMPE",

	// Detail panel — intensity source
	"detail.intensitySource": "\u9707\u5ea6\u30bd\u30fc\u30b9",
	"detail.source.shakemap": "USGS ShakeMap",
	"detail.source.gmpe": "\u63a8\u5b9a (GMPE)",
	"detail.crossSection": "\u65ad\u9762\u8868\u793a",

	// PLATEAU 3D Buildings
	"layer.plateau": "3Dビル",
	"plateau.none": "なし",
	"plateau.chiyoda": "千代田区",
	"plateau.chuo": "中央区",
	"plateau.minato": "港区",
	"plateau.shinjuku": "新宿区",
	"plateau.shibuya": "渋谷区",
	"plateau.yokohama": "横浜市",
	"plateau.kawasaki": "川崎市",
	"plateau.saitama": "さいたま市",
	"plateau.chiba": "千葉市",
	"plateau.utsunomiya": "宇都宮市",
	"plateau.maebashi": "前橋市",
	"plateau.kofu": "甲府市",
	"plateau.osaka": "大阪市",
	"plateau.kyoto": "京都市",
	"plateau.kobe": "神戸市",
	"plateau.wakayama": "和歌山市",
	"plateau.nagoya": "名古屋市",
	"plateau.shizuoka": "静岡市",
	"plateau.hamamatsu": "浜松市",
	"plateau.niigata": "新潟市",
	"plateau.kanazawa": "金沢市",
	"plateau.gifu": "岐阜市",
	"plateau.sapporo": "札幌市",
	"plateau.sendai": "仙台市",
	"plateau.fukushima": "福島市",
	"plateau.hiroshima": "広島市",
	"plateau.okayama": "岡山市",
	"plateau.takamatsu": "高松市",
	"plateau.tottori": "鳥取市",
	"plateau.tokushima": "徳島市",
	"plateau.matsuyama": "松山市",
	"plateau.kochi": "高知市",
	"plateau.fukuoka": "福岡市",
	"plateau.kitakyushu": "北九州市",
	"plateau.kumamoto": "熊本市",
	"plateau.naha": "那覇市",
	"plateau.loading": "ビル読み込み中...",

	// Detail panel — MMI descriptions
	"mmi.destructive": "破壊的",
	"mmi.strong": "強震",
	"mmi.moderate": "中震",
	"mmi.weak": "弱震",

	// AI Panel
	"ai.tab.easy": "要点",
	"ai.tab.expert": "分析",
	"ai.tab.data": "根拠",
	"ai.why": "なぜ揺れたのか？",
	"ai.aftershock": "余震確率",
	"ai.intensity": "震度",
	"ai.intensityGuide": "震度ガイド",
	"ai.actions": "今すべきこと",
	"ai.tsunami": "津波リスク",
	"ai.eli5": "かんたん解説",
	"ai.expert.tectonic": "テクトニクス",
	"ai.expert.mechanism": "断層メカニズム",
	"ai.expert.sequence": "シーケンス分類",
	"ai.expert.historical": "歴史的比較",
	"ai.expert.aftershock": "余震評価",
	"ai.expert.gap": "地震空白域",
	"ai.expert.notable": "注目すべき特徴",
	"ai.expert.depth": "深発分析",
	"ai.expert.coulomb": "クーロン応力",
	"ai.expert.modelNotes": "モデルノート",
	"ai.expert.interpretations": "主要解釈",
	"ai.data.download": "JSONダウンロード",
	"ai.data.intensity": "震度",
	"ai.data.cities": "都市",
	"ai.data.population": "人口",
	"ai.data.tags": "検索タグ",
	"ai.button": "AIブリーフ",
	"ai.badge.loading": "AI分析を生成中...",
	"ai.badge.ready": "AI分析の準備完了",
	"ai.loading": "分析中...",
	"ai.panelLabel": "AI分析パネル",
	"ai.close": "AIパネルを閉じる",
	"ai.disclaimer":
		"ベータ分析です。誤り・欠落・遅延が含まれる場合があるため、重要な判断の前に公式発表と一次ソースを再確認してください。",
	"disclaimer.beta.short":
		"ベータ情報です。誤り・欠落・遅延が含まれる場合があるため、重要な判断の前に公式発表と一次ソースを再確認してください。",
	"ai.urgency.immediate": "直ちに",
	"ai.urgency.within_hours": "数時間",
	"ai.urgency.preparedness": "備え",
	"ai.noPublic": "公開分析データがありません",
	"ai.noExpert": "専門分析データがありません",

	// Search
	"search.placeholder": "M6 宮城 / 深発 M7+ / 最近30日...",
	"search.hint": "Enterで検索 · ESCで閉じる",
	"search.loading": "検索中...",
	"search.noResults": "結果なし",
	"search.dialogLabel": "地震検索",
	"search.inputLabel": "地震を検索",
	"search.resultsLabel": "検索結果",
	"search.stats.countSuffix": "件",
	"search.stats.avgPrefix": "平均",
	"search.stats.offshoreSuffix": "件 海域",
	"search.stats.inlandSuffix": "件 内陸",
	"search.quickFilters": "クイックフィルター",
	"search.examples": "検索例",
	"search.chip.recent": "過去24時間",
	"search.chip.tsunami": "津波",
	"search.chip.tohoku": "東北",
	"search.chip.nankai": "南海",
	"search.chip.kanto": "関東",
	"search.chip.deep": "深発地震",
	"ai.ask.placeholder": "この地震について質問...",
	"ai.ask.submit": "質問",
	"ai.ask.thinking": "回答を生成中...",
	"ai.ask.error": "回答の生成に失敗しました",
	"ai.ask.examples": "質問例",
	"ai.ask.ex1": "この地震は南海トラフと関係ありますか？",
	"ai.ask.ex2": "余震はどのくらい続きますか？",
	"ai.ask.ex3": "津波の危険はありますか？",

	// Mobile shell
	"mobile.tab.map": "地図",
	"mobile.tab.live": "ライブ",
	"mobile.nav.label": "モバイルナビゲーション",

	// Mobile sheet
	"sheet.events": "{n}件",
	"sheet.noSelection": "地震をタップ",
	"sheet.recentTitle": "最近の地震",
	"sheet.countSuffix": "件",

	// Operator Pulse
	"panel.operatorPulse.title": "運用パルス",
	"panel.operatorPulse.realtime": "リアルタイム",
	"panel.operatorPulse.performance": "パフォーマンス",
	"panel.operatorPulse.bundle": "バンドル",
	"panel.operatorPulse.scenario": "シナリオ",
	"panel.operatorPulse.freshness": "更新間隔",
	"panel.operatorPulse.ago": "前",
	"panel.operatorPulse.scenario.on": "ON",
	"panel.operatorPulse.scenario.off": "OFF",
	"panel.operatorPulse.realtime.fresh": "正常",
	"panel.operatorPulse.realtime.stale": "遅延",
	"panel.operatorPulse.realtime.degraded": "劣化",
	"panel.operatorPulse.tone.nominal": "正常",
	"panel.operatorPulse.tone.watch": "注意",
	"panel.operatorPulse.tone.degraded": "劣化",
	"panel.operatorPulse.bundle.seismic": "地震",
	"panel.operatorPulse.bundle.maritime": "海上",
	"panel.operatorPulse.bundle.lifelines": "ライフライン",
	"panel.operatorPulse.bundle.medical": "医療",
	"panel.operatorPulse.bundle.builtEnvironment": "都市インフラ",

	// Sector Stress
	"panel.sectorStress.title": "部門別リスク状況",
	"panel.sectorStress.allClear": "全資産は安定",
	"panel.sectorStress.affected": "件影響",
	"panel.sectorStress.maritime": "海上",
	"panel.sectorStress.inZone": "警戒域",
	"panel.sectorStress.stable": "安定",
	"panel.sectorStress.tracked": "追跡中",

	// Navigation
	"nav.returnToJapan": "日本に戻る",

	// Locale switcher
	"locale.en": "EN",
	"locale.ko": "한",
	"locale.ja": "日",

	// Left Panel Tabs
	"panel.tab.live": "ライブ",
	"panel.tab.archive": "アーカイブ",
	"panel.tab.ask": "質問",
	"search.inlineHint": "地震検索（規模・地域・期間）",

	// Ask Panel
	"ask.welcome.title": "Namazue AI",
	"ask.welcome.desc":
		"地震について質問したり、データベースを検索したり、分析をリクエストできます。AIが結果を検索してグローブ上に可視化します。",
	"ask.suggest.recent": "最近のM6+地震は？",
	"ask.suggest.compare": "東北と関東の地震を比較",
	"ask.suggest.region": "日本海の地震活動の傾向",
	"ask.suggest.analysis": "最新の大きな地震を分析",
	"ask.input.placeholder": "地震について質問...",
	"ask.input.label": "質問入力",
	"ask.input.send": "送信",

	// Impact Intelligence
	"panel.impactIntel.title": "インパクト分析",
	"panel.impactIntel.peakIntensity": "推定最大震度",
	"panel.impactIntel.peakIntensityLand": "陸上最大震度",
	"panel.impactIntel.epicentral": "震源直上:",
	"panel.impactIntel.peakIntensityApprox": "推定最大震度（概算）",
	"panel.impactIntel.selectEvent": "イベントを選択して分析",
	"panel.impactIntel.populationExposure": "影響人口",
	"panel.impactIntel.intensityCoverage": "震度分布面積",
	"panel.impactIntel.tsunamiETA": "津波到達予測",
	"panel.impactIntel.responseProtocol": "対応プロトコル",
	"panel.impactIntel.consequenceMatrix": "影響マトリクス",
	"panel.impactIntel.hospitalsCompromised": "病院機能喪失",
	"panel.impactIntel.hospitalsDisrupted": "病院機能低下",
	"panel.impactIntel.dmatDeployable": "DMAT拠点展開可能",
	"panel.impactIntel.nuclearScramLikely": "原発緊急停止の可能性高",
	"panel.impactIntel.nuclearScramPossible": "原発緊急停止の可能性",
	"panel.impactIntel.railSuspended": "鉄道路線運休",
	"panel.impactIntel.railAffected": "鉄道路線影響",
	"panel.impactIntel.vesselsHigh": "船舶 最優先",
	"panel.impactIntel.vesselsInZone": "警戒域内の船舶",
	"panel.impactIntel.domainActions": "即時対応が必要な事項",

	// Threat Board
	"panel.threatBoard.title": "脅威ボード",
	"panel.threatBoard.nominal": "重大な脅威なし。全体状況は正常。",

	// Check These Now
	"panel.checkNow.title": "今すぐ確認",

	// Shell
	"shell.initializing": "起動中",

	// Event Snapshot
	"snapshot.situation": "状況",
	"snapshot.monitoring": "監視中",
	"snapshot.dataPending": "データ待ち",
	"snapshot.dataLive": "データ受信中",
	"snapshot.elapsed": "経過",
	"snapshot.localTime": "現地時刻",
	"snapshot.eventTruth": "イベント情報",
	"snapshot.scenario": "シナリオ",
	"snapshot.depth": "深さ{n}km",
	"snapshot.deselect": "選択解除 (Esc)",
	"snapshot.simulationLabel": "シミュレーション",
	"snapshot.scenarioDisclaimer":
		"ベータシミュレーション · 実際の地震ではありません",
	"snapshot.scenarioWarning": "対応判断の前に公式発表を再確認してください",
	"snapshot.probability30yr": "30年確率",
	"snapshot.recurrence": "再現間隔",
	"snapshot.truth": "{source}情報 · {confidence}信頼度",
	"snapshot.revisions": "{n}回改訂",
	"snapshot.materialDivergence": "重大な乖離",
	"snapshot.conflictDetected": "矛盾を検出",
	"snapshot.health.degraded": "劣化",
	"snapshot.health.watch": "注意",
	"snapshot.health.nominal": "正常",

	// Recent Feed
	"feed.title": "最近の活動",
	"feed.depth.shallow": "浅発",
	"feed.depth.deep": "深発",
	"feed.noEvents": "期間内にイベントなし",
	"feed.moreNotShown": "他{n}件は非表示",
	"feed.from": "開始",
	"feed.to": "終了",
	"feed.maxYear": "最大1年",
	"feed.apply": "適用",
	"feed.clear": "クリア",
	"feed.invalidRange": "無効な範囲",
	"feed.tsunami": "津波",

	// System Bar / Mission Strip
	"sysbar.japan": "日本",
	"sysbar.eventActive": "イベント発生中",
	"sysbar.systemCalm": "システム正常",
	"sysbar.events": "{n}件",

	// Data Ticker
	"ticker.vessels": "AIS {n}隻追跡中",
	"ticker.monitoring": "監視中",

	// Bundle / Layer Control
	"bundle.operatorView": "オペレータービュー",
	"bundle.density": "密度",
	"bundle.density.minimal": "最小",
	"bundle.density.standard": "標準",
	"bundle.density.dense": "高密度",
	"bundle.enabled": "有効",
	"bundle.disabled": "無効",
	"bundle.activeSummary": "アクティブサマリー",
	"bundle.domainBreakdown": "ドメイン内訳",
	"bundle.layers": "レイヤー",
	"bundle.planned": "計画中",
	"bundle.visibleInView": "ビューに表示中",
	"bundle.hiddenInView": "ビューで非表示",
	"bundle.soon": "もうすぐ",
	"bundle.on": "オン",
	"bundle.off": "オフ",
	"bundle.legend": "凡例",
	"bundle.scenario": "シナリオ",
	"bundle.hideControls": "コントロール非表示",
	"bundle.showControls": "バンドルコントロール",
	"bundle.live": "ライブ",
	"bundle.modeled": "モデル",
	"bundle.syncing": "バンドル同期中",
	"bundle.awaiting": "初期バックエンドサマリーを待機中。",

	// Asset Exposure (remaining)
	"exposure.shipType.passenger": "旅客",
	"exposure.shipType.tanker": "タンカー",
	"exposure.shipType.cargo": "貨物",
	"exposure.shipType.fishing": "漁船",
	"exposure.critical": "緊急",
	"exposure.priority": "優先",
	"exposure.watch": "監視",

	// Impact Intelligence (remaining)
	"impact.jmaPrefix": "震度",
	"impact.above": "以上",
	"impact.populationMan": "約{n}万人",
	"impact.populationNin": "{n}人",
	"impact.approx": "約",
	"impact.dataSource": "総務省住民基本台帳人口 (2025-01-01) · {n}行政単位",

	// Command Palette
	"palette.searchPlaceholder": "地名・バンドル・レイヤー・イベント検索…",
	"palette.noResults": "結果なし",
	"palette.hintDefault": "地名・バンドル・ビュー・レイヤー・イベントを検索…",
	"palette.visible": "表示中",
	"palette.hidden": "非表示",
	"palette.toggleScenario": "シナリオモード切替",
	"palette.togglePanels": "パネル表示切替",
	"palette.toggleDrawer": "バンドルドロワー切替",
	"palette.deselectEvent": "イベント選択解除",
	"locationSafety.title": "地点安全状況",
	"locationSafety.tone.safe": "安全",
	"locationSafety.tone.caution": "注意",
	"locationSafety.tone.danger": "危険",
	"locationSafety.summary.safe":
		"この地点で直ちに高い揺れシグナルはありません。",
	"locationSafety.summary.selectedCaution":
		"現在選択中の地震の影響が想定されます。更新を監視してください。",
	"locationSafety.summary.nearbyCaution":
		"周辺の直近活動が増えており、注意が必要です。",
	"locationSafety.summary.selectedDanger":
		"この地点は現在の選択地震による強い揺れに注意が必要です。",
	"locationSafety.summary.nearbyDanger":
		"周辺の直近の揺れが強く、注意が必要です。",
	"locationSafety.population": "人口 {count}",
	"locationSafety.selectedEventTitle": "現在選択中の地震",
	"locationSafety.nearbyTitle": "過去24時間の周辺活動",
	"locationSafety.close": "地点安全カードを閉じる",
	"locationSafety.noSelectedEvent": "現在選択中の地震はありません",
	"locationSafety.noNearby24h": "過去24時間に周辺イベントはありません",
	"locationSafety.events24h": "{count}件",
	"locationSafety.na": "該当なし",
	"mapSearch.label": "日本の自治体を検索",
	"mapSearch.placeholder": "日本の市区町村・主要都市を検索…",
	"mapSearch.clearQuery": "検索語をクリア",
	"mapSearch.noResults": "一致する地点がありません",

	// Shell (dynamic)
	"shell.scenarioBannerText":
		"ベータシミュレーション — 実際の地震ではありません",
	"shell.scenarioBannerSub": "対応判断の前に公式発表を再確認してください",
	"shell.scenarioBadge": "シナリオ",

	// Settings Panel
	"settings.title": "設定",
	"settings.tab.general": "一般",
	"settings.tab.methodology": "解析手法",
	"settings.notifications": "通知",
	"settings.eventAlerts": "イベント通知",
	"settings.minMagnitude": "最小マグニチュード",
	"settings.alertSound": "警報音",
	"settings.soundHint": "M4.5+ 注意 · M5.5+ 警戒 · M6.5+ 緊急",
	"settings.keyboard": "キーボード",
	"settings.shortcutsEnabled": "ショートカット有効",
	"settings.display": "表示",
	"settings.showCoordinates": "座標表示",
	"settings.resetDefaults": "デフォルトに戻す",
	"settings.on": "ON",
	"settings.off": "OFF",
	"settings.methodology.desc":
		"Namazue Engineは以下の学術モデルと公共機関のレファレンスを基に設計されています。",
	"settings.methodology.betaNotice":
		"Namazueはまだベータ段階です。表示情報には誤り、欠落、解釈差、更新遅延が含まれる場合があります。重要な判断ではこのコンソールだけに依存せず、まず公式発表と一次ソースを再確認してください。",
	"settings.methodology.lastAudited": "最終監査: 2026-03-07",
	"settings.methodology.referenceHeader": "マスターレファレンス一覧",
	"settings.methodology.academic": "学術モデル",
	"settings.methodology.public": "政府・公共データソース",

	// Shortcuts (shared: settings + keyboard help)
	"shortcuts.navigation": "ナビゲーション",
	"shortcuts.controls": "コントロール",
	"shortcuts.information": "情報",
	"shortcuts.commandPalette": "コマンドパレット",
	"shortcuts.switchBundle": "バンドル切替",
	"shortcuts.nextPrevEvent": "次/前のイベント",
	"shortcuts.closeOverlay": "オーバーレイを閉じる/選択解除",
	"shortcuts.toggleScenario": "シナリオモード切替",
	"shortcuts.toggleDrawer": "バンドルドロワー切替",
	"shortcuts.togglePanels": "パネル表示切替",
	"shortcuts.toggleFaults": "断層レイヤー切替",
	"shortcuts.resetView": "日本全域表示",
	"shortcuts.openSettings": "設定を開く",
	"shortcuts.showHelp": "このヘルプを表示",
	"help.title": "キーボードショートカット",

	// Mission Strip
	"strip.view": "ビュー",
	"strip.bundle": "バンドル",
	"strip.density": "密度",
	"strip.freshness": "鮮度",
	"strip.trust": "信頼性",
	"strip.divergence": "乖離",
	"strip.conflict": "競合",
	"strip.lowConf": "低信頼",
	"strip.degraded": "劣化",
	"strip.watch": "注意",
	"strip.nominal": "正常",

	// Command Deck
	"deck.timeline": "タイムライン",
	"deck.event": "イベント",
	"deck.live": "ライブ",
	"deck.view": "ビュー",
	"deck.bundle": "バンドル",
	"deck.density": "密度",

	// Command Palette categories
	"palette.category.location": "場所",
	"palette.category.bundle": "バンドル",
	"palette.category.view": "ビュー",
	"palette.category.layer": "レイヤー",
	"palette.category.action": "アクション",
	"palette.category.event": "イベント",

	// Recent Feed (compact time)
	"feed.timeNow": "今",
	"feed.timeMin": "{n}分前",
	"feed.timeHr": "{n}時間前",
	"feed.timeDay": "{n}日前",
	"feed.timeMonth": "{n}ヶ月前",
	"feed.timeYear": "{n}年前",
	"feed.timeYearMonth": "{y}年{m}ヶ月前",
	"feed.daysSelected": "{n}日間",
	"feed.rangeTooLong": "{n}日 > 最大365日",

	// Notifications
	"notif.detected": "M{mag} 検知",

	// Data Ticker
	"ticker.unknown": "不明",

	// Exposure damage reasons (from fragility curves)
	"exposure.reason.belowThreshold": "運用上の閾値以下",
	"exposure.reason.structuralFailure": "構造破壊リスクあり",
	"exposure.reason.significantDamage": "重大な損傷の可能性大",
	"exposure.reason.moderateDamage": "中程度の損傷リスク",
	"exposure.reason.highDisruption": "障害発生確率高",
	"exposure.reason.elevatedDisruption": "障害リスク上昇",
	"exposure.reason.tsunamiPosture": "津波態勢：{risk}",
	"exposure.reason.lifelineCascade":
		"ライフライン連鎖 — 上流インフラ障害によるリスク上昇",

	// Operational concerns (from assetClassRegistry)
	"exposure.concern.quayInspection": "岸壁・クレーンの点検が必要",
	"exposure.concern.liquefactionRisk": "液状化リスク評価が必要",
	"exposure.concern.trackInspection": "軌道点検を優先実施",
	"exposure.concern.hubInspection": "拠点の構造点検が必要",
	"exposure.concern.accessRouteSensitivity": "アクセス経路への影響",
	"exposure.concern.nonStructuralDamage": "非構造部材の損傷評価",
	"exposure.concern.gridStability": "系統安定性リスク",
	"exposure.concern.transformerInspection": "変圧器ブッシングの点検",
	"exposure.concern.serviceContinuity": "サービス継続リスク",
	"exposure.concern.pipelineIntegrity": "配管網の健全性確認",
	"exposure.concern.commsContinuity": "通信継続リスク",
	"exposure.concern.equipmentRack": "機器ラックの点検",
	"exposure.concern.urbanInspection": "市街地構造物の点検",
	"exposure.concern.glassFacade": "ガラス・外壁の落下危険性評価",
	"exposure.concern.reactorScram": "原子炉自動緊急停止閾値",
	"exposure.concern.spentFuel": "使用済み燃料プールの点検が必要",
	"exposure.concern.beyondDesignBasis": "設計基準超過事象の評価",
	"exposure.concern.runwayInspection": "滑走路の点検が必要",
	"exposure.concern.terminalAssessment": "ターミナル構造の安全確認",
	"exposure.concern.damBodyInspection": "ダム本体の点検が必要",
	"exposure.concern.downstreamEvacuation": "下流域の避難評価",
	"exposure.concern.fireExplosionRisk": "火災・爆発リスクの評価",
	"exposure.concern.pipelineIsolation": "パイプライン遮断プロトコル",
	"exposure.concern.coordinationCapacity": "指揮統制機能のリスク",
	"exposure.concern.shelterAssessment": "避難施設の構造安全確認が必要",

	// Damage probability display
	"exposure.prob.disruption": "障害発生確率",
	"exposure.prob.damage": "損傷発生確率",
	"exposure.prob.collapse": "崩壊発生確率",
	"exposure.prob.overall": "総合リスクスコア",
	"exposure.summary": "{name}は{severity}態勢です。",

	// Priority rationale
	"priority.rationale":
		"{region}の{classLabel}は{severity}態勢です。理由: {reasons}。",

	// Bootstrap loading
	"boot.buildingConsole": "コンソール構築中…",
	"boot.initMap": "地図初期化中…",
	"boot.mountingPanels": "パネル構築中…",
	"boot.loadingFaults": "断層データ読込中…",
	"boot.fetchingEvents": "イベント取得中…",
	"boot.mapReady": "地図準備完了…",
	"boot.eventsLoaded": "{n}件読込完了",
	"boot.ready": "準備完了",
	"boot.failure.mapTitle": "地図を開始できません",
	"boot.failure.mapDetail":
		"コンソールに必要なWebGLを初期化できませんでした。ブラウザの描画設定や強いブロック設定を確認し、再読み込みするか別のブラウザを試してください。",
	"boot.failure.genericTitle": "Namazueを開始できません",
	"boot.failure.genericDetail":
		"コンソールが操作可能になる前に起動に失敗しました。ページを再読み込みしてもう一度お試しください。",
	"boot.failure.retry": "再読み込み",

	// Temporal Slider
	"temporal.catalog": "カタログ",
	"temporal.playAnimation": "アニメーション再生",
	"temporal.exit": "終了",
	"temporal.live": "● ライブ",
	"temporal.events": "{n}件",
	"timeline.sequence.mode.live": "ライブ",
	"timeline.sequence.mode.replay": "リプレイ",
	"timeline.sequence.mode.preview": "プレビュー",
	"timeline.sequence.phase.idle": "待機",
	"timeline.sequence.phase.epicenter-flash": "震央フラッシュ",
	"timeline.sequence.phase.p-wave": "P波伝播",
	"timeline.sequence.phase.s-wave": "S波伝播",
	"timeline.sequence.phase.intensity-reveal": "震度表示",
	"timeline.sequence.phase.infrastructure-handoff": "インフラ連携",
	"timeline.sequence.phase.aftershock-cascade": "余震カスケード",
	"timeline.sequence.phase.settled": "収束",
	"timeline.sequence.boundary.replay": "描画のみ",
	"timeline.sequence.boundary.preview": "合成プレビュー",

	// Fault Catalog
	"fault.title": "HERP 活断層シナリオ",
	"fault.hint": "クリックでシナリオ実行",
	"fault.type.interface": "海溝型",
	"fault.type.intraslab": "スラブ内",
	"fault.type.crustal": "活断層",

	// Maritime Exposure
	"maritime.exposureTitle": "海上影響",
	"maritime.totalTracked": "合計{n}隻追跡中",
	"maritime.highPriority": "最優先",
	"maritime.hazmat": "危険物",

	// Check These Now
	"check.trust": "信頼性",

	// Depth Cross-Section
	"depth.title": "深度断面図",
	"depth.subtitle": "経度 vs. 深さ — 日本海溝から日本海",
	"depth.close": "閉じる (X)",
	"depth.depthLabel": "深さ: {n} km",
	"depth.button": "断面",
	"depth.toggle": "深度断面図 (X)",

	// Decision Matrix
	"matrix.peakIntensity": "最大震度",
	"matrix.population": "人口",
	"matrix.noCityDetail": "都市別影響データなし",
	"matrix.infrastructure": "インフラ",
	"matrix.hospitalRail": "病院{hospitals} / 鉄道{rail}",
	"matrix.tsunamiETA": "津波到達予測",

	// Wave Handoff
	"wave.standby": "S波待機",
	"wave.reached": "S波到達 {n} km",
	"wave.front": "S波前面 {n} km",

	// Settings
	"settings.tooltip": "設定 (,)",
	"home.tooltip": "日本全域表示 (H)",

	// Regions
	"region.japan": "日本",
	"region.hokkaido": "北海道",
	"region.tohoku": "東北",
	"region.kanto": "関東",
	"region.chubu": "中部",
	"region.kansai": "関西",
	"region.chugoku": "中国",
	"region.shikoku": "四国",
	"region.kyushu": "九州",

	// Intensity source (Impact Intelligence)
	"intel.source.jmaObserved": "JMA観測値",
	"intel.source.gmpeEstimate": "GMPE推定値",
	"intel.source.gmpeEstimateFull": "GMPE推定値 (Si & Midorikawa 1999)",
	"intel.source.gmpeLabel": "GMPE推定:",

	// Scenario disclaimer
	"scenario.disclaimer.title": "シミュレーションモード",
	"scenario.disclaimer.body":
		"これはベータ版のシミュレーション機能です。\n表示されるデータは実際の地震情報ではなく、誤り・欠落・遅延が含まれる場合があります。",
	"scenario.disclaimer.warning":
		"実際の災害対応や安全判断には使用しないでください。\n重要な判断の前に、必ず公的機関の発表と一次ソースを再確認してください。",
	"scenario.disclaimer.accept": "「OK」を押すと同意したものとみなします。",

	// Fault tooltip
	"fault.tooltip.depth": "深さ{n}km",
	"fault.tooltip.probability": "30年確率: {prob}",
	"fault.tooltip.recurrence": "再現間隔: {interval}",

	// Decision matrix details
	"matrix.instrumentalDetail": "計測震度 {n}",
	"matrix.cityExposure": "{city} {pop} 震度{jma}",

	// Methodology references
	"methodology.ref.siMidorikawa": "Si & Midorikawa (1999) — 距離減衰式",
	"methodology.ref.wells":
		"Wells & Coppersmith (1994) — 断層長-マグニチュードスケーリング",
	"methodology.ref.nakamura": "Nakamura (1988) — UrEDAS早期検知コンセプト",
	"methodology.ref.jma": "気象庁 — 地震・津波情報",
	"methodology.ref.mic": "総務省統計局 — 人口推計・国勢調査",
	"methodology.ref.cao": "内閣府防災 — 災害対応要領",
	"methodology.ref.nra": "原子力規制委員会 — 原子力安全基準",
	"methodology.ref.gsi": "国土地理院 — 地理空間データ基盤",

	// Location names (Command Palette)
	"location.tokyo": "東京",
	"location.osaka": "大阪",
	"location.nagoya": "名古屋",
	"location.sendai": "仙台",
	"location.sapporo": "札幌",
	"location.fukuoka": "福岡",
	"location.hiroshima": "広島",
	"location.kobe": "神戸",
	"location.yokohama": "横浜",
	"location.kyoto": "京都",
	"location.niigata": "新潟",
	"location.kagoshima": "鹿児島",
	"location.naha": "那覇",
	"location.kumamoto": "熊本",
	"location.hakodate": "函館",
	"location.shizuoka": "静岡",
	"location.kanazawa": "金沢",
	"location.matsuyama": "松山",
	"location.nankaiTrough": "南海トラフ",
	"location.sagamiTrough": "相模トラフ",
	"location.japanOverview": "日本（全域）",

	// Custom range (Recent Feed)
	"feed.customRange": "期間指定",

	// Depth cross-section (canvas labels)
	"depth.pacificPlate": "太平洋プレート",
	"depth.philippineSea": "フィリピン海プレート",

	// AIS Layer
	"ais.inZoneSummary": "{n}隻 影響圏内",
	"ais.passengerCount": "{n}隻 旅客",
	"ais.tankerCount": "{n}隻 タンカー",
	"ais.anchored": "停泊中",
	"ais.heading": "針路",
	"ais.highPriorityLabel": "最優先",
	"ais.impactZoneWarning": "影響圏内 — 震央から{dist}km",

	// System Bar
	"sysbar.healthStatus": "状態 {level}",
	"sysbar.divergence": "乖離",
	"sysbar.conflict": "競合",
	"sysbar.lag": "遅延 {n}秒",
	"sysbar.fps": "fps {n} 低下",

	// Maritime Telemetry
	"maritime.noTraffic": "追跡対象なし",
	"maritime.trackedCount": "{n}隻追跡",
	"maritime.highPriorityCount": "{n}隻優先",
	"maritime.underwayCount": "{n}隻航行中",
	"maritime.anchoredCount": "{n}隻停泊",

	// Bundle Summaries
	"bundle.metric.exposed": "{n} {type} 影響あり",
	"bundle.metric.assetsElevated": "{n}資産が警戒態勢",
	"bundle.metric.noElevated": "全国で警戒態勢なし",
	"bundle.metric.portsElevated": "{n}港湾施設が警戒態勢",
	"bundle.metric.lifelineElevated": "{n}ライフライン拠点が警戒態勢",
	"bundle.metric.noLifelineElevated": "ライフライン警戒態勢なし",
	"bundle.metric.medicalElevated": "{n}医療施設が警戒態勢",
	"bundle.metric.noMedicalShift": "医療アクセスに変化なし",
	"bundle.metric.buildingElevated": "{n}建物群が警戒態勢",
	"bundle.metric.urbanAligned": "{region} 都市状況がイベントに対応",
	"bundle.metric.urbanStandby": "都市構造コンテキスト待機中",
	"bundle.detail.requiresVerification":
		"{assets}のオペレーター確認が必要です。",
	"bundle.detail.pressureCentered":
		"主要な運用負荷は{region}に集中しています。",
	"bundle.detail.seismicStandby": "次の重大イベントに備えて待機中です。",
	"bundle.detail.coastalVerification": "{assets}の沿岸確認が必要です。",
	"bundle.detail.highPriorityFeed":
		"優先船舶{hp}隻、航行中{uw}隻がフィード中。",
	"bundle.detail.underwayTraffic": "沿岸航路で{n}隻が航行中。",
	"bundle.detail.aisStandby": "AISテレメトリと沿岸海運態勢は待機中です。",
	"bundle.detail.corridorVerification": "{assets}の回廊確認が必要です。",
	"bundle.detail.lifelineStandby":
		"鉄道・電力・水道・通信の回廊ストレス監視は待機中です。",
	"bundle.detail.hospitalVerification":
		"{assets}の病院アクセス確認が必要です。",
	"bundle.detail.medicalStandby": "医療アクセスと病院即応体制は待機中です。",
	"bundle.detail.urbanVerification": "{assets}の都市構造健全性確認が必要です。",
	"bundle.detail.builtEnvIntensify":
		"構造レイヤーのオンラインに伴い、市区レベルで建築環境オーバーレイが強化されます。",
	"bundle.detail.builtEnvStandby":
		"オペレーターフォーカスイベントが選択されると、市区レベルの建築環境オーバーレイが有効になります。",
	"bundle.counter.affected": "影響",
	"bundle.counter.visible": "表示中",
	"bundle.counter.tracked": "追跡",
	"bundle.counter.highPriority": "優先",
	"bundle.counter.underway": "航行中",
	"bundle.counter.lifelineSites": "ライフライン拠点",
	"bundle.counter.sites": "施設",
	"bundle.counter.buildingClusters": "建物群",
	"bundle.signal.focusRegion": "注目地域",
	"bundle.signal.topAssets": "主要資産",
	"bundle.signal.focusAssets": "注目資産",
	"bundle.signal.domainMix": "ドメイン構成",
	"bundle.signal.exposedPorts": "影響港湾",
	"bundle.signal.trafficPosture": "交通態勢",
	"bundle.signal.trafficPostureValue": "優先{hp} / 航行中{uw}",
	"bundle.signal.corridorFocus": "回廊注目",
	"bundle.signal.source": "ソース",
	"bundle.signal.modeledFromSeismic": "地震影響からモデル推定",
	"bundle.signal.medicalFocus": "医療注目",
	"bundle.signal.urbanFocus": "都市注目",
	"bundle.signal.activationTier": "有効化レベル",
	"bundle.signal.cityTierFocus": "市区レベルでオペレーターフォーカス",

	// Ops Read Model
	"ops.magSpread": "規模ばらつき {n}",
	"ops.depthSpread": "深さばらつき {n} km",
	"ops.locationSpread": "位置ばらつき {n} km",
	"ops.tsunamiMismatch": "津波態勢不一致",
	"ops.faultTypeMismatch": "断層タイプ不一致",
	"ops.revisionsReview":
		"{sources}からの{n}回改訂にオペレーター確認が必要です。",
	"ops.revisionsShow": "{sources}からの{n}回改訂: {detail}",
	"ops.noSignificantEvent": "運用上重要なイベントは選択されていません",
	"ops.focusAutoSelected": "現在のインシデントストリームから自動選択",
	"ops.focusRetained": "現在のインシデントにフォーカス継続",
	"ops.focusEscalated": "より重大なインシデントにエスカレーション",
	"ops.focusActive": "運用フォーカス稼働中",
	"ops.assetsElevatedNational": "全国で{n}資産が警戒態勢",
	"ops.assetsElevatedVisible": "表示中の{n}資産が警戒態勢",
	"ops.noAssetsElevated": "警戒態勢の資産なし",

	// Rail Domain (bundleDomainOverviews)
	"rail.status.suspended": "運休",
	"rail.status.partial": "一部運転",
	"rail.status.delayed": "遅延",
	"rail.status.pending": "確認待ち",
	"rail.status.nominal": "正常",
	"rail.feed.live": "{source} ライブ",
	"rail.feed.stale": "{source} 遅延",
	"rail.feed.degraded": "{source} 劣化",
	"rail.feed.down": "{source} 停止",
	"rail.feed.unknown": "{source} 不明",
	"rail.feed.defaultSource": "フィード",
	"rail.telemetry.staleWith":
		"鉄道テレメトリが遅延しています。最終確認済みの回廊状態を使用しています。",
	"rail.telemetry.staleWithout":
		"鉄道テレメトリが遅延しており、現在の回廊状態は取得できていません。",
	"rail.telemetry.degradedWith":
		"鉄道テレメトリが劣化しています。行動前に最終確認済みの回廊状態を検証してください。",
	"rail.telemetry.degradedWithout":
		"鉄道テレメトリが劣化しており、現在の回廊状態は取得できていません。",
	"rail.telemetry.downWith":
		"鉄道テレメトリが停止しています。手動による回廊確認が必要です。",
	"rail.telemetry.downWithout":
		"鉄道テレメトリが停止しており、現在の回廊状態は取得できていません。",
	"rail.telemetry.unknownWith":
		"鉄道テレメトリの状態が不明です。行動前に最終確認済みの回廊状態を検証してください。",
	"rail.telemetry.unknownWithout":
		"鉄道テレメトリの状態が不明であり、現在の回廊状態は取得できていません。",
	"rail.label": "鉄道",
	"rail.metric.down": "鉄道テレメトリ停止",
	"rail.metric.degraded": "鉄道テレメトリ劣化",
	"rail.metric.pending": "鉄道テレメトリ確認待ち",
	"rail.metric.stale": "鉄道テレメトリ遅延",
	"rail.metric.corridorsSuspended": "{n}回廊が運休",
	"rail.metric.corridorsPartial": "{n}回廊が一部運転",
	"rail.metric.corridorsDelayed": "{n}回廊が遅延",
	"rail.metric.corridorsPending": "{n}回廊がステータス確認待ち",
	"rail.metric.corridorsNominal": "{n}回廊が正常運行",
	"rail.detail.suspended": "{line}がライブフィードで運休中です。",
	"rail.detail.suspendedCause": "{line}が{cause}により運休中です。",
	"rail.detail.partial": "{line}が一部運転中です。",
	"rail.detail.partialCause": "{line}が{cause}により一部運転中です。",
	"rail.detail.delayed": "{line}が遅延を報告しています。",
	"rail.detail.delayedCause": "{line}が{cause}により遅延しています。",
	"rail.detail.pendingUpdate": "{line}はライブステータス更新を待っています。",
	"rail.detail.nominal":
		"鉄道テレメトリは監視中の新幹線回廊全体で正常態勢を示しています。",
	"rail.signal.feed": "鉄道フィード",
	"rail.signal.networkState": "路線網状態",
	"rail.signal.primaryCorridor": "主要回廊",
	"rail.signal.reportedCause": "報告原因",
	"rail.signal.primaryStatus": "主要状態",
	"rail.signal.network": "鉄道路線網",
	"rail.counter.monitored": "監視中",
	"rail.counter.suspended": "運休",
	"rail.counter.partial": "一部運転",
	"rail.counter.delayed": "遅延",
	"rail.counter.pending": "確認待ち",

	// Power Domain
	"power.label": "電力",
	"power.metric.scramLikely": "原子炉スクラムの可能性 {n}基",
	"power.metric.scramRisks": "原子炉スクラムリスク {n}基",
	"power.metric.siteReview": "原子力施設 {n}基が確認中",
	"power.metric.nodesElevated": "電力ノード {n}箇所が警戒態勢",
	"power.metric.sitesInZone": "発電施設 {n}箇所が影響圏内",
	"power.detail.nearScram": "{plant}はスクラム閾値付近で推定 ~{pga} gal です。",
	"power.detail.gridVerify":
		"{plant}は推定JMA {intensity}であり、送電網の確認が必要です。",
	"power.detail.continuity":
		"{plant}は現在の震動領域内にあり、運転継続の確認が必要です。",
	"power.counter.nodes": "電力ノード",
	"power.counter.scramLikely": "スクラム可能性",
	"power.counter.scramReview": "スクラム確認",
	"power.counter.plantsInZone": "影響圏内施設",
	"power.signal.primaryPlant": "主要施設",
	"power.signal.region": "電力地域",
	"power.signal.pga": "推定PGA",
	"power.signal.gridNode": "送電ノード",
	"power.signal.posture": "電力態勢",

	// Water Domain
	"water.label": "水道",
	"water.posture.outageRisk": "断水リスク",
	"water.posture.continuityReview": "継続性確認",
	"water.posture.verification": "検証",
	"water.posture.nominal": "正常",
	"water.metric.outageRisk": "水道施設 {n}箇所が断水リスク",
	"water.metric.continuityReview": "水道施設 {n}箇所が継続性確認中",
	"water.metric.elevated": "水道施設 {n}箇所が警戒態勢",
	"water.metric.verification": "水道施設 {n}箇所が検証中",
	"water.detail.outageRisk":
		"{site}は推定JMA {intensity}であり、上水道の継続性にリスクがあります。",
	"water.detail.continuityReview":
		"{site}は推定JMA {intensity}であり、配水系統の確認が必要です。",
	"water.detail.verification":
		"{site}は現在の震動領域内にあり、水道継続性の確認が必要です。",
	"water.counter.sites": "水道施設",
	"water.counter.outageRisk": "断水リスク",
	"water.counter.review": "継続性確認",
	"water.counter.verify": "検証",
	"water.signal.primaryFacility": "主要施設",
	"water.signal.region": "水道地域",
	"water.signal.intensity": "推定震度",
	"water.signal.posture": "系統態勢",
	"water.signal.waterPosture": "水道態勢",

	// Overview (generic bundle)
	"overview.defaultMetric.lifeline": "ライフライン確認",
	"overview.defaultMetric.medical": "医療アクセス確認",
	"overview.defaultMetric.builtEnv": "都市健全性確認",
	"overview.counterLabel.lifelineSites": "ライフライン拠点",
	"overview.counterLabel.sites": "施設",
	"overview.counterLabel.buildingClusters": "建物群",
	"overview.signal.nextCheck": "次の確認",
	"overview.signal.region": "地域",
	"overview.signal.primaryDomain": "主要ドメイン",
	"overview.signal.builtEnvironment": "建築環境",
	"overview.counter.checks": "確認項目",
	"overview.metric.queued": "{n}件の{label}がキューに入っています",

	// Poller Section Labels
	"poller.section.events": "イベント",
	"poller.section.governor": "ガバナー",
	"poller.section.maritime": "海事",
	"poller.section.rail": "鉄道",
	"poller.staleMessage": "{section}が遅延中",
	"poller.degradedMessage": "{section} {state}: {error}",
	"poller.degradedNoError": "{section} {state}",
	"poller.fallback.governor":
		"統合スナップショットなしでガバナーケイデンスが稼働中",
	"poller.fallback.maritime":
		"統合スナップショット利用不可；海事キャッシュがあれば最終正常値を提供",
	"poller.fallback.rail":
		"統合スナップショット利用不可；鉄道キャッシュがあれば最終正常値を提供",
	"poller.fallback.transport":
		"統合スナップショット利用不可；フォールバック転送で稼働中",
	"poller.fallback.unavailable":
		"リアルタイムスナップショットとフォールバックフィードが利用できません",

	// Rail Layer Tooltip
	"rail.tooltip.normalOps": "正常運行",
	"rail.tooltip.delayed": "遅延",
	"rail.tooltip.suspended": "運休",
	"rail.tooltip.partial": "一部運転",
	"rail.tooltip.unknown": "状態不明",
	"rail.tooltip.shinkansen": "新幹線",
	"rail.tooltip.conventional": "在来線",
	"rail.tooltip.likelySuspended": "運休の可能性 \u2014 UrEDAS発動",
	"rail.tooltip.normalStatus": "正常運行中",
	"rail.tooltip.stations": "{n}駅",

	// System Health (serviceReadModel)
	"health.degraded.headline": "リアルタイムフィード劣化",
	"health.degraded.detail":
		"フォールバックリアルタイムフィードが稼働中。行動前にソースの信頼性を確認してください。",
	"health.divergence.headline": "リビジョン間の重大な乖離を検出",
	"health.divergence.detail":
		"ソースリビジョンが大きく乖離しており、オペレーター確認が必要です。",
	"health.conflict.headline": "ソース間のリビジョン競合を検出",
	"health.lowConf.headline": "選択イベントの情報信頼度が低い",
	"health.stale.headline": "リアルタイム更新が遅延中",
	"health.conflict.detail":
		"{sources}からの{n}回改訂にオペレーター確認が必要です。",
	"health.lowConf.detail":
		"選択された情報は低信頼度の{source}リビジョンに基づいています。行動前に確認してください。",
	"health.stale.detail":
		"プライマリフィードが遅延中です。判断が現地状況より遅れる可能性があります。",
	"health.nominal.headline": "リアルタイムフィード正常",
	"health.nominal.detail": "ソース競合やリアルタイム劣化は検出されていません。",

	// Ops Snapshot
	"ops.snapshotSummary": "{place} M{mag} イベント。津波態勢 {tsunami}。",

	// Realtime Status
	"realtime.fallbackStale":
		"フォールバックフィード稼働中、データが遅延しています",
	"realtime.fallbackActive": "フォールバックリアルタイムフィードで稼働中",
	"realtime.delayed": "リアルタイム更新が遅延中",

	// Replay Milestones
	"milestone.eventLocked": "イベント確定",
	"milestone.impactReady": "影響分析準備完了",
	"milestone.tsunamiReady": "津波態勢準備完了",
	"milestone.exposureReady": "資産影響評価準備完了",
	"milestone.prioritiesPublished": "優先順位公開",

	// Presentation (Snapshot Model)
	"snapshot.calm.headline": "重大な運用上の地震イベントなし",
	"snapshot.calm.summary": "{metro}は平常監視モードを維持しています。",
	"snapshot.calm.check.replay": "履歴リプレイを開く",
	"snapshot.calm.check.scenario": "シナリオシフトを実行",
	"snapshot.calm.check.inspect": "{metro}のローンチアセットを確認",
	"snapshot.event.headline": "{place}付近で運用上の影響が発生中",
	"snapshot.event.summary": "{metro}のインフラ重点確認が必要です。",

	// Asset Class Registry
	"asset.port.label": "港湾",
	"asset.port.family": "港湾",
	"asset.port.counter": "港湾",
	"asset.port.metric": "港湾施設",
	"asset.port.domainCheck": "沿岸確認",
	"asset.port.priority": "{name}のアクセスを確認",

	"asset.railHub.label": "鉄道拠点",
	"asset.railHub.family": "鉄道",
	"asset.railHub.counter": "鉄道拠点",
	"asset.railHub.metric": "鉄道拠点",
	"asset.railHub.domainCheck": "回廊確認",
	"asset.railHub.priority": "{name}鉄道拠点を点検",

	"asset.hospital.label": "病院",
	"asset.hospital.family": "病院",
	"asset.hospital.counter": "施設",
	"asset.hospital.metric": "病院施設",
	"asset.hospital.domainCheck": "医療アクセス確認",
	"asset.hospital.priority": "{name}のアクセス態勢を確認",

	"asset.powerSub.label": "変電所",
	"asset.powerSub.family": "電力",
	"asset.powerSub.counter": "電力ノード",
	"asset.powerSub.metric": "電力ノード",
	"asset.powerSub.domainCheck": "電力安定性確認",
	"asset.powerSub.priority": "{name}の電力態勢を確認",

	"asset.water.label": "上水施設",
	"asset.water.family": "水道",
	"asset.water.counter": "水道施設",
	"asset.water.metric": "水道施設",
	"asset.water.domainCheck": "水道継続性確認",
	"asset.water.priority": "{name}の水道態勢を確認",

	"asset.telecom.label": "通信拠点",
	"asset.telecom.family": "通信",
	"asset.telecom.counter": "通信拠点",
	"asset.telecom.metric": "通信拠点",
	"asset.telecom.domainCheck": "通信継続性確認",
	"asset.telecom.priority": "{name}の通信態勢を確認",

	"asset.building.label": "建物群",
	"asset.building.family": "都市中心部",
	"asset.building.counter": "建物群",
	"asset.building.metric": "建物群",
	"asset.building.domainCheck": "都市健全性確認",
	"asset.building.priority": "{name}の建築環境態勢を確認",

	"asset.nuclear.label": "原子力発電所",
	"asset.nuclear.family": "原子力",
	"asset.nuclear.counter": "原子力施設",
	"asset.nuclear.metric": "原子力施設",
	"asset.nuclear.domainCheck": "原子力安全確認",
	"asset.nuclear.priority": "緊急: {name}の原子炉状態を確認",

	"asset.airport.label": "空港",
	"asset.airport.family": "航空",
	"asset.airport.counter": "空港",
	"asset.airport.metric": "空港",
	"asset.airport.domainCheck": "航空運用確認",
	"asset.airport.priority": "{name}の滑走路・ターミナルを点検",

	"asset.dam.label": "ダム",
	"asset.dam.family": "ダム",
	"asset.dam.counter": "ダム施設",
	"asset.dam.metric": "ダム施設",
	"asset.dam.domainCheck": "ダム構造健全性確認",
	"asset.dam.priority": "緊急: {name}の構造健全性を点検",

	"asset.lng.label": "LNG基地",
	"asset.lng.family": "エネルギー",
	"asset.lng.counter": "エネルギー施設",
	"asset.lng.metric": "エネルギー施設",
	"asset.lng.domainCheck": "エネルギー施設安全確認",
	"asset.lng.priority": "{name}の格納・パイプライン状態を確認",

	"asset.eoc.label": "行政EOC",
	"asset.eoc.family": "行政",
	"asset.eoc.counter": "EOC施設",
	"asset.eoc.metric": "EOC施設",
	"asset.eoc.domainCheck": "EOC運用確認",
	"asset.eoc.priority": "{name}の運用状態を確認",

	"asset.evac.label": "避難施設",
	"asset.evac.family": "避難所",
	"asset.evac.counter": "避難施設",
	"asset.evac.metric": "避難施設",
	"asset.evac.domainCheck": "避難施設収容力確認",
	"asset.evac.priority": "{name}の避難収容力を評価",

	// Bundle Registry
	"bundle.desc.seismic": "イベント情報、震動領域、および断層コンテキスト。",
	"bundle.desc.maritime": "船舶、港湾アプローチ、および沿岸運用態勢。",
	"bundle.desc.lifelines": "鉄道、空港、都市結節点、電力、水道、通信回廊。",
	"bundle.desc.medical": "病院アクセスと医療対応態勢。",
	"bundle.desc.builtEnv": "3Dビルおよび都市構造コンテキスト。",

	// Operator View Presets
	"view.nationalImpact": "国土影響",
	"view.coastalOperations": "沿岸運用",
	"view.railStress": "鉄道ストレス",
	"view.medicalAccess": "医療アクセス",
	"view.builtEnvironment": "建築環境",

	// Response Timeline (impactIntelligence)
	"response.uredas": "UrEDAS自動停止（新幹線）",
	"response.uredas.desc": "緊急地震速報により新幹線が数秒以内に自動ブレーキ",
	"response.jma": "JMA速報震度",
	"response.jma.desc": "気象庁が初動の震度速報を発表",
	"response.nhk": "NHK地震速報",
	"response.nhk.desc": "NHKが番組を中断し地震情報を放送",
	"response.tsunami": "津波注意報/警報",
	"response.tsunami.desc":
		"気象庁が震源とマグニチュードに基づき津波注意報または警報を発表",
	"response.dmat": "DMAT待機態勢",
	"response.dmat.desc": "災害派遣医療チーム（DMAT）が被災地域で待機態勢に入る",
	"response.fdma": "FDMA災害対策本部",
	"response.fdma.desc": "消防庁が災害対策本部を設置",
	"response.sdf": "SDF派遣判断",
	"response.sdf.desc": "自衛隊の災害派遣に関する判断",
	"response.transport": "広域医療搬送",
	"response.transport.desc": "重傷者の広域医療搬送を開始",
	"response.cabinet": "閣議緊急会合",
	"response.cabinet.desc": "内閣が災害対策のための緊急会合を開催",
	"response.intl": "国際支援要請",
	"response.intl.desc": "政府が国際的な災害支援の要請を検討・判断",

	// Metro labels
	"metro.tokyo": "東京",
	"metro.osaka": "大阪",

	// Layer names (layerRegistry)
	"layer.name.earthquakes": "地震",
	"layer.name.seismicDepth": "3D深度",
	"layer.name.intensity": "震度",
	"layer.name.heatmap": "地震密度",
	"layer.name.faults": "断層",
	"layer.name.ais": "船舶",
	"layer.name.rail": "鉄道",
	"layer.name.airports": "空港",
	"layer.name.transport": "交通拠点",
	"layer.name.power": "電力",
	"layer.name.water": "水道",
	"layer.name.telecom": "通信",
	"layer.name.hospitals": "病院",
	"layer.name.buildings": "建物",
	"layer.name.aftershockCascade": "余震カスケード",

	// Layer gate reasons (layerControl)
	"layer.gate.requiresM5": "M5.0以上が必要",
	"layer.gate.requiresCityZoom": "都市ズームが必要",
	"layer.gate.requiresIntensityGrid": "震度フィールド待ち",
	"layer.gate.unsupportedCity": "検証済みPLATEAUタイルなし",
	"layer.gate.waitingSequence": "波動シーケンス後に利用可",
	"layer.gate.waitingHandoff": "インフラ受け渡し後に利用可",

	// Layer legend labels (layerRegistry)
	"layer.legend.magBelow45": "M < 4.5",
	"layer.legend.mag4550": "M 4.5-5.5",
	"layer.legend.mag5570": "M 5.5-7.0",
	"layer.legend.mag70plus": "M \u2265 7.0",
	"layer.legend.depthShallow": "< 30 km（浅い）",
	"layer.legend.depth3070": "30-70 km",
	"layer.legend.depth70150": "70-150 km",
	"layer.legend.depth150300": "150-300 km",
	"layer.legend.depth300500": "300-500 km",
	"layer.legend.depthDeep": "> 500 km（深い）",
	"layer.legend.heatLow": "低密度",
	"layer.legend.heatModerate": "中密度",
	"layer.legend.heatHigh": "高密度",
	"layer.legend.activeFaultTrace": "活断層線",
	"layer.legend.vessel": "船舶",
	"layer.legend.inImpactZone": "影響圏内",
	"layer.legend.railLine": "鉄道路線",
	"layer.legend.inShakeZone": "震動域内",
	"layer.legend.operational": "運用中",
	"layer.legend.inspectionPosture": "点検態勢",
	"layer.legend.closurePosture": "閉鎖態勢",
	"layer.legend.shinkansenHubs": "新幹線拠点",
	"layer.legend.urbanTransferStress": "都市結節点ストレス",
	"layer.legend.powerFacility": "電力施設",
	"layer.legend.highExposure": "高露出",
	"layer.legend.hospital": "病院",

	// Severity labels
	"severity.critical": "危険",
	"severity.priority": "優先",
	"severity.watch": "注意",
	"severity.clear": "正常",
	"severity.info": "情報",

	// Trust labels
	"trust.confirmed": "確認済み",
	"trust.review": "レビュー",
	"trust.degraded": "劣化",

	// Confidence labels (mission strip)
	"strip.confidence.high": "高",
	"strip.confidence.medium": "中",
	"strip.confidence.low": "低",

	// Freshness source/state labels (mission strip)
	"freshness.source.live": "ライブ",
	"freshness.source.fallback": "フォールバック",
	"freshness.source.cached": "キャッシュ",
	"freshness.state.fresh": "正常",
	"freshness.state.stale": "遅延",
	"freshness.state.degraded": "劣化",

	// Realtime source labels (operatorPulse)
	"realtime.source.server": "サーバー",
	"realtime.source.sse": "SSE",
	"realtime.source.poll": "ポーリング",

	// Performance tone labels (dataTicker)
	"performance.tone.nominal": "正常",
	"performance.tone.watch": "注意",
	"performance.tone.degraded": "劣化",

	// Domain intelligence — 資産別オペレーター指示

	// 病院
	"domain.hospital.patientTransfer": "患者搬送プロトコル起動",
	"domain.hospital.surgeryHalt": "予定手術の中止 — 手術室状況確認",
	"domain.hospital.emergencyPower": "非常用電源確認 — 発電機起動確認",
	"domain.hospital.dmatStandby": "DMAT待機 — 派遣要否判断",
	"domain.hospital.accessRoute": "救急車アクセスルート確認",

	// 原子力発電所
	"domain.nuclear.scramVerify": "原子炉スクラム完了確認",
	"domain.nuclear.spentFuelPool": "使用済燃料プール冷却確認",
	"domain.nuclear.beyondDesignBasis": "設計基準超過 — 緊急時プロトコル発動",
	"domain.nuclear.coolingVerify": "一次冷却系統健全性確認",
	"domain.nuclear.upzNotify": "UPZ 30km圏内自治体への通報",
	"domain.nuclear.nraReport": "原子力規制委員会への報告",

	// ダム
	"domain.dam.downstreamEvac": "下流域避難判断の開始",
	"domain.dam.bodyInspection": "ダム堤体の亀裂・変形点検",
	"domain.dam.spillwayCheck": "洪水吐きゲート動作確認",
	"domain.dam.reservoirLevel": "貯水位・流入量確認",
	"domain.dam.seepageMonitor": "浸透量変化のモニタリング",

	// 変電所
	"domain.power.gridIsolation": "損傷区間の系統切離し",
	"domain.power.transformerInspect": "変圧器ブッシング目視点検",
	"domain.power.loadShedding": "負荷制限プロトコル開始",
	"domain.power.backupActivation": "従属施設の非常用電源起動確認",
	"domain.power.gridMonitor": "系統周波数安定性モニタリング",

	// 鉄道
	"domain.rail.autoStop": "自動停止作動 — 列車位置確認",
	"domain.rail.trackInspection": "軌道点検チーム派遣",
	"domain.rail.passengerEvac": "滞留旅客の避難判断",
	"domain.rail.serviceResume": "運転再開条件の評価",
	"domain.rail.statusMonitor": "路線状況アップデート監視",

	// 空港
	"domain.airport.closure": "空港閉鎖 — 全運航停止",
	"domain.airport.runwayInspect": "滑走路FODウォークダウン点検",
	"domain.airport.terminalCheck": "ターミナル構造安全性評価",
	"domain.airport.notam": "NOTAM発行 — 滑走路状況",
	"domain.airport.diversionPlan": "ダイバート調整",

	// 港湾
	"domain.port.closure": "港湾閉鎖 — 船舶移動停止",
	"domain.port.quayInspect": "岸壁沈下・亀裂点検",
	"domain.port.liquefactionCheck": "埋立地区の液状化評価",
	"domain.port.cargoDiversion": "代替港への貨物転送調整",
	"domain.port.tsunamiPrep": "津波準備 — 船舶沖出し",

	// 上水道施設
	"domain.water.shutoff": "緊急遮断 — 損傷区間切離し",
	"domain.water.pipelineCheck": "幹線管路圧力テスト",
	"domain.water.turbidityMonitor": "浄水濁度レベル監視",
	"domain.water.truckDispatch": "緊急給水車配備",
	"domain.water.pressureMonitor": "配水圧力モニタリング",

	// 通信ハブ
	"domain.telecom.mobileBts": "移動基地局展開",
	"domain.telecom.equipmentCheck": "機器ラック点検",
	"domain.telecom.batteryVerify": "バッテリー残容量確認",
	"domain.telecom.disasterBoard": "災害用伝言板起動",
	"domain.telecom.trafficMonitor": "残存回線トラフィック監視",

	// 防災拠点
	"domain.eoc.hqActivation": "災害対策本部設置（レベル3）",
	"domain.eoc.alertMode": "警戒態勢発令（レベル2）",
	"domain.eoc.infoGathering": "情報収集体制（レベル1）",
	"domain.eoc.alternateActivate": "代替拠点起動",
	"domain.eoc.commsCheck": "防災通信回線確認",

	// 避難所
	"domain.evac.doNotOpen": "開設禁止 — 構造被害の疑い",
	"domain.evac.safetyCheck": "開設前安全点検",
	"domain.evac.limitedCapacity": "制限付き開設",
	"domain.evac.prepareOpen": "開設準備 — 物資配備",
	"domain.evac.standbyReady": "待機 — 開設可能状態",

	// LNG基地
	"domain.lng.emergencyShutdown": "緊急停止 — 全系統隔離",
	"domain.lng.pipelineIsolate": "ブロックバルブでのガス管隔離",
	"domain.lng.fireWatch": "消防警戒範囲設定",
	"domain.lng.gasDetection": "ガス漏洩検知チーム展開",
	"domain.lng.supplyAssess": "ガス供給継続性評価",

	// 建物群
	"domain.building.rescueStandby": "救助チーム待機 — 崩壊リスク",
	"domain.building.entryRestrict": "入館制限 — 被害評価待ち",
	"domain.building.rapidAssessment": "応急危険度判定チーム派遣",
	"domain.building.glassHazard": "ガラス・外壁落下危険区域封鎖",
	"domain.building.inspectionTeam": "構造点検チーム手配",

	// ドメインメトリクス
	"domain.metric.posture": "態勢",
	"domain.metric.scram": "スクラム",
	"domain.metric.pga": "最大加速度",
	"domain.metric.downstreamRisk": "下流リスク",
	"domain.metric.outageRisk": "停電リスク",
	"domain.metric.stopType": "停止種別",
	"domain.metric.inspectionEst": "点検見込み",
	"domain.metric.portStatus": "港湾状態",
	"domain.metric.serviceStatus": "サービス",
	"domain.metric.commsStatus": "通信状態",
	"domain.metric.backupHours": "予備電源",
	"domain.metric.activationLevel": "発動レベル",
	"domain.metric.usability": "使用可否",
	"domain.metric.containment": "封じ込め",
	"domain.metric.damageLevel": "被害度",

	// メトリクス値
	"domain.value.operational": "運用中",
	"domain.value.disrupted": "機能低下",
	"domain.value.compromised": "機能喪失",
	"domain.value.degraded": "一部損傷",
	"domain.value.likely": "高い",
	"domain.value.possible": "可能性あり",
	"domain.value.unlikely": "低い",
	"domain.value.evacuation": "避難",
	"domain.value.alert": "警戒",
	"domain.value.monitoring": "監視",
	"domain.value.blackout": "停電",
	"domain.value.partial": "一部停電",
	"domain.value.stable": "安定",
	"domain.value.auto": "自動",
	"domain.value.manual": "手動",
	"domain.value.normal": "通常",
	"domain.value.closed": "閉鎖",
	"domain.value.restricted": "制限中",
	"domain.value.outage": "断水",
	"domain.value.down": "停止",
	"domain.value.standby": "待機",
	"domain.value.l1": "L1 — 情報収集",
	"domain.value.l2": "L2 — 警戒態勢",
	"domain.value.l3": "L3 — 本部設置",
	"domain.value.unsafe": "使用不可",
	"domain.value.inspectFirst": "点検後使用",
	"domain.value.limited": "制限使用",
	"domain.value.ready": "使用可",
	"domain.value.emergency": "緊急",
	"domain.value.isolated": "隔離",
	"domain.value.severe": "甚大",
	"domain.value.significant": "大規模",
	"domain.value.moderate": "中程度",
	"domain.value.minor": "軽微",

	// 最寄代替施設
	"domain.nearestAlt": "最寄りの運用施設",
	"domain.nearestAlt.none": "代替施設なし",
	"domain.bearing.N": "北",
	"domain.bearing.NE": "北東",
	"domain.bearing.E": "東",
	"domain.bearing.SE": "南東",
	"domain.bearing.S": "南",
	"domain.bearing.SW": "南西",
	"domain.bearing.W": "西",
	"domain.bearing.NW": "北西",

	// Mobile Tab Bar
	"tab.map": "地図",
	"tab.feed": "フィード",
	"tab.layers": "レイヤー",
	"tab.info": "情報",
};

export default ja;
