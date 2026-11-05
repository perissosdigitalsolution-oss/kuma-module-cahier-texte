const API = (typeof window !== 'undefined' && !['localhost','127.0.0.1'].includes(window.location.hostname) && !window.location.hostname.startsWith('192.168.') && !window.location.hostname.startsWith('10.'))
    ? 'https://kuma-school-backend-production.kumaschool88.workers.dev/api/v1/modules/lessons'
    : '/api/v1/modules/lessons';
export const LessonService = {
    async createPlan(data: { teacherId: string; classId: string; subject: string; title: string; description?: string; weekNumber: number; dayOfWeek?: number }) {
        const r = await fetch(`${API}/plan`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken')||''}` }, body: JSON.stringify(data) });
        return r.json();
    },
    async getPlans(filters?: { class?: string; teacher?: string }) {
        const q = new URLSearchParams(Object.entries(filters || {}).filter(([,v]) => v));
        const r = await fetch(`${API}/plans?${q}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')||''}` } });
        return r.json();
    },
    async getSummary(classId: string) {
        const r = await fetch(`${API}/summary/${classId}`, { headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')||''}` } });
        const d = await r.json(); return d.success ? d.summary : [];
    }
};