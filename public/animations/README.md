# CampusLink original authentication character

Login and Signup use the original simple student at a laptop, restored from the earlier design. Desk/gaming and random prop poses have been removed. The animation remains unmounted on mobile (768px and below); the form stays unchanged.

The active artwork is a local vector illustration. No custom .riv file is available. Rive is optional on desktop: place a compatible file at C:/CampusLink/public/animations/campuslink-auth.riv and set AUTH_RIVE_ENABLED=true in src/components/auth/character-config.ts.

State machine: AuthCharacter. Artboard: CampusLinkAuth.
Required Boolean inputs: isEmailFocused, isTyping, isPasswordFocused, isPasswordVisible, isSuccess, isError.
Optional Number inputs: mouseX and mouseY, normalized from -1 to 1.

The character blinks/breathes subtly, looks toward focused fields, reacts to typing, covers/peeks for password visibility, and shows brief error or success feedback. Typing ends 900ms after the last change; error reactions end after 1800ms. There are no gaming or random idle timers. Password focus, hidden tabs, loading and mobile suspend typing; reduced motion disables continuous animation and pointer tracking. All listeners, timers and pointer frames are cleaned up.

Authentication APIs, validation, Google sign-in, sessions and dashboard redirects are preserved.
