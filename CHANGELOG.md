# Changelog

## 2.0.0 — 2026-08-24

- Prevent duplicate generated headers at the start of a document for line and block comment syntaxes.
- Move production Git metadata lookups to asynchronous commands so header insertion does not block the editor.
- Add a dedicated `COPYRIGHT_OWNER` field and keep copyright ownership separate from author identity.
- Document the demo workflow, metadata resolution rules, and checked-in repository audit.