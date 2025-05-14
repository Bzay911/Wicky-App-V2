import { OpenAI } from "openai";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Alert } from "react-native";

// Import the JSON data
const nrlUpcomingMatchups = require("../assets/NRL_Upcoming_Matchup.json");
const nrlCoScoringSummaries = require("../assets/NRL_Co_Scoring_Summaries.json");
const nrlTryscorersInDefeats = require("../assets/NRL_Tryscorers_in_Defeats.json");
const nrlHomeAwayTrycorers = require("../assets/NRL_Home_Away_Trycorers.json");

// Add AFL data imports
const aflUpcomingMatchups = require("../assets/AFL_Upcoming_Matchup.json");
const aflCoScoringSummaries = require("../assets/AFL_Co_Scoring_Summaries.json");
const aflGoalscorersInDefeats = require("../assets/AFL_Goalscorers_in_Defeats.json");
const aflHomeAwayGoalscorers = require("../assets/AFL_Home_Away_Goalscorers.json");

// Use consistent naming convention with uppercase
const EXPO_PUBLIC_OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || "";

if (!EXPO_PUBLIC_OPENAI_API_KEY) {
  console.error(
    "OpenAI API key is not set. Please check your environment variables."
  );
}

console.log(
  "API Key status:",
  EXPO_PUBLIC_OPENAI_API_KEY ? "Present" : "Missing"
);

// Types
interface MatchupData {
  "Team Name"?: string;
  Matchup?: string;
  "Player Name"?: string;
  Team?: string;
  matchup?: string;
  Player?: string;
  Position?: string;
}

interface CoScorerData {
  primary_player: string;
  co_scorer: string;
  co_scoring_rate: number;
  primary_total_scored: number;
  primary_scoring_rate: number;
}

interface LossScorerData {
  player_id: string;
  total_loss_games: number;
  loss_games_with_tries: number;
  full_name: string;
  loss_try_percentage: number;
}

interface HomeAwayScorerData {
  full_name: string;
  team_name?: string;
  home_games: number;
  away_games: number;
  home_games_with_try: number;
  away_games_with_try: number;
  home_try_percentage: number;
  away_try_percentage: number;
}

interface Recommendation {
  name: string;
  percentage: number;
  home_games?: number;
  total_loss_games?: number;
}

interface AnalysisResult {
  sport: string;
  player: string;
  matchup: string;
  winner: string;
  oppositeTeam: string;
  homeTeam: string;
  initialLegsCount: number;
  predefinedSelections: {
    name: string;
    type: string;
    description: string;
    leg: number;
  }[];
  co_scorers: {
    title: string;
    stat_name: string;
    recommendations: Recommendation[];
  };
  loss_scorers: {
    title: string;
    stat_name: string;
    recommendations: Recommendation[];
  };
  home_scorers: {
    title: string;
    stat_name: string;
    recommendations: Recommendation[];
  };
}

interface MultiBuilderContextType {
  isLoading: boolean;
  isInitialized: boolean;
  sports: string[];
  selectedSport: string;
  setSelectedSport: (sport: string) => void;
  matchups: string[];
  players: Record<string, string[]>;
  fetchMatchups: (sport: string) => Promise<void>;
  fetchPlayers: (sport: string, matchup: string) => Promise<void>;
  analyzeMultiBuilder: (
    sport: string,
    matchup: string,
    player: string,
    winner: string
  ) => Promise<AnalysisResult>;
}

const MultiBuilderContext = createContext<MultiBuilderContextType | undefined>(
  undefined
);

export const useMultiBuilder = () => {
  const context = useContext(MultiBuilderContext);
  if (!context) {
    throw new Error(
      "useMultiBuilder must be used within a MultiBuilderProvider"
    );
  }
  return context;
};

interface MultiBuilderProviderProps {
  children: ReactNode;
}

export const MultiBuilderProvider: React.FC<MultiBuilderProviderProps> = ({
  children,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [sports] = useState<string[]>(["nrl", "afl"]); // Include both NRL and AFL
  const [selectedSport, setSelectedSport] = useState<string>("nrl");
  const [matchups, setMatchups] = useState<string[]>([]);
  const [players, setPlayers] = useState<Record<string, string[]>>({});
  const [embeddingsCache, setEmbeddingsCache] = useState<
    Record<string, number[]>
  >({});
  const [apiKeyAvailable, setApiKeyAvailable] = useState(false);

  // Initialize OpenAI client with the key provided explicitly
  const openai = new OpenAI({
    apiKey: EXPO_PUBLIC_OPENAI_API_KEY, // Explicitly provide the key here
    dangerouslyAllowBrowser: true,
  });

  // Initialize data
  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    setIsLoading(true);
    try {
      // Pre-fetch matchups for the selected sport
      await fetchMatchups(selectedSport);
      setIsInitialized(true);
    } catch (error) {
      console.error("Error initializing data:", error);
      Alert.alert(
        "Error",
        `Failed to initialize ${selectedSport.toUpperCase()} data`
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch matchups for the selected sport
  const fetchMatchups = async (sport: string) => {
    setIsLoading(true);
    try {
      // Extract unique matchups from the upcoming matchups data
      const uniqueMatchups = new Set<string>();

      // Get the appropriate data based on sport
      const matchupsData =
        sport === "nrl" ? nrlUpcomingMatchups : aflUpcomingMatchups;

      if (matchupsData && Array.isArray(matchupsData)) {
        // Process based on the actual structure of the JSON file
        matchupsData.forEach((match: MatchupData) => {
          // Handle different field names between NRL and AFL data
          const matchupValue = match.Matchup || match.matchup;
          if (matchupValue) {
            uniqueMatchups.add(matchupValue);
          }
        });

        const matchupArray = Array.from(uniqueMatchups);
        console.log(
          `Loaded ${matchupArray.length} matchups for ${sport}:`,
          matchupArray
        );
        setMatchups(matchupArray);
      } else {
        console.error(
          `${sport.toUpperCase()} matchups data is not valid:`,
          matchupsData
        );
        // Fallback to dummy data
        if (sport === "nrl") {
          setMatchups([
            "Broncos vs Storm",
            "Panthers vs Rabbitohs",
            "Roosters vs Sea Eagles",
            "Raiders vs Knights",
            "Cowboys vs Sharks",
          ]);
        } else {
          // AFL
          setMatchups([
            "Collingwood vs Carlton",
            "Geelong vs Melbourne",
            "Gold Coast vs Adelaide",
            "Richmond vs Brisbane Lions",
            "GWS vs West Coast",
          ]);
        }
      }
    } catch (error) {
      console.error("Error fetching matchups:", error);
      Alert.alert("Error", `Failed to fetch ${sport.toUpperCase()} matchups`);

      // Fallback to dummy data on error
      if (sport === "nrl") {
        setMatchups([
          "Broncos vs Storm",
          "Panthers vs Rabbitohs",
          "Roosters vs Sea Eagles",
        ]);
      } else {
        // AFL
        setMatchups([
          "Collingwood vs Carlton",
          "Geelong vs Melbourne",
          "Gold Coast vs Adelaide",
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch players for a specific matchup
  const fetchPlayers = async (sport: string, matchup: string) => {
    setIsLoading(true);
    try {
      const teams = matchup.split(" vs ");
      const result: Record<string, string[]> = {};

      // Get the appropriate data based on sport
      const matchupsData =
        sport === "nrl" ? nrlUpcomingMatchups : aflUpcomingMatchups;

      // Debug log for matchup teams
      console.log(
        `Fetching players for teams: ${teams.join(", ")} in ${sport}`
      );

      // Get players for each team from the matchups data
      teams.forEach((team) => {
        // Filter players by team
        const teamPlayers = matchupsData
          .filter((match: MatchupData) => {
            // Handle different field names between NRL and AFL data
            const teamName = sport === "nrl" ? match["Team Name"] : match.Team;
            return teamName === team;
          })
          .map((match: MatchupData) => {
            // Handle different field names between NRL and AFL data
            return sport === "nrl" ? match["Player Name"] : match.Player;
          })
          .filter(Boolean); // Remove any undefined values

        // Log the players found
        console.log(`Found ${teamPlayers.length} players for ${team}`);

        // Remove duplicates
        result[team] = Array.from(new Set(teamPlayers));
      });

      console.log(`Loaded players for ${sport} matchup ${matchup}:`, result);
      setPlayers(result);
    } catch (error) {
      console.error("Error fetching players:", error);
      Alert.alert("Error", `Failed to fetch ${sport.toUpperCase()} players`);
    } finally {
      setIsLoading(false);
    }
  };

  // New function to get embeddings from OpenAI
  const getEmbedding = async (text: string): Promise<number[]> => {
    // Check cache first
    if (embeddingsCache[text]) {
      return embeddingsCache[text];
    }

    // Return empty embedding if API key is missing
    if (!EXPO_PUBLIC_OPENAI_API_KEY) {
      console.warn("Skipping embedding request - API key not available");
      return [];
    }

    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text,
        encoding_format: "float",
      });

      const embedding = response.data[0].embedding;

      // Cache the result
      setEmbeddingsCache((prev) => ({
        ...prev,
        [text]: embedding,
      }));

      return embedding;
    } catch (error) {
      console.error("Error getting embedding:", error);
      return []; // Return empty array on error
    }
  };

  // Function to calculate cosine similarity between two vectors
  const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
    if (vecA.length === 0 || vecB.length === 0 || vecA.length !== vecB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  };

  // Modified getDynamicCoScorers to return 5 recommendations
  const getDynamicCoScorers = async (
    player: string,
    team: string,
    upcomingPlayers: string[] = []
  ): Promise<Recommendation[]> => {
    try {
      const recommendations: Recommendation[] = [];

      // Get the appropriate data based on sport
      const coScoringSummaries =
        selectedSport === "nrl" ? nrlCoScoringSummaries : aflCoScoringSummaries;
      const matchupsData =
        selectedSport === "nrl" ? nrlUpcomingMatchups : aflUpcomingMatchups;

      console.log(
        `Getting co-scorers for ${player} (${team}) in sport: ${selectedSport}`
      );

      // First attempt: Use co-scoring summaries
      if (coScoringSummaries && coScoringSummaries.length > 0) {
        // Find entries where the selected player is the primary player
        // Use more flexible matching to match Python's behavior
        const playerCoScorers = coScoringSummaries
          .filter((data: CoScorerData) => {
            const nameMatch =
              data.primary_player
                .toLowerCase()
                .includes(player.toLowerCase()) ||
              player.toLowerCase().includes(data.primary_player.toLowerCase());
            return nameMatch;
          })
          .sort(
            (a: CoScorerData, b: CoScorerData) =>
              b.co_scoring_rate - a.co_scoring_rate
          );

        console.log(`Found ${playerCoScorers.length} co-scorers for ${player}`);

        if (playerCoScorers.length > 0) {
          // Take top 5 co-scorers
          const topCoScorers = playerCoScorers.slice(0, 5);

          // Filter by upcoming players if available
          const filteredCoScorers =
            upcomingPlayers.length > 0
              ? topCoScorers.filter((data: CoScorerData) =>
                  upcomingPlayers.some(
                    (p) =>
                      p.toLowerCase().includes(data.co_scorer.toLowerCase()) ||
                      data.co_scorer.toLowerCase().includes(p.toLowerCase())
                  )
                )
              : topCoScorers;

          // Convert to recommendations
          for (const scorer of filteredCoScorers) {
            recommendations.push({
              name: scorer.co_scorer,
              percentage: Math.round(scorer.co_scoring_rate * 10) / 10, // Convert to percentage
            });
          }

          if (recommendations.length > 0) {
            // Limit to 5 recommendations
            return recommendations.slice(0, 5);
          }
        }
      }

      // AI-powered similarity search if we don't have direct co-scorer data
      if (recommendations.length < 5) {
        try {
          // Create a query about the player's scoring patterns - using appropriate term based on sport
          const scoringTerm = selectedSport === "nrl" ? "tries" : "goals";
          const query = `Players who score ${scoringTerm} when ${player} from ${team} scores`;

          // Get embedding for the query
          const queryEmbedding = await getEmbedding(query);

          if (queryEmbedding.length > 0) {
            // Create player descriptions and get embeddings for each
            const playerEmbeddings: {
              player: string;
              embedding: number[];
              similarity: number;
            }[] = [];

            // Process in batches to avoid rate limits
            const batchSize = 5;
            for (let i = 0; i < upcomingPlayers.length; i += batchSize) {
              const batch = upcomingPlayers.slice(i, i + batchSize);

              // Process batch in parallel
              const batchResults = await Promise.all(
                batch.map(async (p) => {
                  if (p === player) return null; // Skip the selected player

                  // Use appropriate term based on sport
                  const description = `${p} is a player for ${team} who scores ${scoringTerm}`;
                  const embedding = await getEmbedding(description);

                  if (embedding.length > 0) {
                    const similarity = cosineSimilarity(
                      queryEmbedding,
                      embedding
                    );
                    return { player: p, embedding, similarity };
                  }
                  return null;
                })
              );

              // Add valid results to playerEmbeddings
              batchResults.forEach((result) => {
                if (result) playerEmbeddings.push(result);
              });
            }

            // Sort by similarity and take top players
            playerEmbeddings.sort((a, b) => b.similarity - a.similarity);
            const remainingSlots = 5 - recommendations.length;
            const topSimilar = playerEmbeddings.slice(0, remainingSlots);

            // Convert to recommendations
            for (let i = 0; i < topSimilar.length; i++) {
              const { player: playerName, similarity } = topSimilar[i];

              // Convert similarity to percentage (scale from 0.5-1.0 to 40-70%)
              const percentage = Math.round((similarity * 30 + 40) * 10) / 10;

              recommendations.push({
                name: playerName,
                percentage: Math.min(Math.max(percentage, 40), 70), // Clamp between 40-70%
              });
            }

            if (recommendations.length > 0) {
              // Limit to 5 recommendations
              return recommendations.slice(0, 5);
            }
          }
        } catch (error) {
          console.error("Error in AI similarity search:", error);
          // Continue to fallback methods
        }
      }

      // If we still don't have enough recommendations, use team data
      if (recommendations.length < 5) {
        // Get players from the team
        const teamPlayers = matchupsData
          .filter((match: MatchupData) => {
            const teamName =
              selectedSport === "nrl" ? match["Team Name"] : match.Team;
            return teamName === team;
          })
          .map((match: MatchupData) => {
            return selectedSport === "nrl"
              ? match["Player Name"]
              : match.Player;
          })
          .filter((p: string) => p !== player); // Exclude the selected player

        // Remove duplicates
        const uniqueTeamPlayers = Array.from(new Set(teamPlayers));

        console.log(
          `Using fallback: Found ${uniqueTeamPlayers.length} potential co-scorers from team`
        );

        // Add players (up to 5 total)
        const numToAdd = Math.max(0, 5 - recommendations.length);
        for (let i = 0; i < Math.min(numToAdd, uniqueTeamPlayers.length); i++) {
          // Generate a realistic percentage
          const baseRate = 40.0;
          const variation = Math.random() * 10 - 5;
          const decay = i * 5;

          recommendations.push({
            name: uniqueTeamPlayers[i] as string,
            percentage: Math.round((baseRate - decay + variation) * 10) / 10,
          });
        }
      }

      // Final limit to ensure we never return more than 5 recommendations
      return recommendations.slice(0, 5);
    } catch (error) {
      console.error("Error getting co-scorers:", error);
      return [];
    }
  };

  // Function to get loss scorers - modified to return 3 recommendations
  const getLossScorers = (
    oppositeTeam: string,
    upcomingPlayers: string[] = []
  ): Recommendation[] => {
    try {
      const recommendations: Recommendation[] = [];

      // Get the appropriate data based on sport
      const matchupsData =
        selectedSport === "nrl" ? nrlUpcomingMatchups : aflUpcomingMatchups;
      const defeatsScorerData =
        selectedSport === "nrl"
          ? nrlTryscorersInDefeats
          : aflGoalscorersInDefeats;

      // Get players from the opposite team using matchups data
      const oppositeTeamPlayers = new Set(
        matchupsData
          .filter((match: MatchupData) => {
            const teamName =
              selectedSport === "nrl" ? match["Team Name"] : match.Team;
            return teamName === oppositeTeam;
          })
          .map((match: MatchupData) => {
            return selectedSport === "nrl"
              ? match["Player Name"]
              : match.Player;
          })
      );

      console.log(
        `Found ${oppositeTeamPlayers.size} players in opposite team: ${oppositeTeam}`
      );

      // Use loss scorers data
      if (defeatsScorerData) {
        // Filter for players in the opposite team and sort by loss percentage
        const teamLossScorers = defeatsScorerData
          .filter((data: any) => {
            // Check if the player is in the opposite team's upcoming players
            const playerKey = selectedSport === "nrl" ? "full_name" : "Player";
            const playerName = data[playerKey];
            const inOppositeTeam =
              playerName && oppositeTeamPlayers.has(playerName);
            const hasLossGames =
              selectedSport === "nrl"
                ? data.total_loss_games > 0
                : parseFloat(String(data.Total_Defeats)) > 0;

            return inOppositeTeam && hasLossGames;
          })
          .sort((a: any, b: any) => {
            // Sort by loss percentage (descending)
            const percentageKey =
              selectedSport === "nrl" ? "loss_try_percentage" : "Percentage";
            const percentageA = parseFloat(
              String(a[percentageKey]).replace("%", "")
            );
            const percentageB = parseFloat(
              String(b[percentageKey]).replace("%", "")
            );
            return percentageB - percentageA;
          });

        console.log(
          `Found ${teamLossScorers.length} loss scorers for ${oppositeTeam}`
        );

        if (teamLossScorers.length > 0) {
          // Take top 3 loss scorers
          const topLossScorers = teamLossScorers.slice(0, 3);

          // Filter by upcoming players if available
          const filteredLossScorers =
            upcomingPlayers.length > 0
              ? topLossScorers.filter((scorer: any) => {
                  const playerKey =
                    selectedSport === "nrl" ? "full_name" : "Player";
                  return upcomingPlayers.includes(scorer[playerKey]);
                })
              : topLossScorers;

          // Convert to recommendations
          for (const scorer of filteredLossScorers) {
            const playerKey = selectedSport === "nrl" ? "full_name" : "Player";
            const percentageKey =
              selectedSport === "nrl" ? "loss_try_percentage" : "Percentage";
            const totalGamesKey =
              selectedSport === "nrl" ? "total_loss_games" : "Total_Defeats";

            let percentage = scorer[percentageKey];
            if (typeof percentage === "string") {
              percentage = parseFloat(percentage.replace("%", ""));
            }

            recommendations.push({
              name: scorer[playerKey],
              percentage: percentage,
              total_loss_games: parseFloat(String(scorer[totalGamesKey])),
            });
          }

          if (recommendations.length > 0) {
            return recommendations.slice(0, 3); // Ensure max 3 recommendations
          }
        }
      }

      // Fallback: Use players from matchups data if we don't have enough recommendations
      if (recommendations.length < 3) {
        // We already have oppositeTeamPlayers, convert to array and filter out existing recommendations
        const remainingPlayers = Array.from(
          oppositeTeamPlayers as Set<string>
        ).filter(
          (player: string) =>
            !recommendations.some((rec) => rec.name === player)
        );

        // Add enough players to reach 3 recommendations
        const numToAdd = Math.max(0, 3 - recommendations.length);
        for (let i = 0; i < Math.min(numToAdd, remainingPlayers.length); i++) {
          // Generate a realistic percentage
          const baseRate = 40.0;
          const variation = Math.random() * 10 - 5;
          const decay = i * 5;

          recommendations.push({
            name: remainingPlayers[i] as string,
            percentage: Math.round((baseRate - decay + variation) * 10) / 10,
            total_loss_games: Math.floor(Math.random() * 10) + 5,
          });
        }
      }

      // Limit to 3 recommendations
      return recommendations.slice(0, 3);
    } catch (error) {
      console.error("Error getting loss scorers:", error);
      return [];
    }
  };

  // Function to get home scorers - modified to return 3 recommendations
  const getHomeScorers = (
    matchup: string,
    winner: string,
    upcomingPlayers: string[] = [],
    player: string = ""
  ): Recommendation[] => {
    try {
      const recommendations: Recommendation[] = [];

      // Get the home team (first team in the matchup)
      const teams = matchup.split(" vs ");
      const homeTeam = teams[0]; // First team is always the home team

      // Get the appropriate data based on sport
      const matchupsData =
        selectedSport === "nrl" ? nrlUpcomingMatchups : aflUpcomingMatchups;
      const homeAwayData =
        selectedSport === "nrl" ? nrlHomeAwayTrycorers : aflHomeAwayGoalscorers;

      console.log(
        `Getting home scorers for ${homeTeam} in sport: ${selectedSport}`
      );

      // First attempt: Use home/away data
      if (homeAwayData) {
        // Get players from the HOME team (not winner team)
        const homeTeamPlayers = matchupsData
          ? new Set(
              matchupsData
                .filter((match: MatchupData) => {
                  const teamName =
                    selectedSport === "nrl" ? match["Team Name"] : match.Team;
                  return teamName === homeTeam;
                })
                .map((match: MatchupData) => {
                  return selectedSport === "nrl"
                    ? match["Player Name"]
                    : match.Player;
                })
            )
          : new Set<string>();

        console.log(
          `Found ${homeTeamPlayers.size} players in home team: ${homeTeam}`
        );

        // Step 2: Filter home/away data for players in the HOME team
        const playerKey = selectedSport === "nrl" ? "full_name" : "Player";
        let filteredHome =
          homeTeamPlayers.size > 0
            ? homeAwayData.filter((data: any) =>
                homeTeamPlayers.has(data[playerKey])
              )
            : homeAwayData;

        console.log(
          `Found ${filteredHome.length} home scorers in data for ${homeTeam}`
        );

        // Step 3: Exclude the selected player
        if (player) {
          filteredHome = filteredHome.filter(
            (data: any) => data[playerKey] !== player
          );
        }

        // Step 4: Sort by home percentage in descending order
        const percentageKey =
          selectedSport === "nrl" ? "home_try_percentage" : "Home_Percentage";
        filteredHome = filteredHome.sort((a: any, b: any) => {
          let percentageA = a[percentageKey];
          let percentageB = b[percentageKey];

          if (typeof percentageA === "string") {
            percentageA = parseFloat(percentageA.replace("%", ""));
          }
          if (typeof percentageB === "string") {
            percentageB = parseFloat(percentageB.replace("%", ""));
          }

          return percentageB - percentageA;
        });

        // Step 5: Get top 3 players (changed from 5 to 3)
        const topHomeScorers = filteredHome.slice(0, 3);

        // Step 6: Format the recommendations
        for (const scorer of topHomeScorers) {
          const homeGamesKey =
            selectedSport === "nrl" ? "home_games" : "Home_Games";
          let percentage = scorer[percentageKey];

          if (typeof percentage === "string") {
            percentage = parseFloat(percentage.replace("%", ""));
          }

          recommendations.push({
            name: scorer[playerKey],
            percentage: percentage,
            home_games: parseFloat(String(scorer[homeGamesKey] || 0)),
          });
        }

        // Step 7: Filter by upcoming players if available
        if (upcomingPlayers && upcomingPlayers.length > 0) {
          const originalCount = recommendations.length;
          const filteredRecommendations = recommendations.filter((rec) =>
            upcomingPlayers.includes(rec.name)
          );

          // Only use filtered recommendations if we have at least one
          if (filteredRecommendations.length > 0) {
            return filteredRecommendations.slice(0, 3); // Ensure max 3 recommendations
          } else {
            // IMPROVED FALLBACK: Find players that are both in the home team and upcoming matchups
            const commonPlayers = Array.from(
              homeTeamPlayers as Set<string>
            ).filter((player: string) => upcomingPlayers.includes(player));

            if (commonPlayers.length > 0) {
              // Add up to 3 players from the home team as fallback
              for (let i = 0; i < Math.min(3, commonPlayers.length); i++) {
                const playerName = commonPlayers[i];

                // Try to find home stats for this player
                const playerData = homeAwayData.find(
                  (data: any) => data[playerKey] === playerName
                );

                if (playerData) {
                  // Use actual stats if available
                  const homeGamesKey =
                    selectedSport === "nrl" ? "home_games" : "Home_Games";
                  let percentage = playerData[percentageKey];

                  if (typeof percentage === "string") {
                    percentage = parseFloat(percentage.replace("%", ""));
                  }

                  recommendations.push({
                    name: playerName as string,
                    percentage: percentage,
                    home_games: parseFloat(
                      String(playerData[homeGamesKey] || 0)
                    ),
                  });
                } else {
                  // Generate realistic stats if not available
                  recommendations.push({
                    name: playerName as string,
                    percentage:
                      Math.round((50 - i * 5 + (Math.random() * 10 - 5)) * 10) /
                      10,
                    home_games: Math.floor(Math.random() * 10) + 5,
                  });
                }
              }

              return recommendations.slice(0, 3); // Ensure max 3 recommendations
            }
          }
        }
      }

      return recommendations.slice(0, 3); // Ensure max 3 recommendations
    } catch (error) {
      console.error("Error getting home scorers:", error);
      return [];
    }
  };

  // Helper function to ensure all numeric values are properly converted to JavaScript native types
  const convertToNativeTypes = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => convertToNativeTypes(item));
    }

    if (typeof obj === "object") {
      const result: Record<string, any> = {};
      for (const key in obj) {
        result[key] = convertToNativeTypes(obj[key]);
      }
      return result;
    }

    // Convert string numbers to actual numbers
    if (typeof obj === "string" && !isNaN(Number(obj))) {
      return Number(obj);
    }

    return obj;
  };

  // Add a function to ensure unique recommendations across categories (matching Python's _ensure_unique_recommendations)
  const ensureUniqueRecommendations = (
    result: AnalysisResult
  ): AnalysisResult => {
    // Get all players from co_scorers
    const coScorerPlayers = new Set(
      result.co_scorers.recommendations.map((rec) => rec.name)
    );

    // Remove any duplicates from home_scorers
    if (result.home_scorers && result.home_scorers.recommendations) {
      const originalCount = result.home_scorers.recommendations.length;
      result.home_scorers.recommendations =
        result.home_scorers.recommendations.filter(
          (rec) => !coScorerPlayers.has(rec.name)
        );
      const removedCount =
        originalCount - result.home_scorers.recommendations.length;
      if (removedCount > 0) {
        console.log(
          `Removed ${removedCount} duplicate players from home_scorers`
        );
      }
    }

    // Get updated list of all players from co_scorers and home_scorers
    const allPlayers = new Set([
      ...Array.from(coScorerPlayers),
      ...(result.home_scorers?.recommendations?.map((rec) => rec.name) || []),
    ]);

    // Remove any duplicates from loss_scorers
    if (result.loss_scorers && result.loss_scorers.recommendations) {
      const originalCount = result.loss_scorers.recommendations.length;
      result.loss_scorers.recommendations =
        result.loss_scorers.recommendations.filter(
          (rec) => !allPlayers.has(rec.name)
        );
      const removedCount =
        originalCount - result.loss_scorers.recommendations.length;
      if (removedCount > 0) {
        console.log(
          `Removed ${removedCount} duplicate players from loss_scorers`
        );
      }
    }

    return result;
  };

  // Update the main analysis function to include winner and lock as first two legs
  const analyzeMultiBuilder = async (
    sport: string,
    matchup: string,
    player: string,
    winner: string
  ): Promise<AnalysisResult> => {
    setIsLoading(true);
    try {
      const teams = matchup.split(" vs ");
      const oppositeTeam = teams[0] === winner ? teams[1] : teams[0];
      const homeTeam = teams[0]; // First team is always the home team

      console.log(
        `Analyzing ${sport} multi: ${matchup}, lock: ${player}, winner: ${winner}`
      );

      // Get all players in the matchup
      const allMatchupPlayers = [...Object.values(players)].flat();

      // Get recommendations using the real data and AI-powered search
      const coScorers = await getDynamicCoScorers(
        player,
        winner,
        allMatchupPlayers
      );
      const lossScorers = getLossScorers(oppositeTeam, allMatchupPlayers);
      // Pass matchup to getHomeScorers to extract home team
      const homeScorers = getHomeScorers(
        matchup,
        winner,
        allMatchupPlayers,
        player
      );

      // Remove the selected player from all recommendations
      const filterPlayer = (recs: Recommendation[]) =>
        recs.filter((r) => r.name !== player);

      // Determine the scoring term based on sport
      const scoringTerm =
        sport.toLowerCase() === "nrl"
          ? "Try"
          : sport.toLowerCase() === "afl"
          ? "Goal"
          : "Touchdown";
      const scoringTermLower = scoringTerm.toLowerCase();
      const scoringTermPlural =
        sport.toLowerCase() === "nrl"
          ? "tries"
          : sport.toLowerCase() === "afl"
          ? "goals"
          : "touchdowns";

      // Simulate loading for better UX
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Create the result object with additional metadata (matching multi_builder1.py)
      let result = {
        sport: sport,
        player: player,
        matchup: matchup,
        winner: winner,
        oppositeTeam: oppositeTeam,
        homeTeam: homeTeam,
        // Include initial legs count to indicate winner and lock are already legs 1 and 2
        initialLegsCount: 2,
        // Add winner and lock as predefined selections
        predefinedSelections: [
          {
            name: winner,
            type: "winner",
            description: `${winner} to win`,
            leg: 1,
          },
          {
            name: player,
            type: "lock",
            description: `${player} to score a ${scoringTermLower}`,
            leg: 2,
          },
        ],
        co_scorers: {
          title: `These are the most common ${scoringTermLower} scorers when your lock scores (${winner}):`,
          stat_name: "Co-scoring rate",
          recommendations: filterPlayer(coScorers),
        },
        loss_scorers: {
          title: `Top ${scoringTermLower} scorers in losses (${oppositeTeam})`,
          stat_name: `Loss ${scoringTermLower} percentage`,
          recommendations: filterPlayer(lossScorers),
        },
        home_scorers: {
          title: `Top ${scoringTermLower} scorers at home (${homeTeam})`,
          stat_name: `Home ${scoringTermLower} percentage`,
          recommendations: filterPlayer(homeScorers),
        },
      };

      // Ensure unique recommendations across categories (matching Python's _ensure_unique_recommendations)
      result = ensureUniqueRecommendations(result) as Required<AnalysisResult>;

      // Convert all numeric values to native types
      return convertToNativeTypes(result) as AnalysisResult;
    } catch (error) {
      console.error("Error analyzing multi:", error);
      Alert.alert("Error", "Failed to analyze multi bet");
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const value = {
    isLoading,
    isInitialized,
    sports,
    selectedSport,
    setSelectedSport,
    matchups,
    players,
    fetchMatchups,
    fetchPlayers,
    analyzeMultiBuilder,
  };

  useEffect(() => {
    console.log("Environment variables status:");
    console.log(
      `EXPO_PUBLIC_OPENAI_API_KEY: ${
        process.env.EXPO_PUBLIC_OPENAI_API_KEY ? "Set" : "Not set"
      }`
    );

    // Safely log first and last chars of key if it exists
    if (process.env.EXPO_PUBLIC_OPENAI_API_KEY) {
      const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
      console.log(
        `Key preview: ${key.substring(0, 3)}...${key.substring(key.length - 3)}`
      );
    }
  }, []);

  return (
    <MultiBuilderContext.Provider value={value}>
      {children}
    </MultiBuilderContext.Provider>
  );
};

export default MultiBuilderProvider;
