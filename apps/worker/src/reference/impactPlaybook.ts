export interface ReferencePort {
  name: string;
  nameJa: string;
  lat: number;
  lng: number;
}

export interface ResponseMilestoneTemplate {
  id: string;
  translationKey: string;
  labelJa: string;
  minutesAfter: number;
  minMagnitude: number | null;
  tsunamiRiskRequired?: boolean;
}

export const MAJOR_PORTS: ReferencePort[] = [
  { name: 'Tokyo Bay', nameJa: '東京湾', lat: 35.45, lng: 139.8 },
  { name: 'Yokohama', nameJa: '横浜港', lat: 35.44, lng: 139.65 },
  { name: 'Osaka Bay', nameJa: '大阪湾', lat: 34.6, lng: 135.2 },
  { name: 'Kobe', nameJa: '神戸港', lat: 34.68, lng: 135.2 },
  { name: 'Nagoya', nameJa: '名古屋港', lat: 35.05, lng: 136.88 },
  { name: 'Hakata', nameJa: '博多港', lat: 33.6, lng: 130.4 },
  { name: 'Sendai', nameJa: '仙台港', lat: 38.27, lng: 141 },
  { name: 'Niigata', nameJa: '新潟港', lat: 37.95, lng: 139.05 },
  { name: 'Kagoshima', nameJa: '鹿児島港', lat: 31.6, lng: 130.57 },
  { name: 'Naha', nameJa: '那覇港', lat: 26.22, lng: 127.67 },
];

export const RESPONSE_MILESTONE_TEMPLATES: ResponseMilestoneTemplate[] = [
  { id: 'uredas', translationKey: 'response.uredas', labelJa: 'UrEDAS自動停止（新幹線）', minutesAfter: 0, minMagnitude: 4 },
  { id: 'jma', translationKey: 'response.jma', labelJa: 'JMA震度速報', minutesAfter: 3, minMagnitude: null },
  { id: 'nhk', translationKey: 'response.nhk', labelJa: 'NHK地震速報', minutesAfter: 5, minMagnitude: 4 },
  { id: 'tsunami', translationKey: 'response.tsunami', labelJa: '津波注意報/警報', minutesAfter: 10, minMagnitude: null, tsunamiRiskRequired: true },
  { id: 'dmat', translationKey: 'response.dmat', labelJa: 'DMAT待機要請', minutesAfter: 15, minMagnitude: 6 },
  { id: 'fdma', translationKey: 'response.fdma', labelJa: '消防庁災害対策本部', minutesAfter: 30, minMagnitude: 6 },
  { id: 'sdf', translationKey: 'response.sdf', labelJa: '自衛隊派遣決定', minutesAfter: 60, minMagnitude: 6.5 },
  { id: 'transport', translationKey: 'response.transport', labelJa: '広域医療搬送', minutesAfter: 90, minMagnitude: 7 },
  { id: 'cabinet', translationKey: 'response.cabinet', labelJa: '閣議（緊急災害対策）', minutesAfter: 180, minMagnitude: 7 },
  { id: 'intl', translationKey: 'response.intl', labelJa: '国際救援要請', minutesAfter: 360, minMagnitude: 7.5 },
];
