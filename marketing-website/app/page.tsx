import {
  Apple,
  ArrowRight,
  Camera,
  Check,
  Download,
  Code2,
  Monitor,
  MousePointer2,
  ScanLine,
  Smartphone,
  Sparkles,
  Terminal,
  Waypoints,
  Zap,
} from 'lucide-react';

const githubUrl = 'https://github.com/holotrace-was-taken/holotrace';
const releasesUrl = `${githubUrl}/releases`;
const windowsDownloadUrl = `${githubUrl}/releases/download/desktop-latest/holotrace-windows-x64-setup.exe`;
const androidDownloadUrl = `${githubUrl}/releases/download/android-latest/holotrace-android-debug.apk`;
const macosDownloadUrl = `${githubUrl}/releases/download/macos-latest/holotrace-macos-universal.dmg`;
const linuxDownloadUrl = `${githubUrl}/releases/download/linux-latest/holotrace-linux-x86_64.AppImage`;

const steps = [
  {
    title: 'Start with the sketch',
    description: 'Take a photo on Android or bring in an existing image from your desktop.',
    icon: Camera,
  },
  {
    title: 'Check the read',
    description: 'A local vision pass finds likely parts. Review those regions before deeper recognition.',
    icon: ScanLine,
  },
  {
    title: 'Work with the circuit',
    description: 'Move components, draw connections, and switch between canvas, schematic, and parts views.',
    icon: Waypoints,
  },
];

const features = [
  {
    icon: MousePointer2,
    title: 'Edit naturally',
    description: 'Pan, zoom, select, place, and wire on a workspace designed for mouse and touch.',
  },
  {
    icon: Sparkles,
    title: 'Review before upload',
    description: 'See the regions Holotrace found and decide what continues to the recognition service.',
  },
  {
    icon: Zap,
    title: 'See the circuit respond',
    description: 'Inspect connections and simple circuit behavior without redrawing the whole diagram.',
  },
];

const modelSpecs = [
  { value: '2.8M', label: 'parameters at width 32' },
  { value: '64 × 64', label: 'grayscale ink crop in' },
  { value: '44', label: 'symbol classes out' },
  { value: '~11 MB', label: 'exported weights' },
];

const recognitionPaths = [
  {
    icon: ScanLine,
    title: 'Fast path',
    description:
      'ResNet Tiny labels each region the on-device pass proposed, and rejects false proposals through a dedicated background class.',
  },
  {
    icon: Sparkles,
    title: 'Recovery path',
    description:
      'Faster R-CNN with a MobileNetV3 FPN backbone searches the complete page for symbols the local pass overlooked. 19.2M parameters, about 77 MB.',
  },
  {
    icon: Waypoints,
    title: 'Integration',
    description:
      'The normalizer combines boxes, confidence, and model versions with wire geometry to build editable Circuit IR.',
  },
];

const downloads = [
  {
    icon: Monitor,
    title: 'Windows',
    description: 'A focused editor for reviewing captures, arranging components, and working across the full canvas.',
    points: ['Mouse and touch input', 'Full circuit workspace', 'Windows installer'],
    href: windowsDownloadUrl,
    cta: 'Download for Windows',
  },
  {
    icon: Apple,
    title: 'macOS',
    description: 'A universal desktop build for both Apple Silicon and Intel Macs.',
    points: ['Apple Silicon and Intel', 'Full circuit workspace', 'Universal DMG'],
    href: macosDownloadUrl,
    cta: 'Download for macOS',
  },
  {
    icon: Terminal,
    title: 'Linux',
    description: 'A portable x86_64 package for running the circuit workspace across distributions.',
    points: ['Portable package', 'Full circuit workspace', 'x86_64 AppImage'],
    href: linuxDownloadUrl,
    cta: 'Download for Linux',
  },
  {
    icon: Smartphone,
    title: 'Android',
    description: 'Camera-first capture and a touch-ready workspace built for the device already in your pocket.',
    points: ['Direct camera capture', 'Touch-first controls', 'Android package'],
    href: androidDownloadUrl,
    cta: 'Download Android APK',
  },
];

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <span />
      <span />
      <span />
    </span>
  );
}

function CircuitPreview() {
  return (
    <div className="preview-shell" aria-label="Holotrace circuit recognition preview">
      <div className="preview-bar">
        <div className="preview-brand">
          <BrandMark />
          <span>Holotrace</span>
        </div>
        <span className="preview-status">Analysis ready</span>
      </div>
      <div className="preview-workspace">
        <div className="preview-sidebar" aria-hidden="true">
          <button className="tool-active">
            <MousePointer2 size={16} />
          </button>
          <button>
            <Waypoints size={16} />
          </button>
          <button>
            <Zap size={16} />
          </button>
        </div>
        <div className="circuit-board">
          <div className="board-grid" />
          <svg viewBox="0 0 640 390" aria-label="Recognized circuit with resistor, LED, battery, and connecting wires">
            <title>Recognized circuit with resistor, LED, battery, and connecting wires</title>
            <path className="wire wire-accent" d="M90 93 H230" />
            <path className="wire" d="M335 93 H520 V267 H380" />
            <path className="wire" d="M260 267 H90 V93" />
            <path className="current-flow" d="M92 93 H228" />
            <g className="component resistor" transform="translate(230 66)">
              <rect width="105" height="54" rx="8" />
              <path d="M15 27h12l8-13 14 26 14-26 14 26 9-13h10" />
              <circle cx="0" cy="27" r="5" />
              <circle cx="105" cy="27" r="5" />
            </g>
            <g className="component led" transform="translate(322 226)">
              <circle cx="0" cy="41" r="36" />
              <path d="M-17 32h34M-17 50h34M0 15v52" />
              <path className="signal" d="M18 15l16-15M28 25l18-6" />
            </g>
            <g className="component battery" transform="translate(64 152)">
              <rect width="52" height="82" rx="7" />
              <path d="M14 26h24M26 14v24M15 61h22" />
            </g>
            <g className="node">
              <circle cx="90" cy="93" r="8" />
              <circle cx="520" cy="267" r="8" />
            </g>
          </svg>
          <div className="detection-tag tag-resistor">
            <span>R1</span> resistor <b>96%</b>
          </div>
          <div className="detection-tag tag-led">
            <span>D1</span> led <b>93%</b>
          </div>
          <div className="detection-tag tag-battery">
            <span>V1</span> source <b>98%</b>
          </div>
        </div>
        <div className="preview-panel">
          <h3>3 parts found</h3>
          <p>Confirm the read before continuing.</p>
          {['Resistor · R1', 'LED · D1', 'DC source · V1'].map((item) => (
            <div className="review-row" key={item}>
              <span>
                <Check size={13} />
              </span>
              <b>{item}</b>
            </div>
          ))}
          <button>
            Continue to circuit <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

const resnetStages = [
  { x: 296, title: 'Stage 1', channels: '32 ch', shape: '32 × 32', stride: 'stride 1' },
  { x: 460, title: 'Stage 2', channels: '64 ch', shape: '16 × 16', stride: 'stride 2' },
  { x: 624, title: 'Stage 3', channels: '128 ch', shape: '8 × 8', stride: 'stride 2' },
  { x: 788, title: 'Stage 4', channels: '256 ch', shape: '4 × 4', stride: 'stride 2' },
];

function ResNetDiagram() {
  return (
    <figure className="model-diagram">
      <svg viewBox="0 0 1180 470" aria-labelledby="resnet-diagram-title resnet-diagram-desc">
        <title id="resnet-diagram-title">ResNet Tiny architecture</title>
        <desc id="resnet-diagram-desc">
          A 64 by 64 grayscale crop enters a strided 3 by 3 stem convolution, passes through four stages of two
          residual blocks each with channel widths 32, 64, 128 and 256, then a global average pool, dropout and a
          linear layer produce 44 class logits. Each residual block runs two 3 by 3 convolutions with a shortcut that
          projects through a 1 by 1 convolution when the shape changes.
        </desc>

        <defs>
          <marker id="rn-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
            <path d="M0 0 L6 3 L0 6 z" className="rn-arrow-head" />
          </marker>
        </defs>

        {/* main flow connectors */}
        <g className="rn-flow">
          <path d="M116 100 H150" markerEnd="url(#rn-arrow)" />
          <path d="M268 100 H288" markerEnd="url(#rn-arrow)" />
          <path d="M432 100 H452" markerEnd="url(#rn-arrow)" />
          <path d="M596 100 H616" markerEnd="url(#rn-arrow)" />
          <path d="M760 100 H780" markerEnd="url(#rn-arrow)" />
          <path d="M924 100 H952" markerEnd="url(#rn-arrow)" />
        </g>

        {/* input crop */}
        <g className="rn-input">
          <rect x="16" y="60" width="100" height="80" rx="12" />
          <path
            className="rn-ink"
            d="M36 100 H52 M52 88 h28 v24 h-28 z M80 100 H96"
          />
          <text x="66" y="162" className="rn-caption">Ink crop</text>
          <text x="66" y="180" className="rn-dim">64 × 64 × 1</text>
        </g>

        {/* stem */}
        <g className="rn-block rn-stem">
          <rect x="150" y="56" width="118" height="88" rx="12" />
          <text x="209" y="90" className="rn-title">Stem</text>
          <text x="209" y="112" className="rn-sub">conv 3×3 · s2</text>
          <text x="209" y="128" className="rn-sub">BN · ReLU</text>
          <text x="209" y="196" className="rn-dim">32 × 32 × 32</text>
        </g>

        {/* stages */}
        {resnetStages.map((stage) => (
          <g className="rn-block rn-stage" key={stage.title}>
            <rect x={stage.x} y="56" width="136" height="88" rx="12" />
            <line x1={stage.x + 68} y1="76" x2={stage.x + 68} y2="124" className="rn-divider" />
            <text x={stage.x + 34} y="106" className="rn-unit">block</text>
            <text x={stage.x + 102} y="106" className="rn-unit">block</text>
            <text x={stage.x + 68} y="42" className="rn-title">{stage.title}</text>
            <path className="rn-skip" d={`M${stage.x + 6} 144 q 29 34 58 0`} markerEnd="url(#rn-arrow)" />
            <path className="rn-skip" d={`M${stage.x + 74} 144 q 29 34 58 0`} markerEnd="url(#rn-arrow)" />
            <text x={stage.x + 68} y="196" className="rn-dim">
              {stage.shape} × {stage.channels.replace(' ch', '')}
            </text>
            <text x={stage.x + 68} y="214" className="rn-sub">{stage.stride}</text>
          </g>
        ))}

        {/* head */}
        <g className="rn-block rn-head">
          <rect x="952" y="56" width="212" height="88" rx="12" />
          <text x="1058" y="42" className="rn-title">Head</text>
          <text x="1058" y="88" className="rn-sub">global average pool</text>
          <text x="1058" y="108" className="rn-sub">dropout 0.2</text>
          <text x="1058" y="128" className="rn-sub">linear 256 → 44</text>
          <text x="1058" y="196" className="rn-dim">44 class logits</text>
        </g>

        {/* residual block detail */}
        <g className="rn-detail">
          <rect x="16" y="258" width="1148" height="192" rx="16" className="rn-detail-panel" />
          <text x="48" y="292" className="rn-detail-title">Inside one residual block</text>
          <text x="48" y="312" className="rn-sub rn-detail-sub">
            Two 3×3 convolutions and a shortcut. The shortcut projects through a 1×1 convolution when stride or channel
            count changes.
          </text>

          <g className="rn-flow">
            <path d="M118 386 H166" markerEnd="url(#rn-arrow)" />
            <path d="M286 386 H334" markerEnd="url(#rn-arrow)" />
            <path d="M454 386 H502" markerEnd="url(#rn-arrow)" />
            <path d="M622 386 H696" markerEnd="url(#rn-arrow)" />
            <path d="M752 386 H922" markerEnd="url(#rn-arrow)" />
            <path d="M1046 386 H1094" markerEnd="url(#rn-arrow)" />
          </g>

          <g className="rn-pill">
            <rect x="48" y="364" width="70" height="44" rx="10" />
            <text x="83" y="391" className="rn-unit">in</text>
          </g>
          <g className="rn-pill rn-pill-solid">
            <rect x="166" y="364" width="120" height="44" rx="10" />
            <text x="226" y="384" className="rn-unit">conv 3×3</text>
            <text x="226" y="399" className="rn-unit rn-unit-dim">BN</text>
          </g>
          <g className="rn-pill">
            <rect x="334" y="364" width="120" height="44" rx="10" />
            <text x="394" y="391" className="rn-unit">ReLU</text>
          </g>
          <g className="rn-pill rn-pill-solid">
            <rect x="502" y="364" width="120" height="44" rx="10" />
            <text x="562" y="384" className="rn-unit">conv 3×3</text>
            <text x="562" y="399" className="rn-unit rn-unit-dim">BN</text>
          </g>
          <g className="rn-sum">
            <circle cx="726" cy="386" r="26" />
            <path d="M726 374 V398 M714 386 H738" />
          </g>
          <g className="rn-pill">
            <rect x="926" y="364" width="120" height="44" rx="10" />
            <text x="986" y="391" className="rn-unit">ReLU</text>
          </g>
          <g className="rn-pill">
            <rect x="1094" y="364" width="70" height="44" rx="10" />
            <text x="1129" y="391" className="rn-unit">out</text>
          </g>

          <path className="rn-skip rn-skip-long" d="M83 364 V346 H726 V358" markerEnd="url(#rn-arrow)" />
          <text x="404" y="338" className="rn-skip-label">shortcut · identity, or 1×1 conv + BN on shape change</text>
        </g>
      </svg>
    </figure>
  );
}

export default function Home() {
  return (
    <main>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Holotrace home">
          <BrandMark />
          <span>Holotrace</span>
        </a>
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="#model">Model</a>
          <a href="#features">Features</a>
          <a href="#download">Download</a>
        </div>
        <a className="ghost-button" href={githubUrl} target="_blank" rel="noreferrer">
          <Code2 size={16} />
          <span>GitHub</span>
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <h1>
            Draw it. Capture it. <em>Bring it to life.</em>
          </h1>
          <p>
            Turn a hand-drawn circuit into an interactive model you can inspect, edit, and understand on Windows,
            macOS, Linux, or Android.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#download">
              Choose your version
            </a>
            <a className="secondary-button" href={githubUrl} target="_blank" rel="noreferrer">
              View the source <ArrowRight size={16} />
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <CircuitPreview />
        </div>
      </section>

      <section className="section" id="how-it-works">
        <div className="section-intro">
          <h2>From notebook linework to a circuit you can use.</h2>
          <p>Keep the speed of sketching. Add the structure of a digital workspace.</p>
        </div>
        <div className="card-grid three">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <article className="card" key={step.title}>
                <span className="card-icon">
                  <Icon size={20} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </article>
            );
          })}
        </div>
        <p className="section-note">
          Review comes first. You see what Holotrace found before the image continues to deeper recognition.
        </p>
      </section>

      <section className="section model-section" id="model">
        <div className="section-intro">
          <h2>The classifier, drawn out.</h2>
          <p>
            ResNet Tiny is written from scratch and trained on cropped circuit symbols. It is small enough to ship and
            deep enough to separate 44 classes of hand-drawn part.
          </p>
        </div>

        <ResNetDiagram />

        <div className="spec-row">
          {modelSpecs.map((spec) => (
            <div className="spec" key={spec.label}>
              <strong>{spec.value}</strong>
              <span>{spec.label}</span>
            </div>
          ))}
        </div>

        <p className="section-note">
          On the current validation split the classifier reaches 97.6% overall accuracy and a 0.82 macro F1. Accuracy
          is carried by the common classes; rare symbols still have far fewer examples than they need.
        </p>

        <div className="card-grid three">
          {recognitionPaths.map((path) => {
            const Icon = path.icon;
            return (
              <article className="card" key={path.title}>
                <span className="card-icon">
                  <Icon size={20} />
                </span>
                <h3>{path.title}</h3>
                <p>{path.description}</p>
              </article>
            );
          })}
        </div>

        <p className="section-note">
          Every prediction keeps its source location, confidence, alternatives, and model version, so an uncertain read
          can be explained and corrected before simulation.
        </p>
      </section>

      <section className="section" id="features">
        <div className="section-intro">
          <h2>A circuit workspace that gets out of your way.</h2>
          <p>
            Capture at the bench. Refine on a larger screen. The same circuit stays readable across touch and desktop
            layouts.
          </p>
        </div>
        <div className="card-grid three">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <article className="card" key={feature.title}>
                <span className="card-icon">
                  <Icon size={20} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="section download-section" id="download">
        <div className="section-intro">
          <h2>One workspace. Four ways in.</h2>
          <p>
            Try the latest development build. New packages are published after app changes land on main.
          </p>
        </div>
        <div className="card-grid four">
          {downloads.map((item) => {
            const Icon = item.icon;
            return (
              <article className="card download-card" key={item.title}>
                <span className="card-icon">
                  <Icon size={20} />
                </span>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <ul>
                  {item.points.map((point) => (
                    <li key={point}>
                      <Check size={14} /> {point}
                    </li>
                  ))}
                </ul>
                <a className="download-button" href={item.href}>
                  <Download size={16} /> {item.cta}
                </a>
              </article>
            );
          })}
        </div>
        <a className="secondary-button release-link" href={releasesUrl} target="_blank" rel="noreferrer">
          View build history on GitHub <ArrowRight size={16} />
        </a>
      </section>

      <footer>
        <div className="footer-lead">
          <h2>Your next circuit can start on paper.</h2>
          <a className="primary-button" href="#top">
            Back to top
          </a>
        </div>
        <div className="footer-base">
          <span>© {new Date().getFullYear()} Holotrace</span>
          <span>Open source, built with Tauri</span>
          <a href={githubUrl} target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </footer>
    </main>
  );
}
