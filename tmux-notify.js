import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const DEBUG = false;
const debugLog = `${process.env.HOME}/.tmux-plugin-debug.log`;
const log = (msg) => { if (DEBUG) appendFileSync(debugLog, `[${new Date().toISOString()}] ${msg}\n`); };

let lastAssistantText = '';
let lastAssistantTextParts = [];
let agentName = 'Agent';
let currentSessionID = '';
let currentDirectory = '';
let currentNotifyLog = '';
let toolCallCount = 0;
let totalTokens = 0;
let lastStatus = '';
let busyStartTime = 0;

const isGhostty = process.env.TERM_PROGRAM === 'Ghostty';
const isMacOS = process.platform === 'darwin';

let _tmuxChecked = false;
let _tmuxAvailable = false;

function isTmuxAvailable() {
  if (_tmuxChecked) return _tmuxAvailable;
  try {
    execSync('tmux display-message -p "#{session_name}" 2>/dev/null', { encoding: 'utf8', timeout: 500 });
    _tmuxAvailable = true;
    _tmuxChecked = true;
    return true;
  } catch (e) {
    _tmuxAvailable = false;
    _tmuxChecked = true;
    return false;
  }
}

let _cachedWindowID = null;
function getWindowID() {
  if (_cachedWindowID !== null) return _cachedWindowID;
  
  if (isTmuxAvailable()) {
    try {
      const session = execSync('tmux display-message -p "#{session_name}"', { encoding: 'utf8', timeout: 500 }).trim();
      const winIdx = execSync('tmux display-message -p "#{window_index}"', { encoding: 'utf8', timeout: 500 }).trim();
      if (session && winIdx) {
        _cachedWindowID = `${session}-w${winIdx}`;
        return _cachedWindowID;
      }
    } catch (e) {}
  }
  
  const pid = process.pid;
  const ghosttyWin = process.env.GHOSTTY_WINDOW_ID;
  _cachedWindowID = ghosttyWin ? `ghostty-${ghosttyWin}` : `pid-${pid}`;
  return _cachedWindowID;
}

const windowID = getWindowID();

const C = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

const SESSION_PALETTE = [
  '#89b4fa', '#b4befe', '#cba6f7', '#f5c2e7', '#f5e0dc', '#f2cdcd',
  '#fab387', '#f9e2af', '#a6e3a1', '#94e2d5', '#89dceb', '#74c7ec'
];

const PALETTE_SIZE = 12;
const sessionPalette = new Map();
let paletteIndex = 0;

function hashSessionID(sid) {
  let hash = 0;
  for (let i = 0; i < sid.length; i++) {
    hash = ((hash << 5) - hash) + sid.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function paletteFg(idx) {
  const hex = SESSION_PALETTE[idx % SESSION_PALETTE.length].replace('#', '');
  const [r, g, b] = hex.match(/.{2}/g).map(x => parseInt(x, 16));
  return `\u001b[38;2;${r};${g};${b}m`;
}

function paletteBg(idx) {
  const hex = SESSION_PALETTE[idx % SESSION_PALETTE.length].replace('#', '');
  const [r, g, b] = hex.match(/.{2}/g).map(x => Math.floor(parseInt(x, 16) * 0.85));
  return `\u001b[48;2;${r};${g};${b}m`;
}

function getFgForBg(idx) {
  const hex = SESSION_PALETTE[idx % SESSION_PALETTE.length].replace('#', '');
  const [r, g, b] = hex.match(/.{2}/g).map(x => parseInt(x, 16));
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 55) {
    return '\u001b[30m';
  }
  return `\u001b[38;2;${r};${g};${b}m`;
}

function getSessionColor(dir) {
  const key = dir || 'default';
  if (!sessionPalette.has(key) && paletteIndex < PALETTE_SIZE) {
    sessionPalette.set(key, paletteIndex++);
  }

  if (sessionPalette.has(key)) {
    const idx = sessionPalette.get(key);
    return { fg: getFgForBg(idx), bg: paletteBg(idx) };
  }

  const hash = hashSessionID(key);
  const r = (hash & 0xff0000) >> 16;
  const g = (hash & 0x00ff00) >> 8;
  const b = hash & 0x0000ff;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  const fg = brightness > 55 ? '\u001b[30m' : `\u001b[38;2;${r};${g};${b}m`;
  return {
    fg,
    bg: `\u001b[48;2;${Math.floor(r * 0.85)};${Math.floor(g * 0.85)};${Math.floor(b * 0.85)}m`,
  };
}

const STATUS_EMOJI = {
  busy: '💭',
  idle: '✅',
  error: '🚨',
  waiting: '⏳',
  paused: '💤',
  stopped: '🛑',
};

const AGENT_EMOJI = {
  build: '🚀',
  plan: '💡',
  debug: '🔧',
  test: '🧪',
  review: '👀',
  doc: '📝',
  default: '💼',
};

const SKIP_PATTERNS = [
  /^(note|summary|overview|introduction|conclusion|here|there|this|that|implementation plan|plan|response)[:.\s]/i,
];

const SKIP_FRAGMENTS = [
  /^string\s/i, /pattern\s/i, /^regex\s/i, /^error\s/i, /^\[code\]$/i,
];

const ACTION_PATTERNS = [
  /^(created|fixed|added|updated|removed|implemented|built|tested|debugged|reviewed|completed|finished)[:\s]+(.+)/i,
  /\b(created|fixed|added|updated|removed|implemented)[:\s]+(.+)/i,
];

function getNotifyLogPath(directory, sessionID) {
  const opencodeDir = `${directory}/.opencode`;
  if (!existsSync(opencodeDir)) {
    mkdirSync(opencodeDir, { recursive: true });
  }
  return `${opencodeDir}/notifications-${windowID}-${sessionID}.log`;
}

function updateSymlink(logPath) {
  const symlinkPath = `${process.env.HOME}/.tmux-notify-${windowID}.log`;
  
  if (!isTmuxAvailable()) {
    log(`tmux unavailable, skipping symlink. Log: ${logPath}`);
    return;
  }
  
  try {
    execSync(`ln -sf "${logPath}" "${symlinkPath}"`, { encoding: 'utf8' });
    log(`Updated symlink to: ${logPath}`);
  } catch (e) {
    log(`Failed to update symlink: ${e.message}`);
  }
}

function rotateLogIfNeeded(logPath) {
  try {
    const content = readFileSync(logPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    if (lines.length > 1000) {
      writeFileSync(logPath, lines.slice(-500).join('\n') + '\n');
    }
  } catch (e) {}
}

function truncate(text, max) {
  if (text.length <= max) return text;
  const wordBreak = text.substring(0, max).lastIndexOf(' ');
  return (wordBreak > max * 0.6 ? text.substring(0, wordBreak) : text.substring(0, max)) + '…';
}

function getAgentEmoji(agent) {
  const lower = agent.toLowerCase();
  for (const [key, emoji] of Object.entries(AGENT_EMOJI)) {
    if (lower.includes(key)) return emoji;
  }
  return AGENT_EMOJI.default;
}

function formatTokens(tokens) {
  if (!tokens) return '';
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens);
}

function formatDuration(ms) {
  if (!ms || ms < 0 || !isFinite(ms)) return null;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

function detectLanguage(text) {
  const chinese = /[\u4e00-\u9fff]/;
  const japanese = /[\u3040-\u309f\u30a0-\u30ff]/;
  const korean = /[\uac00-\ud7af]/;
  
  if (chinese.test(text)) return 'chinese';
  if (japanese.test(text)) return 'japanese';
  if (korean.test(text)) return 'korean';
  return 'english';
}

function summarize(text) {
  if (!text) return 'completed';

  const hasCode = /```[\s\S]+?```/.test(text);
  
  // Use the full accumulated text from all parts, not just the last chunk
  const fullText = lastAssistantTextParts.length > 0 
    ? lastAssistantTextParts.join('')
    : text;
  
  const textToUse = fullText;

  const lang = detectLanguage(textToUse);
  log(`Summarize: lang=${lang}, parts=${lastAssistantTextParts.length}`);

  let cleaned = textToUse
    .replace(/```[\s\S]+?```/g, '[code]')
    .replace(/`[^`]+`/g, '[code]')
    .replace(/~\/[^,\s]*/g, '')
    .replace(/\/[^,\s]*/g, '')
    .replace(/https?:\/\/[^\s]*/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();

  // Universal question marks (English ?, Chinese ？, Japanese ？)
  const questionChars = /[?？？]/;
  
  // Question detection
  const questionPatterns = lang === 'chinese' ? [
    /[？?]$/m,                           // ends with question mark
    /(?:我想|你要|你要不要|要不要|我可以|你能|我可以帮你)[\s\S]*[？?]/,
    /(?:选择|决定|怎么做)[\s\S]{0,50}[？?]/,
  ] : lang === 'japanese' ? [
    /[？?]$/m,
    /(?:ましょう|ですか|しますか|好不好)[\s\S]*[？?]/,
  ] : [
    /\?$/m,
    /\n\?\s*$/m,
    /(?:would you|could you|should I|can I|do you want|would you like)[\s\S]*\?/i,
    /\?.*(?:A|B|C|D)\)/i,
  ];
  
  const isQuestion = questionPatterns.some(p => p.test(cleaned));
  
  // Multi-choice detection - universal (A), B), C) or A、B、C or ① ② ③)
  const choiceListPatterns = [
    /(?:^|\n)\s*[A-D][).]\s+\S+/m,           // A), B), C), D)
    /(?:^|\n)\s*[A-D][、，]\s+\S+/m,           // A、B、C (Chinese style)
    /(?:^|\n)\s*[a-d][).]\s+\S+/m,           // a), b), c), d)
    /(?:^|\n)\s*-\s+[A-D][):]\s+\S+/m,       // - A: or - A)
    /(?:^|\n)\s*\d+[).:]\s+\S+/m,            // 1), 2), 3)
    /(?:^|\n)\s*[①②③④⑤]\s+\S+/m,            // Japanese circled numbers
  ];
  
  // Count items in lists
  let choiceCount = 0;
  for (const pattern of choiceListPatterns) {
    const matches = cleaned.match(pattern);
    if (matches) choiceCount = Math.max(choiceCount, matches.length);
  }
  
  // Check for numbered question list
  const questionListPattern = lang === 'chinese' 
    ? /(?:^|\n)\s*\d+[.).、][\s\S]*?[？?]/g
    : /(?:^|\n)\s*\d+\.[\s\S]*?\?/g;
  const questionListMatch = cleaned.match(questionListPattern);
  const questionListCount = questionListMatch ? questionListMatch.length : 0;
  
  // Chinese invitation patterns
  const cnInvitation = /(?:要不要|我想|我可以帮你|需要我)[\s\S]{0,80}(?:选择|执行|运行|继续|[ABC]|[①②③])/;
  
  // Decision question patterns
  const decisionPatterns = lang === 'chinese' ? [
    /(?:执行|运行|继续|开始|完成)[\s\S]{0,30}[？?]/,
  ] : [
    /(?:execute|run|proceed|continue|go ahead)[\s\S]{0,50}\?/i,
  ];
  
  // Numbered list detection
  const numberedListPattern = lang === 'chinese'
    ? /(?:^|\n)\d+[).、:：][\s\S]+/g
    : /(?:^|\n)\d+[).:]\s+\S+/g;
  const numberedListMatch = cleaned.match(numberedListPattern) || [];
  const numberedListCount = numberedListMatch.length;
  
  // Bullet list detection (e.g., "- Read, search, and navigate...")
  const bulletListPattern = /(?:^|\n)\s*[-*]\s+\S+/g;
  const bulletListMatch = cleaned.match(bulletListPattern) || [];
  const bulletListCount = bulletListMatch.length;
  
  // Section headers detection (e.g., "Code & Development" followed by list items)
  const sectionPattern = /(?:^|\n)([A-Z][A-Za-z\s&]+)\n\s*[-*]\s+/g;
  const sectionMatch = cleaned.match(sectionPattern);
  const sectionCount = sectionMatch ? sectionMatch.length : 0;
  
  // Check for structured lists FIRST - before closing question
  if (numberedListCount > 0 || bulletListCount > 0) {
    const totalItems = numberedListCount + bulletListCount;
    if (sectionCount > 0) {
      return truncate(`${sectionCount} topics`, 45);
    }
    const hasItems = lang === 'chinese'
      ? /(?:选项|方案|方法|步骤|任务)/
      : /(?:option|choice|approach|way|method|step|task|item)/i;
    return truncate(`${totalItems} ${hasItems.test(cleaned) ? 'items' : 'suggestions'}`, 45);
  }
  
  // Only check for question patterns if no structured content found
  if (isQuestion || questionListCount > 0) {
    if (choiceCount > 0) {
      return truncate(`${choiceCount} choices`, 45);
    }
    if (questionListCount > 0) {
      return truncate(`${questionListCount} questions`, 45);
    }
    if (cnInvitation.test(cleaned) || decisionPatterns.some(p => p.test(cleaned))) {
      return lang === 'chinese' ? truncate('询问操作', 45) : truncate('asks what to do', 45);
    }
    // Extract first question
    const firstQuestion = cleaned.split(/[？?]/)[0].trim();
    if (firstQuestion.length > 5) {
      return truncate(firstQuestion + (lang === 'chinese' ? '？' : '?'), 45);
    }
    return lang === 'chinese' ? '提问中' : 'asking question';
  }

  for (const pattern of SKIP_PATTERNS) {
    if (pattern.test(cleaned.substring(0, 30))) {
      cleaned = cleaned.replace(pattern, '');
    }
  }

  // Sentence splitting - handles Chinese/English
  const sentenceSplit = lang === 'chinese' ? /[。！？\n]+/ : /[.!?]+/;
  let sentences = cleaned.split(sentenceSplit).filter(s => s.trim().length > 3);
  if (sentences.length === 0) return hasCode ? 'provided code' : 'completed';

  // Action patterns - Chinese verbs
  const cnActionPatterns = [
    /(?:已完成|已完成|已创建|已修复|已更新|已添加|已删除|已修改)[:\s]*(.+)/i,
  ];
  
  // Use language-appropriate patterns
  const actionPatterns = lang === 'chinese' ? cnActionPatterns : ACTION_PATTERNS;
  
  for (const pattern of actionPatterns) {
    const match = cleaned.match(pattern);
    if (match && match[1] && match[1].length > 2) {
      return truncate(match[1], 45);
    }
    if (match && match[2] && match[2].length > 3) {
      return truncate(match[1] + ': ' + match[2], 45);
    }
  }

  // Fallback: handle regular sentences
  let result;
  
  // If very short response, use as-is
  if (sentences.length === 1 && sentences[0].length < 50) {
    result = sentences[0];
  } 
  // If medium length, take the last meaningful sentence
  else if (sentences.length <= 3) {
    result = sentences[sentences.length - 1];
  }
  // If long response, take the first sentence (main topic) + last sentence (conclusion)
  else {
    const first = sentences[0].substring(0, 30);
    const last = sentences[sentences.length - 1].substring(0, 30);
    result = first + '...' + (lang === 'chinese' ? '' : ' ') + last;
  }
  
  // Clean up common patterns
  result = result
    .replace(/^(wrote|created|fixed|updated|added|removed|modified|installed|deleted|built|tested|debugged|checked|reviewed|completed|finished)\b[\s:]+/i, '$1: ')
    .replace(/^(here(?:'s| is)|i('ve| have)|to summarize)[:\s]+/i, '')
    .replace(/^(是的|好的|ok|okay|yep|yep|sure|certainly)[\s，,]*/i, '')
    .replace(/^(yes|ok|okay|yep|sure|certainly)[\s,]*:/i, '')
    .trim();

  // Check for acknowledgment patterns
  const ackPatterns = lang === 'chinese' 
    ? /^(好的|是的|收到|明白|了解|没问题)/
    : /^(okay|ok|yes|sure|certainly|understood|got it|i see)[\s,.!]*$/i;
  
  if (ackPatterns.test(result)) {
    return lang === 'chinese' ? '好的' : 'ok';
  }
  
  // Extract key info: numbers, paths, names
  const keyInfo = result.match(/(?:[\/~]?[a-zA-Z][\w.-]*|[\u4e00-\u9fff]+[\w]*)/g);
  if (keyInfo && keyInfo.length > 0) {
    // Keep first few meaningful tokens
    const unique = [...new Set(keyInfo)].slice(0, 3).join(' ');
    if (unique.length > 5 && unique.length < result.length) {
      result = unique;
    }
  }

  for (const skip of SKIP_FRAGMENTS) {
    if (skip.test(result)) {
      return hasCode ? 'provided code' : 'completed';
    }
  }

  return truncate(result, 45) || 'completed';
}

function writeNotification(status, summary, metadata) {
  if (!currentNotifyLog) return;

  const localTime = new Date();
  const timeStr = localTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = localTime.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  const statusEmoji = STATUS_EMOJI[status] || '📌';
  const agentIcon = getAgentEmoji(agentName);

  let metaStr = '';
  if (metadata) {
    if (metadata.tokens) metaStr += `${metadata.tokens} tok`;
    if (metadata.tools) metaStr += metaStr ? ` · ${metadata.tools} tools` : `${metadata.tools} tools`;
    if (metadata.duration) metaStr += metaStr ? ` · ${metadata.duration}` : `${metadata.duration}`;
  }

  const sessionColor = getSessionColor(currentDirectory);
  const shortDir = currentDirectory ? currentDirectory.split('/').pop() : 'local';
  const line = `${C.blue}${dateStr}${C.reset} ${C.cyan}${timeStr}${C.reset} ${sessionColor.bg}${sessionColor.fg}${shortDir}${C.reset} ${statusEmoji} ${agentIcon} ${C.yellow}${agentName}${C.reset} ${C.white}${summary}${C.reset}${metaStr ? ` ${C.gray}${metaStr}${C.reset}` : ''}\n`;

  appendFileSync(currentNotifyLog, line);
  rotateLogIfNeeded(currentNotifyLog);
}

function displayMessage(msg) {
  const clean = msg.replace(/\x1b\[[0-9;]*m/g, '');
  
  if (isTmuxAvailable()) {
    try {
      execSync(`tmux display-message "${clean}"`, { encoding: 'utf8', timeout: 1000 });
      return;
    } catch (e) {
      log(`tmux display failed: ${e.message}`);
    }
  }
  
  if (isGhostty) {
    process.stdout.write(`\x1b]0;${clean}\x07`);
  }
  
  log(`display: ${clean}`);
}

const tmuxDisplay = displayMessage;

function updateGhosttyTitle(status, agent, summary) {
  if (!isGhostty && !isTmuxAvailable()) return;
  
  const shortDir = currentDirectory ? currentDirectory.split('/').pop() : 'opencode';
  const agentIcon = getAgentEmoji(agent);
  const statusIcon = STATUS_EMOJI[status] || '📌';
  const title = `[${shortDir}] ${statusIcon} ${agentIcon} ${agent}: ${summary}`;
  const clean = title.replace(/\x1b\[[0-9;]*m/g, '').replace(/[\x00-\x08\x0b-\x1f]/g, '');
  
  if (isGhostty || isTmuxAvailable()) {
    try {
      // Standard terminal title escape sequence (OSC 0)
      process.stdout.write(`\x1b]0;${clean}\x07`);
    } catch (e) {
      log(`Title update failed: ${e.message}`);
    }
  }
}

function sendMacOSNotification(status, agent, summary, metadata) {
  try {
    const statusIcon = STATUS_EMOJI[status] || '📌';
    const agentIcon = getAgentEmoji(agent);
    const shortDir = currentDirectory ? currentDirectory.split('/').pop() : 'opencode';
    let metaStr = '';
    if (metadata) {
      if (metadata.tokens) metaStr += `${metadata.tokens} tok`;
      if (metadata.tools) metaStr += metaStr ? ` · ${metadata.tools} tools` : `${metadata.tools} tools`;
      if (metadata.duration) metaStr += metaStr ? ` · ${metadata.duration}` : `${metadata.duration}`;
    }
    
    // Escape special characters for AppleScript
    const escapeAppleScript = (str) => str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\n/g, ' ')
      .substring(0, 200);
    
    const titleContent = `${shortDir} · ${statusIcon} ${agentIcon} ${summary}`;
    const safeTitle = escapeAppleScript(titleContent);
    const safeMessage = metaStr ? escapeAppleScript(metaStr) : '';
    const script = `display notification "${safeMessage}" with title "${safeTitle}"`;
    execSync(`osascript -e '${script}'`, { encoding: 'utf8', timeout: 2000 });
  } catch (e) {
    log(`Notification error: ${e.message}`);
  }
}

function resetSessionState() {
  toolCallCount = 0;
  totalTokens = 0;
  lastAssistantText = '';
  lastAssistantTextParts = [];
}

function handleSessionChange(sid, directory) {
  log(`Session changed: ${currentSessionID} -> ${sid}`);
  currentSessionID = sid;
  currentDirectory = directory;
  currentNotifyLog = getNotifyLogPath(directory, currentSessionID);
  updateSymlink(currentNotifyLog);
  resetSessionState();
  const shortDir = directory ? directory.split('/').pop() : 'local';
  tmuxDisplay(`${C.cyan}─── ${shortDir} ───${C.reset}`);
}

export const tmuxNotify = async ({ project, client, $, directory, worktree }) => {
  currentNotifyLog = getNotifyLogPath(directory || process.cwd(), 'init');
  log(`Plugin initialized: ${currentNotifyLog}`);

  return {
    event: async ({ event }) => {
      switch (event.type) {
        case 'session.created': {
          const currentDir = directory || process.cwd();
          currentSessionID = event.properties?.sessionID || 'unknown';
          currentDirectory = currentDir;
          currentNotifyLog = getNotifyLogPath(currentDir, currentSessionID);
          updateSymlink(currentNotifyLog);
          resetSessionState();
          log(`Session created: ${currentSessionID} in ${currentDir}`);
          const shortDir = currentDir ? currentDir.split('/').pop() : 'local';
          tmuxDisplay(`${C.cyan}─── ${shortDir} ───${C.reset}`);
          break;
        }

        case 'message.updated': {
          const info = event.properties?.info;
          if (info?.role === 'assistant' && info?.agent) {
            agentName = info.agent;
          }
          const sid = event.properties?.sessionID;
          const currentDir = process.cwd();
          if (sid && sid !== currentSessionID) {
            handleSessionChange(sid, currentDir);
          } else if (currentDir !== currentDirectory) {
            log(`Directory changed: ${currentDirectory} -> ${currentDir}`);
            currentDirectory = currentDir;
            currentSessionID = sid || currentSessionID;
            currentNotifyLog = getNotifyLogPath(currentDir, currentSessionID);
            updateSymlink(currentNotifyLog);
            resetSessionState();
          }
          break;
        }

        case 'message.part.updated': {
          const part = event.properties?.part;
          if (part?.type === 'text' && part?.text) {
            if (part.text.includes('[SUPERMEMORY]') || part.text.includes('Project Knowledge')) {
              log(`Skipping supermemory context`);
            } else {
              lastAssistantTextParts.push(part.text);
              lastAssistantText = part.text;
            }
          }
          if (part?.type === 'tool') toolCallCount++;
          if (part?.type === 'step-finish' && part?.tokens) {
            totalTokens = part.tokens.total || 0;
          }
          break;
        }

        case 'session.status': {
          const sid = event.properties?.sessionID;
          const currentDir = process.cwd();
          if (sid && sid !== currentSessionID) {
            handleSessionChange(sid, currentDir);
          } else if (currentDir !== currentDirectory) {
            log(`Directory changed in session.status: ${currentDirectory} -> ${currentDir}`);
            currentDirectory = currentDir;
            currentSessionID = sid || currentSessionID;
            currentNotifyLog = getNotifyLogPath(currentDir, currentSessionID);
            updateSymlink(currentNotifyLog);
            resetSessionState();
          }
          const status = event.properties?.status?.type;
          if (status !== lastStatus) {
            lastStatus = status;
            const agentIcon = getAgentEmoji(agentName);
            const shortDir = currentDirectory ? currentDirectory.split('/').pop() : 'opencode';

            if (status === 'busy') {
              busyStartTime = Date.now();
              writeNotification(status, 'thinking...', null);
              // Don't show tmux popup during busy - it blocks. Only update sidebar and title.
              updateGhosttyTitle('busy', agentName, 'thinking...');
            } else if (status === 'idle') {
              const elapsed = busyStartTime ? Date.now() - busyStartTime : 0;
              const summary = summarize(lastAssistantText);
              const metadata = {
                tokens: formatTokens(totalTokens),
                tools: toolCallCount > 0 ? toolCallCount : null,
                duration: formatDuration(elapsed),
              };
              writeNotification(status, summary, metadata);
              // Only show tmux popup on completion - deferred until response done
              tmuxDisplay(`${C.green}✅${C.reset} ${shortDir} · ${agentIcon} ${agentName} done: ${summary}`);
              updateGhosttyTitle('idle', agentName, summary);
              sendMacOSNotification(status, agentName, summary, metadata);
              resetSessionState();
            } else if (status === 'error') {
              writeNotification(status, 'error occurred', null);
              // Show tmux popup on error - important signal
              tmuxDisplay(`${C.red}🚨${C.reset} ${shortDir} · ${agentIcon} ${agentName} error!`);
              updateGhosttyTitle('error', agentName, 'error!');
              sendMacOSNotification(status, agentName, 'error occurred', null);
            } else if (status === 'waiting') {
              writeNotification(status, 'waiting for input', null);
              updateGhosttyTitle('waiting', agentName, 'waiting...');
            } else {
              writeNotification(status, STATUS_EMOJI[status] || status, null);
              // Don't show tmux popup for other statuses - just update title
              updateGhosttyTitle(status, agentName, STATUS_EMOJI[status] || status);
            }
          }
          break;
        }

        case 'session.error': {
          const agentIcon = getAgentEmoji(agentName);
          const shortDir = currentDirectory ? currentDirectory.split('/').pop() : 'opencode';
          writeNotification('error', 'error occurred', null);
          tmuxDisplay(`${C.red}🚨${C.reset} ${shortDir} · ${agentIcon} ${agentName} error!`);
          updateGhosttyTitle('error', agentName, 'error!');
          sendMacOSNotification('error', agentName, 'error occurred', null);
          break;
        }
      }
    },
  };
};
