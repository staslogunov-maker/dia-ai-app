import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
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
  photoUris?: string[];
};

type AnalyzeResult = {
  displayName: string;
  calories: number;
  breadUnits: number;
  protein: number;
  fat: number;
  carbs: number;
  comment: string;
};

const API_URL = 'https://dia-server.onrender.com/analyze-food';
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

function readNumber(...values: any[]) {
  for (const value of values) {
    if (value === null || value === undefined || value === '') continue;

    if (typeof value === 'number' && !Number.isNaN(value)) return value;

    const match = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);

    if (match) {
      const num = Number(match[0]);
      if (!Number.isNaN(num)) return num;
    }
  }

  return 0;
}

function cleanText(value: any, fallback = '') {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function formatNumber(value: number | string) {
  if (value === '' || value === null || value === undefined) return '';

  const num = typeof value === 'number' ? value : readNumber(value);

  if (Number.isNaN(num)) return String(value);

  const fixed = Number.isInteger(num) ? String(num) : String(Number(num.toFixed(1)));

  return fixed.replace('.', ',');
}

function sumField(oldValue: string, newValue: string) {
  const oldNum = readNumber(oldValue);
  const newNum = readNumber(newValue);
  return formatNumber(oldNum + newNum);
}

function joinText(oldValue: string, newValue: string) {
  const oldText = String(oldValue || '').trim();
  const newText = String(newValue || '').trim();

  if (oldText && newText) return `${oldText}, ${newText}`;
  if (oldText) return oldText;
  return newText;
}

function joinNote(oldValue: string, newValue: string) {
  const oldText = String(oldValue || '').trim();
  const newText = String(newValue || '').trim();

  if (oldText && newText) return `${oldText}\n\nДобавлено блюдо: ${newText}`;
  if (oldText) return oldText;
  return newText;
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

function normalizeAnalyzeResult(raw: any): AnalyzeResult {
  const data = raw?.result || raw?.data || raw?.analysis || raw?.food || raw?.meal || raw;

  const nutrition =
    data?.nutrition ||
    data?.nutrients ||
    data?.macros ||
    data?.macronutrients ||
    data;

  return {
    displayName: cleanText(
      data?.displayName ||
        data?.display_name ||
        data?.name ||
        data?.mealName ||
        data?.meal_name ||
        data?.dish ||
        data?.dishName,
      tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma')
    ),
    calories: readNumber(
      nutrition?.calories,
      nutrition?.kcal,
      nutrition?.energy,
      data?.calories,
      data?.kcal
    ),
    breadUnits: readNumber(
      nutrition?.breadUnits,
      nutrition?.bread_units,
      nutrition?.xe,
      nutrition?.XE,
      data?.breadUnits,
      data?.bread_units,
      data?.xe,
      data?.XE
    ),
    protein: readNumber(
      nutrition?.protein,
      nutrition?.proteins,
      nutrition?.protein_g,
      data?.protein,
      data?.proteins
    ),
    fat: readNumber(
      nutrition?.fat,
      nutrition?.fats,
      nutrition?.fat_g,
      data?.fat,
      data?.fats
    ),
    carbs: readNumber(
      nutrition?.carbs,
      nutrition?.carbohydrates,
      nutrition?.carbs_g,
      data?.carbs,
      data?.carbohydrates
    ),
    comment: cleanText(
      data?.comment ||
        data?.aiComment ||
        data?.ai_comment ||
        data?.description ||
        data?.note,
      ''
    ),
  };
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
        backgroundColor: disabled ? '#93c5fd' : '#2563eb',
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        marginBottom: 12,
      }}
    >
      <Text style={{ color: '#ffffff', fontSize: 17, fontWeight: '800' }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function SecondaryButton({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={{
        backgroundColor: '#ffffff',
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#d1d5db',
      }}
    >
      <Text style={{ color: '#111827', fontSize: 17, fontWeight: '700' }}>
        {title}
      </Text>
    </TouchableOpacity>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View
      style={{
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
      }}
    >
      <Text
        style={{
          fontSize: 19,
          fontWeight: '800',
          color: '#111827',
          marginBottom: 12,
        }}
      >
        {title}
      </Text>

      {children}
    </View>
  );
}

function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = 'default',
  multiline = false,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
  multiline?: boolean;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 14,
          color: '#6b7280',
          marginBottom: 6,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        keyboardType={keyboardType}
        multiline={multiline}
        style={{
          backgroundColor: '#f9fafb',
          borderWidth: 1,
          borderColor: '#d1d5db',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 14 : 12,
          fontSize: 16,
          color: '#111827',
          minHeight: multiline ? 90 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
        placeholderTextColor="#9ca3af"
      />
    </View>
  );
}

function MealTypeSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const items = [
    tr('breakfast', 'Завтрак', 'Breakfast', 'Brokastis'),
    tr('lunch', 'Обед', 'Lunch', 'Pusdienas'),
    tr('dinner', 'Ужин', 'Dinner', 'Vakariņas'),
    tr('snack', 'Перекус', 'Snack', 'Uzkoda'),
  ];

  return (
    <View style={{ marginBottom: 12 }}>
      <Text
        style={{
          fontSize: 14,
          color: '#6b7280',
          marginBottom: 8,
          fontWeight: '600',
        }}
      >
        {tr('mealType', 'Тип приёма пищи', 'Meal type', 'Ēdienreizes veids')}
      </Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map((item) => {
          const active = value === item;

          return (
            <TouchableOpacity
              key={item}
              onPress={() => onChange(item)}
              activeOpacity={0.85}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: 14,
                backgroundColor: active ? '#2563eb' : '#ffffff',
                borderWidth: 1,
                borderColor: active ? '#2563eb' : '#d1d5db',
              }}
            >
              <Text
                style={{
                  color: active ? '#ffffff' : '#111827',
                  fontWeight: '700',
                }}
              >
                {item}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function FoodEntryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const editId = String(params.editId || '');
  const mode = String(params.mode || '');
  const isAddDishMode = !!editId && mode === 'add-dish';

  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [loading, setLoading] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  const [mealType, setMealType] = useState(
    tr('breakfast', 'Завтрак', 'Breakfast', 'Brokastis')
  );
  const [glucoseBefore, setGlucoseBefore] = useState('');
  const [glucoseAfter, setGlucoseAfter] = useState('');
  const [insulinUnits, setInsulinUnits] = useState('');
  const [mealComment, setMealComment] = useState('');
  const [userNote, setUserNote] = useState('');

  const [mealName, setMealName] = useState('');
  const [calories, setCalories] = useState('');
  const [breadUnits, setBreadUnits] = useState('');
  const [protein, setProtein] = useState('');
  const [fat, setFat] = useState('');
  const [carbs, setCarbs] = useState('');
  const [aiComment, setAiComment] = useState('');
  const [photoUri, setPhotoUri] = useState('');

  const goToHistoryClean = () => {
    try {
      const anyRouter = router as any;

      if (typeof anyRouter.dismissAll === 'function') {
        anyRouter.dismissAll();
      }
    } catch {}

    router.replace('/history');
  };

  const clearForm = () => {
    setMealType(tr('breakfast', 'Завтрак', 'Breakfast', 'Brokastis'));
    setGlucoseBefore('');
    setGlucoseAfter('');
    setInsulinUnits('');
    setMealComment('');
    setUserNote('');
    setMealName('');
    setCalories('');
    setBreadUnits('');
    setProtein('');
    setFat('');
    setCarbs('');
    setAiComment('');
    setPhotoUri('');
    setSavedOnce(false);
  };

  const showSavedAndOpenHistory = (message: string) => {
    setSavedOnce(true);

    Alert.alert('Сохранено', message, [
      {
        text: 'ОК',
        onPress: goToHistoryClean,
      },
    ]);
  };

  const fillFromAI = (data: AnalyzeResult) => {
    setMealName(data.displayName || '');
    setCalories(formatNumber(data.calories));
    setBreadUnits(formatNumber(data.breadUnits));
    setProtein(formatNumber(data.protein));
    setFat(formatNumber(data.fat));
    setCarbs(formatNumber(data.carbs));
    setAiComment(data.comment || '');
    setSavedOnce(false);
  };

  const compressAndSavePhoto = async (uri: string) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 900 } }],
      {
        compress: 0.6,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    setPhotoUri(result.uri);
    return result.uri;
  };

  const analyzeFood = async (imageUri: string) => {
    try {
      setLoading(true);

      const compressedUri = await compressAndSavePhoto(imageUri);

      const base64 = await FileSystem.readAsStringAsync(compressedUri, {
        encoding: 'base64',
      });

      const response = await fetch(API_URL.replace(/\/+$/, ''), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageBase64: base64,
        }),
      });

      const text = await response.text();
      console.log('SERVER RESPONSE:', text);

      let raw: any;

      try {
        raw = JSON.parse(text);
      } catch {
        throw new Error(
          tr(
            'serverNotJson',
            'Сервер вернул не JSON: ',
            'Server returned non-JSON: ',
            'Serveris neatgrieza JSON: '
          ) + text
        );
      }

      if (!response.ok) {
        throw new Error(
          raw?.error ||
            tr(
              'serverError',
              'Сервер вернул ошибку',
              'Server returned an error',
              'Serveris atgrieza kļūdu'
            )
        );
      }

      const result = normalizeAnalyzeResult(raw);
      fillFromAI(result);
    } catch (error: any) {
      console.log('Analysis error:', error);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        error?.message ||
          tr(
            'analysisError',
            'Не удалось проанализировать фото',
            'Could not analyze the photo',
            'Neizdevās analizēt foto'
          )
      );
    } finally {
      setLoading(false);
    }
  };

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();

      if (!result.granted) {
        Alert.alert(
          tr('error', 'Ошибка', 'Error', 'Kļūda'),
          tr(
            'cameraAccessNeeded',
            'Нужен доступ к камере',
            'Camera access needed',
            'Nepieciešama piekļuve kamerai'
          )
        );
        return;
      }
    }

    setShowCamera(true);
  };

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) {
        Alert.alert(
          tr('error', 'Ошибка', 'Error', 'Kļūda'),
          tr(
            'cameraNotReady',
            'Камера ещё не готова',
            'Camera is not ready yet',
            'Kamera vēl nav gatava'
          )
        );
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });

      if (!photo?.uri) {
        Alert.alert(
          tr('error', 'Ошибка', 'Error', 'Kļūda'),
          tr(
            'photoFailed',
            'Фото не удалось сделать',
            'Could not take photo',
            'Neizdevās uzņemt foto'
          )
        );
        return;
      }

      setShowCamera(false);
      await analyzeFood(photo.uri);
    } catch (error) {
      console.log('Photo error:', error);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        tr(
          'photoFailed',
          'Фото не удалось сделать',
          'Could not take photo',
          'Neizdevās uzņemt foto'
        )
      );
    }
  };

  const addDishToExistingEntry = async () => {
    const existing = await AsyncStorage.getItem(HISTORY_KEY);
    const history: DiaryEntry[] = existing ? JSON.parse(existing) : [];

    const found = history.find((item) => item.id === editId);

    if (!found) {
      Alert.alert('Ошибка', 'Старая запись не найдена');
      return;
    }

    const updatedHistory = history.map((item) => {
      if (item.id !== editId) return item;

      const oldPhotos = getPhotoUris(item);
      const nextPhotos =
        photoUri && !oldPhotos.includes(photoUri)
          ? [...oldPhotos, photoUri]
          : oldPhotos;

      return {
        ...item,
        mealName: joinText(item.mealName, mealName),
        mealComment: joinText(item.mealComment, mealComment),
        calories: sumField(item.calories, calories),
        breadUnits: sumField(item.breadUnits, breadUnits),
        protein: sumField(item.protein, protein),
        fat: sumField(item.fat, fat),
        carbs: sumField(item.carbs, carbs),
        glucoseBefore: item.glucoseBefore,
        insulinUnits: item.insulinUnits,
        glucoseAfter: item.glucoseAfter,
        userNote: joinNote(item.userNote, userNote || aiComment),
        photoUri: nextPhotos[0] || item.photoUri || photoUri,
        photoUris: nextPhotos,
      };
    });

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));

    showSavedAndOpenHistory('Блюдо добавлено в эту же запись.');
  };

  const saveNewEntry = async () => {
    const newItem: DiaryEntry = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      mealType,
      mealName:
        mealName || tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma'),
      mealComment,
      calories,
      breadUnits,
      protein,
      fat,
      carbs,
      glucoseBefore,
      insulinUnits,
      glucoseAfter,
      userNote: userNote || aiComment,
      photoUri,
      photoUris: photoUri ? [photoUri] : [],
    };

    const existing = await AsyncStorage.getItem(HISTORY_KEY);
    const history = existing ? JSON.parse(existing) : [];

    history.unshift(newItem);

    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    showSavedAndOpenHistory('Запись добавлена в дневник.');
  };

  const saveToHistory = async () => {
    try {
      if (savedOnce) {
        Alert.alert(
          tr('saved', 'Уже сохранено', 'Already saved', 'Jau saglabāts'),
          tr(
            'alreadySavedText',
            'Эта запись уже сохранена. Создай новую запись, чтобы сохранить ещё раз.',
            'This entry is already saved. Create a new entry to save again.',
            'Šis ieraksts jau ir saglabāts. Izveido jaunu ierakstu, lai saglabātu vēlreiz.'
          )
        );
        return;
      }

      if (!mealName && !mealComment) {
        Alert.alert(
          tr('noData', 'Нет данных', 'No data', 'Nav datu'),
          tr(
            'takePhotoFirst',
            'Сначала сфотографируй еду или введи описание',
            'Take a food photo or enter a description first',
            'Vispirms nofotografē ēdienu vai ievadi aprakstu'
          )
        );
        return;
      }

      if (isAddDishMode) {
        await addDishToExistingEntry();
        return;
      }

      await saveNewEntry();
    } catch (error) {
      console.log('Saving error:', error);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        tr(
          'saveError',
          'Не удалось сохранить запись',
          'Could not save entry',
          'Neizdevās saglabāt ierakstu'
        )
      );
    }
  };

  if (showCamera) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#000000' }}>
        <View style={{ flex: 1 }}>
          <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
        </View>

        <View style={{ padding: 16, backgroundColor: '#111827' }}>
          <PrimaryButton
            title={tr('takePhoto', 'СДЕЛАТЬ ФОТО', 'TAKE PHOTO', 'UZŅEMT FOTO')}
            onPress={takePhoto}
          />

          <SecondaryButton
            title={tr('cancel', 'ОТМЕНА', 'CANCEL', 'ATCELT')}
            onPress={() => setShowCamera(false)}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {!isAddDishMode ? (
            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.85}
              style={{
                alignSelf: 'flex-start',
                backgroundColor: '#ffffff',
                paddingHorizontal: 16,
                paddingVertical: 10,
                borderRadius: 14,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: '#d1d5db',
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '800', fontSize: 15 }}>
                ← {tr('back', 'Назад', 'Back', 'Atpakaļ')}
              </Text>
            </TouchableOpacity>
          ) : null}

          <View
            style={{
              backgroundColor: '#2563eb',
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
              {isAddDishMode
                ? 'Добавить блюдо'
                : tr('foodEntryTitle', 'Новая запись', 'New entry', 'Jauns ieraksts')}
            </Text>

            <Text style={{ color: '#dbeafe', fontSize: 16, lineHeight: 23 }}>
              {isAddDishMode
                ? 'Сфотографируй ещё одно блюдо. После сохранения откроется дневник без лишних возвратов назад.'
                : tr(
                    'foodEntrySubtitle',
                    'Сфотографируй еду или введи всё вручную.',
                    'Take a food photo or enter everything manually.',
                    'Nofotografē ēdienu vai ievadi visu manuāli.'
                  )}
            </Text>
          </View>

          <PrimaryButton
            title={tr(
              'openCamera',
              'СФОТОГРАФИРОВАТЬ ЕДУ',
              'TAKE FOOD PHOTO',
              'NOFOTOGRAFĒ ĒDIENU'
            )}
            onPress={openCamera}
          />

          <SecondaryButton
            title={tr('clearForm', 'ОЧИСТИТЬ ФОРМУ', 'CLEAR FORM', 'NOTĪRĪT FORMU')}
            onPress={clearForm}
          />

          {!isAddDishMode && (
            <SectionCard title={tr('beforeMeal', 'Перед едой', 'Before meal', 'Pirms ēšanas')}>
              <MealTypeSelector value={mealType} onChange={setMealType} />

              <InputField
                label={tr(
                  'glucoseBefore',
                  'Сахар до еды',
                  'Glucose before meal',
                  'Cukurs pirms ēšanas'
                )}
                value={glucoseBefore}
                onChangeText={(text) => {
                  setGlucoseBefore(text);
                  setSavedOnce(false);
                }}
                placeholder={tr(
                  'glucoseBeforePlaceholder',
                  'Например: 6.4',
                  'For example: 6.4',
                  'Piemēram: 6.4'
                )}
                keyboardType="numeric"
              />

              <InputField
                label={tr(
                  'mealComment',
                  'Комментарий к еде',
                  'Meal comment',
                  'Komentārs par ēdienu'
                )}
                value={mealComment}
                onChangeText={(text) => {
                  setMealComment(text);
                  setSavedOnce(false);
                }}
                placeholder={tr(
                  'mealCommentPlaceholder',
                  'Например: 2 пирожка и чай',
                  'For example: 2 pies and tea',
                  'Piemēram: 2 pīrādziņi un tēja'
                )}
                multiline
              />
            </SectionCard>
          )}

          {loading && (
            <SectionCard
              title={tr(
                'analyzing',
                'ИИ анализирует фото...',
                'AI is analyzing the photo...',
                'MI analizē foto...'
              )}
            >
              <ActivityIndicator size="large" color="#2563eb" />
            </SectionCard>
          )}

          {!!photoUri && (
            <SectionCard title={tr('dishPhoto', 'Фото блюда', 'Dish photo', 'Ēdiena foto')}>
              <Image
                source={{ uri: photoUri }}
                style={{
                  width: '100%',
                  height: 220,
                  borderRadius: 16,
                  backgroundColor: '#e5e7eb',
                }}
                resizeMode="cover"
              />
            </SectionCard>
          )}

          <SectionCard title={tr('mealAnalysis', 'Еда и анализ', 'Meal and analysis', 'Ēdiens un analīze')}>
            <InputField
              label={tr('dishName', 'Название блюда', 'Dish name', 'Ēdiena nosaukums')}
              value={mealName}
              onChangeText={(text) => {
                setMealName(text);
                setSavedOnce(false);
              }}
            />

            <InputField
              label={tr('calories', 'Калории', 'Calories', 'Kalorijas')}
              value={calories}
              onChangeText={(text) => {
                setCalories(text);
                setSavedOnce(false);
              }}
              keyboardType="numeric"
            />

            <InputField
              label={tr('breadUnits', 'Хлебные единицы', 'Bread units', 'Maizes vienības')}
              value={breadUnits}
              onChangeText={(text) => {
                setBreadUnits(text);
                setSavedOnce(false);
              }}
              keyboardType="numeric"
            />

            <InputField
              label={tr('protein', 'Белки', 'Protein', 'Olbaltumvielas')}
              value={protein}
              onChangeText={(text) => {
                setProtein(text);
                setSavedOnce(false);
              }}
              keyboardType="numeric"
            />

            <InputField
              label={tr('fat', 'Жиры', 'Fat', 'Tauki')}
              value={fat}
              onChangeText={(text) => {
                setFat(text);
                setSavedOnce(false);
              }}
              keyboardType="numeric"
            />

            <InputField
              label={tr('carbs', 'Углеводы', 'Carbs', 'Ogļhidrāti')}
              value={carbs}
              onChangeText={(text) => {
                setCarbs(text);
                setSavedOnce(false);
              }}
              keyboardType="numeric"
            />

            <InputField
              label={tr(
                'aiComment',
                'Комментарий ИИ / исправление',
                'AI comment / correction',
                'MI komentārs / labojums'
              )}
              value={aiComment}
              onChangeText={(text) => {
                setAiComment(text);
                setSavedOnce(false);
              }}
              multiline
            />
          </SectionCard>

          {!isAddDishMode && (
            <SectionCard
              title={tr(
                'insulinAfterMeal',
                'Инсулин и после еды',
                'Insulin and after meal',
                'Insulīns un pēc ēšanas'
              )}
            >
              <InputField
                label={tr('insulin', 'Инсулин', 'Insulin', 'Insulīns')}
                value={insulinUnits}
                onChangeText={(text) => {
                  setInsulinUnits(text);
                  setSavedOnce(false);
                }}
                keyboardType="numeric"
              />

              <InputField
                label={tr(
                  'glucoseAfter',
                  'Сахар после еды',
                  'Glucose after meal',
                  'Cukurs pēc ēšanas'
                )}
                value={glucoseAfter}
                onChangeText={(text) => {
                  setGlucoseAfter(text);
                  setSavedOnce(false);
                }}
                keyboardType="numeric"
              />

              <InputField
                label={tr(
                  'afterMealNote',
                  'Что произошло после еды',
                  'What happened after meal',
                  'Kas notika pēc ēšanas'
                )}
                value={userNote}
                onChangeText={(text) => {
                  setUserNote(text);
                  setSavedOnce(false);
                }}
                multiline
              />
            </SectionCard>
          )}

          <PrimaryButton
            title={
              savedOnce
                ? tr('alreadySaved', 'УЖЕ СОХРАНЕНО', 'ALREADY SAVED', 'JAU SAGLABĀTS')
                : isAddDishMode
                  ? 'ДОБАВИТЬ В ЭТУ ЗАПИСЬ'
                  : tr(
                      'save',
                      'СОХРАНИТЬ В ДНЕВНИК',
                      'SAVE TO DIARY',
                      'SAGLABĀT DIENASGRĀMATĀ'
                    )
            }
            onPress={saveToHistory}
            disabled={savedOnce}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}