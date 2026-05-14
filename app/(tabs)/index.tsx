import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import i18n from '../../lib/i18n';

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
        backgroundColor: '#2563eb',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 14,
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>
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
        backgroundColor: '#ffffff',
        paddingVertical: 18,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#d1d5db',
      }}
    >
      <Text style={{ color: '#111827', fontSize: 18, fontWeight: '800' }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={{
            backgroundColor: '#2563eb',
            borderRadius: 28,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <Text
            style={{
              color: '#ffffff',
              fontSize: 32,
              fontWeight: '900',
              marginBottom: 10,
            }}
          >
            Diabet Diary AI
          </Text>

          <Text style={{ color: '#dbeafe', fontSize: 17, lineHeight: 25 }}>
            {tr(
              'homeSubtitle',
              'Сахар, еда, ХЕ, инсулин и графики в одном месте.',
              'Glucose, food, bread units, insulin and charts in one place.',
              'Cukurs, ēdiens, maizes vienības, insulīns un grafiki vienuviet.'
            )}
          </Text>
        </View>

        <PrimaryButton
          title={tr(
            'takeFoodPhoto',
            'СФОТОГРАФИРОВАТЬ ЕДУ',
            'TAKE FOOD PHOTO',
            'NOFOTOGRAFĒT ĒDIENU'
          )}
          onPress={() => router.push('/food-entry')}
        />

        <SecondaryButton
          title={tr(
            'manualEntry',
            'РУЧНАЯ ЗАПИСЬ',
            'MANUAL ENTRY',
            'MANUĀLS IERAKSTS'
          )}
          onPress={() => router.push('/food-entry')}
        />

        <SecondaryButton
          title={tr(
            'openDiary',
            'ОТКРЫТЬ ДНЕВНИК',
            'OPEN DIARY',
            'ATVĒRT DIENASGRĀMATU'
          )}
          onPress={() => router.push('/history')}
        />

        <SecondaryButton
          title={tr(
            'glucoseChart',
            'ГРАФИК САХАРА',
            'GLUCOSE CHART',
            'CUKURA GRAFIKS'
          )}
          onPress={() => router.push('/glucose-chart')}
        />

        <SecondaryButton
          title={tr('report', 'ОТЧЁТ', 'REPORT', 'ATSKAITE')}
          onPress={() => router.push('/report')}
        />

        <SecondaryButton
          title={tr(
            'smartAnalysis',
            'УМНЫЙ АНАЛИЗ',
            'SMART ANALYSIS',
            'GUDRĀ ANALĪZE'
          )}
          onPress={() => router.push('/analysis')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}