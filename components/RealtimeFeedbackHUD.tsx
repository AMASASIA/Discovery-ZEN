import React, { useState, useEffect } from 'react';
import { 
  Mic, 
  Sparkles, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  Share2, 
  Compass, 
  Eye, 
  Volume2,
  Radio,
  Layers
} from 'lucide-react';
import { SpatialNodeData, DiscoverySector } from '../types';
import { DISCOVERY_SECTORS } from '../data/spatialNodes';

export interface VoiceFeedbackData {
  transcript: string;
  keywords: string[];
  matchedSectors: DiscoverySector[];
  matchedNodeIds: string[];
  timestamp: number;
}

export interface ContentFeedbackData {
  node: SpatialNodeData;
  connectedNodes: SpatialNodeData[];
  viewedTotalCount: number;
  allNodesCount: number;
  timestamp: number;
}

interface RealtimeFeedbackHUDProps {
  voiceFeedback: VoiceFeedbackData | null;
  contentFeedback: ContentFeedbackData | null;
  onClearVoiceFeedback: () => void;
  onClearContentFeedback: () => void;
  onFocusNode: (nodeId: string) => void;
  onSelectTag?: (tag: string) => void;
  soundEnabled: boolean;
}

export const RealtimeFeedbackHUD: React.FC<RealtimeFeedbackHUDProps> = ({
  voiceFeedback,
  contentFeedback,
  onClearVoiceFeedback,
  onClearContentFeedback,
  onFocusNode,
  onSelectTag,
  soundEnabled,
}) => {
  // Auto-dismiss or collapse after 9 seconds of inactivity
  const [activeTab, setActiveTab] = useState<'voice' | 'content'>('voice');
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    if (voiceFeedback) {
      setActiveTab('voice');
      setIsMinimized(false);
    }
  }, [voiceFeedback?.timestamp]);

  useEffect(() => {
    if (contentFeedback) {
      setActiveTab('content');
      setIsMinimized(false);
    }
  }, [contentFeedback?.timestamp]);

  // If neither has feedback, do not render
  if (!voiceFeedback && !contentFeedback) {
    return null;
  }

  const currentTab = (activeTab === 'voice' && voiceFeedback) 
    ? 'voice' 
    : contentFeedback 
    ? 'content' 
    : 'voice';

  return (
    <aside 
      aria-label="リアルタイム操作フィードバック"
      id="realtime-interaction-feedback-hud"
      className="fixed top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-4 pointer-events-none transition-all duration-300"
    >
      <div className="bg-white/95 backdrop-blur-2xl rounded-3xl border border-black/15 shadow-2xl overflow-hidden pointer-events-auto transition-all animate-in fade-in slide-in-from-top-4 duration-300">
        {/* Top Control Bar with Tabs & Status */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-black/[0.03] border-b border-black/10">
          <div className="flex items-center gap-1.5">
            {voiceFeedback && (
              <button
                onClick={() => { setActiveTab('voice'); setIsMinimized(false); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold tracking-wider transition-all ${
                  currentTab === 'voice'
                    ? 'bg-black text-white shadow-sm'
                    : 'bg-black/5 text-black/60 hover:text-black hover:bg-black/10'
                }`}
              >
                <Radio className={`w-3 h-3 ${currentTab === 'voice' ? 'text-emerald-400 animate-pulse' : ''}`} />
                <span>音声認識フィードバック</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              </button>
            )}

            {contentFeedback && (
              <button
                onClick={() => { setActiveTab('content'); setIsMinimized(false); }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold tracking-wider transition-all ${
                  currentTab === 'content'
                    ? 'bg-black text-white shadow-sm'
                    : 'bg-black/5 text-black/60 hover:text-black hover:bg-black/10'
                }`}
              >
                <Eye className="w-3 h-3 text-indigo-400" />
                <span>コンテンツ閲覧フィードバック</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="px-2 py-0.5 rounded-lg text-[10px] font-mono text-black/50 hover:text-black hover:bg-black/5"
            >
              {isMinimized ? '展開' : '最小化'}
            </button>
            <button
              onClick={() => {
                if (currentTab === 'voice') onClearVoiceFeedback();
                else onClearContentFeedback();
              }}
              title="閉じる"
              className="p-1 rounded-full text-black/40 hover:text-black hover:bg-black/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body Content */}
        {!isMinimized && (
          <div className="p-4 sm:p-5">
            {/* 1. VOICE INPUT FEEDBACK VIEW */}
            {currentTab === 'voice' && voiceFeedback && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold font-mono tracking-wider">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      <span>認識完了 (VOICE RECOGNIZED)</span>
                    </span>
                    <span className="text-[10px] font-mono text-black/40">
                      {new Date(voiceFeedback.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  {soundEnabled && (
                    <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <Volume2 className="w-3 h-3" />
                      <span>効果音再生済</span>
                    </div>
                  )}
                </div>

                {/* Recognized Text with Highlighting */}
                <div className="p-3.5 rounded-2xl bg-black/[0.02] border border-black/10">
                  <div className="text-[9px] font-mono font-bold tracking-widest text-black/40 uppercase mb-1">
                    認識された音声入力 (HIGHLIGHTED TERMS)
                  </div>
                  <p className="text-sm font-semibold text-black/90 leading-relaxed">
                    {/* Render text with recognized keywords highlighted */}
                    {renderHighlightedText(voiceFeedback.transcript, voiceFeedback.keywords)}
                  </p>
                </div>

                {/* Extracted Keywords & Matched Sectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Matched Sectors */}
                  <div className="p-2.5 rounded-xl bg-black/[0.02] border border-black/5 flex flex-col gap-1">
                    <span className="text-[9px] font-mono text-black/40 font-bold uppercase">
                      合致セクター ({voiceFeedback.matchedSectors.length}領域)
                    </span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {voiceFeedback.matchedSectors.length > 0 ? (
                        voiceFeedback.matchedSectors.map(sec => {
                          const cfg = DISCOVERY_SECTORS.find(s => s.sector === sec);
                          return (
                            <span 
                              key={sec}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 bg-white border border-black/10 text-black shadow-2xs"
                            >
                              <span 
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: cfg?.accentColor || '#1A1A19' }}
                              />
                              <span>【{sec}】</span>
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[10px] text-black/50 italic">全12領域をスキャン中</span>
                      )}
                    </div>
                  </div>

                  {/* Extracted Semantic Tokens */}
                  <div className="p-2.5 rounded-xl bg-black/[0.02] border border-black/5 flex flex-col gap-1">
                    <span className="text-[9px] font-mono text-black/40 font-bold uppercase">
                      抽出キーワード ({voiceFeedback.keywords.length}語)
                    </span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {voiceFeedback.keywords.map(kw => (
                        <button
                          key={kw}
                          onClick={() => onSelectTag?.(kw)}
                          title={`タグ「${kw}」で空間ノードを絞り込み`}
                          className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-emerald-100/70 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 transition-colors"
                        >
                          #{kw}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Spatial Correlated Nodes Action */}
                {voiceFeedback.matchedNodeIds.length > 0 && (
                  <div className="flex items-center justify-between pt-1 border-t border-black/5">
                    <div className="text-[11px] font-mono text-black/60">
                      3D空間内に <strong>{voiceFeedback.matchedNodeIds.length}件</strong> の関連ノードをハイライト中
                    </div>
                    <button
                      onClick={() => onFocusNode(voiceFeedback.matchedNodeIds[0])}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black text-white hover:bg-black/85 text-xs font-bold transition-all shadow-sm"
                    >
                      <Compass className="w-3.5 h-3.5 text-emerald-400" />
                      <span>合致ノードへ移動</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* 2. CONTENT VIEWED FEEDBACK VIEW */}
            {currentTab === 'content' && contentFeedback && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-900 text-[10px] font-bold font-mono tracking-wider">
                      <Eye className="w-3 h-3 text-indigo-600" />
                      <span>コンテンツ閲覧記録 (CONTENT INSPECTED)</span>
                    </span>
                    <span className="text-[10px] font-mono text-black/40">
                      {new Date(contentFeedback.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-black/60 bg-black/5 px-2 py-0.5 rounded">
                    探索済: {contentFeedback.viewedTotalCount} / {contentFeedback.allNodesCount}
                  </span>
                </div>

                {/* Current Inspected Node Header */}
                <div className="p-3.5 rounded-2xl bg-indigo-50/40 border border-indigo-100 flex items-start justify-between">
                  <div className="flex flex-col pr-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: contentFeedback.node.accentColor || '#4F46E5' }}
                      />
                      <span className="text-[10px] font-mono font-bold text-black/60 uppercase">
                        {contentFeedback.node.code} // 【{contentFeedback.node.sector}】 // トポロジー: {contentFeedback.node.topologyLabel}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-black tracking-tight">
                      {contentFeedback.node.title}
                    </h3>
                    <p className="text-xs text-black/70 mt-1 line-clamp-2">
                      {contentFeedback.node.summary}
                    </p>
                  </div>

                  <button
                    onClick={() => onFocusNode(contentFeedback.node.id)}
                    title="ノードを3D空間中心に再フォーカス"
                    className="shrink-0 p-2 rounded-xl bg-white border border-black/10 hover:border-black text-black transition-all shadow-2xs"
                  >
                    <Compass className="w-4 h-4 text-indigo-600" />
                  </button>
                </div>

                {/* Connected Sectors and Cross-links Feedback */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Connected Nodes */}
                  <div className="p-2.5 rounded-xl bg-black/[0.02] border border-black/5 flex flex-col gap-1">
                    <span className="text-[9px] font-mono text-black/40 font-bold uppercase flex items-center justify-between">
                      <span>関連ノード接続</span>
                      <Share2 className="w-2.5 h-2.5 text-black/40" />
                    </span>
                    <div className="flex flex-col gap-1 mt-0.5 max-h-20 overflow-y-auto">
                      {contentFeedback.connectedNodes.length > 0 ? (
                        contentFeedback.connectedNodes.map(cn => (
                          <button
                            key={cn.id}
                            onClick={() => onFocusNode(cn.id)}
                            className="text-left px-2 py-1 rounded-lg bg-white border border-black/5 hover:border-black/20 text-[10px] font-semibold text-black truncate flex items-center justify-between transition-colors shadow-2xs"
                          >
                            <span className="truncate">【{cn.sector}】{cn.title}</span>
                            <ArrowRight className="w-2.5 h-2.5 shrink-0 opacity-40 ml-1" />
                          </button>
                        ))
                      ) : (
                        <span className="text-[10px] text-black/50 italic">独立ノード</span>
                      )}
                    </div>
                  </div>

                  {/* Semantic Term Tags */}
                  <div className="p-2.5 rounded-xl bg-black/[0.02] border border-black/5 flex flex-col gap-1">
                    <span className="text-[9px] font-mono text-black/40 font-bold uppercase">
                      抽出タグ (クリックして関連項表示)
                    </span>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {contentFeedback.node.tags && contentFeedback.node.tags.length > 0 ? (
                        contentFeedback.node.tags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => onSelectTag?.(tag)}
                            className="px-2 py-0.5 rounded-lg text-[10px] font-mono bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition-colors"
                          >
                            #{tag}
                          </button>
                        ))
                      ) : (
                        <span className="text-[10px] text-black/50 italic">タグなし</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};

/**
 * Helper to highlight keywords inside transcript text with styled marks
 */
function renderHighlightedText(text: string, keywords: string[]): React.ReactNode {
  if (!keywords || keywords.length === 0) return text;

  // Build regex pattern matching any keyword
  const escaped = keywords
    .filter(k => k.trim().length > 0)
    .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  
  if (escaped.length === 0) return text;

  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) => {
    const isMatch = keywords.some(k => k.toLowerCase() === part.toLowerCase());
    if (isMatch) {
      return (
        <mark 
          key={i} 
          className="bg-emerald-200 text-emerald-950 font-bold px-1.5 py-0.5 rounded-md mx-0.5 shadow-2xs border border-emerald-300 inline-block"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}
