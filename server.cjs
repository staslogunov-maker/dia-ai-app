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

function smartBreadUnits(parsed) {
  const carbs = toNumber(parsed.carbs, 0);
  let breadUnits = toNumber(parsed.breadUnits, 0);

  if (carbs > 0) {
    breadUnits = roundToTenth(carbs / 12);
  }

  return breadUnits;
}

function normalizeResult(parsed) {
  const calories = toNumber(parsed.calories, 0);
  const protein = toNumber(parsed.protein, 0);
  const fat = toNumber(parsed.fat, 0);
  const carbs = toNumber(parsed.carbs, 0);
  const breadUnits = smartBreadUnits(parsed);

  return {
    displayName: String(parsed.displayName || 'Неизвестное блюдо'),
    calories: roundToTenth(calories),
    breadUnits: roundToTenth(breadUnits),
    protein: roundToTenth(protein),
    fat: roundToTenth(fat),
    carbs: roundToTenth(carbs),
    comment: String(
      parsed.comment ||
        'Оценка примерная. Для точности проверь вес и состав блюда.'
    ),
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

app.get('/', (req, res) => {
  res.send('STAS MULTILANGUAGE AI V12 READY');
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

      let prompt = '';

      // ---------- RECALCULATE MODE ----------
      if (description || mealName) {
        const foodText = description || mealName;

        prompt = `
Ты анализируешь описание еды для диабетического дневника.

Верни ТОЛЬКО JSON без markdown.

Формат:
{
  "displayName": "название блюда",
  "calories": 0,
  "breadUnits": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "comment": "короткий комментарий"
}

Описание еды:
"${foodText}"

Правила:
- Считай максимально реалистично.
- ХЕ = carbs / 12
- Числа без единиц.
- Комментарий короткий.
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

Верни ТОЛЬКО JSON без пояснений и markdown.

Формат:
{
  "displayName": "название блюда",
  "calories": 0,
  "breadUnits": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "comment": "короткий комментарий"
}

Правила:
- Всегда оценивай углеводы.
- ХЕ = carbs / 12
- Числа без единиц измерения.
- Комментарий короткий.
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
              content:
                'Ты эксперт по диабетическому питанию и анализу еды.',
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
              content:
                'Ты эксперт по диабетическому питанию и анализу еды.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });
      }

      const content =
        response?.choices?.[0]?.message?.content || '';

      console.log('OPENAI RAW:', content);

      const parsed = extractJson(content);

      if (!parsed) {
        return res.status(500).json({
          error: 'Не удалось разобрать ответ AI',
          raw: content,
        });
      }

      const result = normalizeResult(parsed);

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