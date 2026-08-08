import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Layers, AudioLines, Search, MessagesSquare, Sparkles, Brain } from "lucide-react";

const FADE_UP = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const FEATURES = [
  {
    icon: Layers,
    title: "Save Anything, Instantly",
    desc: "Send a reel, article, podcast, or a thought at midnight. Pepper keeps it, all in one place.",
  },
  {
    icon: AudioLines,
    title: "Transcribed Automatically",
    desc: "Audio and video become searchable text the moment you save them. No re-listening, no typing it out.",
  },
  {
    icon: Search,
    title: "Find It in Seconds",
    desc: "Hybrid semantic and keyword search means you find what you meant, not just what you typed.",
  },
  {
    icon: MessagesSquare,
    title: "Ask, and It Remembers",
    desc: "Chat with everything you've saved. Pepper recalls the details so you don't have to.",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-bg flex flex-col">
      <header className="max-w-6xl w-full mx-auto flex items-center justify-between px-6 py-6">
        <span className="font-heading text-accent text-xl font-bold">Pepper</span>
        <nav className="flex items-center gap-3">
          <Link
            to="/login"
            className="text-text-secondary hover:text-text-primary text-sm font-medium transition-colors px-2"
          >
            Log in
          </Link>
          <Link
            to="/signup"
            className="bg-accent text-accent-contrast text-sm font-medium rounded-full px-5 py-2.5 hover:opacity-90 transition-opacity"
          >
            Sign Up
          </Link>
        </nav>
      </header>

      <main className="flex-grow">
        <section className="max-w-3xl mx-auto flex flex-col items-center text-center px-6 pt-16 pb-24 gap-6">
          <motion.div
            initial="hidden"
            animate="show"
            variants={FADE_UP}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="glass-card rounded-full px-4 py-1.5 text-xs uppercase tracking-widest text-accent flex items-center gap-2"
          >
            <Sparkles size={14} />
            Your second brain, powered by AI
          </motion.div>

          <motion.h1
            initial="hidden"
            animate="show"
            variants={FADE_UP}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.06 }}
            className="font-heading text-text-primary text-5xl md:text-6xl font-semibold leading-tight"
          >
            Everything you save,
            <br />
            remembered.
          </motion.h1>

          <motion.p
            initial="hidden"
            animate="show"
            variants={FADE_UP}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.12 }}
            className="text-text-secondary text-lg max-w-xl"
          >
            Pepper is a quiet place to keep articles, reels, podcasts, and stray thoughts — instantly
            transcribed, searchable, and ready to talk to.
          </motion.p>

          <motion.div
            initial="hidden"
            animate="show"
            variants={FADE_UP}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.18 }}
            className="flex flex-col items-center gap-3 mt-2"
          >
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link
                to="/signup"
                className="bg-accent text-accent-contrast font-medium h-12 px-8 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              >
                Get Started Free
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/login"
                className="text-text-primary font-medium h-12 px-8 rounded-full flex items-center justify-center border border-text-secondary/25 hover:border-text-secondary/50 transition-colors"
              >
                Log In
              </Link>
            </div>
            <p className="text-text-secondary/60 text-xs">No credit card required.</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: "easeOut", delay: 0.24 }}
            className="w-28 h-28 rounded-full bg-surface border border-text-secondary/10 flex items-center justify-center mt-10"
          >
            <Brain size={44} strokeWidth={1.5} className="text-accent" />
          </motion.div>
        </section>

        <section className="max-w-5xl mx-auto px-6 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="glass-card rounded-2xl p-6 flex flex-col gap-4"
              >
                <div className="w-11 h-11 rounded-full bg-accent/10 flex items-center justify-center">
                  <Icon size={20} strokeWidth={1.75} className="text-accent" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 className="font-heading text-text-primary text-lg font-semibold">{title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="px-6 pb-24">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="glass-card rounded-3xl max-w-4xl mx-auto p-10 md:p-14 text-center flex flex-col items-center gap-6"
          >
            <h2 className="font-heading text-text-primary text-3xl md:text-4xl font-semibold">
              Ready to remember everything?
            </h2>
            <p className="text-text-secondary max-w-md">
              Join Pepper and never lose a good idea again. Intellectual calm for focused minds.
            </p>
            <Link
              to="/signup"
              className="bg-accent text-accent-contrast font-medium h-12 px-8 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
            >
              Create Free Account
              <ArrowRight size={18} />
            </Link>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-text-secondary/10">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4 text-text-secondary text-sm">
          <span>&copy; 2026 Pepper AI</span>
          <div className="flex items-center gap-4 text-text-secondary/70">
            <a href="#" className="hover:text-text-secondary transition-colors">
              Terms of Service
            </a>
            <a href="#" className="hover:text-text-secondary transition-colors">
              Privacy Policy
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
