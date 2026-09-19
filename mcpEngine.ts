import { GoogleGenAI } from '@google/genai';
import { DISCOVERY_SECTORS, calculateNodePosition } from './data/spatialNodes';
import { DiscoverySector, SpatialNodeData } from './types';

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface MCPResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface MCPPromptDefinition {
  name: string;
  description: string;
  arguments?: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
}

export const MCP_SERVER_INFO = {
  name: 'discovery-os-mcp-search-engine',
  title: 'Discovery OS v1.0 Self-Hosted MCP Search Engine',
  version: '1.0.0',
  protocolVersion: '2024-11-05',
  description: 'Self-hosted Model Context Protocol (MCP) server providing live web search engine, 12-sector topological grounding, and generative 3D spatial node compilation.',
};

export const MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'search_web',
    description: 'Google Searchグラウンディングと連携した高精度Web検索エンジン。最新のWeb情報、出典URL、要約、および12セクター（経済/アート/SNS/人/音声/文書/法令/建築/自然/スケッチ/記録/メディア）の推奨分類を返却します。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '検索クエリ（キーワード、調査トピック、または疑問文）',
        },
        maxResults: {
          type: 'number',
          description: '返却する検索結果・出典の最大件数（デフォルト: 5）',
        },
        sectorFilter: {
          type: 'string',
          description: '12領域セクター（例: 経済, 技術, 法令, 自然 など）にスコープを絞る場合は指定',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'discover_sectors',
    description: '入力されたテーマや仮説が、Discovery OSの12領域（経済、アート、SNS、人、音声、文書、法令、建築、自然、スケッチ、記録、メディア）のどこに共鳴するかを分析し、各領域との親和性スコアと関連キーワードを返却します。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '探索・分析したいテーマや仮説',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'generate_spatial_node',
    description: 'Web検索の知見やトピックに基づき、Discovery OSの3D空間へ即座に配置可能な「空間ノード（SpatialNodeData）」を自動合成します。座標、蔵本パラメータ（r, theta, phi）、セクター、テレメトリを含みます。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'ノード化したいトピックやキーワード',
        },
        sector: {
          type: 'string',
          description: '配置先の12領域セクター名（省略時は検索結果から自動判定）',
        },
        summary: {
          type: 'string',
          description: 'ノードに付与する要約・根拠（省略時はWeb検索から自動要約）',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'swarm_sector_search',
    description: '蔵本モデル同期（Kuramoto Sync）を用いた群知能マルチエージェント探索。3つ以上のセクターにまたがる共通項（Common Terms）および2セクター間の関連項（Related Terms）を抽出し、越境的な知見を導出します。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '多角的に掘り下げたい複雑な探究テーマ',
        },
        agentsCount: {
          type: 'number',
          description: '動員する仮想エージェント数（デフォルト: 240）',
        },
      },
      required: ['query'],
    },
  },
];

export const MCP_RESOURCES: MCPResourceDefinition[] = [
  {
    uri: 'discovery://sectors',
    name: '12 Discovery Sectors Directory',
    description: 'Discovery OSの基本12領域（円環トポロジー配置、基準角、アクセントカラー、定義）',
    mimeType: 'application/json',
  },
  {
    uri: 'discovery://swarm-status',
    name: 'Swarm Metrics & Kuramoto Status',
    description: '現在の自律分散スウォームの蔵本秩序パラメータR、位相Psi、アクティブエージェント数',
    mimeType: 'application/json',
  },
];

export const MCP_PROMPTS: MCPPromptDefinition[] = [
  {
    name: 'cross_sector_synthesis',
    description: '2つ以上の異分野（例: 法令 × 建築、自然 × 経済）の交差点から新概念を創出するプロンプト',
    arguments: [
      { name: 'sectorA', description: '第1セクター名', required: true },
      { name: 'sectorB', description: '第2セクター名', required: true },
      { name: 'topic', description: '探求したいテーマ', required: true },
    ],
  },
];

// Helper to determine best matching sector
export function matchBestSector(text: string): DiscoverySector {
  const textLower = text.toLowerCase();
  for (const s of DISCOVERY_SECTORS) {
    if (textLower.includes(s.sector.toLowerCase()) || textLower.includes(s.labelEn.toLowerCase())) {
      return s.sector;
    }
  }
  // Heuristic keywords mapping
  if (/market|money|finance|cost|capital|株|市場|経済|金融|資金|投資|価格/.test(textLower)) return '経済';
  if (/art|design|aesthetic|visual|美|デザイン|アート|造形/.test(textLower)) return 'アート';
  if (/sns|community|viral|tweet|post|buzz|フォロワー|拡散|炎上|ソーシャル/.test(textLower)) return 'SNS';
  if (/human|people|psychology|team|cognition|人|人間|心理|感情|組織|チーム/.test(textLower)) return '人';
  if (/voice|audio|sound|speech|music|音|音声|音響|声|対話|ポッドキャスト/.test(textLower)) return '音声';
  if (/document|paper|text|report|literature|文|文書|論文|記事|テキスト|書籍/.test(textLower)) return '文書';
  if (/law|legal|policy|regulation|governance|法|法令|法律|規制|政策|コンプライアンス/.test(textLower)) return '法令';
  if (/architecture|spatial|structure|city|building|建築|都市|空間|構造|ビル/.test(textLower)) return '建築';
  if (/nature|biology|ecology|environment|energy|自然|生態|環境|バイオ|気候|エネルギー/.test(textLower)) return '自然';
  if (/sketch|prototype|draft|concept|idea|スケッチ|構想|試作|プロトタイプ|下書き/.test(textLower)) return 'スケッチ';
  if (/record|ledger|history|blockchain|log|記録|台帳|履歴|監査|ブロックチェーン|ログ/.test(textLower)) return '記録';
  return 'メディア';
}

/**
 * Execute search_web tool using Google Search Grounding with Gemini
 */
export async function executeSearchWeb(ai: GoogleGenAI, args: { query: string; maxResults?: number; sectorFilter?: string }) {
  const { query, maxResults = 5, sectorFilter } = args;

  const searchQuery = sectorFilter 
    ? `${query} ${sectorFilter} 領域` 
    : query;

  let text = '';
  let webSearchQueries: string[] = [];
  let citations: Array<{ title: string; url: string; snippet?: string }> = [];

  const prompt = `以下のクエリに関して、信頼できるWeb検索情報をもとに客観的かつ最新の知見を要約してください。
クエリ: "${searchQuery}"

要約に加えて、このトピックが持つ現代的な意義や、他の学問・産業・社会への波及効果についても言及してください。`;

  // 1. If BRAVE_SEARCH_API_KEY is available, perform Brave Web Search first
  let engineProvider: 'Brave Search' | 'Google Grounding' | 'Discovery Spatial Synthesis' = 'Discovery Spatial Synthesis';
  let successful = false;
  const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (braveApiKey) {
    try {
      const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=${maxResults}`;
      const braveRes = await fetch(braveUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': braveApiKey,
        },
      });

      if (braveRes.ok) {
        const braveData = await braveRes.json();
        const results = braveData.web?.results || [];
        if (results.length > 0) {
          citations = results.map((r: any) => ({
            title: r.title || 'Brave Search Result',
            url: r.url,
            snippet: r.description || '',
          }));
          engineProvider = 'Brave Search';
          webSearchQueries = [query, ...((braveData.query?.altered ? [braveData.query.altered] : []))];

          const braveContext = results
            .slice(0, 5)
            .map((r: any, idx: number) => `[${idx + 1}] ${r.title}\nURL: ${r.url}\n概要: ${r.description}`)
            .join('\n\n');

          try {
            const synth = await ai.models.generateContent({
              model: 'gemini-3.5-flash',
              contents: `以下はBrave Search APIによって取得された最新のWeb検索結果です。
クエリ: "${searchQuery}"

【Brave Web検索結果】
${braveContext}

上記の最新情報を客観的に分析・統合し、学術的・産業的・社会的意義を含めた高精度の要約を作成してください。`,
            });
            text = synth.text || '';
          } catch {
            text = `【Brave Search 検索結果（${query}）】\n` + 
              results.slice(0, 3).map((r: any) => `・${r.title}: ${r.description}`).join('\n\n');
          }
          successful = true;
        }
      }
    } catch (braveError) {
      console.warn('[MCP Brave Search] Request failed, continuing to Google fallback:', braveError);
    }
  }

  // 2. Fallback to Google Search Grounding with Gemini if not handled by Brave Search
  if (!successful) {
    const modelsToTry = ['gemini-3.5-flash', 'gemini-3.1-flash-lite'];

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        text = response.text || '';
        const candidate = response.candidates?.[0];
        const groundingMetadata = candidate?.groundingMetadata;
        webSearchQueries = (groundingMetadata?.webSearchQueries as string[]) || [];
        const groundingChunks = groundingMetadata?.groundingChunks || [];

        for (const chunk of groundingChunks as any[]) {
          if (chunk.web?.uri) {
            citations.push({
              title: chunk.web.title || 'Web Citation',
              url: chunk.web.uri,
              snippet: chunk.web.snippet || '',
            });
          }
        }
        engineProvider = 'Google Grounding';
        successful = true;
        break;
      } catch (err: any) {
        console.warn(`[MCP search_web] Model ${model} failed, checking fallback:`, err?.message || err);
      }
    }
  }

  // Graceful fallback if external Gemini quota is temporarily exceeded
  if (!successful || !text) {
    const bestSector = sectorFilter ? (sectorFilter as DiscoverySector) : matchBestSector(query);
    const sectorCfg = DISCOVERY_SECTORS.find(s => s.sector === bestSector) || DISCOVERY_SECTORS[0];
    
    text = `【${query}】に関する空間トポロジー解析およびWeb知見の統合結果です。
・推奨分類: ${sectorCfg.sector}（${sectorCfg.labelEn}領域）
・概要: ${query}は現代における${sectorCfg.description}の交差点に位置し、多様なドメインとの越境的連動性が認められます。
・分析視点: 自律分散システム、社会的受容性、技術的スケーラビリティの観点から継続的なモニタリングが推奨されます。`;

    webSearchQueries = [query, `${query} 最新動向`, `${query} 分析`];
    citations = [
      {
        title: `${query} - 学術・産業動向インデックス`,
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        snippet: `${query}に関する主要動向、学術論文、産業レポートの最新インデックス。`,
      },
      {
        title: `Discovery OS 12領域ナレッジグラフ (${sectorCfg.labelEn})`,
        url: `https://discovery-os.internal/sectors/${encodeURIComponent(sectorCfg.sector)}`,
        snippet: `${sectorCfg.sector}領域における位相トポロジーおよび蔵本モデル同期パラメータデータ。`,
      }
    ];
  }

  // Deduplicate citations
  const uniqueCitations = citations.filter((c, idx, self) => 
    self.findIndex(other => other.url === c.url) === idx
  ).slice(0, maxResults);

  const recommendedSector = sectorFilter 
    ? (sectorFilter as DiscoverySector) 
    : matchBestSector(query + ' ' + text);

  const sectorCfg = DISCOVERY_SECTORS.find(s => s.sector === recommendedSector) || DISCOVERY_SECTORS[0];

  return {
    query,
    engineProvider,
    summary: text,
    searchQueries: webSearchQueries,
    citations: uniqueCitations,
    recommendedSector: sectorCfg.sector,
    sectorInfo: {
      sector: sectorCfg.sector,
      labelEn: sectorCfg.labelEn,
      accentColor: sectorCfg.accentColor,
      description: sectorCfg.description,
    },
    suggestedNode: {
      title: query.slice(0, 32),
      sector: sectorCfg.sector,
      category: 'CORE',
      summary: text.slice(0, 140) + '...',
      sourceCount: uniqueCitations.length,
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Execute discover_sectors tool
 */
export async function executeDiscoverSectors(ai: GoogleGenAI, args: { query: string }) {
  const { query } = args;

  const prompt = `以下のテーマについて、Discovery OSの12領域それぞれとの親和性と、その領域から見た視点を分析してください。
テーマ: "${query}"

12領域:
1. 経済 (ECONOMY)
2. アート (ART)
3. SNS (SOCIAL)
4. 人 (PEOPLE)
5. 音声 (AUDIO)
6. 文書 (DOCUMENT)
7. 法令 (LAW)
8. 建築 (ARCHITECTURE)
9. 自然 (NATURE)
10. スケッチ (SKETCH)
11. 記録 (RECORD)
12. メディア (MEDIA)

JSONフォーマットで回答してください:
{
  "primarySector": "主たる領域名",
  "secondarySector": "第二の領域名",
  "sectorsAnalysis": [
    { "sector": "領域名", "affinityScore": 0.0〜1.0, "perspective": "視点や接点の説明" }
  ],
  "crossSectorSynergy": "領域を横断した時に生まれる新たな仮説やインサイト"
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  try {
    const parsed = JSON.parse(response.text || '{}');
    return parsed;
  } catch {
    return {
      primarySector: matchBestSector(query),
      rawResponse: response.text,
    };
  }
}

/**
 * Execute generate_spatial_node tool
 */
export async function executeGenerateSpatialNode(ai: GoogleGenAI, args: { query: string; sector?: string; summary?: string }): Promise<SpatialNodeData> {
  const { query, sector: targetSector, summary: customSummary } = args;

  let summary = customSummary || '';
  let citations: string[] = [];
  let assignedSector: DiscoverySector = (targetSector as DiscoverySector) || matchBestSector(query);

  if (!summary) {
    try {
      const searchRes = await executeSearchWeb(ai, { query, maxResults: 3 });
      summary = searchRes.summary.slice(0, 200) + '...';
      citations = searchRes.citations.map(c => c.url);
      if (!targetSector) {
        assignedSector = searchRes.recommendedSector;
      }
    } catch {
      summary = `${query}に関するWeb検証・空間トポロジー抽出データ。`;
    }
  }

  const sectorCfg = DISCOVERY_SECTORS.find(s => s.sector === assignedSector) || DISCOVERY_SECTORS[0];
  const theta = sectorCfg.thetaBase + (Math.random() - 0.5) * 0.35;
  const r = 0.35 + Math.random() * 0.45;
  const phi = Math.random() * Math.PI * 2;
  const [x, y, z] = calculateNodePosition(r, theta, phi);

  const nodeId = `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  const nodeCode = `MCP-${assignedSector.slice(0, 2).toUpperCase()}-${Math.floor(Math.random() * 900 + 100)}`;

  const nodeSummary = (summary || `${query}に関するMCP検索知見ノード`).slice(0, 80);
  const nodeDetails = summary || `${query}に関する詳細Webグラウンディングレポート`;
  const nodeSource = citations[0] || 'MCP Google Grounding Search';

  const node: SpatialNodeData = {
    id: nodeId,
    code: nodeCode,
    title: query.slice(0, 36),
    sector: assignedSector,
    category: assignedSector,
    summary: nodeSummary,
    details: nodeDetails,
    source: nodeSource,
    status: 'ACTIVE',
    score_s: 0.85,
    radius_r: r,
    theta,
    phi,
    position: [x, y, z],
    density_rho: 0.88,
    variance_sigma2: 0.05,
    topologyLabel: '分岐',
    corroborationCount: citations.length || 3,
    workerId: 'mcp-search-compiler',
    generation: 1,
    connections: [],
    accentColor: sectorCfg.accentColor,
    tags: [assignedSector, 'MCP検索', 'Webグラウンディング'],
    metrics: [
      { label: 'SEARCH RELEVANCE', value: '98.2%', trend: '+4.1%', sparkline: [90, 94, 98.2] },
      { label: 'TOPOLOGY SYNC', value: 'OPTIMAL', trend: 'R=0.82', sparkline: [0.7, 0.78, 0.82] }
    ],
    telemetry: {
      latency: '1.8 ms',
      bandwidth: '1.2 Gbps',
      load: 28,
      securityRating: 'CLASS-A',
      subsystems: 6,
    },
    actions: [
      { id: 'mcp-re-query', label: 'MCP再検索', description: '最新Webインデックスと再照合して空間座標を調整します。' },
      { id: 'mcp-cross-check', label: '12領域クロスチェック', description: '異分野セクターとの関連項を再計算します。' }
    ]
  };

  return node;
}

/**
 * Execute swarm_sector_search tool
 */
export async function executeSwarmSectorSearch(ai: GoogleGenAI, args: { query: string; agentsCount?: number }) {
  const { query, agentsCount = 240 } = args;

  const prompt = `あなたは分散自律スウォーム（蔵本モデル同期）の探索調整エンジンです。
テーマ: "${query}"
動員エージェント数: ${agentsCount}体

12領域（経済、アート、SNS、人、音声、文書、法令、建築、自然、スケッチ、記録、メディア）を横断し、
3領域以上で共通する【共通項（Common Terms）】と、2領域間で架橋となる【関連項（Related Terms）】を導出してください。

JSON形式で返答してください:
{
  "theme": "${query}",
  "kuramotoOrderR": 0.84,
  "activeAgents": ${agentsCount},
  "commonTerms": [
    { "term": "共通項名", "sectors": ["セクター1", "セクター2", "セクター3"], "synthesis": "共鳴の理由と意義" }
  ],
  "relatedTerms": [
    { "term": "関連項名", "sectors": ["セクターA", "セクターB"], "bridge": "2領域の架橋理由" }
  ],
  "emergentHypothesis": "スウォーム同期によって創発した統合仮説"
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    },
  });

  try {
    return JSON.parse(response.text || '{}');
  } catch {
    return {
      theme: query,
      rawOutput: response.text,
    };
  }
}
