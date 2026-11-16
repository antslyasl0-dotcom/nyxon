/* nyxon-runtime.js
 *
 * يخلي تطبيق NYXON يشتغل على Firebase بدل منصة claude.ai.
 *
 * التطبيق مكتوب على واجهة اسمها window.claude.use(...)، وهذا الملف يبني نفس
 * الواجهة بالضبط فوق Firebase — فكود التطبيق يبقى زي ما هو تقريباً.
 *
 * ترتيب التحميل في index.html:
 *   1) firebase-app-compat.js + firebase-auth-compat.js + firebase-firestore-compat.js
 *   2) config.js      (إعدادات مشروعك)
 *   3) هذا الملف
 *   4) سكربت التطبيق
 */
(function () {
  "use strict";

  var CFG = window.NYXON_CONFIG || {};

  function placeholderish(v) { return !v || /ضع|اسم-مشروعك/.test(String(v)); }

  /* بدل شاشة فاضية محيّرة: قل للشخص وش ناقص ووين يروح */
  if (!CFG.firebase || placeholderish(CFG.firebase.apiKey) || placeholderish(CFG.firebase.projectId)) {
    document.addEventListener("DOMContentLoaded", function () {
      var d = document.createElement("div");
      d.setAttribute("dir", "rtl");
      d.style.cssText = "position:fixed;inset:0;z-index:999;background:#0A0E13;color:#E9EEF4;" +
        "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;" +
        "padding:28px;text-align:center;font-family:system-ui,-apple-system,sans-serif";
      d.innerHTML =
        '<img src="icon-192.png" alt="" width="88" height="88" style="border-radius:22px">' +
        '<div style="font-size:19px;font-weight:700;color:#E8B33C;letter-spacing:.2em">NYXON</div>' +
        '<div style="max-width:440px;line-height:1.8">التطبيق ما عنده إعدادات بعد. ' +
        'سمِّ <code style="background:#18212C;padding:2px 7px;border-radius:6px">config.example.js</code> ' +
        'باسم <code style="background:#18212C;padding:2px 7px;border-radius:6px">config.js</code> وعبّيه من لوحة Firebase.</div>' +
        '<a href="setup.html" style="background:#E8B33C;color:#1A1304;font-weight:700;text-decoration:none;' +
        'padding:12px 22px;border-radius:10px">افتح صفحة فحص الإعداد</a>';
      document.body.appendChild(d);
    });
    console.error("NYXON: ما فيه إعدادات. افتح setup.html");
    return;
  }

  firebase.initializeApp(CFG.firebase);
  var fs = firebase.firestore();
  var auth = firebase.auth();

  /* ---------- رموز الأخطاء ----------
     التطبيق يفحص رموز منصة claude.ai، و Firestore يرجع رموز ثانية.
     نترجمها هنا عشان ما نغيّر في التطبيق. */
  function mapErr(e) {
    var c = (e && e.code) || "";
    if (c === "permission-denied" || c === "unauthenticated")
      return { code: "invalid_argument", message: String((e && e.message) || "") };
    if (c === "unavailable" || c === "deadline-exceeded" || c === "aborted")
      return { code: "unavailable", message: String((e && e.message) || "") };
    if (c === "resource-exhausted")
      return { code: "resource_exhausted", message: String((e && e.message) || "") };
    return { code: c || "unavailable", message: String((e && e.message) || "") };
  }

  function wrapSnap(s) {
    return {
      id: s.id,
      exists: s.exists,
      data: function () { return s.data(); },
      metadata: {
        fromCache: !!(s.metadata && s.metadata.fromCache),
        hasPendingWrites: !!(s.metadata && s.metadata.hasPendingWrites)
      }
    };
  }
  function wrapQuery(q) {
    return {
      docs: q.docs.map(wrapSnap),
      size: q.size,
      empty: q.empty,
      docChanges: function () { return []; },
      metadata: {
        fromCache: !!(q.metadata && q.metadata.fromCache),
        hasPendingWrites: !!(q.metadata && q.metadata.hasPendingWrites)
      }
    };
  }

  function wrapDoc(ref) {
    return {
      id: ref.id,
      path: ref.path,
      get: function () { return ref.get().then(wrapSnap, function (e) { throw mapErr(e); }); },
      set: function (d) { return ref.set(d).catch(function (e) { throw mapErr(e); }); },
      update: function (d) { return ref.update(d).catch(function (e) { throw mapErr(e); }); },
      delete: function () { return ref.delete().catch(function (e) { throw mapErr(e); }); },
      onSnapshot: function (next, err) {
        return ref.onSnapshot(
          function (s) { next(wrapSnap(s)); },
          function (e) { if (err) err(mapErr(e)); }
        );
      },
      collection: function (p) { return wrapCol(ref.collection(p)); }
    };
  }
  function wrapCol(ref) {
    return {
      path: ref.path,
      doc: function (id) { return wrapDoc(id ? ref.doc(id) : ref.doc()); },
      add: function (d) { return ref.add(d).then(wrapDoc, function (e) { throw mapErr(e); }); },
      where: function (f, o, v) { return wrapCol(ref.where(f, o, v)); },
      orderBy: function (f, d) { return wrapCol(ref.orderBy(f, d)); },
      limit: function (k) { return wrapCol(ref.limit(k)); },
      get: function () { return ref.get().then(wrapQuery, function (e) { throw mapErr(e); }); },
      onSnapshot: function (next, err) {
        return ref.onSnapshot(
          function (q) { next(wrapQuery(q)); },
          function (e) { if (err) err(mapErr(e)); }
        );
      }
    };
  }

  var db = {
    doc: function (p) { return wrapDoc(fs.doc(p)); },
    collection: function (p) { return wrapCol(fs.collection(p)); }
  };

  /* ---------- من يفتح الصفحة ----------
     العرض ما يحتاج حساب إطلاقاً. الدخول بقوقل مطلوب فقط لمن يبي
     يعرّف نفسه: يأكد حضوره، أو يدير. */
  var ME = { uid: null };
  var ready = new Promise(function (res) {
    var done = false;
    auth.onAuthStateChanged(function (u) {
      ME.uid = u ? u.uid : null;
      window.NYXON_USER = u ? { uid: u.uid, name: u.displayName || "", photo: u.photoURL || "" } : null;
      if (!done) { done = true; res(); }
      if (typeof window.nyxonAuthChanged === "function") window.nyxonAuthChanged(ME.uid);
    });
    setTimeout(function () { if (!done) { done = true; res(); } }, 6000);
  });

  var user = {
    id: function () { return ready.then(function () { return ME.uid; }); },
    me: function () { return ready.then(function () { return { id: ME.uid }; }); },
    isOwner: function () {
      return ready.then(function () { return !!ME.uid && ME.uid === CFG.ownerUid; });
    },
    canEdit: function () {
      return ready.then(function () { return !!ME.uid && ME.uid === CFG.ownerUid; });
    },
    can: function (name) {
      if (name !== "data.write") return Promise.resolve(null);
      // أي شخص داخل بحسابه يقدر على الأقل يرسل طلب تعريف.
      // القواعد في Firestore هي اللي ترفض اللي ما يستاهل،
      // والتطبيق يقفل الأزرار أول ما ترفض كتابة.
      return ready.then(function () { return !!ME.uid; });
    },
    profiles: function () { return Promise.resolve({}); }
  };

  /* ---------- تسجيل الدخول والخروج ---------- */
  window.nyxonSignIn = function () {
    var p = new firebase.auth.GoogleAuthProvider();
    return auth.signInWithPopup(p).catch(function (e) {
      var c = (e && e.code) || "";
      if (c === "auth/popup-blocked" || c === "auth/cancelled-popup-request" ||
          c === "auth/operation-not-supported-in-this-environment") {
        return auth.signInWithRedirect(p);
      }
      throw e;
    });
  };
  window.nyxonSignOut = function () { return auth.signOut(); };

  /* ---------- حفظ ملف للمستخدم ---------- */
  var downloads = {
    save: function (o) {
      try {
        var url = URL.createObjectURL(o.data);
        var a = document.createElement("a");
        a.href = url;
        a.download = o.filename || "nyxon";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 1500);
        return Promise.resolve();
      } catch (e) {
        return Promise.reject({ code: "failed", message: String(e) });
      }
    }
  };

  /* ---------- صور اللاعبين ----------
     بدل تخزين منفصل، الصورة تنحفظ كنص داخل وثيقة اللاعب نفسها.
     التطبيق يصغّرها لـ320 بكسل WebP قبل ما توصل هنا (~20 كيلوبايت)،
     وحد وثيقة Firestore مليون بايت، فهي مريحة. */
  var MAXB = 180 * 1024;
  var assets = {
    upload: function (blob) {
      return new Promise(function (res, rej) {
        if (blob && blob.size > MAXB) {
          rej({ code: "quota_exceeded", message: "الصورة كبيرة" });
          return;
        }
        var r = new FileReader();
        r.onload = function () { res({ id: String(r.result), url: String(r.result) }); };
        r.onerror = function () { rej({ code: "failed", message: "ما انقرأت الصورة" }); };
        r.readAsDataURL(blob);
      });
    },
    list: function () { return Promise.resolve({ assets: [], usage: {} }); },
    // الصورة تعيش داخل وثيقة اللاعب، فمسحها من الوثيقة يكفي
    delete: function () { return Promise.resolve(); }
  };

  window.claude = {
    use: function (n) {
      if (n === "db") return Promise.resolve(db);
      if (n === "user") return Promise.resolve(user);
      if (n === "downloads") return Promise.resolve(downloads);
      if (n === "assets") return Promise.resolve(assets);
      return Promise.resolve(null);
    }
  };
})();
