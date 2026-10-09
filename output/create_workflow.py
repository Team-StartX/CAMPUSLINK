from PIL import Image, ImageDraw, ImageFont
import math
from pathlib import Path

W,H=2400,1350
im=Image.new('RGB',(W,H),'#f1eee4'); d=ImageDraw.Draw(im)
navy='#3c3e60'; lavender='#cdc2db'; ink='#242426'; grid='#dedbd2'; blue='#acc2df'
for x in range(0,W,90): d.line((x,0,x,H),fill=grid,width=3)
for y in range(0,H,90): d.line((0,y,W,y),fill=grid,width=3)
fonts=Path('C:/Windows/Fonts')
def font(size,bold=False): return ImageFont.truetype(str(fonts/('arialbd.ttf' if bold else 'arial.ttf')),size)
def text(x,y,s,size=30,color=ink,bold=False): d.text((x,y),s,font=font(size,bold),fill=color)
def centered(x,y,s,size=30,color=ink,bold=False):
    f=font(size,bold); box=d.textbbox((0,0),s,font=f); d.text((x-(box[2]-box[0])/2,y),s,font=f,fill=color)
def arrow(points,color=navy,width=5):
    d.line(points,fill=color,width=width,joint='curve')
    a,b=points[-2],points[-1]; angle=math.atan2(b[1]-a[1],b[0]-a[0]); L=17
    p=[b,(b[0]-L*math.cos(angle-.5),b[1]-L*math.sin(angle-.5)),(b[0]-L*math.cos(angle+.5),b[1]-L*math.sin(angle+.5))]
    d.polygon(p,fill=color)
def card(x,y,w,h,title,lines,num=None):
    d.rounded_rectangle((x+7,y+8,x+w+7,y+h+8),radius=18,fill=navy)
    d.rounded_rectangle((x,y,x+w,y+h),radius=18,fill='#f8f5ed',outline=navy,width=3)
    d.rounded_rectangle((x,y,x+w,y+60),radius=18,fill=lavender)
    d.rectangle((x+2,y+35,x+w-2,y+60),fill=lavender)
    centered(x+w/2,y+15,title,29,navy,True)
    for i,line in enumerate(lines): centered(x+w/2,y+83+i*39,line,26)
    if num:
        d.ellipse((x-18,y-18,x+29,y+29),fill=navy)
        centered(x+5,y-10,num,24,'white',True)

text(95,43,'BPUT HACKATHON 2026',34,navy,True)
text(95,95,'CAMPUSLINK WORKFLOW',78,navy,True)
text(98,187,'From student readiness to recruitment, offers and placement insights',30,navy)
d.rounded_rectangle((2005,60,2305,117),radius=28,fill=ink)
centered(2155,71,'StartX  |  PS:10',28,'white',True)

d.rounded_rectangle((700,248,1700,303),radius=26,fill=navy)
centered(1200,259,'HOME  →  REGISTER / SIGN IN  →  ROLE DASHBOARD',25,'white',True)
for cx in (430,1200,1970):
    arrow([(1200,303),(1200,327),(cx,327),(cx,352)])
card(100,355,660,170,'STUDENT',['Profile, resume, projects and skills','Assessments and interview preparation'])
card(870,355,660,170,'CAMPUS TEAM',['Verify student records and approve drives','Manage readiness and placement activities'])
card(1640,355,660,170,'RECRUITER',['Define jobs, eligibility and required skills','Review applicants and manage selection'])
for cx in (430,1200,1970): arrow([(cx,533),(cx,574)])
d.rounded_rectangle((100,577,2300,639),radius=14,fill=navy)
centered(1200,592,'EXPRESS API  +  DATABASE   •   PostgreSQL / local SQLite   •   Role and campus access controls',29,'white')
arrow([(330,639),(330,696)])
cards=[(100,'READINESS PROFILE',['Weighted readiness score','Evidence and skill gaps']),
       (685,'ELIGIBILITY CHECK',['CGPA, branch, year, backlogs','Required skills and campus']),
       (1270,'EXPLAINABLE MATCHING',['Weighted candidate fit','NLP text relevance']),
       (1855,'MATCH RESULTS',['Eligible: ranked applicants','Ineligible: reasons + guidance'])]
for i,(x,title,lines) in enumerate(cards):
    card(x,700,445,180,title,lines,str(i+1))
    if i<3: arrow([(x+452,790),(x+570,790)])
arrow([(2077,889),(2077,939),(290,939),(290,991)])
d.rounded_rectangle((660,917,1740,958),radius=10,fill='#f1eee4')
centered(1200,921,'Eligible applicants continue through the placement workflow',27,navy,True)
bottom=[('DRIVE SCHEDULING',['Campus approval + confirmation','Conflict and availability checks']),
        ('NOTIFICATIONS',['Drive and interview updates','In-app alerts / configured email']),
        ('SELECTION ROUNDS',['Assessments and interviews','Results and progression']),
        ('OFFER TRACKING',['Release, accept or defer offers','Verify documents and joining']),
        ('PLACEMENT ANALYTICS',['Readiness and hiring outcomes','Campus and recruiter insights'])]
for i,(title,lines) in enumerate(bottom):
    x=100+i*455
    card(x,995,380,180,title,lines,str(i+5))
    # Use slightly smaller body labels in this dense row.
    d.rectangle((x+4,1065,x+376,1162),fill='#f8f5ed')
    for j,line in enumerate(lines): centered(x+190,1080+j*37,line,23)
    if i<4: arrow([(x+387,1085),(x+440,1085)])
text(100,1240,'PREPARE  •  MATCH  •  SCHEDULE  •  HIRE  •  TRACK',28,navy,True)
text(100,1284,'Prototype flow: explainable rules and NLP; optional AI coaching supports student preparation.',24,navy)
d.rounded_rectangle((2050,1250,2310,1310),radius=28,fill=ink)
centered(2180,1264,'TECHNICAL FLOW',23,'white',True)
out=Path('C:/CampusLink/output/designs/CampusLink_Workflow.png');out.parent.mkdir(parents=True,exist_ok=True)
im.save(out)
print(out)
