import React from 'react';
import { LessonService } from './lesson.service';

export default function LessonPlanTracker({ lang = 'fr' }) {
    const [loading, setLoading] = React.useState(false);
    const [message, setMessage] = React.useState(null);
    const [summary, setSummary] = React.useState([]);

    React.useEffect(() => {
        LessonService.getSummary('class_001').then(setSummary).catch(() => {});
    }, []);

    const handleAddPlan = async () => {
        const title = prompt(lang === 'fr' ? 'Titre du cours:' : 'Lesson title:');
        if (!title) return;
        setLoading(true);
        try {
            await LessonService.createPlan({ teacherId: 'teacher_1', classId: 'class_001', subject: 'Mathématiques', title, description: '', weekNumber: 1 });
            setMessage(lang === 'fr' ? 'Plan ajouté' : 'Lesson added');
        } catch(e) { setMessage(lang === 'fr' ? 'Erreur' : 'Error'); }
        setLoading(false);
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow">
            <h2 className="text-xl font-bold mb-4">{lang === 'fr' ? 'Cahier de Texte' : 'Lesson Plans'}</h2>
            {message && <div className="mb-4 p-3 rounded bg-blue-50">{message}</div>}
            {loading ? <p>{lang === 'fr' ? 'Chargement...' : 'Loading...'}</p> :
             <div className="grid gap-3 mb-4">
                {summary.map((s: any) => <div key={s.subject} className="p-3 bg-slate-50 rounded">
                    <div className="font-medium">{s.subject}</div>
                    <div className="text-xs">{s.total_plans} plans, {s.avg_completion}% complété</div>
                </div>)}
             </div>}
            <button onClick={handleAddPlan} className="px-4 py-2 bg-green-600 text-white rounded">
                {lang === 'fr' ? 'Ajouter Cours' : 'Add Lesson'}
            </button>
        </div>
    );
}