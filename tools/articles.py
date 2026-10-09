# Blog article sources. Edit here, then run:  python3 tools/build_blog.py
# Each article has an Arabic ("ar") and English ("en") version with the same slug.
# Body is plain HTML: <h2>, <p>, <ul>/<ol>, <blockquote class="tip">.

ARTICLES = [
{
  "slug": "website-cost",
  "date": "2026-10-09",
  "icon": "price",
  "ar": {
    "title": "تصميم موقع بيتكلف كام؟ إيه اللي بيحدد السعر فعلًا",
    "desc": "ليه سعر الموقع بيفرق من مكان للتاني؟ اعرف العوامل اللي بتحدد التكلفة، وإزاي تاخد أحسن قيمة لفلوسك من غير مفاجآت.",
    "body": """
<p>"الموقع بكام؟" سؤال بيجيلي كل يوم، والإجابة الصادقة: حسب الموقع. زي ما سعر العربية بيفرق حسب الموديل والإمكانيات، سعر الموقع بيفرق حسب اللي إنت محتاجه منه. في المقال ده هوضحلك العوامل اللي بتحدد السعر، عشان تعرف إنت بتدفع في إيه بالظبط.</p>

<h2>1. نوع الموقع</h2>
<p>صفحة تعريف بسيطة أو بيزنس كارد أونلاين حاجة، وموقع شركة فيه خدمات ومدونة حاجة تانية، ومتجر إلكتروني فيه منتجات وسلة ودفع حاجة تالتة خالص. كل ما الموقع يعمل حاجات أكتر، كل ما الشغل اللي وراه يزيد.</p>

<h2>2. عدد الصفحات والمحتوى</h2>
<p>صفحة واحدة غير عشر صفحات. وكمان مين هيكتب الكلام ويجهّز الصور؟ لو المحتوى جاهز عندك، ده بيوفر وقت وفلوس. ولو محتاجني أكتبه وأظبطه عشان يبيع ويظهر في جوجل، ده جزء من الشغل.</p>

<h2>3. التصميم: قالب جاهز ولا تصميم خاص؟</h2>
<p>القالب الجاهز أرخص وأسرع، بس شكله ممكن يكون شبه مواقع كتير. التصميم الخاص معمول على مقاس نشاطك وهويتك، وبيدي انطباع احترافي أقوى. الاختيار يعتمد على ميزانيتك وأهمية الصورة الاحترافية في مجالك.</p>

<h2>4. المميزات الإضافية</h2>
<p>فورم طلبات، حجز مواعيد، دفع أونلاين، لغتين عربي وإنجليزي، ربط بالواتساب، لوحة تحكم تعدّل منها بنفسك… كل ميزة من دول بتضيف قيمة، وبتضيف شغل.</p>

<h2>5. الدومين والاستضافة</h2>
<p>الدومين هو اسم موقعك (زي waledoweida.com)، والاستضافة هي المكان اللي الموقع شغال عليه. دول بيتجددوا كل سنة، فخلي بالك تسأل عليهم من الأول عشان ما تتفاجئش بعدين.</p>

<blockquote class="tip"><strong>نصيحة:</strong> اتأكد إن الدومين متسجل باسمك إنت، مش باسم الشخص اللي عمل الموقع. كده الموقع ملكك فعلًا مهما حصل.</blockquote>

<h2>6. المتابعة بعد التسليم</h2>
<p>الموقع مش حاجة بتتعمل مرة وخلاص. تحديثات، تعديل أسعار، إضافة خدمات، حل أي مشكلة. اسأل دايمًا: هل في متابعة بعد التسليم؟ ولمدة قد إيه؟</p>

<h2>إزاي تاخد أحسن قيمة لفلوسك؟</h2>
<ul>
  <li><strong>ابدأ باللي محتاجه فعلًا:</strong> موقع صغير شغال كويس أحسن من موقع كبير ناقص.</li>
  <li><strong>اطلب سعر واضح ومكتوب:</strong> فيه كل حاجة هتتعمل، عشان مفيش مفاجآت.</li>
  <li><strong>بص على شغل سابق:</strong> واسأل عن سرعة الموقع وشكله على الموبايل.</li>
</ul>

<h2>الخلاصة</h2>
<p>السعر الصح هو اللي بيجيبلك عملاء أكتر من اللي دفعته. لو عايز تعرف موقعك هيتكلف كام بالظبط، ابعتلي على واتساب وقولّي محتاج إيه، وهبعتلك خطة وسعر واضح قبل ما نبدأ.</p>
"""
  },
  "en": {
    "title": "How much does a website cost? What actually sets the price",
    "desc": "Why do website prices vary so much? Learn the factors that drive the cost and how to get the best value without surprises.",
    "body": """
<p>"How much is a website?" I get asked this every day, and the honest answer is: it depends on the website. Just as a car's price depends on the model and features, a website's price depends on what you need it to do. Here are the factors that set the price, so you know exactly what you're paying for.</p>

<h2>1. The type of website</h2>
<p>A simple profile page or online business card is one thing; a company site with services and a blog is another; an online store with products, cart and payments is something else entirely. The more a site does, the more work goes into it.</p>

<h2>2. Number of pages and content</h2>
<p>One page isn't ten. And who writes the copy and prepares the images? If your content is ready, that saves time and money. If you need it written and shaped to sell and rank on Google, that's part of the job.</p>

<h2>3. Design: template or custom?</h2>
<p>A template is cheaper and faster, but may look like many other sites. A custom design is built around your business and brand and makes a stronger professional impression. The choice depends on your budget and how much a premium image matters in your field.</p>

<h2>4. Extra features</h2>
<p>Order forms, appointment booking, online payment, Arabic and English, WhatsApp integration, a dashboard to edit content yourself… each adds value — and work.</p>

<h2>5. Domain and hosting</h2>
<p>The domain is your site's name (like waledoweida.com); hosting is where it runs. Both renew yearly, so ask about them upfront to avoid surprises later.</p>

<blockquote class="tip"><strong>Tip:</strong> Make sure the domain is registered in your name, not the developer's. That way the site is truly yours, whatever happens.</blockquote>

<h2>6. Support after launch</h2>
<p>A website isn't a one-off. Updates, price changes, new services, fixing issues. Always ask: is there support after delivery, and for how long?</p>

<h2>How to get the best value</h2>
<ul>
  <li><strong>Start with what you actually need:</strong> a small site that works well beats a big one that's half done.</li>
  <li><strong>Ask for a clear, written quote:</strong> listing everything that will be delivered.</li>
  <li><strong>Look at previous work:</strong> and check speed and how it looks on mobile.</li>
</ul>

<h2>The bottom line</h2>
<p>The right price is the one that brings in more customers than it costs. If you want to know exactly what your site would cost, message me on WhatsApp with what you need and I'll send a clear plan and price before we start.</p>
"""
  }
},
{
  "slug": "online-store-vs-whatsapp",
  "date": "2026-10-09",
  "icon": "store",
  "ar": {
    "title": "متجر إلكتروني ولا البيع على واتساب والسوشيال؟",
    "desc": "إمتى يكفيك البيع على واتساب وإنستجرام، وإمتى يبقى المتجر الإلكتروني خطوة لازمة؟ مقارنة عملية تساعدك تختار صح.",
    "body": """
<p>مشاريع كتير بتبدأ البيع على واتساب وإنستجرام، وده بداية ممتازة. بس مع الوقت بيبدأ السؤال: أعمل متجر إلكتروني ولا أكمّل كده؟ الإجابة مش واحدة لكل الناس، فخلّينا نقارن بهدوء.</p>

<h2>البيع على واتساب والسوشيال: مميزاته</h2>
<ul>
  <li><strong>بداية سريعة ومن غير تكلفة كبيرة:</strong> صفحة ورقم واتساب وتبدأ.</li>
  <li><strong>تواصل شخصي:</strong> العميل بيسأل وإنت بترد، وده بيبني ثقة.</li>
  <li><strong>مناسب لعدد منتجات قليل</strong> أو خدمات بتحتاج اتفاق على التفاصيل.</li>
</ul>

<h2>وعيوبه لما الشغل يكبر</h2>
<ul>
  <li><strong>وقتك كله بيروح في الرد:</strong> نفس الأسئلة كل يوم: السعر كام؟ المقاسات؟ الشحن؟</li>
  <li><strong>طلبات بتضيع:</strong> رسالة اتنست أو عميل ما اتردّش عليه بسرعة فراح لحد تاني.</li>
  <li><strong>صعب تعرف أرقامك:</strong> مبيعات الشهر كام؟ أكتر منتج بيتباع إيه؟</li>
  <li><strong>إنت مش ماسك المنصة:</strong> لو الحساب اتقفل، الشغل كله يقف.</li>
</ul>

<h2>المتجر الإلكتروني: إمتى يبقى لازم؟</h2>
<p>لو عندك منتجات كتير، أو طلبات يومية، أو بتعلن وعايز تعرف كل جنيه بيجيب كام، أو عايز العميل يطلب حتى وإنت نايم، يبقى المتجر هيوفر عليك وقت ويزود مبيعاتك. العميل يشوف المنتجات والأسعار والصور، ويختار، ويطلب في دقيقتين.</p>

<blockquote class="tip"><strong>نصيحة:</strong> مش لازم تختار واحد بس. أحسن حل غالبًا إن المتجر يكون فيه زرار واتساب، فالعميل اللي محتاج يسأل يكلمك، واللي عارف هو عايز إيه يطلب على طول.</blockquote>

<h2>إزاي تقرر؟</h2>
<p>اسأل نفسك تلات أسئلة:</p>
<ol>
  <li>هل بتقضي وقت كبير بترد على نفس الأسئلة؟</li>
  <li>هل عندك أكتر من 15–20 منتج؟</li>
  <li>هل بتصرف على إعلانات ومش عارف بالظبط بتجيب كام؟</li>
</ol>
<p>لو جاوبت بـ "أيوه" على اتنين منهم، غالبًا الوقت جه لمتجر إلكتروني.</p>

<h2>الخلاصة</h2>
<p>واتساب والسوشيال بداية ممتازة، والمتجر هو الخطوة اللي بتخلّي الشغل يكبر من غير ما وقتك ينتهي. لو محتار، ابعتلي تفاصيل مشروعك وأقولك الأنسب ليك بصراحة.</p>
"""
  },
  "en": {
    "title": "Online store or selling on WhatsApp and social media?",
    "desc": "When is selling on WhatsApp and Instagram enough, and when does an online store become necessary? A practical comparison to help you choose.",
    "body": """
<p>Many businesses start by selling on WhatsApp and Instagram, and that's a great start. But over time the question comes up: should I build an online store or keep going like this? The answer isn't the same for everyone, so let's compare calmly.</p>

<h2>Selling on WhatsApp and social: the upside</h2>
<ul>
  <li><strong>Fast, low-cost start:</strong> a page, a WhatsApp number, and you're selling.</li>
  <li><strong>Personal contact:</strong> customers ask, you answer, and trust builds.</li>
  <li><strong>Good for a few products</strong> or services that need details agreed one by one.</li>
</ul>

<h2>The downside as you grow</h2>
<ul>
  <li><strong>Your time goes on replies:</strong> the same questions every day — price? sizes? shipping?</li>
  <li><strong>Lost orders:</strong> a missed message or slow reply sends the customer elsewhere.</li>
  <li><strong>Hard to know your numbers:</strong> monthly sales? best-selling product?</li>
  <li><strong>You don't own the platform:</strong> if the account is closed, the business stops.</li>
</ul>

<h2>When does an online store become necessary?</h2>
<p>If you have many products, daily orders, run ads and want to know what each dollar brings back, or want customers to order while you sleep, a store saves time and lifts sales. Customers see products, prices and photos, choose, and order in two minutes.</p>

<blockquote class="tip"><strong>Tip:</strong> You don't have to choose just one. The best setup is often a store with a WhatsApp button: customers with questions message you, and those who know what they want order straight away.</blockquote>

<h2>How to decide</h2>
<p>Ask yourself three questions:</p>
<ol>
  <li>Do you spend a lot of time answering the same questions?</li>
  <li>Do you have more than 15–20 products?</li>
  <li>Do you spend on ads without knowing exactly what they bring back?</li>
</ol>
<p>If you answered "yes" to two of them, it's probably time for an online store.</p>

<h2>The bottom line</h2>
<p>WhatsApp and social media are a great start; a store is the step that lets the business grow without eating all your time. If you're unsure, send me your project details and I'll honestly tell you what suits you best.</p>
"""
  }
},
{
  "slug": "seo-basics",
  "date": "2026-10-09",
  "icon": "seo",
  "ar": {
    "title": "7 حاجات بسيطة تخلّي موقعك يظهر في جوجل",
    "desc": "خطوات SEO عملية تقدر تبدأ بيها النهارده عشان موقعك يطلع في نتايج جوجل ويجيبلك عملاء من غير إعلانات.",
    "body": """
<p>عندك موقع بس محدش بيلاقيه في جوجل؟ دي مشكلة منتشرة جدًا. الخبر الحلو إن في حاجات بسيطة تقدر تعملها تفرق كتير في ظهورك. ده اسمه SEO، أو تحسين الظهور في محركات البحث، ومش محتاج تكون خبير عشان تبدأ.</p>

<h2>1. اعرف الناس بتدوّر بإيه</h2>
<p>فكّر في الكلام اللي عميلك بيكتبه في جوجل فعلًا، مش اللي إنت بتسمي بيه خدمتك. مثلًا الناس بتكتب "تصليح تكييف في مدينة نصر" أكتر من "صيانة أنظمة تبريد". استخدم الكلمات دي في عناوين صفحاتك وكلامك.</p>

<h2>2. عنوان ووصف واضح لكل صفحة</h2>
<p>كل صفحة محتاجة عنوان بيظهر في نتايج جوجل، فيه الخدمة والمكان، ووصف قصير بيشجع الناس تدوس. ده أول حاجة العميل بيشوفها قبل ما يدخل موقعك.</p>

<h2>3. موقعك لازم يكون سريع</h2>
<p>أغلب الناس بتدخل من الموبايل، ولو الموقع بطيء هيقفلوه ويروحوا لغيرك، وجوجل بيلاحظ ده. صغّر حجم الصور، وابعد عن الإضافات اللي ملهاش لازمة.</p>

<h2>4. شكله مظبوط على الموبايل</h2>
<p>جوجل بيقيّم موقعك على أساس نسخة الموبايل. اتأكد إن الكلام مقروء، والأزرار سهلة الضغط، ومفيش حاجة طالعة برّه الشاشة.</p>

<h2>5. محتوى بيجاوب على أسئلة العملاء</h2>
<p>اكتب عن الأسئلة اللي بتتسألها كل يوم: الأسعار، المدة، الفرق بين الاختيارات. كل مقال مفيد هو باب جديد العميل ممكن يدخلك منه من جوجل.</p>

<blockquote class="tip"><strong>نصيحة:</strong> سجّل موقعك في Google Search Console (مجاني). هيقولك الناس بتلاقيك بكلمات إيه، وهل في مشاكل بتمنع ظهورك.</blockquote>

<h2>6. سجّل نشاطك على خرايط جوجل</h2>
<p>لو عندك محل أو بتخدم منطقة معينة، الملف التجاري على جوجل بيخليك تظهر في الخريطة لما حد قريب منك يدوّر. ده من أسرع الطرق للظهور المحلي.</p>

<h2>7. خليك ثابت</h2>
<p>الـ SEO مش زرار بيشتغل في يوم. محتوى جديد بانتظام، وتحديث المعلومات، وآراء عملاء حقيقية، كل ده بيبني ثقة جوجل في موقعك مع الوقت.</p>

<h2>الخلاصة</h2>
<p>الظهور في جوجل بيجيبلك عملاء بيدوّروا على خدمتك بالفعل، ومن غير ما تدفع على كل زيارة. لو عايز أراجع موقعك وأقولك إيه اللي ناقصه عشان يظهر، اطلب تقييم مجاني.</p>
"""
  },
  "en": {
    "title": "7 simple things that help your website show up on Google",
    "desc": "Practical SEO steps you can start today so your site ranks on Google and brings customers without ads.",
    "body": """
<p>You have a website but nobody finds it on Google? That's very common. The good news: a few simple things make a big difference. It's called SEO — search engine optimization — and you don't need to be an expert to start.</p>

<h2>1. Know what people search for</h2>
<p>Think about the words your customers actually type, not what you call your service. People search "AC repair in Nasr City" more than "cooling system maintenance." Use those words in your page titles and copy.</p>

<h2>2. A clear title and description for every page</h2>
<p>Each page needs a title that shows in Google results — with the service and location — and a short description that makes people click. It's the first thing a customer sees before visiting.</p>

<h2>3. Your site must be fast</h2>
<p>Most people browse on mobile, and if your site is slow they leave for a competitor — and Google notices. Compress images and avoid unnecessary plugins.</p>

<h2>4. It must work well on mobile</h2>
<p>Google evaluates your site based on its mobile version. Make sure text is readable, buttons are easy to tap, and nothing spills off the screen.</p>

<h2>5. Content that answers customers' questions</h2>
<p>Write about the questions you get every day: prices, timelines, the difference between options. Every useful article is a new door customers can find you through on Google.</p>

<blockquote class="tip"><strong>Tip:</strong> Add your site to Google Search Console (free). It tells you which words people find you with and whether anything is blocking your visibility.</blockquote>

<h2>6. List your business on Google Maps</h2>
<p>If you have a shop or serve a specific area, a Google Business Profile shows you on the map when someone nearby searches. It's one of the fastest routes to local visibility.</p>

<h2>7. Be consistent</h2>
<p>SEO isn't a switch you flip in a day. Regular new content, up-to-date information and genuine customer reviews build Google's trust in your site over time.</p>

<h2>The bottom line</h2>
<p>Showing up on Google brings customers who are already looking for your service — without paying for every visit. If you'd like me to review your site and tell you what's missing, ask for a free review.</p>
"""
  }
},
{
  "slug": "paid-ads-guide",
  "date": "2026-10-09",
  "icon": "ads",
  "ar": {
    "title": "دليلك لإعلان ممول ناجح على فيسبوك وإنستجرام",
    "desc": "7 خطوات عملية عشان إعلانك الممول يجيبلك عملاء حقيقيين مش مجرد لايكات، من تحديد الهدف لحد قراءة الأرقام الصح.",
    "body": """
<p>ناس كتير بتصرف فلوس على الإعلانات الممولة وفي الآخر تقول "الإعلانات مبتجيبش نتيجة". الحقيقة إن المشكلة غالبًا مش في المنصة ولا في الميزانية، المشكلة في طريقة عمل الإعلان نفسه. في المقال ده هنمشي خطوة بخطوة على الأساسيات اللي بتفرق بين إعلان بيضيّع فلوس وإعلان بيجيب عملاء.</p>

<h2>1. حدد هدف واحد واضح قبل أي حاجة</h2>
<p>قبل ما تفتح مدير الإعلانات، اسأل نفسك: أنا عايز إيه من الإعلان ده بالظبط؟ رسايل على واتساب؟ زيارات للموقع؟ مبيعات من المتجر؟ كل هدف ليه إعداد مختلف، والمنصة بتوصّل إعلانك للناس الأقرب إنهم يعملوا الحاجة اللي اخترتها. لو اخترت "تفاعل" وإنت عايز مبيعات، هتاخد لايكات كتير ومبيعات قليلة.</p>

<h2>2. اعرف جمهورك بدقة</h2>
<p>"كل الناس" مش جمهور. فكّر في عميلك الحقيقي: سنه كام؟ ساكن فين؟ مهتم بإيه؟ بيدوّر على إيه؟ مثلًا لو عندك خدمة في الكويت، استهدف المناطق اللي بتخدمها فعلًا بدل الدولة كلها. ولو منتجك للستات في مصر من 25 لـ 40 سنة، ابدأ من هنا ووسّع بعد ما تشوف النتايج.</p>

<h2>3. العرض والرسالة أهم من الميزانية</h2>
<p>إعلان بميزانية صغيرة ورسالة قوية بيكسب إعلان بميزانية كبيرة ورسالة ضعيفة. الرسالة القوية بتجاوب على سؤال واحد في دماغ العميل: "أنا هستفيد إيه؟". اكتب الفايدة مش المواصفات، وخلّي فيه سبب يخليه يتحرك دلوقتي، زي عرض لفترة محدودة أو استشارة مجانية.</p>

<h2>4. أول 3 ثواني هي كل حاجة</h2>
<p>الناس بتقلّب بسرعة. لو الصورة أو الفيديو مشدّش العين في أول لحظة، الإعلان اتنسى. ابدأ الفيديو بالنتيجة أو بالمشكلة اللي بتحلها، استخدم ألوان واضحة، واكتب كلام كبير ومقروء على الفيديو لأن ناس كتير بتتفرج من غير صوت.</p>

<h2>5. ودّي العميل لمكان واضح</h2>
<p>العميل داس على الإعلان، وبعدين؟ لازم يلاقي خطوة واحدة سهلة: زرار واتساب برسالة جاهزة، أو صفحة فيها العرض والسعر وطريقة الطلب. كل ما الخطوات تقل، كل ما العملاء يزيدوا.</p>

<blockquote class="tip"><strong>نصيحة:</strong> لو بتعلن عن طريق موقع، ركّب بيكسل فيسبوك (Meta Pixel) على الموقع من أول يوم. ده بيخلّي المنصة تتعلم مين اللي بيشتري فعلًا، وبيسمحلك تعمل إعلانات للناس اللي زاروا موقعك قبل كده.</blockquote>

<h2>6. ابدأ صغير واختبر</h2>
<p>متحطش الميزانية كلها على إعلان واحد. اعمل نسختين أو تلاتة بصور أو نصوص مختلفة بميزانية صغيرة لكام يوم، وسيب الأرقام هي اللي تقولك مين الأحسن. بعد كده زوّد الميزانية على الإعلان الكسبان وقفّل الباقي.</p>

<h2>7. تابع الأرقام اللي تفرق</h2>
<p>اللايكات والمشاهدات حلوة، لكنها مش هي اللي بتدفع الفواتير. الأرقام اللي تهمك:</p>
<ul>
  <li><strong>تكلفة الرسالة أو العميل المحتمل:</strong> كل رسالة على واتساب بتكلفك كام؟</li>
  <li><strong>نسبة الضغط على الإعلان (CTR):</strong> لو قليلة، غالبًا المشكلة في الصورة أو الرسالة.</li>
  <li><strong>تكلفة البيعة:</strong> في الآخر، كل عميل جديد بيكلفك كام، وبيكسّبك كام؟</li>
</ul>

<h2>الخلاصة</h2>
<p>الإعلان الناجح مش حظ: هدف واضح، جمهور صح، رسالة قوية، خطوة سهلة للعميل، واختبار مستمر. لو حاسس إن إعلاناتك بتصرف ومش بتجيب، ابعتلي لينك صفحتك وأنا أقولك ممكن تتحسن إزاي.</p>
"""
  },
  "en": {
    "title": "Your Guide to a Successful Facebook & Instagram Ad",
    "desc": "7 practical steps to make your paid ads bring real customers — not just likes — from setting the goal to reading the right numbers.",
    "body": """
<p>Many business owners spend money on paid ads and end up saying "ads don't work." In reality the problem is rarely the platform or the budget — it's how the ad is built. This guide walks through the basics that separate an ad that burns money from one that brings customers.</p>

<h2>1. Pick one clear goal first</h2>
<p>Before opening Ads Manager, ask yourself: what exactly do I want from this ad? WhatsApp messages? Website visits? Store sales? Each goal has its own setup, and the platform shows your ad to the people most likely to take the action you chose. Choose "engagement" when you want sales and you'll get plenty of likes and very few sales.</p>

<h2>2. Know your audience precisely</h2>
<p>"Everyone" is not an audience. Think about your real customer: their age, where they live, what they care about and what they search for. If you serve customers in Kuwait, target the areas you actually serve instead of the whole country. If your product is for women aged 25–40 in Egypt, start there and widen once you see results.</p>

<h2>3. The offer and message matter more than the budget</h2>
<p>A small budget with a strong message beats a big budget with a weak one. A strong message answers one question in the customer's mind: "what's in it for me?" Write the benefit, not the specs, and give a reason to act now — a limited-time offer or a free consultation.</p>

<h2>4. The first 3 seconds are everything</h2>
<p>People scroll fast. If the image or video doesn't grab attention immediately, the ad is forgotten. Open the video with the result or the problem you solve, use clear colors, and add large readable text — many people watch without sound.</p>

<h2>5. Send the customer somewhere clear</h2>
<p>The customer tapped your ad — now what? They should find one easy next step: a WhatsApp button with a ready message, or a page with the offer, the price and how to order. Fewer steps means more customers.</p>

<blockquote class="tip"><strong>Tip:</strong> If you advertise through a website, install the Meta Pixel from day one. It helps the platform learn who actually buys, and lets you retarget people who already visited your site.</blockquote>

<h2>6. Start small and test</h2>
<p>Don't put the whole budget on one ad. Run two or three versions with different images or copy on a small budget for a few days, and let the numbers decide the winner. Then scale the winner and switch off the rest.</p>

<h2>7. Track the numbers that matter</h2>
<p>Likes and views are nice, but they don't pay the bills. The numbers that matter:</p>
<ul>
  <li><strong>Cost per message or lead:</strong> how much does each WhatsApp conversation cost you?</li>
  <li><strong>Click-through rate (CTR):</strong> if it's low, the image or message is usually the problem.</li>
  <li><strong>Cost per sale:</strong> in the end, how much does each new customer cost — and earn — you?</li>
</ul>

<h2>The bottom line</h2>
<p>A successful ad isn't luck: a clear goal, the right audience, a strong message, an easy next step and constant testing. If your ads spend without delivering, send me your page link and I'll tell you how they can improve.</p>
"""
  }
},
{
  "slug": "why-your-business-needs-a-website",
  "date": "2026-10-09",
  "icon": "web",
  "ar": {
    "title": "ليه مشروعك محتاج موقع حتى لو عندك صفحة فيسبوك؟",
    "desc": "صفحة السوشيال ميديا مهمة، لكنها مش كفاية. اعرف 6 أسباب تخلّي الموقع الإلكتروني استثمار حقيقي لمشروعك.",
    "body": """
<p>"أنا عندي صفحة فيسبوك وإنستجرام، أعمل موقع ليه؟" ده من أكتر الأسئلة اللي بتجيلي. السوشيال ميديا مهمة جدًا، لكن الاعتماد عليها لوحدها فيه مخاطر وفرص ضايعة كتير. خلّينا نشوف ليه.</p>

<h2>1. الصفحة مش ملكك، الموقع ملكك</h2>
<p>صفحتك على فيسبوك أو إنستجرام موجودة على أرض حد تاني. لو الحساب اتقفل أو اتهكر، أو المنصة غيّرت طريقة عرض المنشورات، ممكن تخسر وصولك لعملائك في يوم وليلة. الموقع بدومين باسمك هو المكان الوحيد اللي إنت متحكم فيه بالكامل.</p>

<h2>2. الموقع بيظهر في جوجل</h2>
<p>لما حد يدوّر على "تصميم مطابخ في الكويت" أو "دكتور أسنان في المعادي"، جوجل بيعرض مواقع، مش منشورات فيسبوك. الموقع المجهّز صح للظهور في جوجل بيجيبلك عملاء بيدوّروا على خدمتك بالفعل، ومن غير ما تدفع على كل زيارة.</p>

<h2>3. ثقة واحترافية من أول نظرة</h2>
<p>العميل اللي هيدفع مبلغ محترم عايز يطمن إنه بيتعامل مع جهة جادة. موقع منظم فيه خدماتك وأعمالك وطرق التواصل بيدّي انطباع إنك محترف، خصوصًا مع العملاء في الخليج والشركات.</p>

<h2>4. كل معلوماتك في مكان واحد</h2>
<p>بدل ما العميل يقلّب في منشورات قديمة عشان يعرف الأسعار أو العنوان أو مواعيد الشغل، يلاقي كل حاجة مرتبة في صفحة واحدة: الخدمات، الأسئلة الشائعة، والطريقة الأسهل للتواصل.</p>

<h2>5. إعلاناتك بتشتغل أحسن مع موقع</h2>
<p>لما توجّه إعلاناتك لموقعك، تقدر تركّب أدوات زي Meta Pixel وGoogle Analytics، فتعرف مين زار وإيه اللي عجبه، وتعمل إعلانات مخصوص للناس اللي زاروك قبل كده. ده بيقلل تكلفة العميل بشكل واضح مع الوقت.</p>

<blockquote class="tip"><strong>نصيحة:</strong> مش لازم تبدأ بموقع كبير ومكلف. صفحة واحدة احترافية فيها خدماتك وزرار واتساب كفاية جدًا كبداية، وتكبّرها بعدين مع نمو مشروعك.</blockquote>

<h2>6. بتشتغل لك 24 ساعة</h2>
<p>الموقع بيرد على أسئلة العميل وبيعرض شغلك وبيستقبل طلبات حتى وإنت نايم. ومع فورم طلب أو زرار واتساب برسالة جاهزة، العميل يقدر يطلب في أي وقت.</p>

<h2>الخلاصة</h2>
<p>السوشيال ميديا بتعرّف الناس بيك، والموقع بيحوّلهم لعملاء. الاتنين مع بعض هما التركيبة الأقوى. لو عايز تعرف موقع مشروعك ممكن يبقى شكله إيه، ابعتلي وأنا أقولك.</p>
"""
  },
  "en": {
    "title": "Why Your Business Needs a Website Even If You Have a Facebook Page",
    "desc": "Social media pages matter, but they're not enough. Here are 6 reasons a website is a real investment for your business.",
    "body": """
<p>"I already have Facebook and Instagram pages — why do I need a website?" It's one of the questions I hear most. Social media is very important, but relying on it alone carries real risks and missed opportunities. Let's see why.</p>

<h2>1. Your page isn't yours — your website is</h2>
<p>Your Facebook or Instagram page lives on someone else's land. If the account is suspended or hacked, or the platform changes how posts are shown, you can lose access to your customers overnight. A website on your own domain is the one place you fully control.</p>

<h2>2. Websites show up on Google</h2>
<p>When someone searches "kitchen design in Kuwait" or "dentist in Maadi," Google shows websites, not Facebook posts. A website built to rank brings you customers who are already looking for your service — without paying for every visit.</p>

<h2>3. Trust and professionalism at first glance</h2>
<p>A customer about to spend real money wants to know they're dealing with a serious business. A well-organized site with your services, work and contact details signals professionalism — especially to Gulf clients and companies.</p>

<h2>4. All your information in one place</h2>
<p>Instead of scrolling through old posts to find prices, your address or opening hours, the customer finds everything neatly on one page: services, FAQs and the easiest way to reach you.</p>

<h2>5. Your ads work better with a website</h2>
<p>When ads point to your own site, you can install tools like the Meta Pixel and Google Analytics, see who visited and what they liked, and run ads specifically for past visitors. Over time this clearly lowers your cost per customer.</p>

<blockquote class="tip"><strong>Tip:</strong> You don't need to start with a big, expensive site. One professional page with your services and a WhatsApp button is a great start — grow it as your business grows.</blockquote>

<h2>6. It works for you 24/7</h2>
<p>Your website answers questions, shows your work and takes requests even while you sleep. With a request form or a WhatsApp button with a ready message, customers can reach you any time.</p>

<h2>The bottom line</h2>
<p>Social media introduces people to you; a website turns them into customers. Together they're the strongest combination. If you'd like to see what your business website could look like, get in touch.</p>
"""
  }
},
{
  "slug": "google-maps-business-listing",
  "date": "2026-10-09",
  "icon": "maps",
  "ar": {
    "title": "إزاي نشاطك يظهر على خرايط جوجل ويجيبلك عملاء من منطقتك",
    "desc": "خطوات عملية لتسجيل نشاطك على Google Business Profile وتظبيطه عشان يظهر لكل اللي بيدوّر على خدمتك في منطقتك.",
    "body": """
<p>لما حد يكتب في جوجل "مطعم قريب مني" أو "صيانة تكييف في حولي"، أول حاجة بتظهر له خريطة فيها 3 أنشطة. الظهور في المكان ده من أقوى مصادر العملاء للمحلات والشركات المحلية، والخبر الحلو إنه مجاني. التسجيل بيتم عن طريق <strong>Google Business Profile</strong>، وده اللي هنشرحه.</p>

<h2>1. اعمل ملف النشاط</h2>
<p>ادخل على Google Business Profile بحساب جوجل بتاعك، واكتب اسم نشاطك. لو النشاط موجود بالفعل على الخريطة (أحيانًا العملاء بيضيفوه)، اطلب ملكيته بدل ما تعمل واحد جديد عشان متعملش تكرار.</p>

<h2>2. اكتب الاسم الحقيقي بس</h2>
<p>اكتب اسم نشاطك زي ما هو على اليافطة. من الأخطاء الشائعة إن الناس تزوّد كلمات في الاسم زي "أفضل سباك في الكويت 24 ساعة". ده مخالف لإرشادات جوجل وممكن يعرّض الملف للإيقاف.</p>

<h2>3. اختار التصنيف الصح</h2>
<p>التصنيف الأساسي من أهم العوامل اللي جوجل بيعتمد عليها عشان يعرف يعرضك لمين. اختار التصنيف الأدق لنشاطك، وضيف تصنيفات إضافية للخدمات التانية اللي بتقدمها.</p>

<h2>4. أكّد النشاط</h2>
<p>جوجل بيطلب تأكيد إن النشاط حقيقي وإنك صاحبه، وطريقة التأكيد بتختلف حسب النشاط والبلد: ممكن تكون فيديو قصير للمكان، أو رسالة، أو مكالمة. من غير التأكيد، الملف مش هيظهر بشكل كامل.</p>

<h2>5. كمّل كل البيانات</h2>
<ul>
  <li><strong>مواعيد العمل:</strong> بدقة، وحدّثها في الإجازات والمواسم.</li>
  <li><strong>رقم التليفون ولينك الموقع أو الواتساب:</strong> عشان العميل يتواصل بضغطة.</li>
  <li><strong>المناطق اللي بتخدمها:</strong> لو بتروح للعميل في بيته.</li>
  <li><strong>وصف واضح:</strong> بتقدم إيه ولمين، بكلام بسيط.</li>
  <li><strong>الخدمات أو المنتجات:</strong> مع الأسعار لو تقدر.</li>
</ul>

<h2>6. الصور بتفرق جدًا</h2>
<p>ضيف صور حقيقية وواضحة: الواجهة من برا عشان الناس تعرف المكان، الشغل من جوه، المنتجات، والفريق. الأنشطة اللي فيها صور كتير وحديثة بتاخد اهتمام أكتر من الناس.</p>

<blockquote class="tip"><strong>نصيحة:</strong> التقييمات من أهم أسباب ظهورك واختيار العميل ليك. اطلب من كل عميل مبسوط يكتب تقييم، وابعتله اللينك المباشر لصفحة التقييم عشان يسهل عليه. ورد على كل التقييمات، الحلوة والوحشة، بأسلوب محترم.</blockquote>

<h2>7. خليك نشيط</h2>
<p>انشر تحديثات وعروض على الملف من وقت للتاني، ورد على أسئلة الناس. الملف النشيط والمتحدّث بيدّي انطباع إن النشاط شغال وموثوق.</p>

<h2>الخلاصة</h2>
<p>ملف Google Business متظبط صح ممكن يبقى أرخص وأقوى مصدر عملاء لنشاطك المحلي. لو عايز أسجلهولك وأظبطه من الأول للآخر، كلّمني.</p>
"""
  },
  "en": {
    "title": "How to Get Your Business on Google Maps and Win Local Customers",
    "desc": "Practical steps to set up and optimize your Google Business Profile so you show up for everyone searching for your service nearby.",
    "body": """
<p>When someone searches "restaurant near me" or "AC repair in Hawalli," the first thing they see is a map with three businesses. Showing up there is one of the strongest sources of customers for local shops and companies — and it's free. You do it through <strong>Google Business Profile</strong>, which is what this guide covers.</p>

<h2>1. Create your profile</h2>
<p>Go to Google Business Profile with your Google account and type your business name. If your business already appears on the map (customers sometimes add it), claim it instead of creating a new one to avoid duplicates.</p>

<h2>2. Use your real name only</h2>
<p>Enter your business name exactly as it appears on your sign. A common mistake is stuffing extra words into the name, like "Best Plumber in Kuwait 24 Hours." That breaks Google's guidelines and can get the profile suspended.</p>

<h2>3. Choose the right category</h2>
<p>Your primary category is one of the most important signals Google uses to decide who sees you. Pick the most accurate category for your business, then add secondary categories for your other services.</p>

<h2>4. Verify your business</h2>
<p>Google asks you to confirm the business is real and that you own it. The method depends on the business and country — it may be a short video of the location, a message or a phone call. Without verification the profile won't show fully.</p>

<h2>5. Complete every detail</h2>
<ul>
  <li><strong>Opening hours:</strong> accurate, and updated for holidays and seasons.</li>
  <li><strong>Phone and website or WhatsApp link:</strong> so customers can reach you in one tap.</li>
  <li><strong>Service areas:</strong> if you visit customers at home.</li>
  <li><strong>A clear description:</strong> what you offer and to whom, in simple words.</li>
  <li><strong>Services or products:</strong> with prices if you can.</li>
</ul>

<h2>6. Photos make a big difference</h2>
<p>Add real, clear photos: the storefront so people recognize the place, the inside, your work, your products and your team. Businesses with plenty of recent photos get more attention.</p>

<blockquote class="tip"><strong>Tip:</strong> Reviews are one of the biggest reasons you show up — and get chosen. Ask every happy customer for a review and send them the direct review link to make it easy. Reply to every review, good or bad, politely.</blockquote>

<h2>7. Stay active</h2>
<p>Post updates and offers on your profile from time to time and answer people's questions. An active, up-to-date profile tells customers the business is open and trustworthy.</p>

<h2>The bottom line</h2>
<p>A well-optimized Google Business Profile can be the cheapest and strongest source of customers for a local business. If you'd like me to set it up and optimize it for you from start to finish, get in touch.</p>
"""
  }
},
]
