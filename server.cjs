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

function getLang(language) {
  return String(language || 'en').slice(0, 2).toLowerCase();
}

function smartBreadUnits(parsed) {
  const carbs = toNumber(parsed.carbs, 0);
  let breadUnits = toNumber(parsed.breadUnits, 0);

  if (carbs > 0) {
    breadUnits = roundToTenth(carbs / 12);
  }

  return breadUnits;
}

function isWeakComment(comment) {
  const text = String(comment || '').trim().toLowerCase();

  return (
    !text ||
    text.length < 90 ||
    text.split(/\s+/).length < 12 ||
    text.includes('содержит углеводы') ||
    text.includes('высокое содержание углеводов') ||
    text.includes('будьте осторожны') ||
    text.includes('содержит сахар') ||
    text.includes('contains carbohydrates') ||
    text.includes('be careful') ||
    text.includes('high carbs') ||
    text.includes('contains sugar') ||
    text.includes('satur ogļhidrātus')
  );
}

function smartFallbackComment(displayName, language) {
  const lang = getLang(language);
  const name = String(displayName || '').toLowerCase();

  const isAlcohol =
    name.includes('пиво') ||
    name.includes('beer') ||
    name.includes('вино') ||
    name.includes('wine') ||
    name.includes('алког') ||
    name.includes('alcohol') ||
    name.includes('alus') ||
    name.includes('vīns');

  const isChips =
    name.includes('чипс') ||
    name.includes('chips') ||
    name.includes('snack') ||
    name.includes('сухар') ||
    name.includes('čips');

  const isSweet =
    name.includes('торт') ||
    name.includes('cake') ||
    name.includes('конфет') ||
    name.includes('candy') ||
    name.includes('шоколад') ||
    name.includes('chocolate') ||
    name.includes('dessert') ||
    name.includes('десерт') ||
    name.includes('печенье') ||
    name.includes('cookie') ||
    name.includes('kūka');

  const isFastCarbs =
    isChips ||
    isSweet ||
    name.includes('хлеб') ||
    name.includes('bread') ||
    name.includes('рис') ||
    name.includes('rice') ||
    name.includes('карто') ||
    name.includes('potato') ||
    name.includes('макарон') ||
    name.includes('pasta');

  if (lang === 'ru') {
    if (isAlcohol) {
      return 'Этот напиток содержит углеводы и может повлиять на сахар не сразу, а позже. Лучше учитывать порцию и проверить сахар через 1–2 часа после употребления.';
    }

    if (isChips) {
      return 'Чипсы содержат быстрые углеводы и жиры, поэтому сахар может подняться довольно быстро. Лучше учитывать размер порции и проверить глюкозу через 1–2 часа.';
    }

    if (isSweet) {
      return 'Сладкие продукты могут быстро повысить сахар из-за большого количества быстрых углеводов. Лучше уменьшить порцию и проверить сахар через 1–2 часа.';
    }

    if (isFastCarbs) {
      return 'В этом блюде есть быстрые углеводы, поэтому сахар после еды может заметно вырасти. Лучше учитывать порцию и проверить глюкозу через 1–2 часа.';
    }

    return 'Это примерная оценка блюда. Учитывай углеводы и размер порции, потому что сахар после еды может измениться через некоторое время.';
  }

  if (lang === 'lv') {
    if (isAlcohol) {
      return 'Šis dzēriens satur ogļhidrātus un var ietekmēt cukura līmeni arī vēlāk. Labāk ņemt vērā porciju un pārbaudīt cukuru pēc 1–2 stundām.';
    }

    if (isChips) {
      return 'Čipsi satur ātrus ogļhidrātus un taukus, tāpēc cukura līmenis var paaugstināties diezgan ātri. Labāk ņemt vērā porcijas lielumu.';
    }

    if (isSweet) {
      return 'Saldumi var ātri paaugstināt cukura līmeni ātro ogļhidrātu dēļ. Labāk kontrolēt porciju un pārbaudīt cukuru pēc 1–2 stundām.';
    }

    return 'Šis ēdiens var ietekmēt cukura līmeni pēc ēšanas. Labāk ņemt vērā ogļhidrātus, porcijas lielumu un pārbaudīt cukuru vēlāk.';
  }

  if (isAlcohol) {
    return 'This drink contains carbohydrates and may affect glucose later, not immediately. It is better to count the portion and check glucose after 1–2 hours.';
  }

  if (isChips) {
    return 'Chips contain fast carbohydrates and fats, so glucose may rise quite quickly. It is better to watch the portion size and check glucose after 1–2 hours.';
  }

  if (isSweet) {
    return 'Sweet foods may raise glucose quickly because they contain fast carbohydrates. It is better to control the portion and check glucose after 1–2 hours.';
  }

  return 'This is an approximate food estimate. Count the carbohydrates and portion size, because glucose may change some time after eating.';
}

function normalizeResult(parsed, language) {
  const calories = toNumber(parsed.calories, 0);
  const protein = toNumber(parsed.protein, 0);
  const fat = toNumber(parsed.fat, 0);
  const carbs = toNumber(parsed.carbs, 0);
  const breadUnits = smartBreadUnits(parsed);

  const displayName = String(parsed.displayName || 'Food');
  let comment = String(parsed.comment || '').trim();

  if (isWeakComment(comment)) {
    comment = smartFallbackComment(displayName, language);
  }

  return {
    displayName,
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
  res.send('STAS FINAL V10');
});

app.post(['/analyze-food', '/analyze-food/'], async (req, res) => {
  try {
    if (!apiKey) {
      return res.status(500).json({
        error: 'OPENAI_API_KEY missing on server',
      });
    }

    const { imageBase64, language = 'en' } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({
        error: 'No imageBase64',
      });
    }

    const userLanguage = String(language || 'en').slice(0, 5);

    const prompt = `
You analyze food and drink photos for a diabetes diary app.

Return ONLY valid JSON.
No markdown.
No explanations outside JSON.

User language: ${userLanguage}

Format:
{
  "displayName": "food or drink name in the user language",
  "calories": 0,
  "breadUnits": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "comment": "helpful AI comment in the user language"
}

Nutrition rules:
- Always estimate carbohydrates.
- Do not put 0 carbs if food or drink clearly contains carbohydrates.
- Beer, wine, juice, lemonade, sweet drinks and cocktails also need carb estimation.
- Chips, sweets, bread, rice, potatoes, pasta, desserts, pastry, fruit and cereals must not have 0 carbs.
- Bread units: 1 XE = about 12 g carbohydrates.
- Return numbers only, without units.
- If unsure, estimate realistically.

Comment rules:
- The comment MUST be in the user language: ${userLanguage}.
- The comment must sound like a real helpful assistant.
- The comment must be 2 full sentences.
- The comment must be 120–250 characters.
- Explain how the food or drink may affect glucose.
- Give a simple practical tip.
- For alcohol or sweet drinks, mention that glucose may change later and checking after 1–2 hours is useful.
- For fast carbohydrates, mention possible glucose rise.
- Do not diagnose.
- Do not prescribe treatment.
- NEVER write short dry phrases like:
  "Contains carbohydrates"
  "High carbohydrate content"
  "Contains sugar"
  "Be careful"
  "Высокое содержание углеводов"
  "Содержит углеводы"
  "Содержит сахар"
  "Будьте осторожны"

Good Russian examples:
"Чипсы содержат быстрые углеводы и жиры, поэтому сахар может подняться довольно быстро. Лучше учитывать размер порции и проверить глюкозу через 1–2 часа."

"Сладкое вино содержит сахар и может повысить глюкозу не сразу, а позже. Лучше учитывать порцию и проверить сахар через 1–2 часа после употребления."

Good English examples:
"Chips contain fast carbohydrates and fats, so glucose may rise quite quickly. It is better to watch the portion size and check glucose after 1–2 hours."

"Sweet wine contains sugar and may raise glucose later, not only immediately. It is better to count the portion and check glucose after 1–2 hours."

Good Latvian examples:
"Čipsi satur ātrus ogļhidrātus un taukus, tāpēc cukura līmenis var paaugstināties diezgan ātri. Labāk ņemt vērā porcijas lielumu."
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content:
            'You are a food, drink, carbohydrate and bread-unit analysis assistant for a diabetes diary. Always return strict JSON only.',
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
        error: 'Could not parse AI response',
      });
    }

    const result = normalizeResult(parsed, userLanguage);

    console.log('SERVER RESPONSE:', result);

    return res.json(result);
  } catch (error) {
    console.error('SERVER ERROR:', error?.message || error);

    return res.status(500).json({
      error: error?.message || 'Server error',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI SERVER STARTED ON ${PORT}`);
});