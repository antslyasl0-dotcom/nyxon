/* إعدادات مشروع Firebase الخاص بـ NYXON.
   هذي القيم ليست أسراراً: كل موقع Firebase يعرضها في المتصفح.
   اللي يحمي بياناتك هو ملف firestore.rules — تأكد إنك نشرته. */

window.NYXON_CONFIG = {
  firebase: {
    apiKey:            "AIzaSyDv6VZpkoHBLwp-dokZWJuOzYP39ErItr4",
    authDomain:        "nyxon-could.firebaseapp.com",
    projectId:         "nyxon-could",
    storageBucket:     "nyxon-could.firebasestorage.app",
    messagingSenderId: "461625884067",
    appId:             "1:461625884067:web:c420f2a90c16ae74f06e16"
  },

  /* معرّفك كمالك للتطبيق.
     افتح setup.html على موقعك، سجّل دخولك بقوقل، وهي تعطيك المعرّف
     بزر نسخ. حطه هنا وفي firestore.rules مكان OWNER_UID. */
  ownerUid: "b9iTpBRsxdexdw44633V3IjDU9M2"
};
