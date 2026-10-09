'use client';
import { CareerIntelligence } from '@/components/backend-tools';
import { ResumeReview } from '@/components/resume-review';
import type { ResumeAnalysis } from '@/types/resume';
import { Badge, Button, EmptyState, FormField, Modal, PageHeader, Progress } from '@/components/ui';
import {
  aiService,
  documentService,
  learningService,
  studentService,
} from '@/services/platform.service';
import { WorkspaceData, Role } from '@/types';
import { checkEligibility, studentVisible } from '@/utils/placement';
import { fit } from '@/utils/scoring';
import {
  ArrowUpRight,
  Check,
  CircleCheck,
  Code2,
  Download,
  FileText,
  Globe,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
} from 'lucide-react';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { CareerID } from './student-dashboard';
import { useFormAction } from '@/hooks/use-form-action';
type Common = {
  data: WorkspaceData;
  refresh: () => void;
  notify: (s: string) => void;
  role?: Role;
};
export function ProfilePage({ data, refresh, notify }: Common) {
  const { save, saving, error, clearError } = useFormAction();
  const [edit, setEdit] = useState(false);
  const [project, setProject] = useState(false);
  const [name, setName] = useState(data.student.name);
  const [bio, setBio] = useState(data.student.bio);
  const [course, setCourse] = useState(data.student.course);
  const [branch, setBranch] = useState(data.student.branch || '');
  const [year, setYear] = useState(data.student.year);
  const [cgpa, setCgpa] = useState(data.student.cgpa);
  const [backlogs, setBacklogs] = useState(data.student.activeBacklogs || 0);
  return (
    <>
      <PageHeader
        eyebrow="YOUR POTENTIAL, ALL IN ONE PLACE"
        title="Your career story."
        description="A profile that shows what you can do, and where you want to go."
        action={
          <Button
            kind="outline"
            onClick={() => {
              setName(data.student.name);
              setBio(data.student.bio);
              setCourse(data.student.course);
              setBranch(data.student.branch || '');
              setYear(data.student.year);
              setCgpa(data.student.cgpa);
              setBacklogs(data.student.activeBacklogs || 0);
              clearError();
              setEdit(true);
            }}
          >
            <Pencil size={15} /> Edit profile
          </Button>
        }
      />
      {error && !edit && !project && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <div className="profile-layout">
        <aside>
          <CareerID student={data.student} refresh={refresh} notify={notify} />
          <div className="panel">
            <h3>Your story is taking shape.</h3>
            <div className="profile-completion">
              <strong>{data.student.profileCompletion || 82}%</strong>
              <span>complete</span>
            </div>
            <Progress value={data.student.profileCompletion || 82} />
            <div className="check-list">
              <span>
                <CircleCheck size={15} /> Personal information
              </span>
              <span>
                <CircleCheck size={15} /> Education & skills
              </span>
              <span>
                <CircleCheck size={15} /> Projects & experience
              </span>
              <Link href="/student/documents">
                <Plus size={15} /> Add your latest resume
              </Link>
            </div>
          </div>
        </aside>
        <div className="profile-sections">
          <section className="panel">
            <div className="panel-header">
              <h3>A little about me</h3>
              <Pencil size={17} />
            </div>
            <p>{data.student.bio}</p>
            <div className="profile-info">
              <span>
                <small>Email</small>
                {data.student.email}
              </span>
              <span>
                <small>Campus</small>
                {data.student.campus}
              </span>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h3>Education</h3>
              <GraduationCap size={20} />
            </div>
            <h3>{data.student.course}</h3>
            <p>{data.student.campus}</p>
            <div className="profile-info">
              <span>
                <small>Graduation year</small>
                {data.student.year}
              </span>
              <span>
                <small>CGPA</small>
                {data.student.cgpa} / 10
              </span>
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h3>Skills that tell my story</h3>
              <Link href="/student/skills" className="text-link">
                Manage skills <ArrowUpRight size={15} />
              </Link>
            </div>
            <div className="job-chips">
              {data.student.skills.map((s) => (
                <Badge key={s.id} kind={s.verified ? 'verified' : ''}>
                  {s.name}
                  {s.verified && <CircleCheck size={13} />}
                </Badge>
              ))}
            </div>
          </section>
          <section className="panel">
            <div className="panel-header">
              <h3>Things I’ve built</h3>
              <button className="text-button" onClick={() => setProject(true)}>
                <Plus size={16} /> Add project
              </button>
            </div>
            {data.student.projects.map((p, i) => (
              <div className="project-item" key={`${p}-${i}`}>
                <span className="skill-square lavender">
                  <Code2 size={21} />
                </span>
                <div>
                  <h3>{p}</h3>
                  <p>
                    {data.student.projectDescriptions?.[p] ||
                      'Personal project · React, TypeScript'}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Remove ${p}`}
                  disabled={saving}
                  onClick={async () => {
                    await save(async () => {
                      await studentService.updateStudent({
                        projects: data.student.projects.filter((_, n) => n !== i),
                      });
                      refresh();
                      notify('Project removed.');
                    });
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </section>
          <section className="panel">
            <div className="panel-header">
              <h3>Achievements & activity</h3>
              <Trophy size={20} />
            </div>
            <p>
              {data.student.xp.toLocaleString()} career points · {data.history.length} assessment
              results · {data.student.skills.filter((s) => s.verified).length} verified skills
            </p>
            <Link href="/student/assessments" className="text-link">
              View assessment history <ArrowUpRight size={15} />
            </Link>
          </section>
          {['Experience', 'Certifications', 'Professional links', 'Achievements'].map(
            (category) => (
              <ProfileRecords
                key={category}
                category={category}
                data={data}
                refresh={refresh}
                notify={notify}
              />
            ),
          )}
          <section className="panel">
            <h3>Resume & professional links</h3>
            <p>Let recruiters see your latest work.</p>
            <Link href="/student/documents" className="button outline">
              Manage documents <ArrowUpRight size={15} />
            </Link>
          </section>
        </div>
      </div>
      {edit && (
        <Modal title="Edit your career profile" onClose={() => setEdit(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await save(async () => {
                await studentService.updateStudent({
                  name: name.trim(),
                  bio: bio.trim(),
                  course,
                  year,
                  cgpa,
                  branch: branch.trim(),
                  activeBacklogs: backlogs,
                });
                refresh();
                setEdit(false);
                notify('Your profile has been updated.');
              });
            }}
          >
            <FormField label="Full name">
              <input
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
            <FormField label="Email address">
              <input type="email" required value={data.student.email} readOnly />
            </FormField>
            <FormField label="Campus">
              <input value={data.student.campus} readOnly />
            </FormField>
            <p className="muted">
              Email and campus are linked to your account. Contact your campus team to correct them.
            </p>
            <FormField label="Course">
              <input
                required
                maxLength={150}
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
            </FormField>
            <FormField label="Branch">
              <input
                required
                maxLength={80}
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
              />
            </FormField>
            <div className="form-row">
              <FormField label="Graduation year">
                <input
                  type="number"
                  min={2000}
                  max={2099}
                  required
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </FormField>
              <FormField label="CGPA">
                <input
                  type="number"
                  min={0}
                  max={10}
                  step={0.01}
                  required
                  value={cgpa}
                  onChange={(e) => setCgpa(Number(e.target.value))}
                />
              </FormField>
            </div>
            <FormField label="Active backlogs">
              <input
                type="number"
                min={0}
                max={20}
                required
                value={backlogs}
                onChange={(e) => setBacklogs(Number(e.target.value))}
              />
            </FormField>
            <FormField label="About you">
              <textarea
                maxLength={3000}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
              />
            </FormField>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={saving}>
              Save changes <Check size={16} />
            </Button>
          </form>
        </Modal>
      )}
      {project && (
        <Modal title="Add something you’ve built" onClose={() => setProject(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              const values = new FormData(e.currentTarget);
              await save(async () => {
                if (!String(values.get('title') || '').trim())
                  throw new Error('Enter a project title.');
                await studentService.updateStudent({
                  projects: [...data.student.projects, String(values.get('title')).trim()],
                  projectDescriptions: {
                    ...data.student.projectDescriptions,
                    [String(values.get('title')).trim()]: String(values.get('description')).trim(),
                  },
                });
                refresh();
                setProject(false);
                notify('Project added to your story.');
              });
            }}
          >
            <FormField label="Project title">
              <input name="title" required maxLength={500} placeholder="What did you build?" />
            </FormField>
            <FormField label="Description">
              <textarea
                name="description"
                maxLength={3000}
                required
                placeholder="The problem, your contribution, and the result."
              />
            </FormField>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={saving}>
              Add project <Plus size={16} />
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function SkillsPage({ data, refresh, notify }: Common) {
  const [savingSkill, setSavingSkill] = useState(false);
  const [add, setAdd] = useState(false);
  const [search, setSearch] = useState('');
  const [skill, setSkill] = useState('');
  const [level, setLevel] = useState('Intermediate');
  const [error, setError] = useState('');
  const all = [
    'Java',
    'Python',
    'React',
    'SQL',
    'AWS',
    'Machine Learning',
    'JavaScript',
    'Node.js',
    'TypeScript',
    'Docker',
    'Git',
    'Figma',
    'C++',
  ];
  return (
    <>
      <PageHeader
        eyebrow="LESS CLAIMING. MORE PROVING."
        title="Your skills. Your edge."
        description="Build a skill set that opens doors. Verify it to show what you know."
        action={
          <Button onClick={() => setAdd(true)}>
            <Plus size={17} /> Add a skill
          </Button>
        }
      />
      <div className="info-banner lavender">
        <ShieldCheck size={27} />
        <div>
          <b>Verified means you’ve shown your understanding.</b>
          <p>Pass a skill assessment with 70% or more to earn a verified badge and 120 XP.</p>
        </div>
      </div>
      <label className="search-input">
        <Search size={18} />
        <input
          placeholder="Search your skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      <div className="three-columns">
        {data.student.skills
          .filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
          .map((s) => (
            <div key={s.id} className="panel skill-card">
              <div className="panel-header">
                <span className={`skill-square ${s.verified ? 'sage' : 'lavender'}`}>
                  <Code2 size={23} />
                </span>
                <button
                  className="icon-button"
                  aria-label={`Remove ${s.name}`}
                  onClick={async () => {
                    await studentService.removeSkill(s.id);
                    refresh();
                    notify(`${s.name} removed.`);
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <h3>{s.name}</h3>
              <FormField label={`${s.name} experience level`}>
                <select
                  value={s.level}
                  onChange={async (e) => {
                    await studentService.editSkillLevel(s.id, e.target.value);
                    refresh();
                    notify('Experience level updated.');
                  }}
                >
                  {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                    <option key={level}>{level}</option>
                  ))}
                </select>
              </FormField>
              <Badge kind={s.verified ? 'verified' : ''}>
                {s.verified ? (
                  <>
                    <CircleCheck size={13} /> Verified
                  </>
                ) : (
                  'Unverified'
                )}
              </Badge>
              {!s.verified && (
                <Link
                  href={`/student/assessments/${data.assessments.find((a) => a.skill === s.name)?.id || 'technical'}`}
                  className="button outline"
                >
                  Take verification <ArrowUpRight size={15} />
                </Link>
              )}
              {s.verified && (
                <Link href="/student/assessments" className="text-link">
                  View assessment history <ArrowUpRight size={14} />
                </Link>
              )}
            </div>
          ))}
      </div>
      {!data.student.skills.length && (
        <EmptyState
          title="Your first skill is a great start."
          action={<Button onClick={() => setAdd(true)}>Add a skill</Button>}
        />
      )}
      {add && (
        <Modal title="Add a skill. Open a possibility." onClose={() => setAdd(false)}>
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              if (savingSkill) return;
              setSavingSkill(true);
              setError('');
              try {
                if (!skill.trim()) throw new Error('Choose or enter a skill.');
                await studentService.addSkill(skill.trim(), level);
                await refresh();
                setAdd(false);
                setSkill('');
                notify('Skill added. Take an assessment to verify it.');
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setSavingSkill(false);
              }
            }}
          >
            <FormField label="Find your skill">
              <input
                value={skill}
                onChange={(e) => setSkill(e.target.value)}
                placeholder="Search Java, React, Python…"
                maxLength={80}
                required
                list="skills"
              />
              <datalist id="skills">
                {all.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </FormField>
            <div className="filter-pills">
              {all
                .filter((s) => s.toLowerCase().includes(skill.toLowerCase()))
                .slice(0, 6)
                .map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={skill === s ? 'selected' : ''}
                    onClick={() => setSkill(s)}
                  >
                    {s}
                  </button>
                ))}
            </div>
            <FormField label="Experience level">
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option>Beginner</option>
                <option>Intermediate</option>
                <option>Advanced</option>
              </select>
            </FormField>
            <p className="muted">
              Your skill starts as unverified. The assessment system records your results and
              verification.
            </p>
            {error && <p className="field-error">{error}</p>}
            <Button type="submit" disabled={savingSkill}>
              {savingSkill ? 'Adding skill…' : 'Add skill'} <Plus size={16} />
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function ReadinessPage({ data }: { data: WorkspaceData }) {
  const drives = data.drives.filter(
    (d) => studentVisible(d) && checkEligibility(data.student, d).passed,
  );
  const [target, setTarget] = useState(drives[0]?.id || '');
  const drive = drives.find((d) => d.id === target);
  const match = drive ? fit(data.student, drive, data.history) : undefined;
  return (
    <>
      <PageHeader
        eyebrow="A CLEARER VIEW OF WHAT’S NEXT"
        title="Ready for your next chapter?"
        description="Know your strengths. See your next steps. Keep moving forward."
      />
      {<CareerIntelligence studentId={data.student.id} />}
      <div className={'readiness-next-steps'}>
        {false}
        <section className="panel yellow">
          <Badge>YOUR NEXT STEPS</Badge>
          <h2>
            A little focus.
            <br />A lot of progress.
          </h2>
          <FormField label="Target campus drive">
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              {drives.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.company} · {d.role}
                </option>
              ))}
            </select>
          </FormField>
          {match ? (
            <>
              <p>
                <b>
                  {match.score}% fit · {match.label}
                </b>
              </p>
              <div className="check-list">
                {match.gaps.map((g) => (
                  <Link key={g.name} href="/student/learning">
                    <Code2 size={18} />
                    <span>
                      <b>{g.name}</b> · {g.action}
                    </span>
                  </Link>
                ))}
                <Link href="/student/interviews/ai">
                  <VideoIcon /> Practice explaining a relevant project
                </Link>
              </div>
              <p>
                Unverified skills receive half credit; missing skills receive zero. Eligibility is
                checked before matching.
              </p>
            </>
          ) : (
            <p>No eligible active drive yet. Complete your profile and check again.</p>
          )}
        </section>
      </div>
      <section className="panel">
        <div className="panel-header">
          <h3>Your progress over time</h3>
          <Badge>{'Recorded assessments'}</Badge>
        </div>
        {
          <div>
            {data.history.map((h) => (
              <p key={h.id}>
                {h.date} · {h.name} · {h.score}%
              </p>
            ))}
          </div>
        }
      </section>
    </>
  );
}
function VideoIcon() {
  return <Globe size={18} />;
}
export function LearningPage({ data, refresh, notify }: Common) {
  const [path, setPath] = useState('Frontend Developer');
  const steps: Record<string, string[]> = {
    'Frontend Developer': [
      'HTML & CSS foundations',
      'JavaScript fundamentals',
      'React & component architecture',
      'TypeScript',
      'Accessibility & testing',
      'Frontend system design',
      'Interview preparation',
    ],
    'Backend Developer': [
      'Programming fundamentals',
      'Node.js',
      'REST APIs',
      'SQL & databases',
      'Authentication',
      'System design',
      'Cloud basics',
    ],
    'Data Analyst': [
      'Spreadsheets & statistics',
      'SQL',
      'Python',
      'Data visualization',
      'Portfolio project',
      'Interview preparation',
    ],
    'ML Engineer': [
      'Python fundamentals',
      'Linear algebra',
      'Data processing',
      'Model evaluation',
      'Deployment concepts',
      'Interview preparation',
    ],
    'Cloud Engineer': [
      'Networking basics',
      'Linux',
      'AWS fundamentals',
      'Containers',
      'Cloud security',
      'Interview preparation',
    ],
  };
  return (
    <>
      <PageHeader
        eyebrow="ONE STEP BETTER, EVERY DAY"
        title="Build your path forward."
        description="Structured learning paths to help you grow toward the role you want."
      />
      <div className="filter-pills">
        {Object.keys(steps).map((p) => (
          <button key={p} className={path === p ? 'selected' : ''} onClick={() => setPath(p)}>
            {p}
          </button>
        ))}
      </div>
      <div className="panel learning-panel">
        <div className="panel-header">
          <div>
            <Badge>BUILT-IN LEARNING PATH</Badge>
            <h2>{path}</h2>
          </div>
          <span>
            {steps[path].filter((s) => data.learning.includes(`${path}:${s}`)).length} /{' '}
            {steps[path].length} completed
          </span>
        </div>
        {steps[path].map((s, i) => {
          const key = `${path}:${s}`,
            done = data.learning.includes(key);
          return (
            <div className="learning-step" key={s}>
              <span className={`step-circle ${done ? 'sage' : ''}`}>
                {done ? <Check size={17} /> : i + 1}
              </span>
              <div>
                <h3>{s}</h3>
                <p>
                  {done
                    ? 'Learning completed · Ready for verification'
                    : 'Learn the foundations, practice with a project, then verify your understanding.'}
                </p>
              </div>
              <Button
                kind="outline"
                disabled={done}
                onClick={async () => {
                  await learningService.complete(key);
                  refresh();
                  notify('Learning progress saved.');
                }}
              >
                {done ? 'Completed' : 'Mark as learned'}
              </Button>
              <Link href="/student/assessments" className="text-link">
                Verify <ArrowUpRight size={14} />
              </Link>
            </div>
          );
        })}
        <p className="muted">
          Marking a learning step complete records study activity. Verified skills require a passed
          assessment.
        </p>
      </div>
    </>
  );
}
export function DocumentsPage({ data, refresh, notify, role = 'student' }: Common) {
  const [type, setType] = useState('Resume');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<{ id: string; action: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const [analysisName, setAnalysisName] = useState('');
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  async function runAction(id: string, action: string, work: () => Promise<void>) {
    setError('');
    setBusy({ id, action });
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to complete this action. Please try again.',
      );
    } finally {
      setBusy(null);
      feedback.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      feedback.current?.focus({ preventScroll: true });
    }
  }
  return (
    <div className="documents-page">
      <PageHeader
        title={
          role === 'student'
            ? 'Your work, on record.'
            : role === 'campus'
              ? 'Review student documents.'
              : 'Review candidate documents.'
        }
        description={
          role === 'student'
            ? 'Keep your resume, academic records, and certificates together.'
            : role === 'campus'
              ? 'Select a student above to review and verify their uploaded documents.'
              : 'Select an authorized candidate above to review their uploaded documents.'
        }
      />
      {role === 'student' && (
        <div className="document-upload panel">
          <div className="document-upload-copy">
            <FileText size={28} aria-hidden="true" />
            <div>
              <h3>Add your latest document</h3>
              <p>PDF, PNG, JPG · Up to 10 MB. Resume analysis needs a PDF with selectable text.</p>
            </div>
          </div>
          <div className="document-upload-controls">
            <select
              aria-label="Document type"
              disabled={uploading}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option>Resume</option>
              <option>Academic record</option>
              <option>Certificate</option>
              <option>Offer letter</option>
            </select>
            <Button loading={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? 'Uploading…' : 'Choose file'} <Plus size={16} />
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              hidden
              aria-label="Upload document"
              disabled={uploading}
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                if (file) {
                  setError('');
                  setUploading(true);
                  try {
                    if (file.size > 10 * 1024 * 1024)
                      throw new Error('Choose a file smaller than 10 MB.');
                    await documentService.upload(file, type);
                    refresh();
                    notify('Document securely uploaded.');
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setUploading(false);
                    input.value = '';
                  }
                }
              }}
            />
          </div>
          <small className="muted">
            {'Documents are private and accessible to authorized placement staff.'}
          </small>
          <p className="document-analysis-help">
            Upload your resume, then choose Analyze resume to extract skills and review suggestions.{' '}
            <Link href="/student/settings#analysis-preferences">AI preferences</Link>
          </p>
        </div>
      )}
      <div className="panel table-wrap documents-table">
        <table>
          <thead>
            <tr>
              <th>Document</th>
              <th>Type</th>
              <th>Size</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {data.documents.map((d) => (
              <tr key={d.id}>
                <td>
                  <div className="document-name">
                    <FileText size={21} aria-hidden="true" />
                    <b>{d.name}</b>
                  </div>
                </td>
                <td>{d.type}</td>
                <td>{d.size}</td>
                <td>
                  <Badge kind={d.status === 'Verified' ? 'verified' : ''}>{d.status}</Badge>
                </td>
                <td>
                  <div className="document-actions">
                    <Button
                      kind="outline"
                      disabled={Boolean(busy)}
                      loading={busy?.id === d.id && busy.action === 'download'}
                      onClick={() =>
                        void runAction(d.id, 'download', async () => {
                          const url = await documentService.download(d.id),
                            a = document.createElement('a');
                          a.href = url;
                          a.download = d.name;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                        })
                      }
                    >
                      <Download size={15} /> Download
                    </Button>
                    {role === 'student' && d.type === 'Resume' && (
                      <Button
                        disabled={Boolean(busy)}
                        loading={busy?.id === d.id && busy.action === 'analyze'}
                        onClick={() =>
                          void runAction(d.id, 'analyze', async () => {
                            setAnalysis(null);
                            setAnalysisName(d.name);
                            setAnalysis(await aiService.analyzeResume(d.id));
                          })
                        }
                      >
                        {busy?.id === d.id && busy.action === 'analyze'
                          ? 'Analyzing…'
                          : 'Analyze resume'}
                      </Button>
                    )}
                    {role === 'campus' && d.status !== 'Verified' && (
                      <Button
                        kind="outline"
                        disabled={Boolean(busy)}
                        loading={busy?.id === d.id && busy.action === 'verify'}
                        onClick={() =>
                          void runAction(d.id, 'verify', async () => {
                            await documentService.verify(d.id);
                            refresh();
                            notify('Document verification recorded.');
                          })
                        }
                      >
                        Verify document
                      </Button>
                    )}
                    {role === 'student' && (
                      <button
                        className="icon-button"
                        aria-label={`Remove ${d.name}`}
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void runAction(d.id, 'remove', async () => {
                            await documentService.remove(d.id);
                            if (analysisName === d.name) setAnalysis(null);
                            refresh();
                            notify('Document removed.');
                          })
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data.documents.length && (
          <EmptyState
            title={
              role === 'student'
                ? 'Your documents belong here.'
                : data.student.id
                  ? 'No documents uploaded for this student.'
                  : 'No authorized student selected.'
            }
            description={
              role === 'student'
                ? 'Add a resume when you’re ready.'
                : 'Choose a student above to review the documents they have uploaded.'
            }
          />
        )}
      </div>
      <div ref={feedback} tabIndex={-1} className="document-feedback">
        {busy?.action === 'analyze' && (
          <p role="status" className="document-progress">
            Analyzing {analysisName}… This can take a moment.
          </p>
        )}
        {error && (
          <p role="alert" className="document-error">
            {error}
          </p>
        )}
        {analysis && (
          <ResumeReview analysis={analysis} name={analysisName} data={data} refresh={refresh} />
        )}
      </div>
    </div>
  );
}
function ProfileRecords({
  category,
  data,
  refresh,
  notify,
}: {
  category: string;
  data: WorkspaceData;
  refresh: () => void;
  notify: (s: string) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const { save, saving, error, clearError } = useFormAction();
  const [value, setValue] = useState('');
  const records = data.student.records?.[category] || [];
  return (
    <section className="panel">
      <div className="panel-header">
        <h3>{category}</h3>
        <button
          className="text-button"
          onClick={() => {
            clearError();
            setEditing(-1);
            setValue('');
          }}
        >
          <Plus size={15} /> Add
        </button>
      </div>
      {records.length ? (
        records.map((record, i) => (
          <div className="profile-record" key={`${i}-${record}`}>
            <p>{record}</p>
            <button
              className="icon-button"
              aria-label={`Edit ${category}`}
              onClick={() => {
                clearError();
                setEditing(i);
                setValue(record);
              }}
            >
              <Pencil size={15} />
            </button>
            <button
              className="icon-button"
              aria-label={`Remove ${category}`}
              disabled={saving}
              onClick={async () => {
                await save(async () => {
                  await studentService.updateStudent({
                    records: {
                      ...data.student.records,
                      [category]: records.filter((_, index) => index !== i),
                    },
                  });
                  refresh();
                  notify(`${category} updated.`);
                });
              }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))
      ) : (
        <p className="muted">
          Add {category.toLowerCase()} when you’re ready. Every detail helps tell your story.
        </p>
      )}
      {error && editing === null && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {editing !== null && (
        <Modal
          title={`${editing === -1 ? 'Add' : 'Edit'} ${category.toLowerCase()}`}
          onClose={() => setEditing(null)}
        >
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              await save(async () => {
                if (!value.trim()) throw new Error('Enter the details before saving.');
                const next =
                  editing === -1
                    ? [...records, value.trim()]
                    : records.map((r, i) => (i === editing ? value.trim() : r));
                await studentService.updateStudent({
                  records: { ...data.student.records, [category]: next },
                });
                refresh();
                setEditing(null);
                notify(`${category} saved.`);
              });
            }}
          >
            <FormField label={category === 'Professional links' ? 'Label and URL' : 'Details'}>
              <textarea
                required
                rows={4}
                maxLength={1000}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={
                  category === 'Experience'
                    ? 'Role, organization, dates, and your contribution'
                    : category === 'Certifications'
                      ? 'Certification, issuing organization, and year'
                      : category === 'Professional links'
                        ? 'GitHub — https://github.com/yourname'
                        : 'Achievement, date, and what made it meaningful'
                }
              />
            </FormField>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" loading={saving}>
              Save to profile <Check size={16} />
            </Button>
          </form>
        </Modal>
      )}
    </section>
  );
}
