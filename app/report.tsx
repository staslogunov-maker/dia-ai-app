import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

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

type ProblemMeal = DiaryEntry & {
  before: number | null;
  after: number;
  diff: number | null;
  reason: string;
};

type ChartPoint = {
  value: number;
  label: string;
  type: string;
};

const BG = '#f3f4f6';
const CARD = '#ffffff';
const TEXT = '#0f172a';
const MUTED = '#6b7280';
const BLUE = '#2563eb';
const GREEN = '#16a34a';
const ORANGE = '#d97706';
const RED = '#dc2626';

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

function parseNumber(value: string): number | null {
  if (!value) return null;

  const cleaned = String(value)
    .replace(',', '.')
    .replace(/[^0-9.]/g, '');

  if (!cleaned) return null;

  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

function formatOne(value: number) {
  return value.toFixed(1).replace('.', ',');
}

function formatDate(dateString: string) {
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

function formatShortDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleDateString(localeCode(), {
      day: '2-digit',
      month: '2-digit',
    });
  } catch {
    return '';
  }
}

function escapeHtml(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getPhotoUris(item: DiaryEntry) {
  const list: string[] = [];

  if (Array.isArray(item.photoUris)) {
    item.photoUris.forEach((uri) => {
      if (uri && !list.includes(uri)) list.push(uri);
    });
  }

  if (item.photoUri && !list.includes(item.photoUri)) {
    list.unshift(item.photoUri);
  }

  return list;
}

async function imageToBase64(uri?: string) {
  try {
    if (!uri) return '';

    if (uri.startsWith('data:image')) return uri;

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64',
    });

    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return '';
  }
}

function getStatusColor(value: number) {
  if (value < 4) return BLUE;
  if (value <= 10) return GREEN;
  if (value <= 13.9) return ORANGE;
  return RED;
}

function getStatusText(value: number) {
  if (value < 4) return tr('reportLowSugar', 'Низкий сахар', 'Low glucose', 'Zems cukurs');
  if (value <= 10) return tr('reportNormalSugar', 'В норме', 'Normal', 'Normāls');
  if (value <= 13.9) return tr('reportElevatedSugar', 'Повышен', 'Elevated', 'Paaugstināts');
  return tr('reportHighSugar', 'Высокий сахар', 'High glucose', 'Augsts cukurs');
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function buildChartSvg(points: ChartPoint[]) {
  if (points.length < 2) {
    return `<div class="box">Недостаточно данных для графика.</div>`;
  }

  const width = 900;
  const height = 360;
  const padLeft = 55;
  const padRight = 25;
  const padTop = 25;
  const padBottom = 55;

  const values = points.map((p) => p.value);
  const minValue = Math.min(3, ...values);
  const maxValue = Math.max(14, ...values);

  const xStep = (width - padLeft - padRight) / Math.max(points.length - 1, 1);

  const yFor = (value: number) => {
    const usable = height - padTop - padBottom;
    return padTop + (maxValue - value) * (usable / (maxValue - minValue));
  };

  const xFor = (index: number) => padLeft + index * xStep;

  const polyline = points
    .map((point, index) => `${xFor(index)},${yFor(point.value)}`)
    .join(' ');

  const normalTop = yFor(10);
  const normalBottom = yFor(4);

  const circles = points
    .map((point, index) => {
      const x = xFor(index);
      const y = yFor(point.value);
      const color = getStatusColor(point.value);

      return `
        <circle cx="${x}" cy="${y}" r="7" fill="${color}" />
        <text x="${x}" y="${y - 12}" font-size="16" text-anchor="middle" fill="#0f172a">${formatOne(point.value)}</text>
      `;
    })
    .join('');

  const labels = points
    .map((point, index) => {
      if (index % Math.ceil(points.length / 6) !== 0 && index !== points.length - 1) {
        return '';
      }

      const x = xFor(index);

      return `
        <text x="${x}" y="${height - 18}" font-size="14" text-anchor="middle" fill="#6b7280">
          ${escapeHtml(point.label)}
        </text>
      `;
    })
    .join('');

  return `
    <svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="#f8fafc" />
      <rect x="${padLeft}" y="${normalTop}" width="${width - padLeft - padRight}" height="${normalBottom - normalTop}" fill="#dcfce7" opacity="0.8" />

      <line x1="${padLeft}" y1="${yFor(4)}" x2="${width - padRight}" y2="${yFor(4)}" stroke="#16a34a" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${padLeft}" y1="${yFor(10)}" x2="${width - padRight}" y2="${yFor(10)}" stroke="#16a34a" stroke-width="2" stroke-dasharray="6 6" />
      <line x1="${padLeft}" y1="${yFor(13.9)}" x2="${width - padRight}" y2="${yFor(13.9)}" stroke="#d97706" stroke-width="2" stroke-dasharray="6 6" />

      <line x1="${padLeft}" y1="${padTop}" x2="${padLeft}" y2="${height - padBottom}" stroke="#cbd5e1" stroke-width="2" />
      <line x1="${padLeft}" y1="${height - padBottom}" x2="${width - padRight}" y2="${height - padBottom}" stroke="#cbd5e1" stroke-width="2" />

      <text x="10" y="${yFor(4) + 5}" font-size="14" fill="#16a34a">4</text>
      <text x="10" y="${yFor(10) + 5}" font-size="14" fill="#16a34a">10</text>
      <text x="10" y="${yFor(13.9) + 5}" font-size="14" fill="#d97706">13.9</text>

      <polyline points="${polyline}" fill="none" stroke="#2563eb" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
      ${circles}
      ${labels}
    </svg>
  `;
}

function StatBox({
  label,
  value,
  color = BLUE,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <View
      style={{
        width: '31%',
        backgroundColor: '#eff6ff',
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 8,
        alignItems: 'center',
      }}
    >
      <Text style={{ color, fontSize: 22, fontWeight: '900' }}>{value}</Text>
      <Text
        style={{
          color: MUTED,
          fontSize: 12,
          marginTop: 5,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: CARD,
        borderRadius: 24,
        padding: 16,
        marginBottom: 14,
      }}
    >
      {children}
    </View>
  );
}

function PrimaryButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{
        backgroundColor: disabled ? '#93c5fd' : BLUE,
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        marginBottom: 12,
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '900' }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({
  title,
  onPress,
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: CARD,
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#d1d5db',
      }}
    >
      <Text style={{ color: TEXT, fontSize: 16, fontWeight: '800' }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function ReportScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [creatingPdf, setCreatingPdf] = useState(false);

  const loadHistory = async () => {
    try {
      const data = await AsyncStorage.getItem('history');
      const history = data ? JSON.parse(data) : [];
      setEntries(Array.isArray(history) ? history : []);
    } catch (error) {
      console.log('Report loading error:', error);
      setEntries([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const goHome = () => {
    try {
      router.replace('/');
    } catch {
      router.push('/');
    }
  };

  const sortedEntries = useMemo(() => {
    return [...entries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [entries]);

  const glucoseValues = useMemo(() => {
    return entries
      .flatMap((item) => [parseNumber(item.glucoseBefore), parseNumber(item.glucoseAfter)])
      .filter((value): value is number => value !== null);
  }, [entries]);

  const chartPoints = useMemo<ChartPoint[]>(() => {
    const result: ChartPoint[] = [];

    sortedEntries.forEach((item) => {
      const before = parseNumber(item.glucoseBefore);
      const after = parseNumber(item.glucoseAfter);
      const label = formatShortDate(item.createdAt);

      if (before !== null) {
        result.push({
          value: before,
          label,
          type: tr('beforeMealShort', 'до', 'before', 'pirms'),
        });
      }

      if (after !== null) {
        result.push({
          value: after,
          label,
          type: tr('afterMealShort', 'после', 'after', 'pēc'),
        });
      }
    });

    return result;
  }, [sortedEntries]);

  const avg = average(glucoseValues);
  const min = glucoseValues.length ? Math.min(...glucoseValues) : null;
  const max = glucoseValues.length ? Math.max(...glucoseValues) : null;

  const normalCount = glucoseValues.filter((value) => value >= 4 && value <= 10).length;
  const highCount = glucoseValues.filter((value) => value > 10).length;
  const lowCount = glucoseValues.filter((value) => value < 4).length;

  const problemMeals = useMemo<ProblemMeal[]>(() => {
    return entries
      .map((item) => {
        const before = parseNumber(item.glucoseBefore);
        const after = parseNumber(item.glucoseAfter);

        if (after === null) return null;

        const diff = before !== null ? after - before : null;
        const sugarOutOfRange = after > 10 || after < 4;
        const bigJump = diff !== null && diff >= 2;

        if (!sugarOutOfRange && !bigJump) return null;

        let reason = '';

        if (after > 10) {
          reason = tr('reportReasonHigh', 'сахар вышел выше нормы', 'glucose went above normal', 'cukurs pārsniedza normu');
        } else if (after < 4) {
          reason = tr('reportReasonLow', 'сахар упал ниже нормы', 'glucose dropped below normal', 'cukurs nokritās zem normas');
        } else if (bigJump) {
          reason = tr('reportReasonJump', 'сахар заметно вырос после еды', 'glucose rose noticeably after meal', 'cukurs ievērojami pieauga pēc ēšanas');
        }

        return {
          ...item,
          before,
          after,
          diff,
          reason,
        };
      })
      .filter((item): item is ProblemMeal => item !== null)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [entries]);

  const aiSummary = useMemo(() => {
    if (!entries.length) {
      return tr(
        'reportAiSummaryNoData',
        'Пока мало данных. Добавь несколько записей с сахаром до и после еды, чтобы получить полезный вывод.',
        'There is not enough data yet. Add several entries with glucose before and after meals to get a useful summary.',
        'Pagaidām datu ir maz. Pievieno vairākus ierakstus ar cukuru pirms un pēc ēšanas, lai saņemtu noderīgu secinājumu.'
      );
    }

    if (!problemMeals.length) {
      return tr(
        'reportAiSummaryGood',
        'По текущим записям проблемных блюд не найдено. Большинство значений выглядит спокойно.',
        'No problem foods were found in current entries. Most values look stable.',
        'Pašreizējos ierakstos problemātiski ēdieni nav atrasti. Lielākā daļa vērtību izskatās mierīgi.'
      );
    }

    const top = problemMeals
      .slice(0, 3)
      .map((item) => item.mealName || tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma'));

    return tr(
      'reportAiSummaryProblems',
      `Найдено проблемных записей: ${problemMeals.length}. Обрати внимание на блюда: ${top.join(', ')}. Именно после них сахар выходил за пределы или заметно рос.`,
      `Problem entries found: ${problemMeals.length}. Pay attention to: ${top.join(', ')}. After these meals glucose went out of range or rose noticeably.`,
      `Atrasti problemātiski ieraksti: ${problemMeals.length}. Pievērs uzmanību ēdieniem: ${top.join(', ')}. Tieši pēc tiem cukurs izgāja ārpus normas vai ievērojami pieauga.`
    );
  }, [entries.length, problemMeals]);

  const createPdfReport = async () => {
    try {
      if (!entries.length) {
        Alert.alert(
          tr('noData', 'Нет данных', 'No data', 'Nav datu'),
          tr('reportAddEntriesFirst', 'Сначала добавь записи в дневник.', 'Add entries to the diary first.', 'Vispirms pievieno ierakstus dienasgrāmatā.')
        );
        return;
      }

      setCreatingPdf(true);

      const chartSvg = buildChartSvg(chartPoints);

      const problemBlocks = await Promise.all(
        problemMeals.slice(0, 20).map(async (item, index) => {
          const photos = getPhotoUris(item);
          const firstPhoto = await imageToBase64(photos[0]);

          const beforeText = item.before !== null ? formatOne(item.before) : '-';
          const afterText = formatOne(item.after);
          const diffText =
            item.diff !== null ? `${item.diff >= 0 ? '+' : ''}${formatOne(item.diff)}` : '';

          return `
            <div class="meal">
              <h3>${index + 1}. ${escapeHtml(item.mealName || tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma'))}</h3>
              <p class="muted">${escapeHtml(formatDate(item.createdAt))} · ${escapeHtml(item.mealType || '')}</p>
              ${
                firstPhoto
                  ? `<img class="food-img" src="${firstPhoto}" />`
                  : `<div class="no-photo">${escapeHtml(tr('noPhoto', 'Фото нет', 'No photo', 'Nav foto'))}</div>`
              }
              <p><b>${escapeHtml(tr('sugar', 'Сахар', 'Glucose', 'Cukurs'))}:</b> ${beforeText} → ${afterText} ${diffText ? `(${diffText})` : ''}</p>
              <p><b>${escapeHtml(tr('reason', 'Причина', 'Reason', 'Iemesls'))}:</b> ${escapeHtml(item.reason)}</p>
              <p><b>${escapeHtml(tr('breadUnitsShort', 'ХЕ', 'BU', 'XE'))}:</b> ${escapeHtml(item.breadUnits || '-')} · <b>${escapeHtml(tr('carbs', 'Углеводы', 'Carbs', 'Ogļhidrāti'))}:</b> ${escapeHtml(item.carbs || '-')} · <b>${escapeHtml(tr('calories', 'Калории', 'Calories', 'Kalorijas'))}:</b> ${escapeHtml(item.calories || '-')} · <b>${escapeHtml(tr('insulin', 'Инсулин', 'Insulin', 'Insulīns'))}:</b> ${escapeHtml(item.insulinUnits || '-')}</p>
              ${
                item.userNote
                  ? `<p><b>${escapeHtml(tr('note', 'Заметка', 'Note', 'Piezīme'))}:</b> ${escapeHtml(item.userNote)}</p>`
                  : ''
              }
            </div>
          `;
        })
      );

      const diaryBlocks = await Promise.all(
        [...entries]
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map(async (item, index) => {
            const photos = getPhotoUris(item);
            const photoBlocks = await Promise.all(
              photos.slice(0, 4).map(async (uri, photoIndex) => {
                const base64 = await imageToBase64(uri);

                if (!base64) return '';

                return `
                  <div class="diary-photo-wrap">
                    <img class="diary-img" src="${base64}" />
                    <div class="photo-label">${escapeHtml(tr('photo', 'Фото', 'Photo', 'Foto'))} ${photoIndex + 1}</div>
                  </div>
                `;
              })
            );

            return `
              <div class="diary-entry">
                <h3>${index + 1}. ${escapeHtml(item.mealName || tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma'))}</h3>
                <p class="muted">${escapeHtml(formatDate(item.createdAt))} · ${escapeHtml(item.mealType || '')}</p>

                ${
                  photoBlocks.filter(Boolean).length
                    ? `<div class="photo-grid">${photoBlocks.join('')}</div>`
                    : `<div class="no-photo">${escapeHtml(tr('noPhoto', 'Фото нет', 'No photo', 'Nav foto'))}</div>`
                }

                <table>
                  <tr>
                    <td><b>${escapeHtml(tr('glucoseBefore', 'Сахар до еды', 'Glucose before meal', 'Cukurs pirms ēšanas'))}</b></td>
                    <td>${escapeHtml(item.glucoseBefore || '-')}</td>
                    <td><b>${escapeHtml(tr('glucoseAfter', 'Сахар после еды', 'Glucose after meal', 'Cukurs pēc ēšanas'))}</b></td>
                    <td>${escapeHtml(item.glucoseAfter || '-')}</td>
                  </tr>
                  <tr>
                    <td><b>${escapeHtml(tr('calories', 'Калории', 'Calories', 'Kalorijas'))}</b></td>
                    <td>${escapeHtml(item.calories || '-')}</td>
                    <td><b>${escapeHtml(tr('breadUnitsShort', 'ХЕ', 'BU', 'XE'))}</b></td>
                    <td>${escapeHtml(item.breadUnits || '-')}</td>
                  </tr>
                  <tr>
                    <td><b>${escapeHtml(tr('protein', 'Белки', 'Protein', 'Olbaltumvielas'))}</b></td>
                    <td>${escapeHtml(item.protein || '-')}</td>
                    <td><b>${escapeHtml(tr('fat', 'Жиры', 'Fat', 'Tauki'))}</b></td>
                    <td>${escapeHtml(item.fat || '-')}</td>
                  </tr>
                  <tr>
                    <td><b>${escapeHtml(tr('carbs', 'Углеводы', 'Carbs', 'Ogļhidrāti'))}</b></td>
                    <td>${escapeHtml(item.carbs || '-')}</td>
                    <td><b>${escapeHtml(tr('insulin', 'Инсулин', 'Insulin', 'Insulīns'))}</b></td>
                    <td>${escapeHtml(item.insulinUnits || '-')}</td>
                  </tr>
                </table>

                ${
                  item.mealComment
                    ? `<p><b>${escapeHtml(tr('mealComment', 'Комментарий к еде', 'Meal comment', 'Ēdiena komentārs'))}:</b> ${escapeHtml(item.mealComment)}</p>`
                    : ''
                }

                ${
                  item.userNote
                    ? `<p><b>${escapeHtml(tr('note', 'Заметка', 'Note', 'Piezīme'))}:</b> ${escapeHtml(item.userNote)}</p>`
                    : ''
                }
              </div>
            `;
          })
      );

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 24px;
                color: #0f172a;
              }
              h1 {
                font-size: 28px;
                margin-bottom: 4px;
              }
              h2 {
                font-size: 22px;
                margin-top: 30px;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 8px;
              }
              h3 {
                font-size: 18px;
                margin-bottom: 4px;
              }
              .muted {
                color: #6b7280;
              }
              .box {
                background: #eff6ff;
                border-radius: 14px;
                padding: 14px;
                margin: 10px 0;
              }
              .grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
              }
              .stat {
                background: #f8fafc;
                border-radius: 12px;
                padding: 12px;
                text-align: center;
              }
              .stat b {
                font-size: 22px;
                color: #2563eb;
              }
              .meal, .diary-entry {
                page-break-inside: avoid;
                border: 1px solid #e5e7eb;
                border-radius: 14px;
                padding: 14px;
                margin-bottom: 16px;
              }
              .food-img {
                width: 100%;
                max-height: 360px;
                object-fit: cover;
                border-radius: 14px;
                margin: 10px 0;
              }
              .no-photo {
                height: 90px;
                background: #f1f5f9;
                border-radius: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: #6b7280;
                margin: 10px 0;
                padding: 30px;
              }
              .photo-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 10px;
                margin: 10px 0 14px 0;
              }
              .diary-img {
                width: 100%;
                height: 210px;
                object-fit: cover;
                border-radius: 12px;
              }
              .photo-label {
                text-align: center;
                color: #6b7280;
                font-size: 12px;
                font-weight: bold;
                margin-top: 4px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
              }
              td {
                border: 1px solid #e5e7eb;
                padding: 8px;
                font-size: 13px;
              }
            </style>
          </head>
          <body>
            <h1>Dia AI — ${escapeHtml(tr('reportTitle', 'Отчёт', 'Report', 'Atskaite'))}</h1>
            <p class="muted">${escapeHtml(formatDate(new Date().toISOString()))}</p>

            <h2>${escapeHtml(tr('summary', 'Сводка', 'Summary', 'Kopsavilkums'))}</h2>
            <div class="grid">
              <div class="stat"><b>${avg !== null ? formatOne(avg) : '-'}</b><br/>${escapeHtml(tr('averageShort', 'Средний', 'Average', 'Vidējais'))}</div>
              <div class="stat"><b>${min !== null ? formatOne(min) : '-'}</b><br/>${escapeHtml(tr('minShort', 'Мин', 'Min', 'Min'))}</div>
              <div class="stat"><b>${max !== null ? formatOne(max) : '-'}</b><br/>${escapeHtml(tr('maxShort', 'Макс', 'Max', 'Max'))}</div>
              <div class="stat"><b>${normalCount}</b><br/>${escapeHtml(tr('normal', 'В норме', 'Normal', 'Normā'))}</div>
              <div class="stat"><b>${highCount}</b><br/>${escapeHtml(tr('highShort', 'Высоких', 'High', 'Augsti'))}</div>
              <div class="stat"><b>${lowCount}</b><br/>${escapeHtml(tr('lowShort', 'Низких', 'Low', 'Zemi'))}</div>
            </div>

            <p><b>${escapeHtml(tr('totalDiaryEntries', 'Всего записей в дневнике', 'Total diary entries', 'Ieraksti dienasgrāmatā kopā'))}:</b> ${entries.length}</p>

            <h2>${escapeHtml(tr('aiConclusion', 'AI вывод', 'AI summary', 'MI secinājums'))}</h2>
            <div class="box">${escapeHtml(aiSummary)}</div>

            <h2>${escapeHtml(tr('sugarChart', 'График сахара', 'Glucose chart', 'Cukura grafiks'))}</h2>
            ${chartSvg}

            <h2>${escapeHtml(tr('problemMeals', 'Проблемные блюда', 'Problem meals', 'Problemātiski ēdieni'))}</h2>
            ${
              problemBlocks.length
                ? problemBlocks.join('')
                : `<div class="box">${escapeHtml(
                    tr(
                      'noProblemMealsText',
                      'Пока нет проблемных блюд. Когда появятся записи с повышением сахара, они будут показаны здесь.',
                      'No problem meals yet. When entries with glucose rise appear, they will be shown here.',
                      'Pagaidām problemātisku ēdienu nav. Kad parādīsies ieraksti ar cukura paaugstināšanos, tie būs redzami šeit.'
                    )
                  )}</div>`
            }

            <h2>${escapeHtml(tr('fullDiary', 'Весь дневник', 'Full diary', 'Visa dienasgrāmata'))}</h2>
            ${diaryBlocks.join('')}

            <p class="muted">
              ${escapeHtml(
                tr(
                  'medicalDisclaimer',
                  'Отчёт носит информационный характер и не заменяет консультацию врача.',
                  'This report is informational and does not replace medical advice.',
                  'Šī atskaite ir informatīva un neaizstāj ārsta konsultāciju.'
                )
              )}
            </p>
          </body>
        </html>
      `;

      const file = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/pdf',
          dialogTitle: tr('sharePdfReport', 'Поделиться PDF отчётом', 'Share PDF report', 'Dalīties ar PDF atskaiti'),
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert(tr('pdfReady', 'PDF готов', 'PDF ready', 'PDF gatavs'), file.uri);
      }
    } catch (error: any) {
      console.log('PDF error:', error);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        error?.message || tr('pdfCreateError', 'Не удалось создать PDF отчёт.', 'Could not create PDF report.', 'Neizdevās izveidot PDF atskaiti.')
      );
    } finally {
      setCreatingPdf(false);
    }
  };

  const shareTextReport = async () => {
    if (!entries.length) {
      Alert.alert(
        tr('noData', 'Нет данных', 'No data', 'Nav datu'),
        tr('reportAddEntriesFirst', 'Сначала добавь записи в дневник.', 'Add entries to the diary first.', 'Vispirms pievieno ierakstus dienasgrāmatā.')
      );
      return;
    }

    const lines = [
      tr('reportTextTitle', 'Отчёт Dia AI', 'Dia AI report', 'Dia AI atskaite'),
      '',
      `${tr('totalEntries', 'Всего записей', 'Total entries', 'Ieraksti kopā')}: ${entries.length}`,
      `${tr('averageSugar', 'Средний сахар', 'Average glucose', 'Vidējais cukurs')}: ${avg !== null ? formatOne(avg) : '-'}`,
      `${tr('minimum', 'Минимум', 'Minimum', 'Minimums')}: ${min !== null ? formatOne(min) : '-'}`,
      `${tr('maximum', 'Максимум', 'Maximum', 'Maksimums')}: ${max !== null ? formatOne(max) : '-'}`,
      `${tr('normal', 'В норме', 'Normal', 'Normā')}: ${normalCount}`,
      `${tr('highValues', 'Высоких значений', 'High values', 'Augstas vērtības')}: ${highCount}`,
      `${tr('lowValues', 'Низких значений', 'Low values', 'Zemas vērtības')}: ${lowCount}`,
      '',
      `${tr('aiConclusion', 'AI вывод', 'AI summary', 'MI secinājums')}: ${aiSummary}`,
    ];

    await Share.share({ message: lines.join('\n') });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <TouchableOpacity
          onPress={goHome}
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
            backgroundColor: BLUE,
            borderRadius: 28,
            padding: 22,
            marginBottom: 16,
          }}
        >
          <Text style={{ color: '#ffffff', fontSize: 30, fontWeight: '900' }}>
            📄 {tr('reportTitle', 'Отчёт', 'Report', 'Atskaite')}
          </Text>

          <Text
            style={{
              color: '#dbeafe',
              fontSize: 16,
              lineHeight: 23,
              marginTop: 8,
            }}
          >
            {tr(
              'reportSubtitle',
              'Сводка сахара, проблемные блюда, график и полный дневник.',
              'Glucose summary, problem meals, chart and full diary.',
              'Cukura kopsavilkums, problemātiski ēdieni, grafiks un visa dienasgrāmata.'
            )}
          </Text>
        </View>

        <Card>
          <Text style={{ color: TEXT, fontSize: 22, fontWeight: '900', marginBottom: 14 }}>
            {tr('summary', 'Сводка', 'Summary', 'Kopsavilkums')}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <StatBox label={tr('averageShort', 'Средний', 'Average', 'Vidējais')} value={avg !== null ? formatOne(avg) : '-'} />
            <StatBox label={tr('minShort', 'Мин', 'Min', 'Min')} value={min !== null ? formatOne(min) : '-'} color={BLUE} />
            <StatBox label={tr('maxShort', 'Макс', 'Max', 'Max')} value={max !== null ? formatOne(max) : '-'} color={RED} />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <StatBox label={tr('normal', 'В норме', 'Normal', 'Normā')} value={String(normalCount)} color={GREEN} />
            <StatBox label={tr('highShort', 'Высоких', 'High', 'Augsti')} value={String(highCount)} color={RED} />
            <StatBox label={tr('lowShort', 'Низких', 'Low', 'Zemi')} value={String(lowCount)} color={BLUE} />
          </View>

          <Text style={{ color: MUTED, fontSize: 14, marginTop: 14 }}>
            {tr('totalDiaryEntries', 'Всего записей в дневнике', 'Total diary entries', 'Ieraksti dienasgrāmatā kopā')}: {entries.length}
          </Text>
        </Card>

        <Card>
          <Text style={{ color: TEXT, fontSize: 22, fontWeight: '900', marginBottom: 8 }}>
            🤖 {tr('conclusion', 'Вывод', 'Summary', 'Secinājums')}
          </Text>

          <Text style={{ color: '#374151', fontSize: 15, lineHeight: 22 }}>
            {aiSummary}
          </Text>
        </Card>

        <PrimaryButton
          title={
            creatingPdf
              ? tr('creatingPdf', 'Создаём PDF...', 'Creating PDF...', 'Veido PDF...')
              : tr('downloadPdfShare', 'Скачать PDF / Поделиться', 'Download PDF / Share', 'Lejupielādēt PDF / Dalīties')
          }
          onPress={createPdfReport}
          disabled={creatingPdf}
        />

        <SecondaryButton
          title={tr('shareTextReport', 'Поделиться текстовым отчётом', 'Share text report', 'Dalīties ar teksta atskaiti')}
          onPress={shareTextReport}
        />
      </ScrollView>
    </SafeAreaView>
  );
}