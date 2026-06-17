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
  if (value === null || value === undefined || value === '') return fallback;
  const match = String(value).replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!match) return fallback;
  const num = Number(match[0]);
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
  if (code === 'en') return 'The estimate is approximate. Check the weight and ingredients for better accuracy.';
  if (code === 'lv') return 'Aprēķins ir aptuvens. Precizitātei pārbaudi svaru un sastāvu.';
  return 'Оценка примерная. Для точности проверь вес и состав блюда.';
}

function smartBreadUnits(parsed) {
  const carbs = toNumber(parsed.carbs, 0);
  let breadUnits = toNumber(parsed.breadUnits, 0);

  if (carbs > 0) breadUnits = roundToTenth(carbs / 12);
  if (carbs <= 0 && breadUnits > 0) return roundToTenth(breadUnits);

  return breadUnits;
}

function buildSmartComment(result, language = 'ru') {
  const code = normalizeLanguage(language);
  const carbs = toNumber(result.carbs, 0);
  const breadUnits = toNumber(result.breadUnits, 0);
  const fat = toNumber(result.fat, 0);
  const protein = toNumber(result.protein, 0);
  const calories = toNumber(result.calories, 0);

  if (code === 'en') {
    const parts = [`Estimate: about ${breadUnits} BU / ${carbs} g carbs and ${calories} kcal.`];
    if (carbs >= 60) parts.push('This is a high carbohydrate load and may noticeably raise glucose after the meal.');
    else if (carbs >= 30) parts.push('This is a moderate carbohydrate load, so after-meal glucose control is useful.');
    else if (carbs > 0) parts.push('The carbohydrate load is relatively low, so the glucose effect may be moderate.');
    if (fat >= 20) parts.push(`Fat is also high (${fat} g), which may slow digestion and cause a later glucose rise.`);
    if (protein >= 20) parts.push(`Protein is noticeable (${protein} g), which can improve satiety.`);
    parts.push('This is not a medical prescription; use it as diary guidance.');
    return parts.join(' ');
  }

  if (code === 'lv') {
    const parts = [`Aptuveni: ${breadUnits} MV / ${carbs} g ogļhidrātu un ${calories} kcal.`];
    if (carbs >= 60) parts.push('Tā ir liela ogļhidrātu slodze un pēc ēšanas cukurs var ievērojami paaugstināties.');
    else if (carbs >= 30) parts.push('Tā ir vidēja ogļhidrātu slodze, tāpēc pēc ēšanas ir vērts pārbaudīt cukuru.');
    else if (carbs > 0) parts.push('Ogļhidrātu slodze ir salīdzinoši zema, tāpēc ietekme uz cukuru var būt mērena.');
    if (fat >= 20) parts.push(`Tauku ir daudz (${fat} g), tas var palēnināt uzsūkšanos un dot vēlāku cukura kāpumu.`);
    if (protein >= 20) parts.push(`Olbaltumvielu ir pietiekami (${protein} g), tas var dot sāta sajūtu.`);
    parts.push('Tas nav medicīnisks norādījums, bet dienasgrāmatas komentārs.');
    return parts.join(' ');
  }

  const parts = [`Оценка: около ${String(breadUnits).replace('.', ',')} ХЕ / ${String(carbs).replace('.', ',')} г углеводов и ${String(calories).replace('.', ',')} ккал.`];
  if (carbs >= 60) parts.push('Это высокая углеводная нагрузка, сахар после еды может заметно подняться.');
  else if (carbs >= 30) parts.push('Это средняя углеводная нагрузка, лучше проверить сахар после еды.');
  else if (carbs > 0) parts.push('Углеводов немного, влияние на сахар может быть умеренным.');
  if (fat >= 20) parts.push(`Жиров много (${String(fat).replace('.', ',')} г), из-за этого сахар может подниматься медленнее, но дольше.`);
  if (protein >= 20) parts.push(`Белка достаточно (${String(protein).replace('.', ',')} г), блюдо может лучше насыщать.`);
  parts.push('Это не назначение лечения, а подсказка для дневника.');
  return parts.join(' ');
}

function normalizeResult(parsed, language = 'ru') {
  let calories = toNumber(parsed.calories, 0);
  let protein = toNumber(parsed.protein, 0);
  let fat = toNumber(parsed.fat, 0);
  let carbs = toNumber(parsed.carbs, 0);
  let breadUnits = smartBreadUnits(parsed);

  if (carbs <= 0 && breadUnits > 0) carbs = breadUnits * 12;
  if (carbs > 0) breadUnits = carbs / 12;

  protein = Math.max(0, Math.min(protein, 250));
  fat = Math.max(0, Math.min(fat, 250));
  carbs = Math.max(0, Math.min(carbs, 350));
  breadUnits = Math.max(0, Math.min(breadUnits, 30));
  calories = Math.max(0, Math.min(calories, 3500));

  const macroCalories = protein * 4 + carbs * 4 + fat * 9;
  const bigCalorieMismatch = macroCalories > 0 && Math.abs(calories - macroCalories) > Math.max(120, macroCalories * 0.25);

  if (calories <= 0 || bigCalorieMismatch) {
    calories = macroCalories;
  }

  const result = {
    displayName: String(parsed.displayName || fallbackDishName(language)),
    calories: roundToTenth(calories),
    breadUnits: roundToTenth(breadUnits),
    protein: roundToTenth(protein),
    fat: roundToTenth(fat),
    carbs: roundToTenth(carbs),
    comment: String(parsed.comment || fallbackComment(language)),
  };

  // Финальный комментарий строим на сервере из реальных цифр,
  // чтобы ИИ не писал общие фразы без ХЕ и углеводов.
  result.comment = buildSmartComment(result, language);

  return result;
}

function extractJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function buildSystemPrompt(language) {
  return `
Ты эксперт по диабетическому питанию и анализу еды.

Отвечай строго на языке пользователя: ${languageName(language)}.
Поля displayName и comment ОБЯЗАТЕЛЬНО должны быть на языке пользователя.
Верни только JSON без markdown и без дополнительного текста.
`;
}

function buildFoodPrompt(responseLanguage, foodText = '') {
  return `
Ты анализируешь еду для дневника питания и диабета.

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

${foodText ? `Описание еды:\n"${foodText}"` : ''}

Правила:
- Считай максимально реалистично по видимой порции или описанию.
- Всегда оценивай углеводы.
- ХЕ = carbs / 12.
- Числа без единиц измерения.
- Не занижай сладости, хлеб, лаваш, рис, картофель, макароны, пиццу, молоко, соки и десерты.
- Если на фото целая упаковка, оценивай видимую/вероятную порцию, а не всю коробку, если пользователь явно не указал всю коробку.
- Комментарий должен быть полезным для диабетического дневника.
- Учитывай углеводы, ХЕ, калории, белки и жиры.
- Если углеводов много, предупреди о возможном росте сахара.
- Если углеводов мало, отметь это.
- Если жиров много, укажи, что сахар может подняться позже.
- Пиши 2-4 предложения.
- Не пиши медицинские диагнозы.
- Не назначай дозы инсулина.
- Не добавляй текст вне JSON.
`;
}

app.get('/', (req, res) => {
  res.send('STAS MULTILANGUAGE AI V15 SMART COMMENTS READY');
});

app.post([
  '/analyze-food',
  '/analyze-food/',
  '/recalculate-food',
  '/recalculate-food/',
  '/recalculate-foods',
  '/recalculate-foods/',
], async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY missing on server' });
    }

    const { imageBase64, language = 'ru', description, mealName } = req.body || {};
    const responseLanguage = normalizeLanguage(language);
    const foodText = description || mealName || '';

    if (!imageBase64 && !foodText) {
      return res.status(400).json({ error: 'Нет imageBase64 или описания еды' });
    }

    const prompt = buildFoodPrompt(responseLanguage, foodText);
    let response;

    if (imageBase64) {
      response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: buildSystemPrompt(responseLanguage) },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
          },
        ],
      });
    } else {
      response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: buildSystemPrompt(responseLanguage) },
          { role: 'user', content: prompt },
        ],
      });
    }

    const content = response?.choices?.[0]?.message?.content || '';
    console.log('OPENAI RAW:', content);

    const parsed = extractJson(content);
    if (!parsed) {
      return res.status(500).json({ error: 'Не удалось разобрать ответ AI', raw: content });
    }

    const result = normalizeResult(parsed, responseLanguage);
    console.log('FINAL RESULT:', result);

    return res.json(result);
  } catch (error) {
    console.error('SERVER ERROR:', error);
    return res.status(500).json({ error: error?.message || 'Ошибка сервера' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI SERVER STARTED ON ${PORT}`);
});
