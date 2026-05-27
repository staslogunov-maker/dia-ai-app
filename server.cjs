require('dotenv').config();
      return res.status(400).json({
        error: 'No description',
      });
    }

    const userLanguage = String(language || 'en').slice(0, 5);
    const answerLanguage = languageName(userLanguage);

    const prompt = `
You analyze manually corrected food descriptions for a diabetes diary app.

The user corrected the AI photo recognition manually.

VERY IMPORTANT:
The user app language is: ${answerLanguage}

Return ONLY valid JSON.

Format:
{
  "displayName": "food name",
  "calories": 0,
  "breadUnits": 0,
  "protein": 0,
  "fat": 0,
  "carbs": 0,
  "comment": "helpful diabetes comment"
}

Corrected user food description:
"${String(description).trim()}"
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content:
            `You are a food nutrition assistant. Always answer in ${answerLanguage}. Return strict JSON only.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.choices?.[0]?.message?.content || '';
    const parsed = extractJson(content);

    if (!parsed) {
      return res.status(500).json({
        error: 'Could not parse AI response',
      });
    }

    const result = normalizeResult(parsed, userLanguage);

    return res.json(result);
  } catch (error) {
    console.error('RECALCULATE ERROR:', error?.message || error);

    return res.status(500).json({
      error: error?.message || 'Server error',
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AI SERVER STARTED ON ${PORT}`);
});