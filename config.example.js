/* انسخ هذا الملف باسم config.js وعبّيه من Firebase Console.
   وين تلقى القيم:
     Firebase Console ← ⚙ Project settings ← Your apps ← Web app ← SDK setup
   وهذي القيم مو أسرار: المتصفح يشوفها دايماً. اللي يحمي بياناتك هو
   ملف firestore.rules، مو إخفاء هذي الأرقام. */

window.NYXON_CONFIG = {
  firebase: {
    apiKey:            "ضع-المفتاح-هنا",
    authDomain:        "اسم-مشروعك.firebaseapp.com",
    projectId:         "اسم-مشروعك",
    storageBucket:     "اسم-مشروعك.appspot.com",
    messagingSenderId: "000000000000",
    appId:             "1:000000000000:web:0000000000000000000000"
  },

  /* معرّفك أنت كمالك للتطبيق. بعد ما تسجل دخولك بقوقل أول مرة،
     تلقاه في: Firebase Console ← Authentication ← Users ← عمود User UID.
     لازم يكون نفسه المكتوب في firestore.rules مكان OWNER_UID. */
  ownerUid: "ضع-المعرّف-هنا"
};
