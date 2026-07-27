# Recovery Compare Report

## Compared Files

Original runtime entry:

- `/Users/anranfan/core-bank-dp/dist/index.html`
- `/Users/anranfan/core-bank-dp/dist/assets/index-B60NmhIE.js`
- `/Users/anranfan/core-bank-dp/dist/assets/index-CZJYO7NB.css`

Recovered source build:

- `/Users/anranfan/core-bank-dp/xinshi-admin-frontend/dist/index.html`
- `/Users/anranfan/core-bank-dp/xinshi-admin-frontend/dist/assets/index-*.js`
- `/Users/anranfan/core-bank-dp/xinshi-admin-frontend/dist/assets/index-*.css`

## Findings Before Fix

The recovered source build was missing usage of several original runtime features:

- Role creation and role configuration UI.
- Grade-subject configuration using `/grade-subjects`.
- Class-subject and teacher assignment using `/class-subjects`.
- Teacher score-entry loading using `/teacher-score-entries`.
- Original page structure classes such as `class-card`, `grade-subject-picker`, `course-add-form`, `polish-btn`, `score-comment-preview`, and `login-brand__features`.

## Fixes Applied

- Reused original compiled CSS as the recovered global stylesheet after removing Vue scoped `data-v-*` selectors.
- Added compatibility styles for reconstructed template class names.
- Restored config page entries for roles, grade subjects, class subjects, and teacher assignment.
- Restored class card layout and pagination container classes.
- Restored teacher score-entry API usage in the scores page.
- Restored original login feature-list structure.
- Restored student suggestion list structure.
- Restored score comment preview, overall comment display, and polish button class structure.

## Current Verification

`npm run build:source` passes.

Business API set comparison:

- Missing APIs in recovered build: none.
- Extra APIs in recovered build: none.

Key original structure classes now present in recovered build:

- `config-card__icon--roles`
- `grade-subject-picker`
- `course-add-form`
- `class-card`
- `teacher-score-entries`
- `workspace-tabs`
- `student-suggestions`
- `score-comment-preview`
- `overall-comment-display`
- `polish-btn`
- `pagination`
- `login-brand__features`

Additional page style/interaction alignment applied:

- Login form input icons, password visibility icon, and login error layout.
- Topbar user dropdown classes and arrow state.
- Dashboard metrics, workbench cards, dashboard panel, and mini-list layout.
- User query form, role badges, and role chip picker.
- Student filter form, student toolbar, student form layout, and pagination.
- Class query form, class metrics, class page header, class cards, and pagination.
- Config page header, refresh button, tab buttons, enroll-grade chips, and config modal form.
- Score student stat grid, score summary, comment preview, overall comment display, and polish button.
- Transcript pagination and modal form.
- Shared modal backdrop and download progress card classes.

Latest remaining original classes not yet represented are mostly low-level/local widgets:

- Loading skeleton classes such as `class-grid-loading`, `class-skeleton`, `skeleton-line`.
- Teacher search dropdown classes such as `teacher-search-list`, `teacher-search-item`, `teacher-search-selected`.
- Tooltip and minor config helper classes such as `comment-tooltip`, `config-readonly`, `config-modal__hint`.

## Remaining Difference

The recovered source still is not a byte-for-byte reconstruction of the original Vue source because the original dist does not include source maps. Remaining differences are mostly component organization, render output ordering, and repeated route/API string counts.

## CSS Alignment Update

The source stylesheet now directly reuses the original compiled CSS after removing Vue scoped `data-v-*` markers:

- Original CSS: `/Users/anranfan/core-bank-dp/dist/assets/index-CZJYO7NB.css`
- Source CSS: `src/styles.css`

Latest selector comparison:

- Original CSS after removing scoped markers: 401 selectors.
- Current source build CSS: 401 selectors.
- Missing style selectors: none.
- Extra style selectors: none.

The only textual CSS selector difference is equivalent media-query formatting introduced by the build tool:

- Original form: `@media (width<=760px)`
- Built form: `@media(max-width:760px)`
