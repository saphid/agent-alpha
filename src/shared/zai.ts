// Z.AI API Client
// Z.AI provides OpenAI-compatible API endpoints

export class ZAIClient {
  private apiKey: string;
  private baseURL: string;

  constructor(apiKey: string, baseURL = "https://api.z.ai/v1") {
    this.apiKey = apiKey;
    this.baseURL = baseURL;
  }

  async chat(params: {
    messages: Array<{ role: string; content: string }>;
    model?: string;
    temperature?: number;
    max_tokens?: number;
  }): Promise<{ content: string }> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model || "gpt-4o-mini",
        messages: params.messages,
        temperature: params.temperature || 0.7,
        max_tokens: params.max_tokens || 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Z.AI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0]?.message?.content || "",
    };
  }
}
