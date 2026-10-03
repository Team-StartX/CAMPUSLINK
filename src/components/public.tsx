'use client';
import Link from 'next/link';
import {
  ArrowUpRight,
  ArrowRight,
  Sparkles,
  Check,
  GraduationCap,
  Building2,
  ShieldCheck,
  BriefcaseBusiness,
  Menu,
  X,
  CircleCheck,
  Play,
} from 'lucide-react';
import { motion, useScroll, useMotionValueEvent } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { CampusHero } from './campus-hero';
import { MobileCardSlider } from './mobile-card-slider';
import { TeamStartX } from './team-startx';
import { MomentumSection, CommunityAndFAQ } from './home-extras';
import { PlacementJourney } from './placement-journey';
import { CampusOperation } from './campus-operation';
import { useState } from 'react';
export function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Link href="/" className={`logo ${dark ? 'logo-light' : ''}`} aria-label="CampusLink home">
      <span className="logo-mark">
        <i />
        <i />
        <i />
        <i />
      </span>
      campus<span>link</span>
      <span className="logo-dot">®</span>
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
          <b>82%</b>
        </div>
        <div className="progress">
          <span style={{ width: '82%' }} />
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
        <div>
          <strong>78</strong>
          <span>/ 100</span>
        </div>
        <p>You’re getting closer.</p>
        <span className="mini-demo">Demo readiness</span>
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
          <b>It’s a good match.</b>
          <p>Frontend Engineer · Razorpay</p>
        </div>
        <span className="match-bubble">
          92%<small>Demo match</small>
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
          <p>Offer received. Future unlocked.</p>
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
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const pathname = usePathname();
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (value) => setScrolled(value > 30));
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
    <motion.header
      initial={{ y: -90, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
      className={`public-header glass-header ${scrolled ? 'is-scrolled' : ''}`}
    >
      <div className="public-nav">
        <Logo />
        <nav
          id="public-navigation"
          aria-label="Main navigation"
          className={open ? 'public-links opened' : 'public-links'}
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
          <Link href="/login" className="sign-in">
            Sign in <ArrowUpRight size={14} />
          </Link>
          <Link href="/register" className="button small dark nav-join">
            Get started <ArrowUpRight size={15} />
          </Link>
          <button
            className="mobile-toggle"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-controls="public-navigation"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </motion.header>
  );
}
export function Landing() {
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
                    <small>6 verified skills</small>
                  </span>
                  <span className="talent-match">
                    96%<small>Demo match</small>
                  </span>
                </div>
                <div>
                  <span className="avatar-circle pink">02</span>
                  <span>
                    <b>Eligible applicant</b>
                    <small>5 verified skills</small>
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
                <span>84%</span>
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
                  92% <small>Demo match</small>
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
            <Link href="/register?role=student" className="button dark">
              Join as a student <ArrowUpRight size={18} />
            </Link>
            <Link href="/register?role=recruiter" className="button outline">
              Hire great talent <ArrowUpRight size={18} />
            </Link>
          </div>
          <Link href="/register?role=campus" className="text-link">
            Bring CampusLink to your campus <ArrowRight size={16} />
          </Link>
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
        <Link href="/register" className="text-link">
          Let’s build your future <ArrowUpRight size={16} />
        </Link>
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
                <Link className="button dark" href="/register">
                  Get started <ArrowUpRight size={16} />
                </Link>
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
          <Link className="button dark" href="/register">
            Join CampusLink <ArrowUpRight size={17} />
          </Link>
        </div>
        {slug === 'about' && (
          <p className="muted">
            Preview terms: this is a local frontend demo. Account sessions and profile edits are
            stored in your browser. No documents, passwords, or interview responses are sent to an
            external service. Reset demo data from Settings. Production privacy and legal terms will
            be provided before a public launch.
          </p>
        )}
      </main>
      <PublicFooter />
    </>
  );
}
