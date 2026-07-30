import { useEffect, useRef, useState, type TouchEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  MeetPepperIllustration,
  SaveAnythingIllustration,
  TranscribedIllustration,
  ChatWithKnowledgeIllustration,
} from "./illustrations";

const SLIDES = [
  {
    title: "Welcome to Pepper AI",
    desc: "Your personal knowledge companion.",
    Illustration: MeetPepperIllustration,
  },
  {
    title: "Save Anything",
    desc: "Reels, videos, podcasts, articles, or a quick note — Pepper keeps it all in one place.",
    Illustration: SaveAnythingIllustration,
  },
  {
    title: "Transcribed Automatically",
    desc: "Audio and video get transcribed the moment you save them. No manual work.",
    Illustration: TranscribedIllustration,
  },
  {
    title: "Chat With Your Knowledge",
    desc: "Ask Pepper anything — it answers using everything you've saved.",
    Illustration: ChatWithKnowledgeIllustration,
  },
];

const AUTO_ADVANCE_MS = 3000;
const SWIPE_THRESHOLD_PX = 50;
const TRANSITION = { duration: 0.13, ease: "easeOut" as const };

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -24 : 24 }),
};

export function Slides() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const navigate = useNavigate();
  const touchStartX = useRef<number | null>(null);
  const isLast = index === SLIDES.length - 1;

  useEffect(() => {
    if (isLast) return;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        // Tab may have been backgrounded, throttling rAF-driven exit
        // animations; skip advancing until it's visible again so slides
        // don't pile up unanimated.
        if (document.hidden) {
          schedule();
          return;
        }
        goTo(index + 1);
      }, AUTO_ADVANCE_MS);
    };
    schedule();
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, isLast]);

  function goTo(next: number) {
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  }

  function handleTouchStart(e: TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: TouchEvent) {
    if (touchStartX.current === null) return;
    const delta = e.changedTouches[0].clientX - touchStartX.current;
    if (delta < -SWIPE_THRESHOLD_PX) goTo(Math.min(index + 1, SLIDES.length - 1));
    else if (delta > SWIPE_THRESHOLD_PX) goTo(Math.max(index - 1, 0));
    touchStartX.current = null;
  }

  const slide = SLIDES[index];

  return (
    <div
      className="relative min-h-screen flex flex-col bg-bg"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute top-6 left-6 font-heading text-accent text-lg font-bold">
        Pepper
      </div>

      <div className="flex-grow flex flex-col items-center justify-center text-center px-8 gap-4 overflow-hidden">
        <AnimatePresence mode="popLayout" custom={direction} initial={false}>
          <motion.div
            key={index}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={TRANSITION}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={TRANSITION}
            >
              <slide.Illustration />
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...TRANSITION, delay: 0.03 }}
              className="font-heading text-text-primary text-3xl font-bold"
            >
              {slide.title}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...TRANSITION, delay: 0.06 }}
              className="text-text-secondary max-w-sm"
            >
              {slide.desc}
            </motion.p>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="flex justify-center gap-2 mb-8">
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => goTo(i)} aria-label={`Go to slide ${i + 1}`}>
            <motion.span
              layout
              transition={TRANSITION}
              className={`block h-2 rounded-full transition-colors ${
                i === index ? "w-6 bg-accent" : "w-2 bg-text-secondary/40"
              }`}
            />
          </button>
        ))}
      </div>

      <div className="px-8 pb-12">
        <button
          onClick={() => navigate("/signup")}
          className="btn-accent font-medium h-12 w-full max-w-sm rounded-full mx-auto block"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
