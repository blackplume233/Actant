# Changelog — v0.2.3

> **日期**: 2026-02-26
> **变更范围**: v0.2.2 → v0.2.3

---

## ✨ 新功能 (Features)

- feat(hooks): unified event system, schedule refactoring, and subsystem design — PR #179 (c375bd3)
- feat: Instance Interaction Archetype — distinguish agent types with auto-start support — PR #175 (e0e671e)
- feat(source): add community source type for Agent Skills repositories #145 — PR #170 (93b98e0)
- feat(phase4): wave-1 bug fixes — gateway.lease, adopt sync, ping version, install.ps1 — PR #165 (797a03e)
- feat(core): backend-aware provider env injection, declarative materialization (#133 #141 #150) — PR #162 (d69725b)
- feat(core): auto-install missing backend CLI dependencies (#153) — PR #160 (31968ca)
- feat(backend): promote Pi to first-class builtin backend with resolve mode (3c84b02)
- feat(hooks): add Hook type system and event bus implementation (#159) (6aa2be5)
- feat(cli): add interactionModes and enhance agent open command (#134) (c283ea0)

## 🐛 修复 (Fixes)

- fix(core): resolve agent status stuck on error while process is running (#155) — PR #161 (2aa44c4)
- fix(daemon): resolve startup timeout + remove interactionModes dead code — PR #156 (c438e91)
- fix(core): Windows EINVAL when spawning .cmd backend executables — PR #157 (fb7e8f8)
- fix(api): initialize EmployeeScheduler on agent start (#152) — PR #167 (7f4f3b4)
- fix(scripts): harden install.ps1 — npm check, pnpm support, stale bin cleanup (#166) — PR #168 (51ec005)
- fix(issue-cli): resolve CJK encoding corruption in GitHub sync — PR #172 (7bcd996)
- fix: resolve 3 QA bugs — Windows path quoting, --overwrite scope, plugin materialization (#147, #148, #149) (c496899)
- fix: resolve lint non-null assertion and add missing subscriptionModels to test fixtures (00e3734)

## 📝 文档 (Documentation)

- docs(wiki): add VitePress wiki site with feature guides, recipes and reference — PR #176 (3305ea1)
- docs: wiki overhaul, site update, install hardening, and trellis tooling (209f772)
- docs(guides): add comprehensive dev workflow guide — PR #169 (7f57024)
- docs(trellis): update developer identity spec to use Actant Agent model — PR #164 (aec18f7)
- docs(issues): add Agent scheduler 4-mode architecture design — PR #174 (2c860a9)
- docs: Phase 4 preliminary design, GitNexus workflow integration (8aa4d83)
- docs: update spec for PR #175 — AgentArchetype and autoStart fields (2f4c3e7)
- docs: update api-contracts.md with community source type for PR #170 (e0b8b37)
- docs: update api-contracts.md with gateway.lease RPC method for PR #165 (1c76373)

## 🧪 测试 (Tests)

- test(cli): add destroy --force idempotent test + sync issue cache — PR #159 (73b11f7)

## 🔧 其他 (Chore)

- feat(trellis): add create-pr slash command — PR #163 (43d11a2)
- chore: add pr-handler skill, new issues, QA results (a41d5ef)

---

## 统计

| 指标 | 数值 |
|------|------|
| 总提交数 | ~60 |
| 合并 PR | 18 |
| 关闭 Issue | #147, #148, #149, #152, #153, #155, #166 |
| 新 Issue | #178 (ACP Employee Tools RFC) |
| 测试 | 830 通过 / 64 套件 |
| 代码行数 | 33,625 LOC |
