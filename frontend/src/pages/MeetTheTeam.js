import React, { useEffect, useRef, useState, useMemo } from 'react';
import { X, Phone, MapPin, Plus, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/utils/api';
import { toast } from 'sonner';

// ── Colour palette ────────────────────────────────────────────────────────────
const COLORS = {
  Blue:   { color:'#60a5fa', bodyColor:'#2563eb', hatColor:'#1e3a5f' },
  Green:  { color:'#34d399', bodyColor:'#059669', hatColor:'#064e3b' },
  Amber:  { color:'#fbbf24', bodyColor:'#b45309', hatColor:'#451a03' },
  Purple: { color:'#a78bfa', bodyColor:'#7c3aed', hatColor:'#4c1d95' },
  Pink:   { color:'#f472b6', bodyColor:'#db2777', hatColor:'#831843' },
  Orange: { color:'#fb923c', bodyColor:'#ea580c', hatColor:'#78350f' },
  Red:    { color:'#f87171', bodyColor:'#dc2626', hatColor:'#7f1d1d' },
  Teal:   { color:'#2dd4bf', bodyColor:'#0d9488', hatColor:'#042f2e' },
  Sky:    { color:'#38bdf8', bodyColor:'#0284c7', hatColor:'#0c4a6e' },
  Indigo: { color:'#818cf8', bodyColor:'#4f46e5', hatColor:'#1e1b4b' },
  Forest: { color:'#4ade80', bodyColor:'#16a34a', hatColor:'#14532d' },
  Violet: { color:'#c084fc', bodyColor:'#9333ea', hatColor:'#3b0764' },
};

// ── Default team (seeded on first init) ──────────────────────────────────────
const DEFAULT_TEAM = [
  { name:'Chandu MR',    role:'Summit Commander',          title:'CEO & Social Media Head',         phone:'7795620385', colorKey:'Blue',   founder:true,  bio:'The visionary who charts every peak and post. Leads BT with a hiker\'s spirit and an entrepreneur\'s eye.', manages:['Overall Strategy & Vision','Social Media & Brand Identity','Himalayan Ops (via Akash)'], reach:'Brand decisions, media queries, social media campaigns, major escalations' },
  { name:'Varun H',      role:'Base Camp Director',        title:'Head of Sales',                   phone:'9740498724', colorKey:'Green',  founder:true,  bio:'Holds the gate to every trek. Leads the entire sales & enrollment front.', manages:['Sales & Revenue Targets','Registration Team (Amar, Suleman, Anjali)','Trek Bookings'], reach:'Booking issues, sales targets, registration escalations, revenue queries' },
  { name:'Suresh T',     role:'Expedition Finance Chief',  title:'CFO',                             phone:'9019152958', colorKey:'Amber',  founder:true,  bio:'Keeps the expedition treasury on course. Every rupee flowing through BT is tracked by Suresh.', manages:['Finance & Accounts','Budget Planning','Permit Ops (via Naveen)','South Treks (via Rakesh K)'], reach:'Financial approvals, reimbursements, budget queries, cost reports' },
  { name:'Akash Shetty', role:'Himalayan Expeditions Head',title:'Himalayan Treks Operations Head', phone:'7892747248', colorKey:'Sky',    reportsTo:'Chandu MR', bio:'Rules the rooftop of India. Oversees all Himalayan trek operations.', manages:['Himalayan Trek Operations','High Altitude Logistics','Mountain Guide Coordination'], reach:'Himalayan trek ops, altitude planning, expedition queries, mountain guide issues' },
  { name:'Amar BS',      role:'Trail Enrollment Lead',     title:'Trek Registration Executive',     phone:'7892396643', colorKey:'Orange', reportsTo:'Varun H',    bio:'Frontline champion of the registration desk. Handles bookings and participant onboarding.', manages:['Trek Registrations','Participant Onboarding','Booking Confirmations'], reach:'Registration data, booking confirmations, onboarding queries' },
  { name:'Suleman',      role:'Enrollment Specialist',     title:'Trek Registration Executive',     phone:'6366212304', colorKey:'Purple', reportsTo:'Varun H',    bio:'Guides trekkers through their enrollment journey from first inquiry to confirmed booking.', manages:['Trek Registrations','Customer Queries','Booking Coordination'], reach:'Enrollment queries, trekker registration, booking coordination' },
  { name:'Anjali',       role:'Registration Coordinator',  title:'Trek Registration Executive',     phone:'8618283751', colorKey:'Pink',   reportsTo:'Varun H',    bio:'Ensures smooth registration flow so no trekker is left stranded at base camp.', manages:['Trek Registrations','Follow-ups & Reminders','Participant Data Management'], reach:'Participant support, follow-ups, registration queries' },
  { name:'Naveen',       role:'Forest Permits Officer',    title:'Permit & Clearance Coordinator',  phone:'8971755460', colorKey:'Forest', reportsTo:'Suresh T',   bio:'Navigates the bureaucratic wilderness to secure permits and clearances for every expedition.', manages:['Forest Department Permits','Entry & Access Clearances','Compliance Documentation'], reach:'Permit status, forest clearances, government docs, compliance' },
  { name:'Rakesh K',     role:'Southern Trails Ops Head',  title:'South Trek Operations Head',      phone:'8951333624', colorKey:'Red',    reportsTo:'Suresh T',   bio:'Commands all Southern India trek operations. The man on the ground for every southern expedition.', manages:['South India Trek Operations','Ground Logistics','Vendor Coordination (South)'], reach:'South trek ops, on-ground logistics, southern route queries' },
  { name:'Manu Bhargav', role:'Story Cartographer',        title:'Content Editor',                  phone:'7019387485', colorKey:'Violet', bio:'Turns every trail into a story. Crafts content that inspires thousands to lace up their boots.', manages:['Blog & Content Strategy','Social Media Content','Trek Stories & Reports'], reach:'Content, blog posts, trek write-ups, social media material' },
  { name:'Rakesh M',     role:'Trail Chronicles Editor',   title:'Content Editor',                  phone:'9611584273', colorKey:'Teal',   bio:'Documents every adventure with words that transport readers straight to the mountain.', manages:['Trek Documentation','Content Writing & Editing','Trail Narratives'], reach:'Trek reports, documentation, content writing, editorial' },
];

const EMPTY_FORM = { name:'', role:'', title:'', phone:'', bio:'', manages:[], reach:'', reportsTo:'', founder:false, colorKey:'Blue' };
const FIRES = [{ x:0,z:1.5 },{ x:-6,z:2.5 },{ x:6,z:2.5 },{ x:0,z:9 },{ x:-2,z:-2 }];
const FOCAL=310, BASE_H=1.65, HZ_R=0.455, CHAR_H=1.9, INTER=3.6;

// ── Helpers ───────────────────────────────────────────────────────────────────
function rc(m) { return { ...m, ...(COLORS[m.colorKey] || COLORS.Blue) }; }

function autoLayout(members) {
  const r = members.map(m => ({ ...rc(m) }));
  const founders   = r.filter(m => m.founder);
  const withMgr    = r.filter(m => !m.founder && m.reportsTo);
  const solo       = r.filter(m => !m.founder && !m.reportsTo);
  founders.forEach((m,i)  => { m.x=(i-(founders.length-1)/2)*6.5; m.z=0; });
  const byMgr={};
  withMgr.forEach(m => { if(!byMgr[m.reportsTo]) byMgr[m.reportsTo]=[]; byMgr[m.reportsTo].push(m); });
  Object.entries(byMgr).forEach(([mn,reps]) => {
    const mgr=r.find(m=>m.name===mn); const bx=mgr?mgr.x:0, bz=mgr?mgr.z:0;
    reps.forEach((m,i) => { m.x=bx+(i-(reps.length-1)/2)*3.5; m.z=bz+6; });
  });
  solo.forEach((m,i) => { m.x=(i-(solo.length-1)/2)*4.5; m.z=-4; });
  return r;
}

// ── 3D Drawing ────────────────────────────────────────────────────────────────
function drawSky(ctx,W,H,hz){
  const g=ctx.createLinearGradient(0,0,0,hz);
  g.addColorStop(0,'#040a1a'); g.addColorStop(.4,'#0d2248'); g.addColorStop(1,'#1a5280');
  ctx.fillStyle=g; ctx.fillRect(0,0,W,hz);
  ctx.fillStyle='rgba(255,255,255,.7)';
  [[.06,.08],[.15,.04],[.27,.14],[.39,.06],[.5,.1],[.61,.04],[.72,.16],[.82,.07],[.91,.2],[.1,.26],[.47,.3],[.7,.24],[.88,.3],[.33,.22]].forEach(([px,py])=>{ctx.beginPath();ctx.arc(px*W,py*hz,1,0,Math.PI*2);ctx.fill();});
  ctx.fillStyle='rgba(255,248,220,.9)'; ctx.beginPath(); ctx.arc(W*.85,hz*.18,W*.016,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='rgba(13,34,72,.9)';   ctx.beginPath(); ctx.arc(W*.857,hz*.16,W*.013,0,Math.PI*2); ctx.fill();
}
function drawMountains(ctx,W,hz){
  const far=[[0,.92],[.04,.6],[.11,.78],[.17,.4],[.26,.66],[.33,.3],[.43,.56],[.51,.26],[.6,.5],[.67,.36],[.75,.6],[.82,.42],[.89,.66],[.95,.52],[1,.84]];
  ctx.beginPath(); ctx.moveTo(0,hz); far.forEach(([px,py])=>ctx.lineTo(px*W,py*hz)); ctx.lineTo(W,hz); ctx.closePath(); ctx.fillStyle='#1e3d5c'; ctx.fill();
  const mid=[[0,1],[.06,.7],[.14,.84],[.21,.56],[.3,.76],[.38,.5],[.48,.72],[.56,.58],[.64,.7],[.72,.54],[.79,.68],[.87,.56],[.93,.76],[1,.86]];
  ctx.beginPath(); ctx.moveTo(0,hz); mid.forEach(([px,py])=>ctx.lineTo(px*W,py*hz)); ctx.lineTo(W,hz); ctx.closePath(); ctx.fillStyle='#112233'; ctx.fill();
  [[.17,.4],[.33,.3],[.51,.26],[.67,.36],[.82,.42]].forEach(([px,py])=>{const x=px*W,y=py*hz;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-W*.02,y+hz*.1);ctx.lineTo(x+W*.02,y+hz*.1);ctx.closePath();ctx.fillStyle='rgba(220,240,255,.86)';ctx.fill();});
}
function drawFloor(ctx,W,H,hz){ const g=ctx.createLinearGradient(0,hz,0,H); g.addColorStop(0,'#1e3a14');g.addColorStop(.5,'#152a0e');g.addColorStop(1,'#090f06'); ctx.fillStyle=g; ctx.fillRect(0,hz,W,H-hz); }
function drawGrid(ctx,W,H,hz,cx){ ctx.save(); ctx.strokeStyle='rgba(80,200,60,.1)'; ctx.lineWidth=1; for(let i=-14;i<=14;i++){ctx.beginPath();ctx.moveTo(cx,hz);ctx.lineTo(cx+i*75,H);ctx.stroke();} for(let d=1;d<=20;d++){const sy=hz+(BASE_H/d)*FOCAL;if(sy>H)break;const sp=(W*.55)*(sy-hz)/(H-hz+1);ctx.beginPath();ctx.moveTo(cx-sp*2.5,sy);ctx.lineTo(cx+sp*2.5,sy);ctx.stroke();} ctx.restore(); }
function drawFire(ctx,relX,relZ,W,H,hz,camH,cx,time,idx){ const sc=FOCAL/relZ,sx=cx+(relX/relZ)*FOCAL,fy=hz+(camH/relZ)*FOCAL; if(sx<-sc*3||sx>W+sc*3)return; const gr=sc*1.2,grd=ctx.createRadialGradient(sx,fy,0,sx,fy,gr); grd.addColorStop(0,'rgba(251,146,60,.35)');grd.addColorStop(1,'rgba(251,146,60,0)'); ctx.fillStyle=grd;ctx.beginPath();ctx.ellipse(sx,fy,gr,gr*.3,0,0,Math.PI*2);ctx.fill(); if(sc<6)return; const fl=Math.sin(time*11+idx*2.1)*.28+.72,fl2=Math.sin(time*8+idx*1.7+1)*.25+.75,fh=sc*.65*fl; ctx.fillStyle='#f97316';ctx.beginPath();ctx.moveTo(sx,fy-fh);ctx.lineTo(sx-sc*.2,fy);ctx.lineTo(sx+sc*.2,fy);ctx.closePath();ctx.fill(); ctx.fillStyle='#fbbf24';ctx.beginPath();ctx.moveTo(sx,fy-sc*.38*fl2);ctx.lineTo(sx-sc*.11,fy-sc*.05);ctx.lineTo(sx+sc*.11,fy-sc*.05);ctx.closePath();ctx.fill(); ctx.fillStyle='rgba(255,240,180,.85)';ctx.beginPath();ctx.moveTo(sx,fy-sc*.18);ctx.lineTo(sx-sc*.06,fy-sc*.03);ctx.lineTo(sx+sc*.06,fy-sc*.03);ctx.closePath();ctx.fill(); }
function drawChar(ctx,m,relX,relZ,W,H,hz,camH,cx,isNearest,time){
  const sc=FOCAL/relZ,sx=cx+(relX/relZ)*FOCAL,feetY=hz+(camH/relZ)*FOCAL,headY=hz+((camH-CHAR_H)/relZ)*FOCAL,cH=feetY-headY,cW=cH*.37;
  if(sx<-cW*4||sx>W+cW*4||cH<4)return;
  const fog=Math.min(.75,relZ/22); ctx.save(); ctx.globalAlpha=1-fog*.8;
  const sway=Math.sin(m.id*0.91+time*.65)*cH*.007,asx=sx+sway;
  if(isNearest){const pulse=Math.sin(time*4)*.3+.7;ctx.save();ctx.strokeStyle=`rgba(251,191,36,${pulse})`;ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.beginPath();ctx.ellipse(asx,feetY,cW*1.35,cW*.4,0,0,Math.PI*2);ctx.stroke();ctx.restore();}
  ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(asx,feetY,cW*1.15,cW*.33,0,0,Math.PI*2);ctx.fill();
  const legT=headY+cH*.73,legH=feetY-legT;
  ctx.fillStyle='#1c1917';ctx.fillRect(asx-cW*.35,feetY-legH*.28,cW*.31,legH*.28);ctx.fillRect(asx+cW*.04,feetY-legH*.28,cW*.31,legH*.28);
  ctx.fillStyle='#57534e';ctx.fillRect(asx-cW*.33,legT,cW*.29,legH*.75);ctx.fillRect(asx+cW*.04,legT,cW*.29,legH*.75);
  const bT=headY+cH*.27,bH=cH*.47; ctx.fillStyle=m.bodyColor; ctx.beginPath(); if(ctx.roundRect)ctx.roundRect(asx-cW*.52,bT,cW,bH,cW*.13);else ctx.rect(asx-cW*.52,bT,cW,bH); ctx.fill();
  ctx.fillStyle=m.color;ctx.globalAlpha=(1-fog*.8)*.75;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(asx-cW*.3,bT,cW*.6,bH,cW*.1);else ctx.rect(asx-cW*.3,bT,cW*.6,bH);ctx.fill();ctx.globalAlpha=1-fog*.8;
  ctx.fillStyle=m.bodyColor;ctx.fillRect(asx-cW*.72,bT+bH*.1,cW*.22,bH*.72);ctx.fillRect(asx+cW*.5,bT+bH*.1,cW*.22,bH*.72);
  ctx.fillStyle=m.hatColor;ctx.beginPath();if(ctx.roundRect)ctx.roundRect(asx+cW*.38,bT+bH*.06,cW*.3,bH*.68,cW*.05);else ctx.rect(asx+cW*.38,bT+bH*.06,cW*.3,bH*.68);ctx.fill();
  const hR=cH*.125,hCY=headY+cH*.175; ctx.fillStyle='#f5c7a9';ctx.beginPath();ctx.arc(asx,hCY,hR,0,Math.PI*2);ctx.fill();
  ctx.fillStyle=m.hatColor;ctx.beginPath();ctx.ellipse(asx,hCY-hR*.38,hR*1.12,hR*.75,0,Math.PI,0);ctx.fill();
  ctx.beginPath();ctx.ellipse(asx+hR*.22,hCY-hR*.06,hR*1.48,hR*.18,.1,0,Math.PI*2);ctx.fill();
  if(cH>16){const fs=Math.min(13,Math.max(7,cH*.11));ctx.font=`bold ${fs}px Inter,sans-serif`;ctx.textAlign='center';const nW=ctx.measureText(m.name).width,px=fs*.55,py=fs*.3,bx=asx-nW/2-px,by=headY-cH*.1-fs-py*2,bw=nW+px*2,bht=fs+py*2;ctx.fillStyle='rgba(8,15,35,.88)';if(ctx.roundRect){ctx.beginPath();ctx.roundRect(bx,by,bw,bht,bht/2);ctx.fill();}else ctx.fillRect(bx,by,bw,bht);ctx.fillStyle='#fff';ctx.fillText(m.name,asx,by+fs+py*.6);if(cH>32){const rs=Math.max(6.5,fs*.82);ctx.font=`${rs}px Inter,sans-serif`;ctx.fillStyle='#93c5fd';ctx.fillText(m.role,asx,by+fs+py*.6+rs+2);}}
  ctx.restore();
}
function drawLegs(ctx,W,H,wc,moving){ if(!moving)return; const sw=Math.sin(wc*.2)*H*.042,lw=W*.048,lh=H*.17,by=H,lx=W*.38,rx=W*.62; ctx.save();ctx.globalAlpha=.82; ctx.fillStyle='#57534e';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(lx-lw/2,by-lh+sw,lw,lh,lw*.3);else ctx.rect(lx-lw/2,by-lh+sw,lw,lh);ctx.fill(); ctx.fillStyle='#1c1917';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(lx-lw*.6,by-lh*.28+sw,lw*1.2,lh*.3,lw*.2);else ctx.rect(lx-lw*.6,by-lh*.28+sw,lw*1.2,lh*.3);ctx.fill(); ctx.fillStyle='#57534e';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(rx-lw/2,by-lh-sw,lw,lh,lw*.3);else ctx.rect(rx-lw/2,by-lh-sw,lw,lh);ctx.fill(); ctx.fillStyle='#1c1917';ctx.beginPath();if(ctx.roundRect)ctx.roundRect(rx-lw*.6,by-lh*.28-sw,lw*1.2,lh*.3,lw*.2);else ctx.rect(rx-lw*.6,by-lh*.28-sw,lw*1.2,lh*.3);ctx.fill(); ctx.restore(); }

function renderFrame(canvas,logW,logH,state,teamArr){
  if(!canvas||!logW||!logH)return;
  const dpr=window.devicePixelRatio||1,ctx=canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const W=logW,H=logH,{cam,wc,moving,nearestId,time}=state;
  const bob=moving?Math.sin(wc*.18)*.026:0,tilt=moving?Math.sin(wc*.09)*.45:0;
  const camH=BASE_H+bob,hz=H*HZ_R,cx=W/2+tilt;
  ctx.clearRect(0,0,W,H);
  drawSky(ctx,W,H,hz); drawMountains(ctx,W,hz); drawFloor(ctx,W,H,hz); drawGrid(ctx,W,H,hz,cx);
  const proj=(wx,wz)=>{const dx=wx-cam.x,dz=wz-cam.z;return{relX:dx*Math.cos(cam.yaw)-dz*Math.sin(cam.yaw),relZ:dx*Math.sin(cam.yaw)+dz*Math.cos(cam.yaw)};};
  FIRES.forEach((f,i)=>{const{relX,relZ}=proj(f.x,f.z);if(relZ>.3)drawFire(ctx,relX,relZ,W,H,hz,camH,cx,time,i);});
  teamArr.map(m=>{const p=proj(m.x,m.z);return{m,...p};}).filter(c=>c.relZ>.4).sort((a,b)=>b.relZ-a.relZ).forEach(({m,relX,relZ})=>drawChar(ctx,m,relX,relZ,W,H,hz,camH,cx,String(m.id)===String(nearestId),time));
  drawLegs(ctx,W,H,wc,moving);
}

// ── Manages list sub-component ───────────────────────────────────────────────
function ManagesList({ items, onChange }) {
  const [val, setVal] = useState('');
  const add = () => { if(val.trim()){ onChange([...items, val.trim()]); setVal(''); } };
  return (
    <div>
      <div className="space-y-1 mb-2 max-h-28 overflow-y-auto">
        {items.map((item,i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-lg px-2.5 py-1.5">
            <span className="flex-1 text-xs text-slate-700">{item}</span>
            <button type="button" onClick={() => onChange(items.filter((_,j)=>j!==i))} className="text-slate-300 hover:text-red-400 transition-colors"><X size={11}/></button>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-300 italic px-1">No items yet</p>}
      </div>
      <div className="flex gap-2">
        <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add();}}} placeholder="Add item, press Enter…" className="flex-1 text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"/>
        <button type="button" onClick={add} className="text-xs bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg text-slate-600 transition-colors">+ Add</button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
const MeetTheTeam = () => {
  const { userProfile } = useAuth();
  const isAdmin = ['Super Admin', 'Operations Manager'].includes(userProfile?.role);

  const [teamData, setTeamData]     = useState([]);
  const [fromDB,   setFromDB]       = useState(false);
  const [loading,  setLoading]      = useState(true);
  const [adminOpen, setAdminOpen]   = useState(false);
  const [editingMember, setEditing] = useState(null);
  const [delConfirm, setDelConfirm] = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [dialog, setDialog]         = useState(null);
  const [hint,   setHint]           = useState(null);

  const canvasRef  = useRef(null);
  const rafRef     = useRef(null);
  const nearestRef = useRef(null);
  const sizeRef    = useRef({ w:800, h:440 });
  const teamRef    = useRef([]);
  const stateRef   = useRef({ cam:{x:0,z:-12,yaw:0}, keys:new Set(), drag:{on:false,lastX:0}, wc:0, moving:false, time:0, nearestId:null });

  // ── Fetch team ──────────────────────────────────────────────────────────────
  const fetchTeam = async () => {
    try {
      const res = await api.get('/team');
      if (res.data?.length > 0) {
        setTeamData(res.data); setFromDB(true);
      } else {
        setTeamData([]); setFromDB(false);
      }
    } catch { setTeamData([]); setFromDB(false); }
    setLoading(false);
  };

  useEffect(() => { fetchTeam(); }, []);

  // ── Auto-layout whenever teamData changes ───────────────────────────────────
  const layouted = useMemo(() => autoLayout(teamData), [teamData]);
  useEffect(() => { teamRef.current = layouted; }, [layouted]);

  // ── Seed defaults to DB ─────────────────────────────────────────────────────
  const seedDefaults = async () => {
    try {
      await Promise.all(DEFAULT_TEAM.map(m => api.post('/team', m)));
      toast.success('Team initialised from defaults!');
      fetchTeam();
    } catch { toast.error('Failed to initialise team'); }
  };

  // ── Admin CRUD ──────────────────────────────────────────────────────────────
  const openAdd = () => { setEditing(null); setForm(EMPTY_FORM); setAdminOpen(true); };
  const openEdit = (m) => {
    setEditing(m);
    setForm({ name:m.name||'', role:m.role||'', title:m.title||'', phone:m.phone||'', bio:m.bio||'', manages:Array.isArray(m.manages)?[...m.manages]:[], reach:m.reach||'', reportsTo:m.reportsTo||'', founder:m.founder||false, colorKey:m.colorKey||'Blue' });
    setAdminOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    try {
      if (editingMember?.id) { await api.patch(`/team/${editingMember.id}`, form); toast.success('Member updated'); }
      else                   { await api.post('/team', form);                    toast.success('Member added'); }
      setAdminOpen(false); setEditing(null); fetchTeam();
    } catch { toast.error('Failed to save member'); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/team/${delConfirm.id}`);
      toast.success(`${delConfirm.name} removed`);
      setDelConfirm(null); setDialog(null); fetchTeam();
    } catch { toast.error('Failed to delete member'); }
  };

  // ── 3D canvas setup ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const resize = () => {
      const dpr=window.devicePixelRatio||1, w=canvas.offsetWidth, h=canvas.offsetHeight;
      canvas.width=w*dpr; canvas.height=h*dpr; sizeRef.current={w,h};
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    const onKD = (e) => {
      stateRef.current.keys.add(e.key.toLowerCase());
      if (e.key.toLowerCase()==='e' && nearestRef.current) setDialog(nearestRef.current);
      if (e.key==='Escape') { setDialog(null); setAdminOpen(false); }
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
    };
    const onKU = (e) => stateRef.current.keys.delete(e.key.toLowerCase());
    const onMD = (e) => { stateRef.current.drag={on:true,lastX:e.clientX}; };
    const onMM = (e) => { if(!stateRef.current.drag.on)return; stateRef.current.cam.yaw+=(e.clientX-stateRef.current.drag.lastX)*.005; stateRef.current.drag.lastX=e.clientX; };
    const onMU = () => { stateRef.current.drag.on=false; };

    window.addEventListener('keydown',onKD); window.addEventListener('keyup',onKU);
    canvas.addEventListener('mousedown',onMD);
    window.addEventListener('mousemove',onMM); window.addEventListener('mouseup',onMU);

    const loop = () => {
      const s=stateRef.current,{cam,keys}=s; const spd=.08,rot=.033;
      s.moving=false;
      if(keys.has('w')||keys.has('arrowup'))   {cam.x+=Math.sin(cam.yaw)*spd;cam.z+=Math.cos(cam.yaw)*spd;s.moving=true;}
      if(keys.has('s')||keys.has('arrowdown')) {cam.x-=Math.sin(cam.yaw)*spd;cam.z-=Math.cos(cam.yaw)*spd;s.moving=true;}
      if(keys.has('a')||keys.has('arrowleft')) {cam.yaw-=rot;s.moving=true;}
      if(keys.has('d')||keys.has('arrowright')){cam.yaw+=rot;s.moving=true;}
      cam.x=Math.max(-14,Math.min(14,cam.x)); cam.z=Math.max(-14,Math.min(14,cam.z));
      if(s.moving) s.wc++;
      s.time+=.016;
      const team=teamRef.current;
      let nearest=null,minD=Infinity;
      team.forEach(m=>{const dx=m.x-cam.x,dz=m.z-cam.z,d=Math.sqrt(dx*dx+dz*dz),rz=dx*Math.sin(cam.yaw)+dz*Math.cos(cam.yaw);if(d<INTER&&rz>0&&d<minD){minD=d;nearest=m;}});
      if(String(nearest?.id)!==String(nearestRef.current?.id)){nearestRef.current=nearest;s.nearestId=nearest?String(nearest.id):null;setHint(nearest||null);}
      renderFrame(canvas,sizeRef.current.w,sizeRef.current.h,{cam,wc:s.wc,moving:s.moving,nearestId:s.nearestId,time:s.time},team);
      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);

    return ()=>{cancelAnimationFrame(rafRef.current);ro.disconnect();window.removeEventListener('keydown',onKD);window.removeEventListener('keyup',onKU);canvas.removeEventListener('mousedown',onMD);window.removeEventListener('mousemove',onMM);window.removeEventListener('mouseup',onMU);};
  }, []);

  const founders = layouted.filter(m => m.founder);
  const others   = layouted.filter(m => !m.founder);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl" style={{background:'linear-gradient(135deg,#040a1a 0%,#0d2248 55%,#1d4ed8 100%)'}}>
        <div className="absolute top-0 right-0 w-40 h-40 opacity-10" style={{background:'radial-gradient(circle,#fff 0%,transparent 70%)',transform:'translate(30%,-30%)'}}/>
        <div className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">🏔 BT Base Camp — Meet the Team</h1>
            <p className="text-blue-200 text-sm mt-0.5">Explore the camp · walk up to anyone · press E to connect</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-blue-300 text-[12px] bg-white/8 border border-white/15 px-3 py-2 rounded-xl leading-5 hidden sm:block">
              <span className="text-white/90 font-semibold">W/S</span> Move · <span className="text-white/90 font-semibold">A/D</span> Turn · <span className="text-white/90 font-semibold">drag</span> Look<br/>
              Walk up → <kbd className="bg-yellow-400 text-black rounded px-1 font-bold text-[10px]">E</kbd> to talk
            </div>
            {isAdmin && (
              <button onClick={openAdd} className="flex items-center gap-1.5 bg-white text-blue-700 hover:bg-blue-50 font-semibold text-sm px-3 py-2 rounded-xl shadow transition-colors shrink-0">
                <Plus size={15}/> Add Member
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
        <canvas ref={canvasRef} style={{display:'block',width:'100%',height:'500px',cursor:'crosshair'}}/>
        {loading && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-sm">Loading team…</div>}
        {!fromDB && !loading && isAdmin && (
          <div className="absolute top-4 right-4 bg-black/80 backdrop-blur border border-yellow-500/40 rounded-xl px-4 py-3 max-w-xs">
            <p className="text-yellow-300 text-xs font-semibold mb-2">Team not yet saved to database</p>
            <button onClick={seedDefaults} className="w-full text-xs bg-yellow-400 hover:bg-yellow-300 text-black font-bold py-1.5 rounded-lg transition-colors">
              Initialise default team →
            </button>
          </div>
        )}
        {hint && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-72 bg-black/88 backdrop-blur-md border border-white/20 rounded-2xl px-4 py-3 text-center shadow-xl">
            <p className="text-white font-bold text-base leading-tight">{hint.name}</p>
            <p className="text-blue-300 text-xs mt-0.5">{hint.role}</p>
            <div className="mt-2 bg-amber-900/40 border border-amber-600/30 rounded-xl px-3 py-1.5">
              <p className="text-[10px] font-semibold text-amber-300 uppercase tracking-wide mb-0.5">Reach out for</p>
              <p className="text-xs text-amber-100 leading-snug">{hint.reach}</p>
            </div>
            <p className="mt-2 text-white/40 text-[11px]">Press <kbd className="bg-yellow-400 text-black rounded px-1.5 py-0.5 font-bold text-[10px]">E</kbd> for full profile</p>
          </div>
        )}
      </div>

      {/* Quick-access cards */}
      {founders.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-0.5">Leadership</p>
          <div className="grid grid-cols-3 gap-2.5">
            {founders.map(m => (
              <div key={m.id} className="bg-white rounded-xl border-2 p-3 flex items-center gap-2.5 group" style={{borderColor:m.color+'55'}}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 shadow" style={{background:`linear-gradient(135deg,${m.color},${m.hatColor})`}}>{m.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <button onClick={()=>setDialog(m)} className="text-sm font-bold text-slate-900 truncate block w-full text-left hover:text-blue-600">{m.name}</button>
                  <p className="text-[11px] text-slate-400 truncate">{m.role}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>openEdit(m)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit size={11}/></button>
                    <button onClick={()=>setDelConfirm(m)} className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={11}/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {others.length > 0 && (
        <>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-0.5">Team</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {others.map(m => (
              <div key={m.id} className="bg-white rounded-xl border border-slate-100 p-2.5 flex items-center gap-2 group hover:shadow-sm transition-all">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{background:`linear-gradient(135deg,${m.color},${m.hatColor})`}}>{m.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <button onClick={()=>setDialog(m)} className="text-xs font-semibold text-slate-900 truncate block w-full text-left hover:text-blue-600">{m.name}</button>
                  <p className="text-[10px] text-slate-400 truncate">{m.role}</p>
                </div>
                {isAdmin && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>openEdit(m)} className="w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-blue-500"><Edit size={10}/></button>
                    <button onClick={()=>setDelConfirm(m)} className="w-5 h-5 rounded flex items-center justify-center text-slate-300 hover:text-red-500"><Trash2 size={10}/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {layouted.length === 0 && !loading && (
        <div className="text-center py-12 text-slate-400">
          <p className="font-medium">No team members yet</p>
          {isAdmin && <button onClick={openAdd} className="mt-2 text-sm text-blue-500 hover:text-blue-700 underline">Add the first member</button>}
        </div>
      )}

      {/* ── Admin Add/Edit Dialog ─────────────────────────────────────────── */}
      {adminOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={e=>{if(e.target===e.currentTarget){setAdminOpen(false);setEditing(null);}}}>
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-base">{editingMember ? 'Edit Member' : 'Add New Member'}</h3>
              <button onClick={()=>{setAdminOpen(false);setEditing(null);}} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200"><X size={14}/></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Name + Role */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Name *</label>
                  <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Creative Role *</label>
                  <input required value={form.role} onChange={e=>setForm({...form,role:e.target.value})} placeholder="e.g. Summit Commander" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"/>
                </div>
              </div>
              {/* Title + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Job Title</label>
                  <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="e.g. CEO & Social Media Head" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"/>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Phone</label>
                  <input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="10-digit number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"/>
                </div>
              </div>
              {/* Reports to + Founder */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Reports To</label>
                  <select value={form.reportsTo} onChange={e=>setForm({...form,reportsTo:e.target.value})} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100">
                    <option value="">— None / Independent —</option>
                    {layouted.filter(m=>m.id!==editingMember?.id).map(m=><option key={m.id} value={m.name}>{m.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.founder} onChange={e=>setForm({...form,founder:e.target.checked})} className="w-4 h-4 rounded accent-blue-600"/>
                    <span className="text-sm text-slate-700 font-medium">Mark as Leadership</span>
                  </label>
                </div>
              </div>
              {/* Colour picker */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-2">Character Colour</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(COLORS).map(([key,val]) => (
                    <button key={key} type="button" onClick={()=>setForm({...form,colorKey:key})}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${form.colorKey===key?'border-slate-900 scale-110':'border-transparent'}`}
                      style={{background:`linear-gradient(135deg,${val.color},${val.hatColor})`}} title={key}/>
                  ))}
                </div>
              </div>
              {/* Bio */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Bio</label>
                <textarea value={form.bio} onChange={e=>setForm({...form,bio:e.target.value})} rows={2} placeholder="Short description of this person's role…" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"/>
              </div>
              {/* Manages */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Manages</label>
                <ManagesList items={form.manages} onChange={v=>setForm({...form,manages:v})}/>
              </div>
              {/* Reach out for */}
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1">Reach Out For</label>
                <textarea value={form.reach} onChange={e=>setForm({...form,reach:e.target.value})} rows={2} placeholder="What should teammates contact this person for?" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"/>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors">
                  {editingMember ? 'Save Changes' : 'Add Member'}
                </button>
                <button type="button" onClick={()=>{setAdminOpen(false);setEditing(null);}} className="px-5 text-sm border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ────────────────────────────────────────────────── */}
      {delConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center shrink-0"><AlertTriangle size={22} className="text-red-600"/></div>
              <div><h3 className="font-bold text-slate-900">Remove Team Member</h3><p className="text-xs text-slate-400 mt-0.5">This cannot be undone</p></div>
            </div>
            <p className="text-sm text-slate-600 mb-5">Remove <span className="font-semibold text-slate-900">{delConfirm.name}</span> ({delConfirm.role}) from the team?</p>
            <div className="flex gap-3">
              <button onClick={()=>setDelConfirm(null)} className="flex-1 border border-slate-200 rounded-xl text-sm py-2.5 text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
              <button onClick={handleDelete} className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm py-2.5 rounded-xl transition-colors flex items-center justify-center gap-1.5"><Trash2 size={14}/> Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Member detail dialog ──────────────────────────────────────────── */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm" onClick={e=>{if(e.target===e.currentTarget)setDialog(null);}}>
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3.5" style={{background:`linear-gradient(135deg,${dialog.hatColor} 0%,${dialog.bodyColor} 100%)`}}>
              <div className="w-14 h-14 rounded-2xl border-2 border-white/30 flex items-center justify-center text-white text-2xl font-bold shadow" style={{background:`linear-gradient(135deg,${dialog.color},${dialog.bodyColor})`}}>{dialog.name.charAt(0)}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-bold text-lg leading-tight">{dialog.name}</h3>
                <p className="text-white/85 text-sm font-medium">{dialog.role}</p>
                <p className="text-white/55 text-xs mt-0.5">{dialog.title}</p>
              </div>
              <div className="flex items-center gap-1.5">
                {isAdmin && (
                  <>
                    <button onClick={()=>{setDialog(null);openEdit(dialog);}} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/35 transition-colors"><Edit size={13}/></button>
                    <button onClick={()=>{setDelConfirm(dialog);}} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-red-400/60 transition-colors"><Trash2 size={13}/></button>
                  </>
                )}
                <button onClick={()=>setDialog(null)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/35 transition-colors"><X size={15}/></button>
              </div>
            </div>
            <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wide mb-1">📋 Reach out for</p>
                <p className="text-sm text-amber-800 leading-snug">{dialog.reach}</p>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">{dialog.bio}</p>
              {dialog.manages?.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Manages</p>
                  <ul className="space-y-1.5">
                    {dialog.manages.map((item,i)=>(
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-1.5" style={{background:dialog.color}}/>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {dialog.reportsTo && (
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs text-slate-500">
                  <MapPin size={11} className="text-slate-400 shrink-0"/>
                  Reports to: <span className="font-semibold text-slate-700 ml-1">{dialog.reportsTo}</span>
                </div>
              )}
              {dialog.phone && (
                <a href={`tel:${dialog.phone}`} className="flex items-center justify-center gap-2.5 text-white rounded-xl px-4 py-3 font-semibold text-sm hover:opacity-90 transition-opacity shadow" style={{background:`linear-gradient(135deg,${dialog.bodyColor},${dialog.hatColor})`}}>
                  <Phone size={15}/> Call {dialog.name.split(' ')[0]} · {dialog.phone}
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeetTheTeam;
