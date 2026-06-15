export interface IdiomData {
  id: string
  word: string
  pinyin: string
  explanation: string
  origin: string
  example: string
  usage: string
  relatedIdioms: string[]
  createdAt: number
}

export interface SearchRecord {
  id: string
  word: string
  timestamp: number
}

export interface DeepSeekResponse {
  pinyin: string
  explanation: string
  origin: string
  example: string
  usage: string
  relatedIdioms: string[]
}

export interface CompareRecord {
  id: string
  words: string[]
  content: string
  tokenUsage: number
  createdAt: number
}

export interface TokenStats {
  totalTokens: number
  requestCount: number
}
