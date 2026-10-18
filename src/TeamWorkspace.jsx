import React from 'react';
import {createClient} from '@supabase/supabase-js';
import './team-workspace.css';
const endpoint=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
const db=endpoint&&key?createClient(endpoint,key):null;
const required=['altar / picture','lamps and wicks','books','Zoom assistance','accessibility support','other'];
const fmtDate=v=>v?new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'Europe/London'}).format(new Date(v.length===10?v+'T12:00:00Z':v)):'—';
export default function TeamWorkspace({isAdmin=false,isManager=false}){
 const [data,setData]=React.useState(null),[notice,setNotice]=React.useState(''),[busy,setBusy]=React.useState(false);
 const [team,setTeam]=React.useState(''),[task,setTask]=React.useState(''),[registration,setRegistration]=React.useState(''),[member,setMember]=React.useState('');
 const [due,setDue]=React.useState(''),[role,setRole]=React.useState('member'),[enabled,setEnabled]=React.useState(true);
 const [status,setStatus]=React.useState('pending'),[outcome,setOutcome]=React.useState(''),[requirements,setRequirements]=React.useState([]),[comment,setComment]=React.useState('');
 const [search,setSearch]=React.useState('');
 const load=React.useCallback(async()=>{
   if(!db)return;
   const {data:result,error}=await db.rpc('team_workspace_data');
   if(error){setNotice(error.message);return;}
   setData(result);
 },[]);
 React.useEffect(()=>{load();},[load]);
 const run=async(fn,args)=>{
   setBusy(true);setNotice('');
   try{const {error}=await db.rpc(fn,args);if(error)throw error;
     setNotice('Saved successfully.');await load();
   }catch(e){setNotice(e.message||'Unable to save changes.');}
   finally{setBusy(false);}
 };
 const teamRows=data?.teams||[],memberships=data?.memberships||[],users=data?.users||[],registrations=data?.registrations||[],tasks=data?.tasks||[],comments=data?.comments||[];
 const selectedTeam=team||teamRows[0]?.id||'';
 const teamTasks=tasks.filter(t=>t.team_id===selectedTeam && [t.status,t.outcome,registrations.find(r=>r.id===t.registration_id)?.reference,registrations.find(r=>r.id===t.registration_id)?.host_name].join(' ').toLowerCase().includes(search.toLowerCase()));
 const selectedTask=tasks.find(t=>t.id===task);
 const canAssign=isManager||memberships.some(m=>m.team_id===selectedTeam&&m.responsibility==='lead'&&m.active);
 const filteredMembers=memberships.filter(m=>m.team_id===selectedTeam&&m.active).map(m=>({ ...m, name:users.find(u=>u.id===m.user_id)?.full_name||m.user_id}));
 React.useEffect(()=>{
   if(selectedTask){setStatus(selectedTask.status);setOutcome(selectedTask.outcome||'');setRequirements(selectedTask.requirements||[]);setComment('');}
 },[selectedTask?.id]);
 if(!db)return <p>Supabase is not configured.</p>;
 return <section className="team-workspace"><div className="team-heading"><div><h2>Seva Team Coordination</h2><p>Shared task queues, call notes and follow-up history — without Google Sheets.</p></div><button type="button" className="secondary" onClick={load}>Refresh</button></div>
 {notice&&<div className="team-notice" role="status">{notice}</div>}
 {!data?<p>Loading team workspace…</p>:<>
 <div className="team-controls"><label>Seva team<select value={selectedTeam} onChange={e=>{setTeam(e.target.value);setTask('');}}>{teamRows.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Search tasks<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Host, reference, status"/></label></div>
 {isAdmin&&<section className="team-panel"><h3>Team membership</h3><p className="muted">Assign existing portal users to this team. A person can belong to multiple teams.</p>
 <div className="team-controls"><label>Devotee<select value={member} onChange={e=>setMember(e.target.value)}><option value="">Select user</option>{users.map(u=><option value={u.id} key={u.id}>{u.full_name} ({u.role})</option>)}</select></label><label>Responsibility<select value={role} onChange={e=>setRole(e.target.value)}><option value="member">Team member</option><option value="lead">Team lead</option></select></label><label className="team-toggle"><input type="checkbox" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/> Active member</label></div>
 <button type="button" disabled={busy||!member||!selectedTeam} onClick={()=>run('team_manage_member',{p_team:selectedTeam,p_user:member,p_responsibility:role,p_active:enabled})}>Save membership</button>
 <div className="team-member-chips">{filteredMembers.map(m=><span key={m.user_id}>{m.name} · {m.responsibility}</span>)}</div></section>}
 {canAssign&&<section className="team-panel"><h3>Assign a communication or follow-up task</h3><div className="team-controls">
 <label>Registration<select value={registration} onChange={e=>setRegistration(e.target.value)}><option value="">Select registration</option>{registrations.map(r=><option key={r.id} value={r.id}>{r.reference} · {r.host_name} · {r.city}</option>)}</select></label>
 <label>Assign to<select value={member} onChange={e=>setMember(e.target.value)}><option value="">Unassigned queue</option>{filteredMembers.map(m=><option key={m.user_id} value={m.user_id}>{m.name}</option>)}</select></label>
 <label>Follow-up / call due<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label></div>
 <button type="button" disabled={busy||!registration||!selectedTeam} onClick={()=>run('team_assign_task',{p_registration:registration,p_team:selectedTeam,p_assignee:member||null,p_due:due?new Date(due).toISOString():null})}>Save task assignment</button></section>}
 <section className="team-panel"><h3>Team queue <span className="team-count">{teamTasks.length}</span></h3>
 <div className="team-grid">{teamTasks.map(t=>{const r=registrations.find(r=>r.id===t.registration_id);return <button type="button" key={t.id} className={'team-task'+(task===t.id?' team-selected':'')} onClick={()=>setTask(t.id)}>
 <strong>{r?.reference||'Programme request'}</strong><span>{r?.host_name||'Restricted'}</span><span>{r?.city||''} · {fmtDate(r?.preferred_date)}</span><small>{t.status.replaceAll('_',' ')} · {users.find(u=>u.id===t.assigned_to)?.full_name||'Unassigned'}</small></button>})}</div>
 {!teamTasks.length&&<p className="muted">No tasks in this queue yet.</p>}</section>
 {selectedTask&&<section className="team-panel"><h3>Update task and comments</h3>
 {(()=>{const r=registrations.find(x=>x.id===selectedTask.registration_id);return <p><strong>{r?.reference}</strong> · {r?.host_name} {r?.phone&&<> · <a href={'tel:'+r.phone}>{r.phone}</a></>}</p>})()}
 <div className="team-controls"><label>Progress<select value={status} onChange={e=>setStatus(e.target.value)}>{['pending','in_progress','waiting','completed','cancelled'].map(x=><option key={x} value={x}>{x.replaceAll('_',' ')}</option>)}</select></label>
 <label>Outcome / next step<input value={outcome} onChange={e=>setOutcome(e.target.value)} maxLength={500} placeholder="Call confirmed, call again, host feedback…"/></label></div>
 <fieldset className="team-requirements"><legend>Special requirements</legend>{required.map(q=><label key={q}><input type="checkbox" checked={requirements.includes(q)} onChange={e=>setRequirements(v=>e.target.checked?[...v,q]:v.filter(x=>x!==q))}/>{q}</label>)}</fieldset>
 <label className="team-comment">Add dated comment<textarea rows={3} maxLength={2000} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Call notes, arrangements or follow-up feedback"/></label>
 <button type="button" disabled={busy} onClick={()=>run('team_update_task',{p_task:selectedTask.id,p_status:status,p_outcome:outcome,p_requirements:requirements,p_comment:comment})}>Save task update</button>
 <h4>Activity history</h4><div className="team-history">{comments.filter(c=>c.task_id===selectedTask.id).sort((a,b)=>a.created_at.localeCompare(b.created_at)).map(c=><div key={c.id}><strong>{c.author}</strong> <small>{fmtDate(c.created_at)}</small><p>{c.comment}</p></div>)}</div></section>}
 </>}</section>;
}
