const { GoogleGenerativeAI } = require('@google/generative-ai');

// In-memory session history storage
// Storing as array of { role: 'user' | 'assistant', content: string }
const chatHistories = {};

function getMessageHistory(sessionId) {
  if (!chatHistories[sessionId]) {
    chatHistories[sessionId] = [];
  }
  return chatHistories[sessionId];
}

async function streamAIChatResponse({ message, productContext, sessionId, onToken, onError, relevantProducts = [] }) {
  try {
    const history = getMessageHistory(sessionId);

    // Keep history from growing indefinitely (keep last 10 turns = 20 messages)
    if (history.length > 20) {
      history.splice(0, history.length - 20);
    }

    const systemPrompt = `You are an AI shopping assistant for an e-commerce website.
Your role is to help customers find products, answer questions about products, and provide recommendations.

Guidelines:
- Be friendly, helpful, and concise
- If product information is available in the context, use it to answer questions
- Provide specific product names, prices, and details when relevant
- If asked about products not in the context, politely say you don't have that information
- Suggest related products when appropriate
- Format prices with dollar signs
${productContext}`;

    // Add user message to history
    history.push({ role: 'user', content: message });

    const groqKey = process.env.GROQ_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    let fullReply = '';
    let success = false;

    // Helper function to call Gemini
    async function callGemini() {
      console.log('🤖 Routing chat request to Gemini...');
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
        systemInstruction: systemPrompt
      });

      // Convert history to Gemini format (role: 'user' | 'model')
      const geminiHistory = history.slice(0, -1).map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }]
      }));

      const chat = model.startChat({
        history: geminiHistory,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 512,
        }
      });

      const result = await chat.sendMessageStream(message);

      for await (const chunk of result.stream) {
        const token = chunk.text();
        if (token) {
          fullReply += token;
          onToken(token);
        }
      }
    }

    // 1. Try Groq or Grok (xAI) if configured
    if (groqKey) {
      try {
        if (groqKey.startsWith('xai-')) {
          console.log('🤖 Routing chat request to xAI (Grok)...');
          const messages = [
            { role: 'system', content: systemPrompt },
            ...history
          ];

          const response = await fetch('https://api.x.ai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
              model: 'grok-2-1212',
              messages,
              temperature: 0.7,
              stream: true
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`xAI API returned status ${response.status}: ${errText}`);
          }

          const decoder = new TextDecoder();
          let buffer = '';

          for await (const chunk of response.body) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine || cleanLine === 'data: [DONE]') continue;

              if (cleanLine.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(cleanLine.slice(6));
                  const token = parsed.choices?.[0]?.delta?.content || '';
                  if (token) {
                    fullReply += token;
                    onToken(token);
                  }
                } catch (err) {
                  // Ignore partial JSON parsing errors
                }
              }
            }
          }
          success = true;
        } else if (groqKey.startsWith('gsk_') || groqKey.length > 20) {
          console.log('🤖 Routing chat request to Groq...');
          const messages = [
            { role: 'system', content: systemPrompt },
            ...history
          ];

          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages,
              temperature: 0.7,
              max_tokens: 512,
              stream: true
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Groq API returned status ${response.status}: ${errText}`);
          }

          const decoder = new TextDecoder();
          let buffer = '';

          for await (const chunk of response.body) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
              const cleanLine = line.trim();
              if (!cleanLine || cleanLine === 'data: [DONE]') continue;

              if (cleanLine.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(cleanLine.slice(6));
                  const token = parsed.choices?.[0]?.delta?.content || '';
                  if (token) {
                    fullReply += token;
                    onToken(token);
                  }
                } catch (err) {
                  // Ignore partial JSON parsing errors
                }
              }
            }
          }
          success = true;
        }
      } catch (groqError) {
        console.warn('⚠️ Groq/Grok chat failed:', groqError.message);
        if (geminiKey) {
          console.log('🔄 Falling back to Gemini API...');
          try {
            await callGemini();
            success = true;
          } catch (geminiError) {
            console.warn('⚠️ Gemini fallback failed:', geminiError.message);
          }
        }
      }
    }

    // 2. If Groq was not run or not configured, but Gemini is available
    if (!success && geminiKey) {
      try {
        await callGemini();
        success = true;
      } catch (geminiError) {
        console.warn('⚠️ Gemini chat failed:', geminiError.message);
      }
    }

    // 3. Last Resort Fallback: Local Offline Rule-Based Mode
    if (!success) {
      console.log('🤖 Routing chat request to local offline mock helper...');
      let mockReply = '';
      if (relevantProducts && relevantProducts.length > 0) {
        mockReply = `I'm currently running in offline assistant mode. I found these matching products from our store catalog for you:\n\n` +
          relevantProducts.map(p => `- **${p.name}** ($${p.price}): ${p.description}`).join('\n') +
          `\n\nWhich of these would you like to know more about?`;
      } else {
        mockReply = `I'm currently running in offline assistant mode. I couldn't find any direct matches in our catalog for your search, but you can try asking about specific items like Laptops, Wireless Headphones, or pillows!`;
      }

      // Stream the mock reply chunk by chunk to make it feel natural
      const words = mockReply.split(' ');
      for (const word of words) {
        onToken(word + ' ');
        await new Promise(resolve => setTimeout(resolve, 30)); // 30ms typing speed
      }
      fullReply = mockReply;
      success = true;
    }

    // Save reply to history
    history.push({ role: 'assistant', content: fullReply });
    return fullReply;
  } catch (error) {
    console.error('Critical error in streamAIChatResponse:', error);
    onError(error);
  }
}

module.exports = {
  streamAIChatResponse,
  getMessageHistory
};
