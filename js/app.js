/* ═══════════════════════════════════════════════════════════════
   INSPIRE 3 — INTERACTIVE TEARDOWN CONTROLLER
   Three.js r128 · classic scripts · everything procedural
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const T = THREE;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad3 = n => String(Math.max(0, Math.round(n))).padStart(3, '0');
  const SVGNS = 'http://www.w3.org/2000/svg';
  const UP = new T.Vector3(0, 1, 0);
  const QUERY = new URLSearchParams(location.search);

  const PARTS = window.InspireModel.PARTS;
  const PART_BY_ID = Object.fromEntries(PARTS.map(p => [p.id, p]));
  const PRIMARY = ['airframe', 'gimbal', 'battery', 'motors', 'props', 'gear'];
  const PRIMARY_MOBILE = ['airframe', 'gimbal', 'battery', 'motors'];

  const OVERVIEW = {
    idx: '00',
    type: 'SYSTEM OVERVIEW / 整机概览',
    code: 'T740 / FLAGSHIP AERIAL PLATFORM',
    cn: 'DJI INSPIRE 3',
    en: 'CINEMA-GRADE AERIAL SYSTEM',
    tags: ['35mm 全画幅', '8K/75 ProRes RAW', '28 min 续航', 'O3 Pro 15 km', '厘米级 RTK'],
    desc: 'Inspire 3 是为电影级空中影像打造的一体化平台：全画幅 8K 云台相机、O3 Pro 图传、双电冗余与厘米级 RTK 被压缩进 3995 g 的机身。点击任意部件，开始逐层拆解这套飞行系统。',
    specs: [
      ['整机重量', '约 3995 g'],
      ['最大飞行速度', '94 km/h'],
      ['最长飞行时间', '28 min（起落架放下）'],
      ['图传 / 定位', 'O3 Pro 15 km · RTK 1 cm']
    ],
    depth: 0,
    mass: 3995
  };

  const state = {
    current: 0,
    target: 0,
    selected: null,
    // in fully-assembled view a click lifts out only this part; full teardown
    // keeps its previous select-highlight behaviour
    isolate: null,
    hovered: null,
    auto: false,
    ready: false,
    dragging: false,
    view: 'iso'
  };

  // Performance defaults: this scene is intentionally HUD-heavy, so keep the
  // GPU budget modest and let the adaptive scaler below trade pixels for fps.
  const LOW_QUALITY = QUERY.get('quality') === 'low';
  const DPR_CAP = 1.35;

  const renderer = (() => {
    try {
      const r = new T.WebGLRenderer({
        canvas: $('#stage'),
        antialias: (window.devicePixelRatio || 1) <= 1.01 && !LOW_QUALITY,
        alpha: true,
        powerPreference: 'high-performance'
      });
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, LOW_QUALITY ? 1 : DPR_CAP));
      r.setSize(window.innerWidth, window.innerHeight);
      r.outputEncoding = T.sRGBEncoding;
      r.toneMapping = T.ACESFilmicToneMapping;
      r.toneMappingExposure = 0.92;
      // real-time shadows are expensive on software WebGL (headless QA);
      // detect software rasterizers and degrade gracefully.
      let gpuName = '';
      try {
        const gl = r.getContext();
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        gpuName = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
      } catch (e) { /* ignore */ }
      const softwareGL = /swiftshader|llvmpipe|software|basic render/i.test(gpuName);
      window.__INSPIRE_GPU = gpuName;
      window.__INSPIRE_SOFTWARE_GL = softwareGL;
      r.shadowMap.enabled = QUERY.has('forceshadow') || QUERY.get('quality') === 'high';
      r.shadowMap.type = T.PCFShadowMap;
      // If the browser fell back to a software rasterizer (common when GPU
      // acceleration is off), drop the internal resolution and all costly
      // decorative compositing so the page remains usable.
      if (softwareGL) {
        r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 0.85));
        document.body.classList.add('is-lite');
      }
      return r;
    } catch (err) {
      console.error('WebGL unavailable', err);
      $('#boot-phase').textContent = 'WEBGL INIT FAILED · 请使用现代浏览器';
      $('#boot-pct').textContent = 'ERR';
      throw err;
    }
  })();

  document.body.classList.add('is-booting');

  /* ════════════════════════════════════════════════════════════
     SCENE
     ════════════════════════════════════════════════════════════ */
  const scene = new T.Scene();
  scene.fog = new T.FogExp2(0x03070a, 0.0135);

  const camera = new T.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 160);
  const controls = new T.OrbitControls(camera, $('#stage'));
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.85;
  controls.panSpeed = 0.55;
  controls.minDistance = 5.2;
  controls.maxDistance = 36;
  controls.minPolarAngle = 0.055;
  controls.maxPolarAngle = 1.545;
  controls.target.set(0, -0.18, 0);
  controls.screenSpacePanning = false;

  const Y_AXIS = new T.Vector3(0, 1, 0);
  const VIEW_DIR = {
    iso: new T.Vector3(0.82, 0.42, 0.92).normalize(),
    front: new T.Vector3(0, 0.08, 1).normalize(),
    side: new T.Vector3(1, 0.07, 0.02).normalize(),
    top: new T.Vector3(0.02, 1, 0.025).normalize()
  };
  const VIEW_TARGET = new T.Vector3(0, -0.18, 0);

  function frameDistance() {
    const a = window.innerWidth / window.innerHeight;
    let d = 13.6;
    if (a < 1.55) d = 15.2;
    if (a < 1.2) d = 17.8;
    if (a < 0.95) d = 21.0;
    if (a < 0.75) d = 25.6;
    if (a < 0.6) d = 29.5;
    return d;
  }

  function getView(name) {
    const target = VIEW_TARGET.clone();
    target.y += state.current * 0.26;
    const dir = (VIEW_DIR[name] || VIEW_DIR.iso).clone();
    const d = frameDistance() * (state.current > 0.28 ? 1.13 : 1);
    return { pos: target.clone().addScaledVector(dir, d), target };
  }

  /* ── environment / lighting ─────────────────────────────── */
  function makeEnvironment() {
    const size = 128;
    const faces = [];
    const patchesByFace = [
      [[0.72, 0.26, 0.62, 'rgba(160,235,255,.62)'], [0.25, 0.75, 0.5, 'rgba(45,120,145,.35)']],
      [[0.28, 0.3, 0.66, 'rgba(255,150,85,.46)'], [0.8, 0.7, 0.4, 'rgba(20,60,75,.3)']],
      [[0.5, 0.5, 0.8, 'rgba(200,240,255,.82)']],
      [[0.5, 0.5, 0.7, 'rgba(3,6,8,.9)']],
      [[0.36, 0.3, 0.6, 'rgba(100,210,235,.5)'], [0.8, 0.8, 0.5, 'rgba(255,125,60,.35)']],
      [[0.5, 0.4, 0.7, 'rgba(38,88,105,.35)']]
    ];
    for (let i = 0; i < 6; i++) {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const lg = ctx.createLinearGradient(0, 0, 0, size);
      lg.addColorStop(0, i === 2 ? '#b8dce8' : i === 3 ? '#020304' : '#0b171c');
      lg.addColorStop(0.5, i === 2 ? '#546f7b' : i === 3 ? '#010202' : '#060e12');
      lg.addColorStop(1, i === 2 ? '#a5c8d6' : '#010203');
      ctx.fillStyle = lg;
      ctx.fillRect(0, 0, size, size);
      (patchesByFace[i] || []).forEach(p => {
        const grad = ctx.createRadialGradient(p[0] * size, p[1] * size, 0, p[0] * size, p[1] * size, p[2] * size);
        grad.addColorStop(0, p[3]);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, size, size);
      });
      faces.push(c);
    }
    const cube = new T.CubeTexture(faces);
    cube.needsUpdate = true;
    cube.encoding = T.sRGBEncoding;
    try {
      const pmrem = new T.PMREMGenerator(renderer);
      pmrem.compileCubemapShader();
      const env = pmrem.fromCubemap(cube).texture;
      pmrem.dispose();
      return env;
    } catch (e) {
      console.warn('PMREM unavailable, using raw cube', e);
      return cube;
    }
  }
  scene.environment = makeEnvironment();

  const hemi = new T.HemisphereLight(0xbfe7f2, 0x04070a, 0.34);
  scene.add(hemi);

  const keyLight = new T.DirectionalLight(0xfff2e4, 1.75);
  keyLight.position.set(7, 12, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.left = -6.5;
  keyLight.shadow.camera.right = 6.5;
  keyLight.shadow.camera.top = 6.5;
  keyLight.shadow.camera.bottom = -6.5;
  keyLight.shadow.camera.near = 1;
  keyLight.shadow.camera.far = 40;
  keyLight.shadow.bias = -0.00045;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);
  scene.add(keyLight.target);

  const rimLight = new T.DirectionalLight(0x55e3ff, 1.2);
  rimLight.position.set(-8, 4.5, -6);
  scene.add(rimLight);

  const warmFill = new T.DirectionalLight(0xff8a3d, 0.62);
  warmFill.position.set(3, 2.5, -8);
  scene.add(warmFill);

  // two cheap fill lights were removed: every extra light recompiles the scene's
  // shader programs, and on low-end GPUs that killed the frame rate.

  /* ── procedural glows / textures ────────────────────────── */
  function radialTexture(inner, mid, outer, stops) {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(128, 128, inner, 128, 128, 128);
    (stops || [[0, inner], [0.45, mid], [1, outer]]).forEach(s => g.addColorStop(s[0], s[1]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    return tex;
  }
  const softWhite = radialTexture(0, 60, 128, [
    [0, 'rgba(255,255,255,.8)'],
    [0.25, 'rgba(255,255,255,.42)'],
    [0.65, 'rgba(255,255,255,.08)'],
    [1, 'rgba(255,255,255,0)']
  ]);

  function makeGroundGlow(color, opacity, size) {
    const mesh = new T.Mesh(
      new T.PlaneGeometry(size, size),
      new T.MeshBasicMaterial({
        map: softWhite,
        color,
        transparent: true,
        opacity,
        blending: T.AdditiveBlending,
        depthWrite: false
      })
    );
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  /* ════════════════════════════════════════════════════════════
     FLOOR / STAGE
     ════════════════════════════════════════════════════════════ */
  const FLOOR_Y = -1.5;

  const gridMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uColor: { value: new T.Color(0x2c8395) },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vWorld;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vWorld;
      float gridLine(vec2 p, float s) {
        vec2 c = p / s;
        vec2 g = abs(fract(c - 0.5) - 0.5) / fwidth(c);
        return 1.0 - min(min(g.x, g.y), 1.0);
      }
      void main() {
        float d = length(vWorld.xz);
        float fade = (1.0 - smoothstep(7.0, 33.0, d)) * smoothstep(2.9, 4.4, d);
        float major = gridLine(vWorld.xz, 3.2) * 0.68;
        float minor = gridLine(vWorld.xz, 0.8) * 0.16;
        float lines = max(major, minor);
        float ring = smoothstep(0.028, 0.0, abs(d - 6.9)) * 0.1;
        float sweep = smoothstep(0.05, 0.0, abs(d - (5.0 + sin(uTime * 0.22) * 0.6))) * 0.045;
        vec3 col = uColor * (lines + ring + sweep);
        float alpha = (lines + ring + sweep) * fade;
        gl_FragColor = vec4(col, alpha);
      }
    `,
    extensions: { derivatives: true }
  });
  const grid = new T.Mesh(new T.PlaneGeometry(90, 90), gridMaterial);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = FLOOR_Y;
  grid.frustumCulled = false;
  scene.add(grid);

  // shadow catcher
  const shadowPlane = new T.Mesh(
    new T.PlaneGeometry(28, 28),
    new T.ShadowMaterial({ color: 0x000000, opacity: 0.5 })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = FLOOR_Y + 0.012;
  shadowPlane.receiveShadow = true;
  shadowPlane.visible = renderer.shadowMap.enabled;
  scene.add(shadowPlane);

  // central technical pad — dark anodized plate with etched markings
  function makePadTexture() {
    const S = 1024;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const ctx = c.getContext('2d');
    const cx = S / 2, cy = S / 2;
    const base = ctx.createRadialGradient(cx, cy, 30, cx, cy, 512);
    base.addColorStop(0, '#0d2026');
    base.addColorStop(0.55, '#081418');
    base.addColorStop(1, '#03080b');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, S, S);
    ctx.save();
    ctx.translate(cx, cy);
    // concentric etched rings
    [150, 210, 268, 330, 392, 452].forEach((r, i) => {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.strokeStyle = i === 3 ? 'rgba(255,138,61,.30)' : 'rgba(85,227,255,.13)';
      ctx.lineWidth = i === 3 ? 3 : 1.5;
      ctx.setLineDash(i === 2 || i === 5 ? [10, 14] : []);
      ctx.stroke();
    });
    ctx.setLineDash([]);
    // tick ring
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      const long = i % 6 === 0;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 462, Math.sin(a) * 462);
      ctx.lineTo(Math.cos(a) * (long ? 486 : 476), Math.sin(a) * (long ? 486 : 476));
      ctx.strokeStyle = long ? 'rgba(120,230,255,.34)' : 'rgba(120,230,255,.14)';
      ctx.lineWidth = long ? 2 : 1;
      ctx.stroke();
    }
    // crosshair arms
    ctx.strokeStyle = 'rgba(85,227,255,.16)';
    ctx.lineWidth = 1.5;
    [[0, -1], [0, 1], [-1, 0], [1, 0]].forEach(([dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(dx * 30, dy * 30);
      ctx.lineTo(dx * 120, dy * 120);
      ctx.stroke();
    });
    // radial hatch wedges
    ctx.fillStyle = 'rgba(85,227,255,.075)';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(250, -12, 72, 24);
      ctx.restore();
    }
    // amber marker arc
    ctx.beginPath();
    ctx.arc(0, 0, 330, -0.45, 0.35);
    ctx.strokeStyle = 'rgba(255,138,61,.42)';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  const pad = new T.Mesh(
    new T.CircleGeometry(3.05, 96),
    new T.MeshStandardMaterial({
      map: makePadTexture(),
      color: 0xffffff,
      metalness: 0.28,
      roughness: 0.86,
      envMapIntensity: 0.28
    })
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = FLOOR_Y + 0.018;
  pad.receiveShadow = true;
  scene.add(pad);

  const padRing = new T.Mesh(
    new T.RingGeometry(3.03, 3.078, 128),
    new T.MeshBasicMaterial({ color: 0x55e3ff, transparent: true, opacity: 0.16, side: T.DoubleSide, depthWrite: false })
  );
  padRing.rotation.x = -Math.PI / 2;
  padRing.position.y = FLOOR_Y + 0.026;
  scene.add(padRing);

  // always-on contact shadow (grounding even without real-time shadow maps)
  const contactShadow = new T.Mesh(
    new T.PlaneGeometry(7.4, 7.4),
    new T.MeshBasicMaterial({
      map: softWhite,
      color: 0x000000,
      transparent: true,
      opacity: 0.5,
      depthWrite: false
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = FLOOR_Y + 0.034;
  contactShadow.renderOrder = 2;
  scene.add(contactShadow);

  // soft floor glows
  const coolPool = makeGroundGlow(0x2fc7df, 0.08, 9);
  coolPool.position.set(0, FLOOR_Y + 0.03, 0);
  scene.add(coolPool);
  const warmPool = makeGroundGlow(0xff7a2f, 0.03, 17);
  warmPool.position.set(1.4, FLOOR_Y + 0.032, -3.0);
  scene.add(warmPool);

  // dashed orbit rings
  function addOrbitRing(radius, color, opacity, dash, gap, y) {
    const pts = [];
    for (let i = 0; i <= 160; i++) {
      const a = (i / 160) * Math.PI * 2;
      pts.push(new T.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
    }
    const geo = new T.BufferGeometry().setFromPoints(pts);
    const mat = new T.LineDashedMaterial({
      color,
      transparent: true,
      opacity,
      dashSize: dash || 0.2,
      gapSize: gap || 0.2,
      depthWrite: false
    });
    const line = new T.LineLoop(geo, mat);
    line.computeLineDistances();
    line.position.y = y || FLOOR_Y + 0.035;
    scene.add(line);
    return line;
  }
  addOrbitRing(4.4, 0x4f9bab, 0.26, 0.22, 0.17);
  addOrbitRing(6.3, 0x327482, 0.18, 0.4, 0.28);
  addOrbitRing(8.6, 0x2b6471, 0.11, 0.6, 0.5);

  // rotating scan arc
  const scanParent = new T.Group();
  scanParent.rotation.x = -Math.PI / 2;
  scanParent.position.y = FLOOR_Y + 0.042;
  const scanArc = new T.Mesh(
    new T.RingGeometry(4.95, 5.03, 80, 1, 0, Math.PI * 0.52),
    new T.MeshBasicMaterial({
      color: 0x6cecff,
      transparent: true,
      opacity: 0.3,
      side: T.DoubleSide,
      blending: T.AdditiveBlending,
      depthWrite: false
    })
  );
  scanParent.add(scanArc);
  scene.add(scanParent);

  // compass ticks
  (function addTicks() {
    const cyan = [], amber = [];
    const R0 = 8.38, R1 = 8.62;
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const long = i % 12 === 0;
      const inner = long ? 8.24 : R0;
      const target = i === 8 || i === 9 || i === 88 ? amber : cyan;
      target.push(
        Math.cos(a) * inner, 0, Math.sin(a) * inner,
        Math.cos(a) * R1, 0, Math.sin(a) * R1
      );
    }
    function mk(arr, color, opacity) {
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(arr, 3));
      const mat = new T.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
      const lines = new T.LineSegments(geo, mat);
      lines.position.y = FLOOR_Y + 0.04;
      scene.add(lines);
    }
    mk(cyan, 0x4c93a2, 0.34);
    mk(amber, 0xff8a3d, 0.6);
  })();

  /* ── floating dust ──────────────────────────────────────── */
  const dustCount = 230;
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSpeeds = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    const r = 2.5 + Math.random() * 9.5;
    const a = Math.random() * Math.PI * 2;
    dustPositions[i * 3] = Math.cos(a) * r;
    dustPositions[i * 3 + 1] = -0.9 + Math.random() * 5.2;
    dustPositions[i * 3 + 2] = Math.sin(a) * r;
    dustSpeeds[i] = 0.04 + Math.random() * 0.12;
  }
  const dustGeo = new T.BufferGeometry();
  dustGeo.setAttribute('position', new T.BufferAttribute(dustPositions, 3));
  const dust = new T.Points(
    dustGeo,
    new T.PointsMaterial({
      color: 0x8fdfe9,
      size: 0.035,
      map: softWhite,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: T.AdditiveBlending,
      sizeAttenuation: true
    })
  );
  scene.add(dust);

  // distant glow sprites
  function makeGlowSprite(color, opacity, scale, x, y, z) {
    const mat = new T.SpriteMaterial({
      map: softWhite,
      color,
      transparent: true,
      opacity,
      blending: T.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    });
    const sprite = new T.Sprite(mat);
    sprite.scale.set(scale, scale, 1);
    sprite.position.set(x, y, z);
    sprite.renderOrder = -2;
    scene.add(sprite);
    return sprite;
  }
  const topGlow = makeGlowSprite(0xff7a2f, 0.07, 14, 0, 3.8, -7);
  const sideGlow = makeGlowSprite(0x2fc7df, 0.05, 16, -7, 1.8, -5);

  /* ════════════════════════════════════════════════════════════
     MODEL
     ════════════════════════════════════════════════════════════ */
  const built = window.InspireModel.build();
  const modelRoot = built.root;
  const partGroups = built.partGroups;
  const partMap = built.partMap;
  const MODEL_BASE_Y = -0.16;
  modelRoot.position.y = MODEL_BASE_Y;
  scene.add(modelRoot);

  // give every group a small stagger for the teardown wave
  partGroups.forEach((pg, i) => {
    pg.delay = ((i * 2.3) % 12) / 12 * 0.16;
    pg.spin = new T.Vector3(
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05,
      (Math.random() - 0.5) * 0.05
    );
  });

  // Single-part extraction: one shared vector per module id, so parts made of
  // several groups (airframe, four arms, four gear legs) lift out intact.
  const EXTRACT = {
    airframe:     [0, 1.35, 0.55],
    arms:         [0, 1.00, 0.35],
    motors:       [0, 1.25, 0.35],
    props:        [0, 1.55, 0.35],
    gimbal:       [1.25, 2.55, 0.35],
    lens:         [0.95, 2.15, 0.65],
    battery:      [0, 1.10, -0.90],
    sensors:      [0.70, 1.45, 0.40],
    gear:         [0.85, 2.15, 0.55],
    transmission: [0, 1.00, -0.90],
    rtk:          [0, 1.55, -0.80],
    ssd:          [-0.80, 0.90, -1.00]
  };
  partGroups.forEach(pg => {
    pg.iso = 0;
    const e = EXTRACT[pg.id] || [0, 1.1, 0.4];
    pg.extract = new T.Vector3(e[0], e[1], e[2]);
  });
  // a gimbal is presented as a complete camera unit: its lens rides along
  // visually, but selecting the lens still detaches only the lens
  const ISO_FOLLOW = { gimbal: ['lens'] };
  const extractById = {};
  partGroups.forEach(pg => {
    if (!extractById[pg.id]) extractById[pg.id] = pg.extract;
  });

  // selection halo
  const halos = new T.Group();
  scene.add(halos);
  const haloBig = new T.Sprite(new T.SpriteMaterial({
    map: softWhite,
    color: 0x55e3ff,
    transparent: true,
    opacity: 0.15,
    blending: T.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  }));
  haloBig.scale.set(2.6, 2.6, 1);
  haloBig.renderOrder = 8;
  halos.add(haloBig);
  const haloCore = new T.Sprite(new T.SpriteMaterial({
    map: softWhite,
    color: 0x9cf4ff,
    transparent: true,
    opacity: 0.22,
    blending: T.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  }));
  haloCore.scale.set(1.1, 1.1, 1);
  haloCore.renderOrder = 9;
  halos.add(haloCore);
  halos.visible = false;

  const hoverHalo = new T.Sprite(new T.SpriteMaterial({
    map: softWhite,
    color: 0x55e3ff,
    transparent: true,
    opacity: 0.2,
    blending: T.AdditiveBlending,
    depthWrite: false,
    depthTest: false
  }));
  hoverHalo.scale.set(0.9, 0.9, 1);
  hoverHalo.visible = false;
  hoverHalo.renderOrder = 7;
  scene.add(hoverHalo);

  /* ════════════════════════════════════════════════════════════
     CAMERA TWEENING / VIEWS
     ════════════════════════════════════════════════════════════ */
  let camTween = null;
  const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function tweenCamera(pos, target, duration) {
    if (!duration) {
      camera.position.copy(pos);
      controls.target.copy(target);
      controls.update();
      return;
    }
    camTween = {
      fromPos: camera.position.clone(),
      toPos: pos.clone(),
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
      t: 0,
      duration
    };
  }

  function updateCameraTween(dt) {
    if (!camTween) return;
    camTween.t += dt;
    const k = easeInOutCubic(clamp(camTween.t / camTween.duration, 0, 1));
    camera.position.lerpVectors(camTween.fromPos, camTween.toPos, k);
    controls.target.lerpVectors(camTween.fromTarget, camTween.toTarget, k);
    controls.update();
    if (k >= 1) camTween = null;
  }

  function setView(name, opts) {
    opts = opts || {};
    state.view = name;
    setAuto(false, true);
    if (!opts.silent) hideHint();
    const v = getView(name);
    tweenCamera(v.pos, v.target, opts.instant ? 0 : 1.1);
    $$('.view-btn[data-view]').forEach(b => {
      b.classList.toggle('is-active', b.dataset.view === name);
    });
  }

  function setAuto(on, silent) {
    state.auto = !!on;
    const btn = $('#btn-auto');
    btn.classList.toggle('is-active', state.auto);
    btn.setAttribute('aria-pressed', String(state.auto));
    if (!silent && state.auto) showToast('自动环绕已开启 · 拖拽可随时接管');
  }

  // initial camera: far, cinematic angle
  (function placeInitialCamera() {
    const target = VIEW_TARGET.clone();
    const dir = VIEW_DIR.iso.clone().applyAxisAngle(Y_AXIS, -0.38);
    const dist = frameDistance() * 1.34;
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.position.y += 1.6;
    controls.target.copy(target);
    controls.update();
  })();

  /* ════════════════════════════════════════════════════════════
     HUD / DATA
     ════════════════════════════════════════════════════════════ */
  function setDossier(part) {
    const d = part || OVERVIEW;
    $('#dossier-num').textContent = d.idx;
    $('#dossier-type').textContent = d.type;
    $('#dossier-code').textContent = d.code;
    $('#dossier-cn').textContent = d.cn;
    $('#dossier-en').textContent = d.en;
    $('#dossier-code-hint').textContent = part ? d.code : 'T740';
    $('#dossier-tags').innerHTML = (d.tags || []).map(t => `<span class="tag">${t}</span>`).join('');
    $('#dossier-desc').textContent = d.desc;
    $('#dossier-specs').innerHTML = (d.specs || [])
      .map(s => `<div class="spec-row"><dt>${s[0]}</dt><dd>${s[1]}</dd></div>`).join('');

    const depth = part ? part.depth : 0;
    const mass = part ? part.mass : 3995;
    const pct = clamp(mass / 3995 * 100, 0, 100);
    $('#meter-depth').style.width = depth + '%';
    $('#meter-depth-label').textContent = pad3(depth) + '%';
    $('#meter-mass').style.width = pct.toFixed(1) + '%';
    $('#meter-mass-label').textContent = `${mass.toLocaleString('en-US')} g · ${pct.toFixed(1)}%`;
    $('#meter-mass-label-main').textContent = part ? 'MASS / MODULE' : 'MASS / TOTAL';

    const dossier = $('#dossier');
    if (dossier.animate) {
      dossier.animate(
        [{ opacity: 0.35, transform: 'translateY(4px)' }, { opacity: 1, transform: 'translateY(0)' }],
        { duration: 260, easing: 'cubic-bezier(.22,.75,.25,1)' }
      );
    }
  }

  function buildPartList() {
    const ol = $('#part-list');
    ol.innerHTML = '';
    PARTS.forEach(p => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'part-row';
      btn.type = 'button';
      btn.dataset.part = p.id;
      btn.setAttribute('aria-label', `${p.idx} ${p.cn}，查看技术档案`);
      btn.innerHTML = `
        <span class="row-num">${p.idx}</span>
        <span class="row-main"><span class="row-cn">${p.cn}</span><span class="row-en">${p.en}</span></span>
        <span class="row-code">${p.code.replace('TR-740-', 'T-')}</span>`;
      btn.addEventListener('click', () => {
        selectPart(p.id, { openDossier: true });
      });
      li.appendChild(btn);
      ol.appendChild(li);
    });
  }
  buildPartList();

  function setActiveRow(id) {
    $$('.part-row').forEach(b => {
      const on = b.dataset.part === id;
      b.classList.toggle('is-active', on);
      if (on) b.setAttribute('aria-current', 'true');
      else b.removeAttribute('aria-current');
    });
  }

  /* ── labels / leaders ───────────────────────────────────── */
  const leaderSVG = $('#leaders');
  const labelLayer = $('#labels');
  const labelEls = {};
  const labelLeaders = {};
  const labelState = {};
  let svgW = window.innerWidth, svgH = window.innerHeight;
  const safe = { left: 20, right: 20, top: 130, bottom: 20 };

  function createLabel(p, i) {
    const el = document.createElement('button');
    el.className = 'map-label';
    el.type = 'button';
    el.dataset.part = p.id;
    el.setAttribute('aria-label', `${p.idx} ${p.cn}`);
    el.innerHTML = `<span class="ml-idx">${p.idx}</span><span class="ml-copy"><b>${p.cn}</b><small>${p.en}</small><span class="ml-spec">${p.specs[0][1]}</span></span>`;
    el.addEventListener('click', e => {
      e.stopPropagation();
      selectPart(p.id, { openDossier: true });
    });
    el.addEventListener('pointerenter', () => {
      if (state.ready) hideHint();
    });
    labelLayer.appendChild(el);

    const g = document.createElementNS(SVGNS, 'g');
    g.style.opacity = '0';
    const halo = document.createElementNS(SVGNS, 'circle');
    halo.setAttribute('class', 'leader-halo');
    halo.setAttribute('r', '4.6');
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('class', 'leader-line');
    const dot = document.createElementNS(SVGNS, 'circle');
    dot.setAttribute('class', 'leader-dot');
    dot.setAttribute('r', '1.5');
    g.appendChild(halo);
    g.appendChild(path);
    g.appendChild(dot);
    leaderSVG.appendChild(g);

    labelEls[p.id] = el;
    labelLeaders[p.id] = { g, halo, path, dot };
    labelState[p.id] = { x: 0, y: 0, w: 120, h: 28, init: false, visible: false, opacity: 0 };
  }

  PARTS.forEach(createLabel);

  function measureLabels() {
    PARTS.forEach(p => {
      const el = labelEls[p.id];
      if (el) {
        labelState[p.id].w = el.offsetWidth || 120;
        labelState[p.id].h = el.offsetHeight || 26;
      }
    });
  }

  function measureSafeArea() {
    const w = window.innerWidth, h = window.innerHeight;
    svgW = w; svgH = h;
    leaderSVG.setAttribute('viewBox', `0 0 ${w} ${h}`);
    const dock = $('.bottom-dock').getBoundingClientRect();
    safe.top = w > 1120 ? 122 : 112;
    safe.bottom = dock.top - (w > 760 ? 20 : 12);
    if (w > 1120) {
      const lp = $('#panel-left').getBoundingClientRect();
      const rp = $('#panel-right').getBoundingClientRect();
      safe.left = lp.right + 16;
      safe.right = rp.left - 16;
    } else {
      safe.left = 12;
      safe.right = w - 12;
    }
    if (safe.right - safe.left < 260) {
      safe.left = 10;
      safe.right = w - 10;
    }
    measureLabels();
  }

  function currentVisibility(p) {
    if (!state.ready) return false;
    if (p.id === state.selected || p.id === state.hovered) return true;
    const w = window.innerWidth;
    const idx = Number(p.idx) || 1;
    if (w <= 760) {
      return state.current > 0.34 && PRIMARY_MOBILE.includes(p.id);
    }
    // assembled hero stays clean; labels cascade in with the teardown
    if (state.current > 0.1 + idx * 0.019) return true;
    if (w <= 1120) return false;
    return false;
  }

  const tmpV = new T.Vector3();
  const centerScreen = { x: 0, y: 0 };
  let labelLayoutTime = 0;

  function layoutLabels(dt) {
    if (!state.ready) {
      PARTS.forEach(p => {
        labelEls[p.id].classList.remove('is-visible');
        labelLeaders[p.id].g.style.opacity = '0';
      });
      return;
    }
    const w = window.innerWidth;
    const centerPos = tmpV.set(0, 0.15, 0).project(camera);
    centerScreen.x = clamp((centerPos.x * 0.5 + 0.5) * svgW, safe.left, safe.right);
    centerScreen.y = clamp((-centerPos.y * 0.5 + 0.5) * svgH, safe.top, safe.bottom);

    const items = [];
    PARTS.forEach((p, i) => {
      const el = labelEls[p.id];
      const ls = labelState[p.id];
      const show = currentVisibility(p);
      el.classList.toggle('is-current', p.id === state.selected);
      if (!show) {
        el.classList.remove('is-visible');
        labelLeaders[p.id].g.style.opacity = '0';
        ls.visible = false;
        return;
      }
      const anchor = labelAnchor(p.id);
      if (!anchor) return;
      anchor.getWorldPosition(tmpV);
      const proj = tmpV.clone().project(camera);
      if (proj.z > 1) {
        el.classList.remove('is-visible');
        labelLeaders[p.id].g.style.opacity = '0';
        ls.visible = false;
        return;
      }
      const ax = (proj.x * 0.5 + 0.5) * svgW;
      const ay = (-proj.y * 0.5 + 0.5) * svgH;
      if (ax < -80 || ax > svgW + 80 || ay < -80 || ay > svgH + 80) {
        el.classList.remove('is-visible');
        labelLeaders[p.id].g.style.opacity = '0';
        ls.visible = false;
        return;
      }
      const dx = ax - centerScreen.x;
      const dy = ay - centerScreen.y;
      const len = Math.hypot(dx, dy);
      let ux, uy;
      if (len > 12) { ux = dx / len; uy = dy / len; }
      else {
        const a = -Math.PI / 2 + (i / PARTS.length) * Math.PI * 2;
        ux = Math.cos(a); uy = Math.sin(a);
      }
      const push = 42 + Math.min(ls.w, 156) * 0.2;
      let tx = ax + ux * push;
      let ty = ay + uy * push;
      tx = clamp(tx, safe.left + ls.w / 2 + 5, safe.right - ls.w / 2 - 5);
      ty = clamp(ty, safe.top + ls.h / 2 + 4, safe.bottom - ls.h / 2 - 4);
      items.push({ id: p.id, ax, ay, tx, ty, w: ls.w, h: ls.h, el });
      ls.visible = true;
    });

    // ── full-teardown: lay the callouts out as two clean schematic columns
    const columnMode = state.current > 0.72 && items.length > 6;
    if (columnMode) {
      const sorted = items.slice().sort((a, b) => a.ax - b.ax);
      const half = Math.ceil(sorted.length / 2);
      [sorted.slice(0, half), sorted.slice(half)].forEach((col, ci) => {
        col.sort((a, b) => a.ay - b.ay);
        const top = safe.top + 36;
        const bottom = safe.bottom - 34;
        const step = Math.min(62, (bottom - top) / Math.max(1, col.length - 1));
        const start = (top + bottom) / 2 - (step * (col.length - 1)) / 2;
        col.forEach((it, k) => {
          it.tx = ci === 0 ? safe.left + 10 + it.w / 2 : safe.right - 10 - it.w / 2;
          it.ty = start + k * step;
        });
      });
    } else {
      // rectangle separation, deterministic per frame
      const gapX = 9, gapY = 7;
      for (let iter = 0; iter < 8; iter++) {
        let moved = false;
        for (let a = 0; a < items.length; a++) {
          for (let b = a + 1; b < items.length; b++) {
            const A = items[a], B = items[b];
            const dx = A.tx - B.tx, dy = A.ty - B.ty;
            const ox = (A.w + B.w) / 2 + gapX - Math.abs(dx);
            const oy = (A.h + B.h) / 2 + gapY - Math.abs(dy);
            if (ox > 0 && oy > 0) {
              moved = true;
              if (oy < ox * 1.1) {
                const push = oy / 2 + 0.4;
                const s = dy === 0 ? (a % 2 ? 1 : -1) : Math.sign(dy);
                A.ty += push * s;
                B.ty -= push * s;
              } else {
                const push = ox / 2 + 0.4;
                const s = dx === 0 ? (b % 2 ? 1 : -1) : Math.sign(dx);
                A.tx += push * s;
                B.tx -= push * s;
              }
            }
          }
        }
        items.forEach(it => {
          it.tx = clamp(it.tx, safe.left + it.w / 2 + 5, safe.right - it.w / 2 - 5);
          it.ty = clamp(it.ty, safe.top + it.h / 2 + 4, safe.bottom - it.h / 2 - 4);
        });
        if (!moved) break;
      }
    }

    const smooth = 1 - Math.exp(-dt * 13);
    items.forEach(it => {
      const ls = labelState[it.id];
      if (!ls.init) {
        ls.x = it.tx; ls.y = it.ty; ls.init = true;
      } else {
        ls.x += (it.tx - ls.x) * smooth;
        ls.y += (it.ty - ls.y) * smooth;
      }
      it.el.style.left = ls.x.toFixed(1) + 'px';
      it.el.style.top = ls.y.toFixed(1) + 'px';
      it.el.classList.add('is-visible');

      // leader geometry
      const lead = labelLeaders[it.id];
      lead.g.style.opacity = '1';
      const cx = ls.x, cy = ls.y;
      const dx = it.ax - cx, dy = it.ay - cy;
      const tx = dx !== 0 ? (it.w / 2) / Math.abs(dx) : Infinity;
      const ty = dy !== 0 ? (it.h / 2) / Math.abs(dy) : Infinity;
      const tEdge = Math.min(tx, ty);
      const ex = cx + dx * (Number.isFinite(tEdge) ? tEdge : 0);
      const ey = cy + dy * (Number.isFinite(tEdge) ? tEdge : 0);
      lead.path.setAttribute('d', `M${it.ax.toFixed(1)} ${it.ay.toFixed(1)}L${ex.toFixed(1)} ${ey.toFixed(1)}`);
      lead.halo.setAttribute('cx', it.ax.toFixed(1));
      lead.halo.setAttribute('cy', it.ay.toFixed(1));
      lead.dot.setAttribute('cx', it.ax.toFixed(1));
      lead.dot.setAttribute('cy', it.ay.toFixed(1));
      const on = it.id === state.selected;
      lead.path.classList.toggle('is-current', on);
      lead.dot.classList.toggle('is-current', on);
      lead.halo.classList.toggle('is-current', on);
      lead.halo.setAttribute('r', on ? (5.2 + Math.sin(labelLayoutTime * 3) * 0.8).toFixed(2) : '4.2');
    });
    labelLayoutTime += dt;

    // current label gets priority styling
    PARTS.forEach(p => {
      if (labelLeaders[p.id]) labelEls[p.id].classList.toggle('is-current', p.id === state.selected);
    });
  }

  function labelAnchor(id) {
    const pm = partMap[id];
    return pm ? pm.anchor : null;
  }

  /* ════════════════════════════════════════════════════════════
     EXPLOSION
     ════════════════════════════════════════════════════════════ */
  const explodeValue = $('#explode-value');
  const range = $('#explode-range');
  const rangeFill = $('#range-fill');
  const rangeThumb = $('#range-thumb');
  const explodeBtn = $('#btn-explode');
  const explodeCopy = $('#btn-explode-copy');
  const explodeSub = $('#btn-explode-sub');
  const rangeLabels = $$('.range-labels span');

  function updateExplodeUI(targetValue) {
    const p = Math.round(targetValue * 100);
    explodeValue.textContent = pad3(p);
    range.value = String(p);
    rangeFill.style.width = p + '%';
    rangeThumb.style.left = p + '%';
    const exploded = targetValue > 0.5;
    explodeBtn.classList.toggle('is-exploded', exploded);
    explodeBtn.setAttribute('aria-pressed', String(exploded));
    explodeCopy.textContent = exploded ? '合拢模块' : '一键拆解';
    explodeSub.textContent = exploded ? 'ASSEMBLE ALL' : 'EXPLODE ALL';
    if (rangeLabels[1]) rangeLabels[1].textContent = `MODULE ${Math.round(targetValue * 12)}/12`;
  }

  function setExplodeTarget(v, opts) {
    opts = opts || {};
    state.target = clamp(v, 0, 1);
    if (state.target > 0.005) state.isolate = null;
    updateExplodeUI(state.target);
    hideHint();
    if (!opts.silent && state.target > 0.98) {
      showToast('拆解协议完成 · 12 个模块已展开');
    } else if (!opts.silent && state.target < 0.02) {
      showToast('模块已合拢 · 整机结构复位');
    }
  }

  function toggleExplode() {
    setExplodeTarget(state.target > 0.5 ? 0 : 1);
    if (state.target > 0.5) setAuto(false, true);
  }

  const smoothstep = t => t * t * (3 - 2 * t);

  function updateExplosion(dt) {
    const diff = state.target - state.current;
    if (Math.abs(diff) > 0.0008) {
      const speed = 0.95 + Math.abs(diff) * 1.6;
      state.current += Math.sign(diff) * Math.min(Math.abs(diff), dt * speed);
    } else {
      state.current = state.target;
    }

    const cur = state.current;
    // extraction only exists while the model is fully assembled
    if (state.isolate && (cur > 0.02 || state.target > 0.02)) state.isolate = null;
    const isoId = state.isolate;
    partGroups.forEach(pg => {
      const local = clamp((cur - pg.delay) / (1 - pg.delay), 0, 1);
      const e = smoothstep(local);
      const follows = !!(isoId && (ISO_FOLLOW[isoId] || []).includes(pg.id));
      const isoGoal = isoId === pg.id || follows ? 1 : 0;
      pg.iso += (isoGoal - pg.iso) * Math.min(1, dt * 5.6);
      if (Math.abs(pg.iso - isoGoal) < 0.001) pg.iso = isoGoal;

      pg.group.position.copy(pg.base).addScaledVector(pg.offset, e);
      if (pg.iso > 0.0005) {
        const ex = follows ? extractById[isoId] : pg.extract;
        pg.group.position.addScaledVector(ex, pg.iso);
      }
      pg.group.rotation.set(
        pg.baseRot.x + pg.spin.x * e,
        pg.baseRot.y + pg.spin.y * e,
        pg.baseRot.z + pg.spin.z * e
      );
    });

    // gently widen the field of view while exploded
    const wantedFov = 38 + smoothstep(cur) * 2.2;
    if (Math.abs(camera.fov - wantedFov) > 0.01) {
      camera.fov += (wantedFov - camera.fov) * Math.min(1, dt * 4);
      camera.updateProjectionMatrix();
    }
  }

  /* ════════════════════════════════════════════════════════════
     HIGHLIGHT / SELECTION
     ════════════════════════════════════════════════════════════ */
  let glowRecords = [];
  let selectionPulse = 0;
  const cyan = new T.Color(0x4fe1ff);

  function clearSelectionGlow() {
    glowRecords.forEach(rec => {
      rec.mesh.material = rec.original;
      rec.clone.dispose();
    });
    glowRecords = [];
    halos.visible = false;
  }

  function applySelectionGlow(id) {
    clearSelectionGlow();
    const pm = partMap[id];
    if (!pm) return;
    pm.groups.forEach(g => {
      g.traverse(o => {
        if (!o.isMesh || !o.material) return;
        const base = o.material;
        if (Array.isArray(base)) return;
        // keep native emissive LEDs untouched
        if (base.emissive && base.emissive.getHex() !== 0 && base.emissiveIntensity > 0.25) return;
        const clone = base.clone();
        o.material = clone;
        glowRecords.push({
          mesh: o,
          original: base,
          clone,
          baseEmissive: base.emissive ? base.emissive.clone() : new T.Color(0),
          baseIntensity: base.emissiveIntensity != null ? base.emissiveIntensity : 0
        });
      });
    });
    halos.visible = true;
  }

  function updateGlow(dt) {
    selectionPulse += dt;
    if (!state.selected) {
      halos.visible = false;
      return;
    }
    const anchor = labelAnchor(state.selected);
    if (!anchor) return;
    anchor.getWorldPosition(tmpV);
    halos.position.copy(tmpV);
    const pulse = 0.5 + 0.5 * Math.sin(selectionPulse * 2.8);
    // an extracted part sits closer to the lens: relax the bloom so its
    // material detail still reads instead of clipping to white
    const soft = state.isolate ? 0.30 : 1;
    const haloScale = state.isolate ? 0.78 : 1;
    haloBig.material.opacity = (0.17 + 0.1 * pulse) * soft;
    haloCore.material.opacity = (0.22 + 0.16 * pulse) * soft;
    haloBig.scale.setScalar((2.6 + pulse * 0.8) * haloScale);
    haloCore.scale.setScalar((1.0 + pulse * 0.3) * haloScale);
    if (glowRecords.length) {
      glowRecords.forEach(rec => {
        if (!rec.clone.emissive) return;
        rec.clone.emissive.copy(rec.baseEmissive).lerp(cyan, 0.86 * soft);
        rec.clone.emissiveIntensity = rec.baseIntensity + (0.5 + pulse * 0.38) * soft;
      });
    }
  }

  function selectPart(id, opts) {
    opts = opts || {};
    if (!PART_BY_ID[id]) return;
    const same = state.selected === id;
    const wasIsolated = state.isolate === id;

    // clicking the extracted part again puts it back
    if (same && wasIsolated) {
      deselect();
      return;
    }

    state.selected = id;
    const assembled = state.target < 0.02 && state.current < 0.02;
    state.isolate = assembled ? id : null;
    setActiveRow(id);
    setDossier(PART_BY_ID[id]);
    applySelectionGlow(id);
    hideHint();
    if (opts.openDossier && window.innerWidth <= 1120) {
      openPanel('right');
    }
    if (window.innerWidth > 1120) {
      $$('.map-label').forEach(l => l.classList.toggle('is-current', l.dataset.part === id));
    }
    if (assembled && !wasIsolated) {
      showToast(`${PART_BY_ID[id].idx} · ${PART_BY_ID[id].cn} 已单独取出 · 再点一次放回`);
    } else if (!same && opts.toast) {
      showToast(`${PART_BY_ID[id].idx} · ${PART_BY_ID[id].cn} 已选中`);
    }
  }

  function deselect() {
    state.isolate = null;
    if (!state.selected) return;
    state.selected = null;
    setActiveRow(null);
    setDossier(null);
    clearSelectionGlow();
    $$('.map-label').forEach(l => l.classList.remove('is-current'));
  }

  /* ════════════════════════════════════════════════════════════
     RAYCASTING / POINTER
     ════════════════════════════════════════════════════════════ */
  const raycaster = new T.Raycaster();
  const pointerNDC = new T.Vector2();
  const pointer = { x: 0, y: 0, inside: false, downX: 0, downY: 0, down: false, moved: false };
  let hoverTimer = 0;
  let pickDirty = false;

  function partIdFromObject(obj) {
    let cur = obj;
    while (cur && cur !== modelRoot) {
      if (cur.userData && cur.userData.partId) return cur.userData.partId;
      cur = cur.parent;
    }
    return null;
  }

  function pickAt(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObject(modelRoot, true);
    for (let i = 0; i < hits.length; i++) {
      const id = partIdFromObject(hits[i].object);
      if (id) return id;
    }
    return null;
  }

  function updateHoverTip(id) {
    const tip = $('#cursor-tip');
    if (!id) {
      tip.classList.remove('is-visible');
      return;
    }
    const p = PART_BY_ID[id];
    tip.querySelector('.cursor-tip-idx').textContent = p.idx;
    tip.querySelector('.cursor-tip-copy b').textContent = p.cn;
    tip.querySelector('.cursor-tip-copy small').textContent = `${p.en} · CLICK TO TEARDOWN`;
    tip.classList.add('is-visible');
    tip.style.left = pointer.x + 'px';
    tip.style.top = pointer.y + 'px';
  }

  function setHovered(id) {
    if (state.hovered === id) return;
    state.hovered = id;
    renderer.domElement.style.cursor = id ? 'pointer' : 'grab';
    updateHoverTip(id);
    if (id) {
      const anchor = labelAnchor(id);
      if (anchor) {
        anchor.getWorldPosition(tmpV);
        hoverHalo.position.copy(tmpV);
        hoverHalo.visible = true;
      }
    } else {
      hoverHalo.visible = false;
    }
  }

  function updateHover(dt) {
    if (!state.ready || !pointer.inside || state.dragging) {
      return;
    }
    hoverTimer += dt;
    if (hoverTimer < 0.075) return;
    hoverTimer = 0;
    const id = pickAt(pointer.x, pointer.y);
    setHovered(id);
  }

  const stage = renderer.domElement;

  stage.addEventListener('pointermove', e => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    pointer.inside = true;
    pointer.moved = true;
    const tip = $('#cursor-tip');
    if (tip.classList.contains('is-visible')) {
      tip.style.left = pointer.x + 'px';
      tip.style.top = pointer.y + 'px';
    }
    pickDirty = true;
  });

  stage.addEventListener('pointerleave', () => {
    pointer.inside = false;
    setHovered(null);
    setHoverTipHide();
    pickDirty = false;
  });

  stage.addEventListener('pointerdown', e => {
    pointer.down = true;
    pointer.downX = e.clientX;
    pointer.downY = e.clientY;
    pointer.moved = false;
    camTween = null;
    hideHint();
    if (state.auto) setAuto(false, true);
    setHoverTipHide();
  });

  stage.addEventListener('pointermove', e => {
    if (pointer.down && Math.hypot(e.clientX - pointer.downX, e.clientY - pointer.downY) > 5) {
      state.dragging = true;
      pointer.moved = true;
      setHovered(null);
      stage.style.cursor = 'grabbing';
      hoverHalo.visible = false;
    }
  });

  stage.addEventListener('pointerup', e => {
    pointer.down = false;
    const wasDragging = state.dragging;
    state.dragging = false;
    stage.style.cursor = state.hovered ? 'pointer' : 'grab';
    if (wasDragging || e.button !== 0) return;
    const id = pickAt(e.clientX, e.clientY);
    if (id) {
      selectPart(id, { openDossier: true });
    } else {
      deselect();
      if (window.innerWidth <= 1120) closePanels();
    }
  });

  stage.addEventListener('pointercancel', () => {
    pointer.down = false;
    state.dragging = false;
  });

  controls.addEventListener('start', () => {
    camTween = null;
    hideHint();
    if (state.auto) setAuto(false, true);
  });

  function setHoverTipHide() {
    $('#cursor-tip').classList.remove('is-visible');
    hoverHalo.visible = false;
  }

  /* ════════════════════════════════════════════════════════════
     UI WIRING
     ════════════════════════════════════════════════════════════ */
  let toastTimer = null;
  function showToast(msg, duration) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), duration || 2400);
  }

  function hideHint() {
    $('#scene-hint').classList.add('is-hidden');
  }

  function openPanel(which) {
    const left = $('#panel-left');
    const right = $('#panel-right');
    if (which === 'left') {
      left.classList.add('is-open');
      right.classList.remove('is-open');
    } else {
      right.classList.add('is-open');
      left.classList.remove('is-open');
    }
  }
  function closePanels() {
    $('#panel-left').classList.remove('is-open');
    $('#panel-right').classList.remove('is-open');
  }

  range.addEventListener('input', () => {
    setExplodeTarget(Number(range.value) / 100, { silent: true });
  });

  explodeBtn.addEventListener('click', toggleExplode);

  $$('.view-btn[data-view]').forEach(btn => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  $('#btn-reset').addEventListener('click', () => {
    setExplodeTarget(0, { silent: true });
    deselect();
    setAuto(false, true);
    setView('iso');
    closePanels();
    showToast('视角与拆解状态已重置');
  });

  $('#btn-auto').addEventListener('click', () => setAuto(!state.auto));

  $('#btn-fullscreen').addEventListener('click', () => {
    const doc = document;
    if (!doc.fullscreenElement) {
      const el = doc.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => showToast('当前浏览器不支持全屏'));
    } else if (doc.exitFullscreen) {
      doc.exitFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', () => {
    $('#btn-fullscreen').classList.toggle('is-active', !!document.fullscreenElement);
  });

  // guide
  const guide = $('#guide-modal');
  let lastFocus = null;
  function openGuide() {
    lastFocus = document.activeElement;
    guide.hidden = false;
    hideHint();
    const close = guide.querySelector('.guide-close');
    if (close) close.focus({ preventScroll: true });
  }
  function closeGuide() {
    guide.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('#btn-help').addEventListener('click', openGuide);
  $$('[data-close-guide]').forEach(el => el.addEventListener('click', closeGuide));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !guide.hidden) {
      closeGuide();
      e.preventDefault();
    }
  });

  // mobile tabs / drawers
  function wireMobileTab(el, side) {
    if (!el) return;
    el.addEventListener('click', () => {
      if (window.innerWidth > 1120) return;
      openPanel(side);
    });
  }
  wireMobileTab($('#mobile-parts'), 'left');
  wireMobileTab($('#mobile-info'), 'right');
  wireMobileTab($('#btn-parts-mobile'), 'left');
  $$('[data-close-panel]').forEach(el => el.addEventListener('click', closePanels));

  // keyboard
  document.addEventListener('keydown', e => {
    if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
    if (!guide.hidden) return;
    const key = e.key;
    if (key === 'Escape') {
      if (state.selected) deselect();
      else closePanels();
      return;
    }
    if (key === 'e' || key === 'E') {
      toggleExplode();
    } else if (key === 'r' || key === 'R') {
      setExplodeTarget(0, { silent: true });
      deselect();
      setView('iso');
    } else if (key === '?' || key === '/') {
      openGuide();
    } else if (/^[1-9]$/.test(key)) {
      const part = PARTS[Number(key) - 1];
      if (part) selectPart(part.id, { openDossier: true });
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === '?' || e.key === '/') {
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      e.preventDefault();
    }
  });

  // auto-hide hint
  setTimeout(() => {
    if (!state.selected) hideHint();
  }, 14000);

  /* ════════════════════════════════════════════════════════════
     BOOT
     ════════════════════════════════════════════════════════════ */
  const boot = $('#boot');
  const bootFill = $('#boot-fill');
  const bootPct = $('#boot-pct');
  const bootPhase = $('#boot-phase');
  const query = QUERY;
  const debugFast = query.has('static') || query.has('debug');
  const bootStart = performance.now();
  const bootDuration = debugFast ? 260 : window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 700 : 2350;
  const phases = [
    [0.02, 'INITIALIZING AIRFRAME GEOMETRY'],
    [0.2, 'WEAVING CARBON ARM LATTICE'],
    [0.38, 'ASSEMBLING GIMBAL KINEMATICS'],
    [0.55, 'CALIBRATING VISION ARRAY'],
    [0.72, 'SYNCING TELEMETRY BUS'],
    [0.87, 'MAPPING TEARDOWN VECTORS'],
    [0.98, 'READY · ALL SYSTEMS NOMINAL']
  ];

  function bootTick(now) {
    const p = clamp((now - bootStart) / bootDuration, 0, 1);
    const eased = 1 - Math.pow(1 - p, 2.4);
    bootFill.style.width = (eased * 100).toFixed(1) + '%';
    bootPct.textContent = pad3(eased * 100);
    for (let i = phases.length - 1; i >= 0; i--) {
      if (eased >= phases[i][0]) {
        bootPhase.textContent = phases[i][1];
        break;
      }
    }
    if (p < 1) {
      requestAnimationFrame(bootTick);
    } else {
      setTimeout(finishBoot, 180);
    }
  }

  function finishBoot() {
    boot.classList.add('is-done');
    document.body.classList.remove('is-booting');
    state.ready = true;
    document.body.classList.add('is-ready');
    try {
      measureSafeArea();
      measureLabels();

      // debug/deep-link params: ?static=1&exploded=1&selected=gimbal&view=iso
      const eRaw = query.get('exploded');
      if (eRaw !== null) {
        const ev = eRaw === '' ? 1 : clamp(parseFloat(eRaw) || 0, 0, 1);
        state.target = ev;
        state.current = ev;
        updateExplosion(1 / 60);
        updateExplodeUI(ev);
      }

      const viewParam = query.get('view');
      if (viewParam && VIEW_DIR[viewParam]) {
        if (debugFast) tweenCamera(getView(viewParam).pos, getView(viewParam).target, 0);
        else setView(viewParam);
      } else if (debugFast) {
        const v = getView('iso');
        tweenCamera(v.pos, v.target, 0);
      } else {
        setTimeout(() => {
          const v = getView('iso');
          tweenCamera(v.pos, v.target, 2.5);
        }, 80);
      }

      const selParam = query.get('selected');
      if (selParam && PART_BY_ID[selParam]) {
        selectPart(selParam, { openDossier: false });
      }

      if (query.has('guide')) setTimeout(openGuide, 240);
    } catch (err) {
      // never leave the interface locked behind the boot layer
      console.error('[SKYFRAME] boot exception', err);
      document.body.dataset.jsError = String(err && err.message || err);
    }

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(measureLabels);
    }
  }

  requestAnimationFrame(bootTick);

  /* ════════════════════════════════════════════════════════════
     RESIZE
     ════════════════════════════════════════════════════════════ */
  let lastW = window.innerWidth, lastH = window.innerHeight;
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    const w = window.innerWidth, h = window.innerHeight;
    if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    measureSafeArea();
    measureLabels();
    lastW = w; lastH = h;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (state.ready && !camTween) {
        const v = getView(state.view);
        tweenCamera(v.pos, v.target, 0.6);
      }
      if (window.innerWidth > 1120) closePanels();
    }, 180);
  });

  /* ════════════════════════════════════════════════════════════
     MAIN LOOP
     ════════════════════════════════════════════════════════════ */
  let elapsed = 0;
  let lastPick = 0;
  let lastFrameTime = 0;
  let frameTimes = [];

  // optional technical readout for profiling: open with ?perf=1
  const perfHud = QUERY.has('perf') ? (() => {
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;z-index:9999;left:8px;top:8px;padding:4px 7px;background:rgba(0,5,8,.9);border:1px solid #2a6a78;color:#77e6ff;font:11px/1.4 Consolas,monospace;white-space:pre;pointer-events:none';
    document.body.appendChild(el);
    return el;
  })() : null;
  let hudFrames = 0, hudStart = 0, hudFps = 0;

  function animate(t) {
    const frameStart = performance.now();
    const now = typeof t === 'number' ? t : performance.now();
    if (!lastFrameTime) lastFrameTime = now;
    const realDt = Math.max(0.0001, (now - lastFrameTime) / 1000);
    lastFrameTime = now;
    const dt = Math.min(realDt, 0.12);
    elapsed += dt;

    updateExplosion(dt);
    updateCameraTween(dt);
    if (state.auto && !state.dragging && !camTween) {
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(Y_AXIS, dt * 0.16);
      camera.position.copy(controls.target).add(offset);
    }
    controls.update();

    // float
    modelRoot.position.y = MODEL_BASE_Y + Math.sin(elapsed * 0.7) * 0.012;
    dust.rotation.y += dt * 0.012;
    scanParent.rotation.z -= dt * 0.18;
    scanArc.material.opacity = 0.22 + Math.sin(elapsed * 0.9) * 0.08;
    gridMaterial.uniforms.uTime.value = elapsed;
    topGlow.material.opacity = 0.06 + Math.sin(elapsed * 0.4) * 0.015;
    sideGlow.material.opacity = 0.045 + Math.sin(elapsed * 0.33 + 1) * 0.012;

    // dust drift
    const arr = dust.geometry.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      arr[i * 3 + 1] += dustSpeeds[i] * dt;
      if (arr[i * 3 + 1] > 4.6) arr[i * 3 + 1] = -1.0;
    }
    dust.geometry.attributes.position.needsUpdate = true;

    updateGlow(dt);
    if (state.hovered && hoverHalo.visible) {
      const anchor = labelAnchor(state.hovered);
      if (anchor) {
        anchor.getWorldPosition(tmpV);
        hoverHalo.position.copy(tmpV);
        hoverHalo.material.opacity = 0.14 + Math.sin(elapsed * 3) * 0.05;
      }
    }
    if (state.ready) updateHover(dt);
    layoutLabels(dt);

    window.__JS_MS = (performance.now() - frameStart).toFixed(1);
    renderer.render(scene, camera);

    if (perfHud) {
      hudFrames++;
      if (!hudStart) hudStart = now;
      if (now - hudStart > 600) {
        hudFps = hudFrames * 1000 / (now - hudStart);
        hudFrames = 0; hudStart = now;
        const r = renderer.info.render;
        const avg = frameTimes.length ? frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length : 0;
        perfHud.textContent = `FPS ${hudFps.toFixed(1)}  dpr ${renderer.getPixelRatio().toFixed(2)}\ncalls ${r.calls}  tris ${r.triangles}\njs ${window.__JS_MS || 0} ms  frame ${window.__FRAME_MS || 0} ms  avg ${avg.toFixed(0)} ms`;
      }
    }

    frameTimes.push(performance.now() - frameStart);
    if (frameTimes.length > 40) frameTimes.shift();
    window.__FRAME_MS = frameTimes[frameTimes.length - 1].toFixed(0);
    requestAnimationFrame(animate);
  }

  buildPartList();
  setDossier(null);
  updateExplodeUI(0);
  measureLabels();
  measureSafeArea();
  if (LOW_QUALITY) document.body.classList.add('is-lite');

  window.addEventListener('pointerdown', () => {
    hideHint();
  }, { once: true });

  window.addEventListener('blur', () => {
    state.dragging = false;
    pointer.down = false;
  });

  requestAnimationFrame(animate);
})();
