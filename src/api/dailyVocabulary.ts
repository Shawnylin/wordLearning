// Structural validation only: learning value must be judged in context by the model.
export function normalizeStudyWords(value: unknown, content: string, limit = 20): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[、,，;；\n]/) : []
  const words = [...new Set<string>(items.flatMap(item => {
    const raw = typeof item === 'string' ? item : item && typeof item === 'object' ? item.word : undefined
    if (typeof raw !== 'string') return []
    const word = raw.trim().replace(/^[「『“"'《【*_\s]+|[」』”"'》】*_\s]+$/g, '')
    return /^[\u3400-\u9fff]{2,12}$/.test(word) && content.includes(word) ? [word] : []
  }))]
  // Keep complete collocations rather than spending a second slot on their nouns.
  return words.filter(word => !words.some(other => other !== word && other.includes(word))).slice(0, limit)
}

// Shared by search, URL import, PDF parsing and bounded format repair.
export const dailyVocabularyRules = `人民日报评论词语筛选规则：以公务员考试逻辑填空、文段理解和正式议论文表达的学习价值为标准，不把文章主题关键词当作积累词。
先对完整原文逐句扫描，再按“强制收录”和“择优收录”两级输出，不能只挑最醒目的几项：
一、强制收录（只要在原文中出现就必须放入 words，不得因常见、数量限制或主观认为简单而遗漏）：
1. 所有规范成语，包括四字成语及非四字成语。例如原文出现“面面俱到”“浅尝辄止”时，两者都必须分别收录并划线。
2. 具有固定比喻义、引申义、政策语境特定义或稳定惯用搭配的表达。例如“牵住牛鼻子”中的“牛鼻子”指关键环节，必须收录；类似“压舱石、定盘星、试金石、组合拳、基本盘”也不能按普通口语或基础名词排除。
二、择优收录（在完成上述强制扫描后，再结合当前语境筛选）：
1. 易混近义词：如遏制/遏止、涵养/培养、凸显/彰显、审视/检视，关注适用语境、对象及近义词不能互换的原因。
2. 固定搭配：如夯实基础、激发活力、释放潜能、凝聚共识、补齐短板、筑牢防线、厚植优势。优先标记原文完整的“动词＋宾语”，不拆成孤立的基础名词，不重复选取已包含在搭配内的词。
3. 程度或语义有差异的词：如改善—优化—重塑、推动—促进—驱动—引领、问题—隐患—顽疾—掣肘。仅在原文确有词义轻重、适用对象或表达辨析价值时选取，不因出现在示例中就机械标记。
4. 评论常用抽象概括词：如底色、成色、底气、韧性、动能、势能、效能、效应、变量、增量、存量。关注政策语境中的实际指向，不选仅作日常字面描述的用法。
5. 逻辑关系词：如归根结底、究其根本、诚然、然而、由此可见，以及与其……不如……、既要……更要……、不仅在于……更在于……。关注归因、转折、递进、取舍、结论等文段结构作用。
6. 其他适合辨析的熟语或固定表达，关注适用语境、搭配对象、褒贬及使用限制，不只背释义。
排除：无固定引申义的普通口语词、只有主题指代作用的基础名词、人名地名机构名、生僻典故、纯文学修辞。不能仅因“重要、反复出现、与政策有关”就选取，例如孤立的城市、企业、学校、工作通常不标记。“牛鼻子”等固定比喻表达不属于这里所说的普通口语。示例用于说明标准，不是白名单。
输出 words 前先核对强制项是否全部覆盖，再判断择优项在当前语境中能学到什么搭配、辨析或逻辑作用；说不清则删除择优项。强制项全部保留，其余择优项最多补充6项，words 总数最多20项，不为凑数加入普通词。
words 仍是纯字符串数组，每项为原文连续逐字出现的2至12个汉字，不改写、不补词，不输出斜杠、破折号、省略号或解释。跨句式逻辑结构按原文分别标记实际出现的连接部分（如“既要”“更要”），不能把不连续的文字拼成一个词；其完整逻辑关系可在 analysis 中说明。
若输出 analysis，应结合本段指出代表性词语的搭配对象、易混差异或逻辑作用，避免泛泛评价“表达生动、主题鲜明”；不要凭空添加原文没有的搭配。`;
