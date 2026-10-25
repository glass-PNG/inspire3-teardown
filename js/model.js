/* ═══════════════════════════════════════════════════════════════
   INSPIRE 3 — PROCEDURAL AIRFRAME
   Every vertex is generated here. No external model files.
   Exposes: window.InspireModel = { build(), PARTS }
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const T = THREE;
  const DEG = Math.PI / 180;

  /* ── procedural texture helpers ───────────────────────────── */
  function canvasTexture(w, h, draw, repeat) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    const tex = new T.CanvasTexture(c);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    if (repeat) tex.repeat.set(repeat[0], repeat[1]);
    tex.anisotropy = 4;
    tex.encoding = T.sRGBEncoding;
    return tex;
  }

  function carbonTexture() {
    return canvasTexture(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#171b1e';
      ctx.fillRect(0, 0, w, h);
      const s = 16;
      for (let y = 0; y < h / s; y++) {
        for (let x = 0; x < w / s; x++) {
          const dark = (x + y) % 4 === 0 || (x + y) % 4 === 1;
          ctx.fillStyle = dark ? '#23282c' : '#0f1214';
          ctx.fillRect(x * s, y * s, s, s);
          ctx.strokeStyle = dark ? 'rgba(126,141,148,.16)' : 'rgba(0,0,0,.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if ((x + y) % 2 === 0) {
            ctx.moveTo(x * s, y * s + s);
            ctx.lineTo(x * s + s, y * s);
          } else {
            ctx.moveTo(x * s, y * s);
            ctx.lineTo(x * s + s, y * s + s);
          }
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 0.1;
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = '#9fb4bc';
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 1);
      }
      ctx.globalAlpha = 1;
    }, [2.4, 2.4]);
  }

  function brushedTexture() {
    return canvasTexture(512, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#aeb6b9');
      g.addColorStop(0.36, '#8c9497');
      g.addColorStop(0.52, '#b8c1c3');
      g.addColorStop(0.72, '#7e8689');
      g.addColorStop(1, '#a5adaf');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 900; i++) {
        ctx.strokeStyle = Math.random() > 0.5 ? '#ffffff' : '#3d4447';
        ctx.lineWidth = Math.random() * 1.4;
        const y = Math.random() * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y + (Math.random() - 0.5) * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }, [1, 1]);
  }

  function pcbTexture() {
    return canvasTexture(512, 256, (ctx, w, h) => {
      ctx.fillStyle = '#0a2b25';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(196,151,79,.32)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 46; i++) {
        ctx.beginPath();
        let x = Math.random() * w, y = Math.random() * h;
        ctx.moveTo(x, y);
        for (let j = 0; j < 4; j++) {
          x += (Math.random() - 0.5) * 120;
          y += (Math.random() - 0.5) * 60;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      for (let i = 0; i < 42; i++) {
        ctx.fillStyle = i % 7 === 0 ? '#c9a25a' : '#132b28';
        const bw = 4 + Math.random() * 22, bh = 3 + Math.random() * 12;
        ctx.fillRect(Math.random() * (w - bw), Math.random() * (h - bh), bw, bh);
      }
      ctx.fillStyle = 'rgba(85,227,255,.25)';
      for (let i = 0; i < 8; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }, [1.4, 1]);
  }

  function textTexture(lines, opts) {
    opts = opts || {};
    const w = opts.w || 512;
    const h = opts.h || 128;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = 'middle';
    let y = opts.startY || h * 0.5;
    lines.forEach((ln, i) => {
      ctx.fillStyle = ln.color || '#e8f7f9';
      ctx.font = `${ln.weight || 500} ${ln.size || 34}px ${ln.font || '"Bahnschrift","Arial Narrow",sans-serif'}`;
      if (ln.spacing) {
        const text = ln.text;
        const total = [...text].reduce((a, ch) => a + ctx.measureText(ch).width + ln.spacing, 0) - ln.spacing;
        let x = opts.align === 'left' ? 0 : (w - total) / 2;
        [...text].forEach(ch => {
          ctx.fillText(ch, x, y);
          x += ctx.measureText(ch).width + ln.spacing;
        });
      } else {
        let x = w / 2;
        if (opts.align === 'left') x = 0;
        if (opts.align === 'right') x = w;
        ctx.fillText(ln.text, x, y);
      }
      y += ln.size ? ln.size * 1.3 : 20;
    });
    const tex = new T.CanvasTexture(c);
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = 4;
    return tex;
  }

  /* ── geometry helpers ─────────────────────────────────────── */
  function roundedRectShape(w, h, r) {
    const x = -w / 2, y = -h / 2;
    const s = new T.Shape();
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }

  function roundedBox(w, h, d, r, seg) {
    r = Math.max(0.004, Math.min(r, Math.min(w, h, d) * 0.45));
    const bevel = Math.min(r, d * 0.22);
    const shape = roundedRectShape(
      Math.max(0.01, w - bevel * 2),
      Math.max(0.01, h - bevel * 2),
      Math.max(0.002, r - bevel)
    );
    const geo = new T.ExtrudeGeometry(shape, {
      depth: Math.max(0.01, d - bevel * 2),
      bevelEnabled: true,
      bevelSegments: seg || 2,
      steps: 1,
      bevelSize: bevel,
      bevelThickness: bevel,
      curveSegments: 6
    });
    geo.center();
    return geo;
  }

  // Smooth squarish hull lofted through cross sections along Z.
  function hullGeometry(sections, radial) {
    const seg = radial || 24;
    const power = 0.62;
    const rings = [];
    sections.forEach(sec => {
      const pts = [];
      for (let i = 0; i < seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const cx = Math.cos(a), sz = Math.sin(a);
        const x = (sec.w / 2) * Math.sign(cx) * Math.pow(Math.abs(cx), power);
        const y = (sec.h / 2) * Math.sign(sz) * Math.pow(Math.abs(sz), power);
        pts.push(new T.Vector3(x, y + (sec.y || 0), sec.z));
      }
      rings.push(pts);
    });
    const pos = [], idx = [];
    rings.forEach(ring => ring.forEach(p => pos.push(p.x, p.y, p.z)));
    for (let r = 0; r < rings.length - 1; r++) {
      for (let i = 0; i < seg; i++) {
        const a = r * seg + i;
        const b = r * seg + (i + 1) % seg;
        const c = (r + 1) * seg + (i + 1) % seg;
        const d = (r + 1) * seg + i;
        idx.push(a, b, c, a, c, d);
      }
    }
    // caps
    const first = rings[0], last = rings[rings.length - 1];
    const firstCenterIndex = pos.length / 3;
    let fy = 0; first.forEach(p => fy += p.y);
    pos.push(0, fy / first.length, first[0].z);
    const lastCenterIndex = pos.length / 3;
    let ly = 0; last.forEach(p => ly += p.y);
    pos.push(0, ly / last.length, last[0].z);
    for (let i = 0; i < seg; i++) {
      idx.push(firstCenterIndex, (i + 1) % seg, i);
      idx.push(lastCenterIndex, (rings.length - 1) * seg + i, (rings.length - 1) * seg + (i + 1) % seg);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // Thin, twisted, tapered rotor blade with baked vertex colours.
  function bladeGeometry(length, chord, thick, segs) {
    segs = segs || 26;
    const pos = [], col = [], idx = [];
    const cDark = new T.Color(0x0a0f12);
    const cOrange = new T.Color(0xff6a1f);
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const x = t * length;
      let cw = chord * (0.58 + 0.52 * Math.sin(Math.PI * Math.pow(t, 0.72))) * (1 - 0.86 * Math.pow(t, 7));
      cw = Math.max(0.012, cw);
      const th = thick * (1 - 0.68 * t);
      const twist = 0.2 + t * 0.42;
      const cone = 0.055 * length * t * t;
      // diamond airfoil cross-section (chord along Z, thickness along Y)
      const section = [
        [0, -th / 2, 0],
        [cw / 2, 0, 0],
        [0, th / 2, 0],
        [-cw / 2, 0, 0]
      ];
      section.forEach(p => {
        const z = p[0], y = p[1];
        const rz = z * Math.cos(twist) - y * Math.sin(twist);
        const ry = z * Math.sin(twist) + y * Math.cos(twist);
        pos.push(x, ry + cone, rz);
        const c = t > 0.805 ? cOrange : cDark;
        col.push(c.r, c.g, c.b);
      });
    }
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < 4; j++) {
        const a = i * 4 + j;
        const b = i * 4 + (j + 1) % 4;
        const c = (i + 1) * 4 + (j + 1) % 4;
        const d = (i + 1) * 4 + j;
        idx.push(a, b, c, a, c, d);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  /* ── materials ────────────────────────────────────────────── */
  function makeMaterials() {
    const carbonTex = carbonTexture();
    const brushedTex = brushedTexture();
    const pcbTex = pcbTexture();
    const mats = {
      silver: new T.MeshStandardMaterial({ color: 0x79858a, metalness: 0.72, roughness: 0.36, map: brushedTex }),
      canopy: new T.MeshStandardMaterial({ color: 0x778287, metalness: 0.38, roughness: 0.4, map: brushedTex }),
      graphite: new T.MeshStandardMaterial({ color: 0x23282c, metalness: 0.62, roughness: 0.45 }),
      dark: new T.MeshStandardMaterial({ color: 0x101417, metalness: 0.5, roughness: 0.55 }),
      black: new T.MeshStandardMaterial({ color: 0x07090b, metalness: 0.4, roughness: 0.5 }),
      lensBody: new T.MeshStandardMaterial({ color: 0x121619, metalness: 0.68, roughness: 0.32 }),
      carbon: new T.MeshStandardMaterial({ color: 0x3c4246, metalness: 0.32, roughness: 0.52, map: carbonTex }),
      carbonDark: new T.MeshStandardMaterial({ color: 0x24282b, metalness: 0.3, roughness: 0.56, map: carbonTex }),
      chrome: new T.MeshStandardMaterial({ color: 0xd7dde0, metalness: 1.0, roughness: 0.17 }),
      copper: new T.MeshStandardMaterial({ color: 0xb8754a, metalness: 0.85, roughness: 0.32 }),
      orange: new T.MeshStandardMaterial({ color: 0xff7a2f, metalness: 0.35, roughness: 0.42 }),
      glass: new T.MeshPhysicalMaterial({ color: 0x0a1c26, metalness: 0.15, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.9 }),
      lensGlass: new T.MeshPhysicalMaterial({ color: 0x0e2b3c, metalness: 0.25, roughness: 0.03, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0x0a3347, emissiveIntensity: 0.35 }),
      lensCoating: new T.MeshPhysicalMaterial({ color: 0x2d5f80, metalness: 0.5, roughness: 0.04, clearcoat: 1, iridescence: 0, emissive: 0x123a55, emissiveIntensity: 0.6 }),
      pcb: new T.MeshStandardMaterial({ color: 0x1c4a40, metalness: 0.45, roughness: 0.55, map: pcbTex, emissive: 0x06231c, emissiveIntensity: 0.35 }),
      emissiveCyan: new T.MeshStandardMaterial({ color: 0x0d2a32, emissive: 0x55e3ff, emissiveIntensity: 1.7, roughness: 0.3 }),
      emissiveAmber: new T.MeshStandardMaterial({ color: 0x321d0d, emissive: 0xff7a2f, emissiveIntensity: 1.5, roughness: 0.4 }),
      ledGreen: new T.MeshStandardMaterial({ color: 0x0c2a14, emissive: 0x65ff9a, emissiveIntensity: 1.2 }),
      rubber: new T.MeshStandardMaterial({ color: 0x0a0b0c, metalness: 0.1, roughness: 0.9 }),
      titanium: new T.MeshStandardMaterial({ color: 0x7e8689, metalness: 0.9, roughness: 0.28 }),
      gold: new T.MeshStandardMaterial({ color: 0xc9a25a, metalness: 0.95, roughness: 0.25 }),
      blade: new T.MeshStandardMaterial({ color: 0x6b7378, vertexColors: true, metalness: 0.04, roughness: 0.92, side: T.DoubleSide })
    };
    Object.keys(mats).forEach(k => {
      const m = mats[k];
      if (m && 'envMapIntensity' in m) m.envMapIntensity = k === 'glass' || k === 'lensGlass' ? 1.15 : 0.72;
    });
    mats.blade.envMapIntensity = 0.06;
    mats.blade.roughness = 0.95;
    return mats;
  }

  /* ── metadata / dossier content ───────────────────────────── */
  const PARTS = [
    {
      id: 'airframe', idx: '01', cn: '机身主结构', en: 'AIRFRAME & CANOPY', code: 'TR-740-01',
      type: 'CENTRAL AIRFRAME / 中央承力结构', mass: 1100, depth: 14,
      tags: ['碳纤维承力框', '镁铝合金蒙皮', '飞控舱', '风道散热'],
      desc: '中央承力骨架集成飞控、IMU 与散热风道，灰色镁铝合金上盖与深色下腹板共同构成低阻气动外形。机臂、云台、电池与图传模块均挂载于这一基准结构之上。',
      specs: [
        ['整机轴距', '695 mm（起落架收起）'],
        ['机身材料', '碳纤维复合承力框 + 镁铝合金蒙皮'],
        ['整机重量', '约 3995 g（含云台/电池/镜头/桨）'],
        ['工作温度', '-20°C ~ 40°C']
      ]
    },
    {
      id: 'arms', idx: '02', cn: '碳纤维机臂', en: 'FOLDING ARMS', code: 'TR-740-02',
      type: 'STRUCTURAL ARMS / 折叠机臂', mass: 430, depth: 31,
      tags: ['X 型四臂', '向下折叠', '内走线', '机械锁止'],
      desc: '四支高模量碳纤维机臂呈 X 型展开，内部走线包含电机相线、信号线与图传馈线。机臂向下折叠后运输尺寸可压缩至 176 × 709.8 × 500.5 mm。',
      specs: [
        ['布局', 'X 型四旋翼 / 可折叠'],
        ['运输尺寸', '176 × 709.8 × 500.5 mm'],
        ['折叠方向', '机臂向下快速折叠'],
        ['锁止检测', '机械卡扣 + 霍尔传感器']
      ]
    },
    {
      id: 'motors', idx: '03', cn: '动力电机', en: 'DJI 3511s MOTORS', code: 'TR-740-03',
      type: 'PROPULSION / 动力系统', mass: 380, depth: 48,
      tags: ['DJI 3511s', 'FOC 驱动', '铜线定子', '主动散热'],
      desc: '四颗 DJI 3511s 无刷电机提供 3995 g 整机的机动余量，定子采用高槽满率铜线绕组，配合 FOC 电调实现 94 km/h 最大水平速度与 8 m/s 爬升率。',
      specs: [
        ['电机型号', 'DJI 3511s × 4'],
        ['最大上升', '8 m/s'],
        ['最大下降', '8 m/s 垂直 / 10 m/s 斜向'],
        ['最大速度', '94 km/h（运动模式）']
      ]
    },
    {
      id: 'props', idx: '04', cn: '1671 折叠桨', en: 'FOLDING PROPELLERS', code: 'TR-740-04',
      type: 'PROP ROTOR SYSTEM / 桨叶系统', mass: 170, depth: 58,
      tags: ['DJI 1671', '16.7 英寸', '折叠快拆', '高原桨可选'],
      desc: '标配 DJI 1671 折叠桨，直径 16.7 英寸，橙色桨尖用于高转速下的视觉辨识。桨毂采用快拆压紧结构，在 7000 m 高海拔可换装 DJI 1676 高原桨。',
      specs: [
        ['标称型号', 'DJI 1671（标配）'],
        ['桨叶直径', '16.7 in / 约 424 mm'],
        ['高原型号', 'DJI 1676（选配）'],
        ['本体重量', '约 170 g（四支）']
      ]
    },
    {
      id: 'gimbal', idx: '05', cn: '三轴云台', en: '3-AXIS GIMBAL', code: 'TR-740-05',
      type: 'STABILIZED PAYLOAD / 云台相机', mass: 516, depth: 70,
      tags: ['X9-8K Air', '35mm 全画幅', '±0.002°', '快拆'],
      desc: '三轴增稳云台搭载 X9-8K Air 全画幅相机，采用高精度无刷电机与双 IMU 冗余。悬停时角度抖动仅 ±0.002°，飞行中 ±0.004°，满足 8K 长镜头的稳定需求。',
      specs: [
        ['稳定精度', '悬停 ±0.002° / 飞行 ±0.004°'],
        ['俯仰范围', '-90° ~ +30°'],
        ['横滚 / 平移', '±20° / ±300°'],
        ['云台重量', '约 516 g（不含镜头）']
      ]
    },
    {
      id: 'lens', idx: '06', cn: 'DL 全画幅镜头', en: 'DL FULL-FRAME LENS', code: 'TR-740-06',
      type: 'OPTICAL LENS / 光学镜头', mass: 380, depth: 81,
      tags: ['DL 卡口', '18-75mm', '8K 全画幅', 'ProRes RAW'],
      desc: 'DL 卡口全画幅镜头组覆盖 18 / 24 / 35 / 50 / 75 mm 五个焦段。35mm 全画幅 CMOS 最高支持 8192 × 5456 静态照片与 8K/75fps ProRes RAW 视频。',
      specs: [
        ['卡口', 'DJI DL Mount'],
        ['焦段', '18 / 24 / 35 / 50 / 75 mm'],
        ['传感器', '35 mm 全画幅 CMOS'],
        ['最高视频', '8K/75fps ProRes RAW']
      ]
    },
    {
      id: 'battery', idx: '07', cn: 'TB51 智能电池', en: 'TB51 INTELLIGENT BATTERY', code: 'TR-740-07',
      type: 'POWER CELL / 动力电池', mass: 470, depth: 42,
      tags: ['98.8 Wh', '4280 mAh', '自加热', '双电冗余'],
      desc: 'TB51 智能电池采用 6S 锂离子电芯，容量 4280 mAh / 98.8 Wh，支持最大 205.5 W 快充与低温自加热。双电池并联供电，提供最长 28 分钟飞行时间。',
      specs: [
        ['容量 / 能量', '4280 mAh / 98.8 Wh'],
        ['电压', '23.1 V / 6S Li-ion'],
        ['重量', '约 470 g'],
        ['续航', '28 min（起落架放下）']
      ]
    },
    {
      id: 'sensors', idx: '08', cn: '视觉感知阵列', en: 'VISION SENSING ARRAY', code: 'TR-740-08',
      type: 'OBSTACLE AVOIDANCE / 视觉避障', mass: 100, depth: 64,
      tags: ['六向感知', 'ToF', 'FPV 相机', '厘米级定位'],
      desc: '机身前后、左右、上下共布设六向双目视觉与 ToF 传感器，前后探测距离达 48 m。机鼻顶部集成 FPV 相机，为飞手提供低延迟第一视角画面。',
      specs: [
        ['前 / 后', '1.5 – 48 m'],
        ['侧向 / 上视', '1.5 – 42 m / 0.2 – 13 m'],
        ['下视 / ToF', '0.3 – 18 m / 0 – 10 m'],
        ['RTK 精度', '水平 1 cm + 1 PPM']
      ]
    },
    {
      id: 'gear', idx: '09', cn: '起落架', en: 'LANDING GEAR', code: 'TR-740-09',
      type: 'RETRACTABLE GEAR / 收放起落架', mass: 200, depth: 36,
      tags: ['四点支撑', '电动收放', '碳纤维', '减震脚垫'],
      desc: '四点式电动起落架在起飞后自动上收，为云台提供 360° 无遮挡视野。支腿采用碳纤维薄壁梁与减震脚垫，收起与展开状态轴距分别为 695 / 685 mm。',
      specs: [
        ['结构', '四点式电动收放'],
        ['轴距', '695 mm（收）/ 685 mm（放）'],
        ['驱动', '无刷舵机 + 位置反馈'],
        ['脚垫', '硅胶减震脚垫']
      ]
    },
    {
      id: 'transmission', idx: '10', cn: 'O3 Pro 图传', en: 'O3 PRO TRANSMISSION', code: 'TR-740-10',
      type: 'WIRELESS LINK / 无线图传', mass: 90, depth: 76,
      tags: ['50 Mbps', '90 ms 延迟', '三频', '15 km'],
      desc: 'O3 Pro 图传系统支持 2.4 / 5.1 / 5.8 GHz 三频自适应，最大码率 50 Mbps，端到端延迟约 90 ms。配合高增益天线，单控 FPV 最大传输距离约 15 km（FCC）。',
      specs: [
        ['最大码率', '50 Mbps'],
        ['延迟', '约 90 ms'],
        ['频段', '2.4 / 5.1 / 5.8 GHz'],
        ['最大距离', '15 km FCC / 8 km CE']
      ]
    },
    {
      id: 'rtk', idx: '11', cn: 'RTK 定位模块', en: 'RTK POSITIONING', code: 'TR-740-11',
      type: 'GNSS / 高精度定位', mass: 70, depth: 87,
      tags: ['1 cm + 1 PPM', '双频 GNSS', '时间同步', '测绘级'],
      desc: '机载 RTK 模块提供厘米级水平定位与 1 PPM 高程精度，与飞控、云台及相机时间戳同步，用于高精度航线、测绘与重复航拍任务。',
      specs: [
        ['水平精度', '1 cm + 1 PPM'],
        ['GNSS', '双频多星座'],
        ['同步', '飞控 / 云台 / 相机时间戳'],
        ['应用', '测绘 / 巡检 / 重复航线']
      ]
    },
    {
      id: 'ssd', idx: '12', cn: 'PROSSD 存储仓', en: 'PROSSD 1TB BAY', code: 'TR-740-12',
      type: 'ONBOARD STORAGE / 机载存储', mass: 60, depth: 91,
      tags: ['1 TB', 'USB-C 3.1', 'CinemaDNG', '快拆仓'],
      desc: '机身后部快拆仓容纳 DJI PROSSD 1 TB 固态硬盘，最高写入带宽满足 8K/75fps ProRes RAW 持续录制。硬盘可快速取出，通过 USB-C 直接接入后期流程。',
      specs: [
        ['介质', 'DJI PROSSD 1 TB'],
        ['接口', 'USB-C 3.1'],
        ['编码', 'ProRes RAW / CinemaDNG'],
        ['安装', '后部快拆仓 / 免工具']
      ]
    }
  ];

  /* ── build ────────────────────────────────────────────────── */
  function build() {
    const M = makeMaterials();
    const root = new T.Group();
    root.name = 'INSPIRE_3_T740';

    const partGroups = [];
    const partMap = {};

    function register(id, group, offset, anchorLocal) {
      group.userData.partId = id;
      root.add(group);
      const rec = {
        id,
        group,
        offset: new T.Vector3(offset[0], offset[1], offset[2]),
        base: group.position.clone(),
        baseRot: group.rotation.clone()
      };
      partGroups.push(rec);
      if (!partMap[id]) {
        partMap[id] = { id, groups: [], anchor: null, meta: PARTS.find(p => p.id === id) };
      }
      partMap[id].groups.push(group);
      if (!partMap[id].anchor) {
        const a = new T.Object3D();
        a.name = 'label-anchor-' + id;
        if (anchorLocal) a.position.set(anchorLocal[0], anchorLocal[1], anchorLocal[2]);
        group.add(a);
        partMap[id].anchor = a;
      }
      return rec;
    }

    function add(parent, geo, mat, x, y, z, rx, ry, rz) {
      const m = new T.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      if (rx) m.rotation.x = rx;
      if (ry) m.rotation.y = ry;
      if (rz) m.rotation.z = rz;
      m.castShadow = true;
      m.receiveShadow = true;
      parent.add(m);
      return m;
    }

    function groupAt(x, y, z) {
      const g = new T.Group();
      g.position.set(x || 0, y || 0, z || 0);
      return g;
    }

    const dirs = [45, 135, 225, 315].map(deg => {
      const a = deg * DEG;
      return new T.Vector3(Math.cos(a), 0, Math.sin(a));
    });

    /* ── 01 / AIRFRAME SHELL ─────────────────────────────── */
    const shell = new T.Group();
    const hullSections = [
      { z: -1.06, w: 0.34, h: 0.24, y: 0.03 },
      { z: -0.92, w: 0.62, h: 0.34, y: 0.03 },
      { z: -0.62, w: 0.84, h: 0.47, y: 0.03 },
      { z: -0.15, w: 0.92, h: 0.53, y: 0.03 },
      { z: 0.35, w: 0.88, h: 0.5, y: 0.02 },
      { z: 0.72, w: 0.7, h: 0.4, y: 0.0 },
      { z: 0.98, w: 0.48, h: 0.29, y: -0.02 },
      { z: 1.12, w: 0.3, h: 0.19, y: -0.03 },
      { z: 1.19, w: 0.18, h: 0.12, y: -0.03 }
    ];
    add(shell, hullGeometry(hullSections, 32), M.silver, 0, 0, 0);
    // upper canopy — a low lofted shell, following the airframe rather than a box
    const canopySections = [
      { z: -0.74, w: 0.36, h: 0.055, y: 0.3 },
      { z: -0.5, w: 0.56, h: 0.115, y: 0.31 },
      { z: -0.12, w: 0.64, h: 0.145, y: 0.325 },
      { z: 0.28, w: 0.56, h: 0.13, y: 0.315 },
      { z: 0.52, w: 0.4, h: 0.085, y: 0.28 },
      { z: 0.68, w: 0.2, h: 0.045, y: 0.235 }
    ];
    add(shell, hullGeometry(canopySections, 28), M.canopy, 0, 0, 0);
    // canopy seam / dark spine
    add(shell, roundedBox(0.15, 0.035, 1.18, 0.014), M.graphite, 0, 0.4, -0.06);
    add(shell, roundedBox(0.3, 0.025, 0.26, 0.01), M.dark, 0, 0.4, 0.42);
    // side shoulder fairings
    for (let side = -1; side <= 1; side += 2) {
      const sh = add(shell, roundedBox(0.075, 0.16, 0.92, 0.035), M.graphite, side * 0.425, 0.12, -0.02);
      sh.rotation.z = side * -0.07;
      add(shell, roundedBox(0.05, 0.045, 0.5, 0.015), M.dark, side * 0.44, 0.31, -0.12);
    }
    // dark windshield visor
    const visor = add(shell, roundedBox(0.44, 0.14, 0.32, 0.045), M.glass, 0, 0.28, 0.6);
    visor.rotation.x = -0.28;
    // belly plate
    add(shell, roundedBox(0.6, 0.11, 1.28, 0.035), M.dark, 0, -0.25, -0.02);
    add(shell, roundedBox(0.34, 0.05, 0.48, 0.02), M.graphite, 0, -0.3, -0.5);
    // side vent recesses
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i++) {
        const v = add(shell, roundedBox(0.018, 0.075, 0.13, 0.007), M.black,
          side * 0.432, 0.015 + i * 0.0, -0.38 + i * 0.16);
        v.rotation.x = 0.16;
      }
      // orange accent tabs near nose
      add(shell, roundedBox(0.02, 0.025, 0.14, 0.008), M.orange, side * 0.413, 0.13, 0.7);
      // tiny fasteners
      for (let i = 0; i < 3; i++) {
        const s = add(shell, new T.CylinderGeometry(0.016, 0.016, 0.008, 8), M.graphite,
          side * 0.44, 0.2, -0.7 + i * 0.42, 0, 0, Math.PI / 2);
        s.rotation.z = Math.PI / 2;
      }
    }
    // nose cap detail
    add(shell, roundedBox(0.23, 0.1, 0.16, 0.03), M.graphite, 0, 0.09, 1.08);
    add(shell, new T.CylinderGeometry(0.035, 0.035, 0.02, 12), M.titanium, 0, 0.09, 1.16, Math.PI / 2, 0, 0);
    // rear vents
    for (let i = 0; i < 4; i++) {
      add(shell, roundedBox(0.26, 0.02, 0.035, 0.007), M.black, 0, 0.2 - i * 0.055, -1.03);
    }
    // gimbal mount collar under nose
    add(shell, new T.CylinderGeometry(0.14, 0.16, 0.1, 16), M.graphite, 0, -0.3, 0.48);
    // top decals
    const decal = new T.Mesh(
      new T.PlaneGeometry(0.62, 0.2),
      new T.MeshBasicMaterial({
        map: textTexture([
          { text: 'INSPIRE 3', size: 54, color: '#343b3e', spacing: 7, font: '"Bahnschrift SemiCondensed","Arial Narrow",sans-serif' },
          { text: 'T 7 4 0   ·   A I R F R A M E', size: 15, color: '#5f696d', spacing: 2 }
        ], { w: 512, h: 160, startY: 58 }),
        transparent: true, depthWrite: false, opacity: 0.9
      })
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(0, 0.427, -0.02);
    decal.scale.set(0.82, 0.82, 1);
    decal.renderOrder = 3;
    shell.add(decal);
    // registration plate
    const tailDecal = new T.Mesh(
      new T.PlaneGeometry(0.22, 0.07),
      new T.MeshBasicMaterial({
        map: textTexture([{ text: 'T740 · 8K', size: 34, color: '#8e989b', spacing: 2 }], { w: 256, h: 80, startY: 42 }),
        transparent: true, depthWrite: false
      })
    );
    tailDecal.rotation.x = -Math.PI / 2;
    tailDecal.position.set(0, 0.2, -0.95);
    shell.add(tailDecal);

    register('airframe', shell, [0.2, 2.15, -1.35], [0, 0.5, 0.05]);

    /* ── 01b / INTERNAL CHASSIS ──────────────────────────── */
    const core = new T.Group();
    add(core, roundedBox(0.5, 0.035, 1.05, 0.02), M.pcb, 0, 0.02, -0.02);
    add(core, roundedBox(0.36, 0.055, 0.62, 0.02), M.graphite, 0, -0.02, 0.1);
    // side rails
    for (let s = -1; s <= 1; s += 2) {
      add(core, roundedBox(0.06, 0.07, 1.35, 0.025), M.carbonDark, s * 0.38, 0, -0.1);
      const tube = add(core, new T.CylinderGeometry(0.022, 0.022, 0.9, 8), M.gold, s * 0.18, -0.06, 0.2);
      tube.rotation.x = Math.PI / 2;
    }
    // stacked electronics
    add(core, roundedBox(0.3, 0.08, 0.34, 0.015), M.dark, 0, 0.08, -0.36);
    add(core, roundedBox(0.22, 0.05, 0.24, 0.012), M.graphite, 0, 0.14, -0.36);
    for (let i = 0; i < 5; i++) {
      const led = add(core, new T.SphereGeometry(0.011, 6, 5), i % 2 ? M.emissiveCyan : M.ledGreen,
        -0.16 + i * 0.08, 0.17, -0.3 + (i % 3) * 0.04);
      led.castShadow = false;
    }
    // copper heat pipe
    const pipe = add(core, new T.CylinderGeometry(0.018, 0.018, 0.55, 8), M.copper, 0.22, 0.06, 0.15, Math.PI / 2, 0, 0);
    pipe.rotation.x = Math.PI / 2;
    register('airframe', core, [0, 0.35, 0], [0, 0.25, -0.3]);

    /* ── 02 / FOLDING ARMS ───────────────────────────────── */
    dirs.forEach((d, i) => {
      const g = new T.Group();
      const start = 0.58, end = 2.18;
      const len = end - start;
      const mid = (start + end) / 2;
      const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d);
      // main carbon tube
      const tube = add(g, new T.CylinderGeometry(0.086, 0.106, len, 16), M.carbon, d.x * mid, 0.02, d.z * mid);
      tube.quaternion.copy(q);
      // inner silver spar
      const spar = add(g, new T.CylinderGeometry(0.058, 0.068, len * 0.72, 10), M.titanium, d.x * (mid + 0.02), 0.02, d.z * (mid + 0.02));
      spar.quaternion.copy(q);
      spar.scale.set(1, 0.96, 1);
      // arm root hinge
      const hinge = add(g, new T.CylinderGeometry(0.115, 0.115, 0.24, 14), M.graphite, d.x * (start - 0.03), 0.02, d.z * (start - 0.03));
      hinge.quaternion.copy(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), new T.Vector3(-d.z, 0, d.x)));
      add(g, new T.CylinderGeometry(0.032, 0.032, 0.28, 8), M.titanium, d.x * (start - 0.03), 0.02, d.z * (start - 0.03));
      // hinge bolt plate
      add(g, roundedBox(0.2, 0.1, 0.2, 0.035), M.silver, d.x * (start + 0.1), -0.02, d.z * (start + 0.1));
      // control rod beneath
      const rod = add(g, new T.CylinderGeometry(0.016, 0.016, len * 0.78, 6), M.titanium,
        d.x * (mid - 0.02), -0.125, d.z * (mid - 0.02));
      rod.quaternion.copy(q);
      // cable conduit
      const cable = add(g, new T.CylinderGeometry(0.022, 0.022, len * 0.42, 6), M.black,
        d.x * (mid + 0.18), 0.1, d.z * (mid + 0.18));
      cable.quaternion.copy(q);
      // folding lock ring
      const lock = add(g, new T.CylinderGeometry(0.1, 0.1, 0.08, 12), M.orange, d.x * (end - 0.52), 0.02, d.z * (end - 0.52));
      lock.quaternion.copy(q);
      // motor mount pod — gives the arm tip a substantial mechanical shoulder
      const pod = add(g, new T.CylinderGeometry(0.11, 0.14, 0.44, 14), M.graphite, d.x * (end - 0.18), 0.015, d.z * (end - 0.18));
      pod.quaternion.copy(q);
      add(g, new T.CylinderGeometry(0.17, 0.19, 0.06, 16), M.graphite, d.x * end, 0.0, d.z * end);
      add(g, roundedBox(0.26, 0.04, 0.14, 0.015), M.carbonDark, d.x * (end - 0.24), -0.01, d.z * (end - 0.24));
      const off = [d.x * 1.05, 0.26 + i * 0.02, d.z * 1.05];
      register('arms', g, off, [d.x * 1.45, 0.12, d.z * 1.45]);
    });

    /* ── 03 / MOTORS ─────────────────────────────────────── */
    dirs.forEach((d, i) => {
      const g = groupAt(d.x * 2.18, 0.02, d.z * 2.18);
      // mount base
      add(g, new T.CylinderGeometry(0.18, 0.21, 0.06, 18), M.black, 0, 0.0, 0);
      // stator copper coils
      add(g, new T.TorusGeometry(0.135, 0.028, 8, 22), M.copper, 0, 0.07, 0, Math.PI / 2, 0, 0);
      add(g, new T.TorusGeometry(0.108, 0.022, 7, 20), M.copper, 0, 0.1, 0, Math.PI / 2, 0, 0);
      // bell
      add(g, new T.CylinderGeometry(0.165, 0.175, 0.16, 24), M.graphite, 0, 0.19, 0);
      // knurling
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        const rib = add(g, new T.BoxGeometry(0.012, 0.135, 0.025), M.silver,
          Math.cos(a) * 0.174, 0.19, Math.sin(a) * 0.174);
        rib.rotation.y = -a;
      }
      // top cap
      add(g, new T.CylinderGeometry(0.155, 0.16, 0.035, 20), M.silver, 0, 0.285, 0);
      add(g, new T.CylinderGeometry(0.045, 0.052, 0.03, 12), M.dark, 0, 0.308, 0);
      // shaft
      add(g, new T.CylinderGeometry(0.026, 0.026, 0.06, 10), M.chrome, 0, 0.335, 0);
      // led ring under bell
      add(g, new T.TorusGeometry(0.155, 0.008, 5, 20), i % 2 ? M.emissiveAmber : M.emissiveCyan, 0, 0.1, 0, Math.PI / 2, 0, 0);
      // tiny phase wires
      for (let w = 0; w < 3; w++) {
        const a = w / 3 * Math.PI * 2;
        add(g, roundedBox(0.018, 0.03, 0.06, 0.007), M.black, Math.cos(a) * 0.15, 0.02, Math.sin(a) * 0.15);
      }
      register('motors', g, [d.x * 0.85, 0.9, d.z * 0.85], [0, 0.3, 0]);
    });

    /* ── 04 / PROPELLERS ─────────────────────────────────── */
    const bladeGeo = bladeGeometry(1.02, 0.24, 0.03, 30);
    dirs.forEach((d, i) => {
      const g = groupAt(d.x * 2.18, 0.39, d.z * 2.18);
      const armAngle = Math.atan2(d.z, d.x);
      g.rotation.y = -armAngle + 0.62;
      // hub
      add(g, new T.CylinderGeometry(0.105, 0.12, 0.05, 16), M.graphite, 0, 0, 0);
      add(g, new T.CylinderGeometry(0.055, 0.06, 0.05, 12), M.chrome, 0, 0.045, 0);
      add(g, new T.CylinderGeometry(0.028, 0.032, 0.025, 10), M.orange, 0, 0.075, 0);
      // two blades
      for (let b = 0; b < 2; b++) {
        const blade = new T.Mesh(bladeGeo, M.blade);
        blade.position.set(0, 0.005, 0);
        blade.rotation.y = b * Math.PI;
        blade.rotation.z = 0.05;
        blade.castShadow = true;
        g.add(blade);
      }
      // blade clamps
      for (let b = 0; b < 2; b++) {
        const a = b * Math.PI;
        add(g, new T.CylinderGeometry(0.055, 0.055, 0.032, 10), M.dark, Math.cos(a) * 0.09, 0.012, Math.sin(a) * 0.09);
      }
      register('props', g, [d.x * 0.75, 1.5, d.z * 0.75], [0, 0.06, 0]);
    });

    /* ── 05 / GIMBAL + CAMERA ────────────────────────────── */
    const gimbal = new T.Group();
    // yaw mount
    add(gimbal, new T.CylinderGeometry(0.14, 0.15, 0.07, 18), M.graphite, 0, -0.33, 0.47);
    add(gimbal, new T.CylinderGeometry(0.12, 0.12, 0.12, 16), M.dark, 0, -0.4, 0.47);
    add(gimbal, new T.CylinderGeometry(0.06, 0.06, 0.3, 10), M.carbonDark, 0, -0.58, 0.47);
    add(gimbal, new T.CylinderGeometry(0.1, 0.1, 0.05, 14), M.titanium, 0, -0.72, 0.47);
    // gimbal yoke
    add(gimbal, roundedBox(0.5, 0.09, 0.16, 0.03), M.graphite, 0, -0.8, 0.5);
    for (let s = -1; s <= 1; s += 2) {
      add(gimbal, roundedBox(0.055, 0.28, 0.12, 0.02), M.dark, s * 0.3, -0.89, 0.55);
      add(gimbal, new T.CylinderGeometry(0.085, 0.085, 0.13, 16), M.graphite, s * 0.3, -0.98, 0.62, 0, 0, Math.PI / 2);
      add(gimbal, new T.CylinderGeometry(0.045, 0.045, 0.15, 10), M.titanium, s * 0.3, -0.98, 0.62, 0, 0, Math.PI / 2);
    }
    // camera cage
    add(gimbal, roundedBox(0.46, 0.4, 0.42, 0.05), M.dark, 0, -0.99, 0.72);
    add(gimbal, roundedBox(0.5, 0.055, 0.46, 0.02), M.graphite, 0, -0.8, 0.72);
    add(gimbal, roundedBox(0.32, 0.18, 0.2, 0.03), M.graphite, 0, -1.19, 0.66);
    // heat sink fins on bottom
    for (let f = 0; f < 5; f++) {
      add(gimbal, roundedBox(0.4, 0.016, 0.02, 0.006), M.silver, 0, -1.22, 0.96 + f * 0.028);
    }
    // side ports / buttons
    for (let s = -1; s <= 1; s += 2) {
      add(gimbal, roundedBox(0.012, 0.1, 0.14, 0.008), M.graphite, s * 0.252, -0.99, 0.66);
      add(gimbal, new T.CylinderGeometry(0.018, 0.018, 0.02, 10), M.orange, s * 0.26, -1.1, 0.62);
      add(gimbal, new T.CylinderGeometry(0.012, 0.012, 0.02, 8), M.emissiveCyan, s * 0.26, -1.14, 0.58);
    }
    // tiny status LED strip
    add(gimbal, roundedBox(0.12, 0.012, 0.012, 0.004), M.emissiveAmber, 0, -0.82, 0.9);
    // camera side text
    const camDecal = new T.Mesh(
      new T.PlaneGeometry(0.3, 0.11),
      new T.MeshBasicMaterial({
        map: textTexture([
          { text: 'X9-8K AIR', size: 40, color: '#aeb8bb', spacing: 3 },
          { text: 'FULL-FRAME   ·   8K', size: 13, color: '#f08a4b', spacing: 1 }
        ], { w: 512, h: 192, startY: 70 }),
        transparent: true, depthWrite: false
      })
    );
    camDecal.rotation.y = -Math.PI / 2;
    camDecal.position.set(-0.257, -0.98, 0.74);
    gimbal.add(camDecal);
    register('gimbal', gimbal, [0.2, -1.05, 0.45], [0, -1.12, 0.6]);

    /* ── 06 / LENS ───────────────────────────────────────── */
    const lens = new T.Group();
    lens.position.set(0, -0.99, 1.02);
    add(lens, new T.CylinderGeometry(0.235, 0.235, 0.07, 30), M.lensBody, 0, 0, 0);
    add(lens, new T.CylinderGeometry(0.215, 0.225, 0.16, 30), M.lensBody, 0, 0, 0.09, Math.PI / 2, 0, 0);
    add(lens, new T.CylinderGeometry(0.238, 0.238, 0.045, 30), M.titanium, 0, 0, 0.185, Math.PI / 2, 0, 0);
    add(lens, new T.CylinderGeometry(0.215, 0.225, 0.12, 30), M.black, 0, 0, 0.255, Math.PI / 2, 0, 0);
    add(lens, new T.CylinderGeometry(0.214, 0.214, 0.012, 32), M.lensCoating, 0, 0, 0.19, Math.PI / 2, 0, 0);
    add(lens, new T.CylinderGeometry(0.2, 0.205, 0.05, 30), M.lensBody, 0, 0, 0.33, Math.PI / 2, 0, 0);
    // focus ring knurls
    for (let k = 0; k < 24; k++) {
      const a = k / 24 * Math.PI * 2;
      add(lens, new T.BoxGeometry(0.009, 0.028, 0.055), M.graphite,
        Math.cos(a) * 0.224, Math.sin(a) * 0.224, 0.26, 0, 0, a);
    }
    // front element
    const frontGlass = add(lens, new T.CylinderGeometry(0.19, 0.19, 0.025, 32), M.lensGlass, 0, 0, 0.365, Math.PI / 2, 0, 0);
    add(lens, new T.TorusGeometry(0.195, 0.014, 8, 32), M.lensBody, 0, 0, 0.37);
    add(lens, new T.TorusGeometry(0.172, 0.006, 6, 32), M.orange, 0, 0, 0.378);
    // white index marks
    for (let k = 0; k < 8; k++) {
      const a = k / 8 * Math.PI * 2;
      add(lens, new T.BoxGeometry(0.004, 0.012, 0.03), M.silver,
        Math.cos(a) * 0.239, Math.sin(a) * 0.239, 0.185, 0, 0, a);
    }
    const lensText = new T.Mesh(
      new T.PlaneGeometry(0.19, 0.07),
      new T.MeshBasicMaterial({
        map: textTexture([{ text: 'DL 35mm  F2.8', size: 32, color: '#9aa4a7', spacing: 2 }], { w: 512, h: 128, startY: 62 }),
        transparent: true, depthWrite: false
      })
    );
    lensText.position.set(0.201, 0, 0.09);
    lensText.rotation.y = Math.PI / 2;
    lensText.scale.set(0.9, 1, 1);
    lens.add(lensText);
    register('lens', lens, [0.2, -1.0, 1.65], [0, 0, 0.18]);

    /* ── 07 / BATTERY ────────────────────────────────────── */
    const battery = groupAt(0, 0.16, -0.24);
    add(battery, roundedBox(0.66, 0.3, 1.08, 0.05), M.dark, 0, 0, 0);
    add(battery, roundedBox(0.56, 0.06, 0.94, 0.03), M.graphite, 0, 0.166, 0);
    // orange pull tab
    add(battery, roundedBox(0.16, 0.03, 0.05, 0.012), M.orange, 0, 0.13, -0.57);
    // side rails
    for (let s = -1; s <= 1; s += 2) {
      add(battery, roundedBox(0.03, 0.24, 0.9, 0.012), M.black, s * 0.335, 0, 0);
      for (let i = 0; i < 3; i++) add(battery, new T.CylinderGeometry(0.02, 0.02, 0.012, 10), M.titanium, s * 0.35, -0.08 + i * 0.08, -0.3 + i * 0.3, 0, 0, Math.PI / 2);
    }
    const batLabel = new T.Mesh(
      new T.PlaneGeometry(0.46, 0.16),
      new T.MeshBasicMaterial({
        map: textTexture([
          { text: 'TB51', size: 56, color: '#d8e4e6', spacing: 5 },
          { text: '98.8 Wh  ·  4280 mAh  ·  23.1 V', size: 15, color: '#7e9399', spacing: 1 }
        ], { w: 512, h: 192, startY: 68 }),
        transparent: true, depthWrite: false
      })
    );
    batLabel.rotation.x = -Math.PI / 2;
    batLabel.position.set(0, 0.199, 0);
    battery.add(batLabel);
    register('battery', battery, [0, 0.85, -1.55], [0, 0.22, 0]);

    /* ── 08 / VISION + FPV SENSORS ───────────────────────── */
    function sensorHousing(g, x, y, z, ry, count) {
      const sg = groupAt(x, y, z);
      sg.rotation.y = ry || 0;
      add(sg, roundedBox(0.2, 0.09, 0.075, 0.018), M.dark, 0, 0, 0);
      add(sg, roundedBox(0.13, 0.05, 0.08, 0.014), M.graphite, 0, 0.055, 0.0);
      for (let c = 0; c < count; c++) {
        const ox = (c - (count - 1) / 2) * 0.075;
        add(sg, new T.CylinderGeometry(0.025, 0.028, 0.022, 12), M.chrome, ox, 0, 0.04, Math.PI / 2, 0, 0);
        add(sg, new T.CylinderGeometry(0.017, 0.017, 0.012, 12), M.lensGlass, ox, 0, 0.052, Math.PI / 2, 0, 0);
      }
      g.add(sg);
      return sg;
    }
    const sensors = new T.Group();
    // front stereo
    const frontS = sensorHousing(sensors, 0, 0.02, 1.02, 0, 2);
    frontS.position.x = 0;
    // chassis ties
    add(sensors, roundedBox(0.46, 0.04, 0.22, 0.015), M.graphite, 0, 0.02, 1.03);
    // rear stereo
    sensorHousing(sensors, 0, 0.03, -1.08, Math.PI, 2);
    // side stereo
    sensorHousing(sensors, 0.47, 0.03, 0.15, Math.PI / 2, 1);
    sensorHousing(sensors, -0.47, 0.03, 0.15, -Math.PI / 2, 1);
    // downward ToF
    const downS = sensorHousing(sensors, 0, -0.3, 0.02, 0, 1);
    downS.rotation.z = Math.PI;
    // FPV camera on nose
    const fpv = groupAt(0, 0.36, 0.68);
    add(fpv, roundedBox(0.16, 0.12, 0.22, 0.03), M.graphite, 0, 0, 0);
    add(fpv, roundedBox(0.12, 0.09, 0.08, 0.025), M.dark, 0, 0.01, 0.12);
    add(fpv, new T.CylinderGeometry(0.045, 0.05, 0.05, 16), M.black, 0, 0.01, 0.17, Math.PI / 2, 0, 0);
    add(fpv, new T.CylinderGeometry(0.033, 0.033, 0.018, 16), M.lensGlass, 0, 0.01, 0.198, Math.PI / 2, 0, 0);
    add(fpv, new T.CylinderGeometry(0.014, 0.014, 0.01, 8), M.emissiveCyan, 0.05, 0.04, 0.12);
    sensors.add(fpv);
    register('sensors', sensors, [0.8, 0.9, 1.35], [0, 0.03, 1.0]);

    /* ── 09 / LANDING GEAR ───────────────────────────────── */
    const legUpperGeo = new T.CylinderGeometry(0.058, 0.05, 0.58, 4, 1);
    legUpperGeo.rotateY(Math.PI / 4);
    legUpperGeo.scale(1, 1, 0.55);
    const legLowerGeo = new T.CylinderGeometry(0.05, 0.032, 0.64, 4, 1);
    legLowerGeo.rotateY(Math.PI / 4);
    legLowerGeo.scale(1, 1, 0.5);
    dirs.forEach(d => {
      const g = groupAt(d.x * 1.94, -0.06, d.z * 1.94);
      g.rotation.y = -Math.atan2(d.z, d.x);
      // shoulder fairing — blends the leg into the arm
      add(g, roundedBox(0.21, 0.17, 0.3, 0.045), M.graphite, 0, 0.0, 0);
      add(g, roundedBox(0.15, 0.055, 0.22, 0.02), M.silver, 0, 0.075, 0.01);
      add(g, new T.CylinderGeometry(0.072, 0.072, 0.26, 12), M.titanium, 0, -0.02, 0, 0, 0, Math.PI / 2);
      add(g, new T.CylinderGeometry(0.033, 0.033, 0.3, 8), M.silver, 0, -0.02, 0, 0, 0, Math.PI / 2);
      add(g, roundedBox(0.12, 0.028, 0.18, 0.01), M.orange, 0, -0.09, 0.04);
      // upper blade strut
      add(g, legUpperGeo, M.carbon, 0, -0.35, 0);
      add(g, new T.BoxGeometry(0.012, 0.36, 0.018), M.titanium, 0.045, -0.34, 0.015);
      // knee joint
      add(g, new T.CylinderGeometry(0.062, 0.062, 0.075, 12), M.graphite, 0, -0.64, 0.01);
      add(g, new T.CylinderGeometry(0.022, 0.022, 0.1, 8), M.chrome, 0, -0.64, 0.01, 0, 0, Math.PI / 2);
      // lower blade
      const low = add(g, legLowerGeo, M.carbonDark, 0, -0.96, 0.035);
      low.rotation.x = -0.055;
      add(g, roundedBox(0.022, 0.2, 0.026, 0.007), M.black, 0.033, -0.91, 0.055);
      add(g, roundedBox(0.022, 0.006, 0.026, 0.002), M.orange, 0.033, -0.79, 0.055);
      // foot
      add(g, roundedBox(0.13, 0.045, 0.29, 0.018), M.graphite, 0, -1.26, 0.075);
      add(g, roundedBox(0.105, 0.018, 0.21, 0.008), M.rubber, 0, -1.29, 0.075);
      add(g, new T.BoxGeometry(0.016, 0.03, 0.15), M.orange, 0.058, -1.255, 0.06);
      register('gear', g, [d.x * 0.32, -1.15, d.z * 0.32], [0, -0.82, 0.03]);
    });

    /* ── 10 / O3 PRO LINK + ANTENNAS ─────────────────────── */
    const link = new T.Group();
    // rear module
    add(link, roundedBox(0.22, 0.12, 0.3, 0.03), M.graphite, 0, 0.06, -1.02);
    add(link, roundedBox(0.14, 0.03, 0.2, 0.012), M.pcb, 0, 0.13, -1.02);
    for (let s = -1; s <= 1; s += 2) {
      // antenna base
      add(link, roundedBox(0.08, 0.06, 0.1, 0.02), M.dark, s * 0.2, -0.08, -0.98);
      const ant = add(link, new T.CylinderGeometry(0.016, 0.021, 0.56, 8), M.black,
        s * 0.25, -0.33, -1.02, 0, 0, s * 0.35);
      ant.rotation.z = s * 0.35;
      add(link, new T.CylinderGeometry(0.024, 0.024, 0.04, 8), M.chrome, s * 0.31, -0.6, -1.02, 0, 0, s * 0.35);
    }
    register('transmission', link, [-0.4, 0.75, -1.8], [0, -0.15, -1.02]);

    /* ── 11 / RTK MODULE ─────────────────────────────────── */
    const rtk = groupAt(0, 0.36, -0.78);
    add(rtk, new T.CylinderGeometry(0.11, 0.14, 0.09, 20), M.graphite, 0, 0, 0);
    add(rtk, new T.SphereGeometry(0.11, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.canopy, 0, 0.07, 0);
    add(rtk, new T.CylinderGeometry(0.038, 0.045, 0.16, 10), M.titanium, 0.08, 0.12, 0);
    add(rtk, new T.TorusGeometry(0.075, 0.009, 6, 20), M.orange, 0, 0.075, 0, Math.PI / 2, 0, 0);
    add(rtk, new T.CylinderGeometry(0.012, 0.012, 0.012, 8), M.emissiveCyan, 0, 0.1, 0.09);
    register('rtk', rtk, [0, 1.85, -1.75], [0, 0.12, 0]);

    /* ── 12 / PROSSD BAY ─────────────────────────────────── */
    const ssd = groupAt(-0.34, 0.02, -0.82);
    add(ssd, roundedBox(0.06, 0.16, 0.36, 0.02), M.graphite, 0, 0, 0);
    add(ssd, roundedBox(0.02, 0.12, 0.28, 0.012), M.titanium, -0.04, 0, 0);
    add(ssd, roundedBox(0.02, 0.03, 0.09, 0.008), M.orange, -0.055, 0.04, 0.09);
    const ssdLabel = new T.Mesh(
      new T.PlaneGeometry(0.22, 0.08),
      new T.MeshBasicMaterial({
        map: textTexture([{ text: 'PROSSD', size: 38, color: '#93a0a4', spacing: 3 }], { w: 512, h: 160, startY: 80 }),
        transparent: true, depthWrite: false
      })
    );
    ssdLabel.rotation.y = -Math.PI / 2;
    ssdLabel.position.set(-0.061, 0, -0.02);
    ssd.add(ssdLabel);
    register('ssd', ssd, [-0.5, 0.35, -2.15], [0, 0, 0]);

    /* ── final touches ───────────────────────────────────── */
    root.traverse(o => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    /* Merge meshes that share a material inside each independently
       animated part group. This keeps the exact same silhouette while
       cutting hundreds of draw calls down to a few dozen — the single
       biggest win on low-end / integrated GPUs. */
    function mergeGroupByMaterial(group) {
      group.updateMatrixWorld(true);
      const inv = new T.Matrix4().copy(group.matrixWorld).invert();
      const buckets = new Map();
      const originals = [];
      group.traverse(o => {
        if (!o.isMesh || o.isSprite || !o.material || Array.isArray(o.material)) return;
        if (!o.geometry || !o.geometry.attributes.position) return;
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        g.applyMatrix4(inv.clone().multiply(o.matrixWorld));
        if (!g.attributes.normal) g.computeVertexNormals();
        if (!buckets.has(o.material)) buckets.set(o.material, []);
        buckets.get(o.material).push(g);
        originals.push(o);
      });
      originals.forEach(m => { if (m.parent) m.parent.remove(m); });

      buckets.forEach((geos, mat) => {
        const total = geos.reduce((n, g) => n + g.attributes.position.count, 0);
        const pos = new Float32Array(total * 3);
        const nor = new Float32Array(total * 3);
        const uv = new Float32Array(total * 2);
        const useColor = !!mat.vertexColors || geos.some(g => g.attributes.color);
        const col = useColor ? new Float32Array(total * 3) : null;
        let off = 0;
        geos.forEach(g => {
          const n = g.attributes.position.count;
          pos.set(g.attributes.position.array, off * 3);
          if (g.attributes.normal) nor.set(g.attributes.normal.array, off * 3);
          if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
          if (col) {
            if (g.attributes.color) col.set(g.attributes.color.array, off * 3);
            else col.fill(1, off * 3, (off + n) * 3);
          }
          off += n;
          g.dispose();
        });
        const merged = new T.BufferGeometry();
        merged.setAttribute('position', new T.BufferAttribute(pos, 3));
        merged.setAttribute('normal', new T.BufferAttribute(nor, 3));
        merged.setAttribute('uv', new T.BufferAttribute(uv, 2));
        if (col) merged.setAttribute('color', new T.BufferAttribute(col, 3));
        merged.computeBoundingSphere();
        const mesh = new T.Mesh(merged, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        group.add(mesh);
      });
    }
    partGroups.forEach(rec => mergeGroupByMaterial(rec.group));

    return {
      root,
      partGroups,
      parts: PARTS,
      partMap,
      materials: M
    };
  }

  window.InspireModel = { build, PARTS };
})();
