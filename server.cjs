require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));

function roundToTenth(value) {
  return Math.round(value * 10) / 10;
}

function smartBreadUnits(parsed) {
  const name = String(parsed?.displayName || '').toLowerCase();
  const comment = String(parsed?.comment || '').toLowerCase();
  const text = `${name} ${comment}`;

  const carbs = Number(parsed?.carbs || 0);
  let breadUnits = Number(parsed?.breadUnits || 0);

  if (carbs > 0) {
    breadUnits = roundToTenth(carbs / 12);
  }

  const hasPotato =
    text.includes('картоф') ||
    text.includes('potato') ||
    text.includes('fries');

  const hasRice =
    text.includes('рис') ||
    text.includes('rice');

  const hasPasta =
    text.includes('макарон') ||
    text.includes('паста') ||
    text.includes('spaghetti') ||
    text.includes('pasta');

  const hasBread =
    text.includes('хлеб') ||
    text.includes('булк') ||
    text.includes('toast') ||
    text.includes('bread') ||
    text.includes('bun');

  const hasSweet =
    text.includes('конфет') ||
    text.includes('шоколад') ||
    text.includes('печенье') ||
    text.includes('торт') ||
    text.includes('sprite') ||
    text.includes('cola') ||
    text.includes('сок') ||
    text.includes('лимонад') ||
    text.includes('candy') ||
    text.includes('cookie') ||
    text.includes('cake');

  const hasPureProtein =
    text.includes('мяс') ||
    text.includes('котлет') ||
    text.includes('тефтел') ||
    text.includes('куриц') ||
    text.includes('рыб') ||
    text.includes('яйц') ||
    text.includes('meat') ||
    text.includes('chicken') ||
    text.includes('fish') ||
    text.includes('egg');

  if (carbs >= 10 && breadUnits < 0.8) {
    breadUnits = roundToTenth(carbs / 12);
  }

  if (breadUnits === 0) {
    if (hasPotato) breadUnits = 3.5;
    else if (hasRice) breadUnits = 3.5;
    else if (hasPasta) breadUnits = 3.5;
    else if (hasBread) breadUnits = 2.0;
    else if (hasSweet) breadUnits = 2.0;
    else if (hasPureProtein) breadUnits = 0;
  }

  if (!Number.isFinite(breadUnits) || breadUnits < 0) {
    breadUnits = 0;
  }

  return roundToTenth(breadUnits);
}

app.get('/', (req, res) => {
  res.send('AI SERVER WORKS');
});

app.post(['/analyze-food', '/analyze-food/'], async (req, res) => {
  try {
    console.log('POST /analyze-food получен');

    const { imageBase64 } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Нет imageBase64' });
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'Нет OPENAI_API_KEY в .env' });
    }

    const prompt = `
Определи, что изображено на фото, и верни только JSON.

Формат строго такой:
{
  "displayName": "Название блюда или напитка",
  "calories": 0,
  "breadUnits": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "comment": "Короткий комментарий"
}

Правила:
- если на фото напиток, укажи напиток
- если на фото несколько одинаковых объектов, оцени главный объект на фото
- числа должны быть числами, не строками
- не пиши ничего кроме JSON
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
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
        max_tokens: 500,
      }),
    });

    const data = await response.json();
    console.log('OPENAI:', JSON.stringify(data));

    if (!response.ok) {
      return res.status(500).json({
        error: data?.error?.message || 'Ошибка OpenAI',
      });
    }

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({ error: 'Нет ответа от OpenAI' });
    }

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      return res.status(500).json({
        error: 'OpenAI прислал некорректный JSON',
      });
    }

    parsed.breadUnits = smartBreadUnits(parsed);

    return res.json(parsed);
  } catch (error) {
    console.error('SERVER ERROR:', error);
    return res.status(500).json({
      error: error?.message || 'Ошибка сервера',
    });
  }
});

app.listen(3000, '0.0.0.0', () => {
  console.log('AI SERVER STARTED ON 3000');
});

process.stdin.resume();
