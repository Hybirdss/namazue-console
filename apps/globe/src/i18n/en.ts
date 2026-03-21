/**
 * Namazue — English locale strings
 */

const en: Record<string, string> = {
	// Sidebar
	"sidebar.title": "Seismic Monitor",
	"sidebar.totalQuakes": "Total Quakes",
	"sidebar.maxMag": "Max Mag",
	"sidebar.avgMag": "Avg Mag",
	"sidebar.latest": "Latest",
	"sidebar.magDistribution": "Magnitude Distribution",

	// Detail panel / Tooltip shared labels
	"detail.time": "Time",
	"detail.location": "Location",
	"detail.depth": "Depth",
	"detail.faultType": "Fault Type",
	"detail.jmaIntensity": "JMA Intensity",
	"detail.tsunami": "Tsunami",

	// Timeline
	"timeline.play": "Play",
	"timeline.pause": "Pause",
	"timeline.prev": "Previous event",
	"timeline.next": "Next event",
	"timeline.scrub": "Timeline scrubber",

	// Intensity legend
	"legend.title": "JMA Intensity",
	"legend.violent": "Violent",
	"legend.severe": "Severe",
	"legend.strongPlus": "Very Strong",
	"legend.veryStrong": "Strong",
	"legend.ratherStrong": "Rather Strong",
	"legend.strong": "Moderately Strong",
	"legend.moderate": "Moderate",
	"legend.weak": "Weak",
	"legend.slight": "Slight",
	"legend.notFelt": "Not Felt",

	// Asset legend
	"legend.asset.nuclear": "Nuclear",
	"legend.asset.airport": "Airport",
	"legend.asset.port": "Port",
	"legend.asset.hospital": "Hospital",
	"legend.asset.rail": "Rail Hub",
	"legend.asset.power": "Power",
	"legend.asset.water": "Water",
	"legend.asset.dam": "Dam",
	"legend.asset.lng": "LNG",
	"legend.asset.eoc": "Gov EOC",
	"legend.asset.telecom": "Telecom",
	"legend.asset.evacuation": "Evacuation",
	"legend.asset.building": "Buildings",

	// Scenario picker
	"scenario.title": "Training Scenarios",

	// HUD overlay
	"hud.cam": "CAM",
	"hud.time": "TIME",
	"hud.zoom": "ZOOM",

	// Mode switcher
	"mode.realtime": "REALTIME",
	"mode.timeline": "ARCHIVE",
	"mode.scenario": "TRAINING",
	"mode.load": "Load",
	"mode.from": "From",
	"mode.to": "To",
	"mode.start": "Start Date",
	"mode.end": "End Date",
	"mode.error.required": "Select both start and end dates.",
	"mode.error.invalidDate": "Invalid date format.",
	"mode.error.order": "Start date must be before end date.",
	"mode.error.rangeTooLong": "Range must be 366 days or less.",

	// Layer toggles
	"layer.title": "Layers",
	"layer.plates": "Plates",
	"layer.quakes": "Quakes",
	"layer.waves": "Waves",
	"layer.contours": "Contours",
	"layer.shakeMap": "ShakeMap",
	"layer.slab2": "Slab2",
	"layer.labels": "Labels",

	// GSI overlay layers
	"layer.gsiFaults": "Active Faults",
	"layer.gsiRelief": "Elevation",
	"layer.gsiSlope": "Slope",
	"layer.gsiPale": "Pale Map",
	"layer.adminBoundary": "Boundaries",
	"layer.jshisHazard": "Seismic Hazard",
	"layer.gsiBaseGroup": "Base Map",
	"layer.gsiOverlayGroup": "Overlay",

	// Data integration layers
	"layer.activeFaults": "Fault Lines",
	"layer.hazardComparison": "J-SHIS Compare",
	"layer.landslideRisk": "Landslide Risk",

	// Impact panel
	"impact.title": "AFFECTED AREAS",
	"impact.totalExposed": "Total exposed",

	// Alert bar
	"alert.prefix": "EARTHQUAKE ALERT",

	// Tsunami
	"tsunami.warning": "WARNING",
	"tsunami.risk.high": "Tsunami Warning — Evacuate to high ground immediately",
	"tsunami.risk.moderate": "Tsunami Advisory — Stay away from the coast",
	"tsunami.risk.low":
		"Tsunami unlikely, but stay alert for official advisories",
	"tsunami.risk.none":
		"Tsunami risk is currently low, but keep watching official updates",
	"tsunami.label.high": "TSUNAMI WARNING",
	"tsunami.label.moderate": "TSUNAMI ADVISORY",
	"tsunami.label.low": "Stay alert",
	"tsunami.label.none": "Low tsunami concern",

	// Fault types
	"faultType.crustal": "Crustal",
	"faultType.interface": "Interface",
	"faultType.intraslab": "Intraslab",

	// Sidebar extras
	"sidebar.eventCount": "events / 7d",
	"sidebar.eventCount.one": "event / 7d",
	"sidebar.scenarios": "Scenarios",
	"sidebar.training": "Training",
	"sidebar.alert": "M5+ ALERT",
	"sidebar.empty": "No M2.5+ earthquakes in the past 7 days",
	"sidebar.loading": "Fetching earthquake data…",
	"sidebar.lastUpdated": "Updated",
	"sidebar.justNow": "just now",
	"sidebar.agoMin": "min ago",
	"sidebar.offline": "Connection lost — retrying",

	// Relative time
	"time.justNow": "just now",
	"time.minAgo": " min ago",
	"time.hrAgo": " hr ago",
	"time.dayAgo": " days ago",
	"time.monthAgo": " mo ago",
	"time.yearAgo": " yr ",
	"sidebar.mmiTitle": "MODIFIED MERCALLI INTENSITY",
	"sidebar.source.shakemap": "ShakeMap",
	"sidebar.source.gmpe": "GMPE",

	// Detail panel — intensity source
	"detail.intensitySource": "Intensity Source",
	"detail.source.shakemap": "USGS ShakeMap",
	"detail.source.gmpe": "Estimated (GMPE)",
	"detail.crossSection": "Cross-Section",

	// PLATEAU 3D Buildings
	"layer.plateau": "3D Buildings",
	"plateau.none": "None",
	"plateau.chiyoda": "Chiyoda",
	"plateau.chuo": "Chuo",
	"plateau.minato": "Minato",
	"plateau.shinjuku": "Shinjuku",
	"plateau.shibuya": "Shibuya",
	"plateau.yokohama": "Yokohama",
	"plateau.kawasaki": "Kawasaki",
	"plateau.saitama": "Saitama",
	"plateau.chiba": "Chiba",
	"plateau.utsunomiya": "Utsunomiya",
	"plateau.maebashi": "Maebashi",
	"plateau.kofu": "Kofu",
	"plateau.osaka": "Osaka",
	"plateau.kyoto": "Kyoto",
	"plateau.kobe": "Kobe",
	"plateau.wakayama": "Wakayama",
	"plateau.nagoya": "Nagoya",
	"plateau.shizuoka": "Shizuoka",
	"plateau.hamamatsu": "Hamamatsu",
	"plateau.niigata": "Niigata",
	"plateau.kanazawa": "Kanazawa",
	"plateau.gifu": "Gifu",
	"plateau.sapporo": "Sapporo",
	"plateau.sendai": "Sendai",
	"plateau.fukushima": "Fukushima",
	"plateau.hiroshima": "Hiroshima",
	"plateau.okayama": "Okayama",
	"plateau.takamatsu": "Takamatsu",
	"plateau.tottori": "Tottori",
	"plateau.tokushima": "Tokushima",
	"plateau.matsuyama": "Matsuyama",
	"plateau.kochi": "Kochi",
	"plateau.fukuoka": "Fukuoka",
	"plateau.kitakyushu": "Kitakyushu",
	"plateau.kumamoto": "Kumamoto",
	"plateau.naha": "Naha",
	"plateau.loading": "Loading buildings...",

	// Detail panel — MMI descriptions
	"mmi.destructive": "Destructive",
	"mmi.strong": "Strong",
	"mmi.moderate": "Moderate",
	"mmi.weak": "Weak",

	// AI Panel
	"ai.tab.easy": "Briefing",
	"ai.tab.expert": "Analysis",
	"ai.tab.data": "Evidence",
	"ai.why": "Why did it happen?",
	"ai.aftershock": "Aftershock probability",
	"ai.intensity": "Intensity",
	"ai.intensityGuide": "Intensity guide",
	"ai.actions": "What to do now",
	"ai.tsunami": "Tsunami risk",
	"ai.eli5": "Simple explanation",
	"ai.expert.tectonic": "Tectonic context",
	"ai.expert.mechanism": "Fault mechanism",
	"ai.expert.sequence": "Sequence classification",
	"ai.expert.historical": "Historical comparison",
	"ai.expert.aftershock": "Aftershock assessment",
	"ai.expert.gap": "Seismic gap",
	"ai.expert.notable": "Notable features",
	"ai.expert.depth": "Depth analysis",
	"ai.expert.coulomb": "Coulomb stress",
	"ai.expert.modelNotes": "Model notes",
	"ai.expert.interpretations": "Key interpretations",
	"ai.data.download": "Download JSON",
	"ai.data.intensity": "Intensity",
	"ai.data.cities": "Cities",
	"ai.data.population": "Population",
	"ai.data.tags": "Search tags",
	"ai.button": "AI Brief",
	"ai.badge.loading": "AI analyzing...",
	"ai.badge.ready": "AI brief ready",
	"ai.loading": "Analyzing...",
	"ai.panelLabel": "AI analysis panel",
	"ai.close": "Close AI panel",
	"ai.disclaimer":
		"Beta analysis. Errors, omissions, or delays may exist. Verify official releases and primary sources before making important decisions.",
	"disclaimer.beta.short":
		"Beta information. Errors, omissions, or delays may exist. Verify official releases and primary sources before making important decisions.",
	"ai.urgency.immediate": "NOW",
	"ai.urgency.within_hours": "SOON",
	"ai.urgency.preparedness": "PREP",
	"ai.noPublic": "No public analysis available",
	"ai.noExpert": "No expert analysis available",

	// Search
	"search.placeholder": "M6 Tokyo / deep M7+ / last 30 days...",
	"search.hint": "Enter to search · ESC to close",
	"search.loading": "Searching...",
	"search.noResults": "No results found",
	"search.dialogLabel": "Earthquake search",
	"search.inputLabel": "Search earthquakes",
	"search.resultsLabel": "Search results",
	"search.stats.countSuffix": " events",
	"search.stats.avgPrefix": "Avg",
	"search.stats.offshoreSuffix": " offshore",
	"search.stats.inlandSuffix": " inland",
	"search.quickFilters": "Quick filters",
	"search.examples": "Search examples",
	"search.chip.recent": "Last 24h",
	"search.chip.tsunami": "Tsunami",
	"search.chip.tohoku": "Tohoku",
	"search.chip.nankai": "Nankai",
	"search.chip.kanto": "Kanto",
	"search.chip.deep": "Deep quakes",
	"ai.ask.placeholder": "Ask about this earthquake...",
	"ai.ask.submit": "Ask",
	"ai.ask.thinking": "Generating answer...",
	"ai.ask.error": "Failed to generate answer",
	"ai.ask.examples": "Example questions",
	"ai.ask.ex1": "Is this related to the Nankai Trough?",
	"ai.ask.ex2": "How long will aftershocks continue?",
	"ai.ask.ex3": "Is there a tsunami risk?",

	// Locale switcher
	"locale.en": "EN",
	"locale.ko": "\ud55c",
	"locale.ja": "\u65e5",

	// Left Panel Tabs
	"panel.tab.live": "LIVE",
	"panel.tab.archive": "ARCHIVE",
	"panel.tab.ask": "Ask",
	"search.inlineHint": "Search earthquakes (mag, region, period)",

	// Ask Panel
	"ask.welcome.title": "Namazue AI",
	"ask.welcome.desc":
		"Ask about earthquakes, search the database, or request analysis. AI will search and visualize results on the globe.",
	"ask.suggest.recent": "Recent M6+ earthquakes?",
	"ask.suggest.compare": "Compare Tohoku and Kanto quakes",
	"ask.suggest.region": "Western offshore seismicity trend",
	"ask.suggest.analysis": "Analyze the latest major event",
	"ask.input.placeholder": "Ask about earthquakes...",
	"ask.input.label": "Ask input",
	"ask.input.send": "Send",

	// Navigation
	"nav.returnToJapan": "Return to Japan",

	// Mobile shell
	"mobile.tab.map": "Map",
	"mobile.tab.live": "Live",
	"mobile.nav.label": "Mobile navigation",

	// Mobile sheet
	"sheet.events": "{n} events",
	"sheet.noSelection": "Tap an earthquake",
	"sheet.recentTitle": "Recent Quakes",
	"sheet.countSuffix": " events",

	// Operator Pulse
	"panel.operatorPulse.title": "Operator Pulse",
	"panel.operatorPulse.realtime": "Realtime",
	"panel.operatorPulse.performance": "Performance",
	"panel.operatorPulse.bundle": "Bundle",
	"panel.operatorPulse.scenario": "Scenario",
	"panel.operatorPulse.freshness": "Freshness",
	"panel.operatorPulse.ago": "ago",
	"panel.operatorPulse.scenario.on": "ON",
	"panel.operatorPulse.scenario.off": "OFF",
	"panel.operatorPulse.realtime.fresh": "Fresh",
	"panel.operatorPulse.realtime.stale": "Stale",
	"panel.operatorPulse.realtime.degraded": "Degraded",
	"panel.operatorPulse.tone.nominal": "Nominal",
	"panel.operatorPulse.tone.watch": "Watch",
	"panel.operatorPulse.tone.degraded": "Degraded",
	"panel.operatorPulse.bundle.seismic": "Seismic",
	"panel.operatorPulse.bundle.maritime": "Maritime",
	"panel.operatorPulse.bundle.lifelines": "Lifelines",
	"panel.operatorPulse.bundle.medical": "Medical",
	"panel.operatorPulse.bundle.builtEnvironment": "Built Environment",

	// Sector Stress
	"panel.sectorStress.title": "Sector Stress Board",
	"panel.sectorStress.allClear": "All assets clear",
	"panel.sectorStress.affected": "affected",
	"panel.sectorStress.maritime": "Maritime",
	"panel.sectorStress.inZone": "in zone",
	"panel.sectorStress.stable": "stable",
	"panel.sectorStress.tracked": "tracked",

	// Impact Intelligence
	"panel.impactIntel.title": "Impact Intelligence",
	"panel.impactIntel.peakIntensity": "Peak Estimated Intensity",
	"panel.impactIntel.peakIntensityLand": "Peak Intensity (on land)",
	"panel.impactIntel.epicentral": "At epicenter:",
	"panel.impactIntel.peakIntensityApprox": "Peak Estimated Intensity (approx.)",
	"panel.impactIntel.selectEvent": "Select event for analysis",
	"panel.impactIntel.populationExposure": "Population Exposure",
	"panel.impactIntel.intensityCoverage": "Intensity Coverage",
	"panel.impactIntel.tsunamiETA": "Tsunami Arrival Estimates",
	"panel.impactIntel.responseProtocol": "Response Protocol",
	"panel.impactIntel.consequenceMatrix": "Consequence Matrix",
	"panel.impactIntel.hospitalsCompromised": "hospitals compromised",
	"panel.impactIntel.hospitalsDisrupted": "hospitals disrupted",
	"panel.impactIntel.dmatDeployable": "DMAT bases deployable",
	"panel.impactIntel.nuclearScramLikely": "nuclear scram likely",
	"panel.impactIntel.nuclearScramPossible": "nuclear scram possible",
	"panel.impactIntel.railSuspended": "rail lines suspended",
	"panel.impactIntel.railAffected": "rail lines affected",
	"panel.impactIntel.vesselsHigh": "vessels high priority",
	"panel.impactIntel.vesselsInZone": "vessels in zone",
	"panel.impactIntel.domainActions": "Immediate Actions Required",

	// Threat Board
	"panel.threatBoard.title": "Threat Board",
	"panel.threatBoard.nominal": "No elevated threats. Posture nominal.",

	// Check These Now
	"panel.checkNow.title": "Check These Now",

	// Shell
	"shell.initializing": "Initializing",

	// Event Snapshot
	"snapshot.situation": "Situation",
	"snapshot.monitoring": "Monitoring active",
	"snapshot.dataPending": "Data pending",
	"snapshot.dataLive": "Data live",
	"snapshot.elapsed": "Elapsed",
	"snapshot.localTime": "Local Time",
	"snapshot.eventTruth": "Event Truth",
	"snapshot.scenario": "Scenario",
	"snapshot.depth": "{n}km deep",
	"snapshot.deselect": "Deselect (Esc)",
	"snapshot.simulationLabel": "SIMULATION",
	"snapshot.scenarioDisclaimer": "Beta simulation · Not a real earthquake",
	"snapshot.scenarioWarning":
		"Verify official releases before making response decisions",
	"snapshot.probability30yr": "30-year probability",
	"snapshot.recurrence": "Recurrence interval",
	"snapshot.truth": "{source} truth · {confidence} confidence",
	"snapshot.revisions": "{n} revisions",
	"snapshot.materialDivergence": "Material divergence",
	"snapshot.conflictDetected": "Conflict detected",
	"snapshot.health.degraded": "DEGRADED",
	"snapshot.health.watch": "WATCH",
	"snapshot.health.nominal": "NOMINAL",

	// Recent Feed
	"feed.title": "Recent Activity",
	"feed.depth.shallow": "shallow",
	"feed.depth.deep": "deep",
	"feed.noEvents": "No events in range",
	"feed.moreNotShown": "{n} more not shown",
	"feed.from": "From",
	"feed.to": "To",
	"feed.maxYear": "Max 1 year",
	"feed.apply": "Apply",
	"feed.clear": "Clear",
	"feed.invalidRange": "Invalid range",
	"feed.tsunami": "Tsunami",

	// System Bar / Mission Strip
	"sysbar.japan": "Japan",
	"sysbar.eventActive": "Event active",
	"sysbar.systemCalm": "System calm",
	"sysbar.events": "{n} events",

	// Data Ticker
	"ticker.vessels": "AIS {n} vessels tracking",
	"ticker.monitoring": "Monitoring active",

	// Bundle / Layer Control
	"bundle.operatorView": "Operator View",
	"bundle.density": "Density",
	"bundle.density.minimal": "Minimal",
	"bundle.density.standard": "Standard",
	"bundle.density.dense": "Dense",
	"bundle.enabled": "Enabled",
	"bundle.disabled": "Disabled",
	"bundle.activeSummary": "Active Summary",
	"bundle.domainBreakdown": "Domain Breakdown",
	"bundle.layers": "Layers",
	"bundle.planned": "Planned",
	"bundle.visibleInView": "Visible in view",
	"bundle.hiddenInView": "Hidden in view",
	"bundle.soon": "Soon",
	"bundle.on": "On",
	"bundle.off": "Off",
	"bundle.legend": "Legend",
	"bundle.scenario": "Scenario",
	"bundle.hideControls": "Hide Controls",
	"bundle.showControls": "Bundle Controls",
	"bundle.live": "Live",
	"bundle.modeled": "Modeled",
	"bundle.syncing": "Bundle truth syncing",
	"bundle.awaiting": "Awaiting initial backend summary.",

	// Asset Exposure (remaining)
	"exposure.shipType.passenger": "Passenger",
	"exposure.shipType.tanker": "Tanker",
	"exposure.shipType.cargo": "Cargo",
	"exposure.shipType.fishing": "Fishing",
	"exposure.critical": "critical",
	"exposure.priority": "priority",
	"exposure.watch": "watch",

	// Impact Intelligence (remaining)
	"impact.jmaPrefix": "Intensity ",
	"impact.above": " or above",
	"impact.populationMan": "{n}",
	"impact.populationNin": "{n}",
	"impact.approx": "~",
	"impact.dataSource":
		"MIC Resident Registry (2025-01-01) · {n} administrative units",

	// Command Palette
	"palette.searchPlaceholder": "Search locations, bundles, layers, events…",
	"palette.noResults": "No results",
	"palette.hintDefault":
		"Type to search locations, bundles, views, layers, events…",
	"palette.visible": "Currently visible",
	"palette.hidden": "Currently hidden",
	"palette.toggleScenario": "Toggle Scenario Mode",
	"palette.togglePanels": "Toggle Panels",
	"palette.toggleDrawer": "Toggle Bundle Drawer",
	"palette.deselectEvent": "Deselect Event",
	"locationSafety.title": "Location safety",
	"locationSafety.tone.safe": "Safe",
	"locationSafety.tone.caution": "Caution",
	"locationSafety.tone.danger": "Danger",
	"locationSafety.summary.safe":
		"No immediate elevated shaking signal at this place.",
	"locationSafety.summary.selectedCaution":
		"The current selected event may be felt here. Monitor updates.",
	"locationSafety.summary.nearbyCaution":
		"Recent nearby activity warrants a closer look.",
	"locationSafety.summary.selectedDanger":
		"Active shaking posture at this place warrants attention now.",
	"locationSafety.summary.nearbyDanger":
		"Recent nearby shaking warrants attention now.",
	"locationSafety.population": "Population {count}",
	"locationSafety.selectedEventTitle": "Current selected event",
	"locationSafety.nearbyTitle": "24h nearby activity",
	"locationSafety.close": "Close location safety card",
	"locationSafety.noSelectedEvent": "No selected event",
	"locationSafety.noNearby24h": "No nearby events in the last 24 hours",
	"locationSafety.events24h": "{count} events",
	"locationSafety.na": "N/A",
	"mapSearch.label": "Search Japanese municipalities",
	"mapSearch.placeholder": "Search Japan cities, wards, municipalities…",
	"mapSearch.clearQuery": "Clear search query",
	"mapSearch.noResults": "No matching places",

	// Shell (dynamic)
	"shell.scenarioBannerText": "BETA SIMULATION — NOT A REAL EARTHQUAKE",
	"shell.scenarioBannerSub":
		"Verify official releases before making response decisions",
	"shell.scenarioBadge": "SCENARIO",

	// Settings Panel
	"settings.title": "Settings",
	"settings.tab.general": "General",
	"settings.tab.methodology": "Methodology",
	"settings.notifications": "Notifications",
	"settings.eventAlerts": "Event Alerts",
	"settings.minMagnitude": "Min Magnitude",
	"settings.alertSound": "Alert Sound",
	"settings.soundHint": "M4.5+ watch · M5.5+ attention · M6.5+ urgent",
	"settings.keyboard": "Keyboard",
	"settings.shortcutsEnabled": "Shortcuts Enabled",
	"settings.display": "Display",
	"settings.showCoordinates": "Show Coordinates",
	"settings.resetDefaults": "Reset to Defaults",
	"settings.on": "ON",
	"settings.off": "OFF",
	"settings.methodology.desc":
		"Namazue Engine is built on the following academic models and public references.",
	"settings.methodology.betaNotice":
		"Namazue is still in beta. Displayed information may contain errors, omissions, interpretation gaps, or update delays. Do not rely on this console alone for critical decisions; verify official releases and primary sources first.",
	"settings.methodology.lastAudited": "Last audited: 2026-03-07",
	"settings.methodology.referenceHeader": "Master Reference List",
	"settings.methodology.academic": "Academic Models",
	"settings.methodology.public": "Government and Public Sources",

	// Shortcuts (shared: settings + keyboard help)
	"shortcuts.navigation": "Navigation",
	"shortcuts.controls": "Controls",
	"shortcuts.information": "Information",
	"shortcuts.commandPalette": "Command palette",
	"shortcuts.switchBundle": "Switch bundle",
	"shortcuts.nextPrevEvent": "Next / previous event",
	"shortcuts.closeOverlay": "Close overlay / deselect",
	"shortcuts.toggleScenario": "Toggle scenario mode",
	"shortcuts.toggleDrawer": "Toggle bundle drawer",
	"shortcuts.togglePanels": "Toggle panels",
	"shortcuts.toggleFaults": "Toggle faults layer",
	"shortcuts.resetView": "Japan overview",
	"shortcuts.openSettings": "Open settings",
	"shortcuts.showHelp": "Show this help",
	"help.title": "Keyboard Shortcuts",

	// Mission Strip
	"strip.view": "View",
	"strip.bundle": "Bundle",
	"strip.density": "Density",
	"strip.freshness": "Freshness",
	"strip.trust": "Trust",
	"strip.divergence": "DIVERGENCE",
	"strip.conflict": "CONFLICT",
	"strip.lowConf": "LOW CONF",
	"strip.degraded": "DEGRADED",
	"strip.watch": "WATCH",
	"strip.nominal": "NOMINAL",

	// Command Deck
	"deck.timeline": "Timeline",
	"deck.event": "EVENT",
	"deck.live": "LIVE",
	"deck.view": "View",
	"deck.bundle": "Bundle",
	"deck.density": "Density",

	// Command Palette categories
	"palette.category.location": "Location",
	"palette.category.bundle": "Bundle",
	"palette.category.view": "View",
	"palette.category.layer": "Layer",
	"palette.category.action": "Action",
	"palette.category.event": "Event",

	// Recent Feed (compact time)
	"feed.timeNow": "now",
	"feed.timeMin": "{n}m",
	"feed.timeHr": "{n}h",
	"feed.timeDay": "{n}d",
	"feed.timeMonth": "{n}mo",
	"feed.timeYear": "{n}yr",
	"feed.timeYearMonth": "{y}yr {m}mo",
	"feed.daysSelected": "{n}d selected",
	"feed.rangeTooLong": "{n}d exceeds 365d max",

	// Notifications
	"notif.detected": "M{mag} detected",

	// Data Ticker
	"ticker.unknown": "Unknown",

	// Exposure damage reasons (from fragility curves)
	"exposure.reason.belowThreshold": "below operational threshold",
	"exposure.reason.structuralFailure": "structural failure risk",
	"exposure.reason.significantDamage": "significant damage likely",
	"exposure.reason.moderateDamage": "moderate damage risk",
	"exposure.reason.highDisruption": "high disruption probability",
	"exposure.reason.elevatedDisruption": "elevated disruption risk",
	"exposure.reason.tsunamiPosture": "tsunami posture {risk}",
	"exposure.reason.lifelineCascade":
		"lifeline cascade — upstream utility disruption elevates risk",

	// Operational concerns (from assetClassRegistry)
	"exposure.concern.quayInspection": "quay wall / crane inspection required",
	"exposure.concern.liquefactionRisk": "liquefaction risk assessment needed",
	"exposure.concern.trackInspection": "track inspection priority",
	"exposure.concern.hubInspection": "hub structural inspection required",
	"exposure.concern.accessRouteSensitivity": "access route sensitivity",
	"exposure.concern.nonStructuralDamage": "non-structural damage assessment",
	"exposure.concern.gridStability": "grid stability risk",
	"exposure.concern.transformerInspection": "transformer bushing inspection",
	"exposure.concern.serviceContinuity": "service continuity risk",
	"exposure.concern.pipelineIntegrity": "pipeline network integrity check",
	"exposure.concern.commsContinuity": "communications continuity risk",
	"exposure.concern.equipmentRack": "equipment rack inspection",
	"exposure.concern.urbanInspection": "urban structure inspection",
	"exposure.concern.glassFacade": "glass/facade hazard assessment",
	"exposure.concern.reactorScram": "automatic reactor scram threshold",
	"exposure.concern.spentFuel": "spent fuel pool inspection required",
	"exposure.concern.beyondDesignBasis": "beyond-design-basis event assessment",
	"exposure.concern.runwayInspection": "runway inspection required",
	"exposure.concern.terminalAssessment": "terminal structural assessment",
	"exposure.concern.damBodyInspection": "dam body inspection required",
	"exposure.concern.downstreamEvacuation": "downstream evacuation assessment",
	"exposure.concern.fireExplosionRisk": "fire/explosion risk assessment",
	"exposure.concern.pipelineIsolation": "pipeline isolation protocol",
	"exposure.concern.coordinationCapacity": "coordination capacity at risk",
	"exposure.concern.shelterAssessment": "shelter structural assessment needed",

	// Damage probability display
	"exposure.prob.disruption": "Disruption probability",
	"exposure.prob.damage": "Damage probability",
	"exposure.prob.collapse": "Collapse probability",
	"exposure.prob.overall": "Overall risk score",
	"exposure.summary": "{name} is in {severity} posture.",

	// Priority rationale
	"priority.rationale":
		"{region} {classLabel} posture is {severity} because {reasons}.",

	// Bootstrap loading
	"boot.buildingConsole": "Building console\u2026",
	"boot.initMap": "Initializing map\u2026",
	"boot.mountingPanels": "Mounting panels\u2026",
	"boot.loadingFaults": "Loading fault data\u2026",
	"boot.fetchingEvents": "Fetching events\u2026",
	"boot.mapReady": "Map ready\u2026",
	"boot.eventsLoaded": "{n} events loaded",
	"boot.ready": "Ready",
	"boot.failure.mapTitle": "Unable to start the map",
	"boot.failure.mapDetail":
		"WebGL could not be initialized for the console. Check browser graphics settings or strict blocking policies, then refresh or try another browser.",
	"boot.failure.genericTitle": "Unable to start Namazue",
	"boot.failure.genericDetail":
		"Startup failed before the console became interactive. Refresh the page and try again.",
	"boot.failure.retry": "Reload",

	// Temporal Slider
	"temporal.catalog": "Catalog",
	"temporal.playAnimation": "Play animation",
	"temporal.exit": "EXIT",
	"temporal.live": "\u25cf LIVE",
	"temporal.events": "{n} events",
	"timeline.sequence.mode.live": "LIVE",
	"timeline.sequence.mode.replay": "REPLAY",
	"timeline.sequence.mode.preview": "PREVIEW",
	"timeline.sequence.phase.idle": "Idle",
	"timeline.sequence.phase.epicenter-flash": "Epicenter flash",
	"timeline.sequence.phase.p-wave": "P-wave propagation",
	"timeline.sequence.phase.s-wave": "S-wave propagation",
	"timeline.sequence.phase.intensity-reveal": "Intensity reveal",
	"timeline.sequence.phase.infrastructure-handoff": "Infrastructure handoff",
	"timeline.sequence.phase.aftershock-cascade": "Aftershock cascade",
	"timeline.sequence.phase.settled": "Settled",
	"timeline.sequence.boundary.replay": "Visuals only",
	"timeline.sequence.boundary.preview": "Synthetic preview",

	// Fault Catalog
	"fault.title": "HERP Fault Scenarios",
	"fault.hint": "Click to run scenario",
	"fault.type.interface": "Trench type",
	"fault.type.intraslab": "Intraslab",
	"fault.type.crustal": "Active fault",

	// Maritime Exposure
	"maritime.exposureTitle": "Maritime Exposure",
	"maritime.totalTracked": "{n} vessels tracked total",
	"maritime.highPriority": "HIGH PRIORITY",
	"maritime.hazmat": "HAZMAT",

	// Check These Now
	"check.trust": "Trust",

	// Depth Cross-Section
	"depth.title": "DEPTH CROSS-SECTION",
	"depth.subtitle": "Longitude vs. Depth \u2014 Japan Trench to Western Coast",
	"depth.close": "Close (X)",
	"depth.depthLabel": "Depth: {n} km",
	"depth.button": "DEPTH",
	"depth.toggle": "Depth Cross-Section (X)",

	// Decision Matrix
	"matrix.peakIntensity": "Peak Intensity",
	"matrix.population": "Population",
	"matrix.noCityDetail": "No city-level exposure detail",
	"matrix.infrastructure": "Infrastructure",
	"matrix.hospitalRail": "{hospitals} hospital / {rail} rail",
	"matrix.tsunamiETA": "Tsunami ETA",

	// Wave Handoff
	"wave.standby": "Wave standby",
	"wave.reached": "S-wave reached {n} km",
	"wave.front": "S-wave front {n} km",

	// Settings
	"settings.tooltip": "Settings (,)",
	"home.tooltip": "Japan overview (H)",

	// Regions
	"region.japan": "Japan",
	"region.hokkaido": "Hokkaido",
	"region.tohoku": "Tohoku",
	"region.kanto": "Kanto",
	"region.chubu": "Chubu",
	"region.kansai": "Kansai",
	"region.chugoku": "Chugoku",
	"region.shikoku": "Shikoku",
	"region.kyushu": "Kyushu",

	// Intensity source (Impact Intelligence)
	"intel.source.jmaObserved": "JMA Observed",
	"intel.source.gmpeEstimate": "GMPE Estimate",
	"intel.source.gmpeEstimateFull": "GMPE Estimate (Si & Midorikawa 1999)",
	"intel.source.gmpeLabel": "GMPE est:",

	// Scenario disclaimer
	"scenario.disclaimer.title": "Scenario Mode",
	"scenario.disclaimer.body":
		"This is a beta simulation feature.\nErrors, omissions, or delays may exist, and all displayed data is hypothetical rather than real earthquake information.",
	"scenario.disclaimer.warning":
		"Do not use this mode for actual disaster response or safety decisions.\nBefore making important decisions, verify official agencies and primary sources yourself.",
	"scenario.disclaimer.accept": "Press OK to acknowledge and proceed.",

	// Fault tooltip
	"fault.tooltip.depth": "{n}km deep",
	"fault.tooltip.probability": "30yr prob: {prob}",
	"fault.tooltip.recurrence": "Recurrence: {interval}",

	// Decision matrix details
	"matrix.instrumentalDetail": "Instrumental {n}",
	"matrix.cityExposure": "{city} {pop} at JMA {jma}",

	// Methodology references
	"methodology.ref.siMidorikawa":
		"Si & Midorikawa (1999) — Ground-motion attenuation model",
	"methodology.ref.wells":
		"Wells & Coppersmith (1994) — Rupture-length and magnitude scaling",
	"methodology.ref.nakamura":
		"Nakamura (1988) — UrEDAS early detection concept",
	"methodology.ref.jma": "JMA — Earthquake and tsunami bulletins",
	"methodology.ref.mic":
		"Statistics Bureau (MIC) — Population estimates and census data",
	"methodology.ref.cao": "Cabinet Office — Disaster response framework",
	"methodology.ref.nra": "NRA — Nuclear safety reference standards",
	"methodology.ref.gsi": "GSI — Public geospatial baselines",

	// Location names (Command Palette)
	"location.tokyo": "Tokyo",
	"location.osaka": "Osaka",
	"location.nagoya": "Nagoya",
	"location.sendai": "Sendai",
	"location.sapporo": "Sapporo",
	"location.fukuoka": "Fukuoka",
	"location.hiroshima": "Hiroshima",
	"location.kobe": "Kobe",
	"location.yokohama": "Yokohama",
	"location.kyoto": "Kyoto",
	"location.niigata": "Niigata",
	"location.kagoshima": "Kagoshima",
	"location.naha": "Naha",
	"location.kumamoto": "Kumamoto",
	"location.hakodate": "Hakodate",
	"location.shizuoka": "Shizuoka",
	"location.kanazawa": "Kanazawa",
	"location.matsuyama": "Matsuyama",
	"location.nankaiTrough": "Nankai Trough",
	"location.sagamiTrough": "Sagami Trough",
	"location.japanOverview": "Japan (Overview)",

	// Custom range (Recent Feed)
	"feed.customRange": "Custom range",

	// Depth cross-section (canvas labels)
	"depth.pacificPlate": "Pacific Plate",
	"depth.philippineSea": "Philippine Sea",

	// AIS Layer
	"ais.inZoneSummary": "{n} vessels in impact zone",
	"ais.passengerCount": "{n} passenger",
	"ais.tankerCount": "{n} tanker",
	"ais.anchored": "Anchored",
	"ais.heading": "HDG",
	"ais.highPriorityLabel": "HIGH PRIORITY",
	"ais.impactZoneWarning": "IN IMPACT ZONE — {dist}km from epicenter",

	// System Bar
	"sysbar.healthStatus": "health {level}",
	"sysbar.divergence": "divergence",
	"sysbar.conflict": "conflict",
	"sysbar.lag": "lag {n}s ingest",
	"sysbar.fps": "fps {n} degraded",

	// Maritime Telemetry
	"maritime.noTraffic": "No tracked traffic",
	"maritime.trackedCount": "{n} tracked",
	"maritime.highPriorityCount": "{n} high-priority",
	"maritime.underwayCount": "{n} underway",
	"maritime.anchoredCount": "{n} anchored",

	// Bundle Summaries
	"bundle.metric.exposed": "{n} {type} exposed",
	"bundle.metric.assetsElevated": "{n} assets in elevated posture",
	"bundle.metric.noElevated": "No elevated nationwide posture",
	"bundle.metric.portsElevated": "{n} port assets in elevated posture",
	"bundle.metric.lifelineElevated": "{n} lifeline sites in elevated posture",
	"bundle.metric.noLifelineElevated":
		"No lifeline corridors in elevated posture",
	"bundle.metric.medicalElevated": "{n} medical sites in elevated posture",
	"bundle.metric.noMedicalShift": "No medical access posture shift",
	"bundle.metric.buildingElevated": "{n} building clusters in elevated posture",
	"bundle.metric.urbanAligned":
		"{region} urban context aligned to current event",
	"bundle.metric.urbanStandby": "Urban structural context on standby",
	"bundle.detail.requiresVerification":
		"{assets} requires operator verification.",
	"bundle.detail.pressureCentered":
		"Primary operational pressure centered on {region}.",
	"bundle.detail.seismicStandby":
		"National seismic truth is standing by for the next significant event.",
	"bundle.detail.coastalVerification": "{assets} require coastal verification.",
	"bundle.detail.highPriorityFeed":
		"{hp} high-priority vessels and {uw} underway in current feed.",
	"bundle.detail.underwayTraffic":
		"{n} underway across current coastal traffic.",
	"bundle.detail.aisStandby":
		"AIS telemetry and coastal shipping posture are standing by.",
	"bundle.detail.corridorVerification":
		"{assets} require corridor verification.",
	"bundle.detail.lifelineStandby":
		"Rail, power, water, and telecom views are standing by for corridor stress.",
	"bundle.detail.hospitalVerification":
		"{assets} require hospital access verification.",
	"bundle.detail.medicalStandby":
		"Medical access and hospital readiness are standing by.",
	"bundle.detail.urbanVerification": "{assets} require urban integrity review.",
	"bundle.detail.builtEnvIntensify":
		"Built-environment overlays will intensify at city-tier as structural layers come online.",
	"bundle.detail.builtEnvStandby":
		"City-tier built-environment overlays will activate once an operator focus event is selected.",
	"bundle.counter.affected": "Affected",
	"bundle.counter.visible": "Visible",
	"bundle.counter.tracked": "Tracked",
	"bundle.counter.highPriority": "High Priority",
	"bundle.counter.underway": "Underway",
	"bundle.counter.lifelineSites": "Lifeline Sites",
	"bundle.counter.sites": "Sites",
	"bundle.counter.buildingClusters": "Building Clusters",
	"bundle.signal.focusRegion": "Focus Region",
	"bundle.signal.topAssets": "Top Assets",
	"bundle.signal.focusAssets": "Focus Assets",
	"bundle.signal.domainMix": "Domain Mix",
	"bundle.signal.exposedPorts": "Exposed Ports",
	"bundle.signal.trafficPosture": "Traffic Posture",
	"bundle.signal.trafficPostureValue": "{hp} priority / {uw} underway",
	"bundle.signal.corridorFocus": "Corridor Focus",
	"bundle.signal.source": "Source",
	"bundle.signal.modeledFromSeismic": "Modeled from seismic exposure",
	"bundle.signal.medicalFocus": "Medical Focus",
	"bundle.signal.urbanFocus": "Urban Focus",
	"bundle.signal.activationTier": "Activation Tier",
	"bundle.signal.cityTierFocus": "City-tier on operator focus",

	// Ops Read Model
	"ops.magSpread": "magnitude spread {n}",
	"ops.depthSpread": "depth spread {n} km",
	"ops.locationSpread": "location spread {n} km",
	"ops.tsunamiMismatch": "tsunami posture mismatch",
	"ops.faultTypeMismatch": "fault type mismatch",
	"ops.revisionsReview":
		"{n} revisions from {sources} require operator review.",
	"ops.revisionsShow": "{n} revisions from {sources} show {detail}.",
	"ops.noSignificantEvent": "No operationally significant event selected",
	"ops.focusAutoSelected":
		"Operational focus auto-selected from current incident stream",
	"ops.focusRetained": "Operational focus retained on the current incident",
	"ops.focusEscalated":
		"Operational focus escalated to a materially stronger incident",
	"ops.focusActive": "Operational focus active",
	"ops.assetsElevatedNational": "{n} assets in elevated posture nationwide",
	"ops.assetsElevatedVisible": "{n} visible assets in elevated posture",
	"ops.noAssetsElevated": "No assets in elevated posture",

	// Rail Domain (bundleDomainOverviews)
	"rail.status.suspended": "Suspended",
	"rail.status.partial": "Partial Service",
	"rail.status.delayed": "Delayed",
	"rail.status.pending": "Pending",
	"rail.status.nominal": "Nominal",
	"rail.feed.live": "Live {source}",
	"rail.feed.stale": "Stale {source}",
	"rail.feed.degraded": "Degraded {source}",
	"rail.feed.down": "{source} Down",
	"rail.feed.unknown": "{source} Unknown",
	"rail.feed.defaultSource": "feed",
	"rail.telemetry.staleWith":
		"Rail telemetry is stale; using last confirmed corridor state.",
	"rail.telemetry.staleWithout":
		"Rail telemetry is stale and no current corridor status is available.",
	"rail.telemetry.degradedWith":
		"Rail telemetry is degraded; verify the last confirmed corridor state before acting.",
	"rail.telemetry.degradedWithout":
		"Rail telemetry is degraded and no current corridor status is available.",
	"rail.telemetry.downWith":
		"Rail telemetry is down; manual corridor verification is required.",
	"rail.telemetry.downWithout":
		"Rail telemetry is down and no current corridor status is available.",
	"rail.telemetry.unknownWith":
		"Rail telemetry state is unknown; verify the last confirmed corridor state before acting.",
	"rail.telemetry.unknownWithout":
		"Rail telemetry state is unknown and no current corridor status is available.",
	"rail.label": "Rail",
	"rail.metric.down": "Rail telemetry down",
	"rail.metric.degraded": "Rail telemetry degraded",
	"rail.metric.pending": "Rail telemetry pending",
	"rail.metric.stale": "Rail telemetry stale",
	"rail.metric.corridorsSuspended": "{n} rail corridors suspended",
	"rail.metric.corridorsPartial": "{n} rail corridors in partial service",
	"rail.metric.corridorsDelayed": "{n} rail corridors delayed",
	"rail.metric.corridorsPending": "{n} rail corridors pending status",
	"rail.metric.corridorsNominal": "{n} rail corridors nominal",
	"rail.detail.suspended": "{line} is suspended on the live rail feed.",
	"rail.detail.suspendedCause":
		"{line} is suspended on the live rail feed due to {cause}.",
	"rail.detail.partial": "{line} is operating in partial service.",
	"rail.detail.partialCause":
		"{line} is operating in partial service due to {cause}.",
	"rail.detail.delayed": "{line} is reporting delays.",
	"rail.detail.delayedCause": "{line} is reporting delays due to {cause}.",
	"rail.detail.pendingUpdate":
		"{line} is awaiting a confirmed live status update.",
	"rail.detail.nominal":
		"Live rail telemetry shows nominal posture across monitored Shinkansen corridors.",
	"rail.signal.feed": "Rail Feed",
	"rail.signal.networkState": "Network State",
	"rail.signal.primaryCorridor": "Primary Corridor",
	"rail.signal.reportedCause": "Reported Cause",
	"rail.signal.primaryStatus": "Primary Status",
	"rail.signal.network": "Rail Network",
	"rail.counter.monitored": "Monitored",
	"rail.counter.suspended": "Suspended",
	"rail.counter.partial": "Partial",
	"rail.counter.delayed": "Delayed",
	"rail.counter.pending": "Pending",

	// Power Domain
	"power.label": "Power",
	"power.metric.scramLikely": "{n} nuclear SCRAM likely",
	"power.metric.scramRisks": "{n} nuclear SCRAM risks active",
	"power.metric.siteReview": "{n} nuclear sites under review",
	"power.metric.nodesElevated": "{n} power nodes in elevated posture",
	"power.metric.sitesInZone": "{n} generation sites in impact zone",
	"power.detail.nearScram":
		"{plant} is estimated near SCRAM thresholds at ~{pga} gal.",
	"power.detail.gridVerify":
		"{plant} is estimated at JMA {intensity} and requires grid verification.",
	"power.detail.continuity":
		"{plant} sits inside the current shake field and requires continuity verification.",
	"power.counter.nodes": "Power Nodes",
	"power.counter.scramLikely": "SCRAM Likely",
	"power.counter.scramReview": "SCRAM Review",
	"power.counter.plantsInZone": "Plants In Zone",
	"power.signal.primaryPlant": "Primary Plant",
	"power.signal.region": "Power Region",
	"power.signal.pga": "Estimated PGA",
	"power.signal.gridNode": "Grid Node",
	"power.signal.posture": "Power Posture",

	// Water Domain
	"water.label": "Water",
	"water.posture.outageRisk": "Outage Risk",
	"water.posture.continuityReview": "Continuity Review",
	"water.posture.verification": "Verification",
	"water.posture.nominal": "Nominal",
	"water.metric.outageRisk": "{n} water sites at outage risk",
	"water.metric.continuityReview": "{n} water sites in continuity review",
	"water.metric.elevated": "{n} water sites in elevated posture",
	"water.metric.verification": "{n} water sites under verification",
	"water.detail.outageRisk":
		"{site} is estimated at JMA {intensity} with potable-water continuity at risk.",
	"water.detail.continuityReview":
		"{site} is estimated at JMA {intensity} and requires distribution verification.",
	"water.detail.verification":
		"{site} is inside the current shake field and requires water continuity confirmation.",
	"water.counter.sites": "Water Sites",
	"water.counter.outageRisk": "Outage Risk",
	"water.counter.review": "Continuity Review",
	"water.counter.verify": "Verification",
	"water.signal.primaryFacility": "Primary Facility",
	"water.signal.region": "Water Region",
	"water.signal.intensity": "Estimated Intensity",
	"water.signal.posture": "Network Posture",
	"water.signal.waterPosture": "Water Posture",

	// Overview (generic bundle)
	"overview.defaultMetric.lifeline": "lifeline check",
	"overview.defaultMetric.medical": "medical access check",
	"overview.defaultMetric.builtEnv": "urban integrity review",
	"overview.counterLabel.lifelineSites": "Lifeline Sites",
	"overview.counterLabel.sites": "Sites",
	"overview.counterLabel.buildingClusters": "Building Clusters",
	"overview.signal.nextCheck": "Next Check",
	"overview.signal.region": "Region",
	"overview.signal.primaryDomain": "Primary Domain",
	"overview.signal.builtEnvironment": "Built Environment",
	"overview.counter.checks": "Checks",
	"overview.metric.queued": "{n} {label} queued",

	// Poller Section Labels
	"poller.section.events": "Events",
	"poller.section.governor": "Governor",
	"poller.section.maritime": "Maritime",
	"poller.section.rail": "Rail",
	"poller.staleMessage": "{section} stale",
	"poller.degradedMessage": "{section} {state}: {error}",
	"poller.degradedNoError": "{section} {state}",
	"poller.fallback.governor":
		"Governor cadence is running without unified snapshot truth",
	"poller.fallback.maritime":
		"Unified snapshot unavailable; serving last-known-good maritime cache if present",
	"poller.fallback.rail":
		"Unified snapshot unavailable; serving last-known-good rail cache if present",
	"poller.fallback.transport":
		"Unified snapshot unavailable; running on fallback transport",
	"poller.fallback.unavailable":
		"Realtime snapshot and fallback feeds are unavailable",

	// Rail Layer Tooltip
	"rail.tooltip.normalOps": "Normal Operations",
	"rail.tooltip.delayed": "Delayed",
	"rail.tooltip.suspended": "SUSPENDED",
	"rail.tooltip.partial": "Partial Service",
	"rail.tooltip.unknown": "Status Unknown",
	"rail.tooltip.shinkansen": "Shinkansen",
	"rail.tooltip.conventional": "Conventional",
	"rail.tooltip.likelySuspended": "LIKELY SUSPENDED \u2014 UrEDAS triggered",
	"rail.tooltip.normalStatus": "Normal operations",
	"rail.tooltip.stations": "{n} stations",

	// System Health (serviceReadModel)
	"health.degraded.headline": "Realtime feed degraded",
	"health.degraded.detail":
		"Fallback realtime feed active. Verify source confidence before acting.",
	"health.divergence.headline": "Material revision divergence detected",
	"health.divergence.detail":
		"Source revisions diverge materially and require operator review.",
	"health.conflict.headline": "Conflicting source revisions detected",
	"health.lowConf.headline": "Selected event truth is low confidence",
	"health.stale.headline": "Realtime updates are delayed",
	"health.conflict.detail":
		"{n} revisions from {sources} require operator review.",
	"health.lowConf.detail":
		"Selected truth originates from a low-confidence {source} revision. Verify before acting.",
	"health.stale.detail":
		"Primary feed is stale; decisions may lag current field conditions.",
	"health.nominal.headline": "Primary realtime feed healthy",
	"health.nominal.detail":
		"No source conflicts or realtime degradation detected.",

	// Ops Snapshot
	"ops.snapshotSummary": "{place} M{mag} event. Tsunami posture {tsunami}.",

	// Realtime Status
	"realtime.fallbackStale": "Fallback feed active and data is stale",
	"realtime.fallbackActive": "Running on fallback realtime feed",
	"realtime.delayed": "Realtime updates are delayed",

	// Replay Milestones
	"milestone.eventLocked": "Event locked",
	"milestone.impactReady": "Impact ready",
	"milestone.tsunamiReady": "Tsunami posture ready",
	"milestone.exposureReady": "Asset exposure ready",
	"milestone.prioritiesPublished": "Priorities published",

	// Presentation (Snapshot Model)
	"snapshot.calm.headline": "No critical operational earthquake event",
	"snapshot.calm.summary": "{metro} remains in calm monitoring mode.",
	"snapshot.calm.check.replay": "Open historical replay",
	"snapshot.calm.check.scenario": "Run scenario shift",
	"snapshot.calm.check.inspect": "Inspect {metro} launch assets",
	"snapshot.event.headline": "Operational impact forming near {place}",
	"snapshot.event.summary": "{metro} requires focused infrastructure review.",

	// Asset Class Registry
	"asset.port.label": "port",
	"asset.port.family": "Ports",
	"asset.port.counter": "Ports",
	"asset.port.metric": "port asset",
	"asset.port.domainCheck": "coastal verification",
	"asset.port.priority": "Verify {name} access",

	"asset.railHub.label": "rail hub",
	"asset.railHub.family": "Rail",
	"asset.railHub.counter": "Rail Hubs",
	"asset.railHub.metric": "rail hub",
	"asset.railHub.domainCheck": "corridor check",
	"asset.railHub.priority": "Inspect {name} rail hub",

	"asset.hospital.label": "hospital",
	"asset.hospital.family": "Hospital",
	"asset.hospital.counter": "Sites",
	"asset.hospital.metric": "hospital site",
	"asset.hospital.domainCheck": "medical access check",
	"asset.hospital.priority": "Confirm {name} access posture",

	"asset.powerSub.label": "power substation",
	"asset.powerSub.family": "Power",
	"asset.powerSub.counter": "Power Nodes",
	"asset.powerSub.metric": "power node",
	"asset.powerSub.domainCheck": "power stability check",
	"asset.powerSub.priority": "Verify {name} power posture",

	"asset.water.label": "water facility",
	"asset.water.family": "Water",
	"asset.water.counter": "Water Sites",
	"asset.water.metric": "water site",
	"asset.water.domainCheck": "water continuity check",
	"asset.water.priority": "Verify {name} water posture",

	"asset.telecom.label": "telecom hub",
	"asset.telecom.family": "Telecom",
	"asset.telecom.counter": "Telecom Hubs",
	"asset.telecom.metric": "telecom hub",
	"asset.telecom.domainCheck": "telecom continuity check",
	"asset.telecom.priority": "Verify {name} telecom posture",

	"asset.building.label": "building cluster",
	"asset.building.family": "Urban Core",
	"asset.building.counter": "Building Clusters",
	"asset.building.metric": "building cluster",
	"asset.building.domainCheck": "urban integrity review",
	"asset.building.priority": "Review {name} built-environment posture",

	"asset.nuclear.label": "nuclear plant",
	"asset.nuclear.family": "Nuclear",
	"asset.nuclear.counter": "Nuclear Sites",
	"asset.nuclear.metric": "nuclear site",
	"asset.nuclear.domainCheck": "nuclear safety verification",
	"asset.nuclear.priority": "URGENT: Verify {name} reactor status",

	"asset.airport.label": "airport",
	"asset.airport.family": "Aviation",
	"asset.airport.counter": "Airports",
	"asset.airport.metric": "airport",
	"asset.airport.domainCheck": "aviation operations check",
	"asset.airport.priority": "Inspect {name} runway & terminal",

	"asset.dam.label": "dam",
	"asset.dam.family": "Dams",
	"asset.dam.counter": "Dam Sites",
	"asset.dam.metric": "dam site",
	"asset.dam.domainCheck": "dam structural integrity check",
	"asset.dam.priority": "URGENT: Inspect {name} structural integrity",

	"asset.lng.label": "LNG terminal",
	"asset.lng.family": "Energy",
	"asset.lng.counter": "Energy Sites",
	"asset.lng.metric": "energy terminal",
	"asset.lng.domainCheck": "energy facility safety check",
	"asset.lng.priority": "Verify {name} containment & pipeline status",

	"asset.eoc.label": "government EOC",
	"asset.eoc.family": "Government",
	"asset.eoc.counter": "EOC Sites",
	"asset.eoc.metric": "EOC site",
	"asset.eoc.domainCheck": "EOC operational check",
	"asset.eoc.priority": "Confirm {name} operational status",

	"asset.evac.label": "evacuation site",
	"asset.evac.family": "Shelters",
	"asset.evac.counter": "Evacuation Sites",
	"asset.evac.metric": "shelter site",
	"asset.evac.domainCheck": "shelter capacity check",
	"asset.evac.priority": "Assess {name} shelter capacity",

	// Bundle Registry
	"bundle.desc.seismic": "Event truth, shaking fields, and fault context.",
	"bundle.desc.maritime":
		"Ships, port approaches, and coastal operational posture.",
	"bundle.desc.lifelines":
		"Rail, airports, urban transfer nodes, power, water, and telecom corridors.",
	"bundle.desc.medical": "Hospital access and clinical response posture.",
	"bundle.desc.builtEnv": "3D buildings and urban structural context.",

	// Operator View Presets
	"view.nationalImpact": "National Impact",
	"view.coastalOperations": "Coastal Operations",
	"view.railStress": "Rail Stress",
	"view.medicalAccess": "Medical Access",
	"view.builtEnvironment": "Built Environment",

	// Response Timeline (impactIntelligence)
	"response.uredas": "UrEDAS auto-stop (Shinkansen)",
	"response.uredas.desc":
		"Earthquake Early Warning triggers automatic Shinkansen braking within seconds",
	"response.jma": "JMA preliminary seismic intensity",
	"response.jma.desc":
		"Japan Meteorological Agency issues initial seismic intensity report",
	"response.nhk": "NHK earthquake bulletin",
	"response.nhk.desc":
		"National broadcaster interrupts programming with earthquake details",
	"response.tsunami": "Tsunami advisory/warning",
	"response.tsunami.desc":
		"JMA issues tsunami advisory or warning based on epicenter and magnitude",
	"response.dmat": "DMAT standby activation",
	"response.dmat.desc":
		"Disaster Medical Assistance Teams placed on standby across affected regions",
	"response.fdma": "FDMA disaster response HQ",
	"response.fdma.desc":
		"Fire and Disaster Management Agency establishes disaster response headquarters",
	"response.sdf": "SDF dispatch decision",
	"response.sdf.desc":
		"Self-Defense Forces dispatch decision for disaster relief operations",
	"response.transport": "Wide-area medical transport",
	"response.transport.desc":
		"Activation of wide-area medical transport for critically injured patients",
	"response.cabinet": "Cabinet emergency meeting",
	"response.cabinet.desc":
		"Cabinet convenes emergency meeting for disaster countermeasures",
	"response.intl": "International assistance request",
	"response.intl.desc":
		"Government evaluates and potentially requests international disaster assistance",

	// Metro labels
	"metro.tokyo": "Tokyo",
	"metro.osaka": "Osaka",

	// Layer names (layerRegistry)
	"layer.name.earthquakes": "Earthquakes",
	"layer.name.seismicDepth": "3D Depth",
	"layer.name.intensity": "Intensity",
	"layer.name.heatmap": "Seismic Heatmap",
	"layer.name.faults": "Faults",
	"layer.name.ais": "Ships",
	"layer.name.rail": "Rail",
	"layer.name.airports": "Airports",
	"layer.name.transport": "Transport Nodes",
	"layer.name.power": "Power",
	"layer.name.water": "Water",
	"layer.name.telecom": "Telecom",
	"layer.name.hospitals": "Hospitals",
	"layer.name.buildings": "Buildings",
	"layer.name.aftershockCascade": "Aftershock Cascade",

	// Layer gate reasons (layerControl)
	"layer.gate.requiresM5": "Requires M5.0+",
	"layer.gate.requiresCityZoom": "City zoom required",
	"layer.gate.requiresIntensityGrid": "Waiting for intensity field",
	"layer.gate.unsupportedCity": "No verified PLATEAU tileset",
	"layer.gate.waitingSequence": "Available after wave sequence",
	"layer.gate.waitingHandoff": "Available after infra handoff",

	// Layer legend labels (layerRegistry)
	"layer.legend.magBelow45": "M < 4.5",
	"layer.legend.mag4550": "M 4.5-5.5",
	"layer.legend.mag5570": "M 5.5-7.0",
	"layer.legend.mag70plus": "M \u2265 7.0",
	"layer.legend.depthShallow": "< 30 km (shallow)",
	"layer.legend.depth3070": "30-70 km",
	"layer.legend.depth70150": "70-150 km",
	"layer.legend.depth150300": "150-300 km",
	"layer.legend.depth300500": "300-500 km",
	"layer.legend.depthDeep": "> 500 km (deep)",
	"layer.legend.heatLow": "Low density",
	"layer.legend.heatModerate": "Moderate density",
	"layer.legend.heatHigh": "High density",
	"layer.legend.activeFaultTrace": "Active fault trace",
	"layer.legend.vessel": "Vessel",
	"layer.legend.inImpactZone": "In impact zone",
	"layer.legend.railLine": "Rail line",
	"layer.legend.inShakeZone": "In shake zone",
	"layer.legend.operational": "Operational",
	"layer.legend.inspectionPosture": "Inspection posture",
	"layer.legend.closurePosture": "Closure posture",
	"layer.legend.shinkansenHubs": "Shinkansen hubs",
	"layer.legend.urbanTransferStress": "Urban transfer stress",
	"layer.legend.powerFacility": "Power facility",
	"layer.legend.highExposure": "High exposure",
	"layer.legend.hospital": "Hospital",

	// Severity labels
	"severity.critical": "CRITICAL",
	"severity.priority": "PRIORITY",
	"severity.watch": "WATCH",
	"severity.clear": "CLEAR",
	"severity.info": "INFO",

	// Trust labels
	"trust.confirmed": "CONFIRMED",
	"trust.review": "REVIEW",
	"trust.degraded": "DEGRADED",

	// Confidence labels (mission strip)
	"strip.confidence.high": "HIGH",
	"strip.confidence.medium": "MEDIUM",
	"strip.confidence.low": "LOW",

	// Freshness source labels (mission strip)
	"freshness.source.live": "live",
	"freshness.source.fallback": "fallback",
	"freshness.source.cached": "cached",
	"freshness.state.fresh": "fresh",
	"freshness.state.stale": "stale",
	"freshness.state.degraded": "degraded",

	// Realtime source labels (operatorPulse)
	"realtime.source.server": "SERVER",
	"realtime.source.sse": "SSE",
	"realtime.source.poll": "POLL",

	// Performance tone labels (dataTicker)
	"performance.tone.nominal": "NOMINAL",
	"performance.tone.watch": "WATCH",
	"performance.tone.degraded": "DEGRADED",

	// Domain intelligence — per-class operator actions

	// Hospital
	"domain.hospital.patientTransfer": "Activate patient transfer protocol",
	"domain.hospital.surgeryHalt": "Halt elective surgeries — assess OR capacity",
	"domain.hospital.emergencyPower":
		"Verify emergency power — generator start confirmed",
	"domain.hospital.dmatStandby": "DMAT standby — assess deployment need",
	"domain.hospital.accessRoute": "Verify ambulance access routes",

	// Nuclear
	"domain.nuclear.scramVerify": "Verify reactor SCRAM completion",
	"domain.nuclear.spentFuelPool": "Inspect spent fuel pool cooling",
	"domain.nuclear.beyondDesignBasis":
		"Beyond design basis — activate emergency protocol",
	"domain.nuclear.coolingVerify": "Verify primary cooling system integrity",
	"domain.nuclear.upzNotify": "Notify UPZ 30km zone municipalities",
	"domain.nuclear.nraReport": "File NRA incident report",

	// Dam
	"domain.dam.downstreamEvac": "Initiate downstream evacuation assessment",
	"domain.dam.bodyInspection": "Dam body crack/deformation inspection",
	"domain.dam.spillwayCheck": "Verify spillway gate operation",
	"domain.dam.reservoirLevel": "Check reservoir level and inflow",
	"domain.dam.seepageMonitor": "Monitor seepage volume changes",

	// Power substation
	"domain.power.gridIsolation": "Isolate damaged grid section",
	"domain.power.transformerInspect": "Transformer bushing visual inspection",
	"domain.power.loadShedding": "Initiate load shedding protocol",
	"domain.power.backupActivation":
		"Verify backup power activation at dependent facilities",
	"domain.power.gridMonitor": "Monitor grid frequency stability",

	// Rail hub
	"domain.rail.autoStop": "Auto-stop activated — confirm train positions",
	"domain.rail.trackInspection": "Dispatch track inspection teams",
	"domain.rail.passengerEvac": "Assess stranded passenger evacuation",
	"domain.rail.serviceResume": "Evaluate service resumption conditions",
	"domain.rail.statusMonitor": "Monitor line status updates",

	// Airport
	"domain.airport.closure": "Close airport — suspend all operations",
	"domain.airport.runwayInspect": "Runway FOD walk-down inspection",
	"domain.airport.terminalCheck": "Terminal structural safety assessment",
	"domain.airport.notam": "Issue NOTAM for runway status",
	"domain.airport.diversionPlan": "Coordinate flight diversions",

	// Port
	"domain.port.closure": "Close port — suspend vessel movements",
	"domain.port.quayInspect": "Quay wall settlement/crack inspection",
	"domain.port.liquefactionCheck": "Liquefaction assessment at reclaimed areas",
	"domain.port.cargoDiversion":
		"Coordinate cargo diversion to alternative port",
	"domain.port.tsunamiPrep": "Tsunami preparation — move vessels to deep water",

	// Water facility
	"domain.water.shutoff": "Emergency shutoff — isolate damaged sections",
	"domain.water.pipelineCheck": "Pipeline pressure test on trunk lines",
	"domain.water.turbidityMonitor": "Monitor treated water turbidity levels",
	"domain.water.truckDispatch": "Dispatch emergency water trucks",
	"domain.water.pressureMonitor": "Monitor distribution pressure",

	// Telecom hub
	"domain.telecom.mobileBts": "Deploy mobile base stations",
	"domain.telecom.equipmentCheck": "Equipment rack inspection",
	"domain.telecom.batteryVerify": "Verify battery backup remaining capacity",
	"domain.telecom.disasterBoard": "Activate disaster message board",
	"domain.telecom.trafficMonitor":
		"Monitor traffic congestion on remaining links",

	// Government EOC
	"domain.eoc.hqActivation": "Full disaster HQ activation (Level 3)",
	"domain.eoc.alertMode": "Alert mode activation (Level 2)",
	"domain.eoc.infoGathering": "Information gathering mode (Level 1)",
	"domain.eoc.alternateActivate": "Activate alternate EOC facility",
	"domain.eoc.commsCheck": "Verify disaster communication links",

	// Evacuation site
	"domain.evac.doNotOpen": "DO NOT OPEN — structural damage suspected",
	"domain.evac.safetyCheck": "Safety inspection before opening",
	"domain.evac.limitedCapacity": "Open with limited capacity",
	"domain.evac.prepareOpen": "Prepare to open — stage supplies",
	"domain.evac.standbyReady": "Standby — ready to activate",

	// LNG terminal
	"domain.lng.emergencyShutdown": "Emergency shutdown — isolate all systems",
	"domain.lng.pipelineIsolate": "Isolate gas pipelines at block valves",
	"domain.lng.fireWatch": "Activate fire watch perimeter",
	"domain.lng.gasDetection": "Deploy gas leak detection teams",
	"domain.lng.supplyAssess": "Assess gas supply continuity",

	// Building cluster
	"domain.building.rescueStandby": "Standby rescue teams — collapse risk",
	"domain.building.entryRestrict":
		"Restrict building entry — damage assessment pending",
	"domain.building.rapidAssessment": "Deploy rapid damage assessment teams",
	"domain.building.glassHazard": "Cordon glass/facade fall zones",
	"domain.building.inspectionTeam": "Schedule structural inspection teams",

	// Domain metrics labels
	"domain.metric.posture": "Posture",
	"domain.metric.scram": "SCRAM",
	"domain.metric.pga": "PGA",
	"domain.metric.downstreamRisk": "Downstream",
	"domain.metric.outageRisk": "Outage risk",
	"domain.metric.stopType": "Stop type",
	"domain.metric.inspectionEst": "Inspection est.",
	"domain.metric.portStatus": "Port status",
	"domain.metric.serviceStatus": "Service",
	"domain.metric.commsStatus": "Comms",
	"domain.metric.backupHours": "Backup power",
	"domain.metric.activationLevel": "Activation",
	"domain.metric.usability": "Usability",
	"domain.metric.containment": "Containment",
	"domain.metric.damageLevel": "Damage level",

	// Domain metric values
	"domain.value.operational": "Operational",
	"domain.value.disrupted": "Disrupted",
	"domain.value.compromised": "Compromised",
	"domain.value.degraded": "Degraded",
	"domain.value.likely": "Likely",
	"domain.value.possible": "Possible",
	"domain.value.unlikely": "Unlikely",
	"domain.value.evacuation": "Evacuation",
	"domain.value.alert": "Alert",
	"domain.value.monitoring": "Monitoring",
	"domain.value.blackout": "Blackout",
	"domain.value.partial": "Partial outage",
	"domain.value.stable": "Stable",
	"domain.value.auto": "Auto",
	"domain.value.manual": "Manual",
	"domain.value.normal": "Normal",
	"domain.value.closed": "Closed",
	"domain.value.restricted": "Restricted",
	"domain.value.outage": "Outage",
	"domain.value.down": "Down",
	"domain.value.standby": "Standby",
	"domain.value.l1": "L1 — Info gathering",
	"domain.value.l2": "L2 — Alert",
	"domain.value.l3": "L3 — Full activation",
	"domain.value.unsafe": "Unsafe",
	"domain.value.inspectFirst": "Inspect first",
	"domain.value.limited": "Limited",
	"domain.value.ready": "Ready",
	"domain.value.emergency": "Emergency",
	"domain.value.isolated": "Isolated",
	"domain.value.severe": "Severe",
	"domain.value.significant": "Significant",
	"domain.value.moderate": "Moderate",
	"domain.value.minor": "Minor",

	// Nearest alternative
	"domain.nearestAlt": "Nearest operational",
	"domain.nearestAlt.none": "No alternative available",
	"domain.bearing.N": "N",
	"domain.bearing.NE": "NE",
	"domain.bearing.E": "E",
	"domain.bearing.SE": "SE",
	"domain.bearing.S": "S",
	"domain.bearing.SW": "SW",
	"domain.bearing.W": "W",
	"domain.bearing.NW": "NW",

	// Mobile Tab Bar
	"tab.map": "Map",
	"tab.feed": "Feed",
	"tab.layers": "Layers",
	"tab.info": "Info",
};

export default en;
