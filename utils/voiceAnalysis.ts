import { SpatialNodeData, DiscoverySector } from '../types';
import { DISCOVERY_SECTORS } from '../data/spatialNodes';

export interface VoiceAnalysisResult {
  transcript: string;
  keywords: string[];
  matchedSectors: DiscoverySector[];
  matchedNodeIds: string[];
  confidence: number;
}

/**
 * Common technical and domain terms across the 12 discovery sectors
 */
const DOMAIN_TERMS = [
  '自律分散', 'AI', '人工知能', 'エージェント', 'スウォーム', '合意形成', 
  '地域通貨', '循環経済', '流動性', 'AMM', 'ゼロ知識', 'ZK', '暗号', 
  '来歴証明', '著作権', '判例', 'ガバナンス', 'スマートコントラクト', 
  'トポロジー', '音響', '位相同調', 'クラモト', 'Kuramoto', '粘菌', 
  '耐障害性', 'ファサード', '建築', '生体', '自然', '記録', 'メディア',
  'スケッチ', '文書', '法令', 'SNS', 'アート', '経済'
];

/**
 * Analyzes speech transcript to extract keywords, match sectors, and identify related spatial nodes.
 */
export function analyzeVoiceTranscript(
  rawTranscript: string, 
  allNodes: SpatialNodeData[]
): VoiceAnalysisResult {
  const transcript = rawTranscript.trim();
  if (!transcript) {
    return {
      transcript: '',
      keywords: [],
      matchedSectors: [],
      matchedNodeIds: [],
      confidence: 0,
    };
  }

  const lower = transcript.toLowerCase();

  // 1. Identify matched sectors
  const matchedSectors: DiscoverySector[] = [];
  for (const s of DISCOVERY_SECTORS) {
    if (
      lower.includes(s.sector.toLowerCase()) || 
      lower.includes(s.labelEn.toLowerCase()) ||
      lower.includes(s.description.slice(0, 4).toLowerCase())
    ) {
      if (!matchedSectors.includes(s.sector)) {
        matchedSectors.push(s.sector);
      }
    }
  }

  // 2. Extract keywords from known terms, tags, and sectors
  const foundKeywords = new Set<string>();

  // Check sector names
  matchedSectors.forEach(sec => foundKeywords.add(sec));

  // Check domain vocabulary
  for (const term of DOMAIN_TERMS) {
    if (lower.includes(term.toLowerCase())) {
      foundKeywords.add(term);
    }
  }

  // Check node tags
  for (const node of allNodes) {
    for (const tag of node.tags) {
      if (lower.includes(tag.toLowerCase()) && tag.length >= 2) {
        foundKeywords.add(tag);
      }
    }
  }

  // If no predefined keywords hit, split by spaces or punctuation
  if (foundKeywords.size === 0) {
    const tokens = transcript
      .replace(/[、。！？\s,!?]/g, ' ')
      .split(' ')
      .filter(w => w.trim().length >= 2);
    tokens.slice(0, 4).forEach(t => foundKeywords.add(t));
  }

  const keywords = Array.from(foundKeywords).slice(0, 6);

  // 3. Find matching nodes in spatial topology
  const matchedNodeIds: string[] = [];
  const scoredNodes: Array<{ id: string; score: number }> = [];

  for (const node of allNodes) {
    let score = 0;
    const nodeText = `${node.title} ${node.summary} ${node.sector} ${node.tags.join(' ')}`.toLowerCase();

    // Check keyword hits
    for (const kw of keywords) {
      if (nodeText.includes(kw.toLowerCase())) {
        score += 2;
      }
    }

    // Check sector hit
    if (matchedSectors.includes(node.sector)) {
      score += 3;
    }

    // Direct transcript hit
    if (lower.includes(node.title.toLowerCase()) || node.title.toLowerCase().includes(lower)) {
      score += 5;
    }

    if (score > 0) {
      scoredNodes.push({ id: node.id, score });
    }
  }

  scoredNodes.sort((a, b) => b.score - a.score);
  scoredNodes.slice(0, 8).forEach(item => matchedNodeIds.push(item.id));

  // If sectors were found but no specific nodes scored, include nodes from matched sectors
  if (matchedNodeIds.length === 0 && matchedSectors.length > 0) {
    const sectorNodes = allNodes.filter(n => matchedSectors.includes(n.sector));
    sectorNodes.slice(0, 4).forEach(n => matchedNodeIds.push(n.id));
  }

  return {
    transcript,
    keywords,
    matchedSectors,
    matchedNodeIds,
    confidence: keywords.length > 0 ? 0.94 : 0.72,
  };
}
