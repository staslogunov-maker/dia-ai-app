import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import i18n from '../lib/i18n';

type DishStatus = 'eaten' | 'tasted' | 'skipped';

type MealDish = {
  id: string;
  mealName: string;
  mealComment: string;
  calories: string;
  breadUnits: string;
  protein: string;
  fat: string;
  carbs: string;
  userNote: string;
  photoUri?: string;
  status?: DishStatus;
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
  dishes?: MealDish[];
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
const IS_EXPO_GO = Constants.appOwnership === 'expo';

const BG = '#f3f4f6';
const CARD = '#ffffff';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BLUE = '#2563eb';
const RED = '#dc2626';
const GREEN = '#16a34a';

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

function parseFoodNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;

  if (typeof value === 'number') return Number.isNaN(value) ? 0 : value;

  const cleaned = String(value).replace(',', '.').match(/\d+(\.\d+)?/);
  if (!cleaned) return 0;

  const num = Number(cleaned[0]);
  return Number.isNaN(num) ? 0 : num;
}

function formatNumber(value: number | string, suffix = '') {
  if (value === '' || value === null || value === undefined) return '';

  const num = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(num)) return String(value);

  const fixed = Number.isInteger(num) ? String(num) : num.toFixed(1);
  return `${fixed.replace('.', ',')}${suffix}`;
}

function normalizeAnalyzeResult(raw: any): AnalyzeResult {
  return {
    displayName: String(
      raw?.displayName ??
        raw?.name ??
        tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma')
    ),
    calories: Number(raw?.calories ?? 0),
    breadUnits: Number(raw?.breadUnits ?? raw?.xe ?? raw?.bread_units ?? 0),
    protein: Number(raw?.protein ?? 0),
    fat: Number(raw?.fat ?? 0),
    carbs: Number(raw?.carbs ?? 0),
    comment: String(raw?.comment ?? ''),
  };
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
      <Text style={{ fontSize: 14, color: MUTED, marginBottom: 6, fontWeight: '600' }}>
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
          color: TEXT,
          minHeight: multiline ? 90 : undefined,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
        placeholderTextColor="#9ca3af"
      />
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
        backgroundColor: CARD,
        paddingVertical: 16,
        borderRadius: 18,
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#d1d5db',
      }}
    >
      <Text style={{ color: TEXT, fontSize: 17, fontWeight: '700' }}>{title}</Text>
    </TouchableOpacity>
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
      }}
    >
      <Text style={{ fontSize: 19, fontWeight: '800', color: TEXT, marginBottom: 12 }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export default function EditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const [entryId, setEntryId] = useState('');
  const [createdAt, setCreatedAt] = useState('');
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
  const [photoUri, setPhotoUri] = useState('');
  const [dishes, setDishes] = useState<MealDish[]>([]);

  useEffect(() => {
    loadEntry();
  }, [id]);

  const loadEntry = async () => {
    try {
      setLoading(true);

      const saved = await AsyncStorage.getItem('history');
      const history: DiaryEntry[] = saved ? JSON.parse(saved) : [];
      const item = history.find((x) => x.id === id);

      if (!item) {
        Alert.alert(
          tr('error', 'Ошибка', 'Error', 'Kļūda'),
          tr('noData', 'Запись не найдена', 'Entry not found', 'Ieraksts nav atrasts')
        );
        router.back();
        return;
      }

      setEntryId(item.id);
      setCreatedAt(item.createdAt);
      setMealType(item.mealType || '');
      setMealName(item.mealName || '');
      setMealComment(item.mealComment || '');
      setCalories(item.calories || '');
      setBreadUnits(item.breadUnits || '');
      setProtein(item.protein || '');
      setFat(item.fat || '');
      setCarbs(item.carbs || '');
      setGlucoseBefore(item.glucoseBefore || '');
      setInsulinUnits(item.insulinUnits || '');
      setGlucoseAfter(item.glucoseAfter || '');
      setUserNote(item.userNote || '');
      setPhotoUri(item.photoUri || '');

      if (item.dishes && item.dishes.length > 0) {
        setDishes(item.dishes);
      } else {
        setDishes([
          {
            id: `${item.id}-main`,
            mealName: item.mealName || tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma'),
            mealComment: item.mealComment || '',
            calories: item.calories || '',
            breadUnits: item.breadUnits || '',
            protein: item.protein || '',
            fat: item.fat || '',
            carbs: item.carbs || '',
            userNote: item.userNote || '',
            photoUri: item.photoUri || '',
            status: 'eaten',
          },
        ]);
      }
    } catch (error) {
      console.log('Edit screen loading error:', error);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        tr('loadEntryError', 'Не удалось открыть запись', 'Could not open entry', 'Neizdevās atvērt ierakstu')
      );

      router.back();
    } finally {
      setLoading(false);
    }
  };

  const recalcTotals = (nextDishes: MealDish[]) => {
    const totalCalories = nextDishes.reduce((sum, item) => sum + parseFoodNumber(item.calories), 0);
    const totalBreadUnits = nextDishes.reduce((sum, item) => sum + parseFoodNumber(item.breadUnits), 0);
    const totalProtein = nextDishes.reduce((sum, item) => sum + parseFoodNumber(item.protein), 0);
    const totalFat = nextDishes.reduce((sum, item) => sum + parseFoodNumber(item.fat), 0);
    const totalCarbs = nextDishes.reduce((sum, item) => sum + parseFoodNumber(item.carbs), 0);

    setCalories(formatNumber(totalCalories, ' kcal'));
    setBreadUnits(formatNumber(totalBreadUnits, ' XE'));
    setProtein(formatNumber(totalProtein, ' g'));
    setFat(formatNumber(totalFat, ' g'));
    setCarbs(formatNumber(totalCarbs, ' g'));
    setMealName(nextDishes.map((item) => item.mealName).filter(Boolean).join(' + '));
    setPhotoUri(nextDishes.find((item) => !!item.photoUri)?.photoUri || '');
  };

  const addDishFromAI = (data: AnalyzeResult, imageUri: string) => {
    const newDish: MealDish = {
      id: `${Date.now()}-${Math.random()}`,
      mealName: data.displayName || tr('dish', 'Блюдо', 'Dish', 'Ēdiens'),
      mealComment: data.comment || '',
      calories: formatNumber(data.calories, ' kcal'),
      breadUnits: formatNumber(data.breadUnits, ' XE'),
      protein: formatNumber(data.protein, ' g'),
      fat: formatNumber(data.fat, ' g'),
      carbs: formatNumber(data.carbs, ' g'),
      userNote: '',
      photoUri: imageUri,
      status: 'eaten',
    };

    const nextDishes = [...dishes, newDish];
    setDishes(nextDishes);
    recalcTotals(nextDishes);

    Alert.alert(
      tr('saved', 'Готово', 'Done', 'Gatavs'),
      tr('dishAdded', 'Блюдо добавлено к этой записи.', 'Dish added to this entry.', 'Ēdiens pievienots šim ierakstam.')
    );
  };

  const removeDish = (dishId: string) => {
    const nextDishes = dishes.filter((item) => item.id !== dishId);
    setDishes(nextDishes);

    if (nextDishes.length > 0) {
      recalcTotals(nextDishes);
    } else {
      setMealName('');
      setCalories('');
      setBreadUnits('');
      setProtein('');
      setFat('');
      setCarbs('');
      setPhotoUri('');
    }
  };

  const compressPhoto = async (uri: string) => {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 900 } }],
      {
        compress: 0.6,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    return result.uri;
  };

  const analyzeNewDish = async (imageUri: string) => {
    try {
      setAnalyzing(true);

      const compressedUri = await compressPhoto(imageUri);

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
          tr('serverNotJson', 'Сервер вернул не JSON: ', 'Server returned non-JSON: ', 'Serveris neatgrieza JSON: ') + text
        );
      }

      if (!response.ok) {
        throw new Error(
          raw?.error ||
            tr('serverError', 'Сервер вернул ошибку', 'Server returned an error', 'Serveris atgrieza kļūdu')
        );
      }

      const result = normalizeAnalyzeResult(raw);
      addDishFromAI(result, compressedUri);
    } catch (error: any) {
      console.log('Add dish analysis error:', error);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        error?.message ||
          tr('analysisError', 'Не удалось проанализировать фото', 'Could not analyze the photo', 'Neizdevās analizēt foto')
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) {
        Alert.alert(
          tr('error', 'Ошибка', 'Error', 'Kļūda'),
          tr('cameraNotReady', 'Камера ещё не готова', 'Camera is not ready yet', 'Kamera vēl nav gatava')
        );
        return;
      }

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
      });

      if (!photo?.uri) {
        Alert.alert(
          tr('error', 'Ошибка', 'Error', 'Kļūda'),
          tr('photoFailed', 'Фото не удалось сделать', 'Could not take photo', 'Neizdevās uzņemt foto')
        );
        return;
      }

      setShowCamera(false);
      await analyzeNewDish(photo.uri);
    } catch (error) {
      console.log('Photo error:', error);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        tr('photoFailed', 'Фото не удалось сделать', 'Could not take photo', 'Neizdevās uzņemt foto')
      );
    }
  };

  const saveEditedEntry = async () => {
    try {
      const saved = await AsyncStorage.getItem('history');
      const history: DiaryEntry[] = saved ? JSON.parse(saved) : [];

      const finalDishes = dishes.length > 0 ? dishes : undefined;

      const updatedHistory = history.map((item) => {
        if (item.id !== entryId) return item;

        return {
          ...item,
          createdAt,
          mealType,
          mealName,
          mealComment,
          calories,
          breadUnits,
          protein,
          fat,
          carbs,
          glucoseBefore,
          insulinUnits,
          glucoseAfter,
          userNote,
          photoUri,
          dishes: finalDishes,
        };
      });

      await AsyncStorage.setItem('history', JSON.stringify(updatedHistory));

      Alert.alert(
        tr('saved', 'Сохранено', 'Saved', 'Saglabāts'),
        tr('entryUpdated', 'Запись обновлена.', 'Entry updated.', 'Ieraksts atjaunināts.')
      );

      router.back();
    } catch (error) {
      console.log('Edit screen saving error:', error);

      Alert.alert(
        tr('error', 'Ошибка', 'Error', 'Kļūda'),
        tr('saveError', 'Не удалось сохранить изменения', 'Could not save changes', 'Neizdevās saglabāt izmaiņas')
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Text style={{ fontSize: 18, fontWeight: '700', color: TEXT }}>
            {tr('loading', 'Загружаем запись...', 'Loading entry...', 'Ielādējam ierakstu...')}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission?.granted && showCamera) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: TEXT, textAlign: 'center', marginBottom: 16 }}>
            {tr('cameraAccessNeeded', 'Нужен доступ к камере', 'Camera access needed', 'Nepieciešama piekļuve kamerai')}
          </Text>

          <PrimaryButton
            title={tr('allowCamera', 'РАЗРЕШИТЬ КАМЕРУ', 'ALLOW CAMERA', 'ATĻAUT KAMERU')}
            onPress={requestPermission}
          />

          <SecondaryButton
            title={tr('cancel', 'ОТМЕНА', 'CANCEL', 'ATCELT')}
            onPress={() => setShowCamera(false)}
          />
        </View>
      </SafeAreaView>
    );
  }

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
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: CARD,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 14,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: '#d1d5db',
          }}
        >
          <Text style={{ color: TEXT, fontWeight: '700', fontSize: 15 }}>
            ← {tr('back', 'Назад', 'Back', 'Atpakaļ')}
          </Text>
        </TouchableOpacity>

        <View style={{ backgroundColor: BLUE, borderRadius: 24, padding: 22, marginBottom: 18 }}>
          <Text style={{ color: '#ffffff', fontSize: 28, fontWeight: '900', marginBottom: 8 }}>
            {tr('editEntryTitle', 'Редактирование записи', 'Edit entry', 'Ieraksta labošana')}
          </Text>

          <Text style={{ color: '#dbeafe', fontSize: 16, lineHeight: 23 }}>
            {tr(
              'editEntrySubtitle',
              'Можно добавить ещё блюдо к этой же записи и изменить инсулин.',
              'You can add another dish to this same entry and change insulin.',
              'Vari pievienot vēl vienu ēdienu šim pašam ierakstam un mainīt insulīnu.'
            )}
          </Text>
        </View>

        <PrimaryButton
          title={tr('addMoreDish', 'ДОБАВИТЬ ЕЩЁ БЛЮДО К ЭТОЙ ЗАПИСИ', 'ADD ANOTHER DISH TO THIS ENTRY', 'PIEVIENOT VĒL ĒDIENU ŠIM IERAKSTAM')}
          onPress={() => setShowCamera(true)}
        />

        {analyzing && (
          <SectionCard title={tr('analyzing', 'ИИ анализирует фото...', 'AI is analyzing the photo...', 'MI analizē foto...')}>
            <ActivityIndicator size="large" color={BLUE} />
          </SectionCard>
        )}

        <SectionCard title={tr('dishes', 'Блюда в этой записи', 'Dishes in this entry', 'Ēdieni šajā ierakstā')}>
          {dishes.map((dish, index) => (
            <View
              key={dish.id}
              style={{
                backgroundColor: '#f8fafc',
                borderRadius: 16,
                padding: 12,
                marginBottom: 12,
              }}
            >
              {dish.photoUri ? (
                <Image
                  source={{ uri: dish.photoUri }}
                  style={{
                    width: '100%',
                    height: 170,
                    borderRadius: 14,
                    backgroundColor: '#e5e7eb',
                    marginBottom: 10,
                  }}
                  resizeMode="cover"
                />
              ) : null}

              <Text style={{ fontSize: 18, fontWeight: '900', color: TEXT }}>
                {index + 1}. {dish.mealName || tr('dish', 'Блюдо', 'Dish', 'Ēdiens')}
              </Text>

              <Text style={{ color: MUTED, fontSize: 14, marginTop: 6, lineHeight: 21 }}>
                {tr('breadUnitsShort', 'ХЕ', 'BU', 'XE')}: {dish.breadUnits || '-'} ·{' '}
                {tr('calories', 'Калории', 'Calories', 'Kalorijas')}: {dish.calories || '-'} ·{' '}
                {tr('carbs', 'Углеводы', 'Carbs', 'Ogļhidrāti')}: {dish.carbs || '-'}
              </Text>

              {!!dish.mealComment && (
                <Text style={{ color: '#374151', fontSize: 14, marginTop: 6, lineHeight: 21 }}>
                  {dish.mealComment}
                </Text>
              )}

              <TouchableOpacity
                onPress={() => removeDish(dish.id)}
                activeOpacity={0.85}
                style={{
                  backgroundColor: '#fee2e2',
                  paddingVertical: 10,
                  borderRadius: 12,
                  alignItems: 'center',
                  marginTop: 10,
                }}
              >
                <Text style={{ color: RED, fontWeight: '900' }}>
                  {tr('deleteDish', 'УДАЛИТЬ БЛЮДО', 'DELETE DISH', 'DZĒST ĒDIENU')}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </SectionCard>

        <SectionCard title={tr('mainData', 'Основные данные', 'Main data', 'Pamatdati')}>
          <InputField
            label={tr('mealType', 'Тип приёма пищи', 'Meal type', 'Ēdienreizes veids')}
            value={mealType}
            onChangeText={setMealType}
            placeholder={tr('breakfast', 'Например: Завтрак', 'For example: Breakfast', 'Piemēram: Brokastis')}
          />

          <InputField
            label={tr('dishName', 'Название записи', 'Entry name', 'Ieraksta nosaukums')}
            value={mealName}
            onChangeText={setMealName}
            placeholder={tr('dishNamePlaceholder', 'Например: Обед из 2 блюд', 'For example: Lunch with 2 dishes', 'Piemēram: Pusdienas ar 2 ēdieniem')}
          />

          <InputField
            label={tr('mealComment', 'Комментарий к еде', 'Meal comment', 'Komentārs par ēdienu')}
            value={mealComment}
            onChangeText={setMealComment}
            placeholder={tr('mealCommentPlaceholder', 'Например: суп и хлеб', 'For example: soup and bread', 'Piemēram: zupa un maize')}
            multiline
          />
        </SectionCard>

        <SectionCard title={tr('nutrition', 'Общий итог питания', 'Total nutrition', 'Uzturvērtība kopā')}>
          <InputField label={tr('calories', 'Калории', 'Calories', 'Kalorijas')} value={calories} onChangeText={setCalories} />
          <InputField label={tr('breadUnits', 'Хлебные единицы', 'Bread units', 'Maizes vienības')} value={breadUnits} onChangeText={setBreadUnits} />
          <InputField label={tr('protein', 'Белки', 'Protein', 'Olbaltumvielas')} value={protein} onChangeText={setProtein} />
          <InputField label={tr('fat', 'Жиры', 'Fat', 'Tauki')} value={fat} onChangeText={setFat} />
          <InputField label={tr('carbs', 'Углеводы', 'Carbs', 'Ogļhidrāti')} value={carbs} onChangeText={setCarbs} />
        </SectionCard>

        <SectionCard title={tr('sugarAndInsulin', 'Сахар и инсулин', 'Glucose and insulin', 'Cukurs un insulīns')}>
          <InputField
            label={tr('glucoseBefore', 'Сахар до еды', 'Glucose before meal', 'Cukurs pirms ēšanas')}
            value={glucoseBefore}
            onChangeText={setGlucoseBefore}
            placeholder={tr('glucoseBeforePlaceholder', 'Например: 6.4', 'For example: 6.4', 'Piemēram: 6.4')}
            keyboardType="numeric"
          />

          <InputField
            label={tr('insulin', 'Инсулин', 'Insulin', 'Insulīns')}
            value={insulinUnits}
            onChangeText={setInsulinUnits}
            placeholder={tr('insulinPlaceholder', 'Например: 4', 'For example: 4', 'Piemēram: 4')}
            keyboardType="numeric"
          />

          <InputField
            label={tr('glucoseAfter', 'Сахар после еды', 'Glucose after meal', 'Cukurs pēc ēšanas')}
            value={glucoseAfter}
            onChangeText={setGlucoseAfter}
            placeholder={tr('glucoseAfterPlaceholder', 'Например: 8.9', 'For example: 8.9', 'Piemēram: 8.9')}
            keyboardType="numeric"
          />

          <InputField
            label={tr('note', 'Заметка', 'Note', 'Piezīme')}
            value={userNote}
            onChangeText={setUserNote}
            placeholder={tr('afterMealNotePlaceholder', 'Что произошло после еды', 'What happened after meal', 'Kas notika pēc ēšanas')}
            multiline
          />
        </SectionCard>

        <PrimaryButton
          title={tr('saveChanges', 'СОХРАНИТЬ ИЗМЕНЕНИЯ', 'SAVE CHANGES', 'SAGLABĀT IZMAIŅAS')}
          onPress={saveEditedEntry}
        />

        <SecondaryButton
          title={tr('cancel', 'ОТМЕНА', 'CANCEL', 'ATCELT')}
          onPress={() => router.back()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}