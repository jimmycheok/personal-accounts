import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

class OcrService {
  async extractReceiptData(filePath) {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const mimeType = filePath.match(/\.(jpg|jpeg)$/i) ? 'image/jpeg'
      : filePath.match(/\.png$/i) ? 'image/png'
      : filePath.match(/\.gif$/i) ? 'image/gif'
      : 'image/webp';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this Malaysian receipt/invoice image and extract the following information as JSON.
              Return ONLY a valid JSON object with these exact fields:
              {
                "vendor": "store/company name (string)",
                "amount": total amount as number (number),
                "currency": "currency code, usually MYR (string)",
                "date": "date in YYYY-MM-DD format (string or null)",
                "category_suggestion": "one of: Food & Beverage, Transportation, Office Supplies, Utilities, Professional Services, Entertainment, Accommodation, Medical, Other (string)",
                "confidence": confidence percentage 0-100 (number),
                "raw_text": "key text found on receipt (string)",
                "items": array of line items if visible [{description, amount}] or empty array
              }
              If you cannot determine a value, use null. For Malaysian receipts, default currency to MYR.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
            },
          ],
        },
      ],
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error('No OCR response from GPT-4o');

    const parsed = JSON.parse(content);

    return {
      vendor: parsed.vendor || null,
      amount: parsed.amount ? parseFloat(parsed.amount) : null,
      currency: parsed.currency || 'MYR',
      date: parsed.date || null,
      category_suggestion: parsed.category_suggestion || 'Other',
      confidence: parsed.confidence || 0,
      raw_text: parsed.raw_text || '',
      items: parsed.items || [],
    };
  }
}

export default new OcrService();
