// Which build is actually running.
//
// The deploy path here is a zip, unzipped over a folder, committed in GitHub
// Desktop, pushed, built by Netlify. Every one of those steps can quietly not
// happen, and when it doesn't the symptom is indistinguishable from a broken
// feature: you look for a button that was added and it isn't there.
//
// That ambiguity cost most of a day. This constant is bumped with each
// release and served at /api/version, so "did my deploy land?" is a question
// with a one-second answer instead of an afternoon of theories.
export const BUILD_STAMP = "2026-09-23 · stock grid + daily email";
