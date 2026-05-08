import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
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

type InsightCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  valueColor?: string;
};

const BG = '#f3f4f6';
const CARD = '#ffffff';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BLUE = '#2563eb';
const RED = '#dc2626';
const GREEN = '#16a34a';
const ORANGE = '#d97706';

function lang() {
  return String(i18n.locale || 'en').slice(0, 2);
}

function tr(key: string, ru: string, en: string, lv?: string) {
  const value = i18n.t(key);

  const isMissing =
    !value ||
    value === key ||
    String(value).toLowerCase().includes('missing') ||
    String(value).includes('[missing');

  if (!isMissing) return value;

  if (lang() === 'en') return en;
  if (lang() === 'lv') return lv || en;

  return ru;
}

function parseNumber(value?: string): number | null {
  if (!value) return null;

  const cleaned = String(value).replace(',', '.').match(/\d+(\.\d+)?/);

  if (!cleaned) return null;

  const num = Number(cleaned[0]);

  return Number.isNaN(num) ? null : num;
}

function formatOne(value: number) {
  return value.toFixed(1).replace('.', ',');
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, item) => sum + item, 0) / values.length;
}

function getTrendData(values: number[]) {
  if (values.length < 2) {
    return {
      delta: null as number | null,
      label: tr(
        'analysisNotEnoughData',
        'Недостаточно данных',
        'Not enough data',
        'Nepietiek datu'
      ),
      color: TEXT,
      subtitle: tr(
        'analysisNeedTwoValues',
        'Нужно хотя бы 2 значения для сравнения.',
        'At least 2 values are needed for comparison.',
        'Salīdzināšanai vajadzīgas vismaz 2 vērtības.'
      ),
    };
  }

  const mid = Math.ceil(values.length / 2);
  const firstHalf = values.slice(0, mid);
  const secondHalf = values.slice(mid);

  const firstAvg = average(firstHalf);
  const secondAvg = average(secondHalf);

  if (firstAvg === null || secondAvg === null) {
    return {
      delta: null as number | null,
      label: tr(
        'analysisNotEnoughData',
        'Недостаточно данных',
        'Not enough data',
        'Nepietiek datu'
      ),
      color: TEXT,
      subtitle: tr(
        'analysisNeedMoreTrendData',
        'Нужно больше данных для оценки тренда.',
        'More data is needed to estimate the trend.',
        'Tendences novērtēšanai vajag vairāk datu.'
      ),
    };
  }

  const delta = secondAvg - firstAvg;

  if (delta <= -0.5) {
    return {
      delta,
      label: tr('analysisTrendImproving', 'Улучшается', 'Improving', 'Uzlabojas'),
      color: GREEN,
      subtitle: tr(
        'analysisSugarDecreased',
        `Средний сахар снизился на ${formatOne(Math.abs(delta))}.`,
        `Average glucose decreased by ${formatOne(Math.abs(delta))}.`,
        `Vidējais cukurs samazinājās par ${formatOne(Math.abs(delta))}.`
      ),
    };
  }

  if (delta >= 0.5) {
    return {
      delta,
      label: tr('analysisTrendWorse', 'Ухудшается', 'Getting worse', 'Pasliktinās'),
      color: RED,
      subtitle: tr(
        'analysisSugarIncreased',
        `Средний сахар вырос на ${formatOne(delta)}.`,
        `Average glucose increased by ${formatOne(delta)}.`,
        `Vidējais cukurs pieauga par ${formatOne(delta)}.`
      ),
    };
  }

  return {
    delta,
    label: tr('analysisTrendStable', 'Стабильно', 'Stable', 'Stabili'),
    color: TEXT,
    subtitle: tr(
      'analysisNoBigChanges',
      'Серьёзных изменений не видно.',
      'No major changes are visible.',
      'Būtiskas izmaiņas nav redzamas.'
    ),
  };
}

function getRiskData(
  avgBefore: number | null,
  avgAfter: number | null,
  avgRise: number | null,
  highAfterCount: number,
  totalEntries: number
) {
  if (totalEntries === 0) {
    return {
      label: tr('analysisNoData', 'Нет данных', 'No data', 'Nav datu'),
      color: TEXT,
      subtitle: tr(
        'analysisAddEntriesForRisk',
        'Добавь записи, чтобы появилась оценка риска.',
        'Add entries to see risk estimation.',
        'Pievieno ierakstus, lai parādītos riska novērtējums.'
      ),
    };
  }

  let score = 0;

  if (avgBefore !== null && avgBefore >= 7) score += 2;
  if (avgAfter !== null && avgAfter >= 9) score += 2;
  if (avgRise !== null && avgRise >= 3) score += 2;
  if (highAfterCount >= 3) score += 2;
  if (highAfterCount >= 1 && highAfterCount < 3) score += 1;

  if (score >= 6) {
    return {
      label: tr('analysisHighRisk', 'Высокий риск', 'High risk', 'Augsts risks'),
      color: RED,
      subtitle: tr(
        'analysisHighRiskText',
        'Есть заметная вероятность частых скачков сахара. Стоит внимательнее проверить питание, ХЕ и дозу инсулина.',
        'There is a noticeable chance of frequent glucose spikes. Check meals, bread units and insulin dose more carefully.',
        'Pastāv ievērojama biežu cukura lēcienu iespēja. Rūpīgāk pārbaudi ēdienu, maizes vienības un insulīna devu.'
      ),
    };
  }

  if (score >= 3) {
    return {
      label: tr('analysisMediumRisk', 'Средний риск', 'Medium risk', 'Vidējs risks'),
      color: ORANGE,
      subtitle: tr(
        'analysisMediumRiskText',
        'Есть отдельные признаки нестабильности. Нужен более внимательный контроль сахара после еды.',
        'There are some signs of instability. Glucose after meals should be monitored more carefully.',
        'Ir atsevišķas nestabilitātes pazīmes. Cukurs pēc ēšanas jākontrolē uzmanīgāk.'
      ),
    };
  }

  return {
    label: tr('analysisLowRisk', 'Низкий риск', 'Low risk', 'Zems risks'),
    color: GREEN,
    subtitle: tr(
      'analysisLowRiskText',
      'По текущим данным выраженного риска частых скачков сахара не видно.',
      'Based on current data, no clear risk of frequent glucose spikes is visible.',
      'Pēc pašreizējiem datiem izteikts biežu cukura lēcienu risks nav redzams.'
    ),
  };
}

function InsightCard({
  title,
  value,
  subtitle,
  valueColor = TEXT,
}: InsightCardProps) {
  return (
    <View
      style={{
        backgroundColor: CARD,
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontSize: 15,
          color: MUTED,
          fontWeight: '700',
          marginBottom: 8,
        }}
      >
        {title}
      </Text>

      <Text
        style={{
          fontSize: 28,
          color: valueColor,
          fontWeight: '900',
          marginBottom: subtitle ? 8 : 0,
        }}
      >
        {value}
      </Text>

      {!!subtitle && (
        <Text
          style={{
            fontSize: 15,
            color: '#4b5563',
            lineHeight: 22,
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={{
        backgroundColor: CARD,
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 2,
      }}
    >
      <Text
        style={{
          fontSize: 22,
          fontWeight: '900',
          color: TEXT,
          marginBottom: 12,
        }}
      >
        {title}
      </Text>

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
        marginBottom: 14,
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '800' }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function AnalysisScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);

  const loadHistory = async () => {
    try {
      setLoading(true);

      const raw = await AsyncStorage.getItem('history');
      const parsed: DiaryEntry[] = raw ? JSON.parse(raw) : [];

      setEntries(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.log('Analysis loading error:', error);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const stats = useMemo(() => {
    const sortedEntries = entries
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    const beforeValues = sortedEntries
      .map((item) => parseNumber(item.glucoseBefore))
      .filter((item): item is number => item !== null);

    const afterValues = sortedEntries
      .map((item) => parseNumber(item.glucoseAfter))
      .filter((item): item is number => item !== null);

    const breadUnitsValues = sortedEntries
      .map((item) => parseNumber(item.breadUnits))
      .filter((item): item is number => item !== null);

    const avgBefore = average(beforeValues);
    const avgAfter = average(afterValues);

    const highBeforeCount = beforeValues.filter((item) => item >= 7.0).length;
    const highAfterCount = afterValues.filter((item) => item >= 9.0).length;

    const missingAfterCount = sortedEntries.filter(
      (item) => parseNumber(item.glucoseAfter) === null
    ).length;

    const totalBreadUnits = breadUnitsValues.reduce((sum, item) => sum + item, 0);

    const reactions = sortedEntries
      .map((item) => {
        const before = parseNumber(item.glucoseBefore);
        const after = parseNumber(item.glucoseAfter);

        if (before === null || after === null) return null;

        return {
          mealType:
            item.mealType ||
            tr('analysisNoMealType', 'Без типа', 'No type', 'Bez tipa'),
          mealName:
            item.mealName ||
            tr('analysisNoMealName', 'Без названия', 'Untitled', 'Bez nosaukuma'),
          diff: after - before,
          before,
          after,
        };
      })
      .filter(
        (
          item
        ): item is {
          mealType: string;
          mealName: string;
          diff: number;
          before: number;
          after: number;
        } => item !== null
      );

    const avgRise = average(reactions.map((item) => item.diff));
    const badMealSpikes = reactions.filter((item) => item.diff > 3).length;

    const mealTypeStats: Record<string, number[]> = {};

    reactions.forEach((item) => {
      if (!mealTypeStats[item.mealType]) mealTypeStats[item.mealType] = [];
      mealTypeStats[item.mealType].push(item.diff);
    });

    let worstMealType = '';
    let worstMealTypeValue = -999;

    Object.keys(mealTypeStats).forEach((mealType) => {
      const avg =
        mealTypeStats[mealType].reduce((a, b) => a + b, 0) /
        mealTypeStats[mealType].length;

      if (avg > worstMealTypeValue) {
        worstMealTypeValue = avg;
        worstMealType = mealType;
      }
    });

    const mealNameStats: Record<string, number[]> = {};

    reactions.forEach((item) => {
      if (!mealNameStats[item.mealName]) mealNameStats[item.mealName] = [];
      mealNameStats[item.mealName].push(item.diff);
    });

    let worstMealName = '';
    let worstMealNameValue = -999;

    Object.keys(mealNameStats).forEach((mealName) => {
      const avg =
        mealNameStats[mealName].reduce((a, b) => a + b, 0) /
        mealNameStats[mealName].length;

      if (avg > worstMealNameValue) {
        worstMealNameValue = avg;
        worstMealName = mealName;
      }
    });

    const insulinChecks = sortedEntries
      .map((item) => {
        const insulin = parseNumber(item.insulinUnits);
        const before = parseNumber(item.glucoseBefore);
        const after = parseNumber(item.glucoseAfter);

        if (insulin === null || before === null || after === null) return null;

        return {
          insulin,
          diff: after - before,
        };
      })
      .filter((item): item is { insulin: number; diff: number } => item !== null);

    const insulinEffect = average(insulinChecks.map((item) => item.diff));

    const now = new Date();

    const todayEntries = sortedEntries.filter((item) => {
      const date = new Date(item.createdAt);

      return (
        date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    });

    const last7Days = sortedEntries.filter((item) => {
      const date = new Date(item.createdAt);
      return now.getTime() - date.getTime() <= 7 * 24 * 60 * 60 * 1000;
    });

    const last30Days = sortedEntries.filter((item) => {
      const date = new Date(item.createdAt);
      return now.getTime() - date.getTime() <= 30 * 24 * 60 * 60 * 1000;
    });

    const todayBefore = todayEntries
      .map((item) => parseNumber(item.glucoseBefore))
      .filter((n): n is number => n !== null);

    const todayAfter = todayEntries
      .map((item) => parseNumber(item.glucoseAfter))
      .filter((n): n is number => n !== null);

    const last7Before = last7Days
      .map((item) => parseNumber(item.glucoseBefore))
      .filter((n): n is number => n !== null);

    const last7After = last7Days
      .map((item) => parseNumber(item.glucoseAfter))
      .filter((n): n is number => n !== null);

    const last30Before = last30Days
      .map((item) => parseNumber(item.glucoseBefore))
      .filter((n): n is number => n !== null);

    const last30After = last30Days
      .map((item) => parseNumber(item.glucoseAfter))
      .filter((n): n is number => n !== null);

    const todayAvgBefore = average(todayBefore);
    const todayAvgAfter = average(todayAfter);
    const todayHigh = todayAfter.filter((n) => n >= 9).length;

    const last7AvgBefore = average(last7Before);
    const last7AvgAfter = average(last7After);
    const last7High = last7After.filter((n) => n >= 9).length;

    const last30AvgBefore = average(last30Before);
    const last30AvgAfter = average(last30After);
    const last30High = last30After.filter((n) => n >= 9).length;

    const overallTrendSource = afterValues.length >= 2 ? afterValues : beforeValues;
    const overallTrend = getTrendData(overallTrendSource);

    const last7TrendSource = last7After.length >= 2 ? last7After : last7Before;
    const last7Trend = getTrendData(last7TrendSource);

    const riskData = getRiskData(
      avgBefore,
      avgAfter,
      avgRise,
      highAfterCount,
      sortedEntries.length
    );

    let smartAdvice = tr(
      'analysisDefaultAdvice',
      'Продолжай заполнять дневник — тогда анализ станет точнее.',
      'Keep filling in the diary — the analysis will become more accurate.',
      'Turpini aizpildīt dienasgrāmatu — analīze kļūs precīzāka.'
    );

    if (!sortedEntries.length) {
      smartAdvice = tr(
        'analysisNoEntriesAdvice',
        'Пока записей нет. Добавь несколько приёмов пищи, и здесь появится умный анализ.',
        'There are no entries yet. Add several meals and smart analysis will appear here.',
        'Pagaidām ierakstu nav. Pievieno vairākas ēdienreizes, un šeit parādīsies gudra analīze.'
      );
    } else if (avgRise !== null && avgRise > 3) {
      smartAdvice = tr(
        'analysisHighRiseAdvice',
        'После еды сахар растёт слишком сильно. Попробуй уменьшить быстрые углеводы, проверить ХЕ и дозу инсулина.',
        'Glucose rises too much after meals. Try reducing fast carbs and check bread units and insulin dose.',
        'Pēc ēšanas cukurs paaugstinās pārāk daudz. Pamēģini samazināt ātrus ogļhidrātus, pārbaudi maizes vienības un insulīna devu.'
      );
    } else if (avgBefore !== null && avgBefore > 7) {
      smartAdvice = tr(
        'analysisHighBeforeAdvice',
        'Сахар до еды выше желаемого. Стоит внимательнее посмотреть режим питания и базовый контроль.',
        'Glucose before meals is higher than desired. Check your meal routine and baseline control more carefully.',
        'Cukurs pirms ēšanas ir augstāks nekā vēlams. Rūpīgāk pārbaudi ēšanas režīmu un pamata kontroli.'
      );
    } else if (avgAfter !== null && avgAfter > 9) {
      smartAdvice = tr(
        'analysisHighAfterAdvice',
        'Сахар после еды часто повышен. Проверь размер порции, время укола и расчёт углеводов.',
        'Glucose after meals is often high. Check portion size, injection timing and carb calculation.',
        'Cukurs pēc ēšanas bieži ir paaugstināts. Pārbaudi porcijas lielumu, injekcijas laiku un ogļhidrātu aprēķinu.'
      );
    } else if (missingAfterCount >= 3) {
      smartAdvice = tr(
        'analysisMissingAfterAdvice',
        'Ты часто не записываешь сахар после еды. Эти данные очень важны для точного анализа.',
        'You often do not record glucose after meals. This data is very important for accurate analysis.',
        'Tu bieži nepieraksti cukuru pēc ēšanas. Šie dati ir ļoti svarīgi precīzai analīzei.'
      );
    } else {
      smartAdvice = tr(
        'analysisGoodAdvice',
        'По текущим данным ситуация выглядит неплохо. Продолжай регулярно вести дневник.',
        'Based on current data, the situation looks good. Continue keeping the diary regularly.',
        'Pēc pašreizējiem datiem situācija izskatās labi. Turpini regulāri aizpildīt dienasgrāmatu.'
      );
    }

    return {
      avgBefore,
      avgAfter,
      highBeforeCount,
      highAfterCount,
      missingAfterCount,
      breadUnitsValues,
      totalBreadUnits,
      avgRise,
      badMealSpikes,
      worstMealType,
      worstMealTypeValue,
      worstMealName,
      worstMealNameValue,
      insulinEffect,
      insulinChecksCount: insulinChecks.length,
      smartAdvice,
      todayCount: todayEntries.length,
      todayAvgBefore,
      todayAvgAfter,
      todayHigh,
      last7DaysCount: last7Days.length,
      last7AvgBefore,
      last7AvgAfter,
      last7High,
      last30DaysCount: last30Days.length,
      last30AvgBefore,
      last30AvgAfter,
      last30High,
      overallTrend,
      last7Trend,
      riskData,
    };
  }, [entries]);

  const noDataText = tr('analysisNoData', 'Нет данных', 'No data', 'Nav datu');
  const notEnoughText = tr(
    'analysisNotEnoughYet',
    'Пока недостаточно данных',
    'Not enough data yet',
    'Pagaidām nepietiek datu'
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <ActivityIndicator size="large" color={BLUE} />

          <Text
            style={{
              marginTop: 16,
              fontSize: 18,
              color: TEXT,
              fontWeight: '700',
            }}
          >
            {tr(
              'analysisLoading',
              'Загружаем анализ...',
              'Loading analysis...',
              'Ielādējam analīzi...'
            )}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 30 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: BLUE,
            borderRadius: 24,
            padding: 22,
            marginBottom: 18,
          }}
        >
          <Text
            style={{
              color: '#ffffff',
              fontSize: 28,
              fontWeight: '900',
              marginBottom: 8,
            }}
          >
            {tr('analysisTitle', 'Умный анализ', 'Smart analysis', 'Gudrā analīze')}
          </Text>

          <Text style={{ color: '#dbeafe', fontSize: 16, lineHeight: 23 }}>
            {tr(
              'analysisSubtitle',
              'Простая понятная аналитика по твоему дневнику сахара, еды и инсулина.',
              'Simple and clear analytics based on your glucose, food and insulin diary.',
              'Vienkārša un saprotama analītika pēc cukura, ēdiena un insulīna dienasgrāmatas.'
            )}
          </Text>
        </View>

        <PrimaryButton
          title={tr('analysisBackHome', 'НАЗАД НА ГЛАВНУЮ', 'BACK TO HOME', 'ATPAKAĻ UZ SĀKUMU')}
          onPress={() => router.back()}
        />

        <InsightCard
          title={tr('analysisTotalEntries', 'Всего записей', 'Total entries', 'Ieraksti kopā')}
          value={String(entries.length)}
          subtitle={tr(
            'analysisMoreEntriesBetter',
            'Чем больше записей, тем точнее выводы.',
            'The more entries, the more accurate the conclusions.',
            'Jo vairāk ierakstu, jo precīzāki secinājumi.'
          )}
        />

        <InsightCard
          title={tr('analysisAvgBefore', 'Средний сахар до еды', 'Average glucose before meals', 'Vidējais cukurs pirms ēšanas')}
          value={stats.avgBefore !== null ? formatOne(stats.avgBefore) : noDataText}
          subtitle={tr(
            'analysisAvgBeforeSubtitle',
            'Показывает общий уровень сахара перед приёмом пищи.',
            'Shows the general glucose level before meals.',
            'Parāda vispārējo cukura līmeni pirms ēšanas.'
          )}
        />

        <InsightCard
          title={tr('analysisAvgAfter', 'Средний сахар после еды', 'Average glucose after meals', 'Vidējais cukurs pēc ēšanas')}
          value={stats.avgAfter !== null ? formatOne(stats.avgAfter) : noDataText}
          subtitle={tr(
            'analysisAvgAfterSubtitle',
            'Помогает понять, как организм реагирует на еду.',
            'Helps understand how the body reacts to food.',
            'Palīdz saprast, kā organisms reaģē uz ēdienu.'
          )}
        />

        <InsightCard
          title={tr('analysisHighBefore', 'Высокий сахар до еды', 'High glucose before meals', 'Augsts cukurs pirms ēšanas')}
          value={String(stats.highBeforeCount)}
          subtitle={tr(
            'analysisHighBeforeSubtitle',
            'Считаем высоким сахар от 7.0 и выше.',
            'Glucose from 7.0 and above is counted as high.',
            'Par augstu tiek uzskatīts cukurs no 7.0 un vairāk.'
          )}
          valueColor={stats.highBeforeCount > 0 ? RED : TEXT}
        />

        <InsightCard
          title={tr('analysisHighAfter', 'Высокий сахар после еды', 'High glucose after meals', 'Augsts cukurs pēc ēšanas')}
          value={String(stats.highAfterCount)}
          subtitle={tr(
            'analysisHighAfterSubtitle',
            'Считаем высоким сахар от 9.0 и выше.',
            'Glucose from 9.0 and above is counted as high.',
            'Par augstu tiek uzskatīts cukurs no 9.0 un vairāk.'
          )}
          valueColor={stats.highAfterCount > 0 ? RED : TEXT}
        />

        <InsightCard
          title={tr('analysisTotalBU', 'Сумма хлебных единиц', 'Total bread units', 'Maizes vienības kopā')}
          value={stats.breadUnitsValues.length ? formatOne(stats.totalBreadUnits) : noDataText}
          subtitle={tr(
            'analysisTotalBUSubtitle',
            'Суммарные ХЕ по всем записям в дневнике.',
            'Total bread units across all diary entries.',
            'Maizes vienību summa visos dienasgrāmatas ierakstos.'
          )}
        />

        <InsightCard
          title={tr('analysisMissingAfter', 'Пропущен сахар после еды', 'Missing glucose after meals', 'Trūkst cukura pēc ēšanas')}
          value={String(stats.missingAfterCount)}
          subtitle={tr(
            'analysisMissingAfterSubtitle',
            'Это записи, где нет значения сахара после еды.',
            'These are entries without glucose after meal value.',
            'Tie ir ieraksti, kuros nav cukura vērtības pēc ēšanas.'
          )}
        />

        <InsightCard
          title={tr('analysisReaction', 'Реакция на еду', 'Food reaction', 'Reakcija uz ēdienu')}
          value={
            stats.avgRise !== null
              ? `${stats.avgRise > 0 ? '+' : ''}${formatOne(stats.avgRise)}`
              : noDataText
          }
          subtitle={tr(
            'analysisReactionSubtitle',
            `Средний рост сахара после еды. Сильные скачки: ${stats.badMealSpikes}`,
            `Average glucose rise after meals. Strong spikes: ${stats.badMealSpikes}`,
            `Vidējais cukura pieaugums pēc ēšanas. Spēcīgi lēcieni: ${stats.badMealSpikes}`
          )}
          valueColor={stats.avgRise !== null && stats.avgRise > 3 ? RED : TEXT}
        />

        <InsightCard
          title={tr('analysisWorstMealType', 'Проблемный тип приёма пищи', 'Problem meal type', 'Problemātiska ēdienreize')}
          value={stats.worstMealType || notEnoughText}
          subtitle={
            stats.worstMealType
              ? tr(
                  'analysisWorstMealTypeRise',
                  `Средний рост сахара: ${stats.worstMealTypeValue > 0 ? '+' : ''}${formatOne(stats.worstMealTypeValue)}`,
                  `Average glucose rise: ${stats.worstMealTypeValue > 0 ? '+' : ''}${formatOne(stats.worstMealTypeValue)}`,
                  `Vidējais cukura pieaugums: ${stats.worstMealTypeValue > 0 ? '+' : ''}${formatOne(stats.worstMealTypeValue)}`
                )
              : tr(
                  'analysisWorstMealTypeSubtitle',
                  'Показывает тип приёма пищи, после которого сахар растёт сильнее.',
                  'Shows the meal type after which glucose rises the most.',
                  'Parāda ēdienreizes tipu, pēc kura cukurs paaugstinās visvairāk.'
                )
          }
          valueColor={stats.worstMealTypeValue > 3 ? RED : TEXT}
        />

        <InsightCard
          title={tr('analysisWorstMealName', 'Проблемная еда', 'Problem food', 'Problemātisks ēdiens')}
          value={stats.worstMealName || notEnoughText}
          subtitle={
            stats.worstMealName
              ? tr(
                  'analysisWorstMealNameRise',
                  `Средний рост сахара: ${stats.worstMealNameValue > 0 ? '+' : ''}${formatOne(stats.worstMealNameValue)}`,
                  `Average glucose rise: ${stats.worstMealNameValue > 0 ? '+' : ''}${formatOne(stats.worstMealNameValue)}`,
                  `Vidējais cukura pieaugums: ${stats.worstMealNameValue > 0 ? '+' : ''}${formatOne(stats.worstMealNameValue)}`
                )
              : tr(
                  'analysisWorstMealNameSubtitle',
                  'Показывает блюдо, после которого сахар растёт сильнее всего.',
                  'Shows the dish after which glucose rises the most.',
                  'Parāda ēdienu, pēc kura cukurs paaugstinās visvairāk.'
                )
          }
          valueColor={stats.worstMealNameValue > 3 ? RED : TEXT}
        />

        <InsightCard
          title={tr('analysisInsulin', 'Инсулин', 'Insulin', 'Insulīns')}
          value={
            stats.insulinEffect !== null
              ? `${stats.insulinEffect > 0 ? '+' : ''}${formatOne(stats.insulinEffect)}`
              : noDataText
          }
          subtitle={
            stats.insulinChecksCount > 0
              ? stats.insulinEffect !== null && stats.insulinEffect > 2
                ? tr(
                    'analysisInsulinNotEnough',
                    'Среднее изменение сахара после укола. Возможно, инсулина недостаточно.',
                    'Average glucose change after injection. Insulin may be insufficient.',
                    'Vidējās cukura izmaiņas pēc injekcijas. Iespējams, insulīna nepietiek.'
                  )
                : tr(
                    'analysisInsulinNormal',
                    'Среднее изменение сахара после укола. Инсулин работает нормально.',
                    'Average glucose change after injection. Insulin works normally.',
                    'Vidējās cukura izmaiņas pēc injekcijas. Insulīns darbojas normāli.'
                  )
              : tr(
                  'analysisInsulinNoData',
                  'Пока недостаточно записей с инсулином и двумя замерами.',
                  'Not enough entries with insulin and two measurements yet.',
                  'Pagaidām nepietiek ierakstu ar insulīnu un diviem mērījumiem.'
                )
          }
          valueColor={stats.insulinEffect !== null && stats.insulinEffect > 2 ? RED : TEXT}
        />

        <SectionCard title={tr('analysisToday', 'Сегодня', 'Today', 'Šodien')}>
          <InsightCard
            title={tr('analysisEntries', 'Записей', 'Entries', 'Ieraksti')}
            value={String(stats.todayCount)}
            subtitle={tr(
              'analysisTodayEntriesSubtitle',
              'Сколько записей сделано сегодня.',
              'How many entries were made today.',
              'Cik ierakstu veikti šodien.'
            )}
          />

          <InsightCard
            title={tr('analysisAvgBefore', 'Средний сахар до еды', 'Average glucose before meals', 'Vidējais cukurs pirms ēšanas')}
            value={stats.todayAvgBefore !== null ? formatOne(stats.todayAvgBefore) : noDataText}
            subtitle={tr(
              'analysisTodayAvgBeforeSubtitle',
              'Средний сахар до еды за сегодня.',
              'Average glucose before meals today.',
              'Vidējais cukurs pirms ēšanas šodien.'
            )}
          />

          <InsightCard
            title={tr('analysisAvgAfter', 'Средний сахар после еды', 'Average glucose after meals', 'Vidējais cukurs pēc ēšanas')}
            value={stats.todayAvgAfter !== null ? formatOne(stats.todayAvgAfter) : noDataText}
            subtitle={tr(
              'analysisTodayAvgAfterSubtitle',
              'Средний сахар после еды за сегодня.',
              'Average glucose after meals today.',
              'Vidējais cukurs pēc ēšanas šodien.'
            )}
          />

          <InsightCard
            title={tr('analysisHighSugar', 'Высокий сахар', 'High glucose', 'Augsts cukurs')}
            value={String(stats.todayHigh)}
            subtitle={tr(
              'analysisTodayHighSubtitle',
              'Количество высоких значений после еды за сегодня.',
              'Number of high after-meal values today.',
              'Augsto vērtību skaits pēc ēšanas šodien.'
            )}
            valueColor={stats.todayHigh > 0 ? RED : TEXT}
          />
        </SectionCard>

        <SectionCard title={tr('analysisLast7Days', 'Последние 7 дней', 'Last 7 days', 'Pēdējās 7 dienas')}>
          <InsightCard
            title={tr('analysisEntries', 'Записей', 'Entries', 'Ieraksti')}
            value={String(stats.last7DaysCount)}
            subtitle={tr(
              'analysisLast7EntriesSubtitle',
              'Сколько записей попало в последние 7 дней.',
              'How many entries are included in the last 7 days.',
              'Cik ierakstu ietilpst pēdējās 7 dienās.'
            )}
          />

          <InsightCard
            title={tr('analysisAvgBefore', 'Средний сахар до еды', 'Average glucose before meals', 'Vidējais cukurs pirms ēšanas')}
            value={stats.last7AvgBefore !== null ? formatOne(stats.last7AvgBefore) : noDataText}
            subtitle={tr(
              'analysisLast7AvgBeforeSubtitle',
              'Средний сахар до еды за последние 7 дней.',
              'Average glucose before meals for the last 7 days.',
              'Vidējais cukurs pirms ēšanas pēdējās 7 dienās.'
            )}
          />

          <InsightCard
            title={tr('analysisAvgAfter', 'Средний сахар после еды', 'Average glucose after meals', 'Vidējais cukurs pēc ēšanas')}
            value={stats.last7AvgAfter !== null ? formatOne(stats.last7AvgAfter) : noDataText}
            subtitle={tr(
              'analysisLast7AvgAfterSubtitle',
              'Средний сахар после еды за последние 7 дней.',
              'Average glucose after meals for the last 7 days.',
              'Vidējais cukurs pēc ēšanas pēdējās 7 dienās.'
            )}
          />

          <InsightCard
            title={tr('analysisHighSugar', 'Высокий сахар', 'High glucose', 'Augsts cukurs')}
            value={String(stats.last7High)}
            subtitle={tr(
              'analysisLast7HighSubtitle',
              'Количество высоких значений после еды за последние 7 дней.',
              'Number of high after-meal values for the last 7 days.',
              'Augsto vērtību skaits pēc ēšanas pēdējās 7 dienās.'
            )}
            valueColor={stats.last7High > 0 ? RED : TEXT}
          />
        </SectionCard>

        <SectionCard title={tr('analysisLast30Days', 'Последние 30 дней', 'Last 30 days', 'Pēdējās 30 dienas')}>
          <InsightCard
            title={tr('analysisEntries', 'Записей', 'Entries', 'Ieraksti')}
            value={String(stats.last30DaysCount)}
            subtitle={tr(
              'analysisLast30EntriesSubtitle',
              'Сколько записей попало в последние 30 дней.',
              'How many entries are included in the last 30 days.',
              'Cik ierakstu ietilpst pēdējās 30 dienās.'
            )}
          />

          <InsightCard
            title={tr('analysisAvgBefore', 'Средний сахар до еды', 'Average glucose before meals', 'Vidējais cukurs pirms ēšanas')}
            value={stats.last30AvgBefore !== null ? formatOne(stats.last30AvgBefore) : noDataText}
            subtitle={tr(
              'analysisLast30AvgBeforeSubtitle',
              'Средний сахар до еды за последние 30 дней.',
              'Average glucose before meals for the last 30 days.',
              'Vidējais cukurs pirms ēšanas pēdējās 30 dienās.'
            )}
          />

          <InsightCard
            title={tr('analysisAvgAfter', 'Средний сахар после еды', 'Average glucose after meals', 'Vidējais cukurs pēc ēšanas')}
            value={stats.last30AvgAfter !== null ? formatOne(stats.last30AvgAfter) : noDataText}
            subtitle={tr(
              'analysisLast30AvgAfterSubtitle',
              'Средний сахар после еды за последние 30 дней.',
              'Average glucose after meals for the last 30 days.',
              'Vidējais cukurs pēc ēšanas pēdējās 30 dienās.'
            )}
          />

          <InsightCard
            title={tr('analysisHighSugar', 'Высокий сахар', 'High glucose', 'Augsts cukurs')}
            value={String(stats.last30High)}
            subtitle={tr(
              'analysisLast30HighSubtitle',
              'Количество высоких значений после еды за последние 30 дней.',
              'Number of high after-meal values for the last 30 days.',
              'Augsto vērtību skaits pēc ēšanas pēdējās 30 dienās.'
            )}
            valueColor={stats.last30High > 0 ? RED : TEXT}
          />
        </SectionCard>

        <SectionCard title={tr('analysisTrend', 'Тренд', 'Trend', 'Tendence')}>
          <InsightCard
            title={tr('analysisOverallTrend', 'Общий тренд', 'Overall trend', 'Kopējā tendence')}
            value={stats.overallTrend.label}
            subtitle={stats.overallTrend.subtitle}
            valueColor={stats.overallTrend.color}
          />
        </SectionCard>

        <SectionCard title={tr('analysisTrend7Days', 'Тренд за 7 дней', '7-day trend', '7 dienu tendence')}>
          <InsightCard
            title={tr('analysisLastWeek', 'Последняя неделя', 'Last week', 'Pēdējā nedēļa')}
            value={stats.last7Trend.label}
            subtitle={stats.last7Trend.subtitle}
            valueColor={stats.last7Trend.color}
          />
        </SectionCard>

        <SectionCard title={tr('analysisRiskForecast', 'Прогноз риска высокого сахара', 'High glucose risk forecast', 'Augsta cukura riska prognoze')}>
          <InsightCard
            title={tr('analysisRiskScore', 'Оценка риска', 'Risk estimation', 'Riska novērtējums')}
            value={stats.riskData.label}
            subtitle={stats.riskData.subtitle}
            valueColor={stats.riskData.color}
          />
        </SectionCard>

        <SectionCard title={tr('analysisAdvice', 'Совет', 'Advice', 'Padoms')}>
          <Text
            style={{
              fontSize: 16,
              color: TEXT,
              lineHeight: 24,
            }}
          >
            {stats.smartAdvice}
          </Text>
        </SectionCard>
      </ScrollView>
    </SafeAreaView>
  );
}