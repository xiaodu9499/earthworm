/**
 * Conservative, offline enrichment for the standalone learning website.
 *
 * This module deliberately leaves unknown facts blank.  Course data is the
 * preferred source for pronunciation and meaning; the small built-in lexicon
 * only supplies common beginner vocabulary and grammatical function words.
 */

export type LearningStatement = {
  id: string;
  chinese: string;
  english: string;
  soundmark?: string;
};

export type WordDetail = {
  word: string;
  soundmark: string;
  partOfSpeech: string;
  meaning: string;
  role: string;
  phrase: string;
  explanation: string;
};

export type SentenceStructureRole =
  | "subject"
  | "predicate"
  | "object"
  | "complement"
  | "modifier"
  | "adverbial"
  | "connector"
  | "unknown";

export type SentenceStructureGroup = {
  role: SentenceStructureRole;
  label: string;
  text: string;
  tokenIndexes: number[];
  explanation: string;
  /** Heuristic groups never claim more than medium confidence. */
  confidence: "high" | "medium" | "low";
};

export type LexiconEntry = {
  soundmark?: string;
  partOfSpeech?: string;
  meaning?: string;
  explanation?: string;
};

export type LearningLexicon = Record<string, LexiconEntry>;

export type EnrichedStatement = {
  words: WordDetail[];
  sentenceStructure: SentenceStructureGroup[];
  /** Explains why a structure may be partial instead of inventing a parse. */
  structureNote: string;
};

type InternalLexiconEntry = LexiconEntry & {
  ipa?: readonly string[];
};

const WORD_PATTERN = /[\p{L}\p{M}]+(?:[\u2019'-][\p{L}\p{M}]+)*|\d+(?:[.,]\d+)*/gu;

export function tokenizeEnglish(english: string): string[] {
  return english.match(WORD_PATTERN) ?? [];
}

function normalizeWord(word: string): string {
  return word.toLocaleLowerCase("en-US").replaceAll("\u2019", "'");
}

function entry(
  partOfSpeech: string,
  meaning: string,
  explanation: string,
  ...ipa: string[]
): InternalLexiconEntry {
  return { partOfSpeech, meaning, explanation, ipa };
}

const BUILTIN_LEXICON: Record<string, InternalLexiconEntry> = {
  // Pronouns and determiners
  i: entry("代词", "我", "第一人称单数主格。", "/aɪ/"),
  you: entry("代词", "你；你们", "第二人称代词，可作主语或宾语。", "/ju/", "/jə/"),
  he: entry("代词", "他", "第三人称男性单数主格。", "/hi/"),
  she: entry("代词", "她", "第三人称女性单数主格。", "/ʃi/"),
  it: entry("代词", "它；这件事", "第三人称单数代词，也可指代事物或情况。", "/ɪt/"),
  we: entry("代词", "我们", "第一人称复数主格。", "/wi/"),
  they: entry("代词", "他们；它们", "第三人称复数主格。", "/ðeɪ/", "/ðe/"),
  me: entry("代词", "我", "第一人称单数宾格。", "/mi/"),
  him: entry("代词", "他", "第三人称男性单数宾格。", "/hɪm/"),
  her: entry("代词；限定词", "她；她的", "可作宾格代词，也可放在名词前表示所属。", "/hɝ/", "/hər/"),
  us: entry("代词", "我们", "第一人称复数宾格。", "/ʌs/", "/əs/"),
  them: entry("代词", "他们；它们", "第三人称复数宾格。", "/ðɛm/", "/ðəm/"),
  my: entry("限定词", "我的", "放在名词前表示所属。", "/maɪ/"),
  your: entry("限定词", "你的；你们的", "放在名词前表示所属。", "/jʊr/", "/jər/"),
  his: entry("限定词；代词", "他的", "表示男性第三人称所属。", "/hɪz/"),
  our: entry("限定词", "我们的", "放在名词前表示所属。", "/aʊr/", "/ɑr/"),
  their: entry("限定词", "他们的；它们的", "放在名词前表示所属。", "/ðɛr/"),
  this: entry("限定词；代词", "这个", "指靠近说话者的人或事物。", "/ðɪs/"),
  that: entry(
    "限定词；代词；连词",
    "那个；那；引导从句",
    "含义取决于它在句中的位置。",
    "/ðæt/",
    "/ðət/",
  ),
  these: entry("限定词；代词", "这些", "this 的复数形式。", "/ðiz/"),
  those: entry("限定词；代词", "那些", "that 的复数形式。", "/ðoz/"),
  a: entry("冠词", "一个", "用于辅音音素开头的单数可数名词前。", "/ə/", "/eɪ/"),
  an: entry("冠词", "一个", "用于元音音素开头的单数可数名词前。", "/ən/", "/æn/"),
  the: entry(
    "定冠词",
    "这个；这些；特指的",
    "表示说话双方知道或已提到的人或事物。",
    "/ðə/",
    "/ði/",
  ),
  some: entry("限定词；代词", "一些", "表示不确定的数量。", "/sʌm/", "/səm/"),
  any: entry("限定词；代词", "任何；一些", "常用于疑问句和否定句。", "/ˈɛni/"),
  every: entry(
    "限定词",
    "每一个",
    "修饰单数可数名词，强调整体中的每个成员。",
    "/'ɛvri/",
    "/ˈɛvri/",
  ),
  all: entry("限定词；代词", "全部；所有", "表示一个群体或数量的整体。", "/ɔl/"),

  // Be, auxiliaries and modals
  am: entry("be 动词", "是；处于", "be 的第一人称单数现在式。", "/æm/", "/əm/"),
  is: entry("be 动词", "是；处于", "be 的第三人称单数现在式。", "/ɪz/", "/z/"),
  are: entry("be 动词", "是；处于", "be 的复数及第二人称现在式。", "/ɑr/", "/ɚ/"),
  was: entry("be 动词", "曾是；曾处于", "am/is 的过去式。", "/wʌz/", "/wəz/"),
  were: entry("be 动词", "曾是；曾处于", "are 的过去式，也用于部分虚拟语气。", "/wɝ/", "/wər/"),
  be: entry("动词", "是；成为；处于", "be 动词原形。", "/bi/"),
  been: entry("动词", "曾经是；已经处于", "be 的过去分词。", "/bɪn/", "/bin/"),
  being: entry("动词", "正在处于；存在", "be 的现在分词。", "/ˈbiɪŋ/"),
  do: entry(
    "动词；助动词",
    "做；用于构成疑问或否定",
    "作实义动词时表示“做”，也可帮助构成句式。",
    "/du/",
  ),
  does: entry("助动词；动词", "做；用于构成疑问或否定", "do 的第三人称单数形式。", "/dʌz/"),
  did: entry("助动词；动词", "做了；用于过去时疑问或否定", "do 的过去式。", "/dɪd/"),
  "don't": entry("助动词", "不；不要", "do not 的缩写，后接动词原形。", "/dont/", "/doʊnt/"),
  "doesn't": entry("助动词", "不", "does not 的缩写，后接动词原形。", "/ˈdʌznt/", "/dʌzənt/"),
  "didn't": entry("助动词", "没有；没做", "did not 的缩写，后接动词原形。", "/ˈdɪdnt/", "/dɪdənt/"),
  have: entry("动词；助动词", "有；已经", "可表示拥有，也可帮助构成完成时。", "/hæv/", "/həv/"),
  has: entry("动词；助动词", "有；已经", "have 的第三人称单数形式。", "/hæz/", "/həz/"),
  had: entry("动词；助动词", "曾有；已经", "have 的过去式和过去分词。", "/hæd/", "/həd/"),
  can: entry("情态动词", "能；可以", "表示能力、许可或可能性，后接动词原形。", "/kæn/", "/kən/"),
  "can't": entry("情态动词", "不能；不可以", "cannot 的缩写。", "/kænt/"),
  could: entry(
    "情态动词",
    "能够；可能；可以",
    "can 的过去式，也可表达更委婉的请求或可能性。",
    "/kʊd/",
  ),
  will: entry("情态动词", "将；会", "表示将来、意愿或预测，后接动词原形。", "/wɪl/", "/wəl/"),
  would: entry("情态动词", "会；愿意", "可表达假设、过去将来或委婉语气。", "/wʊd/", "/wəd/"),
  should: entry("情态动词", "应该", "表示建议、义务或预期。", "/ʃʊd/"),
  must: entry("情态动词", "必须；一定", "表示强制、必要或较强推断。", "/mʌst/"),
  may: entry("情态动词", "可以；可能", "表示许可或可能性。", "/meɪ/"),
  might: entry("情态动词", "可能", "表示较弱的可能性。", "/maɪt/"),
  not: entry("副词", "不；没有", "用于否定动词、形容词或其他成分。", "/nɑt/", "/nɒt/"),

  // Common verbs in the beginner course
  like: entry("动词；介词", "喜欢；像", "作动词时表示喜爱；作介词时表示相似。", "/laɪk/"),
  want: entry("动词", "想要", "want to 后接动词原形，表示想做某事。", "/wɑnt/", "/wɒnt/"),
  need: entry("动词；名词", "需要；需要的事物", "作动词时表示必要或需求。", "/nid/"),
  know: entry("动词", "知道；了解", "表示掌握信息或熟悉某人某事。", "/no/", "/noʊ/"),
  tell: entry("动词", "告诉；讲述", "常见结构为 tell somebody something。", "/tɛl/"),
  give: entry("动词", "给；提供", "常见结构为 give somebody something。", "/ɡɪv/"),
  get: entry("动词", "得到；到达；变得", "含义依上下文而变化。", "/ɡɛt/"),
  make: entry("动词", "制作；使得", "可表示制造，也可构成 make somebody do something。", "/meɪk/"),
  take: entry("动词", "拿；带；花费", "含义依搭配和上下文而变化。", "/teɪk/"),
  go: entry("动词", "去；走", "表示离开当前地点或前往某处。", "/ɡo/", "/ɡoʊ/"),
  come: entry("动词", "来", "表示向说话者或参照点移动。", "/kʌm/"),
  stay: entry("动词", "停留；保持", "表示留在某处或保持某种状态。", "/ste/", "/steɪ/"),
  leave: entry("动词", "离开；留下", "具体含义由宾语和上下文决定。", "/liv/"),
  eat: entry("动词", "吃", "表示吃食物。", "/it/"),
  drink: entry("动词；名词", "喝；饮料", "作动词时表示饮用。", "/drɪŋk/"),
  sleep: entry("动词；名词", "睡觉；睡眠", "表示进入睡眠状态。", "/slip/"),
  work: entry("动词；名词", "工作；起作用；工作", "含义需结合句子判断。", "/wɝk/"),
  read: entry("动词", "阅读", "现在式常读 /riːd/，过去式拼写不变但读 /red/。", "/rid/", "/rɛd/"),
  write: entry("动词", "写", "表示书写或创作文字。", "/raɪt/"),
  speak: entry("动词", "说；讲某种语言", "强调说话能力或语言。", "/spik/"),
  talk: entry("动词；名词", "谈话；交谈", "常与 to/with/about 搭配。", "/tɔk/"),
  say: entry("动词", "说", "侧重说出的内容。", "/se/", "/seɪ/"),
  see: entry("动词", "看见；明白", "表示视觉感知，也可表示理解。", "/si/"),
  look: entry("动词；名词", "看；看起来；外观", "look at 表示“看向”。", "/lʊk/"),
  watch: entry("动词；名词", "观看；手表", "作动词时强调持续观看。", "/wɑtʃ/"),
  hear: entry("动词", "听见", "表示听觉感知。", "/hɪr/"),
  listen: entry("动词", "听", "listen to 表示有意识地听。", "/ˈlɪsən/"),
  find: entry("动词", "找到；发现", "可表示找到具体事物或发现事实。", "/faɪnd/"),
  think: entry("动词", "想；认为", "可表示思考或表达观点。", "/θɪŋk/"),
  remember: entry("动词", "记得", "表示保留或唤起记忆。", "/rɪˈmɛmbɚ/"),
  forget: entry("动词", "忘记", "表示没有记住某事。", "/fɚˈɡɛt/"),
  understand: entry("动词", "理解", "表示明白意思、原因或情况。", "/ˌʌndɚˈstænd/"),
  explain: entry(
    "动词",
    "解释",
    "常见结构为 explain something to somebody。",
    "/ɪk'splen/",
    "/ɪkˈspleɪn/",
  ),
  ask: entry("动词", "问；请求", "可表示提问或请求某人做事。", "/æsk/"),
  answer: entry("动词；名词", "回答；答案", "可作动词或名词。", "/ˈænsɚ/"),
  help: entry(
    "动词；名词",
    "帮助",
    "help somebody (to) do something 表示帮助某人做某事。",
    "/hɛlp/",
  ),
  use: entry("动词；名词", "使用；用途", "作动词时读 /juːz/。", "/juz/"),
  buy: entry("动词", "买", "表示用钱购买。", "/baɪ/"),
  pay: entry("动词", "支付；付钱", "可与 for 搭配表示为某物付款。", "/pe/", "/peɪ/"),
  call: entry("动词；名词", "打电话；称呼；电话", "含义依宾语和上下文而变化。", "/kɔl/"),
  keep: entry("动词", "保持；保留", "可表示持续某状态或保存某物。", "/kip/"),
  let: entry("动词", "让；允许", "let somebody do something 后接不带 to 的动词原形。", "/lɛt/"),
  plan: entry("动词；名词", "计划", "plan to do something 表示计划做某事。", "/plæn/"),
  decide: entry("动词", "决定", "decide to do something 表示决定做某事。", "/dɪˈsaɪd/"),
  solve: entry("动词", "解决", "通常用于问题或难题。", "/sɑlv/"),
  finish: entry("动词；名词", "完成；结束", "表示使某事结束或完成。", "/ˈfɪnɪʃ/"),
  play: entry("动词；名词", "玩；演奏；比赛", "含义取决于宾语。", "/ple/", "/pleɪ/"),
  drive: entry("动词；名词", "驾驶；驱动", "作动词时表示驾驶车辆或驱使。", "/draɪv/"),

  // Frequent nouns, adjectives and adverbs
  food: entry("名词", "食物", "泛指供人或动物食用的东西。", "/fud/"),
  water: entry("名词；动词", "水；浇水", "作名词时通常不可数。", "/ˈwɔtɚ/"),
  home: entry("名词；副词", "家；在家；回家", "作副词时通常不需要介词 to。", "/hom/", "/hoʊm/"),
  house: entry("名词", "房子", "指供人居住的建筑物。", "/haʊs/"),
  room: entry("名词", "房间；空间", "可指具体房间或可用空间。", "/rum/"),
  school: entry("名词", "学校", "指教育机构或上学活动。", "/skul/"),
  teacher: entry("名词", "老师", "从事教学的人。", "/ˈtitʃɚ/"),
  friend: entry("名词", "朋友", "彼此熟悉并有友好关系的人。", "/frɛnd/"),
  family: entry("名词", "家庭；家人", "可指家庭整体或家庭成员。", "/ˈfæməli/"),
  book: entry("名词；动词", "书；预订", "含义依词性和上下文而变化。", "/bʊk/"),
  dictionary: entry(
    "名词",
    "词典",
    "解释词义、读音和用法的工具书。",
    "/'dɪkʃənɛri/",
    "/ˈdɪkʃəˌnɛri/",
  ),
  question: entry("名词", "问题", "需要回答的提问。", "/ˈkwɛstʃən/"),
  problem: entry("名词", "问题；难题", "指需要处理或解决的困难。", "/ˈprɑbləm/"),
  reason: entry("名词", "原因；理由", "解释某事为何发生。", "/ˈrizən/"),
  time: entry("名词", "时间；次数", "具体含义由搭配决定。", "/taɪm/"),
  day: entry("名词", "天；白天", "二十四小时的一天或白天时段。", "/de/", "/deɪ/"),
  night: entry("名词", "夜晚", "从傍晚到清晨的时段。", "/naɪt/"),
  today: entry("名词；副词", "今天", "表示当天。", "/tə'de/", "/təˈdeɪ/"),
  tomorrow: entry("名词；副词", "明天", "表示今天之后的一天。", "/təˈmɑroʊ/"),
  yesterday: entry("名词；副词", "昨天", "表示今天之前的一天。", "/ˈjɛstɚdeɪ/"),
  now: entry("副词；名词", "现在", "表示当前时刻。", "/naʊ/"),
  here: entry("副词", "这里；在这里", "表示靠近说话者的位置。", "/hɪr/"),
  there: entry("副词；引导词", "那里；有", "可表示地点，也可用于 there be 句型。", "/ðɛr/"),
  good: entry("形容词", "好的", "描述质量令人满意。", "/ɡʊd/"),
  important: entry("形容词", "重要的", "表示具有较大意义或影响。", "/ɪm'pɔrtnt/", "/ɪmˈpɔrtənt/"),
  possible: entry("形容词", "可能的", "表示能够发生或做到。", "/ˈpɑsəbəl/"),
  impossible: entry("形容词", "不可能的", "表示不能发生或做到。", "/ɪm'pɑsəbl/", "/ɪmˈpɑsəbəl/"),
  very: entry("副词", "非常", "加强形容词或副词的程度。", "/ˈvɛri/"),
  more: entry("限定词；代词；副词", "更多；更", "表示数量或程度增加。", "/mɔr/"),
  most: entry("限定词；代词；副词", "最多；最", "表示最高数量或程度。", "/most/", "/moʊst/"),
  enough: entry("限定词；代词；副词", "足够的；足够地", "表示达到所需数量或程度。", "/ɪˈnʌf/"),
  just: entry("副词", "刚刚；正好；只是", "具体含义依上下文判断。", "/dʒʌst/"),
  ever: entry("副词", "曾经；在任何时候", "常用于疑问句、条件句或最高级结构。", "/ˈɛvɚ/"),
  never: entry("副词", "从不", "表示在任何时候都不。", "/ˈnɛvɚ/"),

  // Prepositions, conjunctions and question words
  to: entry(
    "不定式标记；介词",
    "去；向；到；用于动词不定式",
    "需结合后面的词判断是介词还是不定式标记。",
    "/tə/",
    "/tu/",
  ),
  of: entry("介词", "……的；属于", "连接两个名词性成分。", "/əv/", "/ʌv/"),
  in: entry("介词；副词", "在……里面", "表示内部的地点、时间范围或状态。", "/ɪn/"),
  on: entry("介词；副词", "在……上；在某日", "可表示接触表面、日期或持续状态。", "/ɑn/", "/ɒn/"),
  at: entry("介词", "在；向", "常用于具体时间点或地点点位。", "/æt/", "/ət/"),
  for: entry("介词；连词", "为了；给；持续", "含义由它连接的成分决定。", "/fɔr/", "/fɚ/"),
  from: entry("介词", "从；来自", "表示起点、来源或分离。", "/frʌm/", "/frəm/"),
  with: entry("介词", "和；用；带有", "可表示陪伴、工具或具有。", "/wɪð/", "/wɪθ/"),
  about: entry("介词；副词", "关于；大约", "可表示主题或近似数量。", "/əˈbaʊt/"),
  by: entry("介词；副词", "由；通过；在旁边；截至", "具体关系由上下文决定。", "/baɪ/"),
  before: entry("介词；连词；副词", "在……之前", "表示时间或顺序在先。", "/bɪˈfɔr/"),
  after: entry("介词；连词；副词", "在……之后", "表示时间或顺序在后。", "/ˈæftɚ/"),
  between: entry("介词", "在……之间", "通常表示两个或多个明确对象之间。", "/bɪˈtwin/"),
  and: entry("连词", "和；并且", "连接并列的词、短语或分句。", "/ænd/", "/ənd/"),
  but: entry("连词；介词", "但是；除……之外", "常连接语义转折的成分。", "/bʌt/", "/bət/"),
  or: entry("连词", "或者；否则", "连接可选择的词、短语或分句。", "/ɔr/", "/ɚ/"),
  because: entry("连词", "因为", "引导原因从句。", "/bɪ'kɔz/", "/bɪˈkɔz/"),
  if: entry("连词", "如果；是否", "可引导条件从句或宾语从句。", "/ɪf/"),
  when: entry("疑问副词；连词", "什么时候；当……时", "可提问时间或引导时间从句。", "/wɛn/"),
  where: entry("疑问副词；连词", "哪里；在……的地方", "可提问地点或引导从句。", "/wɛr/"),
  why: entry("疑问副词；连词", "为什么；……的原因", "可提问原因或引导从句。", "/waɪ/"),
  how: entry("疑问副词", "怎样；如何", "询问方式、状态或程度。", "/haʊ/"),
  what: entry("疑问代词；限定词", "什么", "询问事物、信息或类别。", "/wʌt/"),
  who: entry("疑问代词", "谁", "询问人的身份。", "/hu/"),
};

const PHRASES: ReadonlyArray<{ words: readonly string[]; meaning: string; explanation: string }> = [
  {
    words: ["have", "to"],
    meaning: "必须；不得不",
    explanation: "have to 后接动词原形，表示客观需要。",
  },
  {
    words: ["has", "to"],
    meaning: "必须；不得不",
    explanation: "has to 是 have to 的第三人称单数形式。",
  },
  { words: ["had", "to"], meaning: "过去必须；不得不", explanation: "had to 表示过去的必要性。" },
  {
    words: ["don't", "have", "to"],
    meaning: "不必",
    explanation: "don't have to 表示没有必要，不等于“禁止”。",
  },
  {
    words: ["doesn't", "have", "to"],
    meaning: "不必",
    explanation: "doesn't have to 是第三人称单数形式。",
  },
  { words: ["want", "to"], meaning: "想要做", explanation: "want to 后接动词原形。" },
  { words: ["wants", "to"], meaning: "想要做", explanation: "wants to 用于第三人称单数主语。" },
  { words: ["need", "to"], meaning: "需要做", explanation: "need to 后接动词原形。" },
  { words: ["needs", "to"], meaning: "需要做", explanation: "needs to 用于第三人称单数主语。" },
  { words: ["plan", "to"], meaning: "计划做", explanation: "plan to 后接动词原形。" },
  {
    words: ["be", "able", "to"],
    meaning: "能够",
    explanation: "be able to 表示具备做某事的能力。",
  },
  {
    words: ["every", "day"],
    meaning: "每天",
    explanation: "every day 是时间频率短语；everyday 是形容词。",
  },
  { words: ["right", "now"], meaning: "现在；立刻", explanation: "right 加强 now 的即时性。" },
  { words: ["look", "for"], meaning: "寻找", explanation: "look for 是固定搭配。" },
  { words: ["listen", "to"], meaning: "听", explanation: "listen 后接对象时通常使用介词 to。" },
  { words: ["at", "night"], meaning: "在夜晚", explanation: "表示夜间这一时间段。" },
];

const SUBJECT_WORDS = new Set([
  "i",
  "you",
  "he",
  "she",
  "it",
  "we",
  "they",
  "this",
  "that",
  "these",
  "those",
  "who",
  "what",
  "there",
]);
const DETERMINERS = new Set([
  "a",
  "an",
  "the",
  "this",
  "that",
  "these",
  "those",
  "my",
  "your",
  "his",
  "her",
  "our",
  "their",
  "some",
  "any",
  "every",
  "all",
]);
const AUXILIARIES = new Set([
  "am",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "do",
  "does",
  "did",
  "don't",
  "doesn't",
  "didn't",
  "have",
  "has",
  "had",
  "can",
  "can't",
  "could",
  "will",
  "would",
  "should",
  "must",
  "may",
  "might",
]);
const PREPOSITIONS = new Set([
  "to",
  "of",
  "in",
  "on",
  "at",
  "for",
  "from",
  "with",
  "about",
  "by",
  "before",
  "after",
  "between",
  "under",
  "over",
  "into",
  "through",
]);
const CONNECTORS = new Set([
  "and",
  "but",
  "or",
  "because",
  "if",
  "when",
  "while",
  "although",
  "so",
]);
const TIME_ADVERBS = new Set([
  "now",
  "today",
  "tomorrow",
  "yesterday",
  "tonight",
  "here",
  "there",
  "always",
  "usually",
  "often",
  "sometimes",
  "never",
]);
const IRREGULAR_LEMMAS: Record<string, string> = {
  likes: "like",
  wants: "want",
  needs: "need",
  knows: "know",
  tells: "tell",
  gives: "give",
  makes: "make",
  takes: "take",
  comes: "come",
  stays: "stay",
  leaves: "leave",
  eats: "eat",
  reads: "read",
  writes: "write",
  speaks: "speak",
  says: "say",
  sees: "see",
  watches: "watch",
  hears: "hear",
  finds: "find",
  thinks: "think",
  asks: "ask",
  uses: "use",
  buys: "buy",
  pays: "pay",
  calls: "call",
  keeps: "keep",
  lets: "let",
  plans: "plan",
  decides: "decide",
  solves: "solve",
  finishes: "finish",
  plays: "play",
  drives: "drive",
  went: "go",
  gone: "go",
  came: "come",
  taken: "take",
  took: "take",
  made: "make",
  gave: "give",
  given: "give",
  knew: "know",
  known: "know",
  told: "tell",
  got: "get",
  eaten: "eat",
  ate: "eat",
  slept: "sleep",
  thought: "think",
  bought: "buy",
  paid: "pay",
  left: "leave",
  found: "find",
  said: "say",
  seen: "see",
};

function candidateLemmas(word: string): string[] {
  const normalized = normalizeWord(word);
  const candidates = [normalized];
  if (IRREGULAR_LEMMAS[normalized]) candidates.push(IRREGULAR_LEMMAS[normalized]);
  if (normalized.endsWith("ies") && normalized.length > 4)
    candidates.push(`${normalized.slice(0, -3)}y`);
  if (normalized.endsWith("ing") && normalized.length > 5) {
    const stem = normalized.slice(0, -3);
    candidates.push(stem, `${stem}e`);
    if (stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1));
  }
  if (normalized.endsWith("ed") && normalized.length > 4) {
    const stem = normalized.slice(0, -2);
    candidates.push(stem, `${stem}e`);
    if (stem.endsWith("i")) candidates.push(`${stem.slice(0, -1)}y`);
    if (stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1));
  }
  if (normalized.endsWith("es") && normalized.length > 4) candidates.push(normalized.slice(0, -2));
  if (normalized.endsWith("s") && normalized.length > 3) candidates.push(normalized.slice(0, -1));
  return [...new Set(candidates)];
}

function lookup(word: string, lexicon: LearningLexicon): InternalLexiconEntry | undefined {
  const candidates = candidateLemmas(word);
  for (const candidate of candidates) {
    const builtIn = BUILTIN_LEXICON[candidate];
    const learned = lexicon[candidate];
    if (builtIn || learned) {
      return {
        ...builtIn,
        ...learned,
        ipa: learned?.soundmark ? [learned.soundmark] : builtIn?.ipa,
      };
    }
  }
  return undefined;
}

function extractSoundmarks(soundmark?: string): string[] {
  if (!soundmark) return [];
  const slashWrapped = soundmark.match(/\/[^/]+\//g);
  if (slashWrapped?.length) return slashWrapped.map((value) => value.trim());
  // A few imported sources omit slashes but separate token IPA with spaces.
  return soundmark.trim().split(/\s+/).filter(Boolean);
}

function isPlausibleSoundmark(soundmark: string): boolean {
  // Imported course data occasionally contains placeholders such as
  // "/Xingrong/" or "/C40/". They are labels, not pronunciation evidence.
  return !/[A-Z0-9]/.test(soundmark) && soundmark.length >= 3;
}

function normalizeIpa(value: string): string {
  return value
    .replaceAll("/", "")
    .replace(/[\s.'ˈˌ]/g, "")
    .toLocaleLowerCase("en-US");
}

function ipaMatches(entryValue: InternalLexiconEntry | undefined, soundmark: string): boolean {
  if (!entryValue) return false;
  const target = normalizeIpa(soundmark);
  const candidates = [
    ...(entryValue.ipa ?? []),
    ...(entryValue.soundmark ? [entryValue.soundmark] : []),
  ];
  return candidates.some((candidate) => normalizeIpa(candidate) === target);
}

/**
 * Aligns sentence-level IPA segments to tokens. Exact-length data stays in its
 * original order. For malformed imported rows a small dynamic programme can
 * skip a missing proper-name pronunciation or an accidental extra IPA segment.
 */
function alignSoundmarks(
  tokens: readonly string[],
  soundmark: string | undefined,
  lexicon: LearningLexicon,
): string[] {
  const segments = extractSoundmarks(soundmark).filter(isPlausibleSoundmark);
  if (segments.length === tokens.length) return segments;
  if (!segments.length) return tokens.map(() => "");

  const tokenCount = tokens.length;
  const segmentCount = segments.length;
  const costs = Array.from({ length: tokenCount + 1 }, () =>
    Array(segmentCount + 1).fill(Number.POSITIVE_INFINITY),
  );
  const action: Array<Array<"pair" | "skip-token" | "skip-segment" | undefined>> = Array.from(
    { length: tokenCount + 1 },
    () => Array(segmentCount + 1).fill(undefined),
  );
  costs[0][0] = 0;

  for (let tokenIndex = 0; tokenIndex <= tokenCount; tokenIndex += 1) {
    for (let segmentIndex = 0; segmentIndex <= segmentCount; segmentIndex += 1) {
      const current = costs[tokenIndex][segmentIndex];
      if (!Number.isFinite(current)) continue;
      if (tokenIndex < tokenCount && segmentIndex < segmentCount) {
        const known = lookup(tokens[tokenIndex], lexicon);
        const pairCost = ipaMatches(known, segments[segmentIndex]) ? 0 : known ? 1.8 : 0.65;
        if (current + pairCost < costs[tokenIndex + 1][segmentIndex + 1]) {
          costs[tokenIndex + 1][segmentIndex + 1] = current + pairCost;
          action[tokenIndex + 1][segmentIndex + 1] = "pair";
        }
      }
      if (tokenIndex < tokenCount) {
        const known = lookup(tokens[tokenIndex], lexicon);
        const skipCost = known ? 1.05 : 0.35;
        if (current + skipCost < costs[tokenIndex + 1][segmentIndex]) {
          costs[tokenIndex + 1][segmentIndex] = current + skipCost;
          action[tokenIndex + 1][segmentIndex] = "skip-token";
        }
      }
      if (segmentIndex < segmentCount && current + 0.9 < costs[tokenIndex][segmentIndex + 1]) {
        costs[tokenIndex][segmentIndex + 1] = current + 0.9;
        action[tokenIndex][segmentIndex + 1] = "skip-segment";
      }
    }
  }

  const aligned = tokens.map(() => "");
  let tokenIndex = tokenCount;
  let segmentIndex = segmentCount;
  while (tokenIndex > 0 || segmentIndex > 0) {
    const step = action[tokenIndex][segmentIndex];
    if (step === "pair") {
      aligned[tokenIndex - 1] = segments[segmentIndex - 1];
      tokenIndex -= 1;
      segmentIndex -= 1;
    } else if (step === "skip-token") {
      tokenIndex -= 1;
    } else if (step === "skip-segment") {
      segmentIndex -= 1;
    } else {
      break;
    }
  }
  return aligned;
}

/**
 * Builds a high-confidence lexicon from atomic course entries such as
 * english="like", chinese="喜欢", soundmark="/laɪk/". Repeated rows vote for
 * the most common value, avoiding arbitrary last-write-wins behaviour.
 */
export function buildLearningLexicon(statements: readonly LearningStatement[]): LearningLexicon {
  type Votes = { meanings: Map<string, number>; soundmarks: Map<string, number> };
  const votes = new Map<string, Votes>();

  for (const statement of statements) {
    const tokens = tokenizeEnglish(statement.english);
    const chinese = statement.chinese.trim();
    if (tokens.length !== 1 || !chinese || chinese.length > 40) continue;
    const key = normalizeWord(tokens[0]);
    const bucket = votes.get(key) ?? { meanings: new Map(), soundmarks: new Map() };
    bucket.meanings.set(chinese, (bucket.meanings.get(chinese) ?? 0) + 1);
    const marks = extractSoundmarks(statement.soundmark);
    if (marks.length === 1 && isPlausibleSoundmark(marks[0])) {
      bucket.soundmarks.set(marks[0], (bucket.soundmarks.get(marks[0]) ?? 0) + 1);
    }
    votes.set(key, bucket);
  }

  const choose = (values: Map<string, number>): string | undefined =>
    [...values.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].length - right[0].length,
    )[0]?.[0];

  const result: LearningLexicon = Object.fromEntries(
    Object.entries(BUILTIN_LEXICON).map(([word, value]) => [
      word,
      {
        soundmark: value.soundmark ?? value.ipa?.[0],
        partOfSpeech: value.partOfSpeech,
        meaning: value.meaning,
        explanation: value.explanation,
      },
    ]),
  );
  for (const [word, bucket] of votes) {
    const builtIn = BUILTIN_LEXICON[word];
    const learnedMeaning = choose(bucket.meanings);
    const learnedSoundmark = choose(bucket.soundmarks);
    result[word] = {
      ...result[word],
      partOfSpeech: result[word]?.partOfSpeech ?? builtIn?.partOfSpeech,
      explanation: result[word]?.explanation ?? builtIn?.explanation,
      meaning: learnedMeaning ?? result[word]?.meaning,
      soundmark: learnedSoundmark ?? result[word]?.soundmark,
    };
  }
  return result;
}

function applyPhrases(
  words: WordDetail[],
  normalizedTokens: readonly string[],
  lexicon: LearningLexicon,
): void {
  const learnedPhrases = Object.entries(lexicon)
    .filter(([key]) => key.includes(" "))
    .map(([key, value]) => ({
      words: key.split(/\s+/),
      meaning: value.meaning ?? "",
      explanation: value.explanation ?? "",
    }));
  const phrases = [...PHRASES, ...learnedPhrases].sort(
    (left, right) => right.words.length - left.words.length,
  );

  for (let start = 0; start < normalizedTokens.length; start += 1) {
    const phrase = phrases.find((candidate) =>
      candidate.words.every((word, offset) => normalizedTokens[start + offset] === word),
    );
    if (!phrase) continue;
    const end = start + phrase.words.length;
    const phraseText = words
      .slice(start, end)
      .map((word) => word.word)
      .join(" ");
    for (let index = start; index < end; index += 1) {
      words[index].phrase = phraseText;
      if (!words[index].explanation && phrase.explanation)
        words[index].explanation = phrase.explanation;
      if (!words[index].meaning && phrase.meaning) words[index].meaning = phrase.meaning;
    }
    start = end - 1;
  }
}

function isLikelyVerb(word: string, lexicon: LearningLexicon): boolean {
  const normalized = normalizeWord(word);
  if (AUXILIARIES.has(normalized)) return true;
  const value = lookup(word, lexicon);
  return Boolean(value?.partOfSpeech?.includes("动词"));
}

function isLikelyNounPhraseStart(word: string, lexicon: LearningLexicon): boolean {
  const normalized = normalizeWord(word);
  if (SUBJECT_WORDS.has(normalized) || DETERMINERS.has(normalized)) return true;
  const partOfSpeech = lookup(word, lexicon)?.partOfSpeech ?? "";
  return partOfSpeech.includes("名词") || partOfSpeech.includes("代词");
}

function group(
  role: SentenceStructureRole,
  label: string,
  tokenIndexes: number[],
  words: readonly string[],
  explanation: string,
  confidence: SentenceStructureGroup["confidence"],
): SentenceStructureGroup | undefined {
  if (!tokenIndexes.length) return undefined;
  return {
    role,
    label,
    text: tokenIndexes.map((index) => words[index]).join(" "),
    tokenIndexes,
    explanation,
    confidence,
  };
}

function buildSentenceStructure(
  tokens: readonly string[],
  lexicon: LearningLexicon,
): { groups: SentenceStructureGroup[]; note: string } {
  if (!tokens.length) return { groups: [], note: "没有可分析的英文词语。" };
  const normalized = tokens.map(normalizeWord);

  // Atomic words and infinitive fragments are vocabulary, not full clauses.
  if (tokens.length === 1) {
    const single = group("unknown", "词语", [0], tokens, "单个词语没有完整的主谓结构。", "high");
    return { groups: single ? [single] : [], note: "这是词语条目，不按完整句子分析。" };
  }
  if (normalized[0] === "to" && !normalized.some((word) => SUBJECT_WORDS.has(word))) {
    const fragment = group(
      "predicate",
      "不定式短语",
      tokens.map((_, index) => index),
      tokens,
      "to 加动词构成不定式短语；它本身不一定是完整句子。",
      "medium",
    );
    return { groups: fragment ? [fragment] : [], note: "这是不定式短语，只标注短语功能。" };
  }

  let subjectStart = 0;
  while (
    subjectStart < normalized.length &&
    (CONNECTORS.has(normalized[subjectStart]) || TIME_ADVERBS.has(normalized[subjectStart]))
  ) {
    subjectStart += 1;
  }
  const verbIndex = normalized.findIndex(
    (_, index) => index >= subjectStart && isLikelyVerb(tokens[index], lexicon),
  );
  if (verbIndex < 0 || verbIndex === subjectStart) {
    const unknown = group(
      "unknown",
      "短语/待确认",
      tokens.map((_, index) => index),
      tokens,
      "未找到可靠的主语和谓语边界。",
      "low",
    );
    return {
      groups: unknown ? [unknown] : [],
      note: "本地规则无法可靠识别完整主谓结构，未强行标注。",
    };
  }

  const groups: SentenceStructureGroup[] = [];
  if (subjectStart > 0) {
    const leadingRole: SentenceStructureRole = CONNECTORS.has(normalized[0])
      ? "connector"
      : "adverbial";
    const leading = group(
      leadingRole,
      leadingRole === "connector" ? "连接成分" : "状语",
      Array.from({ length: subjectStart }, (_, index) => index),
      tokens,
      leadingRole === "connector"
        ? "连接当前内容与前文或并列分句。"
        : "补充时间、地点或方式等信息。",
      "medium",
    );
    if (leading) groups.push(leading);
  }

  const subject = group(
    "subject",
    "主语",
    Array.from({ length: verbIndex - subjectStart }, (_, index) => subjectStart + index),
    tokens,
    "说明动作或状态的执行者、承受者或谈论对象。",
    isLikelyNounPhraseStart(tokens[subjectStart], lexicon) ? "medium" : "low",
  );
  if (subject) groups.push(subject);

  let predicateEnd = verbIndex + 1;
  if (AUXILIARIES.has(normalized[verbIndex])) {
    // Include negation, chained auxiliaries and the first following lexical verb.
    while (predicateEnd < tokens.length) {
      const word = normalized[predicateEnd];
      if (word === "not" || AUXILIARIES.has(word) || word === "to") {
        predicateEnd += 1;
        continue;
      }
      if (isLikelyVerb(tokens[predicateEnd], lexicon)) predicateEnd += 1;
      break;
    }
  } else if (
    predicateEnd < tokens.length &&
    normalized[predicateEnd] === "to" &&
    predicateEnd + 1 < tokens.length &&
    isLikelyVerb(tokens[predicateEnd + 1], lexicon)
  ) {
    predicateEnd += 2;
  }
  const predicate = group(
    "predicate",
    "谓语",
    Array.from({ length: predicateEnd - verbIndex }, (_, index) => verbIndex + index),
    tokens,
    "说明主语的动作、状态或变化。",
    "medium",
  );
  if (predicate) groups.push(predicate);

  let cursor = predicateEnd;
  while (cursor < tokens.length) {
    const start = cursor;
    const current = normalized[cursor];
    if (CONNECTORS.has(current)) {
      const connector = group(
        "connector",
        "连接成分",
        [cursor],
        tokens,
        "连接并列成分或引出从句。",
        "medium",
      );
      if (connector) groups.push(connector);
      cursor += 1;
      continue;
    }
    if (PREPOSITIONS.has(current) || TIME_ADVERBS.has(current)) {
      cursor += 1;
      while (
        cursor < tokens.length &&
        !CONNECTORS.has(normalized[cursor]) &&
        !TIME_ADVERBS.has(normalized[cursor]) &&
        !PREPOSITIONS.has(normalized[cursor])
      )
        cursor += 1;
      const adverbial = group(
        "adverbial",
        "状语/介词短语",
        Array.from({ length: cursor - start }, (_, index) => start + index),
        tokens,
        "补充时间、地点、方式、原因或对象等信息。",
        "low",
      );
      if (adverbial) groups.push(adverbial);
      continue;
    }
    cursor += 1;
    while (
      cursor < tokens.length &&
      !CONNECTORS.has(normalized[cursor]) &&
      !PREPOSITIONS.has(normalized[cursor]) &&
      !TIME_ADVERBS.has(normalized[cursor])
    )
      cursor += 1;
    const object = group(
      "object",
      "宾语/补语",
      Array.from({ length: cursor - start }, (_, index) => start + index),
      tokens,
      "位于谓语之后；可能是动作对象，也可能补充说明主语或宾语。",
      "low",
    );
    if (object) groups.push(object);
  }

  return {
    groups,
    note: "句子结构由保守的本地规则生成；复杂从句中的“宾语/补语”和状语边界仅供入门学习参考。",
  };
}

function setWordRoles(words: WordDetail[], groups: readonly SentenceStructureGroup[]): void {
  for (const structure of groups) {
    if (structure.role === "unknown" || structure.role === "modifier") continue;
    for (const index of structure.tokenIndexes) {
      if (words[index] && !words[index].role) words[index].role = structure.label;
    }
  }
}

/** Enriches one statement without browser globals, network access or mutation. */
export function enrichStatement(
  statement: LearningStatement,
  lexicon: LearningLexicon = {},
): EnrichedStatement {
  const tokens = tokenizeEnglish(statement.english);
  const normalizedTokens = tokens.map(normalizeWord);
  const soundmarks = alignSoundmarks(tokens, statement.soundmark, lexicon);
  const words: WordDetail[] = tokens.map((word, index) => {
    const value = lookup(word, lexicon);
    return {
      word,
      soundmark: soundmarks[index] || value?.soundmark || value?.ipa?.[0] || "",
      partOfSpeech: value?.partOfSpeech ?? "",
      meaning: value?.meaning ?? "",
      role: "",
      phrase: "",
      explanation: value?.explanation ?? "",
    };
  });
  applyPhrases(words, normalizedTokens, lexicon);
  const structure = buildSentenceStructure(tokens, lexicon);
  setWordRoles(words, structure.groups);
  return { words, sentenceStructure: structure.groups, structureNote: structure.note };
}
