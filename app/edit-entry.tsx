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

import i18n from '../lib/i18n';

type DishItem = {
  id: string;
  photoUri?: string;

  mealName: string;
  mealComment: string;

  calories: string;
  breadUnits: string;
  protein: string;
  fat: string;
  carbs: string;

  aiComment?: string;
};

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

  dishes?: DishItem[];
};

const HISTORY_KEY = 'history';

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

function getPhotoUris(item: DiaryEntry) {
  const list: string[] = [];

  if (Array.isArray(item.photoUris)) {
    item.photoUris.forEach((uri) => {
      if (uri && !list.includes(uri)) {
        list.push(uri);
      }
    });
  }

  if (item.photoUri && !list.includes(item.photoUri)) {
    list.unshift(item.photoUri);
  }

  return list;
}

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
        Alert.alert(
          tr('error', 'Ошибка', 'Error', 'Kļūda'),
          tr(
            'entryNotFound',
            'Запись не найдена',
            'Entry not found',
            'Ieraksts nav atrasts'
          )
        );

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

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        tr(
          'loadEntryError',
          'Не удалось загрузить запись',
          'Could not load entry',
          'Neizdevās ielādēt ierakstu'
        )
      );
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

      await AsyncStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(updatedHistory)
      );

      Alert.alert(
        tr('done', 'Готово', 'Done', 'Gatavs'),
        tr(
          'entryUpdated',
          'Запись обновлена',
          'Entry updated',
          'Ieraksts atjaunināts'
        ),
        [
          {
            text: tr('ok', 'ОК', 'OK', 'Labi'),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (e) {
      console.log(e);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        tr(
          'saveError',
          'Не удалось сохранить',
          'Could not save',
          'Neizdevās saglabāt'
        )
      );
    }
  };

  const deleteEntry = async () => {
    try {
      if (!entry) return;

      Alert.alert(
        tr(
          'deleteEntryQuestion',
          'Удалить запись?',
          'Delete entry?',
          'Dzēst ierakstu?'
        ),
        tr(
          'deleteEntryWarning',
          'Эту запись нельзя будет восстановить.',
          'This entry cannot be restored.',
          'Šo ierakstu nevarēs atjaunot.'
        ),
        [
          {
            text: tr('cancel', 'Отмена', 'Cancel', 'Atcelt'),
            style: 'cancel',
          },
          {
            text: tr('delete', 'Удалить', 'Delete', 'Dzēst'),
            style: 'destructive',

            onPress: async () => {
              const raw = await AsyncStorage.getItem(HISTORY_KEY);

              const history: DiaryEntry[] = raw
                ? JSON.parse(raw)
                : [];

              const filtered = history.filter(
                (item) => item.id !== entry.id
              );

              await AsyncStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(filtered)
              );

              Alert.alert(
                tr('deleted', 'Удалено', 'Deleted', 'Dzēsts'),
                tr(
                  'entryDeleted',
                  'Запись удалена',
                  'Entry deleted',
                  'Ieraksts dzēsts'
                ),
                [
                  {
                    text: tr('ok', 'ОК', 'OK', 'Labi'),
                    onPress: () => router.back(),
                  },
                ]
              );
            },
          },
        ]
      );
    } catch (e) {
      console.log(e);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        tr(
          'deleteError',
          'Не удалось удалить',
          'Could not delete',
          'Neizdevās dzēst'
        )
      );
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
          <Text style={styles.loadingText}>
            {tr(
              'loading',
              'Загрузка...',
              'Loading...',
              'Ielāde...'
            )}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const photos = entry ? getPhotoUris(entry) : [];

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
      >
        <ScrollView contentContainerStyle={styles.container}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backText}>
              ← {tr('back', 'Назад', 'Back', 'Atpakaļ')}
            </Text>
          </TouchableOpacity>

          <Text style={styles.title}>
            {tr(
              'editEntryTitle',
              'Редактировать запись',
              'Edit entry',
              'Labot ierakstu'
            )}
          </Text>

          {photos.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 14 }}
            >
              {photos.map((uri, index) => (
                <View
                  key={`${uri}-${index}`}
                  style={{
                    width: 280,
                    marginRight:
                      index === photos.length - 1
                        ? 0
                        : 12,
                  }}
                >
                  <Image
                    source={{ uri }}
                    style={styles.image}
                  />

                  <Text
                    style={{
                      marginTop: 6,
                      textAlign: 'center',
                      color: '#64748b',
                      fontWeight: '800',
                      fontSize: 14,
                    }}
                  >
                    {tr(
                      'photo',
                      'Фото',
                      'Photo',
                      'Foto'
                    )}{' '}
                    {index + 1}
                  </Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <TouchableOpacity
            style={styles.addDishButton}
            onPress={addAnotherDish}
          >
            <Text style={styles.addDishText}>
              {tr(
                'addAnotherDishToEntry',
                '+ Добавить ещё блюдо к этой записи',
                '+ Add another dish to this entry',
                '+ Pievienot vēl vienu ēdienu šim ierakstam'
              )}
            </Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Input
              label={tr(
                'mealType',
                'Тип приёма пищи',
                'Meal type',
                'Ēdienreizes veids'
              )}
              value={mealType}
              onChangeText={setMealType}
            />

            <Input
              label={tr(
                'summaryTitle',
                'Общий итог приёма пищи',
                'Meal summary',
                'Ēdienreizes kopsavilkums'
              )}
              value={mealName}
              onChangeText={setMealName}
            />

            <Input
              label={tr(
                'summaryComment',
                'Общий комментарий',
                'Summary comment',
                'Kopsavilkuma komentārs'
              )}
              value={mealComment}
              onChangeText={setMealComment}
              multiline
            />

            <Input
              label={tr(
                'calories',
                'Калории',
                'Calories',
                'Kalorijas'
              )}
              value={calories}
              onChangeText={setCalories}
              keyboardType="numeric"
            />

            <Input
              label={tr(
                'breadUnitsShort',
                'ХЕ',
                'BU',
                'MV'
              )}
              value={breadUnits}
              onChangeText={setBreadUnits}
              keyboardType="numeric"
            />

            <Input
              label={tr(
                'protein',
                'Белки',
                'Protein',
                'Olbaltumvielas'
              )}
              value={protein}
              onChangeText={setProtein}
              keyboardType="numeric"
            />

            <Input
              label={tr(
                'fat',
                'Жиры',
                'Fat',
                'Tauki'
              )}
              value={fat}
              onChangeText={setFat}
              keyboardType="numeric"
            />

            <Input
              label={tr(
                'carbs',
                'Углеводы',
                'Carbs',
                'Ogļhidrāti'
              )}
              value={carbs}
              onChangeText={setCarbs}
              keyboardType="numeric"
            />

            <Input
              label={tr(
                'glucoseBefore',
                'Сахар до еды',
                'Glucose before meal',
                'Cukurs pirms ēšanas'
              )}
              value={glucoseBefore}
              onChangeText={setGlucoseBefore}
              keyboardType="numeric"
            />

            <Input
              label={tr(
                'insulin',
                'Инсулин',
                'Insulin',
                'Insulīns'
              )}
              value={insulinUnits}
              onChangeText={setInsulinUnits}
              keyboardType="numeric"
            />

            <Input
              label={tr(
                'glucoseAfter',
                'Сахар после еды',
                'Glucose after meal',
                'Cukurs pēc ēšanas'
              )}
              value={glucoseAfter}
              onChangeText={setGlucoseAfter}
              keyboardType="numeric"
            />

            <Input
              label={tr(
                'note',
                'Заметка',
                'Note',
                'Piezīme'
              )}
              value={userNote}
              onChangeText={setUserNote}
              multiline
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={saveEntry}
          >
            <Text style={styles.saveText}>
              {tr(
                'save',
                'Сохранить',
                'Save',
                'Saglabāt'
              )}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={deleteEntry}
          >
            <Text style={styles.deleteText}>
              {tr(
                'deleteEntry',
                'Удалить запись',
                'Delete entry',
                'Dzēst ierakstu'
              )}
            </Text>
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
  keyboardType?: 'default' | 'numeric';
};

function Input({
  label,
  value,
  onChangeText,
  multiline = false,
  keyboardType = 'default',
}: InputProps) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        style={[
          styles.input,
          multiline && styles.textArea,
        ]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
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
    width: 280,
    height: 220,
    borderRadius: 24,
    backgroundColor: '#cbd5e1',
  },

  addDishButton: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#2563eb',
    borderStyle: 'dashed',
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 12,
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