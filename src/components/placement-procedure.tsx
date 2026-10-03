'use client';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useSpring } from 'framer-motion';
import { ArrowUpRight, Check, Code2, GraduationCap, ShieldCheck, Sparkles } from 'lucide-react';

const steps = [
  {
    title: 'Build your profile.',
    label: 'YOUR STARTING POINT',
    description:
      'Add your education, projects, and skills. Give your campus and recruiters a clear view of what you can do.',
    icon: GraduationCap,
    color: 'blue',
  },
  {
    title: 'Verify your skills.',
    label: 'TURN KNOWLEDGE INTO PROOF',
    description:
      'Take focused assessments. Earn verified skill badges and keep your results together in your career profile.',
    icon: ShieldCheck,
    color: 'green',
  },
  {
    title: 'Apply to an active campus drive.',
    label: 'MAKE YOUR NEXT MOVE',
    description:
      'Your placement cell reviews and activates campus drives. Pass hard eligibility first, review the demo match, and apply before the deadline.',
    icon: Sparkles,
    color: 'yellow',
  },
  {
    title: 'Prepare. Interview. Progress.',
    label: 'FROM PREPARATION TO PLACEMENT',
    description:
      'Practice ahead of time, then attend the company’s physical campus visit for assessments and interviews. Follow selection, offers, documents, and joining.',
    icon: Code2,
    color: 'pink',
  },
];
function StepPreview({ step }: { step: number }) {
  return (
    <div className={`procedure-demo demo-${step}`}>
      <div className="procedure-demo-top">
        <span>campuslink / {['PROFILE', 'VERIFICATION', 'OPPORTUNITIES', 'INTERVIEWS'][step]}</span>
        <i />
        <i />
        <i />
      </div>
      {step === 0 ? (
        <>
          <div className="procedure-profile">
            <span>CS</span>
            <div>
              <b>Student profile</b>
              <small>Computer Science · Class of 2027</small>
            </div>
            <GraduationCap size={24} />
          </div>
          <div className="procedure-chips">
            <span>React</span>
            <span>JavaScript</span>
            <span>SQL</span>
          </div>
          <div className="procedure-progress">
            <span>Profile, in progress</span>
            <b>82%</b>
            <div>
              <motion.i
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true }}
              />
            </div>
          </div>
        </>
      ) : step === 1 ? (
        <>
          <div className="procedure-result">
            <ShieldCheck size={33} />
            <div>
              <small>REACT SKILL VERIFICATION</small>
              <b>
                84<span>/100</span>
              </b>
            </div>
            <span className="procedure-verified">
              <Check size={12} />
              Verified
            </span>
          </div>
          <div className="procedure-chips">
            <span>Assessment complete</span>
            <span>+120 XP</span>
          </div>
          <p>Proof that travels with your profile.</p>
        </>
      ) : step === 2 ? (
        <>
          <div className="procedure-job">
            <span>↗</span>
            <div>
              <small>RAZORPAY</small>
              <b>Frontend Engineer</b>
              <p>Bengaluru · Full time</p>
            </div>
            <ArrowUpRight size={22} />
          </div>
          <div className="procedure-chips">
            <span>React</span>
            <span>JavaScript</span>
            <span>SQL</span>
          </div>
          <div className="procedure-application">
            <span>
              <i />
              Application tracked
            </span>
            <b>View opportunity ↗</b>
          </div>
        </>
      ) : (
        <>
          <div className="procedure-interview">
            <span className="procedure-wave">
              {[18, 30, 44, 24, 38, 52, 26, 16, 35, 22].map((h, i) => (
                <i style={{ height: h }} key={i} />
              ))}
            </span>
            <b>Find your voice.</b>
            <small>Practice before the conversation that matters.</small>
          </div>
          <div className="procedure-chips">
            <span>Mock interviews</span>
            <span>Schedule & feedback</span>
          </div>
        </>
      )}
    </div>
  );
}
export function PlacementProcedure() {
  const target = useRef<HTMLElement>(null);
  const reduced = useHydratedReducedMotion();
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target, offset: ['start 55%', 'end 80%'] });
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28 });
  useMotionValueEvent(scrollYProgress, 'change', () => {
    const rows = target.current?.querySelectorAll('.procedure-step');
    let current = 0;
    rows?.forEach((row, index) => {
      if (row.getBoundingClientRect().top <= window.innerHeight * 0.55) current = index;
    });
    setActive(current);
  });
  return (
    <section className="procedure-section" ref={target} id="placement-procedure">
      <div className="procedure-layout content-width">
        <div className="procedure-intro">
          <span className="campus-kicker">HOW CAMPUSLINK WORKS</span>
          <h2>
            The standard
            <br />
            <em>operating procedure.</em>
          </h2>
          <p>
            A clear path from campus potential to career opportunity. One connected step at a time.
          </p>
          <div className="procedure-map" aria-label={`Current highlighted step: ${active + 1}`}>
            {steps.map((s, i) => (
              <a
                key={s.title}
                href={`#procedure-step-${i}`}
                className={active === i ? 'current' : active > i ? 'complete' : ''}
              >
                <span>{active > i ? <Check size={12} /> : String(i + 1).padStart(2, '0')}</span>
                {s.title}
              </a>
            ))}
          </div>
          <Link href="/register?role=student" className="campus-secondary">
            Start your journey
            <ArrowUpRight size={18} />
          </Link>
        </div>
        <div className="procedure-timeline">
          <div className="procedure-line" aria-hidden="true">
            <motion.div style={{ scaleY: reduced ? 1 : progress }} />
          </div>
          {steps.map((s, i) => (
            <motion.article
              className={`procedure-step step-${s.color} ${active === i ? 'step-current' : ''}`}
              key={s.title}
              id={`procedure-step-${i}`}
              initial={{ opacity: reduced ? 1 : 0.65, y: reduced ? 0 : 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ amount: 0.35, once: false }}
              transition={{ duration: reduced ? 0 : 0.45 }}
            >
              <span className="procedure-node">{String(i + 1).padStart(2, '0')}</span>
              <div className="procedure-step-heading">
                <span className="procedure-icon">
                  <s.icon size={21} />
                </span>
                <span className="campus-kicker">{s.label}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
              <StepPreview step={i} />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
