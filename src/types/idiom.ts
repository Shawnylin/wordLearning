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
