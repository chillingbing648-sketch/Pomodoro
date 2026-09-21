import { BACKGROUNDS } from "../data/backgrounds";

export default function BackgroundGallery({ value, onChange }) {
  return (
    <div className="background-gallery" aria-label="Background selection">
      {Object.values(BACKGROUNDS).map((background) => (
        <button
          key={background.id}
          type="button"
          className={`background-card ${background.className} ${value === background.id ? "is-active" : ""}`}
          onClick={() => onChange(background.id)}
          aria-pressed={value === background.id}
        >
          <span className="background-card-preview">
            <span className="background-card-glow" />
            <span className="background-card-grid" />
          </span>
          <span className="background-card-copy">
            <strong>{background.name}</strong>
            <small>{background.description}</small>
          </span>
          {value === background.id && <span className="background-card-check">✓</span>}
        </button>
      ))}
    </div>
  );
}
