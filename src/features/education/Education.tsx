import { useState } from 'react';
import { ChevronRight, BookOpen, HeartPulse, Shield, Baby, GraduationCap } from 'lucide-react';
import { useTheme } from '@/lib/theme-context';
import type { PageId } from '@/components/AppShell';

interface Article {
  id: string;
  title: string;
  summary: string;
  category: string;
}

interface Category {
  id: string;
  label: string;
  icon: typeof BookOpen;
  color: string;
  articles: Article[];
}

const categories: Category[] = [
  {
    id: 'menstrual',
    label: 'Menstrual Health',
    icon: HeartPulse,
    color: 'bg-primary',
    articles: [
      { id: 'period-basics', title: 'Period Basics', summary: 'Understanding the menstrual cycle and what happens during a period.', category: 'menstrual' },
      { id: 'pms', title: 'PMS', summary: 'Premenstrual syndrome: symptoms, causes, and management.', category: 'menstrual' },
      { id: 'period-pain', title: 'Period Pain', summary: 'Why periods cause cramps and how to find relief.', category: 'menstrual' },
      { id: 'pcos', title: 'PCOS', summary: 'Polycystic Ovary Syndrome: signs, symptoms, and management.', category: 'menstrual' },
      { id: 'endometriosis', title: 'Endometriosis', summary: 'Understanding endometriosis and when to seek help.', category: 'menstrual' },
      { id: 'hygiene', title: 'Menstrual Hygiene', summary: 'Best practices for menstrual hygiene and product safety.', category: 'menstrual' },
    ],
  },
  {
    id: 'wellness',
    label: 'Wellness',
    icon: BookOpen,
    color: 'bg-success',
    articles: [
      { id: 'nutrition', title: 'Nutrition', summary: 'How nutrition affects your menstrual health.', category: 'wellness' },
      { id: 'exercise', title: 'Exercise', summary: 'Exercise and your cycle: what to know.', category: 'wellness' },
      { id: 'mental-wellbeing', title: 'Mental Wellbeing', summary: 'Mental health and the menstrual cycle.', category: 'wellness' },
    ],
  },
  {
    id: 'reproductive',
    label: 'Reproductive Health',
    icon: HeartPulse,
    color: 'bg-accent',
    articles: [
      { id: 'fertility', title: 'Understanding Fertility', summary: 'The basics of fertility and the menstrual cycle.', category: 'reproductive' },
      { id: 'ovulation', title: 'Ovulation', summary: 'What happens during ovulation and why it matters.', category: 'reproductive' },
      { id: 'contraception', title: 'Contraception Basics', summary: 'Understanding birth control options.', category: 'reproductive' },
    ],
  },
  {
    id: 'sexual',
    label: 'Sexual Health',
    icon: Shield,
    color: 'bg-warning',
    articles: [
      { id: 'consent', title: 'Consent & Relationships', summary: 'Understanding consent and healthy relationships.', category: 'sexual' },
      { id: 'safe-sex', title: 'Safe Sex', summary: 'Practising safe sex and preventing STIs.', category: 'sexual' },
      { id: 'stis', title: 'STIs', summary: 'Common STIs, symptoms, and testing.', category: 'sexual' },
    ],
  },
  {
    id: 'pregnancy',
    label: 'Pregnancy',
    icon: Baby,
    color: 'bg-primary',
    articles: [
      { id: 'pregnancy-basics', title: 'Early Pregnancy Basics', summary: 'Signs of early pregnancy and what to expect.', category: 'pregnancy' },
      { id: 'prenatal', title: 'Prenatal Care', summary: 'Basics of prenatal care and nutrition.', category: 'pregnancy' },
      { id: 'warning-signs', title: 'Warning Signs', summary: 'When to contact a healthcare professional during pregnancy.', category: 'pregnancy' },
    ],
  },
  {
    id: 'medical',
    label: 'When to Seek Medical Care',
    icon: GraduationCap,
    color: 'bg-error',
    articles: [
      { id: 'when-to-see-doctor', title: 'When to See a Doctor', summary: 'Signs and symptoms that warrant medical attention.', category: 'medical' },
      { id: 'what-to-track', title: 'What to Track Before a Visit', summary: 'How to prepare for a productive doctor visit.', category: 'medical' },
    ],
  },
];

export const articleContent: Record<string, { content: string; references: string[] }> = {
  'period-basics': {
    content: `The menstrual cycle is the monthly process a woman's body goes through to prepare for possible pregnancy. Each cycle typically lasts between 21 and 35 days, with periods lasting 2 to 7 days.

The cycle has four phases:
1. Menstrual phase (days 1-5): The uterine lining sheds, causing bleeding.
2. Follicular phase (days 1-13): Hormones stimulate egg development.
3. Ovulation (around day 14): An egg is released from the ovary.
4. Luteal phase (days 15-28): The body prepares for possible pregnancy.

It's normal for cycles to vary slightly. What matters most is what is normal for you. Significant changes in your cycle pattern should be discussed with a healthcare professional.`,
    references: ['World Health Organization (WHO) - Menstrual Health', 'Mayo Clinic - Menstrual Cycle'],
  },
  'pms': {
    content: `Premenstrual Syndrome (PMS) refers to physical and emotional symptoms that occur in the days or weeks before a period. Up to 75% of menstruating people experience some form of PMS.

Common symptoms include:
- Mood changes: irritability, anxiety, sadness
- Physical: bloating, breast tenderness, fatigue, headaches
- Sleep disturbances
- Food cravings

Most PMS symptoms are mild and manageable. However, if symptoms significantly impact your daily life, relationships, or work, you may have Premenstrual Dysphoric Disorder (PMDD), which should be discussed with a healthcare professional.

Management strategies include regular exercise, a balanced diet, stress reduction, and adequate sleep. Over-the-counter pain relievers can help with physical symptoms.`,
    references: ['Mayo Clinic - PMS', 'Office on Women\'s Health - PMS'],
  },
  'period-pain': {
    content: `Period pain (dysmenorrhea) is caused by the uterus contracting to shed its lining. These contractions are triggered by prostaglandins, hormone-like substances that promote inflammation and pain.

Mild to moderate cramps are normal and can be managed with:
- Heat therapy (heating pad or hot water bottle)
- Gentle exercise and stretching
- Over-the-counter pain relievers (ibuprofen, naproxen)
- Staying hydrated
- Rest

Severe pain that interferes with daily activities, or pain that worsens over time, should be evaluated by a healthcare professional. It could indicate conditions like endometriosis or fibroids.`,
    references: ['Mayo Clinic - Menstrual Cramps', 'ACOG - Dysmenorrhea'],
  },
  'pcos': {
    content: `Polycystic Ovary Syndrome (PCOS) is a common hormonal condition affecting approximately 1 in 10 women of reproductive age. It is characterised by hormonal imbalance, irregular periods, and sometimes polycystic ovaries.

Common signs include:
- Irregular or absent periods
- Excess hair growth on face or body
- Acne or oily skin
- Weight changes or difficulty losing weight
- Thinning hair

PCOS cannot be self-diagnosed. Only a healthcare professional can diagnose PCOS through clinical evaluation, blood tests, and ultrasound. While there is no cure, symptoms can be managed through lifestyle changes, medication, and regular monitoring.

If you suspect you may have PCOS, speak with a healthcare professional for proper evaluation.`,
    references: ['PCOS Awareness Association', 'Mayo Clinic - PCOS', 'Office on Women\'s Health - PCOS'],
  },
  'endometriosis': {
    content: `Endometriosis is a condition where tissue similar to the uterine lining grows outside the uterus, most commonly on the ovaries, fallopian tubes, and pelvic tissue. It affects approximately 1 in 10 women.

Symptoms can include:
- Severe period pain (worse than typical cramps)
- Pain during or after intercourse
- Chronic pelvic pain
- Heavy or irregular bleeding
- Painful urination or bowel movements during periods

Endometriosis can only be definitively diagnosed through laparoscopy, a minimally invasive surgical procedure. If you experience severe period pain that disrupts your daily life, speak with a gynaecologist.

Early diagnosis and management can help prevent the condition from worsening and improve quality of life.`,
    references: ['Endometriosis Foundation of America', 'Mayo Clinic - Endometriosis', 'World Endometriosis Society'],
  },
  'hygiene': {
    content: `Maintaining good menstrual hygiene is essential for preventing infections and ensuring comfort during your period.

Key practices:
- Change sanitary products every 4-6 hours (pads, tampons) or as needed
- Wash hands before and after changing products
- Use clean water for washing the genital area; avoid harsh soaps or douching
- Choose products that are comfortable and appropriate for your flow
- Dispose of used products properly, wrapped in paper
- Wear clean, breathable underwear

If you experience itching, unusual odour, or irritation, consider switching products and consulting a healthcare professional if symptoms persist.`,
    references: ['UNICEF - Menstrual Hygiene Management', 'WHO - Menstrual Health and Hygiene'],
  },
  'nutrition': {
    content: `Nutrition plays an important role in menstrual health. A balanced diet can help manage symptoms and support overall wellbeing.

Key nutrients:
- Iron: Important to replenish losses during menstruation. Found in leafy greens, beans, and lean meats.
- Calcium and Vitamin D: May help reduce PMS symptoms.
- Magnesium: Can help with cramps and mood. Found in nuts, seeds, and dark chocolate.
- Omega-3 fatty acids: Have anti-inflammatory properties that may reduce period pain.
- Vitamin B6: May help with mood symptoms.

Avoid excessive caffeine, salt, and sugar, especially before your period, as these can worsen symptoms like bloating and mood changes.

A healthcare professional or registered dietitian can provide personalised nutrition advice.`,
    references: ['Academy of Nutrition and Dietetics', 'Harvard T.H. Chan School of Public Health'],
  },
  'exercise': {
    content: `Regular exercise benefits menstrual health by reducing stress, improving mood, and potentially easing period symptoms.

During your period:
- Light to moderate exercise (walking, yoga, swimming) can help reduce cramps and improve mood
- Listen to your body — rest if you need to
- Stretching can relieve tension in the lower back and abdomen

Throughout your cycle:
- Regular physical activity can help regulate hormones
- Strength training supports bone health, which is important for long-term health
- Avoid overtraining, as excessive exercise can disrupt menstrual cycles

If exercise causes pain or your periods stop, consult a healthcare professional.`,
    references: ['ACOG - Exercise During Menstruation', 'American College of Sports Medicine'],
  },
  'mental-wellbeing': {
    content: `Mental health and the menstrual cycle are closely connected. Hormonal changes throughout the cycle can affect mood, energy, and emotional wellbeing.

Common experiences:
- Mood changes before or during your period (PMS)
- Anxiety or low mood during certain phases
- Changes in energy levels
- Difficulty concentrating

When to seek help:
- If mood changes significantly impact your daily life
- If you experience severe depression, anxiety, or thoughts of self-harm
- If symptoms occur consistently around the same cycle phase

Speaking with a mental health professional or healthcare provider can help you understand and manage these changes. You don't have to navigate this alone.`,
    references: ['National Institute of Mental Health', 'Office on Women\'s Health - Mental Health'],
  },
  'fertility': {
    content: `Fertility refers to the ability to conceive. Understanding your menstrual cycle can help you identify your fertile window — the days when pregnancy is most likely.

Key facts:
- A woman's most fertile days are typically 5 days before ovulation through 1 day after
- Ovulation usually occurs about 14 days before the next period
- Sperm can survive up to 5 days in the reproductive tract
- An egg is viable for about 12-24 hours after ovulation

Important note: Cycle and fertility window predictions from apps are estimates and should not be used as a reliable method of contraception. If you are trying to conceive or avoid pregnancy, consider speaking with a healthcare professional about appropriate methods.`,
    references: ['ACOG - Fertility Awareness', 'Mayo Clinic - Fertility'],
  },
  'ovulation': {
    content: `Ovulation is the release of a mature egg from the ovary, typically occurring around the middle of the menstrual cycle.

Signs of ovulation may include:
- Changes in cervical mucus (becomes clear and stretchy)
- A slight increase in basal body temperature
- Mild pelvic or abdominal pain (mittelschmerz)
- Increased libido

The egg is viable for about 12-24 hours after release. If not fertilised, it dissolves and the cycle continues to the luteal phase.

Tracking ovulation can help with understanding your cycle, whether for conception or general awareness. However, calendar-based predictions are estimates and may not be accurate for everyone.`,
    references: ['Mayo Clinic - Ovulation', 'ACOG - Fertility Awareness'],
  },
  'contraception': {
    content: `Contraception (birth control) methods prevent pregnancy. There are several types, each with different effectiveness and considerations.

Hormonal methods: Pills, patches, injections, implants, and vaginal rings. These use hormones to prevent ovulation or thicken cervical mucus. Typically 91-99% effective.

Barrier methods: Condoms (male and female), diaphragms, and cervical caps. These physically block sperm. Condoms also provide STI protection. Typically 72-88% effective with typical use.

Intrauterine devices (IUDs): Small devices inserted into the uterus. Hormonal and copper options. Over 99% effective.

Fertility awareness methods: Tracking cycle signs to avoid intercourse on fertile days. 76-88% effective with typical use. Not recommended as sole contraception.

Permanent methods: Tubal ligation and vasectomy. Essentially 100% effective.

A healthcare professional can help you choose the right method based on your health, lifestyle, and preferences.`,
    references: ['CDC - Contraception', 'WHO - Family Planning', 'Planned Parenthood'],
  },
  'consent': {
    content: `Consent is a clear, voluntary, and informed agreement to engage in any activity, including sexual activity. It is a fundamental aspect of healthy relationships.

Consent must be:
- Freely given: No pressure, coercion, or manipulation
- Reversible: Can be withdrawn at any time
- Informed: You know what you're agreeing to
- Enthusiastic: You actively want to participate
- Specific: Agreeing to one thing doesn't mean agreeing to everything

Consent is NOT:
- Silence or lack of resistance
- Implied by clothing, relationship status, or past behaviour
- Possible when someone is intoxicated, asleep, or unable to make decisions

Healthy relationships are built on mutual respect, communication, and trust. If you or someone you know has experienced non-consensual contact, support is available through local helplines and healthcare providers.`,
    references: ['RAINN (Rape, Abuse & Incest National Network)', 'Love Is Respect'],
  },
  'safe-sex': {
    content: `Practising safe sex protects against both unintended pregnancy and sexually transmitted infections (STIs).

Key practices:
- Use condoms correctly and consistently (the only method that also protects against STIs)
- Get tested regularly for STIs, especially with new partners
- Communicate openly with partners about sexual health
- Consider vaccinations (HPV, Hepatitis B)
- Use additional contraception if pregnancy is not desired

Remember:
- Many STIs have no symptoms
- Oral sex can also transmit STIs — use protection
- Regular check-ups are important even if you feel healthy

If you are sexually active, regular STI testing is an important part of your health routine. A healthcare professional can advise on appropriate testing frequency.`,
    references: ['CDC - Sexual Health', 'WHO - Sexual and Reproductive Health'],
  },
  'stis': {
    content: `Sexually Transmitted Infections (STIs) are infections passed through sexual contact. Many STIs may not cause symptoms, making regular testing important.

Common STIs:
- Chlamydia: Often asymptomatic. Can cause discharge, pain. Treatable with antibiotics.
- Gonorrhoea: Similar to chlamydia. Treatable with antibiotics.
- HPV: Very common. Some strains cause genital warts; others can lead to cervical cancer. Vaccine available.
- Herpes: Causes outbreaks of sores. Manageable but not curable.
- HIV: Affects the immune system. Manageable with medication.

Prevention:
- Use condoms
- Get vaccinated (HPV, Hepatitis B)
- Get tested regularly
- Communicate with partners

If you suspect you have an STI, seek medical care promptly. Most STIs are treatable, and early detection prevents complications.`,
    references: ['CDC - STI/STD', 'WHO - STIs', 'Planned Parenthood - STIs'],
  },
  'pregnancy-basics': {
    content: `Early pregnancy can bring various physical and emotional changes. This information is educational and does not assume you are pregnant.

Common early signs of pregnancy:
- Missed period
- Nausea or vomiting (morning sickness)
- Breast tenderness
- Fatigue
- Frequent urination
- Light spotting (implantation bleeding)

If you suspect you might be pregnant:
- Take a home pregnancy test (most accurate after a missed period)
- Confirm with a healthcare professional
- Begin prenatal care if pregnant

Pregnancy tests detect the hormone hCG in urine. For the most accurate results, test after a missed period or at least 21 days after potential conception.

This information is general. If you have questions or concerns about pregnancy, speak with a healthcare professional.`,
    references: ['Mayo Clinic - Pregnancy', 'ACOG - Early Pregnancy', 'Planned Parenthood - Pregnancy'],
  },
  'prenatal': {
    content: `Prenatal care is the healthcare you receive during pregnancy. It helps ensure the health of both the pregnant person and the developing baby.

Key components of prenatal care:
- Regular check-ups (typically monthly, then more frequent later)
- Blood tests and screenings
- Ultrasounds to monitor development
- Nutritional guidance
- Discussion of any concerns

Nutrition basics during pregnancy:
- Folic acid (400-800 mcg daily) is important, especially in early pregnancy
- Iron, calcium, and protein needs increase
- Avoid alcohol, tobacco, and certain medications
- Limit caffeine

If you are pregnant or planning pregnancy, consult a healthcare professional for personalised guidance. This information is educational and not a substitute for medical care.`,
    references: ['ACOG - Prenatal Care', 'Mayo Clinic - Pregnancy Week by Week', 'CDC - Pregnancy'],
  },
  'warning-signs': {
    content: `During pregnancy, certain symptoms warrant immediate medical attention. This is educational information and not a substitute for professional medical advice.

Seek immediate medical care if you experience:
- Heavy vaginal bleeding
- Severe abdominal pain
- Severe headache with vision changes
- High fever
- Severe vomiting or inability to keep fluids down
- Sudden swelling of face or hands
- Decreased fetal movement (after 20 weeks)
- Signs of preterm labour (regular contractions before 37 weeks)

When in doubt, always contact your healthcare provider or seek emergency care. It's always better to be safe.

If you believe you are experiencing a medical emergency, contact your local emergency service or seek immediate medical care.`,
    references: ['ACOG - Warning Signs During Pregnancy', 'Mayo Clinic - Pregnancy Complications'],
  },
  'when-to-see-doctor': {
    content: `Knowing when to seek medical care for menstrual or reproductive health is important. Here are general guidelines.

Consider seeing a healthcare professional if you experience:
- Periods that are consistently irregular (cycle < 21 or > 35 days)
- Very heavy bleeding (soaking through a pad/tampon every hour)
- Periods lasting longer than 7 days
- Severe pain that interferes with daily activities
- Bleeding between periods
- No period for 3+ months (and not pregnant)
- Sudden changes in your cycle pattern
- Unusual discharge or odour
- Pain during intercourse
- Symptoms of possible infection

You don't need to wait for symptoms to be "severe enough." If something concerns you, it's valid to seek care.

If you believe you are experiencing a medical emergency, contact your local emergency service or seek immediate medical care.`,
    references: ['ACOG - When to See a Gynaecologist', 'Mayo Clinic - Menstrual Problems'],
  },
  'what-to-track': {
    content: `Preparing for a doctor's visit with good tracking data can help your healthcare provider give you better care.

Consider tracking and sharing:
- Period dates (start and end)
- Cycle length
- Flow intensity (light, medium, heavy)
- Pain levels (0-10 scale) and when they occur
- Symptoms and their timing relative to your cycle
- Mood changes
- Any medications or supplements
- Questions or concerns you want to discuss

The FemCare+ Health Report feature can generate a summary of your logged data that you can share with your healthcare provider.

Being prepared helps you make the most of your appointment and ensures your concerns are addressed.`,
    references: ['ACOG - Preparing for Your Visit', 'Mayo Clinic - What to Ask Your Doctor'],
  },
};

export default function Education({ onNavigate }: { onNavigate?: (p: PageId) => void }) {
  const { t } = useTheme();
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  if (selectedArticle) {
    const content = articleContent[selectedArticle.id];
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => setSelectedArticle(null)} className="btn-ghost text-sm">
          <ChevronRight className="rotate-180" size={16} /> Back to Education
        </button>
        <div className="card">
          <h1 className="text-xl font-bold text-ink dark:text-gray-100 mb-2">{selectedArticle.title}</h1>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark mb-4">{selectedArticle.summary}</p>
          {content ? (
            <>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {content.content.split('\n\n').map((para, i) => (
                  <p key={i} className="text-sm text-ink dark:text-gray-200 mb-3 leading-relaxed">{para}</p>
                ))}
              </div>
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-ink-muted dark:text-ink-muted-dark mb-2">References:</p>
                <ul className="space-y-1">
                  {content.references.map((ref, i) => (
                    <li key={i} className="text-xs text-ink-muted dark:text-ink-muted-dark">• {ref}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Content coming soon.</p>
          )}
        </div>
        <div className="card bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-900">
          <p className="text-sm text-ink dark:text-gray-200">
            This information is general health education and is not a substitute for professional medical advice. If you have specific concerns, please consult a qualified healthcare professional.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Health Education</h1>

      {categories.map(cat => {
        const Icon = cat.icon;
        return (
          <div key={cat.id}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-lg ${cat.color} flex items-center justify-center`}>
                <Icon size={16} className="text-white" />
              </div>
              <h2 className="section-title">{cat.label}</h2>
            </div>
            <div className="space-y-2">
              {cat.articles.map(article => (
                <button
                  key={article.id}
                  onClick={() => setSelectedArticle(article)}
                  className="card w-full text-left flex items-center gap-3 hover:shadow-md transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink dark:text-gray-100">{article.title}</p>
                    <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">{article.summary}</p>
                  </div>
                  <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
