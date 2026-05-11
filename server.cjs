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

function getLang(language) {
  return String(language || 'en').slice(0, 2).toLowerCase();
}

function isWeakComment(comment) {
  const text = String(comment || '').trim().toLowerCase();

  return (
    !text ||
    text.length < 80 ||
    text.split(/\s+/).length < 12 ||
    text.includes('содержит углеводы') ||
    text.includes('высокое содержание углеводов') ||
    text.includes('содержит сахар') ||
    text.includes('contains carbohydrates') ||
    text.includes('high carbohydrate') ||
    text.includes('contains sugar') ||
    text.includes('satur ogļhidrātus') ||
    text.includes('augsts ogļhidrātu')
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
    name.includes('kūka') ||
    name.includes('šokolāde');

  if (lang === 'ru') {
    if (isAlcohol) {
      return 'Этот напиток содержит углеводы и может повлиять на сахар не сразу, а позже. Лучше учитывать порцию и проверить сахар через 1–2 часа после употребления.';
    }

    if (isChips) {
      return 'Такие закуски содержат быстрые углеводы и жиры, поэтому сахар может подняться довольно быстро. Лучше учитывать размер порции и проверить глюкозу после еды.';
    }

    if (isSweet) {
      return 'Сладкие продукты могут быстро повысить уровень сахара из-за большого количества быстрых углеводов. Лучше контролировать порцию и проверить сахар позже.';
    }

    return 'Это блюдо содержит углеводы и может повлиять на уровень сахара после еды. Лучше учитывать размер порции и проверить сахар через 1–2 часа.';
  }

  if (lang === 'lv') {
    if (isAlcohol) {
      return 'Šis dzēriens satur ogļhidrātus un var ietekmēt cukura līmeni arī vēlāk. Labāk ņemt vērā porciju un pārbaudīt cukuru pēc 1–2 stundām.';
    }

    if (isChips) {
      return 'Šādas uzkodas satur ātrus ogļhidrātus un taukus, tāpēc cukura līmenis var paaugstināties diezgan ātri. Labāk ņemt vērā porcijas lielumu.';
    }

    if (isSweet) {
      return 'Saldumi var ātri paaugstināt cukura līmeni lielā ātro ogļhidrātu daudzuma dēļ. Labāk kontrolēt porciju un pārbaudīt cukuru vēlāk.';
    }

    return 'Šis ēdiens satur ogļhidrātus un var ietekmēt cukura līmeni pēc ēšanas. Labāk ņemt vērā porcijas lielumu un pārbaudīt cukuru pēc 1–2 stundām.';
  }

  if (isAlcohol) {
    return 'This drink contains carbohydrates and may affect glucose later, not immediately. It is better to count the portion and check glucose after 1–2 hours.';
  }

  if (isChips) {
    return 'These snacks contain fast carbohydrates and fats, so glucose may rise quite quickly. It is better to watch the portion size and check glucose after eating.';
  }

  if (isSweet) {
    return 'Sweet foods may raise glucose quickly because they contain fast carbohydrates. It is better to control the portion and check glucose later.';
  }

  return 'This food contains carbohydrates and may affect glucose after eating. It is better to count the portion size and check glucose after 1–2 hours.';
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
  res.send('NEW AI SERVER v3 WORKS');
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
You analyze a food or drink photo for a diabetes diary.

Return ONLY valid JSON. No markdown. No explanations outside JSON.

User language: ${userLanguage}

Response format:
{
  "displayName": "food or drink name in the user language",
  "calories": 0,
  "breadUnits": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "comment": "useful diabetes-friendly comment in the user language"
}

Nutrition rules:
- Always estimate carbohydrates.
- If you see drinks, beer, wine, juice, lemonade, sweet drinks, cocktails — estimate carbohydrates too.
- Beer usually contains carbohydrates from malt. Do not set carbs to 0 for beer.
- Sweet wine, liqueur, cocktails and sweet alcohol may contain significant carbohydrates.
- If you see potatoes, rice, pasta, bread, sweets, fruit, pastry, grains, chips, sauces with sugar — carbs must not be 0.
- Bread units: approximately 1 bread unit = 12 g carbohydrates.
- If breadUnits is uncertain, calculate it from carbs.
- Return numbers without units.
- If the photo is not perfectly clear, still give a reasonable estimate.

Comment rules:
- The comment MUST be in the user language: ${userLanguage}.
- The food/drink name MUST also be in the user language.
- The comment must be useful and human.
- The comment must be 2–3 full sentences.
- The comment must not be shorter than 12 words.
- The comment should be about 120–250 characters.
- Explain how this food or drink can affect glucose.
- Give a simple practical tip: portion size, carbohydrates, or checking glucose after eating.
- For alcohol and sweet drinks, mention that glucose may change later and it is better to check after 1–2 hours.
- For fast carbohydrates, warn about possible glucose rise.
- Do not diagnose.
- Do not prescribe treatment.
- Do not write dry phrases like:
  "Contains carbohydrates"
  "High carbohydrate content"
  "Contains sugar"
  "Carbs are not zero"
- The comment should sound like a real helpful assistant.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.7,
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