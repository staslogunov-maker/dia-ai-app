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
    return 'The estimate is approximate. Check the portion size and ingredients. For a diary, it is useful to compare this meal with glucose after eating.';
  }

  if (code === 'lv') {
    return 'Aprēķins ir aptuvens. Pārbaudi porcijas lielumu un sastāvu. Dienasgrāmatai noderīgi salīdzināt šo ēdienu ar cukuru pēc ēšanas.';
  }

  return 'Оценка примерная. Проверь размер порции и состав блюда. Для дневника полезно сравнить эту еду с сахаром после еды.';
}

function smartBreadUnits(parsed) {
  const carbs = toNumber(parsed.carbs, 0);
  let breadUnits = toNumber(parsed.breadUnits, 0);

  if (carbs > 0) {
    breadUnits = roundToTenth(carbs / 12);
  }

  return breadUnits;
}

function buildSmartComment(parsed, language = 'ru') {
  const code = normalizeLanguage(language);
  const carbs = toNumber(parsed.carbs, 0);
  const breadUnits = smartBreadUnits(parsed);
  const calories = toNumber(parsed.calories, 0);
  const protein = toNumber(parsed.protein, 0);
  const fat = toNumber(parsed.fat, 0);
  const original = String(parsed.comment || '').trim();

  if (original.length >= 70) return original;

  const highCarbs = carbs >= 60 || breadUnits >= 5;
  const mediumCarbs = carbs >= 30 || breadUnits >= 2.5;
  const lowCarbs = carbs > 0 && carbs < 20;
  const highFat = fat >= 25;
  const highProtein = protein >= 25;

  if (code === 'en') {
    const parts = [];
    parts.push(`Estimated load: about ${roundToTenth(breadUnits)} BU and ${roundToTenth(carbs)} g carbs.`);
    if (highCarbs) parts.push('This is a noticeable carbohydrate load, so glucose may rise after eating.');
    else if (mediumCarbs) parts.push('The carbohydrate load is moderate; checking glucose after the meal will show the real reaction.');
    else if (lowCarbs) parts.push('The carbohydrate load looks low, so the glucose effect may be moderate.');
    else parts.push('Carbs look minimal, but the estimate depends on the real portion and ingredients.');
    if (highFat) parts.push('Fat may slow digestion, so glucose can rise later.');
    if (highProtein) parts.push('There is also a good amount of protein, which can help with satiety.');
    parts.push('This is not medical advice and does not prescribe insulin doses.');
    return parts.join(' ');
  }

  if (code === 'lv') {
    const parts = [];
    parts.push(`Aptuvenā slodze: ap ${roundToTenth(breadUnits)} MV un ${roundToTenth(carbs)} g ogļhidrātu.`);
    if (highCarbs) parts.push('Tā ir ievērojama ogļhidrātu slodze, tāpēc cukurs pēc ēšanas var paaugstināties.');
    else if (mediumCarbs) parts.push('Ogļhidrātu slodze ir vidēja; cukura pārbaude pēc ēšanas parādīs reālo reakciju.');
    else if (lowCarbs) parts.push('Ogļhidrātu slodze izskatās zema, tāpēc ietekme uz cukuru var būt mērena.');
    else parts.push('Ogļhidrātu izskatās maz, bet aprēķins atkarīgs no porcijas un sastāva.');
    if (highFat) parts.push('Tauki var palēnināt uzsūkšanos, tāpēc cukurs var paaugstināties vēlāk.');
    if (highProtein) parts.push('Ēdienā ir arī labs olbaltumvielu daudzums, kas palīdz sāta sajūtai.');
    parts.push('Tas nav medicīnisks norādījums un nenosaka insulīna devas.');
    return parts.join(' ');
  }

  const parts = [];
  parts.push(`Оценка: около ${roundToTenth(breadUnits)} ХЕ и ${roundToTenth(carbs)} г углеводов.`);
  if (highCarbs) parts.push('Это заметная углеводная нагрузка, сахар после еды может подняться.');
  else if (mediumCarbs) parts.push('Углеводная нагрузка средняя; замер сахара после еды покажет реальную реакцию.');
  else if (lowCarbs) parts.push('Углеводов немного, влияние на сахар может быть умеренным.');
  else parts.push('Углеводов выглядит мало, но точность зависит от порции и состава.');
  if (highFat) parts.push('Жиры могут замедлить усвоение, поэтому сахар иногда поднимается позже.');
  if (highProtein) parts.push('Белка достаточно много, это может лучше насыщать.');
  parts.push('Это не медицинское назначение и не расчёт дозы инсулина.');
  return parts.join(' ');
}

function normalizeResult(parsed, language = 'ru') {
  const calories = toNumber(parsed.calories, 0);
  const protein = toNumber(parsed.protein, 0);
  const fat = toNumber(parsed.fat, 0);
  const carbs = toNumber(parsed.carbs, 0);
  const breadUnits = smartBreadUnits(parsed);

  const normalized = {
    displayName: String(parsed.displayName || fallbackDishName(language)),
    calories: roundToTenth(calories),
    breadUnits: roundToTenth(breadUnits),
    protein: roundToTenth(protein),
    fat: roundToTenth(fat),
    carbs: roundToTenth(carbs),
    comment: String(parsed.comment || fallbackComment(language)),
  };

  normalized.comment = buildSmartComment(normalized, language);

  return normalized;
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

Комментарий должен быть полезным для дневника диабета:
- 2-4 предложения.
- Учитывай углеводы, ХЕ, калории, жиры и белки.
- Если углеводов много, предупреди о возможном росте сахара после еды.
- Если жиров много, укажи, что сахар может подняться позже.
- Если углеводов мало, отметь, что влияние на сахар может быть умеренным.
- Не назначай дозы инсулина.
- Не ставь диагнозы.
- Не заменяй врача.
`;
}

app.get('/', (req, res) => {
  res.send('STAS MULTILANGUAGE AI V14 SMART COMMENTS READY');
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
  "comment": "полезный комментарий для диабетического дневника на языке пользователя"
}

Описание еды:
"${foodText}"

Правила:
- Считай максимально реалистично.
- ХЕ = carbs / 12.
- Числа без единиц.
- Комментарий 2-4 предложения.
- В комментарии учитывай ХЕ, углеводы, жиры, белки и калории.
- Если углеводов много, предупреди о возможном росте сахара после еды.
- Если жирное блюдо, укажи, что сахар может подняться позже.
- Если углеводов мало, отметь умеренную нагрузку.
- Не назначай дозы инсулина.
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
  "comment": "полезный комментарий для диабетического дневника на языке пользователя"
}

Правила:
- Всегда оценивай углеводы.
- ХЕ = carbs / 12.
- Числа без единиц измерения.
- Комментарий 2-4 предложения.
- В комментарии учитывай ХЕ, углеводы, жиры, белки и калории.
- Если углеводов много, предупреди о возможном росте сахара после еды.
- Если блюдо жирное, укажи, что сахар может подниматься позже.
- Если углеводов мало, отметь, что влияние на сахар может быть умеренным.
- Не назначай дозы инсулина.
- Не пиши медицинские диагнозы.
- Не добавляй текст вне JSON.
`;
      }

      let response;

      // ---------- IMAGE REQUEST ----------
      if (imageBase64) {
        response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.25,
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
          temperature: 0.25,
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
