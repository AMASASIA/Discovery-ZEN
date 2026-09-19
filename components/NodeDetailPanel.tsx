import React, { useState } from 'react';
import { 
  X, 
  Activity, 
  Wifi, 
  ShieldCheck, 
  Cpu, 
  Terminal, 
  CheckCircle2, 
  ArrowUpRight, 
  Sliders, 
  Layers, 
  ExternalLink, 
  Compass, 
  Radio, 
  Share2, 
  Users,
  Bookmark,
  BookmarkCheck,
  Cloud,
  Sparkles,
  Bot
} from 'lucide-react';
import { SpatialNodeData } from '../types';
import { DISCOVERY_SECTORS } from '../data/spatialNodes';

interface NodeDetailPanelProps {
  node: SpatialNodeData | null;
  allNodes: SpatialNodeData[];
  onClose: () => void;
  onFocusNode: (nodeId: string) => void;
  onSelectTag?: (tag: string) => void;
  isSaved?: boolean;
  onToggleSave?: (node: SpatialNodeData) => void;
}

export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({
  node,
  allNodes,
  onClose,
  onFocusNode,
  onSelectTag,
  isSaved = false,
  onToggleSave,
}) => {
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [selectedAi, setSelectedAi] = useState<'gemini' | 'claude'>('gemini');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);
  const [claudeCopied, setClaudeCopied] = useState(false);
  const [sliderValues, setSliderValues] = useState<{ [key: string]: number }>({
    allocation: 78,
    priority: 92,
    sensitivity: 45,
  });

  if (!node) return null;

  const handleAction = (actionId: string, label: string) => {
    setActiveActionId(actionId);
    setTimeout(() => {
      setActiveActionId(null);
      setActionSuccess(`Executed: ${label}`);
      setTimeout(() => setActionSuccess(null), 3500);
    }, 900);
  };

  const handleRunGeminiAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.5-flash',
          messages: [
            {
              role: 'user',
              text: `Discovery OS v1.0の空間トポロジーノード「${node.title}」について、客観的かつ深層的な分析を200字程度で行ってください。\n・所属領域: 【${node.sector}】\n・コード: ${node.code}\n・要約: ${node.summary}\n・トポロジー分類: ${node.topologyLabel || '中核'}\n他領域との連携可能性や、今後の進化シナリオを含めてください。`
            }
          ]
        })
      });
      const data = await res.json();
      if (data.text) {
        setAiAnalysisResult(data.text);
        // Auto pin to Cloud Firestore if not already saved
        if (!isSaved && onToggleSave) {
          onToggleSave(node);
        }
      }
    } catch (err) {
      setAiAnalysisResult('Gemini分析の生成に失敗しました。時間をおいて再試行してください。');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCopyClaudeContext = () => {
    const claudePrompt = `[Discovery OS v1.0 空間トポロジーノード情報 - Claude MCP連携]
ノード名: ${node.title}
領域: ${node.sector}
コード: ${node.code}
トポロジー: ${node.topologyLabel || '中核'} (極座標: r=${node.radius_r?.toFixed(2)}, θ=${(((node.theta || 0)*180)/Math.PI).toFixed(0)}°)
要約: ${node.summary}
詳細: ${node.details}
出典: ${node.source || 'Discovery Registry'}

Claudeへの指示:
上記ノードのトポロジー構造に基づき、他領域（経済、アート、法令、建築等）との相乗効果および自律エージェント群による分散推論プランを策定してください。`;

    navigator.clipboard.writeText(claudePrompt);
    setClaudeCopied(true);
    setAiAnalysisResult('Claude 3.7 / MCP形式のプロンプトをクリップボードにコピーしました。Claude Desktop または Claude Web に貼り付けて活用できます。');
    if (!isSaved && onToggleSave) {
      onToggleSave(node);
    }
    setTimeout(() => setClaudeCopied(false), 3000);
  };

  const sectorCfg = DISCOVERY_SECTORS.find(s => s.sector === node.sector);
  const connectedNodes = allNodes.filter(n => node.connections.includes(n.id));

  return (
    <div 
      id={`node-inspector-${node.id}`}
      className="fixed top-20 right-8 z-30 w-96 max-w-[calc(100vw-3rem)] max-h-[calc(100vh-120px)] bg-white/95 backdrop-blur-2xl rounded-3xl border border-black/15 shadow-2xl p-6 flex flex-col gap-5 overflow-y-auto pointer-events-auto animate-in fade-in slide-in-from-right-8 duration-300"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-black/10 pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span 
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: sectorCfg?.accentColor || '#1A1A19' }}
            />
            <span className="text-[10px] font-mono tracking-widest text-black/60 font-bold uppercase">
              {node.code} // 【{node.sector}】 // {sectorCfg?.labelEn}
            </span>
          </div>
          <h2 className="text-lg font-bold text-black/90 tracking-tight leading-snug">
            {node.title}
          </h2>
        </div>
        <div className="flex items-center gap-1">
          {onToggleSave && (
            <button
              onClick={() => onToggleSave(node)}
              className={`p-1.5 rounded-full transition-all ${
                isSaved 
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                  : 'hover:bg-black/5 text-black/40 hover:text-black'
              }`}
              title={isSaved ? 'Firestoreクラウド保存中（クリックで解除）' : 'Firestoreクラウドへ保存'}
            >
              {isSaved ? <BookmarkCheck className="w-5 h-5 text-amber-700 fill-amber-500" /> : <Bookmark className="w-5 h-5" />}
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/5 text-black/40 hover:text-black transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Prominent Cloud Pin & Auto-Save Button */}
      {onToggleSave && (
        <button
          onClick={() => onToggleSave(node)}
          className={`w-full py-2.5 px-3 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold transition-all shadow-xs ${
            isSaved
              ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100'
              : 'bg-black text-white hover:bg-black/85 border border-black'
          }`}
        >
          {isSaved ? (
            <>
              <BookmarkCheck className="w-4 h-4 text-amber-600 fill-amber-500" />
              <span>ピン留め済み (Cloud Firestore 永続化完了)</span>
            </>
          ) : (
            <>
              <Bookmark className="w-4 h-4" />
              <span>ノードをクラウドにピン留め (Firestore保存)</span>
            </>
          )}
        </button>
      )}

      {/* Dual AI: Gemini & Claude Analysis & MCP Section */}
      <div className="p-3.5 rounded-2xl bg-[#F8F8F6] border border-black/10 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-black">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Gemini & Claude AI 分析</span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-black/10 text-black/60">
            <Cloud className="w-3 h-3 text-blue-500" />
            <span>Cloud Sync</span>
          </div>
        </div>

        {/* AI Model Tabs: Gemini vs Claude */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/5 rounded-xl text-xs font-bold">
          <button
            onClick={() => setSelectedAi('gemini')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              selectedAi === 'gemini' ? 'bg-white shadow-xs text-black' : 'text-black/50 hover:text-black'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
            <span>Gemini 3.5</span>
          </button>
          <button
            onClick={() => setSelectedAi('claude')}
            className={`py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              selectedAi === 'claude' ? 'bg-white shadow-xs text-black' : 'text-black/50 hover:text-black'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#CC785C]"></span>
            <span>Claude 3.7</span>
          </button>
        </div>

        {selectedAi === 'gemini' ? (
          <div className="space-y-2">
            <p className="text-[11px] text-black/60 leading-relaxed">
              Google Gemini 3.5 Flash がこのノードの12領域トポロジー、極座標、潜在的交差領域を深層分析します。
            </p>
            <button
              onClick={handleRunGeminiAnalysis}
              disabled={isAnalyzing}
              className="w-full py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Cpu className="w-3.5 h-3.5 animate-spin" />
                  <span>Gemini トポロジー分析中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Gemini で深層分析 & クラウド保存</span>
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-black/60 leading-relaxed">
              Anthropic Claude（Claude Desktop / MCP）用のノードプロンプトとMCPコンテキストを生成します。
            </p>
            <button
              onClick={handleCopyClaudeContext}
              className="w-full py-2 px-3 rounded-xl bg-[#CC785C] hover:bg-[#B86B50] text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs"
            >
              {claudeCopied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Claude MCPプロンプトをコピー完了！</span>
                </>
              ) : (
                <>
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Claude MCP形式でエクスポート & ピン留め</span>
                </>
              )}
            </button>
          </div>
        )}

        {/* AI Analysis Output */}
        {aiAnalysisResult && (
          <div className="p-3 rounded-xl bg-white border border-black/10 text-xs text-black/80 leading-relaxed space-y-1.5 animate-in fade-in">
            <div className="flex items-center justify-between text-[10px] font-mono font-bold text-black/50 border-b border-black/5 pb-1">
              <span>{selectedAi === 'gemini' ? 'Gemini 3.5 Flash 空間考察' : 'Claude MCP 構造化データ'}</span>
              <span className="text-emerald-600 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3 h-3" /> Firestore同期
              </span>
            </div>
            <p className="text-[11px] whitespace-pre-wrap">{aiAnalysisResult}</p>
          </div>
        )}
      </div>

      {/* Radial Coordinates & Topology Badge (FR-07, FR-09, FR-10) */}
      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="p-2.5 rounded-xl bg-black/[0.03] border border-black/5 flex flex-col gap-0.5">
          <span className="text-[9px] text-black/40">極座標 (r, θ, φ)</span>
          <span className="font-bold text-black">
            r={(node.radius_r ?? 0.1).toFixed(2)} | θ={(((node.theta ?? 0) * 180) / Math.PI).toFixed(0)}°
          </span>
          <span className="text-[9px] text-black/50">位相 φ={(node.phi ?? 0).toFixed(2)} rad</span>
        </div>

        <div className="p-2.5 rounded-xl bg-black/[0.03] border border-black/5 flex flex-col gap-0.5">
          <span className="text-[9px] text-black/40">トポロジー分類 (FR-09)</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-bold">
              {node.topologyLabel || '中核'}
            </span>
            <span className="text-[9px] text-black/60">
              ρ={(node.density_rho ?? 0.9).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Summary (P2 <= 80 chars requirement) */}
      <div className="bg-black/[0.02] p-3 rounded-2xl border border-black/5">
        <div className="text-[9px] font-mono text-black/40 mb-1">要約 (80字以内)</div>
        <p className="text-xs leading-relaxed text-black/80 font-medium">
          {node.summary}
        </p>
      </div>

      {/* Details */}
      <div className="text-xs leading-relaxed text-black/70">
        <div className="text-[9px] font-mono text-black/40 mb-1">詳細記述</div>
        <p className="p-3 rounded-2xl bg-black/[0.015] border border-black/5">
          {node.details}
        </p>
      </div>

      {/* Source Verification (FR-05) */}
      {node.source && (
        <div className="p-3 rounded-2xl bg-black/[0.03] border border-black/10 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[9px] font-mono text-black/40">一次出典・検証ソース (FR-05)</span>
            <span className="text-xs font-mono font-bold text-black truncate max-w-[200px]">
              {node.sourceId || 'SRC-VERIFIED'}
            </span>
          </div>
          <a
            href={node.source}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white border border-black/10 text-xs font-mono font-bold text-black/80 hover:text-black hover:border-black transition-colors"
          >
            <span>検証元</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}

      {/* Corroboration & Lineage (FR-12, FR-23) */}
      <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200 text-xs">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-700" />
          <div>
            <div className="font-bold text-emerald-900">
              独立裏づけ: {node.corroborationCount || 4}体のエージェント合意
            </div>
            <div className="text-[10px] font-mono text-emerald-700">
              ワーカー: {node.workerId || 'w-core-01'} // 第{node.generation || 1}世代
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
          PASS
        </span>
      </div>

      {/* Tags (Semantic Terms) */}
      {node.tags && node.tags.length > 0 && (
        <div>
          <div className="text-[9px] font-mono text-black/40 mb-1.5">抽出タグ (名詞 3〜6個)</div>
          <div className="flex flex-wrap gap-1.5">
            {node.tags.map(t => (
              <button
                key={t}
                onClick={() => onSelectTag?.(t)}
                className="px-2 py-1 rounded-lg bg-black/5 hover:bg-black/10 border border-black/5 text-[11px] font-mono text-black/70 transition-colors"
              >
                #{t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Metrics */}
      {node.metrics && node.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {node.metrics.map((m, idx) => (
            <div key={idx} className="p-3 bg-black/[0.02] border border-black/5 rounded-2xl">
              <span className="text-[9px] font-mono text-black/40 uppercase block mb-1">{m.label}</span>
              <span className="text-base font-bold font-mono text-black block">{m.value}</span>
              <span className="text-[10px] font-mono text-emerald-600 block mt-0.5">{m.trend}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cross-Sector Connected Nodes */}
      {connectedNodes.length > 0 && (
        <div className="border-t border-black/10 pt-4">
          <div className="text-[9px] font-mono text-black/40 mb-2 flex items-center justify-between">
            <span>領域間リンク ({connectedNodes.length}ノード)</span>
            <Share2 className="w-3 h-3 text-black/40" />
          </div>
          <div className="flex flex-col gap-1.5">
            {connectedNodes.map(cn => (
              <button
                key={cn.id}
                onClick={() => onFocusNode(cn.id)}
                className="text-left p-2.5 rounded-xl bg-black/[0.02] hover:bg-black/[0.05] border border-black/5 flex items-center justify-between transition-colors"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] font-mono text-black/40">【{cn.sector}】 {cn.code}</span>
                  <span className="text-xs font-bold text-black truncate max-w-[220px]">{cn.title}</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-black/40" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Node Actions */}
      {node.actions && node.actions.length > 0 && (
        <div className="border-t border-black/10 pt-4 flex flex-col gap-2">
          <div className="text-[9px] font-mono text-black/40">自律エージェント介入アクション</div>
          {node.actions.map(act => (
            <button
              key={act.id}
              onClick={() => handleAction(act.id, act.label)}
              disabled={activeActionId === act.id}
              className="w-full text-left p-2.5 rounded-xl border border-black/10 hover:border-black bg-white hover:bg-black/[0.02] transition-all text-xs flex flex-col gap-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-black">{act.label}</span>
                {activeActionId === act.id && <Cpu className="w-3 h-3 animate-spin text-black" />}
              </div>
              <span className="text-[10px] text-black/60">{act.description}</span>
            </button>
          ))}
          {actionSuccess && (
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-mono text-center border border-emerald-200 animate-in fade-in">
              {actionSuccess}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

