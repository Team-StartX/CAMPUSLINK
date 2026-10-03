'use client';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';

import Image from 'next/image';
import { CompanyLoop } from './home-extras';
import Link from 'next/link';
import { AnimatePresence, motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown, ArrowUpRight, Check, Code2, ShieldCheck, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { PublicStartLink } from './public-session';

const words = ['STAND OUT.', 'GET HIRED.', 'GO FURTHER.'];
const pathways = [
  {
    label: 'Verify skills',
    icon: ShieldCheck,
    title: 'Make your skills count.',
    detail: 'Take a focused assessment. Give recruiters proof of what you can do.',
    href: '/student/skills',
    action: 'Explore skill verification',
    tag: '01 / BUILD YOUR PROOF',
    rows: ['React · JavaScript · SQL', 'Skill assessments', 'Verified career profile'],
  },
  {
    label: 'Find opportunities',
    icon: Code2,
    title: 'Find your next move.',
    detail: 'Explore activated campus drives, check eligibility, and track each application.',
    href: '/student/opportunities',
    action: 'Explore opportunities',
    tag: '02 / MAKE YOUR MOVE',
    rows: ['Approved campus visits', 'Eligibility before demo matching', 'Application tracking'],
  },
  {
    label: 'Earn your place',
    icon: Trophy,
    title: 'A little competition. A lot of growth.',
    detail: 'Join campus challenges, sharpen your thinking, and move up the leaderboard.',
    href: '/student/contests',
    action: 'Explore campus contests',
    tag: '03 / KEEP GETTING BETTER',
    rows: ['Campus challenges', 'XP & achievements', 'Student leaderboard'],
  },
];

export function CampusHero() {
  const reduced = useHydratedReducedMotion();
  const [word, setWord] = useState(0);
  const [path, setPath] = useState(0);
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const artY = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 85]);
  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setWord((i) => (i + 1) % words.length), 3600);
    return () => clearInterval(timer);
  }, [reduced]);
  const selected = pathways[path];
  return (
    <>
      <section ref={ref} className="campus-hero">
        <div className="campus-hero-grid content-width">
          <div className="campus-hero-copy">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              className="campus-hero-signature"
            >
              Your campus. Your launchpad.
            </motion.div>
            <h1 className="campus-placement-heading">
              <span>From Campus</span>
              <span>Potential to</span>
              <span>
                <em>Career Opportunity.</em>
              </span>
              <span className="kinetic-line" aria-label="Stand out. Get hired. Go further.">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={word}
                    aria-hidden="true"
                    initial={{ y: '100%', rotate: 3 }}
                    animate={{ y: 0, rotate: 0 }}
                    exit={{ y: '-100%', rotate: -3 }}
                    transition={{ duration: reduced ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }}
                  >
                    {words[word]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              A unified campus placement ecosystem. Students build verified career profiles,
              companies request on-campus recruitment drives, and placement cells coordinate the
              journey from preparation to offer.
            </motion.p>
            <div className="campus-hero-actions">
              <PublicStartLink className="campus-button" href="/register?role=student">
                Get started <ArrowUpRight size={20} />
              </PublicStartLink>
              <Link className="campus-secondary" href="/features">
                Explore platform <ArrowUpRight size={18} />
              </Link>
            </div>
            <div className="campus-hero-note">
              <ShieldCheck size={16} /> Physical campus drives. Coordinated by your placement cell.
            </div>
            <div
              className="hero-flow"
              aria-label="Student, verify, prepare, campus drive, match, interview, offer"
            >
              {['Student', 'Verify', 'Prepare', 'Campus drive', 'Match', 'Interview', 'Offer'].map(
                (stage, i) => (
                  <motion.span
                    key={stage}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: reduced ? 0 : 0.3 + i * 0.12 }}
                  >
                    {stage}
                    {i < 6 && <ArrowUpRight size={12} />}
                  </motion.span>
                ),
              )}
            </div>
          </div>
          <motion.div style={{ y: artY }} className="student-collage">
            <div className="collage-disc" />
            <div className="collage-grid" />
            <span className="collage-outline">
              NEXT
              <br />
              UP.
            </span>
            <motion.div
              initial={{ opacity: 0, y: 70 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="student-cutout"
            >
              <Image
                src="/images/student-hero.png"
                alt="Student carrying a laptop and backpack"
                width={1024}
                height={1536}
                priority
              />
            </motion.div>
            <motion.div
              className="collage-sticker"
              animate={reduced ? {} : { rotate: [10, 14, 10] }}
              transition={{ duration: 6, repeat: Infinity }}
            >
              <ArrowUpRight size={31} />
              <span>
                YOUR
                <br />
                NEXT MOVE
              </span>
            </motion.div>
            <motion.div
              className="collage-skill"
              animate={reduced ? {} : { y: [0, -8, 0] }}
              transition={{ duration: 5, repeat: Infinity }}
            >
              <span className="collage-check">
                <Check size={20} />
              </span>
              <div>
                <small>DON’T JUST SAY IT.</small>
                <b>Prove your potential.</b>
                <span>Skills that speak for themselves.</span>
              </div>
            </motion.div>
            <div className="collage-caption">
              <span>THE NEXT GENERATION</span>
              <b>Ready for what’s next. ↗</b>
            </div>
            <div className="collage-tape">LEARN. BUILD. REPEAT.</div>
          </motion.div>
        </div>
        <div className="campus-hero-footer content-width">
          <span>FOR STUDENTS WITH BIG PLANS.</span>
          <a href="#career-pathways">
            MAKE YOUR NEXT MOVE <ArrowDown size={15} />
          </a>
          <span>AND THE CAMPUSES BEHIND THEM.</span>
        </div>
      </section>
      <div
        className="career-marquee"
        aria-label="Verify skills. Practice interviews. Discover opportunities. Build your future."
      >
        <div aria-hidden="true">
          {[0, 1].map((i) => (
            <div className="marquee-group" key={i}>
              {[
                'VERIFY YOUR SKILLS',
                'PRACTICE YOUR INTERVIEW',
                'FIND YOUR OPPORTUNITY',
                'BUILD YOUR FUTURE',
              ].map((t) => (
                <span key={t}>
                  {t}
                  <span className="marquee-star">✳</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <CompanyLoop />
      <section className="career-playground content-width" id="career-pathways">
        <div className="career-playground-heading">
          <div>
            <span className="campus-kicker">LESS GUESSWORK. MORE MOMENTUM.</span>
            <h2>
              Your next move,
              <br />
              starts right here.
            </h2>
          </div>
          <p>
            From your first verified skill to your first offer.
            <br />
            Choose where you want to start.
          </p>
        </div>
        <div className="pathway-tabs" role="tablist" aria-label="Explore career pathways">
          {pathways.map((p, i) => (
            <button
              key={p.label}
              role="tab"
              id={`pathway-tab-${i}`}
              aria-selected={path === i}
              aria-controls="pathway-panel"
              onClick={() => setPath(i)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const next = (i + (e.key === 'ArrowRight' ? 1 : 2)) % 3;
                  setPath(next);
                  document.getElementById(`pathway-tab-${next}`)?.focus();
                }
              }}
              tabIndex={path === i ? 0 : -1}
            >
              {path === i && (
                <motion.span
                  layoutId="pathway-pill"
                  className="pathway-active"
                  transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                />
              )}
              <p.icon size={17} />
              <span>{p.label}</span>
              <ArrowUpRight size={15} />
            </button>
          ))}
        </div>
        <div
          className="pathway-panel"
          id="pathway-panel"
          role="tabpanel"
          aria-labelledby={`pathway-tab-${path}`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={path}
              initial={{ opacity: 0, y: reduced ? 0 : 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="pathway-panel-content"
            >
              <div>
                <span className="campus-kicker">{selected.tag}</span>
                <h3>{selected.title}</h3>
                <p>{selected.detail}</p>
                <Link href={selected.href} className="campus-secondary">
                  {selected.action}
                  <ArrowUpRight size={18} />
                </Link>
              </div>
              <div className="pathway-feed">
                <div className="feed-heading">
                  <span>
                    <i /> YOUR CAREER TOOLKIT
                  </span>
                  <small>PREVIEW</small>
                </div>
                {selected.rows.map((row, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: reduced ? 0 : i * 0.09 }}
                    key={row}
                    className="feed-row"
                  >
                    <span>0{i + 1}</span>
                    <b>{row}</b>
                    <Check size={17} />
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </>
  );
}
