/* =============================================================================
   BackgroundGallery.jsx
   Background picker. Reads everything from data/backgrounds.js.

   <BackgroundGallery />                               self-managed + persisted
   <BackgroundGallery value={id} onChange={setId} />   optional controlled use

   Selection is validated, saved to localStorage and broadcast, so a mounted
   <BackgroundEngine /> follows it automatically. Invalid / missing / blocked
   storage falls back to the default safely.
============================================================================= */

import { useRef, useSyncExternalStore } from "react";
import {
  AMBIENT_SOUND_PROFILES,
  BACKGROUNDS,
  loadBackgroundId,
  resolveBackgroundId,
  saveBackgroundId,
  subscribeBackground,
} from "../data/backgrounds";

const CSS = `
.bgg{--bgg-text:#f4f4f6;--bgg-muted:rgba(244,244,246,.56);--bgg-line:rgba(255,255,255,.09);
  box-sizing:border-box;width:100%;max-width:640px;padding:16px;border-radius:18px;color:var(--bgg-text);
  background:rgba(13,14,19,.74);border:1px solid var(--bgg-line);
  -webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);
  box-shadow:0 18px 50px -20px rgba(0,0,0,.65);
  font:400 13px/1.35 -apple-system,BlinkMacSystemFont,"Inter","Segoe UI",system-ui,sans-serif}
.bgg *{box-sizing:border-box}
.bgg__head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:0 2px 12px}
.bgg__title{margin:0;font-size:13px;font-weight:600;letter-spacing:.01em}
.bgg__current{font-size:12px;color:var(--bgg-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bgg__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}
.bgg__card{--a:#9b87f5;position:relative;display:flex;flex-direction:column;gap:9px;padding:7px 7px 10px;text-align:left;
  color:inherit;font:inherit;cursor:pointer;border-radius:13px;background:rgba(255,255,255,.025);
  border:1px solid var(--bgg-line);-webkit-tap-highlight-color:transparent;
  transition:transform .18s ease,border-color .18s ease,background .18s ease,box-shadow .18s ease}
.bgg__card:hover{transform:translateY(-1px);background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.18)}
.bgg__card:active{transform:translateY(0) scale(.99)}
.bgg__card:focus-visible{outline:2px solid var(--a);outline-offset:2px}
.bgg__card[aria-checked="true"]{border-color:var(--a);background:rgba(255,255,255,.055);
  box-shadow:0 0 0 1px var(--a),0 10px 30px -14px var(--a)}
.bgg__thumb{position:relative;aspect-ratio:16/10;border-radius:8px;overflow:hidden;background-size:cover;background-position:center}
.bgg__thumb::after{content:"";position:absolute;inset:0;border-radius:inherit;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.07),inset 0 -22px 30px -18px rgba(0,0,0,.55);pointer-events:none}
.bgg__check{position:absolute;top:6px;right:6px;z-index:1;width:18px;height:18px;border-radius:50%;
  display:grid;place-items:center;background:var(--a);color:#0b0b10;opacity:0;transform:scale(.6);
  transition:opacity .18s ease,transform .18s ease}
.bgg__card[aria-checked="true"] .bgg__check{opacity:1;transform:scale(1)}
.bgg__name{padding:0 3px;font-size:13px;font-weight:600;letter-spacing:.005em}
.bgg__tag{padding:0 3px;margin-top:-6px;font-size:11.5px;color:var(--bgg-muted)}
.bgg__sound{padding:0 3px;margin-top:-3px;font-size:10.5px;color:var(--a);opacity:0.85;letter-spacing:.02em}
@media (prefers-reduced-motion:reduce){.bgg__card,.bgg__check{transition:none}
  .bgg__card:hover,.bgg__card:active{transform:none}}
`;

export default function BackgroundGallery({
  value,
  onChange,
  title = "Background",
  className = "",
  style,
}) {
  const stored = useSyncExternalStore(subscribeBackground, loadBackgroundId, loadBackgroundId);
  const active = resolveBackgroundId(value ?? stored);
  const refs = useRef([]);

  const select = (id) => {
    const next = saveBackgroundId(id);
    if (onChange) onChange(next);
  };

  // Radio-group keyboard model: arrows / Home / End move + select
  const onKeyDown = (e) => {
  const n = BACKGROUNDS.length;
  const i = BACKGROUNDS.findIndex((b) => b.id === active);
  let j;

  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      j = (i + 1) % n;
      break;

    case "ArrowLeft":
    case "ArrowUp":
      j = (i - 1 + n) % n;
      break;

    case "Home":
      j = 0;
      break;

    case "End":
      j = n - 1;
      break;

    default:
      return;
  }

  const nextId = BACKGROUNDS[j]?.id;

  if (!nextId) return;

  e.preventDefault();
  select(nextId);
  refs.current[j]?.focus();
};

  const current = BACKGROUNDS.find((b) => b.id === active);

  return (
    <section className={`bgg ${className}`.trim()} style={style} aria-label={title}>
      <style>{CSS}</style>

      <header className="bgg__head">
        <h2 className="bgg__title">{title}</h2>
        <span className="bgg__current" aria-live="polite">{current?.name}</span>
      </header>

      <div className="bgg__grid" role="radiogroup" aria-label={title} onKeyDown={onKeyDown}>
        {BACKGROUNDS.map((bg, i) => {
          const checked = bg.id === active;
          return (
            <button
              key={bg.id}
              ref={(el) => { refs.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              className="bgg__card"
              style={{ "--a": bg.accent }}
              onClick={() => select(bg.id)}
            >
              <span className="bgg__thumb" style={{ background: bg.preview }}>
                <span className="bgg__check" aria-hidden="true">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 6.4 5 8.9l4.6-5.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </span>
              <span className="bgg__name">{bg.name}</span>
              <span className="bgg__tag">{bg.tagline}</span>
              {AMBIENT_SOUND_PROFILES[bg.id] && (
                <span className="bgg__sound" title={`Ambient sound: ${AMBIENT_SOUND_PROFILES[bg.id].name}`}>
                  ♪ {AMBIENT_SOUND_PROFILES[bg.id].name}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}