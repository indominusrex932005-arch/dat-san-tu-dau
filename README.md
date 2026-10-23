# Login UI review evidence

Source commit: 8d23326ab857dbefd0a63a0093e6d43748385ecc
Backend/base: 7b46672d93f5481d0dc28d698d6c7a1397507bb4, merged backend PR #25.
Date: 23/10/2026. Browser: Codex in-app browser.

Four screenshots show normal and real invalid-password responses at viewport
1366x900 and390x844. Full-page captures may omit the browser scrollbar.
The account and all displayed data are disposable fixtures on a separate
temporary Atlas QA database. Actual controller, bcrypt, CSRF and Mongo session
store were used. No application backend source was changed for testing.

This branch contains screenshots only; application code is on feat/ui-login.
