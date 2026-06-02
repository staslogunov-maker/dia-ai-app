require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

const PORT = process.env.PORT || 3000;
const apiKey = process.env.OPENAI_API_KEY;

console.log('HAS OPENAI KEY:', !!apiKey);
console.log('KEY PREFIX:', apiKey ? apiKey.slice(0, 7) : 'NO_KEY');

if (!apiKey) {
  console.error('OPENAI_API_KEY is missing');
}

const openai = new OpenAI({ apiKey });

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeLanguage(language) {
  const code = String(language || 'ru').toLowerCase();

  if (code.startsWith('en')) return 'en';
  if (code.startsWith('lv')) return 'lv';
  return 'ru';
}

function languageName(language) {
  const code = normalizeLanguage(language);

  if (code === 'en') return 'English';
  if (code === 'lv') return 'Latviešu';
  return 'Русский';
}

function fallbackDishName(language) {
  const code = normalizeLanguage(language);

  if (code === 'en') return 'Unknown dish';
  if (code === 'lv') return 'Nezināms ēdiens';
  return 'Неизвестное блюдо';
}

function fallbackComment(language) {
  const code = normalizeLanguage(language);

  if (code === 'en') {
    return 'The estimate is approximate. For accuracy, check the weight and ingredients.';
  }

  if (code === 'lv') {
    return 'Aprēķins ir aptuvens. Precizitātei pārbaudi svaru un sastāvu.';
  }

  return 'Оценка примерная. Для точности проверь вес и состав блюда.';
}

function smartBreadUnits(parsed) {
  const carbs = toNumber(parsed.carbs, 0);
  let breadUnits = toNumber(parsed.breadUnits, 0);

  if (carbs > 0) {
    breadUnits = roundToTenth(carbs / 12);
  }

  return breadUnits;
}

function normalizeResult(parsed, language = 'ru') {
  const calories = toNumber(parsed.calories, 0);
  const protein = toNumber(parsed.protein, 0);
  const fat = toNumber(parsed.fat, 0);
  const carbs = toNumber(parsed.carbs, 0);
  const breadUnits = smartBreadUnits(parsed);

  return {
    displayName: String(parsed.displayName || fallbackDishName(language)),
    calories: roundToTenth(calories),
    breadUnits: roundToTenth(breadUnits),
    protein: roundToTenth(protein),
    fat: roundToTenth(fat),
    carbs: roundToTenth(carbs),
    comment: String(parsed.comment || fallbackComment(language)),
  };
}

function extractJson(text) {
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {}

  const match = text.match(/\{[\s\S]*\}/);

  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function buildSystemPrompt(language) {
  return `
Ты эксперт по диабетическому питанию и анализу еды.

Отвечай строго на языке пользователя: ${languageName(language)}.
Поля displayName и comment ОБЯЗАТЕЛЬНО должны быть на языке пользователя.
Верни только JSON без markdown и без дополнительного текста.
`;
}

app.get('/', (req, res) => {
  res.send('STAS MULTILANGUAGE AI V13 READY');
});

app.post(
  [
    '/analyze-food',
    '/analyze-food/',
    '/recalculate-food',
    '/recalculate-food/',
    '/recalculate-foods',
    '/recalculate-foods/',
  ],
  async (req, res) => {
    try {
      if (!apiKey) {
        return res.status(500).json({
          error: 'OPENAI_API_KEY missing on server',
        });
      }

      const {
        imageBase64,
        language = 'ru',
        description,
        mealName,
      } = req.body || {};

      const responseLanguage = normalizeLanguage(language);
      let prompt = '';

      // ---------- RECALCULATE MODE ----------
      if (description || mealName) {
        const foodText = description || mealName;

        prompt = `
Ты анализируешь описание еды для диабетического дневника.

Язык ответа: ${languageName(responseLanguage)}.
displayName и comment должны быть на языке: ${languageName(responseLanguage)}.

Верни ТОЛЬКО JSON без markdown.

Формат:
{
  "displayName": "название блюда на языке пользователя",
  "calories": 0,
  "breadUnits": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "comment": "короткий комментарий на языке пользователя"
}

Описание еды:
"${foodText}"

Правила:
- Считай максимально реалистично.
- ХЕ = carbs / 12.
- Числа без единиц.
- Комментарий короткий.
- Не пиши медицинские диагнозы.
- Не добавляй текст вне JSON.
`;
      } else {
        // ---------- IMAGE ANALYZE MODE ----------

        if (!imageBase64) {
          return res.status(400).json({
            error: 'Нет imageBase64',
          });
        }

        prompt = `
Ты анализируешь фото еды для диабетического дневника.

Язык ответа: ${languageName(responseLanguage)}.
displayName и comment должны быть на языке: ${languageName(responseLanguage)}.

Верни ТОЛЬКО JSON без пояснений и markdown.

Формат:
{
  "displayName": "название блюда на языке пользователя",
  "calories": 0,
  "breadUnits": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "comment": "короткий комментарий на языке пользователя"
}

Правила:
- Всегда оценивай углеводы.
- ХЕ = carbs / 12.
- Числа без единиц измерения.
- Комментарий короткий.
- Не пиши медицинские диагнозы.
- Не добавляй текст вне JSON.
`;
      }

      let response;

      // ---------- IMAGE REQUEST ----------
      if (imageBase64) {
        response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(responseLanguage),
            },
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt,
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${imageBase64}`,
                  },
                },
              ],
            },
          ],
        });
      } else {
        // ---------- TEXT REQUEST ----------
        response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content: buildSystemPrompt(responseLanguage),
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });
      }

      const content = response?.choices?.[0]?.message?.content || '';

      console.log('OPENAI RAW:', content);

      const parsed = extractJson(content);

      if (!parsed) {
        return res.status(500).json({
          error: 'Не удалось разобрать ответ AI',
          raw: content,
        });
      }

      const result = normalizeResult(parsed, responseLanguage);

      console.log('FINAL RESULT:', result);

      return res.json(result);
    } catch (error) {
      console.error('SERVER ERROR:', error);

      return res.status(500).json({
        error: error?.message || 'Ошибка сервера',
      });
    }
  }
);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI SERVER STARTED ON ${PORT}`);
});
