import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, {
  Circle,
  G,
  Line,
  Rect,
  Text as SvgText,
} from 'react-native-svg';

import i18n from '../lib/i18n';

type DiaryEntry = {
  id: string;
  createdAt: string;
  mealType: string;
  mealName: string;
  mealComment: string;
  calories: string;
  breadUnits: string;
  protein: string;
  fat: string;
  carbs: string;
  glucoseBefore: string;
  insulinUnits: string;
  glucoseAfter: string;
  userNote: string;
  photoUri?: string;
  photoUris?: string[];
};

type ChartMode = 'all' | 'before' | 'after';

type MeasurePointBase = {
  id: string;
  entryId: string;
  entry: DiaryEntry;
  createdAt: string;
  timeLabel: string;
  fullDateLabel: string;
  dateHeader: string;
  mealName: string;
  value: number;
  kind: 'before' | 'after';
};

type ChartPoint = MeasurePointBase & {
  x: number;
  y: number;
  color: string;
};

const BG = '#f3f4f6';
const CARD = '#ffffff';
const TEXT = '#0f172a';
const MUTED = '#6b7280';
const BLUE = '#2563eb';
const GREEN = '#65a30d';
const ORANGE = '#d97706';
const RED = '#dc2626';
const GRID = '#d1d5db';
const NORMAL_BG = 'rgba(101, 163, 13, 0.12)';
const LINE_COLOR = '#94a3b8';
const POINT_BORDER = '#1f2937';

const SVG_HEIGHT = 290;
const SVG_TOP = 20;
const SVG_BOTTOM = 42;
const SVG_RIGHT_LABELS = 56;
const SVG_LEFT = 26;
const SVG_DRAW_HEIGHT = SVG_HEIGHT - SVG_TOP - SVG_BOTTOM;
const POINT_GAP = 110;

function lang() {
  return String(i18n.locale || 'en').slice(0, 2);
}

function tr(key: string, ru: string, en?: string, lv?: string) {
  const value = i18n.t(key);

  const isMissing =
    !value ||
    value === key ||
    String(value).toLowerCase().includes('missing') ||
    String(value).includes('[missing');

  if (!isMissing) return value;
  if (lang() === 'en') return en || ru;
  if (lang() === 'lv') return lv || en || ru;
  return ru;
}

function localeCode() {
  if (lang() === 'ru') return 'ru-RU';
  if (lang() === 'lv') return 'lv-LV';
  return 'en-US';
}

function parseGlucose(value: string): number | null {
  if (!value) return null;

  const v = String(value).trim().replace(',', '.');
  const match = v.match(/\d+(\.\d+)?/);

  if (!match) return null;

  const num = Number(match[0]);
  return Number.isNaN(num) ? null : num;
}

function formatTime(dateString: string) {
  try {
    return new Date(dateString).toLocaleTimeString(localeCode(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
}

function formatFullDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleString(localeCode(), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
}

function formatDateHeader(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString(localeCode(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function capitalizeFirst(text: string) {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatOne(value: number) {
  return value.toFixed(1).replace('.', ',');
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function getGlucoseColor(value: number) {
  if (value < 4) return BLUE;
  if (value <= 10) return GREEN;
  if (value <= 13.9) return ORANGE;
  return RED;
}

function getGlucoseStatus(value: number) {
  if (value < 4) return tr('glucoseChartLow', 'Низкий', 'Low', 'Zems');
  if (value <= 10) return tr('glucoseChartNormal', 'Норма', 'Normal', 'Norma');
  if (value <= 13.9) {
    return tr('glucoseChartElevated', 'Повышен', 'Elevated', 'Paaugstināts');
  }
  return tr('glucoseChartHigh', 'Высокий', 'High', 'Augsts');
}

function getEntryPhotos(entry: DiaryEntry) {
  const photos: string[] = [];

  if (Array.isArray(entry.photoUris)) {
    entry.photoUris.forEach((uri) => {
      if (uri && !photos.includes(uri)) photos.push(uri);
    });
  }

  if (entry.photoUri && !photos.includes(entry.photoUri)) {
    photos.push(entry.photoUri);
  }

  return photos;
}

function FilterButton({
  title,
  active,
  onPress,
}: {
  title: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: active ? BLUE : CARD,
        borderRadius: 20,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderWidth: 1,
        borderColor: active ? BLUE : '#d1d5db',
        minWidth: 110,
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: active ? '#ffffff' : TEXT,
          fontSize: 14,
          fontWeight: '900',
        }}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function StatCard({
  title,
  value,
  color = TEXT,
}: {
  title: string;
  value: string;
  color?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: CARD,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <Text
        style={{
          color: MUTED,
          fontSize: 14,
          fontWeight: '700',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          color,
          fontSize: 30,
          fontWeight: '900',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function MeasurementBubble({
  value,
  color,
}: {
  value: number;
  color: string;
}) {
  return (
    <View
      style={{
        width: 78,
        height: 78,
        borderRadius: 39,
        backgroundColor: color,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text
        style={{
          color: '#ffffff',
          fontSize: 18,
          fontWeight: '900',
          lineHeight: 20,
        }}
      >
        {formatOne(value)}
      </Text>

      <Text
        style={{
          color: '#ffffff',
          fontSize: 10,
          fontWeight: '800',
          marginTop: 2,
        }}
      >
        {tr('mmol', 'ммоль/л', 'mmol/L', 'mmol/L')}
      </Text>
    </View>
  );
}

function DetailCard({
  point,
  onClose,
}: {
  point: MeasurePointBase;
  onClose: () => void;
}) {
  const entry = point.entry;
  const photos = getEntryPhotos(entry);

  const before = parseGlucose(entry.glucoseBefore);
  const after = parseGlucose(entry.glucoseAfter);
  const diff = before !== null && after !== null ? after - before : null;

  return (
    <View
      style={{
        backgroundColor: CARD,
        borderRadius: 24,
        padding: 16,
        marginBottom: 14,
        borderWidth: 2,
        borderColor: '#bfdbfe',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Text style={{ color: TEXT, fontSize: 21, fontWeight: '900' }}>
          🍽 {tr('entry', 'Запись', 'Entry', 'Ieraksts')}
        </Text>

        <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
          <Text style={{ color: BLUE, fontSize: 15, fontWeight: '900' }}>
            {tr('close', 'Закрыть', 'Close', 'Aizvērt')}
          </Text>
        </TouchableOpacity>
      </View>

      {photos.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
        >
          {photos.map((uri, index) => (
            <View
              key={`${uri}-${index}`}
              style={{
                width: 260,
                marginRight: 12,
              }}
            >
              <Image
                source={{ uri }}
                style={{
                  width: 260,
                  height: 210,
                  borderRadius: 18,
                  backgroundColor: '#e5e7eb',
                }}
                resizeMode="cover"
              />

              <Text
                style={{
                  marginTop: 6,
                  color: MUTED,
                  fontSize: 13,
                  fontWeight: '800',
                  textAlign: 'center',
                }}
              >
                Фото {index + 1}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <View
          style={{
            height: 120,
            borderRadius: 18,
            backgroundColor: '#f1f5f9',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text style={{ color: MUTED, fontWeight: '800' }}>
            {tr('noPhoto', 'Фото нет', 'No photo', 'Nav foto')}
          </Text>
        </View>
      )}

      <Text style={{ color: TEXT, fontSize: 20, fontWeight: '900' }}>
        {entry.mealName || tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma')}
      </Text>

      <Text style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>
        {entry.mealType || tr('mealTypeFallback', 'Приём пищи', 'Meal', 'Ēdienreize')} •{' '}
        {formatFullDate(entry.createdAt)}
      </Text>

      <View
        style={{
          backgroundColor: '#f8fafc',
          borderRadius: 18,
          padding: 14,
          marginTop: 12,
        }}
      >
        <Text style={{ color: TEXT, fontSize: 16, fontWeight: '900' }}>
          {tr('sugar', 'Сахар', 'Glucose', 'Cukurs')}: {entry.glucoseBefore || '-'} →{' '}
          {entry.glucoseAfter || '-'}
          {diff !== null ? ` (${diff >= 0 ? '+' : ''}${formatOne(diff)})` : ''}
        </Text>

        <Text
          style={{
            color: getGlucoseColor(point.value),
            fontSize: 14,
            fontWeight: '900',
            marginTop: 6,
          }}
        >
          {tr('selectedPoint', 'Нажатая точка', 'Selected point', 'Izvēlētais punkts')}:{' '}
          {point.kind === 'before'
            ? tr('beforeMealSmall', 'до еды', 'before meal', 'pirms ēšanas')
            : tr('afterMealSmall', 'после еды', 'after meal', 'pēc ēšanas')}
          {' — '}
          {formatOne(point.value)} {tr('mmol', 'ммоль/л', 'mmol/L', 'mmol/L')}
        </Text>
      </View>

      <Text
        style={{
          color: MUTED,
          fontSize: 14,
          marginTop: 12,
          lineHeight: 21,
        }}
      >
        {tr('breadUnitsShort', 'ХЕ', 'BU', 'XE')}: {entry.breadUnits || '-'} ·{' '}
        {tr('carbs', 'Углеводы', 'Carbs', 'Ogļhidrāti')}: {entry.carbs || '-'} ·{' '}
        {tr('calories', 'Калории', 'Calories', 'Kalorijas')}: {entry.calories || '-'} ·{' '}
        {tr('insulin', 'Инсулин', 'Insulin', 'Insulīns')}: {entry.insulinUnits || '-'}
      </Text>

      {!!entry.mealComment && (
        <Text style={{ color: TEXT, fontSize: 14, marginTop: 10, lineHeight: 21 }}>
          {tr('mealComment', 'Комментарий к еде', 'Meal comment', 'Ēdiena komentārs')}:{' '}
          {entry.mealComment}
        </Text>
      )}

      {!!entry.userNote && (
        <Text style={{ color: TEXT, fontSize: 14, marginTop: 8, lineHeight: 21 }}>
          {tr('note', 'Заметка', 'Note', 'Piezīme')}: {entry.userNote}
        </Text>
      )}
    </View>
  );
}

export default function GlucoseChartScreen() {
  const router = useRouter();

  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [chartMode, setChartMode] = useState<ChartMode>('all');
  const [selectedPoint, setSelectedPoint] = useState<MeasurePointBase | null>(null);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('history');
      const parsed = saved ? JSON.parse(saved) : [];

      setEntries(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.log('Glucose chart loading error:', error);
      setEntries([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const allMeasures = useMemo<MeasurePointBase[]>(() => {
    const result: MeasurePointBase[] = [];

    entries
      .slice()
      .reverse()
      .forEach((item) => {
        const before = parseGlucose(item.glucoseBefore);
        const after = parseGlucose(item.glucoseAfter);

        if (before !== null) {
          result.push({
            id: `${item.id}-before`,
            entryId: item.id,
            entry: item,
            createdAt: item.createdAt,
            timeLabel: formatTime(item.createdAt),
            fullDateLabel: formatFullDate(item.createdAt),
            dateHeader: capitalizeFirst(formatDateHeader(item.createdAt)),
            mealName:
              item.mealName ||
              tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma'),
            value: before,
            kind: 'before',
          });
        }

        if (after !== null) {
          result.push({
            id: `${item.id}-after`,
            entryId: item.id,
            entry: item,
            createdAt: item.createdAt,
            timeLabel: formatTime(item.createdAt),
            fullDateLabel: formatFullDate(item.createdAt),
            dateHeader: capitalizeFirst(formatDateHeader(item.createdAt)),
            mealName:
              item.mealName ||
              tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma'),
            value: after,
            kind: 'after',
          });
        }
      });

    return result.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [entries]);

  const filteredMeasuresBase = useMemo(() => {
    if (chartMode === 'before') {
      return allMeasures.filter((item) => item.kind === 'before');
    }

    if (chartMode === 'after') {
      return allMeasures.filter((item) => item.kind === 'after');
    }

    return allMeasures;
  }, [allMeasures, chartMode]);

  const chartTopValue = useMemo(() => {
    const values = filteredMeasuresBase.map((item) => item.value);

    if (!values.length) return 16.6;

    return Math.max(16.6, Math.ceil(Math.max(...values) + 1));
  }, [filteredMeasuresBase]);

  const yTicks = useMemo(() => {
    if (chartTopValue <= 16.6) {
      return [16.6, 13.9, 10.0, 3.9, 3.0, 0.0];
    }

    const step = chartTopValue / 5;

    return [
      chartTopValue,
      chartTopValue - step,
      chartTopValue - step * 2,
      chartTopValue - step * 3,
      chartTopValue - step * 4,
      0.0,
    ];
  }, [chartTopValue]);

  const svgYFromValue = useCallback(
    (value: number) => {
      const safeValue = Math.max(0, Math.min(chartTopValue, value));
      const ratio = safeValue / chartTopValue;

      return SVG_HEIGHT - SVG_BOTTOM - ratio * SVG_DRAW_HEIGHT;
    },
    [chartTopValue]
  );

  const chartPoints = useMemo<ChartPoint[]>((() => {
    return filteredMeasuresBase.map((item, index) => ({
      ...item,
      x: SVG_LEFT + index * POINT_GAP,
      y: svgYFromValue(item.value),
      color: getGlucoseColor(item.value),
    }));
  }) as any, [filteredMeasuresBase, svgYFromValue]);

  const svgWidth = Math.max(
    640,
    SVG_LEFT + Math.max(chartPoints.length - 1, 0) * POINT_GAP + 90
  );

  const latest = chartPoints.length ? chartPoints[chartPoints.length - 1] : null;

  const averageBefore = useMemo(() => {
    const values = allMeasures
      .filter((item) => item.kind === 'before')
      .map((item) => item.value);

    return average(values);
  }, [allMeasures]);

  const averageAfter = useMemo(() => {
    const values = allMeasures
      .filter((item) => item.kind === 'after')
      .map((item) => item.value);

    return average(values);
  }, [allMeasures]);

  const lowCount = filteredMeasuresBase.filter((item) => item.value < 4).length;

  const inRangeCount = filteredMeasuresBase.filter(
    (item) => item.value >= 4 && item.value <= 10
  ).length;

  const highCount = filteredMeasuresBase.filter((item) => item.value > 10).length;

  const groupedMeasures = useMemo(() => {
    const groups: { date: string; items: MeasurePointBase[] }[] = [];

    filteredMeasuresBase
      .slice()
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .forEach((item) => {
        const existing = groups.find((group) => group.date === item.dateHeader);

        if (existing) {
          existing.items.push(item);
        } else {
          groups.push({
            date: item.dateHeader,
            items: [item],
          });
        }
      });

    return groups;
  }, [filteredMeasuresBase]);

  const hasData = chartPoints.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 34 }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: CARD,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 14,
            marginBottom: 14,
            borderWidth: 1,
            borderColor: '#d1d5db',
          }}
        >
          <Text style={{ color: TEXT, fontWeight: '800', fontSize: 15 }}>
            ← {tr('back', 'Назад', 'Back', 'Atpakaļ')}
          </Text>
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: CARD,
            borderRadius: 28,
            padding: 22,
            marginBottom: 16,
          }}
        >
          <Text
            style={{
              color: TEXT,
              fontSize: 28,
              fontWeight: '900',
              marginBottom: 8,
            }}
          >
            {tr('glucoseChartTitle', 'Динамика сахара', 'Glucose dynamics', 'Cukura dinamika')}
          </Text>

          <Text
            style={{
              color: MUTED,
              fontSize: 16,
              lineHeight: 23,
            }}
          >
            {tr(
              'glucoseChartSubtitle',
              'Нажми на любую точку графика, чтобы увидеть еду, сахар и фото блюда.',
              'Tap any chart point to see food, glucose and dish photo.',
              'Pieskaries jebkuram grafika punktam, lai redzētu ēdienu, cukuru un foto.'
            )}
          </Text>
        </View>

        {latest && (
          <View
            style={{
              backgroundColor: CARD,
              borderRadius: 24,
              padding: 20,
              marginBottom: 14,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16, color: MUTED, fontWeight: '700' }}>
              {tr('currentSugar', 'Текущий сахар', 'Current glucose', 'Pašreizējais cukurs')}
            </Text>

            <Text
              style={{
                fontSize: 46,
                fontWeight: '900',
                color: latest.color,
                marginTop: 6,
              }}
            >
              {formatOne(latest.value)}
            </Text>

            <Text style={{ fontSize: 14, color: MUTED, marginTop: 4 }}>
              {tr('mmol', 'ммоль/л', 'mmol/L', 'mmol/L')}
            </Text>

            <Text style={{ fontSize: 14, color: MUTED, marginTop: 6 }}>
              {latest.kind === 'before'
                ? tr('beforeMeal', 'До еды', 'Before meal', 'Pirms ēšanas')
                : tr('afterMeal', 'После еды', 'After meal', 'Pēc ēšanas')}{' '}
              • {latest.timeLabel}
            </Text>
          </View>
        )}

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <FilterButton
            title={tr('filterAll', 'ВСЁ', 'ALL', 'VISI')}
            active={chartMode === 'all'}
            onPress={() => {
              setChartMode('all');
              setSelectedPoint(null);
            }}
          />

          <FilterButton
            title={tr('filterBefore', 'ДО ЕДЫ', 'BEFORE', 'PIRMS')}
            active={chartMode === 'before'}
            onPress={() => {
              setChartMode('before');
              setSelectedPoint(null);
            }}
          />

          <FilterButton
            title={tr('filterAfter', 'ПОСЛЕ ЕДЫ', 'AFTER', 'PĒC')}
            active={chartMode === 'after'}
            onPress={() => {
              setChartMode('after');
              setSelectedPoint(null);
            }}
          />
        </View>

        {!hasData ? (
          <View
            style={{
              backgroundColor: CARD,
              borderRadius: 24,
              padding: 24,
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                fontSize: 22,
                fontWeight: '900',
                color: TEXT,
                marginBottom: 8,
                textAlign: 'center',
              }}
            >
              {tr('noChartData', 'Нет данных для графика', 'No chart data', 'Nav datu grafikam')}
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: MUTED,
                lineHeight: 24,
                textAlign: 'center',
              }}
            >
              {tr(
                'addSugarEntries',
                'Добавь записи с сахаром, и здесь появятся точки.',
                'Add entries with glucose values and points will appear here.',
                'Pievieno ierakstus ar cukura vērtībām, un šeit parādīsies punkti.'
              )}
            </Text>
          </View>
        ) : (
          <>
            <View
              style={{
                backgroundColor: CARD,
                borderRadius: 24,
                paddingVertical: 16,
                paddingHorizontal: 8,
                marginBottom: 14,
              }}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Svg width={svgWidth + SVG_RIGHT_LABELS} height={SVG_HEIGHT}>
                  <Rect
                    x={0}
                    y={svgYFromValue(10.0)}
                    width={svgWidth}
                    height={svgYFromValue(3.9) - svgYFromValue(10.0)}
                    fill={NORMAL_BG}
                    rx={12}
                  />

                  {yTicks.map((tick, index) => (
                    <Line
                      key={`grid-${index}`}
                      x1={0}
                      y1={svgYFromValue(tick)}
                      x2={svgWidth}
                      y2={svgYFromValue(tick)}
                      stroke={GRID}
                      strokeWidth={tick === 0 ? 0 : 1}
                    />
                  ))}

                  {chartPoints.map((point, index) => {
                    const next = chartPoints[index + 1];

                    if (!next) return null;

                    return (
                      <Line
                        key={`line-${point.id}`}
                        x1={point.x}
                        y1={point.y}
                        x2={next.x}
                        y2={next.y}
                        stroke={LINE_COLOR}
                        strokeWidth={4}
                        strokeLinecap="round"
                      />
                    );
                  })}

                  {chartPoints.map((point) => {
                    const selected = selectedPoint?.id === point.id;

                    return (
                      <G key={point.id}>
                        <Line
                          x1={point.x}
                          y1={SVG_HEIGHT - 24}
                          x2={point.x}
                          y2={point.y}
                          stroke={selected ? '#93c5fd' : '#e5e7eb'}
                          strokeWidth={selected ? 4 : 2}
                        />

                        <Rect
                          x={point.x - 31}
                          y={point.y - 45}
                          width={62}
                          height={31}
                          rx={10}
                          fill={selected ? '#eff6ff' : '#ffffff'}
                          stroke={selected ? BLUE : '#d1d5db'}
                          strokeWidth={selected ? 2 : 1}
                          onPressIn={() => setSelectedPoint(point)}
                        />

                        <SvgText
                          x={point.x}
                          y={point.y - 24}
                          fill={TEXT}
                          fontSize="12"
                          fontWeight="900"
                          textAnchor="middle"
                          onPressIn={() => setSelectedPoint(point)}
                        >
                          {formatOne(point.value)}
                        </SvgText>

                        <Circle
                          cx={point.x}
                          cy={point.y}
                          r={selected ? 18 : point.kind === 'before' ? 14 : 11}
                          fill={point.color}
                          stroke={selected ? BLUE : POINT_BORDER}
                          strokeWidth={selected ? 4 : 2}
                          onPressIn={() => setSelectedPoint(point)}
                        />

                        {chartMode === 'all' && (
                          <SvgText
                            x={point.x}
                            y={point.y + (point.kind === 'before' ? 5 : 4)}
                            fill="#ffffff"
                            fontSize={point.kind === 'before' ? '8' : '7'}
                            fontWeight="900"
                            textAnchor="middle"
                            onPressIn={() => setSelectedPoint(point)}
                          >
                            {point.kind === 'before'
                              ? tr('shortBefore', 'ДО', 'BEF', 'PIR')
                              : tr('shortAfter', 'ПОСЛЕ', 'AFT', 'PĒC')}
                          </SvgText>
                        )}

                        <Circle
                          cx={point.x}
                          cy={point.y}
                          r={46}
                          fill="#000000"
                          opacity={0.01}
                          onPressIn={() => setSelectedPoint(point)}
                        />

                        <SvgText
                          x={point.x}
                          y={SVG_HEIGHT - 8}
                          fill="#404040"
                          fontSize="11"
                          fontWeight="700"
                          textAnchor="middle"
                        >
                          {point.timeLabel}
                        </SvgText>
                      </G>
                    );
                  })}

                  {yTicks.map((tick) => (
                    <SvgText
                      key={`tick-${tick}`}
                      x={svgWidth + SVG_RIGHT_LABELS - 6}
                      y={svgYFromValue(tick) + 4}
                      fill="#404040"
                      fontSize="12"
                      textAnchor="end"
                    >
                      {tick.toFixed(1).replace('.', ',')}
                    </SvgText>
                  ))}
                </Svg>
              </ScrollView>
            </View>

            {selectedPoint && (
              <DetailCard
                point={selectedPoint}
                onClose={() => setSelectedPoint(null)}
              />
            )}

            <StatCard
              title={tr(
                'avgSugarBefore',
                'Средний сахар до еды',
                'Average glucose before meal',
                'Vidējais cukurs pirms ēšanas'
              )}
              value={
                averageBefore !== null
                  ? formatOne(averageBefore)
                  : tr('noData', 'Нет данных', 'No data', 'Nav datu')
              }
            />

            <StatCard
              title={tr(
                'avgSugarAfter',
                'Средний сахар после еды',
                'Average glucose after meal',
                'Vidējais cukurs pēc ēšanas'
              )}
              value={
                averageAfter !== null
                  ? formatOne(averageAfter)
                  : tr('noData', 'Нет данных', 'No data', 'Nav datu')
              }
            />

            <StatCard
              title={tr('normalSugar', 'Норма', 'Normal', 'Norma')}
              value={String(inRangeCount)}
              color={GREEN}
            />

            <StatCard
              title={tr('lowSugar', 'Низкий сахар', 'Low glucose', 'Zems cukurs')}
              value={String(lowCount)}
              color={BLUE}
            />

            <StatCard
              title={tr('highSugar', 'Высокий сахар', 'High glucose', 'Augsts cukurs')}
              value={String(highCount)}
              color={RED}
            />

            {groupedMeasures.map((group) => (
              <View key={group.date} style={{ marginBottom: 16 }}>
                <View
                  style={{
                    backgroundColor: GREEN,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    borderTopLeftRadius: 20,
                    borderTopRightRadius: 20,
                  }}
                >
                  <Text
                    style={{
                      color: '#ffffff',
                      fontSize: 18,
                      fontWeight: '900',
                    }}
                  >
                    {group.date}
                  </Text>
                </View>

                <View
                  style={{
                    backgroundColor: CARD,
                    borderBottomLeftRadius: 20,
                    borderBottomRightRadius: 20,
                    overflow: 'hidden',
                  }}
                >
                  {group.items.map((item, index) => (
                    <TouchableOpacity
                      key={item.id}
                      onPress={() => setSelectedPoint(item)}
                      activeOpacity={0.85}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 16,
                        paddingVertical: 16,
                        borderTopWidth: index === 0 ? 0 : 1,
                        borderTopColor: '#e5e7eb',
                      }}
                    >
                      <Text
                        style={{
                          width: 64,
                          color: '#374151',
                          fontSize: 16,
                          fontWeight: '500',
                        }}
                      >
                        {item.timeLabel}
                      </Text>

                      <MeasurementBubble
                        value={item.value}
                        color={getGlucoseColor(item.value)}
                      />

                      <View style={{ flex: 1, marginLeft: 14 }}>
                        <Text
                          style={{
                            color: TEXT,
                            fontSize: 17,
                            fontWeight: '900',
                            marginBottom: 4,
                          }}
                        >
                          {item.kind === 'before'
                            ? tr('beforeMeal', 'До еды', 'Before meal', 'Pirms ēšanas')
                            : tr('afterMeal', 'После еды', 'After meal', 'Pēc ēšanas')}
                        </Text>

                        <Text
                          style={{
                            color: MUTED,
                            fontSize: 14,
                            marginBottom: 4,
                          }}
                        >
                          {item.mealName}
                        </Text>

                        <Text
                          style={{
                            color: getGlucoseColor(item.value),
                            fontSize: 14,
                            fontWeight: '800',
                          }}
                        >
                          {getGlucoseStatus(item.value)} ·{' '}
                          {tr(
                            'tapToOpenEntry',
                            'нажми, чтобы открыть запись',
                            'tap to open entry',
                            'pieskaries, lai atvērtu ierakstu'
                          )}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}