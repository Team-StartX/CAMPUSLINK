'use client';
import { useHydratedReducedMotion } from '@/hooks/use-hydrated-reduced-motion';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  Building2,
  Check,
  CircleCheck,
  GraduationCap,
  Menu,
  Play,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { MouseEventHandler } from 'react';
import { useEffect, useRef, useState } from 'react';
import { CampusHero } from './campus-hero';
import { CampusOperation } from './campus-operation';
import { CommunityAndFAQ, MomentumSection } from './home-extras';
import { MobileCardSlider } from './mobile-card-slider';
import { PlacementJourney } from './placement-journey';
import { PublicStartLink, usePublicSession } from './public-session';
import { TeamStartX } from './team-startx';
export function Logo({
  dark = false,
  collapsible = false,
  onClick,
  label = 'CampusLink home',
}: {
  dark?: boolean;
  collapsible?: boolean;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  label?: string;
}) {
  return (
    <Link
      href="/"
      className={`logo ${dark ? 'logo-light' : ''}`}
      aria-label={label}
      onClick={onClick}
    >
      <span className="logo-mark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      {collapsible ? (
        <span className="logo-wordmark">
          campus<span className="logo-name-light">link</span>
          <span className="logo-dot">®</span>
        </span>
      ) : (
        <>
          campus<span>link</span>
          <span className="logo-dot">®</span>
        </>
      )}
    </Link>
  );
}
const rise = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};
export function JourneyIllustration() {
  return (
    <div className="journey-art" aria-label="Career journey from student profile to job offer">
      <svg className="journey-lines" viewBox="0 0 590 480">
        <path
          d="M140 90 C430 20 200 260 430 190 S520 350 300 370"
          fill="none"
          stroke="#999184"
          strokeWidth="1.5"
          strokeDasharray="7 7"
        />
      </svg>
      <span className="orbit orbit-one" />
      <span className="art-spark spark-one">✳</span>
      <span className="art-spark spark-two">✦</span>
      <span className="art-plus">+</span>
      <motion.div
        className="journey-profile"
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 6, repeat: Infinity }}
      >
        <div className="tiny-label">
          YOUR POTENTIAL, VERIFIED <ArrowUpRight size={13} />
        </div>
        <div className="profile-art-row">
          <div className="drawn-avatar">
            <GraduationCap size={43} />
          </div>
          <div>
            <strong>Your career profile</strong>
            <p>Future frontend engineer</p>
            <span className="tiny-pill">
              <i /> Open to opportunities
            </span>
          </div>
        </div>
        <div className="art-divider" />
        <div className="art-skills">
          <span>
            <CircleCheck size={13} /> JavaScript
          </span>
          <span>
            <CircleCheck size={13} /> React
          </span>
          <span>
            <CircleCheck size={13} /> SQL
          </span>
        </div>
        <div className="art-profile-bottom">
          <span>Profile strength</span>
          <b>Add your evidence</b>
        </div>
      </motion.div>
      <motion.div
        className="journey-score"
        animate={{ y: [0, 8, 0], rotate: [-5, -3, -5] }}
        transition={{ duration: 7, repeat: Infinity }}
      >
        <span className="score-icon">
          <Sparkles size={19} />
        </span>
        <span>PLACEMENT READINESS</span>
        <p>Skills, academics, projects, and practice results.</p>
        <Link href="/student/readiness">Review your preparation</Link>
      </motion.div>
      <motion.div
        className="journey-match"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
      >
        <div className="company-art">
          R<span>↗</span>
        </div>
        <div>
          <b>Find your next opportunity.</b>
          <p>Active drives at your campus</p>
        </div>
        <span className="match-bubble">
          <small>Review eligibility</small>
        </span>
      </motion.div>
      <motion.div
        className="journey-offer"
        animate={{ y: [0, 6, 0], rotate: [5, 3, 5] }}
        transition={{ duration: 6, repeat: Infinity }}
      >
        <span className="offer-check">
          <Check size={21} />
        </span>
        <div>
          <b>Your next chapter.</b>
          <p>Track offers and joining progress.</p>
        </div>
        <span>✦</span>
      </motion.div>
      <div className="journey-caption">
        <span className="line-arrow">↳</span> A little progress. A world of possibilities.
      </div>
    </div>
  );
}
export function PublicNav() {
  const { user, ready } = usePublicSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [scrollHidden, setScrollHidden] = useState(false);
  const scrollAnchor = useRef(0);
  const [pointerInside, setPointerInside] = useState(false);
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const header = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const pathname = usePathname();
  const { scrollY } = useScroll();
  const reduced = useHydratedReducedMotion();
  useMotionValueEvent(scrollY, 'change', (value) => {
    const position = Math.max(0, value);
    setScrolled((previous) => position > 80 || (previous && position > 40));
    if (position <= 40) {
      setScrollHidden(false);
      scrollAnchor.current = position;
      return;
    }
    const distance = position - scrollAnchor.current;
    if (Math.abs(distance) < 10) return;
    setScrollHidden(distance > 0 && position > 80);
    if (distance > 0) setPointerInside(false);
    scrollAnchor.current = position;
  });
  useEffect(() => {
    setScrolled(window.scrollY > 80);
    setScrollHidden(false);
    scrollAnchor.current = window.scrollY;
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !header.current?.contains(event.target)) {
        setOpen(false);
        setKeyboardFocus(false);
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, [open]);
  const compact = scrolled && !pointerInside && !keyboardFocus && !open;
  const hidden = scrollHidden && !keyboardFocus && !open;
  const links = [
    ['/features', 'Product'],
    [pathname === '/' ? '/#placement-journey' : '/how-it-works', 'How it works'],
    ['/for-students', 'Students'],
    ['/for-recruiters', 'Recruiters'],
    ['/for-campuses', 'Campuses'],
    ['/assessments', 'Assessments'],
    ['/pricing', 'Pricing'],
  ];
  return (
    <div className="public-header-shell">
      <motion.header
        ref={header}
        initial={{ y: -90, opacity: 0 }}
        animate={{ y: hidden ? -110 : 0, opacity: hidden ? 0 : 1 }}
        transition={{ duration: reduced ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
        className={`public-header glass-header ${scrolled ? 'is-scrolled' : ''} ${compact ? 'is-compact' : 'is-expanded'} ${user ? 'has-session' : ''} ${hidden ? 'is-hidden' : ''}`}
        inert={hidden}
        aria-hidden={hidden || undefined}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse' || event.pointerType === 'pen') setPointerInside(true);
        }}
        onPointerLeave={() => setPointerInside(false)}
        onPointerDownCapture={() => setKeyboardFocus(false)}
        onFocusCapture={(event) => {
          if (event.target.matches(':focus-visible')) setKeyboardFocus(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setKeyboardFocus(false);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
      >
        <div className="public-nav">
          <Logo
            collapsible
            label={compact ? 'Expand navigation' : 'CampusLink home'}
            onClick={(event) => {
              if (compact) {
                event.preventDefault();
                setOpen(true);
              } else setOpen(false);
            }}
          />
          <nav
            id="public-navigation"
            aria-label="Main navigation"
            className={open ? 'public-links opened' : 'public-links'}
            inert={compact}
            aria-hidden={compact || undefined}
            onMouseLeave={() => setHovered(null)}
          >
            {links.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                onMouseEnter={() => setHovered(href)}
                onFocus={() => setHovered(href)}
                onBlur={() => setHovered(null)}
                aria-current={pathname === href ? 'page' : undefined}
              >
                {(hovered === href || (!hovered && pathname === href)) && (
                  <motion.span
                    className="nav-hover-pill"
                    layoutId="nav-hover"
                    transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  />
                )}
                <span>{label}</span>
              </Link>
            ))}
          </nav>
          <div className="nav-actions">
            {ready && !user && (
              <Link
                href="/login"
                className="sign-in"
                inert={compact}
                aria-hidden={compact || undefined}
              >
                Sign in <ArrowUpRight size={14} />
              </Link>
            )}
            <PublicStartLink
              href="/register"
              className={user ? 'nav-profile' : 'button small dark nav-join'}
              iconOnly
            >
              Get started <ArrowUpRight size={15} />
            </PublicStartLink>
            <button
              className="mobile-toggle"
              onClick={() => setOpen(!open)}
              aria-expanded={open}
              aria-controls="public-navigation"
              aria-label={open ? 'Close navigation' : 'Open navigation'}
              inert={compact}
              aria-hidden={compact || undefined}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </motion.header>
    </div>
  );
}
export function Landing() {
  const { user } = usePublicSession();
  return (
    <>
      <PublicNav />
      <main className="campus-landing">
        <CampusHero />
        <section className="perspectives content-width" id="ecosystem">
          <div className="section-heading">
            <div>
              <span className="eyebrow">CONNECTED BY POSSIBILITY</span>
              <h2>
                One ecosystem.
                <br />
                Three perspectives.
              </h2>
            </div>
            <p>
              Different goals. A shared destination.
              <br />A better way to go from learning to earning.
            </p>
          </div>
          <MobileCardSlider
            className="perspective-grid"
            label="Student, recruiter and campus cards"
          >
            <motion.div {...rise} className="perspective-card lavender">
              <div className="card-top">
                <span className="outline-icon">
                  <GraduationCap />
                </span>
                <span>01 / THE EXPLORERS</span>
              </div>
              <h3>
                Your potential.
                <br />
                Made visible.
              </h3>
              <p>Build skills, prove what you know, and discover opportunities that fit you.</p>
              <div className="role-art student-art">
                <span>
                  React <CircleCheck size={13} />
                </span>
                <span>
                  Python <CircleCheck size={13} />
                </span>
                <span className="role-star">✳</span>
                <div>
                  YOU’VE GOT THIS. <ArrowUpRight size={18} />
                </div>
              </div>
              <Link href="/for-students">
                For students <ArrowUpRight size={19} />
              </Link>
            </motion.div>
            <motion.div {...rise} className="perspective-card yellow">
              <div className="card-top">
                <span className="outline-icon">
                  <BriefcaseBusiness />
                </span>
                <span>02 / THE OPPORTUNITY MAKERS</span>
              </div>
              <h3>
                Great talent.
                <br />
                Less guesswork.
              </h3>
              <p>
                Request a campus visit, confirm the schedule, and meet verified talent in person.
              </p>
              <div className="role-art recruiter-art">
                <div>
                  <span className="avatar-circle">01</span>
                  <span>
                    <b>Verified candidate</b>
                    <small>Review verified skills</small>
                  </span>
                  <span className="talent-match">
                    <small>Evidence-based fit</small>
                  </span>
                </div>
                <div>
                  <span className="avatar-circle pink">02</span>
                  <span>
                    <b>Eligible applicant</b>
                    <small>Review eligibility</small>
                  </span>
                  <CircleCheck size={18} />
                </div>
              </div>
              <Link href="/for-recruiters">
                For recruiters <ArrowUpRight size={19} />
              </Link>
            </motion.div>
            <motion.div {...rise} className="perspective-card pink">
              <div className="card-top">
                <span className="outline-icon">
                  <Building2 />
                </span>
                <span>03 / THE FUTURE BUILDERS</span>
              </div>
              <h3>
                Every student.
                <br />A step forward.
              </h3>
              <p>
                Review recruiter requests, coordinate physical resources, and activate campus
                drives.
              </p>
              <div className="role-art campus-art">
                <div className="mini-bars">
                  {[32, 56, 43, 72, 88, 108].map((height, i) => (
                    <i key={i} style={{ height }} />
                  ))}
                </div>
                <span>PROGRESS, TOGETHER. ↗</span>
              </div>
              <Link href="/for-campuses">
                For campus teams <ArrowUpRight size={19} />
              </Link>
            </motion.div>
          </MobileCardSlider>
        </section>
        <MomentumSection />
        <PlacementJourney />
        <section className="features-section content-width">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A LITTLE SUPPORT GOES A LONG WAY</span>
              <h2>
                Everything for
                <br />
                your next big step.
              </h2>
            </div>
            <Link href="/features" className="button outline">
              Explore all features <ArrowUpRight size={16} />
            </Link>
          </div>
          <MobileCardSlider className="feature-grid" label="Career feature cards">
            <Link href="/student/skills" className="feature-card sage">
              <ShieldCheck />
              <h3>Skills you can stand behind.</h3>
              <p>Add a skill. Take a verification. Turn “I know it” into “I can prove it.”</p>
              <div className="verification-flow">
                <span>React</span>
                <ArrowRight size={15} />
                <span>Assessment</span>
                <ArrowRight size={15} />
                <b>
                  <CircleCheck size={14} /> Verified
                </b>
              </div>
              <ArrowUpRight className="feature-arrow" />
            </Link>
            <Link href="/student/interviews/ai" className="feature-card blue">
              <Play />
              <h3>Practice. Prepare. Walk in ready.</h3>
              <p>A safe space to find your voice before the interview that matters.</p>
              <div className="interview-preview">
                <span className="sound-wave">▂ ▅ ▃ ▇ ▅ ▂ ▄ ▆ ▃</span>
                <span>Interview practice & coaching</span>
              </div>
              <ArrowUpRight className="feature-arrow" />
            </Link>
            <Link href="/student/opportunities" className="feature-card yellow">
              <Sparkles />
              <h3>Opportunity, with a little direction.</h3>
              <p>Discover roles aligned with your skills and see what to work on next.</p>
              <div className="opportunity-preview">
                <b>Frontend Engineer</b>
                <span>
                  <small>Skills and eligibility</small>
                </span>
              </div>
              <ArrowUpRight className="feature-arrow" />
            </Link>
          </MobileCardSlider>
        </section>
        <CommunityAndFAQ />
        <section className="cta-section content-width">
          <div className="cta-spark">✳</div>
          <span className="eyebrow">THE FUTURE DOESN’T BUILD ITSELF. YOU DO.</span>
          <h2>
            Build skills. Prove them.
            <br />
            <span>Get discovered.</span>
          </h2>
          <p>Your next chapter is closer than you think.</p>
          <div>
            <PublicStartLink href="/register?role=student" className="button dark">
              Join as a student <ArrowUpRight size={18} />
            </PublicStartLink>
            {!user && (
              <PublicStartLink href="/register?role=recruiter" className="button outline">
                Hire great talent <ArrowUpRight size={18} />
              </PublicStartLink>
            )}
          </div>
          {!user && (
            <PublicStartLink href="/register?role=campus" className="text-link">
              Bring CampusLink to your campus <ArrowRight size={16} />
            </PublicStartLink>
          )}
          <span className="cta-star">✦</span>
        </section>
        <TeamStartX />
      </main>
      <PublicFooter />
    </>
  );
}
export function PublicFooter() {
  return (
    <footer className="footer content-width">
      <div className="footer-top">
        <div>
          <Logo />
          <p>Potential meets possibility.</p>
        </div>
        <div>
          <Link href="/about">About us</Link>
          <Link href="/features">Product</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/how-it-works">How it works</Link>
        </div>
        <PublicStartLink href="/register" className="text-link">
          Let’s build your future <ArrowUpRight size={16} />
        </PublicStartLink>
      </div>
      <div className="footer-bottom">
        <span>© 2026 CampusLink. Made for what comes next.</span>
        <span>Interface previews use illustrative data</span>
        <Link href="/about?section=privacy">Privacy & terms</Link>
      </div>
      <div className="footer-wordmark" aria-hidden="true">
        {'CAMPUSLINK'.split('').map((letter, index) => (
          <span className={`footer-letter footer-letter-${index % 5}`} key={`${letter}-${index}`}>
            {letter}
          </span>
        ))}
      </div>
    </footer>
  );
}
export function PublicPage({ slug }: { slug: string }) {
  const titles: Record<string, string> = {
    about: 'Potential deserves a platform.',
    features: 'A toolkit for your next chapter.',
    'how-it-works': 'From profile to placement.',
    'for-students': 'Your ambition. A clear direction.',
    'for-recruiters': 'Discover talent beyond the resume.',
    'for-campuses': 'Move every student forward.',
    pricing: 'A little support. A lot of possibility.',
    assessments: 'One assessment system. Every kind of progress.',
  };
  return (
    <>
      <PublicNav />
      <main className="public-detail content-width">
        <span className="eyebrow">MADE FOR WHAT COMES NEXT</span>
        <h1>{titles[slug] || 'Your next chapter starts here.'}</h1>
        <p className="lead">
          Students build verified career profiles. Companies request physical campus visits.
          Placement cells review, schedule, and activate the drives that connect them.
        </p>
        {slug === 'how-it-works' || slug === 'for-recruiters' || slug === 'for-campuses' ? (
          <CampusOperation />
        ) : slug === 'pricing' ? (
          <div className="pricing-grid">
            {['Free', 'Premium', 'Campus'].map((tier, i) => (
              <div className={`panel ${i === 1 ? 'lavender' : ''}`} key={tier}>
                <h2>{tier}</h2>
                <h3>{i === 0 ? '₹0' : i === 1 ? '₹499 / month' : 'Let’s talk'}</h3>
                <p>
                  {i === 0
                    ? 'Everything you need to get started.'
                    : i === 1
                      ? 'Extra support for your preparation.'
                      : 'One connected placement ecosystem.'}
                </p>
                <div className="check-list">
                  {[
                    'Career profile & verified skills',
                    'Core placement opportunity access',
                    'Unified assessment history',
                    i === 1
                      ? 'Advanced preparation & practice'
                      : 'Mock interviews & career progress',
                  ].map((x) => (
                    <span key={x}>
                      <Check size={15} />
                      {x}
                    </span>
                  ))}
                </div>
                <PublicStartLink className="button dark" href="/register">
                  Get started <ArrowUpRight size={16} />
                </PublicStartLink>
              </div>
            ))}
          </div>
        ) : (
          <>
            <JourneyIllustration />
            <div className="detail-sections">
              {[
                'Create your career identity',
                'Verify what you know',
                'Prepare with purpose',
                'Discover your fit',
                'Connect, interview, and grow',
                'Support your entire campus',
              ].map((t, i) => (
                <div className="panel" key={t}>
                  <span className="eyebrow">0{i + 1}</span>
                  <h3>{t}</h3>
                  <p>
                    Bring your progress into one place. Track skills, assessments, projects,
                    applications, and interviews with clear next steps.
                  </p>
                  <Link
                    href={
                      [
                        '/student/profile',
                        '/student/skills',
                        '/student/assessments',
                        '/student/opportunities',
                        '/student/interviews',
                        '/campus/dashboard',
                      ][i]
                    }
                    className="text-link"
                  >
                    Explore <ArrowUpRight size={15} />
                  </Link>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="public-page-cta">
          <h2>Ready to write your next chapter?</h2>
          <PublicStartLink className="button dark" href="/register">
            Join CampusLink <ArrowUpRight size={17} />
          </PublicStartLink>
        </div>
        {slug === 'about' && (
          <p className="muted">
            Your account and placement records are stored by CampusLink. Authorized campus and
            recruiter teams access records relevant to their placement work. Optional external AI
            analysis follows your saved sharing preferences.
          </p>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
