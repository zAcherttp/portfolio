"use client";

import { Mail, MapPin, Phone, User } from "lucide-react";
import { motion, type Variants } from "motion/react";
import { profile } from "@/data/profile";

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

export function HomeProfile() {
  return (
    <>
      <div className="mb-4 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {profile.name}
          </h1>
          <p className="mt-1.5 font-mono text-xs tracking-wider text-subtle uppercase">
            {profile.role}
          </p>
        </div>
      </div>

      <div className="-mx-2 mb-4 grid grid-cols-1 gap-x-1 gap-y-1 text-sm text-muted-foreground sm:w-2/3 sm:grid-cols-2">
        <div className="space-y-1">
          <motion.div
            initial="normal"
            whileHover="animate"
            className="group flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
          >
            <MotionMapPin
              variants={iconBounceVariants}
              className="h-4 w-4 text-subtle transition-colors group-hover:text-foreground"
            />
            <span className="transition-colors group-hover:text-foreground">
              Ho Chi Minh City, Viet Nam
            </span>
          </motion.div>
          <motion.div
            initial="normal"
            whileHover="animate"
            className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
          >
            <MotionPhone
              variants={iconBounceVariants}
              className="h-4 w-4 text-subtle transition-colors group-hover:text-foreground"
            />
            <a
              href="tel:+84326149613"
              className="font-mono text-sm transition-colors group-hover:text-foreground"
            >
              +84 326 149 613
            </a>
          </motion.div>
        </div>

        <div className="space-y-1">
          <motion.div
            initial="normal"
            whileHover="animate"
            className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
          >
            <MotionMail
              variants={iconBounceVariants}
              className="h-4 w-4 text-subtle transition-colors group-hover:text-foreground"
            />
            <a
              href="mailto:zchr.work@gmail.com"
              className="transition-colors group-hover:text-foreground"
            >
              zchr.work@gmail.com
            </a>
          </motion.div>
          <motion.div
            initial="normal"
            whileHover="animate"
            className="group flex cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-hover"
          >
            <MotionUser
              variants={iconBounceVariants}
              className="h-4 w-4 text-subtle transition-colors group-hover:text-foreground"
            />
            <span className="transition-colors group-hover:text-foreground">
              he / him
            </span>
          </motion.div>
        </div>
      </div>
    </>
  );
}
