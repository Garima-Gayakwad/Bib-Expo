# Browser console errors (Excalidraw / ChunkLoadError)

If you see errors like:

- **"Loading the script '.../excalidraw...' violates the following Content Security Policy directive"**
- **"ChunkLoadError: Loading chunk 4736 failed"**
- References to **`content.js`** in the stack trace

**These do not come from this app.** This project does not use Excalidraw.

They are caused by a **Chrome extension** (e.g. a notes, whiteboard, or drawing extension that uses Excalidraw) injecting scripts into the page. The extension’s own CSP then blocks its script, which produces the error.

## How to fix or avoid the error

1. **Find the extension**  
   The error mentions `chrome-extension://3623f9b6-e1fe-454c-b0b7-d6a2df867098/`. In Chrome go to `chrome://extensions/`, find the extension with that ID (or look for drawing/notes/Excalidraw-related extensions).

2. **Disable it for this site**  
   On the extension’s card, click “Details” → under “Permissions” or “Site access”, set it to “On specific sites” and remove or exclude `bib-expo-web.vercel.app` (and your localhost URL if needed).

3. **Or disable it entirely**  
   Turn the extension off in `chrome://extensions/` if you don’t need it.

4. **Confirm the app is fine**  
   Open the app in an **Incognito window** (extensions are usually disabled there). The Excalidraw/ChunkLoadError should disappear. The app itself does not need any code changes for this.
