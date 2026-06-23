"use client";

import { Mail, MapPin, Phone, User } from "lucide-react";
import { motion, type Variants } from "motion/react";
import BookmarkRow from "../components/BookmarkRow";
import SeeAllButton from "../components/SeeAllButton";
import { GitHub, LinkedIn } from "../components/ui/icons";
import { bookmarksData } from "../data/bookmarks";

const MotionMapPin = motion.create(MapPin);
const MotionPhone = motion.create(Phone);
const MotionMail = motion.create(Mail);
const MotionUser = motion.create(User);

const iconBounceVariants: Variants = {
  normal: { y: 0 },
  animate: {
    y: [0, -2, 0.25, 0],
    transition: {
      duration: 0.45,
      ease: "easeOut",
    },
  },
};

export default function Home() {
  // Show only first 3 bookmarks in the peek window
  const featuredBookmarks = bookmarksData.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#fefefe] text-zinc-900 font-sans antialiased">
      <div className="max-w-3xl mx-auto px-6 py-12 sm:py-20">
        {/* Intro Header */}
        <header className="mb-12">
          {/* Profile Card Header */}
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between mb-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900">
                Tuấn Phát
              </h1>
              <p className="text-xs text-zinc-400 font-mono mt-1.5 uppercase tracking-wider">
                Software Developer
              </p>
            </div>
          </div>

          {/* Grid Metadata columns (gridless) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-1 gap-y-1 text-sm text-zinc-500 mb-4 -mx-2 sm:w-2/3">
            <div className="space-y-1">
              <motion.div
                initial="normal"
                whileHover="animate"
                className="flex items-center gap-2.5 group cursor-default py-1.5 px-2 rounded-md hover:bg-zinc-100/70 transition-colors"
              >
                <MotionMapPin
                  variants={iconBounceVariants}
                  className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors"
                />
                <span className="group-hover:text-zinc-900 transition-colors">
                  Ho Chi Minh City, Viet Nam
                </span>
              </motion.div>
              <motion.div
                initial="normal"
                whileHover="animate"
                className="flex items-center gap-2.5 group cursor-pointer py-1.5 px-2 rounded-md hover:bg-zinc-100/70 transition-colors"
              >
                <MotionPhone
                  variants={iconBounceVariants}
                  className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors"
                />
                <a
                  href="tel:+84326149613"
                  className="font-mono text-sm group-hover:text-zinc-900 transition-colors"
                >
                  +84 326 149 613
                </a>
              </motion.div>
            </div>

            <div className="space-y-1">
              <motion.div
                initial="normal"
                whileHover="animate"
                className="flex items-center gap-2.5 group cursor-pointer py-1.5 px-2 rounded-md hover:bg-zinc-100/70 transition-colors"
              >
                <MotionMail
                  variants={iconBounceVariants}
                  className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors"
                />
                <a
                  href="mailto:zchr.work@gmail.com"
                  className="group-hover:text-zinc-900 transition-colors"
                >
                  zchr.work@gmail.com
                </a>
              </motion.div>
              <motion.div
                initial="normal"
                whileHover="animate"
                className="flex items-center gap-2.5 group cursor-default py-1.5 px-2 rounded-md hover:bg-zinc-100/70 transition-colors"
              >
                <MotionUser
                  variants={iconBounceVariants}
                  className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors"
                />
                <span className="group-hover:text-zinc-900 transition-colors">
                  he / him
                </span>
              </motion.div>
            </div>
          </div>

          {/* Social Buttons Row */}
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/zAcherttp"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-7 h-7 rounded-md border border-zinc-200/60 hover:bg-zinc-50 hover:border-zinc-300/80 hover:text-zinc-900 text-zinc-400 transition-all"
              aria-label="GitHub"
            >
              <GitHub className="w-3.5 h-3.5" />
            </a>
            <a
              href="https://www.linkedin.com/in/ttuanphat91605/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center w-7 h-7 rounded-md border border-zinc-200/60 hover:bg-zinc-50 hover:border-zinc-300/80 hover:text-zinc-900 text-zinc-400 transition-all"
              aria-label="LinkedIn"
            >
              <LinkedIn className="w-3.5 h-3.5" />
            </a>
          </div>
        </header>

        {/* Bookmarks Peek Widget */}
        <section className="mb-12">
          <div className="flex justify-between items-baseline mb-2">
            <h2 className="text-sm font-normal text-zinc-600">Bookmarks</h2>
          </div>

          <div className="flex flex-col -mx-3 border-b border-zinc-100 pb-4">
            {featuredBookmarks.map((bookmark) => (
              <BookmarkRow key={bookmark.id} bookmark={bookmark} />
            ))}

            <SeeAllButton remaining={bookmarksData.slice(3)} />
          </div>
        </section>

        {/* Footer/Framing Placeholder */}
        <footer className="pt-6 text-xs text-zinc-400">
          <p>
            © {new Date().getFullYear()} — Built with Next.js and Tailwind CSS
          </p>
        </footer>
      </div>
    </div>
  );
}
