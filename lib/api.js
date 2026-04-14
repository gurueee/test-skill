import { supabase } from './supabase';

// ── SEARCH (homepage) ─────────────────────────────────────────────────────────
export async function searchAll(query) {
  const q = query.trim();
  if (!q) return { skills: [], glossary: [], jd: [] };
  const [s, g, j] = await Promise.all([
    supabase.from('skills').select('id,skill_name').ilike('skill_name', `%${q}%`).limit(10),
    supabase.from('glossary').select('id,term,full_form,definition,domain,related_skills')
      .or(`term.ilike.%${q}%,definition.ilike.%${q}%`).limit(10),
    supabase.from('job_descriptions').select('id,title,department,sub_dept,content')
      .or(`title.ilike.%${q}%,department.ilike.%${q}%`).limit(10),
  ]);
  return { skills: s.data||[], glossary: g.data||[], jd: j.data||[] };
}

// ── SKILL MATRIX ──────────────────────────────────────────────────────────────
export async function getAllFunctions() {
  const { data, error } = await supabase
    .from('employees')
    .select('id,bu,function_name,leader,employee_skills(skills(skill_name))')
    .order('bu').order('function_name');
  if (error) throw error;
  return data || [];
}

export async function searchFunctions(query) {
  const q = query.trim();
  if (!q) return getAllFunctions();

  // Step 1: find skill IDs that match the query
  const { data: matchedSkills } = await supabase
    .from('skills')
    .select('id')
    .ilike('skill_name', `%${q}%`);

  const skillIds = (matchedSkills||[]).map(s => s.id);

  // Step 2: find emp_ids that have those skills
  let empIdsFromSkills = [];
  if (skillIds.length > 0) {
    const { data: esRows } = await supabase
      .from('employee_skills')
      .select('emp_id')
      .in('skill_id', skillIds);
    empIdsFromSkills = [...new Set((esRows||[]).map(r => r.emp_id))];
  }

  // Step 3: fetch employees matching by function/leader/bu OR by skill
  const queries = [];

  // Match by function name, leader, or BU
  queries.push(
    supabase.from('employees')
      .select('id,bu,function_name,leader,employee_skills(skills(skill_name))')
      .or(`function_name.ilike.%${q}%,leader.ilike.%${q}%,bu.ilike.%${q}%`)
      .order('bu')
  );

  // Match by skill (only if we found skill matches)
  if (empIdsFromSkills.length > 0) {
    queries.push(
      supabase.from('employees')
        .select('id,bu,function_name,leader,employee_skills(skills(skill_name))')
        .in('id', empIdsFromSkills)
        .order('bu')
    );
  }

  const results = await Promise.all(queries);
  const map = new Map();
  results.forEach(res => {
    (res.data||[]).forEach(e => map.set(e.id, e));
  });

  return [...map.values()];
}

// ── GLOSSARY ──────────────────────────────────────────────────────────────────
export async function getGlossary({ search = '', domain = '' } = {}) {
  let q = supabase.from('glossary').select('*').order('term');
  if (search) q = q.or(`term.ilike.%${search}%,definition.ilike.%${search}%`);
  if (domain) q = q.ilike('domain', `%${domain}%`);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return data || [];
}

// ── JD ────────────────────────────────────────────────────────────────────────
export async function getJDs({ dept = '', title = '', offset = 0 } = {}) {
  let q = supabase.from('job_descriptions')
    .select('id,title,department,sub_dept,content')
    .order('department').order('title')
    .range(offset, offset + 19);
  if (dept)  q = q.ilike('department', `%${dept}%`);
  if (title) q = q.ilike('title', `%${title}%`);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function countJDs({ dept = '', title = '' } = {}) {
  let q = supabase.from('job_descriptions').select('id', { count:'exact', head:true });
  if (dept)  q = q.ilike('department', `%${dept}%`);
  if (title) q = q.ilike('title', `%${title}%`);
  const { count } = await q;
  return count || 0;
}
