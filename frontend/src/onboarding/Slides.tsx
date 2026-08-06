import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  MeetPepperIllustration,
  SaveAnythingIllustration,
  TranscribedIllustration,
  ChatWithKnowledgeIllustration,
} from "./illustrations";

const SLIDES = [
  {
    title: "Meet Pepper",
    desc: "A quiet place for everything worth remembering.",
    Illustration: MeetPepperIllustration,
  },
  {
    title: "Save Anything, As It Happens",
    desc: "A reel, a podcast, an article, a thought at midnight — send it to Pepper and it's kept, in one place.",
    Illustration: SaveAnythingIllustration,
  },
  {
    title: "Transcribed the Moment You Save It",
    desc: "Audio and video turn into searchable text automatically. No re-listening, no typing it out.",
    Illustration: TranscribedIllustration,
  },
  {
    title: "Ask, and Pepper Remembers",
    desc: "Everything you've saved becomes something you can talk to.",
    Illustration: ChatWithKnowledgeIllustration,
  },
];

const AUTO_ADVANCE_MS = 3000;
const TRANSITION = { duration: 0.2, ease: "easeOut" as const };
const SLIDE_TRANSITION = {
  x: { type: "spring" as const, stiffness: 320, damping: 32 },
  opacity: { duration: 0.15 },
};

// Product of drag distance and release velocity; a fast flick over a short
// distance should paginate just as readily as a slow drag across the screen.
const SWIPE_CONFIDENCE_THRESHOLD = 10000;
function swipePower(offset: number, velocity: number) {
  return Math.abs(offset) * velocity;
}

// A deliberate drag past this point pages even when released slowly, so the
// gesture doesn't rely on flick velocity alone.
const SWIPE_DISTANCE_THRESHOLD = 80;

const slideVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 300 : -300 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -300 : 300 }),
};

export function Slides() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const navigate = useNavigate();
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
    if (next < 0 || next >= SLIDES.length) return;
    setDirection(next > index ? 1 : -1);
    setIndex(next);
  }

  function handleDragEnd(_e: unknown, info: PanInfo) {
    const swipe = swipePower(info.offset.x, info.velocity.x);
    if (swipe < -SWIPE_CONFIDENCE_THRESHOLD || info.offset.x < -SWIPE_DISTANCE_THRESHOLD) {
      goTo(index + 1);
    } else if (swipe > SWIPE_CONFIDENCE_THRESHOLD || info.offset.x > SWIPE_DISTANCE_THRESHOLD) {
      goTo(index - 1);
    }
  }

  const slide = SLIDES[index];

  return (
    <div className="relative min-h-screen flex flex-col bg-bg">
      <div className="absolute top-6 left-6 font-heading text-accent text-lg font-bold">
        Pepper
      </div>

      <div className="relative flex-grow overflow-hidden">
        <AnimatePresence custom={direction} initial={false}>
          <motion.div
            key={index}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SLIDE_TRANSITION}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={handleDragEnd}
            className="absolute inset-0 flex flex-col items-center justify-center text-center px-8 gap-4"
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
          className="bg-accent text-accent-contrast font-medium h-12 w-full max-w-sm rounded-full mx-auto block"
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
