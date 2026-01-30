import { PriceData } from './oracleAPI';

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface BorrowAnalysis {
  riskLevel: 'low' | 'medium' | 'high';
  recommendation: string;
  insights: string[];
  warnings: string[];
  suggestedCollateralRatio: number;
}

class GeminiAIService {
  private conversationHistory: ChatMessage[] = [];
  private priceContext: PriceData[] = [];

  updatePriceContext(prices: PriceData[]) {
    this.priceContext = prices;
  }

  private formatPriceContext(): string {
    if (this.priceContext.length === 0) return 'No price data available.';

    return this.priceContext.map(p => {
      const token = p.pair.split('/')[0];
      const change24h = p.twap?.deviation24h ? `${p.twap.deviation24h > 0 ? '+' : ''}${p.twap.deviation24h.toFixed(2)}%` : 'N/A';
      return `${token}: $${p.price.toFixed(2)} (24h: ${change24h}, Sources: ${p.sourceCount})`;
    }).join('\n');
  }

  async chat(userMessage: string): Promise<string> {
    if (!GEMINI_API_KEY) {
      return this.getFallbackResponse(userMessage);
    }

    const systemContext = `You are an AI assistant for Aleo Oracle, a privacy-preserving DeFi lending protocol on Aleo blockchain.
You help users understand:
- How to borrow against collateral (users deposit ETH/BTC/ALEO and borrow USD)
- Managing positions and collateral ratios (minimum 150% required)
- Understanding price feeds and oracle data
- The staking system where operators stake to submit price data and earn rewards
- Privacy features of Aleo (zero-knowledge proofs, private records)

Current Live Prices:
${this.formatPriceContext()}

Key Protocol Rules:
- Minimum collateral ratio: 150%
- Liquidation threshold: 125%
- Liquidation bonus: 5%
- Prices are aggregated from 10+ exchanges with cryptographic signatures

Be helpful, concise, and always prioritize user safety. Warn about risks when appropriate.`;

    // Build conversation with history for multi-turn context
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    // First message includes system context
    contents.push({
      role: 'user',
      parts: [{ text: systemContext + '\n\nPlease acknowledge you understand and are ready to help.' }]
    });
    contents.push({
      role: 'model',
      parts: [{ text: 'I understand. I\'m the Aleo Oracle AI assistant, ready to help with borrowing, staking, price feeds, and privacy features. How can I help you?' }]
    });

    // Add recent conversation history (last 10 messages for context window)
    const recentHistory = this.conversationHistory.slice(-10);
    for (const msg of recentHistory) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      });
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error('Gemini API error:', response.status, errorData);
        return this.getFallbackResponse(userMessage);
      }

      const data = await response.json();
      const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I could not generate a response.';

      // Store in history
      this.conversationHistory.push(
        { role: 'user', content: userMessage, timestamp: Date.now() },
        { role: 'assistant', content: assistantMessage, timestamp: Date.now() }
      );

      return assistantMessage;
    } catch (error) {
      console.error('Gemini API error:', error);
      return this.getFallbackResponse(userMessage);
    }
  }

  private getFallbackResponse(userMessage: string): string {
    const lower = userMessage.toLowerCase();

    if (lower.includes('borrow')) {
      return 'To borrow on Aleo Oracle:\n1. Connect your Aleo wallet\n2. Go to the Borrow page\n3. Select collateral token (ETH, BTC, ALEO, etc.)\n4. Enter collateral amount and desired borrow amount\n5. Maintain at least 150% collateral ratio\n\nYour position is stored privately using zero-knowledge proofs.';
    }
    if (lower.includes('stake') || lower.includes('staking')) {
      return 'To stake on Aleo Oracle:\n1. Connect your wallet\n2. Go to the Stake page\n3. Enter minimum 1,000 ALEO credits\n4. Earn ~8.5% APY for submitting accurate prices\n\nUnbonding period is 7 days. Maximum slashing risk is 10%.';
    }
    if (lower.includes('liquidat')) {
      return 'Liquidation occurs when your collateral ratio falls below 125%. The liquidator receives a 5% bonus. To avoid liquidation:\n- Maintain ratio above 150% (200%+ recommended)\n- Monitor prices regularly\n- Add more collateral if ratio drops';
    }
    if (lower.includes('price') || lower.includes('oracle')) {
      const priceInfo = this.formatPriceContext();
      return `Current prices from our oracle:\n${priceInfo}\n\nPrices are aggregated from 10+ exchanges with cryptographic Schnorr signatures and TWAP calculations.`;
    }
    if (lower.includes('privacy') || lower.includes('zk') || lower.includes('zero')) {
      return 'Aleo Oracle uses zero-knowledge proofs for privacy:\n- Positions are stored as private records\n- Only you can see your collateral and debt\n- The blockchain only sees encrypted proofs\n- Price verification happens on-chain without revealing position details';
    }

    return 'I can help with borrowing, staking, price feeds, liquidation risks, and Aleo privacy features. What would you like to know?';
  }

  async analyzeBorrow(
    collateralToken: string,
    collateralAmount: number,
    borrowAmount: number
  ): Promise<BorrowAnalysis> {
    const price = this.priceContext.find(p => p.pair.startsWith(collateralToken));
    if (!price) {
      return {
        riskLevel: 'high',
        recommendation: 'Unable to analyze - price data not available',
        insights: [],
        warnings: ['Price data not found for this token'],
        suggestedCollateralRatio: 200,
      };
    }

    const collateralValue = collateralAmount * price.price;
    const currentRatio = (collateralValue / borrowAmount) * 100;
    const change24h = price.twap?.deviation24h || 0;

    const prompt = `Analyze this DeFi borrow position:
- Collateral: ${collateralAmount} ${collateralToken} worth $${collateralValue.toFixed(2)}
- Borrow Amount: $${borrowAmount}
- Current Collateral Ratio: ${currentRatio.toFixed(1)}%
- ${collateralToken} 24h Price Change: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%
- Minimum Required Ratio: 150%
- Liquidation Threshold: 125%

Provide a JSON response with this exact structure (no markdown, just JSON):
{
  "riskLevel": "low" or "medium" or "high",
  "recommendation": "brief recommendation",
  "insights": ["insight1", "insight2"],
  "warnings": ["warning1 if any"],
  "suggestedCollateralRatio": number
}`;

    try {
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
        }),
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Try to parse JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          riskLevel: parsed.riskLevel || (currentRatio < 160 ? 'high' : currentRatio < 180 ? 'medium' : 'low'),
          recommendation: parsed.recommendation || 'Consider maintaining a higher collateral ratio for safety.',
          insights: parsed.insights || [],
          warnings: parsed.warnings || [],
          suggestedCollateralRatio: parsed.suggestedCollateralRatio || 200,
        };
      }
    } catch (error) {
      console.error('Analysis error:', error);
    }

    // Fallback analysis
    return {
      riskLevel: currentRatio < 160 ? 'high' : currentRatio < 180 ? 'medium' : 'low',
      recommendation: currentRatio < 160
        ? 'Your position is at high risk. Consider adding more collateral.'
        : currentRatio < 180
        ? 'Moderate risk. Monitor your position closely.'
        : 'Your position appears healthy. Keep monitoring market conditions.',
      insights: [
        `Current ratio: ${currentRatio.toFixed(1)}%`,
        `24h price change: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`,
      ],
      warnings: currentRatio < 170 ? ['Position close to liquidation threshold'] : [],
      suggestedCollateralRatio: 200,
    };
  }

  getHistory(): ChatMessage[] {
    return this.conversationHistory;
  }

  clearHistory() {
    this.conversationHistory = [];
  }
}

export const geminiAI = new GeminiAIService();
