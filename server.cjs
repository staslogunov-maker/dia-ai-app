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

  let comment = String(parsed.comment || '').trim();

  if (!comment || comment.split(/\s+/).length < 12) {
    comment =
      'Оценка примерная. Этот продукт может влиять на сахар, поэтому лучше учитывать углеводы и проверить сахар через 1–2 часа.';
  }

  return {
    displayName: String(parsed.displayName || 'Неизвестное блюдо'),
    calories: roundToTenth(calories),
    breadUnits: roundToTenth(breadUnits),
    protein: roundToTenth(protein),
    fat: roundToTenth(fat),
    carbs: roundToTenth(carbs),
    comment,
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
  res.send('AI SERVER WORKS');
});

app.post(['/analyze-food', '/analyze-food/'], async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY missing on server',
      });
    }

    const { imageBase64 } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({
        error: 'Нет imageBase64',
      });
    }

    const prompt = `
Ты анализируешь фото еды для диабетического дневника.

Верни ТОЛЬКО JSON без пояснений и без markdown.

Формат ответа:
{
  "displayName": "название еды или напитка",
  "calories": 0,
  "breadUnits": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "comment": "полезный комментарий для диабетика"
}

Правила расчёта:
- Всегда оценивай углеводы.
- Если видишь напиток, пиво, вино, сок, лимонад, сладкий напиток — тоже считай углеводы.
- Пиво обычно содержит углеводы из солода. Не ставь 0 углеводов для пива.
- Сладкое вино, ликёр, коктейль, сладкий алкоголь — углеводы могут быть высокими.
- Если на фото есть картофель, рис, макароны, хлеб, сладости, фрукты, выпечка, крупы, соусы с сахаром — углеводы не должны быть 0.
- Хлебные единицы считай примерно так: 1 ХЕ = 12 г углеводов.
- Если breadUnits не уверен, всё равно оцени по carbs.
- Числа возвращай без единиц измерения.
- Не пиши "0", если еда или напиток явно содержит углеводы.
- Если фото не идеально понятно, дай примерную оценку.

Правила комментария:
- Комментарий всегда на русском языке.
- Комментарий должен быть полезный, 2–3 предложения.
- Комментарий НЕ должен быть короче 12 слов.
- Комментарий должен быть 120–250 символов.
- Комментарий должен объяснять влияние еды или напитка на сахар.
- Нельзя писать короткие фразы:
  "Содержит углеводы"
  "Высокое содержание углеводов"
  "Содержит сахар"
  "Содержит сахар, углеводы не нулевые"
- Комментарий должен выглядеть как совет живого помощника.
- Для сладких напитков и алкоголя обязательно предупреждай, что сахар может подняться позже.
- Для быстрых углеводов предупреждай о возможном резком росте сахара.
- Объясни, почему продукт может влиять на сахар.
- Для алкоголя обязательно напомни: сахар может меняться позже, лучше проверить через 1–2 часа.
- Не ставь диагноз и не назначай лечение.
- Пиши простым языком.

Примеры хороших комментариев:
- "Пиво содержит углеводы из солода и может поднять сахар позже. Лучше учитывать его как углеводный напиток и проверить сахар через 1–2 часа."
- "Сладкое вино содержит сахар и может быстро повысить уровень глюкозы. После алкоголя сахар иногда меняется не сразу, поэтому лучше проверить его через 1–2 часа."
- "Чипсы содержат быстрые углеводы и жиры, поэтому сахар может подняться довольно быстро. Лучше учитывать размер порции и проверить сахар через 1–2 часа после еды."
- "Блюдо содержит быстрые углеводы, поэтому сахар после еды может вырасти. Лучше учитывать размер порции и проверить сахар через 1–2 часа."
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.9,
      messages: [
        {
          role: 'system',
          content:
            'Ты эксперт по анализу еды, напитков, углеводов и хлебных единиц для диабетического дневника. Отвечай строго JSON.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
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

    const content = response.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);

    if (!parsed) {
      console.error('OPENAI RAW RESPONSE:', content);

      return res.status(500).json({
        error: 'Не удалось разобрать ответ AI',
      });
    }

    const result = normalizeResult(parsed);

    console.log('SERVER RESPONSE:', result);

    return res.json(result);
  } catch (error) {
    console.error('SERVER ERROR:', error?.message || error);

    return res.status(500).json({
      error: error?.message || 'Ошибка сервера',
    });
  }
});

app.listen(PORT,'0.0.0.0', () => {
  console.log(`AI SERVER STARTED ON ${PORT}`);
});