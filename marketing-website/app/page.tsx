import {
  ArrowDown,
  ArrowRight,
  Camera,
  Check,
  Code2,
  Download,
  Monitor,
  MousePointer2,
  ScanLine,
  Smartphone,
  Sparkles,
  Waypoints,
  Zap,
} from 'lucide-react';

const githubUrl = 'https://github.com/holotrace-was-taken/holotrace';
const releasesUrl = `${githubUrl}/releases`;
const windowsDownloadUrl = `${githubUrl}/releases/download/desktop-latest/holotrace-windows-x64-setup.exe`;
const androidDownloadUrl = `${githubUrl}/releases/download/android-latest/holotrace-android-debug.apk`;

const steps = [
  { number: '01', label: 'CAPTURE', title: 'Start with the sketch', description: 'Take a photo on Android or bring in an existing image from your desktop.', icon: Camera },
  { number: '02', label: 'REVIEW', title: 'Check the read', description: 'A local vision pass finds likely parts. Review those regions before deeper recognition.', icon: ScanLine },
  { number: '03', label: 'EXPLORE', title: 'Work with the circuit', description: 'Move components, draw connections, and switch between canvas, schematic, and parts views.', icon: Waypoints },
];

const features = [
  { icon: MousePointer2, title: 'Edit naturally', description: 'Pan, zoom, select, place, and wire on a workspace designed for mouse and touch.' },
  { icon: Sparkles, title: 'Review before upload', description: 'See the regions Holotrace found and decide what continues to the recognition service.' },
  { icon: Zap, title: 'See the circuit respond', description: 'Inspect connections and simple circuit behavior without redrawing the whole diagram.' },
];

const architectureStages = [
  {
    number: '01',
    label: 'ON DEVICE',
    title: 'OpenCV prepares the page',
    description: 'Crop, perspective, contrast, and denoising run locally. The same pass proposes likely symbol regions.',
    detail: 'IMAGE + REGION PROPOSALS',
    icon: Camera,
  },
  {
    number: '02',
    label: 'FAST PATH',
    title: 'A compact classifier reads each crop',
    description: 'ResNet Tiny labels proposed regions and rejects false proposals with a dedicated background class.',
    detail: '2.8M PARAMETERS · ~11 MB',
    icon: ScanLine,
  },
  {
    number: '03',
    label: 'RECOVERY PATH',
    title: 'A full-page detector catches misses',
    description: 'Faster R-CNN with a MobileNetV3 FPN backbone searches the complete page for symbols the local pass overlooked.',
    detail: '19.2M PARAMETERS · ~77 MB',
    icon: Sparkles,
  },
  {
    number: '04',
    label: 'IN INTEGRATION',
    title: 'Evidence becomes a circuit model',
    description: 'The normalizer combines boxes, confidence, and model versions with wire geometry to build editable Circuit IR.',
    detail: 'REVIEWABLE · VERSIONED · RENDERER-INDEPENDENT',
    icon: Waypoints,
  },
];

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>;
}

function CircuitPreview() {
  return (
    <div className="preview-shell" aria-label="Holotrace circuit recognition preview">
      <div className="preview-bar">
        <div className="preview-brand"><BrandMark /><span>HOLOTRACE</span></div>
        <span className="preview-status"><i /> ANALYSIS READY</span>
      </div>
      <div className="preview-workspace">
        <div className="preview-sidebar" aria-hidden="true">
          <button className="tool-active"><MousePointer2 size={16} /></button>
          <button><Waypoints size={16} /></button>
          <button><Zap size={16} /></button>
        </div>
        <div className="circuit-board">
          <div className="board-grid" />
          <svg viewBox="0 0 640 390" aria-label="Recognized circuit with resistor, LED, battery, and connecting wires">
            <title>Recognized circuit with resistor, LED, battery, and connecting wires</title>
            <path className="wire wire-blue" d="M90 93 H230" />
            <path className="wire" d="M335 93 H520 V267 H380" />
            <path className="wire" d="M260 267 H90 V93" />
            <path className="current-flow" d="M92 93 H228" />
            <g className="component resistor" transform="translate(230 66)">
              <rect width="105" height="54" rx="8" />
              <path d="M15 27h12l8-13 14 26 14-26 14 26 9-13h10" />
              <circle cx="0" cy="27" r="5" /><circle cx="105" cy="27" r="5" />
            </g>
            <g className="component led" transform="translate(322 226)">
              <circle cx="0" cy="41" r="36" />
              <path d="M-17 32h34M-17 50h34M0 15v52" />
              <path className="signal" d="M18 15l16-15M28 25l18-6" />
            </g>
            <g className="component battery" transform="translate(64 152)">
              <rect width="52" height="82" rx="7" /><path d="M14 26h24M26 14v24M15 61h22" />
            </g>
            <g className="node"><circle cx="90" cy="93" r="8" /><circle cx="520" cy="267" r="8" /></g>
          </svg>
          <div className="detection-tag tag-resistor"><span>R1</span> resistor <b>96%</b></div>
          <div className="detection-tag tag-led"><span>D1</span> led <b>93%</b></div>
          <div className="detection-tag tag-battery"><span>V1</span> source <b>98%</b></div>
          <div className="canvas-caption">CANVAS / CIRCUIT_01</div>
        </div>
        <div className="preview-panel">
          <span className="panel-kicker">DETECTION REVIEW</span>
          <h3>3 parts found</h3>
          <p>Confirm the read before continuing.</p>
          {['Resistor · R1', 'LED · D1', 'DC source · V1'].map((item) => (
            <div className="review-row" key={item}><span><Check size={13} /></span><b>{item}</b></div>
          ))}
          <button>Continue to circuit <ArrowRight size={14} /></button>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main>
      <nav className="site-nav" aria-label="Primary navigation">
        <a className="wordmark" href="#top" aria-label="Holotrace home"><BrandMark /><span>HOLOTRACE</span></a>
        <div className="nav-links"><a href="#how-it-works">How it works</a><a href="#model">Model</a><a href="#features">Features</a><a href="#download">Download</a></div>
        <a className="github-link" href={githubUrl} target="_blank" rel="noreferrer"><Code2 size={17} /><span>GitHub</span></a>
      </nav>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow"><i /> CIRCUIT SKETCHES, MADE INTERACTIVE</span>
          <h1>Draw it.<br />Capture it.<br /><em>Bring it to life.</em></h1>
          <p>Turn a hand-drawn circuit into an interactive model you can inspect, edit, and understand on desktop or Android.</p>
          <div className="hero-actions">
            <a className="primary-button" href="#download">Choose your version <ArrowDown size={17} /></a>
            <a className="text-link" href={githubUrl} target="_blank" rel="noreferrer">View the source <ArrowRight size={16} /></a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-label label-one">LOCAL PASS <span>01</span></div>
          <div className="visual-label label-two">EDITABLE MODEL <span>03</span></div>
          <CircuitPreview />
        </div>
      </section>

      <div className="signal-strip" aria-hidden="true"><span>PHOTO INPUT</span><i /><span>LOCAL VISION</span><i /><span>DETECTION REVIEW</span><i /><span>CIRCUIT MODEL</span></div>

      <section className="process section" id="how-it-works">
        <div className="section-intro">
          <span className="eyebrow">THE PROCESS</span>
          <h2>From notebook linework to a circuit you can use.</h2>
          <p>Keep the speed of sketching. Add the structure of a digital workspace.</p>
        </div>
        <div className="step-grid">
          {steps.map((step) => {
            const Icon = step.icon;
            return <article className="step-card" key={step.number}><div className="step-top"><span>{step.number}</span><Icon size={21} /></div><span className="step-label">{step.label}</span><h3>{step.title}</h3><p>{step.description}</p></article>;
          })}
        </div>
      </section>

      <section className="trust-band">
        <div className="trust-icon"><ScanLine size={28} /></div>
        <p><span>Review comes first.</span> See what Holotrace found before the image continues to deeper recognition.</p>
        <span className="trust-meta">ON-DEVICE FIRST PASS</span>
      </section>

      <section className="architecture section" id="model">
        <div className="architecture-intro">
          <div>
            <span className="eyebrow">MODEL ARCHITECTURE</span>
            <h2>Two views of the page.<br />One accountable result.</h2>
          </div>
          <div className="architecture-summary">
            <p>A fast classifier examines the regions found on your device while a second model scans the full page. Keeping both paths preserves speed without depending on perfect first-pass detection.</p>
            <span><i /> CURRENT RECOGNITION STACK</span>
          </div>
        </div>

        <div className="architecture-flow">
          {architectureStages.map((stage, index) => {
            const Icon = stage.icon;
            return (
              <article className="architecture-stage" key={stage.number}>
                <div className="architecture-stage-top">
                  <span className="stage-number">{stage.number}</span>
                  <span className="stage-icon"><Icon size={19} /></span>
                </div>
                <span className="stage-label">{stage.label}</span>
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
                <span className="stage-detail">{stage.detail}</span>
                {index < architectureStages.length - 1 && <span className="flow-arrow" aria-hidden="true"><ArrowRight size={16} /></span>}
              </article>
            );
          })}
        </div>

        <div className="architecture-note">
          <Code2 size={19} />
          <p><strong>Why keep the raw result?</strong> Each prediction retains its source location, confidence, alternatives, and model version so uncertain reads can be explained and corrected before simulation.</p>
        </div>
      </section>

      <section className="features section" id="features">
        <div className="section-intro split-intro">
          <div><span className="eyebrow">BUILT FOR THE WORKBENCH</span><h2>A circuit workspace that gets out of your way.</h2></div>
          <p>Capture at the bench. Refine on a larger screen. The same circuit stays readable across touch and desktop layouts.</p>
        </div>
        <div className="feature-grid">
          {features.map((feature) => {
            const Icon = feature.icon;
            return <article className="feature-card" key={feature.title}><Icon size={22} /><h3>{feature.title}</h3><p>{feature.description}</p></article>;
          })}
        </div>
      </section>

      <section className="download section" id="download">
        <div className="download-heading"><span className="eyebrow">DOWNLOAD HOLOTRACE</span><h2>One workspace.<br />Two ways in.</h2><p>Try the latest development build for Windows or Android. New packages are published after app changes land on main.</p></div>
        <div className="download-grid">
          <article className="download-card">
            <div className="platform-icon"><Monitor size={29} /></div><span className="platform-label">DESKTOP</span><h3>Holotrace for Windows</h3>
            <p>A focused editor for reviewing captures, arranging components, and working across the full circuit canvas.</p>
            <ul><li><Check size={14} /> Mouse and touch input</li><li><Check size={14} /> Full circuit workspace</li><li><Check size={14} /> Windows installer</li></ul>
            <a className="download-button" href={windowsDownloadUrl}><Download size={16} /> Download for Windows</a>
          </article>
          <article className="download-card android-card">
            <div className="platform-icon"><Smartphone size={29} /></div><span className="platform-label">MOBILE</span><h3>Holotrace for Android</h3>
            <p>Camera-first capture and a touch-ready circuit workspace built for the device already in your pocket.</p>
            <ul><li><Check size={14} /> Direct camera capture</li><li><Check size={14} /> Touch-first controls</li><li><Check size={14} /> Android package</li></ul>
            <a className="download-button" href={androidDownloadUrl}><Download size={16} /> Download Android APK</a>
          </article>
        </div>
        <a className="release-link" href={releasesUrl} target="_blank" rel="noreferrer"><Code2 size={18} /> View build history on GitHub <ArrowRight size={16} /></a>
      </section>

      <footer>
        <div className="footer-lead"><BrandMark /><h2>Your next circuit can start on paper.</h2><a className="primary-button" href="#top">Back to top <ArrowDown className="up-arrow" size={17} /></a></div>
        <div className="footer-base"><span>© {new Date().getFullYear()} Holotrace</span><span>OPEN SOURCE · BUILT WITH TAURI</span><a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a></div>
      </footer>
    </main>
  );
}
