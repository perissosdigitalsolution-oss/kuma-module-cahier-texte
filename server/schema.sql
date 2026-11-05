-- KUMA Module: Cahier de Texte — Tables autonomes

CREATE TABLE IF NOT EXISTS mod_lesson_plans (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    teacher_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    week_number INTEGER NOT NULL,
    day_of_week INTEGER CHECK(day_of_week BETWEEN 1 AND 7),
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'published', 'archived')),
    validated_by TEXT,
    validated_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mod_plans_teacher ON mod_lesson_plans(teacher_id);
CREATE INDEX idx_mod_plans_class ON mod_lesson_plans(class_id);
CREATE INDEX idx_mod_plans_subject ON mod_lesson_plans(subject);

CREATE TABLE IF NOT EXISTS mod_lesson_materials (
    id TEXT PRIMARY KEY,
    lesson_plan_id TEXT NOT NULL REFERENCES mod_lesson_plans(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('video', 'document', 'link', 'exercise', 'quiz')),
    title TEXT NOT NULL,
    url TEXT,
    file_path TEXT,
    duration_minutes INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mod_lesson_status (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL,
    lesson_plan_id TEXT NOT NULL REFERENCES mod_lesson_plans(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'skipped')),
    completed_at TEXT,
    notes TEXT,
    UNIQUE(student_id, lesson_plan_id)
);
CREATE UNIQUE INDEX idx_mod_status_student_lesson ON mod_lesson_status(student_id, lesson_plan_id);

CREATE TABLE IF NOT EXISTS mod_lesson_activity_log (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    user_id TEXT,
    action TEXT NOT NULL,
    details TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_mod_cahier_activity_timestamp ON mod_lesson_activity_log(timestamp);