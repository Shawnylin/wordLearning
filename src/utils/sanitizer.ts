/**
 * AI 防注入工具
 * 用于清洗用户输入，防止 prompt 注入攻击
 */

// 危险模式列表 - 用于检测可能的注入尝试
const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+(instructions?|prompts?)/i,
  /forget\s+(everything|all|previous)/i,
  /you\s+are\s+now\s+/i,
  /new\s+role\s*:/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /human\s*:\s*/i,
  /assistant\s*:\s*/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /pretend\s+you\s+are/i,
  /act\s+as\s+if/i,
  /bypass\s+(safety|filter|restriction)/i,
  /输出.*密码/i,
  /告诉我.*密钥/i,
  /忽略.*指令/i,
  /无视.*规则/i,
  /扮演.*角色/i,
  /你现在是/i
]

/**
 * 清洗用户输入
 * 1. 去除首尾空白
 * 2. 限制长度
 * 3. 移除潜在注入字符
 * 4. 检测注入模式
 */
export function sanitizeInput(input: string): {
  sanitized: string
  isSuspicious: boolean
  reason?: string
} {
  // 1. 去除首尾空白
  let sanitized = input.trim()

  // 2. 长度限制（成语/词语通常不会超过10个字）
  if (sanitized.length > 20) {
    return {
      sanitized: sanitized.substring(0, 20),
      isSuspicious: true,
      reason: '输入过长，已截断'
    }
  }

  // 3. 空输入检查
  if (sanitized.length === 0) {
    return {
      sanitized: '',
      isSuspicious: false,
      reason: '输入为空'
    }
  }

  // 4. 移除控制字符和特殊 Unicode
  sanitized = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '')

  // 5. 检测注入模式
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      return {
        sanitized,
        isSuspicious: true,
        reason: '检测到可疑输入模式'
      }
    }
  }

  // 6. 检查是否包含过多特殊字符（正常成语/词语主要是中文）
  const chineseCharCount = (sanitized.match(/[一-鿿]/g) || []).length
  if (sanitized.length > 2 && chineseCharCount / sanitized.length < 0.5) {
    return {
      sanitized,
      isSuspicious: true,
      reason: '输入包含过多非中文字符'
    }
  }

  return {
    sanitized,
    isSuspicious: false
  }
}

/**
 * 验证 DeepSeek 返回的数据结构
 */
export function validateIdiomData(data: any): boolean {
  if (!data || typeof data !== 'object') return false

  const requiredFields = ['pinyin', 'explanation', 'origin', 'example', 'usage', 'relatedIdioms']
  for (const field of requiredFields) {
    if (!(field in data)) return false
    if (field === 'relatedIdioms') {
      if (!Array.isArray(data[field])) return false
    } else {
      if (typeof data[field] !== 'string') return false
    }
  }

  return true
}
