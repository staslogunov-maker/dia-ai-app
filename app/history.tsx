import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  SafeAreaView,
  ScrollView,
  Text,
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
  photoUris?: string[];
  dishes?: MealDish[];
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

function localeCode() {
  if (lang() === 'ru') return 'ru-RU';
  if (lang() === 'lv') return 'lv-LV';
  return 'en-US';
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

function statusLabel(status?: DishStatus) {
  if (status === 'tasted') {
    return tr('statusTasted', 'Пробовал', 'Tasted', 'Pagaršots');
  }

  if (status === 'skipped') {
    return tr('statusSkipped', 'Не ел', 'Skipped', 'Neēsts');
  }

  return tr('statusEaten', 'Съел', 'Eaten', 'Apēsts');
}

function statusColor(status?: DishStatus) {
  if (status === 'tasted') return ORANGE;
  if (status === 'skipped') return MUTED;
  return GREEN;
}

function InfoLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <Text
      style={{
        fontSize: 17,
        color: TEXT,
        lineHeight: 27,
      }}
    >
      <Text style={{ fontWeight: '800' }}>{label}: </Text>
      {value || '-'}
    </Text>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<DiaryEntry[]>([]);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('history');
      const parsed = saved ? JSON.parse(saved) : [];

      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      console.log('Diary loading error:', error);
      setHistory([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const deleteEntry = async (id: string) => {
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
            const updated = history.filter((item) => item.id !== id);
            setHistory(updated);
            await AsyncStorage.setItem('history', JSON.stringify(updated));
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          style={{
            alignSelf: 'flex-start',
            backgroundColor: CARD,
            paddingHorizontal: 18,
            paddingVertical: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#d1d5db',
            marginBottom: 18,
          }}
        >
          <Text
            style={{
              fontSize: 16,
              fontWeight: '800',
              color: TEXT,
            }}
          >
            ← {tr('back', 'Назад', 'Back', 'Atpakaļ')}
          </Text>
        </TouchableOpacity>

        <Text
          style={{
            fontSize: 34,
            fontWeight: '900',
            color: TEXT,
          }}
        >
          {tr('diaryTitleShort', 'Дневник', 'Diary', 'Dienasgrāmata')}
        </Text>

        <Text
          style={{
            fontSize: 18,
            color: MUTED,
            marginTop: 6,
            marginBottom: 20,
          }}
        >
          {tr(
            'allSavedEntries',
            'Все сохранённые записи',
            'All saved entries',
            'Visi saglabātie ieraksti'
          )}
        </Text>

        {history.length === 0 ? (
          <View
            style={{
              backgroundColor: CARD,
              borderRadius: 24,
              padding: 24,
              alignItems: 'center',
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
              {tr(
                'noEntriesYet',
                'Записей пока нет',
                'No entries yet',
                'Ierakstu vēl nav'
              )}
            </Text>

            <Text
              style={{
                fontSize: 16,
                color: MUTED,
                textAlign: 'center',
                lineHeight: 23,
              }}
            >
              {tr(
                'addPhotoOrManualEntry',
                'Сделай фото еды или добавь ручную запись.',
                'Take a food photo or add a manual entry.',
                'Nofotografē ēdienu vai pievieno manuālu ierakstu.'
              )}
            </Text>
          </View>
        ) : (
          history.map((item) => {
            const photos = getPhotoUris(item);

            return (
              <View
                key={item.id}
                style={{
                  backgroundColor: CARD,
                  borderRadius: 24,
                  padding: 16,
                  marginBottom: 18,
                  shadowColor: '#000',
                  shadowOpacity: 0.08,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 3,
                }}
              >
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
                          marginRight: index === photos.length - 1 ? 0 : 12,
                        }}
                      >
                        <Image
                          source={{ uri }}
                          style={{
                            width: '100%',
                            height: 190,
                            borderRadius: 18,
                            backgroundColor: '#e5e7eb',
                          }}
                          resizeMode="cover"
                        />

                        <Text
                          style={{
                            marginTop: 6,
                            textAlign: 'center',
                            color: MUTED,
                            fontWeight: '800',
                            fontSize: 14,
                          }}
                        >
                          Фото {index + 1}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}

                <Text
                  style={{
                    fontSize: 24,
                    fontWeight: '900',
                    color: TEXT,
                    marginBottom: 6,
                  }}
                >
                  {item.mealName ||
                    tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma')}
                </Text>

                <Text
                  style={{
                    fontSize: 16,
                    color: MUTED,
                    marginBottom: 12,
                  }}
                >
                  {formatDate(item.createdAt)} •{' '}
                  {item.mealType ||
                    tr('mealTypeFallback', 'Приём пищи', 'Meal', 'Ēdienreize')}
                </Text>

                <View
                  style={{
                    backgroundColor: '#f9fafb',
                    borderRadius: 18,
                    padding: 14,
                  }}
                >
                  <InfoLine
                    label={tr(
                      'glucoseBefore',
                      'Сахар до еды',
                      'Glucose before meal',
                      'Cukurs pirms ēšanas'
                    )}
                    value={item.glucoseBefore}
                  />

                  <InfoLine
                    label={tr('calories', 'Калории', 'Calories', 'Kalorijas')}
                    value={item.calories}
                  />

                  <InfoLine
                    label={tr('breadUnitsShort', 'ХЕ', 'BU', 'MV')}
                    value={item.breadUnits}
                  />

                  <InfoLine
                    label={tr('protein', 'Белки', 'Protein', 'Olbaltumvielas')}
                    value={item.protein}
                  />

                  <InfoLine
                    label={tr('fat', 'Жиры', 'Fat', 'Tauki')}
                    value={item.fat}
                  />

                  <InfoLine
                    label={tr('carbs', 'Углеводы', 'Carbs', 'Ogļhidrāti')}
                    value={item.carbs}
                  />

                  <InfoLine
                    label={tr('insulin', 'Инсулин', 'Insulin', 'Insulīns')}
                    value={item.insulinUnits}
                  />

                  <InfoLine
                    label={tr(
                      'glucoseAfter',
                      'Сахар после еды',
                      'Glucose after meal',
                      'Cukurs pēc ēšanas'
                    )}
                    value={item.glucoseAfter}
                  />
                </View>

                {item.mealComment ? (
                  <Text
                    style={{
                      fontSize: 16,
                      color: TEXT,
                      lineHeight: 24,
                      marginTop: 12,
                    }}
                  >
                    <Text style={{ fontWeight: '900' }}>
                      {tr(
                        'mealComment',
                        'Комментарий к еде',
                        'Meal comment',
                        'Ēdiena komentārs'
                      )}
                      :{' '}
                    </Text>
                    {item.mealComment}
                  </Text>
                ) : null}

                {item.userNote ? (
                  <Text
                    style={{
                      fontSize: 16,
                      color: TEXT,
                      lineHeight: 24,
                      marginTop: 10,
                    }}
                  >
                    <Text style={{ fontWeight: '900' }}>
                      {tr('note', 'Заметка', 'Note', 'Piezīme')}:{' '}
                    </Text>
                    {item.userNote}
                  </Text>
                ) : null}

                {item.dishes && item.dishes.length > 0 ? (
                  <View style={{ marginTop: 14 }}>
                    <Text
                      style={{
                        fontSize: 18,
                        fontWeight: '900',
                        color: TEXT,
                        marginBottom: 8,
                      }}
                    >
                      {tr('dishes', 'Блюда', 'Dishes', 'Ēdieni')}
                    </Text>

                    {item.dishes.map((dish) => (
                      <View
                        key={dish.id}
                        style={{
                          backgroundColor: '#f9fafb',
                          borderRadius: 16,
                          padding: 12,
                          marginBottom: 10,
                        }}
                      >
                        {dish.photoUri ? (
                          <Image
                            source={{ uri: dish.photoUri }}
                            style={{
                              width: '100%',
                              height: 150,
                              borderRadius: 14,
                              marginBottom: 8,
                              backgroundColor: '#e5e7eb',
                            }}
                            resizeMode="cover"
                          />
                        ) : null}

                        <Text
                          style={{
                            fontSize: 17,
                            fontWeight: '900',
                            color: TEXT,
                          }}
                        >
                          {dish.mealName ||
                            tr('dish', 'Блюдо', 'Dish', 'Ēdiens')}
                        </Text>

                        <Text
                          style={{
                            fontSize: 14,
                            fontWeight: '800',
                            color: statusColor(dish.status),
                            marginTop: 4,
                          }}
                        >
                          {statusLabel(dish.status)}
                        </Text>

                        {dish.mealComment ? (
                          <Text
                            style={{
                              fontSize: 14,
                              color: MUTED,
                              marginTop: 6,
                              lineHeight: 20,
                            }}
                          >
                            {dish.mealComment}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}

                <View
                  style={{
                    flexDirection: 'row',
                    gap: 10,
                    marginTop: 16,
                  }}
                >
                  <TouchableOpacity
                    onPress={() =>
                      router.push({
                        pathname: '/edit-entry',
                        params: { id: item.id },
                      })
                    }
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      backgroundColor: BLUE,
                      paddingVertical: 14,
                      borderRadius: 16,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#ffffff',
                        fontSize: 15,
                        fontWeight: '900',
                      }}
                    >
                      {tr('edit', 'РЕДАКТИРОВАТЬ', 'EDIT', 'LABOT')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => deleteEntry(item.id)}
                    activeOpacity={0.85}
                    style={{
                      flex: 1,
                      backgroundColor: RED,
                      paddingVertical: 14,
                      borderRadius: 16,
                      alignItems: 'center',
                    }}
                  >
                    <Text
                      style={{
                        color: '#ffffff',
                        fontSize: 15,
                        fontWeight: '900',
                      }}
                    >
                      {tr('delete', 'УДАЛИТЬ', 'DELETE', 'DZĒST')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}