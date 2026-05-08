import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  TouchableOpacity,
  View,
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
};

type ProblemMeal = DiaryEntry & {
  before: number | null;
  after: number;
  diff: number | null;
  reason: string;
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

function getStatusColor(value: number) {
  if (value < 4) return BLUE;
  if (value <= 10) return GREEN;
  if (value <= 13.9) return ORANGE;
  return RED;
}

function getStatusText(value: number) {
  if (value < 4) {
    return tr('reportLowSugar', 'Низкий сахар', 'Low glucose', 'Zems cukurs');
  }

  if (value <= 10) {
    return tr('reportNormalSugar', 'В норме', 'Normal', 'Normāls');
  }

  if (value <= 13.9) {
    return tr('reportElevatedSugar', 'Повышен', 'Elevated', 'Paaugstināts');
  }

  return tr('reportHighSugar', 'Высокий сахар', 'High glucose', 'Augsts cukurs');
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
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
}: {
  title: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: BLUE,
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

  const glucoseValues = useMemo(() => {
    return entries
      .flatMap((item) => [
        parseNumber(item.glucoseBefore),
        parseNumber(item.glucoseAfter),
      ])
      .filter((value): value is number => value !== null);
  }, [entries]);

  const avg = average(glucoseValues);
  const min = glucoseValues.length ? Math.min(...glucoseValues) : null;
  const max = glucoseValues.length ? Math.max(...glucoseValues) : null;

  const normalCount = glucoseValues.filter(
    (value) => value >= 4 && value <= 10
  ).length;
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
          reason = tr(
            'reportReasonHigh',
            'сахар вышел выше нормы',
            'glucose went above normal',
            'cukurs pārsniedza normu'
          );
        } else if (after < 4) {
          reason = tr(
            'reportReasonLow',
            'сахар упал ниже нормы',
            'glucose dropped below normal',
            'cukurs nokritās zem normas'
          );
        } else if (bigJump) {
          reason = tr(
            'reportReasonJump',
            'сахар заметно вырос после еды',
            'glucose rose noticeably after meal',
            'cukurs ievērojami pieauga pēc ēšanas'
          );
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
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
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
      .map((item) =>
        item.mealName ||
        tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma')
      );

    return tr(
      'reportAiSummaryProblems',
      `Найдено проблемных записей: ${problemMeals.length}. Обрати внимание на блюда: ${top.join(
        ', '
      )}. Именно после них сахар выходил за пределы или заметно рос.`,
      `Problem entries found: ${problemMeals.length}. Pay attention to: ${top.join(
        ', '
      )}. After these meals glucose went out of range or rose noticeably.`,
      `Atrasti problemātiski ieraksti: ${problemMeals.length}. Pievērs uzmanību ēdieniem: ${top.join(
        ', '
      )}. Tieši pēc tiem cukurs izgāja ārpus normas vai ievērojami pieauga.`
    );
  }, [entries.length, problemMeals]);

  const shareTextReport = async () => {
    if (!entries.length) {
      Alert.alert(
        tr('noData', 'Нет данных', 'No data', 'Nav datu'),
        tr(
          'reportAddEntriesFirst',
          'Сначала добавь записи в дневник.',
          'Add entries to the diary first.',
          'Vispirms pievieno ierakstus dienasgrāmatā.'
        )
      );
      return;
    }

    const lines = [
      tr('reportTextTitle', 'Отчёт Dia AI', 'Dia AI report', 'Dia AI atskaite'),
      '',
      `${tr('totalEntries', 'Всего записей', 'Total entries', 'Ieraksti kopā')}: ${
        entries.length
      }`,
      `${tr('averageSugar', 'Средний сахар', 'Average glucose', 'Vidējais cukurs')}: ${
        avg !== null ? formatOne(avg) : '-'
      }`,
      `${tr('minimum', 'Минимум', 'Minimum', 'Minimums')}: ${
        min !== null ? formatOne(min) : '-'
      }`,
      `${tr('maximum', 'Максимум', 'Maximum', 'Maksimums')}: ${
        max !== null ? formatOne(max) : '-'
      }`,
      `${tr('normal', 'В норме', 'Normal', 'Normā')}: ${normalCount}`,
      `${tr('highValues', 'Высоких значений', 'High values', 'Augstas vērtības')}: ${highCount}`,
      `${tr('lowValues', 'Низких значений', 'Low values', 'Zemas vērtības')}: ${lowCount}`,
      '',
      `${tr('problemMeals', 'Проблемные блюда', 'Problem meals', 'Problemātiski ēdieni')}:`,
      problemMeals.length
        ? problemMeals
            .slice(0, 10)
            .map((item, index) => {
              const before = item.before !== null ? formatOne(item.before) : '-';
              const after = formatOne(item.after);
              const diff =
                item.diff !== null
                  ? ` (${item.diff >= 0 ? '+' : ''}${formatOne(item.diff)})`
                  : '';

              return `${index + 1}. ${
                item.mealName ||
                tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma')
              } — ${tr('sugar', 'сахар', 'glucose', 'cukurs')} ${before} → ${after}${diff}`;
            })
            .join('\n')
        : tr('noProblemMeals', 'Нет проблемных блюд', 'No problem meals', 'Nav problemātisku ēdienu'),
      '',
      `${tr('aiConclusion', 'AI вывод', 'AI summary', 'MI secinājums')}: ${aiSummary}`,
    ];

    await Share.share({ message: lines.join('\n') });
  };

  const downloadPdfSoon = () => {
    Alert.alert(
      tr('pdfReport', 'PDF отчёт', 'PDF report', 'PDF atskaite'),
      tr(
        'pdfReportSoon',
        'Сейчас готов экран отчёта в приложении. Следующим шагом добавим настоящий PDF с фото еды и кнопкой отправки врачу.',
        'The report screen is ready. Next we will add a real PDF with food photos and a button to send it to a doctor.',
        'Atskaites ekrāns ir gatavs. Nākamajā solī pievienosim īstu PDF ar ēdiena foto un pogu nosūtīšanai ārstam.'
      )
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
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
              'Сводка сахара, проблемные блюда и фото еды, после которой сахар вышел за пределы.',
              'Glucose summary, problem meals and food photos after which glucose went out of range.',
              'Cukura kopsavilkums, problemātiski ēdieni un foto, pēc kuriem cukurs izgāja ārpus normas.'
            )}
          </Text>
        </View>

        <Card>
          <Text style={{ color: TEXT, fontSize: 22, fontWeight: '900', marginBottom: 14 }}>
            {tr('summary', 'Сводка', 'Summary', 'Kopsavilkums')}
          </Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <StatBox
              label={tr('averageShort', 'Средний', 'Average', 'Vidējais')}
              value={avg !== null ? formatOne(avg) : '-'}
            />
            <StatBox
              label={tr('minShort', 'Мин', 'Min', 'Min')}
              value={min !== null ? formatOne(min) : '-'}
              color={BLUE}
            />
            <StatBox
              label={tr('maxShort', 'Макс', 'Max', 'Max')}
              value={max !== null ? formatOne(max) : '-'}
              color={RED}
            />
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <StatBox
              label={tr('normal', 'В норме', 'Normal', 'Normā')}
              value={String(normalCount)}
              color={GREEN}
            />
            <StatBox
              label={tr('highShort', 'Высоких', 'High', 'Augsti')}
              value={String(highCount)}
              color={RED}
            />
            <StatBox
              label={tr('lowShort', 'Низких', 'Low', 'Zemi')}
              value={String(lowCount)}
              color={BLUE}
            />
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

        <Card>
          <Text style={{ color: TEXT, fontSize: 22, fontWeight: '900', marginBottom: 6 }}>
            ⚠️ {tr('problemMeals', 'Проблемные блюда', 'Problem meals', 'Problemātiski ēdieni')}
          </Text>

          <Text style={{ color: MUTED, fontSize: 14, lineHeight: 20, marginBottom: 12 }}>
            {tr(
              'problemMealsSubtitle',
              'Здесь показываются только те блюда, после которых сахар вышел за пределы нормы или заметно вырос.',
              'Only meals after which glucose went out of range or rose noticeably are shown here.',
              'Šeit tiek rādīti tikai tie ēdieni, pēc kuriem cukurs izgāja ārpus normas vai ievērojami pieauga.'
            )}
          </Text>

          {problemMeals.length === 0 ? (
            <View
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: 18,
                padding: 16,
              }}
            >
              <Text style={{ color: MUTED, fontSize: 15, lineHeight: 22 }}>
                {tr(
                  'noProblemMealsText',
                  'Пока нет проблемных блюд. Когда появятся записи с повышением сахара, они будут показаны здесь.',
                  'No problem meals yet. When entries with glucose rise appear, they will be shown here.',
                  'Pagaidām problemātisku ēdienu nav. Kad parādīsies ieraksti ar cukura paaugstināšanos, tie būs redzami šeit.'
                )}
              </Text>
            </View>
          ) : (
            problemMeals.map((item) => {
              const color = getStatusColor(item.after);
              const beforeText = item.before !== null ? formatOne(item.before) : '-';
              const afterText = formatOne(item.after);
              const diffText =
                item.diff !== null
                  ? `${item.diff >= 0 ? '+' : ''}${formatOne(item.diff)}`
                  : '';

              return (
                <View
                  key={`${item.id}-${item.after}`}
                  style={{
                    borderTopWidth: 1,
                    borderTopColor: '#e5e7eb',
                    paddingTop: 14,
                    marginTop: 14,
                  }}
                >
                  {item.photoUri ? (
                    <Image
                      source={{ uri: item.photoUri }}
                      style={{
                        width: '100%',
                        height: 210,
                        borderRadius: 18,
                        backgroundColor: '#e5e7eb',
                        marginBottom: 12,
                      }}
                      resizeMode="cover"
                    />
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
                    {item.mealName ||
                      tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma')}
                  </Text>

                  <Text style={{ color: MUTED, fontSize: 14, marginTop: 4 }}>
                    {item.mealType ||
                      tr('mealTypeFallback', 'Приём пищи', 'Meal', 'Ēdienreize')}{' '}
                    • {formatDate(item.createdAt)}
                  </Text>

                  <View
                    style={{
                      backgroundColor: '#f8fafc',
                      borderRadius: 18,
                      padding: 14,
                      marginTop: 12,
                    }}
                  >
                    <Text style={{ color, fontSize: 17, fontWeight: '900' }}>
                      {tr('sugar', 'Сахар', 'Glucose', 'Cukurs')}: {beforeText} → {afterText}
                      {diffText ? ` (${diffText})` : ''}
                    </Text>

                    <Text style={{ color: MUTED, fontSize: 14, marginTop: 5 }}>
                      {getStatusText(item.after)} — {item.reason}
                    </Text>
                  </View>

                  <Text
                    style={{
                      color: MUTED,
                      fontSize: 14,
                      marginTop: 10,
                      lineHeight: 21,
                    }}
                  >
                    {tr('breadUnitsShort', 'ХЕ', 'BU', 'XE')}: {item.breadUnits || '-'} ·{' '}
                    {tr('carbs', 'Углеводы', 'Carbs', 'Ogļhidrāti')}: {item.carbs || '-'} ·{' '}
                    {tr('calories', 'Калории', 'Calories', 'Kalorijas')}: {item.calories || '-'} ·{' '}
                    {tr('insulin', 'Инсулин', 'Insulin', 'Insulīns')}: {item.insulinUnits || '-'}
                  </Text>

                  {!!item.userNote && (
                    <Text
                      style={{
                        color: TEXT,
                        fontSize: 14,
                        marginTop: 8,
                        lineHeight: 21,
                      }}
                    >
                      {tr('note', 'Заметка', 'Note', 'Piezīme')}: {item.userNote}
                    </Text>
                  )}
                </View>
              );
            })
          )}
        </Card>

        <PrimaryButton
          title={tr(
            'downloadPdfShare',
            'Скачать PDF / Поделиться',
            'Download PDF / Share',
            'Lejupielādēt PDF / Dalīties'
          )}
          onPress={downloadPdfSoon}
        />

        <SecondaryButton
          title={tr(
            'shareTextReport',
            'Поделиться текстовым отчётом',
            'Share text report',
            'Dalīties ar teksta atskaiti'
          )}
          onPress={shareTextReport}
        />
      </ScrollView>
    </SafeAreaView>
  );
}