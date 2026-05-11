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

function getFallbackComment(language) {
  const lang = String(language || 'en').slice(0, 2).toLowerCase();

  if (lang === 'ru') {
    return 'Оценка примерная. Этот продукт может влиять на сахар, поэтому лучше учитывать углеводы и проверить сахар через 1–2 часа.';
  }

  if (lang === 'lv') {
    return 'Novērtējums ir aptuvens. Šis produkts var ietekmēt cukura līmeni, tāpēc labāk ņemt vērā ogļhidrātus un pārbaudīt cukuru pēc 1–2 stundām.';
  }

  if (lang === 'de') {
    return 'Die Einschätzung ist ungefähr. Dieses Produkt kann den Blutzucker beeinflussen, daher sollten Kohlenhydrate berücksichtigt und der Zucker nach 1–2 Stunden geprüft werden.';
  }

  return 'This is an approximate estimate. This food may affect glucose levels, so it is better to count the carbohydrates and check glucose after 1–2 hours.';
}

function normalizeResult(parsed, language) {
  const calories = toNumber(parsed.calories, 0);
  const protein = toNumber(parsed.protein, 0);
  const fat = toNumber(parsed.fat, 0);
  const carbs = toNumber(parsed.carbs, 0);
  const breadUnits = smartBreadUnits(parsed);

  let comment = String(parsed.comment || '').trim();

  if (!comment || comment.split(/\s+/).length < 12) {
    comment = getFallbackComment(language);
  }

  return {
    displayName: String(parsed.displayName || 'Food'),
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

Good examples in Russian:
- "Чипсы содержат много углеводов и жиров, поэтому сахар может подняться быстрее обычного. Лучше учитывать размер порции и проверить сахар через 1–2 часа."
- "Сладкое вино содержит сахар и может повысить уровень глюкозы. После алкоголя сахар иногда меняется позже, поэтому лучше проверить его через 1–2 часа."

Good examples in English:
- "Chips contain many carbohydrates and fats, so glucose may rise faster than expected. It is better to watch the portion size and check glucose after 1–2 hours."
- "Sweet wine contains sugar and may raise glucose levels. Alcohol can affect glucose later, so it is better to check it again after 1–2 hours."

Good examples in Latvian:
- "Čipsi satur daudz ogļhidrātu un tauku, tāpēc cukura līmenis var paaugstināties diezgan ātri. Labāk ņemt vērā porcijas lielumu un pārbaudīt cukuru pēc 1–2 stundām."
- "Saldais vīns satur cukuru un var paaugstināt glikozes līmeni. Alkohola ietekme var parādīties vēlāk, tāpēc labāk pārbaudīt cukuru pēc 1–2 stundām."
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
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