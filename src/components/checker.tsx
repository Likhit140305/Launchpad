"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight } from "lucide-react";
import { track } from "@/lib/client";

const QUESTIONS = [
  "Have you built an application that uses an AI model?",
  "Do you have a project deployed on a public URL that you can show a recruiter?",
  "Have you connected an AI API or model to an application yourself?",
  "Do you have an AI project outside your regular coursework that you can confidently discuss in an interview?",
  "If given an hour, could you build and deploy a small working AI application?",
];

export function PlacementChecker() {
  const [state, setState] = useState<"idle" | "playing" | "result">("idle");
  const [current, setCurrent] = useState(0);
  const [score, setScore] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const [viewTracked, setViewTracked] = useState(false);

  useEffect(() => {
    if (!ref.current || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !viewTracked) {
        track("checker_viewed");
        setViewTracked(true);
      }
    }, { threshold: 0.2 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [viewTracked]);

  const start = () => {
    track("checker_started");
    setState("playing");
    setCurrent(0);
    setScore(0);
  };

  const answer = (isYes: boolean) => {
    track("checker_question_answered", { question_number: current + 1, answer: isYes ? "yes" : "not_yet" });
    if (isYes) setScore((s) => s + 1);
    
    if (current < QUESTIONS.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      const finalScore = score + (isYes ? 1 : 0);
      track("checker_completed", { score: finalScore });
      setState("result");
    }
  };

  const retake = () => {
    track("checker_retake");
    setState("playing");
    setCurrent(0);
    setScore(0);
  };

  const ctaClick = () => {
    track("checker_cta_clicked", { score });
  };

  const getResultCopy = (s: number) => {
    if (s <= 1) return { title: "You're just getting started.", body: "You may know some AI concepts, but you don't yet have much that a recruiter can interact with. The fastest way to change that is to build something small, real and deployed." };
    if (s <= 3) return { title: "You have the foundations.", body: "What you're missing is something concrete you can put in front of a recruiter and say: 'I built this.'" };
    if (s === 4) return { title: "You're almost there.", body: "You already have most of the pieces. One working, deployed project could turn that knowledge into something you can demonstrate." };
    return { title: "You're ready to build.", body: "Now turn that confidence into something a recruiter can actually open, test and see." };
  };

  return (
    <div ref={ref} className="bg-white pb-6 pt-16 px-4 sm:px-6">
      <div className="mx-auto max-w-3xl rounded-2xl bg-navy-900 p-8 text-white shadow-xl sm:p-12">
        <AnimatePresence mode="wait">
          {state === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-navy-800 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-marigold-400">
                ⚡ One-Minute Check
              </div>
              <h2 className="mb-4 font-display text-3xl font-bold leading-tight sm:text-4xl">
                Can you show a recruiter something you built?
              </h2>
              <p className="mx-auto mb-10 max-w-[40ch] text-lg text-navy-200">
                Five yes-or-no questions. No signup needed to see your result.
              </p>
              <button
                onClick={start}
                className="inline-flex items-center gap-2 rounded-xl bg-marigold-400 px-8 py-4 font-display text-lg font-bold text-navy-950 transition-colors hover:bg-marigold-500"
              >
                Start the check <ArrowUpRight className="h-5 w-5" />
              </button>
            </motion.div>
          )}

          {state === "playing" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mb-8 flex items-center justify-between">
                <span className="text-sm font-bold uppercase tracking-wider text-navy-300">
                  Question {current + 1} of {QUESTIONS.length}
                </span>
                <div className="flex gap-2">
                  {QUESTIONS.map((_, i) => (
                    <span
                      key={i}
                      className={`h-2.5 w-2.5 rounded-full ${i === current ? "bg-marigold-400" : i < current ? "bg-marigold-400/40" : "bg-navy-700"}`}
                    />
                  ))}
                </div>
              </div>
              
              <div className="min-h-[140px] flex items-center">
                <AnimatePresence mode="wait">
                  <motion.h3
                    key={current}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="font-display text-2xl font-bold leading-snug sm:text-3xl"
                  >
                    {QUESTIONS[current]}
                  </motion.h3>
                </AnimatePresence>
              </div>

              <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <button
                  onClick={() => answer(true)}
                  className="rounded-xl border border-navy-600 bg-navy-800 p-5 text-center text-lg font-bold transition-colors hover:border-marigold-400 hover:bg-navy-700"
                >
                  Yes
                </button>
                <button
                  onClick={() => answer(false)}
                  className="rounded-xl border border-navy-600 bg-navy-800 p-5 text-center text-lg font-bold transition-colors hover:border-marigold-400 hover:bg-navy-700"
                >
                  Not yet
                </button>
              </div>
            </motion.div>
          )}

          {state === "result" && (() => {
            const copy = getResultCopy(score);
            return (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="mb-4 text-sm font-bold uppercase tracking-widest text-navy-300">
                  Your AI Placement Readiness
                </div>
                <div className="font-display text-8xl font-extrabold text-marigold-400">
                  {score} <span className="text-5xl text-navy-400">/ 5</span>
                </div>
                
                <h3 className="mt-8 font-display text-2xl font-bold sm:text-3xl">
                  {copy.title}
                </h3>
                <p className="mx-auto mt-4 max-w-[50ch] text-lg text-navy-200">
                  {copy.body}
                </p>
                <p className="mt-6 font-display font-semibold text-white text-xl">
                  Build something you can show.
                </p>

                <div className="mt-10 flex flex-col items-center justify-center gap-6 sm:flex-row">
                  <a
                    href="#register"
                    onClick={ctaClick}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-marigold-400 px-8 py-4 font-display text-lg font-bold text-navy-950 transition-colors hover:bg-marigold-500 sm:w-auto"
                  >
                    Build My AI Project <ArrowUpRight className="h-5 w-5" />
                  </a>
                  <button
                    onClick={retake}
                    className="text-sm font-semibold text-navy-300 hover:text-white"
                  >
                    Retake the check
                  </button>
                </div>
              </motion.div>
            );
          })()}
        </AnimatePresence>
      </div>
    </div>
  );
}
