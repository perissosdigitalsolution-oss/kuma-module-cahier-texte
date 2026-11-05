// ============================================================================
// KUMA Module: Cahier de Texte — Hono sub-app (mountable, self-contained).
//
// Embedded mode (host worker):
//   import { createLessonModule } from '../../modules/cahier-texte/server/lessonModule';
//   app.route('/api/v1/modules/lessons', createLessonModule());
//
// Standalone mode: server/standalone/index.ts mounts the SAME factory.
// Only external dependency: hono (peer dependency of the module).
// ============================================================================
import { Hono, type Context } from 'hono';

const ALLOWED_ROLES = new Set([
    'admin', 'director', 'directeur', 'directrice', 'founder', 'fondatrice',
    'manager', 'gestionnaire', 'teacher', 'enseignant',
]);

/** Minimal D1 surface used by the module (works with Cloudflare D1). */
export interface ModuleDB {
    prepare(sql: string): {
        bind(...vals: unknown[]): {
            first<T = Record<string, unknown>>(): Promise<T | null>;
            all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
            run(): Promise<unknown>;
        };
        first<T = Record<string, unknown>>(): Promise<T | null>;
        all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
    batch(stmts: unknown[]): Promise<unknown>;
}

interface ModPayload { sub?: string; role?: string; schoolId?: string; tenantId?: string; email?: string }

export type ModEnv = {
    Bindings: { DB: ModuleDB; [k: string]: unknown };
    Variables: { tenantId: string; jwtPayload: ModPayload | null };
};

type ModContext = Context<ModEnv>;

function resolveContext(c: ModContext): { tenantId: string; role: string; userId: string } {
    const payload = (c.get('jwtPayload') || {}) as ModPayload;
    const tenantId = String(c.get('tenantId') || payload.schoolId || payload.tenantId || 'default');
    return { tenantId, role: String(payload.role || '').toLowerCase(), userId: String(payload.sub || '') };
}

function genId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

const MATERIAL_TYPES = ['video', 'document', 'link', 'exercise', 'quiz'] as const;

export function createLessonModule() {
    const app = new Hono<ModEnv>();

    // ── GET /v1/health — unauthenticated capability probe ───────────────────
    app.get('/v1/health', (c: ModContext) => c.json({
        module: 'kuma-module-cahier-texte',
        version: '1.0.0',
        status: 'ready',
        capabilities: ['lesson-plans', 'materials', 'student-tracking', 'class-summary'],
        time: new Date().toISOString(),
    }));

    // ── POST /v1/plan — create a lesson plan (staff only) ───────────────────
    app.post('/v1/plan', async (c: ModContext) => {
        try {
            const { tenantId, role, userId } = resolveContext(c);
            if (!ALLOWED_ROLES.has(role)) return c.json({ error: 'Forbidden' }, 403);

            const body = await c.req.json<{
                teacherId?: string; classId: string; subject: string; title: string;
                description?: string; weekNumber: number; dayOfWeek?: number;
            }>();
            if (!body.classId || !body.subject || !body.title || !body.weekNumber) {
                return c.json({ error: 'classId, subject, title and weekNumber are required' }, 400);
            }
            if (body.dayOfWeek !== undefined && (body.dayOfWeek < 1 || body.dayOfWeek > 7)) {
                return c.json({ error: 'dayOfWeek must be 1-7' }, 400);
            }

            const planId = genId('plan');
            const now = new Date().toISOString();
            await c.env.DB.prepare(`
                INSERT INTO mod_lesson_plans (id, school_id, teacher_id, class_id, subject, title, description, week_number, day_of_week, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
            `).bind(
                planId, tenantId, userId, body.classId, body.subject, body.title,
                body.description || null, body.weekNumber, body.dayOfWeek ?? null, now, now
            ).run();

            return c.json({ success: true, planId }, 201);
        } catch (e) {
            console.error('[lesson-module] plan error:', e);
            return c.json({ error: 'Failed to create lesson plan' }, 500);
        }
    });

    // ── GET /v1/plans?class=&teacher=&week= ─────────────────────────────────
    app.get('/v1/plans', async (c: ModContext) => {
        try {
            const { tenantId } = resolveContext(c);
            const classId = c.req.query('class');
            const teacherId = c.req.query('teacher');
            const week = c.req.query('week');

            let sql = 'SELECT * FROM mod_lesson_plans WHERE school_id = ? AND status = \'published\'';
            const binds: unknown[] = [tenantId];
            if (classId) { sql += ' AND class_id = ?'; binds.push(classId); }
            if (teacherId) { sql += ' AND teacher_id = ?'; binds.push(teacherId); }
            if (week) { sql += ' AND week_number = ?'; binds.push(Number(week)); }
            sql += ' ORDER BY week_number, day_of_week, created_at DESC LIMIT 200';

            const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
            return c.json({ success: true, plans: results || [] });
        } catch (e) {
            console.error('[lesson-module] plans error:', e);
            return c.json({ error: 'Failed to fetch plans' }, 500);
        }
    });

    // ── POST /v1/material — attach a teaching resource (staff only) ─────────
    app.post('/v1/material', async (c: ModContext) => {
        try {
            const { tenantId, role } = resolveContext(c);
            if (!ALLOWED_ROLES.has(role)) return c.json({ error: 'Forbidden' }, 403);

            const body = await c.req.json<{ lessonPlanId: string; type: string; title: string; url?: string; durationMinutes?: number }>();
            if (!body.lessonPlanId || !body.title || !MATERIAL_TYPES.includes(body.type as typeof MATERIAL_TYPES[number])) {
                return c.json({ error: 'lessonPlanId, title and a valid type (video|document|link|exercise|quiz) are required' }, 400);
            }

            // ensure the plan belongs to this school
            const plan = await c.env.DB.prepare('SELECT id FROM mod_lesson_plans WHERE id = ? AND school_id = ?')
                .bind(body.lessonPlanId, tenantId).first();
            if (!plan) return c.json({ error: 'Lesson plan not found' }, 404);

            const matId = genId('mat');
            await c.env.DB.prepare(`
                INSERT INTO mod_lesson_materials (id, lesson_plan_id, type, title, url, duration_minutes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).bind(matId, body.lessonPlanId, body.type, body.title, body.url || null, body.durationMinutes ?? null, new Date().toISOString()).run();

            return c.json({ success: true, materialId: matId }, 201);
        } catch (e) {
            console.error('[lesson-module] material error:', e);
            return c.json({ error: 'Failed to add material' }, 500);
        }
    });

    // ── POST /v1/status — mark a student's lesson tracking (staff only) ─────
    app.post('/v1/status', async (c: ModContext) => {
        try {
            const { tenantId, role } = resolveContext(c);
            if (!ALLOWED_ROLES.has(role)) return c.json({ error: 'Forbidden' }, 403);

            const body = await c.req.json<{ studentId: string; lessonPlanId: string; status: 'completed' | 'skipped' | 'pending'; notes?: string }>();
            if (!body.studentId || !body.lessonPlanId || !['completed', 'skipped', 'pending'].includes(body.status)) {
                return c.json({ error: 'studentId, lessonPlanId and status (completed|skipped|pending) are required' }, 400);
            }

            const now = new Date().toISOString();
            await c.env.DB.prepare(`
                INSERT INTO mod_lesson_status (id, student_id, lesson_plan_id, status, completed_at, notes)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(student_id, lesson_plan_id)
                DO UPDATE SET status = excluded.status, completed_at = excluded.completed_at, notes = excluded.notes
            `).bind(
                genId('status'), body.studentId, body.lessonPlanId, body.status,
                body.status === 'completed' ? now : null, body.notes || null
            ).run();

            return c.json({ success: true });
        } catch (e) {
            console.error('[lesson-module] status error:', e);
            return c.json({ error: 'Failed to update status' }, 500);
        }
    });

    // ── GET /v1/summary/:classId — per-subject coverage (plain aggregates) ──
    app.get('/v1/summary/:classId', async (c: ModContext) => {
        try {
            const { tenantId } = resolveContext(c);
            const classId = c.req.param('classId');

            const { results } = await c.env.DB.prepare(`
                SELECT
                    lp.subject,
                    COUNT(DISTINCT lp.id) AS total_plans,
                    COUNT(ls.id) AS completed_marks,
                    SUM(CASE WHEN ls.status = 'completed' THEN 1 ELSE 0 END) AS completed_count
                FROM mod_lesson_plans lp
                LEFT JOIN mod_lesson_status ls ON ls.lesson_plan_id = lp.id
                WHERE lp.school_id = ?1 AND lp.class_id = ?2 AND lp.status = 'published'
                GROUP BY lp.subject
                ORDER BY lp.subject
            `).bind(tenantId, classId).all();

            return c.json({ success: true, classId, summary: results || [] });
        } catch (e) {
            console.error('[lesson-module] summary error:', e);
            return c.json({ error: 'Failed to fetch summary' }, 500);
        }
    });

    return app;
}