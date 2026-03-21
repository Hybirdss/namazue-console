#!/usr/bin/env python3
"""Generate municipality population centroids from official Japan sources.

Sources:
- e-Stat: 2025-01-01 resident registry population by municipality/ward
- MLIT N03: 2025 administrative boundaries
"""

from __future__ import annotations

import argparse
import json
import math
import pathlib
import shutil
import subprocess
import sys
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass


ROOT = pathlib.Path(__file__).resolve().parent.parent
OUTPUT_PATH = ROOT / 'apps/globe/src/data/municipalities.generated.ts'
NAME_EN_MAP_PATH = ROOT / 'tools/data/municipality-name-en.json'

POPULATION_URL = 'https://www.e-stat.go.jp/stat-search/file-download?fileKind=0&statInfId=000040306654'
BOUNDARY_URL = 'https://nlftp.mlit.go.jp/ksj/gml/data/N03/N03-2025/N03-20250101_GML.zip'

UNMATCHED_GEOMETRY_CODES = {
    '12000',
    '13000',
    '23000',
    '30000',
    '40000',
    '46000',
    '47000',
}

PREFECTURE_IDS = {
    '北海道': 'hokkaido',
    '青森県': 'aomori',
    '岩手県': 'iwate',
    '宮城県': 'miyagi',
    '秋田県': 'akita',
    '山形県': 'yamagata',
    '福島県': 'fukushima',
    '茨城県': 'ibaraki',
    '栃木県': 'tochigi',
    '群馬県': 'gunma',
    '埼玉県': 'saitama',
    '千葉県': 'chiba',
    '東京都': 'tokyo',
    '神奈川県': 'kanagawa',
    '新潟県': 'niigata',
    '富山県': 'toyama',
    '石川県': 'ishikawa',
    '福井県': 'fukui',
    '山梨県': 'yamanashi',
    '長野県': 'nagano',
    '岐阜県': 'gifu',
    '静岡県': 'shizuoka',
    '愛知県': 'aichi',
    '三重県': 'mie',
    '滋賀県': 'shiga',
    '京都府': 'kyoto',
    '大阪府': 'osaka',
    '兵庫県': 'hyogo',
    '奈良県': 'nara',
    '和歌山県': 'wakayama',
    '鳥取県': 'tottori',
    '島根県': 'shimane',
    '岡山県': 'okayama',
    '広島県': 'hiroshima',
    '山口県': 'yamaguchi',
    '徳島県': 'tokushima',
    '香川県': 'kagawa',
    '愛媛県': 'ehime',
    '高知県': 'kochi',
    '福岡県': 'fukuoka',
    '佐賀県': 'saga',
    '長崎県': 'nagasaki',
    '熊本県': 'kumamoto',
    '大分県': 'oita',
    '宮崎県': 'miyazaki',
    '鹿児島県': 'kagoshima',
    '沖縄県': 'okinawa',
}

XLSX_NS = {'x': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


@dataclass
class PopulationRow:
    code: str
    prefecture_name: str
    name: str
    population: int


@dataclass
class GeometryAccumulator:
    prefecture_name: str
    weighted_lng: float = 0.0
    weighted_lat: float = 0.0
    total_weight: float = 0.0
    fallback_lng: float = 0.0
    fallback_lat: float = 0.0
    fallback_points: int = 0

    def add(self, lng: float, lat: float, weight: float, point_count: int) -> None:
        if weight > 0:
            self.weighted_lng += lng * weight
            self.weighted_lat += lat * weight
            self.total_weight += weight
        self.fallback_lng += lng * point_count
        self.fallback_lat += lat * point_count
        self.fallback_points += point_count

    def centroid(self) -> tuple[float, float]:
        if self.total_weight > 0:
            return self.weighted_lat / self.total_weight, self.weighted_lng / self.total_weight
        if self.fallback_points > 0:
            return self.fallback_lat / self.fallback_points, self.fallback_lng / self.fallback_points
        raise ValueError('No geometry points accumulated')


def log(message: str) -> None:
    print(f'[build-municipalities] {message}', file=sys.stderr)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument('--population-file', type=pathlib.Path)
    parser.add_argument('--boundary-zip', type=pathlib.Path)
    parser.add_argument('--output', type=pathlib.Path, default=OUTPUT_PATH)
    return parser.parse_args()


def ensure_tool(name: str) -> None:
    if shutil.which(name):
        return
    raise SystemExit(f'Missing required tool: {name}')


def download(url: str, destination: pathlib.Path) -> pathlib.Path:
    log(f'Downloading {url}')
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(url) as response, destination.open('wb') as out_file:
        shutil.copyfileobj(response, out_file)
    return destination


def load_name_en_map() -> dict[str, str]:
    if not NAME_EN_MAP_PATH.exists():
        return {}
    return json.loads(NAME_EN_MAP_PATH.read_text(encoding='utf-8'))


def parse_shared_strings(workbook: zipfile.ZipFile) -> list[str]:
    strings: list[str] = []
    root = ET.fromstring(workbook.read('xl/sharedStrings.xml'))
    for item in root.findall('x:si', XLSX_NS):
        strings.append(''.join(node.text or '' for node in item.iterfind('.//x:t', XLSX_NS)))
    return strings


def cell_value(cell: ET.Element, shared_strings: list[str]) -> str:
    value = cell.find('x:v', XLSX_NS)
    if value is None or value.text is None:
        return ''
    if cell.attrib.get('t') == 's':
        return shared_strings[int(value.text)]
    return value.text


def parse_population_rows(path: pathlib.Path) -> tuple[int, dict[str, PopulationRow]]:
    with zipfile.ZipFile(path) as workbook:
        shared_strings = parse_shared_strings(workbook)
        sheet = ET.fromstring(workbook.read('xl/worksheets/sheet1.xml'))

    population_rows: dict[str, PopulationRow] = {}
    national_total: int | None = None

    for row in sheet.find('x:sheetData', XLSX_NS)[3:]:
        values: dict[str, str] = {}
        for cell in row.findall('x:c', XLSX_NS):
            ref = cell.attrib.get('r', '')
            column = ''.join(ch for ch in ref if ch.isalpha())
            values[column] = cell_value(cell, shared_strings)

        if values.get('D') != '計':
            continue

        code = values.get('A', '')
        prefecture_name = values.get('B', '')
        name = values.get('C', '')
        population = int(values.get('E', '0') or '0')

        if code == '-' and prefecture_name == '合計':
            national_total = population
            continue

        if code == '-' or name == '-':
            continue

        population_rows[code[:5]] = PopulationRow(
            code=code[:5],
            prefecture_name=prefecture_name,
            name=name,
            population=population,
        )

    if national_total is None:
        raise ValueError('Failed to locate national total row in resident registry workbook')

    return national_total, population_rows


def iter_geojson_features(boundary_zip: pathlib.Path):
    ensure_tool('unzip')
    ensure_tool('jq')

    command = (
        f"unzip -p '{boundary_zip}' N03-20250101.geojson "
        "| jq -c '.features[]'"
    )
    with subprocess.Popen(
        ['bash', '-lc', command],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    ) as process:
        assert process.stdout is not None
        for line in process.stdout:
            if line.strip():
                yield json.loads(line)

        stderr = process.stderr.read() if process.stderr else ''
        return_code = process.wait()
        if return_code != 0:
            raise RuntimeError(f'Failed to stream boundary GeoJSON: {stderr.strip()}')


def ring_area_centroid(ring: list[list[float]]) -> tuple[float, float, float]:
    if len(ring) < 4:
        return 0.0, 0.0, 0.0

    area2 = 0.0
    centroid_lng = 0.0
    centroid_lat = 0.0

    for (lng0, lat0), (lng1, lat1) in zip(ring, ring[1:]):
        cross = (lng0 * lat1) - (lng1 * lat0)
        area2 += cross
        centroid_lng += (lng0 + lng1) * cross
        centroid_lat += (lat0 + lat1) * cross

    if math.isclose(area2, 0.0, abs_tol=1e-12):
        return 0.0, 0.0, 0.0

    return (
        area2 / 2.0,
        centroid_lng / (3.0 * area2),
        centroid_lat / (3.0 * area2),
    )


def geometry_centroid(geometry: dict) -> tuple[float, float, float, int]:
    geometry_type = geometry.get('type')
    polygons: list[list[list[list[float]]]]

    if geometry_type == 'Polygon':
        polygons = [geometry['coordinates']]
    elif geometry_type == 'MultiPolygon':
        polygons = geometry['coordinates']
    else:
        raise ValueError(f'Unsupported geometry type: {geometry_type}')

    total_signed_area = 0.0
    weighted_lng = 0.0
    weighted_lat = 0.0
    fallback_lng = 0.0
    fallback_lat = 0.0
    point_count = 0

    for polygon in polygons:
        for ring in polygon:
            point_count += len(ring)
            for lng, lat in ring:
                fallback_lng += lng
                fallback_lat += lat

            signed_area, centroid_lng, centroid_lat = ring_area_centroid(ring)
            if signed_area == 0.0:
                continue

            total_signed_area += signed_area
            weighted_lng += centroid_lng * signed_area
            weighted_lat += centroid_lat * signed_area

    if not math.isclose(total_signed_area, 0.0, abs_tol=1e-12):
        centroid_lng = weighted_lng / total_signed_area
        centroid_lat = weighted_lat / total_signed_area
        return abs(total_signed_area), centroid_lng, centroid_lat, point_count

    if point_count == 0:
        raise ValueError('Geometry contained no points')

    return 0.0, fallback_lng / point_count, fallback_lat / point_count, point_count


def parse_boundary_centroids(path: pathlib.Path) -> dict[str, GeometryAccumulator]:
    geometries: dict[str, GeometryAccumulator] = {}
    feature_count = 0

    for feature in iter_geojson_features(path):
        feature_count += 1
        properties = feature['properties']
        code = properties['N03_007']
        prefecture_name = properties['N03_001']
        weight, centroid_lng, centroid_lat, point_count = geometry_centroid(feature['geometry'])

        accumulator = geometries.setdefault(
            code,
            GeometryAccumulator(prefecture_name=prefecture_name),
        )
        accumulator.add(
            lng=centroid_lng,
            lat=centroid_lat,
            weight=weight,
            point_count=point_count,
        )

        if feature_count % 5000 == 0:
            log(f'Processed {feature_count} boundary features')

    log(f'Processed {feature_count} boundary features total')
    return geometries


def json_literal(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def render_typescript(
    rows: list[dict[str, object]],
    total_population: int,
    unit_count: int,
) -> str:
    lines = [
        '/**',
        ' * Municipality population dataset — generated from official sources.',
        ' *',
        ' * Population: e-Stat resident registry (2025-01-01)',
        ' * Boundaries/Centroids: MLIT National Land Numerical Information N03 (2025)',
        ' * Generated by: tools/build-municipalities.py',
        ' */',
        '',
        'export interface MunicipalityData {',
        '  code: string;',
        '  name: string;',
        '  nameEn: string;',
        '  lat: number;',
        '  lng: number;',
        '  population: number;',
        '  prefectureId: string;',
        '}',
        '',
        'export const MUNICIPALITY_DATA: MunicipalityData[] = [',
    ]

    for row in rows:
        lines.append(
            '  { '
            f"code: '{row['code']}', "
            f"name: {json_literal(row['name'])}, "
            f"nameEn: {json_literal(row['nameEn'])}, "
            f"lat: {row['lat']:.6f}, "
            f"lng: {row['lng']:.6f}, "
            f"population: {row['population']}, "
            f"prefectureId: '{row['prefectureId']}'"
            ' },'
        )

    lines.extend([
        '];',
        '',
        'export const MUNICIPALITY_DATASET_METADATA = {',
        "  sourcePopulation: 'e-Stat resident registry 2025-01-01',",
        "  sourceBoundaries: 'MLIT N03 administrative boundaries 2025',",
        f'  unitCount: {unit_count},',
        f'  totalPopulation: {total_population},',
        "} as const;",
        '',
    ])
    return '\n'.join(lines)


def main() -> None:
    args = parse_args()
    name_en_map = load_name_en_map()

    with tempfile.TemporaryDirectory(prefix='build-municipalities-') as temp_dir_name:
        temp_dir = pathlib.Path(temp_dir_name)
        population_file = args.population_file or download(POPULATION_URL, temp_dir / 'population.xlsx')
        boundary_zip = args.boundary_zip or download(BOUNDARY_URL, temp_dir / 'boundaries.zip')

        national_total, population_rows = parse_population_rows(population_file)
        log(f'Parsed {len(population_rows)} resident registry rows')

        boundary_geometries = parse_boundary_centroids(boundary_zip)
        log(f'Computed centroids for {len(boundary_geometries)} boundary codes')

        missing_population_codes = sorted(
            code for code in boundary_geometries
            if code not in population_rows and code not in UNMATCHED_GEOMETRY_CODES
        )
        if missing_population_codes:
            raise ValueError(f'Missing population rows for boundary codes: {missing_population_codes[:20]}')

        rows: list[dict[str, object]] = []
        for code in sorted(population_rows):
            population_row = population_rows[code]
            geometry = boundary_geometries.get(code)
            if geometry is None:
                continue

            prefecture_id = PREFECTURE_IDS.get(population_row.prefecture_name)
            if prefecture_id is None:
                raise ValueError(f'Unknown prefecture mapping: {population_row.prefecture_name}')

            lat, lng = geometry.centroid()
            rows.append({
                'code': code,
                'name': population_row.name,
                'nameEn': name_en_map.get(population_row.name, population_row.name),
                'lat': lat,
                'lng': lng,
                'population': population_row.population,
                'prefectureId': prefecture_id,
            })

        joined_total = sum(int(row['population']) for row in rows)
        if joined_total != national_total:
            raise ValueError(
                f'Joined population total {joined_total} does not match national total {national_total}'
            )

        output = render_typescript(
            rows=rows,
            total_population=national_total,
            unit_count=len(rows),
        )

        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(output, encoding='utf-8')
        log(f'Wrote {len(rows)} municipalities to {args.output}')


if __name__ == '__main__':
    main()
