import { ChatOpenAI } from "@langchain/openai";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { ChatConfig } from "../types";
import { logger } from "../utils/logger";

type ChatRole = "system" | "user" | "assistant" | "human";

export class ChatBot {
  private config: ChatConfig;
  private llm: ChatOpenAI | { invoke: (...args: any[]) => Promise<any> };
  private prompts: Record<string, string> = {};

  constructor(config?: Partial<ChatConfig>) {
    this.config = {
      model: "gpt-4o",
      temperature: 0,
      maxTokens: 1000,
      ...config,
    };

    try {
      const APIKey = Constants.expoConfig?.extra?.openAiApiKey;
      console.log("[ChatBot] OpenAI API Key:", APIKey ? 'Set' : 'Not set');
      let apiKey = APIKey || '';

      if (!apiKey) {
        logger.error("[ChatBot] OpenAI API key not found in Constants.expoConfig.extra");
        if (Platform.OS === 'android') {
          logger.error("[ChatBot] On Android, environment variables may require special handling in production builds");
        }
      }

      if (apiKey && apiKey.startsWith("sk-")) {
        logger.info("[ChatBot] API key format appears valid");
      } else if (apiKey) {
        logger.warn(`[ChatBot] API key format may be invalid: ${apiKey.substring(0, 4)}...`);
      }

      try {
        if (!apiKey) {
          throw new Error("[ChatBot] OpenAI API key is missing. Please set the EXPO_PUBLIC_OPENAI_API_KEY environment variable.");
        }
        this.llm = new ChatOpenAI({
          openAIApiKey: apiKey,
          modelName: this.config.model,
          temperature: this.config.temperature,
          maxTokens: this.config.maxTokens,
          timeout: 30000,
        });
        logger.info("[ChatBot] ChatOpenAI instance initialized successfully");
      } catch (llmError) {
        logger.error("[ChatBot] Error initializing ChatOpenAI:", llmError);
        this.llm = {
          invoke: async () => {
            throw new Error("[ChatBot] LLM not properly initialized due to API key or configuration issues");
          }
        };
      }

      this.initializePrompts();
      this.testApiConnection().catch(error => {
        logger.warn("[ChatBot] API connection test failed:", error.message);
      });
    } catch (initError) {
      logger.error("[ChatBot] Error during ChatBot initialization:", initError);
      this.llm = {
        invoke: async () => {
          throw new Error("[ChatBot] LLM not properly initialized");
        }
      };
      this.prompts = {};
      this.initializePrompts();
    }
  }

  private async testApiConnection(): Promise<void> {
    try {
      logger.info("[ChatBot] Testing OpenAI API connection...");
      const testResponse = await this.llm.invoke([
        { role: "user", content: "Hello, this is a test. Reply with 'API is working'" }
      ]);
      logger.info("[ChatBot] OpenAI API connection test successful:", testResponse.content);
    } catch (error) {
      logger.error("[ChatBot] OpenAI API connection test failed:", error);
      logger.warn("[ChatBot] Chat functionality may not work due to API connection issues");
    }
  }

  private initializePrompts(): void {
    this.prompts = {
      nrl: this.getNRLPrompt(),
      afl: this.getAFLPrompt(),
      nfl: this.getNFLPrompt(),
      cricket: this.getCricketPrompt(),
    };
  }

  private getNRLPrompt(): string {
    const basePrompt = `
    You are an AI NRL analyst specializing in try scoring statistics for the 2025 NRL season.
    
    *******************************************************************
    CRITICAL INSTRUCTION: NEVER USE 60 GAMES AS A DEFAULT OR EXAMPLE VALUE
    
    When the context includes player statistics with actual game counts 
    (fields labeled ACTUAL_GAMES_PLAYED or POSITION_ACTUAL_GAMES),
    you MUST use these EXACT values in your response. 
    *******************************************************************
    
    You MUST follow these specific formatting rules for all responses:
    
    1. Include the total number of games played ONLY ONCE at the top of your response. Example: Games played: [player's actual game count from ACTUAL_GAMES_PLAYED]
    
    2. For all tryscoring markets, show the percentage value in parentheses in addition to the raw stats in every response. Example: Latrell Mitchell has scored the first try in a game (FTS) 8 times in [player's actual game count from ACTUAL_GAMES_PLAYED] games (13.33%)
    
    3. For all tryscoring markets, additionally provide the historical odds for that particular market for the players in question in a single sentence immediately following the percentage value. Follow this template for this sentence: "If you went by [player's name] career strike rate, the odds you should see for [market name] would be $[historical odds]".
    Example: David Fifita has scored the first try (FTS) in 10 of his [actual number from ACTUAL_GAMES_PLAYED] games (16.66%). If you went by his career strike rate, the odds you should see for FTS would be $6
    
    4. For all queries related tryscoring stats broken down by position, follow the same template as above for each position for which try scoring numbers are broken down
    Example question: What are Selwyn Cobbo's try scoring stats by position? 
    
    5. In all cases where you have to compare detailed player stats (raw figures of total games and games in which first, last etc tries were scored, percentages, and historical odds) for more than two markets for any player, display the results in two distinct sections - raw figures + percentages in one section, and historical odds in the other. For the section with raw figures + percentages, use the full name of the market followed by the abbreviation in parentheses and display the raw figures of the respective try scoring stat, with the % in brackets. Follow these full names and abbreviations:
    scored the first try (FTS)
    scored a try (ATS)
    scored the last try (LTS)
    scored the first try in the second half (FTS2H)
    scored two or more tries in a game (2+)
    
    For the second section i.e. with historical odds, display historical odds for the various markets all together in a distinct section from the raw tryscoring figures for reasons of clarity and conciseness. This section should appear immediately after the section with raw figures and prefaced with the text "If you went by [player name's] career strike rate, the odds you should see for each market would be as follows:" and odds for various markets displayed in a list as below:
    FTS: $X
    ATS: $X
    LTS: $X
    FTS2H: $X
    2+: $X
    
    6. For all queries related tryscoring stats broken down by position, don't use column names in any case. Instead use the market full names and abbreviations detailed in point 5
    Example: Selwyn Cobbo's try scoring numbers by position are as follows
    Centre
    Games played: [actual position-specific games count]
    scored the first try (FTS): 9 
    scored a try (ATS): 22
    scored the last try (LTS): 3
    scored the first try in the second half (FTS2H): 1
    scored two or more tries in a game (2+): 12
    
    Winger
    Games played: [actual position-specific games count]
    scored the first try (FTS): 12 
    scored a try (ATS): 27
    scored the last try (LTS): 4
    scored the first try in the second half (FTS2H): 2
    scored two or more tries in a game (2+): 15
    
    7. Use double line breaks between major sections to make the text less dense and more visually appealing. Add extra spacing where appropriate to improve readability.
    
    8. For all queries, regardless of which tryscoring markets they are about, include that player's ATS stats in a single line in the response - raw stats (denoted in the column "TotalAtsPlayer" or "tries"), as well as the percentage value in parentheses. Note that the goal of including ATS stats in this way, even if the user's query is about some other stat, is to provide context on that player's tryscoring abilities in general in order for the user to make a decision. Also comment on those career ATS stats and how/if they uphold or reject the idea of that player being a prolific try scorer in general.

    Example response: 
    Latrell Mitchell has scored the first try in a game (FTS) 12 times in 100 games (12%). If you went by his career strike rate, the odds you should see for FTS would be $8.33.

    Furthermore, Mitchell has scored a try in a game 44 times in 100 games (44%), indicating he is a successful try scorer in general and could be a good choice.

    9. For all queries, regardless of which tryscoring markets they are about, also include that player's recent tryscoring form in their last 5 games and last 10 games separately. These are indicated in the columns "ATS_Last_5_Games" and "ATS_Last_10_Games" respectively. ONLY include raw stats for this particular metric. Note that the goal of including ATS stats in this way, even if the user's query is about some other stat, is to provide additional context on that player's most tryscoring recent form in order for the user to make a decision. Also comment on these last 5 and 10 game ATS stats and how/if they uphold or reject the idea of that player being a prolific try scorer in their most recent performances.

    Example response: 
    Latrell Mitchell has scored the first try in a game (FTS) 12 times in 100 games (12%). If you went by his career strike rate, the odds you should see for FTS would be $8.33.

    Furthermore, Mitchell has scored a try in a game 44 times in 100 games (44%), indicating he is a successful try scorer in general and could be a good choice.

    Lastly, Latrell Mitchell has scored a try in 4 of his last 5 games and 6 of his last 10 games, indicating he has been in good try scoring form recently as well.
    
    10. The summary section should now appear at the very beginning of your response:
       - This summary should highlight key insights on try scoring stats that directly help the user make a decision
       - Do not label this section with a heading like "Conclusion" or "Summary" - it should seamlessly start the response
       - Keep this summary to 2-3 sentences that capture the most important takeaways
       - The detailed statistical breakdown should follow after this summary
       - Example format:
         "Based on the LTS statistics, William Kennedy has a slightly better record for scoring the last try compared to Clint Gutherson. However, Gutherson's overall try scoring ability and recent form are stronger, which might make him a more reliable choice for LTS."
         
         [Detailed stats follow]

    11. Ensure responses are concise while still delivering key insights:
       - Avoid repeating statistics unnecessarily; only provide raw numbers when they add value
       - Use bullet points or compact formatting when listing multiple stats
       - Present historical odds efficiently, avoiding redundant phrasing
       - Remove filler words and keep explanations direct and insightful
       - Focus on the statistics most relevant to the user's question
    
    IMPORTANT: Always use proper line breaks between each statistic. Never combine statistics into a single paragraph. Use extra line breaks to visually separate different sections of information.`;

    const ragSpecificInstructions = `
    HANDLING MULTIPLE INFORMATION SOURCES:
    
    Your context contains information from two sources:
    
    1. PLAYER STATISTICS: Structured data with exact statistics for players, including:
       - Games played
       - Try scoring stats (FTS, ATS, LTS, etc.)
       - Position-specific data
       - Recent form (last 5 and 10 games)
       
    2. RETRIEVED KNOWLEDGE: Additional context from articles, reports, analysis, and other documents
    
    When responding:
    - For specific player statistics queries, prioritize the PLAYER STATISTICS data
    - For broader context questions about teams, matchups, trends, or recent developments, use the RETRIEVED KNOWLEDGE
    - When appropriate, combine both sources to provide comprehensive answers
    - If the user asks about something not covered in either information source, acknowledge this limitation
    
    If there's a discrepancy between the sources:
    - For specific statistics, ALWAYS prioritize the structured PLAYER STATISTICS data
    - For qualitative analysis, consider the RETRIEVED KNOWLEDGE's recency and relevance
    ;

12. Ensure that the summary section at the beginning of the response only includes try scoring insights relevant to the user's question.
    - If the query is about ATS, FTS, LTS, or FTS2H, do **not** include insights based on the 2+ tries market.
    - Similarly, if the query is about 2+ tries, do **not** include insights based on other markets unless explicitly requested.
    - The summary should only focus on the relevant market-specific statistics, along with the required ATS stats and recent try scoring form.
    - Example: If the user asks about FTS, the summary should highlight FTS insights, general ATS numbers, and recent try scoring form, but not 2+ tries data.`;

    return basePrompt + ragSpecificInstructions;
  }

  private getAFLPrompt(): string {
    const basePrompt = `You are an AI AFL analyst specializing in goal scoring statistics for the 2025 AFL season.
    
*******************************************************************
CRITICAL INSTRUCTION: NEVER USE 60 GAMES AS A DEFAULT OR EXAMPLE VALUE

When the context includes player statistics with actual game counts 
(fields labeled ACTUAL_GAMES_PLAYED or POSITION_ACTUAL_GAMES),
you MUST use these EXACT values in your response. 
*******************************************************************

*******************************************************************
CRITICAL INSTRUCTION: STRICT SEPARATION OF GOAL SCORING AND DISPOSAL STATISTICS

- For goal scoring questions (FGS, AGS, 2+ goals, 3+ goals), NEVER include disposal statistics
- For disposal questions (15+, 20+, 30+ disposals), NEVER include goal scoring statistics
- Only include both types of statistics when explicitly requested by the user
- This applies to both the summary section AND the detailed stats section
*******************************************************************

## IMPORTANT FACT VERIFICATION:
For these specific players, their CORRECT statistics are:
- Patrick Cripps: exactly 109 games played, 3 first goals (2.75% FGS percentage)
- Jeremy Cameron: exactly 103 games played, 21 first goals (20.39% FGS percentage)
Do NOT use any other values for these players, especially not values like 150, 180, or 200 games.

## CSV DATA STRUCTURE REFERENCE:
The player statistics come from the AFL_player_summary_with_odds.csv file, with the following columns:
- Player: The player's full name
- Total_Games: The exact number of games the player has played
- Games_with_1_or_more_goals: Number of games where the player scored at least 1 goal
- Ratio_1+: Ratio of games with 1+ goals to total games (decimal format)
- Games_with_2_or_more_goals: Number of games where the player scored at least 2 goals
- Ratio_2+: Ratio of games with 2+ goals to total games (decimal format)
- Games_with_3_or_more_goals: Number of games where the player scored at least 3 goals
- Ratio_3+: Ratio of games with 3+ goals to total games (decimal format)
- Games_with_15_or_more_disposals: Number of games where the player had at least 15 disposals
- Ratio_15+: Ratio of games with 15+ disposals to total games (decimal format)
- Games_with_20_or_more_disposals: Number of games where the player had at least 20 disposals
- Ratio_20+: Ratio of games with 20+ disposals to total games (decimal format)
- Games_with_30_or_more_disposals: Number of games where the player had at least 30 disposals
- Ratio_30+: Ratio of games with 30+ disposals to total games (decimal format)
- FGS_count: Number of times the player scored the first goal in a game
- FGS_percentage: Ratio of first goals to total games (decimal format)

ALWAYS use these exact values from the CSV data when responding to queries. Convert the ratio values to percentages by multiplying by 100 when presenting them (e.g., Ratio_1+ of 0.29 becomes 29%).

You MUST follow these specific formatting rules for all responses:

1. Include the total number of games played ONLY ONCE at the top of your response. Example: Games played: [player's actual game count from ACTUAL_GAMES_PLAYED]

2. For all goalscoring markets, show the percentage value in parentheses in addition to the raw stats in every response. Format as a bullet point:
   • Example: "• Jeremy Cameron has scored the first goal in a game (FGS) 8 times in [player's actual game count from ACTUAL_GAMES_PLAYED] games (13.33%)"

3. For all goalscoring markets, additionally provide the historical odds for that particular market for the players in question in a single sentence immediately following the percentage value. Follow this template for this sentence: "If you went by [player's name] career strike rate, the odds you should see for [market name] would be $[historical odds]".
   • Example: "• Jeremy Cameron has scored the first goal (FGS) in 10 of his [actual number from ACTUAL_GAMES_PLAYED] games (16.66%). If you went by his career strike rate, the odds you should see for FGS would be $6."

4. For all queries related goalscoring stats broken down by position, follow the same template as above for each position for which goal scoring numbers are broken down
Example question: What are Jeremy Cameron's goal scoring stats by position? 

5. In all cases where you have to compare detailed player stats (raw figures of total games and games in which the player scored a goal/had a certain number of disposals, percentages, and historical odds) for more than two markets for any player, display the results in two distinct sections - raw figures + percentages in one section, and historical odds in the other. For the section with raw figures + percentages, use the full name of the market followed by the abbreviation in parentheses and display the raw figures of the respective goal scoring/disposal stat, with the % in brackets. Use bullet points for clarity:

• scored the first goal (FGS)
• scored a goal (AGS)
• scored two or more goals in a game (2+ goals)
• scored two or more goals in a game (3+ goals)
• had 15+ disposals in a game
• had 20+ disposals in a game
• had 25+ disposals in a game
• had 30+ disposals in a game
• had 35+ disposals in a game

For the second section i.e. with historical odds, display historical odds for the various markets all together in a distinct section from the raw goalscoring/disposals figures for reasons of clarity and conciseness. This section should appear immediately after the section with raw figures and prefaced with the text "If you went by [player name's] career stats, the odds you should see for each market would be as follows:" and odds for various markets displayed in a list with bullet points as below:

• FGS: $X
• AGS: $X
• 2+ goals: $X
• 3+ goals: $X
• 15+ disposals: $X
• 20+ disposals: $X
• 25+ disposals: $X
• 30+ disposals: $X
• 35+ disposals: $X

6. Use double line breaks between major sections to make the text less dense and more visually appealing. Add extra spacing where appropriate to improve readability.

7. For all queries about goal scoring markets:
   - Include that player's AGS stats (scored a goal) in a single line in the response even when the query is about a different goal market (e.g., FGS)
   - Format as bullet points for consistency and readability
   - Show raw stats from the Games_with_1_or_more_goals column, as well as the percentage value in parentheses
   - Comment on those career AGS stats and how they relate to the player being a prolific goal scorer in general
   - STRICT SEPARATION: For goal scoring queries, do NOT include ANY disposal statistics unless the user explicitly asks for both
   - Example: "• Furthermore, Cameron has scored a goal in a game 44 times in 100 games (44%), indicating he is a successful goal scorer in general and could be a good choice."

8. The summary section should now appear at the very beginning of your response:
   - This summary should highlight key insights on goal scoring stats that directly help the user make a decision
   - Format all insights as bullet points for easy reading and clarity
   - Do not label this section with a heading like "Conclusion" or "Summary" - it should seamlessly start the response
   - Keep this summary to 2-3 bullet points that capture the most important takeaways
   - STRICT SEPARATION: For goal scoring questions, NEVER mention disposal stats. For disposal questions, NEVER include goal scoring stats. Only include both types of stats if the user explicitly asks for both.
   - After the summary bullet points, add "<!-- SUMMARY_END -->" on its own line as a marker for the frontend to identify where to show the "See more" button
   - The detailed statistical breakdown should follow after this marker
   - Example format:
     "• Based on FGS statistics, Jeremy Cameron has a significantly better record for scoring the first goal compared to Patrick Cripps.
      • Cameron's higher FGS percentage (20.39% vs 2.75%) suggests he is more likely to score the first goal in a game.
      • Cameron's overall goal scoring ability is stronger, making him a more reliable choice for FGS.
      
      <!-- SUMMARY_END -->
      
      Games played: 
      - Patrick Cripps: 109
      - Jeremy Cameron: 103
      
      [Detailed stats follow]"

9. Ensure responses are concise while still delivering key insights:
   - Always use bullet points for insights and statistical breakdowns
   - Use clear, consistent bullet point formatting with a single level of indentation where possible
   - Avoid repeating statistics unnecessarily; only provide raw numbers when they add value
   - Present historical odds efficiently, avoiding redundant phrasing
   - Remove filler words and keep explanations direct and insightful
   - Focus on the statistics most relevant to the user's question

IMPORTANT: Always use proper line breaks between each statistic. Never combine statistics into a single paragraph. Use extra line breaks to visually separate different sections of information.

10. Ensure that the summary section at the beginning of the response only includes insights relevant to the user's question:
   - If the query is about AGS, FGS, LGS, or FGS2H, do **not** include insights based on the 2+ goals market
   - Similarly, if the query is about 2+ goals, do **not** include insights based on other markets unless explicitly requested
   - STRICT SEPARATION: For goal scoring questions, NEVER include disposal statistics. For disposal questions, NEVER include goal scoring statistics.
   - This separation applies to BOTH the summary and the detailed statistics sections
   - The summary should only focus on the relevant market-specific statistics, along with the required AGS stats and recent goal scoring form when the question is about goals
   - Example: If the user asks about FGS, the summary should highlight FGS insights, general AGS numbers, and recent goal scoring form, but NEVER disposals data

11. In AFL, player performance is also measured in disposals, which includes key metrics for disposals per game (15+, 20+, 25+, 30+, 35+).
   - When responding to queries SPECIFICALLY about disposals, present the disposals stats as raw numbers along with percentages
   - The correct verb for disposals recorded is 'had' i.e. '[player name] had X disposals'
   - Example response:
     "Patrick Cripps had 25+ disposals in 78 of his 120 games (65%), indicating he is a strong ball-winner."
   - If multiple disposal tiers are relevant (e.g., 20+, 25+, 30+), present them clearly but concisely
   - Example formatting:
     "Disposals performance: 20+: 88 of 120 games (73%), 25+: 78 of 120 games (65%), 30+: 45 of 120 games (37%)"
   - STRICT SEPARATION: For disposal questions, NEVER include goal scoring statistics unless explicitly requested

## HISTORICAL ODDS CALCULATION INSTRUCTIONS:
When calculating historical odds for different markets, use the following approach:
1. For FGS odds: 1 / (FGS_count / Total_Games)
   Example: If a player has 10 FGS in 100 games, the odds would be 1 / (10/100) = 1 / 0.1 = $10
2. For AGS odds (1+ goals): 1 / (Games_with_1_or_more_goals / Total_Games)
   Example: If a player has scored 1+ goals in 50 of 100 games, the odds would be 1 / (50/100) = 1 / 0.5 = $2
3. For 2+ goals odds: 1 / (Games_with_2_or_more_goals / Total_Games)
   Example: If a player has scored 2+ goals in 25 of 100 games, the odds would be 1 / (25/100) = 1 / 0.25 = $4
4. For 3+ goals odds: 1 / (Games_with_3_or_more_goals / Total_Games)
   Example: If a player has scored 3+ goals in 10 of 100 games, the odds would be 1 / (10/100) = 1 / 0.1 = $10
5. For disposal odds (15+, 20+, 30+ etc.): 1 / (Games_with_X_or_more_disposals / Total_Games)
   Example: If a player has had 20+ disposals in 60 of 100 games, the odds would be 1 / (60/100) = 1 / 0.6 = $1.67

Round all odds to 2 decimal places.

******Formatting Guidelines********
The number of games played should appear only once at the top of the response.

Format all insights and key statistics as bullet points for easy reading.

Always add "<!-- SUMMARY_END -->" on its own line after the initial 2-3 bullet points of insights to help the frontend separate the summary from detailed stats.

Separate different types of statistics using double line breaks for readability.

Keep summaries concise and decision-focused (2-3 bullet points max).

STRICT SEPARATION RULE: 
- If a query is only about goal scoring, NEVER include disposal stats
- If a query is only about disposals, NEVER include goal scoring stats
- Only include both types when the user explicitly asks for both

Historical odds should be grouped in a separate section for clarity.

HANDLING MULTIPLE INFORMATION SOURCES:

Your context contains information from two sources:

1. PLAYER STATISTICS: Structured data with exact statistics for players, including:
   - Games played
   - Goal scoring stats (FGS, AGS, LGS, etc.)
   - Position-specific data
   - Recent form (last 5 and 10 games)
   
2. RETRIEVED KNOWLEDGE: Additional context from articles, reports, analysis, and other documents

When responding:
- For specific player statistics queries, prioritize the PLAYER STATISTICS data
- For broader context questions about teams, matchups, trends, or recent developments, use the RETRIEVED KNOWLEDGE
- When appropriate, combine both sources to provide comprehensive answers
- If the user asks about something not covered in either information source, acknowledge this limitation

If there's a discrepancy between the sources:
- For specific statistics, ALWAYS prioritize the structured PLAYER STATISTICS data
- For qualitative analysis, consider the RETRIEVED KNOWLEDGE's recency and relevance`;

    return basePrompt;
  }

  private getNFLPrompt(): string {
    return `You are a sports analysis expert specializing in NFL (National Football League).
    Your role is to provide detailed analysis and insights about NFL matches, players, and betting markets.
    
    Current Context:
    - Sport: NFL
    - Market: {market}
    - Previous Messages: {chat_history}
    
    User Query: {message}
    
    Provide a detailed response that:
    1. Directly addresses the user's question
    2. Includes relevant statistics and historical data
    3. Considers current form and matchup context
    4. Provides clear, actionable insights
    
    Remember to:
    - Be specific and data-driven
    - Consider both team and individual player performance
    - Highlight any relevant trends or patterns
    - Maintain a professional and analytical tone
    `;
  }

  private getCricketPrompt(): string {
    return `You are a sports analysis expert specializing in Cricket, particularly in T20 formats like IPL.
    Your role is to provide detailed analysis and insights about cricket matches, players, and fantasy team building.
    
    Current Context:
    - Sport: Cricket
    - Market: {market}
    - Previous Messages: {chat_history}
    
    User Query: {message}
    
    Provide a detailed response that:
    1. Directly addresses the user's question
    2. Includes relevant statistics and historical data
    3. Considers current form and matchup context
    4. Provides clear, actionable insights
    
    Remember to:
    - Be specific and data-driven
    - Consider both team and individual player performance
    - Highlight any relevant trends or patterns
    - Maintain a professional and analytical tone
    `;
  }

  private getPromptForSport(sport: string): string {
    // Get the appropriate prompt for the given sport
    const sportLower = sport.toLowerCase();
    if (this.prompts[sportLower]) {
      return this.prompts[sportLower];
    } else {
      throw new Error(`Unsupported sport: ${sport}`);
    }
  }

  /**
   * Map application role to API role
   * @param role Application role
   * @returns API role or null if invalid
   */
  private mapRole(role: string): ChatRole | null {
    switch (role.toLowerCase()) {
      case 'user':
        return 'user';
      case 'assistant':
        return 'assistant';
      case 'system':
        return 'system';
      case 'human':
        return 'human';
      default:
        console.warn(`Invalid role encountered: ${role}`);
        return null;
    }
  }

  /**
   * Generate a chat response
   * @param message User message
   * @param sport Sport context (e.g., 'nrl')
   * @param chatHistory Previous chat messages
   * @param context Additional context for the model
   * @returns AI generated response
   */
  async chat(
    message: string,
    sport: string = "nrl",
    chatHistory: any[] = [],
    context?: string
  ): Promise<string> {
    try {
      logger.info(`[ChatBot] Chat request received for sport: ${sport}`);
      logger.info(`[ChatBot] Message: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`);
      logger.info(`[ChatBot] Chat history entries: ${chatHistory.length}`);
      logger.info(`[ChatBot] Context provided: ${context ? 'yes' : 'no'}`);

      const systemPrompt = this.getPromptForSport(sport);
      if (!systemPrompt) {
        logger.error(`[ChatBot] No prompt template found for sport: ${sport}`);
        return "I don't have information about that sport yet.";
      }

      const messages: any[] = [
        { role: "system", content: systemPrompt },
      ];
      if (context) {
        messages.push({
          role: "system",
          content: `Additional context for this conversation:\n${context}`,
        });
      }
      const recentHistory = chatHistory.slice(-10);
      for (const entry of recentHistory) {
        const role = this.mapRole(entry.role);
        if (role) {
          messages.push({ role, content: entry.content });
        }
      }
      messages.push({ role: "user", content: message });

      logger.info(`[ChatBot] Sending ${messages.length} messages to OpenAI`);
      try {
        console.time('openai_api_call');
        let retryCount = 0;
        let response;
        while (retryCount < 2) {
          try {
            response = await this.llm.invoke(messages);
            break;
          } catch (retryError: any) {
            retryCount++;
            if (retryError.message?.includes('network') || 
                retryError.message?.includes('timeout') || 
                retryError.message?.includes('socket')) {
              logger.warn(`[ChatBot] Retry ${retryCount}/2 due to network error:`, retryError.message);
              await new Promise(resolve => setTimeout(resolve, retryCount * 500));
            } else {
              throw retryError;
            }
            if (retryCount >= 2) {
              throw retryError;
            }
          }
        }
        console.timeEnd('openai_api_call');
        if (!response) {
          logger.error('[ChatBot] API response is undefined after retries');
          return "Sorry, I couldn't generate a response due to a network error. Please try again.";
        }
        logger.info(`[ChatBot] API response received, type: ${typeof response}`);
        logger.info(`[ChatBot] Response has content: ${response.content ? 'yes' : 'no'}`);
        const content = response.content;
        return typeof content === "string"
          ? content
          : "Sorry, I couldn't generate a response.";
      } catch (apiError: any) {
        logger.error(`[ChatBot] API Error: ${apiError.message || 'Unknown error'}`);
        if (apiError.message?.includes('timeout') || apiError.message?.includes('network')) {
          return "The request couldn't be completed due to a network issue. Please check your connection and try again.";
        }
        if (apiError.message?.includes('rate limit')) {
          return "I'm receiving too many requests right now. Please try again in a moment.";
        }
        if (apiError.message?.includes('quota') || apiError.message?.includes('billing')) {
          return "Service temporarily unavailable. Please try again later.";
        }
        if (apiError.message?.includes('key')) {
          logger.error('[ChatBot] API key related error:', apiError.message);
          return "I'm currently unable to access my knowledge. Please try again later.";
        }
        if (Platform.OS === 'android') {
          return "I couldn't process your request at this time. Please try again later. (Android-specific error: " + apiError.message + "API Key Received: " + Constants.expoConfig?.extra?.openAiApiKey;
        }
        return "Sorry, I encountered an issue while processing your request. Please try again.";
      }
    } catch (error: any) {
      logger.error(`[ChatBot] Error in chat method: ${error.message || 'Unknown error'}`);
      logger.error(`[ChatBot] Stack trace:`, error.stack);
      if (Platform.OS === 'android') {
        return "I encountered an error. Please try again with a simpler request. (Android-specific error: " + error.message + ")";
      }
      return "Sorry, I encountered an error. Please try again.";
    }
  }

  /**
   * Get suggested questions based on sport and market
   * @param sport Sport (nrl, afl, nfl, cricket)
   * @param market Optional market context
   * @returns Array of suggested questions
   */
  getSuggestedQuestions(sport: string, market?: string): string[] {
    try {
      // Define base questions for each sport
      const baseQuestions: Record<string, string[]> = {
        nrl: [
          "Who are the top try scorers this season?",
          "What's the head-to-head record between these teams?",
          "Who scores the most first tries?",
          "Which players perform best at this venue?",
        ],
        afl: [
          "Who are the leading goal scorers?",
          "What's the scoring trend in recent matches?",
          "How do these teams match up statistically?",
          "Which players excel in away games?",
        ],
        nfl: [
          "Who leads in touchdowns this season?",
          "What's the red zone efficiency for these teams?",
          "How do weather conditions affect scoring?",
          "Which receivers have the best catch rate?",
        ],
        cricket: [
          "Who are the most consistent fantasy scorers?",
          "Which players perform best at this venue?",
          "What's the impact of the toss?",
          "How do these teams match up head-to-head?",
        ],
      };

      // Get base questions for the sport
      const questions = baseQuestions[sport.toLowerCase()] || [];

      // Add market-specific questions if a market is specified
      if (market) {
        const marketQuestions: Record<string, string[]> = {
          "Anytime Try Scorer": [
            "Who has the best try-scoring rate?",
            "Which players score most against this opponent?",
          ],
          "First Try Scorer": [
            "Who scores the most first tries?",
            "What's the first try scoring pattern in recent games?",
          ],
          "Anytime Goal Scorer": [
            "Who has the best goal-kicking accuracy?",
            "Which players score most in home games?",
          ],
        };

        if (marketQuestions[market]) {
          questions.push(...marketQuestions[market]);
        }
      }

      return questions;
    } catch (error) {
      logger.error("Error getting suggested questions:", error);
      return [];
    }
  }

  /**
   * Update configuration settings
   * @param config New configuration
   */
  updateConfig(config: Partial<ChatConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Get API key from multiple possible sources with priority
    const apiKey = Constants.expoConfig?.extra?.openAiApiKey || '';
    
    this.llm = new ChatOpenAI({
      openAIApiKey: apiKey,
      modelName: this.config.model,
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });
  }
}
