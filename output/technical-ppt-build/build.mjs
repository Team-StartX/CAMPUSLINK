import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from 'file:///C:/Users/sahoo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const SKILL='C:/Users/sahoo/.codex/plugins/cache/openai-primary-runtime/presentations/26.1007.11041/skills/presentations';
const {finalizePresentation,makeNativeBulletParagraphs}=await import(pathToFileURL(SKILL+'/container_tools/artifact_tool_utils.mjs'));
const DIR='C:/CampusLink/output/technical-ppt-build';
const FINAL='C:/CampusLink/output/presentations/CampusLink_Technical_Documentation.pptx';
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={bg:'#F1EEE4',navy:'#3C3E60',lav:'#CDC2DB',ink:'#252527',gray:'#66666D'};
const report=JSON.parse(await fs.readFile('C:/CampusLink/output/placement-demo-report.json','utf8'));
const sources=(names)=>names.map(n=>'C:/CampusLink/'+n).join('\n');
function tx(s,text,x,y,w,h,size=26,bold=false,fill='none',color=C.ink){
 const a=s.shapes.add({geometry:'textbox',name:text.slice(0,45),position:{left:x,top:y,width:w,height:h},fill,line:{fill:'none',width:0}});
 a.text=text;a.text.insets=fill==='none'?0:12;a.text.style={fontFamily:'Arial',typeface:'Arial',fontSize:size,bold,color,autoFit:'none'};return a;
}
function base(title,notes='',refs=[]){const s=p.slides.add();s.background.fill=C.bg;
 tx(s,'CAMPUSLINK',64,32,500,30,18,true,'none',C.navy);
 tx(s,title,64,91,1152,96,44,true,'none',C.navy);
 tx(s,'StartX / BPUT Hackathon 2026 / PS10',64,675,900,24,16,false,'none',C.gray);
 tx(s,String(p.slides.items.length).padStart(2,'0'),1160,664,56,38,22,true,C.navy,'#FFFFFF');
 s.speakerNotes.text=notes+'\n\nSources:\n'+sources(refs);return s;
}
function list(s,items,x=70,y=220,w=1138,h=390,size=29){const a=tx(s,'',x,y,w,h,size);a.text=makeNativeBulletParagraphs(items,{marginLeftPoints:20,hangingPoints:10,spaceAfterPoints:h<=180?9:17});return a;}
function sub(s,t,x,y,w=550){tx(s,t,x,y,w,48,28,true,C.lav,C.navy);}
function foot(s,t){tx(s,t,70,615,1135,42,20,false,'none',C.navy);}
function table(s,values,x=70,y=220,w=1138,h=350,widths){
 const t=s.tables.add({rows:values.length,columns:values[0].length,left:x,top:y,width:w,height:h,values,columnWidths:widths});
 t.cells.block({row:0,column:0,rowCount:values.length,columnCount:values[0].length}).assign({fill:C.bg,textStyle:{fontFamily:'Arial',typeface:'Arial',fontSize:24,color:C.ink},margins:{left:12,right:12,top:10,bottom:10}});
 t.cells.block({row:0,column:0,rowCount:1,columnCount:values[0].length}).assign({fill:C.lav,textStyle:{fontFamily:'Arial',typeface:'Arial',fontSize:24,bold:true,color:C.navy}});
 t.borders.assign({fill:'#DAD5DE',width:1,style:'solid'});return t;
}
function node(s,t,x,y,w,h=75){const a=s.shapes.add({geometry:'rect',name:t,position:{left:x,top:y,width:w,height:h},fill:C.lav,line:{fill:C.navy,width:1.5}});a.text=t;a.text.insets=12;a.text.style={fontFamily:'Arial',typeface:'Arial',fontSize:24,bold:true,color:C.navy,alignment:'center',verticalAlignment:'middle'};return a;}
function link(s,a,b,from='right',to='left'){s.shapes.connect(a,b,{kind:from==='bottom'?'elbow':'straight',fromSide:from,toSide:to,line:{fill:C.navy,width:2},tail:{type:'arrow',width:'med',length:'med'}});}

// 1
let s=base('CAMPUSLINK','Introduce CampusLink as an implemented campus placement prototype. It combines preparation and placement operations. The core matching method uses explicit rules and text relevance. Generative coaching and historical outcome prediction are separate optional components. This technical presentation follows the current repository and the recorded synthetic demonstration, with no claim of public-dataset validation.', ['README.md']);
tx(s,'Technical Documentation',70,258,1120,82,48,true,C.lav,C.navy);
tx(s,'System architecture, algorithms, evaluation\nand multi-campus deployment',70,380,1120,122,34);
tx(s,'Team StartX\nProblem Statement PS10',70,548,900,70,26,true,'none',C.navy);
// 2
s=base('Problem and solution','The project addresses fragmented placement information and repeated manual operations. CampusLink integrates the preparation and recruitment journey. The expected time savings and placement improvements remain hypotheses until a real college pilot measures them. Its prototype strength is explainable scoring and connected operations rather than a validated placement probability.', ['README.md','src/utils/scoring.ts']);
sub(s,'Problem',70,212);sub(s,'Our solution',660,212);
list(s,['Scattered student records and placement updates','Repeated eligibility checks and shortlisting','Scheduling conflicts and offer tracking gaps'],70,285,530,290,28);
list(s,['Centralized role-based placement workspace','Readiness scores and explainable matching','Scheduling, notifications and offer tracking'],660,285,540,290,28);
foot(s,'Why it matters: preparation gaps and coordination delays affect the whole placement cycle.');
// 3
s=base('Roles and prototype scope','Students manage their career profiles, preparation and applications. Recruiters define requirements, review candidates and manage hiring rounds. Campus teams verify records, approve recruiters and drives, and coordinate resources. Administrators manage access, campuses and assessment content. The image is an existing repository dashboard screenshot for interface context, not the synthetic evaluation report.', ['README.md','src/features/student-dashboard.tsx','src/features/recruiter-dashboard.tsx','src/features/campus-dashboard.tsx','src/features/admin-dashboard.tsx','output/screenshots/dashboard-preview.jpg']);
list(s,['Students: profile, practice and application progress','Recruiters: requirements, selection and offers','Campus teams: verification and drive coordination','Administrators: access and assessment content'],70,220,510,385,26);
const img=await fs.readFile('C:/CampusLink/output/screenshots/dashboard-preview.jpg');
s.images.add({blob:img.buffer.slice(img.byteOffset,img.byteOffset+img.byteLength),contentType:'image/jpeg',position:{left:630,top:225,width:575,height:323},fit:'contain',alt:'Existing CampusLink student dashboard screenshot'});
tx(s,'Student dashboard screenshot',630,563,575,30,20,false,'none',C.gray);
// 4
s=base('System architecture','The Next.js browser interface sends requests to the frontend origin using /api/v1. Next.js rewrites forward these requests to the Express backend. The backend handles session authentication, CSRF checks, business rules and database transactions. PostgreSQL stores production entities and SQLite supports local development. Documents live in private storage. Background workers process queued email, reminders and cleanup. Optional external AI and speech services operate through the backend with appropriate consent.', ['README.md','next.config.mjs','server/app.ts','server/workspace.ts','server/db.ts','server/storage.ts']);
let a=node(s,'Browser\nRole dashboards',70,240,235,112),b=node(s,'Next.js\n/api/v1 proxy',365,240,240,112),c=node(s,'Express API\nRules + sessions',665,240,250,112),e=node(s,'Database\nPostgreSQL / SQLite',975,240,235,112);link(s,a,b);link(s,b,c);link(s,c,e);
let f=node(s,'Private document storage',500,447,315,90),g=node(s,'Email / reminder workers',875,447,335,90);link(s,c,f,'bottom','top');link(s,e,g,'bottom','top');
tx(s,'Optional coaching and speech providers connect through the backend.',70,566,1130,50,27);
// 5
s=base('Data model and access protection','Relational tables connect accounts to campuses, drives to recruiters, applications to students and recruitment rounds, and offers to applications where available. Foreign keys and uniqueness rules protect these relationships. Flexible attributes remain in JSON-validated payloads alongside important SQL fields. API authorization enforces tenant and owner scope. RLS is enabled without direct client policies, so client users do not access PostgreSQL directly. Private storage, transactional writes and audit history support document and workflow integrity.', ['server/DATABASE.md','server/schema.ts','server/auth.ts','server/workspace.ts']);
table(s,[['Entity group','Purpose'],['Campuses and accounts','Identity, roles and institutional scope'],['Profiles and evidence','Skills, projects, assessments and documents'],['Drives and applications','Recruiter requirements and candidate progression'],['Offers and notifications','Responses, joining status and communication']],70,212,1138,300,[355,783]);
list(s,['Server sessions and CSRF checks protect requests.','Campus and owner permissions restrict records.','Foreign keys, transactions and audit logs protect workflow integrity.'],70,535,1138,110,23);
// 6
s=base('Readiness scoring','Readiness is a deterministic weighted score with six categories. Verified skills measure the proportion of recorded skills that are verified. Academics use CGPA times ten minus ten per active backlog, bounded to zero through one hundred. Projects use 35 points per recorded project, capped at one hundred. Aptitude, communication and interview categories use mean scores from matching assessment history. Missing evidence contributes zero. The categories indicate recorded preparation evidence and do not measure a validated probability of employment.', ['src/utils/scoring.ts']);
table(s,[['Readiness factor','Weight','Category score'],['Verified skills','30%','Verified / recorded skills × 100'],['Academics','20%','CGPA × 10 − backlog penalty'],['Projects','15%','Project count × 35, capped at 100'],['Aptitude','15%','Mean relevant assessment score'],['Communication','10%','Mean relevant assessment score'],['Interview','10%','Mean relevant assessment score']],70,211,1138,362,[290,140,708]);
foot(s,'Readiness = sum of weighted category scores. Missing evidence contributes zero.');
// 7
s=base('Readiness example and score interpretation','The synthetic selected student has category scores 100, 90, 100, 85, 85 and 85. The weighted total equals 92.75, which rounds to 93. This produces the Highly Employable label. The label belongs to a rule-based readiness rubric, not a placement guarantee. The example confirms arithmetic using the recorded demo values. The weight choices and thresholds have not been validated against real employment outcomes.', ['src/utils/scoring.ts','output/placement-demo-report.json']);
tx(s,'93 / 100',70,221,470,105,76,true,'none',C.navy);
tx(s,'Highly Employable',70,332,490,50,32,true,C.lav,C.navy);
tx(s,'30 + 18 + 15 + 12.75\n+ 8.5 + 8.5 = 92.75',70,412,510,116,32);
table(s,[['Score range','Readiness level'],['0–44','Not Ready'],['45–69','Developing'],['70–84','Ready'],['85–100','Highly Employable']],655,221,550,335,[180,370]);
foot(s,'This readiness rubric summarizes recorded evidence. Outcome validation remains pending.');
// 8
s=base('Eligibility gates','Every mandatory eligibility condition must pass before a candidate receives a nonzero fit or hybrid ranking score. Conditions include campus, course, branch, graduation year, CGPA and active backlogs. Required skills become a hard gate when requireSkills is enabled. Hard skill eligibility checks recorded skill presence, while the fit score distinguishes verified and unverified skills. Free-text additional conditions require an explicit campus verification entry. Students can see reasons for failing eligibility.', ['src/utils/placement.ts','src/utils/scoring.ts']);
list(s,['Check registered campus, course, branch and graduation year.','Compare CGPA and active backlogs with recruiter limits.','Require recorded skills when the drive enables mandatory skills.','Require campus verification for extra recruiter conditions.','Assign zero fit and hybrid score when a mandatory gate fails.'],70,215,1135,364,28);
foot(s,'A high readiness score cannot override a failed eligibility condition.');
// 9
s=base('Job-specific candidate fit','The fit function combines six job-specific evidence factors after eligibility passes. Required skill alignment gives full credit to verified skills and half credit to recorded unverified skills. Preferred alignment measures presence, with required-skill alignment as a fallback when the drive has no preferred skills. Assessment performance averages the recorded history. Project relevance matches required skill words against project names and descriptions. Certifications count recorded certification entries. Academics use bounded CGPA times ten. These are transparent heuristics and their weights are not learned from hiring outcomes.', ['src/utils/scoring.ts']);
table(s,[['Fit factor','Weight','Evidence'],['Required skill alignment','35%','Verified: full credit, unverified: half credit'],['Preferred skills','10%','Recorded skill presence'],['Assessments','20%','Mean recorded assessment score'],['Relevant projects','15%','Matching project count, capped at 100'],['Certifications','5%','Recorded certification count, capped at 100'],['Academics','15%','CGPA × 10, capped at 100']],70,211,1138,362,[325,130,683]);
foot(s,'Required alignment also supplies the preferred-skill score when preferred skills are absent.');
// 10
s=base('NLP and hybrid ranking','Local NLP normalizes aliases from a reviewed skill dictionary, extracts job requirements using regular expressions and computes TF-IDF cosine relevance. Tokens exclude common stop words. TF is term count divided by document token count. Smoothed IDF is log((N+1)/(documentFrequency+1)) + 1, where N includes the query and candidate documents. The job query uses drive skills and description. Candidate text uses recorded skills, projects and project descriptions. TF-IDF measures lexical relevance and does not use semantic embeddings or an LLM. Eligibility gates still apply to the final ranking.', ['server/nlp.ts','server/services.ts']);
list(s,['Normalize skill aliases and tokenize job and candidate text.','Build TF-IDF vectors with smoothed inverse document frequency.','Compute cosine similarity between the job and each candidate.','Combine 85% rule-based fit with 15% text relevance.','Round the hybrid score and sort candidates in descending order.'],70,216,1130,345,28);
tx(s,'Hybrid score = round(0.85 × fit + 0.15 × cosine similarity × 100)',70,571,1138,65,27,true,C.lav,C.navy);
// 11
s=base('Matching results across three drives','The stored report ranks the strongest specialist first for each drive. Each has hybrid score 74 and readiness 93. The developing specialist has hybrid score 40 and readiness 18. The all-rounder has hybrid score 34 and readiness 18. The low readiness of the latter profiles reflects deliberately missing verified skills, projects and assessment evidence. Readiness and job fit serve different purposes, so their scores are not interchangeable. Expected winners were manually specified in the demo script. These three cases do not establish general ranking quality.', ['scripts/placement-demo.ts','output/placement-demo-report.json']);
table(s,[['Simulated drive','Expected top candidate','Hybrid score','Readiness'],...report.drives.map(x=>[x.role,x.expectedBest,String(x.ranking[0].score),String(x.ranking[0].readiness)])],70,224,1138,255,[340,388,205,205]);
list(s,['Each developing specialist scores 40 for the matching drive.','The all-rounder scores 34 in each drive.','Verified skills and preparation evidence influence the ranking.'],70,508,1130,130,26);
// 12
s=base('Scheduling and offer workflow','Scheduling uses availability and overlapping-resource checks rather than a trained optimization model. Drive conflicts cover venue, lab, room, recruiter and cohort constraints. Interview checks include candidate, room and panel overlaps. The workflow requires campus approval, a proposed schedule, recruiter confirmation and activation. Recruiters then record selection results and release offers. The synthetic demonstration includes deferral followed by acceptance, a blocked joining action before document verification, successful verification and joining, and deduplicated reminders. Notifications are stored, while external email needs service credentials.', ['src/services/drive.validation.ts','server/recruitment.ts','server/services.ts','scripts/placement-demo.ts']);
sub(s,'Recruitment coordination',70,211);sub(s,'Offer and joining controls',660,211);
list(s,['Campus approval and recruiter confirmation','Resource and cohort conflict checks','Candidate, room and panel interview checks'],70,285,540,270,28);
list(s,['Round results control candidate progression','Students accept, defer or withdraw offers','Document verification precedes joining'],660,285,540,270,28);
foot(s,'Stored notifications and deduplicated reminders connect the workflow.');
// 13
s=base('Optional historical outcome model','The repository implements logistic regression with six normalized readiness features plus an intercept. Training requires at least sixty labeled rows across three cohorts. Cohorts sort lexically, and the last cohort becomes the held-out test set, so cohort identifiers need to preserve chronology. Both train and test sets must contain placed and unplaced examples. Batch gradient descent runs 1,800 epochs with learning rate 0.15 and L2 coefficient 0.01 on non-intercept weights. The evaluation threshold is 0.5. Metrics include accuracy, precision, recall and Brier score. The demonstration does not train this model, and the runtime rejects synthetic provenance for live outcome estimates.', ['server/ml.ts','README.md']);
list(s,['Model: logistic regression over six readiness features.','Training requires at least 60 labeled outcomes across three cohorts.','The latest sorted cohort serves as the held-out test set.','Training uses gradient descent with L2 regularization.','Evaluation reports accuracy, precision, recall and Brier score.'],70,215,1135,335,28);
tx(s,'Current status: historical training and outcome validation remain pending.',70,573,1138,64,26,true,C.lav,C.navy);
// 14
s=base('Simulated dataset and evaluation protocol','The fixture contains thirteen synthetic student profiles, twelve in the main college and one in another campus to check isolation. Three job specifications require React and TypeScript, Java and SQL, and Python and SQL. Each main drive expects exactly three eligible candidates: the corresponding strong specialist, the developing specialist and the all-rounder. This yields nine positive labels and thirty negative labels across thirty-nine pairs. Expected labels and top-ranked candidates are manually specified. The fixture checks missing skills, low CGPA, wrong branch or graduation year, backlogs and campus mismatch. The demo uses isolated in-memory SQLite and simulated document records, not uploaded PDF files. No public dataset evaluation appears in the repository evidence.', ['scripts/placement-demo.ts','output/placement-demo-report.json']);
table(s,[['Dataset element','Coverage'],['Student profiles','13 synthetic profiles across two colleges'],['Recruitment drives','Frontend, backend and data analysis'],['Eligibility labels','39 pairs: 9 eligible and 30 ineligible'],['Ranking targets','One manually specified winner per drive'],['Edge cases','Missing skills, low CGPA, branch, year, backlogs and campus']],70,211,1138,350,[335,803]);
foot(s,'Isolated in-memory demonstration. No public-dataset validation is recorded.');
// 15
s=base('Measured matching accuracy','The stored demo report has correct = 39 and pairs = 39, so eligibility accuracy is one hundred percent. The three expected top candidates also match, giving top-one agreement of three out of three. The script asserts both outcomes. Eligibility classification checks agreement with manually specified rule labels. Ranking accuracy here is agreement with three chosen examples. These values describe a small scripted fixture and cannot support claims about real hiring success, fairness or prediction accuracy. Precision, recall and F1 for a general candidate relevance task have not been evaluated on an independent dataset.', ['scripts/placement-demo.ts','output/placement-demo-report.json']);
tx(s,'39 / 39',70,234,540,110,78,true,'none',C.navy);tx(s,'Eligibility decisions match labels',70,370,540,75,30,true);
tx(s,'3 / 3',675,234,520,110,78,true,'none',C.navy);tx(s,'Expected top candidates match',675,370,520,75,30,true);
tx(s,'Both checks achieved 100% agreement on the supplied synthetic fixture.',70,492,1135,78,31,true,C.lav,C.navy);
foot(s,'Small scripted benchmark. Real-world hiring and ranking accuracy remain unverified.');
// 16
s=base('Scoring validation and remaining evidence','The recorded example confirms the weighted arithmetic, and the fixture exercises evidence-rich versus evidence-poor profiles in matching. It does not provide an independently labeled readiness dataset or expert employability scores. Scoring correctness should be tested with boundary CGPA values, backlogs, missing history, partially verified skills and capped project or certification counts. An external validation study should compare scores with expert rubrics and historical outcomes, check sensitivity to weights and audit subgroup behavior. Those are proposed evaluations, not completed results.', ['src/utils/scoring.ts','output/placement-demo-report.json']);
sub(s,'What the prototype demonstrates',70,211);sub(s,'What still needs validation',660,211);
list(s,['Worked readiness arithmetic: 92.75 rounds to 93','Evidence-rich specialists lead the demo rankings','Missing evidence reduces readiness contributions'],70,286,540,300,27);
list(s,['Agreement with independent expert readiness labels','Sensitivity to weights and score thresholds','Real outcome association and subgroup behavior'],660,286,540,300,27);
foot(s,'No independently labeled readiness accuracy result is available.');
// 17
s=base('Performance evidence and benchmark plan','The saved report records elapsedMs = 85.58. The timer starts after student setup and wraps the three-drive setup, approvals, scheduling, eligibility, applications and ranking loop. It stops before later interview conflicts, offer responses and joining verification. Thus it is neither a full lifecycle timing nor browser latency. It uses a small in-memory database with no concurrency, and the report includes no hardware or repeated-run distribution. A production benchmark should report median and p95 API latency, throughput, failure rate, ranking time by cohort size and scheduling contention under realistic traffic. Dashboard polling every fifteen seconds adds request volume as the active user count grows.', ['scripts/placement-demo.ts','output/placement-demo-report.json','README.md','src/features/team.tsx']);
tx(s,`${report.evaluation.elapsedMs} ms`,70,224,1135,110,76,true,'none',C.navy);
tx(s,'Recorded duration of the three-drive setup and matching loop',70,360,1135,55,29,true);
list(s,['Small in-memory run with no concurrent users.','Later interview, offer and joining checks fall outside the timer.','Production plan: p50/p95 latency, throughput and failure rate.','Measure ranking growth, polling traffic and scheduling contention.'],70,442,1135,183,25);
// 18
s=base('Multi-campus isolation','Campus IDs associate student records with a registered institution. Campus team operations scope records to that institution and recruiters operate within their authorized partnerships and ownership. Candidate eligibility also checks the drive campus. Relational connections protect cross-entity consistency. The demo asserts that the main campus student list contains twelve people and excludes the other-campus student. Recruiter schedule availability needs cross-campus checks, because one recruiter may serve multiple institutions. This is functional isolation evidence rather than a production-scale throughput test.', ['README.md','server/workspace.ts','server/DATABASE.md','scripts/placement-demo.ts']);
list(s,['Students belong to their registered campus.','Campus teams access institution-scoped records.','Recruiter partnerships and ownership govern hiring operations.','Eligibility checks prevent campus-mismatched applications.','Recruiter availability checks span campuses.'],70,217,1135,343,28);
tx(s,'Demo coverage: 12 students in the main campus and one excluded campus profile.',70,577,1135,63,26,true,C.lav,C.navy);
// 19
s=base('Scalability approach','The documented starting architecture uses a single authoritative Express backend and PostgreSQL transaction layer. Campus and owner indexes support scoped queries. Aggregate reads batch related rows, and PostgreSQL snapshot reads do not acquire the placement write lock. Private object storage and workers can scale separately. Multiple backend replicas require shared rate-limit state and a durable queue with job claims to avoid duplicate worker processing. Scheduling uses a shared placement lock and may become a contention point. Capacity must be established through load tests before promises about institution count or user throughput. These replica and queue changes describe an expansion plan.', ['README.md','server/DATABASE.md','server/db.ts']);
sub(s,'Current foundation',70,211);sub(s,'Expansion requirements',660,211);
list(s,['Authoritative API with PostgreSQL transactions','Campus and owner indexes for scoped queries','Batch reads for related records'],70,285,540,270,28);
list(s,['Shared rate limiting across API replicas','Durable queues and exclusive job claims','Load testing of polling and scheduling locks'],660,285,540,270,28);
foot(s,'Multi-campus isolation is implemented. Production capacity remains to be benchmarked.');
// 20
s=base('Deployment architecture','Repository configuration targets Vercel for Next.js and Render for Express. Browsers call the frontend /api/v1 path, which proxies to the backend origin set by API_INTERNAL_URL. Session cookies therefore remain on the frontend origin. The backend uses hosted PostgreSQL, private Supabase storage and Resend email delivery in production. Optional AI services remain backend integrations. FRONTEND_URL must match the frontend HTTPS origin, and the API must bind to the assigned port on 0.0.0.0. This is a deployment configuration and approach, not evidence of a live production deployment.', ['README.md','render.yaml','vercel.json','next.config.mjs']);
a=node(s,'User browser',70,255,240,90);b=node(s,'Vercel\nNext.js frontend',390,255,260,90);c=node(s,'Render\nExpress backend',730,255,270,90);link(s,a,b);link(s,b,c);
e=node(s,'PostgreSQL',70,467,310,90);f=node(s,'Supabase private storage',475,467,335,90);g=node(s,'Resend email',905,467,305,90);link(s,c,e,'bottom','top');link(s,c,f,'bottom','top');link(s,c,g,'bottom','top');
foot(s,'Backend-only credentials. Frontend requests use the same-origin /api/v1 proxy.');
// 21
s=base('Configuration and operational checks','Use Node.js 24.x and install the repository dependencies. npm run dev starts the local API and frontend. Production uses npm run build for Next.js and npm run server:build followed by npm run server:start for Express. Database tables and migrations apply at startup. Before the relational cutover, stop old backend instances because the legacy store becomes read-only. Keep provider secrets in backend settings rather than NEXT_PUBLIC variables. Verify health, login, account approval, private uploads and password recovery after deployment. Sleeping hosting processes delay requests and pause email and reminder workers, so production operations need a persistent process.', ['README.md','render.yaml','server/DATABASE.md']);
list(s,['Local setup: Node.js 24, repository install and npm run dev.','Build frontend and backend before deploying.','Configure database, private storage, email and frontend origin.','Keep secrets in backend settings and validate database TLS.','Verify health, login, approvals, uploads and password recovery.'],70,215,1135,342,28);
foot(s,'Email and reminder workers need a persistent backend process.');
// 22
s=base('Technical findings and next steps','The repository implements the requested core placement capabilities and provides a reproducible synthetic demonstration. It has transparent rule-based readiness and fit scores, text relevance, conflict-aware scheduling, stored notifications and offer controls. The current evidence is strongest for functional workflow behavior and conformance to chosen rules. Before a broader rollout, conduct a real college pilot, benchmark realistic concurrency, validate rubric scores with independent labels and, if using outcome prediction, train and hold out genuine historical cohorts. The proposed sequence limits claims to evidence that each stage produces.', ['README.md','output/placement-demo-report.json','server/ml.ts']);
sub(s,'Implemented and demonstrated',70,211);sub(s,'Next validation stages',660,211);
list(s,['Connected placement lifecycle','Explainable rules and NLP matching','Synthetic eligibility and ranking checks'],70,285,540,280,28);
list(s,['College pilot and usability measurements','Production load and contention benchmarks','Independent scoring and historical-model validation'],660,285,540,280,28);
foot(s,'The next milestone is a measured institutional pilot.');
// 23
s=base('References','All technical facts and measured values come from the local repository and stored report. The deck does not rely on external market claims or public datasets. Read the cited source files for complete implementation detail. The recorded benchmark is available in output/placement-demo-report.json, and scripts/placement-demo.ts contains the fixture and expected labels. Scoring accuracy beyond rule arithmetic requires independent validation. The optional historical model is not part of the synthetic evaluation.', ['README.md','server/API.md','server/DATABASE.md','src/utils/scoring.ts','src/utils/placement.ts','server/nlp.ts','server/services.ts','server/ml.ts','scripts/placement-demo.ts','output/placement-demo-report.json','render.yaml','next.config.mjs']);
table(s,[['Technical topic','Repository source'],['Architecture and data','README.md, server/API.md, server/DATABASE.md'],['Readiness and eligibility','src/utils/scoring.ts, src/utils/placement.ts'],['NLP and hybrid matching','server/nlp.ts, server/services.ts'],['Optional prediction','server/ml.ts'],['Dataset and evaluation','scripts/placement-demo.ts, output/placement-demo-report.json'],['Deployment','render.yaml, vercel.json, next.config.mjs']],70,211,1138,380,[335,803]);
// 24
s=base('THANK YOU','Invite discussion about architecture, scoring transparency, evaluation limits and pilot deployment. The prototype connects preparation with recruitment management. Explain that scores help human decisions and that real-world outcome and scalability claims require further evidence.', ['README.md']);
tx(s,'Questions and Discussion',70,290,1138,84,48,true,C.lav,C.navy);
tx(s,'CampusLink\nConnecting students, campuses and careers',70,426,1138,120,34);

await fs.mkdir(DIR+'/previews',{recursive:true});
await (await PresentationFile.exportPptx(p)).save(DIR+'/candidate.pptx');
console.log('Draft exported: '+p.slides.items.length+' slides');
for(let i=0;i<p.slides.items.length;i++){
 const blob=await p.export({slide:p.slides.items[i],format:'png',scale:1});
 await fs.writeFile(DIR+'/previews/slide-'+String(i+1).padStart(2,'0')+'.png',new Uint8Array(await blob.arrayBuffer()));
 console.log('Rendered '+(i+1));
}
const result=await finalizePresentation({workspaceDir:'C:/CampusLink',candidatePath:DIR+'/candidate.pptx',finalPath:FINAL,pythonExecutable:'C:/Users/sahoo/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',integrityValidatorPath:SKILL+'/container_tools/inspect_presentation_package_integrity.py',layoutValidatorPath:SKILL+'/container_tools/inspect_presentation_layout_geometry.py',layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...[5,6,7,9,11,14,23].flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:24,requiredNativeTableOwnerSlides:[5,6,7,9,11,14,23],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:DIR+'/validation.json'});
console.log(JSON.stringify(result));
