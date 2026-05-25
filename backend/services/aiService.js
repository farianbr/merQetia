const OpenAI = require('openai');

// Lazily initialize so the app runs fine even without AI credentials
let openaiClient = null;

const getClient = () => {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_KEY,
      baseURL: process.env.AI_URL || 'https://api.openai.com/v1',
    });
  }
  return openaiClient;
};

/**
 * Generate a concise order summary using AI.
 *
 * @param {Array}  services - Populated service documents
 * @param {Object} answers  - { "<serviceId>": { "question": "answer" } }
 * @returns {string|null}   - Summary text, or null if AI is disabled / fails
 */
const generateOrderSummary = async (services, answers) => {
  // Respect the toggle — default to disabled if not explicitly set to "true"
  if (process.env.AI_SUMMARY_ENABLED !== 'true') return null;

  try {
    const lines = [];

    for (const service of services) {
      lines.push(`Service: ${service.name} (${service.department})`);
      const serviceAnswers = answers[service._id.toString()] || {};
      for (const [question, answer] of Object.entries(serviceAnswers)) {
        lines.push(`  Q: ${question}`);
        lines.push(`  A: ${answer}`);
      }
    }

    const context = lines.join('\n');

    const response = await getClient().chat.completions.create({
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional project brief writer for a freelance agency. ' +
            'Given a list of ordered services and client answers, write a concise 2-3 sentence ' +
            'summary of what the client needs. Be clear and professional.',
        },
        {
          role: 'user',
          content: `Client order details:\n\n${context}`,
        },
      ],
      max_tokens: 200,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    // AI failure is non-critical — log and continue without summary
    console.error('[AI Summary] Failed to generate summary:', err.message);
    return null;
  }
};

module.exports = { generateOrderSummary };
