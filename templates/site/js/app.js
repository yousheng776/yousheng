/* 永世爱恋 · 格芮芙陪伴终端 */
(function () {
  'use strict';

  var $ = function (s, el) { return (el || document).querySelector(s); };
  var STORE_KEY = 'gref.v2';

  // 每套皮肤八种表情加至少三个动作，图从豆包来，按 exp 映射。
  var SKINS = {
    vow: {
      name: '永世爱恋', short: '婚纱',
      actor: true,
      face: 'assets/char/avatar.png',
      thumb: 'assets/char/bow.png',
      line: '她站在教堂中央，白纱从积水的地面拖过去。',
      exp: {
        calm: 'idle', soft: 'expect', smile: 'expect', joy: 'happy',
        shy: 'shy', sad: 'sad', scared: 'surprised', sleepy: 'doze',
        pray: 'pray', wave: 'wave', sit: 'sit', frenzy: 'frenzy'
      }
    },
    pajama: {
      name: '睡衣', short: '睡衣',
      actor: true,
      face: 'assets/faces/pajama.png',
      thumb: 'assets/char/pajama.png',
      line: '她把睡裙拢了拢，赤脚踩在冰凉的石板上。',
      exp: {
        calm: 'pajama', soft: 'pj_smile', smile: 'pj_smile', joy: 'pj_stretch',
        shy: 'pj_shy', sad: 'pj_pillow', scared: 'pj_pillow', sleepy: 'pj_sleep',
        pray: 'pj_smile', wave: 'pj_stretch', sit: 'pj_pillow', frenzy: 'pj_pillow'
      }
    },
    qipao: {
      name: '深廊引蝶', short: '引蝶',
      actor: true,
      face: 'assets/faces/qipao_chibi.png',
      thumb: 'assets/char/qipao.png',
      line: '她把旗袍的褶子理平，回头看你。',
      exp: {
        calm: 'qipao', soft: 'qipao_soft', smile: 'qipao_soft', joy: 'qipao_wave',
        shy: 'qipao_shy', sad: 'qipao_worry', scared: 'qipao_worry', sleepy: 'qipao_soft',
        pray: 'qipao_soft', wave: 'qipao_wave', sit: 'qipao', frenzy: 'qipao_worry'
      }
    },
    bride: {
      name: '誓约', short: '誓约',
      actor: false,
      face: 'assets/faces/portrait.jpg',
      thumb: 'assets/faces/portrait.jpg',
      line: '她站在教堂中央，捧花里有一朵白玫瑰。'
    },
    original: {
      name: '幽庭寐影', short: '幽庭',
      actor: false,
      face: 'assets/faces/original.jpg',
      thumb: 'assets/faces/original.jpg',
      line: '花落了一地，她躺在里面，像在等谁走近。'
    }
  };

  var IDLE_LINES = [
    '她把珍珠链绕在指尖，一圈，又一圈。',
    '一片花瓣落在她肩上，她没有拂开。',
    '她在数远处亮着的窗。',
    '她把手贴在玻璃上，看自己的影子。',
    '她低着头，像在背一段很久以前的誓词。',
    '她抬眼看了你一下，又很快移开。'
  ];

  var state = load();
  GF.state.aff = state.aff;
  GF.state.pats = state.pats || 0;

  var logEl = $('#log');
  var inputEl = $('#input');
  var modal = $('#modal');
  var modalCard = $('#modalCard');
  var typingEl = $('#typing');
  var currentSkin = SKINS[state.skin] ? state.skin : 'vow';
  var lastActivity = Date.now();
  var speaking = false;

  /* ---------------- 存储 ---------------- */

  function load() {
    var base = {
      skin: 'vow', aff: 30, pats: 0, visits: 0, lastVisit: 0,
      tts: false, reminders: [], log: [],
      study: { on: true, fired: {}, days: {} },
      llm: { on: false, base: 'https://api.openai.com/v1', key: '', model: 'gpt-4o-mini' },
      touches: {}, skinSeen: {}, lastGreetDay: '', lastIdleVoice: 0
    };
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return base;
      var data = JSON.parse(raw);
      return Object.assign(base, data);
    } catch (e) { return base; }
  }

  function save() {
    state.aff = GF.state.aff;
    state.pats = GF.state.pats;
    state.lastVisit = Date.now();
    if (state.log.length > 80) state.log = state.log.slice(-80);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ---------------- 时间 ---------------- */

  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
  function dayKey(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dateLine(d) {
    var week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 · 星期' + week;
  }
  function periodOf(d) {
    var h = d.getHours();
    if (h < 5) return '深夜';
    if (h < 9) return '清晨';
    if (h < 12) return '上午';
    if (h < 14) return '正午';
    if (h < 18) return '午后';
    if (h < 23) return '入夜';
    return '夜深';
  }

  /* ---------------- 场景 ---------------- */

  var currentPose = '';
  var alphaMap = null, alphaW = 0, alphaH = 0;

  function loadAlphaMap(name) {
    var im = new Image();
    im.onload = function () {
      var w = 72;
      var h = Math.max(1, Math.round(w * im.height / im.width));
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.drawImage(im, 0, 0, w, h);
      alphaMap = ctx.getImageData(0, 0, w, h).data;
      alphaW = w; alphaH = h;
    };
    im.src = 'assets/char/' + name + '.png';
  }

  function setPose(name) {
    var img = $('#actor');
    if (!img || !name || currentPose === name) return;
    currentPose = name;
    img.src = 'assets/char/' + name + '.png';
    loadAlphaMap(name);
  }

  function applySkin(key, silent) {
    currentSkin = key;
    state.skin = key;
    var s = SKINS[key];
    document.body.dataset.skin = key;
    $('#faceImg').src = s.face;
    var wrap = $('#actorWrap');
    if (wrap) wrap.hidden = !s.actor;
    document.body.classList.remove('frenzy');
    currentPose = '';
    if (s.actor) setPose(s.exp.calm);
    document.querySelectorAll('.skin-btn').forEach(function (b) {
      b.classList.toggle('is-active', b.dataset.skin === key);
    });
    $('#idleLine').textContent = s.line;
    save();
    if (!silent) toast('换上了「' + s.name + '」');
  }

  function buildSkins() {
    var box = $('#skins');
    box.innerHTML = '';
    Object.keys(SKINS).forEach(function (key) {
      var s = SKINS[key];
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'skin-btn';
      b.dataset.skin = key;
      b.style.backgroundImage = 'url("' + s.thumb + '")';
      b.title = s.name;
      b.setAttribute('aria-label', s.name);
      var label = document.createElement('span');
      label.textContent = s.short;
      b.appendChild(label);
      b.addEventListener('click', function () {
        if (currentSkin === key) return;
        applySkin(key);
        var first = !state.skinSeen[key];
        state.skinSeen[key] = true;
        var own = GF.P.voice[key] && GF.P.voice[key].acquire;
        herSay((first && own) ? own : '……这件啊。你觉得合适吗。', { exp: 'soft' });
        save();
      });
      box.appendChild(b);
    });
  }

  function buildPetals() {
    var box = $('#petals');
    for (var i = 0; i < 18; i++) {
      var p = document.createElement('i');
      p.className = 'petal';
      var size = 6 + Math.random() * 9;
      p.style.width = size + 'px';
      p.style.height = size * 0.82 + 'px';
      p.style.left = (Math.random() * 100) + '%';
      p.style.opacity = (0.22 + Math.random() * 0.4).toFixed(2);
      p.style.animationDuration = (16 + Math.random() * 16).toFixed(1) + 's';
      p.style.animationDelay = (-Math.random() * 26).toFixed(1) + 's';
      p.style.setProperty('--drift', (Math.random() * 160 - 80).toFixed(0) + 'px');
      box.appendChild(p);
    }
  }

  /* ---------------- 消息 ---------------- */

  function addMsg(who, text, opts) {
    opts = opts || {};
    var wrap = document.createElement('div');
    wrap.className = 'msg ' + who;
    if (who === 'system') {
      wrap.textContent = text;
    } else {
      var bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = text;
      wrap.appendChild(bubble);
    }
    logEl.appendChild(wrap);
    scrollLog();
    updateChips();
    if (!opts.noStore && text) {
      state.log.push({ who: who, text: text, ts: Date.now() });
    }
    return wrap;
  }

  function updateChips() {
    var n = state.log.filter(function (m) { return m.who !== 'system'; }).length;
    var chips = $('#chips');
    if (chips) chips.hidden = n > 4;
  }

  function scrollLog() {
    requestAnimationFrame(function () { logEl.scrollTop = logEl.scrollHeight; });
  }

  function typeIn(el, text) {
    return new Promise(function (resolve) {
      var i = 0;
      var timer = setInterval(function () {
        i += 2;
        el.textContent = text.slice(0, i);
        scrollLog();
        if (i >= text.length) {
          clearInterval(timer);
          el.textContent = text;
          resolve();
        }
      }, 26);
    });
  }

  function updateMeta() {
    var aff = GF.state.aff;
    var bar = $('#affBar');
    if (!bar) return;
    bar.style.width = aff + '%';
    $('#affNum').textContent = aff;
    $('#visitNum').textContent = '第 ' + state.visits + ' 次见面';
    $('#remindNum').textContent = state.reminders.length + ' 个约定';
  }

  function setFace(exp) {
    var chip = $('#faceChip');
    chip.dataset.exp = exp || 'soft';
    var s = SKINS[currentSkin];
    if (s && s.actor && s.exp) setPose(s.exp[exp] || s.exp.calm);
  }

  function setMood(mood) {
    var el = $('#moodText');
    el.textContent = (GF.P.moods && GF.P.moods[mood]) || '她正看着你';
  }

  function herSay(text, opts) {
    opts = opts || {};
    setFace(opts.exp || GF.state.exp);
    setMood(opts.mood || GF.state.mood);
    if (opts.instant) {
      addMsg('her', text, opts);
      return Promise.resolve();
    }
    var wrap = addMsg('her', '', { noStore: true });
    var bubble = wrap.querySelector('.bubble');
    return typeIn(bubble, text).then(function () {
      state.log.push({ who: 'her', text: text, ts: Date.now() });
      updateChips();
      save();
    });
  }

  function meSay(text) {
    addMsg('me', text);
  }

  function sysSay(text) {
    addMsg('system', text);
  }

  var HURT = /怪物|讨厌你|滚开|恨你|离开我|消失吧/;

  async function hurt() {
    var s = SKINS[currentSkin];
    if (s && s.actor && s.exp.frenzy) {
      setPose(s.exp.frenzy);
      document.body.classList.add('frenzy');
      sysSay('她的眼睛变了颜色。');
    }
    GF.state.aff = Math.max(0, GF.state.aff - 4);
    await wait(2400);
    document.body.classList.remove('frenzy');
    await herSay('……你刚才，说我是怪物。', { exp: 'sad', mood: 'sad' });
    await wait(600);
    await herSay('对不起。我不该让你看见那个样子。', { exp: 'sad', mood: 'sad' });
    updateMeta();
    save();
  }

  async function respond(text) {
    meSay(text);
    lastActivity = Date.now();
    if (HURT.test(text)) { await hurt(); return; }
    typingEl.hidden = false;

    if (state.llm && state.llm.on && state.llm.key && state.llm.base && state.llm.model) {
      try {
        var answer = await llmReply(text);
        if (answer) {
          typingEl.hidden = true;
          GF.state.aff = Math.min(100, GF.state.aff + 1);
          state.aff = GF.state.aff;
          await herSay(answer, { exp: 'soft', mood: 'calm' });
          updateMeta();
          save();
          return;
        }
      } catch (err) {
        typingEl.hidden = true;
        toast('模型没有回应，先用她自己的话。');
      }
    }

    var res = GF.reply(text, currentSkin);
    await wait(520 + Math.random() * 420);
    typingEl.hidden = true;

    var before = state.aff;
    state.aff = GF.state.aff;
    await herSay(res.text, { exp: res.exp, mood: res.mood });

    checkThreshold(before, state.aff);
    updateMeta();
    save();
  }

  function checkThreshold(before, after) {
    [50, 70, 90].forEach(function (mark) {
      if (before < mark && after >= mark) {
        var line = GF.P.thresholds[mark];
        if (mark === 70) line = GF.voiceLine(currentSkin, 'focus') || line;
        if (mark === 90) line = GF.voiceLine(currentSkin, 'max') || line;
        if (line) setTimeout(function () { herSay(line, { exp: 'shy', mood: 'shy' }); }, 900);
      }
    });
  }

  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------------- 语音输入 ---------------- */

  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var rec = null;
  var listening = false;

  function initVoice() {
    var mic = $('#micBtn');
    if (!SR) {
      mic.addEventListener('click', function () {
        toast('这个浏览器不支持语音输入。换 Chrome 或 Edge 打开。');
      });
      $('#hint').textContent = '当前浏览器不支持语音输入，直接打字也可以。';
      return;
    }
    rec = new SR();
    rec.lang = 'zh-CN';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onstart = function () { listening = true; mic.classList.add('is-listening'); };
    rec.onend = function () { listening = false; mic.classList.remove('is-listening'); };
    rec.onerror = function (e) {
      listening = false;
      mic.classList.remove('is-listening');
      if (e.error === 'not-allowed') toast('麦克风被拦住了。地址栏里允许一下。');
      else if (e.error !== 'aborted') toast('没有听清，再说一次。');
    };
    rec.onresult = function (e) {
      var transcript = '';
      for (var i = e.resultIndex; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      inputEl.value = transcript;
      var last = e.results[e.results.length - 1];
      if (last.isFinal && transcript.trim()) {
        var text = transcript.trim();
        inputEl.value = '';
        setTimeout(function () { respond(text); }, 220);
      }
    };

    mic.addEventListener('click', function () {
      if (listening) { rec.stop(); return; }
      try { rec.start(); } catch (err) { rec.stop(); }
    });
  }

  /* ---------------- 她读出来 ---------------- */

  var voices = [];

  function loadVoices() {
    if (!window.speechSynthesis) return;
    voices = window.speechSynthesis.getVoices() || [];
  }
  if (window.speechSynthesis) {
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }



  /* ---------------- 弹层 ---------------- */

  function openModal(html, opts) {
    opts = opts || {};
    modalCard.className = 'modal-card' + (opts.cls ? ' ' + opts.cls : '');
    modalCard.innerHTML = html;
    modal.hidden = false;
    var x = modalCard.querySelector('[data-close]');
    if (x) x.addEventListener('click', closeModal);
  }

  function closeModal() { modal.hidden = true; modalCard.innerHTML = ''; }

  modal.addEventListener('click', function (e) {
    var hot = e.target.closest ? e.target.closest('[data-z]') : null;
    if (hot) { closeModal(); touchZone(hot.dataset.z); return; }
    if (e.target === modal) closeModal();
    if (e.target.matches('[data-close]')) closeModal();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
    if (e.key === 'Escape' && !$('#focus').hidden) closeFocus();
  });

  var toastTimer = null;
  function toast(text) {
    var t = $('#toast');
    t.textContent = text;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------------- 摸头 ---------------- */

  async function pat() {
    sysSay('你伸出手，轻轻摸了摸她的头。');
    lastActivity = Date.now();
    typingEl.hidden = false;
    await wait(480);
    typingEl.hidden = true;
    await herSay(GF.patLine(), { exp: 'shy', mood: 'shy' });
    state.pats = GF.state.pats;
    updateMeta();
    save();
  }


  /* ---------------- 触碰 ---------------- */

  var TOUCH_ZONES = [
    ['head', '头', 50, 8],
    ['face', '脸', 50, 20],
    ['ear', '耳', 63, 20],
    ['chest', '胸', 50, 36],
    ['waist', '腹', 50, 49],
    ['hand', '手', 34, 52],
    ['leg', '腿', 50, 74],
    ['foot', '脚', 50, 90]
  ];

  var REACT = {
    head: 'react-head', face: 'react-face', ear: 'react-ear', hand: 'react-hand',
    waist: 'react-waist', chest: 'react-chest', leg: 'react-leg', foot: 'react-foot'
  };

  function react(zone) {
    var img = $('#actor');
    if (!img) return;
    Object.keys(REACT).forEach(function (k) { img.classList.remove(REACT[k]); });
    void img.offsetWidth;
    var cls = REACT[zone] || REACT.head;
    img.classList.add(cls);
    setTimeout(function () { img.classList.remove(cls); }, 680);
  }

  function touchZone(zone) {
    lastActivity = Date.now();
    var n = (state.touches[zone] || 0) + 1;
    state.touches[zone] = n;
    var res = null;

    var own = GF.P.voice[currentSkin];
    if (own && own.touch && n % 4 === 0) {
      res = { text: GF.pick(own.touch), exp: 'shy', mood: 'shy' };
    }
    if (!res && zone === 'head' && n >= 3 && Math.random() < 0.35) {
      var pat = GF.voiceLine(currentSkin, 'pat');
      if (pat) res = { text: pat, exp: 'shy', mood: 'shy' };
    }
    if (!res) res = GF.touch(zone, n, GF.state.aff);

    GF.state.aff = Math.min(100, GF.state.aff + 1);
    react(zone);
    herSay(res.text, { exp: res.exp, mood: res.mood }).then(function () {
      updateMeta();
      save();
    });
    updateMeta();
    save();
  }

  var SIT_POSES = { sit: 1, pj_pillow: 1 };
  var LIE_POSES = { pj_sleep: 1 };

  function zoneFromPoint(x, y) {
    if (LIE_POSES[currentPose]) {
      if (x < 0.34) return 'head';
      if (x < 0.55) return 'chest';
      if (x < 0.72) return 'waist';
      if (x < 0.90) return 'leg';
      return 'foot';
    }
    if (SIT_POSES[currentPose]) {
      if (y < 0.12) return 'head';
      if (y < 0.34) return (x < 0.32 || x > 0.68) ? 'ear' : 'face';
      if (y < 0.50) return 'chest';
      if (y < 0.66) return 'waist';
      if (y < 0.88) return 'leg';
      return 'foot';
    }
    if (y < 0.11) return 'head';
    if (y < 0.32) return (x < 0.33 || x > 0.67) ? 'ear' : 'face';
    if (y < 0.45) return 'chest';
    if (y < 0.58) return (x < 0.36 || x > 0.64) ? 'hand' : 'waist';
    if (y < 0.88) return 'leg';
    return 'foot';
  }

  function openTouch() {
    var s = SKINS[currentSkin];
    var html = '<button class="x-btn" data-close type="button">×</button>' +
      '<h3>触碰</h3>' +
      '<p class="sub">点她身上你想碰的地方。她会告诉你她的感觉。</p>';
    if (s.actor) {
      var pose = s.exp.calm || 'idle';
      html += '<div class="touch-figure"><img src="assets/char/' + pose + '.png" alt="格芮芙">';
      TOUCH_ZONES.forEach(function (z) {
        html += '<button class="hot" type="button" data-z="' + z[0] + '" style="left:' + z[2] + '%;top:' + z[3] + '%">' + z[1] + '</button>';
      });
      html += '</div>';
    } else {
      html += '<div class="touch-grid">';
      TOUCH_ZONES.forEach(function (z) {
        html += '<button type="button" data-z="' + z[0] + '">' + z[1] + '</button>';
      });
      html += '</div>';
    }
    openModal(html);
  }

  /* ---------------- 管风琴 ---------------- */

  var actx = null;
  var MENDE = [
    { t: 0.00, d: 0.18, ns: [60] },
    { t: 0.18, d: 0.18, ns: [60] },
    { t: 0.36, d: 0.18, ns: [60] },
    { t: 0.54, d: 1.61, ns: [60] },
    { t: 2.14, d: 0.18, ns: [60] },
    { t: 2.32, d: 0.18, ns: [60] },
    { t: 2.50, d: 0.18, ns: [60] },
    { t: 2.68, d: 1.61, ns: [60] },
    { t: 4.29, d: 0.18, ns: [60] },
    { t: 4.46, d: 0.18, ns: [60] },
    { t: 4.64, d: 0.18, ns: [60] },
    { t: 4.82, d: 0.54, ns: [60, 64] },
    { t: 5.36, d: 0.18, ns: [60, 64] },
    { t: 5.54, d: 0.18, ns: [60, 64] },
    { t: 5.72, d: 0.18, ns: [60, 64] },
    { t: 5.90, d: 0.54, ns: [60, 64] },
    { t: 6.44, d: 0.18, ns: [60, 64] },
    { t: 6.62, d: 0.18, ns: [60, 64] },
    { t: 6.80, d: 0.18, ns: [60, 64] },
    { t: 6.98, d: 0.55, ns: [60, 64, 67] },
    { t: 7.53, d: 0.18, ns: [60, 64, 67] },
    { t: 7.71, d: 0.18, ns: [60, 64, 67] },
    { t: 7.89, d: 0.18, ns: [60, 64, 67] },
    { t: 8.07, d: 0.55, ns: [60, 64, 67] },
    { t: 8.62, d: 0.55, ns: [60, 64, 67] },
    { t: 9.17, d: 1.07, ns: [45, 57, 76, 78, 84] },
    { t: 10.24, d: 1.07, ns: [47, 59, 75, 78, 83] },
    { t: 11.04, d: 0.27, ns: [71, 75, 78] },
    { t: 11.31, d: 0.54, ns: [40, 52, 71, 78, 81] },
    { t: 11.84, d: 0.54, ns: [40, 52, 71, 76, 79] },
    { t: 12.38, d: 0.54, ns: [41, 53, 69, 74, 77] },
    { t: 12.92, d: 0.54, ns: [41, 53, 65, 69, 74] },
    { t: 13.45, d: 1.07, ns: [43, 55, 72] },
    { t: 13.55, d: 0.12, ns: [74] }
  ];

  // 瓦格纳《婚礼合唱》开头，C 大调，按 4/4 的附点节奏
  var MARCH = [
    { f: 392.00, d: 0.5 }, { f: 523.25, d: 1.5 }, { f: 523.25, d: 0.5 },
    { f: 587.33, d: 0.5 }, { f: 523.25, d: 0.5 }, { f: 659.25, d: 1.5 }, { f: 587.33, d: 2.0 },
    { f: 392.00, d: 0.5 }, { f: 523.25, d: 1.5 }, { f: 523.25, d: 0.5 },
    { f: 587.33, d: 0.5 }, { f: 523.25, d: 0.5 }, { f: 698.46, d: 1.5 }, { f: 659.25, d: 2.0 },
    { f: 392.00, d: 0.5 }, { f: 523.25, d: 1.5 }, { f: 523.25, d: 0.5 },
    { f: 587.33, d: 0.5 }, { f: 523.25, d: 0.5 }, { f: 659.25, d: 1.5 }, { f: 587.33, d: 2.0 },
    { f: 523.25, d: 1.0 }, { f: 440.00, d: 1.0 }, { f: 349.23, d: 1.0 },
    { f: 329.63, d: 1.0 }, { f: 293.66, d: 1.0 }, { f: 261.63, d: 2.0 }
  ];
  var MARCH_BEAT = 0.5;

  function tone(freq, dur, when, vol) {
    if (!freq) return;
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    var t0 = actx.currentTime + (when || 0);
    var osc = actx.createOscillator();
    var osc2 = actx.createOscillator();
    var gain = actx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc2.type = 'triangle';
    osc2.frequency.value = freq * 2;
    var g2 = actx.createGain();
    g2.gain.value = 0.12;
    var level = vol || 0.22;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(level, t0 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + (dur || 0.5));
    osc.connect(gain);
    osc2.connect(g2);
    g2.connect(gain);
    gain.connect(actx.destination);
    osc.start(t0); osc2.start(t0);
    osc.stop(t0 + (dur || 0.5) + 0.05);
    osc2.stop(t0 + (dur || 0.5) + 0.05);
  }

  function midiFreq(n) {
    return 440 * Math.pow(2, (n - 69) / 12);
  }

  function playMendelssohn() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    MENDE.forEach(function (g) {
      var top = Math.max.apply(null, g.ns);
      g.ns.forEach(function (n) {
        tone(midiFreq(n), g.d, g.t, n === top ? 0.10 : 0.055);
      });
    });
    herSay('门德尔松的。管风琴一响，我就想往你那边看。', { exp: 'joy', mood: 'joy' });
  }

  function playWeddingMarch() {
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    var beat = MARCH_BEAT;
    var t = 0;
    MARCH.forEach(function (n) {
      tone(n.f, n.d * beat, t, 0.20);
      t += n.d * beat;
    });
    // 低音踏板，撑住管风琴的厚度
    var starts = [];
    var acc = 0;
    MARCH.forEach(function (n) { starts.push(acc); acc += n.d * beat; });
    tone(130.81, 3.4, starts[0], 0.06);
    tone(130.81, 3.4, starts[7], 0.06);
    tone(130.81, 3.4, starts[14], 0.06);
    tone(174.61, 1.6, starts[21], 0.06);
    tone(130.81, 3.2, starts[21] + 3 * beat, 0.06);
    herSay('这是开头那一段。后面的我还没练熟。', { exp: 'joy', mood: 'joy' });
  }

  function openOrgan() {
    var whites = [
      { n: 'C4', f: 261.63 }, { n: 'D4', f: 293.66 }, { n: 'E4', f: 329.63 },
      { n: 'F4', f: 349.23 }, { n: 'G4', f: 392.00 }, { n: 'A4', f: 440.00 },
      { n: 'B4', f: 493.88 }, { n: 'C5', f: 523.25 }
    ];
    var blacks = [
      { i: 0, f: 277.18 }, { i: 1, f: 311.13 }, { i: 3, f: 369.99 },
      { i: 4, f: 415.30 }, { i: 5, f: 466.16 }
    ];
    var html = '<button class="x-btn" data-close type="button">×</button>' +
      '<h3>管风琴</h3><p class="sub">琴键是凉的。按下去的时候，会有一点回声。</p>' +
      '<div class="organ"><div class="organ-keys" id="organKeys">';
    whites.forEach(function (w) {
      html += '<button type="button" data-f="' + w.f + '" aria-label="' + w.n + '"></button>';
    });
    blacks.forEach(function (b) {
      html += '<button type="button" class="black" data-f="' + b.f + '" style="position:absolute;left:' +
        ((b.i + 1) * 12.5) + '%;width:7.2%;transform:translateX(-50%);" aria-label="black"></button>';
    });
    html += '</div><div class="btn-row"><button class="btn primary" id="playMarch" type="button">婚礼进行曲</button>' +
      '<button class="btn" id="playChorus" type="button">婚礼合唱</button>' +
      '<button class="btn" data-close type="button">合上琴盖</button></div></div>';
    openModal(html);
    $('#organKeys').addEventListener('click', function (e) {
      var b = e.target.closest('button[data-f]');
      if (!b) return;
      tone(parseFloat(b.dataset.f), 0.7, 0);
      b.classList.add('hit');
      setTimeout(function () { b.classList.remove('hit'); }, 180);
    });
    $('#playMarch').addEventListener('click', playMendelssohn);
    $('#playChorus').addEventListener('click', playWeddingMarch);
  }

  /* ---------------- 邀约 ---------------- */

  var PLACES = ['旧教堂的最后一排', '许愿石下', '钟楼顶层', '温室的花架旁', '泳池边', '管理局的天台', '玫瑰园的铁门前'];
  var ACTS = ['听我弹一首曲子', '在桥上锁下两个人的名字', '看一次日落', '挑一枚纸做的戒指', '把捧花抛给你', '在长椅上坐到灯灭'];

  function makeInvite() {
    var d = new Date();
    var place = PLACES[Math.floor(Math.random() * PLACES.length)];
    var act = ACTS[Math.floor(Math.random() * ACTS.length)];
    var time = ['傍晚六点', '晚上八点', '下午三点', '日落之前'][Math.floor(Math.random() * 4)];
    return {
      place: place, act: act, time: time,
      text: '谨 邀\n局长\n于 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · ' + time + '\n' + place + '\n' + act
    };
  }

  function openInvite() {
    var inv = makeInvite();
    var html = '<div class="invite">' +
      '<div class="kicker">奇诡话剧 · 私人邀约</div>' +
      '<p class="inv-line">' + inv.text.replace(/\n/g, '<br>') + '</p>' +
      '<div class="sign">格芮芙</div>' +
      '<div class="wax">芮</div></div>' +
      '<div class="btn-row"><button class="btn primary" data-close type="button">收下</button></div>';
    openModal(html);
    herSay('我写了邀请函。火漆压得不太好，边缘有点歪。', { exp: 'smile', mood: 'smile' });
  }

  /* ---------------- 提醒 ---------------- */

  function renderReminders() {
    var list = $('#remindList');
    if (!list) return;
    if (!state.reminders.length) {
      list.innerHTML = '<li style="justify-content:center;color:rgba(255,255,255,.32)">还没有约定。</li>';
      return;
    }
    list.innerHTML = '';
    state.reminders.slice().sort(function (a, b) { return a.time < b.time ? -1 : 1; }).forEach(function (r) {
      var li = document.createElement('li');
      li.innerHTML = '<time>' + r.time + '</time><span>' + escapeHtml(r.text) + '</span>' +
        '<button type="button" data-del="' + r.id + '" aria-label="删除">×</button>';
      list.appendChild(li);
    });
    list.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.reminders = state.reminders.filter(function (r) { return r.id !== b.dataset.del; });
        save();
        renderReminders();
        updateMeta();
        updateMeta();
      });
    });
  }

  function openRemind() {
    var d = new Date();
    var def = pad(Math.min(23, d.getHours() + 1)) + ':00';
    var html = '<button class="x-btn" data-close type="button">×</button>' +
      '<h3>约定</h3><p class="sub">到点了，我会准时来找你。</p>' +
      '<ul class="remind-list" id="remindList"></ul>' +
      '<div class="field"><label>时间</label><input id="rTime" type="time" value="' + def + '"></div>' +
      '<div class="field"><label>要提醒你的事</label><input id="rText" type="text" maxlength="40" placeholder="喝水、吃药、去开会……"></div>' +
      '<div class="field"><label>重复</label><select id="rRepeat"><option value="daily">每天</option><option value="once">只这一次</option></select></div>' +
      '<div class="btn-row"><button class="btn primary" id="rAdd" type="button">交给她</button><button class="btn" data-close type="button">算了</button></div>';
    openModal(html);
    renderReminders();

    $('#rAdd').addEventListener('click', function () {
      var time = $('#rTime').value;
      var text = $('#rText').value.trim();
      if (!time || !text) { toast('时间和事都写一下。'); return; }
      state.reminders.push({
        id: 'r' + Date.now(), time: time, text: text,
        repeat: $('#rRepeat').value, fired: ''
      });
      save();
      renderReminders();
      $('#rText').value = '';
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      herSay('记住了。' + time + '，我会来提醒你。', { exp: 'soft', mood: 'calm' });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function checkReminders() {
    var now = new Date();
    var hm = hhmm(now);
    var key = dayKey(now) + ' ' + hm;
    var due = [];
    state.reminders.forEach(function (r) {
      if (r.time === hm && r.fired !== key) {
        r.fired = key;
        due.push(r);
      }
    });
    if (!due.length) return;
    updateMeta();
    due.forEach(function (r) {
      herSay(GF.reminderLine(r.time, r.text), { exp: 'soft', mood: 'calm' });
      if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification('格芮芙', { body: r.time + ' · ' + r.text }); } catch (e) {}
      }
      if (r.repeat === 'once') {
        state.reminders = state.reminders.filter(function (x) { return x.id !== r.id; });
      }
    });
    save();
  }



  /* ---------------- 陪伴 / 专注 ---------------- */

  var focusState = {
    mode: 'up', running: false, elapsed: 0,
    total: 25 * 60, remaining: 25 * 60, interval: 25,
    lastPlace: 0, done: false
  };
  var focusBubbleTimer = null;
  var sceneKey = 'vow';
  var sceneSkin = 'vow';

  var SCENES = {
    vow: { type: 'art', img: 'assets/scenes/portrait.jpg', skin: 'vow', label: '婚纱' },
    garden: { type: 'art', img: 'assets/scenes/original.jpg', skin: 'original', label: '幽庭' },
    corridor: { type: 'art', img: 'assets/scenes/qipao.jpg', skin: 'qipao', label: '深廊' },
    close: { type: 'art', img: 'assets/scenes/portrait.jpg', skin: 'vow', label: '近景' },
    cafe: { type: 'room', img: 'assets/scenes/room_cafe.jpg', label: '咖啡馆', painted: true },
    library: { type: 'room', img: 'assets/scenes/room_library.jpg', label: '图书馆', painted: true },
    classroom: { type: 'room', img: 'assets/scenes/room_classroom.jpg', label: '教室', painted: true },
    home: { type: 'room', img: 'assets/scenes/room_home.jpg', label: '家里', painted: true }
  };

  var skinChoice = 'vow';

  function setActorPose(exp) {
    var s = SKINS[skinChoice] || SKINS.vow;
    var file = (s.exp && s.exp[exp]) || (s.exp && s.exp.calm) || 'idle';
    $('#sceneActor').src = 'assets/char/' + file + '.png';
  }

  function renderDateSkins() {
    var box = $('#dateSkins');
    box.innerHTML = '';
    ['vow', 'pajama', 'qipao'].forEach(function (key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.dataset.skin = key;
      b.title = SKINS[key].name;
      b.style.backgroundImage = 'url("' + SKINS[key].thumb + '")';
      b.classList.toggle('is-on', key === skinChoice);
      box.appendChild(b);
    });
  }

  function setScene(key) {
    if (!SCENES[key]) key = 'vow';
    sceneKey = key;
    var def = SCENES[key];
    var room = def.type === 'room';
    sceneSkin = room ? skinChoice : def.skin;
    $('#focus').dataset.scene = key;
    $('#focus').classList.toggle('is-painted', !!def.painted);
    $('#stageImg').src = def.img + '?v=14';
    $('#sceneActor').hidden = !room;
    $('#dateSkins').hidden = !room;
    var sf = $('#stageFore');
    if (sf) { sf.hidden = !(room && def.painted); if (def.painted) sf.src = def.img + '?v=14'; }
    var tf = $('#tableFg'); if (tf) tf.hidden = !room || !!def.painted;
    var tp = $('#tableProps'); if (tp) tp.hidden = !room;
    if (room) {
      setActorPose('calm');
      renderDateSkins();
    }
    document.querySelectorAll('#sceneTabs button').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.scene === key);
    });
  }

  function fmtClock(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    return h > 0 ? (pad(h) + ':' + pad(m) + ':' + pad(s)) : (pad(m) + ':' + pad(s));
  }

  function ensureAudio() {
    if (!window.AudioContext && !window.webkitAudioContext) return;
    if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
  }

  function chime(big) {
    ensureAudio();
    tone(659.25, 0.6, 0);
    tone(987.77, 0.7, 0.18);
    if (big) tone(1318.5, 0.9, 0.38);
  }

  function notifyFocus(title) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification(title, { body: '她在等你抬头。', tag: 'focus' }); } catch (e) {}
    }
    if (document.hidden) flashTitle(title);
  }

  function showFocusBubble(text) {
    var b = $('#focusBubble');
    b.textContent = text;
    b.hidden = false;
    clearTimeout(focusBubbleTimer);
    focusBubbleTimer = setTimeout(function () { b.hidden = true; }, 30000);
  }

  function renderFocusOpts() {
    var box = $('#focusOpts');
    box.innerHTML = '';
    if (focusState.mode === 'up') {
      box.innerHTML = '<span>从零开始，看看能坐多久。</span>';
      return;
    }
    var presets = focusState.mode === 'down' ? [15, 25, 45, 60] : [15, 25, 45];
    presets.forEach(function (min) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = min + ' 分';
      var cur = focusState.mode === 'down' ? Math.round(focusState.total / 60) : focusState.interval;
      b.classList.toggle('is-on', cur === min);
      b.addEventListener('click', function () {
        if (focusState.mode === 'down') {
          focusState.total = min * 60;
          focusState.remaining = min * 60;
        } else {
          focusState.interval = min;
        }
        resetFocus();
      });
      box.appendChild(b);
    });
    var label = document.createElement('label');
    var cur2 = focusState.mode === 'down' ? Math.round(focusState.total / 60) : focusState.interval;
    label.innerHTML = '自定义 <input type="number" min="1" max="180" value="' + cur2 + '"> 分';
    var input = label.querySelector('input');
    input.addEventListener('change', function () {
      var v = parseInt(input.value, 10);
      if (!v || v < 1) v = 1;
      if (v > 180) v = 180;
      if (focusState.mode === 'down') {
        focusState.total = v * 60;
        focusState.remaining = focusState.total;
      } else {
        focusState.interval = v;
      }
      resetFocus();
    });
    box.appendChild(label);
  }

  function updateFocusUI() {
    var t = focusState.mode === 'down' ? focusState.remaining : focusState.elapsed;
    $('#focusClock').textContent = fmtClock(t);
    var label = focusState.mode === 'up'
      ? '正向计时'
      : focusState.mode === 'down'
        ? '倒计时 · ' + Math.round(focusState.total / 60) + ' 分钟'
        : '间隔 · 每 ' + focusState.interval + ' 分钟';
    $('#focusModeLabel').textContent = label;
    document.querySelectorAll('#focusTabs button').forEach(function (b) {
      b.classList.toggle('is-on', b.dataset.mode === focusState.mode);
    });
  }

  function resetFocus() {
    focusState.running = false;
    focusState.elapsed = 0;
    focusState.remaining = focusState.total;
    focusState.done = false;
    document.body.classList.remove('focus-done');
    $('#focus').classList.remove('celebrate');
    $('#focusDoneBanner').hidden = true;
    $('#endImg').hidden = true;
    $('#focusStart').textContent = '开始';
    $('#focusBubble').hidden = true;
    if (SCENES[sceneKey] && SCENES[sceneKey].type === 'room') setActorPose('calm');
    renderFocusOpts();
    updateFocusUI();
  }

  function openFocus() {
    $('#focus').hidden = false;
    $('#focusName').textContent = (GF.P.name || '她') + ' · 陪着你';
    focusState.lastPlace = Date.now();
    setScene(sceneKey);
    resetFocus();
    if (SCENES[sceneKey] && SCENES[sceneKey].type === 'room') {
      setActorPose('wave');
      setTimeout(function () {
        if (!$('#focus').hidden && SCENES[sceneKey].type === 'room') setActorPose('calm');
      }, 2600);
    }
    ensureAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  function closeFocus() {
    $('#focus').hidden = true;
    focusState.running = false;
    $('#focusBubble').hidden = true;
    $('#focus').classList.remove('celebrate');
    $('#focusDoneBanner').hidden = true;
    $('#endImg').hidden = true;
    document.body.classList.remove('focus-done');
  }

  function toggleFocusTimer() {
    if (focusState.running) {
      focusState.running = false;
      $('#focusStart').textContent = '继续';
      return;
    }
    if (focusState.mode === 'down' && focusState.remaining <= 0) focusState.remaining = focusState.total;
    focusState.running = true;
    focusState.done = false;
    document.body.classList.remove('focus-done');
    $('#focus').classList.remove('celebrate');
    $('#focusDoneBanner').hidden = true;
    $('#endImg').hidden = true;
    $('#focusStart').textContent = '暂停';
    focusState.lastPlace = Date.now();
  }

  function finishFocus() {
    focusState.running = false;
    focusState.done = true;
    $('#focusStart').textContent = '再来一次';
    document.body.classList.add('focus-done');
    $('#focus').classList.add('celebrate');
    $('#focusDoneBanner').hidden = false;
    if (SCENES[sceneKey] && SCENES[sceneKey].type === 'room') {
      setActorPose('joy');
    } else {
      var chibiSkin = (SKINS[sceneSkin] && SKINS[sceneSkin].actor) ? sceneSkin : 'vow';
      var file = (SKINS[chibiSkin].exp && SKINS[chibiSkin].exp.joy) || 'happy';
      $('#endImg').src = 'assets/char/' + file + '.png';
      $('#endImg').hidden = false;
    }
    showFocusBubble('时间到。你做到了。');
    chime(true);
    notifyFocus('时间到');
    setTimeout(function () {
      $('#focusDoneBanner').hidden = true;
      $('#endImg').hidden = true;
      document.body.classList.remove('focus-done');
    }, 6000);
  }

  function dateZoneFromPoint(x, y) {
    if (y < 0.2) return 'head';
    if (y < 0.34) return (x < 0.3 || x > 0.7) ? 'ear' : 'face';
    if (y < 0.52) return 'chest';
    if (y < 0.66) return (x < 0.38 || x > 0.62) ? 'hand' : 'waist';
    return 'waist';
  }

  function chibiZoneFromPoint(x, y) {
    if (y < 0.12) return 'head';
    if (y < 0.32) return (x < 0.32 || x > 0.68) ? 'ear' : 'face';
    if (y < 0.45) return 'chest';
    if (y < 0.58) return (x < 0.36 || x > 0.64) ? 'hand' : 'waist';
    if (y < 0.72) return 'waist';
    if (y < 0.9) return 'leg';
    return 'foot';
  }

  function dateTouch(zone) {
    lastActivity = Date.now();
    var key = 'date_' + zone;
    var n = (state.touches[key] || 0) + 1;
    state.touches[key] = n;
    var res;
    if (Math.random() < 0.48) {
      res = { text: GF.pick(GF.P.dateTouch[zone] || GF.P.dateTouch.head), exp: 'shy', mood: 'shy' };
    } else {
      res = GF.touch(zone, n, GF.state.aff);
    }
    GF.state.aff = Math.min(100, GF.state.aff + 1);
    var img = $('#stageImg');
    img.classList.remove('pulse');
    void img.offsetWidth;
    img.classList.add('pulse');
    setTimeout(function () { img.classList.remove('pulse'); }, 600);
    showFocusBubble(res.text);
    updateMeta();
    save();
  }

  setInterval(function () {
    if ($('#focus').hidden) return;
    if (Date.now() - focusState.lastPlace > 300000) {
      focusState.lastPlace = Date.now();
      showFocusBubble(GF.placeLine(sceneSkin));
      if (SCENES[sceneKey] && SCENES[sceneKey].type === 'room' && Math.random() < 0.4) {
        setActorPose(Math.random() < 0.5 ? 'doze' : 'pray');
      }
    }
    if (!focusState.running) return;
    focusState.elapsed += 1;
    if (focusState.mode === 'down') {
      focusState.remaining -= 1;
      if (focusState.remaining <= 0) {
        focusState.remaining = 0;
        finishFocus();
        updateFocusUI();
        return;
      }
    }
    if (focusState.mode === 'interval' && focusState.elapsed % (focusState.interval * 60) === 0) {
      showFocusBubble('到点了。站起来走两步。');
      chime(false);
      notifyFocus('该歇一下了');
    }
    updateFocusUI();
  }, 1000);

  /* ---------------- 可选：大模型 ---------------- */

  function buildLLMPrompt() {
    var s = SKINS[currentSkin];
    return [
      '你在扮演《无期迷途》的格芮芙，MBCC-S-214，鬼新娘。',
      '说话短，留白多，礼貌，遇事先想自己是不是做错了。谈婚礼会雀跃，谈童年会低落，紧张时句子会断。',
      '称呼对方为局长。不用网络梗，不用破折号，不写露骨内容。亲密的话按好感分层。',
      '现在穿着「' + s.name + '」，亲密度 ' + GF.state.aff + '。',
      '只回一到三句话，用中文，不要解释设定，不要出戏。'
    ].join('\n');
  }

  async function llmReply(text) {
    var cfg = state.llm;
    var url = String(cfg.base || '').replace(/\/+$/, '');
    if (!/\/chat\/completions$/.test(url)) url += '/chat/completions';
    var history = state.log.filter(function (m) { return m.who !== 'system'; }).slice(-10)
      .map(function (m) { return { role: m.who === 'me' ? 'user' : 'assistant', content: m.text }; });
    var body = {
      model: cfg.model,
      temperature: 0.9,
      max_tokens: 300,
      messages: [{ role: 'system', content: buildLLMPrompt() }]
        .concat(history)
        .concat([{ role: 'user', content: text }])
    };
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 20000);
    try {
      var res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var data = await res.json();
      var msg = data.choices && data.choices[0] && data.choices[0].message;
      return msg && msg.content ? String(msg.content).trim() : '';
    } finally {
      clearTimeout(timer);
    }
  }

  function openLLM() {
    var c = state.llm || {};
    var html = '<button class="x-btn" data-close type="button">×</button>' +
      '<h3>对话模型</h3>' +
      '<p class="sub">填一个 OpenAI 兼容接口。留空就用本地台词库。</p>' +
      '<div class="field"><label>接口地址</label><input id="llmBase" type="text" placeholder="https://api.openai.com/v1"></div>' +
      '<div class="field"><label>密钥</label><input id="llmKey" type="password" placeholder="sk-..."></div>' +
      '<div class="field"><label>模型</label><input id="llmModel" type="text" placeholder="gpt-4o-mini"></div>' +
      '<div class="field"><label style="display:flex;align-items:center;gap:8px;font-size:12px;letter-spacing:0">' +
      '<input id="llmOn" type="checkbox" style="width:auto"> 使用大模型</label></div>' +
      '<p class="study-note">密钥只存在这台电脑的浏览器里。请求直接发给你填的接口，不经过别处。</p>' +
      '<div class="btn-row"><button class="btn primary" id="llmSave" type="button">保存</button>' +
      '<button class="btn" data-close type="button">取消</button></div>';
    openModal(html);
    $('#llmBase').value = c.base || '';
    $('#llmKey').value = c.key || '';
    $('#llmModel').value = c.model || '';
    $('#llmOn').checked = !!c.on;
    $('#llmSave').addEventListener('click', function () {
      state.llm = {
        on: $('#llmOn').checked,
        base: $('#llmBase').value.trim(),
        key: $('#llmKey').value.trim(),
        model: $('#llmModel').value.trim()
      };
      save();
      closeModal();
      toast(state.llm.on ? '大模型已接上。' : '先用本地台词库。');
    });
  }

  /* ---------------- 雅思陪跑 ---------------- */

  var BASE_TITLE = document.title;
  var titleTimer = null;

  function studySessionKey(d) {
    var h = d.getHours();
    if (h < 2) {
      var y = new Date(d);
      y.setDate(y.getDate() - 1);
      return dayKey(y);
    }
    return dayKey(d);
  }

  function studyDay(key) {
    var k = key || studySessionKey(new Date());
    if (!state.study.days[k]) state.study.days[k] = { checks: 0, focus: 0, slack: 0 };
    return state.study.days[k];
  }

  function flashTitle(msg) {
    if (titleTimer) return;
    var on = false;
    titleTimer = setInterval(function () {
      document.title = on ? BASE_TITLE : '✦ ' + msg;
      on = !on;
    }, 1200);
    window.addEventListener('focus', function () {
      clearInterval(titleTimer);
      titleTimer = null;
      document.title = BASE_TITLE;
    }, { once: true });
  }

  function notifyStudy(line) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try { new Notification('格芮芙 · 雅思', { body: line, tag: 'study' }); } catch (e) {}
    }
    if (document.hidden) flashTitle('该学雅思了');
  }

  function addStudyActions() {
    document.querySelectorAll('.qa').forEach(function (n) { n.remove(); });
    var chips = $('#chips');
    if (chips) chips.hidden = true;
    var wrap = document.createElement('div');
    wrap.className = 'qa';
    wrap.innerHTML = '<button type="button" data-a="focus">在学</button>' +
      '<button type="button" data-a="slack">走神了</button>';
    logEl.appendChild(wrap);
    scrollLog();
    wrap.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      wrap.remove();
      studyAnswer(b.dataset.a);
    });
  }

  function studyAnswer(kind) {
    lastActivity = Date.now();
    var d = studyDay();
    if (kind === 'focus') {
      d.focus += 1;
      herSay(GF.pick(GF.P.study.praise), { exp: 'joy', mood: 'smile' });
    } else {
      d.slack += 1;
      herSay(GF.pick(GF.P.study.slack), { exp: 'soft', mood: 'calm' });
    }
    save();
    renderStudyStats();
  }

  function studyFire(hour, opts) {
    opts = opts || {};
    lastActivity = Date.now();
    var line = GF.studyLine(hour);
    var exp = hour === 1 ? 'sleepy' : (hour === 10 ? 'wave' : (hour >= 22 || hour === 0 ? 'soft' : 'calm'));
    return herSay(line, { exp: exp, mood: 'calm' }).then(function () {
      if (hour !== 1) addStudyActions();
      if (!opts.silent) notifyStudy(line);
    });
  }

  function checkStudy() {
    if (!state.study || !state.study.on) return;
    var now = new Date();
    var h = now.getHours();
    if (!(h >= 10 || h <= 1)) return;
    var key = studySessionKey(now) + 'T' + h;
    if (state.study.fired[key]) return;
    state.study.fired[key] = Date.now();
    var d = studyDay();
    d.checks += 1;
    pruneStudy();
    save();
    renderStudyStats();
    studyFire(h);
  }

  function pruneStudy() {
    if (Object.keys(state.study.fired).length > 80) state.study.fired = {};
    var days = Object.keys(state.study.days).sort();
    while (days.length > 10) delete state.study.days[days.shift()];
  }

  function renderStudyStats() {
    var el = $('#studyChecks');
    if (!el) return;
    var d = studyDay();
    el.textContent = d.checks;
    $('#studyFocus').textContent = d.focus;
    $('#studySlack').textContent = d.slack;
    var st = $('#studyState');
    if (st) {
      st.dataset.on = state.study.on ? '1' : '0';
      st.textContent = state.study.on ? '陪跑中' : '已暂停';
    }
    var btn = $('#studyToggle');
    if (btn) btn.textContent = state.study.on ? '暂停陪跑' : '开始陪跑';
  }

  function openStudy() {
    var html = '<button class="x-btn" data-close type="button">×</button>' +
      '<h3>雅思陪跑</h3>' +
      '<p class="sub">每天 10:00 开始，每小时来一次，次日 01:00 收工。</p>' +
      '<div class="study-state" id="studyState" data-on="1">陪跑中</div>' +
      '<div class="study-stats">' +
      '<div><b id="studyChecks">0</b><span>今天检查</span></div>' +
      '<div><b id="studyFocus">0</b><span>在学</span></div>' +
      '<div><b id="studySlack">0</b><span>走神</span></div>' +
      '</div>' +
      '<p class="study-note">页面开着才会提醒。把这个标签页固定住，别让系统把它挂起。</p>' +
      '<div class="btn-row">' +
      '<button class="btn primary" id="studyToggle" type="button">暂停陪跑</button>' +
      '<button class="btn" id="studyNow" type="button">现在检查</button>' +
      '</div>';
    openModal(html);
    renderStudyStats();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    $('#studyToggle').addEventListener('click', function () {
      state.study.on = !state.study.on;
      save();
      renderStudyStats();
      if (state.study.on) {
        herSay('那我从十点开始。一个小时来一次，到一点。', { exp: 'soft', mood: 'calm' });
      } else {
        herSay('好。我先不催你。想开始的时候，点一下「学习」。', { exp: 'soft', mood: 'calm' });
      }
    });
    $('#studyNow').addEventListener('click', function () {
      var h = new Date().getHours();
      if (!(h >= 10 || h <= 1)) h = 15;
      studyDay().checks += 1;
      save();
      renderStudyStats();
      closeModal();
      studyFire(h, { silent: true });
    });
  }

  /* ---------------- 启动 ---------------- */

  function boot() {
    buildSkins();
    buildPetals();
    var urlSkin = new URLSearchParams(location.search).get('skin');
    if (urlSkin && SKINS[urlSkin]) { state.skin = urlSkin; currentSkin = urlSkin; }
    applySkin(currentSkin, true);

    var now = new Date();
    var gapH = state.lastVisit ? (now.getTime() - state.lastVisit) / 3600000 : 999;

    if (state.log.length) {
      state.log.forEach(function (m) {
        var node = addMsg(m.who, m.text, { noStore: true });
        node.classList.add('no-anim');
      });
      if (gapH > 6) {
        var greet = '';
        if (state.lastGreetDay !== dayKey(now)) {
          state.lastGreetDay = dayKey(now);
          greet = GF.voiceLine(currentSkin, 'greet');
        }
        herSay(greet || GF.awayLine(gapH), { exp: 'soft', mood: 'calm' });
      }
    } else {
      sysSay(dateLine(now) + ' · ' + periodOf(now));
      sysSay('奇诡话剧 · 第 壹 幕　登场：格芮芙');
      setTimeout(function () {
        var own = GF.P.voice[currentSkin] && GF.P.voice[currentSkin].acquire;
        herSay(own || GF.opening(now), { exp: 'soft', mood: 'calm' });
      }, 600);
    }

    setInterval(function () {
      if (Date.now() - lastActivity < 60000) return;
      var sk = SKINS[currentSkin];
      if (sk && sk.actor && Date.now() - lastActivity > 150000) {
        var hr = new Date().getHours();
        var idleExp = ((hr >= 23 || hr < 5) && sk.exp.sit) ? 'sit' : 'sleepy';
        setPose(sk.exp[idleExp]);
      }
      if (Date.now() - lastActivity > 360000 && Date.now() - (state.lastIdleVoice || 0) > 3600000) {
        state.lastIdleVoice = Date.now();
        var idleVoice = GF.voiceLine(currentSkin, 'idle');
        if (idleVoice) herSay(idleVoice, { exp: 'sleepy', mood: 'sleepy' });
      }
      var el = $('#idleLine');
      el.style.opacity = '0';
      setTimeout(function () {
        el.textContent = IDLE_LINES[Math.floor(Math.random() * IDLE_LINES.length)];
        el.style.opacity = '1';
      }, 500);
    }, 42000);

    setInterval(checkReminders, 15000);
    setTimeout(checkReminders, 1200);
    setInterval(checkStudy, 20000);
    setTimeout(checkStudy, 2500);

    $('#idleSub').textContent = dateLine(now) + ' · ' + periodOf(now) + ' · 第 ' + (state.visits + 1) + ' 次见面';
    state.visits += 1;
    updateMeta();

    initVoice();
  }

  /* ---------------- 事件 ---------------- */

  $('#composer').addEventListener('submit', function (e) {
    e.preventDefault();
    var text = inputEl.value.trim();
    if (!text) { inputEl.focus(); return; }
    inputEl.value = '';
    respond(text);
  });

  $('#llmBtn').addEventListener('click', openLLM);


  $('#rituals').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-act]');
    if (!b) return;
    var act = b.dataset.act;
    if (act === 'touch') openTouch();
    if (act === 'companion') openFocus();
    if (act === 'organ') openOrgan();
    if (act === 'invite') openInvite();
    if (act === 'remind') openRemind();
    if (act === 'study') openStudy();
  });

  $('#focusClose').addEventListener('click', closeFocus);
  $('#focusStart').addEventListener('click', toggleFocusTimer);
  $('#focusReset').addEventListener('click', resetFocus);
  $('#focusTabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-mode]');
    if (!b) return;
    focusState.mode = b.dataset.mode;
    resetFocus();
  });

  $('#sceneTabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-scene]');
    if (!b) return;
    setScene(b.dataset.scene);
  });

  $('#stageImg').addEventListener('click', function (e) {
    if (SCENES[sceneKey] && SCENES[sceneKey].type === 'room') return;
    var r = this.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width;
    var y = (e.clientY - r.top) / r.height;
    dateTouch(dateZoneFromPoint(x, y));
  });

  $('#sceneActor').addEventListener('click', function (e) {
    var r = this.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width;
    var y = (e.clientY - r.top) / r.height;
    dateTouch(chibiZoneFromPoint(x, y));
  });

  $('#tableProps').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-prop]');
    if (!b) return;
    var d = GF.P.tableTouch[b.dataset.prop];
    if (!d) return;
    setActorPose(d.exp);
    showFocusBubble(GF.pick(d.lines));
    GF.state.aff = Math.min(100, GF.state.aff + 1);
    updateMeta();
    save();
  });

  $('#dateSkins').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-skin]');
    if (!b) return;
    skinChoice = b.dataset.skin;
    sceneSkin = skinChoice;
    setActorPose('calm');
    renderDateSkins();
  });

  $('#actor').addEventListener('click', function (e) {
    var r = this.getBoundingClientRect();
    var x = (e.clientX - r.left) / r.width;
    var y = (e.clientY - r.top) / r.height;
    if (alphaMap && alphaW) {
      var px = Math.min(alphaW - 1, Math.max(0, Math.floor(x * alphaW)));
      var py = Math.min(alphaH - 1, Math.max(0, Math.floor(y * alphaH)));
      if (alphaMap[(py * alphaW + px) * 4 + 3] < 24) return;
    }
    touchZone(zoneFromPoint(x, y));
  });

  $('#chips').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    respond(b.textContent);
  });


  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) checkReminders();
  });

  window.addEventListener('beforeunload', save);

  boot();

})();
