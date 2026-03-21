export const LINE_ID_MAP: Record<string, string> = {
  'JR-East.TohokuShinkansen': 'tohoku',
  'JR-East.JoetsuShinkansen': 'joetsu',
  'JR-East.HokurikuShinkansen': 'hokuriku',
  'JR-East.HokkaidoShinkansen': 'hokkaido',
  'JR-Central.Tokaido': 'tokaido',
  'JR-West.SanyoShinkansen': 'sanyo',
  'JR-Kyushu.KyushuShinkansen': 'kyushu',
  'JR-Kyushu.NishiKyushuShinkansen': 'nishi-kyushu',
};

export const JR_OPERATORS = [
  'odpt.Operator:JR-East',
  'odpt.Operator:JR-Central',
  'odpt.Operator:JR-West',
  'odpt.Operator:JR-Kyushu',
];

export const RAIL_LINE_LABELS: Record<string, string> = {
  tokaido: 'Tokaido Shinkansen',
  sanyo: 'Sanyo Shinkansen',
  tohoku: 'Tohoku Shinkansen',
  hokkaido: 'Hokkaido Shinkansen',
  joetsu: 'Joetsu Shinkansen',
  hokuriku: 'Hokuriku Shinkansen',
  kyushu: 'Kyushu Shinkansen',
  'nishi-kyushu': 'Nishi-Kyushu Shinkansen',
};

export interface RailReferenceLine {
  lineId: string;
  label: string;
  odptRailways: string[];
}

export const RAIL_REFERENCE_LINES: RailReferenceLine[] = Object.entries(RAIL_LINE_LABELS).map(
  ([lineId, label]) => ({
    lineId,
    label,
    odptRailways: Object.entries(LINE_ID_MAP)
      .filter(([, mappedLineId]) => mappedLineId === lineId)
      .map(([railway]) => railway),
  }),
);
