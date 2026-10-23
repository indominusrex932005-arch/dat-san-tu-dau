# Court list UI review evidence

Source commit: 3d72b54583b99a4d086b1d35ba0d743b76d0334b
Backend/base: 7b46672d93f5481d0dc28d698d6c7a1397507bb4 (includes backend PR #25).
Date: 23/10/2026. Browser: Codex in-app browser.

Requested viewports: 1366x900 and390x844. Normal/empty captures include full
page content where available. Long-data captures show the viewport and an
additional mobile bottom view. Scrollbars may reduce content width by15px.

All displayed records are disposable fixtures in a dedicated temporary Atlas
QA database, served by the actual app/controller, Mongoose and MongoStore.
Normal:3 active courts, including zero price and a missing populated facility;
one inactive court is excluded. Empty:0 active courts. Long:1 court with long
unbroken court/facility names and address. No application DB data was modified.
The temporary database was removed after checks.

Application source is on feat/ui-courts. This branch contains evidence only.
