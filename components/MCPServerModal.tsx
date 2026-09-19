import React, { useState, useEffect } from 'react';
import { 
  Server, 
  Search, 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Terminal, 
  Radio, 
  Layers, 
  Globe, 
  ArrowRight, 
  Cpu, 
  Code2, 
  Plus,
  RefreshCw
} from 'lucide-react';
import { SpatialNodeData } from '../types';

interface MCPServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddSpatialNode?: (node: SpatialNodeData) => void;
  initialQuery?: string;
}

export const MCPServerModal: React.FC<MCPServerModalProps> = ({
  isOpen,
  onClose,
  onAddSpatialNode,
  initialQuery = '',
}) => {
  const [activeTab, setActiveTab] = useState<'search' | 'tools' | 'connect' | 'jsonrpc'>('search');
  const [query, setQuery] = useState(initialQuery);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any | null>(null);
  const [synthesizedNode, setSynthesizedNode] = useState<SpatialNodeData | null>(null);
  const [serverInfo, setServerInfo] = useState<any | null>(null);
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [nodeSpawned, setNodeSpawned] = useState(false);
  const [jsonRpcInput, setJsonRpcInput] = useState<string>(
    JSON.stringify(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'search_web',
          arguments: {
            query: '人工知能と分散協調システムの最新動向',
            maxResults: 3,
          },
        },
      },
      null,
      2
    )
  );
  const [jsonRpcOutput, setJsonRpcOutput] = useState<string>('');
  const [isExecutingJsonRpc, setIsExecutingJsonRpc] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/mcp/info')
        .then(res => res.json())
        .then(data => setServerInfo(data))
        .catch(err => console.error('Failed to load MCP info:', err));

      if (initialQuery && initialQuery !== query) {
        setQuery(initialQuery);
      }
    }
  }, [isOpen, initialQuery]);

  const handleExecuteSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchResult(null);
    setSynthesizedNode(null);
    setNodeSpawned(false);

    try {
      const res = await fetch('/api/mcp/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.trim(),
          maxResults: 5,
          generateNode: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setSearchResult(data.result);
        if (data.spatialNode) {
          setSynthesizedNode(data.spatialNode);
        }
      } else {
        alert(data.error || 'MCP Search query failed');
      }
    } catch (err: any) {
      console.error('MCP search error:', err);
      alert('検索エラーが発生しました: ' + (err?.message || String(err)));
    } finally {
      setIsSearching(false);
    }
  };

  const handleSpawnTo3D = () => {
    if (synthesizedNode && onAddSpatialNode) {
      onAddSpatialNode(synthesizedNode);
      setNodeSpawned(true);
    }
  };

  const handleExecuteRawJsonRpc = async () => {
    setIsExecutingJsonRpc(true);
    setJsonRpcOutput('');
    try {
      const parsed = JSON.parse(jsonRpcInput);
      const res = await fetch('/api/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      setJsonRpcOutput(JSON.stringify(data, null, 2));
    } catch (err: any) {
      setJsonRpcOutput(`Error: ${err?.message || String(err)}`);
    } finally {
      setIsExecutingJsonRpc(false);
    }
  };

  const claudeConfigSnippet = JSON.stringify(
    {
      mcpServers: {
        'discovery-os-search': {
          url: `${window.location.origin}/api/mcp/sse`,
        },
      },
    },
    null,
    2
  );

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(claudeConfigSnippet);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md p-4 pointer-events-auto animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-black/15 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-black/10 flex items-center justify-between bg-[#FBFBFA]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-black text-white shadow-md">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-black tracking-wide">
                  自前 MCP 検索エンジン・サーバー
                </h2>
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  ONLINE (2024-11-05)
                </span>
              </div>
              <p className="text-[11px] text-black/50 font-mono">
                Model Context Protocol (JSON-RPC 2.0 / SSE) • Google Grounding Web Search
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-black/10 flex items-center justify-center text-black/50 hover:text-black hover:bg-black/5 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-black/10 bg-[#FBFBFA]">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'search'
                ? 'border-black text-black'
                : 'border-transparent text-black/45 hover:text-black'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>MCP Web 検索</span>
          </button>

          <button
            onClick={() => setActiveTab('tools')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'tools'
                ? 'border-black text-black'
                : 'border-transparent text-black/45 hover:text-black'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>登録 MCP ツール ({serverInfo?.toolsCount || 4})</span>
          </button>

          <button
            onClick={() => setActiveTab('jsonrpc')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'jsonrpc'
                ? 'border-black text-black'
                : 'border-transparent text-black/45 hover:text-black'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>JSON-RPC コンソール</span>
          </button>

          <button
            onClick={() => setActiveTab('connect')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold border-b-2 transition-all ${
              activeTab === 'connect'
                ? 'border-black text-black'
                : 'border-transparent text-black/45 hover:text-black'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>外部クライアント接続 (Claude 等)</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* TAB 1: MCP WEB SEARCH */}
          {activeTab === 'search' && (
            <div className="space-y-6">
              {/* Search Form */}
              <form onSubmit={handleExecuteSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-black/40 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    placeholder="MCP検索エンジンでWeb探索（例: 2026年の自律分散AI市場動向）..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-black/15 text-sm font-medium text-black focus:outline-none focus:border-black bg-white shadow-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !query.trim()}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-black text-white text-xs font-bold tracking-wider hover:bg-black/85 disabled:opacity-50 transition-all shadow-md shrink-0"
                >
                  {isSearching ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>検索中...</span>
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      <span>MCP 検索実行</span>
                    </>
                  )}
                </button>
              </form>

              {/* Sample Prompts */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-bold text-black/40 tracking-wider">クエリ例:</span>
                {[
                  '量子コンピューティングと暗号技術の最新標準',
                  '生成AIエージェントの自律協調プロトコル',
                  '再生可能エネルギーと地域分散グリッド',
                  '知的財産権とオープンソースAI法規制',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => {
                      setQuery(sample);
                    }}
                    className="text-[11px] px-2.5 py-1 rounded-xl bg-black/5 hover:bg-black/10 text-black/70 transition-all"
                  >
                    {sample}
                  </button>
                ))}
              </div>

              {/* Search Results Display */}
              {searchResult && (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  {/* Summary Card */}
                  <div className="p-5 rounded-2xl bg-[#F8F8F6] border border-black/10 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span 
                          className="px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-sm"
                          style={{ backgroundColor: searchResult.sectorInfo?.accentColor || '#000' }}
                        >
                          推奨領域: 【{searchResult.recommendedSector}】 {searchResult.sectorInfo?.labelEn}
                        </span>
                        <span className="text-[10px] font-mono text-black/60 bg-white px-2 py-0.5 rounded border border-black/10">
                          {searchResult.engineProvider || 'Brave Search / Google Grounding'}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-black/40">
                        {new Date(searchResult.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    <div className="text-xs text-black/80 leading-relaxed font-sans whitespace-pre-line">
                      {searchResult.summary}
                    </div>

                    {/* Citations & Sources */}
                    {searchResult.citations?.length > 0 && (
                      <div className="pt-3 border-t border-black/10 space-y-1.5">
                        <div className="text-[10px] font-bold tracking-wider text-black/40">
                          WEB出典・グラウンディングソース ({searchResult.citations.length}件):
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {searchResult.citations.map((c: any, idx: number) => (
                            <a
                              key={idx}
                              href={c.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-white border border-black/10 hover:border-black/30 flex items-center justify-between text-[11px] group transition-all shadow-2xs"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="font-bold text-black truncate group-hover:text-blue-600 transition-colors">
                                  {c.title}
                                </div>
                                <div className="text-[9px] text-black/40 truncate font-mono">
                                  {c.url}
                                </div>
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-black/30 group-hover:text-black shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 3D Spawn Action Banner */}
                  {synthesizedNode && (
                    <div className="p-4 rounded-2xl bg-black text-white flex items-center justify-between shadow-lg">
                      <div className="min-w-0 pr-3">
                        <div className="text-[10px] font-mono tracking-widest text-emerald-400 font-bold">
                          SPATIAL NODE READY
                        </div>
                        <div className="text-sm font-bold truncate">
                          {synthesizedNode.title} ({synthesizedNode.code})
                        </div>
                        <div className="text-[10px] text-white/60 font-mono">
                          Sector: {synthesizedNode.tags[0]} • Position: [{synthesizedNode.position.join(', ')}]
                        </div>
                      </div>

                      <button
                        onClick={handleSpawnTo3D}
                        disabled={nodeSpawned}
                        className={`px-4 py-2 rounded-xl text-xs font-bold tracking-wider flex items-center gap-1.5 transition-all shadow-md shrink-0 ${
                          nodeSpawned
                            ? 'bg-emerald-500 text-white cursor-default'
                            : 'bg-white text-black hover:bg-white/90'
                        }`}
                      >
                        {nodeSpawned ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>配置完了！</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>3D空間に配置</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: REGISTERED MCP TOOLS */}
          {activeTab === 'tools' && (
            <div className="space-y-4">
              <div className="text-xs text-black/60 leading-relaxed">
                本サーバーは Model Context Protocol 規格に準拠し、以下の4つのネイティブツールを公開しています。すべてのツールは <code className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[11px]">tools/call</code> 経由で実行可能です。
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(serverInfo?.tools || []).map((tool: any) => (
                  <div
                    key={tool.name}
                    className="p-4 rounded-2xl border border-black/10 bg-[#FBFBFA] shadow-sm space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="w-4 h-4 text-black/60" />
                        <span className="font-mono text-xs font-bold text-black">{tool.name}</span>
                      </div>
                      <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-black/5 text-black/60">
                        Tool
                      </span>
                    </div>
                    <p className="text-[11px] text-black/70 leading-relaxed">
                      {tool.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-2xl bg-black/5 border border-black/10 space-y-2 text-xs">
                <div className="font-bold text-black flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  <span>公開 MCP リソース (Resources)</span>
                </div>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-black/70 font-mono">
                  <li>discovery://sectors - 12領域円環トポロジー構造定義</li>
                  <li>discovery://swarm-status - 蔵本モデル秩序パラメータRおよびスウォーム状態</li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 3: RAW JSON-RPC CONSOLE */}
          {activeTab === 'jsonrpc' && (
            <div className="space-y-4">
              <div className="text-xs text-black/60">
                HTTP POST <code className="px-1.5 py-0.5 rounded bg-black/5 font-mono text-[11px]">/api/mcp</code> エンドポイントへ JSON-RPC 2.0 リクエストを直接送信してテストできます。
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center text-[11px] font-bold text-black/50 uppercase tracking-wider">
                  <span>Request Payload (JSON-RPC 2.0)</span>
                  <button
                    onClick={() => {
                      setJsonRpcInput(
                        JSON.stringify({
                          jsonrpc: '2.0',
                          id: Date.now(),
                          method: 'tools/list',
                          params: {},
                        }, null, 2)
                      );
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    Load tools/list template
                  </button>
                </div>
                <textarea
                  value={jsonRpcInput}
                  onChange={(e) => setJsonRpcInput(e.target.value)}
                  rows={8}
                  className="w-full p-3 rounded-2xl border border-black/15 font-mono text-xs text-black focus:outline-none focus:border-black bg-[#F8F8F6]"
                />
              </div>

              <button
                onClick={handleExecuteRawJsonRpc}
                disabled={isExecutingJsonRpc}
                className="px-5 py-2.5 rounded-xl bg-black text-white text-xs font-bold tracking-wider hover:bg-black/85 transition-all shadow-md flex items-center gap-2"
              >
                {isExecutingJsonRpc ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Terminal className="w-3.5 h-3.5" />}
                <span>リクエスト送信 (POST /api/mcp)</span>
              </button>

              {jsonRpcOutput && (
                <div className="space-y-2 animate-in fade-in duration-200">
                  <div className="text-[11px] font-bold text-black/50 uppercase tracking-wider">
                    Response
                  </div>
                  <pre className="p-3 rounded-2xl bg-black text-emerald-400 font-mono text-xs overflow-x-auto max-h-60">
                    {jsonRpcOutput}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: EXTERNAL CLIENT CONNECT (Claude Desktop) */}
          {activeTab === 'connect' && (
            <div className="space-y-5">
              <div className="text-xs text-black/70 leading-relaxed">
                本サーバーは標準の <strong>Server-Sent Events (SSE)</strong> トランスポートを備えています。Claude Desktop、Cursor、その他のMCPクライアントから接続し、Discovery OSの検索エンジンと12領域空間合成ツールを外部AIモデルから直接呼び出すことができます。
              </div>

              {/* Endpoints Table */}
              <div className="p-4 rounded-2xl bg-[#F8F8F6] border border-black/10 space-y-2 text-xs">
                <div className="font-bold text-black">公開 MCP エンドポイント:</div>
                <div className="space-y-1.5 font-mono text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="text-black/60">SSE Transport:</span>
                    <span className="font-bold text-black">{window.location.origin}/api/mcp/sse</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-black/60">HTTP JSON-RPC:</span>
                    <span className="font-bold text-black">{window.location.origin}/api/mcp</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-black/60">Server Info:</span>
                    <span className="font-bold text-black">{window.location.origin}/api/mcp/info</span>
                  </div>
                </div>
              </div>

              {/* Claude Desktop Config */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-black">
                    Claude Desktop 設定ファイル (<code className="font-mono text-[10px]">claude_desktop_config.json</code>):
                  </span>
                  <button
                    onClick={handleCopyConfig}
                    className="flex items-center gap-1 text-xs font-bold text-black/70 hover:text-black"
                  >
                    {copiedConfig ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">コピー完了</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>設定JSONをコピー</span>
                      </>
                    )}
                  </button>
                </div>

                <pre className="p-4 rounded-2xl bg-black text-white font-mono text-xs overflow-x-auto shadow-inner">
                  {claudeConfigSnippet}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
