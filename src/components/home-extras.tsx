'use client';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { MobileCardSlider } from './mobile-card-slider';
import { ArrowUpRight, Code2, GraduationCap, Minus, Plus, ShieldCheck, Trophy } from 'lucide-react';

const names = [
  'Build projects',
  'Solve problems',
  'Explore ideas',
  'Work together',
  'Keep learning',
  'Get placement ready',
];
export function CompanyLoop() {
  return (
    <section className="company-loop" aria-label="Company and university logo showcase">
      <p>BIG AMBITIONS. FAMILIAR NAMES.</p>
      <div className="company-loop-window">
        <div className="company-loop-track" aria-hidden="true">
          {[0, 1].map((i) => (
            <div className="company-loop-group" key={i}>
              <span className="loop-razor">
                <b>↗</b> Razorpay
              </span>
              <span className="loop-google">
                {'Google'.split('').map((c, j) => (
                  <i
                    key={j}
                    style={{
                      color: ['#4285f4', '#ea4335', '#fbbc05', '#4285f4', '#34a853', '#ea4335'][j],
                    }}
                  >
                    {c}
                  </i>
                ))}
              </span>
              <span className="loop-atlassian">
                <b>▲</b> ATLASSIAN
              </span>
              <span className="loop-microsoft">
                <i>
                  <b />
                  <b />
                  <b />
                  <b />
                </i>
                Microsoft
              </span>
              <span className="loop-tcs">tcs</span>
              <span className="loop-notion">
                <b>N</b>Notion
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="university-loop-label">FROM CAMPUS TO CAREER.</div>
      <div className="company-loop-window university-loop-window">
        <div className="company-loop-track university-loop-track" aria-hidden="true">
          {[0, 1].map((i) => (
            <div className="university-loop-group" key={i}>
              {[
                { name: 'IIT Bhubaneswar', src: 'iit-bhubaneswar.png' },
                { name: 'NIT Rourkela', src: 'nit-rourkela.png' },
                { name: 'Utkal University', src: 'utkal.png' },
                { name: 'IIIT Bangalore', src: 'iiit-bangalore.png' },
              ].map((u) => (
                <div className="university-wordmark" key={u.name}>
                  <Image src={`/logos/${u.src}`} alt="" width={170} height={50} />
                  <span>{u.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <small>Explore opportunities across companies and campuses.</small>
    </section>
  );
}

export function MomentumSection() {
  const reduced = useHydratedReducedMotion();
  return (
    <section className="momentum-section content-width">
      <div className="momentum-heading">
        <span className="campus-kicker">THE SMALL WINS ADD UP.</span>
        <h2>
          Make progress.
          <br />
          <em>Make it visible.</em>
        </h2>
        <p>Build a profile with something behind it.</p>
      </div>
      <MobileCardSlider className="momentum-cards" label="Projects, skills and campus challenges">
        {[
          {
            icon: Code2,
            title: 'Build something real.',
            text: 'Your projects deserve more than a forgotten folder.',
            tags: ['Portfolio', 'Projects', 'Experience'],
            href: '/student/profile',
            color: 'blue',
          },
          {
            icon: ShieldCheck,
            title: 'Show what you know.',
            text: 'Go from a skill on your resume to a verified result.',
            tags: ['React', 'SQL', 'JavaScript'],
            href: '/student/skills',
            color: 'green',
          },
          {
            icon: Trophy,
            title: 'Keep raising the bar.',
            text: 'Turn campus challenges into a habit of getting better.',
            tags: ['Challenges', 'XP', 'Leaderboard'],
            href: '/student/contests',
            color: 'yellow',
          },
        ].map((c, i) => (
          <motion.div
            className={`momentum-card momentum-${c.color}`}
            key={c.title}
            initial={{ opacity: 0, y: 45, rotate: reduced ? 0 : [-3, 2, -2][i] }}
            whileInView={{ opacity: 1, y: 0, rotate: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, delay: reduced ? 0 : i * 0.12 }}
            whileHover={reduced ? {} : { y: -8 }}
          >
            <div className="momentum-art">
              <motion.div
                animate={reduced ? {} : { rotate: i === 1 ? [0, 360] : [0, -8, 0] }}
                transition={{ duration: i === 1 ? 24 : 5, repeat: Infinity, ease: 'linear' }}
                className="momentum-orb"
              >
                <c.icon size={45} />
              </motion.div>
              {c.tags.map((t, j) => (
                <motion.span
                  key={t}
                  className={`momentum-tag tag-${j}`}
                  animate={reduced ? {} : { y: [0, j % 2 ? -5 : 5, 0] }}
                  transition={{ duration: 4 + j, repeat: Infinity }}
                >
                  {t}
                </motion.span>
              ))}
            </div>
            <h3>{c.title}</h3>
            <p>{c.text}</p>
            <Link href={c.href}>
              Start here <ArrowUpRight size={18} />
            </Link>
          </motion.div>
        ))}
      </MobileCardSlider>
    </section>
  );
}

const faqs = [
  {
    q: 'Who is CampusLink for?',
    a: 'Students build their career profiles and prepare for placements. Recruiters discover candidates and manage hiring. Campus teams coordinate drives and track student progress.',
  },
  {
    q: 'How does skill verification work?',
    a: 'Choose a skill on your profile and complete its assessment. Passing results add a verified badge to that skill, with your assessment history and career points updated in the same workspace.',
  },
  {
    q: 'Can recruiters see my verified skills?',
    a: 'The recruiter workspace includes student profiles, verified skills, and candidate discovery. The preview uses sample profiles and opportunities so you can explore the workflow.',
  },
  {
    q: 'How do I start preparing?',
    a: 'Add your skills, complete a verification, and try a mock interview. Your dashboard brings together your progress, upcoming interviews, and recommended opportunities.',
  },
];
export function CommunityAndFAQ() {
  const [open, setOpen] = useState<number | null>(0);
  const reduced = useHydratedReducedMotion();
  return (
    <>
      <section className="campus-community content-width">
        <div>
          <span className="campus-kicker">DIFFERENT STORIES. SHARED AMBITION.</span>
          <h2>
            Your campus.
            <br />
            <em>Your kind of people.</em>
          </h2>
          <p>Different strengths. A shared place to grow.</p>
        </div>
        <motion.div
          className="community-grid"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={{ visible: { transition: { staggerChildren: reduced ? 0 : 0.08 } } }}
        >
          {names.map((name, i) => (
            <motion.div
              key={name}
              variants={{ hidden: { opacity: 0, scale: 0.85 }, visible: { opacity: 1, scale: 1 } }}
              whileHover={reduced ? {} : { rotate: i % 2 ? 3 : -3, scale: 1.04 }}
              className={`community-person person-${i}`}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              <b>{name}</b>
              <small>
                {
                  [
                    'Frontend enthusiast',
                    'Problem solver',
                    'Creative developer',
                    'Campus collaborator',
                    'Builder & explorer',
                    'Future engineer',
                  ][i]
                }
              </small>
              <GraduationCap size={17} />
            </motion.div>
          ))}
        </motion.div>
      </section>
      <section className="home-faq content-width">
        <div>
          <span className="campus-kicker">A FEW THINGS YOU MIGHT WONDER.</span>
          <h2>
            Good questions.
            <br />
            Clear answers.
          </h2>
        </div>
        <div className="home-faq-items">
          {faqs.map((f, i) => (
            <div className={`home-faq-item ${open === i ? 'faq-open' : ''}`} key={f.q}>
              <button
                aria-expanded={open === i}
                aria-controls={`home-answer-${i}`}
                id={`home-question-${i}`}
                onClick={() => setOpen(open === i ? null : i)}
              >
                {f.q}
                {open === i ? <Minus size={17} /> : <Plus size={17} />}
              </button>
              <AnimatePresence initial={false}>
                {open === i && (
                  <motion.div
                    id={`home-answer-${i}`}
                    role="region"
                    aria-labelledby={`home-question-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: reduced ? 0 : 0.25 }}
                  >
                    <p>{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
