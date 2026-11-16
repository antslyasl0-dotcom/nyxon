/* عامل الخدمة: يخلي التطبيق ينتصب على الشاشة الرئيسية بأيقونته،
   ويفتح بسرعة. متعمّد يكون بسيط:
   - صفحة التطبيق: الشبكة أولاً، والنسخة المحفوظة احتياط لو الشبكة طايحة.
     (عشان ما يعلق أحد على نسخة قديمة بعد أي تحديث.)
   - الأيقونات والملفات الثابتة: المحفوظ أولاً.
   - Firebase وكل شي ثاني: ما نتدخل فيه إطلاقاً. */

var CACHE = 'nyxon-v1';
var SHELL = [
  './',
  './index.html',
  './nyxon-runtime.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(SHELL.map(function (u) {
        return c.add(u).catch(function () { /* ملف ناقص ما يوقف التنصيب */ });
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  var url;
  try { url = new URL(req.url); } catch (x) { return; }

  // بيانات Firebase ما تنحفظ أبداً — لازم تكون حيّة
  if (url.origin !== self.location.origin) return;

  var isPage = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').indexOf('text/html') >= 0;

  if (isPage) {
    e.respondWith(
      fetch(req).then(function (r) {
        var copy = r.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return r;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) {
          return r || new Response('التطبيق غير متاح بدون إنترنت.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
          });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (r) {
        if (r && r.status === 200 && r.type === 'basic') {
          var copy = r.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return r;
      });
    })
  );
});
