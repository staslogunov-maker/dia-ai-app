import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
    Alert,
    SafeAreaView,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import i18n from '../lib/i18n';

type BasalInsulinEntry = {
  id: string;
  createdAt: string;
  insulinName: string;
  units: string;
  time: string;
  comment: string;
};

const STORAGE_KEY = 'basal-insulin-history';

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

function formatDate(dateString: string) {
  try {
    return new Date(dateString).toLocaleString(
      lang() === 'lv' ? 'lv-LV' : lang() === 'en' ? 'en-US' : 'ru-RU',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }
    );
  } catch {
    return dateString;
  }
}

export default function BasalInsulinScreen() {
  const router = useRouter();

  const [insulinName, setInsulinName] = useState('');
  const [units, setUnits] = useState('');
  const [time, setTime] = useState('22:00');
  const [comment, setComment] = useState('');
  const [history, setHistory] = useState<BasalInsulinEntry[]>([]);

  const loadHistory = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];

      setHistory(Array.isArray(parsed) ? parsed : []);
    } catch (e) {
      console.log('Basal insulin load error:', e);
      setHistory([]);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [])
  );

  const saveEntry = async () => {
    try {
      if (!insulinName.trim() || !units.trim()) {
        Alert.alert(
          tr('error', 'Ошибка', 'Error', 'Kļūda'),
          tr(
            'fillFields',
            'Заполни название и единицы',
            'Fill insulin name and units',
            'Aizpildi nosaukumu un vienības'
          )
        );
        return;
      }

      const newItem: BasalInsulinEntry = {
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        insulinName: insulinName.trim(),
        units: units.trim(),
        time: time.trim() || '22:00',
        comment: comment.trim(),
      };

      const updated = [newItem, ...history];

      setHistory(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      Alert.alert(
        tr('saved', 'Сохранено', 'Saved', 'Saglabāts'),
        tr(
          'dailyInsulinSaved',
          'Суточный инсулин сохранён',
          'Daily insulin saved',
          'Diennakts insulīns saglabāts'
        )
      );

      setComment('');
    } catch (e) {
      console.log('Basal insulin save error:', e);

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

  const deleteEntry = async (id: string) => {
    Alert.alert(
      tr('deleteEntry', 'Удалить запись?', 'Delete entry?', 'Dzēst ierakstu?'),
      tr(
        'deleteEntryText',
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
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          },
        },
      ]
    );
  };

  const lastEntry = history[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f3f4f6' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          activeOpacity={0.85}
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 14,
            paddingVertical: 12,
            paddingHorizontal: 16,
            marginBottom: 18,
            alignSelf: 'flex-start',
            borderWidth: 1,
            borderColor: '#d1d5db',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>
            ← {tr('back', 'Назад', 'Back', 'Atpakaļ')}
          </Text>
        </TouchableOpacity>

        <View
          style={{
            backgroundColor: '#2563eb',
            borderRadius: 24,
            padding: 22,
            marginBottom: 20,
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
            {tr(
              'dailyInsulin',
              'Суточный инсулин',
              'Daily insulin',
              'Diennakts insulīns'
            )}
          </Text>

          <Text style={{ color: '#dbeafe', fontSize: 16, lineHeight: 24 }}>
            {tr(
              'dailyInsulinText',
              'Записывай длинный инсулин перед сном или в течение дня.',
              'Record long-acting insulin before sleep or during the day.',
              'Pieraksti ilgstošo insulīnu pirms miega vai dienas laikā.'
            )}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#ffffff',
            borderRadius: 20,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <Text style={labelStyle}>
            {tr(
              'insulinName',
              'Название инсулина',
              'Insulin name',
              'Insulīna nosaukums'
            )}
          </Text>
          <TextInput
            placeholder={tr('insulinNameExample', 'Например: Лантус', 'For example: Lantus', 'Piemēram: Lantus')}
            value={insulinName}
            onChangeText={setInsulinName}
            style={inputStyle}
            placeholderTextColor="#9ca3af"
          />

          <Text style={labelStyle}>
            {tr('units', 'Единицы', 'Units', 'Vienības')}
          </Text>
          <TextInput
            placeholder="15"
            value={units}
            onChangeText={setUnits}
            keyboardType="numeric"
            style={inputStyle}
            placeholderTextColor="#9ca3af"
          />

          <Text style={labelStyle}>
            {tr('time', 'Время', 'Time', 'Laiks')}
          </Text>
          <TextInput
            placeholder="22:00"
            value={time}
            onChangeText={setTime}
            style={inputStyle}
            placeholderTextColor="#9ca3af"
          />

          <Text style={labelStyle}>
            {tr('comment', 'Комментарий', 'Comment', 'Komentārs')}
          </Text>
          <TextInput
            placeholder={tr(
              'commentPlaceholder',
              'Например: перед сном',
              'For example: before sleep',
              'Piemēram: pirms miega'
            )}
            value={comment}
            onChangeText={setComment}
            multiline
            style={[
              inputStyle,
              {
                height: 100,
                textAlignVertical: 'top',
              },
            ]}
            placeholderTextColor="#9ca3af"
          />

          <TouchableOpacity
            onPress={saveEntry}
            activeOpacity={0.85}
            style={{
              backgroundColor: '#2563eb',
              paddingVertical: 16,
              borderRadius: 18,
              alignItems: 'center',
              marginTop: 6,
            }}
          >
            <Text style={{ color: '#ffffff', fontSize: 18, fontWeight: '900' }}>
              {tr(
                'saveToDiary',
                'СОХРАНИТЬ В ДНЕВНИК',
                'SAVE TO DIARY',
                'SAGLABĀT DIENASGRĀMATĀ'
              )}
            </Text>
          </TouchableOpacity>
        </View>

        {lastEntry ? (
          <View style={cardStyle}>
            <Text style={titleStyle}>
              {tr(
                'lastInjection',
                'Последний укол',
                'Last injection',
                'Pēdējā injekcija'
              )}
            </Text>

            <Text style={infoStyle}>💉 {lastEntry.insulinName}</Text>
            <Text style={infoStyle}>
              {tr('units', 'Единицы', 'Units', 'Vienības')}: {lastEntry.units}
            </Text>
            <Text style={infoStyle}>
              {tr('time', 'Время', 'Time', 'Laiks')}: {lastEntry.time}
            </Text>
            <Text style={infoStyle}>{formatDate(lastEntry.createdAt)}</Text>

            {!!lastEntry.comment && (
              <Text style={[infoStyle, { marginTop: 6 }]}>
                {lastEntry.comment}
              </Text>
            )}
          </View>
        ) : null}

        <View style={cardStyle}>
          <Text style={titleStyle}>
            {tr(
              'basalHistory',
              'История суточного инсулина',
              'Daily insulin history',
              'Diennakts insulīna vēsture'
            )}
          </Text>

          {history.length === 0 ? (
            <Text style={{ fontSize: 16, color: '#6b7280', lineHeight: 24 }}>
              {tr(
                'noBasalEntries',
                'Записей пока нет.',
                'No entries yet.',
                'Ierakstu vēl nav.'
              )}
            </Text>
          ) : (
            history.map((item, index) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: '#f9fafb',
                  borderRadius: 16,
                  padding: 14,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: '#e5e7eb',
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#111827' }}>
                  {index + 1}. 💉 {item.insulinName}
                </Text>

                <Text style={historyTextStyle}>
                  {tr('units', 'Единицы', 'Units', 'Vienības')}: {item.units}
                </Text>

                <Text style={historyTextStyle}>
                  {tr('time', 'Время', 'Time', 'Laiks')}: {item.time}
                </Text>

                <Text style={historyTextStyle}>{formatDate(item.createdAt)}</Text>

                {!!item.comment && (
                  <Text style={[historyTextStyle, { marginTop: 6 }]}>
                    {item.comment}
                  </Text>
                )}

                <TouchableOpacity
                  onPress={() => deleteEntry(item.id)}
                  activeOpacity={0.85}
                  style={{
                    backgroundColor: '#dc2626',
                    paddingVertical: 10,
                    borderRadius: 12,
                    alignItems: 'center',
                    marginTop: 10,
                  }}
                >
                  <Text
                    style={{
                      color: '#ffffff',
                      fontSize: 14,
                      fontWeight: '900',
                    }}
                  >
                    {tr('delete', 'УДАЛИТЬ', 'DELETE', 'DZĒST')}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const labelStyle = {
  fontSize: 14,
  color: '#6b7280',
  marginBottom: 6,
  fontWeight: '700' as const,
};

const inputStyle = {
  backgroundColor: '#f9fafb',
  borderWidth: 1,
  borderColor: '#d1d5db',
  borderRadius: 16,
  paddingHorizontal: 14,
  paddingVertical: 14,
  fontSize: 16,
  color: '#111827',
  marginBottom: 12,
};

const cardStyle = {
  backgroundColor: '#ffffff',
  borderRadius: 20,
  padding: 18,
  marginBottom: 16,
};

const titleStyle = {
  fontSize: 20,
  fontWeight: '900' as const,
  color: '#111827',
  marginBottom: 12,
};

const infoStyle = {
  fontSize: 17,
  color: '#111827',
  marginBottom: 8,
  lineHeight: 24,
};

const historyTextStyle = {
  fontSize: 15,
  color: '#374151',
  marginTop: 6,
  lineHeight: 22,
};