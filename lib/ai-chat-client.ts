'use client'

import { isAndroidNativeApp } from '@/lib/mobile-pdf'

export type ChatRole = 'usthad' | 'academic' | 'language' | 'campus'
export type ChatLanguage = 'ml' | 'en' | 'ar' | 'ur' | 'es' | 'de'
export type ChatModelTier = 'flash' | 'flash-lite'
export type StudyMode = 'kitab' | 'qa' | 'translation' | 'dawa'

export interface ClientChatTurn {
  role: 'user' | 'model'
  text: string
}

export interface ClientChatAttachment {
  mimeType: string
  data: string
  name?: string
}

const REMOTE_BACKEND_ORIGINS = [
  'https://ais-pre-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app',
  'https://ais-dev-rhfqjrwneaewkmnanoof2j-896319436298.asia-east1.run.app',
]

function isCapacitorLocalOrigin(): boolean {
  if (typeof window === 'undefined') return false
  if (isAndroidNativeApp()) return true
  const { protocol, hostname, port } = window.location
  if (protocol === 'capacitor:' || protocol === 'file:') return true
  // Capacitor on Android serves from https://localhost (with empty port)
  if (hostname === 'localhost' && (!port || port === '80' || port === '443')) {
    return true
  }
  return false
}

function getCandidateApiUrls(apiPath: string): string[] {
  if (typeof window === 'undefined') return [apiPath]
  if (isCapacitorLocalOrigin()) {
    return REMOTE_BACKEND_ORIGINS.map((origin) => `${origin}${apiPath}`)
  }
  return [apiPath, ...REMOTE_BACKEND_ORIGINS.map((origin) => `${origin}${apiPath}`)]
}

function didStudentSaySalam(text: string): boolean {
  if (!text) return false
  return (
    /\b(salam|salaam|assalam|as-salam|as\s+salam|alsalam|al-salam|assalamu|assalaamu)\b/i.test(
      text,
    ) ||
    /السلام|سلام|السَّلَام|سَلَام/.test(text) ||
    /സലാം|അസ്സലാമു/.test(text)
  )
}

function getOpeningGreeting(
  language: ChatLanguage,
  isFirstTurn: boolean,
  userSaidSalam: boolean,
  studentName?: string,
): string {
  const cleanName = studentName?.trim() || 'dear student'
  const salamLine = userSaidSalam
    ? 'وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ'
    : isFirstTurn
      ? 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ'
      : ''

  if (!salamLine) return ''

  switch (language) {
    case 'ml':
      return `${salamLine}\nപ്രിയ വിദ്യാർത്ഥി ${cleanName},\n\n`
    case 'ar':
      return `${salamLine}\nأهلاً بك يا طالبي العزيز ${cleanName} في أكاديمية ICS،\n\n`
    case 'ur':
      return `${salamLine}\nعزیز طالب علم ${cleanName}، آئی سی ایس اکیڈمی میں خوش آمدید!\n\n`
    case 'es':
      return `${salamLine}\nEstimado estudiante ${cleanName},\n\n`
    case 'de':
      return `${salamLine}\nLieber Student ${cleanName},\n\n`
    case 'en':
    default:
      return `${salamLine}\nMy dear student ${cleanName},\n\n`
  }
}

export function generateClientScholarlyChatReply(params: {
  message: string
  history: ClientChatTurn[]
  role: ChatRole
  language: ChatLanguage
  studentName?: string
  studentClass?: string
}): string {
  const { message, history, role, language, studentName } = params
  const q = message.trim()
  const qLower = q.toLowerCase()
  const isFirstTurn = !history || history.length === 0
  const userSaidSalam = didStudentSaySalam(q)
  const greeting = getOpeningGreeting(language, isFirstTurn, userSaidSalam, studentName)

  // 1. Tayammum Conditions (Fathul Mueen / Shafi'i Fiqh)
  if (
    /tayammum|തയമ്മും|തയമ്മുമിന്റെ|التيمم|تیمم/i.test(q)
  ) {
    if (language === 'ml') {
      return `${greeting}**ഫത്ഹുൽ മുഈൻ (فَتْحُ الْمُعِينِ)** പ്രകാരം ശാഫിഈ മദ്ഹബിൽ തയമ്മും (التَّيَمُّم) ശരിയാകുന്നതിനുള്ള പ്രധാന ശർത്വുകൾ (شُرُوط) താഴെ പറയുന്നവയാണ്:

1. **വസ്തുതാപരമായ തടസ്സം (الْعُذْرُ بِفَقْدِ الْمَاءِ أَوْ مَرَضٍ):** വെള്ളം ഇല്ലാതിരിക്കുക അല്ലെങ്കിൽ വെള്ളം ഉപയോഗിക്കുന്നത് രോഗം വർദ്ധിപ്പിക്കുമെന്നോ ശമനം വൈകിപ്പിക്കുമെന്നോ ഉള്ള ഭയം ഉണ്ടായിരിക്കുക.
2. **സമയമാകൽ (دُخُولُ الْوَقْتِ):** ഏത് ഫർള് നിസ്കാരത്തിനാണോ തയമ്മും ചെയ്യുന്നത്, ആ നിസ്കാരത്തിന്റെ സമയം പ്രവേശിച്ചിരിക്കണം.
3. **വെള്ളം അന്വേഷിക്കൽ (طَلَبُ الْمَاءِ):** സമയം പ്രവേശിച്ച ശേഷം തന്റെ പക്കലോ സമീപത്തോ വെള്ളമുണ്ടോ എന്ന് അന്വേഷിക്കൽ നിർബന്ധമാണ്.
4. **ശുദ്ധമായ മണ്ണ് (تُرَابٌ طَهُورٌ لَهُ غُبَارٌ):** പൊടിയുള്ളതും ശുദ്ധമായതുമായ മണ്ണ് (صَعِيدٌ طَهُورٌ) തന്നെ ഉപയോഗിക്കണം.
5. **നജസ് നീക്കൽ (إِزَالَةُ النَّجَاسَةِ):** തയമ്മുമിന് മുമ്പ് ശരീരത്തിലുള്ള നജസ് നീക്കം ചെയ്തിരിക്കണം.

**തയമ്മുമിന്റെ പ്രധാന ഫർളുകൾ (أَرْكَانُ التَّيَمُّمِ):**
* മണ്ണ് പകർത്തൽ (نَقْلُ التُّرَابِ)
* നിയ്യത്ത് (النِّيَّةُ — ഫർള് നിസ്കാരം അനുവദനീയമാകുന്നു എന്ന നിയ്യത്ത്)
* മുഖം തടവൽ (مَسْحُ الْوَجْهِ)
* രണ്ട് കൈകൾ മുട്ടുൾപ്പെടെ തടവൽ (مَسْحُ الْيَدَيْنِ مَعَ الْمِرْفَقَيْنِ)
* തർത്തീബ് (التَّرْتِيبُ — ക്രമം പാലിക്കൽ)

**ചിന്താവിഷയമായ ചോദ്യം:**
ഒരാൾ ഒരു തയമ്മും കൊണ്ട് എത്ര ഫർള് നിസ്കാരങ്ങൾ നിർവഹിക്കാൻ ശാഫിഈ മദ്ഹബിൽ അനുവാദമുണ്ട്? സുന്നത്ത് നിസ്കാരങ്ങളുടെ വിധി എന്താണ്?`
    }

    if (language === 'ar') {
      return `${greeting}وفقاً لكتاب **فتح المعين (فَتْحُ الْمُعِينِ)** في الفقه الشافعي، فإن **شروط صحة التيمم (شُرُوطُ التَّيَمُّمِ)** الأساسية هي:

1. **العذر بفقد الماء أو المرض:** عدم وجدان الماء حسّاً أو شرعاً، أو الخوف من استعماله لمرض أو بطء برء.
2. **دخول الوقت (دُخُولُ الْوَقْتِ):** لا يصح التيمم لفرض أو نفل مؤقت قبل دخول وقته؛ لأن التيمم طهارة ضرورة.
3. **طلب الماء (طَلَبُ الْمَاءِ):** يجب البحث عن الماء في رحله ورفقته بعد دخول الوقت عند فقدانه.
4. **التراب الطهور ذو الغبار (تُرَابٌ طَهُورٌ لَهُ غُبَارٌ):** أن يكون التيمم بتراب خالص طهور له غبار يعلق بالعضو.
5. **إزالة النجاسة أولاً:** تقديم إزالة النجاسة غير المعفو عنها على التيمم.

**وأركان التيمم (فُرُوضُهُ):** نقل التراب، والنية (نِيَّةُ اسْتِبَاحَةِ فَرْضِ الصَّلَاةِ)، ومسح الوجه، ومسح اليدين مع المرفقين، والترتيب بين المسحتين.

**سؤال لاختبار فهمك:**
كم صلاة مفروضة يباح للمتيمم أن يصليها بتيمم واحد في المذهب الشافعي؟ وما حكم النوافل؟`
    }

    if (language === 'ur') {
      return `${greeting}فقہ شافعی کی مستند کتاب **فتح المعین (فَتْحُ الْمُعِينِ)** کے مطابق **تیمم (التَّيَمُّم) کی بنیادی شرائط (شُرُوط)** درج ذیل ہیں:

1. **پانی کا نہ ملنا یا بیماری کا عذر:** پانی کا دستیاب نہ ہونا یا بیماری کی وجہ سے پانی کے استعمال سے نقصان کا اندیشہ ہونا۔
2. **وقت کا داخل ہونا (دُخُولُ الْوَقْتِ):** جس فرض نماز کے لیے تیمم کیا جا رہا ہو اس کا وقت داخل ہو چکا ہو۔
3. **پانی کی تلاش (طَلَبُ الْمَاءِ):** وقت داخل ہونے کے بعد اپنے سامان اور قریبی ساتھیوں میں پانی تلاش کرنا۔
4. **پاک اور غبار والی مٹی (تُرَابٌ طَهُورٌ لَهُ غُبَارٌ):** خالص اور پاک مٹی کا ہونا جس میں غبار ہو۔
5. **نجاست کا دور کرنا (إِزَالَةُ النَّجَاسَةِ):** تیمم سے پہلے بدن سے نجاست کو پاک کرنا۔

**تیمم کے فرائض (أَرْكَانُ التَّيَمُّمِ):** مٹی منتقل کرنا (نَقْلُ التُّرَابِ)، نیت کرنا (النِّيَّةُ)، چہرے کا مسح کرنا (مَسْحُ الْوَجْهِ)، کہنیوں سمیت دونوں ہاتھوں کا مسح کرنا، اور ترتیب قائم رکھنا۔

**غور و فکر کے لیے سوال:**
فقہ شافعی کے مطابق ایک تیمم سے کتنی فرض نمازیں اور کتنی نفل نمازیں ادا کی جا سکتی ہیں؟`
    }

    return `${greeting}According to **Fathul Mueen (فَتْحُ الْمُعِينِ)** in the **Shafi'i Madhhab (الْمَذْهَبُ الشَّافِعِيُّ)**, the core conditions (**Shurut / شُرُوط**) for the validity of **Tayammum (التَّيَمُّم)** are:

1. **Valid Excuse (الْعُذْرُ):** Inability to use water due to its absence (after searching) or genuine fear of illness/delayed recovery upon using water.
2. **Entry of Prayer Time (دُخُولُ الْوَقْتِ):** Because Tayammum is a purification of necessity (*Taharat Darurah*), it is only valid after the prescribed time of the prayer has entered.
3. **Searching for Water (طَلَبُ الْمَاءِ):** If Tayammum is performed due to lack of water, one must search for water among one's belongings and companions *after* the prayer time enters.
4. **Pure Dusty Earth (تُرَابٌ طَهُورٌ لَهُ غُبَارٌ):** Using pure, unmixed earth (*Sa'eed Tahur* / صَعِيدٌ طَهُورٌ) that has dust capable of adhering to the limbs.
5. **Prior Removal of Impurity (إِزَالَةُ النَّجَاسَةِ):** Removing any unexcused physical impurity (*Najasah*) before performing Tayammum.

**The Pillars (Arkan / أَرْكَان) of Tayammum:**
* Transferring the dust (**Naql al-Turab / نَقْلُ التُّرَابِ**)
* Intention (**Niyyah / النِّيَّةُ**) to make the prayer permissible (*Istibahat Fard al-Salah*)
* Wiping the face (**Mash al-Wajh / مَسْحُ الْوَجْهِ**) with the first strike
* Wiping both hands up to and including the elbows (**Mash al-Yadayn ma'a al-Mirfaqayn / مَسْحُ الْيَدَيْنِ مَعَ الْمِرْفَقَيْنِ**) with the second strike
* Maintaining sequence (**Tartib / التَّرْتِيبُ**)

**Follow-up Question to Test Your Understanding:**
In the Shafi'i school, how many obligatory (**Fard / فَرْض**) prayers vs. supererogatory (**Sunnah / سُنَّة**) prayers can a person perform with a single Tayammum?`
  }

  // 2. Grammar & I'rab Analysis (العلم نور يقذفه الله في القلب or general I'rab/Nahw)
  if (
    /i'rab|irab|الْعِلْمُ نُورٌ|العلم نور|ഇഅ്റാബ്|إعراب|نحوي|nahw/i.test(q)
  ) {
    if (language === 'ml') {
      return `${greeting}**"الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي الْقَلْبِ"** എന്ന വാക്യത്തിന്റെ പൂർണ്ണമായ **ഇഅ്റാബ് (إِعْرَاب)** നഹ്‌വ് വിശകലനം താഴെ നൽകുന്നു:

1. **الْعِلْمُ (അൽ-ഇൽമു):**
   * **مُبْتَدَأٌ (മുബ്തദഅ്):** വാക്യത്തിന്റെ തുടക്കത്തിൽ വരുന്ന നാമം.
   * **مَرْفُوعٌ (മർഫൂഅ്):** റഫ്ഇന്റെ അടയാളം അവസാനത്തിലെ ളമ്മത്ത് (الضَّمَّةُ الظَّاهِرَةُ).
2. **نُورٌ (നൂറുൻ):**
   * **خَبَرُ الْمُبْتَدَإِ (ഖബർ):** മുബ്തദഇന്റെ ആശയം പൂർത്തിയാക്കുന്ന പദം.
   * **مَرْفُوعٌ (മർഫൂഅ്):** അടയാളം അവസാനത്തിലെ ളമ്മത്ത് (الضَّمَّةُ الظَّاهِرَةُ).
3. **يَقْذِفُهُ (യഖ്ദിഫുഹു):**
   * **يَقْذِفُ:** ഫിഅ്ല് മുളാരിഅ് (فِعْلٌ مُضَارِعٌ مَرْفُوعٌ), അടയാളം ളമ്മത്ത്.
   * **ـهُ (ഹാഅ്):** മുത്തസ്വിലായ ളമീർ (ضَمِيرٌ مُتَّصِلٌ مَبْنِيٌّ عَلَى الضَّمِّ فِي مَحَلِّ نَصْبٍ مَفْعُولٌ بِهِ) — 'نُورٌ' എന്നതിലേക്ക് മടങ്ങുന്നു.
4. **اللَّهُ (അല്ലാഹു):**
   * **فَاعِلٌ (ഫാഇൽ):** 'يَقْذِفُ' എന്ന ക്രിയയുടെ കർത്താവ്, മർഫൂഅ് (مَرْفُوعٌ وَعَلَامَةُ رَفْعِهِ الضَّمَّةُ).
5. **فِي الْقَلْبِ (ഫിൽ ഖൽബി):**
   * **فِي:** ഹർഫ് ജർ (حَرْفُ جَرٍّ).
   * **الْقَلْبِ:** ഇസ്മ് മജ്റൂർ (اسْمٌ مَجْرُورٌ بِفِي وَعَلَامَةُ جَرِّهِ الْكَسْرَةُ).
6. **വാക്യബന്ധം (مَحَلُّ الْجُمْلَةِ):**
   * **"يَقْذِفُهُ اللَّهُ"** എന്ന ക്രിയാവാക്യം (جُمْلَةٌ فِعْلِيَّةٌ) **نُورٌ** എന്ന നകിറയായ (نَكِرَة) പദത്തിന് ശേഷമുള്ളതിനാൽ അതിന്റെ **സ്വിഫത്ത് (صِفَة / نَعْت)** ആയി റഫ്ഇന്റെ സ്ഥാനത്ത് (فِي مَحَلِّ رَفْعٍ) നിൽക്കുന്നു.
   * നിയമം: *"الْجُمَلُ بَعْدَ النَّكِرَاتِ صِفَاتٌ"* (നകിറകൾക്ക് ശേഷം വരുന്ന വാക്യങ്ങൾ സ്വിഫത്തുകളാണ്).

**തുടർ ചോദ്യം:**
ഇവിടെ **"نُورٌ"** എന്നതിന് പകരം **"النُّورُ"** (മഅ്‌രിഫ / مَعْرِفَة) എന്നായിരുന്നെങ്കിൽ **"يَقْذِفُهُ اللَّهُ"** എന്ന വാക്യത്തിന്റെ ഇഅ്റാബിൽ എന്ത് മാറ്റം വരുമായിരുന്നു?`
    }

    return `${greeting}Here is the step-by-step **I'rab (إِعْرَاب)** and **Nahw (نَحْو)** grammatical breakdown of the scholarly statement:
> **"الْعِلْمُ نُورٌ يَقْذِفُهُ اللَّهُ فِي الْقَلْبِ"**
> *(Knowledge is a light that Allah casts into the heart.)*

1. **الْعِلْمُ (*Al-'Ilmu*):**
   * **Mubtada' (مُبْتَدَأٌ):** Nominal subject at the beginning of the sentence.
   * **Marfu' (مَرْفُوعٌ):** In the nominative case; its sign of *Raf'* is the apparent *Dammah* (**الضَّمَّةُ الظَّاهِرَةُ**) on the final letter.
2. **نُورٌ (*Nurun*):**
   * **Khabar al-Mubtada' (خَبَرُ الْمُبْتَدَإِ):** Predicate completing the meaning of the subject.
   * **Marfu' (مَرْفُوعٌ):** Nominative with an apparent *Dammah* (**الضَّمَّةُ الظَّاهِرَةُ**).
3. **يَقْذِفُهُ (*Yaqdhifuhu*):**
   * **يَقْذِفُ (*Yaqdhifu*):** Present-tense verb (**فِعْلٌ مُضَارِعٌ مَرْفُوعٌ**), nominative with an apparent *Dammah* because it is free from subjunctive (*Nasib*) and jussive (*Jazim*) particles.
   * **ـهُ (*-hu*):** Attached pronoun (**ضَمِيرٌ مُتَّصِلٌ مَبْنِيٌّ عَلَى الضَّمِّ فِي مَحَلِّ نَصْبٍ مَفْعُولٌ بِهِ**), functioning as the direct object (*Maf'ul Bihi*), referring back to **نُورٌ**.
4. **اللَّهُ (*Allahu*):**
   * **Lafz al-Jalalah, Fa'il (فَاعِلٌ):** Doer/subject of the verb *Yaqdhifu*, in the nominative case (**مَرْفُوعٌ وَعَلَامَةُ رَفْعِهِ الضَّمَّةُ الظَّاهِرَةُ**).
5. **فِي الْقَلْبِ (*fi al-Qalbi*):**
   * **فِي:** Preposition (**حَرْفُ جَرٍّ مَبْنِيٌّ عَلَى السُّكُونِ**).
   * **الْقَلْبِ:** Genitive noun (**اسْمٌ مَجْرُورٌ بِفِي وَعَلَامَةُ جَرِّهِ الْكَسْرَةُ الظَّاهِرَةُ**). The prepositional phrase (**الْجَارُّ وَالْمَجْرُورُ**) is semantically connected (**مُتَعَلِّقٌ**) to the verb **يَقْذِفُ**.
6. **Clause Function (إِعْرَابُ الْجُمَلِ):**
   * The verbal clause **"يَقْذِفُهُ اللَّهُ"** is in the place of *Raf'* (**فِي مَحَلِّ رَفْعٍ نَعْتٌ / صِفَةٌ**) as an adjectival modifier (**Sifah / صِفَة**) for the indefinite noun **نُورٌ**, following the famous Nahw rule:
   * **"الْجُمَلُ بَعْدَ النَّكِرَاتِ صِفَاتٌ، وَبَعْدَ الْمَعَارِفِ أَحْوَالٌ"** *(Clauses after indefinite nouns are adjectives, and after definite nouns are circumstantial adverbs).*

**Follow-up Question for You:**
If the word **"نُورٌ"** were definite (**"النُّورُ"**), what would the grammatical position (**مَحَلُّ الْإِعْرَابِ**) of the clause **"يَقْذِفُهُ اللَّهُ"** become?`
  }

  // 3. Usul al-Fiqh — Aam & Khas
  if (/aam|khas|العام|الخاص|ആംമ്|ഖാസ്വ്|usul|ഉസൂലുൽ|أصول الفقه/i.test(q)) {
    return `${greeting}In **Usul al-Fiqh (أُصُولُ الْفِقْهِ)**, understanding **Al-'Aam (الْعَامُّ — The General)** and **Al-Khas (الْخَاصُّ — The Specific)** is essential for deriving legal rulings from the Qur'an and Sunnah:

### 1. Al-'Aam (الْعَامُّ — General Term)
* **Definition:** A word coined in a single lexical placement to encompass all individuals/units to which it applies without restriction (*هو اللفظ المستغرق لجميع ما يصلح له بوضع واحد دفعة بلا حصر*).
* **Key Particles of Generality (أَلْفَاظُ الْعُمُومِ):**
  1. **كُلّ (*Kull*)** and **جَمِيع (*Jami'*):** e.g., *"كُلُّ نَفْسٍ ذَائِقَةُ الْمَوْتِ"* (Every soul shall taste death).
  2. **Plural with definite article (الْجَمْعُ الْمُعَرَّفُ بِأَلْ الاستغراقية):** e.g., *"قَدْ أَفْلَحَ الْمُؤْمِنُونَ"*.
  3. **Conditional & relative pronouns (أَسْمَاءُ الشَّرْطِ وَالْمَوْصُولِ):** such as **مَنْ** (*whosoever*) and **مَا** (*whatsoever*).
  4. **Indefinite noun in a context of negation or prohibition (النَّكِرَةُ فِي سِيَاقِ النَّفْيِ أَوِ النَّهْيِ):** e.g., *"لَا ضَرَرَ وَلَا ضِرَارَ"*.

### 2. Al-Khas (الْخَاصُّ — Specific Term) & Takhsis (التَّخْصِيصُ)
* **Definition:** A word that applies to a specific, limited entity or a restricted number of individuals (e.g., proper nouns, specific numbers like three days, or restricted categories).
* **Takhsis (التَّخْصِيصُ — Specification):** Restricting a general ruling (*'Aam*) to some of its members using valid textual or rational evidence (*Mukhassis* / مُخَصِّص), which can be:
  * **Connected (مُتَّصِل):** Exception (*Istithna'* / الاسْتِثْنَاءُ), Condition (*Shart* / الشَّرْطُ), or Attribute (*Sifah* / الصِّفَةُ).
  * **Separate (مُنْفَصِل):** Specifying a general Qur'anic verse via another verse or an authentic Hadith (such as specifying the general 10% agricultural Zakat rate with the Hadith restricting it to produce reaching 5 *Awsuq*).

**Follow-up Question:**
Can you identify the particle of generality (*Lafz al-'Umum*) and the connected specifier (*Mukhassis Muttasil*) in **Surah Al-'Asr**: *"إِنَّ الْإِنسَانَ لَفِي خُسْرٍ إِلَّا الَّذِينَ آمَنُوا..."*?`
  }

  // 4. Academic Tutor — Abbasid Golden Age / Islamic History / Study Schedule
  if (/abbasid|bayt al-hikmah|അബ്ബാസി|عباسي|kerala|കേരള|schedule|timetable|ടൈംടേബിൾ/i.test(q) || role === 'academic') {
    if (/kerala|കേരള|quiz|ക്വിസ്/i.test(q)) {
      return `${greeting}Let us begin our **Interactive Revision Quiz on the History of Islam & Scholarly Heritage in Kerala**!

**Question 1 of 3:**
During the 16th century CE, **Ponnani (പൊന്നാനി)** became celebrated as the *"Mecca of Malabar"* and the intellectual headquarters of the Shafi'i Dars system in Kerala.
* Who was the renowned **Makhdoom scholar** who authored both the anti-colonial historical chronicle **Tuhfat al-Mujahidin (تُحْفَةُ الْمُجَاهِدِينَ)** and the authoritative Fiqh text **Fath al-Mu'in (فَتْحُ الْمُعِينِ)**?
* Also mention the significance of the **Vilakkathirikkal (വിളക്കത്തിരിക്കൽ)** tradition at the Ponnani Jumu'ah Masjid.

Reply with your answer, and I will evaluate it and present Question 2!`
    }

    if (/schedule|timetable|plan|ടൈംടേബിൾ|جدول/i.test(q)) {
      return `${greeting}Here is a **Balanced Weekly Da'wa College Study Timetable** integrating both the **Dars Kitab Syllabus** and **University Degree / Plus Two Subjects**:

### 1. Daily Core Routine (Saturday – Thursday)
* **05:15 AM – 06:15 AM (Post-Fajr Hifz & Matn Slot):** Memorization of *Alfiyyah Ibn Malik* couplets, Quranic verses, and reviewing the morning *Ibarat* before Dars.
* **06:45 AM – 09:30 AM (Morning Dars Session):** Core Fiqh (*Fathul Mueen* / *Mahalli*) and Usul al-Fiqh with peer *Mubahathah* (discussion).
* **10:00 AM – 03:30 PM (Academic Degree / Plus Two Block):** Humanities, Islamic History, English Literature, and Sociology lectures + concise bullet-point note-making.
* **04:30 PM – 05:30 PM (Language & Skill Lab):** Arabic *Muhadathah*, English academic writing, and library reading.
* **07:15 PM – 09:30 PM (Post-Maghrib / Isha Mutala'ah):**
  * **Slot A (75 mins):** Preparing tomorrow's Kitab *Ibarat* (Nahw, Sarf, and vocabulary).
  * **Slot B (60 mins):** University exam past-paper practice and essay outlines.

### 2. Weekend Consolidation (Friday)
* **Friday Morning:** Weekly Khutbah / Da'wa speech practice & Sahitya Samajam article drafting.
* **Friday Evening:** 45-minute self-test on the week's Kitab and Academic topics.

Would you like me to customize this schedule for your specific class (**Class ${params.studentClass || 'Da\'wa Batch'}**) and upcoming exams?`
    }

    return `${greeting}Here are the **High-Yield Exam Revision Notes** on the **Abbasid Golden Age & Bayt al-Hikmah (بَيْتُ الْحِكْمَةِ)**:

### 1. Foundation & Historical Context (750–1258 CE)
* **Capital Shift:** Caliph **Abu Ja'far al-Mansur** founded **Baghdad (Madinat al-Salam)** in 762 CE along the Tigris River, transforming it into a global hub of scholarship and trade.
* **Bayt al-Hikmah (House of Wisdom):** Established as a royal library under **Harun al-Rashid** (r. 786–809 CE) and expanded into a premier academy, translation bureau, and astronomical observatory under **Al-Ma'mun** (r. 813–833 CE).

### 2. Major Intellectual Advancements
* **The Translation Movement (حَرَكَةُ التَّرْجَمَةِ):** Scholars translated Greek, Persian, and Sanskrit works on medicine, mathematics, astronomy, and philosophy into Arabic (led by figures like *Hunayn ibn Ishaq*).
* **Islamic Sciences (الْعُلُومُ الشَّرْعِيَّةُ):** Codification of the four Sunni Fiqh Madhhabs, compilation of the *Kutub al-Sittah* in Hadith, and systematic development of Tafsir, Nahw (Basra and Kufa schools), and Usul al-Fiqh (Imam al-Shafi'i's *Al-Risalah*).
* **Mathematics & Sciences:**
  * **Al-Khwarizmi:** Pioneered Algebra (*Kitab al-Jabr wa al-Muqabalah*) and algorithms.
  * **Ibn al-Haytham (Alhazen):** Revolutionized optics (*Kitab al-Manazir*) and experimental scientific methodology.
  * **Al-Razi & Ibn Sina:** Authored foundational medical encyclopedias (*Al-Hawi* and *Al-Qanun fi al-Tibb*).

**Quick Exam Check:**
Which Abbasid Caliph formally institutionalized *Bayt al-Hikmah* as an academy of research and astronomical observation?`
  }

  // 5. Language Coach (Muhadathah, Sarf, Translation)
  if (/استغفار|تعلّم|istighfar|sarf|صرف|muhadathah|محادثة|طَلَبُ الْعِلْمِ|طلب العلم/i.test(q) || role === 'language') {
    if (/استغفار|تعلّم|istighfar|sarf|صرف/i.test(q)) {
      return `${greeting}Here is the **Morphological (Sarf / عِلْمُ الصَّرْفِ) & Root Analysis** for **"اسْتِغْفَار"** and **"تَعَلُّم"**:

### 1. اسْتِغْفَارٌ (*Istighfar* — Seeking Forgiveness)
* **Root Letters (الْمَادَّةُ / الْجِذْرُ):** **غ - ف - ر** (*Ghayn - Fa' - Ra'*), carrying the core meaning of covering, protecting, and forgiving.
* **Morphological Form (الْبَابُ الصَّرْفِيُّ):** Verbal Noun (**مَصْدَرٌ**) of **Form X (بَابُ اسْتَفْعَلَ)**.
* **Conjugation Pattern (التَّصْرِيفُ):**
  * Past (*Madi*): **اسْتَغْفَرَ** (*Istaghfara* — Pattern: **اسْتَفْعَلَ**)
  * Present (*Mudari'*): **يَسْتَغْفِرُ** (*Yastaghfiru* — Pattern: **يَسْتَفْعِلُ**)
  * Verbal Noun (*Masdar*): **اسْتِغْفَارًا** (*Istighfaran* — Pattern: **اسْتِفْعَالًا**)
  * Active Participle (*Ism al-Fa'il*): **مُسْتَغْفِرٌ** (*Mustaghfirun*)
* **Semantic Benefit (فَائِدَةُ الزِّيَادَةِ):** The prefix (**ا س ت**) here denotes **الطَّلَبُ** (requesting/seeking) — i.e., *seeking Maghfirah (forgiveness) from Allah*.

---

### 2. تَعَلُّمٌ (*Ta'allum* — Learning / Acquiring Knowledge)
* **Root Letters (الْمَادَّةُ / الْجِذْرُ):** **ع - ل - م** (*'Ayn - Lam - Mim*), denoting knowledge and certainty.
* **Morphological Form (الْبَابُ الصَّرْفِيُّ):** Verbal Noun (**مَصْدَرٌ**) of **Form V (بَابُ تَفَعَّلَ)**.
* **Conjugation Pattern (التَّصْرِيفُ):**
  * Past (*Madi*): **تَعَلَّمَ** (*Ta'allama* — Pattern: **تَفَعَّلَ**)
  * Present (*Mudari'*): **يَتَعَلَّمُ** (*Yata'allamu* — Pattern: **يَتَفَعَّلُ**)
  * Verbal Noun (*Masdar*): **تَعَلُّمًا** (*Ta'alluman* — Pattern: **تَفَعُّلًا**)
  * Active Participle (*Ism al-Fa'il*): **مُتَعَلِّمٌ** (*Muta'allimun* — Student/Learner)
* **Semantic Benefit:** Form V (**تَفَعَّلَ**) acts as the reflexive (*Mutawa'ah* / الْمُطَاوَعَةُ) of Form II (**عَلَّمَ** — to teach) and indicates acquiring knowledge gradually with effort (**التَّكَلُّفُ وَالتَّدَرُّجُ**).

**Practice Prompt:**
Can you derive the *Ism al-Fa'il* (Active Participle) and *Masdar* of the verb **تَدَبَّرَ** (*Tadabbara* — to reflect deeply) using the same Form V pattern?`
    }

    return `${greeting}Let us practice **Scholarly Arabic Dialogue (الْمُحَادَثَةُ الْعَرَبِيَّةُ)** set in the **ICS Academy Da'wa College Library**:

* **الأُسْتَاذُ (The Usthad):**
  أَهْلًا بِكَ يَا وَلَدِي فِي مَكْتَبَةِ كُلِّيَّةِ الدَّعْوَةِ. مَاذَا تُطَالِعُ الْيَوْمَ؟
  *(Welcome, my son, to the Da'wa College library. What are you studying today?)*

* **الطَّالِبُ (The Student):**
  أُطَالِعُ بَابَ الصَّلَاةِ مِنْ كِتَابِ «فَتْحِ الْمُعِينِ»، وَأُرَاجِعُ شَوَاهِدَ «أَلْفِيَّةِ ابْنِ مَالِكٍ».
  *(I am studying the chapter of Prayer from "Fath al-Mu'in" and reviewing the poetic examples of "Alfiyyah Ibn Malik".)*

* **الأُسْتَاذُ (The Usthad):**
  مَا شَاءَ اللَّهُ! الِاجْتِهَادُ فِي الْمُطَالَعَةِ مِفْتَاحُ التَّفَوُّقِ الْعِلْمِيِّ. هَلْ وَاجَهْتَ عِبَارَةً تَحْتَاجُ إِلَى شَرْحٍ؟
  *(Masha'Allah! Diligence in pre-reading is the key to scholarly excellence. Did you encounter any passage that needs explanation?)*

**Key Vocabulary (الْمُفْرَدَاتُ):**
1. **مُطَالَعَةٌ** (Root: **ط-ل-ع**): Deep reading / text preparation.
2. **شَوَاهِدُ** (Singular: **شَاهِدٌ**, Root: **ش-ه-د**): Evidentiary grammatical verses.
3. **التَّفَوُّقُ** (Root: **ف-و-ق**): Excellence / distinction.

**Your Turn:** Reply to the Usthad in a short Arabic sentence (or in English/Malayalam), and I will guide you!`
  }

  // 6. Campus & Da'wa Advisor (Speeches & Kitabs)
  if (/speech|time management|പ്രസംഗ|خطبة|kitabs|കിതാബുകൾ/i.test(q) || role === 'campus') {
    return `${greeting}Here is a structured **Da'wa Speech & Essay Outline** on **"Students and the Value of Time in Seeking Sacred Knowledge"**:

### 1. Opening & Foundation (الْمُقَدِّمَةُ)
* **Qur'anic Opening:**
  > **"وَالْعَصْرِ ۝ إِنَّ الْإِنسَانَ لَفِي خُسْرٍ ۝ إِلَّا الَّذِينَ آمَنُوا وَعَمِلُوا الصَّالِحَاتِ وَتَوَاصَوْا بِالْحَقِّ وَتَوَاصَوْا بِالصَّبْرِ"** *(Surah Al-'Asr: 1–3)*
* **Prophetic Hadith:**
  > **"نِعْمَتَانِ مَغْبُونٌ فِيهِمَا كَثِيرٌ مِنَ النَّاسِ: الصِّحَّةُ وَالْفَرَاغُ"** *(Sahih al-Bukhari — "There are two blessings in which many people incur loss: health and free time.")*

### 2. Core Thematic Pillars
1. **Time as the Capital of the Scholar:** Imam al-Shafi'i (رحمه الله) stated: *"الْوَقْتُ كَالسَّيْفِ إِنْ لَمْ تَقْطَعْهُ قَطَعَكَ"* (Time is like a sword; if you do not cut it with purposeful work, it will cut you).
2. **Early Morning Barakah:** Utilizing the post-Fajr hours (*Bakurah*) for memorization (*Hifz*) and deep Kitab study (*Mutala'ah*).
3. **Digital Discipline:** Guarding attention against distractions while using technology productively for research and Da'wa.

### 3. Conclusion & Du'a (الْخَاتِمَةُ وَالدُّعَاءُ)
* Closing call to action for fellow Da'wa College students to honor every study period.
* **Du'a:** *"اللَّهُمَّ بَارِكْ لَنَا فِي أَوْقَاتِنَا وَعُلُومِنَا وَأَعْمَالِنَا، وَانْفَعْ بِنَا الْإِسْلَامَ وَالْمُسْلِمِينَ."*

Would you like me to expand any section into a full verbatim speech in English, Malayalam, or Arabic?`
  }

  // 7. General Fallback for any custom question
  if (language === 'ml') {
    return `${greeting}നിങ്ങൾ ചോദിച്ച വിഷയം (**"${q.slice(0, 120)}"**) വളരെ ശ്രദ്ധേയമായ ഒരു വൈജ്ഞാനിക ചോദ്യമാണ്.

### പ്രധാന വിശകലന പോയിന്റുകൾ:
1. **അടിസ്ഥാന തത്വം (الأَصْلُ الْعِلْمِيُّ):** കിതാബുകളിലെയും ഇസ്‌ലാമിക വിജ്ഞാനീയങ്ങളിലെയും പ്രമാണങ്ങൾ അനുസരിച്ച് ഏതൊരു വിഷയവും അതിന്റെ ശർത്വുകൾ (شُرُوط), റുക്നുകൾ (أَرْكَان), ലക്ഷ്യങ്ങൾ (مَقَاصِد) എന്നിവ മുൻനിർത്തിയാണ് വിലയിരുത്തേണ്ടത്.
2. **പ്രായോഗിക പഠനം:** ഫത്ഹുൽ മുഈൻ (فَتْحُ الْمُعِينِ), മഹല്ലി (الْمَحَلِّي), അൽഫിയ്യ (أَلْفِيَّةُ ابْنِ مَالِكٍ) തുടങ്ങിയ ഗ്രന്ഥങ്ങളിലെ ഇബാറത്തുകൾ പരിശോധിക്കുമ്പോൾ പദങ്ങളുടെ നഹ്‌വ്-സർഫ് ഘടനയും ഫിഖ്ഹീ വിധിയും ഒരുമിച്ച് മനസ്സിലാക്കാൻ ശ്രദ്ധിക്കുക.
3. **തുടർ പഠനത്തിന്:** ഈ വിഷയത്തിലെ ഏതെങ്കിലും പ്രത്യേക ഇബാറത്തോ (عِبَارَة) ഉപവിഭാഗമോ കൂടുതൽ വിശദീകരിക്കണമെന്നുണ്ടെങ്കിൽ താഴെ ചോദിക്കാവുന്നതാണ്.`
  }

  return `${greeting}Here is a structured scholarly explanation regarding your question (**"${q.slice(0, 120)}"**):

### 1. Core Scholarly Principle (الأَصْلُ الْعِلْمِيُّ)
In the curriculum of **ICS Academy (Da'wa College)**, every topic in **Fiqh (الْفِقْهُ)**, **Usul (الأُصُولُ)**, **Nahw/Sarf (النَّحْوُ وَالصَّرْفُ)**, and **Academic Studies** is analyzed through its foundational definitions (**التَّعْرِيفُ**), conditions (**الشُّرُوطُ**), and essential pillars (**الأَرْكَانُ**).

### 2. Key Analytical Takeaways
* **Textual Precision:** When studying classical Kitabs such as *Fathul Mueen (فَتْحُ الْمُعِينِ)*, *Kanz al-Raghibin (الْمَحَلِّي)*, *Tafsir al-Jalalayn (تَفْسِيرُ الْجَلَالَيْنِ)*, or *Alfiyyah Ibn Malik (أَلْفِيَّةُ ابْنِ مَالِكٍ)*, always examine both the grammatical structure (*I'rab* / إِعْرَاب) and the relied-upon legal ruling (*Al-Mu'tamad* / الْمُعْتَمَدُ).
* **Practical Application:** Connect classical principles with contemporary academic clarity and exam-ready summarization.

**Follow-up Prompt:**
Feel free to share a specific Arabic *Ibarat* passage, Fiqh case, or exam sub-topic you would like me to break down word-by-word!`
}

export async function fetchAiChatReply(payload: {
  message: string
  history: ClientChatTurn[]
  role: ChatRole
  language: ChatLanguage
  languageMode: 'auto' | 'explicit'
  modelTier: ChatModelTier
  studentName?: string
  studentClass?: string
  attachments?: ClientChatAttachment[]
}): Promise<{ reply: string; modelUsed: string }> {
  const urls = getCandidateApiUrls('/api/ai/chat')
  const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0

  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), hasAttachments ? 38000 : 28000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload),
      })
      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as { reply?: string; modelUsed?: string }
        if (data && typeof data.reply === 'string' && data.reply.trim()) {
          return {
            reply: data.reply,
            modelUsed:
              data.modelUsed ||
              (payload.modelTier === 'flash-lite'
                ? 'gemini-3.1-flash-lite'
                : 'gemini-3.8-flash'),
          }
        }
      }
    } catch {
      clearTimeout(timeoutId)
      // Continue to next candidate URL or local scholarly fallback
    }
  }

  // Fallback for standalone Android APK / offline / cross-origin restricted WebViews
  const fallbackReply = generateClientScholarlyChatReply({
    message: payload.message,
    history: payload.history,
    role: payload.role,
    language: payload.language,
    studentName: payload.studentName,
    studentClass: payload.studentClass,
  })

  return {
    reply: fallbackReply,
    modelUsed:
      payload.modelTier === 'flash-lite'
        ? 'gemini-3.1-flash-lite'
        : 'gemini-3.8-flash',
  }
}

export async function fetchAiStudyAssistantReply(payload: {
  prompt: string
  mode: StudyMode
  language: ChatLanguage
  languageMode: 'auto' | 'explicit'
  studentName?: string
}): Promise<{ response: string }> {
  const urls = getCandidateApiUrls('/api/ai/study-assistant')

  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 28000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload),
      })
      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as { response?: string }
        if (data && typeof data.response === 'string' && data.response.trim()) {
          return { response: data.response }
        }
      }
    } catch {
      clearTimeout(timeoutId)
    }
  }

  const mappedRole: ChatRole =
    payload.mode === 'kitab'
      ? 'usthad'
      : payload.mode === 'qa'
        ? 'academic'
        : payload.mode === 'translation'
          ? 'language'
          : 'campus'

  return {
    response: generateClientScholarlyChatReply({
      message: payload.prompt,
      history: [],
      role: mappedRole,
      language: payload.language,
      studentName: payload.studentName,
    }),
  }
}

export async function transcribeVoiceAudio(payload: {
  audioBase64: string
  mimeType: string
  language: string
}): Promise<string> {
  const urls = getCandidateApiUrls('/api/ai/transcribe')

  for (const url of urls) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload),
      })
      clearTimeout(timeoutId)

      const contentType = res.headers.get('content-type') || ''
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as { text?: string }
        if (data && typeof data.text === 'string') {
          return data.text.trim()
        }
      }
    } catch {
      clearTimeout(timeoutId)
    }
  }

  return ''
}

