# AGI OS — الخطة التنفيذية لمعالجة كل مشاكل جاهزية الإنتاج

**المصدر:** تقرير تحليل الجاهزية على الالتزام `7a60d85`
**الفرع:** `arena/01a09b28-agi-system`
**الحالة:** 🔄 قيد التنفيذ — المرحلة 0 مغلقة جزئيًا، والمرحلة 1 مغلقة في بنود الأمن الحرجة (P1.1–P1.4, P1.9, P1.10)

---

## مبادئ التنفيذ

1. **لا ادعاءات بلا قياس.** كل بند يُغلق فقط بعد إثباته بأمر يُنفَّذ (بناء / اختبار / PoC).
2. **لا تبعيات جديدة ثقيلة** إلا عند الضرورة الأمنية القصوى — الحلول المعتمدة على Node المدمج (`node:vm`, `node:worker_threads`, `node:http`, `node:child_process`) أولًا.
3. **Fail-Closed.** أي غموض في القرار الأمني → رفض، لا سماح.
4. **لا محاكاة تُرجع نجاحًا مُختلَقًا.** إما تنفيذ حقيقي أو نقل صريح إلى `simulation/` مع تسمية واضحة.
5. **ترتيب صارم:** البناء يجب أن ينجح قبل أي شيء آخر، وCI يجب أن يوجد قبل أي إصلاح آخر حتى لا يتكرر الانكسار.

---

## المرحلة 0 — أوقف النزيف (بناء + CI + مصداقية)

| # | المهمة | الدليل المطلوب | الحالة |
|---|--------|----------------|--------|
| P0.1 | إضافة `@types/node` إلى `monitoring`, `io-github`, `cli`, `github-agent` | `pnpm -r build` ينجح 58/58 | ✅ |
| P0.2 | إصلاح أي أخطاء تصريف متبقية في الحزم الأربع | `pnpm -r typecheck` ينجح | ✅ |
| P0.3 | إنشاء `.github/workflows/ci.yml`: install → typecheck → build → test → audit → docker build | ملف موجود ويعمل محليًا بنفس الخطوات | ✅ |
| P0.4 | سكربت `verify` موحّد في الجذر + `--no-bail` حتى لا يُخفي الفشل الأول بقية النتائج | `pnpm verify` ينفذ السلسلة كاملة | ✅ |
| P0.5 | تصحيح README: الأرقام الحقيقية + خطوات تشغيل صحيحة (`install → build → test`) + شارة حالة صادقة | لا رقم في README غير قابل للقياس | ⬜ |
| P0.6 | `CHANGELOG.md` + توحيد الإصدارات (جذر/حزم/رسالة الالتزام) | إصدار واحد متسق | ⬜ |

**معيار إغلاق المرحلة 0:** استنساخ نظيف → `pnpm install && pnpm verify` → نجاح كامل بدون تدخل يدوي.

---

## المرحلة 1 — الأمن (شرط إطلاق، لا يمكن تجاوزه)

| # | المهمة | الدليل المطلوب | الحالة |
|---|--------|----------------|--------|
| P1.1 | **عزل حقيقي للـ Sandbox**: استبدال `new Function` بـ `node:vm` + سياق مُجمَّد بلا globals للمضيف + `timeout` فعلي + مُنفِّذ اختياري عبر `worker_threads` مع `resourceLimits` (سقف ذاكرة حقيقي) | PoC القديم (`this.constructor.constructor("return process")().env`) → **مرفوض** | ✅ |
| P1.2 | **توحيد أسماء الوحدات**: خريطة `SkillCategory → GovernanceModule` و`skillId → operation` في `skill-executor` | `filesystem.read` على `/etc/passwd` → `BLOCK/POL-001` | ✅ |
| P1.3 | **توصيل Risk Override + Fail-Closed**: القرار النهائي = الأشد بين السياسة والمخاطرة؛ غياب قاعدة مطابقة لعمليات write/exec/delete → رفض أو موافقة، لا سماح | اختبار تكامل عبر `SkillRunner` الحقيقي | ✅ |
| P1.4 | **تطبيق `allowedScopes`** قبل `handler.execute` + إصلاح `PathGuard.isWithinScope` (قائمة فارغة = رفض، ومقارنة بفاصل المسار بعد `resolve`) | `/sandbox-evil` خارج `/sandbox` | ✅ |
| P1.5 | **إصلاح `FileBackend`**: تطبيع + احتواء داخل `basePath` + تحقق `missionId` بـ `^[A-Za-z0-9_.-]+$` ورفض `..` | PoC العبور المساري → مرفوض | ⬜ |
| P1.6 | **مهارات الملفات الحقيقية** (`real-skills`): احتواء داخل `workingDir` ورفض الروابط الرمزية الخارجة | قراءة `/etc/passwd` عبر المهارة → مرفوضة | ⬜ |
| P1.7 | **تقسية `api-server`**: `crypto.timingSafeEqual` للمفاتيح، عدم تسريب `error.message`، Rate Limiting، حد لحجم الجسم، CORS مطبَّق فعلًا | اختبارات لكل بند | ⬜ |
| P1.8 | **`DependencyAuditor` حقيقي**: قراءة `pnpm audit --json` / OSV بدل قائمة الـ 3 مداخل | يكتشف الـ 4 Critical الحالية | ⬜ |
| P1.9 | **معالجة ثغرات التبعيات**: `next`, `vitest`, `vite`, `postcss`, `esbuild` | `pnpm audit --audit-level=high` → 0 | ✅ |
| P1.10 | **اختبارات خصومية مستقلة** لا تُشتق من نفس قوائم المصدر (حمولات مولَّدة + تحوّلات التعتيم) | مجموعة جديدة في `sandbox-adversarial` | ✅ |
| P1.11 | تقسية Docker: `USER node`، deps إنتاج فقط، تثبيت إصدار pnpm، healthchecks بلا `curl` | `docker build` ينجح ويعمل بغير root | ⬜ |

**معيار إغلاق المرحلة 1:** كل PoC في تقرير الجاهزية يفشل (يُرفض)، و`pnpm audit` نظيف على مستوى high فأعلى.

---

## المرحلة 2 — اجعله يعمل فعلًا

| # | المهمة | الدليل المطلوب | الحالة |
|---|--------|----------------|--------|
| P2.1 | **خادم HTTP حقيقي** في `api-server` باستخدام `node:http` (بلا تبعيات): `listen({host:'0.0.0.0'})` + `/api/health`, `/api/ready`, `/metrics` | `curl localhost:PORT/api/health` → 200 | ⬜ |
| P2.2 | **`packages/runtime`**: نقطة تجميع (Composition Root) تربط kernel+governance+providers+memory+cognition+missions+tools وتُغذّي `EventLoop` الحقيقي، مع إيقاف رشيق على `SIGTERM/SIGINT` | `node dist/main.js` يشغّل حلقة حقيقية | ⬜ |
| P2.3 | **`TerminalExecutor` حقيقي**: `execFile` (لا `exec` بسلسلة) + مهلة + `cwd` مقيَّد + التقاط stdout/stderr فعلي | أمر حقيقي يعيد ناتجًا حقيقيًا | ⬜ |
| P2.4 | **`DeploymentManager`**: تنفيذ حقيقي عبر `docker`/`kubectl` مع كشف غيابهما، أو نقل صريح إلى `simulation/` | لا `status:'running'` مُختلَق | ⬜ |
| P2.5 | **`CanaryRunner`/`ChaosEngine`**: قياس حقيقي (نداءات فعلية + حقن أعطال فعلي) أو نقل إلى `simulation/` | لا `Math.random()` ولا `safetyIncidents=0` ثابت | ⬜ |
| P2.6 | **حدود الذاكرة**: حلقات محدودة (ring buffer) في `EventLoop.results`, `AuditLedger`, `VectorEngine.documents`, و`results` في security-gates/production-ops | اختبار يثبت الحد الأقصى | ⬜ |
| P2.7 | **تخزين دائم للمتجهات** + تضمين دلالي حقيقي محلي (Ollama `nomic-embed-text` = $0) مع إبقاء المحرك الحالي كخيار fallback | حفظ/تحميل يعمل عبر إعادة التشغيل | ⬜ |
| P2.8 | **لوحة العرض**: استبدال `seedDemoData()` بنداءات API حقيقية عبر مسارات Next.js (proxy) | لا بيانات ثابتة في الإنتاج | ⬜ |
| P2.9 | **`CostGuard`**: مطابقة لاحقة (post-hoc) بالتوكنز الفعلية من رد المزوّد + إنذار عند أي انحراف | تكلفة محسوبة من `usage` لا من تقدير المستدعي | ⬜ |

**معيار إغلاق المرحلة 2:** `docker compose up` يُنتج نظامًا يعمل فعليًا ويجيب على `/api/health`، والوكيل ينفّذ مهمة حقيقية من طرف إلى طرف.

---

## المرحلة 3 — النضج الإنتاجي

| # | المهمة | الحالة |
|---|--------|--------|
| P3.1 | ESLint + Prettier config على مستوى الجذر + تفعيل `lint` في 58/58 حزمة | ✅ |
| P3.2 | عتبات تغطية (coverage thresholds) + تقرير موحّد | ⬜ |
| P3.3 | اختبارات تكامل ضد Ollama حقيقي + E2E لمهمة كاملة + اختبار حمل/استمرار | ⬜ |
| P3.4 | `SECURITY.md` (سياسة إفصاح) + `CONTRIBUTING.md` + `CODEOWNERS` + قوالب PR/Issue | ⬜ |
| P3.5 | وسوم إصدار دلالي (semver tags) + Releases + سياسة تراجع (rollback) | ⬜ |
| P3.6 | مراقبة: إصلاح `PrometheusExporter` + `/metrics` + سجلات مهيكلة (pino) مع **حجب الأسرار** + تتبع أخطاء | ⬜ |
| P3.7 | K8s: مجسات تتطابق مع الخادم الحقيقي، `securityContext` (non-root, read-only FS, drop capabilities), `resources`, `NetworkPolicy`, تثبيت إصدارات الصور | ⬜ |
| P3.8 | خزنة أسرار حقيقية (تشفير أثناء السكون / KMS) بدل الذاكرة | ⬜ |

---

## أولوية التنفيذ الفعلية (ما سيُنفَّذ الآن)

```
P0.1 → P0.2 → P0.3 → P0.4      (البناء + CI: يفتح كل شيء آخر)
   ↓
P1.1 (العزل) → P1.2/P1.3 (الحوكمة) → P1.4/P1.5/P1.6 (المسارات)
   ↓
P1.7 (api-server) → P1.8/P1.9 (التبعيات) → P1.10 (اختبارات خصومية) → P1.11 (Docker)
   ↓
P2.1 (خادم HTTP) → P2.2 (نقطة التجميع) → P2.3 (الطرفية) → P2.6 (الذاكرة)
   ↓
الباقي حسب الجدول
```

## سجل التنفيذ

| التاريخ | البند | التغيير | الدليل |
|---------|-------|---------|--------|
| 2026-09-13 | P0.1–P0.2 | إضافة `@types/node` للحزم التي تستورد `node:` builtins وإصلاح أخطاء التصريف | `pnpm -r build` → 58/58، `pnpm -r typecheck` → 0 أخطاء |
| 2026-09-13 | P0.3 | إنشاء `.github/workflows/ci.yml` بتسع وظائف: install, typecheck, build, test, lint, security, security-poc, hygiene, docker + بوابة `ci-passed` | الملف موجود؛ نفس الخطوات تُنفَّذ محليًا عبر `pnpm verify` |
| 2026-09-13 | P0.4 | سلسلة `verify` موحّدة مع `--no-bail`، وتشمل الآن `hygiene` و`adversarial` | `pnpm verify` |
| 2026-09-13 | P1.1 | عزل حقيقي: `VmExecutor` (سياق V8 منفصل مع `codeGeneration:{strings:false,wasm:false}` فيصبح `eval`/`new Function` **رميًا من المحرك نفسه** لا تصفية نصية) و`SubprocessExecutor` (عملية مستقلة تحت نموذج أذونات Node مع سجن ملفاتي). حذف `simulateExecution` و`new Function`. رفض صريح للغات غير المدعومة بدل نجاح مُختلَق، وإبلاغ `unenforcedLimits` بأمانة | `node scripts/adversarial-gate.mjs` → صفر اختراقات على 4 تركيبات؛ الحمولة الأصلية `this.constructor.constructor("return process")().env` → `EvalError: Code generation from strings disallowed` |
| 2026-09-13 | P1.2 | مفردات حوكمة قانونية (`governance/src/vocabulary.ts`): `filesystem→fs`, `terminal→exec`, `github→git`, `filesystem.read→read`. التطبيع عند حدود الـ Gateway لا عند مستدعٍ واحد، و`SkillRunner` يرسل القيم القانونية صراحةً | `packages/skill-executor/tests/governance-bypass.test.ts` → قراءة `/etc/passwd` عبر مهارة "محكومة" = `BLOCK/POL-001` بدل `ALLOW/matchedRuleId=null` |
| 2026-09-13 | P1.3 | Fail-Closed: غياب قاعدة مطابقة لعملية مُعدِّلة → `REQUIRE_APPROVAL` (`FAIL-CLOSED`)؛ قاعدة ترمي استثناءً → موافقة لا تخطٍّ صامت. إضافة POL-008 (السماح الصريح للتنفيذ داخل حدود العزل) وPOL-009 (السماح بالكتابة النسبية داخل مساحة العمل). إعادة بناء مقياس المخاطرة ليصبح واعيًا بالهدف بدل عقوبة مسطّحة "أي كتابة = HIGH" | `packages/governance/tests/vocabulary-failclosed.test.ts` (24 اختبارًا) + 122/122 في حزمة governance |
| 2026-09-13 | P1.4 | تطبيق `allowedScopes` في `scope-guard.ts` قبل `handler.execute`: رفض المواقع المحمية والعبور المساري وأي مسار خارج `workingDir`. إصلاح `PathGuard.isWithinScope`: قائمة فارغة = رفض، ومقارنة بعد `resolve` بفاصل المسار | `/sandbox-evil` لم يعد داخل `/sandbox`؛ 51/51 في skill-executor |
| 2026-09-13 | P1.9 | ترقية التبعيات + `scripts/audit-gate.mjs` مع قائمة السماح | `pnpm audit:strict` → 0/0/0/0/0، PASSED |
| 2026-09-13 | P1.10 | إعادة كتابة `@agi-os/sandbox-adversarial` من الصفر. كانت تُبلّغ 18/18 "محظور" **كنتيجة حتمية بنيويًا**: `checkCapability('${cat}.execute')` لم يكن له أي مفتاح فيرجع الرفض دائمًا، فيُحسَم الحكم قبل تنفيذ أي كود. الآن 20 حمولة قابلة للتنفيذ مع هدف معلن ومُحقِّق يقيس هل تحقق الهدف، على طبقتين (مع/دون تجاوز قائمة المصدر) ومستويَي عزل | `scripts/adversarial-gate.mjs` يفشل إذا عجز الكاشف عن رؤية اختراق مُتعمَّد (اختبار ذاتي)، ثم يتطلب صفر اختراقات |
| 2026-09-13 | P3.1 | ESLint على مستوى الجذر (قواعد الصحة = error، الديون = warning) + `scripts/lint-codemod.mjs` دقيق الموضع/العمود | `eslint .` → 0 خطأ، 88 تحذيرًا (دين مقبول ومُوثَّق) |
| 2026-09-13 | جديد | `scripts/workspace-hygiene.mjs`: ثوابت بنيوية تمنع عودة أصناف كاملة من الأعطال (نقص `@types/node`، غياب سكربت اختبار، `bin` خامل) | 233 فحصًا، 0 فشل؛ موصول بوظيفة CI مستقلة |
| 2026-09-13 | P0.3 (تصحيح ثانٍ) | **تسليم الوظائف عبر `actions/cache` كان غير حتمي**: وظيفة `install` تحفظ `node_modules` ووظيفة `build` تحفظ `dist/` والبقية تستعيد المفتاح. نجح `build` (1m20s) وماتت الوظائف الأربع التالية خلال 13–18 ثانية لأن الاستعادة لم تُسلّم مساحة عمل صالحة — والكاش موثَّق كأفضل جهد لا ضمان، وغياب الإصابة ليس خطأً. صار كل job مكتفيًا ذاتيًا عبر إجراء مركّب `.github/actions/setup-workspace` (تثبيت من lockfile مجمّد + بناء عند الحاجة)، مع بقاء كاش مخزن pnpm عبر `setup-node` وهو الآلية المدعومة | CI: build/typecheck/test/lint/security/hygiene/**security-poc** كلها خضراء بعد الإصلاح |
| 2026-09-13 | P1.11 | **إصلاح Dockerfile** (كان يفشل في CI): (1) `corepack prepare pnpm@latest` يُثبّت pnpm 10 على `lockfileVersion 6.0` فيرفض `--frozen-lockfile` التوفيق — صار الإصدار مثبَّتًا على حقل `packageManager`؛ (2) كانت `kernel` و`missions` و`tools` ترث `../../tsconfig.json` الذي **لم يُنسخ إطلاقًا** إلى مرحلة البناء. أُضيف نسخ إعدادات الجذر، و`USER node` مع مجلدات حالة مملوكة قبل إسقاط الصلاحيات، وhealthcheck بـ node بدل curl (غير موجود على alpine)، واستُبدل `CMD` الذي كان يستدعي `tsx` — وهو ليس تبعية في أي حزمة — بنقطة دخول الـ CLI الحقيقية | `node packages/cli/dist/main.js status` → exit 0؛ وفحص `docker-context` الجديد يُمسك بكلتا العلّتين (اختبار طفرة: حُذف tsconfig → 3 أخطاء باسم الحزم؛ نُسخ مسار مُستثنى → خطأ) |
| 2026-09-13 | P0.3 (تصحيح) | **ترتيب CI كان معكوسًا**: `typecheck` كان يسبق `build`، والحزم تحلّ بعضها عبر ملفات التصريح المبنية (`types: ./dist/index.d.ts`). على runner نظيف أنتج ذلك **166 خطأ `TS2307: Cannot find module @agi-os/kernel`**. صار `build ← typecheck`، و`typecheck` يستعيد كاش البناء (يشمل `dist/`). ونفس الخلل كان في سكربت `verify` المحلي | إعادة إنتاج محلي من حالة نظيفة: حذف كل `dist/` → `pnpm build` ثم `pnpm typecheck` → 0 أخطاء (كان 166) |
| 2026-09-13 | جديد | نقطة دخول حقيقية للـ CLI (`packages/cli/src/main.ts`): كان `bin: agi` يشير إلى ملف صادرات لا يقرأ `process.argv` إطلاقًا فيطبع لا شيء ويخرج بـ 0. الآن تحليل وسائط، إخراج مقروء/JSON، وأكواد خروج صادقة (0/1/2) | 30/30 اختبارًا؛ `agi --bogus` → 2، `agi init` → يُنشئ المجلدات فعلًا |

### قرارات وتبعات تستحق التسجيل

- **تصنيف `module:'sandbox'` أُبقي كما هو.** تحويله إلى `'exec'` يجعل `RiskEvaluator` يُسجّل كل تنفيذ في الصندوق HIGH فيفرض موافقة على كل شيء. القرار النهائي: POL-008 يسمح صراحةً بالتنفيذ **لأنه** داخل حدود عزل مُطبَّقة، مع إبقاء `operation:'process'`.
- **POL-005 كان يُطابق سلاسل قصيرة بلا حدود كلمات**: `'format'` يصيب "information" و`'dd'` يصيب "added"/"address". أُصلحت إلى مطابقة بحدود الكلمات للكلمات المفردة، وإضافة `matchesDangerousCommand` قابلة للاختبار. كذلك أُلغي إدراج `sandbox` في POL-005 لأن الهدف يحتوي UUID عشوائيًا قد يتضمن "dd" فيحجب التنفيذ بشكل متقطّع.
- **عقوبة "أي كتابة = +35" كانت هي العائق الحقيقي**، لا الحوكمة: مع مُضاعِف `fs` (×1.2) تصبح 42 = HIGH فيتجاوز القرار ويسقط POL-009، فلا يستطيع الوكيل كتابة ملف داخل مساحة عمله دون بشري. صارت المخاطرة واعية بالهدف: أساس صغير للكتابة + تصعيد كبير (`write_outside_workspace`) حين يقع الهدف خارج الجذور المملوكة. الأهداف الحساسة ما تزال تُصعَّد (+30) وPOL-001 يحجبها outright.
- **قائمة الأهداف المحمية موسَّعة** لتشمل مواقع البقاء (persistence) التي كان يغيبها: `/etc/cron`, `crontab`, `/etc/systemd`, `ld.so.preload`, `.bashrc`, `authorized_keys`, `.npmrc`, `.pypirc`.
- **بنود ما تزال مفتوحة في المرحلة 1:** P1.5 (`FileBackend`)، P1.6 (احتواء `real-skills` ورفض الروابط الرمزية — الحارس الحالي في `SkillRunner` يمنع الوصول لكنه ليس داخل المهارة نفسها)، P1.7 (تقسية `api-server` و`timingSafeEqual`)، P1.8 (`DependencyAuditor` حقيقي)، P1.11 (تقسية Docker).
- **قصور وظيفي مُسجَّل لا أمني:** `DeploymentManager`/`CanaryRunner`/`ChaosEngine`/`TerminalExecutor` تُعيد نجاحًا مُختلَقًا — هذه المرحلة 2 (P2.3–P2.5)، ويجب إما تنفيذها فعليًا أو نقلها إلى `simulation/` بتسمية صريحة.
