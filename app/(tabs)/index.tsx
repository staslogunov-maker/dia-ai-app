import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

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
      <Text
        style={{
          color: '#ffffff',
          fontSize: 18,
          fontWeight: '900',
        }}
      >
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
      <Text
        style={{
          color: '#111827',
          fontSize: 18,
          fontWeight: '800',
        }}
      >
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
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
        }}
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

          <Text
            style={{
              color: '#dbeafe',
              fontSize: 17,
              lineHeight: 25,
            }}
          >
            Сахар, еда, ХЕ, инсулин и графики в одном месте.
          </Text>
        </View>

        <PrimaryButton
          title="СФОТОГРАФИРОВАТЬ ЕДУ"
          onPress={() => router.push('/food-entry')}
        />

        <SecondaryButton
          title="РУЧНАЯ ЗАПИСЬ"
          onPress={() => router.push('/food-entry')}
        />

        <SecondaryButton
          title="ОТКРЫТЬ ДНЕВНИК"
          onPress={() => router.push('/history')}
        />

        <SecondaryButton
          title="ГРАФИК САХАРА"
          onPress={() => router.push('/glucose-chart')}
        />

        <SecondaryButton
          title="ОТЧЁТ"
          onPress={() => router.push('/report')}
        />

        <SecondaryButton
          title="УМНЫЙ АНАЛИЗ"
          onPress={() => router.push('/analysis')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}