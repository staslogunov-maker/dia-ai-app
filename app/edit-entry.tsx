import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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

const HISTORY_KEY = 'history';

export default function EditEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [entry, setEntry] = useState<DiaryEntry | null>(null);
  const [loading, setLoading] = useState(true);

  const [mealType, setMealType] = useState('');
  const [mealName, setMealName] = useState('');
  const [mealComment, setMealComment] = useState('');
  const [calories, setCalories] = useState('');
  const [breadUnits, setBreadUnits] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [glucoseBefore, setGlucoseBefore] = useState('');
  const [insulinUnits, setInsulinUnits] = useState('');
  const [glucoseAfter, setGlucoseAfter] = useState('');
  const [userNote, setUserNote] = useState('');

  useEffect(() => {
    loadEntry();
  }, []);

  const loadEntry = async () => {
    try {
      const id = String(params.id || '');

      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      const history: DiaryEntry[] = raw ? JSON.parse(raw) : [];

      const found = history.find((item) => item.id === id);

      if (!found) {
        Alert.alert('Ошибка', 'Запись не найдена');
        router.back();
        return;
      }

      setEntry(found);

      setMealType(found.mealType || '');
      setMealName(found.mealName || '');
      setMealComment(found.mealComment || '');
      setCalories(found.calories || '');
      setBreadUnits(found.breadUnits || '');
      setProtein(found.protein || '');
      setFat(found.fat || '');
      setCarbs(found.carbs || '');
      setGlucoseBefore(found.glucoseBefore || '');
      setInsulinUnits(found.insulinUnits || '');
      setGlucoseAfter(found.glucoseAfter || '');
      setUserNote(found.userNote || '');
    } catch (e) {
      console.log(e);
      Alert.alert('Ошибка', 'Не удалось загрузить запись');
    } finally {
      setLoading(false);
    }
  };

  const normalizeValue = (value: string) => {
    return value.trim();
  };

  const saveEntry = async () => {
    try {
      if (!entry) return;

      const raw = await AsyncStorage.getItem(HISTORY_KEY);
      const history: DiaryEntry[] = raw ? JSON.parse(raw) : [];

      const updatedHistory = history.map((item) => {
        if (item.id !== entry.id) return item;

        return {
          ...item,
          mealType: normalizeValue(mealType),
          mealName: normalizeValue(mealName),
          mealComment: normalizeValue(mealComment),
          calories: normalizeValue(calories),
          breadUnits: normalizeValue(breadUnits),
          protein: normalizeValue(protein),
          fat: normalizeValue(fat),
          carbs: normalizeValue(carbs),
          glucoseBefore: normalizeValue(glucoseBefore),
          insulinUnits: normalizeValue(insulinUnits),
          glucoseAfter: normalizeValue(glucoseAfter),
          userNote: normalizeValue(userNote),
        };
      });

      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));

      Alert.alert('Готово', 'Запись обновлена');
      router.back();
    } catch (e) {
      console.log(e);
      Alert.alert('Ошибка', 'Не удалось сохранить');
    }
  };

  const deleteEntry = async () => {
    try {
      if (!entry) return;

      Alert.alert('Удалить запись?', 'Эту запись нельзя будет восстановить.', [
        {
          text: 'Отмена',
          style: 'cancel',
        },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const raw = await AsyncStorage.getItem(HISTORY_KEY);
            const history: DiaryEntry[] = raw ? JSON.parse(raw) : [];

            const filtered = history.filter((item) => item.id !== entry.id);

            await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));

            Alert.alert('Удалено', 'Запись удалена');
            router.back();
          },
        },
      ]);
    } catch (e) {
      console.log(e);
      Alert.alert('Ошибка', 'Не удалось удалить');
    }
  };

  const addAnotherDish = () => {
    if (!entry) return;

    router.push({
      pathname: '/food-entry',
      params: {
        editId: entry.id,
        mode: 'add-dish',
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>← Назад</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Редактировать запись</Text>

          {entry?.photoUri ? (
            <Image source={{ uri: entry.photoUri }} style={styles.image} />
          ) : null}

          <TouchableOpacity
            style={styles.addDishButton}
            onPress={addAnotherDish}
          >
            <Text style={styles.addDishText}>+ Добавить ещё блюдо к этой записи</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Input
              label="Тип приёма пищи"
              value={mealType}
              onChangeText={setMealType}
            />

            <Input
              label="Название блюда"
              value={mealName}
              onChangeText={setMealName}
            />

            <Input
              label="Комментарий"
              value={mealComment}
              onChangeText={setMealComment}
              multiline
            />

            <Input
              label="Калории"
              value={calories}
              onChangeText={setCalories}
            />

            <Input
              label="ХЕ"
              value={breadUnits}
              onChangeText={setBreadUnits}
            />

            <Input
              label="Белки"
              value={protein}
              onChangeText={setProtein}
            />

            <Input
              label="Жиры"
              value={fat}
              onChangeText={setFat}
            />

            <Input
              label="Углеводы"
              value={carbs}
              onChangeText={setCarbs}
            />

            <Input
              label="Сахар до еды"
              value={glucoseBefore}
              onChangeText={setGlucoseBefore}
            />

            <Input
              label="Инсулин"
              value={insulinUnits}
              onChangeText={setInsulinUnits}
            />

            <Input
              label="Сахар после еды"
              value={glucoseAfter}
              onChangeText={setGlucoseAfter}
            />

            <Input
              label="Заметка"
              value={userNote}
              onChangeText={setUserNote}
              multiline
            />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={saveEntry}>
            <Text style={styles.saveText}>Сохранить</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.deleteButton} onPress={deleteEntry}>
            <Text style={styles.deleteText}>Удалить запись</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type InputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  multiline?: boolean;
};

function Input({
  label,
  value,
  onChangeText,
  multiline = false,
}: InputProps) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={[styles.input, multiline && styles.textArea]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        placeholderTextColor="#94a3b8"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#f1f5f9',
  },

  container: {
    padding: 16,
    paddingBottom: 50,
  },

  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    fontSize: 16,
    color: '#334155',
    fontWeight: '700',
  },

  backButton: {
    marginBottom: 10,
  },

  backText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563eb',
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 16,
  },

  image: {
    width: '100%',
    height: 220,
    borderRadius: 24,
    marginBottom: 14,
    backgroundColor: '#cbd5e1',
  },

  addDishButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },

  addDishText: {
    color: '#2563eb',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
  },

  inputWrap: {
    marginBottom: 14,
  },

  label: {
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },

  input: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0f172a',
  },

  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  saveButton: {
    marginTop: 18,
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },

  saveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },

  deleteButton: {
    marginTop: 12,
    backgroundColor: '#fee2e2',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },

  deleteText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '800',
  },
});