import express, { Request, Response } from 'express';
import http from 'http';
import path from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy GoogleGenAI initialization
let aiClient: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error('GEMINI_API_KEY is not configured in environment variables.');
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// 1. Multi-turn Gemini Chat Endpoint
// Supports: gemini-3.1-pro-preview, gemini-3.5-flash, gemini-3.1-flash-lite
app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { 
      messages, 
      model = 'gemini-3.5-flash', 
      systemInstruction = 'You are an analytical AI copilot for Discovery OS v1.0, specializing in cross-sector knowledge discovery and 12-sector topology synthesis.' 
    } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Invalid messages array provided.' });
      return;
    }

    const ai = getAI();

    // Map conversation history
    const contents = messages.map((m: { role: string; text: string }) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction,
      },
    });

    res.json({
      text: response.text || '',
      modelUsed: model,
    });
  } catch (error: any) {
    console.error('Gemini Chat API Error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to generate response from Gemini model.',
    });
  }
});

// 2. Google Maps Grounding Endpoint
// Uses: gemini-3.5-flash with { googleMaps: {} } tool
app.post('/api/maps-grounding', async (req: Request, res: Response) => {
  try {
    const { prompt, lat, lng } = req.body;

    if (!prompt || typeof prompt !== 'string') {
      res.status(400).json({ error: 'Prompt string is required.' });
      return;
    }

    const ai = getAI();

    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    if (lat !== undefined && lng !== undefined && !isNaN(Number(lat)) && !isNaN(Number(lng))) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: Number(lat),
            longitude: Number(lng),
          },
        },
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
      config,
    });

    const candidate = response.candidates?.[0];
    const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];
    
    // Extract Maps place links and review snippets
    const places: Array<{ title: string; uri: string; snippets: string[] }> = [];

    for (const chunk of groundingChunks as any[]) {
      if (chunk.maps) {
        places.push({
          title: chunk.maps.title || 'Google Maps Location',
          uri: chunk.maps.uri || '',
          snippets: chunk.maps.placeAnswerSources?.reviewSnippets?.map((s: any) => s.text) || [],
        });
      }
    }

    res.json({
      text: response.text || '',
      places,
      groundingChunks,
    });
  } catch (error: any) {
    console.error('Maps Grounding API Error:', error);
    res.status(500).json({
      error: error?.message || 'Failed to query Google Maps grounding with Gemini.',
    });
  }
});

// ============================================================================
// 3. Self-Hosted MCP (Model Context Protocol) Server & Search Engine Endpoints
// Protocol Version: 2024-11-05
// Supports: SSE (Server-Sent Events) & Direct JSON-RPC 2.0 (HTTP POST)
// ============================================================================
import { 
  MCP_SERVER_INFO, 
  MCP_TOOLS, 
  MCP_RESOURCES, 
  MCP_PROMPTS,
  executeSearchWeb,
  executeDiscoverSectors,
  executeGenerateSpatialNode,
  executeSwarmSectorSearch
} from './mcpEngine';
import { DISCOVERY_SECTORS } from './data/spatialNodes';

// Active MCP SSE Sessions Map
interface MCPSession {
  id: string;
  res: Response;
  createdAt: number;
}
const mcpSessions = new Map<string, MCPSession>();

// Helper to execute MCP JSON-RPC 2.0 messages
async function handleMCPMessage(message: any, ai: GoogleGenAI): Promise<any> {
  const { jsonrpc = '2.0', id, method, params } = message;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: MCP_SERVER_INFO.protocolVersion,
        capabilities: {
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
          prompts: { listChanged: false },
          logging: {},
        },
        serverInfo: {
          name: MCP_SERVER_INFO.name,
          version: MCP_SERVER_INFO.version,
        },
      },
    };
  }

  if (method === 'notifications/initialized' || method === 'initialized') {
    return null; // Notifications don't require responses
  }

  if (method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: MCP_TOOLS,
      },
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params || {};
    try {
      let toolResult: any = null;

      if (name === 'search_web') {
        toolResult = await executeSearchWeb(ai, args);
      } else if (name === 'discover_sectors') {
        toolResult = await executeDiscoverSectors(ai, args);
      } else if (name === 'generate_spatial_node') {
        toolResult = await executeGenerateSpatialNode(ai, args);
      } else if (name === 'swarm_sector_search') {
        toolResult = await executeSwarmSectorSearch(ai, args);
      } else {
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Unknown MCP tool requested: ${name}`,
          },
        };
      }

      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2),
            },
          ],
          isError: false,
        },
      };
    } catch (toolErr: any) {
      console.error(`[MCP Server] Error executing tool ${name}:`, toolErr);
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `MCP Tool execution error: ${toolErr?.message || String(toolErr)}`,
            },
          ],
          isError: true,
        },
      };
    }
  }

  if (method === 'resources/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        resources: MCP_RESOURCES,
      },
    };
  }

  if (method === 'resources/read') {
    const { uri } = params || {};
    if (uri === 'discovery://sectors') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(DISCOVERY_SECTORS, null, 2),
            },
          ],
        },
      };
    }
    return {
      jsonrpc: '2.0',
      id,
      error: { code: -32602, message: `Resource not found: ${uri}` },
    };
  }

  if (method === 'prompts/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        prompts: MCP_PROMPTS,
      },
    };
  }

  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: -32601,
      message: `Method not supported: ${method}`,
    },
  };
}

// 3.1. MCP Server Status & Info Endpoint
app.get('/api/mcp/info', (_req: Request, res: Response) => {
  res.json({
    status: 'ONLINE',
    serverInfo: MCP_SERVER_INFO,
    endpoints: {
      sse: '/api/mcp/sse',
      httpJsonRpc: '/api/mcp',
      searchDirect: '/api/mcp/search',
    },
    toolsCount: MCP_TOOLS.length,
    tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
    resources: MCP_RESOURCES,
    prompts: MCP_PROMPTS,
    activeSessions: mcpSessions.size,
    claudeDesktopConfig: {
      mcpServers: {
        'discovery-os-search': {
          url: 'http://localhost:3000/api/mcp/sse',
        },
      },
    },
  });
});

// 3.2. Direct HTTP JSON-RPC 2.0 MCP Endpoint
app.post('/api/mcp', async (req: Request, res: Response) => {
  try {
    const ai = getAI();
    const body = req.body;

    if (Array.isArray(body)) {
      const results = [];
      for (const msg of body) {
        const resp = await handleMCPMessage(msg, ai);
        if (resp) results.push(resp);
      }
      res.json(results);
      return;
    }

    const response = await handleMCPMessage(body, ai);
    if (!response) {
      res.status(204).end();
      return;
    }
    res.json(response);
  } catch (error: any) {
    console.error('[MCP Server HTTP Error]:', error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: error?.message || 'Internal MCP Server Error' },
    });
  }
});

// 3.3. MCP Server-Sent Events (SSE) Transport Endpoint
app.get('/api/mcp/sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const sessionId = `mcp_sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  mcpSessions.set(sessionId, { id: sessionId, res, createdAt: Date.now() });

  console.log(`[MCP Server] New SSE Session connected: ${sessionId}`);

  // Send initial endpoint announcement as per MCP specification
  res.write(`event: endpoint\ndata: /api/mcp/messages?sessionId=${sessionId}\n\n`);

  // Heartbeat keep-alive every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': keep-alive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    mcpSessions.delete(sessionId);
    console.log(`[MCP Server] SSE Session disconnected: ${sessionId}`);
  });
});

// 3.4. Message handler for active SSE Sessions
app.post('/api/mcp/messages', async (req: Request, res: Response) => {
  const sessionId = (req.query.sessionId as string) || req.body?.sessionId;
  const session = sessionId ? mcpSessions.get(sessionId) : null;

  try {
    const ai = getAI();
    const response = await handleMCPMessage(req.body, ai);

    if (session && response) {
      session.res.write(`event: message\ndata: ${JSON.stringify(response)}\n\n`);
    }

    res.json(response || { ok: true });
  } catch (err: any) {
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32603, message: err?.message || 'Failed to process message' },
    });
  }
});

// 3.5. High-level MCP Search Endpoint for Front-End integration
app.post('/api/mcp/search', async (req: Request, res: Response) => {
  try {
    const { query, maxResults = 5, sectorFilter, generateNode = true } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({ error: 'Search query is required.' });
      return;
    }

    const ai = getAI();

    // 1. Run MCP search_web with Google Search Grounding
    const searchResult = await executeSearchWeb(ai, { query, maxResults, sectorFilter });

    // 2. Optionally synthesize full SpatialNodeData
    let spatialNode: any = null;
    if (generateNode) {
      spatialNode = await executeGenerateSpatialNode(ai, {
        query,
        sector: searchResult.recommendedSector,
        summary: searchResult.summary,
      });
    }

    res.json({
      mcpServer: MCP_SERVER_INFO.name,
      protocolVersion: MCP_SERVER_INFO.protocolVersion,
      result: searchResult,
      spatialNode,
    });
  } catch (error: any) {
    console.error('[MCP Search API Error]:', error);
    res.status(500).json({
      error: error?.message || 'Failed to execute MCP Search Engine query.',
    });
  }
});

// 4. Live API WebSocket server (gemini-3.8-live)
const wss = new WebSocketServer({ server, path: '/api/live' });

wss.on('connection', async (clientWs: WebSocket) => {
  console.log('[Live API] Client connected to WebSocket');
  let session: any = null;

  try {
    const ai = getAI();
    session = await ai.live.connect({
      model: 'gemini-3.8-live',
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: 'You are the Discovery OS live voice navigator. Converse naturally with the user in real-time, assisting them in cross-domain exploration of the 12 discovery sectors, topological relationships, and spatial findings. Be concise and insightful.',
      },
      callbacks: {
        onmessage: (message: any) => {
          if (clientWs.readyState !== WebSocket.OPEN) return;

          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          if (audio) {
            clientWs.send(JSON.stringify({ type: 'audio', audio }));
          }

          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ type: 'interrupted' }));
          }

          const textPart = message.serverContent?.modelTurn?.parts?.find((p: any) => p.text);
          if (textPart?.text) {
            clientWs.send(JSON.stringify({ type: 'text', text: textPart.text }));
          }
        },
        onclose: () => {
          console.log('[Live API] Gemini session closed');
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'session_closed' }));
          }
        },
        onerror: (err: any) => {
          console.error('[Live API] Gemini session error:', err);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', error: err?.message || String(err) }));
          }
        },
      },
    });

    clientWs.send(JSON.stringify({ type: 'ready', message: 'Connected to gemini-3.8-live session.' }));

    clientWs.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.text) {
          session.sendRealtimeInput({
            text: msg.text,
          });
        }
      } catch (err) {
        console.error('[Live API] Error processing client message:', err);
      }
    });

    clientWs.on('close', () => {
      console.log('[Live API] Client disconnected');
      if (session) {
        try {
          session.close();
        } catch {
          // ignore
        }
      }
    });
  } catch (err: any) {
    console.error('[Live API] Session initialization failed:', err);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ 
        type: 'error', 
        error: err?.message || 'Failed to initialize gemini-3.8-live session. Please check your GEMINI_API_KEY.' 
      }));
    }
  }
});

// Vite & Static Asset Handling
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Discovery OS server listening on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
