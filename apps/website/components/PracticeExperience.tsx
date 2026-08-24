"use client";

/* eslint-disable @next/next/no-img-element */
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";

import UiIcon from "@/components/UiIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import styles from "./PracticeExperience.module.css";

export type PracticeMode = "word-input" | "reorder";
export type Familiarity = "unfamiliar" | "mastered";

export type PracticeWordDetail = {
  word: string;
  phonetic?: string;
  soundmark?: string;
  partOfSpeech?: string;
  meaning?: string;
  role?: string;
  phrase?: string;
  explanation?: string;
};

export type SentenceAnalysisPart = {
  text: string;
  role: string;
  explanation?: string;
};

export type SentenceStructureGroup = {
  role: string;
  label: string;
  text: string;
  tokenIndexes?: number[];
  explanation?: string;
  confidence?: "high" | "medium" | "low";
};

export type PracticeStatement = {
  id: string;
  chinese: string;
  english: string;
  soundmark?: string;
  image?: string;
  words?: PracticeWordDetail[];
  wordDetails?: PracticeWordDetail[];
  sentenceStructure?: SentenceStructureGroup[];
  sentenceAnalysis?: SentenceAnalysisPart[];
  structureNote?: string;
};

export type PracticePreferences = {
  autoSpeak: boolean;
  typingSound: boolean;
  feedbackSound: boolean;
  mode: PracticeMode;
};

export type PracticeCompletion = {
  statementId: string;
  method: "typed" | "reordered" | "revealed";
};

export type PracticeExperienceProps = {
  compact?: boolean;
  autoFocusInput?: boolean;
  statement: PracticeStatement;
  index: number;
  total: number;
  preferences: PracticePreferences;
  familiarity?: Familiarity;
  onPreferencesChange: (preferences: PracticePreferences) => void;
  onFamiliarityChange: (familiarity: Familiarity) => void;
  onPrevious: () => void;
  onNext: () => void;
  onCourseComplete?: () => void;
  courseCompleteLabel?: string;
  nextCourseTitle?: string;
  onComplete?: (completion: PracticeCompletion) => void;
  canPrevious?: boolean;
  canNext?: boolean;
};

type AnswerStatus = "active" | "complete" | "revealed";
type ReorderToken = { id: number; text: string };
type AnnotatedWord = PracticeWordDetail & { wordIndex: number };
type AnnotatedWordGroup = {
  role: string;
  roleKey: string;
  words: AnnotatedWord[];
};

type WordSlotStyle = CSSProperties & {
  "--word-slot-width": string;
};

function normalizeWord(value: string) {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[.,!?;:'"“”‘’()[\]{}\-—_]/g, "")
    .trim();
}

function resolveSpeechText(text: string) {
  const normalized = text.normalize("NFKC").trim();
  return normalized === "I" ? "eye" : normalized;
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function roleKey(role: string) {
  if (role.includes("主语")) return "subject";
  if (role.includes("谓语")) return "predicate";
  if (role.includes("宾语") || role.includes("补语")) return "object";
  if (role.includes("状语") || role.includes("介词")) return "adverbial";
  if (role.includes("连接")) return "connector";
  return "word";
}

function shuffleTokens(words: string[], seedText: string): ReorderToken[] {
  let seed = 2166136261;
  for (const character of seedText) {
    seed ^= character.charCodeAt(0);
    seed = Math.imul(seed, 16777619);
  }

  const items = words.map((text, id) => ({ id, text }));
  for (let index = items.length - 1; index > 0; index -= 1) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519);
    const target = Math.abs(seed) % (index + 1);
    [items[index], items[target]] = [items[target], items[index]];
  }

  if (items.length > 1 && items.every((item, index) => item.id === index)) {
    items.push(items.shift() as ReorderToken);
  }
  return items;
}

export default function PracticeExperience({
  compact = false,
  autoFocusInput = true,
  statement,
  index,
  total,
  preferences,
  familiarity,
  onPreferencesChange,
  onFamiliarityChange,
  onPrevious,
  onNext,
  onCourseComplete,
  courseCompleteLabel = "返回课程目录",
  nextCourseTitle,
  onComplete,
  canPrevious = index > 0,
  canNext = index < total - 1,
}: PracticeExperienceProps) {
  const wordDetails = statement.wordDetails ?? statement.words;
  const words = useMemo(
    () =>
      wordDetails?.length
        ? wordDetails.map((detail) => detail.word)
        : statement.english.trim().split(/\s+/).filter(Boolean),
    [statement.english, wordDetails],
  );
  const shuffledTokens = useMemo(
    () => shuffleTokens(words, `${statement.id}:${statement.english}`),
    [statement.english, statement.id, words],
  );
  const sentenceParts = useMemo<SentenceAnalysisPart[]>(() => {
    if (statement.sentenceAnalysis) return statement.sentenceAnalysis;
    return (
      statement.sentenceStructure?.map((part) => ({
        text: part.text,
        role: part.label || part.role,
        explanation: part.explanation,
      })) ?? []
    );
  }, [statement.sentenceAnalysis, statement.sentenceStructure]);
  const annotatedWordGroups = useMemo<AnnotatedWordGroup[]>(() => {
    const details = words.map((word, wordIndex) => ({
      word,
      wordIndex,
      ...(wordDetails?.[wordIndex] ?? {}),
    }));

    return details.reduce<AnnotatedWordGroup[]>((groups, detail) => {
      const role = detail.role || "词语";
      const key = roleKey(role);
      const previous = groups.at(-1);
      if (previous?.role === role) {
        previous.words.push(detail);
      } else {
        groups.push({ role, roleKey: key, words: [detail] });
      }
      return groups;
    }, []);
  }, [wordDetails, words]);
  const [wordInputs, setWordInputs] = useState<string[]>(() => words.map(() => ""));
  const [activeWord, setActiveWord] = useState(0);
  const [hintVisible, setHintVisible] = useState(false);
  const [showImage, setShowImage] = useState(true);
  const [status, setStatus] = useState<AnswerStatus>("active");
  const [errorMessage, setErrorMessage] = useState("");
  const [errorPulse, setErrorPulse] = useState(0);
  const [selectedTokens, setSelectedTokens] = useState<number[]>([]);
  const [expandedPart, setExpandedPart] = useState<number | null>(null);
  const [showSentenceAnalysis, setShowSentenceAnalysis] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [paused, setPaused] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const activeWordRef = useRef(0);
  const wordCommitInFlightRef = useRef(false);
  const typingAudioRef = useRef<HTMLAudioElement | null>(null);
  const rightAudioRef = useRef<HTMLAudioElement | null>(null);
  const speechAudioRef = useRef<HTMLAudioElement | null>(null);
  const completionRef = useRef<string | null>(null);

  const focusInput = useCallback((wordIndex = activeWordRef.current) => {
    requestAnimationFrame(() => inputRefs.current[wordIndex]?.focus({ preventScroll: true }));
  }, []);

  const activateWordInputFromGesture = useCallback(
    (wordIndex: number, input: HTMLInputElement) => {
      if (paused || status !== "active") return;

      activeWordRef.current = wordIndex;
      inputRefs.current.forEach((candidate, candidateIndex) => {
        if (candidate) candidate.readOnly = candidateIndex !== wordIndex;
      });
      input.readOnly = false;
      setActiveWord(wordIndex);
      setHintVisible(false);
      setErrorMessage("");

      // iOS and embedded browsers only open the software keyboard when an
      // editable control is focused inside the original touch gesture. React's
      // state update alone lands too late when the tapped slot was read-only.
      input.focus({ preventScroll: true });
    },
    [paused, status],
  );

  useEffect(() => {
    activeWordRef.current = activeWord;
  }, [activeWord]);

  const speakText = useCallback((text: string, rate = 0.82) => {
    if (typeof window === "undefined") return;
    const spokenText = resolveSpeechText(text);
    if (!spokenText) return;
    speechAudioRef.current?.pause();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(spokenText);
      const voices = window.speechSynthesis.getVoices();
      const englishVoice =
        voices.find((voice) => voice.lang.toLowerCase() === "en-us") ??
        voices.find((voice) => voice.lang.toLowerCase().startsWith("en-"));
      if (englishVoice) utterance.voice = englishVoice;
      utterance.lang = englishVoice?.lang || "en-US";
      utterance.rate = rate;
      window.speechSynthesis.speak(utterance);
      return;
    }

    // The embedded browser does not expose Web Speech. Keep the standalone
    // site usable there with a keyless MP3 endpoint, as the original client
    // also relies on a remote pronunciation service.
    const audio = speechAudioRef.current ?? new Audio();
    speechAudioRef.current = audio;
    audio.src = `https://fanyi.baidu.com/gettts?lan=en&spd=3&source=web&text=${encodeURIComponent(spokenText)}`;
    audio.preload = "auto";
    void audio.play().catch(() => undefined);
  }, []);

  const speak = useCallback(() => {
    speakText(statement.english);
  }, [speakText, statement.english]);

  const speakWord = useCallback(
    (word: string) => {
      speakText(word, 0.72);
    },
    [speakText],
  );

  const playTypingSound = useCallback(() => {
    if (!preferences.typingSound || typeof window === "undefined") return;
    const audio = typingAudioRef.current ?? new Audio("/typing.mp3");
    typingAudioRef.current = audio;
    audio.volume = 0.18;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, [preferences.typingSound]);

  const playRightSound = useCallback(() => {
    if (!preferences.feedbackSound || typeof window === "undefined") return;
    const audio = rightAudioRef.current ?? new Audio("/right.mp3");
    rightAudioRef.current = audio;
    audio.volume = 0.45;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, [preferences.feedbackSound]);

  const playErrorSound = useCallback(() => {
    if (!preferences.feedbackSound || typeof window === "undefined") return;
    const AudioContextConstructor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return;

    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(210, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(130, context.currentTime + 0.12);
    gain.gain.setValueAtTime(0.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.14);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
    oscillator.addEventListener("ended", () => void context.close(), { once: true });
  }, [preferences.feedbackSound]);

  const finish = useCallback(
    (method: PracticeCompletion["method"]) => {
      const completionKey = `${statement.id}:${method}`;
      if (completionRef.current) return;
      completionRef.current = completionKey;
      setStatus(method === "revealed" ? "revealed" : "complete");
      setErrorMessage("");
      if (method !== "revealed") playRightSound();
      if (preferences.autoSpeak) window.setTimeout(speak, 180);
      onComplete?.({ statementId: statement.id, method });
    },
    [onComplete, playRightSound, preferences.autoSpeak, speak, statement.id],
  );

  useEffect(() => {
    const resetTimer = window.setTimeout(() => {
      completionRef.current = null;
      setWordInputs(words.map(() => ""));
      activeWordRef.current = 0;
      setActiveWord(0);
      setHintVisible(false);
      setShowImage(true);
      setStatus("active");
      setErrorMessage("");
      setSelectedTokens([]);
      setExpandedPart(null);
      setShowSentenceAnalysis(false);
      setPaused(false);
      wordCommitInFlightRef.current = false;
      if (autoFocusInput) focusInput(0);
    }, 0);
    return () => window.clearTimeout(resetTimer);
  }, [autoFocusInput, focusInput, statement.id, words]);

  useEffect(() => {
    if (!preferences.autoSpeak || typeof window === "undefined") return;
    const timer = window.setTimeout(speak, 220);
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis?.cancel();
      speechAudioRef.current?.pause();
    };
  }, [preferences.autoSpeak, speak, statement.id]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [paused]);

  useEffect(() => {
    if (autoFocusInput && preferences.mode === "word-input" && status === "active" && !paused) {
      focusInput();
    }
  }, [autoFocusInput, focusInput, paused, preferences.mode, status]);

  const reportError = useCallback(
    (message: string) => {
      setErrorMessage(message);
      setErrorPulse((pulse) => pulse + 1);
      playErrorSound();
      focusInput();
    },
    [focusInput, playErrorSound],
  );

  const submitCurrentWord = useCallback(() => {
    if (paused || status !== "active" || !words[activeWord] || wordCommitInFlightRef.current)
      return;
    if (normalizeWord(wordInputs[activeWord] ?? "") !== normalizeWord(words[activeWord])) {
      reportError("再想一想，这个单词还不对");
      return;
    }

    wordCommitInFlightRef.current = true;
    window.requestAnimationFrame(() => {
      wordCommitInFlightRef.current = false;
    });

    const nextInputs = [...wordInputs];
    nextInputs[activeWord] = words[activeWord];
    setWordInputs(nextInputs);
    setHintVisible(false);
    setErrorMessage("");

    const nextUnanswered = words.findIndex(
      (word, wordIndex) =>
        wordIndex > activeWord &&
        normalizeWord(nextInputs[wordIndex] ?? "") !== normalizeWord(word),
    );
    const allCorrect = words.every(
      (word, wordIndex) => normalizeWord(nextInputs[wordIndex] ?? "") === normalizeWord(word),
    );

    if (allCorrect) {
      finish("typed");
    } else {
      const nextWord =
        nextUnanswered >= 0 ? nextUnanswered : Math.min(activeWord + 1, words.length - 1);
      activeWordRef.current = nextWord;
      setActiveWord(nextWord);
      focusInput(nextWord);
    }
  }, [activeWord, finish, focusInput, paused, reportError, status, wordInputs, words]);

  const moveActiveWord = useCallback(
    (direction: -1 | 1) => {
      const nextWord = Math.max(0, Math.min(words.length - 1, activeWordRef.current + direction));
      activeWordRef.current = nextWord;
      setActiveWord(nextWord);
      setHintVisible(false);
      setErrorMessage("");
      focusInput(nextWord);
    },
    [focusInput, words.length],
  );

  const onTypingKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.nativeEvent.isComposing || event.repeat) return;
      if (event.shiftKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        submitCurrentWord();
        return;
      }
      if (event.key === "Tab") {
        event.preventDefault();
        moveActiveWord(event.shiftKey ? -1 : 1);
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        event.preventDefault();
        moveActiveWord(event.key === "ArrowLeft" ? -1 : 1);
        return;
      }
      if (event.key === "Backspace" && !(wordInputs[activeWord] ?? "")) {
        event.preventDefault();
        const previous = Math.max(0, activeWord - 1);
        setWordInputs((inputs) =>
          inputs.map((value, wordIndex) => (wordIndex >= previous ? "" : value)),
        );
        setActiveWord(previous);
        activeWordRef.current = previous;
        setErrorMessage("");
        focusInput(previous);
      }
    },
    [activeWord, focusInput, moveActiveWord, submitCurrentWord, wordInputs],
  );

  const validateReorder = useCallback(
    (tokenIds: number[]) => {
      if (tokenIds.length !== words.length) return;
      if (tokenIds.every((tokenId, tokenIndex) => tokenId === tokenIndex)) {
        finish("reordered");
      } else {
        reportError("顺序还不对，可以点选已排列的单词撤回");
      }
    },
    [finish, reportError, words.length],
  );

  const chooseToken = useCallback(
    (tokenId: number) => {
      if (paused || status !== "active" || selectedTokens.includes(tokenId)) return;
      const next = [...selectedTokens, tokenId];
      setSelectedTokens(next);
      setErrorMessage("");
      playTypingSound();
      validateReorder(next);
    },
    [paused, playTypingSound, selectedTokens, status, validateReorder],
  );

  const removeToken = useCallback(
    (position: number) => {
      if (paused || status !== "active") return;
      setSelectedTokens((tokens) => tokens.filter((_, tokenIndex) => tokenIndex !== position));
      setErrorMessage("");
    },
    [paused, status],
  );

  const revealAnswer = useCallback(() => {
    if (paused || status !== "active") return;
    setWordInputs([...words]);
    setSelectedTokens(words.map((_, wordIndex) => wordIndex));
    finish("revealed");
  }, [finish, paused, status, words]);

  const restartQuestion = useCallback(() => {
    completionRef.current = null;
    setWordInputs(words.map(() => ""));
    setActiveWord(0);
    setHintVisible(false);
    setStatus("active");
    setErrorMessage("");
    setSelectedTokens([]);
    setExpandedPart(null);
    setShowSentenceAnalysis(false);
    wordCommitInFlightRef.current = false;
    activeWordRef.current = 0;
    focusInput(0);
  }, [focusInput, words]);

  const setFamiliarity = useCallback(
    (next: Familiarity) => {
      onFamiliarityChange(next);
    },
    [onFamiliarityChange],
  );

  const updatePreference = useCallback(
    <Key extends keyof PracticePreferences>(key: Key, value: PracticePreferences[Key]) => {
      onPreferencesChange({ ...preferences, [key]: value });
    },
    [onPreferencesChange, preferences],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        speak();
      } else if (event.ctrlKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        setFamiliarity("mastered");
      } else if (event.ctrlKey && event.key.toLowerCase() === "q") {
        event.preventDefault();
        setFamiliarity("unfamiliar");
      } else if (event.shiftKey && event.key === "ArrowLeft" && canPrevious) {
        event.preventDefault();
        onPrevious();
      } else if (event.shiftKey && event.key === "ArrowRight" && canNext) {
        event.preventDefault();
        onNext();
      } else if (
        event.key === "Enter" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey &&
        status !== "active"
      ) {
        event.preventDefault();
        if (canNext) onNext();
        else onCourseComplete?.();
      } else if (event.key === "ArrowUp" && status === "active") {
        event.preventDefault();
        setHintVisible(true);
      } else if (event.key === "ArrowDown" && status === "active") {
        event.preventDefault();
        setHintVisible(false);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setPaused((current) => !current);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canNext, canPrevious, onCourseComplete, onNext, onPrevious, setFamiliarity, speak, status]);

  const percentage = total > 0 ? Math.round(((index + 1) / total) * 100) : 0;
  const answered = status !== "active";
  const currentAnalysisPart = sentenceParts[expandedPart ?? -1];

  return (
    <section
      className={`${styles.experience} ${compact ? styles.keyboardCompact : ""} ${answered ? styles.answerVisible : ""}`}
      aria-label="英语句子练习"
      onPointerDown={(event) => {
        if (
          preferences.mode !== "word-input" ||
          status !== "active" ||
          paused ||
          (event.target instanceof Element &&
            event.target.closest("input, button, a, select, textarea, [role='button']"))
        ) {
          return;
        }

        const wordIndex = activeWordRef.current;
        const input = inputRefs.current[wordIndex];
        if (input) activateWordInputFromGesture(wordIndex, input);
      }}
    >
      <div className={styles.topbar}>
        <div className={styles.progressCopy}>
          <span>
            {index + 1} / {total}
          </span>
          <span>{percentage}%</span>
        </div>
        <div className={styles.sessionTools}>
          <span
            className={styles.timer}
            aria-label={`练习用时 ${formatTime(elapsedSeconds)}`}
          >
            <UiIcon
              name="clock"
              size={15}
            />{" "}
            {formatTime(elapsedSeconds)}
          </span>
          <button
            type="button"
            className={styles.quietButton}
            onClick={() => setPaused((current) => !current)}
          >
            <UiIcon
              name={paused ? "play" : "pause"}
              size={15}
            />{" "}
            {paused ? "继续" : "暂停"}
          </button>
        </div>
      </div>

      <div
        className={styles.progressTrack}
        aria-hidden="true"
      >
        <span style={{ transform: `scaleX(${percentage / 100})` }} />
      </div>

      <div
        className={styles.modeTabs}
        role="group"
        aria-label="练习模式"
      >
        <button
          type="button"
          className={preferences.mode === "word-input" ? styles.selectedTab : ""}
          onClick={() => updatePreference("mode", "word-input")}
          aria-pressed={preferences.mode === "word-input"}
        >
          逐词输入
        </button>
        <button
          type="button"
          className={preferences.mode === "reorder" ? styles.selectedTab : ""}
          onClick={() => updatePreference("mode", "reorder")}
          aria-pressed={preferences.mode === "reorder"}
        >
          拆句重组
        </button>
      </div>

      {!answered && <p className={styles.chinesePrompt}>{statement.chinese}</p>}

      {statement.image && (
        <section
          className={styles.imageArea}
          aria-label="题目图片"
        >
          <label>
            <input
              type="checkbox"
              checked={showImage}
              onChange={(event) => setShowImage(event.target.checked)}
            />
            显示图片
          </label>
          {/* Course images may be remote and are not constrained to a configured Next image host. */}
          {showImage && (
            <img
              src={statement.image}
              alt={`${statement.chinese}的课程配图`}
            />
          )}
        </section>
      )}

      <div
        className={`${styles.practiceArea} ${answered ? styles.answeredArea : styles.activeArea}`}
      >
        {answered ? (
          <div
            className={styles.completedStage}
            aria-label="答题结果与单词解释"
          >
            <div className={styles.annotatedSentence}>
              {annotatedWordGroups.map((group, groupIndex) => (
                <div
                  className={styles.annotationGroup}
                  data-role={group.roleKey}
                  key={`${group.role}-${groupIndex}`}
                >
                  <div className={styles.annotationWords}>
                    {group.words.map((detail) => (
                      <button
                        type="button"
                        className={styles.annotationWord}
                        key={`${detail.word}-${detail.wordIndex}`}
                        onClick={() => speakWord(detail.word)}
                        aria-label={`朗读单词 ${detail.word}`}
                        title="点击朗读单词"
                      >
                        <span className={styles.annotationSoundmark}>
                          {detail.phonetic || detail.soundmark || "\u00a0"}
                        </span>
                        <span className={styles.annotationPart}>
                          {detail.partOfSpeech || "词语"}
                        </span>
                        <strong>{detail.word}</strong>
                        <span className={styles.annotationMeaning}>
                          {detail.meaning || "暂无释义"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <span className={styles.annotationRole}>{group.role}</span>
                </div>
              ))}
            </div>

            <p className={styles.completedChinese}>{statement.chinese}</p>
            <div className={styles.completedUtilities}>
              <button
                type="button"
                onClick={speak}
              >
                <UiIcon
                  name="volume"
                  size={15}
                />
                朗读
              </button>
              <button
                type="button"
                className={showSentenceAnalysis ? styles.analysisToggleActive : ""}
                onClick={() => setShowSentenceAnalysis((current) => !current)}
                aria-expanded={showSentenceAnalysis}
              >
                <span
                  className={styles.analysisDot}
                  aria-hidden="true"
                />
                句子解析
              </button>
            </div>

            {showSentenceAnalysis && (
              <div className={styles.inlineAnalysis}>
                {sentenceParts.length ? (
                  <>
                    <div className={styles.inlineAnalysisParts}>
                      {sentenceParts.map((part, partIndex) => (
                        <button
                          type="button"
                          key={`${part.text}-${partIndex}`}
                          className={expandedPart === partIndex ? styles.selectedPart : ""}
                          onClick={() =>
                            setExpandedPart((current) => (current === partIndex ? null : partIndex))
                          }
                          aria-expanded={expandedPart === partIndex}
                        >
                          <strong>{part.text}</strong>
                          <span>{part.role}</span>
                        </button>
                      ))}
                    </div>
                    {expandedPart !== null && (
                      <p className={styles.analysisExplanation}>
                        <strong>{currentAnalysisPart?.role}：</strong>
                        {currentAnalysisPart?.explanation || "本成分暂无进一步说明。"}
                      </p>
                    )}
                    {statement.structureNote && (
                      <p className={styles.structureNote}>{statement.structureNote}</p>
                    )}
                  </>
                ) : (
                  <p className={styles.emptyInlineAnalysis}>本句暂无详细解析。</p>
                )}
              </div>
            )}
          </div>
        ) : preferences.mode === "word-input" ? (
          <div
            className={styles.wordLine}
            aria-label="逐词输入区域"
          >
            {words.map((word, wordIndex) => {
              const isActive = wordIndex === activeWord && status === "active";
              const isCorrect = normalizeWord(wordInputs[wordIndex] ?? "") === normalizeWord(word);
              return (
                <div
                  className={`${styles.wordSlot} ${isActive ? styles.activeSlot : ""} ${isCorrect ? styles.correctSlot : ""}`}
                  key={`${word}-${wordIndex}`}
                  style={
                    {
                      "--word-slot-width": `${Math.max(6, Math.min(word.length + 3, 20))}ch`,
                    } as WordSlotStyle
                  }
                >
                  {status === "active" ? (
                    <input
                      ref={(element) => {
                        inputRefs.current[wordIndex] = element;
                      }}
                      type="text"
                      inputMode="text"
                      enterKeyHint={wordIndex === words.length - 1 ? "done" : "next"}
                      autoFocus={autoFocusInput && wordIndex === 0}
                      value={wordInputs[wordIndex] ?? ""}
                      readOnly={!isActive}
                      tabIndex={isActive ? 0 : -1}
                      placeholder={
                        isCorrect ? "" : "·".repeat(Math.max(2, Math.min(word.length, 8)))
                      }
                      onPointerDown={(event) => {
                        activateWordInputFromGesture(wordIndex, event.currentTarget);
                      }}
                      onTouchStart={(event) => {
                        activateWordInputFromGesture(wordIndex, event.currentTarget);
                      }}
                      onChange={(event) => {
                        if (!isActive) return;
                        const value = event.target.value.replace(/\s/g, "");
                        if (value.length > (wordInputs[wordIndex] ?? "").length) playTypingSound();
                        setWordInputs((inputs) =>
                          inputs.map((input, inputIndex) =>
                            inputIndex === wordIndex ? value : input,
                          ),
                        );
                        setErrorMessage("");
                      }}
                      onBeforeInput={(event) => {
                        const inputEvent = event.nativeEvent as InputEvent;
                        if (!inputEvent.data || !/\s/.test(inputEvent.data)) return;
                        event.preventDefault();
                        event.stopPropagation();
                        submitCurrentWord();
                      }}
                      onKeyDown={onTypingKeyDown}
                      onFocus={() => {
                        if (isActive) return;
                        activeWordRef.current = wordIndex;
                        setActiveWord(wordIndex);
                        setHintVisible(false);
                      }}
                      autoComplete="off"
                      autoCapitalize="off"
                      spellCheck={false}
                      disabled={paused}
                      aria-label={`第 ${wordIndex + 1} 个单词`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (status !== "active") return;
                        activeWordRef.current = wordIndex;
                        setActiveWord(wordIndex);
                        setHintVisible(false);
                        focusInput(wordIndex);
                      }}
                      disabled={status !== "active" || paused}
                      aria-label={`切换到第 ${wordIndex + 1} 个单词`}
                    >
                      {isCorrect || answered ? (
                        word
                      ) : (
                        <span aria-hidden="true">
                          {"·".repeat(Math.max(2, Math.min(word.length, 8)))}
                        </span>
                      )}
                    </button>
                  )}
                  {isActive && hintVisible && <span className={styles.wordHint}>答案：{word}</span>}
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.reorderArea}>
            <div
              className={styles.assembledLine}
              aria-label="已排列的单词"
            >
              {selectedTokens.length ? (
                selectedTokens.map((tokenId, tokenIndex) => (
                  <button
                    type="button"
                    key={`${tokenId}-${tokenIndex}`}
                    onClick={() => removeToken(tokenIndex)}
                    disabled={answered || paused}
                    aria-label={`撤回 ${words[tokenId]}`}
                  >
                    {words[tokenId]}
                  </button>
                ))
              ) : (
                <span>按顺序点选下面的单词</span>
              )}
            </div>
            <div
              className={styles.tokenBank}
              aria-label="可选单词"
            >
              {shuffledTokens.map((token) => (
                <button
                  type="button"
                  key={token.id}
                  onClick={() => chooseToken(token.id)}
                  disabled={selectedTokens.includes(token.id) || answered || paused}
                >
                  {token.text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className={styles.feedback}
          aria-live="polite"
        >
          {errorMessage && (
            <span
              key={errorPulse}
              className={styles.errorMessage}
            >
              ● {errorMessage}
            </span>
          )}
          {status === "complete" && (
            <span className={styles.successMessage}>✓ 回答正确，做得好</span>
          )}
          {status === "revealed" && (
            <span className={styles.revealMessage}>答案已显示，可以查看解析后再练一次</span>
          )}
        </div>

        {paused && (
          <div
            className={styles.pauseLayer}
            role="status"
          >
            <strong>练习已暂停</strong>
            <span>按 Esc 或点击“继续”恢复</span>
          </div>
        )}
      </div>

      <div
        className={styles.preferenceBar}
        aria-label="声音设置"
      >
        <span>声音</span>
        <label>
          <input
            type="checkbox"
            checked={preferences.autoSpeak}
            onChange={(event) => updatePreference("autoSpeak", event.target.checked)}
          />
          自动朗读
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.typingSound}
            onChange={(event) => updatePreference("typingSound", event.target.checked)}
          />
          打字音效
        </label>
        <label>
          <input
            type="checkbox"
            checked={preferences.feedbackSound}
            onChange={(event) => updatePreference("feedbackSound", event.target.checked)}
          />
          答题反馈
        </label>
      </div>

      <div className={styles.actionDock}>
        <div className={styles.primaryActions}>
          {preferences.mode === "word-input" && status === "active" && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={submitCurrentWord}
              disabled={paused}
            >
              确认当前单词 <kbd>Space</kbd>
            </button>
          )}
          {status === "active" ? (
            <button
              type="button"
              onClick={revealAnswer}
              disabled={paused}
            >
              显示答案 <kbd>↑</kbd>
            </button>
          ) : (
            <button
              type="button"
              onClick={restartQuestion}
            >
              再练一次
            </button>
          )}
          <button
            type="button"
            onClick={speak}
          >
            <UiIcon
              name="volume"
              size={15}
            />
            朗读 <kbd>Ctrl A</kbd>
          </button>
        </div>

        <div className={styles.familiarityBar}>
          <button
            type="button"
            className={familiarity === "unfamiliar" ? styles.unfamiliar : ""}
            onClick={() => setFamiliarity("unfamiliar")}
            aria-pressed={familiarity === "unfamiliar"}
          >
            {familiarity === "unfamiliar" ? "● 不熟悉" : "标记不熟悉"} <kbd>Ctrl Q</kbd>
          </button>
          <button
            type="button"
            className={familiarity === "mastered" ? styles.mastered : ""}
            onClick={() => setFamiliarity("mastered")}
            aria-pressed={familiarity === "mastered"}
          >
            {familiarity === "mastered" ? "✓ 已掌握" : "标记掌握"} <kbd>Ctrl M</kbd>
          </button>
        </div>

        <nav
          className={styles.navigation}
          aria-label="题目导航"
        >
          <button
            type="button"
            onClick={onPrevious}
            disabled={!canPrevious}
          >
            <UiIcon
              name="arrow-left"
              size={15}
            />
            上一题
          </button>
          <span>Shift + 方向键切题</span>
          {canNext ? (
            <button
              type="button"
              className={styles.nextButton}
              onClick={onNext}
            >
              下一题 <kbd>Enter</kbd>
              <UiIcon
                name="arrow-right"
                size={15}
              />
            </button>
          ) : answered && onCourseComplete ? (
            <button
              type="button"
              className={`${styles.nextButton} ${styles.courseCompleteButton}`}
              onClick={onCourseComplete}
              title={nextCourseTitle}
            >
              {courseCompleteLabel} <kbd>Enter</kbd>
              <UiIcon
                name="arrow-right"
                size={15}
              />
            </button>
          ) : (
            <button
              type="button"
              className={styles.nextButton}
              disabled
            >
              下一题 <kbd>Enter</kbd>
              <UiIcon
                name="arrow-right"
                size={15}
              />
            </button>
          )}
        </nav>
      </div>
    </section>
  );
}
