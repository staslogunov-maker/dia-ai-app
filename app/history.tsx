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
  userNote?: string;
  photoUri?: string;
  aiComment?: string;
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

function getEntryDishes(item: DiaryEntry): MealDish[] {
  if (Array.isArray(item.dishes) && item.dishes.length > 0) {
    return item.dishes.map((dish, index) => ({
      ...dish,
      id: dish.id || `${item.id}-dish-${index + 1}`,
    }));
  }

  return [
    {
      id: `${item.id}-legacy-dish`,
      mealName:
        item.mealName || tr('untitled', 'Без названия', 'Untitled', 'Bez nosaukuma'),
      mealComment: item.mealComment || item.userNote || '',
      calories: item.calories || '',
      breadUnits: item.breadUnits || '',
      protein: item.protein || '',
      fat: item.fat || '',
      carbs: item.carbs || '',
      userNote: item.userNote || '',
      photoUri: item.photoUri || getPhotoUris(item)[0] || '',
      aiComment: item.userNote || '',
    },
  ];
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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <Text
      style={{
        fontSize: 16,
        color: TEXT,
        lineHeight: 26,
      }}
    >
      <Text style={{ fontWeight: '800' }}>{label}: </Text>
      {value || '-'}
    </Text>
  );
}

function DishCard({
  dish,
  index,
}: {
  dish: MealDish;
  index: number;
}) {
  const comment = dish.mealComment || dish.aiComment || dish.userNote || '';

  return (
    <View
      style={{
        backgroundColor: '#f9fafb',
        borderRadius: 18,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
      }}
    >
      <Text
        style={{
          fontSize: 18,
          fontWeight: '900',
          color: TEXT,
          marginBottom: 8,
        }}
      >
        {tr('dish', 'Блюдо', 'Dish', 'Ēdiens')} {index + 1}
      </Text>

      {dish.photoUri ? (
        <Image
          source={{ uri: dish.photoUri }}
          style={{
            width: '100%',
            height: 180,
            borderRadius: 14,
            marginBottom: 10,
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
          marginBottom: 4,
        }}
      >
        {dish.mealName || tr('dish', 'Блюдо', 'Dish', 'Ēdiens')}
      </Text>

      <Text
        style={{
          fontSize: 14,
          fontWeight: '800',
          color: statusColor(dish.status),
          marginBottom: 8,
        }}
      >
        {statusLabel(dish.status)}
      </Text>

      {comment ? (
        <Text
          style={{
            fontSize: 14,
            color: MUTED,
            lineHeight: 20,
            marginBottom: 8,
          }}
        >
          {comment}
        </Text>
      ) : null}

      <View
        style={{
          backgroundColor: '#ffffff',
          borderRadius: 14,
          padding: 10,
        }}
      >
        <InfoLine
          label={tr('calories', 'Калории', 'Calories', 'Kalorijas')}
          value={dish.calories}
        />
        <InfoLine
          label={tr('breadUnitsShort', 'ХЕ', 'BU', 'MV')}
          value={dish.breadUnits}
        />
        <InfoLine
          label={tr('protein', 'Белки', 'Protein', 'Olbaltumvielas')}
          value={dish.protein}
        />
        <InfoLine
          label={tr('fat', 'Жиры', 'Fat', 'Tauki')}
          value={dish.fat}
        />
        <InfoLine
          label={tr('carbs', 'Углеводы', 'Carbs', 'Ogļhidrāti')}
          value={dish.carbs}
        />
      </View>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<DiaryEntry[]>([]);

  const loadHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('history');
      const parsed = saved ? JSON.parse(saved) : [];

      const filtered = Array.isArray(parsed)
        ? parsed.filter((item) => {
            const mealName = String(item?.mealName || '').toLowerCase();
            const mealType = String(item?.mealType || '').toLowerCase();
            const insulinName = String(item?.insulinName || '').toLowerCase();

            const looksLikeBasalInsulin =
              item?.isBasalInsulin === true ||
              mealType === 'basal-insulin' ||
              !!insulinName ||
              mealName === 'lantus' ||
              mealName === 'novorapid' ||
              mealName === 'nivarapid' ||
              mealName === 'tresiba' ||
              mealName === 'тресиба' ||
              mealName === 'левемир' ||
              mealName === 'лантус' ||
              mealName === 'новорапид';

            return !looksLikeBasalInsulin;
          })
        : [];

      setHistory(filtered);
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

  const goHome = () => {
    try {
      router.replace('/');
    } catch {
      router.push('/');
    }
  };

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
          onPress={goHome}
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
            const dishes = getEntryDishes(item);

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
                <Text
                  style={{
                    fontSize: 16,
                    color: MUTED,
                    marginBottom: 12,
                    fontWeight: '700',
                  }}
                >
                  {formatDate(item.createdAt)} •{' '}
                  {item.mealType ||
                    tr('mealTypeFallback', 'Приём пищи', 'Meal', 'Ēdienreize')}
                </Text>

                <Text
                  style={{
                    fontSize: 22,
                    fontWeight: '900',
                    color: TEXT,
                    marginBottom: 12,
                  }}
                >
                  🍽 {tr('dishes', 'Блюда', 'Dishes', 'Ēdieni')}
                </Text>

                {dishes.map((dish, index) => (
                  <DishCard
                    key={dish.id || `${item.id}-${index}`}
                    dish={dish}
                    index={index}
                  />
                ))}

                <View
                  style={{
                    backgroundColor: '#eff6ff',
                    borderRadius: 18,
                    padding: 14,
                    marginTop: 4,
                    borderWidth: 1,
                    borderColor: '#bfdbfe',
                  }}
                >
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: '900',
                      color: TEXT,
                      marginBottom: 10,
                    }}
                  >
                    📊 {tr(
                      'mealSummary',
                      'Общий итог приёма пищи',
                      'Meal summary',
                      'Ēdienreizes kopsavilkums'
                    )}
                  </Text>

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

                  {item.mealComment ? (
                    <Text
                      style={{
                        fontSize: 15,
                        color: TEXT,
                        lineHeight: 22,
                        marginTop: 10,
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
                        fontSize: 15,
                        color: TEXT,
                        lineHeight: 22,
                        marginTop: 8,
                      }}
                    >
                      <Text style={{ fontWeight: '900' }}>
                        {tr('note', 'Заметка', 'Note', 'Piezīme')}:{' '}
                      </Text>
                      {item.userNote}
                    </Text>
                  ) : null}
                </View>

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
